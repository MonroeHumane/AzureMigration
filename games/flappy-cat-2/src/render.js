// Canvas renderer — draws in logical 432x768 space; caller scales via setTransform.
import { VIEW, PHYS, FRAME_SHIFT } from './config.js';
import { biomeForGame } from './engine.js';
import { catEllipse, pipeRects } from './hitbox.js';

const ROCK_TIP = 0.38; // fraction of sprite that is the pointed cap facing the gap

// Fixed-cell repeating strip — constant cell width is what makes the wrap
// seamless (variable-width items modulo a fixed span is what caused the pop).
const STRIP = ['house1.png', 'tree.png', 'houseSmall1.png', 'tree.png'];
const STRIP_CELL = 168;   // logical px per slot
const STRIP_H = 118;      // band height above the ground line
const stripOffset = i => 14 + (i % 3) * 26; // deterministic per-slot x jitter

// Gradient caches — sky only rebuilds when the palette changes
let skyCache = { key: '', grad: null };
let vigCache = null;

export function drawGame(ctx, g, images, catDef, reducedMotion, debug) {
  const biome = biomeForGame(g);
  const W = VIEW.W, H = VIEW.H, groundY = H - VIEW.GROUND;

  ctx.save();
  if (g.shake > 0 && !reducedMotion) {
    const s = g.shake * 7;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  // Sky — cached gradient, rebuilt only when the biome palette shifts
  const skyKey = biome.sky[0] + '|' + biome.sky[1];
  if (skyCache.key !== skyKey) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, biome.sky[0]);
    grad.addColorStop(1, biome.sky[1]);
    skyCache = { key: skyKey, grad };
  }
  ctx.fillStyle = skyCache.grad;
  ctx.fillRect(0, 0, W, H);

  // Sun
  const sun = images['sun.png'];
  if (sun && sun.naturalWidth) {
    const sy = 54 + Math.sin(g.time * 0.15) * 6;
    ctx.globalAlpha = biome.id === 'ice' ? 0.85 : 1;
    ctx.drawImage(sun, W - 108, sy, 74, 74);
    ctx.globalAlpha = 1;
  }

  // Clouds — two parallax bands
  const clouds = ['cloud1.png','cloud2.png','cloud3.png','cloud4.png','cloud5.png','cloud6.png']
    .map(k => images[k]).filter(i => i && i.naturalWidth);
  if (clouds.length) {
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 4; i++) {
      const img = clouds[i % clouds.length];
      const speed = 0.6 + i * 0.18;
      const cw = 96 + (i % 3) * 26;
      const ch = cw * (img.naturalHeight / img.naturalWidth);
      const span = W + cw * 2;
      const cx = span - ((g.cloudX * speed + i * 190) % span) - cw;
      ctx.drawImage(img, cx, 46 + i * 74 + Math.sin(g.time * 0.4 + i) * 5, cw, ch);
    }
    ctx.globalAlpha = 1;
  }

  // Distant houses/trees strip — fixed cells, wraps by full pattern span.
  const props = STRIP.map(k => images[k]).filter(i => i && i.naturalWidth);
  if (props.length) {
    const span = STRIP.length * STRIP_CELL;
    let base = -(g.hillsX % span);
    if (base > 0) base -= span;
    ctx.globalAlpha = 0.92;
    for (let x = base, i = 0; x < W + STRIP_CELL; x += STRIP_CELL, i++) {
      const img = props[i % props.length];
      const ph = i % 2 === 0 ? 104 : 112;
      const pw = ph * (img.naturalWidth / img.naturalHeight);
      // bottom-anchor each prop to the ground line
      ctx.drawImage(img, x + stripOffset(i), groundY - ph - 4, pw, ph);
    }
    ctx.globalAlpha = 1;
  }

  // Ground
  ctx.fillStyle = biome.ground;
  ctx.fillRect(0, groundY, W, VIEW.GROUND);
  ctx.fillStyle = biome.dirt;
  ctx.fillRect(0, groundY + 34, W, VIEW.GROUND - 34);
  // moving dashes for speed feel
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  const dashSpan = 64;
  let dx = -(g.groundX % dashSpan);
  for (; dx < W; dx += dashSpan) ctx.fillRect(dx, groundY + 8, 30, 5);

  // Pipes — tip slice + stretched body
  for (const p of g.pipes) {
    const set = biome.id === 'grass'
      ? { top: images['rock_top.png'], bottom: images['rock_bottom.png'] }
      : { top: images[`rock_top_${biome.id}.png`], bottom: images[`rock_bottom_${biome.id}.png`] };
    const gapTop = p.gapY - p.gapH / 2;
    const gapBot = p.gapY + p.gapH / 2;
    drawPipe(ctx, set.top, p.x, 0, PHYS.pipeW, gapTop, true);
    drawPipe(ctx, set.bottom, p.x, gapBot, PHYS.pipeW, groundY - gapBot, false);
  }

  // Sparkles + puffs
  const star = images['star.png'], puff = images['puff.png'];
  for (const s of g.sparkles) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, s.life * 2);
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    if (star) ctx.drawImage(star, -9, -9, 18, 18);
    ctx.restore();
  }
  for (const p of g.puffs) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(0.8, p.life * 1.8));
    const sz = 20 + (1 - p.life) * 14;
    if (puff) ctx.drawImage(puff, p.x - sz / 2, p.y - sz / 2, sz, sz * 0.84);
    ctx.restore();
  }

  // Cat
  const cat = images[catDef.sheet];
  if (cat && cat.naturalWidth) {
    ctx.save();
    ctx.translate(PHYS.catX, g.catY);
    ctx.rotate(g.catRot);
    const fw = catDef.fw, fh = catDef.fh;
    const fr = g.catFrame % catDef.frames;
    const sx = fr * fw - (FRAME_SHIFT[fr] || 0);
    const dw = 92, dh = dw * (fh / fw);
    ctx.drawImage(cat, sx, 0, fw, fh, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  // Speed lines — stream past once the scroll is genuinely fast
  const speedT = Math.max(0, Math.min(1, (Math.min(PHYS.speedMax, PHYS.speedBase + g.score * 2.2) - PHYS.speedBase) / (PHYS.speedMax - PHYS.speedBase)));
  if (speedT > 0.45 && !reducedMotion && g.state === 'PLAYING') {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.2;
    for (const l of g.speedlines) {
      ctx.globalAlpha = Math.min(0.5, l.life * 1.6) * speedT;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + l.len, l.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Floating popups — pop in, rise, fade
  for (const p of g.popups) {
    const pop = Math.min(1, p.t * 8);
    const a = Math.min(1, (p.life - p.t) * 2.2);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,30,25,0.8)';
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = '#ffe27a';
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Hit flash
  if (g.flash > 0) {
    ctx.fillStyle = `rgba(255,244,230,${(g.flash * 0.85).toFixed(3)})`;
    ctx.fillRect(-10, -10, W + 20, H + 20);
  }

  // Vignette — static gradient, built once
  if (!vigCache) {
    vigCache = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.32, W / 2, H * 0.5, H * 0.78);
    vigCache.addColorStop(0, 'rgba(0,0,0,0)');
    vigCache.addColorStop(1, 'rgba(8,14,20,0.26)');
  }
  ctx.fillStyle = vigCache;
  ctx.fillRect(0, 0, W, H);

  // In-run score — Kenney digit sprites
  if (g.state === 'PLAYING' || g.state === 'DYING') {
    const digits = String(g.score).split('');
    const dh = 46, dw = dh * (53 / 78), gap = 4;
    let sx = (W - digits.length * (dw + gap)) / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    for (const d of digits) {
      const img = images[`numbers/number${d}.png`];
      if (img) ctx.drawImage(img, sx, 54, dw, dh);
      sx += dw + gap;
    }
    ctx.restore();
  }

  // READY overlay hint (canvas-side; DOM start card sits above)
  if (g.state === 'READY') {
    const get = images['ui/textGetReady.png'];
    if (get) ctx.drawImage(get, (W - 360) / 2, H * 0.2, 360, 66);
    const tap = images['ui/tap.png'];
    if (tap) {
      const bob = Math.sin(g.time * 3.4) * 7;
      ctx.drawImage(tap, W / 2 - 28, H * 0.56 + bob, 56, 56);
    }
  }

  // ?debug=1 — draw the actual collision geometry
  if (debug) {
    const catImg = images[catDef.sheet];
    const e = catEllipse(catImg, g.catFrame % catDef.frames, catDef.fw, catDef.fh, 92);
    const cr = Math.cos(g.catRot), sr = Math.sin(g.catRot);
    const ecx = PHYS.catX + e.ox * cr - e.oy * sr;
    const ecy = g.catY + e.ox * sr + e.oy * cr;
    ctx.strokeStyle = 'rgba(80,255,140,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(ecx, ecy, e.rx, e.ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,90,90,0.85)';
    for (const p of g.pipes) {
      const gapTop = p.gapY - p.gapH / 2;
      const gapBot = p.gapY + p.gapH / 2;
      const set = biome.id === 'grass'
        ? { top: images['rock_top.png'], bottom: images['rock_bottom.png'] }
        : { top: images[`rock_top_${biome.id}.png`], bottom: images[`rock_bottom_${biome.id}.png`] };
      for (const r of pipeRects(set.top, PHYS.pipeW, gapTop, true)) {
        ctx.strokeRect(p.x + r.ox, r.oy, r.w, r.h);
      }
      for (const r of pipeRects(set.bottom, PHYS.pipeW, groundY - gapBot, false)) {
        ctx.strokeRect(p.x + r.ox, gapBot + r.oy, r.w, r.h);
      }
    }
  }

  ctx.restore();
}

function drawPipe(ctx, img, x, y, w, h, isTop) {
  if (h <= 0) return;
  if (!img || !img.naturalWidth) {
    ctx.fillStyle = '#4b7a52';
    ctx.fillRect(x, y, w, h);
    return;
  }
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const tipSrc = Math.floor(ih * ROCK_TIP);          // pointed end of the sprite
  const tipH = Math.min(h, w * (tipSrc / iw));       // draw at aspect
  const bodyH = h - tipH;
  if (isTop) {
    // top pipe: sprite tip is at the BOTTOM (faces the gap)
    if (bodyH > 0) ctx.drawImage(img, 0, 0, iw, ih - tipSrc, x, y, w, bodyH);
    ctx.drawImage(img, 0, ih - tipSrc, iw, tipSrc, x, y + bodyH, w, tipH);
  } else {
    // bottom pipe: sprite tip is at the TOP (faces the gap)
    ctx.drawImage(img, 0, 0, iw, tipSrc, x, y, w, tipH);
    if (bodyH > 0) ctx.drawImage(img, 0, tipSrc, iw, ih - tipSrc, x, y + tipH, w, bodyH);
  }
}
