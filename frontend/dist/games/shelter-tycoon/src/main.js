// ═══════════════════════════════════════════════════════════════
//  SHELTER TYCOON - Humane Society shelter simulator
//  Entry point: imports, init, game loop
// ═══════════════════════════════════════════════════════════════

import { ECONOMY, COMPANY_TYPES, OFFICE_TYPES, COMMON_ROOMS, TILE_W, TILE_H } from './config.js';
import { initEngine, setClickHandler, setBuildDragCallbacks, smoothZoom, toScreen, toTile, getZoom, setCam, getSize } from './engine.js';
import { placeRoom, addCorridor, refreshDoors, getRoomInstances, clearMap, restoreRoomFromSave } from './map.js';
import {
  initFloorPlan, pickRandomPlan, getActivePlan,
  getAllExpansions, isExpansionAvailable, isExpansionPurchased, purchaseExpansion,
} from './floorplan.js';
import { G, trackEvent } from './game.js';
import { Agent, setNextAgentId, getNextAgentId } from './agent.js';
import { simulationTick } from './simulation.js';
import { render, updateHover } from './renderer/index.js';
import { initMinimap, drawMinimap } from './renderer/minimap.js';
import { initPanels, selectAgent, deselectAgent, updateUI } from './ui/panels.js';
import { initSpeedControls, initKeyboard, setSpeed } from './ui/speed.js';
import { initBuildPanel, toggleBuildPanel, renderBuildPanel, setBuildPanelMode } from './ui/build-panel.js';
import { showEquipmentPanel, hideEquipmentPanel } from './ui/equipment-panel.js';
import { initCashflowGraph, updateCashflowGraph } from './ui/cashflow-graph.js';
import { initFloatingChartPanel } from './ui/floating-chart.js';
import { initStrategyPanel, updateStrategyPanel } from './ui/strategy-panel.js';
import { initIntro, showLevelIntro, hideIntro } from './ui/intro.js';
import { handleBuildClick, handleBuildMouseDown, handleBuildMouseMove, handleBuildMouseUp, setSelectedRoomType, setCorridorMode, isCorridorMode, cycleRotation, resetRotation } from './build-mode.js';
import { initAudio, toggleMusic } from './audio.js';
import { resumeAudioCtx, sfxClick } from './sfx.js';
import { showToast } from './ui/toast.js';
import { initHudPopovers } from './ui/hud-popover.js';
import { initTutorial, hasReadyHabitat, habitatUnderConstruction } from './ui/tutorial.js';
import { aiCeoTick, toggleAiCeo, enableAiCeo } from './ai-ceo.js';
import {
  getMonroeNickname,
  getMonroeDisplayName,
  setMonroeDexUser,
  slugifyDexUsername,
  resolvePlayerIdentity,
  syncAdoptedexProfile,
  loadFromWordPress,
  saveToWordPress,
  serializeGameState,
  refreshAvailablePets,
  sanitizeAdoptedPetIds,
  logIntakeCatalogStatus,
  loadMonroePets,
  isLauncherEmbed,
  notifyLauncherNeedDex,
  showDexIdentityGate,
  hideDexIdentityGate,
} from './monroe-api.js?v=13';
import { Project, setNextProjectId } from './project.js';
import { AGENT_ROLES, PROJECT_TEMPLATES, getRoleForPet, getHabitatForSpecies } from './config.js';
import { initIntakeCatalog } from './intake.js';

/** Lobby camera focus - kept in main.js so stale cached engine.js cannot break startup. */
function focusCameraOnTile(tx, ty) {
  const { W, H } = getSize();
  const zoom = getZoom();
  const halfW = (TILE_W / 2) * zoom;
  const halfH = (TILE_H / 2) * zoom;
  setCam(W / 2 - (tx - ty) * halfW, H * 0.42 - (tx + ty) * halfH);
}

