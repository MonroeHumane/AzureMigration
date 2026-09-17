/**
 * Flappy Cat — Kenney rock/cloud variant swapper (non-module).
 * Safe to skip: only mutates window.gameInstance.images when present & writable.
 * Does not rewrite the packed engine bundle.
 */
(function () {
  'use strict';

  var ROCK_SETS = [
    { id: 'grass', top: './assets/rock_top.png', bottom: './assets/rock_bottom.png' },
    { id: 'ice', top: './assets/rock_top_ice.png', bottom: './assets/rock_bottom_ice.png' },
    { id: 'snow', top: './assets/rock_top_snow.png', bottom: './assets/rock_bottom_snow.png' },
    { id: 'dirt', top: './assets/rock_top_dirt.png', bottom: './assets/rock_bottom_dirt.png' }
  ];

  var EXTRA_CLOUDS = [
    { key: 'cloud4', src: './assets/cloud4.png' },
    { key: 'cloud5', src: './assets/cloud5.png' },
    { key: 'cloud6', src: './assets/cloud6.png' }
  ];

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function imagesMutable(gi) {
    if (!gi || !gi.images || typeof gi.images !== 'object') return false;
    try {
      var probe = gi.images.rockTop;
      if (!probe) return false;
      // Attempt a no-op reassignment to confirm writability.
      gi.images.rockTop = probe;
      return true;
    } catch (e) {
      return false;
    }
  }

  function setForScore(score) {
    if (score >= 25) return ROCK_SETS[1]; // ice / night
    if (score >= 15) return ROCK_SETS[2]; // snow / dusk
    if (score >= 8) return ROCK_SETS[3];  // dirt / late day
    return ROCK_SETS[0]; // grass
  }

  function applyRockSet(gi, set, cache) {
    if (!set || !cache[set.id]) return;
    var pair = cache[set.id];
    if (pair.top) gi.images.rockTop = pair.top;
    if (pair.bottom) gi.images.rockBottom = pair.bottom;
    try {
      document.documentElement.dataset.fcRocks = set.id;
    } catch (e) {}
  }

  function injectExtraClouds(gi, cloudImgs) {
    if (!Array.isArray(gi.clouds)) return;
    EXTRA_CLOUDS.forEach(function (c) {
      if (cloudImgs[c.key]) gi.images[c.key] = cloudImgs[c.key];
    });
    var keys = EXTRA_CLOUDS.map(function (c) { return c.key; }).filter(function (k) {
      return !!gi.images[k];
    });
    if (!keys.length) return;
    // Avoid duplicating if we already injected.
    if (gi._fcExtraClouds) return;
    gi._fcExtraClouds = true;
    var width = (gi.model && gi.model.LOGICAL_WIDTH) || 400;
    keys.forEach(function (key, i) {
      gi.clouds.push({
        x: width + 60 + i * 140,
        y: 28 + (i * 37) % 90,
        speed: 7 + (i % 3) * 2.5,
        scale: 0.55 + (i % 3) * 0.12,
        imgKey: key
      });
    });
  }

  function boot() {
    var tries = 0;
    function waitReady() {
      var gi = window.gameInstance;
      if (!gi || !gi.assetsLoaded || !imagesMutable(gi)) {
        if (++tries < 120) {
          setTimeout(waitReady, 100);
        } else {
          console.info('[Flappy] Asset variants skipped (gameInstance.images not mutable or not ready).');
        }
        return;
      }

      var cache = {};
      var cloudImgs = {};
      var jobs = [];

      ROCK_SETS.forEach(function (set) {
        jobs.push(
          Promise.all([loadImage(set.top), loadImage(set.bottom)]).then(function (pair) {
            cache[set.id] = { top: pair[0], bottom: pair[1] };
          })
        );
      });
      EXTRA_CLOUDS.forEach(function (c) {
        jobs.push(loadImage(c.src).then(function (img) {
          if (img) cloudImgs[c.key] = img;
        }));
      });

      Promise.all(jobs).then(function () {
        if (!imagesMutable(window.gameInstance)) {
          console.info('[Flappy] Asset variants skipped after preload (images not mutable).');
          return;
        }
        gi = window.gameInstance;
        injectExtraClouds(gi, cloudImgs);

        var lastSetId = '';
        function tick() {
          var g = window.gameInstance;
          if (!g || !g.images) return;
          var score = (g.model && g.model.score) || 0;
          var state = g.model && g.model.state;
          if (state === 'READY') {
            // Fresh round: pick grass or a random set for run-to-run variety.
            if (lastSetId === '' || lastSetId === '__ready__') {
              /* keep */
            }
          }
          var set;
          if (state === 'READY' && score === 0) {
            // Randomize starting rock style once per ready screen.
            if (!g._fcReadyRockRoll) {
              g._fcReadyRockRoll = true;
              set = ROCK_SETS[Math.floor(Math.random() * ROCK_SETS.length)];
              applyRockSet(g, set, cache);
              lastSetId = set.id;
            }
          } else {
            if (state === 'PLAYING' || state === 'DYING') {
              g._fcReadyRockRoll = false;
            }
            set = setForScore(score);
            if (set.id !== lastSetId) {
              applyRockSet(g, set, cache);
              lastSetId = set.id;
            }
          }
          if (state === 'GAME_OVER') {
            g._fcReadyRockRoll = false;
          }
        }
        setInterval(tick, 200);
        tick();
        console.info('[Flappy] Kenney rock/cloud variants active.');
      });
    }
    waitReady();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
