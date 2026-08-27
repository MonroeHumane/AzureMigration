// ═══════════════════════════════════════════════════════════════
//  SHELTER TYCOON - Guided tutorial (checklist + button highlights)
// ═══════════════════════════════════════════════════════════════

import { G } from '../game.js';
import { getRoomInstances } from '../map.js';

const HABITAT_TYPES = ['kennel', 'cattery'];

export function hasHabitatRoom() {
  return getRoomInstances().some(r => HABITAT_TYPES.includes(r.typeKey));
}

export function hasReadyHabitat() {
  return getRoomInstances().some(
    r => HABITAT_TYPES.includes(r.typeKey) && r.constructionProgress >= 1,
  );
}

export function habitatUnderConstruction() {
  return getRoomInstances().some(
    r => HABITAT_TYPES.includes(r.typeKey) && r.constructionProgress < 1,
  );
}

export const TUTORIAL_STEPS = [
  {
    id: 'corridors',
    title: 'Spot the tan corridors',
    body: 'Tan diamond tiles are walkways. Your shelter starts with paths already painted. New rooms must touch a tan corridor on at least one edge.',
    hint: 'Need more path? Build → Corridor (free) and click empty green floor.',
    target: null,
    key: null,
    check: () => true,
  },
  {
    id: 'build',
    title: 'Build Kennel or Cattery',
    body: 'Press B → Build. Choose Wire Kennels ($1,200) for dogs or Basic Cattery ($1,200) for cats. Drag on the map so the green preview touches tan corridors.',
    hint: 'Construction takes a moment - use 2× speed while you wait.',
    target: '#build-btn',
    key: 'B',
    check: () => hasReadyHabitat(),
  },
  {
    id: 'intake',
    title: 'Intake your first pet',
    body: 'Open Intake (H). Dogs need a finished Kennel; cats need a finished Cattery. Pick a pet from the Monroe catalog.',
    hint: 'Click Intake above, then choose a pet card.',
    target: '#hire-btn',
    key: 'H',
    check: () => G.agents.some(a => a.petId),
  },
  {
    id: 'care',
    title: 'Watch the care plan',
    body: 'Care plans advance automatically: Intake → Medical → Socialization → Ready. Track progress in Care Plans on the right.',
    hint: 'Speed up time with 2× if you like.',
    target: '#panel',
    key: null,
    check: () => G.projects.some(p => p.isCarePlan && p.state === 'in_progress'),
  },
  {
    id: 'ready',
    title: 'Get a pet adoption-ready',
    body: 'When all care phases finish, the pet is Ready. Adopters will visit the Adoption Lobby.',
    hint: null,
    target: null,
    key: null,
    check: () => G.agents.some(a => a.petId && a.readyForAdoption),
  },
  {
    id: 'adopt',
    title: 'Complete your first adoption',
    body: 'Match a ready pet with an adopter in the lobby. Each adoption earns a donation and adds to your Adoptédex.',
    hint: 'Raise Outreach in Build to attract more adopters later.',
    target: null,
    key: null,
    check: () => (G.adoptedCount || 0) >= 1,
  },
];

let guideEl = null;
let listEl = null;
let bodyEl = null;
let hintEl = null;
let dismissed = false;

export function initTutorial() {
  if (G.tutorialComplete) return;

  guideEl = document.getElementById('tutorial-guide');
  if (!guideEl) return;

  listEl = guideEl.querySelector('[data-tutorial-steps]');
  bodyEl = guideEl.querySelector('[data-tutorial-body]');
  hintEl = guideEl.querySelector('[data-tutorial-hint]');

  const skipBtn = guideEl.querySelector('[data-tutorial-skip]');
  if (skipBtn) {
    skipBtn.onclick = () => {
      dismissed = true;
      G.tutorialComplete = true;
      guideEl.classList.add('is-hidden');
      clearPulse();
      if (typeof G.scheduleSave === 'function') G.scheduleSave();
    };
  }

  const toggleBtn = guideEl.querySelector('[data-tutorial-toggle]');
  if (toggleBtn) {
    toggleBtn.onclick = () => guideEl.classList.toggle('is-collapsed');
  }

  renderTutorialSteps();
  updateTutorialGuide();
}

export function isTutorialActive() {
  return !dismissed && !G.tutorialComplete && G.companyType === 'animal_shelter';
}

function isStepComplete(step) {
  if (!step.check) return false;
  try {
    return step.check();
  } catch (_) {
    return false;
  }
}

function getActiveStep() {
  if (!isTutorialActive()) return null;
  for (const step of TUTORIAL_STEPS) {
    if (!isStepComplete(step)) return step;
  }
  return null;
}

function clearPulse() {
  document.querySelectorAll('.tutorial-pulse').forEach(el => el.classList.remove('tutorial-pulse'));
}

function applyPulse(selector) {
  clearPulse();
  if (!selector) return;
  const el = document.querySelector(selector);
  if (el) el.classList.add('tutorial-pulse');
}

function renderTutorialSteps() {
  if (!listEl) return;

  listEl.innerHTML = TUTORIAL_STEPS.map((step, i) => {
    const done = isStepComplete(step);
    const active = !done && TUTORIAL_STEPS.slice(0, i).every(isStepComplete);
    return `
      <li class="tutorial-step ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}">
        <span class="tutorial-step-num">${done ? '✓' : i + 1}</span>
        <span class="tutorial-step-label">${step.title}</span>
      </li>
    `;
  }).join('');
}

function updateTutorialGuide() {
  if (!guideEl || !isTutorialActive()) {
    if (guideEl) guideEl.classList.add('is-hidden');
    clearPulse();
    return;
  }

  guideEl.classList.remove('is-hidden');
  renderTutorialSteps();

  const step = getActiveStep();
  if (!step) {
    G.tutorialComplete = true;
    guideEl.classList.add('is-hidden');
    clearPulse();
    return;
  }

  let body = step.body;
  let hint = step.hint || '';

  if (step.id === 'build' && habitatUnderConstruction() && !hasReadyHabitat()) {
    hint = '🔨 Habitat under construction - press 2× to finish faster.';
  }
  if (step.id === 'intake' && !hasReadyHabitat()) {
    body = 'You need a finished Kennel (dogs) or Cattery (cats) before intake. Press B → Build if you have not placed one yet.';
    hint = 'Green placement preview must touch tan corridor tiles.';
    applyPulse('#build-btn');
    if (bodyEl) bodyEl.textContent = body;
    if (hintEl) hintEl.textContent = hint;
    return;
  }

  if (bodyEl) bodyEl.textContent = body;
  if (hintEl) hintEl.textContent = hint;

  applyPulse(step.target);
}

export function updateTutorial(dt) {
  if (!isTutorialActive()) return;

  const step = getActiveStep();
  if (step && isStepComplete(step)) {
    G.completedTriggers.add(`tutorial_${step.id}`);
    renderTutorialSteps();
  }

  if (TUTORIAL_STEPS.every(isStepComplete)) {
    if (!G.tutorialComplete) {
      G.tutorialComplete = true;
      if (typeof G.scheduleSave === 'function') G.scheduleSave();
    }
  }

  updateTutorialGuide();
}

export function onHabitatPlaced(typeKey) {
  if (!HABITAT_TYPES.includes(typeKey)) return;
  G.completedTriggers.add('first_room');
  if (!isTutorialActive()) return;
}
