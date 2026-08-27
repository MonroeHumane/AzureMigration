/*
 * Pet Snake Engine (WIP)
 * Reusable core gameplay loop extracted from petsnake.html.
 * This module deliberately avoids direct DOM manipulation; consumers supply
 * callbacks for rendering, audio, and HUD interactions.
 */

/**
 * Engine constants - centralized configuration values
 * These can be overridden via config if needed
 */
const ENGINE_CONSTANTS = Object.freeze({
	// Timing
	MAX_FRAME_DELTA_MS: 120,        // Cap delta to prevent spiral of death
	
	// Input
	MAX_INPUT_QUEUE_SIZE: 3,        // Maximum queued direction inputs
	
	// Snake
	MIN_SNAKE_LENGTH: 3,            // Minimum snake length after damage
	
	// Bomb
	BOMB_LENGTH_PENALTY: 0.5,       // Fraction of snake lost on bomb hit
	BOMB_SCORE_PENALTY: 0.5,        // Fraction of score lost on bomb hit
	
	// Powerups
	DEFAULT_POWERUP_DURATION: 8000, // Default powerup duration in ms
	
	// Vacuum
	VACUUM_MIN_TAIL: 2,             // Minimum vacuum tail length
	VACUUM_MAX_TAIL_RATIO: 2,       // Max tail = boardSize * ratio
	VACUUM_SPAWN_ATTEMPTS: 200,     // Max attempts to spawn vacuum
	VACUUM_MIN_DISTANCE_RATIO: 0.33, // Min spawn distance = boardSize * ratio
	VACUUM_STUCK_THRESHOLD: 3,      // Ticks before vacuum is "stuck"
	VACUUM_ESCAPE_SHRINK: 3,        // Segments to shrink when escaping
	
	// Empty cell finding
	BOARD_FILL_THRESHOLD: 0.5,      // Switch to enumeration strategy above this fill ratio
	MAX_RANDOM_ATTEMPTS: 50,        // Max random sampling attempts before switching
});

const defaultConfig = {
	boardSize: 19,
	initialSnake: [{ x: 10, y: 9 }, { x: 9, y: 9 }, { x: 8, y: 9 }],
	tickMs: 200,
	mode: "classic",
	difficulty: "normal",
	superMode: false,
	treatSpawnBehavior: null,
	treatTypes: [
		{ key: "fish", icon: "🐟", score: 1 },
		{ key: "bone", icon: "🦴", score: 2 },
		{ key: "biscuit", icon: "🍪", score: 1 },
		{ key: "steak", icon: "🥩", score: 3 }
	],
	powerupTypes: [
		{ key: "speed", icon: "⚡", duration: 9000 },
		{ key: "score", icon: "⭐", duration: 9000 },
		{ key: "shield", icon: "🛡", duration: 12000 }
	],
	vacuumBehaviorByDifficulty: {
		chill: { speedRatio: 2.5, turnChance: 0.15, tailGain: 3, tailDecay: 0.06, pursuitChance: 0.2, minTail: 2 },
		normal: { speedRatio: 2, turnChance: 0.22, tailGain: 4, tailDecay: 0.08, pursuitChance: 0.35, minTail: 2 },
		spicy: { speedRatio: 1.6, turnChance: 0.28, tailGain: 5, tailDecay: 0.10, pursuitChance: 0.5, minTail: 3 },
		hard: { speedRatio: 1.4, turnChance: 0.30, tailGain: 6, tailDecay: 0.08, pursuitChance: 0.65, minTail: 3 },
		boss: { speedRatio: 1.2, turnChance: 0.35, tailGain: 7, tailDecay: 0.06, pursuitChance: 0.8, minTail: 4 }
	},
	bombSpawnChance: 0.15,
	bombCooldownMs: 5000,
	powerupSpawnChance: 0.2,
	powerupCooldownMs: 4000
};

const defaultVacuumBehavior = { speedRatio: 2, turnChance: 0.22, tailGain: 4, tailDecay: 0.08, pursuitChance: 0.35, minTail: 2 };

const directionVectors = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 }
};

const isOpposite = (curr, next) => curr && next && curr.x === -next.x && curr.y === -next.y;
const DEFAULT_DIRECTION = { x: 1, y: 0 };
const SPEED_TICK_FACTOR = 0.65;
const MIN_SPEED_TICK = 60;

const normalizeDirection = (dx = 0, dy = 0) => {
	if (!dx && !dy) return { ...DEFAULT_DIRECTION };
	const clampedX = Math.max(-1, Math.min(1, dx));
	const clampedY = Math.max(-1, Math.min(1, dy));
	if (clampedX && clampedY) {
		// Prefer horizontal move when both axes were provided (invalid diagonal), fallback to default.
		return { ...DEFAULT_DIRECTION };
	}
	if (!clampedX && !clampedY) return { ...DEFAULT_DIRECTION };
	return { x: clampedX, y: clampedY };
};

const inferDirectionFromSnake = (segments = []) => {
	if (!Array.isArray(segments) || segments.length < 2) {
		return { ...DEFAULT_DIRECTION };
	}
	const head = segments[0];
	const neck = segments[1];
	if (!head || !neck) return { ...DEFAULT_DIRECTION };
	const dx = head.x - neck.x;
	const dy = head.y - neck.y;
	if (Math.abs(dx) + Math.abs(dy) !== 1) {
		return { ...DEFAULT_DIRECTION };
	}
	return normalizeDirection(dx, dy);
};

const createDefaultTimingAdapter = () => {
	if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
		return {
			request: (cb) => window.requestAnimationFrame(cb),
			cancel: (id) => window.cancelAnimationFrame(id),
			now: () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now())
		};
	}
	return {
		request: (cb) => setTimeout(() => cb(Date.now()), 16),
		cancel: (id) => clearTimeout(id),
		now: () => Date.now()
	};
};

