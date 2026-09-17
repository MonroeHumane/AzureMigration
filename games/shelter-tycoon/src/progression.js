// ═══════════════════════════════════════════════════════════════
//  SHELTER TYCOON - Progressive Facility Unlocks (Tech Tree)
// ═══════════════════════════════════════════════════════════════

import { OFFICE_TYPES, COMMON_ROOMS, COMPANY_TYPES } from './config.js';
import { countRoomsByType, getRoomInstances } from './map.js';
import { G } from './game.js';

const TECH_TREES = {
  animal_shelter: {
    lobby:    { tier: 0, requirement: 'Starting facility', check: () => true, progress: () => 'Available' },
    kennel:   { tier: 1, requirement: 'Tier 1 - Wire Kennels ($1,200)', check: () => G.money >= 1200 || countRoomsByType('kennel') > 0, progress: () => countRoomsByType('kennel') > 0 ? 'Built' : `$${Math.round(G.money).toLocaleString()} / $1,200` },
    cattery:  { tier: 1, requirement: 'Tier 1 - Basic Cattery ($1,200)', check: () => G.money >= 1200 || countRoomsByType('cattery') > 0, progress: () => countRoomsByType('cattery') > 0 ? 'Built' : `$${Math.round(G.money).toLocaleString()} / $1,200` },
    breakroom:{ tier: 1, requirement: 'Intake at least 1 pet', check: () => G.agents.some(a => a.petId != null), progress: () => `${G.agents.filter(a => a.petId).length}/1 pets` },
    playyard: { tier: 2, requirement: 'Tier 2 - 3 adoptions & $5,000 cash', check: () => (G.adoptedCount || 0) >= 3 && G.money >= 5000, progress: () => `${G.adoptedCount || 0}/3 adoptions · $${Math.round(G.money).toLocaleString()}/5K` },
    meeting:  { tier: 2, requirement: 'Build Kennel + Cattery', check: () => countRoomsByType('kennel') > 0 && countRoomsByType('cattery') > 0, progress: () => `Kennel ${countRoomsByType('kennel') > 0 ? '✓' : '✗'} · Cattery ${countRoomsByType('cattery') > 0 ? '✓' : '✗'}` },
    vetbay:   { tier: 3, requirement: 'Tier 3 - 8 adoptions & $12,000 cash', check: () => (G.adoptedCount || 0) >= 8 && G.money >= 12000, progress: () => `${G.adoptedCount || 0}/8 adoptions · $${Math.round(G.money).toLocaleString()}/12K` },
  },
};

const BRANCH_NODES = {
  outreach: {
    name: 'Community Outreach',
    icon: '📣',
    tier: 3,
    description: '+25% adopter visits from reputation',
    cost: 5000,
    requirement: '5 successful adoptions',
    check: () => (G.adoptedCount || 0) >= 5 && G.money >= 5000,
    progress: () => `${G.adoptedCount || 0}/5 adoptions · $${Math.round(G.money).toLocaleString()}/5K`,
    excludes: [],
  },
  enrichment: {
    name: 'Enrichment Program',
    icon: '🎾',
    tier: 3,
    description: 'Play Yard socialization +50% faster',
    cost: 4000,
    requirement: 'Play Yard built',
    check: () => countRoomsByType('playyard') > 0 && G.money >= 4000,
    progress: () => `Play Yard ${countRoomsByType('playyard') > 0 ? '✓' : '✗'} · $${Math.round(G.money).toLocaleString()}/4K`,
    excludes: [],
  },
  clinic: {
    name: 'Low-Cost Clinic',
    icon: '💉',
    tier: 3,
    description: 'Vet Bay reduces medical upkeep 40%',
    cost: 6000,
    requirement: 'Vet Bay built',
    check: () => countRoomsByType('vetbay') > 0 && G.money >= 6000,
    progress: () => `Vet Bay ${countRoomsByType('vetbay') > 0 ? '✓' : '✗'} · $${Math.round(G.money).toLocaleString()}/6K`,
    excludes: [],
  },
};

for (const key of Object.keys(BRANCH_NODES)) {
  BRANCH_NODES[key].excludes = Object.keys(BRANCH_NODES).filter(k => k !== key);
}

function getRulesForCompanyType() {
  const typeKey = G.companyType || 'animal_shelter';
  return TECH_TREES[typeKey] || TECH_TREES.animal_shelter;
}

