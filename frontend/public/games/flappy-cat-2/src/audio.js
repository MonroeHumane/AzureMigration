// Tiny WebAudio synth — same style as the rest of the arcade (no audio files).
let AC = null;
let muted = false;

function ctx() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* unsupported */ } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}

function beep(f0, f1, dur, type = 'sine', vol = 0.16) {
  if (muted) return;
  const ac = ctx(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, ac.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), ac.currentTime + dur);
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination);
  o.start(); o.stop(ac.currentTime + dur + 0.02);
}

function hiss(dur, freq, vol = 0.1, type = 'bandpass') {
  if (muted) return;
  const ac = ctx(); if (!ac) return;
  const n = ac.createBufferSource();
  const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = b;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  n.connect(f).connect(g).connect(ac.destination); n.start();
}

export const sfx = {
  flap:   () => hiss(0.09, 1600, 0.07, 'highpass'),
  point:  () => { beep(660, 990, 0.12, 'sine', 0.16); beep(1320, 1320, 0.06, 'triangle', 0.06); },
  whoosh: () => { hiss(0.14, 2200, 0.09, 'bandpass'); beep(980, 520, 0.11, 'sine', 0.05); },
  hit:    () => { beep(220, 60, 0.18, 'square', 0.2); hiss(0.12, 2400, 0.14); },
  die:    () => { beep(320, 50, 0.7, 'sawtooth', 0.14); },
  medal:  () => { beep(523, 523, 0.1, 'triangle', 0.14); setTimeout(() => beep(659, 659, 0.1, 'triangle', 0.14), 110); setTimeout(() => beep(784, 784, 0.18, 'triangle', 0.16), 220); },
  pack:   () => { beep(392, 784, 0.4, 'sine', 0.14); setTimeout(() => beep(784, 1175, 0.3, 'sine', 0.1), 180); },
  tick:   () => beep(880, 880, 0.05, 'square', 0.06),
};

export function setMuted(m) { muted = !!m; }
export function isMuted() { return muted; }
export function primeAudio() { ctx(); }

// ── Tiny chiptune loop — lookahead step sequencer, tempo follows scroll ──
// Bouncy C-major vamp under the flight: triangle bass + square arp + hats.
let musTimer = null, musStep = 0, musBpm = 126, nextT = 0;
const BASS = [130.81, 130.81, 87.31, 98];    // C2 C2 F1 G1
const ARP  = [261.63, 329.63, 392, 523.25, 392, 329.63, 261.63, 392];

function noteAt(f, dur, type, vol, when) {
  const ac = ctx(); if (!ac || muted) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(vol, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  o.connect(g).connect(ac.destination);
  o.start(when); o.stop(when + dur + 0.03);
}
function hatAt(when) {
  const ac = ctx(); if (!ac || muted) return;
  const n = ac.createBufferSource();
  const b = ac.createBuffer(1, ac.sampleRate * 0.03, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = b;
  const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6800;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.022, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.03);
  n.connect(f).connect(g).connect(ac.destination); n.start(when);
}
function schedMusic() {
  const ac = ctx(); if (!ac) return;
  const eighth = 60 / musBpm / 2;
  while (nextT < ac.currentTime + 0.18) {
    const s = musStep % 8;
    if (s % 2 === 0) noteAt(BASS[(musStep >> 3) % 4] * (s === 6 ? 1.5 : 1), eighth * 1.7, 'triangle', 0.05, nextT);
    noteAt(ARP[s], eighth * 0.9, 'square', 0.026, nextT);
    if (s % 2 === 1) hatAt(nextT);
    nextT += eighth;
    musStep++;
  }
}
export function startMusic() {
  const ac = ctx(); if (!ac || musTimer) return;
  musStep = 0; nextT = ac.currentTime + 0.08;
  musTimer = setInterval(schedMusic, 42);
}
export function stopMusic() { clearInterval(musTimer); musTimer = null; }
export function setMusicTempo(t) { musBpm = 122 + t * 46; }  // 122→168 BPM by scroll
