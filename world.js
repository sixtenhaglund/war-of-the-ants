/* World generation, rock queries, and the fog of war. */

function buildWorld() {
  // The WHOLE world starts as solid rock...
  grid = new Array(COLS * ROWS).fill(true);
  hard = new Uint8Array(COLS * ROWS);
  hits = new Uint8Array(COLS * ROWS);
  explored = new Uint8Array(COLS * ROWS);
  visible  = new Uint8Array(COLS * ROWS);
  for (let i = 0; i < hard.length; i++) if (Math.random() < ROCK_CHANCE) hard[i] = 1;
  // scatter tough 2×2 BIG ROCK blocks (10 hp) — rare, hard walls to dig around
  for (let n = 0; n < BIGROCK_COUNT; n++) {
    const c = 1 + Math.floor(Math.random() * (COLS - 3));
    const r = 1 + Math.floor(Math.random() * (ROWS - 3));
    for (let dc = 0; dc < 2; dc++)
      for (let dr = 0; dr < 2; dr++) hard[(r + dr) * COLS + (c + dc)] = 2;
  }
  mctx.clearRect(0, 0, COLS, ROWS);            // wipe the minimap cache for a fresh world

  // ...except a small open NEST room carved around the queen. Solid walls
  // completely surround the nest — the only way out is to DIG.
  const cx = WORLD_W / 2, cy = WORLD_H / 2;
  const roomRadius = 130;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
      if (Math.hypot(x - cx, y - cy) < roomRadius) grid[r * COLS + c] = false;
    }
  }

  // scatter open CAVES through the rock — some small, some big — with beetles.
  beetles = [];
  carrying = null;
  foodCount = 0;
  const placed = [];                            // caves already dropped, so new ones keep their distance
  for (let n = 0; n < 140; n++) {
    const cc = 3 + Math.floor(Math.random() * (COLS - 6));
    const cr = 3 + Math.floor(Math.random() * (ROWS - 6));
    const ccx = cc * TILE + TILE / 2, ccy = cr * TILE + TILE / 2;
    // keep caves off the nest: nest radius (130) + a big cave's reach + rock to
    // spare, so no cave can ever touch the nest and be revealed before you've
    // dug a tunnel to it. (Bump this if caves get bigger again.)
    if (Math.hypot(ccx - cx, ccy - cy) < roomRadius + 490) continue;
    const rad = 1 + Math.floor(Math.random() * 5);         // 1 (small) … 5 (big) tiles

    // RARE big caves: usually one blob, but ~12% of the time it's 2–3 blobs
    // clustered together (offset & overlapping) → one big, irregular cavern.
    const lobes = Math.random() < 0.12 ? 2 + Math.floor(Math.random() * 2) : 1;
    const spread = lobes > 1 ? Math.round(rad * 0.7) : 0;  // how far the extra blobs sit out
    const reach = rad + spread + 1;                        // farthest this cave's rock could open

    // keep caves APART: skip this spot if the new cave would touch an already
    // placed one, so separate caves never merge into a map-swallowing cavern.
    // (Uses each cave's reach, so bigger caves reserve more room.)
    let tooClose = false;
    for (const p of placed) {
      if (Math.hypot(cc - p.cc, cr - p.cr) < reach + p.reach + 1) { tooClose = true; break; }
    }
    if (tooClose) continue;
    placed.push({ cc, cr, reach });

    carveBlob(cc, cr, rad);                                // the main blob
    for (let l = 1; l < lobes; l++)                        // extra blobs for a rare big cave
      carveBlob(cc + Math.round(rand(-spread, spread)), cr + Math.round(rand(-spread, spread)), rad);

    const count = 1 + Math.floor(Math.random() * 5);       // 1–5 beetles per cave
    for (let k = 0; k < count; k++) {
      beetles.push({
        x: ccx + rand(-rad * 22, rad * 22),
        y: ccy + rand(-rad * 22, rad * 22),
        hp: BEETLE_HP, angle: rand(0, 6.28), wanderT: 0,
        dead: false, carried: false, gone: false,
      });
    }
  }

  // ⚠ debug: stamp the whole map onto the minimap so every cave shows from the start
  if (DEBUG_SEE_ALL)
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++) stampMini(c, r);
}

