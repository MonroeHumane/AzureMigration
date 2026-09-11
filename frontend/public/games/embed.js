(function () {
	if (!/(?:^|[?&])embed=1(?:&|$)/.test(window.location.search)) {
		return;
	}
	var root = document.documentElement;
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
