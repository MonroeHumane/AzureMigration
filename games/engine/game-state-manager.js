/*
 * Game State Manager - Phase 5
 * Centralized state machine for managing game UI states
 * Replaces scattered .is-* class toggles with a single data-game-state attribute
 */

export const GAME_STATES = Object.freeze({
	IDLE: 'idle',
	PLAYING: 'playing',
	PAUSED: 'paused',
	FLOOR_COMPLETE: 'floor-complete',
	RUN_VICTORY: 'run-victory',
	RUN_DEFEAT: 'run-defeat',
});

export class GameStateManager {
	/**
	 * @param {HTMLElement} containerEl - The game container element
	 */
	constructor(containerEl) {
		this.container = containerEl;
		this.state = GAME_STATES.IDLE;
		this.listeners = new Set();
		
		// Initialize state on container
		if (this.container) {
			this.container.dataset.gameState = this.state;
		}
	}
	
	/**
	 * Get current game state
	 * @returns {string} Current state
	 */
	getState() {
		return this.state;
	}
	
	/**
	 * Set new game state
	 * @param {string} newState - New state value from GAME_STATES
	 * @throws {Error} If newState is not a valid GAME_STATES value
	 */
	setState(newState) {
		if (!Object.values(GAME_STATES).includes(newState)) {
			throw new Error(`GameStateManager: Invalid state "${newState}". Valid states: ${Object.values(GAME_STATES).join(', ')}`);
		}
		
		const prevState = this.state;
		if (prevState === newState) return;
		
		this.state = newState;
		
		if (this.container) {
			this.container.dataset.gameState = newState;
		}
		
		this.emit({ prev: prevState, next: newState });
	}
	
	/**
	 * Check if current state matches given state
	 * @param {string} state - State to check against
	 * @returns {boolean}
	 */
	is(state) {
		return this.state === state;
	}
	
	/**
	 * Check if game is in playing state
	 * @returns {boolean}
	 */
	isPlaying() {
		return this.state === GAME_STATES.PLAYING;
	}
	
	/**
	 * Check if game is in paused state
	 * @returns {boolean}
	 */
	isPaused() {
		return this.state === GAME_STATES.PAUSED;
	}
	
	/**
	 * Check if game is showing a modal overlay
	 * @returns {boolean}
	 */
	isModal() {
		return [
			GAME_STATES.FLOOR_COMPLETE,
			GAME_STATES.RUN_VICTORY,
			GAME_STATES.RUN_DEFEAT
		].includes(this.state);
	}
	
	/**
	 * Check if game is active (playing or paused)
	 * @returns {boolean}
	 */
	isActive() {
		return [
			GAME_STATES.PLAYING,
			GAME_STATES.PAUSED,
			GAME_STATES.FLOOR_COMPLETE
		].includes(this.state);
	}
	
	/**
	 * Register a callback for state changes
	 * @param {Function} callback - Callback receiving {prev, next} state object
	 * @returns {Function} Unsubscribe function
	 */
	onStateChange(callback) {
		this.listeners.add(callback);
		return () => this.listeners.delete(callback);
	}
	
	/**
	 * Emit state change to all listeners
	 * @param {Object} detail - State change detail {prev, next}
	 */
	emit(detail) {
		this.listeners.forEach(cb => {
			try {
				cb(detail);
			} catch (err) {
				console.error('GameStateManager: Listener error:', err);
			}
		});
	}
	
	/**
	 * Reset to idle state
	 */
	reset() {
		this.setState(GAME_STATES.IDLE);
	}
	
	/**
	 * Cleanup and remove all listeners
	 */
	destroy() {
		this.listeners.clear();
		this.container = null;
	}
}

export default GameStateManager;
