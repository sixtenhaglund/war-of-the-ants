/* Rendering: the world through the camera, plus the minimap. */

// tile colour tiers [base, face, outline] — defined once, not rebuilt per tile
const COL_DIRT    = ['#5a4325', '#6b5230', '#3a2b16'];
const COL_ROCK    = ['#565662', '#6c6c7a', '#33333c'];
const COL_BIGROCK = ['#3a3a48', '#4c4c5e', '#20202a'];

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

  // zoomed out → far more tiles on screen; skip the fine per-tile detail (insets
  // and stroked borders are the pricey part and are barely visible when small).
  const detail = cam.zoom >= 1.05;

  for (let c = c0; c <= c1; c++) {
    for (let r = r0; r <= r1; r++) {
      const i = r * COLS + c;
      if (!explored[i]) continue;                // never seen → leave it black
      const x = c * TILE, y = r * TILE;

      if (grid[i]) {                             // a solid block
        // colour by tier: big rock (dark) > grey rock > brown dirt
        const col = hard[i] === 2 ? COL_BIGROCK : hard[i] ? COL_ROCK : COL_DIRT;

        if (!detail) {                           // zoomed out → one flat square, no borders
          ctx.fillStyle = col[1];
          ctx.fillRect(x, y, TILE, TILE);
          const dmg = hard[i] === 2 && bigId[i] >= 0 ? hits[bigId[i]] / BIGROCK_HP : hits[i] / maxHits(i);
          if (dmg > 0) {
            ctx.fillStyle = 'rgba(0,0,0,' + (0.7 * dmg) + ')';
            ctx.fillRect(x, y, TILE, TILE);
          }
          if (!visible[i]) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, TILE, TILE); }
          continue;                              // done with this tile
        }

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
        ctx.fillStyle = '#2a1e0e';
        ctx.fillRect(x, y, TILE, TILE);
      }

      if (!visible[i]) {                          // explored but not in sight → dim
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }

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

  // centipedes you can currently SEE (the dragged one is drawn with the queen)
  for (const c of centipedes) {
    if (c.gone || c.carried) continue;
    const cc = Math.floor(c.x / TILE), cr = Math.floor(c.y / TILE);
    if (cc < 0 || cr < 0 || cc >= COLS || cr >= ROWS) continue;
    if (!visible[cr * COLS + cc]) continue;
    drawCentipede(c);
    if (!c.dead) drawCentipedeHp(c);              // health bar over living centipedes
  }

  drawParticles();                                // blood splatter

  if (dragging) drawCentipede(dragging);          // the corpse she's hauling, under her body
  drawQueen();

  // the beetles she's hauling: the first BACK_CAP ride on her back; only once those
  // are full does the next one (the 3rd) go in her mouth out front
  for (let k = 0; k < carried.length; k++) {
    ctx.save();
    ctx.translate(queen.x, queen.y);
    ctx.rotate(queenFacing());                          // flips with her when she's dragging
    const isMouth = k >= BACK_CAP;                       // slot 3 = the mouth
    if (isMouth) {
      drawBeetle(17, 0, Math.PI / 2, true, false);       // clamped crosswise in her jaws, like a real ant
      drawMandible(1, BODY_PARTS[2].x, 0);               // one jaw laid OVER the beetle → looks gripped
    } else {
      drawBeetle(-8 - k * 7, 0, 0, true, true);          // back ones lie flat over her abdomen
    }
    ctx.restore();
  }

  ctx.restore();
  drawMinimap();
  drawQueenHp();
}

// the queen's health bar, top-centre of the screen (drawn in screen coords)
function drawQueenHp() {
  const w = 220, h = 16, x = W / 2 - w / 2, y = 14;
  const frac = clamp(queen.hp / QUEEN_HP, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = frac > 0.5 ? '#46d068' : frac > 0.25 ? '#e8c060' : '#e0463c';  // green → yellow → red
  ctx.fillRect(x, y, w * frac, h);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('QUEEN', W / 2, y + h - 4);
  ctx.textAlign = 'left';                          // reset so other text isn't centred
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
  for (const c of centipedes) {                            // hostile centipedes = red
    if (c.dead || c.gone || c.carried) continue;
    const cc = Math.floor(c.x / TILE), cr = Math.floor(c.y / TILE);
    if (cc < 0 || cr < 0 || cc >= COLS || cr >= ROWS || !explored[cr * COLS + cc]) continue;
    markTile(cc, cr, '#e0463c');
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
