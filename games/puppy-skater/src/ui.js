// DOM chrome: start screen, game-over panel (medal/distance/leaderboard/
// rescued pets), pack-open modal, milestone toasts, pup picker.
// Canvas stays gameplay-only.
import { MEDALS, DOGS, MILESTONES } from './config.js';

const $ = sel => document.querySelector(sel);

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function createUI({ onStart, onRetry, onOpenPack, onPickDog }) {
  const root = $('#ui-root');

  // ── Start screen ─────────────────────────────────────────────────────────
  const start = el('section', 'ps-overlay ps-start');
  start.innerHTML = `
    <div class="ps-card">
      <p class="ps-eyebrow">Humane Arcade</p>
      <h1 class="ps-title">PUPPY SKATER</h1>
      <p class="ps-sub"><kbd>↑</kbd> ollie over blocks &amp; low fish · <kbd>↓</kbd> duck under walls, high fish &amp; whales.<br>Pick up lost pets on the way — every 20 rescues in one run earns a pack.</p>
      <div class="ps-dogs" role="radiogroup" aria-label="Choose your pup"></div>
      <button type="button" class="ps-btn ps-btn-primary" data-start>Start Skating</button>
      <p class="ps-best" data-best></p>
    </div>`;
  root.appendChild(start);

  const dogsWrap = start.querySelector('.ps-dogs');
  const dogButtons = DOGS.map(dog => {
    const b = el('button', 'ps-dog-pick');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.dog = dog.id;
    const cv = document.createElement('canvas');
    cv.width = dog.fw; cv.height = dog.fh;
    cv.className = 'ps-dog-thumb';
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', dog.name);
    const im = new Image();
    im.onload = () => { cv.getContext('2d').drawImage(im, 0, 0, dog.fw, dog.fh, 0, 0, dog.fw, dog.fh); };
    im.src = `assets/${dog.sheet}`;
    b.appendChild(cv);
    b.appendChild(el('span', 'ps-dog-name', dog.name));
    b.addEventListener('click', () => { selectDog(dog.id); onPickDog(dog.id); });
    dogsWrap.appendChild(b);
    return b;
  });
  function selectDog(id) {
    dogButtons.forEach(b => {
      const on = b.dataset.dog === id;
      b.classList.toggle('is-picked', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  start.querySelector('[data-start]').addEventListener('click', onStart);

  // ── Game over ────────────────────────────────────────────────────────────
  const over = el('section', 'ps-overlay ps-over');
  over.innerHTML = `
    <div class="ps-card">
      <img class="ps-banner" src="assets/ui/textGameOver.png" alt="Game over">
      <div class="ps-score-row">
        <img class="ps-medal" data-medal alt="" hidden>
        <div class="ps-score-nums">
          <div class="ps-score-big" data-score>0</div>
          <div class="ps-meters">meters</div>
          <div class="ps-best-line">Best <b data-best-run>0</b><span data-new-best class="ps-newbest" hidden> · New best!</span></div>
        </div>
      </div>
      <div class="ps-rescued" data-rescued hidden>
        <h2 class="ps-h2">Rescued this run</h2>
        <div class="ps-rescued-row" data-rescued-row></div>
        <p class="ps-rescued-earn" data-earned hidden></p>
        <a class="ps-binder-link" data-binder-link target="_top" hidden>View in your Binder →</a>
      </div>
      <div class="ps-board">
        <h2 class="ps-h2">Leaderboard</h2>
        <ol class="ps-leader" data-leader><li class="ps-loading">Loading…</li></ol>
      </div>
      <div class="ps-actions">
        <button type="button" class="ps-btn ps-btn-primary" data-retry>Skate Again</button>
        <button type="button" class="ps-btn ps-btn-pack" data-pack hidden>🐾 Open Pack</button>
      </div>
      <p class="ps-packs-line" data-packs-line></p>
    </div>`;
  root.appendChild(over);
  over.querySelector('[data-retry]').addEventListener('click', onRetry);
  over.querySelector('[data-pack]').addEventListener('click', () => onOpenPack());

  // ── Pack opening modal ───────────────────────────────────────────────────
  const packModal = el('section', 'ps-overlay ps-packmodal');
  packModal.innerHTML = `
    <div class="ps-card ps-pack-card">
      <h2 class="ps-h2" data-pack-title>Booster Pack</h2>
      <div class="ps-pack-body" data-pack-body></div>
      <button type="button" class="ps-btn ps-btn-primary" data-pack-done>Nice!</button>
    </div>`;
  root.appendChild(packModal);
  packModal.querySelector('[data-pack-done]').addEventListener('click', () => hide(packModal));

  // ── Toast lane ───────────────────────────────────────────────────────────
  const toasts = el('div', 'ps-toasts', '');
  root.appendChild(toasts);

  // Milestone tick list (distance markers during play)
  const tickBar = el('div', 'ps-ticks');
  tickBar.innerHTML = MILESTONES.map(m =>
    `<span class="ps-tick" data-tick="${m.key}" title="${m.label} — ${m.at}m">${m.at}m</span>`).join('');
  root.appendChild(tickBar);

  function show(node) { node.classList.add('is-open'); }
  function hide(node) { node.classList.remove('is-open'); }

  // Context-aware key hints.
  const hints = $('#ps-hints');
  const HINT_SETS = {
    menu:    '<span class="ps-chip"><kbd>↑</kbd> ollie</span><span class="ps-chip"><kbd>↓</kbd> duck</span><span class="ps-chip"><kbd>M</kbd> mute</span>',
    over:    '<span class="ps-chip"><kbd>R</kbd> skate again</span><span class="ps-chip"><kbd>C</kbd> pup</span><span class="ps-chip"><kbd>M</kbd> mute</span>',
    playing: '',
  };
  function setPhase(phase) {
    if (!hints) return;
    hints.innerHTML = HINT_SETS[phase] || '';
    hints.classList.toggle('is-hidden', phase === 'playing');
    document.documentElement.classList.toggle('ps-playing', phase === 'playing');
  }

  function renderLeaders(leaders, score) {
    const ol = over.querySelector('[data-leader]');
    ol.innerHTML = '';
    if (leaders === null) {
      ol.appendChild(el('li', 'ps-loading', 'Loading…'));
      return;
    }
    if (!leaders.length) {
      ol.appendChild(el('li', 'ps-loading', 'No scores yet — be the first!'));
      return;
    }
    leaders.forEach(row => {
      const li = el('li', row.playerName === playerNameSafe() && row.score === score ? 'is-you' : '');
      li.appendChild(el('span', 'ps-rank', `#${row.rank}`));
      li.appendChild(el('span', 'ps-pname', escapeHtml(row.playerName || 'Player')));
      li.appendChild(el('span', 'ps-pscore', `${row.score}m`));
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

  function toast(text, opts = {}) {
    const t = el('div', 'ps-toast' + (opts.rare ? ' is-rare' : ''), text);
    toasts.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, opts.ms || 3400);
  }

  return {
    updateLeaderboard(leaders, score) { renderLeaders(leaders, score); },
    setPacks,
    showStart(best, dogId) {
      selectDog(dogId);
      start.querySelector('[data-best]').textContent = best > 0 ? `Personal best: ${best} m` : '';
      show(start); hide(over);
    },
    hideStart() { hide(start); },
    selectDog,

    showGameOver({ score, best, isNewBest, leaders, unopenedPacks, rescued, packsEarned }) {
      over.querySelector('[data-score]').textContent = score;
      over.querySelector('[data-best-run]').textContent = best;
      over.querySelector('[data-new-best]').hidden = !isNewBest;

      const medal = MEDALS.find(m => score >= m.min);
      const medalImg = over.querySelector('[data-medal]');
      if (medal) { medalImg.src = `assets/${medal.img}`; medalImg.alt = `${medal.label} medal`; medalImg.hidden = false; }
      else medalImg.hidden = true;

      // Rescued pet chips
      const rw = over.querySelector('[data-rescued]');
      const row = over.querySelector('[data-rescued-row]');
      row.innerHTML = '';
      if (rescued && rescued.length) {
        rw.hidden = false;
        rescued.slice(0, 8).forEach(pet => {
          const chip = el('a', 'ps-rescued-chip');
          chip.href = pet.link || 'https://www.monroe-humane.org/adopt/';
          chip.target = '_blank'; chip.rel = 'noopener';
          chip.title = `Meet ${pet.name || 'this pet'} →`;
          if (pet.photo) {
            const img = el('img', '');
            img.src = pet.photo; img.alt = pet.name; img.loading = 'lazy';
            chip.appendChild(img);
          }
          chip.appendChild(el('span', '', escapeHtml(pet.name || 'Friend')));
          row.appendChild(chip);
        });
        if (rescued.length > 8) row.appendChild(el('span', 'ps-rescued-more', `+${rescued.length - 8}`));
        // Pack progress line — 1 pack per 20 rescues, this run only
        const earn = over.querySelector('[data-earned]');
        const packs = packsEarned | 0;
        const left = rescued.length % 20;
        earn.hidden = false;
        earn.textContent = packs > 0
          ? `🎁 ${packs} pack${packs > 1 ? 's' : ''} earned!${left ? ` ${20 - left} more rescues next run for another.` : ''}`
          : `${20 - left} more rescues in a single run earns a pack.`;
        earn.classList.toggle('is-earned', packs > 0);
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

      renderLeaders(leaders, score);

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
        const c = el('div', 'ps-petcard');
        c.innerHTML = `${card.file ? `<img src="${escapeAttr(card.file)}" alt="">` : ''}
          <b>${escapeHtml(card.name || 'Shelter friend')}</b>
          <span>${escapeHtml(card.breed || card.type || '')}</span>`;
        body.appendChild(c);
      });
      if (result.coins_awarded) {
        body.appendChild(el('p', 'ps-coin-note', `+${result.coins_awarded} bonus coins`));
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
    resetTicks() { tickBar.querySelectorAll('.ps-tick').forEach(t => t.classList.remove('hit')); },
    setTicksVisible(v) { tickBar.classList.toggle('is-live', v); },
  };
}

function playerNameSafe() {
  try { return localStorage.getItem('monroeDexDisplay') || localStorage.getItem('monroeDexUser') || 'Player'; }
  catch (e) { return 'Player'; }
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }
