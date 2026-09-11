/* ─── Pseudo-3D projection helpers (GameHelix-style math, no assets) ──── */

var Perspective = (function () {
  /** Active biome colors — set each frame from GameScene via setBiomeColors. */
  var _colors = null;

  function colors() {
    return _colors || CFG.COLORS;
  }

  function setBiomeColors(c) {
    _colors = c || null;
  }

  function layout(W, H) {
    var horizonY = H * CFG.HORIZON_Y_RATIO;
    var playerScreenY = H * CFG.PLAYER_SCREEN_Y_RATIO;
    var centerX = W / 2;
    var targetHalf = W * 0.36;
    var baseHalf = CFG.TRACK_HALF_W * (CFG.FOCAL / CFG.PLAYER_Z);
    var ws = targetHalf / Math.max(1, baseHalf);
    return {
      W: W, H: H, horizonY: horizonY, playerScreenY: playerScreenY, centerX: centerX,
      focal: CFG.FOCAL, cameraHeight: CFG.CAMERA_HEIGHT, playerZ: CFG.PLAYER_Z,
      laneWorldX: CFG.LANE_WORLD_X.map(function (x) { return x * ws; }),
      trackHalfW: CFG.TRACK_HALF_W * ws, farZ: CFG.FAR_Z, nearZ: CFG.NEAR_Z,
    };
  }

  function project(L, relZ, worldX, worldY) {
    worldY = worldY || 0;
    if (relZ < 1) return null;
    var scale = L.focal / relZ;
    return { x: L.centerX + worldX * scale, y: L.horizonY + (L.cameraHeight - worldY) * scale, scale: scale };
  }

  function screenYToRelZ(L, sy) {
    var dy = sy - L.horizonY;
    if (dy <= 1) return L.farZ;
    return (L.cameraHeight * L.focal) / dy;
  }

  function laneScreenX(L, lane) {
    return L.centerX + (L.laneWorldX[lane] || 0) * (L.focal / L.playerZ);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

  function hexToColor(hex) { return Phaser.Display.Color.HexStringToColor(hex).color; }

  function drawSky(g, L) {
    var C = colors();
    var steps = 10;
    var top = Phaser.Display.Color.HexStringToColor(C.skyTop);
    var mid = Phaser.Display.Color.HexStringToColor(C.skyMid);
    var bot = Phaser.Display.Color.HexStringToColor(C.skyBottom);
    var h = L.horizonY + 36;
    for (var i = 0; i < steps; i++) {
      var t = i / (steps - 1);
      var c = t < 0.55
        ? Phaser.Display.Color.Interpolate.ColorWithColor(top, mid, 100, Math.floor((t / 0.55) * 100))
        : Phaser.Display.Color.Interpolate.ColorWithColor(mid, bot, 100, Math.floor(((t - 0.55) / 0.45) * 100));
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, h * (i / steps), L.W, Math.ceil(h / steps) + 1);
    }
    var haze = C.haze != null ? C.haze : 0x6bc4a6;
    g.fillStyle(haze, 0.16);
    g.fillRect(0, L.horizonY - 8, L.W, 22);
  }

  function drawTrack(g, L, cameraZ) {
    var C = colors();
    var STEP = Math.max(2, Math.floor(L.H / 220));
    var dark = hexToColor(C.trackDark);
    var light = hexToColor(C.trackLight);
    for (var sy = Math.floor(L.horizonY); sy <= L.H; sy += STEP) {
      var relZ = screenYToRelZ(L, sy);
      if (relZ < L.nearZ || relZ > L.farZ) continue;
      var absZ = cameraZ + relZ;
      var scale = L.focal / relZ;
      var hw = L.trackHalfW * scale;
      var stripe = (Math.floor(absZ / 180) & 1);
      g.fillStyle(stripe ? light : dark, 1);
      g.fillRect(L.centerX - hw, sy, hw * 2, STEP + 1);
    }
    _line(g, L, (L.laneWorldX[0] + L.laneWorldX[1]) / 2, C.laneDiv, 0.5);
    _line(g, L, (L.laneWorldX[1] + L.laneWorldX[2]) / 2, C.laneDiv, 0.5);
    _line(g, L, -L.trackHalfW, C.trackEdge, 0.9);
    _line(g, L, L.trackHalfW, C.trackEdge, 0.9);
    var bl = project(L, L.nearZ + 50, -L.trackHalfW, 0);
    var br = project(L, L.nearZ + 50, L.trackHalfW, 0);
    if (bl && br) {
      g.fillStyle(0x0c332a, 0.32);
      g.fillPoints([{ x: L.centerX, y: L.horizonY }, { x: bl.x, y: bl.y }, { x: 0, y: L.H }, { x: 0, y: L.horizonY }], true);
      g.fillPoints([{ x: L.centerX, y: L.horizonY }, { x: br.x, y: br.y }, { x: L.W, y: L.H }, { x: L.W, y: L.horizonY }], true);
    }
  }

  function _line(g, L, wx, color, alpha) {
    var near = project(L, L.nearZ + 50, wx, 0);
    var far = project(L, L.farZ * 0.6, wx, 0);
    if (!near || !far) return;
    g.lineStyle(Math.max(1.5, 2), color, alpha);
    g.beginPath();
    g.moveTo(far.x, far.y);
    g.lineTo(near.x, near.y);
    g.strokePath();
  }

  function _shade(base, delta) {
    var c = Phaser.Display.Color.IntegerToColor(base);
    return Phaser.Display.Color.GetColor(
      Math.max(0, Math.min(255, c.red + delta)),
      Math.max(0, Math.min(255, c.green + delta)),
      Math.max(0, Math.min(255, c.blue + delta))
    );
  }

  function drawObstacle(g, L, obs, relZ) {
    var C = colors();
    var scale = L.focal / relZ;
    var wx = L.laneWorldX[obs.lane];
    var cx = L.centerX + wx * scale;
    var lw = (L.trackHalfW * 2 / 3) * scale;
    var w = lw * 0.9;
    var groundY = L.horizonY + L.cameraHeight * scale;
    var v = obs.variant | 0;

    if (obs.type === SR_OBSTACLE_TYPES.LANE_BLOCK) {
      var h = CFG.WALL_HEIGHT * scale;
      var wall = C.wall;
      if (v === 1) {
        // Boulder — wider base, rounded top
        g.fillStyle(_shade(wall, -20), 0.95);
        g.fillEllipse(cx, groundY - h * 0.35, w * 1.05, h * 0.85);
        g.fillStyle(_shade(wall, 25), 0.35);
        g.fillEllipse(cx - w * 0.15, groundY - h * 0.55, w * 0.35, h * 0.25);
      } else if (v === 2) {
        // Crate / stacked blocks
        var bh = h / 3;
        g.fillStyle(wall, 0.95);
        g.fillRoundedRect(cx - w / 2, groundY - bh, w, bh, Math.min(4, w * 0.08));
        g.fillStyle(_shade(wall, -18), 0.95);
        g.fillRoundedRect(cx - w * 0.42, groundY - bh * 2, w * 0.84, bh, Math.min(4, w * 0.08));
        g.fillStyle(_shade(wall, 12), 0.95);
        g.fillRoundedRect(cx - w * 0.34, groundY - h, w * 0.68, bh, Math.min(4, w * 0.08));
        g.lineStyle(Math.max(1, 1.5 * scale), 0x000000, 0.25);
        g.strokeRect(cx - w / 2, groundY - bh, w, bh);
      } else {
        // Classic pillar
        g.fillStyle(wall, 0.95);
        g.fillRoundedRect(cx - w / 2, groundY - h, w, h, Math.min(6, w * 0.1));
        g.fillStyle(0xffffff, 0.18);
        g.fillRect(cx - w / 2, groundY - h, w, Math.max(2, h * 0.05));
        g.fillStyle(_shade(wall, -30), 0.5);
        g.fillRect(cx + w * 0.25, groundY - h, w * 0.2, h);
      }
    } else if (obs.type === SR_OBSTACLE_TYPES.LOW) {
      var lh = CFG.LOW_WALL_HEIGHT * scale;
      var low = C.low;
      if (v === 1) {
        // Log — horizontal capsule
        g.fillStyle(_shade(low, -15), 0.95);
        g.fillRoundedRect(cx - w / 2, groundY - lh * 0.7, w, lh * 0.7, lh * 0.35);
        g.fillStyle(_shade(low, 30), 0.4);
        g.fillCircle(cx - w * 0.35, groundY - lh * 0.35, lh * 0.28);
        g.fillCircle(cx + w * 0.35, groundY - lh * 0.35, lh * 0.28);
      } else if (v === 2) {
        // Mound / rubble
        g.fillStyle(low, 0.95);
        g.fillTriangle(cx - w / 2, groundY, cx, groundY - lh * 1.05, cx + w / 2, groundY);
        g.fillStyle(_shade(low, 20), 0.5);
        g.fillTriangle(cx - w * 0.2, groundY, cx, groundY - lh * 0.7, cx + w * 0.15, groundY);
      } else {
        g.fillStyle(low, 0.95);
        g.fillRoundedRect(cx - w / 2, groundY - lh, w, lh, Math.min(5, w * 0.1));
        g.fillStyle(0xffffff, 0.12);
        g.fillRect(cx - w / 2, groundY - lh, w, Math.max(2, lh * 0.12));
      }
    } else if (obs.type === SR_OBSTACLE_TYPES.HIGH) {
      var barBottom = L.horizonY + (L.cameraHeight - CFG.HIGH_BAR_BOTTOM) * scale;
      var barH = CFG.HIGH_BAR_THICKNESS * scale;
      var high = C.high;
      if (v === 1) {
        // Vine / rope sag
        g.lineStyle(Math.max(2, 2.5 * scale), high, 0.9);
        g.beginPath();
        g.moveTo(cx - w / 2, barBottom - barH * 0.3);
        g.lineTo(cx - w * 0.15, barBottom + barH * 0.4);
        g.lineTo(cx + w * 0.15, barBottom + barH * 0.4);
        g.lineTo(cx + w / 2, barBottom - barH * 0.3);
        g.strokePath();
        g.fillStyle(high, 0.85);
        g.fillEllipse(cx, barBottom + barH * 0.15, w * 0.55, barH * 0.9);
        g.lineStyle(Math.max(2, 2 * scale), _shade(high, -40), 0.7);
        g.beginPath();
        g.moveTo(cx - w * 0.4, barBottom - barH);
        g.lineTo(cx - w * 0.4, groundY);
        g.moveTo(cx + w * 0.4, barBottom - barH);
        g.lineTo(cx + w * 0.4, groundY);
        g.strokePath();
      } else if (v === 2) {
        // Banner / double bar
        g.fillStyle(high, 0.95);
        g.fillRoundedRect(cx - w / 2, barBottom - barH, w, barH * 0.45, 2);
        g.fillRoundedRect(cx - w / 2, barBottom - barH * 2.1, w, barH * 0.45, 2);
        g.lineStyle(Math.max(2, 2.5 * scale), high, 0.65);
        g.beginPath();
        g.moveTo(cx - w * 0.32, barBottom - barH * 2.1);
        g.lineTo(cx - w * 0.32, groundY);
        g.moveTo(cx + w * 0.32, barBottom - barH * 2.1);
        g.lineTo(cx + w * 0.32, groundY);
        g.strokePath();
      } else {
        g.fillStyle(high, 0.95);
        g.fillRoundedRect(cx - w / 2, barBottom - barH, w, barH, Math.min(4, barH * 0.25));
        g.lineStyle(Math.max(2, 2.5 * scale), high, 0.65);
        g.beginPath();
        g.moveTo(cx - w * 0.32, barBottom);
        g.lineTo(cx - w * 0.32, groundY);
        g.moveTo(cx + w * 0.32, barBottom);
        g.lineTo(cx + w * 0.32, groundY);
        g.strokePath();
      }
    }
  }

  function drawCollectible(g, L, item, relZ, frame) {
    var C = colors();
    var scale = L.focal / relZ;
    var wx = L.laneWorldX[item.lane];
    var cx = L.centerX + wx * scale;
    var cy = L.horizonY + (L.cameraHeight - 48) * scale;
    var r = Math.max(4, 13 * scale);
    var pulse = 0.82 + 0.18 * Math.sin((frame || 0) * 0.14 + item.id);
    g.fillStyle(C.collect, pulse);
    g.fillCircle(cx, cy, r);
    g.lineStyle(Math.max(1, 2 * scale), 0xffffff, 0.8);
    g.strokeCircle(cx, cy, r);
  }

  /** Screen-space AABB hint for optional Kenney rock overlay (collision unchanged). */
  function obstacleScreenBox(L, obs, relZ) {
    var scale = L.focal / relZ;
    var wx = L.laneWorldX[obs.lane];
    var cx = L.centerX + wx * scale;
    var lw = (L.trackHalfW * 2 / 3) * scale;
    var w = lw * 0.9;
    var groundY = L.horizonY + L.cameraHeight * scale;
    var h = CFG.WALL_HEIGHT * scale;
    return { cx: cx, groundY: groundY, w: w, h: h, scale: scale };
  }

  return {
    layout: layout, project: project, screenYToRelZ: screenYToRelZ,
    laneScreenX: laneScreenX, lerp: lerp, smoothstep: smoothstep,
    drawSky: drawSky, drawTrack: drawTrack, drawObstacle: drawObstacle,
    drawCollectible: drawCollectible, setBiomeColors: setBiomeColors,
    colors: colors, obstacleScreenBox: obstacleScreenBox,
  };
})();
