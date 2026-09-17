/*
 * Shared input plumbing for Pet Snake Adventure.
 *
 * Both the keyboard path and the swipe path funnel through createDirectionSink()
 * so buffering, debouncing and the "input accepted" head-cell pulse behave
 * identically no matter how the player turns.
 */

/** Maximum buffered inputs, so mashing can't queue a suicide turn three ticks out. */
export const INPUT_BUFFER_LIMIT = 3;
/** Minimum gap between two identical directions. */
export const INPUT_DEBOUNCE_MS = 50;

/**
 * Pulse the snake head to confirm a turn was accepted into the buffer.
 * Double-RAF so the class removal is painted before it is re-added.
 */
export const flashInputFeedback = () => {
	const headCell = document.querySelector('.cat-snake__cell.is-head');
	if (!headCell) return;
	headCell.classList.remove('input-buffered');
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			headCell.classList.add('input-buffered');
		});
	});
	setTimeout(() => {
		headCell.classList.remove('input-buffered');
	}, 200);
};

/**
 * Build the single funnel every input source pushes directions into.
 *
 * @param {object} engine - PetSnakeEngine instance
 * @param {object} [options]
 * @param {Function} [options.shouldAcceptDirection] - gate; return false to drop input
 * @returns {(dir: string) => boolean} true when the direction was queued
 */
export const createDirectionSink = (engine, { shouldAcceptDirection } = {}) => {
	let lastDirection = null;
	let lastInputTime = 0;

	return (dir) => {
		if (!dir || !engine || typeof engine.enqueueDirection !== 'function') return false;
		if (typeof shouldAcceptDirection === 'function' && !shouldAcceptDirection()) return false;

		const now = Date.now();
		if (dir === lastDirection && now - lastInputTime < INPUT_DEBOUNCE_MS) return false;
		if (engine.inputQueue && engine.inputQueue.length >= INPUT_BUFFER_LIMIT) return false;

		engine.enqueueDirection(dir);
		lastDirection = dir;
		lastInputTime = now;

		if (engine.inputQueue && engine.inputQueue.length > 0) {
			flashInputFeedback();
		}
		return true;
	};
};

/**
 * Swipe-to-turn on the play surface.
 *
 * There is no on-screen D-pad, so the gesture has to carry the whole mobile
 * control scheme. Two things make that workable:
 *   - the origin re-arms after every turn, so one continuous L-shaped drag
 *     queues two turns without lifting a finger;
 *   - a short tap with no travel toggles pause, mirroring Space.
 *
 * @param {HTMLElement} surfaceEl - element to listen on (the play area)
 * @param {object} engine - PetSnakeEngine instance
 * @param {object} [options]
 * @param {Function} [options.shouldAcceptDirection] - gate passed to the sink
 * @param {Function} [options.onTap] - called on a tap with no meaningful travel
 * @param {number} [options.threshold=24] - px of travel before a turn fires
 * @returns {Function} unbind
 */
export const bindSwipeControls = (surfaceEl, engine, options = {}) => {
	if (!surfaceEl || !engine || typeof engine.enqueueDirection !== 'function') return () => {};

	const { onTap, threshold = 24 } = options;
	const pushDirection = createDirectionSink(engine, options);

	const TAP_MAX_TRAVEL = 12;
	const TAP_MAX_MS = 320;

	let pointerId = null;
	let originX = 0;
	let originY = 0;
	let startedAt = 0;
	let travelled = 0;
	let turned = false;

	const reset = () => {
		pointerId = null;
		travelled = 0;
		turned = false;
	};

	const handleDown = (event) => {
		if (pointerId !== null) return;
		if (event.target.closest('.board-drawer, [data-hud-toggle], .board-mat-modal, .screen')) return;
		pointerId = event.pointerId;
		originX = event.clientX;
		originY = event.clientY;
		startedAt = Date.now();
		travelled = 0;
		turned = false;
		if (typeof surfaceEl.setPointerCapture === 'function') {
			try { surfaceEl.setPointerCapture(event.pointerId); } catch (_e) { /* capture is best-effort */ }
		}
	};

	const handleMove = (event) => {
		if (event.pointerId !== pointerId) return;

		const dx = event.clientX - originX;
		const dy = event.clientY - originY;
		const absX = Math.abs(dx);
		const absY = Math.abs(dy);
		travelled = Math.max(travelled, absX, absY);

		if (absX < threshold && absY < threshold) return;

		const dir = absX > absY ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
		if (pushDirection(dir)) turned = true;

		// Re-arm from the current point so a continuous drag can turn again.
		originX = event.clientX;
		originY = event.clientY;
	};

	const handleUp = (event) => {
		if (event.pointerId !== pointerId) return;
		if (typeof surfaceEl.releasePointerCapture === 'function') {
			try { surfaceEl.releasePointerCapture(event.pointerId); } catch (_e) { /* already released */ }
		}

		const isTouch = event.pointerType === 'touch' || event.pointerType === 'pen';
		const wasTap = !turned && travelled <= TAP_MAX_TRAVEL && Date.now() - startedAt <= TAP_MAX_MS;
		if (isTouch && wasTap && typeof onTap === 'function') {
			onTap(event);
		}
		reset();
	};

	const handleCancel = (event) => {
		if (event.pointerId !== pointerId) return;
		reset();
	};

	surfaceEl.addEventListener('pointerdown', handleDown);
	surfaceEl.addEventListener('pointermove', handleMove);
	surfaceEl.addEventListener('pointerup', handleUp);
	surfaceEl.addEventListener('pointercancel', handleCancel);

	return () => {
		surfaceEl.removeEventListener('pointerdown', handleDown);
		surfaceEl.removeEventListener('pointermove', handleMove);
		surfaceEl.removeEventListener('pointerup', handleUp);
		surfaceEl.removeEventListener('pointercancel', handleCancel);
	};
};

export default bindSwipeControls;