// carve ONE cave blob: a squashed, randomly-rotated oval with a rough edge, so
// caves aren't all perfect circles. (bcx,bcy) is the blob centre, in tiles.
function carveBlob(bcx, bcy, rad) {
  const rx = rad, ry = Math.max(1, rad * rand(0.55, 1));   // squash one axis → an oval
  const rot = rand(0, Math.PI), cs = Math.cos(rot), sn = Math.sin(rot);
  const reach = Math.ceil(rad) + 1;
  for (let c = bcx - reach; c <= bcx + reach; c++)
    for (let r = bcy - reach; r <= bcy + reach; r++) {
      if (c <= 0 || r <= 0 || c >= COLS - 1 || r >= ROWS - 1) continue;
      const dx = c - bcx, dy = r - bcy;
      const x = dx * cs + dy * sn, y = -dx * sn + dy * cs;  // rotate into the oval's frame
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1 + Math.random() * 0.25) grid[r * COLS + c] = false;
    }
}

// is the world point (px,py) inside a solid block?
function isRock(px, py) {
  const c = Math.floor(px / TILE), r = Math.floor(py / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
  return grid[r * COLS + c] === true;
}

// how many bites a block needs to break: big rock > grey rock > soft dirt
function maxHits(i) { return hard[i] === 2 ? BIGROCK_HP : hard[i] ? ROCK_HP : DIRT_HP; }

// reveal one tile: mark it visible now, and remember + stamp it the first time
function reveal(i, c, r) {
  visible[i] = 1;
  if (!explored[i]) { explored[i] = 1; stampMini(c, r); }
}

// VISION RULE: you see any tile within the REVEAL radius that is part of your
// CONNECTED tunnel network — even straight through a wall — plus the rock walls
// touching it. Two separate questions:
//   1) is it connected?  → follow the whole network (a flood fill, no distance
//      limit on the *following*), so we know every tile that's really yours.
//   2) should it light up? → only if it's within REVEAL of the queen.
// A cave sealed behind rock is never reached by the flood, so it stays hidden
// until you dig a tunnel that links it into your network.
function updateFog() {
  if (DEBUG_SEE_ALL) { visible.fill(1); explored.fill(1); return; }  // ⚠ debug: see everything
  visible.fill(0);
  const maxD2 = REVEAL * REVEAL;
  const qc = Math.floor(queen.x / TILE), qr = Math.floor(queen.y / TILE);
  if (qc < 0 || qr < 0 || qc >= COLS || qr >= ROWS) return;

  const inRange = (nc, nr) => {
    const x = nc * TILE + TILE / 2, y = nr * TILE + TILE / 2;
    return (x - queen.x) ** 2 + (y - queen.y) ** 2 <= maxD2;
  };

  const start = qr * COLS + qc;
  const queued = new Uint8Array(COLS * ROWS);   // BFS visited (the whole network)
  const queue = [start];
  queued[start] = 1;
  reveal(start, qc, qr);

  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const c = i % COLS, r = (i - c) / COLS;
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const ni = nr * COLS + nc;
        if (grid[ni]) {
          if (inRange(nc, nr)) reveal(ni, nc, nr);   // a rock wall we can see, if close
        } else {
          // an open tile → part of the network. For a DIAGONAL step, only pass if
          // at least one side tile is also open — never squeeze the flood through a
          // corner between two solid rocks (that would link tunnels that aren't).
          if (dc !== 0 && dr !== 0 && grid[r * COLS + nc] && grid[nr * COLS + c]) continue;
          if (inRange(nc, nr)) reveal(ni, nc, nr);   // connected AND close → light it up
          if (!queued[ni]) { queued[ni] = 1; queue.push(ni); }  // follow the network on
        }
      }
    }
  }
}
