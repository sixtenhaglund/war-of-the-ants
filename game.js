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
    const dx = Math.cos(queen.angle) * move;
    const dy = Math.sin(queen.angle) * move;
    moveQueen(dx * queen.speed * dt, dy * queen.speed * dt);
  }
  const movedDist = Math.hypot(queen.x - preX, queen.y - preY);

  // legs animate only when she actually walks (not when just turning)
  legActive = move !== 0 && movedDist > 0.1;
  if (legActive) walkPhase += dt * 14;

  // 3) biting: start on cooldown while held — but NOT while carrying something
  //    (her mouth is full). Damage lands when the jaws snap shut.
  if (biteCd > 0) biteCd -= dt;
  if (mouseHeld && biteCd <= 0 && !carrying) startBite();
  if (bitePending && (BITE_COOLDOWN - biteCd) / BITE_ANIM >= BITE_IMPACT) {
    chompDamage();
    bitePending = false;
  }

  updateBeetles(dt);
  updateParticles(dt);

  // pick up a dead beetle you walk over (if your jaws are empty)
  if (!carrying) {
    for (const b of beetles) {
      if (b.dead && !b.carried && !b.gone && Math.hypot(b.x - queen.x, b.y - queen.y) < 20) {
        carrying = b; b.carried = true; break;
      }
    }
  }
  // drop it on the nest food pile → it counts as food
  if (carrying && Math.hypot(queen.x - foodPile.x, queen.y - foodPile.y) < 44) {
    carrying.gone = true; carrying = null; foodCount++;
    document.getElementById('score').textContent = '🪲 Food: ' + foodCount;
  }

  // pick any berry you walk over
  for (const p of plants) {
    if (p.type === 'berry' && !p.picked && Math.hypot(p.x - queen.x, p.y - queen.y) < 18) {
      p.picked = true; berryCount++;
      document.getElementById('berries').textContent = '🍒 Berries: ' + berryCount;
    }
  }

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
  requestAnimationFrame(loop);
}
