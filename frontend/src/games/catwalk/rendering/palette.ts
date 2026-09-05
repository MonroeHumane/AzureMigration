export const PALETTE = Object.freeze({
  background: '#07100c',
  grid: '#173628',
  gridStrong: '#2b5440',
  cat: '#b8ff81',
  catSoft: '#75c98a',
  dogCoral: '#ff7682',
  dogAmber: '#ffc266',
  dogRose: '#ff9db1',
  water: '#74deec',
  waterSoft: '#367f8c',
  home: '#dfffe9',
  homeDim: '#587767',
  warning: '#ffcc66',
});

export type WireColor = (typeof PALETTE)[keyof typeof PALETTE];