export class PetSnakeEngine {
	constructor(options = {}) {
		this.config = { ...defaultConfig, ...options.config };
		this.renderAdapter = options.renderAdapter || null;
		this.audioAdapter = options.audioAdapter || null;
		const defaultTiming = createDefaultTimingAdapter();
		const providedTiming = options.timingAdapter || {};
		this.timingAdapter = {
			request: providedTiming.request || defaultTiming.request,
			cancel: providedTiming.cancel || defaultTiming.cancel,
			now: providedTiming.now || defaultTiming.now
		};
		this.eventHandlers = new Map();
		this.boardSize = this.config.boardSize;
		this.difficultyLevel = this.config.difficulty;
		this.superModeActive = Boolean(this.config.superMode);
		this.baseTick = this.config.tickMs;
		this.treatSpawnHook = null;
		this.treatRespawnDelay = 0;
		this.pendingTreatSpawn = false;
		this.treatRespawnTimer = 0;
		this.collisionInterceptor = null;
		this.bombSpawnChance = this.config.bombSpawnChance ?? defaultConfig.bombSpawnChance;
		this.bombCooldownMs = this.config.bombCooldownMs ?? defaultConfig.bombCooldownMs;
		this.powerupSpawnChance = this.config.powerupSpawnChance ?? defaultConfig.powerupSpawnChance;
		this.powerupCooldownMs = this.config.powerupCooldownMs ?? defaultConfig.powerupCooldownMs;
		this.resetState();
	}

	resetState() {
		this.snake = [];
		this.snakePositionSet = new Set(); // O(1) position lookup
		this.direction = { ...DEFAULT_DIRECTION };
		this.inputQueue = [];
		this.treat = null;
		this.powerup = null;
		this.bomb = null;
		this.vacuum = null;
		this.vacuumTail = [];
		this.vacuumTailTarget = 0;
		this.vacuumTailSet = new Set();
		this.vacuumTickAcc = 0;
		this.vacuumDifficultyLevel = this.difficultyLevel || "normal";
		this.inPlay = false;
		this.paused = false;
		this.baseTick = this.config.tickMs;
		this.tick = this.baseTick;
		this.rafId = null;
		this.frameAccumulator = 0;
		this.lastFrameTime = 0;
		this.score = 0;
		this.activeEffects = {};
		this.scoreMultiplier = 1;
		// Run-level multiplier from affixes/starting modifiers; persists through powerup effects.
		this.runScoreMultiplier = 1;
		// Run-level vacuum speed scale from affixes (enemySpeed); 1 = unchanged, >1 = faster.
		this.vacuumBehaviorScale = 1;
		// Run-level vacuum turn-erraticness scale (Haunted Vacuum); 1 = unchanged.
		this.vacuumTurnScale = 1;
		this.powerCooldown = 0;
		this.bombCooldown = 0;
		this.pendingTreatSpawn = false;
		this.treatRespawnTimer = 0;
		this.obstacles = [];
		this.obstacleSet = new Set();
	}

	// === Snake Position Set Methods (O(1) lookups) ===
	
	/** Generate unique key for position */
	_posKey(x, y) {
		return `${x},${y}`;
	}

	/** Add position to snake set */
	_addSnakePosition(x, y) {
		this.snakePositionSet.add(this._posKey(x, y));
	}

	/** Remove position from snake set */
	_removeSnakePosition(x, y) {
		this.snakePositionSet.delete(this._posKey(x, y));
	}

	/** Check if position has snake segment - O(1) */
	_hasSnakePosition(x, y) {
		return this.snakePositionSet.has(this._posKey(x, y));
	}

	/** Rebuild snake position set from snake array */
	_rebuildSnakePositionSet() {
		this.snakePositionSet.clear();
		for (const segment of this.snake) {
			this._addSnakePosition(segment.x, segment.y);
		}
	}

	on(event, handler) {
		if (!this.eventHandlers.has(event)) {
			this.eventHandlers.set(event, new Set());
		}
		this.eventHandlers.get(event).add(handler);
		return () => {
			this.eventHandlers.get(event)?.delete(handler);
		};
	}

	emit(event, payload) {
		const listeners = this.eventHandlers.get(event);
		if (!listeners) return;
		listeners.forEach((handler) => handler(payload));
	}

	configure(configOverrides = {}) {
		this.config = { ...this.config, ...configOverrides };
		if (configOverrides.tickMs) {
			this.tick = configOverrides.tickMs;
		}
		this.emit("config", this.config);
	}

	attachRenderAdapter(adapter) {
		this.renderAdapter = adapter;
		return this;
	}

	attachAudioAdapter(adapter) {
		this.audioAdapter = adapter;
		return this;
	}