// roundRect polyfill
const ctx = document.getElementById('game').getContext('2d');
if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = [r,r,r,r];
    this.moveTo(x + r[0], y);
    this.lineTo(x + w - r[1], y);
    this.quadraticCurveTo(x + w, y, x + w, y + r[1]);
    this.lineTo(x + w, y + h - r[2]);
    this.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
    this.lineTo(x + r[3], y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r[3]);
    this.lineTo(x, y + r[0]);
    this.quadraticCurveTo(x, y, x + r[0], y);
    this.closePath();
  };
}

// ─── Initialize ────────────────────────────────────────────
initEngine();
initMinimap();
initPanels();
initSpeedControls();
initBuildPanel();
initCashflowGraph();
initFloatingChartPanel();
initStrategyPanel();
initIntro();
initAudio();
initHudPopovers();

// ─── Corridor drag painting callbacks ───────────────────────
setBuildDragCallbacks({
  shouldCapture: () => G.buildMode && isCorridorMode(),
  onDown: (sx, sy) => handleBuildMouseDown(sx, sy),
  onMove: (sx, sy) => handleBuildMouseMove(sx, sy),
  onUp: () => handleBuildMouseUp(),
});

// ─── Default starting layout (new games only) ───────────────
function buildDefaultCorridorsOnly() {
  const plan = getActivePlan();
  if (!plan) return;

  for (let x = plan.corridorX[0]; x < plan.corridorX[1]; x++) {
    addCorridor(x, plan.corridorY);
    addCorridor(x, plan.corridorY - 1);
  }

  const lp = plan.lobbyPos;
  const lobbyMidX = lp.x + 2;
  const minY = Math.min(plan.corridorY - 1, lp.y);
  const maxY = Math.max(plan.corridorY, lp.y + 3);
  for (let y = minY; y <= maxY; y++) {
    addCorridor(lobbyMidX, y);
    addCorridor(lobbyMidX + 1, y);
  }

  if (plan.extraCorridors) {
    for (const seg of plan.extraCorridors) {
      for (let x = seg.x1; x <= seg.x2; x++) {
        addCorridor(x, seg.y);
        addCorridor(x, seg.y - 1);
      }
    }
  }

  // North branches off the main hallway - spots to attach kennels/catteries
  const branchStart = plan.corridorX[0] + 2;
  const branchEnd = plan.corridorX[1] - 3;
  for (let x = branchStart; x <= branchEnd; x += 3) {
    for (let dy = 1; dy <= 5; dy++) {
      addCorridor(x, plan.corridorY - dy);
      if (x + 1 <= branchEnd) addCorridor(x + 1, plan.corridorY - dy);
    }
  }
}

function buildDefaultStartingLayout() {
  const plan = getActivePlan();
  if (!plan) return;

  const lp = plan.lobbyPos;
  placeRoom('lobby', lp.x, lp.y, 5, 3);
  buildDefaultCorridorsOnly();

  const lobby = getRoomInstances().find(r => r.typeKey === 'lobby');
  if (lobby) refreshDoors(lobby.id);

  focusCameraOnTile(lp.x + 2, lp.y + 1);
}

function restoreMapFromSave(saved) {
  clearMap();
  if (saved.corridors?.length) {
    for (const tile of saved.corridors) addCorridor(tile.x, tile.y);
  } else if (saved.rooms?.length) {
    buildDefaultCorridorsOnly();
  }
  if (saved.rooms?.length) {
    for (const room of saved.rooms) restoreRoomFromSave(room);
  } else {
    buildDefaultStartingLayout();
  }
}

const MAX_REASONABLE_PETS_IN_CARE = 24;

