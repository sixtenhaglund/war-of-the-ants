/* A tiny particle system — right now just beetle blood. */

// spray a burst of red droplets out from (x,y)
function spawnBlood(x, y, amount) {
  for (let k = 0; k < amount; k++) {
    const a = rand(0, 6.28), sp = rand(20, 100);
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.3, 0.7), max: 0.7,
      r: rand(1.5, 3),
    });
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.9; p.vy *= 0.9;          // drag: they slow down
    p.life -= dt;
  }
  for (let i = particles.length - 1; i >= 0; i--) {   // drop the dead ones
    if (particles[i].life <= 0) particles.splice(i, 1);
  }
}

// draw them (inside the world transform) — fading out as they die. Blood is red;
// acid splashes (tagged acid:true) are green.
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.acid ? '#9fe02a' : '#b41414';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, 6.28);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
