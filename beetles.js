/* Beetles: the bugs you hunt, and the nest food pile you feed. */

// living beetles wander slowly around their cave, bouncing off rock
function updateBeetles(dt) {
  for (const b of beetles) {
    if (b.dead || b.gone || b.carried) continue;
    b.wanderT -= dt;
    if (b.wanderT <= 0) { b.angle = rand(0, 6.28); b.wanderT = rand(0.6, 2.2); }
    const nx = b.x + Math.cos(b.angle) * 24 * dt;
    const ny = b.y + Math.sin(b.angle) * 24 * dt;
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