	startRun(runConfig = {}) {
		this.configure(runConfig);
		this.resetState();
		this.boardSize = runConfig.boardSize ?? this.config.boardSize;
		this.difficultyLevel = runConfig.difficulty ?? this.config.difficulty;
		// Allow separate vacuum difficulty for more granular control
		this.vacuumDifficultyLevel = runConfig.vacuumDifficulty ?? this.difficultyLevel;
		if (typeof runConfig.superMode === "boolean") {
			this.superModeActive = runConfig.superMode;
		} else {
			this.superModeActive = Boolean(this.config.superMode);
		}
		const nextTick = runConfig.tickMs ?? runConfig.tick ?? this.config.tickMs;
		this.baseTick = nextTick;
		this.tick = nextTick;
		this.runScoreMultiplier = Number(runConfig.scoreMultiplier) > 0 ? Number(runConfig.scoreMultiplier) : 1;
		this.vacuumBehaviorScale = Number(runConfig.vacuumBehaviorScale) > 0 ? Number(runConfig.vacuumBehaviorScale) : 1;
		this.vacuumTurnScale = Number(runConfig.vacuumTurnScale) > 0 ? Number(runConfig.vacuumTurnScale) : 1;
		const initialSnake = runConfig.initialSnake || this.config.initialSnake;
		this.snake = JSON.parse(JSON.stringify(initialSnake));
		this._rebuildSnakePositionSet(); // Build set from initial snake
		this.direction = inferDirectionFromSnake(this.snake);
		this.inputQueue.length = 0;
		this.resetVacuumTailState();
		this.applyTreatBehavior(runConfig.treatSpawnBehavior ?? this.config.treatSpawnBehavior);
		// Apply bomb/powerup spawn modifiers if provided
		if (runConfig.bombSpawnRate !== undefined) {
			const baseChance = this.config.bombSpawnChance ?? defaultConfig.bombSpawnChance;
			const baseCooldown = this.config.bombCooldownMs ?? defaultConfig.bombCooldownMs;
			this.bombSpawnChance = Math.min(0.95, baseChance * runConfig.bombSpawnRate);
			this.bombCooldownMs = Math.max(500, baseCooldown / runConfig.bombSpawnRate);
		} else {
			this.bombSpawnChance = this.config.bombSpawnChance ?? defaultConfig.bombSpawnChance;
			this.bombCooldownMs = this.config.bombCooldownMs ?? defaultConfig.bombCooldownMs;
		}
		if (runConfig.powerupSpawnRate !== undefined) {
			const baseChance = this.config.powerupSpawnChance ?? defaultConfig.powerupSpawnChance;
			const baseCooldown = this.config.powerupCooldownMs ?? defaultConfig.powerupCooldownMs;
			this.powerupSpawnChance = Math.min(0.95, baseChance * runConfig.powerupSpawnRate);
			this.powerupCooldownMs = Math.max(500, baseCooldown / runConfig.powerupSpawnRate);
		} else {
			this.powerupSpawnChance = this.config.powerupSpawnChance ?? defaultConfig.powerupSpawnChance;
			this.powerupCooldownMs = this.config.powerupCooldownMs ?? defaultConfig.powerupCooldownMs;
		}
		this.spawnTreat();
		if (this.superModeActive) {
			const behavior = this.vacuumBehavior();
			this.vacuum = this.createVacuumStart({
				minTailLength: behavior.minTail ?? 2,
				startingTailLength: behavior.minTail ?? 2
			});
			this.vacuumTickAcc = 0;
		} else {
			this.vacuum = null;
		}
		this.powerCooldown = 0;
		this.bombCooldown = 0;
		this.activeEffects = {};
		this.applyEffects();
		this.inPlay = true;
		this.paused = false;
		this.emit("score", { score: this.score, delta: 0 });
		this.emit("run:start", { config: this.config });
		this.ensureLoop();
		this.draw();
	}

	pause() {
		if (!this.inPlay || this.paused) return;
		this.paused = true;
		this.stopLoop();
		this.emit("run:pause");
	}

	resume() {
		if (!this.inPlay || !this.paused) return;
		this.paused = false;
		this.ensureLoop();
		this.emit("run:resume");
	}

	stop() {
		this.stopLoop();
		this.inPlay = false;
		this.paused = false;
		this.resetVacuumTailState();
		this.emit("run:stop");
	}

	enqueueDirection(next) {
		if (!directionVectors[next]) return;
		// Limit input buffer to prevent overflow
		if (this.inputQueue.length >= ENGINE_CONSTANTS.MAX_INPUT_QUEUE_SIZE) return;
		const lastQueued = this.inputQueue.length
			? this.inputQueue[this.inputQueue.length - 1]
			: this.direction;
		const candidate = directionVectors[next];
		if (!candidate) return;
		if (isOpposite(this.direction, candidate)) return;
		if (lastQueued && typeof lastQueued === "string" && lastQueued === next) return;
		this.inputQueue.push(next);
	}

	setDirection(vector) {
		this.direction = { ...vector };
	}

	applyQueuedDirection() {
		if (!this.inputQueue.length) return;
		while (this.inputQueue.length) {
			const nextKey = this.inputQueue.shift();
			const vec = directionVectors[nextKey];
			if (!vec) continue;
			if (isOpposite(this.direction, vec)) continue;
			this.direction = { ...vec };
			break;
		}
	}

	vacuumBehavior() {
		// Use vacuum-specific difficulty if set, otherwise fall back to general difficulty
		const level = this.vacuumDifficultyLevel || this.difficultyLevel;
		const base = this.config.vacuumBehaviorByDifficulty[level] || defaultVacuumBehavior;
		const scale = this.vacuumBehaviorScale || 1;
		const turnScale = this.vacuumTurnScale || 1;
		if (scale === 1 && turnScale === 1) return base;
		// enemySpeed affix: >1 = faster vacuum (lower speedRatio), more aggressive turns/pursuit.
		// vacuumTurnScale (Haunted Vacuum): extra erratic turning without changing speed.
		return {
			...base,
			speedRatio: Math.max(1, base.speedRatio / scale),
			turnChance: Math.min(0.9, base.turnChance * scale * turnScale),
			pursuitChance: Math.min(0.95, base.pursuitChance * scale)
		};
	}

	tailKey(x, y) {
		return `${x},${y}`;
	}

	maxVacuumTailLength() {
		return Math.max(
			ENGINE_CONSTANTS.VACUUM_MIN_TAIL * 3,
			this.boardSize * ENGINE_CONSTANTS.VACUUM_MAX_TAIL_RATIO
		);
	}

