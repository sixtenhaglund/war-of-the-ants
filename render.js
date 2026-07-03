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
        const rock = hard[i];                    // tough rock (grey) vs dirt (brown)
        ctx.fillStyle = rock ? '#565662' : '#5a4325';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = rock ? '#6c6c7a' : '#6b5230';
        ctx.fillRect(x + 3, y + 3, TILE - 8, TILE - 8);
        ctx.strokeStyle = rock ? '#33333c' : '#3a2b16';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
        if (hits[i] > 0) {                        // darker per break stage (saved damage)
          ctx.fillStyle = 'rgba(0,0,0,' + (0.7 * (hits[i] / maxHits(i))) + ')';
          ctx.fillRect(x, y, TILE, TILE);
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
  }

  drawQueen();

  if (carrying) {                                 // the beetle riding on her back
    ctx.save();
    ctx.translate(queen.x, queen.y);
    ctx.rotate(queen.angle);
    drawBeetle(-14, 0, 0, true, true);
    ctx.restore();
  }

  ctx.restore();
  drawMinimap();
}

// ---- minimap: blit the cached world image into a square box, bottom-left.
//      No per-tile loop here anymore — we just scale up the pre-stamped image. ----
function drawMinimap() {
  const MM = 190;
  const bx = 14, by = H - MM - 14;
  const sc = Math.min(MM / COLS, MM / ROWS);      // fit COLS×ROWS pixels into the box
  const dw = COLS * sc, dh = ROWS * sc;
  const ox = bx + (MM - dw) / 2, oy = by + (MM - dh) / 2;

  ctx.fillStyle = '#000';
  ctx.fillRect(bx, by, MM, MM);

  ctx.imageSmoothingEnabled = false;              // crisp pixels, not blurry
  ctx.drawImage(mini, ox, oy, dw, dh);            // the cached explored map, scaled up

  ctx.fillStyle = '#ffd479';                      // queen dot
  ctx.beginPath();
  ctx.arc(ox + (queen.x / TILE) * sc, oy + (queen.y / TILE) * sc, 3, 0, 6.28);
  ctx.fill();

  ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, MM, MM);
}
