import test from 'node:test';
import assert from 'node:assert/strict';

import { CatwalkEngine } from './game.ts';

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