function sanitizeSavedPets(savedPets) {
  if (!savedPets?.length) return [];

  const catalogSize = (G.shelterCatalog || []).length;
  const catalogIds = new Set((G.shelterCatalog || []).map((p) => p.id));
  const valid = savedPets.filter((p) => p?.petId != null && p.petId !== '');

  if (catalogSize >= 10) {
    const overlap = valid.filter((p) => catalogIds.has(String(p.petId))).length;
    if (overlap >= catalogSize - 2) {
      console.warn(
        `[Shelter Tycoon] Ignoring corrupted save: ${valid.length} in-care pets matched nearly the full catalog (${catalogSize}).`,
      );
      return [];
    }
    return valid;
  }

  if (valid.length > MAX_REASONABLE_PETS_IN_CARE) {
    console.warn(
      `[Shelter Tycoon] Ignoring corrupted save: ${valid.length} in-care pets (max ${MAX_REASONABLE_PETS_IN_CARE}).`,
    );
    return [];
  }

  return valid;
}

function restorePetsFromSave(savedPets) {
  const pets = sanitizeSavedPets(savedPets);
  if (!pets.length) return;

  G.agents = G.agents.filter(a => !a.petId);
  G.projects = G.projects.filter(p => !p.isCarePlan);

  let maxAgentId = 0;
  let maxProjectId = 0;

  for (const pet of pets) {
    const roleKey = pet.roleKey || getRoleForPet({ species: pet.species });
    const profile = {
      name: pet.name,
      avatar: pet.avatar,
      petId: pet.petId,
      species: pet.species,
      age: pet.age,
      readyForAdoption: !!pet.readyForAdoption,
      mood: 0.75,
      skill: 0.45,
      motivation: 0.8,
      alignment: 0.85,
      seniority: 2,
    };

    const agent = new Agent(roleKey, pet.x, pet.y, profile);
    if (pet.agentId != null) {
      agent.id = pet.agentId;
      maxAgentId = Math.max(maxAgentId, pet.agentId);
    }
    agent.petId = pet.petId;
    agent.species = pet.species;
    agent.age = pet.age;
    agent.readyForAdoption = !!pet.readyForAdoption;
    G.agents.push(agent);

    if (pet.carePlan) {
      const habitat = getHabitatForSpecies(pet.species);
      const tpl = PROJECT_TEMPLATES.find(t =>
        t.isCarePlan && t.office === (pet.carePlan.templateOffice || habitat)
      ) || PROJECT_TEMPLATES.find(t => t.isCarePlan);

      if (tpl) {
        const carePlan = new Project(tpl, 1.0);
        if (pet.carePlan.id != null) {
          carePlan.id = pet.carePlan.id;
          maxProjectId = Math.max(maxProjectId, pet.carePlan.id);
        }
        carePlan.name = `${pet.name}'s Care Plan`;
        carePlan.petId = pet.petId;
        carePlan.petAgent = agent;
        carePlan.phaseIdx = pet.carePlan.phaseIdx ?? 0;
        carePlan.phaseProgress = pet.carePlan.phaseProgress ?? 0;
        carePlan.state = pet.carePlan.state || 'in_progress';
        carePlan.dayAge = pet.carePlan.dayAge ?? 0;
        carePlan.qualityScore = pet.carePlan.qualityScore ?? 0.5;
        agent.task = carePlan.state !== 'done' ? carePlan : null;
        G.projects.push(carePlan);
      }
    }
  }

  if (maxAgentId > 0) setNextAgentId(maxAgentId + 1);
  if (maxProjectId > 0) setNextProjectId(maxProjectId + 1);
}

function restoreCeoFromSave(savedCeo) {
  if (!savedCeo) return;

  if (G.ceo) {
    G.agents = G.agents.filter(a => a !== G.ceo);
    G.ceo = null;
  }

  const ceo = new Agent('ceo', savedCeo.x, savedCeo.y);
  if (savedCeo.agentId != null) {
    ceo.id = savedCeo.agentId;
    setNextAgentId(Math.max(getNextAgentId(), savedCeo.agentId + 1));
  }
  ceo.name = savedCeo.name || 'Director';
  ceo.mood = savedCeo.mood ?? 0.9;
  ceo.skill = savedCeo.skill ?? 0.5;
  ceo.alignment = savedCeo.alignment ?? 1.0;
  G.agents.push(ceo);
  G.ceo = ceo;
}