	clampVacuumTailTarget(value) {
		return Math.max(0, Math.min(value, this.maxVacuumTailLength()));
	}

	trackTailSegment(segment) {
		this.vacuumTailSet.add(this.tailKey(segment.x, segment.y));
	}

	dropTailSegment(segment) {
		this.vacuumTailSet.delete(this.tailKey(segment.x, segment.y));
	}

	resetVacuumTailState() {
		this.vacuumTail = [];
		this.vacuumTailTarget = 0;
		this.vacuumTailSet.clear();
		this.vacuumStuckCounter = 0; // Track how many ticks vacuum has been stuck
		this.vacuumLastPosition = null; // Track last position to detect stuck state
	}

	// Obstacle Management
	obstacleKey(x, y) {
		return `${x},${y}`;
	}

	hasObstacle(x, y) {
		return this.obstacleSet.has(this.obstacleKey(x, y));
	}

	addObstacle(x, y) {
		const key = this.obstacleKey(x, y);
		if (!this.obstacleSet.has(key)) {
			this.obstacles.push({ x, y });
			this.obstacleSet.add(key);
		}
	}

	clearObstacles() {
		this.obstacles = [];
		this.obstacleSet.clear();
	}

	spawnObstacles(positions) {
		this.clearObstacles();
		if (Array.isArray(positions)) {
			positions.forEach(pos => this.addObstacle(pos.x, pos.y));
		}
	}

	syncVacuumTail(prev, behavior) {
		const minTail = behavior.minTail ?? 2;
		let desiredLength = Math.max(minTail, Math.floor(this.vacuumTailTarget));

		if (prev) {
			const head = { x: prev.x, y: prev.y };
			this.vacuumTail.unshift(head);
			this.trackTailSegment(head);
			while (this.vacuumTail.length > desiredLength) {
				const removed = this.vacuumTail.pop();
				if (removed) this.dropTailSegment(removed);
			}
		}

		// Apply decay but respect minimum tail length
		this.vacuumTailTarget = Math.max(minTail, this.clampVacuumTailTarget(this.vacuumTailTarget - behavior.tailDecay));
		const decayedLength = Math.max(minTail, Math.floor(this.vacuumTailTarget));
		while (this.vacuumTail.length > decayedLength) {
			const removed = this.vacuumTail.pop();
			if (removed) this.dropTailSegment(removed);
		}
	}

	isVacuumTailCell(x, y) {
		return this.vacuumTailSet.has(this.tailKey(x, y));
	}

	isSnakeBodyCell(x, y) {
		// O(1) lookup - check if position is in snake AND not the head
		if (!this._hasSnakePosition(x, y)) return false;
		const head = this.snake[0];
		if (head && head.x === x && head.y === y) return false;
		return true;
	}

	isBlockedForVacuum(x, y) {
		if (x < 0 || x >= this.boardSize || y < 0 || y >= this.boardSize) return true;
		if (this.isVacuumTailCell(x, y)) return true;
		if (this.isSnakeBodyCell(x, y)) return true;
		if (this.hasObstacle(x, y)) return true; // Obstacles block vacuum
		return false;
	}

	runLoop(timestamp) {
		if (!this.inPlay || this.paused) {
			this.rafId = null;
			return;
		}
		if (!this.lastFrameTime) {
			this.lastFrameTime = timestamp;
		}
		let delta = timestamp - this.lastFrameTime;
		this.lastFrameTime = timestamp;
		if (delta > ENGINE_CONSTANTS.MAX_FRAME_DELTA_MS) delta = ENGINE_CONSTANTS.MAX_FRAME_DELTA_MS;
		this.frameAccumulator += delta;
		let advanced = false;
		while (this.frameAccumulator >= this.tick) {
			const stepSize = this.tick;
			this.step(stepSize);
			this.frameAccumulator -= this.tick;
			advanced = true;
			if (!this.inPlay || this.paused) break;
		}
		if (advanced) this.draw();
		if (this.inPlay && !this.paused) {
			this.rafId = this.timingAdapter.request((ts) => this.runLoop(typeof ts === "number" ? ts : this.timingAdapter.now()));
		} else {
			this.rafId = null;
		}
	}

	ensureLoop() {
		if (this.rafId || !this.inPlay || this.paused) return;
		this.frameAccumulator = 0;
		this.lastFrameTime = 0;
		this.rafId = this.timingAdapter.request((ts) => this.runLoop(typeof ts === "number" ? ts : this.timingAdapter.now()));
	}

	stopLoop() {
		if (this.rafId) {
			this.timingAdapter.cancel(this.rafId);
			this.rafId = null;
		}
		this.frameAccumulator = 0;
		this.lastFrameTime = 0;
	}

	restartLoopTiming() {
		if (!this.inPlay || this.paused) return;
		this.stopLoop();
		this.ensureLoop();
	}

