import { drawCat } from '../models/cat';
import { drawDog, DOG_PROFILES } from '../models/dogs';
import { drawEnvironment, BOARD_HEIGHT, BOARD_WIDTH, CELL_SIZE, PLAY_TOP_Y, PLAY_BOTTOM_Y } from '../models/environment';
import { drawFishbone } from '../models/fishbones';
import { drawHouse } from '../models/houses';
import { DOG_LANES, FISHBONE_LANES, HOME_POSITIONS, positionsForLane, type GameState } from '../engine/game';
import { PALETTE } from './palette';
import { line, polyline, wire } from './primitives';

export function renderGame(context: CanvasRenderingContext2D, state: GameState, audioMuted = true, debug = false): void {
  // 1. World environment
  drawEnvironment(context, state.elapsed);

  // 2. Sanctuary Houses (Goals)
  HOME_POSITIONS.forEach((homeX, index) => {
    drawHouse(context, { x: homeX, y: PLAY_TOP_Y + 31, index, occupied: state.homes[index], phase: state.elapsed });
  });

  // 3. Fishbone River Platforms
  FISHBONE_LANES.forEach((lane) => {
    positionsForLane(lane, state).forEach((center) => {
      drawFishbone(context, {
        x: center,
        y: PLAY_TOP_Y + lane.row * CELL_SIZE + CELL_SIZE / 2,
        length: lane.length,
        facing: lane.speed > 0 ? 1 : -1,
        phase: state.elapsed + lane.row * 0.2,
        kind: lane.kind,
      });
      if (debug) {
        context.strokeStyle = PALETTE.warning;
        context.strokeRect(
          center - lane.length / 2 + 8,
          PLAY_TOP_Y + lane.row * CELL_SIZE + 14,
          lane.length - 16,
          CELL_SIZE - 28,
        );
      }
    });
  });

  // 4. Patrol Dogs (Street Hazards)
  DOG_LANES.forEach((lane) => {
    const profile = DOG_PROFILES[lane.breed];
    positionsForLane(lane, state).forEach((center) => {
      drawDog(context, {
        x: center,
        y: PLAY_TOP_Y + lane.row * CELL_SIZE + CELL_SIZE / 2 - 3,
        breed: lane.breed,
        facing: lane.speed > 0 ? 1 : -1,
        phase: (state.elapsed * Math.abs(lane.speed)) / 32,
        alert: lane.row === Math.floor((state.cat.y - PLAY_TOP_Y) / CELL_SIZE) && Math.abs(center - state.cat.x) < 145,
      });
      if (debug) {
        context.strokeStyle = PALETTE.warning;
        context.strokeRect(
          center - profile.collisionWidth * 0.41,
          PLAY_TOP_Y + lane.row * CELL_SIZE + 10,
          profile.collisionWidth * 0.82,
          CELL_SIZE - 20,
        );
      }
    });
  });

  // 5. Hero Cat
  drawCat(context, {
    x: state.cat.x,
    y: state.cat.y,
    phase: state.cat.action === 'hop' ? 1 - state.cat.actionTime / 0.16 : state.elapsed,
    action: state.cat.action,
    direction: state.cat.direction,
    invulnerable: state.cat.invulnerable > 0,
  });

  // 6. INTEGRATED ARCADE TOP HUD BAR (Y: 0 to 52)
  renderTopHud(context, state, audioMuted);

  // 7. INTEGRATED ARCADE BOTTOM STATUS BAR (Y: 832 to 864)
  renderBottomBar(context, state);
}

