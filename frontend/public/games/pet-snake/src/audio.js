// Pet Snake Adventure — Audio System & Music Controller
// Integrates with HumaneAudio, Web Audio SFX, and arcade cabinet mute synchronization.

const suite = typeof window !== 'undefined' && window.HumaneAudio?.getSuite
  ? window.HumaneAudio.getSuite()
  : null;

let isMuted = false;
let currentMusic = null;
let deathAudio = null;

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
  if (currentMusic) {
    currentMusic.muted = isMuted;
  }
  if (deathAudio) {
    deathAudio.muted = isMuted;
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
  if (currentMusic) {
    currentMusic.pause();
    currentMusic = null;
  }

  try {
    currentMusic = new Audio(`../music/${trackName}`);
    currentMusic.loop = true;
    currentMusic.volume = isMuted ? 0 : 0.35;
    currentMusic.muted = isMuted;
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

export function playDeathMusic() {
  stopMusic();
  try {
    deathAudio = new Audio('../music/death.mp3');
    deathAudio.volume = isMuted ? 0 : 0.45;
    deathAudio.muted = isMuted;
    deathAudio.play().catch(() => {});
  } catch (err) {}
}

export function stopDeathMusic() {
  if (deathAudio) {
    deathAudio.pause();
    deathAudio = null;
  }
}
