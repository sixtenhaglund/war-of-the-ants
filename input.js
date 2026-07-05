/* Keyboard, mouse, window events, and the PLAY button. */

addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === '+' || e.key === '=') cam.zoom = clamp(cam.zoom * 1.15, 0.6, 3);
  if (e.key === '-' || e.key === '_') cam.zoom = clamp(cam.zoom / 1.15, 0.6, 3);
  if (e.key === 'm' || e.key === 'M') bigMap = !bigMap;   // toggle the full-screen map
  if ((e.key === 'e' || e.key === 'E') && !e.repeat) eat();  // eat prey / open the pile menu (once per press)
  if (e.key === 'Escape' && pileMenuOpen) closePileMenu();
});
addEventListener('keyup', e => { keys[e.key] = false; });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.12 : 0.89), 0.6, 3);
}, { passive: false });

// track the mouse so the queen can steer toward it
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

// left click: grab dead prey in reach → otherwise hold to mine / bite
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;                // only the left button mines / grabs
  if (tryGrab()) return;                     // grab a dead beetle / centipede
  mouseHeld = true;
});
addEventListener('mouseup', () => { mouseHeld = false; });

// right click: drop what she's holding — into the pile if she's on it, else on the ground
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
