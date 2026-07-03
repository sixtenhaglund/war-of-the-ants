/* World generation, rock queries, and the fog of war. */

function buildWorld() {
  // The WHOLE world starts as solid rock...
  grid = new Array(COLS * ROWS).fill(true);
  hard = new Uint8Array(COLS * ROWS);
  hits = new Uint8Array(COLS * ROWS);
  explored = new Uint8Array(COLS * ROWS);
  visible  = new Uint8Array(COLS * ROWS);
  for (let i = 0; i < hard.length; i++) if (Math.random() < ROCK_CHANCE) hard[i] = 1;
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
  for (let n = 0; n < 90; n++) {
    const cc = 3 + Math.floor(Math.random() * (COLS - 6));
    const cr = 3 + Math.floor(Math.random() * (ROWS - 6));
    const ccx = cc * TILE + TILE / 2, ccy = cr * TILE + TILE / 2;
    if (Math.hypot(ccx - cx, ccy - cy) < 340) continue;   // keep caves off the nest
    const rad = 1 + Math.floor(Math.random() * 4);         // 1 (small) … 4 (big) tiles
    for (let c = cc - rad; c <= cc + rad; c++)
      for (let r = cr - rad; r <= cr + rad; r++) {
        if (c <= 0 || r <= 0 || c >= COLS - 1 || r >= ROWS - 1) continue;
        if (Math.hypot(c - cc, r - cr) <= rad + Math.random() * 0.7) grid[r * COLS + c] = false;
      }
    const count = 1 + Math.floor(Math.random() * rad);     // bigger caves → more beetles
    for (let k = 0; k < count; k++) {
      beetles.push({
        x: ccx + rand(-rad * 16, rad * 16),
        y: ccy + rand(-rad * 16, rad * 16),
        hp: 2, angle: rand(0, 6.28), wanderT: 0,
        dead: false, carried: false, gone: false,
      });
    }
  }
}

// is the world point (px,py) inside a solid block?
function isRock(px, py) {
  const c = Math.floor(px / TILE), r = Math.floor(py / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
  return grid[r * COLS + c] === true;
}

// how many bites a block needs to break: tough rock takes more than soft dirt
function maxHits(i) { return hard[i] ? ROCK_HP : DIRT_HP; }

// is any of the 8 tiles around (c,r) an open/hollow tile?
function besideHollow(c, r) {
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (dc === 0 && dr === 0) continue;
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      if (grid[nr * COLS + nc] === false) return true;
    }
  }
  return false;
}

// VISION RULE: you see open tiles near you, and a rock tile only if it borders
// open space. Newly-seen tiles get stamped onto the minimap cache.
function updateFog() {
  visible.fill(0);
  const rad = Math.ceil(REVEAL / TILE) + 1;
  const qc = Math.floor(queen.x / TILE), qr = Math.floor(queen.y / TILE);
  for (let c = qc - rad; c <= qc + rad; c++) {
    for (let r = qr - rad; r <= qr + rad; r++) {
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
      const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
      if (Math.hypot(x - queen.x, y - queen.y) >= REVEAL) continue;
      const i = r * COLS + c;
      if (grid[i] === false || besideHollow(c, r)) {
        visible[i] = 1;
        if (!explored[i]) { explored[i] = 1; stampMini(c, r); }   // remember + draw on minimap
      }
    }
  }
}
