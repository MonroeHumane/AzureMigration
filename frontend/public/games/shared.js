(function (global) {
	const AudioContextClass = global.AudioContext || global.webkitAudioContext;

	function createAudioSuite() {
		const audioCtx = AudioContextClass ? new AudioContextClass() : null;
		const masterGain = audioCtx ? audioCtx.createGain() : null;
		const sfxGain = audioCtx ? audioCtx.createGain() : null;
		const musicGain = audioCtx ? audioCtx.createGain() : null;

		if (audioCtx && masterGain && sfxGain && musicGain) {
			masterGain.gain.value = 0.8;
			sfxGain.gain.value = 0.8;
			musicGain.gain.value = 0;
			sfxGain.connect(masterGain);
			musicGain.connect(masterGain);
			masterGain.connect(audioCtx.destination);
		}

		let audioReady = false;
		const ensureAudio = () => {
			if (!audioCtx) return;
			if (!audioReady) {
				audioCtx.resume();
				audioReady = true;
			}
		};

		const beep = (freq = 440, dur = 0.1, type = "sine", vol = 0.2) => {
			if (!audioCtx) return;
			const now = audioCtx.currentTime;
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();
			osc.type = type;
			osc.frequency.setValueAtTime(freq, now);
			gain.gain.setValueAtTime(vol, now);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
			osc.connect(gain).connect(sfxGain || audioCtx.destination);
			osc.start(now);
			osc.stop(now + dur);
		};

		const sfx = {
			start: () => beep(520, 0.14, "triangle", 0.26),
			eat: () => {
				beep(660, 0.08, "sine", 0.22);
				beep(880, 0.08, "triangle", 0.16);
			},
			bonk: () => beep(140, 0.2, "sawtooth", 0.3),
			pause: () => beep(300, 0.08, "square", 0.18),
			resume: () => beep(420, 0.08, "square", 0.18)
		};

		const music = {
			pattern: [0, 3, 7, 5, 2, 7, 5, 3],
			tempo: 112,
			step: 0,
			timer: null,
			playing: false,
			start() {
				if (!audioCtx) return;
				ensureAudio();
				if (this.playing) return;
				this.playing = true;
				this.step = 0;
				this.fadeTo(0.24);
				this.schedule();
			},
			stop() {
				this.playing = false;
				if (this.timer) {
					clearTimeout(this.timer);
					this.timer = null;
				}
				this.fadeTo(0);
			},
			pause() {
				this.fadeTo(0.0001);
			},
			resume() {
				if (this.playing) {
					this.fadeTo(0.22);
				}
			},
			fadeTo(level) {
				if (!audioCtx || !musicGain) return;
				const now = audioCtx.currentTime;
				musicGain.gain.cancelScheduledValues(now);
				musicGain.gain.setTargetAtTime(level, now, 0.08);
			},
			schedule() {
				if (!this.playing || !audioCtx) return;
				const beat = 60 / this.tempo;
				const startAt = audioCtx.currentTime + 0.05;
				for (let i = 0; i < 4; i += 1) {
					const idx = (this.step + i) % this.pattern.length;
					const semi = this.pattern[idx];
					const time = startAt + i * beat;
					this.playNote(time, semi);
				}
				this.step = (this.step + 4) % this.pattern.length;
				this.timer = setTimeout(() => this.schedule(), beat * 4 * 1000 * 0.9);
			},
			playNote(time, semi) {
				if (!audioCtx) return;
				const freq = 196 * Math.pow(2, semi / 12);
				const osc = audioCtx.createOscillator();
				const gain = audioCtx.createGain();
				osc.type = "triangle";
				osc.frequency.setValueAtTime(freq, time);
				gain.gain.setValueAtTime(0.0001, time);
				gain.gain.exponentialRampToValueAtTime(0.18, time + 0.02);
				gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.38);
				osc.connect(gain).connect(musicGain || audioCtx.destination);
				osc.start(time);
				osc.stop(time + 0.6);
			}
		};

		return { ensureAudio, sfx, music };
	}

	const suite = createAudioSuite();

	global.HumaneAudio = {
		getSuite: () => suite
	};

	/* ========================================================================
	   HumaneGameSystem — desktop/mobile input contract for embedded games
	   ========================================================================
	   Markup contract:
	     [data-hg-desktop-controls]  shown on fine-pointer / desktop
	     [data-hg-mobile-controls]   shown on coarse-pointer / mobile
	     [data-hg-action="pause"]    optional; Escape / visibility helpers
	   CSS: humane-game-system.css (classes hg-desktop / hg-mobile / hg-coarse)
	   ======================================================================== */

	const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile/i;

	function isEmbed() {
		return (
			typeof document !== "undefined" &&
			(document.documentElement.classList.contains("humane-embed") ||
				/(?:^|[?&])embed=1(?:&|$)/.test(global.location.search))
		);
	}

	function isCoarsePointer() {
		try {
			return !!global.matchMedia && global.matchMedia("(pointer: coarse)").matches;
		} catch (_) {
			return false;
		}
	}

	function isFinePointer() {
		try {
			return !!global.matchMedia && global.matchMedia("(pointer: fine)").matches;
		} catch (_) {
			return true;
		}
	}

	function isNarrowViewport() {
		try {
			return !!global.matchMedia && global.matchMedia("(max-width: 720px)").matches;
		} catch (_) {
			return false;
		}
	}

	function isMobileLike() {
		const uaMobile = typeof navigator !== "undefined" && MOBILE_UA.test(navigator.userAgent || "");
		return isCoarsePointer() || isNarrowViewport() || uaMobile;
	}

	/**
	 * Apply html.hg-desktop | hg-mobile | hg-coarse for CSS control visibility.
	 * Call once on boot (and optionally on resize/orientationchange).
	 */
	function applyViewportClasses(root) {
		const el = root || (typeof document !== "undefined" ? document.documentElement : null);
		if (!el) return { desktop: false, mobile: false, coarse: false };

		const coarse = isCoarsePointer();
		const mobile = isMobileLike();
		const desktop = !mobile || (isFinePointer() && !coarse && !isNarrowViewport());

		el.classList.toggle("hg-coarse", coarse);
		el.classList.toggle("hg-mobile", mobile);
		el.classList.toggle("hg-desktop", desktop || (!mobile && !coarse));

		// If both flags would be false, prefer desktop chrome for keyboard games.
		if (!el.classList.contains("hg-mobile") && !el.classList.contains("hg-desktop")) {
			el.classList.add("hg-desktop");
		}

		return {
			desktop: el.classList.contains("hg-desktop"),
			mobile: el.classList.contains("hg-mobile"),
			coarse: el.classList.contains("hg-coarse")
		};
	}

	/**
	 * Wire elements marked with data-hg-action / data-hg-key.
	 * options.onAction(actionName, event) — game handles pause/resume/etc.
	 * Desktop: keydown from data-hg-key on [data-hg-desktop-controls] children.
	 * Mobile: pointer/click on [data-hg-mobile-controls] [data-hg-action].
	 */
	function bindControlSurfaces(options) {
		const opts = options || {};
		const onAction = typeof opts.onAction === "function" ? opts.onAction : function () {};
		const root = opts.root || document;
		const disposers = [];

		function fire(action, event) {
			if (!action) return;
			onAction(String(action), event);
		}

		const desktopRoot = root.querySelector("[data-hg-desktop-controls]");
		const mobileRoot = root.querySelector("[data-hg-mobile-controls]");

		function onKeyDown(event) {
			if (!desktopRoot && !opts.listenGlobalKeys) return;
			const key = event.key;
			const nodes = (desktopRoot || root).querySelectorAll("[data-hg-key]");
			for (let i = 0; i < nodes.length; i += 1) {
				const want = nodes[i].getAttribute("data-hg-key");
				if (!want) continue;
				const keys = want.split("|").map(function (k) {
					return k.trim();
				});
				if (keys.indexOf(key) !== -1) {
					const action =
						nodes[i].getAttribute("data-hg-action") ||
						nodes[i].getAttribute("data-action") ||
						want;
					fire(action, event);
					if (opts.preventDefault !== false) event.preventDefault();
					break;
				}
			}
			if (opts.escapePauses !== false && (key === "Escape" || key === "Esc")) {
				fire("pause", event);
			}
		}

		global.addEventListener("keydown", onKeyDown);
		disposers.push(function () {
			global.removeEventListener("keydown", onKeyDown);
		});

		function bindPointerActions(surface) {
			if (!surface) return;
			function onClick(event) {
				const target = event.target && event.target.closest
					? event.target.closest("[data-hg-action]")
					: null;
				if (!target || !surface.contains(target)) return;
				fire(target.getAttribute("data-hg-action"), event);
			}
			surface.addEventListener("click", onClick);
			disposers.push(function () {
				surface.removeEventListener("click", onClick);
			});
		}

		bindPointerActions(mobileRoot);
		bindPointerActions(desktopRoot);

		return function unbind() {
			while (disposers.length) {
				const d = disposers.pop();
				try {
					d();
				} catch (_) {}
			}
		};
	}

	/**
	 * Optional: pause when the tab/iframe hides (hub switch, phone lock, etc.).
	 * onPause() should pause gameplay; onResume is optional (do not auto-resume
	 * audio-heavy games without a user gesture).
	 */
	function pauseOnVisibilityChange(onPause, onResume) {
		if (typeof document === "undefined") return function () {};

		function handle() {
			if (document.hidden || document.visibilityState === "hidden") {
				if (typeof onPause === "function") onPause();
			} else if (typeof onResume === "function") {
				onResume();
			}
		}

		document.addEventListener("visibilitychange", handle);
		return function unbind() {
			document.removeEventListener("visibilitychange", handle);
		};
	}

	/** Boot helper: classes + optional control binding + visibility pause. */
	function boot(options) {
		const opts = options || {};
		const mode = applyViewportClasses(opts.rootHtml || document.documentElement);
		let unbindControls = null;
		let unbindVis = null;

		if (opts.onAction || opts.bindControls) {
			unbindControls = bindControlSurfaces(opts);
		}
		if (typeof opts.onVisibilityPause === "function") {
			unbindVis = pauseOnVisibilityChange(
				opts.onVisibilityPause,
				opts.onVisibilityResume
			);
		}

		if (opts.watchResize !== false) {
			const onResize = function () {
				applyViewportClasses(opts.rootHtml || document.documentElement);
			};
			global.addEventListener("resize", onResize);
			global.addEventListener("orientationchange", onResize);
			const prevUnbind = unbindControls;
			unbindControls = function () {
				global.removeEventListener("resize", onResize);
				global.removeEventListener("orientationchange", onResize);
				if (prevUnbind) prevUnbind();
			};
		}

		return {
			mode: mode,
			isEmbed: isEmbed(),
			dispose: function () {
				if (unbindControls) unbindControls();
				if (unbindVis) unbindVis();
			}
		};
	}

	global.HumaneGameSystem = {
		isEmbed: isEmbed,
		isCoarsePointer: isCoarsePointer,
		isFinePointer: isFinePointer,
		isMobileLike: isMobileLike,
		applyViewportClasses: applyViewportClasses,
		bindControlSurfaces: bindControlSurfaces,
		pauseOnVisibilityChange: pauseOnVisibilityChange,
		boot: boot
	};
})(window);