	/* Core movement loop placeholder: handles walls, self, treats. */
	step(delta = this.tick) {
		if (!this.inPlay || this.paused) return;
		this.stepVacuum();
		const head = this.snake[0];
		// Check vacuum collision (shield protects)
		if (this.vacuum && head && head.x === this.vacuum.x && head.y === this.vacuum.y) {
			if (this.activeEffects.shield) {
				delete this.activeEffects.shield;
				this.applyEffects();
				this.emit("live", { text: "Shield saved you from the vacuum!" });
			} else {
				this.fail("vacuum", { x: head.x, y: head.y });
				return;
			}
		}
		// Check vacuum tail collision (shield protects)
		if (this.vacuumTail.length) {
			if (head && this.isVacuumTailCell(head.x, head.y)) {
				if (this.activeEffects.shield) {
					delete this.activeEffects.shield;
					this.applyEffects();
					this.emit("live", { text: "Shield saved you from vacuum tail!" });
				} else {
					this.fail("vacuum-tail", { x: head.x, y: head.y });
					return;
				}
			}
		}
		this.applyQueuedDirection();
		const next = { x: head.x + this.direction.x, y: head.y + this.direction.y };
		const hitsWall = next.x < 0 || next.y < 0 || next.x >= this.boardSize || next.y >= this.boardSize;
		const hitsSelf = this._hasSnakePosition(next.x, next.y); // O(1) lookup
		const hitsObstacle = this.hasObstacle(next.x, next.y);

		// Shield protects against obstacles only (not walls or self)
		if (hitsObstacle && this.activeEffects.shield) {
			delete this.activeEffects.shield;
			this.applyEffects();
			this.emit("live", { text: "Shield saved you from an obstacle!" });
			// Continue movement - shield consumed but no collision
		} else {
			const blockedReason = hitsWall ? "wall" : hitsSelf ? "self" : hitsObstacle ? "obstacle" : null;
			if (blockedReason) {
				const intercepted = this.collisionInterceptor
					? this.collisionInterceptor({
						reason: blockedReason,
						next,
						snake: this.snake,
						boardSize: this.boardSize
					})
					: false;
				if (!intercepted) {
					this.fail(blockedReason, { next });
					return;
				}
			}
		}
		this.snake.unshift(next);
		this._addSnakePosition(next.x, next.y); // Track new head position
		// Check vacuum collision after movement (shield protects)
		if (this.vacuum && next.x === this.vacuum.x && next.y === this.vacuum.y) {
			if (this.activeEffects.shield) {
				delete this.activeEffects.shield;
				this.applyEffects();
				this.emit("live", { text: "Shield saved you from the vacuum!" });
			} else {
				this.fail("vacuum", { x: next.x, y: next.y });
				return;
			}
		}
		// Check vacuum tail collision after movement (shield protects)
		if (this.isVacuumTailCell(next.x, next.y)) {
			if (this.activeEffects.shield) {
				delete this.activeEffects.shield;
				this.applyEffects();
				this.emit("live", { text: "Shield saved you from vacuum tail!" });
			} else {
				this.fail("vacuum-tail", { x: next.x, y: next.y });
				return;
			}
		}
		if (this.bomb && next.x === this.bomb.x && next.y === this.bomb.y) {
			if (this.activeEffects.shield) {
				delete this.activeEffects.shield;
				this.applyEffects();
				this.bomb = null;
				this.emit("bomb:clear", { reason: "shield" });
				this.emit("live", { text: "Shield saved you from a bomb!" });
			} else {
				// Halve the snake length (minimum from constant)
				const keep = Math.max(
					ENGINE_CONSTANTS.MIN_SNAKE_LENGTH,
					Math.ceil(this.snake.length * (1 - ENGINE_CONSTANTS.BOMB_LENGTH_PENALTY))
				);
				const scoreLost = Math.floor(this.score * ENGINE_CONSTANTS.BOMB_SCORE_PENALTY);
				// Remove positions of segments being cut
				for (let i = keep; i < this.snake.length; i++) {
					const seg = this.snake[i];
					this._removeSnakePosition(seg.x, seg.y);
				}
				this.snake.length = keep;
				this.score = Math.max(0, this.score - scoreLost);
				this.bomb = null;
				this.emit("bomb:clear", { reason: "explode" });
				this.emit("score", { score: this.score, delta: -scoreLost });
				this.emit("live", { text: "Boom! Cut in half!" });
			}
		}
		if (this.powerup && next.x === this.powerup.x && next.y === this.powerup.y) {
			const key = this.powerup.key;
			const timer = this.config.powerupTypes.find((p) => p.key === key);
			const duration = timer?.duration || ENGINE_CONSTANTS.DEFAULT_POWERUP_DURATION;
			this.activeEffects[key] = {
				remaining: duration,
				duration: duration
			};
			this.powerup = null;
			this.emit("powerup:clear", { reason: "consume", key });
			this.applyEffects();
			this.emit("live", { text: `${key} power active!` });
		}
		let ateTreat = false;
		if (this.treat && next.x === this.treat.x && next.y === this.treat.y) {
			ateTreat = true;
			this.handleTreatEaten();
		}
		if (!ateTreat) {
			const tail = this.snake.pop();
			if (tail) this._removeSnakePosition(tail.x, tail.y); // Remove old tail
		}
		this.maybeSpawnSpecials(delta);
		this.tickTreatRespawn(delta);
		this.tickEffects(delta);
		this.emit("snake:step", { snake: this.snake, head: next, ateTreat });
	}

	fail(reason, detail = {}) {
		this.stop();
		this.emit("run:fail", { reason, ...detail });
	}

	spawnTreat() {
		const cell = this.resolveTreatCell();
		const treatTypes = this.config.treatTypes || defaultConfig.treatTypes;
		const kind = treatTypes[Math.floor(Math.random() * treatTypes.length)] || treatTypes[0];
		this.treat = { x: cell.x, y: cell.y, ...kind };
		this.emit("treat", this.treat);
	}

	handleTreatEaten() {
		const gain = (this.treat?.score || 1) * this.scoreMultiplier;
		const snack = this.treat;
		this.treat = null;
		this.addScore(gain);
		this.emit("treat:eat", { treat: snack, gain });
		this.queueTreatRespawn();
	}

	addScore(amount) {
		this.score += amount;
		this.emit("score", { score: this.score, delta: amount });
	}

