/* TEMPLE NOTE: mid-run celebrateDiscovery deferred — GameScene soft toast; RoundOver still celebrates + claims on claimed:true. */
/* ─── Adoptédex integration: discoveries + distance-milestone rewards ─────
   Uses the shared window.MonroeAdoptedex client (dex-shared.js) exactly the
   way match.js does for its LEVEL_MILESTONES - see the invariant below,
   which was a real bug in both Match and Flappy Cat before being fixed:
   the reward UI must only render when the SERVER confirms claimed:true,
   never just because the client thinks a milestone was crossed.

   Deepened: createFlipCard celebration overlay on discover, and milestone
   claim UI with Open Pack CTA once claimReward returns claimed:true. */

var ShelterRunDex = (function () {
  var CLAIMED_KEY = 'monroe_shelter_run_claimed_distances';
  var STYLE_ID = 'sr-dex-celebration-css';
  var activeOverlay = null;

  function getParams() {
    if (typeof MonroeAdoptedex !== 'undefined') {
      return MonroeAdoptedex.getParams();
    }
    return { dexUser: '', dexDisplay: '', dexApi: '' };
  }

  function readClaimed() {
    try {
      return JSON.parse(localStorage.getItem(CLAIMED_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function writeClaimed(list) {
    try {
      localStorage.setItem(CLAIMED_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  /** Map ShelterRunPets shape → MonroeAdoptedex.createFlipCard pet shape. */
  function toDexPet(pet) {
    if (!pet) return null;
    return {
      id: String(pet.id || ''),
      name: pet.name || 'Shelter friend',
      file: pet.photo || pet.file || pet.image || '',
      type: pet.type || 'Companion',
      breed: pet.breed || '',
      age: pet.age || pet.age_display || '',
      gender: pet.gender || '',
      url: pet.link || pet.url || '',
      archived: !!pet.archived,
      alt: pet.alt || pet.name || 'Shelter pet',
    };
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent = [
      '.sr-dex-overlay{position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;',
      'padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right))',
      'max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));',
      'background:rgba(7,26,23,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
      'pointer-events:auto;animation:srDexFade .2s ease}',
      '@keyframes srDexFade{from{opacity:0}to{opacity:1}}',
      '.sr-dex-panel{max-width:min(92vw,340px);width:100%;text-align:center;color:#fffaf3;',
      'font-family:"Fredoka","Segoe UI",system-ui,sans-serif}',
      '.sr-dex-panel__eyebrow{font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;',
      'color:#6bc4a6;margin:0 0 .35rem}',
      '.sr-dex-panel__title{font-size:1.35rem;font-weight:700;margin:0 0 .75rem;color:#fff}',
      '.sr-dex-panel__host{display:flex;justify-content:center;margin:0 auto .85rem;perspective:900px}',
      '.sr-dex-panel__host .adoptedex-card-wrap{list-style:none;margin:0;padding:0;width:min(220px,70vw)}',
      '.sr-dex-panel__host .adoptedex-card{position:relative;width:100%;aspect-ratio:3/4.2;border:0;padding:0;',
      'background:transparent;cursor:pointer;transform-style:preserve-3d;transition:transform .55s ease;',
      'border-radius:16px;perspective:900px}',
      '.sr-dex-panel__host .adoptedex-card.is-flipped{transform:rotateY(180deg)}',
      '.sr-dex-panel__host .adoptedex-card__face{position:absolute;inset:0;backface-visibility:hidden;',
      '-webkit-backface-visibility:hidden;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;',
      'padding:10px;box-shadow:0 16px 36px rgba(0,0,0,.45);border:2px solid rgba(107,196,166,.45)}',
      '.sr-dex-panel__host .adoptedex-card__face--front{background:linear-gradient(160deg,#fffaf3,#ffe8c7);color:#2c1c19}',
      '.sr-dex-panel__host .adoptedex-card__face--back{background:linear-gradient(160deg,#0c332a,#071a17);color:#fffaf3;',
      'transform:rotateY(180deg);justify-content:space-between}',
      '.sr-dex-panel__host .adoptedex-card__art{flex:1;border-radius:12px;overflow:hidden;background:#0b1a16;',
      'display:flex;align-items:center;justify-content:center;position:relative;min-height:120px}',
      '.sr-dex-panel__host .adoptedex-card__photo{width:100%;height:100%;object-fit:cover}',
      '.sr-dex-panel__host .adoptedex-card__name{font-weight:800;font-size:1.05rem;margin-top:6px}',
      '.sr-dex-panel__host .adoptedex-card__num{font-size:.72rem;font-weight:700;color:#115e59}',
      '.sr-dex-panel__host .adoptedex-card__type{font-size:.72rem;font-weight:700;align-self:flex-start;',
      'padding:2px 8px;border-radius:999px;background:rgba(107,196,166,.25);margin-top:4px}',
      '.sr-dex-panel__host .adoptedex-card__stats{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;',
      'font-size:.78rem;text-align:left;margin:8px 0}',
      '.sr-dex-panel__host .adoptedex-card__stats dt{opacity:.7}',
      '.sr-dex-panel__host .adoptedex-card__stats dd{margin:0;font-weight:700}',
      '.sr-dex-panel__host .adoptedex-card__actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}',
      '.sr-dex-panel__host .adoptedex-btn{display:inline-flex;align-items:center;justify-content:center;',
      'min-height:44px;padding:8px 14px;border-radius:999px;font-weight:800;font-size:.8rem;text-decoration:none;',
      'border:1.5px solid rgba(107,196,166,.5);background:#08332a;color:#5eead4}',
      '.sr-dex-panel__hint{font-size:.78rem;color:#cfe0ea;margin:0 0 .75rem}',
      '.sr-dex-panel__actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}',
      '.sr-dex-btn{appearance:none;border:0;cursor:pointer;min-height:44px;padding:10px 16px;border-radius:999px;',
      'font-family:inherit;font-weight:800;font-size:.85rem}',
      '.sr-dex-btn--primary{background:linear-gradient(140deg,#ffd39f,#ffb347);color:#2c1c19}',
      '.sr-dex-btn--ghost{background:rgba(8,51,42,.9);color:#e8f4ef;border:1.5px solid rgba(107,196,166,.45)}',
      '.sr-dex-milestone{max-width:min(92vw,380px);padding:1rem 1.1rem;border-radius:18px;',
      'background:rgba(12,51,42,.95);border:1.5px solid rgba(251,191,36,.55);',
      'box-shadow:0 16px 40px rgba(0,0,0,.5);text-align:center;color:#fffaf3;',
      'font-family:"Fredoka","Segoe UI",system-ui,sans-serif}',
      '.sr-dex-milestone h3{margin:0 0 .35rem;font-size:1.2rem}',
      '.sr-dex-milestone p{margin:0 0 .85rem;color:#cfe0ea;font-size:.88rem}',
    ].join('');
    document.head.appendChild(css);
  }

  function dismissOverlay() {
    if (activeOverlay && activeOverlay.parentNode) {
      activeOverlay.parentNode.removeChild(activeOverlay);
    }
    activeOverlay = null;
  }

  function hostEl() {
    return document.getElementById('game-container') || document.body;
  }

  /**
   * Celebration UI for a rescued pet using MonroeAdoptedex.createFlipCard.
   * Tap the card to flip front/back. Auto-dismisses unless sticky.
   */
  function celebrateDiscovery(pet, options) {
    options = options || {};
    ensureStyles();
    dismissOverlay();

    var dexPet = toDexPet(pet);
    if (!dexPet || !dexPet.id) return;

    var overlay = document.createElement('div');
    overlay.className = 'sr-dex-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Pet discovered');

    var panel = document.createElement('div');
    panel.className = 'sr-dex-panel';

    var eyebrow = document.createElement('p');
    eyebrow.className = 'sr-dex-panel__eyebrow';
    eyebrow.textContent = '🐾 Rescued along the run';

    var title = document.createElement('h2');
    title.className = 'sr-dex-panel__title';
    title.textContent = dexPet.name;

    var host = document.createElement('div');
    host.className = 'sr-dex-panel__host';

    if (typeof MonroeAdoptedex !== 'undefined' && typeof MonroeAdoptedex.createFlipCard === 'function') {
      var wrap = MonroeAdoptedex.createFlipCard(dexPet, {
        met: true,
        mode: 'collection',
        readOnly: true,
        dexNumber: options.dexNumber || 0,
        highlight: true,
      });
      // createFlipCard returns <li>; unwrap button for cleaner overlay
      var cardBtn = wrap.querySelector('.adoptedex-card') || wrap;
      if (wrap.tagName === 'LI') {
        host.appendChild(wrap);
      } else {
        host.appendChild(cardBtn);
      }
      // Auto-flip after a beat so the back stats peek
      setTimeout(function () {
        var c = host.querySelector('.adoptedex-card');
        if (c && !c.classList.contains('is-flipped')) c.classList.add('is-flipped');
      }, options.autoFlipMs != null ? options.autoFlipMs : 700);
    } else if (dexPet.file) {
      var img = document.createElement('img');
      img.src = dexPet.file;
      img.alt = dexPet.alt || dexPet.name;
      img.style.cssText = 'width:160px;height:160px;object-fit:cover;border-radius:16px;border:3px solid #ffd166;';
      host.appendChild(img);
    }

    var hint = document.createElement('p');
    hint.className = 'sr-dex-panel__hint';
    hint.textContent = 'Tap card to flip · saved to your Pet Discovery Binder';

    var actions = document.createElement('div');
    actions.className = 'sr-dex-panel__actions';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sr-dex-btn sr-dex-btn--primary';
    closeBtn.textContent = 'Keep running';
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      dismissOverlay();
      if (typeof options.onClose === 'function') options.onClose();
    });
    actions.appendChild(closeBtn);

    panel.append(eyebrow, title, host, hint, actions);
    overlay.appendChild(panel);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        dismissOverlay();
        if (typeof options.onClose === 'function') options.onClose();
      }
    });

    hostEl().appendChild(overlay);
    activeOverlay = overlay;

    var ttl = options.durationMs != null ? options.durationMs : 2800;
    if (ttl > 0) {
      setTimeout(function () {
        if (activeOverlay === overlay) {
          dismissOverlay();
          if (typeof options.onClose === 'function') options.onClose();
        }
      }, ttl);
    }

    return overlay;
  }

  /**
   * Milestone pack banner — only call after claimReward resolved claimed:true.
   */

  function pulseCelebrateFlash() {
    var el = document.getElementById('srCelebrateFlash');
    if (!el) return;
    var reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
    setTimeout(function () { el.classList.remove('is-on'); }, reduced ? 220 : 720);
  }

  function celebrateMilestone(milestone, options) {
    options = options || {};
    ensureStyles();
    pulseCelebrateFlash();

    var tierLabel = ({ standard: 'Standard', duo: 'Duo', deluxe: 'Deluxe' })[milestone.tier] || milestone.tier;
    var overlay = document.createElement('div');
    overlay.className = 'sr-dex-overlay';
    overlay.setAttribute('role', 'status');

    var box = document.createElement('div');
    box.className = 'sr-dex-milestone';

    var h = document.createElement('h3');
    h.textContent = '🎁 ' + tierLabel + ' pack unlocked!';

    var p = document.createElement('p');
    p.textContent = (milestone.threshold ? milestone.threshold + ' m milestone · ' : '') +
      'Open it in your Pet Discovery Binder.';

    var actions = document.createElement('div');
    actions.className = 'sr-dex-panel__actions';

    var openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'sr-dex-btn sr-dex-btn--primary';
    openBtn.textContent = 'Open pack';
    openBtn.addEventListener('click', function () {
      dismissOverlay();
      openBinderPacks(milestone.tier);
    });

    var laterBtn = document.createElement('button');
    laterBtn.type = 'button';
    laterBtn.className = 'sr-dex-btn sr-dex-btn--ghost';
    laterBtn.textContent = 'Later';
    laterBtn.addEventListener('click', dismissOverlay);

    actions.append(openBtn, laterBtn);
    box.append(h, p, actions);
    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) dismissOverlay();
    });

    // Do not dismiss an active discovery flip mid-celebration — queue instead.
    if (activeOverlay && activeOverlay.getAttribute('aria-label') === 'Pet discovered') {
      var pendingMilestone = milestone;
      var pendingOptions = options;
      var wait = setInterval(function () {
        if (!activeOverlay || activeOverlay.getAttribute('aria-label') !== 'Pet discovered') {
          clearInterval(wait);
          celebrateMilestone(pendingMilestone, pendingOptions);
        }
      }, 120);
      setTimeout(function () { clearInterval(wait); }, 8000);
      return null;
    }

    dismissOverlay();
    hostEl().appendChild(overlay);
    activeOverlay = overlay;

    if (typeof options.onShow === 'function') options.onShow(milestone);
    return overlay;
  }

  function openBinderPacks(tier) {
    var p = getParams();
    var q = new URLSearchParams();
    q.set('embed', document.documentElement.classList.contains('humane-embed') ? '1' : '0');
    if (tier) q.set('pack', tier);
    if (p.dexUser) {
      q.set('dex_user', p.dexUser);
      q.set('user', p.dexUser);
    }
    if (p.dexApi) q.set('dex_api', p.dexApi);
    var url = '../dex/album.html?' + q.toString() + '#open-pack';
    // Prefer booster ceremony when available
    var booster = '../booster/index.html?' + q.toString();
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'arcade:open_game',
          game: 'booster',
          url: booster,
          tier: tier || 'standard',
        }, '*');
        return;
      }
    } catch (e) {}
    window.location.href = booster;
  }

  /**
   * Reports every pet collected during a run, batched into one call at
   * run-end rather than one network call per pickup.
   */
  function reportDiscoveries(petIds) {
    if (typeof MonroeAdoptedex === 'undefined' || !petIds || !petIds.length) {
      return Promise.resolve(null);
    }
    var p = getParams();
    if (!p.dexUser) {
      // Still persist locally so album can pick them up offline
      try {
        var existing = JSON.parse(localStorage.getItem('monroe_discovered_pets') || '[]');
        petIds.forEach(function (id) {
          var s = String(id);
          if (existing.indexOf(s) === -1) existing.push(s);
        });
        localStorage.setItem('monroe_discovered_pets', JSON.stringify(existing));
      } catch (e) {}
      return Promise.resolve(null);
    }
    return MonroeAdoptedex.discoverBulk(p.dexApi, p.dexUser, petIds, 'shelter_run')
      .then(function (res) {
        try {
          var existing = JSON.parse(localStorage.getItem('monroe_discovered_pets') || '[]');
          petIds.forEach(function (id) {
            var s = String(id);
            if (existing.indexOf(s) === -1) existing.push(s);
          });
          localStorage.setItem('monroe_discovered_pets', JSON.stringify(existing));
        } catch (e) {}
        return res;
      })
      .catch(function (e) {
        console.warn('[Shelter Run] discovery failed:', e);
        return null;
      });
  }

  /**
   * Claims every distance milestone crossed this run that isn't already
   * claimed locally. onClaimed is only called when server confirms claimed:true.
   */
  function claimMilestones(finalDistanceMeters, onClaimed) {
    if (typeof MonroeAdoptedex === 'undefined') return;
    var p = getParams();
    if (!p.dexUser) return;

    var claimed = readClaimed();
    var thresholds = Object.keys(CFG.DISTANCE_MILESTONES)
      .map(Number)
      .filter(function (m) { return m <= finalDistanceMeters; })
      .sort(function (a, b) { return a - b; });

    thresholds.forEach(function (threshold) {
      if (claimed.indexOf(threshold) !== -1) return;
      var milestone = CFG.DISTANCE_MILESTONES[threshold];

      MonroeAdoptedex.claimReward(p.dexApi, p.dexUser, 'shelter_run', milestone.rewardKey, {
        tier: milestone.tier,
        count: 1,
      }).then(function (result) {
        if (result && result.claimed) {
          claimed.push(threshold);
          writeClaimed(claimed);
          try {
            var packs = parseInt(localStorage.getItem('monroeDexPacks') || '0', 10) || 0;
            localStorage.setItem('monroeDexPacks', String(packs + 1));
          } catch (e) {}
          var payload = { tier: milestone.tier, rewardKey: milestone.rewardKey, threshold: threshold };
          celebrateMilestone(payload);
          if (typeof onClaimed === 'function') {
            onClaimed(payload);
          }
          if (typeof MonroeAdoptedex !== 'undefined' && typeof MonroeAdoptedex.showRewardToast === 'function') {
            MonroeAdoptedex.showRewardToast({
              title: 'Shelter Run pack!',
              message: 'Distance ' + threshold + 'm — ' + (milestone.tier || 'standard') + ' pack unlocked.',
              game: 'Shelter Run',
              tier: milestone.tier,
              rare: threshold >= 3000,
            });
          }
        }
      }).catch(function (e) {
        console.warn('[Shelter Run] claim failed for ' + milestone.rewardKey + ':', e);
      });
    });
  }

  return {
    getParams: getParams,
    toDexPet: toDexPet,
    reportDiscoveries: reportDiscoveries,
    claimMilestones: claimMilestones,
    celebrateDiscovery: celebrateDiscovery,
    celebrateMilestone: celebrateMilestone,
    openBinderPacks: openBinderPacks,
    dismissOverlay: dismissOverlay,
  };
})();
