/* The queen: collision, movement, biting, and drawing. */

// Would her body (centred at cx,cy, facing ang) overlap any rock? Spin every
// body sample point into the world and check the tile it lands on.
function bodyHitsRock(cx, cy, ang) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  for (const [lx, ly] of BODY) {
    const wx = cx + lx * cs - ly * sn;
    const wy = cy + lx * sn + ly * cs;
    if (isRock(wx, wy)) return true;
  }
  return false;
}

// move each axis on its own (so she slides along walls), only if her body is clear
function moveQueen(dx, dy) {
  if (dx !== 0 && !bodyHitsRock(queen.x + dx, queen.y, queen.angle)) queen.x += dx;
  if (dy !== 0 && !bodyHitsRock(queen.x, queen.y + dy, queen.angle)) queen.y += dy;
}

// If turning has pushed her body into rock, nudge her out toward open space.
function pushOutOfWalls() {
  for (let iter = 0; iter < 8; iter++) {
    const cs = Math.cos(queen.angle), sn = Math.sin(queen.angle);
    let px = 0, py = 0, n = 0;
    for (const [lx, ly] of BODY) {
      const wx = queen.x + lx * cs - ly * sn;
      const wy = queen.y + lx * sn + ly * cs;
      if (isRock(wx, wy)) {
        const tx = (Math.floor(wx / TILE) + 0.5) * TILE;
        const ty = (Math.floor(wy / TILE) + 0.5) * TILE;
        px += wx - tx; py += wy - ty;                      // push away from the tile centre
        n++;
      }
    }
    if (n === 0) return;                                   // she's clear — done
    const len = Math.hypot(px, py) || 1;
    queen.x += (px / len) * 2;
    queen.y += (py / len) * 2;
  }
}

// Begin a bite now, but hold the damage until the jaws snap shut mid-swing.
function startBite() {
  biteCd = BITE_COOLDOWN;
  bitePending = true;
}

// Grab the nearest dead beetle within reach — if her load isn't already full.
// Returns true when she picks one up, so the click doesn't ALSO start a bite.
function tryPickup() {
  if (carried.length >= CARRY_CAP) return false;        // her mouth + back are full
  let best = null, bestD = 26;                          // only beetles within reach count
  for (const b of beetles) {
    if (!b.dead || b.carried || b.gone || b.noPickup > 0) continue;
    const d = Math.hypot(b.x - queen.x, b.y - queen.y);
    if (d < bestD) { bestD = d; best = b; }             // keep the closest one
  }
  if (!best) return false;
  best.carried = true;
  carried.push(best);                                   // newest goes on top of the load
  return true;
}

// Spit the beetle in her mouth onto the ground in front of her, so she can pick
// it up again later. A short grace stops her instantly re-grabbing it.
function dropCarried() {
  if (carried.length === 0) return;
  const b = carried.pop();                              // the mouth one (last picked) comes out first
  let dx = queen.x + Math.cos(queen.angle) * 20;        // just in front of her
  let dy = queen.y + Math.sin(queen.angle) * 20;
  if (isRock(dx, dy)) { dx = queen.x; dy = queen.y; }   // fall back to her feet if that's rock
  b.x = dx; b.y = dy;
  b.carried = false;
  b.noPickup = 0.8;                                      // seconds before it can be re-grabbed
}

