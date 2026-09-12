// Canvas side-view renderer — draws in logical 432x768 space; caller scales
// via setTransform. Painter's algorithm: sky → sun → clouds → far strip →
// near strip → ground → collectibles → obstacles → particles → player → FX → HUD.
import { VIEW, WORLD, PHYS, FRAME_JUMP, FRAME_DUCK, BIOMES, BIOME_CYCLE_RESET } from './config.js';
import { biomeForMeters } from './engine.js';

const GY = WORLD.groundY;
const B = WORLD.block;

// ── Biome palette blending (crossfade over ~170m before each threshold) ────
function parseColor(c) {
  if (c[0] === '#') {
    const n = parseInt(c.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255, 1];
  }
  const p = c.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number);
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}
function lerpColor(a, b, t) {
  const A = parseColor(a), B = parseColor(b);
  const al = A[3] + (B[3] - A[3]) * t;
  const r = Math.round(A[0] + (B[0] - A[0]) * t);
  const g = Math.round(A[1] + (B[1] - A[1]) * t);
  const bl = Math.round(A[2] + (B[2] - A[2]) * t);
  return al >= 0.999 ? `rgb(${r},${g},${bl})` : `rgba(${r},${g},${bl},${al.toFixed(3)})`;
}
const BLEND_M = 170;
function blendedBiome(m, nightStart) {
  const cycled = m % BIOME_CYCLE_RESET;
  let idx = 0;
  for (let i = 0; i < BIOMES.length; i++) if (cycled >= BIOMES[i].min) idx = i;
  let cur = BIOMES[idx];
  let next = BIOMES[(idx + 1) % BIOMES.length];
  let nextMin = idx + 1 < BIOMES.length ? next.min : BIOME_CYCLE_RESET;
  if (nightStart && cycled < BIOMES[1].min) {
    // Dark launcher theme: the opening leg skates under the night palette,
    // then blends into Wildflower Walk at the normal 500m seam.
    cur = BIOMES[BIOMES.length - 1];
    next = BIOMES[1];
    nextMin = BIOMES[1].min;
  }
  const t = Math.max(0, Math.min(1, (cycled - (nextMin - BLEND_M)) / BLEND_M));
  if (t <= 0) return cur;
  const mix = {};
  for (const k of Object.keys(cur)) {
    const a = cur[k], b = next[k];
    if (k === 'sky') mix.sky = [lerpColor(a[0], b[0], t), lerpColor(a[1], b[1], t)];
    else if (typeof a === 'string' && (a[0] === '#' || a.startsWith('rgb'))) mix[k] = lerpColor(a, b, t);
    else mix[k] = a;
  }
  mix.id = t > 0.5 ? next.id : cur.id;
  mix.label = t > 0.5 ? next.label : cur.label;
  return mix;
}

// Deterministic hash for world-keyed decoration placement.
function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
// Alpha-fade a palette color — post-blend values arrive as rgb()/rgba().
function fade(c, a) {
  const [r, g, b] = parseColor(c);
  return `rgba(${r},${g},${b},${a})`;
}
function lerp(a, b, t) { return a + (b - a) * t; }

// Per-biome tinted copies of the strip art (multiply fill, alpha kept).
const tintCache = new Map();
function tinted(images, key, color) {
  const img = images && images[key];
  if (!img || !img.naturalWidth || !color) return img;
  const ck = key + '|' + color;
  if (tintCache.has(ck)) return tintCache.get(ck);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(img, 0, 0);
  tintCache.set(ck, c);
  return c;
}

