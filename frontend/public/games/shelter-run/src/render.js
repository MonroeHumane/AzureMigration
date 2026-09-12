// Canvas pseudo-3D renderer — draws in logical 432x768 space; caller scales
// via setTransform. Painter's algorithm: sky → sides → props → track →
// depth-sorted world items → particles → player → flashes → HUD.
import { VIEW, PROJ, PHYS, OBSTACLE, FRAME_SHIFT } from './config.js';
import { biomeForMeters } from './engine.js';
import { layout, project, screenYToRelZ, laneScreenX, obstacleBox, smoothstep, lerp } from './perspective.js';

const L = layout();

const STRIP = ['house1.png', 'tree.png', 'houseSmall1.png', 'tree.png'];
const PROP_SLOT = 340;          // world z between scenery props
const CLOUD_KEYS = ['cloud1.png','cloud2.png','cloud3.png','cloud4.png','cloud5.png','cloud6.png'];
const ROCK_KEY = { grass: 'rockGrass.png', dirt: 'rock.png', snow: 'rockSnow.png', ice: 'rockIce.png' };

const OB_COLORS = {
  lane_block: ['#c25a4a', '#a8483c'],
  low: ['#9a6a3a', '#7d5228'],
  high: ['#e8b050', '#c89038'],
};

function shade(hex, d) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + d));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + d));
  const b = Math.max(0, Math.min(255, (n & 255) + d));
  return `rgb(${r},${g},${b})`;
}

export function drawGame(ctx, g, assets, reducedMotion, debug) {
  const { images, catDef, petDeck } = assets;
  const biome = biomeForMeters(g.meters);
  const W = VIEW.W, H = VIEW.H;

  ctx.save();
  if (g.shake > 0 && !reducedMotion) {
    const s = g.shake * 7;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  drawSky(ctx, biome, g.time, images);
  drawSides(ctx, biome, g.cameraZ);
  drawProps(ctx, biome, g.cameraZ, images);
  drawTrack(ctx, biome, g.cameraZ);
  drawWorldItems(ctx, g, biome, images, petDeck);
  drawParticles(ctx, g, images);
  drawPlayer(ctx, g, images, catDef);

  // Fog glow at horizon for depth
  const fog = ctx.createLinearGradient(0, L.horizonY - 30, 0, L.horizonY + 120);
  fog.addColorStop(0, biome.fog);
  fog.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, L.horizonY - 30, W, 150);

  // Flash overlays
  if (g.flash > 0) { ctx.fillStyle = `rgba(255,244,230,${(g.flash * 0.8).toFixed(3)})`; ctx.fillRect(-10, -10, W + 20, H + 20); }
  if (g.hurtFlash > 0) { ctx.fillStyle = `rgba(220,60,50,${(g.hurtFlash * 0.35).toFixed(3)})`; ctx.fillRect(-10, -10, W + 20, H + 20); }

  // Vignette
  const vig = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(8,14,20,0.32)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  drawHud(ctx, g, images);

  if (g.state === 'READY') drawReady(ctx, g, images);

  if (debug) drawDebug(ctx, g);

  ctx.restore();
}

// ── Sky ────────────────────────────────────────────────────────────────────
function drawSky(ctx, biome, t, images) {
  const sky = ctx.createLinearGradient(0, 0, 0, L.horizonY + 80);
  sky.addColorStop(0, biome.sky[0]);
  sky.addColorStop(1, biome.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.W, L.horizonY + 80);

  const sun = images['sun.png'];
  if (sun && sun.naturalWidth) {
    ctx.globalAlpha = 0.95;
    ctx.drawImage(sun, VIEW.W - 96, 34 + Math.sin(t * 0.15) * 5, 62, 62);
    ctx.globalAlpha = 1;
  }

  ctx.globalAlpha = 0.85;
  const clouds = CLOUD_KEYS.map(k => images[k]).filter(i => i && i.naturalWidth);
  for (let i = 0; i < 4 && clouds.length; i++) {
    const img = clouds[i % clouds.length];
    const cw = 84 + (i % 3) * 22;
    const ch = cw * (img.naturalHeight / img.naturalWidth);
    const span = VIEW.W + cw * 2;
    const cx = span - ((t * 9 * (0.6 + i * 0.18) + i * 170) % span) - cw;
    ctx.drawImage(img, cx, 26 + i * 44 + Math.sin(t * 0.4 + i) * 4, cw, ch);
  }
  ctx.globalAlpha = 1;
}

