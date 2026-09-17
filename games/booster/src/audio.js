/**
 * Booster audio — small WebAudio synth (no asset files needed).
 * Honors the shared mute keys: monroe_booster_muted + monroeArcadeMuted.
 */
let ctx = null;
let muted = false;
try {
	muted = localStorage.getItem('monroe_booster_muted') === '1'
		|| localStorage.getItem('monroeArcadeMuted') === 'true'
		|| localStorage.getItem('monroeArcadeMuted') === '1';
} catch (e) {}

export function init() { /* lazily creates context on first sound */ }

export function isMuted() { return muted; }

export function setMuted(m) {
	muted = !!m;
	try {
		localStorage.setItem('monroe_booster_muted', m ? '1' : '0');
		localStorage.setItem('monroeArcadeMuted', String(m));
	} catch (e) {}
}

export function toggleMuted() { setMuted(!muted); return muted; }

function ac() {
	if (!ctx) {
		const AC = window.AudioContext || window.webkitAudioContext;
		if (AC) ctx = new AC();
	}
	if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
	return ctx;
}

function env(gain, t0, peak, dur) {
	gain.gain.setValueAtTime(0.0001, t0);
	gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
	gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

/** Foil rip — filtered noise burst that sweeps down. */
export function tear() {
	if (muted) return;
	const c = ac(); if (!c) return;
	const dur = 0.4;
	const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < data.length; i++) {
		const p = i / data.length;
		data[i] = (Math.random() * 2 - 1) * (0.5 + p * 0.5) * (1 - p * 0.55);
	}
	const src = c.createBufferSource(); src.buffer = buf;
	const filter = c.createBiquadFilter();
	filter.type = 'bandpass';
	filter.frequency.setValueAtTime(3200, c.currentTime);
	filter.frequency.exponentialRampToValueAtTime(700, c.currentTime + dur);
	const g = c.createGain(); env(g, c.currentTime, 0.28, dur);
	src.connect(filter); filter.connect(g); g.connect(c.destination);
	src.start();
}

/** Card reveal whoosh. */
export function whoosh() {
	if (muted) return;
	const c = ac(); if (!c) return;
	const o = c.createOscillator(); const g = c.createGain();
	o.type = 'sine';
	o.frequency.setValueAtTime(300, c.currentTime);
	o.frequency.exponentialRampToValueAtTime(720, c.currentTime + 0.16);
	env(g, c.currentTime, 0.12, 0.18);
	o.connect(g); g.connect(c.destination);
	o.start(); o.stop(c.currentTime + 0.2);
}

/** Coin ding. */
export function coin() {
	if (muted) return;
	const c = ac(); if (!c) return;
	[1318.5, 1760].forEach((f, i) => {
		const o = c.createOscillator(); const g = c.createGain();
		o.type = 'square';
		o.frequency.setValueAtTime(f, c.currentTime + i * 0.07);
		env(g, c.currentTime + i * 0.07, 0.06, 0.16);
		o.connect(g); g.connect(c.destination);
		o.start(c.currentTime + i * 0.07); o.stop(c.currentTime + i * 0.07 + 0.18);
	});
}

/** Rare/foil fanfare arpeggio. */
export function fanfare() {
	if (muted) return;
	const c = ac(); if (!c) return;
	[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
		const o = c.createOscillator(); const g = c.createGain();
		o.type = 'triangle';
		o.frequency.setValueAtTime(f, c.currentTime + i * 0.08);
		env(g, c.currentTime + i * 0.08, 0.1, 0.35);
		o.connect(g); g.connect(c.destination);
		o.start(c.currentTime + i * 0.08); o.stop(c.currentTime + i * 0.08 + 0.4);
	});
}
