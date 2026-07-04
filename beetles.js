/* Beetles: the bugs you hunt, and the nest food pile you feed. */

// living beetles wander slowly around their cave — but PANIC and run away when
// the queen gets close. They bounce off rock either way.
const FLEE_RANGE = 140;   // how close the queen can get before a beetle bolts
function updateBeetles(dt) {
  for (const b of beetles) {
    if (b.dead || b.gone || b.carried) continue;

    const dx = b.x - queen.x, dy = b.y - queen.y;   // vector pointing AWAY from her
    const dist = Math.hypot(dx, dy);

    let speed;
    if (dist < FLEE_RANGE) {
      b.angle = Math.atan2(dy, dx);   // face straight away from the queen
      b.wanderT = rand(0.2, 0.6);     // don't fall back into an old wander mid-panic
      speed = 52;                     // scared beetles are quick (but slower than the queen)
    } else {
      b.wanderT -= dt;
      if (b.wanderT <= 0) { b.angle = rand(0, 6.28); b.wanderT = rand(0.6, 2.2); }
      speed = 24;
    }

    const nx = b.x + Math.cos(b.angle) * speed * dt;
    const ny = b.y + Math.sin(b.angle) * speed * dt;
    if (!isRock(nx, b.y)) b.x = nx; else b.angle = rand(0, 6.28);
    if (!isRock(b.x, ny)) b.y = ny; else b.angle = rand(0, 6.28);
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

// the nest food pile — a heap that grows as you deliver beetles
function drawFoodPile() {
  ctx.strokeStyle = 'rgba(255,215,120,0.4)'; ctx.lineWidth = 2;   // faint drop-spot ring
  ctx.beginPath(); ctx.arc(foodPile.x, foodPile.y, 22, 0, 6.28); ctx.stroke();
  const n = foodCount * 3;
  for (let k = 0; k < n; k++) {
    const a = k * 2.399;                          // golden-angle spiral fills the heap
    const rr = 2 + Math.sqrt(k) * 3;
    ctx.fillStyle = k % 2 ? '#8a8a8a' : '#707070';
    ctx.beginPath();
    ctx.arc(foodPile.x + Math.cos(a) * rr, foodPile.y + Math.sin(a) * rr, 4, 0, 6.28);
    ctx.fill();
  }
}