// ── Side ground (grass/dirt flanking the track) ────────────────────────────
function drawSides(ctx, biome, cameraZ) {
  const H = VIEW.H;
  ctx.fillStyle = biome.sideA;
  ctx.fillRect(0, L.horizonY, VIEW.W, H - L.horizonY);

  // Mown-grass stripes converging with perspective, scrolling with camera.
  const STEP = 3;
  for (let sy = Math.floor(L.horizonY); sy <= H; sy += STEP) {
    const relZ = screenYToRelZ(L, sy);
    if (relZ < L.nearZ || relZ > L.farZ) continue;
    const absZ = cameraZ + relZ;
    if (Math.floor(absZ / 240) & 1) {
      ctx.fillStyle = biome.sideB;
      ctx.fillRect(0, sy, VIEW.W, STEP + 1);
    }
  }
}

// ── Scenery props (houses/trees) beside the track, depth-sorted ────────────
function drawProps(ctx, biome, cameraZ, images) {
  const props = STRIP.map(k => images[k]).filter(i => i && i.naturalWidth);
  if (!props.length) return;

  const first = Math.floor((cameraZ + L.nearZ) / PROP_SLOT);
  const last = Math.floor((cameraZ + L.farZ) / PROP_SLOT);
  for (let slot = last; slot >= first; slot--) {
    const z = slot * PROP_SLOT + 120;
    const relZ = z - cameraZ;
    if (relZ < L.nearZ || relZ > L.farZ) continue;
    const img = props[slot % props.length];
    const side = slot % 2 === 0 ? -1 : 1;
    const jitter = ((slot * 137) % 60) - 30;
    const wx = side * (L.trackHalfW + 110 + jitter);
    const p = project(L, relZ, wx, 0);
    if (!p) continue;
    const ph = 170 * p.scale * 1.15;
    const pw = ph * (img.naturalWidth / img.naturalHeight);
    // Fade distant props into the haze
    const fogT = Math.max(0, Math.min(1, (relZ - L.farZ * 0.55) / (L.farZ * 0.45)));
    ctx.globalAlpha = 0.95 - fogT * 0.55;
    ctx.drawImage(img, p.x - pw / 2, p.y - ph, pw, ph);
  }
  ctx.globalAlpha = 1;
}

// ── Track ──────────────────────────────────────────────────────────────────
function drawTrack(ctx, biome, cameraZ) {
  const H = VIEW.H;
  const STEP = 3;
  for (let sy = Math.floor(L.horizonY); sy <= H; sy += STEP) {
    const relZ = screenYToRelZ(L, sy);
    if (relZ < L.nearZ || relZ > L.farZ) continue;
    const absZ = cameraZ + relZ;
    const scale = L.focal / relZ;
    const hw = L.trackHalfW * scale;
    ctx.fillStyle = (Math.floor(absZ / 170) & 1) ? biome.trackA : biome.trackB;
    ctx.fillRect(L.centerX - hw, sy, hw * 2, STEP + 1);
  }

  // Lane divider dashes + glowing edges
  for (const wx of [ (L.laneWorldX[0] + L.laneWorldX[1]) / 2, (L.laneWorldX[1] + L.laneWorldX[2]) / 2 ]) {
    drawGroundLine(ctx, wx, biome.lane, 0.55, cameraZ, true);
  }
  for (const wx of [-L.trackHalfW, L.trackHalfW]) {
    drawGroundLine(ctx, wx, biome.edge, 0.9, cameraZ, false);
  }
}

