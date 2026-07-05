/* The game loop: update everything, then draw it. */

function update(dt) {
  // 1) glide to FACE THE MOUSE (ease part-way each frame, never snap)
  const mwx = (mouse.x - W / 2) / cam.zoom + cam.x;
  const mwy = (mouse.y - H / 2) / cam.zoom + cam.y;
  const targetAngle = Math.atan2(mwy - queen.y, mwx - queen.x);
  queen.angle += angleDiff(queen.angle, targetAngle) * Math.min(1, dt * TURN_RATE);
  pushOutOfWalls();   // if turning shoved her into rock, slide her out

  // 2) W forward, S back — always along the way she faces
  let move = 0;
  if (keys['w'] || keys['W']) move += 1;
  if (keys['s'] || keys['S']) move -= 1;
  const preX = queen.x, preY = queen.y;
  if (move !== 0) {
    const spd = queen.speed * (dragging ? DRAG_SLOW : 1);   // heavy centipede slows her down
    const dx = Math.cos(queen.angle) * move;
    const dy = Math.sin(queen.angle) * move;
    moveQueen(dx * spd * dt, dy * spd * dt);
  }
  const movedDist = Math.hypot(queen.x - preX, queen.y - preY);

  // legs animate only when she actually walks (not when just turning), and they
  // cycle FASTER the faster she's actually moving: frac is how much of her top
  // speed she managed this frame (slowed by dragging, or by scraping a wall).
  legActive = move !== 0 && movedDist > 0.1;
  const maxStep = queen.speed * dt;
  const frac = maxStep > 0 ? movedDist / maxStep : 0;
  if (legActive) walkPhase += dt * 22 * frac;

  // 3) biting: start on cooldown while held — but NOT while carrying something
  //    (her mouth is full). Damage lands when the jaws snap shut.
  if (biteCd > 0) biteCd -= dt;
  if (mouseHeld && biteCd <= 0 && carried.length <= BACK_CAP && !dragging) startBite();   // blocked when her mouth is busy
  if (bitePending && (BITE_COOLDOWN - biteCd) / BITE_ANIM >= BITE_IMPACT) {
    chompDamage();
    bitePending = false;
  }

  // glide the turn-around: ease dragFlip toward 1 while dragging, back to 0 when not
  const flipTarget = dragging ? 1 : 0;
  dragFlip += (flipTarget - dragFlip) * Math.min(1, dt * 7);

  updateBeetles(dt);
  updateCentipedes(dt);
  updateDrag();                                 // keep the dragged centipede pinned to her mouth
  updateParticles(dt);

  // let just-dropped beetles lie a moment before they can be re-grabbed
  for (const b of beetles) if (b.noPickup > 0) b.noPickup -= dt;

  // HUD: food in the pile (and its limit), plus what she's hauling right now
  const load = carried.length + (dragging ? 1 : 0);
  document.getElementById('score').textContent =
    '🍖 Food: ' + foodCount + '/' + FOOD_LIMIT +
    (foodCount >= FOOD_LIMIT ? '  (FULL)' : '') +
    (load ? '   🐜 carrying ' + load : '');

  updateFog();

  // camera follows the queen, clamped so we never show past the world edge
  const halfW = (W / 2) / cam.zoom, halfH = (H / 2) / cam.zoom;
  cam.x = WORLD_W < 2 * halfW ? WORLD_W / 2 : clamp(queen.x, halfW, WORLD_W - halfW);
  cam.y = WORLD_H < 2 * halfH ? WORLD_H / 2 : clamp(queen.y, halfH, WORLD_H - halfH);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);   // cap dt so tab-switches don't jump
  last = now;
  update(dt);
  draw();
  if (running) requestAnimationFrame(loop);          // death sets running=false → the loop halts
}
