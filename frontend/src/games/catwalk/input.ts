import type { Direction } from './models/cat';

interface InputOptions {
  root: HTMLElement;
  surface: HTMLElement;
  onMove: (direction: Direction) => void;
  onPause: () => void;
}

export function bindInput({ root, surface, onMove, onPause }: InputOptions): () => void {
  const keyDirections: Record<string, Direction> = {
    arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
  };
  const removers: Array<() => void> = [];
  const handleKey = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (keyDirections[key]) {
      event.preventDefault();
      onMove(keyDirections[key]);
    } else if (key === 'p' || key === ' ') {
      event.preventDefault();
      onPause();
    }
  };
  window.addEventListener('keydown', handleKey);
  removers.push(() => window.removeEventListener('keydown', handleKey));

  root.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
    const handleMove = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onMove(button.dataset.move as Direction);
    };
    // pointerdown keeps D-pad responsive; click alone feels laggy on mobile.
    button.addEventListener('pointerdown', handleMove);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
    removers.push(() => {
      button.removeEventListener('pointerdown', handleMove);
    });
  });

  let pointerId: number | null = null;
  let originX = 0;
  let originY = 0;
  const swipeThreshold = 28;
  const handleDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return;
    pointerId = event.pointerId;
    originX = event.clientX;
    originY = event.clientY;
    surface.setPointerCapture?.(event.pointerId);
  };
  const handleMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const distanceX = event.clientX - originX;
    const distanceY = event.clientY - originY;
    if (Math.max(Math.abs(distanceX), Math.abs(distanceY)) < swipeThreshold) return;
    onMove(Math.abs(distanceX) > Math.abs(distanceY) ? (distanceX > 0 ? 'right' : 'left') : (distanceY > 0 ? 'down' : 'up'));
    originX = event.clientX;
    originY = event.clientY;
  };
  const handleUp = (event: PointerEvent) => {
    if (event.pointerId === pointerId) pointerId = null;
  };
  surface.addEventListener('pointerdown', handleDown);
  surface.addEventListener('pointermove', handleMove);
  surface.addEventListener('pointerup', handleUp);
  surface.addEventListener('pointercancel', handleUp);
  removers.push(() => {
    surface.removeEventListener('pointerdown', handleDown);
    surface.removeEventListener('pointermove', handleMove);
    surface.removeEventListener('pointerup', handleUp);
    surface.removeEventListener('pointercancel', handleUp);
  });

  return () => removers.forEach((remove) => remove());
}
