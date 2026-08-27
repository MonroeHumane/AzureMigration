// ═══════════════════════════════════════════════════════════════
//  SHELTER TYCOON - Build Sidebar (habitat catalog + pet intake)
// ═══════════════════════════════════════════════════════════════

import { OFFICE_TYPES, COMMON_ROOMS, AGENT_ROLES, AGENT_SALARY, OFFICE_GUIDE, ROOM_COSTS, SENIORITY_LEVELS, seniorityStars, getIQLabel, getRoleForPet, getHabitatForSpecies, INTAKE_COST } from '../config.js';
import { getOfficeCategoriesForCompany } from '../economy.js';
import { G } from '../game.js';
import { setSelectedRoomType, setCorridorMode, isCorridorMode } from '../build-mode.js';
import { countRoomsByType, addCorridor, addCorridorLine } from '../map.js';
import { getRoomUnlockState, isOfficeAvailable } from '../progression.js';
import {
  getAvailableExpansions,
  getAllExpansions,
  isExpansionPurchased,
  purchaseExpansion,
  getActivePlan,
} from '../floorplan.js';
import { showToast } from './toast.js';
import { sfxBuild, sfxError } from '../sfx.js';
import {
  getIntakeQueue, intakePet, intakeRandomPet, isIntakeReady, initIntakeCatalog,
} from '../intake.js';
import { hasReadyHabitat, habitatUnderConstruction } from './tutorial.js';

let buildPanelEl = null;
let selectedHireRole = null;
let panelMode = 'build'; // build | hire

export function initBuildPanel() {
  buildPanelEl = document.getElementById('build-panel');
  if (!buildPanelEl) return;
  renderBuildPanel();
}

export function toggleBuildPanel(show) {
  if (!buildPanelEl) return;
  buildPanelEl.classList.toggle('visible', show);
}

export function setBuildPanelMode(mode) {
  panelMode = mode === 'hire' ? 'hire' : 'build';
}

function renderRoomButton(key, def) {
  const count = countRoomsByType(key);
  const cost = def.cost || 0;
  const canAfford = G.money >= cost;
  const unlock = getRoomUnlockState(key);
  const lockClass = unlock.unlocked ? '' : 'locked';
  const disabledClass = canAfford ? '' : 'disabled';
  const roleText = unlock.unlocked
    ? `${OFFICE_GUIDE[key]?.role || 'Utility'} · ${OFFICE_GUIDE[key]?.impact || 'Supports your company operations.'}`
    : `🔒 ${unlock.requirement} (${unlock.progress})`;

  return `
    <button class="room-btn ${disabledClass} ${lockClass}" data-room="${key}">
      <span class="room-icon">${def.icon}</span>
      <span class="room-info">
        <span class="room-name">${def.name}</span>
        <span class="room-cost ${canAfford ? '' : 'too-expensive'}">$${cost.toLocaleString()}${count > 0 ? ` (${count})` : ''}</span>
        <span class="room-role">${roleText}</span>
      </span>
    </button>
  `;
}