export function drawGame(ctx, g, assets, reducedMotion, debug) {
  const { images, dogDef, petDeck } = assets;
  const biome = blendedBiome(g.meters, g.nightStart);
  const W = VIEW.W, H = VIEW.H;
  const speedT = Math.max(0, Math.min(1, (g.speed - PHYS.speedBase) / (PHYS.speedMax - PHYS.speedBase)));

  ctx.save();
  if (g.shake > 0 && !reducedMotion) {
    const s = g.shake * 7;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  drawSky(ctx, biome, g.time, images);
  drawClouds(ctx, g.cameraX, g.time, images);
  drawStrip(ctx, biome, g.cameraX, images, 0.45, 'farImg', 'farTint', GY - 176, 170);
  drawStrip(ctx, biome, g.cameraX, images, 0.72, 'nearImg', 'nearTint', GY - 62, 60);
  drawGround(ctx, biome, g.cameraX);
  drawCollectibles(ctx, g, images, petDeck);
  drawObstacles(ctx, g, images);
  drawParticles(ctx, g, images);
  drawPlayer(ctx, g, images, dogDef);

  if (speedT > 0.4 && !reducedMotion && g.state === 'PLAYING') drawSpeedLines(ctx, g, speedT);
  drawPopups(ctx, g);
  ctx.restore(); // end shake transform

  if (g.flash > 0) { ctx.fillStyle = `rgba(255,244,230,${(g.flash * 0.8).toFixed(3)})`; ctx.fillRect(-10, -10, W + 20, H + 20); }
  if (g.hurtFlash > 0) { ctx.fillStyle = `rgba(220,60,50,${(g.hurtFlash * 0.35).toFixed(3)})`; ctx.fillRect(-10, -10, W + 20, H + 20); }

  // Vignette — static gradient, built once (allocating it per frame is pure churn)
  if (!vigCache) {
    vigCache = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.75);
    vigCache.addColorStop(0, 'rgba(0,0,0,0)');
    vigCache.addColorStop(1, 'rgba(8,14,20,0.30)');
  }
  ctx.fillStyle = vigCache;
  ctx.fillRect(0, 0, W, H);

  drawConfetti(ctx, g);
  drawBanner(ctx, g);
  drawHud(ctx, g, images);
  if (g.state === 'READY') drawReady(ctx, g, images);
  if (debug) drawDebug(ctx, g);
}

// Gradient caches — keyed by palette; rebuilt only when the biome blend changes.
let vigCache = null;
let skyCache = { key: '', grad: null };
const glowCache = new Map();  // sun color -> 180px radial sprite
let haloSprite = null;        // shared collectible halo

function sunGlowSprite(color) {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 180;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(90, 90, 8, 90, 90, 90);
  g.addColorStop(0, color);
  g.addColorStop(0.35, fade(color, 0.33));
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 180, 180);
  glowCache.set(color, c);
  return c;
}

function getHaloSprite() {
  if (haloSprite) return haloSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(48, 48, 10, 48, 48, 48);
  g.addColorStop(0, 'rgba(255,209,102,0.55)');
  g.addColorStop(1, 'rgba(255,209,102,0)');
  x.fillStyle = g; x.fillRect(0, 0, 96, 96);
  haloSprite = c;
  return c;
}

function drawSky(ctx, biome, t, images) {
  const W = VIEW.W;
  const skyKey = biome.sky[0] + '|' + biome.sky[1];
  if (skyCache.key !== skyKey) {
    const grad = ctx.createLinearGradient(0, 0, 0, GY);
    grad.addColorStop(0, biome.sky[0]);
    grad.addColorStop(1, biome.sky[1]);
    skyCache = { key: skyKey, grad };
  }
  ctx.fillStyle = skyCache.grad;
  ctx.fillRect(0, 0, W, GY + 2);

  // Sun / moon — drifts slowly down as the run goes on
  const sx = W * 0.24, sy = 92 + Math.sin(t * 0.12) * 4;
  ctx.drawImage(sunGlowSprite(biome.sun), sx - 90, sy - 90);
  ctx.fillStyle = biome.sun;
  ctx.beginPath(); ctx.arc(sx, sy, 30, 0, Math.PI * 2); ctx.fill();

  if (biome.id === 'night') {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 22; i++) {
      const x = hash2(i, 3) * W, y = hash2(i, 9) * 300;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.globalAlpha = 0.35 + 0.5 * tw;
      ctx.fillRect(x, y, 2.4, 2.4);
    }
    ctx.globalAlpha = 1;
  }
}

// Tiling helper — draws `img` side by side wrapping at parallax factor.
function tileStrip(ctx, img, camX, parallax, y, drawH) {
  const iw = img && (img.naturalWidth || img.width);
  const ih = img && (img.naturalHeight || img.height);
  if (!iw || !ih) return;
  const scale = drawH / ih;
  const tw = iw * scale;
  if (tw <= 0) return;
  let off = -(camX * parallax) % tw;
  if (off > 0) off -= tw;
  for (let x = off; x < VIEW.W + tw; x += tw) {
    ctx.drawImage(img, x, y, tw, drawH);
  }
}

