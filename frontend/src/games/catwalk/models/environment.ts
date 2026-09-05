import { PALETTE } from '../rendering/palette';
import { circle, curve, line, polyline, resetGlow, wire } from '../rendering/primitives';

export const BOARD_WIDTH = 720;
export const BOARD_HEIGHT = 864; // 52px top HUD + 780px board + 32px bottom bar
export const PLAY_TOP_Y = 52;
export const PLAY_BOTTOM_Y = 832;
export const CELL_SIZE = 60;

export function drawEnvironment(context: CanvasRenderingContext2D, elapsed: number): void {
  resetGlow(context);

  // 1. Solid deep background
  context.fillStyle = PALETTE.background;
  context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // 2. Faint coordinate grid (calm, stable arcade grid)
  wire(context, PALETTE.grid, 0.75, 0.35);
  for (let column = 0; column <= BOARD_WIDTH; column += CELL_SIZE) {
    line(context, { x: column + 0.5, y: PLAY_TOP_Y }, { x: column + 0.5, y: PLAY_BOTTOM_Y });
  }
  for (let r = 0; r <= 13; r++) {
    const y = PLAY_TOP_Y + r * CELL_SIZE;
    line(context, { x: 0, y: y + 0.5 }, { x: BOARD_WIDTH, y: y + 0.5 });
  }

  // ========================================================
  // 3. RIVER SECTOR (Rows 1 to 5: Y = 112 .. 412)
  // Clean, elegant, calm currents without clutter or visual strobing
  // ========================================================
  const riverTopY = PLAY_TOP_Y + 1 * CELL_SIZE; // 112
  const riverHeight = 5 * CELL_SIZE; // 300
  const riverBottomY = riverTopY + riverHeight; // 412

  // A. Rich aquatic gradient
  const riverGrad = context.createLinearGradient(0, riverTopY, 0, riverBottomY);
  riverGrad.addColorStop(0, '#04161f');
  riverGrad.addColorStop(0.5, '#072430');
  riverGrad.addColorStop(1, '#051b24');
  context.fillStyle = riverGrad;
  context.fillRect(0, riverTopY, BOARD_WIDTH, riverHeight);

  // B. Clean riverbank boundary lines
  wire(context, PALETTE.water, 1.5, 0.7);
  line(context, { x: 0, y: riverTopY + 0.5 }, { x: BOARD_WIDTH, y: riverTopY + 0.5 });
  line(context, { x: 0, y: riverBottomY - 0.5 }, { x: BOARD_WIDTH, y: riverBottomY - 0.5 });

  // C. Gentle, continuous streamline waves per lane
  // (Smooth continuous curves, no flashing bubbles, no disjointed arcs)
  const laneSpeeds = [
    { row: 1, dir: 1, speed: 28, waveLen: 120, amp: 2.5 },
    { row: 2, dir: -1, speed: 32, waveLen: 140, amp: 2.8 },
    { row: 3, dir: 1, speed: 36, waveLen: 150, amp: 3.0 },
    { row: 4, dir: -1, speed: 30, waveLen: 130, amp: 2.6 },
    { row: 5, dir: 1, speed: 34, waveLen: 135, amp: 2.8 },
  ];

  laneSpeeds.forEach((c) => {
    const rowY = PLAY_TOP_Y + c.row * CELL_SIZE;
    const centerY = rowY + CELL_SIZE / 2;

    // 1. Smooth harmonic streamline
    wire(context, PALETTE.waterSoft, 1.1, 0.45);
    context.beginPath();
    for (let x = 0; x <= BOARD_WIDTH; x += 15) {
      const wavePhase = (x - elapsed * c.speed * c.dir) / (c.waveLen * 0.16);
      const wy = centerY + Math.sin(wavePhase) * c.amp;
      if (x === 0) context.moveTo(x, wy);
      else context.lineTo(x, wy);
    }
    context.stroke();

    // 2. Faint second harmonic ripple line for liquid depth
    wire(context, PALETTE.waterSoft, 0.8, 0.25);
    context.beginPath();
    for (let x = 0; x <= BOARD_WIDTH; x += 15) {
      const wavePhase = (x - elapsed * c.speed * c.dir * 0.85 + 40) / (c.waveLen * 0.2);
      const wy = centerY + 10 + Math.sin(wavePhase) * (c.amp * 0.7);
      if (x === 0) context.moveTo(x, wy);
      else context.lineTo(x, wy);
    }
    context.stroke();

    // 3. Lane boundary water thread
    wire(context, '#0e3a46', 0.8, 0.35);
    line(context, { x: 0, y: rowY + 0.5 }, { x: BOARD_WIDTH, y: rowY + 0.5 });
  });

  // ========================================================
  // 4. ROAD SECTOR (Rows 7 to 11: Y = 472 .. 772)
  // Clean, crisp asphalt with clear lane dividers
  // ========================================================
  const roadTopY = PLAY_TOP_Y + 7 * CELL_SIZE; // 472
  const roadHeight = 5 * CELL_SIZE; // 300
  const roadBottomY = roadTopY + roadHeight; // 772

  // A. Asphalt background bed
  context.fillStyle = '#05110c';
  context.fillRect(0, roadTopY, BOARD_WIDTH, roadHeight);

  // B. Clean road curb boundaries
  wire(context, '#25583f', 1.6, 0.85);
  line(context, { x: 0, y: roadTopY + 0.5 }, { x: BOARD_WIDTH, y: roadTopY + 0.5 });
  line(context, { x: 0, y: roadBottomY - 0.5 }, { x: BOARD_WIDTH, y: roadBottomY - 0.5 });

  // C. Clean dashed lane dividers
  wire(context, PALETTE.gridStrong, 1.2, 0.65);
  context.setLineDash([16, 16]);
  for (let row = 8; row <= 11; row += 1) {
    line(context, { x: 0, y: PLAY_TOP_Y + row * CELL_SIZE + 0.5 }, { x: BOARD_WIDTH, y: PLAY_TOP_Y + row * CELL_SIZE + 0.5 });
  }
  context.setLineDash([]);

  // ========================================================
  // 5. SANCTUARY SIDEWALK FENCES (Rows 6 and 12)
  // Crisp architectural picket fences
  // ========================================================
  for (const safeRow of [6, 12]) {
    const topY = PLAY_TOP_Y + safeRow * CELL_SIZE + 10;
    const bottomY = PLAY_TOP_Y + safeRow * CELL_SIZE + CELL_SIZE - 10;
    const railY1 = PLAY_TOP_Y + safeRow * CELL_SIZE + 20;
    const railY2 = PLAY_TOP_Y + safeRow * CELL_SIZE + 40;

    // Horizontal rails
    wire(context, PALETTE.fence, 1.4, 0.8);
    line(context, { x: 8, y: railY1 + 0.5 }, { x: BOARD_WIDTH - 8, y: railY1 + 0.5 });
    line(context, { x: 8, y: railY2 + 0.5 }, { x: BOARD_WIDTH - 8, y: railY2 + 0.5 });

    // Pickets with pointed tops
    wire(context, PALETTE.fencePost, 1.2, 0.7);
    for (let picketX = 20; picketX < BOARD_WIDTH; picketX += 24) {
      polyline(context, [
        { x: picketX - 3, y: bottomY },
        { x: picketX - 3, y: topY + 4 },
        { x: picketX, y: topY },
        { x: picketX + 3, y: topY + 4 },
        { x: picketX + 3, y: bottomY },
      ]);
    }
  }

  resetGlow(context);
}
