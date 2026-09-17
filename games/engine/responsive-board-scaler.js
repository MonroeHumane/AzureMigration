/*
 * Responsive Board Scaler - Game-Like Experience
 * Handles desktop zoom, fullscreen, viewport resizing, and maintains perfect aspect ratio
 * Provides smooth scaling without distortion or overflow
 */

export class ResponsiveBoardScaler {
	constructor(options = {}) {
		this.boardEl = options.boardEl;
		this.boardWrapEl = options.boardWrapEl;
		this.boardSize = options.boardSize || 19;
		this.onMetricsChange = options.onMetricsChange || (() => {});
		
		// Scaling constraints
		this.minCellSize = options.minCellSize || 16;
		this.maxCellSize = options.maxCellSize || 56;
		this.padding = options.padding || 48;
		this.gap = options.gap || 0;
		this.fullscreenPadding = options.fullscreenPadding || 40;
		
		// State tracking
		this.currentMetrics = null;
		this.lastViewportSize = null;
		this.resizeTimeout = null;
		this.observers = [];
		this._pendingRAF = null;
		this._hasApplied = false;
		
		// Store bound handler references for cleanup
		this._boundHandlers = {
			resize: () => this.handleResize(),
			orientationchange: () => this.handleResize(),
			fullscreenchange: () => this.handleResize()
		};
		
		// Performance: Track device pixel ratio for crisp rendering
		this.devicePixelRatio = window.devicePixelRatio || 1;
		
		this.init();
	}

	init() {
		if (!this.boardEl || !this.boardWrapEl) {
			console.warn('ResponsiveBoardScaler: Missing boardEl or boardWrapEl');
			return;
		}

		// Calculate initial metrics
		this.calculateMetrics();
		
		// Listen for window resize with debounce using stored references
		window.addEventListener('resize', this._boundHandlers.resize);
		window.addEventListener('orientationchange', this._boundHandlers.orientationchange);
		
		// Listen for fullscreen changes instead of ResizeObserver on document.documentElement
		document.addEventListener('fullscreenchange', this._boundHandlers.fullscreenchange);
		
		// Monitor board wrapper size changes only
		const resizeObserver = new ResizeObserver(() => this.handleResize());
		resizeObserver.observe(this.boardWrapEl);
		this.observers.push(resizeObserver);
	}

	/**
	 * Main calculation engine - determines optimal cell size
	 */
	calculateMetrics() {
		const isFullscreen = this.isFullscreenMode();
		const viewportSize = this.getViewportSize();
		const containerSize = this.getContainerSize();
		
		// Detect zoom level using devicePixelRatio
		const zoomLevel = this.detectZoomLevel();
		
		// containerSize now already accounts for CSS padding (it's the content-box)
		// so we don't need to subtract additional padding
		const availableWidth = containerSize.width;
		const availableHeight = containerSize.height;
		
		// Constrain to minimum 1px per cell
		if (availableWidth < this.boardSize || availableHeight < this.boardSize) {
			console.warn('Board container too small for given board size');
			return null;
		}
		
		// Calculate cell sizes based on width and height
		const cellByWidth = Math.floor(availableWidth / this.boardSize);
		const cellByHeight = Math.floor(availableHeight / this.boardSize);
		
		// Take minimum to maintain square aspect ratio
		let cellSize = Math.min(cellByWidth, cellByHeight);
		
		// Clamp to min/max bounds
		cellSize = Math.max(this.minCellSize, Math.min(this.maxCellSize, cellSize));
		
		// Calculate total board dimensions
		const totalSpacing = this.gap * (this.boardSize - 1);
		const gridWidth = cellSize * this.boardSize + totalSpacing;
		const gridHeight = cellSize * this.boardSize + totalSpacing;
		
		// Calculate frame dimensions (with padding/chrome)
		const frameWidth = gridWidth + this.padding;
		const frameHeight = gridHeight + this.padding;
		
		// Check if board fits within container
		const fits = gridWidth <= availableWidth && gridHeight <= availableHeight;
		
		// Calculate scaling factors for visual feedback
		const scaleFactorWidth = fits ? 1 : gridWidth / availableWidth;
		const scaleFactorHeight = fits ? 1 : gridHeight / availableHeight;
		
		const metrics = {
			boardSize: this.boardSize,
			cellSize,
			gap: this.gap,
			gridWidth,
			gridHeight,
			frameWidth,
			frameHeight,
			containerWidth: containerSize.width,
			containerHeight: containerSize.height,
			availableWidth,
			availableHeight,
			padding: this.padding,
			fits,
			isFullscreen,
			zoomLevel,
			scaleFactorWidth,
			scaleFactorHeight,
			timestamp: Date.now()
		};
		
		// Only update if metrics actually changed
		if (!this.metricsEqual(this.currentMetrics, metrics)) {
			this.currentMetrics = metrics;
			this.applyMetrics(metrics);
			this.onMetricsChange(metrics);
		}
		
		return metrics;
	}