// ─── Floor Plan (layout applied after save check) ────────────
const planKey = pickRandomPlan();
const plan = initFloorPlan(planKey);
console.log(`Floor plan: ${plan.name}`);

// ─── WordPress save / load ─────────────────────────────────
let saveInFlight = false;

G.scheduleSave = function scheduleSave() {
  if (!G.playerNickname || saveInFlight) return;
  if (G.lastSaveDay === G.day && !G.savePending) return;
  G.savePending = true;
  saveInFlight = true;
  const payload = serializeGameState();
  saveToWordPress(G.playerNickname, payload).finally(() => {
    G.lastSaveDay = G.day;
    G.savePending = false;
    saveInFlight = false;
  });
};

function applySavedState(saved) {
  if (saved.companyType) G.companyType = saved.companyType;
  if (saved.money != null) G.money = saved.money;
  if (saved.totalRevenue != null) G.totalRevenue = saved.totalRevenue;
  if (saved.reputation != null) G.reputation = saved.reputation;
  if (saved.day != null) G.day = saved.day;
  if (saved.week != null) G.week = saved.week;
  if (saved.adoptedPetIds) {
    G.adoptedPetIds = saved.adoptedPetIds.map((id) => String(id));
  }
  if (saved.adoptedCount != null) G.adoptedCount = saved.adoptedCount;
  if (saved.tutorialComplete != null) {
    G.tutorialComplete = saved.tutorialComplete;
  } else if ((saved.adoptedCount || 0) >= 1 || (saved.pets?.length || 0) >= 1) {
    G.tutorialComplete = true;
  }
  if (saved.lastAdoptionDay != null) G.lastAdoptionDay = saved.lastAdoptionDay;
  if (saved.marketingBudget != null) G.marketingBudget = saved.marketingBudget;
  if (saved.dailyHistory) G.dailyHistory = saved.dailyHistory;
  if (saved.completedLog) G.completedLog = saved.completedLog;
  if (saved.metrics) G.metrics = { ...G.metrics, ...saved.metrics };
  if (saved.equipmentConfig) G.equipmentConfig = { ...G.equipmentConfig, ...saved.equipmentConfig };
  if (saved.techTreeBranches) G.techTreeBranches = [...saved.techTreeBranches];
  if (saved.unlockedRooms) G.unlockedRooms = new Set(saved.unlockedRooms);

  restoreMapFromSave(saved);
  restoreCeoFromSave(saved.ceo);
  restorePetsFromSave(saved.pets);
  sanitizeAdoptedPetIds();

  G.uiDirty = true;
}

function promptNicknameIfNeeded() {
  const resolved = resolvePlayerIdentity();
  if (resolved) {
    hideDexIdentityGate();
    return Promise.resolve(resolved.slug);
  }

  if (isLauncherEmbed()) {
    notifyLauncherNeedDex();
    showDexIdentityGate();
    showToast('Choose your Adoptédex nickname on the Games page to save progress.');
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const modal = document.getElementById('nickname-modal');
    const input = document.getElementById('nickname-input');
    const submitBtn = document.getElementById('nickname-submit-btn');
    if (!modal || !input || !submitBtn) {
      resolve(null);
      return;
    }

    modal.style.display = 'flex';
    input.focus();

    const finish = () => {
      const parsed = slugifyDexUsername(input.value);
      if (!parsed) {
        showToast('Adoptédex nickname must be 3–20 letters or numbers (same as Humane Games).');
        return;
      }
      setMonroeDexUser(parsed.slug, parsed.display);
      modal.style.display = 'none';
      hideDexIdentityGate();
      resolve(parsed.slug);
    };

    submitBtn.onclick = finish;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') finish();
    };
  });
}

let shelterBootstrapComplete = false;

