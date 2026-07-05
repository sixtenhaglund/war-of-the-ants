/* Spitters: a hostile ANT that keeps its distance and spits ACID at the queen.
   Unlike centipedes it won't rush you — it kites, holding ~SPITTER_KITE away and
   lobbing acid globs whenever it has line of sight. Kill one (3 bites) and, like a
   beetle, you can carry the body home for food or eat it to heal. */

function makeSpitter(x, y) {
  return {
    x, y, angle: rand(0, 6.28), hp: SPITTER_HP, kind: 'spitter',
    dead: false, carried: false, gone: false, hostile: true,
    spitCd: rand(0.5, SPIT_CD), wanderT: 0, noPickup: 0,
  };
}

function updateSpitters(dt) {
  for (const s of spitters) {
    if (s.noPickup > 0) s.noPickup -= dt;
    if (s.dead || s.gone || s.carried) continue;
    if (s.spitCd > 0) s.spitCd -= dt;

    const dx = queen.x - s.x, dy = queen.y - s.y, qd = Math.hypot(dx, dy);
    const sees = qd < SPITTER_SIGHT && clearLine(s.x, s.y, queen.x, queen.y);

    if (sees) {
      s.angle = Math.atan2(dy, dx);                 // face the queen to aim
      // KITE: hold its distance — back off if she's too close, edge in if too far
      let want = null;
      if (qd < SPITTER_KITE - 25) want = s.angle + Math.PI;     // too close → retreat
      else if (qd > SPITTER_KITE + 45) want = s.angle;          // too far → approach
      if (want !== null) {
        const a = openHeading(s.x, s.y, want, 18);
        const mvx = Math.cos(a) * SPITTER_SPEED * dt, mvy = Math.sin(a) * SPITTER_SPEED * dt;
        if (!isRock(s.x + mvx, s.y)) s.x += mvx;
        if (!isRock(s.x, s.y + mvy)) s.y += mvy;
      }
      // SPIT: lob a glob straight at the queen (needs a clear line, already checked)
      if (s.spitCd <= 0) { spitAcid(s); s.spitCd = SPIT_CD; }
    } else {
      // WANDER when it can't see her
      s.wanderT -= dt;
      if (s.wanderT <= 0) { s.angle = rand(0, 6.28); s.wanderT = rand(0.8, 2.2); }
      const mvx = Math.cos(s.angle) * SPITTER_SPEED * 0.6 * dt;
      const mvy = Math.sin(s.angle) * SPITTER_SPEED * 0.6 * dt;
      if (!isRock(s.x + mvx, s.y)) s.x += mvx; else s.angle = rand(0, 6.28);
      if (!isRock(s.x, s.y + mvy)) s.y += mvy; else s.angle = rand(0, 6.28);
    }
  }
}

// fire an acid glob from the spitter toward the queen
function spitAcid(s) {
  const a = Math.atan2(queen.y - s.y, queen.x - s.x);
  acids.push({
    x: s.x + Math.cos(a) * 11, y: s.y + Math.sin(a) * 11,
    vx: Math.cos(a) * SPIT_SPEED, vy: Math.sin(a) * SPIT_SPEED,
    life: SPIT_LIFE,
  });
}

// move the acid globs; a hit on the queen hurts her, a hit on rock splats
function updateAcids(dt) {
  for (const p of acids) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt;
    if (Math.hypot(p.x - queen.x, p.y - queen.y) < 13) {   // splashed the queen
      queen.hp -= SPIT_DMG;
      spawnAcidSplat(p.x, p.y);
      p.life = 0;
      if (queen.hp <= 0) gameOver();
    } else if (isRock(p.x, p.y)) {                          // hit a wall
      spawnAcidSplat(p.x, p.y);
      p.life = 0;
    }
  }
  for (let i = acids.length - 1; i >= 0; i--) if (acids[i].life <= 0) acids.splice(i, 1);
}

// a little green splash — reuse the particle system but tint it acid-green
function spawnAcidSplat(x, y) {
  for (let k = 0; k < 8; k++) {
    const a = rand(0, 6.28), sp = rand(20, 90);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.25, 0.6), max: 0.6, r: rand(1.5, 3), acid: true,
    });
  }
}

// draw a spitter ant at (x,y) facing angle. `local` skips the rotate (for when it's
// riding on the queen, already inside her rotated frame). Grey when dead.
function drawSpitterAt(x, y, angle, dead, local) {
  ctx.save();
  ctx.translate(x, y);
  if (!local) ctx.rotate(angle);

  // legs
  ctx.strokeStyle = dead ? '#555' : '#25401c'; ctx.lineWidth = 1.4;
  for (let s = -1; s <= 1; s++) {
    ctx.beginPath(); ctx.moveTo(s * 3, -2); ctx.lineTo(s * 3 - 2, -7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 3, 2);  ctx.lineTo(s * 3 - 2, 7);  ctx.stroke();
  }

  // body: abdomen, thorax, head — sickly acid-green
  ctx.fillStyle = dead ? '#6f6f6f' : '#5c7a2c';
  ctx.beginPath(); ctx.ellipse(-7, 0, 7, 5.5, 0, 0, 6.28); ctx.fill();   // abdomen (the acid sac)
  ctx.fillStyle = dead ? '#7a7a7a' : '#6d8f36';
  ctx.beginPath(); ctx.ellipse(-1, 0, 3.5, 3.5, 0, 0, 6.28); ctx.fill(); // thorax
  ctx.beginPath(); ctx.ellipse(6, 0, 4.5, 4, 0, 0, 6.28); ctx.fill();    // head

  if (!dead) {
    ctx.fillStyle = '#c9f04a';                                            // a bright acid droplet at the mouth
    ctx.beginPath(); ctx.arc(10, 0, 2, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#1c2a10';                                            // eyes
    ctx.beginPath(); ctx.arc(7, -2, 1, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(7, 2, 1, 0, 6.28); ctx.fill();
  }
  ctx.restore();
}

function drawSpitter(s) { drawSpitterAt(s.x, s.y, s.angle, s.dead, false); }

// green health bar over a living spitter
function drawSpitterHp(s) {
  const w = 16, x = s.x - w / 2, y = s.y - 14;
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
  ctx.fillStyle = '#8ede3a'; ctx.fillRect(x, y, w * (s.hp / SPITTER_HP), 3);
}

// draw the acid globs in flight (inside the world transform)
function drawAcids() {
  for (const p of acids) {
    ctx.fillStyle = '#9fe02a';
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); ctx.fill();
    ctx.fillStyle = 'rgba(200,255,90,0.5)';                               // a little glow
    ctx.beginPath(); ctx.arc(p.x, p.y, 6.5, 0, 6.28); ctx.fill();
  }
}
