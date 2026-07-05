/* World generation, rock queries, and the fog of war. */

function buildWorld() {
  // The WHOLE world starts as solid rock...
  grid = new Array(COLS * ROWS).fill(true);
  hard = new Uint8Array(COLS * ROWS);
  hits = new Uint8Array(COLS * ROWS);
  bigId = new Int32Array(COLS * ROWS).fill(-1);
  explored = new Uint8Array(COLS * ROWS);
  visible  = new Uint8Array(COLS * ROWS);
  for (let i = 0; i < hard.length; i++) if (Math.random() < ROCK_CHANCE) hard[i] = 1;
  // scatter tough 2×2 BIG ROCK patches, kept as clean SEPARATE blocks: skip any
  // spot that would overlap or ORTHOGONALLY touch an existing big block (those
  // tiles just stay ordinary dirt/rock). Diagonal/corner contact is allowed, so
  // two big blocks can still sit corner-to-corner.
  const bigAt = (cc, rr) => cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && hard[rr * COLS + cc] === 2;
  for (let n = 0; n < BIGROCK_COUNT; n++) {
    const c = 1 + Math.floor(Math.random() * (COLS - 3));
    const r = 1 + Math.floor(Math.random() * (ROWS - 3));
    let clear = true;
    for (let dc = -1; dc <= 2 && clear; dc++)
      for (let dr = -1; dr <= 2 && clear; dr++) {
        if ((dc === -1 || dc === 2) && (dr === -1 || dr === 2)) continue;   // ignore diagonal corners
        if (bigAt(c + dc, r + dr)) clear = false;
      }
    if (!clear) continue;
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
  centipedes = [];
  carried = [];
  dragging = null;
  dragFlip = 0;
  foodCount = 0;
  pileItems = [];
  queen.x = WORLD_W / 2; queen.y = WORLD_H / 2; queen.angle = 0; queen.hp = QUEEN_HP;
  const placed = [];                            // caves already dropped, so new ones keep their distance
  for (let n = 0; n < 140; n++) {
    const cc = 3 + Math.floor(Math.random() * (COLS - 6));
    const cr = 3 + Math.floor(Math.random() * (ROWS - 6));
    const ccx = cc * TILE + TILE / 2, ccy = cr * TILE + TILE / 2;
    // keep caves off the nest: nest radius (130) + a big cave's reach + rock to
    // spare, so no cave can ever touch the nest and be revealed before you've
    // dug a tunnel to it. (Bump this if caves get bigger again.)
    if (Math.hypot(ccx - cx, ccy - cy) < roomRadius + 490) continue;
    const rad = 2 + Math.floor(Math.random() * 4);         // 2 (small) … 5 (big) tiles

    // RARE big caves: usually one blob, but ~12% of the time it's 2–3 blobs
    // clustered together (offset & overlapping) → one big, irregular cavern.
    const lobes = Math.random() < 0.12 ? 2 + Math.floor(Math.random() * 3) : 1;   // rarely 2–4 blobs
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
    placed.push({ cc, cr, reach, rad });                  // rad kept for spawning bugs later

    carveBlob(cc, cr, rad);                                // the main blob
    for (let l = 1; l < lobes; l++)                        // extra blobs for a rare big cave
      carveBlob(cc + Math.round(rand(-spread, spread)), cr + Math.round(rand(-spread, spread)), rad);
  }

  // spread exactly BUG_LIMIT bugs EVENLY over the caves, round-robin: cave 0, 1,
  // 2, … then loop back — so every cave gets a near-equal share.
  for (let k = 0; k < BUG_LIMIT && placed.length > 0; k++) {
    const cave = placed[k % placed.length];
    const ccx = cave.cc * TILE + TILE / 2, ccy = cave.cr * TILE + TILE / 2;
    beetles.push({
      x: ccx + rand(-cave.rad * 22, cave.rad * 22),
      y: ccy + rand(-cave.rad * 22, cave.rad * 22),
      hp: BEETLE_HP, angle: rand(0, 6.28), wanderT: 0,
      dead: false, carried: false, gone: false,
    });
  }

  // scatter CENTIPEDES too — offset into different caves from the beetles so they
  // aren't all sharing one room.
  for (let k = 0; k < CENTI_LIMIT && placed.length > 0; k++) {
    const cave = placed[(k * 7 + 3) % placed.length];
    const ccx = cave.cc * TILE + TILE / 2, ccy = cave.cr * TILE + TILE / 2;
    const roll = Math.random();
    const t = roll < 0.5 ? 0 : roll < 0.83 ? 1 : 2;   // mostly small, some medium, a few giants
    centipedes.push(makeCentipede(ccx + rand(-20, 20), ccy + rand(-20, 20), t));
  }

  // dig thin TUNNELS linking nearby caves into networks: each cave connects to
  // its nearest neighbour most of the time, and a second one now and then — so
  // you get chains of two or more caves joined by 1–2 tile passages.
  const MAXLINK = 14;                            // only join caves this close (tiles)
  for (let a = 0; a < placed.length; a++) {
    const A = placed[a];
    let n1 = -1, d1 = Infinity, n2 = -1, d2 = Infinity;   // nearest & 2nd-nearest cave
    for (let b = 0; b < placed.length; b++) {
      if (b === a) continue;
      const d = Math.hypot(placed[b].cc - A.cc, placed[b].cr - A.cr);
      if (d < d1) { d2 = d1; n2 = n1; d1 = d; n1 = b; }
      else if (d < d2) { d2 = d; n2 = b; }
    }
    if (n1 >= 0 && d1 <= MAXLINK && Math.random() < 0.65)
      carveTunnel(A.cc, A.cr, placed[n1].cc, placed[n1].cr, Math.random() < 0.5 ? 1 : 2);
    if (n2 >= 0 && d2 <= MAXLINK && Math.random() < 0.22)
      carveTunnel(A.cc, A.cr, placed[n2].cc, placed[n2].cr, Math.random() < 0.5 ? 1 : 2);
  }

  connectBigRocks();   // group orthogonally-touching big rock into single blocks

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

// group big-rock tiles into blocks: every run of ORTHOGONALLY-connected big rock
// gets one shared id (bigId), so it takes damage and breaks as a single block.
// Diagonal-only touches don't join → diagonal big rocks stay separate blocks.
function connectBigRocks() {
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === true && hard[i] === 2 && bigId[i] < 0) {   // a new block starts here
      const stack = [i];
      bigId[i] = i;                                            // the block's id = this tile
      for (let h = 0; h < stack.length; h++) {
        const k = stack[h], kc = k % COLS, kr = (k - kc) / COLS;
        const nb = [];
        if (kc > 0) nb.push(k - 1);
        if (kc < COLS - 1) nb.push(k + 1);
        if (kr > 0) nb.push(k - COLS);
        if (kr < ROWS - 1) nb.push(k + COLS);
        for (const m of nb)
          if (grid[m] === true && hard[m] === 2 && bigId[m] < 0) { bigId[m] = i; stack.push(m); }
      }
    }
  }
}