async function bootstrapMonroePlayer() {
  await promptNicknameIfNeeded();

  const slug = G.playerNickname;
  let catalogLoaded = false;

  try {
    await loadMonroePets({ logStatus: false });
    catalogLoaded = true;
  } catch (e) {
    console.warn('Pet catalog unavailable - intake disabled until API responds.', e);
    showToast('Pet catalog failed to load - use Refresh in Intake to retry.');
    try {
      await initIntakeCatalog();
      catalogLoaded = true;
    } catch (_) { /* demo fallback */ }
  }

  if (slug) {
    await syncAdoptedexProfile(slug);
    const saved = await loadFromWordPress(slug);
    if (saved) {
      applySavedState(saved);
      showToast(`☁️ Welcome back, ${getMonroeDisplayName()}! Shelter save loaded.`);
    } else {
      buildDefaultStartingLayout();
    }
  } else {
    buildDefaultStartingLayout();
  }

  if (catalogLoaded) {
    await initIntakeCatalog({ reload: false });
    refreshAvailablePets();
    logIntakeCatalogStatus();
  }

  shelterBootstrapComplete = true;
}

let shelterGameStarting = false;

async function startShelterGame() {
  if (shelterGameStarting) return;
  shelterGameStarting = true;

  G.companyType = 'animal_shelter';
  const companyDef = COMPANY_TYPES.animal_shelter;
  G.unlockedRooms = new Set(companyDef.startUnlocked);

  await bootstrapMonroePlayer();

  if (!hasReadyHabitat() && !habitatUnderConstruction()) {
    showToast('Tan paths are corridors. Press B → build Kennel (dogs) or Cattery (cats) touching them.');
  }

  G.gameSpeed = 1;
  G.missionDismissed = true;
  trackEvent('game-start', { company: G.companyType, player: G.playerNickname || 'guest' });

  if (!G.ceo) {
    const ceoLp = getActivePlan()?.lobbyPos || { x: 10, y: 18 };
    const ceo = new Agent('ceo', ceoLp.x + 2, ceoLp.y + 1);
    ceo.name = 'Director';
    ceo.mood = 0.9;
    ceo.skill = 0.5;
    ceo.alignment = 1.0;
    G.agents.push(ceo);
    G.ceo = ceo;
  }

  document.querySelectorAll('.speed-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.speed === '1');
  });

  initTutorial();

  const lp = getActivePlan()?.lobbyPos;
  if (lp) focusCameraOnTile(lp.x + 2, lp.y + 1);
}

// ─── Company Picker Modal ─────────────────────────────────
G.gameSpeed = 0; // Pause until company + mission dismissed
let selectedCompanyType = null;
const pickerModal = document.getElementById('company-picker-modal');
const pickerGrid = document.getElementById('company-picker-grid');
const pickerBtn = document.getElementById('company-start-btn');
if (pickerModal) pickerModal.style.display = 'none';