function renderBuildSection() {
  const allRooms = { ...OFFICE_TYPES, ...COMMON_ROOMS };
  const corridorActive = isCorridorMode() ? 'selected' : '';

  let prerequisite = '';
  if (G.companyType === 'animal_shelter' && !hasReadyHabitat()) {
    const building = habitatUnderConstruction();
    prerequisite = `
      <div class="build-prerequisite-callout">
        <strong>${building ? '🔨 Habitat building…' : '🐾 Build a habitat first'}</strong>
        <p>${building
          ? 'Wait for construction to finish (try 2× speed), then use Intake (H).'
          : 'Place Wire Kennels for dogs or Basic Cattery for cats. The green preview must touch tan corridor tiles on the map.'}</p>
      </div>
    `;
  }

  // Corridor tool at top
  let html = `<div class="build-section"><h3>🏗️ Build</h3>${prerequisite}<div class="room-catalog">`;
  html += `
    <button class="room-btn corridor-tool ${corridorActive}" data-corridor="true">
      <span class="room-icon">🚶</span>
      <span class="room-info">
        <span class="room-name">Corridor</span>
        <span class="room-cost">Free - click & drag</span>
        <span class="room-role">Paint walkways for your agents. Rooms need corridors next to them.</span>
      </span>
    </button>
  `;
  html += `<div class="build-category-header">🏢 Rooms</div>`;

  for (const [catKey, cat] of Object.entries(getOfficeCategoriesForCompany())) {
    const roomsInCat = cat.offices.filter(key => {
      if (!allRooms[key]) return false;
      // Hide offices not available for this company type
      return isOfficeAvailable(key);
    });
    if (roomsInCat.length === 0) continue;

    html += `<div class="build-category-header">${cat.icon} ${cat.label}</div>`;
    for (const key of roomsInCat) {
      html += renderRoomButton(key, allRooms[key]);
    }
  }

  html += `</div></div>`;

  // ─── Land Expansions ───
  const expansions = getAllExpansions();
  const availableExps = expansions.filter(e => !isExpansionPurchased(e.id));
  if (availableExps.length > 0) {
    html += `<div class="build-section"><h3>🗺️ Expand Land</h3><div class="room-catalog">`;
    for (const exp of availableExps) {
      const canAfford = G.money >= exp.cost;
      const locked = exp.requires && !isExpansionPurchased(exp.requires);
      const disabledClass = !canAfford || locked ? 'disabled' : '';
      const lockClass = locked ? 'locked' : '';
      const statusText = locked
        ? `🔒 Requires another expansion first`
        : `${exp.w}×${exp.h} tiles of buildable land`;
      html += `
        <button class="room-btn ${disabledClass} ${lockClass}" data-expansion="${exp.id}">
          <span class="room-icon">🗺️</span>
          <span class="room-info">
            <span class="room-name">${exp.name}</span>
            <span class="room-cost ${canAfford ? '' : 'too-expensive'}">$${exp.cost.toLocaleString()}</span>
            <span class="room-role">${statusText}</span>
          </span>
        </button>
      `;
    }
    html += `</div></div>`;
  }

  // ─── Marketing Budget ───
  html += `
    <div class="build-section">
      <h3>📣 Marketing Budget</h3>
      <div class="budget-control">
        <input type="range" id="budget-slider" min="0" max="500" step="10" value="${G.marketingBudget}">
        <div class="budget-display">
          <span class="budget-amount">$${G.marketingBudget}/day</span>
        </div>
        <div class="budget-hint">Community outreach budget - attracts more adopters</div>
      </div>
    </div>
  `;

  return html;
}

function renderCandidateCards(key, role, candidates) {
  let html = `<div class="candidate-list">`;
  for (const c of candidates) {
    const avatarImg = c.avatar
      ? `<img src="${c.avatar}" alt="${c.name}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1.5px solid ${role.color};flex-shrink:0">`
      : `<span style="font-size:18px">${role.emoji}</span>`;

    const tier = SENIORITY_LEVELS[c.seniority] || SENIORITY_LEVELS[2];
    const stars = seniorityStars(c.seniority);
    const tierColor = c.seniority >= 4 ? '#f0d050' : c.seniority >= 3 ? '#b0c8e8' : 'var(--text-dim)';

    html += `
      <div class="candidate-card">
        <div class="candidate-top">
          <span class="candidate-name" style="display:flex;align-items:center;gap:6px">${avatarImg} ${c.name}</span>
          <span class="candidate-eff">Eff ${c.efficiency}x</span>
        </div>
        <div class="candidate-meta" style="color:${tierColor}">${stars} ${tier.label}</div>
        <div class="candidate-meta">Skill ${Math.round(c.skill * 100)}% · Mood ${Math.round(c.mood * 100)}% · <span style="color:${c.iq >= 1.3 ? '#f0d050' : c.iq >= 1.0 ? '#b0c8e8' : 'var(--text-dim)'}">🧠 ${getIQLabel(c.iq).label}</span></div>
        <div class="candidate-meta">Salary $${c.salary}/day · Signing $${c.signingCost}</div>
        <button class="candidate-hire-btn" data-role="${key}" data-candidate-id="${c.id}">
          Hire Candidate
        </button>
      </div>
    `;
  }
  html += `
    <button class="candidate-reroll-btn" data-role="${key}">🔄 Roll New Candidates</button>
  </div>`;
  return html;
}

