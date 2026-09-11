/**
 * Shared light/dark theme for Humane hub games (Match, Adoptedex, etc.).
 *
 * Storage: localStorage.humaneGamesTheme = 'light' | 'dark'
 * Classes: html.pm-theme-light | html.pm-theme-dark
 * Default: dark when html.humane-embed, else light (unless a preference is saved).
 *
 * Usage:
 *   <script src="../embed.js"></script>
 *   <script src="../theme.js"></script>   <!-- auto-applies on load -->
 *   HumaneGamesTheme.toggle();
 *   HumaneGamesTheme.bindToggle(buttonEl);
 */
(function (global) {
	'use strict';

	var KEY = 'humaneGamesTheme';
	var LEGACY_KEYS = ['petMatchTheme'];
	var LIGHT = 'light';
	var DARK = 'dark';

	function rootEl() {
		return global.document && global.document.documentElement;
	}

	function readStorage(key) {
		try {
			return global.localStorage.getItem(key);
		} catch (e) {
			return null;
		}
	}

	function writeStorage(key, value) {
		try {
			global.localStorage.setItem(key, value);
		} catch (e) { /* ignore quota / private mode */ }
	}

	function normalize(theme) {
		return theme === DARK ? DARK : LIGHT;
	}

	function getSaved() {
		var saved = readStorage(KEY);
		if (saved === LIGHT || saved === DARK) {
			return saved;
		}
		for (var i = 0; i < LEGACY_KEYS.length; i++) {
			var legacy = readStorage(LEGACY_KEYS[i]);
			if (legacy === LIGHT || legacy === DARK) {
				writeStorage(KEY, legacy);
				return legacy;
			}
		}
		return null;
	}

	function getDefault() {
		var root = rootEl();
		if (root && root.classList.contains('humane-embed')) {
			return DARK;
		}
		return LIGHT;
	}

	function get() {
		var root = rootEl();
		if (root) {
			if (root.classList.contains('pm-theme-light')) return LIGHT;
			if (root.classList.contains('pm-theme-dark')) return DARK;
			var data = root.getAttribute('data-pm-theme') || root.dataset && root.dataset.pmTheme;
			if (data === LIGHT || data === DARK) return data;
		}
		return getSaved() || getDefault();
	}

	function syncToggle(button, theme) {
		if (!button) return;
		var isDark = theme === DARK;
		button.textContent = isDark ? '☀️' : '🌙';
		button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
		button.setAttribute('title', isDark ? 'Switch to light theme' : 'Switch to dark theme');
		button.setAttribute('aria-label', 'Toggle light or dark theme');
	}

	function apply(theme, options) {
		var opts = options || {};
		var next = normalize(theme);
		var root = rootEl();
		if (root) {
			root.classList.remove('pm-theme-light', 'pm-theme-dark');
			root.classList.add('pm-theme-' + next);
			root.setAttribute('data-pm-theme', next);
			if (root.dataset) root.dataset.pmTheme = next;
		}
		if (opts.persist !== false) {
			writeStorage(KEY, next);
		}
		var btn = opts.button || (api._boundButton || null);
		syncToggle(btn, next);
		try {
			global.dispatchEvent(new CustomEvent('humane-games-theme', { detail: { theme: next } }));
		} catch (e) { /* older browsers */ }
		return next;
	}

	function init(options) {
		var opts = options || {};
		var theme = getSaved() || getDefault();
		return apply(theme, { persist: false, button: opts.button });
	}

	function toggle(options) {
		var opts = options || {};
		var next = get() === DARK ? LIGHT : DARK;
		return apply(next, { persist: true, button: opts.button });
	}

	function bindToggle(button) {
		if (!button) return null;
		api._boundButton = button;
		syncToggle(button, get());
		if (button.dataset && button.dataset.hgThemeBound === '1') {
			return button;
		}
		if (button.dataset) button.dataset.hgThemeBound = '1';
		button.addEventListener('click', function () {
			toggle({ button: button });
		});
		return button;
	}

	var api = {
		KEY: KEY,
		LIGHT: LIGHT,
		DARK: DARK,
		getSaved: getSaved,
		getDefault: getDefault,
		get: get,
		apply: apply,
		init: init,
		toggle: toggle,
		bindToggle: bindToggle,
		initThemeToggle: bindToggle,
		syncToggle: syncToggle,
		_boundButton: null
	};

	global.HumaneGamesTheme = api;

	// First-paint: apply as soon as this script runs (after embed.js when present).
	try {
		init({ persist: false });
	} catch (e) { /* ignore */ }
})(typeof window !== 'undefined' ? window : this);