	spawnPowerup() {
		const slot = this.randomEmptyCell();
		if (!slot) return; // No space available
		const types = this.config.powerupTypes || defaultConfig.powerupTypes;
		const kind = types[Math.floor(Math.random() * types.length)] || types[0];
		this.powerup = { ...slot, ...kind };
		this.emit("powerup:spawn", this.powerup);
	}

	spawnBomb() {
		const slot = this.randomEmptyCell();
		if (!slot) return; // No space available
		this.bomb = { ...slot };
		this.emit("bomb:spawn", this.bomb);
	}

	createVacuumStart(options = {}) {
		const head = this.snake[0] || { x: Math.floor(this.boardSize / 2), y: Math.floor(this.boardSize / 2) };
		const minDistance = options.minDistance ?? 
			Math.max(6, Math.floor(this.boardSize * ENGINE_CONSTANTS.VACUUM_MIN_DISTANCE_RATIO));
		let spawn = null;
		for (let attempts = 0; attempts < ENGINE_CONSTANTS.VACUUM_SPAWN_ATTEMPTS; attempts++) {
			const candidate = this.randomEmptyCell();
			if (!candidate) break; // Board is full
			const distance = Math.abs(candidate.x - head.x) + Math.abs(candidate.y - head.y);
			if (distance >= minDistance) {
				spawn = candidate;
				break;
			}
		}
		if (!spawn) {
			spawn = this.randomEmptyCell();
			if (!spawn) {
				console.warn('Cannot spawn vacuum - no empty cells');
				return null;
			}
		}
		const headings = [
			{ dx: 1, dy: 0 },
			{ dx: -1, dy: 0 },
			{ dx: 0, dy: 1 },
			{ dx: 0, dy: -1 }
		];
		const heading = headings[Math.floor(Math.random() * headings.length)];

		// Initialize with minimum tail length
		const minTail = options.minTailLength ?? ENGINE_CONSTANTS.VACUUM_MIN_TAIL;
		const startingTail = options.startingTailLength ?? minTail;
		this.vacuumTailTarget = Math.max(minTail, startingTail);

		// Create initial tail segments behind the vacuum
		const vacuum = { ...spawn, ...heading };
		for (let i = 1; i <= Math.floor(this.vacuumTailTarget); i++) {
			const tailX = spawn.x - (heading.dx * i);
			const tailY = spawn.y - (heading.dy * i);
			// Only add if within bounds
			if (tailX >= 0 && tailX < this.boardSize && tailY >= 0 && tailY < this.boardSize) {
				const segment = { x: tailX, y: tailY };
				this.vacuumTail.push(segment);
				this.trackTailSegment(segment);
			}
		}

		return vacuum;
	}

	/**
	 * Turn on super mode and spawn a vacuum mid-run (e.g. the Vacuum Warning affix).
	 * No-op if a vacuum is already active.
	 * @returns {boolean} whether a vacuum was newly spawned
	 */
	enableVacuum() {
		if (!this.inPlay || this.vacuum) return false;
		this.superModeActive = true;
		const behavior = this.vacuumBehavior();
		this.resetVacuumTailState();
		this.vacuum = this.createVacuumStart({
			minTailLength: behavior.minTail ?? 2,
			startingTailLength: behavior.minTail ?? 2
		});
		this.vacuumTickAcc = 0;
		this.emit("vacuum:spawn", { x: this.vacuum.x, y: this.vacuum.y });
		this.emit("live", { text: "A vacuum roars to life!" });
		return true;
	}

	maybeSpawnSpecials(delta = this.tick) {
		if (!this.superModeActive) {
			this.powerup = null;
			this.bomb = null;
			return;
		}
		if (!this.powerup && this.powerCooldown <= 0) {
			if (Math.random() < this.powerupSpawnChance) {
				this.spawnPowerup();
				this.powerCooldown = this.powerupCooldownMs;
			}
		} else {
			this.powerCooldown = Math.max(0, this.powerCooldown - delta);
		}
		if (!this.bomb && this.bombCooldown <= 0) {
			if (Math.random() < this.bombSpawnChance) {
				this.spawnBomb();
				this.bombCooldown = this.bombCooldownMs;
			}
		} else {
			this.bombCooldown = Math.max(0, this.bombCooldown - delta);
		}
	}

	tickEffects(delta = this.tick) {
		const keys = Object.keys(this.activeEffects);
		if (!keys.length) return;
		let changed = false;
		keys.forEach((key) => {
			const timer = this.activeEffects[key];
			timer.remaining -= delta;
			if (timer.remaining <= 0) {
				delete this.activeEffects[key];
				changed = true;
			}
		});
		if (changed) {
			this.applyEffects();
		} else {
			this.emit("effects", { active: { ...this.activeEffects } });
		}
	}

	/**
	 * Grant a timed powerup effect programmatically (Catnip Mouse, Chaos affix, etc.).
	 * @param {string} key one of the configured powerup keys (speed, score, shield)
	 * @param {number} [duration] ms; falls back to the powerup type default
	 */
	applyEffect(key, duration) {
		if (!key) return;
		const fallback = this.config.powerupTypes?.find((p) => p.key === key)?.duration
			|| ENGINE_CONSTANTS.DEFAULT_POWERUP_DURATION;
		const dur = Number(duration) > 0 ? Number(duration) : fallback;
		this.activeEffects[key] = { remaining: dur, duration: dur };
		this.applyEffects();
		this.emit("powerup:clear", { reason: "granted", key });
	}

