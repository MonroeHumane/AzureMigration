/** Base night-patrol wireframe colors (immutable reference). */
export const PALETTE = Object.freeze({
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
});

export type WireColor = (typeof PALETTE)[keyof typeof PALETTE];

/** Patrol shift / time-of-day mood for background + accent tinting. */
export type ShiftId = 'night' | 'lateNight' | 'dawn';

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
    water: PALETTE.water,
    waterSoft: PALETTE.waterSoft,
    fence: PALETTE.fence,
    fencePost: PALETTE.fencePost,
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
};

/**
 * Resolve patrol shift from run progress.
 * night (start) → lateNight (mid patrol) → optional dawn when score/elapsed climb.
 */
export function resolveShift(elapsed: number, score: number, level: number): ShiftId {
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
