/*
 * foster-scoot-engine.js
 * "Foster Scoot" - a Pac-Man-style maze runner for Monroe Humane Society.
 *
 * ARCHITECTURE:
 *  • Pure state machine - zero DOM access, zero side-effects outside emit().
 *  • Communicates upstream via the same on()/emit() event bus as PetSnakeEngine.
 *  • this.snake = [{ x, y }] - single-element array so DomBoardRenderer renders
 *    the player as a "snake head of length 1" with native head-rotation transforms.
 *  • Primary vacuum occupies renderAdapter.vacuum (native is-vacuum styling).
 *    Extra vacuums are passed as renderAdapter.obstacles for DomBoardRenderer
 *    back-compat; extend DomBoardRenderer for richer multi-vacuum visuals.
 *  • Static board cells (walls, dots) are initialised ONCE via "board:init".
 *    The renderAdapter loop only carries dynamic entities each frame.
 *
 * LIFECYCLE:
 *   const engine = new FosterScootEngine();
 *   engine.attachRenderAdapter(fn);
 *   engine.init(stateManager);
 *   engine.on("board:init", ({ matrix, dots, megaTreats }) => buildBoard(...));
 *   engine.on("dot:eat",    ({ x, y })                    => removeDot(...));
 *   engine.on("score",      ({ score })                   => updateHUD(...));
 *   engine.on("health:change", ({ hearts })               => updateHearts(...));
 *   engine.on("audio",      payload                       => beep(payload));
 *   engine.start();
 */

import { GAME_STATES } from './game-state-manager.js';

// ─── Engine constants ─────────────────────────────────────────────────────────

const ENGINE_CONSTANTS = Object.freeze({
	MAX_FRAME_DELTA_MS:   120,  // ms - spiral-of-death guard
	MAX_INPUT_QUEUE_SIZE:   3,  // buffered direction inputs
});

const BOARD_SIZE          = 19;
const TICK_MS             = 160;  // ms between game steps (≈ 6 fps logic)
const MEGA_TREAT_TICKS    = 45;   // steps vacuums stay frightened
const VACUUM_SLEEP_TICKS  =  6;   // immobility steps after a vacuum is caught
const MAX_HEARTS          =  3;

// ─── Direction helpers ────────────────────────────────────────────────────────

/** Accepts both arrow-key strings and plain word strings. */
const DIR_MAP = Object.freeze({
	ArrowUp:    { x:  0, y: -1 },
	ArrowDown:  { x:  0, y:  1 },
	ArrowLeft:  { x: -1, y:  0 },
	ArrowRight: { x:  1, y:  0 },
	up:         { x:  0, y: -1 },
	down:       { x:  0, y:  1 },
	left:       { x: -1, y:  0 },
	right:      { x:  1, y:  0 },
});

const CARDINALS = Object.freeze([
	{ x:  0, y: -1 },
	{ x:  0, y:  1 },
	{ x: -1, y:  0 },
	{ x:  1, y:  0 },
]);

// ─── Vacuum definitions ───────────────────────────────────────────────────────

/**
 * speedRatio: vacuum moves once every N engine ticks.
 *   1.0 = same pace as player  |  1.5 = 50% slower  |  2.0 = half speed
 */
const VACUUM_INIT = Object.freeze([
	{ id: 1, type: 'upright',  x: 9,  y: 8, dx:  0, dy: -1, state: 'scatter', speedRatio: 1.3 },
	{ id: 2, type: 'canister', x: 8,  y: 9, dx: -1, dy:  0, state: 'chase',   speedRatio: 1.0 },
	{ id: 3, type: 'robot',    x: 10, y: 9, dx:  1, dy:  0, state: 'random',  speedRatio: 1.5 },
]);

const VACUUM_EMOJI = Object.freeze({
	upright:    '🧹',
	canister:   '🤖',
	robot:      '🌀',
	frightened: '👻',
});

// ─── Collectible positions ────────────────────────────────────────────────────

/** Player spawn - row 16 is a fully open corridor. */
const PLAYER_START = Object.freeze({ x: 9, y: 16 });