function drawClouds(ctx, camX, t, images) {
  const keys = ['cloud1.png', 'cloud2.png', 'cloud3.png', 'cloud_fish.png'];
  // Fixed world slots every ~190px of parallax space; fish clouds every 4th.
  const slotW = 190;
  const start = Math.floor((camX * 0.22 - 160) / slotW);
  for (let i = start; i < start + 6; i++) {
    const x = i * slotW - camX * 0.22 + hash2(i, 5) * 60;
    const y = 40 + hash2(i, 7) * 200;
    const img = images[keys[i % 4 === 3 ? 3 : i % 3]];
    if (!img || !img.naturalWidth) continue;
    const w = (70 + hash2(i, 11) * 50);
    const h = w * (img.naturalHeight / img.naturalWidth);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(img, x, y + Math.sin(t * 0.6 + i) * 5, w, h);
  }
  ctx.globalAlpha = 1;
}

function drawStrip(ctx, biome, camX, images, parallax, imgKey, tintKey, y, h) {
  const img = tinted(images, biome[imgKey], biome[tintKey]);
  if (img) tileStrip(ctx, img, camX, parallax, y, h);
}

function drawGround(ctx, biome, camX) {
  const W = VIEW.W, H = VIEW.H;
  ctx.fillStyle = biome.ground;
  ctx.fillRect(0, GY, W, H - GY);
  ctx.fillStyle = biome.groundTop;
  ctx.fillRect(0, GY, W, 12);
  ctx.fillStyle = biome.curb;
  ctx.fillRect(0, H - 26, W, 26);
  // Sidewalk seams scrolling at full speed — the speedometer you feel
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  const seamW = 92;
  let off = -(camX % seamW);
  for (let x = off; x < W; x += seamW) ctx.fillRect(x, GY + 12, 3, H - GY - 38);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, GY + 12, W, 3);
}

// ── World items ─────────────────────────────────────────────────────────────
function drawCollectibles(ctx, g, images, petDeck) {
  const star = images['star.png'];
  for (const c of g.collectibles) {
    if (c.collected) continue;
    const x = c.worldX - g.cameraX;
    if (x < -60 || x > VIEW.W + 60) continue;
    const y = GY - c.alt + Math.sin(g.time * 3 + c.id) * 6;
    const r = 21;

    if (!c.pet && petDeck && petDeck.length) c.pet = petDeck[Math.floor(Math.random() * petDeck.length)];

    // Sparkle trail
    for (let i = 1; i <= 2; i++) {
      ctx.globalAlpha = 0.4 - i * 0.14;
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(x + i * 16, y + Math.sin(g.time * 4 + i + c.id) * 8, 4 - i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const haloR = r * 1.9;
    ctx.drawImage(getHaloSprite(), x - haloR, y - haloR, haloR * 2, haloR * 2);

    const img = c.pet && c.pet.img;
    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
      const s = Math.max(r * 2 / img.naturalWidth, r * 2 / img.naturalHeight);
      ctx.drawImage(img, x - img.naturalWidth * s / 2, y - img.naturalHeight * s / 2,
                  img.naturalWidth * s, img.naturalHeight * s);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 0.32, 0, Math.PI * 2); ctx.fill();
      for (const [dx, dy] of [[-0.4, 0.25], [0, 0.35], [0.4, 0.25]]) {
        ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, r * 0.16, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - r - 4, 6, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawObstacles(ctx, g, images) {
  for (const o of g.obstacles) {
    const x = o.worldX - g.cameraX;
    if (x + o.w < -80 || x > VIEW.W + 80) continue;

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x + o.w / 2, GY + 8, Math.min(o.w, 90) * 0.55, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (o.t === 'blocks') {
      const img = images[`block_${o.color}.png`];
      const cols = Math.round(o.w / B), rows = Math.round(o.h / B);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = x + c * B - 1, by = GY - (r + 1) * B - 1;
          if (img && img.naturalWidth) ctx.drawImage(img, bx, by, B + 2, B + 2);
          else { ctx.fillStyle = '#c25a4a'; ctx.fillRect(bx, by, B + 2, B + 2); }
        }
      }
    } else if (o.t === 'hang') {
      const img = images[`block_${o.color}.png`];
      const cols = Math.round(o.w / B);
      const bottom = GY - WORLD.hangBottom;
      // Column hangs from the sky to head height — the duck wall.
      // Slight sway so it reads as hanging, not a wall segment.
      const sway = Math.sin(g.time * 1.7 + o.id) * 3;
      const rows = Math.ceil((bottom - 52) / B);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = x + c * B - 1 + sway * (rows - r) / rows, by = bottom - (r + 1) * B - 1;
          if (img && img.naturalWidth) ctx.drawImage(img, bx, by, B + 2, B + 2);
        }
      }
      // warning chevron on the lowest block — pulses
      ctx.fillStyle = `rgba(255,240,200,${0.65 + 0.3 * Math.sin(g.time * 7 + o.id)})`;
      ctx.beginPath();
      ctx.moveTo(x + o.w / 2 - 9 + sway, bottom - 14);
      ctx.lineTo(x + o.w / 2 + 9 + sway, bottom - 14);
      ctx.lineTo(x + o.w / 2 + sway, bottom - 4);
      ctx.closePath(); ctx.fill();
    } else {
      // Flyers — bob + wiggle, face left into the pup's path
      const img = images[o.t === 'whale' ? 'whale.png' : o.sprite];
      const cy = GY - o.top + o.h / 2 + Math.sin(g.time * 4 + o.id) * (o.t === 'whale' ? 3 : 7);
      const wob = Math.sin(g.time * 6 + o.id * 2) * (o.t === 'whale' ? 0.02 : 0.08);
      const dw = o.t === 'whale' ? 150 : 62;
      const dh = dw * ((img && img.naturalHeight) ? img.naturalHeight / img.naturalWidth : 0.6);
      ctx.save();
      ctx.translate(x + o.w / 2, cy);
      ctx.rotate(wob);
      if (img && img.naturalWidth) ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      else { ctx.fillStyle = '#e0905a'; ctx.fillRect(-dw / 2, -dh / 2, dw, dh); }
      ctx.restore();
    }
  }
}