// Build company picker cards
if (pickerGrid) {
  const allRooms = { ...OFFICE_TYPES, ...COMMON_ROOMS };
  for (const [typeKey, typeDef] of Object.entries(COMPANY_TYPES)) {
    const officeIcons = typeDef.available.map(k => allRooms[k]?.icon || '').filter(Boolean).join('');
    const card = document.createElement('div');
    card.className = 'company-card';
    card.dataset.type = typeKey;
    card.innerHTML = `
      <div class="company-icon">${typeDef.icon}</div>
      <div class="company-name">${typeDef.name}</div>
      <div class="company-tagline">${typeDef.tagline}</div>
      <div class="company-offices">${typeDef.available.map(k => `<span title="${allRooms[k]?.name || k}">${allRooms[k]?.icon || ''}</span>`).join('')}</div>
    `;
    card.addEventListener('click', () => {
      sfxClick();
      pickerGrid.querySelectorAll('.company-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedCompanyType = typeKey;
      pickerBtn.disabled = false;
      pickerBtn.style.opacity = '1';
      pickerBtn.textContent = `Start as ${typeDef.name} →`;
    });
    pickerGrid.appendChild(card);
  }
}

// ─── Mission Modal (shown first as welcome) ──────────────────────────────────
const missionModal = document.getElementById('mission-modal');
const missionBtn = document.getElementById('mission-start-btn');
if (missionBtn) {
  missionBtn.addEventListener('click', async () => {
    resumeAudioCtx();
    sfxClick();
    missionModal.style.display = 'none';
    pickerModal.style.display = 'none';
    await startShelterGame();
  });
}

// ─── Company Picker (shown after welcome) ─────────────────────────────────
if (pickerBtn) {
  pickerBtn.addEventListener('click', async () => {
    resumeAudioCtx();
    sfxClick();
    pickerModal.style.display = 'none';
    await startShelterGame();
  });
}

// ─── Expansion purchase popup ────────────────────────────────
function showExpansionPopup(exp, sx, sy) {
  // Remove any existing popup
  const old = document.getElementById('expansion-popup');
  if (old) old.remove();

  const canAfford = G.money >= exp.cost;
  const popup = document.createElement('div');
  popup.id = 'expansion-popup';
  popup.style.cssText = `
    position: fixed; left: ${sx}px; top: ${sy - 10}px; transform: translate(-50%, -100%);
    background: rgba(20,17,22,0.97); border: 1px solid rgba(240,160,80,0.4);
    border-radius: 12px; padding: 16px 20px; z-index: 40; text-align: center;
    min-width: 200px; box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    font-family: system-ui; color: #f0d0a0;
  `;
  popup.innerHTML = `
    <div style="font-size: 13px; font-weight: 700; margin-bottom: 4px;">🗺️ ${exp.name}</div>
    <div style="font-size: 11px; color: #a08870; margin-bottom: 10px;">${exp.w}×${exp.h} tiles of new land</div>
    <div style="font-size: 18px; font-weight: 800; margin-bottom: 12px; color: ${canAfford ? '#50c878' : '#e05050'}">
      $${exp.cost.toLocaleString()}
    </div>
    <div style="display: flex; gap: 8px; justify-content: center;">
      <button id="exp-buy-btn" ${canAfford ? '' : 'disabled'} style="
        padding: 8px 20px; border-radius: 8px; border: none; cursor: ${canAfford ? 'pointer' : 'not-allowed'};
        background: ${canAfford ? 'linear-gradient(135deg, #e07030, #c05020)' : '#333'};
        color: ${canAfford ? 'white' : '#666'}; font-size: 13px; font-weight: 700;
      ">Buy Land</button>
      <button id="exp-cancel-btn" style="
        padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(240,160,80,0.2);
        background: transparent; color: #a08870; font-size: 13px; cursor: pointer;
      ">Cancel</button>
    </div>
    ${!canAfford ? '<div style="font-size: 10px; color: #e05050; margin-top: 8px;">Not enough funds</div>' : ''}
  `;
  document.body.appendChild(popup);

  const buyBtn = document.getElementById('exp-buy-btn');
  const cancelBtn = document.getElementById('exp-cancel-btn');

  if (buyBtn && canAfford) {
    buyBtn.addEventListener('click', () => {
      sfxClick();
      G.money -= exp.cost;
      purchaseExpansion(exp.id);

      // Auto-build corridors through the new land
      const midY = exp.y + Math.floor(exp.h / 2);
      for (let x = exp.x; x < exp.x + exp.w; x++) {
        addCorridor(x, midY);
        addCorridor(x, midY - 1);
      }

      sfxClick();
      showToast(`Expanded: ${exp.name}! -$${exp.cost.toLocaleString()}`);
      G.uiDirty = true;
      popup.remove();
    });
  }

  cancelBtn.addEventListener('click', () => {
    sfxClick();
    popup.remove();
  });

  // Close on click outside
  setTimeout(() => {
    const closer = (e) => {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('mousedown', closer);
      }
    };
    document.addEventListener('mousedown', closer);
  }, 100);
}

