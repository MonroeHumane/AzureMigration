import test from 'node:test';
import assert from 'node:assert/strict';

import { CatwalkEngine, getStageConfig, getDogLanesForStage, getFishboneLanesForStage } from './game.ts';

test('start() gives a forgiving first patrol', () => {
  const engine = new CatwalkEngine();
  engine.start();

  assert.equal(engine.state.lives, 6);
  assert.ok(engine.state.time >= 52, `expected a longer opening window, got ${engine.state.time}`);
  assert.equal(engine.state.status, 'playing');
});

test('fresh state starts with a safe spawn window', () => {
  const engine = new CatwalkEngine();
  engine.start();

  assert.ok(engine.state.cat.invulnerable > 0 && engine.state.cat.invulnerable <= 0.8, `expected a brief protective blink, got ${engine.state.cat.invulnerable}`);
});

test('stages scale progressively without becoming impossible', () => {
  const s1 = getStageConfig(1);
  const s2 = getStageConfig(2);
  const s3 = getStageConfig(3);
  const s5 = getStageConfig(5);
  const s10 = getStageConfig(10);

  // Speed increases moderately, capped for human reaction times
  assert.ok(s2.speedMultiplier > s1.speedMultiplier);
  assert.ok(s3.speedMultiplier > s2.speedMultiplier);
  assert.ok(s5.speedMultiplier <= 1.4, `speed at stage 5 should be fair, got ${s5.speedMultiplier}`);
  assert.ok(s10.speedMultiplier <= 1.5, `speed at stage 10 should cap gently, got ${s10.speedMultiplier}`);

  // Time stays ample to clear 5 homes
  assert.ok(s5.roundTime >= 35, `round time at stage 5 should allow deliberate jumps, got ${s5.roundTime}`);
  assert.ok(s10.roundTime >= 28, `high-level round time should not starve player, got ${s10.roundTime}`);

  // Check lane platform and gap fairness
  const dogLanesS1 = getDogLanesForStage(1);
  const dogLanesS5 = getDogLanesForStage(5);
  dogLanesS5.forEach((lane, idx) => {
    assert.ok(lane.gap >= 260, `dog gap in lane ${idx} must remain wide enough to cross, got ${lane.gap}`);
    assert.ok(lane.gap <= dogLanesS1[idx].gap, 'dog gaps should tighten as stage increases');
  });

  const fishLanesS5 = getFishboneLanesForStage(5);
  fishLanesS5.forEach((lane, idx) => {
    assert.ok(lane.length >= 140, `fishbone platform in lane ${idx} must remain rideable, got ${lane.length}`);
  });
});

