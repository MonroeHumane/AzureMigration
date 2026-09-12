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

// Continuous board-roll bed — gain follows run speed. Lazily created on first call.
let rollGain = null, rollSrc = null;
export function setRoll(level) {
  const ac = ctx(); if (!ac) return;
  if (!rollSrc) {
    const len = ac.sampleRate * 1.5;
    const b = ac.createBuffer(1, len, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    rollSrc = ac.createBufferSource();
    rollSrc.buffer = b; rollSrc.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 0.7;
    rollGain = ac.createGain(); rollGain.gain.value = 0;
    rollSrc.connect(f).connect(rollGain).connect(ac.destination);
    rollSrc.start();
  }
  rollGain.gain.setTargetAtTime(muted ? 0 : level * 0.06, ac.currentTime, 0.14);
}

export const sfx = {
  roll:    () => hiss(0.05, 300, 0.03, 'lowpass'),
  nearMiss:() => hiss(0.15, 2800, 0.1, 'highpass'),
  fanfare: () => {
    beep(523, 523, 0.11, 'triangle', 0.15);
    setTimeout(() => beep(659, 659, 0.11, 'triangle', 0.15), 110);
    setTimeout(() => beep(784, 784, 0.11, 'triangle', 0.15), 220);
    setTimeout(() => beep(1046, 1046, 0.24, 'triangle', 0.17), 330);
  },
  // ollie pop + happy yip
  jump:    () => { hiss(0.05, 1200, 0.07, 'highpass'); beep(340, 700, 0.13, 'triangle', 0.13);
                   setTimeout(() => beep(880, 1200, 0.07, 'square', 0.05), 60); },
  duck:    () => hiss(0.2, 600, 0.09, 'lowpass'),
  land:    () => { beep(180, 90, 0.09, 'sine', 0.1); hiss(0.05, 900, 0.05); },
  collect: () => { beep(660, 990, 0.12, 'sine', 0.15); beep(1320, 1320, 0.07, 'triangle', 0.06); },
  rescue:  () => { beep(523, 784, 0.14, 'sine', 0.15); setTimeout(() => beep(784, 1046, 0.16, 'sine', 0.12), 90); },
  // yelp! quick descending double-bark
  hit:     () => { beep(700, 240, 0.12, 'square', 0.16); setTimeout(() => beep(600, 200, 0.14, 'square', 0.13), 90); hiss(0.1, 2400, 0.1); },
  die:     () => { beep(400, 120, 0.5, 'sawtooth', 0.12); setTimeout(() => beep(300, 60, 0.5, 'sine', 0.1), 200); },
  medal:   () => { beep(523, 523, 0.1, 'triangle', 0.14); setTimeout(() => beep(659, 659, 0.1, 'triangle', 0.14), 110); setTimeout(() => beep(784, 784, 0.18, 'triangle', 0.16), 220); },
  pack:    () => { beep(392, 784, 0.4, 'sine', 0.14); setTimeout(() => beep(784, 1175, 0.3, 'sine', 0.1), 180); },
  tick:    () => beep(880, 880, 0.05, 'square', 0.06),
};

export function setMuted(m) { muted = !!m; }
export function isMuted() { return muted; }
export function primeAudio() { ctx(); }

// ── Tiny chiptune loop — lookahead step sequencer, tempo follows speed ──
// bass pulse on quarters + square arp 8ths + hat ticks, quiet under the roll bed.
let musTimer = null, musStep = 0, musBpm = 132, nextT = 0;
const BASS = [110, 110, 130.81, 98];         // A1 A1 C2 G1 — driving minor vamp
const ARP  = [220, 261.63, 329.63, 392, 329.63, 261.63, 220, 329.63];

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
  const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.025, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.03);
  n.connect(f).connect(g).connect(ac.destination); n.start(when);
}
function schedMusic() {
  const ac = ctx(); if (!ac) return;
  const eighth = 60 / musBpm / 2;
  while (nextT < ac.currentTime + 0.18) {
    const s = musStep % 8;
    if (s % 2 === 0) noteAt(BASS[(musStep >> 3) % 4] * (s === 6 ? 1.5 : 1), eighth * 1.7, 'triangle', 0.055, nextT);
    noteAt(ARP[s], eighth * 0.9, 'square', 0.028, nextT);
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
export function setMusicTempo(t) { musBpm = 120 + t * 52; }  // 120→172 BPM by speed