function getRoomDef(typeKey) {
  return OFFICE_TYPES[typeKey] || COMMON_ROOMS[typeKey];
}

function ensureUnlockSet() {
  if (!G.unlockedRooms || !(G.unlockedRooms instanceof Set)) {
    G.unlockedRooms = new Set(['lobby']);
  }
  const typeKey = G.companyType || 'animal_shelter';
  const companyDef = COMPANY_TYPES[typeKey];
  if (companyDef) {
    for (const key of companyDef.startUnlocked) G.unlockedRooms.add(key);
  }
}

export function getRoomLabel(typeKey) {
  return getRoomDef(typeKey)?.name || typeKey;
}

export function syncRoomUnlocks() {
  ensureUnlockSet();
  const rules = getRulesForCompanyType();
  const newlyUnlocked = [];
  for (const [roomKey, rule] of Object.entries(rules)) {
    if (G.unlockedRooms.has(roomKey)) continue;
    if (rule.check()) {
      G.unlockedRooms.add(roomKey);
      newlyUnlocked.push(roomKey);
    }
  }
  return newlyUnlocked;
}

export function getRoomUnlockState(typeKey) {
  ensureUnlockSet();
  const rules = getRulesForCompanyType();
  const rule = rules[typeKey];
  if (!rule) {
    return { unlocked: true, tier: 1, requirement: 'No requirement', progress: 'Available' };
  }
  if (G.unlockedRooms.has(typeKey)) {
    return { unlocked: true, tier: rule.tier, requirement: rule.requirement, progress: 'Unlocked' };
  }
  return { unlocked: false, tier: rule.tier, requirement: rule.requirement, progress: rule.progress() };
}

export function getUnlockTree() {
  const rules = getRulesForCompanyType();
  const tree = [];
  for (const [roomKey, rule] of Object.entries(rules)) {
    const def = getRoomDef(roomKey);
    const state = getRoomUnlockState(roomKey);
    tree.push({
      key: roomKey,
      name: def?.name || roomKey,
      icon: def?.icon || '🏠',
      tier: rule.tier,
      unlocked: state.unlocked,
      requirement: state.requirement,
      progress: state.progress,
      type: 'room',
    });
  }

  const chosenBranches = new Set(G.techTreeBranches || []);
  const excludedByChosen = new Set();
  for (const chosen of chosenBranches) {
    const node = BRANCH_NODES[chosen];
    if (node) node.excludes.forEach(k => excludedByChosen.add(k));
  }

  for (const [key, node] of Object.entries(BRANCH_NODES)) {
    const chosen = chosenBranches.has(key);
    const excluded = excludedByChosen.has(key) && !chosen;
    tree.push({
      key,
      name: node.name,
      icon: node.icon,
      tier: node.tier,
      unlocked: chosen,
      excluded,
      requirement: node.description,
      progress: chosen ? 'Chosen' : excluded ? 'Locked' : node.progress(),
      type: 'branch',
      canChoose: !chosen && !excluded && node.check(),
      cost: node.cost,
    });
  }

  return tree.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
}

export function chooseTechBranch(key) {
  const node = BRANCH_NODES[key];
  if (!node) return false;
  if ((G.techTreeBranches || []).includes(key)) return false;
  if (!node.check()) return false;
  if (G.money < node.cost) return false;
  G.money -= node.cost;
  if (!G.techTreeBranches) G.techTreeBranches = [];
  G.techTreeBranches.push(key);
  return true;
}

export function hasSpecializeBranch() { return false; }
export function hasDiversifyBranch() { return false; }
export function hasScaleOpsBranch() { return false; }

export function hasOutreachBranch() {
  return (G.techTreeBranches || []).includes('outreach');
}

export function hasEnrichmentBranch() {
  return (G.techTreeBranches || []).includes('enrichment');
}

export function hasClinicBranch() {
  return (G.techTreeBranches || []).includes('clinic');
}

export function isOfficeAvailable(officeKey) {
  const typeKey = G.companyType || 'animal_shelter';
  const companyDef = COMPANY_TYPES[typeKey];
  if (!companyDef) return true;
  if (['lobby', 'breakroom', 'meeting'].includes(officeKey)) return true;
  return companyDef.available.includes(officeKey);
}
