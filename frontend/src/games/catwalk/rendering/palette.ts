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