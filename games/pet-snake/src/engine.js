// Pet Snake Adventure — Pure Deterministic Gameplay Engine
// Free of DOM dependencies. Exposes state, events, and sub-tick interpolation for 60fps rendering.

import {
  BOARD_SIZES,
  DIFFICULTIES,
  STARTING_MODIFIERS,
  TREAT_TYPES,
  POWERUP_TYPES,
  AFFIX_DEFINITIONS,
  ALL_UPGRADES,
  FLOOR_SCRIPT,
  MASCOTS,
  CONTINUE_COST,
  ROUTE_SKIP_COINS
} from './config.js';

const VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export const GAME_PHASES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  REWARD: 'reward',
  VICTORY: 'victory',
  DEFEAT: 'defeat'
};

export class PetSnakeEngine {
  constructor(options = {}) {
    this.options = options;
    this.eventListeners = new Map();

    // Core state
    this.phase = GAME_PHASES.IDLE;
    this.floorIndex = 0;
    this.currentFloor = null;
    this.boardSize = BOARD_SIZES.roomy;
    this.mascot = MASCOTS[0];
    this.startingModifier = STARTING_MODIFIERS[0];

    // Stats
    this.score = 0;
    this.coinsEarned = 0;
    this.hearts = 3;
    this.maxHearts = 3;
    this.streak = 0;
    this.bestStreak = 0;
    this.treatsCollected = 0;
    this.treatBreakdown = { fish: 0, bone: 0, biscuit: 0, steak: 0 };
    this.rescuedPets = [];

    // Entities
    this.snake = [];
    this.snakePrev = [];
    this.direction = { x: 1, y: 0 };
    this.inputQueue = [];
    this.treats = [];
    this.powerup = null;
    this.bomb = null;
    this.obstacles = [];
    this.vacuum = null;
    this.vacuumPrev = null;
    this.vacuumTail = [];

    // Upgrades & Modifiers
    this.upgrades = [];
    this.flags = this.createDefaultFlags();
    this.persistentTickScalar = 1.0;

    // Timing & Physics
    this.tickMs = 175;
    this.tickTimer = 0;
    this.graceMs = 0;
    this.activeEffects = { speed: 0, score: 0, shield: 0 };
    this.goalTimer = 0;
    this.bossPhase = 0;

    // Route & Upgrade Drafting
    this.draftUpgrades = [];
    this.routeChoices = [];
    this.selectedRouteIndex = 0;
    this.draftedUpgradeThisFloor = false;

    // Screen Shake & FX Events
    this.shakeIntensity = 0;
    this.shakeDecay = 0.9;
    this.recentEvents = [];
  }

  createDefaultFlags() {
    return {
      zoomieCollar: false,
      therapyCollar: false,
      therapyTreatCount: 0,
      luckyCollar: false,
      ironCollar: false,
      ironShieldActive: false,
      awarenessCollar: false,
      vacuumToy: false,
      bombPlushie: false,
      featherWand: false,
      featherCharge: 0,
      catnipMouse: false,
      catnipTimestamps: [],
      scratchingPost: false,
      scratchingPostCharge: 0,
      cozyBlanket: false,
      snackStreaks: false,
      treatMagnet: false,
      gourmetPalate: false,
      scavenger: false,
      secondHelping: false,
      efficientDigestion: false,
      digestionCount: 0,
      bombImmunity: false
    };
  }

