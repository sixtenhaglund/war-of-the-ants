/* Rendering: the world through the camera, plus the minimap. */

function draw() {
  ctx.fillStyle = '#000';                        // unexplored world stays black
  ctx.fillRect(0, 0, W, H);

  // ---- world, seen through the camera (translate → scale → translate) ----
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  // only loop over the tiles that could be on screen (fast)
  const halfW = (W / 2) / cam.zoom, halfH = (H / 2) / cam.zoom;
  const c0 = Math.max(0, Math.floor((cam.x - halfW) / TILE));
  const c1 = Math.min(COLS - 1, Math.ceil((cam.x + halfW) / TILE));
  const r0 = Math.max(0, Math.floor((cam.y - halfH) / TILE));
  const r1 = Math.min(ROWS - 1, Math.ceil((cam.y + halfH) / TILE));

  for (let c = c0; c <= c1; c++) {
    for (let r = r0; r <= r1; r++) {
      const i = r * COLS + c;
      if (!explored[i]) continue;                // never seen → leave it black
      const x = c * TILE, y = r * TILE;

      if (grid[i]) {                             // a solid block
        // colour by tier: big rock (dark) > grey rock > brown dirt
        const col = hard[i] === 2 ? ['#3a3a48', '#4c4c5e', '#20202a']
                  : hard[i]        ? ['#565662', '#6c6c7a', '#33333c']
                  :                  ['#5a4325', '#6b5230', '#3a2b16'];
        ctx.fillStyle = col[0];
        ctx.fillRect(x, y, TILE, TILE);
        if (hard[i] === 2) {
          // BIG ROCK: only frame/outline the edges facing NON-big-rock, so
          // ORTHOGONALLY touching big rock fuses into one block (diagonal touches
          // don't join). Inner edges OVERLAP by 1px so the fills leave no seam.
          const bT = isBigRock(c, r - 1), bB = isBigRock(c, r + 1),
                bL = isBigRock(c - 1, r), bR = isBigRock(c + 1, r);
          const l = bL ? -1 : 3, t = bT ? -1 : 3, rr = bR ? -1 : 3, bb = bB ? -1 : 3;
          ctx.fillStyle = col[1];
          ctx.fillRect(x + l, y + t, TILE - l - rr, TILE - t - bb);
          ctx.strokeStyle = col[2]; ctx.lineWidth = 1;
          ctx.beginPath();                         // outline only the outer edges
          if (!bT) { ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x + TILE + 0.5, y + 0.5); }
          if (!bB) { ctx.moveTo(x + 0.5, y + TILE + 0.5); ctx.lineTo(x + TILE + 0.5, y + TILE + 0.5); }
          if (!bL) { ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x + 0.5, y + TILE + 0.5); }
          if (!bR) { ctx.moveTo(x + TILE + 0.5, y + 0.5); ctx.lineTo(x + TILE + 0.5, y + TILE + 0.5); }
          ctx.stroke();
          // darken from the whole block's shared health, overlapping inner edges
          const dmg = bigId[i] >= 0 ? hits[bigId[i]] / BIGROCK_HP : 0;
          if (dmg > 0) {
            ctx.fillStyle = 'rgba(0,0,0,' + (0.7 * dmg) + ')';
            ctx.fillRect(x - (bL ? 1 : 0), y - (bT ? 1 : 0),
                         TILE + (bL ? 1 : 0) + (bR ? 1 : 0), TILE + (bT ? 1 : 0) + (bB ? 1 : 0));
          }
        } else {
          ctx.fillStyle = col[1];
          ctx.fillRect(x + 3, y + 3, TILE - 8, TILE - 8);
          ctx.strokeStyle = col[2];
          ctx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
          if (hits[i] > 0) {                        // per-block damage darkening
            ctx.fillStyle = 'rgba(0,0,0,' + (0.7 * (hits[i] / maxHits(i))) + ')';
            ctx.fillRect(x, y, TILE, TILE);
          }
        }
      } else {                                    // open floor
        ctx.fillStyle = grass[i] ? '#2f8a34' : '#2a1e0e';   // grassy ground vs bare dirt
        ctx.fillRect(x, y, TILE, TILE);
        if (grass[i]) {                            // flat grass flecks (fixed per tile)
          ctx.fillStyle = '#3fa845';
          for (let g = 0; g < 4; g++) {
            const gx = x + 4 + ((c * 13 + g * 11) % (TILE - 8));
            const gy = y + 4 + ((r * 17 + g * 7) % (TILE - 8));
            ctx.fillRect(gx, gy, 2, 2);
          }
        }
      }

      if (!visible[i]) {                          // explored but not in sight → dim
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }

  drawPlants();                                   // cave grass, bushes, berries

  // food pile in the nest (once you've seen that spot)
  const fpc = Math.floor(foodPile.x / TILE), fpr = Math.floor(foodPile.y / TILE);
  if (explored[fpr * COLS + fpc]) drawFoodPile();

  // beetles you can currently SEE (fog hides the rest)
  for (const b of beetles) {
    if (b.gone || b.carried) continue;
    const bc = Math.floor(b.x / TILE), br = Math.floor(b.y / TILE);
    if (bc < 0 || br < 0 || bc >= COLS || br >= ROWS) continue;
    if (!visible[br * COLS + bc]) continue;
    drawBeetle(b.x, b.y, b.angle, b.dead);
    if (!b.dead) drawBeetleHp(b);                 // health bar over living beetles
  }

  drawParticles();                                // blood splatter

  drawQueen();

  if (carrying) {                                 // whatever's held in her mouth
    ctx.save();
    ctx.translate(queen.x, queen.y);
    ctx.rotate(queen.angle);
    if (carrying.kind === 'berry') {
      ctx.fillStyle = '#d23b3b';                  // a berry in her jaws
      ctx.beginPath(); ctx.arc(16, 0, 4, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#f07a68';
      ctx.beginPath(); ctx.arc(14.8, -1.3, 1.4, 0, 6.28); ctx.fill();
    } else {
      drawBeetle(16, 0, 0, true, true);           // a beetle in her jaws
    }
    ctx.restore();
  }

  ctx.restore();
  drawMinimap();
}

// ---- minimap: blit the cached world image into a square box, bottom-left.
//      No per-tile loop here anymore — we just scale up the pre-stamped image. ----
function drawMinimap() {
  // small in the corner normally; big and centred when the M-map is open
  const MM = bigMap ? Math.min(W, H) * 0.9 : 190;
  const bx = bigMap ? (W - MM) / 2 : 14;
  const by = bigMap ? (H - MM) / 2 : H - MM - 14;
  const sc = Math.min(MM / COLS, MM / ROWS);      // fit COLS×ROWS pixels into the box
  const dw = COLS * sc, dh = ROWS * sc;
  const ox = bx + (MM - dw) / 2, oy = by + (MM - dh) / 2;

  if (bigMap) {                                   // darken the game behind the big map
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(bx, by, MM, MM);

  ctx.imageSmoothingEnabled = false;              // crisp pixels, not blurry
  ctx.drawImage(mini, ox, oy, dw, dh);            // the cached explored map, scaled up

  // markers snap to the SAME grid as the map: each fills exactly one tile pixel,
  // using the same rounded edges the scaled map image uses for that tile — so a
  // marker is the same size as a normal minimap pixel.
  const markTile = (tc, tr, colour) => {
    const x0 = Math.round(ox + tc * sc), x1 = Math.round(ox + (tc + 1) * sc);
    const y0 = Math.round(oy + tr * sc), y1 = Math.round(oy + (tr + 1) * sc);
    ctx.fillStyle = colour;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  };

  // creatures: enemies = red, passive beetles = blue — but only the ones you've
  // already discovered (their tile is explored), so the map respects the fog.
  for (const b of beetles) {
    if (b.dead || b.gone || b.carried) continue;
    const bc = Math.floor(b.x / TILE), br = Math.floor(b.y / TILE);
    if (bc < 0 || br < 0 || bc >= COLS || br >= ROWS || !explored[br * COLS + bc]) continue;
    markTile(bc, br, b.hostile ? '#e0463c' : '#4aa3ff');   // red if hostile, else blue
  }

  // friends (green) — draw any you add to a `friends` array later
  if (typeof friends !== 'undefined')
    for (const f of friends) markTile(Math.floor(f.x / TILE), Math.floor(f.y / TILE), '#46d068');

  markTile(Math.floor(queen.x / TILE), Math.floor(queen.y / TILE), '#46d068');   // you (the queen) — green

  ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, MM, MM);

  if (bigMap) {                                   // little hint under the big map
    ctx.fillStyle = '#ffd479';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press M to close', W / 2, oy + dh + 26);
    ctx.textAlign = 'left';                        // reset so other text isn't centred
  }
}

// ---- cave plants: grass tufts, bushes, and pick-able berry plants ----
function drawPlants() {
  for (const p of plants) {
    const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
    if (pc < 0 || pr < 0 || pc >= COLS || pr >= ROWS) continue;
    if (!visible[pr * COLS + pc]) continue;        // only where the queen can see
    drawPlant(p);
  }
}

function drawPlant(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(0.8 + p.seed * 0.5, 0.8 + p.seed * 0.5);   // slight size variety per plant

  if (p.type === 'bush') {
    ctx.fillStyle = '#2f6b2c';                     // clump of round leaves
    for (const [ox, oy, r] of [[-4, 1, 5], [4, 1, 5], [0, -3, 6], [0, 2, 5]]) {
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, 6.28); ctx.fill();
    }
    ctx.fillStyle = '#3c8a37';                     // lighter highlight on top
    ctx.beginPath(); ctx.arc(-1, -2, 4, 0, 6.28); ctx.fill();
  } else {                                         // berry plant
    ctx.fillStyle = '#2f6b2c';                     // small green plant
    for (const [ox, oy] of [[-4, 1], [4, 1], [0, -3]]) {
      ctx.beginPath(); ctx.arc(ox, oy, 4.5, 0, 6.28); ctx.fill();
    }
    if (!p.picked) {                               // the pickable berry (gone once taken)
      ctx.fillStyle = '#d23b3b';
      ctx.beginPath(); ctx.arc(0, -5, 3.4, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#f07a68';                   // shine
      ctx.beginPath(); ctx.arc(-1.1, -6, 1.1, 0, 6.28); ctx.fill();
    }
  }
  ctx.restore();
}
