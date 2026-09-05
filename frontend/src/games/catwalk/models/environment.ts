import { PALETTE } from '../rendering/palette';
import { curve, line, wire } from '../rendering/primitives';

export const BOARD_WIDTH = 720;
export const BOARD_HEIGHT = 780;
export const CELL_SIZE = 60;

export function drawEnvironment(context: CanvasRenderingContext2D, elapsed: number): void {
  context.fillStyle = PALETTE.background;
  context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  wire(context, PALETTE.grid, 1);
  for (let column = 0; column <= BOARD_WIDTH; column += CELL_SIZE) {
    line(context, { x: column, y: 0 }, { x: column, y: BOARD_HEIGHT });
  }
  for (let row = 0; row <= BOARD_HEIGHT; row += CELL_SIZE) {
    line(context, { x: 0, y: row }, { x: BOARD_WIDTH, y: row });
  }

  wire(context, PALETTE.waterSoft, 1.2, 0.75);
  for (let row = 1; row <= 5; row += 1) {
    const centerY = row * CELL_SIZE + CELL_SIZE / 2;
    const shift = (elapsed * (10 + row * 2)) % 90;
    for (let startX = -100 + shift; startX < BOARD_WIDTH; startX += 90) {
      curve(context, { x: startX, y: centerY }, { x: startX + 15, y: centerY - 4 }, { x: startX + 28, y: centerY + 4 }, { x: startX + 42, y: centerY });
    }
  }

  wire(context, PALETTE.gridStrong, 1.4);
  context.setLineDash([18, 18]);
  for (let row = 8; row <= 11; row += 1) {
    line(context, { x: 0, y: row * CELL_SIZE }, { x: BOARD_WIDTH, y: row * CELL_SIZE });
  }
  context.setLineDash([]);

  wire(context, PALETTE.catSoft, 1.8);
  for (const safeRow of [6, 12]) {
    const centerY = safeRow * CELL_SIZE + CELL_SIZE / 2;
    line(context, { x: 14, y: centerY - 6 }, { x: BOARD_WIDTH - 14, y: centerY - 6 });
    line(context, { x: 14, y: centerY + 6 }, { x: BOARD_WIDTH - 14, y: centerY + 6 });
    for (let fenceX = 22; fenceX < BOARD_WIDTH; fenceX += 38) {
      line(context, { x: fenceX, y: centerY - 11 }, { x: fenceX, y: centerY + 11 });
    }
  }
}