function hitTestExpansion(sx, sy) {
  const { tx, ty } = toTile(sx, sy);
  for (const exp of getAllExpansions()) {
    if (isExpansionPurchased(exp.id)) continue;
    if (!isExpansionAvailable(exp)) continue;
    if (tx >= exp.x && tx < exp.x + exp.w && ty >= exp.y && ty < exp.y + exp.h) {
      return exp;
    }
  }
  return null;
}

// ─── Click handler ─────────────────────────────────────────
setClickHandler((sx, sy) => {
  // Close any open expansion popup
  const existingPopup = document.getElementById('expansion-popup');
  if (existingPopup) { existingPopup.remove(); return; }

  // Build mode takes priority
  if (G.buildMode && handleBuildClick(sx, sy)) {
    renderBuildPanel();
    return;
  }

  // Check expansion zone clicks
  const hitExp = hitTestExpansion(sx, sy);
  if (hitExp) {
    showExpansionPopup(hitExp, sx, sy);
    return;
  }

  // Check interactive furniture clicks
  if (G._hoveredFurniture) {
    const { furniture, room } = G._hoveredFurniture;
    showEquipmentPanel(furniture, room);
    return;
  }

  // Check agent clicks
  const zoom = getZoom();
  for (const agent of G.agents) {
    const s = toScreen(agent.x, agent.y);
    const dx = sx - s.x, dy = sy - (s.y - 10 * zoom);
    if (Math.abs(dx) < 14 * zoom && Math.abs(dy) < 20 * zoom) {
      selectAgent(agent);
      return;
    }
  }

  // Clicked empty space
  deselectAgent();
  hideEquipmentPanel();
});

// ─── Keyboard ──────────────────────────────────────────────
initKeyboard({
  onDeselect: deselectAgent,
  onBuildModeToggle: () => {
    setBuildPanelMode('build');
    toggleBuildPanel(G.buildMode);
    if (!G.buildMode) { setSelectedRoomType(null); setCorridorMode(false); resetRotation(); }
    const hireBtn = document.getElementById('hire-btn');
    if (hireBtn) hireBtn.classList.remove('active');
    const buildButton = document.getElementById('build-btn');
    if (buildButton) buildButton.classList.toggle('active', G.buildMode);
    renderBuildPanel();
  },
  onBuildModeExit: () => {
    toggleBuildPanel(false);
    setSelectedRoomType(null);
    setCorridorMode(false);
    resetRotation();
    setBuildPanelMode('build');
    const buildButton = document.getElementById('build-btn');
    if (buildButton) buildButton.classList.remove('active');
    const hireBtn = document.getElementById('hire-btn');
    if (hireBtn) hireBtn.classList.remove('active');
  },
  onRotate: () => {
    cycleRotation();
  },
  onHireModeToggle: () => {
    const panel = document.getElementById('build-panel');
    const hireButton = document.getElementById('hire-btn');
    const buildButton = document.getElementById('build-btn');
    const alreadyOpenForHire = panel?.classList.contains('visible') && hireButton?.classList.contains('active');
    const willShow = !alreadyOpenForHire;

    setBuildPanelMode('hire');
    G.buildMode = false;
    setSelectedRoomType(null);
    toggleBuildPanel(willShow);

    if (hireButton) hireButton.classList.toggle('active', willShow);
    if (buildButton) buildButton.classList.remove('active');
    renderBuildPanel();
  },
});

// ─── Build button ──────────────────────────────────────────
const buildBtn = document.getElementById('build-btn');
if (buildBtn) {
  buildBtn.addEventListener('click', () => {
    sfxClick();
    setBuildPanelMode('build');
    G.buildMode = !G.buildMode;
    toggleBuildPanel(G.buildMode);
    if (!G.buildMode) { setSelectedRoomType(null); setCorridorMode(false); }
    buildBtn.classList.toggle('active', G.buildMode);
    const hireBtn = document.getElementById('hire-btn');
    if (hireBtn) hireBtn.classList.remove('active');
    renderBuildPanel();
  });
}

