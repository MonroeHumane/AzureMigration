/**
 * 🐾 MonroeCard — ONE shared card renderer for the whole Adoptédex.
 * Album binder cells, inspector faces, pack reveals, meet-the-pet overlays
 * and the rebuilt booster all render through this. DOM-based (real links,
 * real alt text, accessible) with a pointer-driven foil sheen layer.
 *
 * Plain-script module: exposes window.MonroeCard. Requires card-model.js
 * for attribute computation (falls back gracefully if absent).
 */
(function (global) {
	'use strict';

	// ── Inline SVG icon set (replaces emoji iconography) ──────────────────
	var SVG_OPEN = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">';
	var ICONS = {
		paw: SVG_OPEN + '<path d="M12 13.2c-2.9 0-5.6 2.3-5.6 4.9 0 1.5 1.1 2.5 2.7 2.5 1 0 1.9-.5 2.9-.5s1.9.5 2.9.5c1.6 0 2.7-1 2.7-2.5 0-2.6-2.7-4.9-5.6-4.9zM6.4 8.2c-1.2-.4-2.6.7-3 2.2-.4 1.6.2 3 1.4 3.4 1.2.4 2.6-.7 3-2.3.4-1.5-.2-2.9-1.4-3.3zm11.2 0c-1.2.4-1.8 1.8-1.4 3.3.4 1.6 1.8 2.7 3 2.3 1.2-.4 1.8-1.8 1.4-3.4-.4-1.5-1.8-2.6-3-2.2zM9.6 3.5c-1.4.2-2.3 1.9-2.1 3.7.2 1.8 1.4 3.1 2.8 2.9 1.4-.2 2.3-1.9 2.1-3.7-.2-1.8-1.4-3-2.8-2.9zm4.8 0c-1.4-.1-2.6 1.1-2.8 2.9-.2 1.8.7 3.5 2.1 3.7 1.4.2 2.6-1.1 2.8-2.9.2-1.8-.7-3.5-2.1-3.7z"/></svg>',
		cat: SVG_OPEN + '<path d="M5 9.5V4l3.8 2.2A9 9 0 0 1 12 5.5c1.1 0 2.2.2 3.2.7L19 4v5.5c0 4.6-3.1 8-7 8s-7-3.4-7-8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="9.4" cy="10.4" r=".9"/><circle cx="14.6" cy="10.4" r=".9"/></svg>',
		dog: SVG_OPEN + '<path d="M7.2 4.2C5.6 4.2 4.3 5.8 4.3 8c0 1.5.7 2.8 1.8 3.4.7 3.6 3.1 6 5.9 6s5.2-2.4 5.9-6c1.1-.6 1.8-1.9 1.8-3.4 0-2.2-1.3-3.8-2.9-3.8-.9 0-1.7.4-2.3 1.1a7.5 7.5 0 0 0-2.5-.5 7.5 7.5 0 0 0-2.5.5c-.6-.7-1.4-1.1-2.3-1.1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="9.6" cy="11" r=".9"/><circle cx="14.4" cy="11" r=".9"/></svg>',
		bolt: SVG_OPEN + '<path d="M13.2 2 5 13.4h4.4L10.4 22l8.2-11.4h-4.4L13.2 2z"/></svg>',
		heart: SVG_OPEN + '<path d="M12 21s-7.5-4.7-9.9-9C.5 8.9 1.7 5.4 4.6 4.2 6.6 3.4 9 4.1 12 6.5c3-2.4 5.4-3.1 7.4-2.3 2.9 1.2 4.1 4.7 2.5 7.8-2.4 4.3-9.9 9-9.9 9z"/></svg>',
		star: SVG_OPEN + '<path d="m12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9 5.9 20.4l1.5-6.8L2.2 9l6.9-.7L12 2z"/></svg>',
		sparkle: SVG_OPEN + '<path d="M12 2c.6 4.8 2.7 7 7.5 7.6C14.7 10.2 12.6 12.4 12 17.2 11.4 12.4 9.3 10.2 4.5 9.6 9.3 9 11.4 6.8 12 2zm7 12c.3 2.4 1.4 3.5 3.8 3.8-2.4.3-3.5 1.4-3.8 3.8-.3-2.4-1.4-3.5-3.8-3.8 2.4-.3 3.5-1.4 3.8-3.8zM5 14c.3 2 1.1 2.9 3.1 3.2-2 .3-2.8 1.2-3.1 3.2-.3-2-1.1-2.9-3.1-3.2 2-.3 2.8-1.2 3.1-3.2z"/></svg>',
		shield: SVG_OPEN + '<path d="M12 2 4.5 5v6c0 5 3.2 8.6 7.5 10.8C16.3 19.6 19.5 16 19.5 11V5L12 2zm0 3.1 5 2v4c0 3.6-2.2 6.3-5 7.9-2.8-1.6-5-4.3-5-7.9v-4l5-2z"/></svg>',
		crown: SVG_OPEN + '<path d="m3 7 3.5 3L12 4l5.5 6L21 7l-1.5 11h-15L3 7zm1.8 12.8h14.4v1.7H4.8v-1.7z"/></svg>',
		coin: SVG_OPEN + '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5.2"/><path d="M12 6.8v10.4" stroke="#fff" stroke-width="1.4"/></svg>',
		pack: SVG_OPEN + '<path d="M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1.5 2v2.2l2-1 2 1V5h3v14h-8v-5.5l-2 1-2-1V5h3z" opacity=".9"/><path d="M12 13.5c-1.6 0-3 1.3-3 2.7 0 .8.6 1.4 1.5 1.4.5 0 1-.3 1.5-.3s1 .3 1.5.3c.9 0 1.5-.6 1.5-1.4 0-1.4-1.4-2.7-3-2.7z"/></svg>',
		home: SVG_OPEN + '<path d="M12 3 2.5 11h2.7v9h5.2v-5.8h3.2V20h5.2v-9h2.7L12 3z"/></svg>',
		calendar: SVG_OPEN + '<path d="M7 2v2H4.5A1.5 1.5 0 0 0 3 5.5v14A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-14A1.5 1.5 0 0 0 19.5 4H17V2h-2.2v2H9.2V2H7zm13 6.5v10h-16v-10h16zM6 11v2.4h2.4V11H6zm4.8 0v2.4h2.4V11h-2.4zm4.8 0v2.4H18V11h-2.4z"/></svg>',
		flip: SVG_OPEN + '<path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>',
		gift: SVG_OPEN + '<path d="M12 4.5A2.7 2.7 0 0 0 9.3 2 2.7 2.7 0 0 0 6.6 4.7c0 .3 0 .6.1.8H4v4.3h16V5.5h-2.7c.1-.2.1-.5.1-.8A2.7 2.7 0 0 0 14.7 2 2.7 2.7 0 0 0 12 4.5zM9.3 4a.9.9 0 0 1 .9.9V5H9.1a.9.9 0 0 1 .2-1zm5.4 0a.9.9 0 0 1 0 1H13.8v-.1a.9.9 0 0 1 .9-.9zM5.5 11.5h5.4V21H5.5v-9.5zm7.6 0h5.4V21h-5.4v-9.5z"/></svg>',
		flame: SVG_OPEN + '<path d="M12.9 2c.4 3.6-1.5 5.7-3.3 7.7-1.4 1.6-2.6 3.3-2.6 5.6A5.9 5.9 0 0 0 13 21.2c3.2-.4 5.5-2.9 5.5-6.1 0-2.2-1-4.2-2.4-5.9-.5 1-1.2 1.9-2.3 2.4.3-3-.4-7-2.9-9.6z"/></svg>',
	};

	function icon(name, cls) {
		return '<span class="mhc-ico ' + (cls || '') + '" aria-hidden="true">' + (ICONS[name] || ICONS.paw) + '</span>';
	}

	function escapeHtml(value) {
		return String(value == null ? '' : value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function formatGender(gender) {
		var g = String(gender || '').trim().toLowerCase();
		if (!g || g === 'unknown') return '';
		if (g === 'male' || g === 'm') return '♂ Male';
		if (g === 'female' || g === 'f') return '♀ Female';
		return String(gender);
	}

	/** Normalize any pet-ish record into the canonical card object. */
	function toCard(pet, index) {
		if (global.MonroeCardModel && typeof global.MonroeCardModel.computeCardAttributes === 'function') {
			return global.MonroeCardModel.computeCardAttributes(pet, index);
		}
		// Minimal fallback (model not loaded)
		return {
			id: String(pet.id || ''), dexNumber: '', name: pet.name || 'Companion',
			species: (String(pet.type || '').toLowerCase().indexOf('dog') >= 0) ? 'dog' : 'cat',
			breed: pet.breed || '', ageDisplay: pet.age || '', gender: pet.gender || '',
			location: pet.location || '', photoUrl: pet.image_url || pet.file || '',
			rarity: pet.rarity || 'common', rarityLabel: pet.rarity || 'Rescue Pet',
			foil: pet.foil || 'none', signatureMove: { icon: 'paw', name: '', effect: '' },
			stats: pet.stats || { energy: 0, cuddle: 0, loyalty: 0 },
			isAdopted: !!pet.archived, adoptionUrl: pet.url || '', description: pet.description || '',
			intakeDate: '', shelterStamp: 'HSMC ID #' + pet.id,
		};
	}

	/**
	 * Unified card face markup (front). Same markup everywhere:
	 * binder cells, inspector, reveal overlays, booster cards.
	 *
	 * opts: { inspector, nameTag ('h2'|'span'), dexNumber, compact }
	 */
	function buildFaceHtml(card, opts) {
		opts = opts || {};
		var foil = card.foil || 'none';
		var genderLabel = formatGender(card.gender);
		var statusLabel = card.isAdopted ? 'Adopted' : 'Available';
		var statusMod = card.isAdopted ? 'is-adopted' : 'is-available';
		var nameTag = opts.nameTag || (opts.inspector ? 'h2' : 'span');

		var chips = '';
		if (card.ageDisplay) chips += '<span class="mhc-card__chip">' + escapeHtml(card.ageDisplay) + '</span>';
		if (genderLabel) chips += '<span class="mhc-card__chip">' + escapeHtml(genderLabel) + '</span>';
		chips += '<span class="mhc-card__chip">' + escapeHtml(card.speciesLabel || card.species) + '</span>';
		chips += '<span class="mhc-card__chip mhc-card__chip--status ' + statusMod + '">' + statusLabel + '</span>';

		var moveInner = opts.inspector && card.signatureMove.effect
			? '<div><strong>' + icon(card.signatureMove.icon, 'mhc-ico--move') + escapeHtml(card.signatureMove.name) + '</strong>' +
				'<p class="mhc-card__move-effect">' + escapeHtml(card.signatureMove.effect) + '</p></div>'
			: '<span>' + icon(card.signatureMove.icon, 'mhc-ico--move') + escapeHtml(card.signatureMove.name) + '</span>';

		return '<div class="mhc-card foil-' + foil + (card.isAdopted ? ' mhc-card--adopted' : '') +
				(opts.inspector ? ' mhc-card--inspector' : '') + '" data-rarity="' + escapeHtml(card.rarity) + '">' +
			'<div class="mhc-card__foil" aria-hidden="true"></div>' +
			(foil !== 'none' ? '<canvas class="mhc-card__foil-fx" aria-hidden="true"></canvas>' : '') +
			'<img class="mhc-card__frame" src="/assets/cards/frame-' + escapeHtml(card.rarity) + '.png" alt="" aria-hidden="true" onerror="this.style.display=\'none\'">' +
			'<div class="mhc-card__head">' +
				'<span class="mhc-card__dex">' + escapeHtml(card.dexNumber || '') + '</span>' +
				'<' + nameTag + ' class="mhc-card__name">' + escapeHtml(card.name) + '</' + nameTag + '>' +
				icon(card.species === 'dog' ? 'dog' : (card.species === 'cat' ? 'cat' : 'paw'), 'mhc-card__species mhc-ico--' + card.species) +
			'</div>' +
			'<div class="mhc-card__photo">' +
				'<img class="mhc-card__img" src="' + escapeHtml(card.photoUrl) + '" alt="' + escapeHtml(card.name) + '"' + (opts.inspector ? '' : ' loading="lazy"') + ' onerror="window.MonroeAdoptedex&&MonroeAdoptedex.onImgError(this)">' +
				(card.isAdopted ? '<span class="mhc-card__adopted">' + icon('home') + 'Adopted</span>' : '') +
				'<span class="mhc-card__rarity">' + escapeHtml(card.rarityLabel) + '</span>' +
			'</div>' +
			'<div class="mhc-card__body">' +
				'<div class="mhc-card__chips">' + chips + '</div>' +
				'<span class="mhc-card__breed">' + escapeHtml(card.breed) + '</span>' +
				'<div class="mhc-card__move">' + moveInner + '</div>' +
				'<div class="mhc-card__stats">' +
					'<span class="mhc-card__stat" title="Energy">' + icon('bolt') + '<b>' + card.stats.energy + '</b><i>Energy</i></span>' +
					'<span class="mhc-card__stat" title="Cuddle">' + icon('heart') + '<b>' + card.stats.cuddle + '</b><i>Cuddle</i></span>' +
					'<span class="mhc-card__stat" title="Loyalty">' + icon('star') + '<b>' + card.stats.loyalty + '</b><i>Loyalty</i></span>' +
				'</div>' +
				(opts.inspector ? '<div class="mhc-card__stamp">' + escapeHtml(card.shelterStamp) + '</div>' : '') +
			'</div>' +
		'</div>';
	}

	/** Rich back face: rescue bio, traits, shelter stamp. */
	function buildBackHtml(card) {
		var traits = (card.personalityTraits || []).map(function (t) {
			return '<span class="mhc-card__trait">' + escapeHtml(t) + '</span>';
		}).join('');
		return '<div class="mhc-card mhc-card--back foil-' + (card.foil || 'none') + '" data-rarity="' + escapeHtml(card.rarity) + '">' +
			'<div class="mhc-card__foil" aria-hidden="true"></div>' +
			'<div class="mhc-card__back-head">' + icon('paw') + '<h3>' + escapeHtml(card.name) + '</h3>' +
				'<div class="mhc-card__back-sub">ID #' + escapeHtml(card.id) + ' · ' + escapeHtml(card.speciesLabel || '') + ' · ' + escapeHtml(card.gender || '') + '</div>' +
			'</div>' +
			'<div class="mhc-card__back-bio"><strong>Rescue Story</strong><p>' + escapeHtml(card.description || card.bio || '') + '</p></div>' +
			'<div class="mhc-card__back-traits">' +
				traits +
				'<span class="mhc-card__trait">' + icon('home') + escapeHtml(card.location || 'Shelter') + '</span>' +
				(card.favoriteItem ? '<span class="mhc-card__trait">' + icon('star') + 'Loves: ' + escapeHtml(card.favoriteItem) + '</span>' : '') +
				(card.intakeDate ? '<span class="mhc-card__trait">' + icon('calendar') + 'Intake: ' + escapeHtml(card.intakeDate) + '</span>' : '') +
			'</div>' +
			'<div class="mhc-card__back-foot"><span>Official Monroe Collector Card</span><span>' + icon('flip') + 'Tap to flip</span></div>' +
		'</div>';
	}

	/**
	 * Build a flippable card DOM element (button semantics, click toggles).
	 * opts: { startFlipped, onFlip, inspector, dexNumber }
	 */
	function build(pet, opts) {
		opts = opts || {};
		var card = toCard(pet, typeof opts.dexIndex === 'number' ? opts.dexIndex : undefined);
		if (opts.dexNumber) card.dexNumber = opts.dexNumber;

		var wrap = document.createElement('div');
		wrap.className = 'mhc-card-scene' + (opts.className ? ' ' + opts.className : '');

		var btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'mhc-card-flip' + (opts.startFlipped ? ' is-flipped' : '');
		btn.setAttribute('aria-label', 'Flip ' + card.name + ' card');

		var front = document.createElement('div');
		front.className = 'mhc-card-face mhc-card-face--front';
		front.innerHTML = buildFaceHtml(card, opts);
		var back = document.createElement('div');
		back.className = 'mhc-card-face mhc-card-face--back';
		back.innerHTML = buildBackHtml(card);

		btn.append(front, back);
		btn.addEventListener('click', function (e) {
			if (e.target && e.target.closest && e.target.closest('a')) return;
			btn.classList.toggle('is-flipped');
			if (typeof opts.onFlip === 'function') opts.onFlip(btn.classList.contains('is-flipped'));
		});

		wrap.appendChild(btn);
		wrap._card = card;
		if (card.foil && card.foil !== 'none') {
			bindFoilFx(wrap);
		}
		return wrap;
	}

	// ── Pointer tilt + foil sheen ─────────────────────────────────────────
	function reducedMotion() {
		try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
	}

	/**
	 * Attach pointer tilt to a host element containing .mhc-card faces.
	 * Sets --pointer-x/y (0–100%), --tilt-x/y (deg) consumed by card.css.
	 */
	function bindTilt(el, opts) {
		if (!el || el._mhcTiltBound) return;
		el._mhcTiltBound = true;
		var maxTilt = (opts && opts.maxTilt) || 14;
		var moving = false;

		function apply(clientX, clientY) {
			var rect = el.getBoundingClientRect();
			var px = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
			var py = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
			el.style.setProperty('--pointer-x', (px * 100).toFixed(1) + '%');
			el.style.setProperty('--pointer-y', (py * 100).toFixed(1) + '%');
			el.style.setProperty('--pointer-deg', (Math.atan2(py - 0.5, px - 0.5) * 180 / Math.PI + 180).toFixed(1) + 'deg');
			if (!reducedMotion()) {
				el.style.setProperty('--tilt-x', ((0.5 - py) * maxTilt * 0.75).toFixed(2) + 'deg');
				el.style.setProperty('--tilt-y', ((px - 0.5) * maxTilt).toFixed(2) + 'deg');
				el.classList.add('is-tilting');
			}
		}
		function reset() {
			el.style.setProperty('--pointer-x', '50%');
			el.style.setProperty('--pointer-y', '50%');
			el.style.setProperty('--tilt-x', '0deg');
			el.style.setProperty('--tilt-y', '0deg');
			el.classList.remove('is-tilting');
		}
		el.addEventListener('pointermove', function (e) { apply(e.clientX, e.clientY); });
		el.addEventListener('pointerdown', function (e) { apply(e.clientX, e.clientY); });
		el.addEventListener('pointerleave', reset);
		el.addEventListener('pointerup', function () { window.setTimeout(reset, 160); });
	}

	// ── Canvas specular foil (pointer-reactive, per foil colorway) ─────────
	var FOIL_PALETTES = {
		aurora: [[45, 212, 191], [125, 211, 252], [196, 181, 253], [255, 183, 213]],
		cosmos: [[99, 102, 241], [236, 72, 153], [251, 146, 60], [167, 139, 250]],
		gold:   [[255, 220, 120], [255, 179, 71], [255, 248, 210], [217, 119, 6]],
		prism:  [[244, 114, 182], [250, 204, 90], [52, 211, 153], [96, 165, 250], [167, 139, 250]],
	};

	/**
	 * Attach a canvas specular layer to a built card scene. Renders a soft
	 * multi-stop holographic wash that follows the pointer (plus a slow idle
	 * drift) — the sheen the CSS gradient layer approximates, but per-pixel.
	 * Cheap: only renders while the pointer is over the card or for a short
	 * ambient window after build.
	 */
	function bindFoilFx(scene) {
		var canvas = scene.querySelector('.mhc-card__foil-fx');
		if (!canvas || !canvas.getContext) return;
		var ctx = canvas.getContext('2d');
		var card = scene._card || {};
		var stops = FOIL_PALETTES[card.foil] || FOIL_PALETTES.aurora;
		var px = 0.5, py = 0.4, hover = false, raf = null, t0 = performance.now();
		var ambientUntil = t0 + (reducedMotion() ? 0 : 2400); // gentle sweep on reveal

		function size() {
			var r = canvas.getBoundingClientRect();
			var dpr = Math.min(2, window.devicePixelRatio || 1);
			canvas.width = Math.max(1, Math.round(r.width * dpr));
			canvas.height = Math.max(1, Math.round(r.height * dpr));
		}

		function draw(now) {
			var w = canvas.width, h = canvas.height;
			if (!w || !h) { size(); w = canvas.width; h = canvas.height; if (!w || !h) return; }
			ctx.clearRect(0, 0, w, h);
			var t = (now - t0) / 1000;
			var cx = px * w, cy = py * h;

			// specular hotspot following the pointer
			var g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
			stops.forEach(function (c, i) {
				var a = hover ? 0.34 - i * 0.06 : 0.2 - i * 0.04;
				g1.addColorStop(Math.min(1, i / (stops.length - 1)), 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, a) + ')');
			});
			g1.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.fillStyle = g1;
			ctx.fillRect(0, 0, w, h);

			// rotating rainbow band (idle drift + pointer angle)
			var ang = Math.atan2(py - 0.5, px - 0.5) + t * 0.35;
			var gx = Math.cos(ang), gy = Math.sin(ang);
			var g2 = ctx.createLinearGradient(w / 2 - gx * w * 0.8, h / 2 - gy * h * 0.8, w / 2 + gx * w * 0.8, h / 2 + gy * h * 0.8);
			stops.forEach(function (c, i) {
				g2.addColorStop(i / (stops.length - 1), 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.16)');
			});
			ctx.fillStyle = g2;
			ctx.fillRect(0, 0, w, h);

			// fine diffraction streaks for prism/cosmos
			if (card.foil === 'prism' || card.foil === 'cosmos') {
				ctx.globalAlpha = 0.1;
				for (var i = 0; i < 7; i++) {
					var off = ((t * 0.12 + i / 7) % 1) * (w + h);
					var sg = ctx.createLinearGradient(off - 60, 0, off, h);
					var c = stops[i % stops.length];
					sg.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
					sg.addColorStop(0.5, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.9)');
					sg.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
					ctx.fillStyle = sg;
					ctx.fillRect(0, 0, w, h);
				}
				ctx.globalAlpha = 1;
			}

			if (hover || now < ambientUntil) {
				raf = requestAnimationFrame(draw);
			} else {
				raf = null;
			}
		}

		function kick() { if (raf === null) raf = requestAnimationFrame(draw); }

		scene.addEventListener('pointermove', function (e) {
			var r = canvas.getBoundingClientRect();
			px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
			py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
			hover = true;
			kick();
		});
		scene.addEventListener('pointerleave', function () {
			hover = false;
			ambientUntil = performance.now() + 700; // brief fade-out sweep
		});
		if (window.ResizeObserver) {
			new ResizeObserver(function () { size(); kick(); }).observe(canvas);
		} else {
			size();
		}
		kick();
	}

	global.MonroeCard = {
		ICONS: ICONS,
		icon: icon,
		toCard: toCard,
		buildFaceHtml: buildFaceHtml,
		buildBackHtml: buildBackHtml,
		build: build,
		bindTilt: bindTilt,
		bindFoilFx: bindFoilFx,
		escapeHtml: escapeHtml,
	};
})(window);
