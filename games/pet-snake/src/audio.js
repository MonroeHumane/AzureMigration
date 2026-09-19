// Pet Snake Adventure — Audio System & Music Controller
// Integrates with HumaneAudio, Web Audio SFX, and arcade cabinet mute synchronization.

const suite = typeof window !== 'undefined' && window.HumaneAudio?.getSuite
  ? window.HumaneAudio.getSuite()
  : null;

let isMuted = false;
let currentMusic = null;
let lastTrackName = 'default1.mp3';

// Procedural Web Audio context for fallback/supplementary SFX
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx && typeof window !== 'undefined') {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setMuted(muted) {
  isMuted = !!muted;
  if (isMuted) {
    if (currentMusic) currentMusic.pause();
    stopDeathMusic();
  } else {
    if (currentMusic) {
      currentMusic.muted = false;
      currentMusic.play().catch(() => {});
    } else if (lastTrackName) {
      playMusic(lastTrackName);
    }
  }
}

export function primeAudio() {
  getAudioCtx();
  if (suite?.ensureAudio) {
    suite.ensureAudio();
  }
}

// ── Sound Effects ───────────────────────────────────────────────────────────
export const sfx = {
  eat() {
    if (isMuted) return;
    if (suite?.sfx?.eat) {
      suite.sfx.eat();
      return;
    }
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  },

  bonk() {
    if (isMuted) return;
    if (suite?.sfx?.bonk) {
      suite.sfx.bonk();
      return;
    }
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  },

  powerup() {
    if (isMuted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [440, 554, 659, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.18, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.01, now + (i + 1) * 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + (i + 1) * 0.05);
    });
  },

  bomb() {
    if (isMuted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  },

  victory() {
    if (isMuted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.25, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.01, now + idx * 0.12 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.25);
    });
  }
};

// ── Music Tracks ────────────────────────────────────────────────────────────
export function playMusic(trackName = 'default1.mp3') {
  lastTrackName = trackName;
  if (currentMusic) {
    currentMusic.pause();
    currentMusic = null;
  }
  if (isMuted) return;

  try {
    currentMusic = new Audio(`../music/${trackName}`);
    currentMusic.loop = true;
    currentMusic.volume = 0.35;
    currentMusic.play().catch(() => {});
  } catch (err) {
    // Silently fall back if autoplay blocked
  }
}

export function stopMusic() {
  if (currentMusic) {
    currentMusic.pause();
    currentMusic = null;
  }
}

let deathNodes = [];

export function playDeathMusic() {
  stopMusic();
  stopDeathMusic();
  if (isMuted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.35, now);
  masterGain.connect(ctx.destination);
  deathNodes.push(masterGain);

  // Somber, atmospheric 8-bit game over arpeggio / sequence:
  // Descending minor progression: D4 (293.66), Bb3 (233.08), G3 (196.00), Eb3 (155.56), D3 (146.83)
  const leadNotes = [
    { freq: 293.66, start: 0.00, dur: 0.45 },
    { freq: 261.63, start: 0.45, dur: 0.45 },
    { freq: 233.08, start: 0.90, dur: 0.45 },
    { freq: 196.00, start: 1.35, dur: 0.60 },
    { freq: 174.61, start: 1.95, dur: 0.40 },
    { freq: 146.83, start: 2.35, dur: 1.20 }
  ];

  leadNotes.forEach(({ freq, start, dur }) => {
    const t0 = now + start;
    const t1 = t0 + dur;
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    if (dur > 0.5) {
      osc.frequency.setValueAtTime(freq, t0 + 0.2);
      osc.frequency.linearRampToValueAtTime(freq - 3, t1);
    }

    noteGain.gain.setValueAtTime(0.001, t0);
    noteGain.gain.linearRampToValueAtTime(0.28, t0 + 0.04);
    noteGain.gain.setValueAtTime(0.25, t1 - 0.08);
    noteGain.gain.exponentialRampToValueAtTime(0.001, t1);

    osc.connect(noteGain);
    noteGain.connect(masterGain);

    osc.start(t0);
    osc.stop(t1);
    deathNodes.push(osc, noteGain);
  });

  // Deep resonant bass pad undertone (D2 = 73.42Hz, slowly decaying)
  const bassOsc = ctx.createOscillator();
  const bassGain = ctx.createGain();
  const bassFilter = ctx.createBiquadFilter();

  bassOsc.type = 'sawtooth';
  bassOsc.frequency.setValueAtTime(73.42, now);
  bassOsc.frequency.exponentialRampToValueAtTime(36.71, now + 3.5);

  bassFilter.type = 'lowpass';
  bassFilter.frequency.setValueAtTime(220, now);
  bassFilter.frequency.linearRampToValueAtTime(80, now + 3.0);

  bassGain.gain.setValueAtTime(0.001, now);
  bassGain.gain.linearRampToValueAtTime(0.22, now + 0.08);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);

  bassOsc.connect(bassFilter);
  bassFilter.connect(bassGain);
  bassGain.connect(masterGain);

  bassOsc.start(now);
  bassOsc.stop(now + 3.5);
  deathNodes.push(bassOsc, bassGain, bassFilter);
}

export function stopDeathMusic() {
  deathNodes.forEach(node => {
    try {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    } catch (_) {}
  });
  deathNodes = [];
}