// The real chomp — runs at the snap. Hits a beetle if one's in front, else rock.
function chompDamage() {
  const fx = queen.x + Math.cos(queen.angle) * NOSE;
  const fy = queen.y + Math.sin(queen.angle) * NOSE;

  // a living beetle in front? Beetles die in 2 bites, then become a pickup.
  for (const b of beetles) {
    if (b.dead || b.gone || b.carried) continue;
    if (Math.hypot(b.x - fx, b.y - fy) < 16) {
      b.hp -= 1;
      spawnBlood(b.x, b.y, 8);                 // splatter on the hit
      if (b.hp <= 0) { b.dead = true; spawnBlood(b.x, b.y, 14); }  // extra on the kill
      return;                                 // a bite lands on one thing
    }
  }

  // otherwise chew the rock in front
  const c = Math.floor(fx / TILE), r = Math.floor(fy / TILE);
  if (c <= 0 || r <= 0 || c >= COLS - 1 || r >= ROWS - 1) return;
  const i = r * COLS + c;
  if (grid[i] !== true) return;

  if (hard[i] === 2 && bigId[i] >= 0) {         // BIG ROCK: one shared connected block
    const o = bigId[i];
    hits[o] += 1;                               // damage saved on the block's id tile
    if (hits[o] >= BIGROCK_HP) {                // whole block breaks at once
      const stack = [i];                        // flood the connected block open
      while (stack.length) {
        const k = stack.pop();
        if (!(grid[k] === true && hard[k] === 2 && bigId[k] === o)) continue;
        grid[k] = false; hits[k] = 0; bigId[k] = -1;
        const kc = k % COLS, kr = (k - kc) / COLS;
        stampMini(kc, kr);
        if (kc > 0) stack.push(k - 1);
        if (kc < COLS - 1) stack.push(k + 1);
        if (kr > 0) stack.push(k - COLS);
        if (kr < ROWS - 1) stack.push(k + COLS);
      }
    }
    return;
  }

  hits[i] += 1;                               // damage is saved per block
  if (hits[i] >= maxHits(i)) { grid[i] = false; hits[i] = 0; stampMini(c, r); }  // breaks
}

// Draw ONE mandible (side = -1 or 1), hinged at head-front hx and opened by
// jawAngle. The caller has already moved into the queen's local frame. Pulled out
// of drawQueen so a jaw can also be drawn OVER the beetle in her mouth (the
// clamped look) — one jaw behind it, one in front.
function drawMandible(side, hx, jawAngle) {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#c8c8c8'; ctx.lineWidth = 0.6;
  ctx.save();
  ctx.translate(hx + 4, side * 2);              // hinge at the head's front corner
  ctx.rotate(side * jawAngle);
  ctx.scale(0.65, 0.65);                         // shrink the whole jaw shape
  ctx.beginPath();
  ctx.moveTo(0, side * 1.5);
  ctx.quadraticCurveTo(5, side * 3, 8, side * 0.3);   // outer edge → sharp tip
  ctx.quadraticCurveTo(4, side * 1, 0, side * -0.5);  // inner edge hooks back
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawQueen() {
  ctx.save();
  ctx.translate(queen.x, queen.y);
  ctx.rotate(queen.angle);

  // legs: swing while walking forward/back, still otherwise
  ctx.strokeStyle = '#3a2b16'; ctx.lineWidth = 2;
  for (let s = -1; s <= 1; s++) {
    const swing = legActive ? Math.sin(walkPhase + s * 2.1) * 3 : 0;
    ctx.beginPath(); ctx.moveTo(s * 5, 0); ctx.lineTo(s * 5 - 3 + swing, -11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 5, 0); ctx.lineTo(s * 5 - 3 - swing,  11); ctx.stroke();
  }

  // A bite plays two moves across e = 0→1: wind-up (head back, jaws open) then
  // strike (head lunges, jaws snap shut), then settle. It runs over BITE_ANIM
  // seconds, then holds at rest for the rest of the (longer) cooldown.
  const e = clamp((BITE_COOLDOWN - biteCd) / BITE_ANIM, 0, 1);
  const head = BODY_PARTS[2];
  const hx = head.x + keyed(e, [[0, 0], [0.45, -4], [0.75, 3], [1, 0]]);

  ctx.fillStyle = '#e8c060';
  ctx.beginPath(); ctx.ellipse(BODY_PARTS[0].x, 0, BODY_PARTS[0].rx, BODY_PARTS[0].ry, 0, 0, 6.28); ctx.fill(); // abdomen
  ctx.beginPath(); ctx.ellipse(BODY_PARTS[1].x, 0, BODY_PARTS[1].rx, BODY_PARTS[1].ry, 0, 0, 6.28); ctx.fill(); // thorax
  ctx.beginPath(); ctx.ellipse(hx, 0, head.rx, head.ry, 0, 0, 6.28); ctx.fill();                                // head (lunges)

  // small white mandibles that snap shut on the strike
  const jawAngle = keyed(e, [[0, 0], [0.45, 0.55], [0.75, -0.05], [1, 0]]);
  for (const side of [-1, 1]) drawMandible(side, hx, jawAngle);

  ctx.restore();
}
