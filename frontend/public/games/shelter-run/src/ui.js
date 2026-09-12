// DOM chrome: start screen, game-over panel (medal/distance/leaderboard/
// rescued pets), pack-open modal, upgrade store, objectives panel,
// milestone toasts, companion picker. Canvas stays gameplay-only.
import { MEDALS, CATS, MILESTONES, UPGRADES, OBJECTIVES } from './config.js';

const $ = sel => document.querySelector(sel);

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function createUI({ onStart, onRetry, onOpenPack, onPickCat, onBuyUpgrade }) {
  const root = $('#ui-root');

  // ── Start screen ─────────────────────────────────────────────────────────
  const start = el('section', 'sr-overlay sr-start');
  start.innerHTML = `
    <div class="sr-card">
      <p class="sr-eyebrow">Humane Arcade</p>
      <h1 class="sr-title">SHELTER RUN</h1>
      <p class="sr-sub">Swipe or use <kbd>←</kbd><kbd>→</kbd> to change lanes, <kbd>↑</kbd> to jump, <kbd>↓</kbd> to slide.<br>Rescue pets along the trail — distance milestones earn packs.</p>
      <div class="sr-cats" role="radiogroup" aria-label="Choose your cat"></div>
      <button type="button" class="sr-btn sr-btn-primary" data-start>Start Running</button>
      <div class="sr-menu-row">
        <button type="button" class="sr-btn sr-btn-soft" data-store>🛍 Upgrades</button>
        <button type="button" class="sr-btn sr-btn-soft" data-objectives>🎯 Objectives</button>
      </div>
      <p class="sr-best" data-best></p>
      <p class="sr-wallet" data-wallet hidden></p>
    </div>`;
  root.appendChild(start);

  const catsWrap = start.querySelector('.sr-cats');
  const catButtons = CATS.map(cat => {
    const b = el('button', 'sr-cat-pick');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.cat = cat.id;
    const cv = document.createElement('canvas');
    cv.width = 160; cv.height = 140;
    cv.className = 'sr-cat-thumb';
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', cat.name);
    const im = new Image();
    im.onload = () => { cv.getContext('2d').drawImage(im, 0, 0, cat.fw, cat.fh, 0, 0, 160, 140); };
    im.src = `assets/${cat.sheet}`;
    b.appendChild(cv);
    b.appendChild(el('span', 'sr-cat-name', cat.name));
    b.addEventListener('click', () => { selectCat(cat.id); onPickCat(cat.id); });
    catsWrap.appendChild(b);
    return b;
  });
  function selectCat(id) {
    catButtons.forEach(b => {
      const on = b.dataset.cat === id;
      b.classList.toggle('is-picked', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  start.querySelector('[data-start]').addEventListener('click', onStart);

  // ── Game over ────────────────────────────────────────────────────────────
  const over = el('section', 'sr-overlay sr-over');
  over.innerHTML = `
    <div class="sr-card">
      <img class="sr-banner" src="assets/ui/textGameOver.png" alt="Game over">
      <div class="sr-score-row">
        <img class="sr-medal" data-medal alt="" hidden>
        <div class="sr-score-nums">
          <div class="sr-score-big" data-score>0</div>
          <div class="sr-meters">meters</div>
          <div class="sr-best-line">Best <b data-best-run>0</b><span data-new-best class="sr-newbest" hidden> · New best!</span></div>
        </div>
      </div>
      <div class="sr-rescued" data-rescued hidden>
        <h2 class="sr-h2">Rescued this run</h2>
        <div class="sr-rescued-row" data-rescued-row></div>
        <a class="sr-binder-link" data-binder-link target="_top" hidden>View in your Binder →</a>
      </div>
      <div class="sr-board">
        <h2 class="sr-h2">Leaderboard</h2>
        <ol class="sr-leader" data-leader><li class="sr-loading">Loading…</li></ol>
      </div>
      <div class="sr-actions">
        <button type="button" class="sr-btn sr-btn-primary" data-retry>Run Again</button>
        <button type="button" class="sr-btn sr-btn-pack" data-pack hidden>🐾 Open Pack</button>
      </div>
      <p class="sr-packs-line" data-packs-line></p>
    </div>`;
  root.appendChild(over);
  over.querySelector('[data-retry]').addEventListener('click', onRetry);
  over.querySelector('[data-pack]').addEventListener('click', () => onOpenPack());

  // ── Pack opening modal ───────────────────────────────────────────────────
  const packModal = el('section', 'sr-overlay sr-packmodal');
  packModal.innerHTML = `
    <div class="sr-card sr-pack-card">
      <h2 class="sr-h2" data-pack-title>Booster Pack</h2>
      <div class="sr-pack-body" data-pack-body></div>
      <button type="button" class="sr-btn sr-btn-primary" data-pack-done>Nice!</button>
    </div>`;
  root.appendChild(packModal);
  packModal.querySelector('[data-pack-done]').addEventListener('click', () => hide(packModal));

  // ── Upgrade store modal ─────────────────────────────────────────────────
  const storeModal = el('section', 'sr-overlay sr-storemodal');
  storeModal.innerHTML = `
    <div class="sr-card sr-store-card">
      <h2 class="sr-h2">Upgrade Store</h2>
      <p class="sr-store-sub">Spend shelter coins on run power-ups. Each has 5 levels.</p>
      <p class="sr-wallet sr-wallet-lg" data-store-wallet>🪙 <b data-store-coins>0</b> coins</p>
      <div class="sr-store-list" data-store-list></div>
      <button type="button" class="sr-btn sr-btn-primary" data-store-close>Done</button>
    </div>`;
  root.appendChild(storeModal);
  storeModal.querySelector('[data-store-close]').addEventListener('click', () => hide(storeModal));

  // ── Objectives modal ─────────────────────────────────────────────────────
  const objModal = el('section', 'sr-overlay sr-objmodal');
  objModal.innerHTML = `
    <div class="sr-card sr-obj-card">
      <h2 class="sr-h2">Objectives</h2>
      <p class="sr-store-sub">Each completed objective raises your score multiplier.</p>
      <p class="sr-mult-line" data-obj-mult>Score multiplier: <b>×1</b></p>
      <ul class="sr-obj-list" data-obj-list></ul>
      <button type="button" class="sr-btn sr-btn-primary" data-obj-close>Done</button>
    </div>`;
  root.appendChild(objModal);
  objModal.querySelector('[data-obj-close]').addEventListener('click', () => hide(objModal));

  start.querySelector('[data-store]').addEventListener('click', () => { show(storeModal); if (onBuyUpgrade) onBuyUpgrade(null); });
  start.querySelector('[data-objectives]').addEventListener('click', () => show(objModal));

  // ── Toast lane ───────────────────────────────────────────────────────────
  const toasts = el('div', 'sr-toasts', '');
  root.appendChild(toasts);

  // Milestone tick list (distance markers during play)
  const tickBar = el('div', 'sr-ticks');
  tickBar.innerHTML = MILESTONES.map(m =>
    `<span class="sr-tick" data-tick="${m.key}" title="${m.label} — ${m.at}m">${m.at}m</span>`).join('');
  root.appendChild(tickBar);

  function show(node) { node.classList.add('is-open'); }
  function hide(node) { node.classList.remove('is-open'); }

  // Context-aware key hints.
  const hints = $('#sr-hints');
  const HINT_SETS = {
    menu:    '<span class="sr-chip"><kbd>←</kbd><kbd>→</kbd> lane</span><span class="sr-chip"><kbd>↑</kbd> jump</span><span class="sr-chip"><kbd>↓</kbd> slide</span><span class="sr-chip"><kbd>M</kbd> mute</span>',
    over:    '<span class="sr-chip"><kbd>R</kbd> run again</span><span class="sr-chip"><kbd>C</kbd> cat</span><span class="sr-chip"><kbd>M</kbd> mute</span>',
    playing: '',
  };
  function setPhase(phase) {
    if (!hints) return;
    hints.innerHTML = HINT_SETS[phase] || '';
    hints.classList.toggle('is-hidden', phase === 'playing');
    document.documentElement.classList.toggle('sr-playing', phase === 'playing');
  }

  function renderLeaders(leaders, score) {
    const ol = over.querySelector('[data-leader]');
    ol.innerHTML = '';
    if (leaders === null) {
      ol.appendChild(el('li', 'sr-loading', 'Loading…'));
      return;
    }
    if (!leaders.length) {
      ol.appendChild(el('li', 'sr-loading', 'No scores yet — be the first!'));
      return;
    }
    leaders.forEach(row => {
      const li = el('li', row.playerName === playerNameSafe() && row.score === score ? 'is-you' : '');
      li.appendChild(el('span', 'sr-rank', `#${row.rank}`));
      li.appendChild(el('span', 'sr-pname', escapeHtml(row.playerName || 'Player')));
      li.appendChild(el('span', 'sr-pscore', `${row.score}m`));
      ol.appendChild(li);
    });
  }

  function setPacks(count) {
    const packBtn = over.querySelector('[data-pack]');
    const line = over.querySelector('[data-packs-line]');
    const packs = count | 0;
    packBtn.hidden = packs <= 0;
    line.textContent = packs > 0 ? `You have ${packs} unopened pack${packs === 1 ? '' : 's'} in your Adoptédex.` : '';
  }

  // ── Upgrade store rendering ──────────────────────────────────────────────
  // progress = server GET shape { upgrades: {k:{level}}, coin_balance } —
  // coinBalance may be passed separately when we know it from the profile.
  function renderStore(progress, coinBalance, busyKey) {
    const list = storeModal.querySelector('[data-store-list]');
    const coinsEl = storeModal.querySelector('[data-store-coins]');
    const owned = (progress && progress.upgrades) || {};
    const coins = coinBalance | 0;
    coinsEl.textContent = coins;
    list.innerHTML = '';
    for (const [key, def] of Object.entries(UPGRADES)) {
      const lvl = Math.min(5, (owned[key] && owned[key].level) | 0);
      const maxed = lvl >= 5;
      const cost = maxed ? null : def.costs[lvl];
      const row = el('div', 'sr-upgrade' + (maxed ? ' is-maxed' : ''));
      row.innerHTML = `
        <span class="sr-up-icon">${def.icon}</span>
        <div class="sr-up-mid">
          <div class="sr-up-name">${escapeHtml(def.label)}</div>
          <div class="sr-up-pips">${[1,2,3,4,5].map(i => `<i class="${i <= lvl ? 'on' : ''}"></i>`).join('')}</div>
          <div class="sr-up-desc">${escapeHtml(def.desc)}</div>
        </div>
        <button type="button" class="sr-btn sr-btn-buy" data-buy="${key}"
          ${maxed || coins < cost || busyKey ? 'disabled' : ''}>
          ${maxed ? 'MAX' : `🪙 ${cost}`}
        </button>`;
      if (!maxed && onBuyUpgrade) {
        row.querySelector('[data-buy]').addEventListener('click', () => onBuyUpgrade(key));
      }
      list.appendChild(row);
    }
  }

  function renderObjectives(progress) {
    const list = objModal.querySelector('[data-obj-list]');
    const mult = objModal.querySelector('[data-obj-mult]');
    const done = new Set((progress && progress.objectives) || []);
    const m = (progress && progress.multiplier) || (1 + done.size);
    mult.innerHTML = `Score multiplier: <b>×${m}</b>`;
    list.innerHTML = '';
    for (const o of OBJECTIVES) {
      const claimed = done.has(o.key);
      const li = el('li', claimed ? 'is-done' : '');
      li.innerHTML = `<span class="sr-obj-check">${claimed ? '✓' : ''}</span><span>${escapeHtml(o.label)}</span><span class="sr-obj-plus">+1×</span>`;
      list.appendChild(li);
    }
  }

  function setWallet(coins) {
    const w = start.querySelector('[data-wallet]');
    if (coins === null || coins === undefined) { w.hidden = true; return; }
    w.hidden = false;
    w.innerHTML = `🪙 <b>${coins | 0}</b> coins`;
  }

  function toast(text, opts = {}) {
    const t = el('div', 'sr-toast' + (opts.rare ? ' is-rare' : ''), text);
    toasts.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, opts.ms || 3400);
  }

  return {
    updateLeaderboard(leaders, score) { renderLeaders(leaders, score); },
    setPacks,
    renderStore,
    renderObjectives,
    setWallet,
    openStore() { show(storeModal); },
    openObjectives() { show(objModal); },
    closeStore() { hide(storeModal); },
    showStart(best, catId) {
      selectCat(catId);
      start.querySelector('[data-best]').textContent = best > 0 ? `Personal best: ${best} m` : '';
      show(start); hide(over);
    },
    hideStart() { hide(start); },
    selectCat,

    showGameOver({ score, meters, best, isNewBest, leaders, unopenedPacks, rescued, caught }) {
      over.querySelector('[data-score]').textContent = score;
      over.querySelector('[data-best-run]').textContent = best;
      over.querySelector('[data-new-best]').hidden = !isNewBest;
      over.querySelector('.sr-meters').textContent =
        (caught ? 'score — the pack caught you! ' : 'score — ') + `${meters}m ran`;
      if (caught) over.querySelector('.sr-meters').classList.add('is-caught');
      else over.querySelector('.sr-meters').classList.remove('is-caught');

      const medal = MEDALS.find(m => meters >= m.min);
      const medalImg = over.querySelector('[data-medal]');
      if (medal) { medalImg.src = `assets/${medal.img}`; medalImg.alt = `${medal.label} medal`; medalImg.hidden = false; }
      else medalImg.hidden = true;

      // Rescued pet chips — linked to their adoption pages when we have a URL.
      const rw = over.querySelector('[data-rescued]');
      const row = over.querySelector('[data-rescued-row]');
      row.innerHTML = '';
      if (rescued && rescued.length) {
        rw.hidden = false;
        rescued.slice(0, 8).forEach(pet => {
          const chip = el(pet.url ? 'a' : 'div', 'sr-rescued-chip');
          if (pet.url) {
            chip.href = pet.url;
            chip.target = '_blank';
            chip.rel = 'noopener';
            chip.title = `Adopt ${pet.name}`;
          }
          if (pet.photo) {
            const img = el('img', '');
            img.src = pet.photo; img.alt = pet.name; img.loading = 'lazy';
            chip.appendChild(img);
          }
          chip.appendChild(el('span', '', escapeHtml(pet.name || 'Friend')));
          row.appendChild(chip);
        });
        if (rescued.length > 8) row.appendChild(el('span', 'sr-rescued-more', `+${rescued.length - 8}`));
        // Deep link to the Binder carrying the player's identity + api.
        const link = over.querySelector('[data-binder-link]');
        if (typeof MonroeAdoptedex !== 'undefined' && MonroeAdoptedex.getParams) {
          const p = MonroeAdoptedex.getParams();
          const qs = new URLSearchParams();
          if (p.dexUser) qs.set('user', p.dexUser);
          if (p.dexApi) qs.set('dex_api', p.dexApi);
          link.href = `/games/dex/album.html?${qs}`;
          link.hidden = false;
        } else {
          link.href = '/games/dex/album.html';
          link.hidden = false;
        }
      } else {
        rw.hidden = true;
        over.querySelector('[data-binder-link]').hidden = true;
      }

      renderLeaders(leaders, meters);

      setPacks(unopenedPacks);
      hide(start); show(over);
    },
    hideGameOver() { hide(over); },

    showPackResult(result) {
      const body = packModal.querySelector('[data-pack-body]');
      packModal.querySelector('[data-pack-title]').textContent = result.pack_rarity_label || 'Booster Pack';
      body.innerHTML = '';
      (result.cards || []).forEach(card => {
        if (typeof MonroeAdoptedex !== 'undefined' && MonroeAdoptedex.createFlipCard) {
          try {
            const pet = {
              id: String(card.id || ''), name: card.name || 'Shelter friend',
              file: card.file || card.photo || '', type: card.type || 'Companion',
              breed: card.breed || '', age: card.age || '', gender: card.gender || '',
              url: card.url || '', archived: !!card.archived, alt: card.alt || card.name || 'Shelter pet',
            };
            body.appendChild(MonroeAdoptedex.createFlipCard(pet, { reveal: true }));
            return;
          } catch (e) { /* fall through to simple card */ }
        }
        const c = el('div', 'sr-petcard');
        c.innerHTML = `${card.file ? `<img src="${escapeAttr(card.file)}" alt="">` : ''}
          <b>${escapeHtml(card.name || 'Shelter friend')}</b>
          <span>${escapeHtml(card.breed || card.type || '')}</span>`;
        body.appendChild(c);
      });
      if (result.coins_awarded) {
        body.appendChild(el('p', 'sr-coin-note', `+${result.coins_awarded} bonus coins`));
      }
      show(packModal);
    },
    hidePackModal() { hide(packModal); },

    toast,
    setPhase,
    markMilestone(key) {
      const t = tickBar.querySelector(`[data-tick="${key}"]`);
      if (t) t.classList.add('hit');
    },
    resetTicks() { tickBar.querySelectorAll('.sr-tick').forEach(t => t.classList.remove('hit')); },
    setTicksVisible(v) { tickBar.classList.toggle('is-live', v); },
  };
}

function playerNameSafe() {
  try { return localStorage.getItem('monroeDexDisplay') || localStorage.getItem('monroeDexUser') || 'Player'; }
  catch (e) { return 'Player'; }
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }
