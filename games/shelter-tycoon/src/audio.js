// ═══════════════════════════════════════════════════════════════
//  SHELTER TYCOON - Audio (BGM playlist with shuffle)
// ═══════════════════════════════════════════════════════════════

// No bundled MP3s in Monroe deploy - add paths here if assets are shipped later.
const TRACKS = [];

let bgm = null;
let playing = false;
let volume = 0.3;
let initialized = false;
let playlist = [];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function nextTrack() {
  if (TRACKS.length === 0) return null;
  if (playlist.length === 0) {
    playlist = shuffle([...TRACKS]);
    if (playlist[0] === bgm?.src?.split('/').slice(-2).join('/')) {
      const last = playlist.pop();
      playlist.unshift(last);
    }
  }
  return playlist.shift();
}

function loadTrack(src) {
  if (!src) return;
  if (bgm) {
    bgm.pause();
    bgm.removeEventListener('ended', onTrackEnd);
  }
  bgm = new Audio(src);
  bgm.volume = volume;
  bgm.addEventListener('ended', onTrackEnd);
}

function onTrackEnd() {
  if (!playing) return;
  const next = nextTrack();
  if (!next) return;
  loadTrack(next);
  bgm.play().catch(() => {});
}

export function initAudio() {
  if (TRACKS.length === 0) return;

  loadTrack(nextTrack());

  const start = () => {
    if (!initialized) {
      initialized = true;
      bgm?.play().catch(() => {});
      playing = true;
      document.removeEventListener('click', start);
      document.removeEventListener('keydown', start);
    }
  };
  document.addEventListener('click', start);
  document.addEventListener('keydown', start);
}

export function toggleMusic() {
  if (!bgm || TRACKS.length === 0) return false;
  if (playing) {
    bgm.pause();
    playing = false;
  } else {
    bgm.play().catch(() => {});
    playing = true;
  }
  return playing;
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (bgm) bgm.volume = volume;
}

export function getVolume() { return volume; }
export function isPlaying() { return playing; }
