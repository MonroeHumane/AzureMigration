import { type ShiftPalette, getShiftPalette } from '../rendering/palette';
import { line, polyline, resetGlow, wire } from '../rendering/primitives';

export const BOARD_WIDTH = 720;
export const BOARD_HEIGHT = 864; // 52px top HUD + 780px board + 32px bottom bar
export const PLAY_TOP_Y = 52;
export const PLAY_BOTTOM_Y = 832;
export const CELL_SIZE = 60;

export function drawEnvironment(
  context: CanvasRenderingContext2D,
  elapsed: number,
  shift?: ShiftPalette,
): void {
  const mood = shift ?? getShiftPalette('night');
  resetGlow(context);

  // 1. Solid deep background (shift-aware)
  context.fillStyle = mood.background;
  context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // Soft mood wash + sky vignette (late night blue / dawn amber)
  if (mood.moodWash !== 'rgba(4, 18, 12, 0)') {
    context.fillStyle = mood.moodWash;
    context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  }
  const skyGrad = context.createLinearGradient(0, PLAY_TOP_Y, 0, PLAY_TOP_Y + CELL_SIZE * 3);
  skyGrad.addColorStop(0, mood.skyAccent);
  skyGrad.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = skyGrad;
  context.fillRect(0, PLAY_TOP_Y, BOARD_WIDTH, CELL_SIZE * 3);

  // Faint drifting atmosphere motes (very subtle, shift-tinted)
  const moteColor = mood.id === 'dawn' ? 'rgba(255,180,90,0.12)' : mood.id === 'lateNight' ? 'rgba(120,160,255,0.10)' : 'rgba(77,250,139,0.08)';
  context.fillStyle = moteColor;
  for (let i = 0; i < 8; i++) {
    const mx = ((elapsed * (8 + i * 3) + i * 97) % (BOARD_WIDTH + 40)) - 20;
    const my = PLAY_TOP_Y + 20 + ((i * 73 + elapsed * 4) % (PLAY_BOTTOM_Y - PLAY_TOP_Y - 40));
    context.beginPath();
    context.arc(mx, my, 1.1 + (i % 3) * 0.4, 0, Math.PI * 2);
    context.fill();
  }

  // 2. Faint coordinate grid (calm, stable arcade grid)
  wire(context, mood.grid, 0.75, 0.35);
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

  // A. Rich aquatic gradient (shift-aware)
  const riverGrad = context.createLinearGradient(0, riverTopY, 0, riverBottomY);
  riverGrad.addColorStop(0, mood.riverTop);
  riverGrad.addColorStop(0.5, mood.riverMid);
  riverGrad.addColorStop(1, mood.riverBottom);
  context.fillStyle = riverGrad;
  context.fillRect(0, riverTopY, BOARD_WIDTH, riverHeight);

  // B. Clean riverbank boundary lines
  wire(context, mood.water, 1.5, 0.7);
  line(context, { x: 0, y: riverTopY + 0.5 }, { x: BOARD_WIDTH, y: riverTopY + 0.5 });
  line(context, { x: 0, y: riverBottomY - 0.5 }, { x: BOARD_WIDTH, y: riverBottomY - 0.5 });

  // C. Gentle, continuous streamline waves per lane
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
    wire(context, mood.waterSoft, 1.1, 0.45);
    context.beginPath();
    for (let x = 0; x <= BOARD_WIDTH; x += 15) {
      const wavePhase = (x - elapsed * c.speed * c.dir) / (c.waveLen * 0.16);
      const wy = centerY + Math.sin(wavePhase) * c.amp;
      if (x === 0) context.moveTo(x, wy);
      else context.lineTo(x, wy);
    }
    context.stroke();

    // 2. Faint second harmonic ripple line for liquid depth
    wire(context, mood.waterSoft, 0.8, 0.25);
    context.beginPath();
    for (let x = 0; x <= BOARD_WIDTH; x += 15) {
      const wavePhase = (x - elapsed * c.speed * c.dir * 0.85 + 40) / (c.waveLen * 0.2);
      const wy = centerY + 10 + Math.sin(wavePhase) * (c.amp * 0.7);
      if (x === 0) context.moveTo(x, wy);
      else context.lineTo(x, wy);
    }
    context.stroke();

    // 3. Lane boundary water thread
    wire(context, mood.id === 'lateNight' ? '#0e2840' : mood.id === 'dawn' ? '#1a3030' : '#0e3a46', 0.8, 0.35);
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
  context.fillStyle = mood.roadBed;
  context.fillRect(0, roadTopY, BOARD_WIDTH, roadHeight);

  // B. Clean road curb boundaries
  wire(context, mood.id === 'lateNight' ? '#254858' : mood.id === 'dawn' ? '#3a5830' : '#25583f', 1.6, 0.85);
  line(context, { x: 0, y: roadTopY + 0.5 }, { x: BOARD_WIDTH, y: roadTopY + 0.5 });
  line(context, { x: 0, y: roadBottomY - 0.5 }, { x: BOARD_WIDTH, y: roadBottomY - 0.5 });

  // C. Clean dashed lane dividers
  wire(context, mood.gridStrong, 1.2, 0.65);
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
    wire(context, mood.fence, 1.4, 0.8);
    line(context, { x: 8, y: railY1 + 0.5 }, { x: BOARD_WIDTH - 8, y: railY1 + 0.5 });
    line(context, { x: 8, y: railY2 + 0.5 }, { x: BOARD_WIDTH - 8, y: railY2 + 0.5 });

    // Pickets with pointed tops
    wire(context, mood.fencePost, 1.2, 0.7);
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
