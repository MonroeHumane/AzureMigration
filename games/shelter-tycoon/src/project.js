// ═══════════════════════════════════════════════════════════════
//  SHELTER TYCOON - Care Plan Class (phases, quality, deadlines)
// ═══════════════════════════════════════════════════════════════

import { CARE_PLAN_PHASES } from './config.js';

let nextProjId = 0;

export function getNextProjectId() { return nextProjId; }

export function setNextProjectId(id) {
  nextProjId = Math.max(0, id);
}

export class Project {
  constructor(template, reputationPremium = 1.0) {
    this.id = nextProjId++;
    this.template = template;
    this.name = template.name + ' #' + (this.id + 1);
    this.phases = template.phases ? [...template.phases] : [...CARE_PLAN_PHASES];
    this.phaseIdx = 0;
    this.phaseProgress = 0;
    this.phaseTime = template.time / this.phases.length;
    this.state = 'waiting';
    this.assignedAgents = [];
    this.pay = template.cost ? template.basePay : Math.round(template.basePay * reputationPremium);
    this.stalled = false;
    this.qualityScore = 0.5;
    this.deadline = template.time * 2.5;
    this.dayAge = 0;
    this.salesClosed = false;
    this.synergyLabels = [];
    this.source = 'intake';
    this.petId = null;
    this.petAgent = null;
    this.isCarePlan = !!template.isCarePlan;
  }

  get currentPhase() { return this.phases[this.phaseIdx]; }
  get targetOffice() { return this.template.office; }
  get progress() { return (this.phaseIdx + this.phaseProgress) / this.phases.length; }
  get isOverdue() { return this.dayAge > this.deadline; }
  get isReadyForAdoption() {
    return this.isCarePlan && this.currentPhase === 'ready' && this.phaseIdx >= this.phases.length - 1 && this.state !== 'done';
  }

  advancePhase(qualityContribution) {
    this.qualityScore += qualityContribution || 0;
    this.phaseIdx++;
    this.phaseProgress = 0;
    this.assignedAgents = [];

    if (this.phaseIdx >= this.phases.length) {
      this.state = 'done';
      this.qualityScore /= this.phases.length;
      if (this.petAgent) {
        this.petAgent.readyForAdoption = true;
      }
      return true;
    }
    this.state = 'waiting';
    return false;
  }

  get deadlineRemaining() {
    return Math.max(0, this.deadline - this.dayAge);
  }

  get deadlineUrgent() {
    return this.deadlineRemaining / this.deadline < 0.3;
  }

  getFinalPay() {
    if (this.isCarePlan) return 0;
    const qualityMultiplier = 0.5 + this.qualityScore * 1.0;
    return Math.round(this.pay * qualityMultiplier);
  }

  getReputationChange() {
    if (this.isCarePlan) {
      if (this.qualityScore > 0.6) return 1;
      return 0;
    }
    if (this.qualityScore > 0.7) return 2;
    if (this.qualityScore > 0.4) return 1;
    if (this.isOverdue) return -1;
    return 0;
  }

  getPhaseLabel() {
    const labels = {
      intake: 'Intake',
      medical: 'Medical Check',
      socialization: 'Socialization',
      ready: 'Ready for Adoption',
    };
    return labels[this.currentPhase] || this.currentPhase;
  }
}