function drawGroundLine(ctx, wx, color, alpha, cameraZ, dashed) {
  const STEP = 4;
  for (let sy = Math.floor(L.horizonY) + 2; sy <= VIEW.H; sy += STEP) {
    const relZ = screenYToRelZ(L, sy);
    if (relZ < L.nearZ || relZ > L.farZ) continue;
    if (dashed && (Math.floor((cameraZ + relZ) / 90) & 1)) continue;
    const scale = L.focal / relZ;
    const x = L.centerX + wx * scale;
    const wLine = Math.max(1, 3.2 * scale);
    ctx.globalAlpha = alpha * Math.min(1, scale * 1.4);
    ctx.fillStyle = color;
    ctx.fillRect(x - wLine / 2, sy, wLine, STEP + 1);
  }
  ctx.globalAlpha = 1;
}

// ── World items: obstacles + collectibles, far → near ──────────────────────
function drawWorldItems(ctx, g, biome, images, petDeck) {
  const items = [];
  for (const o of g.obstacles) {
    const d = o.worldZ - g.cameraZ;
    if (d > L.nearZ && d < L.farZ) items.push({ kind: 'obs', z: o.worldZ, o, d });
  }
  for (const c of g.collectibles) {
    if (c.collected) continue;
    const d = c.worldZ - g.cameraZ;
    if (d > L.nearZ && d < L.farZ) items.push({ kind: 'col', z: c.worldZ, c, d });
  }
  items.sort((a, b) => b.z - a.z);

  for (const it of items) {
    // Near-plane clip: items at/under the camera would fill the screen.
    if (it.d < NEAR_CLIP) continue;
    if (it.kind === 'obs') drawObstacle(ctx, it.o, it.d, biome, images);
    else drawCollectible(ctx, it.c, it.d, g.time, petDeck);
  }
}

// Below this depth an item is at the camera — hide it rather than let a
// wall-sized quad sweep the screen. Items fade out approaching the clip.
const NEAR_CLIP = 118;
function nearFade(relZ) {
  return Math.max(0, Math.min(1, (relZ - NEAR_CLIP) / 90));
}

