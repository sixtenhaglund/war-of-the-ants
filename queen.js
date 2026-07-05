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

// Grab the nearest dead prey within reach. A CENTIPEDE needs a free mouth (she
// can't drag two, or drag with a beetle in her mouth); a BEETLE just needs a free
// carry slot. Returns true when she grabs something, so the click doesn't bite.
function tryGrab() {
  // centipede first — it's the big prize, and dragging uses the mouth
  if (!dragging && carried.length <= BACK_CAP) {
    let best = null, bestD = 30;
    for (const c of centipedes) {
      if (!c.dead || c.carried || c.gone || c.noPickup > 0) continue;
      const d = Math.hypot(c.x - queen.x, c.y - queen.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) { best.carried = true; dragging = best; return true; }
  }
  // otherwise a beetle onto her back/mouth (only BACK_CAP fit while a drag fills the mouth)
  const cap = dragging ? BACK_CAP : CARRY_CAP;
  if (carried.length < cap) {
    let best = null, bestD = 26;
    for (const b of beetles) {
      if (!b.dead || b.carried || b.gone || b.noPickup > 0) continue;
      const d = Math.hypot(b.x - queen.x, b.y - queen.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    if (best) { best.carried = true; carried.push(best); return true; }
  }
  return false;
}

// Standing on the nest pile and clicking DEPOSITS your whole load — beetles (2
// food) and any dragged centipede (5 food) — up to the pile's FOOD_LIMIT. Returns
// true if the click was "used up" near the pile, so it doesn't also mine.
function tryDeposit() {
  if (carried.length === 0 && !dragging) return false;              // nothing to drop
  if (Math.hypot(queen.x - foodPile.x, queen.y - foodPile.y) >= 44) return false;  // not on the pile

  while (carried.length && foodCount < FOOD_LIMIT) {                // dump the beetles
    const b = carried.shift(); b.gone = true;
    foodCount = Math.min(FOOD_LIMIT, foodCount + 2);
    pileItems.push({ type: 'beetle', food: 2, heal: BEETLE_HEAL });
  }
  if (dragging && foodCount < FOOD_LIMIT) {                         // then the centipede (its size sets the value)
    dragging.gone = true;
    foodCount = Math.min(FOOD_LIMIT, foodCount + dragging.type.food);
    pileItems.push({ type: 'centipede', food: dragging.type.food, heal: dragging.type.heal });
    dragging = null;
  }
  return true;                                                      // consume the click either way
}

// Press E to EAT prey and restore health: the centipede in her mouth heals 8, a
// beetle heals 4. If her mouth is empty but she's standing on the food pile, she
// eats from the stockpile instead. Skipped at full health so nothing's wasted.
function eat() {
  if (queen.hp >= QUEEN_HP) return;                        // already full — don't waste food

  if (dragging) {                                          // eat the dragged centipede (bigger = more HP)
    dragging.gone = true;
    queen.hp = Math.min(QUEEN_HP, queen.hp + dragging.type.heal);
    dragging = null;
    return;
  }
  if (carried.length) {                                    // eat the beetle in her mouth
    carried.pop().gone = true;
    queen.hp = Math.min(QUEEN_HP, queen.hp + BEETLE_HEAL);
    return;
  }
  // hands empty → eat from the pile if she's standing on it (each item remembers its heal)
  if (pileItems.length && Math.hypot(queen.x - foodPile.x, queen.y - foodPile.y) < 44) {
    const item = pileItems.pop();                          // take one off the heap
    foodCount = Math.max(0, foodCount - item.food);
    queen.hp = Math.min(QUEEN_HP, queen.hp + item.heal);
  }
}

// Right-click drops what's in her mouth in front of her: the dragged centipede
// first (it fills the mouth), else the top beetle. A grace stops instant re-grab.
function dropHeld() {
  let dx = queen.x + Math.cos(queen.angle) * 20;        // just in front of her
  let dy = queen.y + Math.sin(queen.angle) * 20;
  if (isRock(dx, dy)) { dx = queen.x; dy = queen.y; }   // fall back to her feet if that's rock
  const thing = dragging || carried.pop();
  if (!thing) return;
  if (dragging) dragging = null;
  thing.x = dx; thing.y = dy;
  thing.carried = false;
  thing.noPickup = 0.8;
}

// The real chomp — runs at the snap. Hits a beetle if one's in front, else rock.
function chompDamage() {
  const fx = queen.x + Math.cos(queen.angle) * NOSE;
  const fy = queen.y + Math.sin(queen.angle) * NOSE;

  // a living creature in front? Find the closest beetle OR centipede in reach and
  // chomp it. Beetles die in 2 bites, centipedes in 5 — then they become prey.
  let target = null, td = 16;
  for (const b of beetles)    { if (b.dead || b.gone || b.carried) continue;
    const d = Math.hypot(b.x - fx, b.y - fy); if (d < td) { td = d; target = b; } }
  for (const c of centipedes) { if (c.dead || c.gone || c.carried) continue;
    for (const s of c.segs) {                   // whole body is a hitbox: bite ANY segment
      const d = Math.hypot(s.x - fx, s.y - fy); if (d < td) { td = d; target = c; } } }
  if (target) {
    target.hp -= 1;
    spawnBlood(target.x, target.y, 8);          // splatter on the hit
    if (target.hp <= 0) { target.dead = true; spawnBlood(target.x, target.y, 14); }  // extra on the kill
    return;                                     // a bite lands on one thing
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

// which way the queen's BODY points when drawn. Normally she faces her heading,
// but while DRAGGING a centipede she turns around — she grips it and hauls it
// backward, like a real ant. dragFlip eases 0→1 so the turn GLIDES, not snaps.
function queenFacing() {
  return queen.angle + dragFlip * Math.PI;
}

function drawQueen() {
  ctx.save();
  ctx.translate(queen.x, queen.y);
  ctx.rotate(queenFacing());

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
