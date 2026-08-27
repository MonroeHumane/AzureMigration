/*
 * Screen Router
 * Owns which top-level screen is visible: title / setup / run.
 *
 * Deliberately orthogonal to GameStateManager: that one owns run state
 * (idle|playing|paused|floor-complete|run-victory|run-defeat) and writes
 * data-game-state. This one writes data-screen and never inspects run state.
 */

export const SCREENS = Object.freeze({
	TITLE: 'title',
	SETUP: 'setup',
	RUN: 'run',
});

export class ScreenRouter {
	/**
	 * @param {HTMLElement} containerEl - element carrying the data-screen attribute
	 * @param {string} initial - starting screen
	 */
	constructor(containerEl, initial = SCREENS.TITLE) {
		this.container = containerEl;
		this.screen = Object.values(SCREENS).includes(initial) ? initial : SCREENS.TITLE;
		this.listeners = new Set();

		if (this.container) {
			this.container.dataset.screen = this.screen;
		}
	}

	getScreen() {
		return this.screen;
	}

	is(screen) {
		return this.screen === screen;
	}

	/**
	 * @param {string} nextScreen - value from SCREENS
	 */
	setScreen(nextScreen) {
		if (!Object.values(SCREENS).includes(nextScreen)) {
			throw new Error(`ScreenRouter: Invalid screen "${nextScreen}". Valid screens: ${Object.values(SCREENS).join(', ')}`);
		}

		const prev = this.screen;
		if (prev === nextScreen) return;

		this.screen = nextScreen;

		if (this.container) {
			this.container.dataset.screen = nextScreen;
		}

		this.emit({ prev, next: nextScreen });
	}

	/**
	 * @param {Function} callback - receives {prev, next}
	 * @returns {Function} unsubscribe
	 */
	onScreenChange(callback) {
		this.listeners.add(callback);
		return () => this.listeners.delete(callback);
	}

	emit(detail) {
		this.listeners.forEach((cb) => {
			try {
				cb(detail);
			} catch (err) {
				console.error('ScreenRouter: Listener error:', err);
			}
		});
	}

	destroy() {
		this.listeners.clear();
		this.container = null;
	}
}

export default ScreenRouter;