function renderIntakeSection() {
  const queue = getIntakeQueue();
  const petsInCare = G.agents.filter(a => a.petId).length;
  const ready = G.agents.filter(a => a.readyForAdoption).length;
  const canAfford = G.money >= INTAKE_COST;

  let habitatBlock = '';
  if (!hasReadyHabitat()) {
    habitatBlock = `
      <div class="build-prerequisite-callout" style="margin-bottom:10px">
        <strong>Build a habitat before intake</strong>
        <p>Dogs need a finished <em>Wire Kennels</em> room; cats need a <em>Basic Cattery</em>. Press <kbd>B</kbd> and place next to tan corridors ($1,200 each).</p>
      </div>
    `;
  }

  let html = `
    <div class="build-section">
      <h3>🐾 Pet Intake <span class="hire-cost">Monroe catalog · $${INTAKE_COST} processing fee</span></h3>
      ${habitatBlock}
      <div class="recruitment-status">${isIntakeReady() ? `${G.availablePets?.length || 0} pets available · ${petsInCare} in care · ${ready} ready to adopt` : 'Loading pet catalog from WordPress…'}</div>
      <div class="candidate-list">
  `;

  if (queue.length === 0) {
    html += `<div class="recruitment-status">No pets available - all may be adopted out or already in your shelter.</div>`;
    html += `<button class="candidate-reroll-btn" data-intake-refresh="true">🔄 Refresh Catalog</button>`;
  } else {
    for (const pet of queue) {
      const role = AGENT_ROLES[getRoleForPet(pet)] || AGENT_ROLES.pet_other;
      const avatarImg = pet.photo_url
        ? `<img src="${pet.photo_url}" alt="${pet.name}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:1.5px solid ${role.color};flex-shrink:0">`
        : `<span style="font-size:24px">${role.emoji}</span>`;
      html += `
        <div class="candidate-card">
          <div class="candidate-top">
            <span class="candidate-name" style="display:flex;align-items:center;gap:8px">${avatarImg} ${pet.name}</span>
            <span class="candidate-eff">${pet.species || 'pet'}</span>
          </div>
          <div class="candidate-meta">Age ${pet.age ?? '?'} · Habitat: ${getHabitatForSpecies(pet.species)}</div>
          <button class="candidate-hire-btn" data-intake-pet-id="${pet.id}" ${canAfford ? '' : 'disabled'}>
            Intake ${pet.name} ($${INTAKE_COST})
          </button>
        </div>
      `;
    }
    html += `<button class="candidate-reroll-btn" data-intake-random="true">🎲 Intake Random Pet ($${INTAKE_COST})</button>`;
    html += `<button class="candidate-reroll-btn" data-intake-refresh="true">🔄 Refresh Catalog</button>`;
  }

  html += `</div></div>`;
  return html;
}