function renderTopHud(context: CanvasRenderingContext2D, state: GameState, audioMuted: boolean): void {
  // Semi-translucent vector header backing
  context.fillStyle = 'rgba(4, 11, 8, 0.94)';
  context.fillRect(0, 0, BOARD_WIDTH, 52);

  wire(context, PALETTE.gridStrong, 1.2, 0.8);
  line(context, { x: 0, y: 52 }, { x: BOARD_WIDTH, y: 52 });

  // Neon corner accents
  wire(context, PALETTE.cat, 1.6, 0.85);
  polyline(context, [{ x: 10, y: 18 }, { x: 10, y: 8 }, { x: 26, y: 8 }]);
  polyline(context, [{ x: BOARD_WIDTH - 10, y: 18 }, { x: BOARD_WIDTH - 10, y: 8 }, { x: BOARD_WIDTH - 26, y: 8 }]);

  // Arcade Title / Brand
  context.font = 'bold 15px "Share Tech Mono", monospace';
  context.fillStyle = PALETTE.cat;
  context.textAlign = 'left';
  context.fillText('CATWALK', 32, 24);

  context.font = '10px "Share Tech Mono", monospace';
  context.fillStyle = PALETTE.catSoft;
  context.fillText('NIGHT PATROL', 32, 40);

  // Stats: SCORE
  context.font = '10px "Share Tech Mono", monospace';
  context.fillStyle = '#6c9b84';
  context.textAlign = 'center';
  context.fillText('SCORE', 180, 20);
  context.font = 'bold 17px "Share Tech Mono", monospace';
  context.fillStyle = '#dfffe9';
  context.fillText(String(state.score).padStart(5, '0'), 180, 40);

  // Stats: HI-SCORE
  context.font = '10px "Share Tech Mono", monospace';
  context.fillStyle = '#6c9b84';
  context.fillText('HI-SCORE', 290, 20);
  context.font = 'bold 17px "Share Tech Mono", monospace';
  context.fillStyle = PALETTE.cat;
  context.fillText(String(state.best).padStart(5, '0'), 290, 40);

  // Stats: ROUTE / LEVEL
  context.font = '10px "Share Tech Mono", monospace';
  context.fillStyle = '#6c9b84';
  context.fillText('ROUTE', 400, 20);
  context.font = 'bold 17px "Share Tech Mono", monospace';
  context.fillStyle = PALETTE.warning;
  context.fillText(`0${state.level}`.slice(-2), 400, 40);

  // Stats: HOMES SAFE
  const homesSaved = state.homes.filter(Boolean).length;
  context.font = '10px "Share Tech Mono", monospace';
  context.fillStyle = '#6c9b84';
  context.fillText('SAVED', 510, 20);
  context.font = 'bold 15px "Share Tech Mono", monospace';
  context.fillStyle = homesSaved === 5 ? PALETTE.cat : '#dfffe9';
  context.fillText(`${homesSaved} / 5`, 510, 40);

  // Stats: LIVES (Represented as cute vector cat silhouettes or tally pips)
  context.font = '10px "Share Tech Mono", monospace';
  context.fillStyle = '#6c9b84';
  context.fillText('LIVES', 610, 20);

  for (let i = 0; i < 6; i++) {
    const pipX = 582 + i * 11;
    const pipY = 32;
    if (i < state.lives) {
      wire(context, PALETTE.cat, 1.5, 1, 3);
      // Small cat ear icon
      polyline(context, [
        { x: pipX - 3.5, y: pipY + 6 },
        { x: pipX - 3.5, y: pipY - 1 },
        { x: pipX - 1.5, y: pipY - 5 },
        { x: pipX, y: pipY - 2 },
        { x: pipX + 1.5, y: pipY - 5 },
        { x: pipX + 3.5, y: pipY - 1 },
        { x: pipX + 3.5, y: pipY + 6 },
      ], true);
    } else {
      wire(context, PALETTE.homeDim, 1, 0.4);
      line(context, { x: pipX - 2, y: pipY + 6 }, { x: pipX + 2, y: pipY + 6 });
    }
  }

  // Audio Status indicator icon (top-right corner: X=690, Y=26)
  wire(context, audioMuted ? PALETTE.homeDim : PALETTE.water, 1.4);
  polyline(context, [
    { x: 686, y: 22 },
    { x: 690, y: 22 },
    { x: 695, y: 17 },
    { x: 695, y: 35 },
    { x: 690, y: 30 },
    { x: 686, y: 30 },
  ], true);
  if (!audioMuted) {
    // Sound soundwave arcs
    wire(context, PALETTE.water, 1.2, 0.85);
    context.beginPath();
    context.arc(696, 26, 4, -Math.PI * 0.3, Math.PI * 0.3);
    context.stroke();
    context.beginPath();
    context.arc(696, 26, 8, -Math.PI * 0.3, Math.PI * 0.3);
    context.stroke();
  } else {
    // Slash over muted speaker
    wire(context, PALETTE.dogCoral, 1.5);
    line(context, { x: 684, y: 17 }, { x: 700, y: 35 });
  }
}

function renderBottomBar(context: CanvasRenderingContext2D, state: GameState): void {
  const barY = 832;
  context.fillStyle = 'rgba(4, 11, 8, 0.94)';
  context.fillRect(0, barY, BOARD_WIDTH, 32);

  wire(context, PALETTE.gridStrong, 1.2, 0.8);
  line(context, { x: 0, y: barY }, { x: BOARD_WIDTH, y: barY });

  // Time progress bar calculation
  const maximumTime = Math.max(22, 58 - (state.level - 1) * 4.5);
  const remainingFraction = Math.max(0, Math.min(1, state.time / maximumTime));

  context.font = '11px "Share Tech Mono", monospace';
  context.fillStyle = remainingFraction < 0.25 ? PALETTE.warning : '#6c9b84';
  context.textAlign = 'left';
  context.fillText('TIME', 16, barY + 20);

  // Timer rail background
  const railX = 56;
  const railWidth = 460;
  const railY = barY + 12;
  const railH = 9;

  wire(context, PALETTE.homeDim, 1, 0.6);
  context.strokeRect(railX, railY, railWidth, railH);

  // Active timer bar with vector glow
  if (remainingFraction > 0) {
    const barWidth = railWidth * remainingFraction;
    const timerColor = remainingFraction < 0.25 ? PALETTE.warning : PALETTE.cat;
    context.fillStyle = timerColor;
    context.fillRect(railX + 1, railY + 1, barWidth - 2, railH - 2);

    wire(context, timerColor, 1.2, 0.9, 4);
    context.strokeRect(railX + 1, railY + 1, barWidth - 2, railH - 2);
  }

  // Right-side footer status readout
  context.font = '11px "Share Tech Mono", monospace';
  context.fillStyle = '#6c9b84';
  context.textAlign = 'right';
  context.fillText('CAT-01 / ACTIVE', BOARD_WIDTH - 16, barY + 20);
}