  // ── Event Bus ─────────────────────────────────────────────────────────────
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
    return () => {
      const arr = this.eventListeners.get(event);
      if (arr) {
        const idx = arr.indexOf(callback);
        if (idx !== -1) arr.splice(idx, 1);
      }
    };
  }

  emit(event, payload = {}) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(cb => {
        try { cb(payload); } catch (err) { console.error('Engine event error:', err); }
      });
    }
  }

  // ── Run Lifecycle ─────────────────────────────────────────────────────────
  startRun(startingModifierKey = 'normal', mascotId = 'cat') {
    this.startingModifier = STARTING_MODIFIERS.find(m => m.key === startingModifierKey) || STARTING_MODIFIERS[0];
    this.mascot = MASCOTS.find(m => m.id === mascotId) || MASCOTS[0];

    this.score = 0;
    this.coinsEarned = 0;
    this.hearts = this.startingModifier.hearts;
    this.maxHearts = this.startingModifier.hearts;
    this.streak = 0;
    this.bestStreak = 0;
    this.treatsCollected = 0;
    this.treatBreakdown = { fish: 0, bone: 0, biscuit: 0, steak: 0 };
    this.rescuedPets = [];
    this.upgrades = [];
    this.flags = this.createDefaultFlags();
    this.flags.bombImmunity = !!this.startingModifier.bombImmunity;
    this.persistentTickScalar = this.startingModifier.tickScalar || 1.0;

    this.floorIndex = 0;
    this.startFloor(this.floorIndex);
    this.phase = GAME_PHASES.PLAYING;
    this.emit('run:start', { floor: 1, modifier: this.startingModifier });
  }

  startFloor(floorIndex, { retry = false } = {}) {
    this.floorIndex = floorIndex;
    const floorDef = FLOOR_SCRIPT[floorIndex] || FLOOR_SCRIPT[FLOOR_SCRIPT.length - 1];
    this.currentFloor = {
      ...floorDef,
      affixes: [...(floorDef.affixes || [])]
    };

    const boardKey = this.currentFloor.board || 'roomy';
    this.boardSize = BOARD_SIZES[boardKey] || 19;
    const diffKey = this.currentFloor.difficulty || 'normal';
    const diff = DIFFICULTIES[diffKey] || DIFFICULTIES.normal;

    // Reset floor-specific charges
    this.flags.featherCharge = this.flags.featherWand ? 1 : 0;
    this.flags.ironShieldActive = this.flags.ironCollar;
    this.flags.scratchingPostCharge = this.flags.scratchingPost ? 1 : 0;
    this.flags.catnipTimestamps = [];

    // Set tick and grace period
    let grace = diff.graceMs;
    if (this.flags.cozyBlanket) grace = Math.round(grace * 1.5);
    this.graceMs = grace;
    this.tickMs = diff.tick;
    this.tickTimer = 0;
    this.goalTimer = 0;
    this.bossPhase = 0;

    // Initialize snake
    const mid = Math.floor(this.boardSize / 2);
    this.snake = [
      { x: mid + 1, y: mid },
      { x: mid, y: mid },
      { x: mid - 1, y: mid }
    ];
    this.snakePrev = this.snake.map(s => ({ ...s }));
    this.direction = { x: 1, y: 0 };
    this.inputQueue = [];

    // Setup hazards and obstacles
    this.obstacles = this.generateObstacles(diff.obstacleDensity);
    this.treats = [];
    this.powerup = null;
    this.bomb = null;
    this.vacuum = null;
    this.vacuumPrev = null;
    this.vacuumTail = [];

    // Vacuum setup if active
    if (this.currentFloor.vacuum) {
      const vY = Math.random() < 0.5 ? 2 : this.boardSize - 3;
      const vX = Math.random() < 0.5 ? 2 : this.boardSize - 3;
      this.vacuum = {
        x: vX,
        y: vY,
        dir: { x: 0, y: 1 },
        stepTimer: 0,
        difficulty: this.currentFloor.vacuum.difficulty || 'normal'
      };
      this.vacuumPrev = { ...this.vacuum };
    }

    // Spawn initial treats
    const initialTreatCount = this.currentFloor.affixes.includes('abundance') ? 3 : 1;
    for (let i = 0; i < initialTreatCount; i++) {
      this.spawnTreat();
    }

    this.draftedUpgradeThisFloor = false;
    this.phase = GAME_PHASES.PLAYING;
    this.emit('floor:start', { floor: floorIndex + 1, goal: this.currentFloor.goal, affixes: this.currentFloor.affixes });
  }

  generateObstacles(density) {
    const list = [];
    const total = Math.floor(this.boardSize * this.boardSize * density);
    const mid = Math.floor(this.boardSize / 2);
    let attempts = 0;

    while (list.length < total && attempts < 300) {
      attempts++;
      const x = Math.floor(Math.random() * this.boardSize);
      const y = Math.floor(Math.random() * this.boardSize);
      // Keep clear of starting snake center zone (5x5)
      if (Math.abs(x - mid) <= 2 && Math.abs(y - mid) <= 2) continue;
      if (!list.some(o => o.x === x && o.y === y)) {
        list.push({ x, y });
      }
    }
    return list;
  }

  // ── Input Handling ────────────────────────────────────────────────────────
  enqueueDirection(dirKey) {
    if (this.phase !== GAME_PHASES.PLAYING && this.phase !== GAME_PHASES.PAUSED) return;
    const v = VECTORS[dirKey];
    if (!v) return;

    const lastDir = this.inputQueue.length > 0 ? this.inputQueue[this.inputQueue.length - 1] : this.direction;
    // Prevent 180° reverse direction into own body
    if (lastDir.x + v.x === 0 && lastDir.y + v.y === 0) return;

    if (this.inputQueue.length < 3) {
      this.inputQueue.push(v);
    }
  }

  togglePause() {
    if (this.phase === GAME_PHASES.PLAYING) {
      this.phase = GAME_PHASES.PAUSED;
      this.emit('pause');
    } else if (this.phase === GAME_PHASES.PAUSED) {
      this.phase = GAME_PHASES.PLAYING;
      this.emit('resume');
    }
  }

  // ── Game Loop Update (called per frame with dt in seconds) ─────────────────
  update(dt) {
    if (this.phase !== GAME_PHASES.PLAYING) return;

    // Decay screen shake
    if (this.shakeIntensity > 0) {
      this.shakeIntensity *= Math.pow(this.shakeDecay, dt * 60);
      if (this.shakeIntensity < 0.2) this.shakeIntensity = 0;
    }

    // Grace period timer
    if (this.graceMs > 0) {
      this.graceMs = Math.max(0, this.graceMs - dt * 1000);
    }

    // Active powerups expiration
    for (const key of Object.keys(this.activeEffects)) {
      if (this.activeEffects[key] > 0) {
        this.activeEffects[key] = Math.max(0, this.activeEffects[key] - dt * 1000);
      }
    }

    // Goal Timer for Survival & Boss Floors
    const goal = this.currentFloor?.goal;
    if (goal && (goal.type === 'survive' || goal.type === 'vacuumHunt' || goal.type === 'boss')) {
      this.goalTimer += dt * 1000;

      // Scripted Boss Phases on Floor 15
      if (goal.type === 'boss') {
        const progress = this.goalTimer / goal.targetMs;
        if (progress >= 0.33 && this.bossPhase === 0) {
          this.bossPhase = 1;
          this.triggerScreenShake(8);
          // Phase 2: dust piles / bomb traps erupt
          const extraObstacles = this.generateObstacles(0.04);
          this.obstacles.push(...extraObstacles);
          this.emit('boss:phase', { phase: 2, desc: 'Phase 2: Dust Piles Erupt!' });
        } else if (progress >= 0.66 && this.bossPhase === 1) {
          this.bossPhase = 2;
          this.triggerScreenShake(12);
          // Phase 3: Vacuum moves faster with longer tail
          this.emit('boss:phase', { phase: 3, desc: 'Phase 3: Relentless Overdrive!' });
        }
      }

      if (this.goalTimer >= goal.targetMs) {
        this.completeFloor('time');
        return;
      }
    }

    // Tick Calculation
    let effectiveTick = this.tickMs * this.persistentTickScalar;
    if (this.currentFloor?.affixes?.includes('zoomies')) effectiveTick *= 0.85;
    if (this.activeEffects.speed > 0) effectiveTick *= 0.65;
    if (this.bossPhase === 2) effectiveTick *= 0.82;

    this.tickTimer += dt * 1000;
    if (this.tickTimer >= effectiveTick) {
      this.tickTimer -= effectiveTick;
      this.step();
    }
  }

  // ── Discrete Simulation Step ──────────────────────────────────────────────
  step() {
    // 1. Snapshot previous positions for smooth lerp rendering
    this.snakePrev = this.snake.map(s => ({ ...s }));
    if (this.vacuum) {
      this.vacuumPrev = { ...this.vacuum };
    }

    // 2. Consume direction queue
    if (this.inputQueue.length > 0) {
      this.direction = this.inputQueue.shift();
    }

    // 3. Move snake head
    const head = this.snake[0];
    const newHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y
    };

    // 4. Wall collision
    if (newHead.x < 0 || newHead.x >= this.boardSize || newHead.y < 0 || newHead.y >= this.boardSize) {
      this.handleCollision('wall');
      return;
    }

    // 5. Obstacle collision
    if (this.obstacles.some(o => o.x === newHead.x && o.y === newHead.y)) {
      this.handleCollision('obstacle');
      return;
    }

    // 6. Self collision (with Feather Wand ghost-step override)
    const selfHitIndex = this.snake.findIndex(s => s.x === newHead.x && s.y === newHead.y);
    if (selfHitIndex !== -1 && selfHitIndex < this.snake.length - 1) {
      if (this.flags.featherCharge > 0) {
        this.flags.featherCharge -= 1;
        this.triggerScreenShake(3);
        this.emit('effect:feather', { remaining: this.flags.featherCharge });
      } else {
        this.handleCollision('self');
        return;
      }
    }

    // 7. Vacuum collision (head-on or into tail)
    if (this.vacuum && (this.vacuum.x === newHead.x && this.vacuum.y === newHead.y)) {
      this.handleCollision('vacuum');
      return;
    }
    if (this.vacuumTail.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
      this.handleCollision('vacuum_tail');
      return;
    }

    // 8. Bomb collision
    if (this.bomb && this.bomb.x === newHead.x && this.bomb.y === newHead.y) {
      if (this.flags.bombImmunity) {
        this.bomb = null;
        this.triggerScreenShake(4);
        this.emit('bomb:immune');
      } else if (this.activeEffects.shield > 0) {
        this.bomb = null;
        this.triggerScreenShake(4);
        if (this.flags.bombPlushie) this.addScore(3);
        this.emit('bomb:shield');
      } else if (this.flags.scratchingPostCharge > 0) {
        this.flags.scratchingPostCharge -= 1;
        this.bomb = null;
        this.triggerScreenShake(4);
        this.emit('bomb:deflect');
      } else if (this.flags.luckyCollar && Math.random() < 0.25) {
        this.bomb = null;
        this.triggerScreenShake(4);
        this.emit('bomb:lucky');
      } else {
        this.handleBombExplosion();
        return;
      }
    }

    // 9. Move body
    this.snake.unshift(newHead);
    let grew = false;

    // 10. Check treat consumption
    const treatIndex = this.treats.findIndex(t => t.x === newHead.x && t.y === newHead.y);
    if (treatIndex !== -1) {
      const treat = this.treats.splice(treatIndex, 1)[0];
      this.eatTreat(treat);
      grew = true;
    }

    // Check powerup consumption
    if (this.powerup && this.powerup.x === newHead.x && this.powerup.y === newHead.y) {
      this.consumePowerup(this.powerup);
      this.powerup = null;
    }

    if (!grew) {
      this.snake.pop();
    }

    // 11. Vacuum step
    if (this.vacuum) {
      this.updateVacuum();
    }

    // 12. Random spawns (bombs & powerups)
    this.maybeSpawnHazards();

    // 13. Goal completion check
    this.checkGoalProgress();
  }

  // ── Eating & Scoring ──────────────────────────────────────────────────────
  eatTreat(treat) {
    this.treatsCollected += 1;
    this.treatBreakdown[treat.key] = (this.treatBreakdown[treat.key] || 0) + 1;

    let points = treat.score || 1;
    if (this.startingModifier.treatValue) points *= this.startingModifier.treatValue;
    if (this.currentFloor?.affixes?.includes('snackShortage')) points += 2;
    if (this.flags.gourmetPalate && (treat.key === 'steak' || treat.key === 'biscuit')) {
      points += treat.key === 'steak' ? 4 : 2;
    }
    if (this.activeEffects.score > 0) points *= 2;
    if (this.currentFloor?.affixes?.includes('donationNight')) points = Math.max(1, Math.floor(points * 0.5));

    this.addScore(points);

    // Combo streak
    if (this.flags.snackStreaks) {
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const bonus = Math.floor(this.streak / 3);
      if (bonus > 0) this.addScore(bonus);
    }

    // Therapy Collar healing
    if (this.flags.therapyCollar && this.hearts < this.maxHearts) {
      this.flags.therapyTreatCount += 1;
      if (this.flags.therapyTreatCount >= 8) {
        this.flags.therapyTreatCount = 0;
        this.heal(1);
      }
    }

    // Efficient Digestion healing
    if (this.flags.efficientDigestion && this.hearts < this.maxHearts) {
      this.flags.digestionCount += 1;
      if (this.flags.digestionCount >= 6) {
        this.flags.digestionCount = 0;
        this.heal(1);
      }
    }

    // Catnip Mouse speed surge
    if (this.flags.catnipMouse) {
      const now = Date.now();
      this.flags.catnipTimestamps.push(now);
      this.flags.catnipTimestamps = this.flags.catnipTimestamps.filter(t => now - t <= 4000);
      if (this.flags.catnipTimestamps.length >= 3) {
        this.flags.catnipTimestamps = [];
        this.activeEffects.speed = 3000;
        this.emit('effect:catnip');
      }
    }

    // Scavenger coin drop
    if (this.flags.scavenger && Math.random() < 0.20) {
      const coinAward = Math.round(1 * (this.startingModifier.coinMultiplier || 1));
      this.coinsEarned += coinAward;
      this.emit('coin:gain', { amount: coinAward, total: this.coinsEarned });
    }

    // Real Shelter Pet Rescue Goal Progress
    if (treat.isPet && treat.petData) {
      this.rescuedPets.push(treat.petData);
      this.emit('pet:rescued', { pet: treat.petData, totalRescued: this.rescuedPets.length });
    }

    // Second Helping
    if (this.flags.secondHelping && Math.random() < 0.20) {
      this.spawnTreat();
    }

    // Respawn treat
    if (this.treats.length === 0) {
      this.spawnTreat();
    }

    this.emit('treat:eat', { treat, points });
  }

  addScore(pts) {
    const mult = this.startingModifier.scoreMultiplier || 1.0;
    const finalPts = Math.round(pts * mult);
    this.score += finalPts;
    this.emit('score', { score: this.score, delta: finalPts });
  }

  heal(amount = 1) {
    this.hearts = Math.min(this.maxHearts, this.hearts + amount);
    this.emit('health:change', { hearts: this.hearts, maxHearts: this.maxHearts });
  }

  // ── Hazards & Collisions ──────────────────────────────────────────────────
  handleCollision(reason) {
    this.streak = 0;
    this.triggerScreenShake(10);

    // Iron Collar shield absorption
    if (this.flags.ironShieldActive) {
      this.flags.ironShieldActive = false;
      this.graceMs = 1500;
      this.emit('shield:absorb', { reason });
      return;
    }

    // Lucky Collar chance
    if (this.flags.luckyCollar && Math.random() < 0.25) {
      this.graceMs = 1200;
      this.emit('lucky:dodge', { reason });
      return;
    }

    this.hearts -= 1;
    this.emit('health:change', { hearts: this.hearts, maxHearts: this.maxHearts, reason });

    if (this.hearts > 0) {
      // Reposition to safe start cell on current floor
      const mid = Math.floor(this.boardSize / 2);
      this.snake = [
        { x: mid + 1, y: mid },
        { x: mid, y: mid },
        { x: mid - 1, y: mid }
      ];
      this.snakePrev = this.snake.map(s => ({ ...s }));
      this.direction = { x: 1, y: 0 };
      this.inputQueue = [];
      this.graceMs = 2500;
      this.emit('floor:restart', { reason, hearts: this.hearts });
    } else {
      this.endRun(false, reason);
    }
  }

  handleBombExplosion() {
    this.triggerScreenShake(14);
    this.streak = 0;
    this.bomb = null;

    // Cut snake length
    const penalty = this.flags.bombPlushie ? 0.25 : 0.5;
    const cutAmount = Math.floor(this.snake.length * penalty);
    if (this.snake.length - cutAmount >= 3) {
      this.snake.splice(this.snake.length - cutAmount);
    }

    this.handleCollision('bomb');
  }

  triggerScreenShake(intensity) {
    this.shakeIntensity = Math.min(25, this.shakeIntensity + intensity);
  }

  // ── Vacuum AI ─────────────────────────────────────────────────────────────
  updateVacuum() {
    const v = this.vacuum;
    if (!v) return;

    // Add current position to tail
    this.vacuumTail.unshift({ x: v.x, y: v.y });
    const maxTail = this.bossPhase === 2 ? 8 : (v.difficulty === 'boss' ? 6 : 4);
    if (this.vacuumTail.length > maxTail) {
      this.vacuumTail.pop();
    }

    // Direction choice: steer toward closest treat or player
    const target = (this.treats.length > 0 && Math.random() < 0.7)
      ? this.treats[0]
      : this.snake[0];

    const dx = target.x - v.x;
    const dy = target.y - v.y;
    const preferred = [];

    if (Math.abs(dx) > Math.abs(dy)) {
      preferred.push({ x: Math.sign(dx), y: 0 });
      preferred.push({ x: 0, y: Math.sign(dy) || 1 });
    } else {
      preferred.push({ x: 0, y: Math.sign(dy) });
      preferred.push({ x: Math.sign(dx) || 1, y: 0 });
    }

    let chosen = preferred[0];
    const nX = v.x + chosen.x;
    const nY = v.y + chosen.y;

    if (nX < 0 || nX >= this.boardSize || nY < 0 || nY >= this.boardSize || this.obstacles.some(o => o.x === nX && o.y === nY)) {
      chosen = preferred[1] || { x: -v.dir.x, y: -v.dir.y };
    }

    v.dir = chosen;
    v.x += chosen.x;
    v.y += chosen.y;

    // Check if vacuum ate a treat
    const tIdx = this.treats.findIndex(t => t.x === v.x && t.y === v.y);
    if (tIdx !== -1) {
      this.treats.splice(tIdx, 1);
      this.spawnTreat();
      if (this.flags.vacuumToy) {
        this.spawnPowerup();
      }
      this.emit('vacuum:stole');
    }
  }

  // ── Spawners ──────────────────────────────────────────────────────────────
  spawnTreat(isRescue = false) {
    const cell = this.findEmptyCell();
    if (!cell) return;

    let key = 'fish';
    const roll = Math.random();
    if (roll < 0.40) key = 'fish';
    else if (roll < 0.70) key = 'bone';
    else if (roll < 0.90) key = 'biscuit';
    else key = 'steak';

    const def = TREAT_TYPES[key];
    const treat = {
      x: cell.x,
      y: cell.y,
      key,
      label: def.label,
      score: def.score,
      icon: def.icon,
      color: def.color,
      isPet: isRescue || this.currentFloor?.goal?.type === 'rescue',
      petData: null
    };

    this.treats.push(treat);
  }

  spawnPowerup() {
    if (this.powerup) return;
    const cell = this.findEmptyCell();
    if (!cell) return;

    const keys = ['speed', 'score', 'shield'];
    const key = keys[Math.floor(Math.random() * keys.length)];
    const def = POWERUP_TYPES[key];

    this.powerup = {
      x: cell.x,
      y: cell.y,
      key,
      label: def.label,
      icon: def.icon,
      duration: def.duration
    };
  }

  consumePowerup(p) {
    this.activeEffects[p.key] = p.duration;
    this.addScore(2);
    this.emit('powerup:collect', { powerup: p });
  }

  maybeSpawnHazards() {
    // Bomb spawn
    if (!this.bomb && Math.random() < 0.02) {
      const cell = this.findEmptyCell();
      if (cell) {
        this.bomb = { x: cell.x, y: cell.y, timer: 12000 };
      }
    }
    // Powerup spawn
    if (!this.powerup && Math.random() < 0.015) {
      this.spawnPowerup();
    }
  }

  findEmptyCell() {
    const occupied = new Set();
    this.snake.forEach(s => occupied.add(`${s.x},${s.y}`));
    this.obstacles.forEach(o => occupied.add(`${o.x},${o.y}`));
    this.treats.forEach(t => occupied.add(`${t.x},${t.y}`));
    if (this.bomb) occupied.add(`${this.bomb.x},${this.bomb.y}`);
    if (this.powerup) occupied.add(`${this.powerup.x},${this.powerup.y}`);
    if (this.vacuum) occupied.add(`${this.vacuum.x},${this.vacuum.y}`);
    this.vacuumTail.forEach(v => occupied.add(`${v.x},${v.y}`));

    const candidates = [];
    const head = this.snake[0] || { x: 0, y: 0 };
    const hasNarrow = this.currentFloor?.affixes?.includes('narrowHalls');
    const hasMagnet = this.flags.treatMagnet;
    const mid = Math.floor(this.boardSize / 2);

    for (let x = 0; x < this.boardSize; x++) {
      for (let y = 0; y < this.boardSize; y++) {
        if (!occupied.has(`${x},${y}`)) {
          // Filter if narrow halls
          if (hasNarrow && (Math.abs(x - mid) > 4 || Math.abs(y - mid) > 4)) continue;
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length === 0) return null;

    // Sort by proximity to head if Treat Magnet is equipped
    if (hasMagnet && Math.random() < 0.65) {
      candidates.sort((a, b) => {
        const da = Math.abs(a.x - head.x) + Math.abs(a.y - head.y);
        const db = Math.abs(b.x - head.x) + Math.abs(b.y - head.y);
        return da - db;
      });
      return candidates[Math.floor(Math.random() * Math.min(6, candidates.length))];
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // ── Goal Progress & Room Clear ────────────────────────────────────────────
  checkGoalProgress() {
    const goal = this.currentFloor?.goal;
    if (!goal) return;

    if (goal.type === 'forage') {
      if (this.treatsCollected >= goal.target) {
        this.completeFloor('goal');
      }
    } else if (goal.type === 'rescue') {
      if (this.rescuedPets.length >= goal.target) {
        this.completeFloor('rescue');
      }
    }
  }

  completeFloor(trigger) {
    this.phase = GAME_PHASES.REWARD;

    // Coins reward for completing floor
    const floorCoins = Math.max(1, Math.round((5 + this.floorIndex) * (this.startingModifier.coinMultiplier || 1)));
    this.coinsEarned += floorCoins;

    if (this.floorIndex >= FLOOR_SCRIPT.length - 1) {
      this.endRun(true, 'conquered');
      return;
    }

    // Generate upgrade draft cards (3 random upgrades not yet chosen)
    this.generateDraftOptions();
    // Generate route choices (2 branching paths)
    this.generateRouteChoices();

    this.emit('floor:complete', {
      floor: this.floorIndex + 1,
      trigger,
      coinsEarned: floorCoins,
      totalScore: this.score
    });
  }

  generateDraftOptions() {
    const available = ALL_UPGRADES.filter(u => !this.upgrades.some(existing => existing.id === u.id));
    const count = 3 + (this.startingModifier.extraUpgrades || 0);
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    this.draftUpgrades = shuffled.slice(0, count);
  }

  generateRouteChoices() {
    const nextFloor = this.floorIndex + 2;
    const difficulties = ['normal', 'spicy'];
    this.routeChoices = [
      {
        id: `route_a_${nextFloor}`,
        title: `Safe Route · Floor ${nextFloor}`,
        board: 'roomy',
        difficulty: 'normal',
        goalDesc: 'Forage for snacks in a calm room',
        affix: 'abundance',
        affixDesc: 'Snack Feast: Extra treats appear'
      },
      {
        id: `route_b_${nextFloor}`,
        title: `Hazard Trial · Floor ${nextFloor}`,
        board: 'roomy',
        difficulty: 'spicy',
        goalDesc: 'Rescue trapped shelter companions',
        affix: 'zoomies',
        affixDesc: 'Zoomies: +20% Speed, bonus points'
      }
    ];
    this.selectedRouteIndex = 0;
  }

  selectUpgrade(upgradeId) {
    const upgrade = this.draftUpgrades.find(u => u.id === upgradeId);
    if (!upgrade || this.draftedUpgradeThisFloor) return false;

    upgrade.apply(this);
    this.upgrades.push(upgrade);
    this.draftedUpgradeThisFloor = true;
    this.emit('upgrade:select', { upgrade });
    return true;
  }

  chooseRoute(routeIndex) {
    if (this.routeChoices[routeIndex]) {
      this.selectedRouteIndex = routeIndex;
    }
  }

  skipRoute() {
    this.coinsEarned += ROUTE_SKIP_COINS;
    this.emit('coin:gain', { amount: ROUTE_SKIP_COINS, total: this.coinsEarned });
    this.advanceToNextFloor();
  }

  advanceToNextFloor() {
    this.startFloor(this.floorIndex + 1);
  }

  continueWithCoins() {
    if (this.coinsEarned < CONTINUE_COST) return false;
    this.coinsEarned -= CONTINUE_COST;
    this.hearts = this.maxHearts;
    this.startFloor(this.floorIndex, { retry: true });
    this.emit('run:continue', { floor: this.floorIndex + 1 });
    return true;
  }

  endRun(victory, reason) {
    this.phase = victory ? GAME_PHASES.VICTORY : GAME_PHASES.DEFEAT;
    this.emit('run:end', {
      victory,
      reason,
      floor: this.floorIndex + 1,
      score: this.score,
      coinsEarned: this.coinsEarned,
      treatsCollected: this.treatsCollected,
      rescuedPets: this.rescuedPets,
      upgrades: this.upgrades
    });
  }

  // ── Interpolation Snapshot for 60fps Rendering ────────────────────────────
  getRenderSnapshot(alpha = 1.0) {
    const lerp = (a, b, t) => a + (b - a) * t;

    const interpolatedSnake = this.snake.map((seg, i) => {
      const prev = this.snakePrev[i] || seg;
      return {
        x: lerp(prev.x, seg.x, alpha),
        y: lerp(prev.y, seg.y, alpha)
      };
    });

    let interpolatedVacuum = null;
    if (this.vacuum) {
      const prev = this.vacuumPrev || this.vacuum;
      interpolatedVacuum = {
        ...this.vacuum,
        x: lerp(prev.x, this.vacuum.x, alpha),
        y: lerp(prev.y, this.vacuum.y, alpha)
      };
    }

    return {
      phase: this.phase,
      boardSize: this.boardSize,
      mascot: this.mascot,
      snake: interpolatedSnake,
      direction: this.direction,
      treats: this.treats,
      powerup: this.powerup,
      bomb: this.bomb,
      obstacles: this.obstacles,
      vacuum: interpolatedVacuum,
      vacuumTail: this.vacuumTail,
      activeEffects: { ...this.activeEffects },
      graceMs: this.graceMs,
      dimRoom: this.currentFloor?.affixes?.includes('dimRoom'),
      bossPhase: this.bossPhase,
      shakeIntensity: this.shakeIntensity,
      score: this.score,
      hearts: this.hearts,
      maxHearts: this.maxHearts,
      floor: this.floorIndex + 1,
      totalFloors: FLOOR_SCRIPT.length,
      goal: this.currentFloor?.goal,
      goalProgress: this.currentFloor?.goal?.type === 'survive' || this.currentFloor?.goal?.type === 'boss'
        ? Math.min(1.0, this.goalTimer / this.currentFloor.goal.targetMs)
        : (this.currentFloor?.goal?.type === 'rescue'
          ? this.rescuedPets.length / this.currentFloor.goal.target
          : this.treatsCollected / (this.currentFloor?.goal?.target || 10))
    };
  }
}
