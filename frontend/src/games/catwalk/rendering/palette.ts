export type ThemeId = 'dark' | 'light';

type WirePalette = {
  background: string;
  grid: string;
  gridStrong: string;
  cat: string;
  catSoft: string;
  catGlow: string;
  dogCoral: string;
  dogAmber: string;
  dogRose: string;
  water: string;
  waterDeep: string;
  waterSoft: string;
  waterGlow: string;
  home: string;
  homeDim: string;
  fence: string;
  fencePost: string;
  warning: string;
};

/** Night patrol: neon-on-black, glowing wireframe. */
const NIGHT_WIRE: WirePalette = {
  background: '#040b08',
  grid: '#0d2218',
  gridStrong: '#1a3c2c',
  cat: '#4dfa8b',
  catSoft: '#22a058',
  catGlow: '#00ff73',
  dogCoral: '#ff5c6a',
  dogAmber: '#ffaa33',
  dogRose: '#ff7599',
  water: '#3fe0f5',
  waterDeep: '#061d28',
  waterSoft: '#185868',
  waterGlow: '#00d0ea',
  home: '#e8ffef',
  homeDim: '#325845',
  fence: '#38885a',
  fencePost: '#52bb7e',
  warning: '#ffbb33',
};

/**
 * Day patrol: the same linework read as a bright storybook map instead of a
 * neon HUD. Saturated inks that hold up on a pale sky, and the glow is switched
 * off entirely — the bloom is what makes the night version feel spooky.
 */
const DAY_WIRE: WirePalette = {
  background: '#dff1fb',
  grid: '#b6d9e8',
  gridStrong: '#7fb6cd',
  cat: '#15803d',
  catSoft: '#4ade80',
  catGlow: '#16a34a',
  dogCoral: '#dc2626',
  dogAmber: '#c2410c',
  dogRose: '#db2777',
  water: '#1d4ed8',
  waterDeep: '#bfdbfe',
  waterSoft: '#60a5fa',
  waterGlow: '#2563eb',
  home: '#0f766e',
  homeDim: '#5b7b8a',
  fence: '#166534',
  fencePost: '#15803d',
  warning: '#b45309',
};

type HudPalette = {
  /** Cockpit bar gradient, top to bottom */
  panelTop: string;
  panelMid: string;
  panelBottom: string;
  rule: string;
  divider: string;
  dividerNotch: string;
  frame: string;
  frameFaint: string;
  frameFaintest: string;
  subtitle: string;
  label: string;
  value: string;
  underline: string;
  gold: string;
  goldUnderline: string;
  badge: string;
  controlIdle: string;
  soundIcon: string;
  soundWave: string;
  soundHalo: string;
  pauseIcon: string;
  pauseHalo: string;
  scrim: string;
};

const NIGHT_HUD: HudPalette = {
  panelTop: '#07150e',
  panelMid: '#040d09',
  panelBottom: '#020704',
  rule: '#102e20',
  divider: '#163828',
  dividerNotch: '#2c6d4e',
  frame: '#1d4834',
  frameFaint: '#1e4432',
  frameFaintest: '#142c20',
  subtitle: '#6ee7a8',
  label: '#78a890',
  value: '#e8ffef',
  underline: '#1b4532',
  gold: '#caa652',
  goldUnderline: '#5c4618',
  badge: '#276345',
  controlIdle: '#204a36',
  soundIcon: '#a2e8f5',
  soundWave: '#3fe0f5',
  soundHalo: 'rgba(63, 224, 245, 0.09)',
  pauseIcon: '#a2e8c2',
  pauseHalo: 'rgba(77, 250, 139, 0.09)',
  scrim: 'rgba(4, 11, 8, 0.96)',
};

const DAY_HUD: HudPalette = {
  panelTop: '#ffffff',
  panelMid: '#f4f8fa',
  panelBottom: '#e3edf2',
  rule: '#c2d6de',
  divider: '#cbd5e1',
  dividerNotch: '#15803d',
  frame: '#7fb6cd',
  frameFaint: '#a8cbd9',
  frameFaintest: '#c2d6de',
  subtitle: '#15803d',
  label: '#5b7b8a',
  value: '#123524',
  underline: '#a8cbd9',
  gold: '#a16207',
  goldUnderline: '#d6b476',
  badge: '#15803d',
  controlIdle: '#8fb3a2',
  soundIcon: '#1d4ed8',
  soundWave: '#2563eb',
  soundHalo: 'rgba(29, 78, 216, 0.08)',
  pauseIcon: '#15803d',
  pauseHalo: 'rgba(21, 128, 61, 0.08)',
  scrim: 'rgba(223, 241, 251, 0.96)',
};

/**
 * Live wire colors. Mutated in place by `setCatwalkTheme` so every model module
 * that reads `PALETTE.cat` at draw time picks up the new theme on the next
 * frame, without threading a palette argument through the whole renderer.
 */
export const PALETTE: WirePalette = { ...NIGHT_WIRE };

/** HUD / cockpit-bar inks. Mutated in place alongside PALETTE. */
export const HUD: HudPalette = { ...NIGHT_HUD };

export type WireColor = string;

/** Glow multiplier applied to every `wire()` call. 0 in daylight. */
export const glowScale = { value: 1 };

let activeTheme: ThemeId = 'dark';

export function getCatwalkTheme(): ThemeId {
  return activeTheme;
}

