/* ─── Lightweight particle pool (Graphics dots) — reduced-motion aware ── */

var SrFx = (function () {
  var POOL = 48;

  function create(scene) {
    var gfx = scene.add.graphics().setDepth(18);
    var parts = [];
    for (var i = 0; i < POOL; i++) {
      parts.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 3, color: 0xffffff, alpha: 1 });
    }
    return { gfx: gfx, parts: parts, reduced: false };
  }

  function setReduced(fx, on) { if (fx) fx.reduced = !!on; }

  function _spawn(fx, n, conf) {
    if (!fx || fx.reduced) return;
    var spawned = 0;
    for (var i = 0; i < fx.parts.length && spawned < n; i++) {
      var p = fx.parts[i];
      if (p.alive) continue;
      p.alive = true;
      p.x = conf.x + (Math.random() - 0.5) * (conf.spreadX || 8);
      p.y = conf.y + (Math.random() - 0.5) * (conf.spreadY || 4);
      p.vx = (conf.vx || 0) + (Math.random() - 0.5) * (conf.jitterX || 40);
      p.vy = (conf.vy || 0) + (Math.random() - 0.5) * (conf.jitterY || 30);
      p.life = 0;
      p.max = conf.lifeMs || 320;
      p.r = conf.r || (2 + Math.random() * 3);
      p.color = conf.color != null ? conf.color : 0xffffff;
      p.alpha = conf.alpha != null ? conf.alpha : 0.9;
      spawned++;
    }
  }

  function dust(fx, x, y, color) {
    _spawn(fx, 8, {
      x: x, y: y, spreadX: 18, spreadY: 6,
      vx: 0, vy: -20, jitterX: 80, jitterY: 40,
      lifeMs: 280, r: 2.5, color: color != null ? color : 0xd4c4a0, alpha: 0.7,
    });
  }

  function sparks(fx, x, y, color) {
    _spawn(fx, 10, {
      x: x, y: y, spreadX: 10, spreadY: 4,
      vx: 0, vy: -60, jitterX: 100, jitterY: 80,
      lifeMs: 360, r: 2.2, color: color != null ? color : 0xfff6c2, alpha: 1,
    });
  }

  function slideTrail(fx, x, y, color) {
    _spawn(fx, 3, {
      x: x, y: y + 6, spreadX: 22, spreadY: 4,
      vx: 0, vy: 8, jitterX: 30, jitterY: 20,
      lifeMs: 220, r: 3.5, color: color != null ? color : 0xc8b890, alpha: 0.45,
    });
  }

  function speedLines(fx, W, H, intensity) {
    if (!fx || fx.reduced || intensity < 0.15) return;
    var n = Math.min(4, 1 + Math.floor(intensity * 4));
    for (var i = 0; i < n; i++) {
      _spawn(fx, 1, {
        x: W * (0.15 + Math.random() * 0.7),
        y: H * (0.35 + Math.random() * 0.5),
        spreadX: 2, spreadY: 2,
        vx: 0, vy: 180 + intensity * 220,
        jitterX: 10, jitterY: 40,
        lifeMs: 180, r: 1.2 + intensity, color: 0xffffff, alpha: 0.25 + intensity * 0.25,
      });
    }
  }

  function update(fx, dtMs) {
    if (!fx) return;
    var g = fx.gfx;
    g.clear();
    for (var i = 0; i < fx.parts.length; i++) {
      var p = fx.parts[i];
      if (!p.alive) continue;
      p.life += dtMs;
      if (p.life >= p.max) { p.alive = false; continue; }
      var t = p.life / p.max;
      p.x += p.vx * (dtMs / 1000);
      p.y += p.vy * (dtMs / 1000);
      p.vy += 80 * (dtMs / 1000);
      var a = p.alpha * (1 - t);
      var r = p.r * (1 - t * 0.4);
      g.fillStyle(p.color, a);
      g.fillCircle(p.x, p.y, Math.max(0.8, r));
    }
  }

  function destroy(fx) {
    if (fx && fx.gfx) fx.gfx.destroy();
  }

  return {
    create: create, setReduced: setReduced, dust: dust, sparks: sparks,
    slideTrail: slideTrail, speedLines: speedLines, update: update, destroy: destroy,
  };
})();