export function renderBuildPanel() {
  if (!buildPanelEl) return;

  const html = panelMode === 'hire' ? renderIntakeSection() : renderBuildSection();
  buildPanelEl.innerHTML = html;

  buildPanelEl.querySelectorAll('.room-btn:not(.disabled):not(.locked)').forEach(btn => {
    if (btn.dataset.expansion) {
      // Land expansion - instant purchase
      btn.addEventListener('click', () => {
        const expId = btn.dataset.expansion;
        const allExps = getAllExpansions();
        const exp = allExps.find(e => e.id === expId);
        if (!exp) return;
        if (G.money < exp.cost) {
          sfxError();
          showToast(`Not enough funds! Need $${exp.cost.toLocaleString()}`);
          return;
        }
        G.money -= exp.cost;
        purchaseExpansion(expId);

        // Auto-build corridors through the new land
        // Place corridor at the edge CLOSEST to main corridor so the bulk of the
        // expansion is free for rooms (not split by the corridor).
        const plan = getActivePlan();
        const mainCorridorY = plan ? plan.corridorY : 22;
        const expBottom = exp.y + exp.h - 1;
        let corrY;
        if (exp.y >= mainCorridorY) {
          // Expansion is BELOW main corridor - corridor at top edge
          corrY = exp.y + 1;
        } else if (expBottom <= mainCorridorY) {
          // Expansion is ABOVE main corridor - corridor at bottom edge
          corrY = expBottom - 1;
        } else {
          // Expansion straddles main corridor - align with it
          corrY = mainCorridorY;
        }
        // Clamp within expansion bounds
        corrY = Math.max(exp.y + 1, Math.min(corrY, expBottom - 1));
        for (let x = exp.x; x < exp.x + exp.w; x++) {
          addCorridor(x, corrY);
          addCorridor(x, corrY - 1);
        }

        // Auto-build vertical connector to main corridor
        const mainCorrX0 = plan ? plan.corridorX[0] : 0;
        const mainCorrX1 = plan ? plan.corridorX[1] : 40;
        // Pick connector X: prefer overlap with main corridor range, else use expansion edge
        let connX = exp.x + 1;
        if (exp.x < mainCorrX1 && exp.x + exp.w > mainCorrX0) {
          // Expansion overlaps main corridor horizontally - connect in the overlap
          connX = Math.max(exp.x + 1, mainCorrX0);
        }
        const fromY = Math.min(corrY - 1, mainCorridorY - 1);
        const toY = Math.max(corrY, mainCorridorY);
        for (let y = fromY; y <= toY; y++) {
          addCorridor(connX, y);
          addCorridor(connX + 1, y);
        }

        sfxBuild();
        showToast(`Expanded: ${exp.name}! -$${exp.cost.toLocaleString()}`);
        G.uiDirty = true;
        renderBuildPanel();
      });
    } else {
      // Room placement
      btn.addEventListener('click', () => {
        const type = btn.dataset.room;
        buildPanelEl.querySelectorAll('.room-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        setSelectedRoomType(type);
        G.buildMode = true;
      });
    }
  });

  buildPanelEl.querySelectorAll('.hire-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const roleKey = btn.dataset.role;
      selectedHireRole = selectedHireRole === roleKey ? null : roleKey;
      renderBuildPanel();
    });
  });

  buildPanelEl.querySelectorAll('[data-intake-pet-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const petId = btn.dataset.intakePetId;
      const pet = (G.availablePets || []).find(p => String(p.id) === String(petId))
        || (G.shelterCatalog || []).find(p => String(p.id) === String(petId));
      if (!pet) return;
      intakePet(pet);
      toggleBuildPanel(false);
      const hireBtn = document.getElementById('hire-btn');
      if (hireBtn) hireBtn.classList.remove('active');
      renderBuildPanel();
    });
  });

  buildPanelEl.querySelectorAll('[data-intake-random]').forEach(btn => {
    btn.addEventListener('click', () => {
      intakeRandomPet();
      toggleBuildPanel(false);
      const hireBtn = document.getElementById('hire-btn');
      if (hireBtn) hireBtn.classList.remove('active');
      renderBuildPanel();
    });
  });

  buildPanelEl.querySelectorAll('[data-intake-refresh]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await initIntakeCatalog();
      renderBuildPanel();
    });
  });

  // Corridor tool button
  const corridorBtn = buildPanelEl.querySelector('[data-corridor]');
  if (corridorBtn) {
    corridorBtn.addEventListener('click', () => {
      buildPanelEl.querySelectorAll('.room-btn').forEach(b => b.classList.remove('selected'));
      corridorBtn.classList.add('selected');
      setCorridorMode(true);
      G.buildMode = true;
    });
  }

  // Marketing budget slider
  const slider = document.getElementById('budget-slider');
  if (slider) {
    slider.addEventListener('input', (e) => {
      G.marketingBudget = parseInt(e.target.value, 10);
      const display = buildPanelEl.querySelector('.budget-amount');
      if (display) display.textContent = `$${G.marketingBudget}/day`;
    });
  }

  // Office guide popover on hover
  setupOfficePopover();
}

