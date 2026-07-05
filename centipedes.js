/* Centipedes: long, HOSTILE prey. They hunt the queen and bite her when close.
   Kill one (5 bites) and it becomes a heavy corpse you DRAG by the mouth — you
   move at half speed, but it's worth 5 food at the pile. */

// build one centipede at head position (x, y), of size CENTI_TYPES[t]. Its body is
// a little "rope" of points (segs) that trails the head — that's what makes it
// slither. It keeps a reference to its `type` so all its stats come from one place.
function makeCentipede(x, y, t) {
  const type = CENTI_TYPES[t];
  const segs = [];
  for (let i = 0; i < type.segs; i++) segs.push({ x, y });    // all stacked on the head at first
  return {
    x, y, angle: rand(0, 6.28), hp: type.hp, maxHp: type.hp, type,
    dead: false, carried: false, gone: false, hostile: true,
    biteCd: 0, wanderT: 0, noPickup: 0, segs,
  };
}

// pull the body along: seg[0] snaps to the head, then each seg is kept exactly
// its type's spacing behind the one in front → a smooth trailing chain.
function followSegs(c) {
  const s = c.segs, gap = c.type.spacing;
  s[0].x = c.x; s[0].y = c.y;
  for (let i = 1; i < s.length; i++) {
    const dx = s[i].x - s[i - 1].x, dy = s[i].y - s[i - 1].y;
    const d = Math.hypot(dx, dy) || 1;
    s[i].x = s[i - 1].x + (dx / d) * gap;
    s[i].y = s[i - 1].y + (dy / d) * gap;
  }
}

function updateCentipedes(dt) {
  for (const c of centipedes) {
    if (c.noPickup > 0) c.noPickup -= dt;         // just-dropped corpses lie a moment
    if (c.gone || c.carried) continue;            // gone = eaten; carried = being dragged (drag code moves it)
    if (c.dead) { followSegs(c); continue; }      // a still corpse — keep its body coherent

    if (c.biteCd > 0) c.biteCd -= dt;

    // A centipede sits in a size hierarchy. It FLEES anything bigger (and, if it's
    // a timid small one, the queen too), and HUNTS anything smaller (beetles,
    // smaller centipedes, and — if it's aggressive — the queen). Survival first:
    // if a threat is near it runs; otherwise it chases the nearest prey.
    let thX = 0, thY = 0, thD = CENTI_FLEE;       // nearest threat (to flee)
    let pyX = 0, pyY = 0, pyD = CENTI_CHASE;      // nearest prey (to hunt)

    // It only NOTICES something it can actually SEE — clearLine blocks vision through
    // walls (checked only once a candidate is the closest so far, to stay cheap).
    const qd = Math.hypot(queen.x - c.x, queen.y - c.y);
    if (c.type.timid) { if (qd < thD && clearLine(c.x, c.y, queen.x, queen.y)) { thD = qd; thX = queen.x; thY = queen.y; } }   // scared of the queen
    else              { if (qd < pyD && clearLine(c.x, c.y, queen.x, queen.y)) { pyD = qd; pyX = queen.x; pyY = queen.y; } }   // hunts the queen

    for (const b of beetles) {                    // beetles are always prey
      if (b.dead || b.gone || b.carried) continue;
      const d = Math.hypot(b.x - c.x, b.y - c.y);
      if (d < pyD && clearLine(c.x, c.y, b.x, b.y)) { pyD = d; pyX = b.x; pyY = b.y; }
    }
    for (const o of centipedes) {                 // bigger centipedes = threat, smaller = prey
      if (o === c || o.dead || o.gone || o.carried) continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (o.type.segs > c.type.segs) { if (d < thD && clearLine(c.x, c.y, o.x, o.y)) { thD = d; thX = o.x; thY = o.y; } }
      else if (o.type.segs < c.type.segs) { if (d < pyD && clearLine(c.x, c.y, o.x, o.y)) { pyD = d; pyX = o.x; pyY = o.y; } }
    }

    if (thD < CENTI_FLEE) {                        // FLEE: bolt away from the threat, rounding corners
      c.angle = openHeading(c.x, c.y, Math.atan2(c.y - thY, c.x - thX), 20);
      crawl(c, c.type.speed * dt);
    } else if (pyD < CENTI_CHASE) {                // HUNT: crawl at the prey, routing around walls
      c.angle = openHeading(c.x, c.y, Math.atan2(pyY - c.y, pyX - c.x), 20);
      crawl(c, c.type.speed * dt);
    } else {                                       // WANDER when nothing's around
      c.wanderT -= dt;
      if (c.wanderT <= 0) { c.angle = rand(0, 6.28); c.wanderT = rand(0.8, 2.2); }
      const mvx = Math.cos(c.angle) * CENTI_WANDER * dt;
      const mvy = Math.sin(c.angle) * CENTI_WANDER * dt;
      if (!isRock(c.x + mvx, c.y)) c.x += mvx; else c.angle = rand(0, 6.28);
      if (!isRock(c.x, c.y + mvy)) c.y += mvy; else c.angle = rand(0, 6.28);
    }
    followSegs(c);                                // body trails the head

    // catch & eat prey its head reaches: living beetles, then smaller centipedes
    for (const b of beetles) {
      if (b.dead || b.gone || b.carried) continue;
      if (Math.hypot(b.x - c.x, b.y - c.y) < CENTI_ATTACK) { b.gone = true; spawnBlood(b.x, b.y, 8); break; }
    }
    for (const o of centipedes) {
      if (o === c || o.dead || o.gone || o.carried || o.type.segs >= c.type.segs) continue;
      if (Math.hypot(o.x - c.x, o.y - c.y) < CENTI_ATTACK) { o.gone = true; spawnBlood(o.x, o.y, 10); break; }
    }

    // aggressive types bite the QUEEN with their HEAD (the tail is harmless) — but
    // only with real line of sight, so it can't reach her THROUGH a wall
    if (!c.type.timid && c.biteCd <= 0 && qd < CENTI_ATTACK && clearLine(c.x, c.y, queen.x, queen.y)) {
      queen.hp -= c.type.dmg;
      c.biteCd = CENTI_BITE_CD;
      spawnBlood(queen.x, queen.y, 6);
      const ax = queen.x - c.x, ay = queen.y - c.y, ad = Math.hypot(ax, ay) || 1;   // knock her away
      const kx = (ax / ad) * 6, ky = (ay / ad) * 6;
      if (!isRock(queen.x + kx, queen.y + ky)) { queen.x += kx; queen.y += ky; }
      if (queen.hp <= 0) gameOver();
    }
  }
}

