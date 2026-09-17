// DOM chrome: start screen, game-over panel (medal/score/leaderboard), pack-open
// modal, milestone toasts, companion picker. Canvas stays gameplay-only.
import { MEDALS, CATS, MILESTONES } from './config.js';

const $ = sel => document.querySelector(sel);

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function createUI({ onStart, onRetry, onOpenPack, onPickCat, onShare }) {
  const root = $('#ui-root');

  // ── Start screen ─────────────────────────────────────────────────────────
  const start = el('section', 'fc2-overlay fc2-start');
  start.innerHTML = `
    <div class="fc2-card">
      <p class="fc2-eyebrow">Humane Arcade</p>
      <h1 class="fc2-title">FLAPPY CAT</h1>
      <p class="fc2-sub">Tap, click, or press <kbd>Space</kbd> to flap.<br>Clear the rocks — every score milestone earns pack rewards.</p>
      <div class="fc2-cats" role="radiogroup" aria-label="Choose your cat"></div>
      <button type="button" class="fc2-btn fc2-btn-primary" data-start>Tap to Play</button>
      <p class="fc2-best" data-best></p>
    </div>`;
  root.appendChild(start);

  const catsWrap = start.querySelector('.fc2-cats');
  const catButtons = CATS.map(cat => {
    const b = el('button', 'fc2-cat-pick');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.cat = cat.id;
    // Render frame 0 of the run cycle into a thumbnail canvas — drawing the
    // raw <img> at CSS size crops the 960px sheet and chops the sprite.
    const cv = document.createElement('canvas');
    cv.width = 160; cv.height = 140;
    cv.className = 'fc2-cat-thumb';
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', cat.name);
    const im = new Image();
    im.onload = () => {
      cv.getContext('2d').drawImage(im, 0, 0, cat.fw, cat.fh, 0, 0, 160, 140);
    };
    im.src = `assets/${cat.sheet}`;
    b.appendChild(cv);
    b.appendChild(el('span', 'fc2-cat-name', cat.name));
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
  const over = el('section', 'fc2-overlay fc2-over');
  over.innerHTML = `
    <div class="fc2-card">
      <img class="fc2-banner" src="assets/ui/textGameOver.png" alt="Game over">
      <div class="fc2-score-row">
        <img class="fc2-medal" data-medal alt="" hidden>
        <div class="fc2-score-nums">
          <div class="fc2-score-big" data-score>0</div>
          <div class="fc2-best-line">Best <b data-best-run>0</b><span data-new-best class="fc2-newbest" hidden> · New best!</span></div>
        </div>
      </div>
      <div class="fc2-board">
        <h2 class="fc2-h2">Leaderboard</h2>
        <ol class="fc2-leader" data-leader><li class="fc2-loading">Loading…</li></ol>
      </div>
      <div class="fc2-actions">
        <button type="button" class="fc2-btn fc2-btn-primary" data-retry>Fly Again</button>
        <button type="button" class="fc2-btn fc2-btn-pack" data-pack hidden>🐾 Open Pack</button>
      </div>
      <p class="fc2-packs-line" data-packs-line></p>
    </div>`;
  root.appendChild(over);
  over.querySelector('[data-retry]').addEventListener('click', onRetry);
  over.querySelector('[data-pack]').addEventListener('click', () => onOpenPack());

  // ── Pack opening modal ───────────────────────────────────────────────────
  const packModal = el('section', 'fc2-overlay fc2-packmodal');
  packModal.innerHTML = `
    <div class="fc2-card fc2-pack-card">
      <h2 class="fc2-h2" data-pack-title>Booster Pack</h2>
      <div class="fc2-pack-body" data-pack-body></div>
      <button type="button" class="fc2-btn fc2-btn-primary" data-pack-done>Nice!</button>
    </div>`;
  root.appendChild(packModal);
  packModal.querySelector('[data-pack-done]').addEventListener('click', () => hide(packModal));

  // ── Toast lane ───────────────────────────────────────────────────────────
  const toasts = el('div', 'fc2-toasts', '');
  root.appendChild(toasts);

  // Milestone tick list (subtle progress hint during play)
  const tickBar = el('div', 'fc2-ticks');
  tickBar.innerHTML = MILESTONES.map(m =>
    `<span class="fc2-tick" data-tick="${m.key}" title="${m.label} — score ${m.at}">${m.at}</span>`).join('');
  root.appendChild(tickBar);

  function show(node) { node.classList.add('is-open'); }
  function hide(node) { node.classList.remove('is-open'); }

  // Context-aware key hints — only show what works right now.
  const hints = $('#fc-hints');
  const HINT_SETS = {
    menu:    '<span class="fc2-chip"><kbd>Space</kbd> flap</span><span class="fc2-chip"><kbd>M</kbd> mute</span><span class="fc2-chip"><kbd>C</kbd> cat</span><span class="fc2-chip"><kbd>P</kbd> pause</span>',
    over:    '<span class="fc2-chip"><kbd>Space</kbd> / <kbd>R</kbd> fly again</span><span class="fc2-chip"><kbd>C</kbd> cat</span><span class="fc2-chip"><kbd>M</kbd> mute</span>',
    playing: '',
  };
  function setPhase(phase) {
    if (!hints) return;
    hints.innerHTML = HINT_SETS[phase] || '';
    hints.classList.toggle('is-hidden', phase === 'playing');
    document.documentElement.classList.toggle('fc2-playing', phase === 'playing');
  }

  function toast(text, opts = {}) {
    const t = el('div', 'fc2-toast' + (opts.rare ? ' is-rare' : ''), text);
    toasts.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, opts.ms || 3400);
  }

  return {
    showStart(best, catId) {
      selectCat(catId);
      start.querySelector('[data-best]').textContent = best > 0 ? `Personal best: ${best}` : '';
      show(start); hide(over);
    },
    hideStart() { hide(start); },
    selectCat,

    showGameOver({ score, best, isNewBest, leaders, unopenedPacks }) {
      over.querySelector('[data-score]').textContent = score;
      over.querySelector('[data-best-run]').textContent = best;
      over.querySelector('[data-new-best]').hidden = !isNewBest;

      const medal = MEDALS.find(m => score >= m.min);
      const medalImg = over.querySelector('[data-medal]');
      if (medal) { medalImg.src = `assets/${medal.img}`; medalImg.alt = `${medal.label} medal`; medalImg.hidden = false; }
      else medalImg.hidden = true;

      const ol = over.querySelector('[data-leader]');
      ol.innerHTML = '';
      if (!leaders || !leaders.length) {
        ol.appendChild(el('li', 'fc2-loading', 'No scores yet — be the first!'));
      } else {
        leaders.forEach(row => {
          const li = el('li', row.playerName === playerNameSafe() && row.score === score ? 'is-you' : '');
          li.appendChild(el('span', 'fc2-rank', `#${row.rank}`));
          li.appendChild(el('span', 'fc2-pname', escapeHtml(row.playerName || 'Player')));
          li.appendChild(el('span', 'fc2-pscore', String(row.score)));
          ol.appendChild(li);
        });
      }

      const packBtn = over.querySelector('[data-pack]');
      const line = over.querySelector('[data-packs-line]');
      const packs = unopenedPacks | 0;
      packBtn.hidden = packs <= 0;
      line.textContent = packs > 0 ? `You have ${packs} unopened pack${packs === 1 ? '' : 's'} in your Adoptédex.` : '';
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
        const c = el('div', 'fc2-petcard');
        c.innerHTML = `${card.file ? `<img src="${escapeAttr(card.file)}" alt="">` : ''}
          <b>${escapeHtml(card.name || 'Shelter friend')}</b>
          <span>${escapeHtml(card.breed || card.type || '')}</span>`;
        body.appendChild(c);
      });
      if (result.coins_awarded) {
        body.appendChild(el('p', 'fc2-coin-note', `+${result.coins_awarded} bonus coins`));
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
    resetTicks() { tickBar.querySelectorAll('.fc2-tick').forEach(t => t.classList.remove('hit')); },
    setTicksVisible(v) { tickBar.classList.toggle('is-live', v); },
  };
}

function playerNameSafe() {
  try { return localStorage.getItem('monroeDexDisplay') || localStorage.getItem('monroeDexUser') || 'Player'; }
  catch (e) { return 'Player'; }
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }
