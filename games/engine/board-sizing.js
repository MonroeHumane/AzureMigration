/*
 * Board sizing helpers shared between the Pet Snake UI layer and any
 * future renderers. These utilities accept plain measurement inputs so
 * they remain platform-agnostic (no DOM dependencies).
 * 
 * Phase 5: Simplified for desktop-only (minimum 1280×720)
 */

export const BOARD_CELL_BASE = {
	cozy: { base: 36, min: 22, max: 46 },
	roomy: { base: 32, min: 22, max: 42 },
	grand: { base: 28, min: 20, max: 38 }
};

export const BASE_BOARD_GAP = 4;

const FALLBACK_CELL_CONFIG = { base: 24, min: 18, max: 28 };

const resolveCellConfig = (boardKey, overrides = {}) => {
	if (boardKey && overrides[boardKey]) {
		return overrides[boardKey];
	}
	return { ...FALLBACK_CELL_CONFIG };
};

/**
 * Compute board metrics for desktop layout
 * @param {Object} options - Configuration options
 * @param {string} options.boardKey - Board key (cozy, roomy, grand)
 * @param {number} options.boardSize - Grid size
 * @param {number} options.scale - Scale factor (default: 1)
 * @param {number} options.innerWidth - Container width
 * @param {number} options.innerHeight - Container height
 * @param {number} options.chromeX - Horizontal chrome/padding
 * @param {number} options.chromeY - Vertical chrome/padding
 * @param {number} options.baseGap - Base gap between cells
 * @param {Object} options.boardCellBase - Cell size configurations
 * @param {Object} options.cellConfigOverride - Override cell config
 * @returns {Object|null} Computed metrics
 */
export const computeBoardMetrics = ({
	boardKey,
	boardSize,
	scale = 1,
	innerWidth = 0,
	innerHeight = 0,
	chromeX = 0,
	chromeY = 0,
	baseGap = BASE_BOARD_GAP,
	boardCellBase = BOARD_CELL_BASE,
	cellConfigOverride
} = {}) => {
	if (!Number.isFinite(boardSize) || boardSize <= 0) {
		return null;
	}
	
	const cellConfig = cellConfigOverride || resolveCellConfig(boardKey, boardCellBase);
	const safeScale = Math.max(0.5, Number(scale) || 1);
	
	// Desktop-only: use config min/max directly
	const minCell = cellConfig.min;
	const maxCell = cellConfig.max;
	
	const gap = Math.max(1, Math.round(baseGap / Math.max(safeScale, 0.9)));
	const spacing = gap * (boardSize - 1);
	const usableWidth = Math.max(0, innerWidth - chromeX - spacing);
	const usableHeight = Math.max(0, innerHeight - chromeY - spacing);
	const maxByWidth = innerWidth ? Math.floor(usableWidth / boardSize) : maxCell;
	const maxByHeight = innerHeight ? Math.floor(usableHeight / boardSize) : maxCell;
	const raw = Math.min(maxByWidth, maxByHeight);
	const baseCell = cellConfig.base || maxCell;
	const preferred = Math.min(raw || maxCell, baseCell, maxCell);
	const clamped = Math.max(minCell, preferred);
	const scaled = Math.max(minCell, Math.min(maxCell, Math.round(clamped * safeScale)));
	const gridWidth = scaled * boardSize + spacing;
	const gridHeight = scaled * boardSize + spacing;
	const measuredWidth = gridWidth + chromeX;
	const measuredHeight = gridHeight + chromeY;
	
	return {
		boardKey,
		boardSize,
		gap,
		minCell,
		maxCell,
		raw,
		scaled,
		gridWidth,
		gridHeight,
		measuredWidth,
		measuredHeight
	};
};