// ─── Office Guide Popover ────────────────────────────────
let popoverEl = null;
let popoverHideTimer = null;

function setupOfficePopover() {
  popoverEl = document.getElementById('office-popover');
  if (!popoverEl) return;

  const allRooms = { ...OFFICE_TYPES, ...COMMON_ROOMS };

  buildPanelEl.querySelectorAll('.room-btn[data-room]').forEach(btn => {
    const key = btn.dataset.room;
    const guide = OFFICE_GUIDE[key];
    if (!guide || !guide.guide) return;

    btn.addEventListener('mouseenter', () => {
      clearTimeout(popoverHideTimer);
      showOfficePopover(btn, key, allRooms[key], guide);
    });

    btn.addEventListener('mouseleave', () => {
      popoverHideTimer = setTimeout(hideOfficePopover, 200);
    });
  });

  popoverEl.addEventListener('mouseenter', () => clearTimeout(popoverHideTimer));
  popoverEl.addEventListener('mouseleave', () => {
    popoverHideTimer = setTimeout(hideOfficePopover, 150);
  });
}

function showOfficePopover(btn, key, def, guide) {
  if (!popoverEl || !def) return;

  const rent = ROOM_COSTS[key] || 0;
  const rentLine = rent > 0 ? `<span style="color:var(--text-dim);font-size:10px;margin-left:auto">$${rent}/day rent</span>` : '';

  let html = `
    <div class="office-popover-header">
      <span class="office-popover-icon">${def.icon}</span>
      <div>
        <div class="office-popover-title">${def.name} ${rentLine}</div>
        <div class="office-popover-role">${guide.role} - ${guide.impact}</div>
      </div>
    </div>
    <div class="office-popover-section">
      <div class="office-popover-label">What is this?</div>
      <div class="office-popover-text">${guide.guide}</div>
    </div>
    <div class="office-popover-section">
      <div class="office-popover-label">How it works</div>
      <div class="office-popover-text">${guide.howItWorks}</div>
    </div>
    <div class="office-popover-section">
      <div class="office-popover-label">Tips</div>
      <div class="office-popover-text">${guide.tips}</div>
    </div>
  `;

  if (guide.projects) {
    html += `
      <div class="office-popover-section">
        <div class="office-popover-label">Projects</div>
        <div class="office-popover-projects">
          ${guide.projects.split(', ').map(p => `<span class="office-popover-tag">${p}</span>`).join('')}
        </div>
      </div>
    `;
  }

  popoverEl.innerHTML = html;

  // Position: to the right of the build panel
  const btnRect = btn.getBoundingClientRect();
  const panelRect = buildPanelEl.getBoundingClientRect();
  let top = btnRect.top;
  const left = panelRect.right + 12;

  popoverEl.classList.add('visible');

  // Clamp vertically to viewport
  const actualHeight = popoverEl.offsetHeight;
  if (top + actualHeight > window.innerHeight - 12) {
    top = window.innerHeight - actualHeight - 12;
  }
  if (top < 12) top = 12;

  popoverEl.style.top = `${top}px`;
  popoverEl.style.left = `${left}px`;
}

function hideOfficePopover() {
  if (popoverEl) popoverEl.classList.remove('visible');
}
