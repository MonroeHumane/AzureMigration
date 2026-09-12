// Alpha-mask collision geometry. Sprites are scanned once at load on an
// offscreen canvas; opaque pixels define the hit shapes:
//   cat  -> per-frame bounding box -> inscribed ellipse (tight, animation-aware)
//   rock -> banded width profile -> stacked rects that follow the pointed tip
// If pixel reads fail (tainted canvas, missing image) callers fall back to
// the old conservative shapes — never crash.

const TIP_FRACTION = 0.38; // pointed end of the rock sprite (matches render slice)
const TIP_BANDS = 5;       // horizontal bands subdividing the tip region
const ALPHA_MIN = 16;      // alpha > this counts as solid

let work = null;

function scan(img, sx, sy, sw, sh) {
  try {
    if (!work) {
      work = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    }
    work.canvas.width = sw;
    work.canvas.height = sh;
    work.clearRect(0, 0, sw, sh);
    work.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return work.getImageData(0, 0, sw, sh).data;
  } catch (e) {
    return null;
  }
}

// ── Cat: tight ellipse per animation frame ─────────────────────────────────
// Returns {ox, oy, rx, ry} — center offset (pre-rotation) + radii in dest px.

const catCache = new Map();

export function catEllipse(img, frame, fw, fh, drawW) {
  if (!img || !img.naturalWidth) return { ox: 0, oy: 0, rx: drawW * 0.32, ry: drawW * 0.32 };
  const key = `${img.src}#${frame}`;
  if (catCache.has(key)) return catCache.get(key);

  const drawH = drawW * (fh / fw);
  const data = scan(img, frame * fw, 0, fw, fh);
  let box = null;
  if (data) {
    let minX = fw, minY = fh, maxX = -1, maxY = -1;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        if (data[(y * fw + x) * 4 + 3] > ALPHA_MIN) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX >= 0) box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }
  if (!box) box = { x: fw * 0.2, y: fh * 0.2, w: fw * 0.6, h: fh * 0.6 };

  const s = drawW / fw;
  // Ellipse inscribed in the alpha bbox, shrunk slightly so it stays inside
  // the sprite when the cat rotates.
  const e = {
    ox: (box.x + box.w / 2) * s - drawW / 2,
    oy: (box.y + box.h / 2) * s - drawH / 2,
    rx: (box.w / 2) * s * 0.9,
    ry: (box.h / 2) * s * 0.86,
  };
  catCache.set(key, e);
  return e;
}

// ── Rock: banded tip profile ───────────────────────────────────────────────
// Returns {tipSrc, iw, ih, bandsTop:[{l,r}], bandsBottom:[{l,r}]}
// l/r are opaque-column bounds (source px) per horizontal band of the tip
// region. Body region is treated as full width.

const rockCache = new Map();

export function rockProfile(img) {
  if (!img || !img.naturalWidth) return null;
  const key = img.src;
  if (rockCache.has(key)) return rockCache.get(key);

  const iw = img.naturalWidth, ih = img.naturalHeight;
  const tipSrc = Math.floor(ih * TIP_FRACTION);
  const data = scan(img, 0, 0, iw, ih);
  let profile = null;

  if (data) {
    const bandH = tipSrc / TIP_BANDS;
    const bands = [];
    for (let b = 0; b < TIP_BANDS * 2; b++) {
      // bands 0..TIP_BANDS-1 cover the TOP tip region; the rest cover BOTTOM.
      const regionY = b < TIP_BANDS ? b * bandH : ih - tipSrc + (b - TIP_BANDS) * bandH;
      let l = iw, r = -1;
      for (let y = Math.floor(regionY); y < regionY + bandH; y++) {
        for (let x = 0; x < iw; x++) {
          if (data[(y * iw + x) * 4 + 3] > ALPHA_MIN) {
            if (x < l) l = x;
            if (x > r) r = x;
          }
        }
      }
      if (r < 0) { l = iw * 0.3; r = iw * 0.7; } // empty band — conservative mid width
      bands.push({ l, r });
    }
    profile = {
      iw, ih, tipSrc,
      bandsTop: bands.slice(0, TIP_BANDS),
      bandsBottom: bands.slice(TIP_BANDS),
    };
  }
  rockCache.set(key, profile);
  return profile;
}

// Build tight collision rects (pipe-local coords, ox/oy relative to pipe x
// and the screen y passed in) mirroring drawPipe's two-slice layout.
export function pipeRects(img, w, h, isTop) {
  const rects = [];
  const prof = rockProfile(img);

  if (!prof) {
    // Fallback: full-width rect minus a small margin
    rects.push({ ox: 4, oy: 0, w: w - 8, h });
    return rects;
  }

  const { iw, ih, tipSrc } = prof;
  const tipH = Math.min(h, w * (tipSrc / iw));
  const bodyH = h - tipH;
  const sx = w / iw; // dest px per source px horizontally

  const inset = Math.max(2, iw * 0.03) * sx; // rocky edge breathing room

  if (isTop) {
    // Sprite tip is at the BOTTOM of the source image -> bottom of the pipe.
    if (bodyH > 0) rects.push({ ox: inset, oy: 0, w: w - inset * 2, h: bodyH });
    const bandH = tipH / TIP_BANDS;
    prof.bandsBottom.forEach((b, i) => {
      rects.push({ ox: b.l * sx, oy: bodyH + i * bandH, w: Math.max(4, (b.r - b.l) * sx), h: bandH });
    });
  } else {
    // Sprite tip is at the TOP of the source image -> top of the pipe.
    const bandH = tipH / TIP_BANDS;
    prof.bandsTop.forEach((b, i) => {
      rects.push({ ox: b.l * sx, oy: i * bandH, w: Math.max(4, (b.r - b.l) * sx), h: bandH });
    });
    if (bodyH > 0) rects.push({ ox: inset, oy: tipH, w: w - inset * 2, h: bodyH });
  }
  return rects;
}

// Ellipse-vs-rect: scale into unit-circle space, clamp, distance check.
export function ellipseHitsRect(cx, cy, rx, ry, rx0, ry0, rw, rh) {
  const ix = 1 / rx, iy = 1 / ry;
  const x0 = (rx0 - cx) * ix, y0 = (ry0 - cy) * iy;
  const x1 = x0 + rw * ix, y1 = y0 + rh * iy;
  const qx = Math.max(x0, Math.min(0, x1));
  const qy = Math.max(y0, Math.min(0, y1));
  return qx * qx + qy * qy <= 1;
}
