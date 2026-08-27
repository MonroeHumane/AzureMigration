/*
 * Shared helpers for best-score persistence between Pet Snake surfaces.
 * These utilities stay DOM-free and accept a storage object that mimics
 * the Web Storage API (getItem/setItem). Consumers can pass window.localStorage
 * or their own implementation when running outside the browser.
 */

const DEFAULT_GLOBAL_KEY = "petSnakeBest";
const DEFAULT_LEGACY_KEYS = ["catSnakeBest"];

const getStorage = (storage) => {
	if (storage) return storage;
	if (typeof window !== "undefined" && window.localStorage) {
		return window.localStorage;
	}
	return null;
};

const toScore = (value) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

export const buildBestKey = ({ pet, difficulty, board, mode }) =>
	`petSnakeBest_${pet}_${difficulty}_${board}_${mode}`;

export const loadBestScore = ({
	storage,
	pet,
	difficulty,
	board,
	mode,
	globalKey = DEFAULT_GLOBAL_KEY,
	legacyKeys = DEFAULT_LEGACY_KEYS
} = {}) => {
	const store = getStorage(storage);
	if (!store) return 0;
	const key = buildBestKey({ pet, difficulty, board, mode });
	const configScore = store.getItem(key);
	if (configScore !== null) return toScore(configScore);
	const globalScore = store.getItem(globalKey);
	if (globalScore !== null) return toScore(globalScore);
	for (const legacyKey of legacyKeys) {
		const legacyScore = store.getItem(legacyKey);
		if (legacyScore !== null) return toScore(legacyScore);
	}
	return 0;
};

export const saveBestScore = ({
	storage,
	pet,
	difficulty,
	board,
	mode,
	score,
	globalKey = DEFAULT_GLOBAL_KEY
} = {}) => {
	const store = getStorage(storage);
	if (!store) return { updatedGlobal: false, globalScore: 0 };
	const safeScore = Math.max(0, Number(score) || 0);
	const key = buildBestKey({ pet, difficulty, board, mode });
	store.setItem(key, String(safeScore));
	const globalScore = toScore(store.getItem(globalKey));
	if (safeScore > globalScore) {
		store.setItem(globalKey, String(safeScore));
		return { updatedGlobal: true, globalScore: safeScore };
	}
	return { updatedGlobal: false, globalScore };
};