function drawObstacle(ctx, obs, relZ, biome, images) {
  const { cx, groundY, w, scale } = obstacleBox(L, obs, relZ);
  const v = obs.variant | 0;
  const fogT = Math.max(0, Math.min(1, (relZ - L.farZ * 0.6) / (L.farZ * 0.4)));
  ctx.globalAlpha = (1 - fogT * 0.6) * nearFade(relZ);

  // Contact shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 2 * scale, w * 0.55, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (obs.type === OBSTACLE.LANE_BLOCK) {
    const h = 210 * scale;
    const rockKey = ROCK_KEY[biome.id] || 'rock.png';
    const rock = images[rockKey] || images['rock.png'];
    if (v === 1 && rock && rock.naturalWidth) {
      // Kenney boulder fitted to the lane AABB
      const rh = h * 1.02;
      const rw = rh * (rock.naturalWidth / rock.naturalHeight);
      ctx.drawImage(rock, cx - rw / 2, groundY - rh, rw, rh);
    } else if (v === 2) {
      // Stacked crates
      const bh = h / 3;
      for (let i = 0; i < 3; i++) {
        const cw = w * (1 - i * 0.14);
        const y = groundY - bh * (i + 1);
        ctx.fillStyle = i % 2 ? shade(OB_COLORS.lane_block[0], -22) : OB_COLORS.lane_block[0];
        roundRect(ctx, cx - cw / 2, y, cw, bh, Math.min(5, w * 0.08));
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(cx - cw / 2 + 3, y + bh / 2); ctx.lineTo(cx + cw / 2 - 3, y + bh / 2);
        ctx.stroke();
      }
    } else {
      // Brick pillar with cap highlight
      const grad = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      grad.addColorStop(0, OB_COLORS.lane_block[1]);
      grad.addColorStop(0.5, OB_COLORS.lane_block[0]);
      grad.addColorStop(1, OB_COLORS.lane_block[1]);
      ctx.fillStyle = grad;
      roundRect(ctx, cx - w / 2, groundY - h, w, h, Math.min(7, w * 0.1));
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(cx - w / 2, groundY - h, w, Math.max(2, h * 0.06));
      // brick lines
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = Math.max(1, scale);
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - w / 2 + 2, groundY - h * i / 4);
        ctx.lineTo(cx + w / 2 - 2, groundY - h * i / 4);
        ctx.stroke();
      }
    }
  } else if (obs.type === OBSTACLE.LOW) {
    const lh = PHYS.lowWallHeight * scale;
    if (v === 1) {
      // Fallen log — horizontal capsule with end rings
      const ly = groundY - lh * 0.72;
      ctx.fillStyle = OB_COLORS.low[0];
      roundRect(ctx, cx - w / 2, ly, w, lh * 0.72, lh * 0.36);
      ctx.fill();
      ctx.fillStyle = OB_COLORS.low[1];
      ctx.beginPath();
      ctx.ellipse(cx - w / 2 + lh * 0.36, ly + lh * 0.36, lh * 0.3, lh * 0.3, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + w / 2 - lh * 0.36, ly + lh * 0.36, lh * 0.3, lh * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = Math.max(1, 1.2 * scale);
      ctx.stroke();
    } else if (v === 2) {
      // Rock mound
      ctx.fillStyle = OB_COLORS.low[1];
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, groundY);
      ctx.quadraticCurveTo(cx - w * 0.2, groundY - lh * 1.15, cx, groundY - lh * 1.05);
      ctx.quadraticCurveTo(cx + w * 0.25, groundY - lh * 0.9, cx + w / 2, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.18, groundY);
      ctx.quadraticCurveTo(cx, groundY - lh * 0.72, cx + w * 0.12, groundY);
      ctx.fill();
    } else {
      // Hedge / curb block
      ctx.fillStyle = OB_COLORS.low[0];
      roundRect(ctx, cx - w / 2, groundY - lh, w, lh, Math.min(6, w * 0.12));
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(cx - w / 2, groundY - lh, w, Math.max(2, lh * 0.14));
    }
  } else {
    // HIGH — overhead bar/branch: slide under
    const barBottom = L.horizonY + (L.cameraHeight - PHYS.highBarBottom) * scale;
    const barH = 46 * scale;
    const postW = Math.max(2, 7 * scale);
    ctx.strokeStyle = OB_COLORS.high[1];
    ctx.lineWidth = postW;
    for (const px of [cx - w * 0.36, cx + w * 0.36]) {
      ctx.beginPath();
      ctx.moveTo(px, barBottom - barH * 0.4);
      ctx.lineTo(px, groundY);
      ctx.stroke();
    }
    if (v === 1) {
      // Vine with leaves — sagging curve
      ctx.strokeStyle = OB_COLORS.high[0];
      ctx.lineWidth = Math.max(2, barH * 0.4);
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, barBottom - barH * 0.5);
      ctx.quadraticCurveTo(cx, barBottom + barH * 0.55, cx + w / 2, barBottom - barH * 0.5);
      ctx.stroke();
      ctx.fillStyle = '#6aa860';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.ellipse(cx + i * w * 0.14, barBottom + barH * 0.22 + Math.abs(i) * -barH * 0.12, 5 * scale, 9 * scale, i * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (v === 2) {
      // Hanging banner
      ctx.fillStyle = OB_COLORS.high[0];
      roundRect(ctx, cx - w / 2, barBottom - barH, w, barH * 0.9, 3 * scale);
      ctx.fill();
      ctx.fillStyle = OB_COLORS.high[1];
      for (let i = 0; i < 3; i++) {
        const bx = cx - w / 2 + w * (i + 0.5) / 3;
        ctx.beginPath();
        ctx.moveTo(bx - w * 0.12, barBottom - barH * 0.1);
        ctx.lineTo(bx + w * 0.12, barBottom - barH * 0.1);
        ctx.lineTo(bx, barBottom + barH * 0.35);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = OB_COLORS.high[0];
      roundRect(ctx, cx - w / 2, barBottom - barH, w, barH, Math.min(4, barH * 0.3));
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(cx - w / 2, barBottom - barH, w, Math.max(1.5, barH * 0.18));
    }
  }
  ctx.globalAlpha = 1;
}

// Pet rescue token — real photo in a floating golden ring.
function drawCollectible(ctx, c, relZ, t, petDeck) {
  const scale = L.focal / relZ;
  const wx = L.laneWorldX[c.lane];
  const p = project(L, relZ, wx, 52 + Math.sin(t * 3 + c.id) * 8);
  if (!p) return;
  const r = Math.max(5, 26 * scale);
  const fogT = Math.max(0, Math.min(1, (relZ - L.farZ * 0.6) / (L.farZ * 0.4)));
  ctx.globalAlpha = (1 - fogT * 0.6) * nearFade(relZ);

  // Assign a pet the first time this token is drawn.
  if (!c.pet && petDeck && petDeck.length) c.pet = petDeck[Math.floor(Math.random() * petDeck.length)];

  const pulse = 0.85 + 0.15 * Math.sin(t * 5 + c.id * 2);
  // Glow halo
  const halo = ctx.createRadialGradient(p.x, p.y, r * 0.4, p.x, p.y, r * 1.9);
  halo.addColorStop(0, 'rgba(255,209,102,0.55)');
  halo.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 1.9 * pulse, 0, Math.PI * 2);
  ctx.fill();

  const img = c.pet && c.pet.img;
  if (img && img.complete && img.naturalWidth) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.max(r * 2 / img.naturalWidth, r * 2 / img.naturalHeight);
    ctx.drawImage(img, p.x - img.naturalWidth * s / 2, p.y - img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();
  } else {
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    // paw dot
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(p.x, p.y - r * 0.2, r * 0.32, 0, Math.PI * 2); ctx.fill();
    for (const [dx, dy] of [[-0.4, 0.25], [0, 0.35], [0.4, 0.25]]) {
      ctx.beginPath(); ctx.arc(p.x + dx * r, p.y + dy * r, r * 0.16, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = Math.max(1.5, 3 * scale);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ── Particles ──────────────────────────────────────────────────────────────
function drawParticles(ctx, g, images) {
  const puff = images['puff.png'], star = images['star.png'];
  for (const p of g.puffs) {
    const pr = project(L, Math.max(30, p.z), L.laneWorldX[p.lane] + p.x, 10);
    if (!pr) continue;
    const sz = Math.max(4, (16 + (0.5 - p.life) * 26) * pr.scale * 2);
    ctx.globalAlpha = Math.max(0, Math.min(0.75, p.life * 1.9));
    if (puff) ctx.drawImage(puff, pr.x - sz / 2, pr.y - sz / 2, sz, sz * 0.84);
  }
  for (const s of g.sparkles) {
    const pr = project(L, Math.max(30, s.z), L.laneWorldX[s.lane] + s.x, 60);
    if (!pr) continue;
    const sz = Math.max(3, 14 * pr.scale * 2);
    ctx.globalAlpha = Math.min(1, s.life * 2);
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(s.rot);
    if (star) ctx.drawImage(star, -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ── Player ─────────────────────────────────────────────────────────────────
function drawPlayer(ctx, g, images, catDef) {
  const anchor = { x: lerp(laneScreenX(L, g.lane), laneScreenX(L, g.targetLane), smoothstep(g.laneT)) };
  const pScale = L.focal / L.playerZ;
  const groundY = L.horizonY + L.cameraHeight * pScale;
  const jumpOff = g.worldY * pScale;
  const px = anchor.x, py = groundY - jumpOff;

  // Shadow — shrinks + fades with jump height
  const shT = Math.max(0.25, 1 - g.worldY / (PHYS.jumpHeight * 1.6));
  ctx.fillStyle = `rgba(0,0,0,${(0.3 * shT).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(px, groundY + 4, 34 * shT, 8 * shT, 0, 0, Math.PI * 2);
  ctx.fill();

  const cat = images[catDef.sheet];
  if (!cat || !cat.naturalWidth) return;

  const invBlink = g.invincibleT > 0 && Math.floor(g.time / 0.08) % 2 === 0;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(g.lean * -0.16);
  const sliding = g.action === 'sliding';
  const dw = 96, dh = dw * (catDef.fh / catDef.fw);
  ctx.scale(g.stretchX * (sliding ? 1.15 : 1), g.squashY * (sliding ? 0.62 : 1));
  if (invBlink) ctx.globalAlpha = 0.35;
  const fr = g.catFrame % catDef.frames;
  const sx = fr * catDef.fw - (FRAME_SHIFT[fr] || 0);
  ctx.drawImage(cat, sx, 0, catDef.fw, catDef.fh, -dw / 2, -dh + 8, dw, dh);
  ctx.restore();

  if (g.landFlash > 0) {
    ctx.strokeStyle = `rgba(255,240,200,${g.landFlash.toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(px, groundY + 2, 40 * (1 - g.landFlash) + 22, 10 * (1 - g.landFlash) + 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── HUD ────────────────────────────────────────────────────────────────────
function drawHud(ctx, g, images) {
  if (g.state !== 'PLAYING' && g.state !== 'DYING') return;
  const W = VIEW.W;

  // Distance — Kenney digits + "m"
  const digits = String(Math.floor(g.meters)).split('');
  const dh = 40, dw = dh * (53 / 78), gap = 3;
  const mw = 16;
  let sx = (W - digits.length * (dw + gap) - mw - 6) / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  for (const d of digits) {
    const img = images[`numbers/number${d}.png`];
    if (img) ctx.drawImage(img, sx, 52, dw, dh);
    sx += dw + gap;
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('m', sx + 4, 52 + dh / 2 + 2);
  ctx.restore();

  // Rescued counter
  ctx.save();
  ctx.font = '800 17px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(10,28,25,0.55)';
  roundRect(ctx, 12, 54, 78, 30, 15); ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.fillText('🐾 ' + g.rescuedCount, 24, 70);
  ctx.restore();

  // Lives
  ctx.save();
  ctx.fillStyle = 'rgba(10,28,25,0.55)';
  const lw = 26 + g.lives * 22;
  roundRect(ctx, W - 12 - lw, 54, lw, 30, 15); ctx.fill();
  ctx.font = '16px system-ui';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < PHYS.lives; i++) {
    ctx.globalAlpha = i < g.lives ? 1 : 0.25;
    ctx.fillText('❤', W - 12 - lw + 16 + i * 22, 70);
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
    ctx.drawImage(tap, VIEW.W / 2 - 26, VIEW.H * 0.62 + bob, 52, 52);
  }
}

function drawDebug(ctx, g) {
  ctx.strokeStyle = 'rgba(80,255,140,0.8)';
  ctx.lineWidth = 1;
  for (const o of g.obstacles) {
    const d = o.worldZ - g.cameraZ;
    if (d < L.nearZ || d > L.farZ) continue;
    const b = obstacleBox(L, o, d);
    const h = (o.type === OBSTACLE.LANE_BLOCK ? 210 : o.type === OBSTACLE.LOW ? PHYS.lowWallHeight : 60) * b.scale;
    const y = o.type === OBSTACLE.HIGH ? b.groundY - (PHYS.highBarBottom + 60) * b.scale : b.groundY - h;
    ctx.strokeRect(b.cx - b.w / 2, y, b.w, h);
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
