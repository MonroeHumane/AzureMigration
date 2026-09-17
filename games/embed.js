(function () {
	var root = document.documentElement;

	// First-paint theme, before any stylesheet lands. theme.js re-applies the same
	// value later (and owns storage/events); this only kills the flash of the wrong
	// palette when the cabinet hands us ?theme=.
	try {
		var themeMatch = /(?:^|[?&])theme=(light|dark)(?:&|$)/.exec(window.location.search);
		if (themeMatch) {
			root.classList.remove('pm-theme-light', 'pm-theme-dark');
			root.classList.add('pm-theme-' + themeMatch[1]);
			root.setAttribute('data-pm-theme', themeMatch[1]);
		}
	} catch (e) {
		/* ignore */
	}

	if (!/(?:^|[?&])embed=1(?:&|$)/.test(window.location.search)) {
		return;
	}
	root.classList.add('humane-embed');

	// Hint layout engines that we are framed (safe areas still apply via CSS env()).
	root.classList.add('humane-embed-frame');

	// Optional: mark coarse/narrow early so first paint can hide desktop-only chrome.
	// Full HumaneGameSystem.applyViewportClasses may refine this after shared.js loads.
	try {
		var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
		var narrow = window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
		if (coarse || narrow) {
			root.classList.add('hg-mobile');
			if (coarse) root.classList.add('hg-coarse');
		} else {
			root.classList.add('hg-desktop');
		}
	} catch (e) {
		/* ignore */
	}
})();