/** Power pellets at the four corners of the playable area. */
const MEGA_TREAT_POSITIONS = Object.freeze([
	{ x:  1, y:  1 },
	{ x: 17, y:  1 },
	{ x:  1, y: 17 },
	{ x: 17, y: 17 },
]);

// ─── Audio presets ────────────────────────────────────────────────────────────
// Consumers map `type` to a category label; `freq/dur/wave/vol` allow the host
// to pass parameters directly to shared.js beep(freq, dur, type, vol).

const AUDIO = Object.freeze({
	kibble:   { type: 'kibble',   freq:  750, dur: 0.05, wave: 'triangle', vol: 0.15 },
	megaLow:  { type: 'powerup',  freq:  700, dur: 0.08, wave: 'triangle', vol: 0.20 },
	megaHigh: { type: 'powerup',  freq: 1050, dur: 0.10, wave: 'triangle', vol: 0.18 },
	eatVac:   { type: 'treat',    freq:  500, dur: 0.25, wave: 'sawtooth', vol: 0.22 },
	hurt:     { type: 'fail',     freq:  220, dur: 0.28, wave: 'sawtooth', vol: 0.28 },
	gameOver: { type: 'fail',     freq:  160, dur: 0.45, wave: 'sawtooth', vol: 0.32 },
});