	applyEffects() {
		// Score powerup stacks on top of the run-level multiplier (affixes / starting modifiers).
		this.scoreMultiplier = this.runScoreMultiplier * (this.activeEffects.score ? 2 : 1);
		const speedActive = Boolean(this.activeEffects.speed);
		const desiredTick = speedActive
			? Math.max(MIN_SPEED_TICK, Math.round(this.baseTick * SPEED_TICK_FACTOR))
			: this.baseTick;
		if (desiredTick !== this.tick) {
			this.tick = desiredTick;
			this.restartLoopTiming();
		}
		this.emit("effects", { active: { ...this.activeEffects } });
	}

	applyTreatBehavior(behavior = null) {
		if (behavior && typeof behavior.hook === "function") {
			this.treatSpawnHook = behavior.hook;
		} else {
			this.treatSpawnHook = null;
		}
		const delay = behavior?.respawnDelayMs ?? 0;
		this.treatRespawnDelay = Math.max(0, Number(delay) || 0);
	}

	setTreatSpawnBehavior(behavior = null) {
		this.applyTreatBehavior(behavior);
	}

	setCollisionInterceptor(interceptor) {
		this.collisionInterceptor = typeof interceptor === "function" ? interceptor : null;
	}

	queueTreatRespawn() {
		if (this.treatRespawnDelay > 0) {
			this.pendingTreatSpawn = true;
			this.treatRespawnTimer = this.treatRespawnDelay;
			this.treat = null;
		} else {
			this.spawnTreat();
		}
	}

	tickTreatRespawn(delta = this.tick) {
		if (!this.pendingTreatSpawn) return;
		this.treatRespawnTimer -= delta;
		if (this.treatRespawnTimer <= 0) {
			this.pendingTreatSpawn = false;
			this.spawnTreat();
		}
	}

	resolveTreatCell() {
		let slot = this.randomEmptyCell();
		if (!slot) {
			console.warn('Cannot resolve treat cell - board is full');
			return { x: 0, y: 0 }; // Fallback, but caller should handle null
		}
		if (this.treatSpawnHook) {
			try {
				const custom = this.treatSpawnHook({
					candidate: slot,
					boardSize: this.boardSize,
					snake: this.snake,
					occupied: (x, y) => this.cellOccupied(x, y),
					randomEmptyCell: () => this.randomEmptyCell()
				});
				if (custom && Number.isInteger(custom.x) && Number.isInteger(custom.y) && !this.cellOccupied(custom.x, custom.y)) {
					slot = custom;
				}
			} catch (error) {
				console.warn("Treat spawn hook failed", error);
			}
		}
		return slot;
	}

	/**
	 * Estimates how many cells are currently occupied.
	 * Used to choose optimal empty cell finding strategy.
	 */
	_estimateOccupiedCount() {
		return this.snake.length +
			(this.treat ? 1 : 0) +
			(this.powerup ? 1 : 0) +
			(this.bomb ? 1 : 0) +
			(this.vacuum ? 1 : 0) +
			this.vacuumTail.length +
			this.obstacles.length;
	}

	/**
	 * Random sampling strategy - good for sparse boards.
	 * O(attempts) with O(1) per attempt due to Set lookups.
	 */
	_randomSampleEmptyCell(maxAttempts) {
		for (let i = 0; i < maxAttempts; i++) {
			const x = Math.floor(Math.random() * this.boardSize);
			const y = Math.floor(Math.random() * this.boardSize);
			if (!this.cellOccupied(x, y)) return { x, y };
		}
		return null;
	}

	/**
	 * Enumeration strategy - guaranteed to find empty cell if one exists.
	 * O(boardSize²) but deterministic. Used for dense boards.
	 */
	_enumerateAndPickEmptyCell() {
		const emptyCells = [];
		for (let y = 0; y < this.boardSize; y++) {
			for (let x = 0; x < this.boardSize; x++) {
				if (!this.cellOccupied(x, y)) {
					emptyCells.push({ x, y });
				}
			}
		}
		if (emptyCells.length === 0) return null;
		return emptyCells[Math.floor(Math.random() * emptyCells.length)];
	}

	/**
	 * Finds a random empty cell using adaptive strategy based on board fill level.
	 * Returns null if board is completely full (callers must handle this).
	 */
	randomEmptyCell(maxAttempts = ENGINE_CONSTANTS.MAX_RANDOM_ATTEMPTS) {
		const totalCells = this.boardSize * this.boardSize;
		const occupied = this._estimateOccupiedCount();
		const fillRatio = occupied / totalCells;

		// For sparse boards, random sampling is faster
		if (fillRatio < ENGINE_CONSTANTS.BOARD_FILL_THRESHOLD) {
			const result = this._randomSampleEmptyCell(maxAttempts);
			if (result) return result;
		}

		// For dense boards or if sampling failed, enumerate all cells
		return this._enumerateAndPickEmptyCell();
	}

	cellOccupied(x, y) {
		if (this._hasSnakePosition(x, y)) return true; // O(1) lookup
		if (this.treat && this.treat.x === x && this.treat.y === y) return true;
		if (this.powerup && this.powerup.x === x && this.powerup.y === y) return true;
		if (this.bomb && this.bomb.x === x && this.bomb.y === y) return true;
		if (this.vacuum && this.vacuum.x === x && this.vacuum.y === y) return true;
		if (this.isVacuumTailCell(x, y)) return true;
		if (this.hasObstacle(x, y)) return true; // Obstacles occupy cells
		return false;
	}

