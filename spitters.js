/* The SPITTER queen's weapon: acid. If you chose the Spitter class at the menu,
   hold SPACE to spit glowing acid globs in the way you're facing. They fly until
   they hit a creature (damaging it) or a wall (splat). Basic queens can't spit. */

// fire one acid glob from the queen's mouth, in the way she faces
function playerSpit() {
  const a = queen.angle;
  acids.push({
    x: queen.x + Math.cos(a) * 16, y: queen.y + Math.sin(a) * 16,
    vx: Math.cos(a) * SPIT_SPEED, vy: Math.sin(a) * SPIT_SPEED,
    life: SPIT_LIFE,
  });
}

// hurt a creature the acid struck; kill it (→ carryable prey) if it runs out of HP
function acidHit(e) {
  e.hp -= SPIT_DMG;
  spawnAcidSplat(e.x, e.y);
  if (e.hp <= 0) { e.dead = true; spawnBlood(e.x, e.y, 12); }
}

// move the acid globs; a hit on a creature hurts it, a hit on rock splats
function updateAcids(dt) {
  for (const p of acids) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt;
    let hit = false;
    for (const c of centipedes) {                          // any segment of a centipede
      if (c.dead || c.gone || c.carried) continue;
      for (const s of c.segs) if (Math.hypot(s.x - p.x, s.y - p.y) < 8) { acidHit(c); hit = true; break; }
      if (hit) break;
    }
    if (!hit) for (const b of beetles) {                   // or a beetle
      if (b.dead || b.gone || b.carried) continue;
      if (Math.hypot(b.x - p.x, b.y - p.y) < 8) { acidHit(b); hit = true; break; }
    }
    if (hit || isRock(p.x, p.y)) { spawnAcidSplat(p.x, p.y); p.life = 0; }   // splat on a wall too
  }
  for (let i = acids.length - 1; i >= 0; i--) if (acids[i].life <= 0) acids.splice(i, 1);
}

// a little green splash — reuse the particle system but tag it acid-green
function spawnAcidSplat(x, y) {
  for (let k = 0; k < 8; k++) {
    const a = rand(0, 6.28), sp = rand(20, 90);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.25, 0.6), max: 0.6, r: rand(1.5, 3), acid: true,
    });
  }
}

// draw the acid globs in flight (inside the world transform)
function drawAcids() {
  for (const p of acids) {
    ctx.fillStyle = 'rgba(200,255,90,0.5)';                 // glow
    ctx.beginPath(); ctx.arc(p.x, p.y, 6.5, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#9fe02a';                              // core
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); ctx.fill();
  }
}
