# War of The Ants

A browser game where you play a **queen ant** digging through a huge underground cave world.

## Play
Open `index.html` in a browser and press **PLAY**.

## Controls
- **Mouse** — steer (the queen turns to face the cursor)
- **W / S** — move forward / back
- **Hold left click** — bite: mine the wall or attack a beetle in front of you
- **Left click** a dead beetle — pick it up (carry up to 3: 1 in the mouth + 2 on the back)
- **Right click** — spit the beetle in your mouth back onto the ground
- **Scroll** — zoom in / out

## Goal
Dig out of your walled-in nest, explore the caves, and hunt **beetles** (2 bites each).
Carry the dead beetles back to the **food pile** in your nest to score them — every
beetle you deliver shows up as a real beetle in the heap.

## How the code is organised
Plain HTML/CSS/JS, split into files that share one global scope (loaded in order):

| File | What it does |
|------|--------------|
| `config.js` | constants, game state, maths helpers, minimap cache |
| `world.js`  | cave/rock generation, fog of war |
| `queen.js`  | the queen: collision, movement, biting, drawing |
| `beetles.js`| beetle behaviour + drawing, the food pile |
| `render.js` | drawing the world through the camera + the minimap |
| `input.js`  | keyboard / mouse / PLAY button |
| `game.js`   | the main update + draw loop |
