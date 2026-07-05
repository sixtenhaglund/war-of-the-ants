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
let explored, visible;    // fog: seen-before? / seen right now?
let beetles = [];         // bugs living in the caves
let centipedes = [];      // long, hostile prey that hunts and bites the queen
let carried = [];         // dead beetles she's hauling: the first BACK_CAP ride on her back, the next in her mouth
let dragging = null;      // a dead centipede being DRAGGED by the mouth (too big to carry) — or null
let dragFlip = 0;         // 0..1 eased turn-around: 1 = fully spun around to haul, 0 = facing normally
let reviveFlash = 0;      // seconds left on the "revived at the nest" banner after a death
const BACK_CAP = 2;       // beetles that fit on her back (mouth stays free, so she can still mine)
const CARRY_CAP = 3;      // total she can hold = 2 on the back + 1 in the mouth
const FOOD_GOAL = 20;     // a target amount of food to stock the nest pile with (a goal, not a cap)
let pileMenuOpen = false; // is the "what's in the pile" eat-menu open? (pauses the game)
let particles = [];       // blood droplets etc.
let W, H;                 // screen size
let running = false;
let bigMap = false;       // is the full-screen map open? (toggled with M)

// ⚠ TEMPORARY DEBUG: reveal the whole map + infinite vision so you can see every
//   cave. Set back to false to restore the normal fog of war.
const DEBUG_SEE_ALL = true;

// ---- the queen ----
const queen = { x: WORLD_W / 2, y: WORLD_H / 2, speed: 100, angle: 0, hp: 20 };
const QUEEN_HP = 20;                          // her full health (centipede bites chip this down)
const DRAG_SLOW = 0.5;                        // she moves at HALF speed while dragging a heavy centipede

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
const BUG_LIMIT = 50;                         // total bugs on the map, spread evenly over caves
const BEETLE_HEAL = 3;                        // eating a beetle (press E) restores 3 HP

// ---- centipedes: long, hostile prey. THREE sizes, each with its own stats.
//      Bigger ones are longer, tougher, hit harder, and give more food — but they
//      crawl slower. Each spawned centipede picks a type and copies these numbers. ----
const CENTI_TYPES = [
  // name        segs spacing  hp  dmg food heal  rMul  speed  colour     shade      timid=runs from the queen
  { name: 'small',  segs: 8,  spacing: 6, hp: 3, dmg: 1, food: 3, heal: 5,  rMul: 0.8, speed: 84, col: '#c46a2a', dark: '#9c4d1a', timid: true },
  { name: 'medium', segs: 12, spacing: 7, hp: 5, dmg: 1, food: 5, heal: 8,  rMul: 1.0, speed: 70, col: '#8a3320', dark: '#642415' },
  { name: 'giant',  segs: 16, spacing: 8, hp: 9, dmg: 2, food: 10, heal: 12, rMul: 1.3, speed: 54, col: '#701818', dark: '#460d0d' },
];
const CENTI_LIMIT = 12;                       // how many roam the caves
const CENTI_CHASE = 210;                      // it starts hunting prey within this range
const CENTI_FLEE = 175;                       // and bolts from a bigger threat within this range
const CENTI_ATTACK = 26;                      // it catches / bites once this close (its HEAD, not tail)
const CENTI_BITE_CD = 1.1;                    // seconds between its bites
const CENTI_WANDER = 26;                      // idle wander speed
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
const PILE_RADIUS = 74;                       // how close counts as "on the pile" for depositing / eating

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
