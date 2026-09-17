/**
 * PackView — the sealed booster pack with drag-to-tear opening.
 * DOM + CSS 3D (pointer tilt, peel-away foil flap). Accessible: the pack is
 * a button, tap/click/Enter all open it; the tear gesture is bonus juice.
 */
export class PackView {
	constructor(host, opts) {
		this.host = host;
		this.opts = opts || {};
		this.tier = this.opts.tier || 'standard';
		this.disabled = !!this.opts.disabled;
		this.opened = false;
		this.tearing = false;
		this.tearProgress = 0;
		this.dragging = false;
		this.reduced = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
		this.render();
	}

	render() {
		const wrap = document.createElement('div');
		wrap.className = 'pack-wrapper-3d pack-tier-' + this.tier;
		wrap.innerHTML = `
			<div class="pack-body" role="button" tabindex="0" aria-label="Open ${this.tier} booster pack — drag across the top or press Enter">
				<div class="pack-flap" aria-hidden="true">
					<div class="pack-flap__inner">
						<span class="pack-flap__notch pack-flap__notch--l"></span>
						<span class="pack-flap__notch pack-flap__notch--r"></span>
						<span class="pack-flap__brand">MONROE</span>
					</div>
				</div>
				<div class="pack-perf" aria-hidden="true"><span class="pack-perf__line"></span><span class="pack-perf__scissors">✂</span></div>
				<div class="pack-face">
					<img class="pack-face__art" src="/assets/cards/pack-${this.tier}.png" alt="" draggable="false">
					<div class="pack-face__sheen" aria-hidden="true"></div>
				</div>
			</div>
			<div class="pack-shadow" aria-hidden="true"></div>`;
		this.host.appendChild(wrap);
		this.el = wrap;
		this.body = wrap.querySelector('.pack-body');
		this.flap = wrap.querySelector('.pack-flap');
		this.bind();
	}

	tierLabel() {
		return this.tier === 'deluxe' ? 'DELUXE' : (this.tier === 'duo' ? 'DUO' : 'STANDARD');
	}

	cardCount() {
		return this.tier === 'deluxe' ? 3 : (this.tier === 'duo' ? 2 : 1);
	}

	bind() {
		// Hover tilt + foil sheen
		this.body.addEventListener('pointermove', (e) => {
			if (this.reduced || this.opened) return;
			const r = this.body.getBoundingClientRect();
			const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
			const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
			this.body.style.setProperty('--tilt-x', ((0.5 - py) * 12).toFixed(2) + 'deg');
			this.body.style.setProperty('--tilt-y', ((px - 0.5) * 16).toFixed(2) + 'deg');
			this.body.style.setProperty('--pointer-x', (px * 100).toFixed(1) + '%');
			this.body.style.setProperty('--pointer-y', (py * 100).toFixed(1) + '%');
		});
		this.body.addEventListener('pointerleave', () => {
			this.body.style.setProperty('--tilt-x', '0deg');
			this.body.style.setProperty('--tilt-y', '0deg');
			if (!this.opened) this.setTear(0);
		});

		// Drag-to-tear: press near the top strip and drag sideways.
		this.body.addEventListener('pointerdown', (e) => {
			if (this.disabled || this.opened || this.tearing) return;
			const r = this.body.getBoundingClientRect();
			const nearTop = (e.clientY - r.top) / r.height < 0.38;
			this.dragging = true;
			this.dragStartX = e.clientX;
			this.dragFromTop = nearTop;
			this.body.setPointerCapture && this.body.setPointerCapture(e.pointerId);
		});
		this.body.addEventListener('pointermove', (e) => {
			if (!this.dragging || this.opened || this.tearing) return;
			const r = this.body.getBoundingClientRect();
			const dist = Math.abs(e.clientX - this.dragStartX);
			const need = r.width * (this.dragFromTop ? 0.55 : 0.85);
			this.setTear(Math.min(1, dist / need));
			if (this.tearProgress >= 1) {
				this.dragging = false;
				this.ripOpen();
			}
		});
		const endDrag = () => {
			if (!this.dragging) return;
			this.dragging = false;
			if (!this.opened) this.snapBack();
		};
		this.body.addEventListener('pointerup', endDrag);
		this.body.addEventListener('pointercancel', endDrag);

		// Tap / click / keyboard open
		this.body.addEventListener('click', () => {
			if (!this.opened && !this.tearing && this.tearProgress < 0.35) this.ripOpen();
		});
		this.body.addEventListener('keydown', (e) => {
			if ((e.key === ' ' || e.key === 'Enter') && !this.opened && !this.tearing) {
				e.preventDefault();
				this.ripOpen();
			}
		});
	}

	setTear(p) {
		this.tearProgress = p;
		const deg = this.reduced ? 0 : p * -118;
		this.flap.style.transform = `rotateX(${deg}deg) translateY(${p * -8}px)`;
		this.flap.style.opacity = String(1 - p * 0.55);
		this.body.classList.toggle('is-tearing', p > 0.02);
	}

	snapBack() {
		this.flap.style.transition = 'transform .3s cubic-bezier(.2,.9,.3,1.3), opacity .3s';
		this.setTear(0);
		setTimeout(() => { this.flap.style.transition = ''; }, 320);
	}

	setTearing(on) {
		this.tearing = !!on;
		this.body.classList.toggle('is-tearing', !!on);
		if (!on && !this.opened) this.setTear(0);
	}

	ripOpen() {
		if (this.opened || this.tearing || this.disabled) return;
		this.tearing = true;
		this.setTear(1);
		this.spawnScraps();
		this.body.classList.add('is-pack-punch');
		setTimeout(() => {
			this.opened = true;
			this.el.classList.add('is-opened');
			if (typeof this.opts.onOpen === 'function') this.opts.onOpen();
		}, this.reduced ? 0 : 240);
	}

	/** Foil scraps fly off the perforation line on rip. */
	spawnScraps() {
		if (this.reduced) return;
		const r = this.body.getBoundingClientRect();
		const tierColors = {
			standard: ['#4caf7d', '#2b7a52'],
			duo: ['#5f8fd4', '#3a5f9f'],
			deluxe: ['#a06cd4', '#6a45a0'],
		};
		const [a, b] = tierColors[this.tier] || tierColors.standard;
		for (let i = 0; i < 7; i++) {
			const s = document.createElement('span');
			s.className = 'tear-scrap';
			const sz = 8 + Math.random() * 14;
			s.style.cssText = `left:${r.left + Math.random() * r.width}px;top:${r.top + r.height * 0.17}px;width:${sz}px;height:${sz * 0.7}px;` +
				`--scrap-a:${a};--scrap-b:${b};--sc-x:${(Math.random() - 0.5) * 60}vw;--sc-y:${18 + Math.random() * 40}vh;--sc-r:${(Math.random() - 0.5) * 540}deg;`;
			document.body.appendChild(s);
			setTimeout(() => s.remove(), 1000);
		}
	}

	destroy() {
		if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
	}
}
