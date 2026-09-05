import { drawCat } from '../models/cat';
import { drawDog, DOG_PROFILES } from '../models/dogs';
import { drawEnvironment, BOARD_HEIGHT, BOARD_WIDTH, CELL_SIZE, PLAY_TOP_Y, PLAY_BOTTOM_Y } from '../models/environment';
import { drawFishbone } from '../models/fishbones';
import { drawHouse } from '../models/houses';
import {
  getDogLanesForStage,
  getFishboneLanesForStage,
  getStageConfig,
  HOME_POSITIONS,
  positionsForLane,
  type GameState,
} from '../engine/game';
import { PALETTE } from './palette';
import type { ParticleSystem } from './particles';
import { circle, line, polyline, resetGlow, wire } from './primitives';

export function renderGame(
  context: CanvasRenderingContext2D,
  state: GameState,
  audioMuted = true,
  debug = false,
  hoveredControl: 'sound' | 'pause' | null = null,
  particles?: ParticleSystem,
): void {
  // 1. World environment
  drawEnvironment(context, state.elapsed);

  // 2. Sanctuary Houses (Goals)
  HOME_POSITIONS.forEach((homeX, index) => {
    drawHouse(context, { x: homeX, y: PLAY_TOP_Y + 31, index, occupied: state.homes[index], phase: state.elapsed });
  });

  // 3. Fishbone River Platforms (Scaled dynamically per stage)
  const fishboneLanes = getFishboneLanesForStage(state.level);
  fishboneLanes.forEach((lane) => {
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

  // 4. Patrol Dogs (Street Hazards - Scaled dynamically per stage)
  const dogLanes = getDogLanesForStage(state.level);
  dogLanes.forEach((lane) => {
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

  // 6. Vector Particle Effects (Sparks, splashes, celebration fireworks)
  particles?.render(context);

  // 7. INTEGRATED ARCADE TOP HUD BAR (Y: 0 to 52)
  renderTopHud(context, state, audioMuted, hoveredControl);

  // 8. INTEGRATED ARCADE BOTTOM STATUS BAR (Y: 832 to 864)
  renderBottomBar(context, state);
}


function renderTopHud(
  context: CanvasRenderingContext2D,
  state: GameState,
  audioMuted: boolean,
  hoveredControl: 'sound' | 'pause' | null,
): void {
  // Always reset glow before drawing UI elements so nothing is accidentally smudged
  resetGlow(context);

  // Backdrop cockpit panel with solid crisp gradient
  const bgGradient = context.createLinearGradient(0, 0, 0, 52);
  bgGradient.addColorStop(0, '#07150e');
  bgGradient.addColorStop(0.75, '#040d09');
  bgGradient.addColorStop(1, '#020704');
  context.fillStyle = bgGradient;
  context.fillRect(0, 0, BOARD_WIDTH, 52);

  // Bottom double separation line (crisp 1px lines on integer coordinates)
  wire(context, PALETTE.gridStrong, 1.2, 0.9);
  line(context, { x: 0, y: 51.5 }, { x: BOARD_WIDTH, y: 51.5 });
  wire(context, '#102e20', 1.0, 0.6);
  line(context, { x: 0, y: 48.5 }, { x: BOARD_WIDTH, y: 48.5 });

  // Neon corner bezel brackets
  wire(context, PALETTE.cat, 1.6, 0.85);
  polyline(context, [{ x: 8, y: 18 }, { x: 8, y: 8 }, { x: 20, y: 8 }]);
  polyline(context, [{ x: BOARD_WIDTH - 8, y: 18 }, { x: BOARD_WIDTH - 8, y: 8 }, { x: BOARD_WIDTH - 20, y: 8 }]);

  // Divider helper
  const drawDivider = (x: number) => {
    wire(context, '#163828', 1, 0.7);
    line(context, { x: x + 0.5, y: 10 }, { x: x + 0.5, y: 42 });
    wire(context, '#2c6d4e', 1.5, 0.95);
    line(context, { x: x + 0.5, y: 24 }, { x: x + 0.5, y: 28 }); // Center phosphor notch
  };

  // ========================================================
  // SECTION 1: CRISP VECTOR LOGO & EMBLEM (x: 10 .. 136)
  // ========================================================
  // Geometric faceted feline crest (razor sharp lines, NO blur)
  const emblemX = 26;
  const emblemY = 25;

  // Outer shield badge
  wire(context, '#1d4834', 1.0, 0.8);
  polyline(context, [
    { x: emblemX - 12, y: emblemY - 10 },
    { x: emblemX + 12, y: emblemY - 10 },
    { x: emblemX + 12, y: emblemY + 5 },
    { x: emblemX, y: emblemY + 13 },
    { x: emblemX - 12, y: emblemY + 5 },
  ], true);

  // Sharp vector cat face inside
  wire(context, PALETTE.cat, 1.5, 1);
  polyline(context, [
    { x: emblemX - 8, y: emblemY + 4 },
    { x: emblemX - 8, y: emblemY - 3 },
    { x: emblemX - 4, y: emblemY - 9 }, // Left ear tip
    { x: emblemX, y: emblemY - 4 }, // Crown
    { x: emblemX + 4, y: emblemY - 9 }, // Right ear tip
    { x: emblemX + 8, y: emblemY - 3 },
    { x: emblemX + 8, y: emblemY + 4 },
    { x: emblemX, y: emblemY + 8 },
  ], true);

  // Luminous cat eye pips
  wire(context, PALETTE.catGlow, 1.4, 1);
  circle(context, { x: emblemX - 3.2, y: emblemY }, 1.0);
  circle(context, { x: emblemX + 3.2, y: emblemY }, 1.0);

  // RAZOR SHARP LOGO TYPOGRAPHY (NO shadow blur!)
  resetGlow(context);
  context.font = 'bold 15px "Share Tech Mono", Consolas, monospace';
  context.fillStyle = PALETTE.cat;
  context.textAlign = 'left';
  context.fillText('CATWALK', 44, 25);

  context.font = 'bold 9.5px "Share Tech Mono", Consolas, monospace';
  context.fillStyle = '#6ee7a8'; // Clean high-contrast emerald green
  context.fillText('// NIGHT PATROL', 44, 38);

  drawDivider(136);

  // ========================================================
  // SECTION 2: 1P SCORE (x: 136 .. 234, Center: 185)
  // ========================================================
  resetGlow(context);
  context.font = '9px "Share Tech Mono", Consolas, monospace';
  context.fillStyle = '#78a890';
  context.textAlign = 'center';
  context.fillText('1P SCORE', 185, 18);

  context.font = 'bold 17px "Share Tech Mono", Consolas, monospace';
  context.fillStyle = '#e8ffef';
  context.fillText(String(state.score).padStart(5, '0'), 185, 38);

  wire(context, '#1b4532', 1, 0.7);
  polyline(context, [
    { x: 156, y: 41 },
    { x: 156, y: 44 },
    { x: 214, y: 44 },
    { x: 214, y: 41 },
  ]);

  drawDivider(234);

  // ========================================================
  // SECTION 3: HI-SCORE RECORD (x: 234 .. 334, Center: 284)
  // ========================================================
  resetGlow(context);
  context.font = '9px "Share Tech Mono", Consolas, monospace';
  context.fillStyle = '#caa652';
  context.textAlign = 'center';
  context.fillText('★ HI-SCORE', 284, 18);

  context.font = 'bold 17px "Share Tech Mono", Consolas, monospace';
  context.fillStyle = PALETTE.warning;
  context.fillText(String(state.best).padStart(5, '0'), 284, 38);

  wire(context, '#5c4618', 1, 0.7);
  polyline(context, [
    { x: 256, y: 41 },
    { x: 256, y: 44 },
    { x: 312, y: 44 },
    { x: 312, y: 41 },
  ]);

  drawDivider(334);

  // ========================================================
  // SECTION 4: ROUTE / SECTOR BADGE (x: 334 .. 416, Center: 375)
  // ========================================================
  resetGlow(context);
  context.font = '9px "Share Tech Mono", Consolas, monospace';
  context.fillStyle = '#78a890';
  context.textAlign = 'center';
  context.fillText('ROUTE', 375, 18);

  // Chamfered sector badge
  wire(context, '#276345', 1.3, 0.9);
  polyline(context, [
    { x: 358, y: 27 },
    { x: 361, y: 24 },
    { x: 389, y: 24 },
    { x: 392, y: 27 },
    { x: 392, y: 39 },
    { x: 389, y: 42 },
    { x: 361, y: 42 },
    { x: 358, y: 39 },
  ], true);

  resetGlow(context);
  context.font = 'bold 14px "Share Tech Mono", Consolas, monospace';
  context.fillStyle = PALETTE.catGlow;
  context.textAlign = 'center';
  context.fillText(`0${state.level}`.slice(-2), 375, 37);

  drawDivider(416);

  // ========================================================
  // SECTION 5: SANCTUARY HOUSES / SAVED (x: 416 .. 536, Center: 476)
  // ========================================================
  const savedCount = state.homes.filter(Boolean).length;
  resetGlow(context);
  context.font = '9px "Share Tech Mono", Consolas, monospace';
  context.fillStyle = '#78a890';
  context.textAlign = 'center';
  context.fillText(`SANCTUARY [${savedCount}/5]`, 476, 18);

  // 5 Mini Illuminated Sanctuary House Glyphs
  for (let i = 0; i < 5; i++) {
    const hx = 436 + i * 20;
    const hy = 32;
    const isOccupied = state.homes[i];

    if (isOccupied) {
      wire(context, PALETTE.cat, 1.5, 1, 3);
      polyline(context, [{ x: hx - 6, y: hy - 1 }, { x: hx, y: hy - 7 }, { x: hx + 6, y: hy - 1 }]);
      polyline(context, [{ x: hx - 5, y: hy - 1 }, { x: hx - 5, y: hy + 6 }, { x: hx + 5, y: hy + 6 }, { x: hx + 5, y: hy - 1 }]);
      circle(context, { x: hx, y: hy + 2 }, 2);
    } else {
      wire(context, '#1e4432', 1, 0.7);
      polyline(context, [{ x: hx - 6, y: hy - 1 }, { x: hx, y: hy - 7 }, { x: hx + 6, y: hy - 1 }]);
      polyline(context, [{ x: hx - 5, y: hy - 1 }, { x: hx - 5, y: hy + 6 }, { x: hx + 5, y: hy + 6 }, { x: hx + 5, y: hy - 1 }]);
      wire(context, '#142c20', 0.8, 0.6);
      line(context, { x: hx - 2, y: hy + 6 }, { x: hx - 2, y: hy + 3 });
      line(context, { x: hx + 2, y: hy + 6 }, { x: hx + 2, y: hy + 3 });
      line(context, { x: hx - 2, y: hy + 3 }, { x: hx + 2, y: hy + 3 });
    }
  }

  drawDivider(536);

  // ========================================================
  // SECTION 6: LIVES TALLY (x: 536 .. 636, Center: 586)
  // ========================================================
  resetGlow(context);
  context.font = '9px "Share Tech Mono", Consolas, monospace';
  context.fillStyle = '#78a890';
  context.textAlign = 'center';
  context.fillText('LIVES', 586, 18);

  for (let i = 0; i < 6; i++) {
    const lx = 551 + i * 14;
    const ly = 32;

    if (i < state.lives) {
      wire(context, PALETTE.cat, 1.4, 1, 2);
      polyline(context, [
        { x: lx - 4, y: ly + 5 },
        { x: lx - 4, y: ly - 1 },
        { x: lx - 4, y: ly - 6 },
        { x: lx - 1, y: ly - 2 },
        { x: lx + 1, y: ly - 2 },
        { x: lx + 4, y: ly - 6 },
        { x: lx + 4, y: ly - 1 },
        { x: lx + 4, y: ly + 5 },
      ], true);
      wire(context, PALETTE.catGlow, 1.2, 1);
      line(context, { x: lx - 2.5, y: ly + 1 }, { x: lx - 1, y: ly + 1 });
      line(context, { x: lx + 1, y: ly + 1 }, { x: lx + 2.5, y: ly + 1 });
    } else {
      wire(context, '#1c3e2b', 1, 0.5);
      line(context, { x: lx - 2.5, y: ly - 2.5 }, { x: lx + 2.5, y: ly + 2.5 });
      line(context, { x: lx + 2.5, y: ly - 2.5 }, { x: lx - 2.5, y: ly + 2.5 });
    }
  }

  drawDivider(636);

  // ========================================================
  // SECTION 7: INTERACTIVE ON-CANVAS VECTOR CONTROLS (x: 636 .. 712)
  // ========================================================
  const isSoundHovered = hoveredControl === 'sound';
  wire(
    context,
    isSoundHovered ? PALETTE.water : '#204a36',
    isSoundHovered ? 1.6 : 1.2,
    isSoundHovered ? 1 : 0.85,
    isSoundHovered ? 4 : 0,
  );
  if (isSoundHovered) {
    context.fillStyle = 'rgba(63, 224, 245, 0.09)';
    context.fillRect(644, 11, 30, 30);
  }
  polyline(context, [
    { x: 644, y: 15 },
    { x: 648, y: 11 },
    { x: 670, y: 11 },
    { x: 674, y: 15 },
    { x: 674, y: 37 },
    { x: 670, y: 41 },
    { x: 648, y: 41 },
    { x: 644, y: 37 },
  ], true);

  wire(context, audioMuted ? PALETTE.homeDim : isSoundHovered ? PALETTE.water : '#a2e8f5', 1.4);
  polyline(context, [
    { x: 652, y: 23 },
    { x: 655, y: 23 },
    { x: 659, y: 18 },
    { x: 659, y: 34 },
    { x: 655, y: 29 },
    { x: 652, y: 29 },
  ], true);

  if (!audioMuted) {
    wire(context, isSoundHovered ? PALETTE.water : '#3fe0f5', 1.3, 0.95);
    context.beginPath();
    context.arc(660, 26, 4, -Math.PI * 0.35, Math.PI * 0.35);
    context.stroke();
    context.beginPath();
    context.arc(660, 26, 8, -Math.PI * 0.35, Math.PI * 0.35);
    context.stroke();
  } else {
    wire(context, PALETTE.dogCoral, 1.8, 1);
    line(context, { x: 650, y: 17 }, { x: 668, y: 35 });
  }

  const isPauseHovered = hoveredControl === 'pause';
  wire(
    context,
    isPauseHovered ? PALETTE.cat : '#204a36',
    isPauseHovered ? 1.6 : 1.2,
    isPauseHovered ? 1 : 0.85,
    isPauseHovered ? 4 : 0,
  );
  if (isPauseHovered) {
    context.fillStyle = 'rgba(77, 250, 139, 0.09)';
    context.fillRect(680, 11, 30, 30);
  }
  polyline(context, [
    { x: 680, y: 15 },
    { x: 684, y: 11 },
    { x: 706, y: 11 },
    { x: 710, y: 15 },
    { x: 710, y: 37 },
    { x: 706, y: 41 },
    { x: 684, y: 41 },
    { x: 680, y: 37 },
  ], true);

  if (state.status === 'paused') {
    wire(context, PALETTE.warning, 1.5, 1);
    polyline(context, [
      { x: 691, y: 20 },
      { x: 700, y: 26 },
      { x: 691, y: 32 },
    ], true);
  } else {
    wire(context, isPauseHovered ? PALETTE.cat : '#a2e8c2', 2, 0.95);
    line(context, { x: 692, y: 20 }, { x: 692, y: 32 });
    line(context, { x: 697, y: 20 }, { x: 697, y: 32 });
  }

  resetGlow(context);
}

function renderBottomBar(context: CanvasRenderingContext2D, state: GameState): void {
  resetGlow(context);
  const barY = 832;
  const stage = getStageConfig(state.level);

  context.fillStyle = 'rgba(4, 11, 8, 0.96)';
  context.fillRect(0, barY, BOARD_WIDTH, 32);

  wire(context, PALETTE.gridStrong, 1.2, 0.8);
  line(context, { x: 0, y: barY + 0.5 }, { x: BOARD_WIDTH, y: barY + 0.5 });

  // Time progress bar calculation
  const maximumTime = stage.roundTime;
  const remainingFraction = Math.max(0, Math.min(1, state.time / maximumTime));

  resetGlow(context);
  context.font = 'bold 11px "Share Tech Mono", Consolas, monospace';
  context.fillStyle = remainingFraction < 0.25 ? PALETTE.warning : '#78a890';
  context.textAlign = 'left';
  context.fillText('TIME', 16, barY + 20);

  // Timer rail background
  const railX = 52;
  const railWidth = 420;
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

    wire(context, timerColor, 1.2, 0.9, 3);
    context.strokeRect(railX + 1, railY + 1, barWidth - 2, railH - 2);
  }

  // Right-side stage name & status readout (crisp text, no blur)
  resetGlow(context);
  context.font = 'bold 11px "Share Tech Mono", Consolas, monospace';
  context.fillStyle = '#78a890';
  context.textAlign = 'right';
  context.fillText(`${stage.name.toUpperCase()} // ACTIVE`, BOARD_WIDTH - 16, barY + 20);
}
