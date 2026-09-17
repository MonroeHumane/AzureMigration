// ═══════════════════════════════════════════════════════════════
//  BUSINESS TYCOON - Rendering Primitives
// ═══════════════════════════════════════════════════════════════

import { getCtx } from '../engine.js';

export function drawDiamond(x, y, w, h, color) {
  const ctx = getCtx();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x, y + h / 2);
  ctx.lineTo(x - w / 2, y);
  ctx.closePath();
  ctx.fill();
}

export function drawBox(x, y, bw, bh, depth, top, left, right) {
  const ctx = getCtx();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(x, y - depth); ctx.lineTo(x + bw / 2, y + bh / 2 - depth);
  ctx.lineTo(x, y + bh - depth); ctx.lineTo(x - bw / 2, y + bh / 2 - depth);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(x - bw / 2, y + bh / 2 - depth); ctx.lineTo(x, y + bh - depth);
  ctx.lineTo(x, y + bh); ctx.lineTo(x - bw / 2, y + bh / 2);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(x + bw / 2, y + bh / 2 - depth); ctx.lineTo(x, y + bh - depth);
  ctx.lineTo(x, y + bh); ctx.lineTo(x + bw / 2, y + bh / 2);
  ctx.closePath(); ctx.fill();
}

export function shadeColor(hex, amount) {
  if (!hex || typeof hex !== 'string') return 'rgb(136,136,136)';
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgb(${clamp(r + amount)},${clamp(g + amount)},${clamp(b + amount)})`;
  }
  if (clean.length < 6) return 'rgb(136,136,136)';
  let r = parseInt(clean.slice(0, 2), 16) + amount;
  let g = parseInt(clean.slice(2, 4), 16) + amount;
  let b = parseInt(clean.slice(4, 6), 16) + amount;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return 'rgb(136,136,136)';
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

function clamp(n) {
  return Math.max(0, Math.min(255, n));
}