	stepVacuum() {
		if (!this.vacuum) return;
		const behavior = this.vacuumBehavior();
		this.vacuumTickAcc += 1;
		if (this.vacuumTickAcc < behavior.speedRatio) return;
		this.vacuumTickAcc = 0;

		// Check if vacuum is stuck (hasn't moved in several ticks)
		const currentPos = `${this.vacuum.x},${this.vacuum.y}`;
		if (this.vacuumLastPosition === currentPos) {
			this.vacuumStuckCounter += 1;
		} else {
			this.vacuumStuckCounter = 0;
			this.vacuumLastPosition = currentPos;
		}

		// If stuck for threshold ticks, activate escape mechanism
		const isStuck = this.vacuumStuckCounter >= ENGINE_CONSTANTS.VACUUM_STUCK_THRESHOLD;

		let dx = this.vacuum.dx;
		let dy = this.vacuum.dy;

		// PURSUIT MODE: Sometimes actively chase the player
		const pursuitChance = behavior.pursuitChance ?? 0.35;
		const head = this.snake[0];
		const isPursuing = head && Math.random() < pursuitChance;

		if (isPursuing && head) {
			// Calculate direction towards player
			const toPlayerX = head.x - this.vacuum.x;
			const toPlayerY = head.y - this.vacuum.y;

			// Prefer the axis with greater distance
			if (Math.abs(toPlayerX) > Math.abs(toPlayerY)) {
				dx = toPlayerX > 0 ? 1 : -1;
				dy = 0;
			} else if (Math.abs(toPlayerY) > 0) {
				dx = 0;
				dy = toPlayerY > 0 ? 1 : -1;
			}
		} else if (Math.random() < behavior.turnChance) {
			// Random turn when not pursuing
			[dx, dy] = Math.random() < 0.5 ? [dy, -dx] : [-dy, dx];
		}

		const turnLeft = { dx: dy, dy: -dx };
		const turnRight = { dx: -dy, dy: dx };
		const reverse = { dx: -dx, dy: -dy };

		// Build option pool - pursuit direction first if pursuing
		const optionPool = isPursuing
			? [{ dx, dy }, turnLeft, turnRight, reverse]
			: [{ dx, dy }, Math.random() < 0.5 ? turnLeft : turnRight, Math.random() < 0.5 ? turnRight : turnLeft, reverse];

		const tried = new Set();
		let chosen = null;
		for (const option of optionPool) {
			const key = `${option.dx},${option.dy}`;
			if (tried.has(key)) continue;
			tried.add(key);
			const nx = this.vacuum.x + option.dx;
			const ny = this.vacuum.y + option.dy;
			if (this.isBlockedForVacuum(nx, ny)) continue;
			chosen = { ...option, nx, ny };
			break;
		}

		// ESCAPE MECHANISM: If stuck and no valid moves, shrink tail and try again
		if (!chosen && isStuck) {
			const minTail = behavior.minTail ?? ENGINE_CONSTANTS.VACUUM_MIN_TAIL;
			const shrinkAmount = Math.min(
				ENGINE_CONSTANTS.VACUUM_ESCAPE_SHRINK,
				Math.max(0, this.vacuumTail.length - minTail)
			);
			for (let i = 0; i < shrinkAmount; i++) {
				const removed = this.vacuumTail.pop();
				if (removed) this.dropTailSegment(removed);
			}
			this.vacuumTailTarget = Math.max(minTail, this.vacuumTailTarget - shrinkAmount);

			// Try movement options again with cleared tail
			tried.clear();
			for (const option of optionPool) {
				const key = `${option.dx},${option.dy}`;
				if (tried.has(key)) continue;
				tried.add(key);
				const nx = this.vacuum.x + option.dx;
				const ny = this.vacuum.y + option.dy;
				if (this.isBlockedForVacuum(nx, ny)) continue;
				chosen = { ...option, nx, ny };
				break;
			}

			if (chosen) {
				this.emit("vacuum:escape", { x: this.vacuum.x, y: this.vacuum.y });
				this.emit("live", { text: "The vacuum wiggled free!" });
			}
		}

		if (!chosen) return;
		const prev = { x: this.vacuum.x, y: this.vacuum.y };
		this.vacuum.dx = chosen.dx;
		this.vacuum.dy = chosen.dy;
		this.vacuum.x = chosen.nx;
		this.vacuum.y = chosen.ny;
		let stoleTreat = false;
		if (this.treat && this.vacuum.x === this.treat.x && this.vacuum.y === this.treat.y) {
			const stolenTreat = this.treat;
			const tailGain = behavior.tailGain + (stolenTreat.score || 1);
			this.vacuumTailTarget = this.clampVacuumTailTarget(this.vacuumTailTarget + tailGain);
			this.treat = null;
			stoleTreat = true;
			this.emit("live", { text: `The vacuum stole your ${stolenTreat.key || "treat"}!` });
			this.emit("audio", { type: "vacuum-steal" });
		}
		if (this.powerup && this.vacuum.x === this.powerup.x && this.vacuum.y === this.powerup.y) {
			this.powerup = null;
			this.emit("powerup:clear", { reason: "vacuum" });
			this.emit("live", { text: "The vacuum shorted a powerup!" });
		}
		if (this.bomb && this.vacuum.x === this.bomb.x && this.vacuum.y === this.bomb.y) {
			this.bomb = null;
			this.emit("bomb:clear", { reason: "vacuum" });
			this.emit("live", { text: "The vacuum safely ate a bomb." });
		}
		this.syncVacuumTail(prev, behavior);
		if (stoleTreat) {
			this.queueTreatRespawn();
		}
	}

	draw() {
		if (!this.renderAdapter) return;
		this.renderAdapter({
			snake: this.snake,
			treat: this.treat,
			powerup: this.powerup,
			bomb: this.bomb,
			vacuum: this.vacuum,
			vacuumTail: this.vacuumTail,
			obstacles: this.obstacles,
			direction: { ...this.direction },
			activeEffects: this.activeEffects
		});
	}
}
