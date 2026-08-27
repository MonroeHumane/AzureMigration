// ═══════════════════════════════════════════════════════════════
//  SHELTER TYCOON - Pet Intake (Monroe pet-catalog API)
// ═══════════════════════════════════════════════════════════════

import {
  AGENT_ROLES, INTAKE_COST, getRoleForPet, getHabitatForSpecies, PROJECT_TEMPLATES,
} from './config.js';
import { G } from './game.js';
import { Agent } from './agent.js';
import { Project } from './project.js';
import { getRoomInstances } from './map.js';
import { getActivePlan } from './floorplan.js';
import {
  loadMonroePets, refreshAvailablePets,
} from './monroe-api.js?v=13';
import { showToast } from './ui/toast.js';
import { sfxBuild, sfxError } from './sfx.js';

let intakeReady = false;
let catalogUsingDemoFallback = false;

const DEMO_PETS = [
  { id: 'demo_1', name: 'Buddy', species: 'dog', age: 3, photo_url: null },
  { id: 'demo_2', name: 'Whiskers', species: 'cat', age: 2, photo_url: null },
  { id: 'demo_3', name: 'Thumper', species: 'rabbit', age: 1, photo_url: null },
];

function loadDemoCatalog() {
  G.shelterCatalog = [...DEMO_PETS];
  refreshAvailablePets();
  catalogUsingDemoFallback = true;
  intakeReady = G.availablePets.length > 0;
}

export async function initIntakeCatalog(options = {}) {
  const { reload = true } = options;
  try {
    if (reload) {
      await loadMonroePets();
    } else {
      refreshAvailablePets();
    }
    catalogUsingDemoFallback = false;
    intakeReady = true;
    return G.availablePets.length;
  } catch (error) {
    console.error('Failed to load Monroe pet catalog.', error);
    loadDemoCatalog();
    showToast('Pet catalog unavailable - demo pets loaded. Tap Refresh to retry the API.');
    return G.availablePets.length;
  }
}

export function isIntakeReady() {
  return intakeReady && (G.availablePets?.length || 0) > 0;
}

export function isUsingDemoCatalog() {
  return catalogUsingDemoFallback;
}

export function getIntakeQueue() {
  return (G.availablePets || []).slice(0, 12);
}

export function peekNextIntakePet() {
  const queue = G.availablePets || [];
  return queue.length > 0 ? queue[0] : null;
}

function pickRandomIntakePet() {
  const queue = G.availablePets || [];
  if (queue.length === 0) return null;
  const idx = Math.floor(Math.random() * queue.length);
  return queue.splice(idx, 1)[0];
}

function getCarePlanTemplate(habitat) {
  return PROJECT_TEMPLATES.find(t => t.isCarePlan && t.office === habitat)
    || PROJECT_TEMPLATES.find(t => t.isCarePlan);
}

function habitatHasCapacity(habitat) {
  const rooms = getRoomInstances().filter(r => r.typeKey === habitat && r.constructionProgress >= 1);
  if (rooms.length === 0) return false;
  const petsInHabitat = G.agents.filter(a => a.petId && a.role?.office === habitat).length;
  return petsInHabitat < rooms.length * 3;
}

export function canIntakePet(pet) {
  if (!pet) return { ok: false, reason: 'No pet selected.' };
  if (G.money < INTAKE_COST) return { ok: false, reason: 'Not enough funds for intake processing.' };
  const habitat = getHabitatForSpecies(pet.species);
  if (!getRoomInstances().some(r => r.typeKey === habitat && r.constructionProgress >= 1)) {
    return { ok: false, reason: `Build a ${habitat === 'cattery' ? 'Cattery' : habitat === 'kennel' ? 'Kennel' : habitat === 'playyard' ? 'Play Yard' : 'habitat room'} first.` };
  }
  if (!habitatHasCapacity(habitat)) {
    return { ok: false, reason: 'That habitat is full - expand or build another room.' };
  }
  return { ok: true, habitat };
}

export function intakePet(pet = null) {
  refreshAvailablePets();
  const chosen = pet || pickRandomIntakePet();
  if (!chosen) {
    sfxError();
    showToast('No pets available in the Monroe catalog.');
    return null;
  }

  const check = canIntakePet(chosen);
  if (!check.ok) {
    sfxError();
    showToast(check.reason);
    if (pet) refreshAvailablePets();
    return null;
  }

  G.money -= INTAKE_COST;
  refreshAvailablePets();

  const roleKey = getRoleForPet(chosen);
  const habitat = check.habitat || getHabitatForSpecies(chosen.species);

  const plan = getActivePlan();
  const lp = plan ? plan.lobbyPos : { x: 10, y: 18 };
  const spawn = { x: lp.x + 2, y: lp.y + 2 };

  const profile = {
    name: chosen.name,
    avatar: chosen.photo_url || chosen.photo || null,
    petId: chosen.id,
    species: chosen.species,
    age: chosen.age,
    mood: 0.75,
    skill: 0.45,
    motivation: 0.8,
    alignment: 0.85,
    seniority: 2,
  };

  const agent = new Agent(roleKey, spawn.x, spawn.y, profile);
  agent.petId = chosen.id;
  agent.species = chosen.species;
  agent.age = chosen.age;
  agent.readyForAdoption = false;
  G.agents.push(agent);

  const officeRoom = getRoomInstances().find(r => r.typeKey === habitat && r.constructionProgress >= 1);
  if (officeRoom) {
    setTimeout(() => agent.moveToRoom(officeRoom.id), 200);
  }

  const tpl = getCarePlanTemplate(habitat);
  if (tpl) {
    const carePlan = new Project(tpl, 1.0);
    carePlan.name = `${chosen.name}'s Care Plan`;
    carePlan.petId = chosen.id;
    carePlan.petAgent = agent;
    carePlan.state = 'in_progress';
    agent.task = carePlan;
    G.projects.push(carePlan);
  }

  G.completedTriggers.add('first_hire');
  G.completedTriggers.add('first_intake');
  if (tpl) G.completedTriggers.add('first_project');
  sfxBuild();
  showToast(`🐾 ${chosen.name} arrived! Intake fee $${INTAKE_COST}. Care plan started.`);
  G.uiDirty = true;
  return agent;
}

export function intakeRandomPet() {
  refreshAvailablePets();
  if ((G.availablePets || []).length === 0) {
    sfxError();
    showToast('No more pets available for intake.');
    return null;
  }
  const pet = pickRandomIntakePet();
  const result = intakePet(pet);
  if (!result) {
    G.availablePets.unshift(pet);
    refreshAvailablePets();
  }
  return result;
}

// Compatibility stubs for legacy imports
export function rollCandidatesForRole() { return []; }
export function getCandidatesForRole() { return []; }
export function consumeCandidate() { return null; }
export function clearCandidatesForRole() {}
export function hasHRStaff() { return true; }