const hireBtn = document.getElementById('hire-btn');
if (hireBtn) {
  hireBtn.addEventListener('click', () => {
    sfxClick();
    const panel = document.getElementById('build-panel');
    const alreadyOpenForHire = panel?.classList.contains('visible') && hireBtn.classList.contains('active');
    const willShow = !alreadyOpenForHire;

    setBuildPanelMode('hire');
    G.buildMode = false;
    setSelectedRoomType(null);
    toggleBuildPanel(willShow);

    hireBtn.classList.toggle('active', willShow);
    if (buildBtn) buildBtn.classList.remove('active');
    renderBuildPanel();
  });
}

// Agent panel close
const closeBtn = document.querySelector('#agent-panel .btn-close');
if (closeBtn) closeBtn.addEventListener('click', deselectAgent);

// Music toggle
const musicBtn = document.getElementById('music-btn');
if (musicBtn) {
  musicBtn.addEventListener('click', () => {
    resumeAudioCtx();
    const playing = toggleMusic();
    musicBtn.textContent = playing ? '🎵' : '🔇';
  });
}

const levelIntro = document.getElementById('level-intro');
if (levelIntro) levelIntro.addEventListener('click', hideIntro);

// ─── AI CEO button (in-game toggle) ────────────────────
const aiCeoBtn = document.getElementById('ai-ceo-btn');
if (aiCeoBtn) {
  aiCeoBtn.addEventListener('click', () => {
    sfxClick();
    const enabled = toggleAiCeo();
    aiCeoBtn.style.background = enabled ? 'linear-gradient(135deg, rgba(60,120,200,0.3), rgba(40,80,160,0.4))' : 'transparent';
    aiCeoBtn.style.color = enabled ? '#80c0ff' : 'var(--text-dim)';
    aiCeoBtn.style.borderColor = enabled ? 'rgba(100,180,255,0.4)' : 'var(--border)';
  });
}

// ─── AI CEO button in mission modal ────────────────────
let startWithAiCeo = false;
const missionAiBtn = document.getElementById('mission-ai-btn');
if (missionAiBtn) {
  missionAiBtn.addEventListener('click', () => {
    resumeAudioCtx();
    sfxClick();
    startWithAiCeo = true;
    // Hide welcome, show company picker
    missionModal.style.display = 'none';
    pickerModal.style.display = 'flex';
  });
}

// ─── Restart Handler ──────────────────────────────────────
window.addEventListener('studio-tycoon-restart', () => {
  // Reset game state
  G.reset();

  // Re-init map (need to reimport these)
  // For now, just reload the page for a clean restart
  window.location.reload();
});

// ─── Game Loop ─────────────────────────────────────────────
let lastTime = 0;
let uiCounter = 0;

function gameLoop(time) {
  const rawDt = Math.min((time - lastTime) / 16.67, 4);
  lastTime = time;
  const dt = rawDt * G.gameSpeed;
  G.gameTick += dt;
  G.frameCount++;

  // Smooth zoom
  smoothZoom();

  // Simulation
  simulationTick(dt);

  // AI CEO autonomous play (pass rawDt so it works even when paused for events)
  aiCeoTick(dt || rawDt);

  // Hover detection
  updateHover();

  // Render
  render();

  // UI updates (throttled)
  uiCounter++;
  if (uiCounter % 20 === 0) {
    updateUI();
    updateStrategyPanel();
    updateCashflowGraph();
    // Refresh build panel affordability
    if (uiCounter % 60 === 0) {
      const panel = document.getElementById('build-panel');
      if (panel?.classList.contains('visible')) renderBuildPanel();
    }
  }
  if (uiCounter % 30 === 0) drawMinimap();

  requestAnimationFrame(gameLoop);
}

// ─── Start ─────────────────────────────────────────────────
updateUI();
updateStrategyPanel();
requestAnimationFrame(gameLoop);

console.log('🐾 Shelter Tycoon loaded - Monroe WordPress integration active');
console.log('B = Build mode | C = Corridor tool | R = Rotate | Drag = Pan | Scroll = Zoom');
