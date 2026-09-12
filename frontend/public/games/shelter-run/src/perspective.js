// Pseudo-3D projection — pure math, no DOM/canvas. All drawing happens in
// render.js via the projected {x, y, scale} points returned here.
import { VIEW, PROJ } from './config.js';

export function layout() {
  const W = VIEW.W, H = VIEW.H;
  const horizonY = H * PROJ.horizonRatio;
  return {
    W, H, horizonY,
    centerX: W / 2,
    focal: PROJ.focal,
    cameraHeight: PROJ.cameraHeight,
    playerZ: PROJ.playerZ,
    laneWorldX: PROJ.laneWorldX,
    trackHalfW: PROJ.trackHalfW,
    farZ: PROJ.farZ,
    nearZ: 70,
  };
}

// relZ = worldZ - cameraZ (depth ahead of camera). worldY is height above
// the track. Returns screen position + scale, or null behind the camera.
export function project(L, relZ, worldX, worldY = 0) {
  if (relZ < 1) return null;
  const scale = L.focal / relZ;
  return {
    x: L.centerX + worldX * scale,
    y: L.horizonY + (L.cameraHeight - worldY) * scale,
    scale,
  };
}

export function screenYToRelZ(L, sy) {
  const dy = sy - L.horizonY;
  if (dy <= 1) return L.farZ;
  return (L.cameraHeight * L.focal) / dy;
}

// Screen-space anchor for the player sprite at its fixed playerZ depth.
export function playerAnchor(L) {
  const p = project(L, L.playerZ, 0, 0);
  return { x: p.x, groundY: p.y, scale: p.scale };
}

export function laneScreenX(L, lane) {
  return L.centerX + (L.laneWorldX[lane] || 0) * (L.focal / L.playerZ);
}

export function laneWorldAt(L, laneT, fromLane, toLane) {
  // Interpolated *world* x for collision (lane check uses effectiveLane, but
  // rendering interpolates screen x directly).
  return L.laneWorldX[fromLane] + (L.laneWorldX[toLane] - L.laneWorldX[fromLane]) * smoothstep(laneT);
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

// Obstacle footprint on screen (used by render + debug).
export function obstacleBox(L, obs, relZ) {
  const scale = L.focal / relZ;
  const cx = L.centerX + L.laneWorldX[obs.lane] * scale;
  const laneW = (L.trackHalfW * 2 / 3) * scale;
  const w = laneW * 0.92;
  const groundY = L.horizonY + L.cameraHeight * scale;
  return { cx, groundY, w, scale };
}