function drawSpeedLines(ctx, g, speedT) {
  // engine-streamed streaks — they live in world space so they read as motion,
  // not flicker
  ctx.lineCap = 'round';
  for (const l of g.speedlines) {
    ctx.globalAlpha = Math.min(0.55, l.life * 1.6) * speedT;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(l.x + l.len, l.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Floating popups — near-miss praise etc. Rise handled in engine; render pops in + fades.
function drawPopups(ctx, g) {
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
}

// Milestone/biome banner — center upper third, gold-trimmed card.
function drawBanner(ctx, g) {
  const b = g.banner;
  if (!b) return;
  const a = Math.min(1, Math.min(b.t, (b.dur - b.t) * 2.4) * 3);
  const W = VIEW.W;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  const y = 136 - (1 - a) * 16;
  ctx.font = '800 25px system-ui, sans-serif';
  if (!b._pw) b._pw = Math.max(210, ctx.measureText(b.text).width + 60); // cache per banner
  const pw = b._pw;
  const ph = b.sub ? 60 : 46;
  ctx.fillStyle = 'rgba(12,30,26,0.74)';
  roundRect(ctx, (W - pw) / 2, y, pw, ph, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.65)'; ctx.lineWidth = 2;
  roundRect(ctx, (W - pw) / 2, y, pw, ph, 14); ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(b.text, W / 2, y + (b.sub ? 20 : ph / 2));
  if (b.sub) {
    ctx.fillStyle = '#cfe8dd';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(b.sub, W / 2, y + 42);
  }
  ctx.restore();
}

function drawConfetti(ctx, g) {
  for (const c of g.confetti) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.globalAlpha = Math.max(0, Math.min(1, c.life * 2));
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * (0.35 + 0.65 * Math.abs(Math.sin(c.rot * 2))));
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawParticles(ctx, g, images) {
  const star = images['star.png'];
  for (const p of g.puffs) {
    const sz = 10 + (0.5 - p.life) * 30;
    ctx.globalAlpha = Math.max(0, Math.min(0.7, p.life * 1.9));
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, sz * 0.4), 0, Math.PI * 2); ctx.fill();
  }
  for (const s of g.sparkles) {
    const sz = 9;
    ctx.globalAlpha = Math.min(1, s.life * 2);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    if (star && star.naturalWidth) ctx.drawImage(star, -sz / 2, -sz / 2, sz, sz);
    else { ctx.fillStyle = '#ffe27a'; ctx.fillRect(-sz / 2, -sz / 2, sz, sz); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ── Player ──────────────────────────────────────────────────────────────────
function drawPlayer(ctx, g, images, dogDef) {
  const px = WORLD.playerX;
  const py = GY - g.worldY;

  // Shadow — shrinks + fades with ollie height
  const shT = Math.max(0.25, 1 - g.worldY / (PHYS.jumpHeight * 1.6));
  ctx.fillStyle = `rgba(0,0,0,${(0.3 * shT).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(px, GY + 6, 46 * shT, 9 * shT, 0, 0, Math.PI * 2);
  ctx.fill();

  const dog = images[dogDef.sheet];
  if (!dog || !dog.naturalWidth) return;

  const invBlink = g.invincibleT > 0 && Math.floor(g.time / 0.08) % 2 === 0;
  const tumble = g.hitT > 0 ? Math.sin((1 - g.hitT / 0.55) * Math.PI) : 0;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(g.lean * -0.10 + tumble * 0.9);
  const ducking = g.action === 'ducking';
  const jumping = g.action === 'jumping';
  const dw = 138, dh = dw * (dogDef.fh / dogDef.fw);
  ctx.scale(g.stretchX * (ducking ? 1.12 : 1), g.squashY * (ducking ? 0.9 : 1));
  if (invBlink) ctx.globalAlpha = 0.35;
  const fr = jumping ? FRAME_JUMP : ducking ? FRAME_DUCK : g.dogFrame % 6;
  ctx.drawImage(dog, fr * dogDef.fw, 0, dogDef.fw, dogDef.fh, -dw / 2, -dh + 10, dw, dh);
  ctx.restore();

  if (g.landFlash > 0) {
    ctx.strokeStyle = `rgba(255,240,200,${g.landFlash.toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(px, GY + 4, 40 * (1 - g.landFlash) + 22, 10 * (1 - g.landFlash) + 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── HUD — homage layout: big centered score, HI top-right ───────────────────
function drawDigits(ctx, images, value, cx, y, h, shadow) {
  const digits = String(value).split('');
  const dw = h * (53 / 78), gap = h * 0.08;
  let sx = cx - (digits.length * (dw + gap) - gap) / 2;
  ctx.save();
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2; }
  for (const d of digits) {
    const img = images[`numbers/number${d}.png`];
    if (img) ctx.drawImage(img, sx, y, dw, h);
    sx += dw + gap;
  }
  ctx.restore();
  return sx;
}

function drawHud(ctx, g, images) {
  if (g.state !== 'PLAYING' && g.state !== 'DYING') return;
  const W = VIEW.W;

  // Distance — big centered digits like the GBA original
  drawDigits(ctx, images, Math.floor(g.meters), W / 2, 50, 46, true);

  // HI score top-right, small digits
  ctx.save();
  ctx.font = '800 15px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(10,28,25,0.55)';
  roundRect(ctx, W - 12 - 118, 46, 118, 26, 13); ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.fillText('HI', W - 12 - 108, 60);
  const hi = Math.max(g.best, Math.floor(g.meters));
  drawDigits(ctx, images, hi, W - 12 - 52, 48, 22, false);
  ctx.restore();

  // Rescued counter
  ctx.save();
  ctx.font = '800 17px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(10,28,25,0.55)';
  roundRect(ctx, 12, 46, 78, 30, 15); ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.fillText('🐾 ' + g.rescuedCount, 24, 62);
  if (g.rescueStreak >= 3) {
    ctx.fillStyle = '#7ee0a3';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillText(`×${g.rescueStreak} streak`, 20, 86);
  }
  ctx.restore();

  // Lives
  ctx.save();
  ctx.fillStyle = 'rgba(10,28,25,0.55)';
  const lw = 26 + PHYS.lives * 22;
  roundRect(ctx, W - 12 - lw, 78, lw, 28, 14); ctx.fill();
  ctx.font = '15px system-ui';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < PHYS.lives; i++) {
    ctx.globalAlpha = i < g.lives ? 1 : 0.25;
    ctx.fillText('❤', W - 12 - lw + 16 + i * 22, 93);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawReady(ctx, g, images) {
  const get = images['ui/textGetReady.png'];
  if (get) ctx.drawImage(get, (VIEW.W - 340) / 2, VIEW.H * 0.17, 340, 62);
  const tap = images['ui/tap.png'];
  if (tap) {
    const bob = Math.sin(g.time * 3.4) * 6;
    ctx.drawImage(tap, VIEW.W / 2 - 26, VIEW.H * 0.4 + bob, 52, 52);
  }
}

function drawDebug(ctx, g) {
  ctx.strokeStyle = 'rgba(80,255,140,0.8)';
  ctx.lineWidth = 1;
  const h = g.action === 'ducking' ? WORLD.duckH : WORLD.standH;
  const pb = GY - g.worldY;
  ctx.strokeRect(WORLD.playerX - WORLD.playerW / 2, pb - h, WORLD.playerW, h);
  for (const o of g.obstacles) {
    const x = o.worldX - g.cameraX;
    if (o.t === 'blocks') ctx.strokeRect(x, GY - o.h, o.w, o.h);
    else if (o.t === 'hang') ctx.strokeRect(x, -80, o.w, GY - WORLD.hangBottom + 80);
    else ctx.strokeRect(x, GY - o.top, o.w, o.h);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
