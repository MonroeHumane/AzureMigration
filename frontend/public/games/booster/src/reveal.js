/**
 * RevealView — post-open card cascade + summary.
 * Cards render through the shared MonroeCard component (same card as the
 * binder/inspector). Fan layout, arrow-key/click navigation, tap flips.
 */
export class RevealView {
	constructor(host, opts) {
		this.host = host;
		this.opts = opts || {};
		this.cards = this.opts.cards || [];
		this.focus = 0;
		this.reduced = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
		this.render();
	}

	render() {
		const Cards = window.MonroeCard;
		const wrap = document.createElement('div');
		wrap.className = 'pack-reveal-stage';

		// Header line
		const head = document.createElement('div');
		head.className = 'pack-reveal-head pack-rarity-' + this.opts.packRarity;
		head.innerHTML = `
			<span class="pack-reveal-head__tier">${this.opts.packRarityLabel || 'Pack'} opened!</span>
			${this.opts.coinsAwarded ? `<span class="pack-reveal-head__coins">+${this.opts.coinsAwarded} coins</span>` : ''}`;
		wrap.appendChild(head);

		// Card fan
		const fan = document.createElement('div');
		fan.className = 'pack-reveal-fan' + (this.cards.length > 1 ? ' pack-reveal-fan--multi' : '');
		fan.setAttribute('role', 'listbox');
		fan.setAttribute('aria-label', 'Cards pulled — use arrow keys to browse, Enter to flip');

		const newIds = new Set((this.opts.newIds || []).map(String));
		this.cardEls = this.cards.map((pet, i) => {
			const cell = document.createElement('div');
			cell.className = 'pack-reveal-cell card-3d-wrapper';
			cell.setAttribute('role', 'option');
			cell.style.setProperty('--fan-i', String(i));
			cell.style.setProperty('--pop-delay', (i * 0.14) + 's');
			if (newIds.has(String(pet.id))) {
				const stamp = document.createElement('span');
				stamp.className = 'pack-reveal-new';
				stamp.textContent = 'NEW';
				cell.appendChild(stamp);
			}

			if (Cards && typeof Cards.build === 'function') {
				const scene = Cards.build(pet, {
					className: 'mhc-card-scene--pop',
					startFlipped: true, // face-down; flips open on the stagger
					onFlip: () => {},
				});
				scene.querySelector('.mhc-card-flip').classList.add('adoptedex-card');
				Cards.bindTilt(scene);
				// staggered auto-reveal: each card flips face-up in turn
				const flipBtn = scene.querySelector('.mhc-card-flip');
				setTimeout(() => flipBtn && flipBtn.classList.remove('is-flipped'), this.reduced ? 0 : 500 + i * 260);
				cell.appendChild(scene);
			} else {
				cell.innerHTML = `<div class="humane-card"><img src="${pet.file || ''}" alt="${pet.name || 'Pet'}"><b>${pet.name || 'Pet'}</b></div>`;
			}
			cell.addEventListener('click', () => this.setFocus(i));
			fan.appendChild(cell);
			return cell;
		});
		wrap.appendChild(fan);
		this.setFocus(0);

		// Actions
		const actions = document.createElement('div');
		actions.className = 'pack-reveal-actions';
		const openMore = document.createElement('button');
		openMore.type = 'button';
		openMore.className = 'booster-btn booster-btn--primary';
		openMore.textContent = this.opts.canOpenAnother ? 'Open another pack' : 'No packs left';
		openMore.disabled = !this.opts.canOpenAnother;
		openMore.addEventListener('click', () => this.opts.onOpenAnother && this.opts.onOpenAnother());

		const album = document.createElement('a');
		album.className = 'booster-btn booster-btn--ghost';
		const q = new URLSearchParams(window.location.search);
		album.href = `../dex/album.html?embed=${q.get('embed') === '1' ? '1' : '0'}&dex_user=${encodeURIComponent(q.get('dex_user') || '')}&dex_api=${encodeURIComponent(q.get('dex_api') || '')}`;
		album.textContent = 'View in album';

		const done = document.createElement('button');
		done.type = 'button';
		done.className = 'booster-btn';
		done.textContent = 'Done';
		done.addEventListener('click', () => this.opts.onDone && this.opts.onDone());

		actions.append(openMore, album, done);
		wrap.appendChild(actions);

		this.el = wrap;
		this.host.appendChild(wrap);
	}

	setFocus(i) {
		if (!this.cardEls || !this.cardEls.length) return;
		this.focus = Math.max(0, Math.min(this.cardEls.length - 1, i));
		this.cardEls.forEach((el, idx) => {
			el.classList.toggle('is-focused', idx === this.focus);
			el.setAttribute('aria-selected', idx === this.focus ? 'true' : 'false');
		});
	}

	prev() { this.setFocus(this.focus - 1); }
	next() { this.setFocus(this.focus + 1); }

	flipCurrent() {
		const cell = this.cardEls && this.cardEls[this.focus];
		if (!cell) return;
		const btn = cell.querySelector('.mhc-card-flip');
		if (btn) btn.classList.toggle('is-flipped');
	}

	dismiss() {
		if (this.opts.onDone) this.opts.onDone();
	}

	destroy() {
		if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
	}
}