// crawl the centipede head along c.angle by sp, sliding along any wall it meets
function crawl(c, sp) {
  const mvx = Math.cos(c.angle) * sp, mvy = Math.sin(c.angle) * sp;
  if (!isRock(c.x + mvx, c.y)) c.x += mvx;
  if (!isRock(c.x, c.y + mvy)) c.y += mvy;
}

// while dragging, the corpse's head is pinned to the queen's mouth and the rest
// of its body drags along the ground behind her.
function updateDrag() {
  if (!dragging) return;
  const a = queenFacing();                         // her mouth now points backward (she hauls it behind her)
  dragging.x = queen.x + Math.cos(a) * 18;
  dragging.y = queen.y + Math.sin(a) * 18;
  followSegs(dragging);
}

// draw a centipede from its segs: overlapping circles, thick at the head, with
// little legs and a fanged head. Grey when dead.
function drawCentipede(c) {
  const s = c.segs, n = s.length, dead = c.dead, m = c.type.rMul;   // m = size multiplier
  const bodyA = dead ? '#5a5a5a' : c.type.dark;
  const bodyB = dead ? '#6c6c6c' : c.type.col;

  // legs first (under the body): two per segment, poking out sideways
  ctx.strokeStyle = dead ? '#4a4a4a' : '#3a140a'; ctx.lineWidth = 1.4;
  for (let i = 1; i < n; i++) {
    const dx = s[i - 1].x - s[i].x, dy = s[i - 1].y - s[i].y;
    const d = Math.hypot(dx, dy) || 1;
    const px = -dy / d, py = dx / d;              // sideways (perpendicular to the body)
    const wig = Math.sin(i * 1.3) * 2;            // stagger the legs so they don't line up
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s[i].x, s[i].y);
      ctx.lineTo(s[i].x + px * side * 7 * m + (dx / d) * wig, s[i].y + py * side * 7 * m + (dy / d) * wig);
      ctx.stroke();
    }
  }

  // body segments, tail → head so the head sits on top
  for (let i = n - 1; i >= 0; i--) {
    const t = i / (n - 1);                         // 0 at head, 1 at tail
    const r = (3 + (1 - t) * 3.5) * m;             // fatter toward the head, scaled by size
    ctx.fillStyle = i % 2 ? bodyA : bodyB;
    ctx.beginPath(); ctx.arc(s[i].x, s[i].y, r, 0, 6.28); ctx.fill();
  }

  // head detail: eyes + two curved fangs, pointing the way it's crawling
  const hx = s[0].x, hy = s[0].y;
  const ang = Math.atan2(s[0].y - s[1].y, s[0].x - s[1].x);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ang);
  ctx.scale(m, m);                                                  // whole head scales with size
  ctx.fillStyle = dead ? '#7a7a7a' : c.type.col;
  ctx.beginPath(); ctx.arc(1, 0, 6, 0, 6.28); ctx.fill();          // head
  if (!dead) {                                                      // glowing eyes only when alive
    ctx.fillStyle = '#ffdb4d';
    ctx.beginPath(); ctx.arc(3, -2.2, 1.3, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(3,  2.2, 1.3, 0, 6.28); ctx.fill();
  }
  ctx.strokeStyle = dead ? '#555' : '#2a0d05'; ctx.lineWidth = 1.6; // fangs
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(5, side * 3);
    ctx.quadraticCurveTo(10, side * 4, 11, side * 1);
    ctx.stroke();
  }
  ctx.restore();
}

// red health bar over a living centipede's head (wider for bigger ones)
function drawCentipedeHp(c) {
  const w = 20 * c.type.rMul, x = c.x - w / 2, y = c.y - 14 * c.type.rMul;
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
  ctx.fillStyle = '#e04030'; ctx.fillRect(x, y, w * (c.hp / c.maxHp), 3);
}

// ---- the queen has been slain ----
// She's the queen — she can't truly die. She's revived at the nest at full health
// and the world carries on exactly as it was, as if it never happened.
function gameOver() {
  // drop whatever she was holding where she fell, so nothing is lost
  for (const b of carried) { b.carried = false; b.x = queen.x; b.y = queen.y; b.noPickup = 0.6; }
  carried = [];
  if (dragging) { dragging.carried = false; dragging.noPickup = 0.6; dragging = null; }
  dragFlip = 0;
  queen.x = WORLD_W / 2; queen.y = WORLD_H / 2; queen.angle = 0; queen.hp = QUEEN_HP;
  reviveFlash = 2.5;                              // brief on-screen "revived" banner
}