// ─── Maze matrix ─────────────────────────────────────────────────────────────
//
//  0  corridor  - kibble dot placed here at game start
//  1  wall      - impassable to player AND vacuums
//  2  spawn zone - accessible only to vacuum agents; player cannot enter
//
// Layout is symmetric left–right. Key landmarks:
//   y= 0 / y=18 : outer border walls
//   y= 1,  x=1/17 : mega treat corners (top)
//   y= 8,  x=9    : vacuum 1 spawn (upright, scatter)
//   y= 9,  x=8/10 : vacuum 2/3 spawn (inside zone)
//   y=10           : horizontal bypass corridor flanking the ghost house
//   y=16,  x=9    : player spawn
//   y=17,  x=1/17 : mega treat corners (bottom)
//
const MAZE_MATRIX = Object.freeze([
	/* y= 0 */ [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
	/* y= 1 */ [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
	/* y= 2 */ [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
	/* y= 3 */ [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
	/* y= 4 */ [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	/* y= 5 */ [1,0,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,0,1],
	/* y= 6 */ [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
	/* y= 7 */ [1,1,1,1,0,1,1,1,0,0,0,1,1,1,0,1,1,1,1],
	/* y= 8 */ [1,1,1,1,0,1,0,0,0,0,0,0,0,1,0,1,1,1,1],  // vac-1 @ (9,8)
	/* y= 9 */ [1,1,1,1,0,1,0,2,2,2,2,2,0,1,0,1,1,1,1],  // vac-2 @ (8,9), vac-3 @ (10,9)
	/* y=10 */ [1,0,0,0,0,0,0,2,2,2,2,2,0,0,0,0,0,0,1],  // bypass corridor
	/* y=11 */ [1,1,1,1,0,1,0,2,2,2,2,2,0,1,0,1,1,1,1],
	/* y=12 */ [1,1,1,1,0,1,0,0,0,0,0,0,0,1,0,1,1,1,1],
	/* y=13 */ [1,1,1,1,0,1,1,1,0,0,0,1,1,1,0,1,1,1,1],
	/* y=14 */ [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
	/* y=15 */ [1,0,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,0,1],
	/* y=16 */ [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],  // player @ (9,16)
	/* y=17 */ [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
	/* y=18 */ [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
]);

// ─── Engine class ─────────────────────────────────────────────────────────────

export class FosterScootEngine {

	/**
	 * @param {object}   [options]
	 * @param {number}   [options.tickMs=160]        - ms between game steps
	 * @param {Function} [options.renderAdapter=null] - same as PetSnakeEngine
	 */
	constructor(options = {}) {
		this.boardSize     = BOARD_SIZE;
		this.tick          = options.tickMs ?? TICK_MS;
		this.renderAdapter = options.renderAdapter ?? null;
		this.stateManager  = null;
		this.eventHandlers = new Map();

		// Game state - fully populated by _resetState()
		this.snake        = [];
		this.direction    = { x: 1, y: 0 };
		this.inputQueue   = [];
		this.vacuums      = [];
		this.dots         = new Set();   // "x,y" keys for remaining kibble dots
		this.activeMegaTreats = new Set(); // "x,y" keys for remaining mega treats
		this.totalDots    = 0;
		this.hearts       = MAX_HEARTS;
		this.score        = 0;
		this.flags        = { megaTreatActive: false, megaTreatTicksRemaining: 0 };
		this.inPlay       = false;
		this.paused       = false;

		// RAF loop state
		this.rafId            = null;
		this.frameAccumulator = 0;
		this.lastFrameTime    = 0;

		// Timing adapter - browser RAF when available, setTimeout fallback for Node tests
		const hasBrowser = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';
		this._raf  = hasBrowser
			? (cb) => window.requestAnimationFrame(cb)
			: (cb) => setTimeout(() => cb(Date.now()), 16);
		this._caf  = hasBrowser
			? (id) => window.cancelAnimationFrame(id)
			: (id) => clearTimeout(id);
		this._now  = (typeof performance !== 'undefined' && performance.now)
			? () => performance.now()
			: () => Date.now();
	}

	// ── Event bus ─────────────────────────────────────────────────────────────
	// Identical contract to PetSnakeEngine so host wiring is interchangeable.

	/**
	 * Register a listener for a named event.
	 * @param {string}   event
	 * @param {Function} handler
	 * @returns {Function} Unsubscribe function
	 */
	on(event, handler) {
		if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, new Set());
		this.eventHandlers.get(event).add(handler);
		return () => this.eventHandlers.get(event)?.delete(handler);
	}

	/**
	 * Fire all listeners for a named event.
	 * @param {string} event
	 * @param {*}      payload
	 */
	emit(event, payload) {
		const listeners = this.eventHandlers.get(event);
		if (!listeners) return;
		listeners.forEach(h => h(payload));
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	/**
	 * Bind the shared GameStateManager. Call before start().
	 * @param {import('./game-state-manager.js').GameStateManager} stateManager
	 * @returns {this}
	 */
	init(stateManager) {
		this.stateManager = stateManager;
		return this;
	}

	/**
	 * Attach the render adapter callback (same API as PetSnakeEngine).
	 * @param {Function} adapter
	 * @returns {this}
	 */
	attachRenderAdapter(adapter) {
		this.renderAdapter = adapter;
		return this;
	}

	/**
	 * Reset all state, emit "board:init" for static cell setup, then begin the
	 * tick loop. Sets GameStateManager to PLAYING.
	 */
	start() {
		this._resetState();

		if (this.stateManager) this.stateManager.setState(GAME_STATES.PLAYING);

		// One-shot event so consumers can stamp wall/dot classes onto the DOM once
		// rather than re-rendering the static grid every frame.
		this.emit('board:init', {
			matrix:     MAZE_MATRIX,
			dots:       this._dotPositionsArray(),
			megaTreats: MEGA_TREAT_POSITIONS.slice(),
			boardSize:  BOARD_SIZE,
		});

		this.emit('run:start', {});
		this.emit('score',         { score: 0, delta: 0 });
		this.emit('health:change', { hearts: this.hearts });

		this.inPlay = true;
		this.paused = false;
		this._ensureLoop();
		this.draw();
	}

	/** Freeze the loop without discarding board state. */
	pause() {
		if (!this.inPlay || this.paused) return;
		this.paused = true;
		this._stopLoop();
		if (this.stateManager) this.stateManager.setState(GAME_STATES.PAUSED);
		this.emit('run:pause', {});
	}

	/** Resume after pause(). */
	resume() {
		if (!this.inPlay || !this.paused) return;
		this.paused = false;
		if (this.stateManager) this.stateManager.setState(GAME_STATES.PLAYING);
		this._ensureLoop();
		this.emit('run:resume', {});
	}

	/** Halt the loop. Called internally by defeat/victory; safe to call externally. */
	stop() {
		this._stopLoop();
		this.inPlay = false;
		this.paused = false;
		this.emit('run:stop', {});
	}

	// ── Input ─────────────────────────────────────────────────────────────────

	/**
	 * Queue a directional input. Accepts both arrow-key strings ('ArrowUp') and
	 * plain strings ('up'). Matches ENGINE_CONSTANTS.MAX_INPUT_QUEUE_SIZE = 3.
	 * @param {string} directionString
	 */
	handleInput(directionString) {
		const vec = DIR_MAP[directionString];
		if (!vec) return;
		if (this.inputQueue.length >= ENGINE_CONSTANTS.MAX_INPUT_QUEUE_SIZE) return;

		// Reject 180° reversals and same-direction duplicates
		const last = this.inputQueue.length
			? this.inputQueue[this.inputQueue.length - 1]
			: this.direction;
		if (last.x === -vec.x && last.y === -vec.y) return;  // reversal
		if (last.x ===  vec.x && last.y ===  vec.y) return;  // duplicate

		this.inputQueue.push(vec);
	}

	/** Alias matching PetSnakeEngine's public method name. */
	enqueueDirection(key) { this.handleInput(key); }

	// ── Core tick ─────────────────────────────────────────────────────────────

	/**
	 * Advance the world by one logic step. Called by the RAF loop.
	 * @param {number} _delta - elapsed ms (ignored; fixed-step model)
	 */
	step(_delta) {
		if (!this.inPlay || this.paused) return;

		// ── 1. Decrement mega treat timer ────────────────────────────────────
		if (this.flags.megaTreatActive) {
			if (--this.flags.megaTreatTicksRemaining <= 0) {
				this._deactivateMegaTreat();
			}
		}

		// ── 2. Advance all vacuum agents (may trigger defeat) ─────────────────
		this._stepVacuums();
		if (!this.inPlay) return;

		// ── 3. Resolve queued player input ────────────────────────────────────
		//
		// Try the first buffered direction. If it's blocked, leave it queued so
		// the player smoothly turns as soon as the path opens (corner buffering).
		// If it's a duplicate of the current direction, discard and continue.
		const head = this.snake[0];

		while (this.inputQueue.length > 0) {
			const candidate = this.inputQueue[0];

			// Discard reversals (shouldn't reach here, but belt-and-suspenders)
			if (candidate.x === -this.direction.x && candidate.y === -this.direction.y) {
				this.inputQueue.shift();
				continue;
			}

			const testX = head.x + candidate.x;
			const testY = head.y + candidate.y;

			if (this._isPlayerPassable(testX, testY)) {
				// Path is clear - commit this direction
				this.direction = this.inputQueue.shift();
			}
			// Path blocked - keep candidate buffered; try current direction below
			break;
		}

		// ── 4. Compute next position ──────────────────────────────────────────
		const nextX = head.x + this.direction.x;
		const nextY = head.y + this.direction.y;

		// ── 5. Wall / spawn-zone collision - no death, slide or freeze ─────────
		//
		// Per spec: if the primary direction is blocked, try the first passable
		// lateral direction still in the queue; otherwise freeze this tick.
		if (!this._isPlayerPassable(nextX, nextY)) {
			const altIdx = this.inputQueue.findIndex(d =>
				this._isPlayerPassable(head.x + d.x, head.y + d.y)
			);
			if (altIdx !== -1) {
				const alt = this.inputQueue.splice(altIdx, 1)[0];
				this.direction = alt;
				this.snake[0]  = { x: head.x + alt.x, y: head.y + alt.y };
				this._onPlayerMoved(this.snake[0].x, this.snake[0].y);
			}
			// else: complete freeze - player position unchanged this tick
			return;
		}

		// ── 6. Move player ────────────────────────────────────────────────────
		this.snake[0] = { x: nextX, y: nextY };
		this._onPlayerMoved(nextX, nextY);
	}

	// ── Player movement resolution ────────────────────────────────────────────

	/** Called whenever the player actually moves to a new cell. */
	_onPlayerMoved(x, y) {
		const key = this._posKey(x, y);

		// Mega treat collection (power pellet)
		if (this.activeMegaTreats.has(key)) {
			this.activeMegaTreats.delete(key);
			this._activateMegaTreat(x, y);
			if (!this.inPlay) return; // Victory may have triggered
		}

		// Kibble dot collection
		if (this.dots.has(key)) {
			this.dots.delete(key);
			this._onDotEaten(x, y);
			if (!this.inPlay) return;
		}

		// Check if player stepped onto a vacuum
		this._checkVacuumCollisions(x, y);
	}

	_onDotEaten(x, y) {
		const points = 10;
		this.score += points;
		this.emit('score', { score: this.score, delta: points });
		this.emit('audio', { ...AUDIO.kibble });
		this.emit('dot:eat', { x, y, dotsRemaining: this.dots.size });

		// Victory when every dot AND every mega treat is gone
		if (this.dots.size === 0 && this.activeMegaTreats.size === 0) {
			this._triggerVictory();
		}
	}

	// ── Mega treat (power pellet) ─────────────────────────────────────────────

	_activateMegaTreat(x, y) {
		this.flags.megaTreatActive         = true;
		this.flags.megaTreatTicksRemaining = MEGA_TREAT_TICKS;

		// Save each vacuum's mode, switch all to frightened scatter
		this.vacuums.forEach(v => {
			v.prevState = v.state;
			v.state     = 'scatter';
		});

		this.emit('megatreat:eat', { x, y });
		this.emit('live', { text: 'Mega Treat activated! The vacuums are scattering!' });

		// Ascending arpeggio sweep - two tones; consumer staggers timing if desired
		this.emit('audio', { ...AUDIO.megaLow  });
		this.emit('audio', { ...AUDIO.megaHigh });

		// Victory if this was the last collectible
		if (this.dots.size === 0 && this.activeMegaTreats.size === 0) {
			this._triggerVictory();
		}
	}

	_deactivateMegaTreat() {
		this.flags.megaTreatActive         = false;
		this.flags.megaTreatTicksRemaining = 0;

		// Restore each vacuum to its pre-frightened state
		this.vacuums.forEach(v => {
			if (v.prevState !== undefined) {
				v.state     = v.prevState;
				v.prevState = undefined;
			}
		});

		this.emit('live', { text: 'Mega Treat expired. Vacuums resuming normal behavior.' });
	}

	// ── Vacuum AI ─────────────────────────────────────────────────────────────

	/**
	 * Advance every vacuum agent. Each agent checks for player collision after
	 * its own move so "vacuum walks into player" is caught symmetrically with
	 * "player walks into vacuum" (_checkVacuumCollisions, called after step()).
	 */
	_stepVacuums() {
		for (const vac of this.vacuums) {
			if (!this.inPlay) break;

			// ── Sleep penalty (after being eaten) ────────────────────────────
			if (vac.sleepTicks > 0) {
				vac.sleepTicks--;
				continue;
			}

			// ── Speed throttle ────────────────────────────────────────────────
			vac.tickAcc = (vac.tickAcc || 0) + 1;
			if (vac.tickAcc < vac.speedRatio) continue;
			vac.tickAcc = 0;

			// ── Move ──────────────────────────────────────────────────────────
			this._stepVacuumAgent(vac);

			// ── Post-move collision with player ───────────────────────────────
			if (!this.inPlay) break;
			const head = this.snake[0];
			if (vac.x === head.x && vac.y === head.y && vac.sleepTicks === 0) {
				if (this.flags.megaTreatActive) {
					this._eatVacuum(vac);
				} else {
					this._playerHurt();
					break;
				}
			}
		}
	}

	/**
	 * Compute and commit a single vacuum's movement for this tick.
	 *
	 * Intersection-based pathfinding (classic Pac-Man ghost AI):
	 *   • Straight corridors: continue without re-scoring.
	 *   • Intersections (>1 non-reverse option) or dead-ends: score all
	 *     candidates with Manhattan distance heuristic and pick the best.
	 * @param {object} vac - mutable vacuum agent record
	 */
	_stepVacuumAgent(vac) {
		const head       = this.snake[0];
		const reverseDir = { x: -vac.dx, y: -vac.dy };

		// Valid non-reverse moves from the current cell
		const validNonReverse = CARDINALS.filter(d =>
			!(d.x === reverseDir.x && d.y === reverseDir.y) &&
			this._isVacuumPassable(vac.x + d.x, vac.y + d.y)
		);

		const canContinue    = this._isVacuumPassable(vac.x + vac.dx, vac.y + vac.dy);
		const atIntersection = validNonReverse.length > 1 || !canContinue;

		// Straight corridor - just advance; no re-scoring needed
		if (!atIntersection && canContinue) {
			vac.x += vac.dx;
			vac.y += vac.dy;
			return;
		}

		// Choose from non-reverse options; fall back to any direction if trapped
		const candidates = validNonReverse.length > 0
			? validNonReverse
			: CARDINALS.filter(d => this._isVacuumPassable(vac.x + d.x, vac.y + d.y));

		if (candidates.length === 0) return; // Fully cornered - stay put

		// Current effective mode: mega treat overrides agent's own state to scatter
		const mode = this.flags.megaTreatActive ? 'scatter' : vac.state;
		let chosen;

		if (mode === 'chase') {
			// Minimise Manhattan distance to player - closes in aggressively
			chosen = candidates.reduce((best, d) => {
				const dist  = Math.abs((vac.x + d.x)    - head.x) + Math.abs((vac.y + d.y)    - head.y);
				const bDist = Math.abs((vac.x + best.x) - head.x) + Math.abs((vac.y + best.y) - head.y);
				return dist < bDist ? d : best;
			});
		} else if (mode === 'scatter') {
			// Maximise Manhattan distance from player - flees in frightened mode
			chosen = candidates.reduce((best, d) => {
				const dist  = Math.abs((vac.x + d.x)    - head.x) + Math.abs((vac.y + d.y)    - head.y);
				const bDist = Math.abs((vac.x + best.x) - head.x) + Math.abs((vac.y + best.y) - head.y);
				return dist > bDist ? d : best;
			});
		} else {
			// Random mode - uniform random valid direction (fallback / patrol)
			chosen = candidates[Math.floor(Math.random() * candidates.length)];
		}

		vac.dx = chosen.x;
		vac.dy = chosen.y;
		vac.x += chosen.x;
		vac.y += chosen.y;
	}

	// ── Collision resolution ──────────────────────────────────────────────────

	/**
	 * Check whether the player at (px, py) overlaps any active vacuum.
	 * Called after each player move step.
	 */
	_checkVacuumCollisions(px, py) {
		for (const vac of this.vacuums) {
			if (vac.sleepTicks > 0)        continue; // sleeping - immune
			if (vac.x !== px || vac.y !== py) continue; // no overlap

			if (this.flags.megaTreatActive) {
				// ── Condition B: player eats the frightened vacuum ────────────
				this._eatVacuum(vac);
			} else {
				// ── Condition A: vacuum damages the player ────────────────────
				this._playerHurt();
				return; // One hit per step
			}
		}
	}

	/**
	 * Player catches a frightened vacuum.
	 * Scores points, emits audio, then returns the vacuum to its spawn with a
	 * sleep penalty so it re-emerges after VACUUM_SLEEP_TICKS steps.
	 */
	_eatVacuum(vac) {
		const points = 200;
		this.score += points;
		this.emit('score',        { score: this.score, delta: points });
		this.emit('audio',        { ...AUDIO.eatVac });
		this.emit('vacuum:eaten', { id: vac.id, x: vac.x, y: vac.y });
		this.emit('live',         { text: `You caught the ${vac.type} vacuum! +${points} pts` });

		// Return vacuum to its original spawn position
		const spawn = VACUUM_INIT.find(v => v.id === vac.id);
		if (spawn) {
			vac.x  = spawn.x;
			vac.y  = spawn.y;
			vac.dx = spawn.dx;
			vac.dy = spawn.dy;
		}
		vac.sleepTicks = VACUUM_SLEEP_TICKS;
		this.emit('vacuum:reset', { id: vac.id });
	}

	/**
	 * Player was caught by a vacuum while not frightened.
	 * Deducts one heart. Resets positions or triggers defeat.
	 */
	_playerHurt() {
		this.hearts--;
		this.emit('health:change', { hearts: this.hearts });
		this.emit('audio',         { ...AUDIO.hurt });
		this.emit('live', {
			text: `Caught by a vacuum! ${this.hearts} heart${this.hearts !== 1 ? 's' : ''} remaining.`,
		});

		if (this.hearts <= 0) {
			this._triggerDefeat();
			return;
		}

		this._resetPositions();
	}

	/**
	 * Snap player and all vacuums back to their spawn positions.
	 * Called after a non-fatal collision. Cancels any active mega treat.
	 */
	_resetPositions() {
		// Reset player
		this.snake[0]      = { ...PLAYER_START };
		this.direction     = { x: 1, y: 0 };
		this.inputQueue.length = 0;

		// Reset all vacuums to spawn with brief sleep penalty
		VACUUM_INIT.forEach((init, i) => {
			const vac = this.vacuums[i];
			if (!vac) return;
			vac.x          = init.x;
			vac.y          = init.y;
			vac.dx         = init.dx;
			vac.dy         = init.dy;
			vac.sleepTicks = VACUUM_SLEEP_TICKS;
			vac.tickAcc    = 0;
		});

		// Cancel mega treat on death reset (matches classic Pac-Man behaviour)
		if (this.flags.megaTreatActive) this._deactivateMegaTreat();
	}

	// ── Terminal states ───────────────────────────────────────────────────────

	_triggerVictory() {
		this.stop();
		this.emit('live', { text: 'Every pet has been fostered! Board cleared! 🎉' });
		if (this.stateManager) this.stateManager.setState(GAME_STATES.RUN_VICTORY);
	}

	_triggerDefeat() {
		this.stop();
		this.emit('audio', { ...AUDIO.gameOver });
		this.emit('live',  { text: 'Game over! The vacuums got you.' });
		if (this.stateManager) this.stateManager.setState(GAME_STATES.RUN_DEFEAT);
	}

	// ── Passability helpers ───────────────────────────────────────────────────

	/**
	 * Player can traverse open corridors only (cell value === 0).
	 * Walls (1) and vacuum spawn zones (2) are both blocked.
	 */
	_isPlayerPassable(x, y) {
		if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return false;
		return MAZE_MATRIX[y][x] === 0;
	}

	/**
	 * Vacuums traverse open corridors (0) AND the spawn zone (2).
	 * Only hard walls (1) and out-of-bounds are blocked.
	 */
	_isVacuumPassable(x, y) {
		if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return false;
		return MAZE_MATRIX[y][x] !== 1;
	}

	// ── Render dispatch ───────────────────────────────────────────────────────

	/**
	 * Push current dynamic state to the render adapter.
	 *
	 * DomBoardRenderer-compatible fields are populated every frame.
	 * Extended maze-specific fields (vacuums array, hearts, megaTreatActive,
	 * score) are also included for custom renderer consumers.
	 */
	draw() {
		if (!this.renderAdapter) return;

		// First non-sleeping vacuum → native is-vacuum rendering via DomBoardRenderer
		const primary = this.vacuums.find(v => v.sleepTicks === 0) ?? null;

		// Remaining non-sleeping vacuums → obstacles so their cells are still stamped.
		// Use the frightened emoji during a mega treat so the visual cue is clear.
		const extra = this.vacuums
			.filter(v => v !== primary && v.sleepTicks === 0)
			.map(v => ({
				x:     v.x,
				y:     v.y,
				emoji: this.flags.megaTreatActive
					? VACUUM_EMOJI.frightened
					: (VACUUM_EMOJI[v.type] ?? '🤖'),
			}));

		this.renderAdapter({
			// ── Standard DomBoardRenderer fields ──────────────────────────────
			snake:         this.snake,   // [{x,y}] - single-element player array
			treat:         null,
			powerup:       null,
			bomb:          null,
			vacuum:        primary,
			vacuumTail:    [],
			obstacles:     extra,
			direction:     { ...this.direction },
			activeEffects: {},

			// ── Extended foster-scoot fields (ignored by base DomBoardRenderer) ──
			vacuums:         this.vacuums,
			megaTreatActive: this.flags.megaTreatActive,
			hearts:          this.hearts,
			score:           this.score,
		});
	}

	// ── RAF game loop (mirrors PetSnakeEngine.runLoop) ────────────────────────

	_ensureLoop() {
		if (this.rafId || !this.inPlay || this.paused) return;
		this.frameAccumulator = 0;
		this.lastFrameTime    = 0;
		this.rafId = this._raf(ts => this._runLoop(typeof ts === 'number' ? ts : this._now()));
	}

	_stopLoop() {
		if (this.rafId) {
			this._caf(this.rafId);
			this.rafId = null;
		}
		this.frameAccumulator = 0;
		this.lastFrameTime    = 0;
	}

	_runLoop(timestamp) {
		if (!this.inPlay || this.paused) {
			this.rafId = null;
			return;
		}

		if (!this.lastFrameTime) this.lastFrameTime = timestamp;

		let delta = timestamp - this.lastFrameTime;
		this.lastFrameTime = timestamp;

		// Cap delta to prevent spiral of death after tab becomes visible again
		if (delta > ENGINE_CONSTANTS.MAX_FRAME_DELTA_MS) delta = ENGINE_CONSTANTS.MAX_FRAME_DELTA_MS;

		this.frameAccumulator += delta;

		let advanced = false;
		while (this.frameAccumulator >= this.tick) {
			this.step(this.tick);
			this.frameAccumulator -= this.tick;
			advanced = true;
			if (!this.inPlay || this.paused) break;
		}

		if (advanced) this.draw();

		if (this.inPlay && !this.paused) {
			this.rafId = this._raf(ts => this._runLoop(typeof ts === 'number' ? ts : this._now()));
		} else {
			this.rafId = null;
		}
	}

	// ── State initialisation ──────────────────────────────────────────────────

	_resetState() {
		this.snake         = [{ ...PLAYER_START }];
		this.direction     = { x: 1, y: 0 };
		this.inputQueue    = [];
		this.score         = 0;
		this.hearts        = MAX_HEARTS;
		this.flags         = { megaTreatActive: false, megaTreatTicksRemaining: 0 };
		this.inPlay        = false;
		this.paused        = false;

		this._initVacuums();
		this._initDots();
	}

	_initVacuums() {
		this.vacuums = VACUUM_INIT.map(init => ({
			id:         init.id,
			type:       init.type,
			x:          init.x,
			y:          init.y,
			dx:         init.dx,
			dy:         init.dy,
			state:      init.state,
			baseState:  init.state,    // survives mega-treat resets
			prevState:  undefined,     // saved state during mega treat
			speedRatio: init.speedRatio,
			sleepTicks: 0,
			tickAcc:    0,
		}));
	}

	_initDots() {
		this.dots.clear();
		this.activeMegaTreats.clear();

		// Cells reserved for mega treats and the player spawn are not regular dots
		const megaTreatKeySet = new Set(MEGA_TREAT_POSITIONS.map(p => this._posKey(p.x, p.y)));
		const playerStartKey  = this._posKey(PLAYER_START.x, PLAYER_START.y);

		for (let y = 0; y < BOARD_SIZE; y++) {
			for (let x = 0; x < BOARD_SIZE; x++) {
				if (MAZE_MATRIX[y][x] !== 0) continue;
				const key = this._posKey(x, y);
				if (megaTreatKeySet.has(key)) continue;
				if (key === playerStartKey)   continue;
				this.dots.add(key);
			}
		}

		this.totalDots = this.dots.size;
		MEGA_TREAT_POSITIONS.forEach(p => this.activeMegaTreats.add(this._posKey(p.x, p.y)));
	}

	// ── Utilities ─────────────────────────────────────────────────────────────

	/** Canonical 2D → flat-array index, matching DomBoardRenderer.idx(). */
	idx(x, y) { return y * BOARD_SIZE + x; }

	/** String key for Set/Map lookups. */
	_posKey(x, y) { return `${x},${y}`; }

	/** Snapshot of all active dot positions as an array (used in board:init). */
	_dotPositionsArray() {
		return Array.from(this.dots, key => {
			const [x, y] = key.split(',').map(Number);
			return { x, y };
		});
	}
}