export function setCatwalkTheme(theme: ThemeId): void {
  activeTheme = theme === 'light' ? 'light' : 'dark';
  const light = activeTheme === 'light';
  Object.assign(PALETTE, light ? DAY_WIRE : NIGHT_WIRE);
  Object.assign(HUD, light ? DAY_HUD : NIGHT_HUD);
  glowScale.value = light ? 0 : 1;
}

/** Patrol shift / time-of-day mood for background + accent tinting. */
export type ShiftId = 'night' | 'lateNight' | 'dawn' | 'daylight' | 'afternoon';

export interface ShiftPalette {
  id: ShiftId;
  /** Solid board fill behind the grid */
  background: string;
  grid: string;
  gridStrong: string;
  /** Soft full-board wash (rgba) drawn after the base fill */
  moodWash: string;
  /** River gradient stops */
  riverTop: string;
  riverMid: string;
  riverBottom: string;
  /** Road asphalt bed */
  roadBed: string;
  /** Subtle sky vignette accent (rgba) */
  skyAccent: string;
  water: string;
  waterSoft: string;
  fence: string;
  fencePost: string;
}

const SHIFT_TABLE: Record<ShiftId, ShiftPalette> = {
  night: {
    id: 'night',
    background: '#040b08',
    grid: '#0d2218',
    gridStrong: '#1a3c2c',
    moodWash: 'rgba(4, 18, 12, 0)',
    riverTop: '#04161f',
    riverMid: '#072430',
    riverBottom: '#051b24',
    roadBed: '#05110c',
    skyAccent: 'rgba(0, 40, 28, 0.12)',
    water: NIGHT_WIRE.water,
    waterSoft: NIGHT_WIRE.waterSoft,
    fence: NIGHT_WIRE.fence,
    fencePost: NIGHT_WIRE.fencePost,
  },
  lateNight: {
    id: 'lateNight',
    background: '#030810',
    grid: '#0a1824',
    gridStrong: '#152a3c',
    moodWash: 'rgba(12, 24, 48, 0.22)',
    riverTop: '#04101c',
    riverMid: '#061a2c',
    riverBottom: '#040e18',
    roadBed: '#040c14',
    skyAccent: 'rgba(40, 60, 120, 0.16)',
    water: '#5aa8ff',
    waterSoft: '#1a4060',
    fence: '#3a6a88',
    fencePost: '#5a9abb',
  },
  dawn: {
    id: 'dawn',
    background: '#0a0c08',
    grid: '#1a2214',
    gridStrong: '#2e3c24',
    moodWash: 'rgba(48, 28, 12, 0.18)',
    riverTop: '#0c1820',
    riverMid: '#102430',
    riverBottom: '#0a1a22',
    roadBed: '#0c120c',
    skyAccent: 'rgba(255, 140, 60, 0.10)',
    water: '#4ec8d8',
    waterSoft: '#2a5860',
    fence: '#6a8850',
    fencePost: '#8abb62',
  },

  // Daylight shifts only run in light theme: blue sky, green verges, a real
  // river instead of a glowing channel.
  daylight: {
    id: 'daylight',
    background: '#dff1fb',
    grid: '#b6d9e8',
    gridStrong: '#7fb6cd',
    moodWash: 'rgba(255, 247, 214, 0.28)',
    riverTop: '#7dd3fc',
    riverMid: '#38bdf8',
    riverBottom: '#0ea5e9',
    roadBed: '#cbd5e1',
    skyAccent: 'rgba(253, 224, 71, 0.22)',
    water: DAY_WIRE.water,
    waterSoft: DAY_WIRE.waterSoft,
    fence: DAY_WIRE.fence,
    fencePost: DAY_WIRE.fencePost,
  },
  afternoon: {
    id: 'afternoon',
    background: '#ffeed6',
    grid: '#f3d9b6',
    gridStrong: '#d8b489',
    moodWash: 'rgba(255, 196, 120, 0.24)',
    riverTop: '#93c5fd',
    riverMid: '#60a5fa',
    riverBottom: '#3b82f6',
    roadBed: '#d6d3d1',
    skyAccent: 'rgba(251, 146, 60, 0.2)',
    water: DAY_WIRE.water,
    waterSoft: DAY_WIRE.waterSoft,
    fence: DAY_WIRE.fence,
    fencePost: DAY_WIRE.fencePost,
  },
};

/**
 * Resolve patrol shift from run progress.
 * night (start) → lateNight (mid patrol) → optional dawn when score/elapsed climb.
 */
export function resolveShift(elapsed: number, score: number, level: number): ShiftId {
  // In light theme the patrol runs in daylight, drifting toward golden hour on
  // a long run — the same progression beat as night → late night.
  if (activeTheme === 'light') {
    return elapsed > 45 || level >= 3 || score >= 900 ? 'afternoon' : 'daylight';
  }
  // Dawn unlocks after a solid run (high score or deep into later routes)
  if (score >= 2200 || (level >= 4 && elapsed > 90)) return 'dawn';
  // Late-night accent once the patrol has been underway a while
  if (elapsed > 45 || level >= 3 || score >= 900) return 'lateNight';
  return 'night';
}

export function getShiftPalette(shift: ShiftId): ShiftPalette {
  return SHIFT_TABLE[shift];
}

export function getShiftPaletteForState(elapsed: number, score: number, level: number): ShiftPalette {
  return getShiftPalette(resolveShift(elapsed, score, level));
}
