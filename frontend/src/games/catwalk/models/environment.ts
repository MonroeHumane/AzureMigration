import { PALETTE } from '../rendering/palette';
import { curve, line, polyline, wire } from '../rendering/primitives';

export const BOARD_WIDTH = 720;
export const BOARD_HEIGHT = 864; // 52px top HUD + 780px board + 32px bottom bar
export const PLAY_TOP_Y = 52;
export const PLAY_BOTTOM_Y = 832;
export const CELL_SIZE = 60;

export function drawEnvironment(context: CanvasRenderingContext2D, elapsed: number): void {
  // 1. Deep vector terminal background
  context.fillStyle = PALETTE.background;
  context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // 2. River Bank Depth Fill (Rows 1 to 5 of play area)
  // Gives clear visual distinction between water and road!
  context.fillStyle = PALETTE.waterDeep;
  context.fillRect(0, PLAY_TOP_Y + 1 * CELL_SIZE, BOARD_WIDTH, 5 * CELL_SIZE);

  // 3. Vector Grid Backdrop (Faint, high-tech radar style)
  wire(context, PALETTE.grid, 0.9, 0.45);
  for (let column = 0; column <= BOARD_WIDTH; column += CELL_SIZE) {
    line(context, { x: column, y: PLAY_TOP_Y }, { x: column, y: PLAY_BOTTOM_Y });
  }
  for (let r = 0; r <= 13; r++) {
    const y = PLAY_TOP_Y + r * CELL_SIZE;
    line(context, { x: 0, y }, { x: BOARD_WIDTH, y });
  }

  // 4. Flowing River Currents & Caustic Waves (Rows 1 to 5)
  for (let row = 1; row <= 5; row += 1) {
    const centerY = PLAY_TOP_Y + row * CELL_SIZE + CELL_SIZE / 2;
    // Alternate current direction to mirror water lanes
    const dir = row % 2 === 1 ? 1 : -1;
    const waveShift = ((elapsed * 24 * dir) % 120 + 120) % 120;

    wire(context, PALETTE.waterSoft, 1.2, 0.4);
    for (let startX = -120 + waveShift; startX < BOARD_WIDTH + 60; startX += 80) {
      curve(
        context,
        { x: startX, y: centerY + 6 },
        { x: startX + 16, y: centerY + 2 },
        { x: startX + 28, y: centerY + 10 },
        { x: startX + 44, y: centerY + 6 },
      );
    }

    // River lane divider water lines
    wire(context, PALETTE.waterSoft, 0.8, 0.25);
    line(context, { x: 0, y: PLAY_TOP_Y + row * CELL_SIZE }, { x: BOARD_WIDTH, y: PLAY_TOP_Y + row * CELL_SIZE });
  }

  // 5. Road Lane Markings (Rows 7 to 11)
  // Clean dashed vector road boundaries
  wire(context, PALETTE.gridStrong, 1.2, 0.7);
  context.setLineDash([16, 16]);
  for (let row = 8; row <= 11; row += 1) {
    line(context, { x: 0, y: PLAY_TOP_Y + row * CELL_SIZE }, { x: BOARD_WIDTH, y: PLAY_TOP_Y + row * CELL_SIZE });
  }
  context.setLineDash([]);

  // Road curb markers
  wire(context, PALETTE.gridStrong, 1.6, 0.85);
  line(context, { x: 0, y: PLAY_TOP_Y + 7 * CELL_SIZE }, { x: BOARD_WIDTH, y: PLAY_TOP_Y + 7 * CELL_SIZE });
  line(context, { x: 0, y: PLAY_TOP_Y + 12 * CELL_SIZE }, { x: BOARD_WIDTH, y: PLAY_TOP_Y + 12 * CELL_SIZE });

  // 6. Safe Sanctuary Fences (Rows 6 and 12)
  // Beautiful wireframe picket garden fence
  for (const safeRow of [6, 12]) {
    const topY = PLAY_TOP_Y + safeRow * CELL_SIZE + 10;
    const bottomY = PLAY_TOP_Y + safeRow * CELL_SIZE + CELL_SIZE - 10;
    const railY1 = PLAY_TOP_Y + safeRow * CELL_SIZE + 20;
    const railY2 = PLAY_TOP_Y + safeRow * CELL_SIZE + 40;

    // Horizontal rails
    wire(context, PALETTE.fence, 1.6, 0.85);
    line(context, { x: 8, y: railY1 }, { x: BOARD_WIDTH - 8, y: railY1 });
    line(context, { x: 8, y: railY2 }, { x: BOARD_WIDTH - 8, y: railY2 });

    // Pickets with pointed tops
    wire(context, PALETTE.fencePost, 1.4, 0.75);
    for (let picketX = 20; picketX < BOARD_WIDTH; picketX += 24) {
      polyline(context, [
        { x: picketX - 3, y: bottomY },
        { x: picketX - 3, y: topY + 4 },
        { x: picketX, y: topY }, // Pointed pick
        { x: picketX + 3, y: topY + 4 },
        { x: picketX + 3, y: bottomY },
      ]);
    }
  }

  // 7. Subtle CRT scanline effect (arcade aesthetic)
  wire(context, '#000000', 0.6, 0.15);
  for (let y = 0; y < BOARD_HEIGHT; y += 4) {
    line(context, { x: 0, y }, { x: BOARD_WIDTH, y });
  }
}