	/**
	 * Gets device pixel ratio, useful for detecting zoom/scale level
	 * Note: devicePixelRatio reflects both browser zoom and display scaling
	 */
	detectZoomLevel() {
		return window.devicePixelRatio || 1;
	}

	/**
	 * Get actual viewport size
	 */
	getViewportSize() {
		return {
			width: window.innerWidth,
			height: window.innerHeight,
			inWidth: window.innerWidth,
			inHeight: window.innerHeight
		};
	}

	/**
	 * Get container size accounting for fullscreen and nested layouts
	 */
	getContainerSize() {
		// Always measure the element. The old fullscreen branch returned the raw
		// viewport, which overshot the parchment mat's play hole and pushed the
		// grid outside the frame. The app shell already gives the play area the
		// whole viewport, so measuring it is correct in both modes.
		const wrapRect = this.boardWrapEl.getBoundingClientRect();
		const styles = window.getComputedStyle(this.boardWrapEl);
		const paddingTop = parseFloat(styles.paddingTop) || 0;
		const paddingBottom = parseFloat(styles.paddingBottom) || 0;
		const paddingLeft = parseFloat(styles.paddingLeft) || 0;
		const paddingRight = parseFloat(styles.paddingRight) || 0;

		const contentWidth = Math.max(wrapRect.width - paddingLeft - paddingRight, 120);
		const contentHeight = Math.max(wrapRect.height - paddingTop - paddingBottom, 120);

		return {
			width: contentWidth,
			height: contentHeight
		};
	}

	/**
	 * Check if in fullscreen mode
	 */
	isFullscreenMode() {
		const widget = this.boardWrapEl?.closest('[data-adventure-widget]');
		return widget?.classList.contains('is-fullscreen') || 
		       document.fullscreenElement === widget ||
		       document.fullscreenElement === document.documentElement;
	}

	/**
	 * Apply calculated metrics to DOM using RAF for batching
	 */
	applyMetrics(metrics) {
		if (!this.boardEl) return;

		const write = () => {
			const root = this.boardEl.style;
			root.setProperty('--board-size', String(metrics.boardSize));
			root.setProperty('--cell-size', `${metrics.cellSize}px`);
			root.setProperty('--board-gap', `${metrics.gap}px`);

			// Set font-size for emoji scaling
			root.setProperty('--board-font-size', `${metrics.cellSize * 0.6}px`);
		};

		// Cancel any pending RAF to prevent stacking
		if (this._pendingRAF) {
			cancelAnimationFrame(this._pendingRAF);
			this._pendingRAF = null;
		}

		// The very first application must land before the first paint, otherwise
		// the board renders once at the CSS default cell size and overflows its
		// frame. Only later updates are worth batching into a frame.
		if (!this._hasApplied) {
			this._hasApplied = true;
			write();
			return;
		}

		this._pendingRAF = requestAnimationFrame(() => {
			write();
			this._pendingRAF = null;
		});
	}

	/**
	 * Compare two metrics objects
	 */
	metricsEqual(m1, m2) {
		if (!m1 || !m2) return false;
		return m1.cellSize === m2.cellSize &&
		       m1.gridWidth === m2.gridWidth &&
		       m1.gridHeight === m2.gridHeight &&
		       m1.isFullscreen === m2.isFullscreen;
	}

