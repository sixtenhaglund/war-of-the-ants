/* Keyboard, mouse, window events, and the PLAY button. */

addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === '+' || e.key === '=') cam.zoom = clamp(cam.zoom * 1.15, 0.6, 3);
  if (e.key === '-' || e.key === '_') cam.zoom = clamp(cam.zoom / 1.15, 0.6, 3);
});
addEventListener('keyup', e => { keys[e.key] = false; });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.12 : 0.89), 0.6, 3);
}, { passive: false });

// track the mouse so the queen can steer toward it
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

// hold the mouse button to mine / bite in front of the queen
canvas.addEventListener('mousedown', () => { mouseHeld = true; });
addEventListener('mouseup', () => { mouseHeld = false; });

function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', () => { if (running) resize(); });

// ---- PLAY button (called from index.html) ----
function startGame() {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('game').style.display = 'block';
  resize();
  if (!grid) buildWorld();
  if (!running) { running = true; requestAnimationFrame(loop); }
}
