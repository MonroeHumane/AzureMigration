// Pet Snake Adventure — DOM UI System
// Clean overlays for Title, HUD, Upgrade Draft, Route Selection, and Field Journal.

import { STARTING_MODIFIERS, MASCOTS, CONTINUE_COST, ROUTE_SKIP_COINS } from './config.js';

export class UIManager {
  constructor(rootEl, callbacks = {}) {
    this.root = rootEl;
    this.cb = callbacks;

    this.selectedModifier = 'normal';
    this.selectedMascot = 'cat';
    this.selectedUpgradeId = null;

    this.hudEl = null;
    this.overlayEl = null;
  }

  // ── Title Screen ──────────────────────────────────────────────────────────
  showTitleScreen({ bestScore = 0, bestFloor = 0, coins = 0 } = {}) {
    this.root.innerHTML = `
      <div class="ps-modal-backdrop">
        <div class="ps-title-card">
          <div class="ps-title-header">
            <span class="ps-badge">🐾 Monroe Humane Arcade</span>
            <h1 class="ps-main-title">Pet Snake Adventure</h1>
            <p class="ps-subtitle">A 15-floor roguelike trial through Monroe County trails & shelters.</p>
          </div>

          <div class="ps-stats-bar">
            <div class="ps-stat"><span class="ps-stat-lbl">Best Score</span><strong class="ps-stat-val">${bestScore}</strong></div>
            <div class="ps-stat"><span class="ps-stat-lbl">Deepest Floor</span><strong class="ps-stat-val">Floor ${bestFloor || 1}</strong></div>
            <div class="ps-stat"><span class="ps-stat-lbl">Shelter Coins</span><strong class="ps-stat-val">🪙 ${coins}</strong></div>
          </div>

          <div class="ps-setup-section">
            <label class="ps-setup-label">Choose Your Companion</label>
            <div class="ps-mascot-picker" role="radiogroup">
              ${MASCOTS.map(m => `
                <button type="button" class="ps-mascot-btn ${m.id === this.selectedMascot ? 'is-active' : ''}" data-mascot="${m.id}">
                  <span class="ps-mascot-icon">${m.head}</span>
                  <span class="ps-mascot-name">${m.name}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="ps-setup-section">
            <label class="ps-setup-label">Select Starting Archetype</label>
            <div class="ps-modifier-list">
              ${STARTING_MODIFIERS.map(mod => `
                <button type="button" class="ps-mod-btn ${mod.key === this.selectedModifier ? 'is-active' : ''}" data-mod="${mod.key}">
                  <div class="ps-mod-top">
                    <strong>${mod.name}</strong>
                    <span class="ps-mod-pill">${mod.pill}</span>
                  </div>
                  <p class="ps-mod-desc">${mod.desc}</p>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="ps-title-actions">
            <button type="button" class="hg-btn hg-btn--primary ps-btn-start" id="btn-start-run">
              Start Adventure ▶
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind mascot picker
    this.root.querySelectorAll('.ps-mascot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedMascot = btn.dataset.mascot;
        this.root.querySelectorAll('.ps-mascot-btn').forEach(b => b.classList.toggle('is-active', b === btn));
      });
    });

    // Bind modifier picker
    this.root.querySelectorAll('.ps-mod-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedModifier = btn.dataset.mod;
        this.root.querySelectorAll('.ps-mod-btn').forEach(b => b.classList.toggle('is-active', b === btn));
      });
    });

    // Bind start button
    const startBtn = this.root.querySelector('#btn-start-run');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.cb.onStart?.(this.selectedModifier, this.selectedMascot);
      });
    }
  }

  // ── In-Game HUD ───────────────────────────────────────────────────────────
  setupHUD() {
    this.root.innerHTML = `
      <div class="ps-hud" id="ps-hud">
        <div class="ps-hud-left">
          <div class="hg-chip ps-chip-floor"><span id="hud-floor">Floor 1 / 15</span></div>
          <div class="hg-chip ps-chip-hearts" id="hud-hearts">♥♥♥</div>
          <div class="hg-chip ps-chip-score"><span class="hg-chip__label">Score</span> <strong id="hud-score">0</strong></div>
        </div>

        <div class="ps-hud-center">
          <div class="ps-goal-card">
            <span class="ps-goal-text" id="hud-goal-text">Collecting Snacks...</span>
            <div class="ps-goal-bar-wrap">
              <div class="ps-goal-bar" id="hud-goal-bar" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <div class="ps-hud-right">
          <div class="hg-chip ps-chip-coins">🪙 <strong id="hud-coins">0</strong></div>
          <button type="button" class="hg-btn hg-btn--secondary ps-pause-btn" id="btn-pause" aria-label="Pause">⏸</button>
        </div>
      </div>
      <div id="ps-overlay-slot"></div>
    `;

    this.root.querySelector('#btn-pause')?.addEventListener('click', () => {
      this.cb.onTogglePause?.();
    });
  }

  updateHUD(snapshot, coins = 0) {
    const floorEl = this.root.querySelector('#hud-floor');
    const heartsEl = this.root.querySelector('#hud-hearts');
    const scoreEl = this.root.querySelector('#hud-score');
    const goalTextEl = this.root.querySelector('#hud-goal-text');
    const goalBarEl = this.root.querySelector('#hud-goal-bar');
    const coinsEl = this.root.querySelector('#hud-coins');

    if (floorEl) floorEl.textContent = `Floor ${snapshot.floor} / ${snapshot.totalFloors}`;

    if (heartsEl) {
      const full = '♥'.repeat(Math.max(0, snapshot.hearts));
      const empty = '♡'.repeat(Math.max(0, snapshot.maxHearts - snapshot.hearts));
      heartsEl.textContent = full + empty;
    }

    if (scoreEl) scoreEl.textContent = String(snapshot.score);
    if (coinsEl) coinsEl.textContent = String(coins);

    if (goalTextEl && snapshot.goal) {
      if (snapshot.goal.type === 'forage') {
        const current = Math.min(snapshot.goal.target, Math.round((snapshot.goalProgress || 0) * snapshot.goal.target));
        goalTextEl.textContent = `Snacks: ${current} / ${snapshot.goal.target}`;
      } else if (snapshot.goal.type === 'rescue') {
        const current = Math.min(snapshot.goal.target, Math.round((snapshot.goalProgress || 0) * snapshot.goal.target));
        goalTextEl.textContent = `Rescue Pals: ${current} / ${snapshot.goal.target}`;
      } else if (snapshot.goal.type === 'survive') {
        const remaining = Math.max(0, Math.ceil((1.0 - (snapshot.goalProgress || 0)) * (snapshot.goal.targetMs / 1000)));
        goalTextEl.textContent = `Survive: ${remaining}s`;
      } else if (snapshot.goal.type === 'vacuumHunt') {
        const remaining = Math.max(0, Math.ceil((1.0 - (snapshot.goalProgress || 0)) * (snapshot.goal.targetMs / 1000)));
        goalTextEl.textContent = `Vacuum Hunt: ${remaining}s`;
      } else if (snapshot.goal.type === 'boss') {
        const phaseName = snapshot.bossPhase === 2 ? 'Phase 3: Overdrive' : (snapshot.bossPhase === 1 ? 'Phase 2: Dust Storm' : 'Phase 1: Sweep');
        goalTextEl.textContent = `BOSS: ${phaseName}`;
      }
    }

    if (goalBarEl) {
      const pct = Math.min(100, Math.max(0, (snapshot.goalProgress || 0) * 100));
      goalBarEl.style.width = `${pct}%`;
    }
  }

  // ── Upgrade Drafting & Route Modal ────────────────────────────────────────
  showDraftModal(upgrades = [], routes = [], onConfirm) {
    const slot = this.root.querySelector('#ps-overlay-slot');
    if (!slot) return;

    this.selectedUpgradeId = upgrades[0]?.id || null;
    let selectedRouteIndex = 0;

    slot.innerHTML = `
      <div class="ps-modal-backdrop">
        <div class="ps-draft-card">
          <div class="ps-draft-header">
            <span class="ps-badge">Floor Cleared!</span>
            <h2>Draft an Upgrade & Pick Route</h2>
            <p>Empower your snake with equipment or tactical perks before entering the next room.</p>
          </div>

          <div class="ps-draft-section">
            <h3 class="ps-section-subhead">1. Choose One Equipment Card</h3>
            <div class="ps-card-grid">
              ${upgrades.map(u => `
                <button type="button" class="ps-upgrade-card ${u.id === this.selectedUpgradeId ? 'is-selected' : ''}" data-upgrade="${u.id}">
                  <span class="ps-card-icon">${u.icon}</span>
                  <strong class="ps-card-name">${u.name}</strong>
                  <span class="ps-card-cat">${u.category}</span>
                  <p class="ps-card-desc">${u.desc}</p>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="ps-draft-section">
            <h3 class="ps-section-subhead">2. Select Next Destination</h3>
            <div class="ps-route-grid">
              ${routes.map((r, idx) => `
                <button type="button" class="ps-route-card ${idx === selectedRouteIndex ? 'is-selected' : ''}" data-route="${idx}">
                  <strong>${r.title}</strong>
                  <span class="ps-route-goal">${r.goalDesc}</span>
                  <span class="ps-route-affix">${r.affixDesc}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="ps-draft-footer">
            <button type="button" class="hg-btn hg-btn--secondary" id="btn-route-skip">
              Skip Route (+${ROUTE_SKIP_COINS} Coins) 🪙
            </button>
            <button type="button" class="hg-btn hg-btn--primary" id="btn-draft-continue">
              Proceed to Next Floor ▶
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind upgrade cards
    slot.querySelectorAll('.ps-upgrade-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedUpgradeId = card.dataset.upgrade;
        slot.querySelectorAll('.ps-upgrade-card').forEach(c => c.classList.toggle('is-selected', c === card));
      });
    });

    // Bind route cards
    slot.querySelectorAll('.ps-route-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedRouteIndex = Number(card.dataset.route);
        slot.querySelectorAll('.ps-route-card').forEach(c => c.classList.toggle('is-selected', c === card));
      });
    });

    // Skip Route
    slot.querySelector('#btn-route-skip')?.addEventListener('click', () => {
      slot.innerHTML = '';
      this.cb.onSkipRoute?.(this.selectedUpgradeId);
    });

    // Confirm
    slot.querySelector('#btn-draft-continue')?.addEventListener('click', () => {
      slot.innerHTML = '';
      onConfirm?.(this.selectedUpgradeId, selectedRouteIndex);
    });
  }

  // ── Field Journal (Run End) ───────────────────────────────────────────────
  showFieldJournal(runSummary) {
    const slot = this.root.querySelector('#ps-overlay-slot') || this.root;
    const { victory, reason, floor, score, coinsEarned, rescuedPets = [], upgrades = [] } = runSummary;

    const stamp = victory ? 'VERIFIED' : (reason === 'vacuum' ? 'VACUUMED' : (reason === 'bomb' ? 'BLASTED' : 'BONKED'));
    const stampClass = victory ? 'is-verified' : 'is-failed';

    slot.innerHTML = `
      <div class="ps-modal-backdrop">
        <div class="ps-journal-card">
          <div class="ps-journal-top">
            <div class="ps-journal-title-box">
              <span class="ps-journal-eyebrow">MONROE COUNTY HUMANE SOCIETY · FIELD OBSERVATION LOG</span>
              <h2>${victory ? 'Expedition Complete!' : 'Expedition Terminated'}</h2>
            </div>
            <div class="ps-stamp ${stampClass}">${stamp}</div>
          </div>

          <div class="ps-journal-body">
            <div class="ps-journal-row">
              <div class="ps-journal-stat"><span class="ps-j-lbl">Floors Explored</span><strong>${floor} / 15</strong></div>
              <div class="ps-journal-stat"><span class="ps-j-lbl">Run Score</span><strong>${score}</strong></div>
              <div class="ps-journal-stat"><span class="ps-j-lbl">Coins Collected</span><strong>🪙 ${coinsEarned}</strong></div>
            </div>

            ${rescuedPets.length > 0 ? `
              <div class="ps-journal-rescues">
                <h3>Rescued Shelter Companions (${rescuedPets.length})</h3>
                <div class="ps-rescue-list">
                  ${rescuedPets.map(p => `
                    <div class="ps-rescue-badge">
                      <span>🐾</span>
                      <strong>${p.name}</strong>
                      <small>${p.breed || p.type}</small>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div class="ps-journal-kit">
              <h3>Equipment Carried</h3>
              <div class="ps-kit-list">
                ${upgrades.length > 0 ? upgrades.map(u => `
                  <span class="ps-kit-tag">${u.icon} ${u.name}</span>
                `).join('') : '<span class="ps-kit-empty">No equipment gathered.</span>'}
              </div>
            </div>
          </div>

          <div class="ps-journal-actions">
            <button type="button" class="hg-btn hg-btn--secondary" id="btn-journal-restart">
              Return to Camp ⛺
            </button>
            <button type="button" class="hg-btn hg-btn--primary" id="btn-journal-continue" ${coinsEarned < CONTINUE_COST ? 'disabled' : ''}>
              Continue with Coins (${CONTINUE_COST} 🪙)
            </button>
          </div>
        </div>
      </div>
    `;

    slot.querySelector('#btn-journal-restart')?.addEventListener('click', () => {
      this.cb.onReturnToTitle?.();
    });

    slot.querySelector('#btn-journal-continue')?.addEventListener('click', () => {
      this.cb.onContinueWithCoins?.();
    });
  }

  showPauseOverlay() {
    const slot = this.root.querySelector('#ps-overlay-slot');
    if (!slot) return;

    slot.innerHTML = `
      <div class="ps-modal-backdrop">
        <div class="ps-pause-modal">
          <h2>Game Paused</h2>
          <p>Take a breath, stretch your paws.</p>
          <div class="ps-pause-actions">
            <button type="button" class="hg-btn hg-btn--primary" id="btn-resume-run">Resume Run ▶</button>
            <button type="button" class="hg-btn hg-btn--secondary" id="btn-abort-run">Abort to Title</button>
          </div>
        </div>
      </div>
    `;

    slot.querySelector('#btn-resume-run')?.addEventListener('click', () => {
      slot.innerHTML = '';
      this.cb.onTogglePause?.();
    });

    slot.querySelector('#btn-abort-run')?.addEventListener('click', () => {
      slot.innerHTML = '';
      this.cb.onAbort?.();
    });
  }

  hidePauseOverlay() {
    const slot = this.root.querySelector('#ps-overlay-slot');
    if (slot) slot.innerHTML = '';
  }
}