// carve a thin TUNNEL of open floor from (c0,r0) to (c1,r1), `thick` tiles wide.
// Walks ONE tile at a time in x or y (never a diagonal jump), so the path is
// always ORTHOGONALLY connected — a walkable staircase, not a corner-only chain
// the queen can't fit through. Never digs near the nest (keeps it sealed).
function carveTunnel(c0, r0, c1, r1, thick) {
  const midC = COLS / 2, midR = ROWS / 2;
  const dig = (bc, br) => {
    for (let dc = 0; dc < thick; dc++)
      for (let dr = 0; dr < thick; dr++) {
        const c = bc + dc, r = br + dr;
        if (c <= 0 || r <= 0 || c >= COLS - 1 || r >= ROWS - 1) continue;
        if (Math.hypot(c - midC, r - midR) < 6) continue;   // keep the nest sealed
        grid[r * COLS + c] = false;
      }
  };
  let c = c0, r = r0;
  dig(c, r);
  while (c !== c1 || r !== r1) {
    if (c !== c1 && (Math.abs(c1 - c) >= Math.abs(r1 - r) || r === r1)) c += c < c1 ? 1 : -1;
    else r += r < r1 ? 1 : -1;                              // step whichever axis is farther
    dig(c, r);
  }
}

// is the world point (px,py) inside a solid block?
function isRock(px, py) {
  const c = Math.floor(px / TILE), r = Math.floor(py / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
  return grid[r * COLS + c] === true;
}

// Find a heading close to `want` that ISN'T blocked by rock a step ahead. Searches
// outward from `want` on both sides — a tiny turn first, then wider, and finally
// even sideways/backward — so a cornered creature squeezes out any gap it can find
// instead of grinding into the wall and freezing. Returns `want` only if truly boxed in.
function openHeading(x, y, want, step) {
  step = step || 22;
  const offs = [0, 0.4, -0.4, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0, 2.6, -2.6, Math.PI];
  for (const o of offs) {
    const a = want + o;
    if (!isRock(x + Math.cos(a) * step, y + Math.sin(a) * step)) return a;
  }
  return want;
}

// Is the straight line from (x0,y0) to (x1,y1) free of rock? Samples every ~7px,
// so a creature can't reach/bite THROUGH a wall — it needs real line of sight.
function clearLine(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(2, Math.ceil(Math.hypot(dx, dy) / 7));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isRock(x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

// how many bites a block needs to break: big rock > grey rock > soft dirt
function maxHits(i) { return hard[i] === 2 ? BIGROCK_HP : hard[i] ? ROCK_HP : DIRT_HP; }

// is the tile at (c,r) a solid big-rock block? (used to merge touching big rocks)
function isBigRock(c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
  const i = r * COLS + c;
  return grid[i] && hard[i] === 2;
}

// reveal one tile: mark it visible now, and remember + stamp it the first time
function reveal(i, c, r) {
  visible[i] = 1;
  if (!explored[i]) { explored[i] = 1; stampMini(c, r); }
}

// VISION RULE: you see any tile within the REVEAL radius that is part of your
// CONNECTED tunnel network — even straight through a wall — plus the rock walls
// touching it. Two separate questions:
//   1) is it connected?  → flood through open tiles from the queen.
//   2) should it light up? → only if it's within REVEAL of the queen.
// A cave sealed behind rock is never reached by the flood, so it stays hidden.
// The flood is bounded to a local region (2× REVEAL) around the queen so we don't
// re-walk the whole dug map every frame — that's plenty to see connected tunnels
// through nearby walls.
let fogQueued = null;                             // reused BFS visited buffer (no per-frame alloc)
const fogQueue = [];                              // reused BFS queue
function updateFog() {
  if (DEBUG_SEE_ALL) { visible.fill(1); explored.fill(1); return; }  // ⚠ debug: see everything
  visible.fill(0);
  if (!fogQueued || fogQueued.length !== COLS * ROWS) fogQueued = new Uint8Array(COLS * ROWS);
  else fogQueued.fill(0);

  const maxD2 = REVEAL * REVEAL;                  // light up within this
  const propD2 = (REVEAL * 2) * (REVEAL * 2);     // but only flood within this local region
  const qc = Math.floor(queen.x / TILE), qr = Math.floor(queen.y / TILE);
  if (qc < 0 || qr < 0 || qc >= COLS || qr >= ROWS) return;

  const start = qr * COLS + qc;
  fogQueue.length = 0;
  fogQueue.push(start);
  fogQueued[start] = 1;
  reveal(start, qc, qr);

  for (let head = 0; head < fogQueue.length; head++) {
    const i = fogQueue[head];
    const c = i % COLS, r = (i - c) / COLS;
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const ni = nr * COLS + nc;
        const x = nc * TILE + TILE / 2 - queen.x, y = nr * TILE + TILE / 2 - queen.y;
        const d2 = x * x + y * y;
        if (d2 > propD2) continue;                 // outside the local flood region
        if (grid[ni]) {
          if (d2 <= maxD2 && !visible[ni]) reveal(ni, nc, nr);   // a rock wall we can see, if close
        } else {
          if (fogQueued[ni]) continue;             // this open tile is already handled
          // DIAGONAL step: only pass if a side tile is also open — never squeeze the
          // flood through a corner between two solid rocks (would link separate tunnels).
          if (dc !== 0 && dr !== 0 && grid[r * COLS + nc] && grid[nr * COLS + c]) continue;
          fogQueued[ni] = 1;
          fogQueue.push(ni);                       // follow the network on
          if (d2 <= maxD2) reveal(ni, nc, nr);     // connected AND close → light it up
        }
      }
    }
  }
}
