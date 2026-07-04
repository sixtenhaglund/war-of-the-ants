/* =========================================================================
   WAR OF THE ANTS — shared config, constants, and game state.
   This file loads first: every other file uses the things defined here.
   (These files are plain <script>s, so they all share one global scope —
    no imports needed, just load them in the right order.)
   ========================================================================= */

const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');

// ---- world grid (in tiles) — much bigger than the screen ----
const TILE = 44;
const COLS = 120, ROWS = 84;                 // a big cave world
const WORLD_W = COLS * TILE, WORLD_H = ROWS * TILE;

// ---- world state (filled in by buildWorld) ----
let grid;                 // grid[r*COLS+c] === true  → a solid block
let hard;                 // 1 if that block is tough ROCK, 0 if DIRT
let hits;                 // how many bites this block has taken (saved!)
let bigId;                // for a 2×2 big-rock tile: its block's top-left index (else -1)
let grass;                // open-floor ground type: 1 = grassy floor, 0 = bare dirt
let explored, visible;    // fog: seen-before? / seen right now?
let beetles = [];         // bugs living in the caves
let carrying = null;      // the dead beetle the queen is hauling (or null)
let foodCount = 0;        // beetles delivered to the nest food pile
let plants = [];          // cave decorations: bushes and berry plants
let particles = [];       // blood droplets etc.
let W, H;                 // screen size
let running = false;
let bigMap = false;       // is the full-screen map open? (toggled with M)

// ⚠ TEMPORARY DEBUG: reveal the whole map + infinite vision so you can see every
//   cave. Set back to false to restore the normal fog of war.
const DEBUG_SEE_ALL = true;

// ---- the queen ----
const queen = { x: WORLD_W / 2, y: WORLD_H / 2, speed: 100, angle: 0 };

// The ant's body = three ellipses in its own frame (it faces +x). The DRAWING
// and the HITBOX both read this data, so the hitbox matches the ant exactly.
// The legs are drawn separately and are NOT part of the hitbox.
const BODY_PARTS = [
  { x: -10, y: 0, rx: 9, ry: 7 },   // abdomen
  { x:  -1, y: 0, rx: 5, ry: 5 },   // thorax
  { x:   7, y: 0, rx: 6, ry: 5 },   // head
];
// turn those ellipses into a ring of sample points we test against the rock
const BODY = [];
for (const p of BODY_PARTS) {
  BODY.push([p.x, p.y]);
  for (let a = 0; a < 6.28; a += Math.PI / 4) {
    BODY.push([p.x + Math.cos(a) * p.rx, p.y + Math.sin(a) * p.ry]);
  }
}
const NOSE = 15;   // centre → just past the head tip (must reach past her body to bite)

// ---- camera & vision ----
const cam = { x: 0, y: 0, zoom: 1.4 };
const REVEAL = 320;                          // how far the queen sees (pixels)

// ---- tuning knobs ----
const DIRT_HP = 2;                           // dirt breaks in 2 bites
const ROCK_HP = 5;                           // grey rock is tougher: 5 bites
const BIGROCK_HP = 8;                         // big 2×2 rock blocks are toughest: 8 bites
const ROCK_CHANCE = 0.3;                     // fewer solid blocks are hard rock now (was 0.5)
const BIGROCK_COUNT = 45;                     // how many tough 2×2 rock blocks to scatter
const BEETLE_HP = 2;                         // beetles die in 2 bites
const BITE_COOLDOWN = 1.0;                   // seconds between bites (the wait)
const BITE_ANIM = 0.45;                      // how long the bite ANIMATION takes
const BITE_IMPACT = 0.75;                    // point in the animation (0..1) where jaws snap → damage
let biteCd = 0;                              // time left until she can bite again
let bitePending = false;                     // a bite is mid-swing; damage not applied yet
let walkPhase = 0;                           // advances while walking → drives the leg swing
let legActive = false;                       // are the legs animating right now?
let mouseHeld = false;                       // is the mouse button held (mining)?
const keys = {};                             // which keyboard keys are down

// the nest food pile — carry dead beetles here to score them
const foodPile = { x: WORLD_W / 2 + 60, y: WORLD_H / 2 };

const mouse = { x: innerWidth / 2, y: innerHeight / 2 };  // last known mouse (screen)
const TURN_RATE = 6.5;   // how fast she glides to face the mouse

// ---- little maths helpers ----
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);

// smallest turn from angle a to angle b, kept in -PI..PI so she turns the short way
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// Slide a value through keyframes [ [time, value], ... ] for time in 0..1.
function keyed(t, frames) {
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, v0] = frames[i], [t1, v1] = frames[i + 1];
    if (t <= t1) {
      const f = clamp((t - t0) / (t1 - t0 || 1), 0, 1);
      return v0 + (v1 - v0) * f;
    }
  }
  return frames[frames.length - 1][1];
}

// ---- minimap cache: an offscreen image of the world, ONE PIXEL per tile. We
//      stamp a tile onto it only when it changes (newly explored, or dug out),
//      instead of redrawing all COLS*ROWS tiles every single frame. ----
const mini = document.createElement('canvas');
mini.width = COLS; mini.height = ROWS;
const mctx = mini.getContext('2d');

// paint one tile onto the minimap cache in its current colour
function stampMini(c, r) {
  const i = r * COLS + c;
  mctx.fillStyle = grid[i] ? (hard[i] === 2 ? '#4c4c5e' : hard[i] ? '#6c6c7a' : '#6b5230') : '#3a2b16';
  mctx.fillRect(c, r, 1, 1);
}