	/**
	 * Handle resize events with debounce
	 */
	handleResize() {
		if (this.resizeTimeout) {
			clearTimeout(this.resizeTimeout);
		}
		
		// Debounce: wait 100ms before recalculating
		// This prevents jank from rapid resize events
		this.resizeTimeout = setTimeout(() => {
			this.calculateMetrics();
		}, 100);
	}

	/**
	 * Force immediate recalculation (useful for transitions)
	 */
	forceRecalculate() {
		if (this.resizeTimeout) {
			clearTimeout(this.resizeTimeout);
		}
		this.calculateMetrics();
	}

	/**
	 * Update board size and recalculate metrics
	 */
	setBoardSize(newSize) {
		if (newSize !== this.boardSize) {
			this.boardSize = newSize;
			this.forceRecalculate();
		}
	}

	/**
	 * Get current metrics
	 */
	getMetrics() {
		return this.currentMetrics;
	}

	/**
	 * Cleanup observers and listeners
	 */
	destroy() {
		// Disconnect all ResizeObservers
		this.observers.forEach(observer => observer.disconnect());
		this.observers = [];
		
		// Remove window event listeners using stored references
		window.removeEventListener('resize', this._boundHandlers.resize);
		window.removeEventListener('orientationchange', this._boundHandlers.orientationchange);
		document.removeEventListener('fullscreenchange', this._boundHandlers.fullscreenchange);
		
		// Cancel any pending timeouts and RAF
		if (this.resizeTimeout) {
			clearTimeout(this.resizeTimeout);
			this.resizeTimeout = null;
		}
		
		if (this._pendingRAF) {
			cancelAnimationFrame(this._pendingRAF);
			this._pendingRAF = null;
		}
		
		// Clear all references
		this._boundHandlers = null;
		this.boardEl = null;
		this.boardWrapEl = null;
		this.currentMetrics = null;
		this.lastViewportSize = null;
	}
}

/**
 * Utility: Get optimal cell size for a given board size and container
 * Can be used standalone without creating a full scaler instance
 */
export function calculateOptimalCellSize(
	boardSize,
	containerWidth,
	containerHeight,
	options = {}
) {
	const {
		minCell = 16,
		maxCell = 56,
		padding = 48,
		gap = 0
	} = options;
	
	const availWidth = containerWidth - padding;
	const availHeight = containerHeight - padding;
	
	const cellByWidth = Math.floor(availWidth / boardSize);
	const cellByHeight = Math.floor(availHeight / boardSize);
	
	const cellSize = Math.min(cellByWidth, cellByHeight);
	return Math.max(minCell, Math.min(maxCell, cellSize));
}

/**
 * Utility: Detect if content is zoomed at browser/OS level
 * Returns zoom ratio (1.0 = 100%, 1.1 = 110%, etc)
 */
export function detectBrowserZoom() {
	// Method 1: Check device pixel ratio
	const pixelRatio = window.devicePixelRatio || 1;
	
	// Method 2: Create test element to measure actual vs CSS pixels
	const div = document.createElement('div');
	div.style.width = '1in';
	div.style.height = '1in';
	div.style.position = 'absolute';
	div.style.left = '-9999px';
	document.body.appendChild(div);
	
	const cssPixels = div.offsetWidth;
	const actualPixels = window.matchMedia(`(resolution: ${cssPixels}dpi)`).matches ? cssPixels : null;
	
	document.body.removeChild(div);
	
	// Return combined estimate
	return pixelRatio;
}

/**
 * Utility: Get safe rendering area accounting for system UI (notches, etc)
 */
export function getSafeViewportArea() {
	return {
		width: window.innerWidth,
		height: window.innerHeight,
		top: 0,
		left: 0,
		// On mobile with notches, consider viewport-fit
		safeAreaInset: {
			top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top')) || 0,
			right: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-right')) || 0,
			bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom')) || 0,
			left: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-left')) || 0
		}
	};
}

export default ResponsiveBoardScaler;
