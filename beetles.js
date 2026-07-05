/* Beetles: the bugs you hunt, and the nest food pile you feed. */

// living beetles wander slowly around their cave — but PANIC and run away when
// the queen gets close. They bounce off rock either way.
const FLEE_RANGE = 170;   // how close a threat can get before a beetle bolts (they're alert)
function updateBeetles(dt) {
  for (const b of beetles) {
    if (b.dead || b.gone || b.carried) continue;

    // run from the nearest THREAT — the queen, or a hunting centipede's head
    let tx = queen.x, ty = queen.y, dist = Math.hypot(b.x - queen.x, b.y - queen.y);
    for (const c of centipedes) {
      if (c.dead || c.gone || c.carried) continue;
      const d = Math.hypot(b.x - c.x, b.y - c.y);
      if (d < dist) { dist = d; tx = c.x; ty = c.y; }
    }
    const dx = b.x - tx, dy = b.y - ty;             // vector pointing AWAY from that threat

    if (dist < FLEE_RANGE) {
      // PANIC, but SMART: it wants to run straight away, but if a wall is that way
      // it looks for the escape heading CLOSEST to "straight away" that's actually
      // open — checking wider and wider angles left & right — so it rounds corners
      // and slips down tunnels instead of grinding into the rock.
      const away = Math.atan2(dy, dx);
      const esc = openHeading(b.x, b.y, away, 24);   // best open escape (even out of a corner)
      const sp = 60 * dt;             // a bit faster than a wander — real fright
      const mvx = Math.cos(esc) * sp, mvy = Math.sin(esc) * sp;
      if (!isRock(b.x + mvx, b.y)) b.x += mvx;
      if (!isRock(b.x, b.y + mvy)) b.y += mvy;
      b.angle = esc;
      b.wanderT = rand(0.2, 0.6);     // don't fall back into an old wander mid-panic
      b.idle = false;                 // never idle while running
    } else {
      // wander slowly — but every so often just stand still (idle) for a while
      b.wanderT -= dt;
      if (b.wanderT <= 0) {
        if (Math.random() < 0.35) {                     // sometimes pause and rest
          b.idle = true; b.wanderT = rand(0.8, 2.5);
        } else {                                        // otherwise pick a new heading
          b.idle = false; b.angle = rand(0, 6.28); b.wanderT = rand(0.6, 2.2);
        }
      }
      if (!b.idle) {                                     // move only when not resting
        const nx = b.x + Math.cos(b.angle) * 24 * dt;
        const ny = b.y + Math.sin(b.angle) * 24 * dt;
        if (!isRock(nx, b.y)) b.x = nx; else b.angle = rand(0, 6.28);
        if (!isRock(b.x, ny)) b.y = ny; else b.angle = rand(0, 6.28);
      }
    }
  }
}

// draw a beetle. dead ones are grey; `local` skips the rotate (used when it's
// riding on the queen, already inside her rotated transform).
function drawBeetle(x, y, angle, dead, local) {
  ctx.save();
  ctx.translate(x, y);
  if (!local) ctx.rotate(angle);
  ctx.strokeStyle = dead ? '#555' : '#180d06'; ctx.lineWidth = 1.5;
  for (let s = -1; s <= 1; s++) {                 // six legs
    ctx.beginPath(); ctx.moveTo(s * 3, -2); ctx.lineTo(s * 3 - 2, -7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 3, 2);  ctx.lineTo(s * 3 - 2, 7);  ctx.stroke();
  }
  ctx.fillStyle = dead ? '#707070' : '#3a2216';  // shell
  ctx.beginPath(); ctx.ellipse(0, 0, 8, 6, 0, 0, 6.28); ctx.fill();
  ctx.fillStyle = dead ? '#8a8a8a' : '#241009';  // head
  ctx.beginPath(); ctx.ellipse(7, 0, 3.5, 3, 0, 0, 6.28); ctx.fill();
  ctx.strokeStyle = dead ? '#4a4a4a' : '#140a04'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(5, 0); ctx.stroke();   // shell seam
  ctx.restore();
}

// a small health bar floating above a living beetle (drawn in world coords,
// not rotated with the beetle)
function drawBeetleHp(b) {
  const w = 16, x = b.x - w / 2, y = b.y - 14;
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 1, y - 1, w + 2, 5);
  ctx.fillStyle = '#e04030';
  ctx.fillRect(x, y, w * (b.hp / BEETLE_HP), 3);
}

// the nest food pile — every piece of prey you deliver is drawn as its real (dead)
// self, packed into the heap with a golden-angle spiral so they fan out evenly.
function drawFoodPile() {
  ctx.strokeStyle = 'rgba(255,215,120,0.45)'; ctx.lineWidth = 2;  // drop-spot ring (click inside it to deposit)
  ctx.beginPath(); ctx.arc(foodPile.x, foodPile.y, PILE_RADIUS, 0, 6.28); ctx.stroke();
  for (let k = 0; k < pileItems.length; k++) {
    const it = pileItems[k];
    const a = k * 2.399;                          // golden angle → even, non-overlapping spread
    const rr = Math.sqrt(k) * 5;                  // spiral outward from the centre
    ctx.save();
    ctx.translate(foodPile.x + Math.cos(a) * rr, foodPile.y + Math.sin(a) * rr);
    if (it.type === 'centipede') {
      ctx.rotate(a);                              // curl each centipede a different way
      drawPileCentipede(it.rMul || 1);            // sized to match the one you delivered
    } else {
      ctx.scale(0.72, 0.72);
      drawBeetle(0, 0, a * 2, true, false);       // dead = grey; a*2 spins each so the heap looks scattered
    }
    ctx.restore();
  }
}

// a little coiled dead centipede for the pile, scaled by m (its real size)
function drawPileCentipede(m) {
  ctx.fillStyle = '#6a6a6a';
  for (let i = 0; i < 7; i++) {                    // a short arc of shrinking segments
    const a = i * 0.5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * i * 2.4 * m, Math.sin(a) * i * 2.4 * m, (3.4 - i * 0.25) * m, 0, 6.28);
    ctx.fill();
  }
}
