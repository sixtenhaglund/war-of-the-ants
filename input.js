/* Keyboard, mouse, window events, and the PLAY button. */

addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === '+' || e.key === '=') cam.zoom = clamp(cam.zoom * 1.15, 0.6, 3);
  if (e.key === '-' || e.key === '_') cam.zoom = clamp(cam.zoom / 1.15, 0.6, 3);
  if (e.key === 'm' || e.key === 'M') bigMap = !bigMap;   // toggle the full-screen map
});
addEventListener('keyup', e => { keys[e.key] = false; });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.12 : 0.89), 0.6, 3);
}, { passive: false });

// track the mouse so the queen can steer toward it
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

// left click, in priority order: drop your load on the pile → grab dead prey in
// reach → otherwise hold to mine / bite
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;                // only the left button mines / grabs
  if (tryDeposit()) return;                  // standing on the pile → deposit the load
  if (tryGrab()) return;                     // grab a dead beetle / centipede
  mouseHeld = true;
});
addEventListener('mouseup', () => { mouseHeld = false; });

// right click: drop whatever's in her mouth back onto the ground
canvas.addEventListener('contextmenu', e => { e.preventDefault(); dropHeld(); });

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

// after the queen dies: rebuild a fresh world (full health) and start the loop again
function restartGame() {
  document.getElementById('dead').style.display = 'none';
  buildWorld();                 // fresh caves + a full-health queen
  last = performance.now();     // reset the clock so the first frame doesn't jump
  running = true;
  requestAnimationFrame(loop);
}
