import { drawCat } from '../models/cat';
import { drawDog, DOG_PROFILES } from '../models/dogs';
import { drawEnvironment, BOARD_HEIGHT, BOARD_WIDTH, CELL_SIZE } from '../models/environment';
import { drawFishbone } from '../models/fishbones';
import { drawHouse } from '../models/houses';
import { DOG_LANES, FISHBONE_LANES, HOME_POSITIONS, positionsForLane, type GameState } from '../engine/game';
import { PALETTE } from './palette';
import { line, wire } from './primitives';

export function renderGame(context: CanvasRenderingContext2D, state: GameState, debug = false): void {
  drawEnvironment(context, state.elapsed);

  HOME_POSITIONS.forEach((homeX, index) => {
    drawHouse(context, { x: homeX, y: 31, index, occupied: state.homes[index], phase: state.elapsed });
  });

  FISHBONE_LANES.forEach((lane) => {
    positionsForLane(lane, state).forEach((center) => {
      drawFishbone(context, {
        x: center,
        y: lane.row * CELL_SIZE + CELL_SIZE / 2,
        length: lane.length,
        facing: lane.speed > 0 ? 1 : -1,
        phase: state.elapsed + lane.row * 0.2,
        kind: lane.kind,
      });
      if (debug) {
        context.strokeStyle = PALETTE.warning;
        context.strokeRect(center - lane.length / 2 + 8, lane.row * CELL_SIZE + 14, lane.length - 16, CELL_SIZE - 28);
      }
    });
  });

  DOG_LANES.forEach((lane) => {
    const profile = DOG_PROFILES[lane.breed];
    positionsForLane(lane, state).forEach((center) => {
      drawDog(context, {
        x: center,
        y: lane.row * CELL_SIZE + CELL_SIZE / 2 - 3,
        breed: lane.breed,
        facing: lane.speed > 0 ? 1 : -1,
        phase: state.elapsed * Math.abs(lane.speed) / 32,
        alert: lane.row === Math.floor(state.cat.y / CELL_SIZE) && Math.abs(center - state.cat.x) < 145,
      });
      if (debug) {
        context.strokeStyle = PALETTE.warning;
        context.strokeRect(center - profile.collisionWidth * 0.41, lane.row * CELL_SIZE + 10, profile.collisionWidth * 0.82, CELL_SIZE - 20);
      }
    });
  });

  drawCat(context, {
    x: state.cat.x,
    y: state.cat.y,
    phase: state.cat.action === 'hop' ? 1 - state.cat.actionTime / 0.16 : state.elapsed,
    action: state.cat.action,
    direction: state.cat.direction,
    invulnerable: state.cat.invulnerable > 0,
  });

  const maximumTime = Math.max(28, 48 - state.level * 2);
  const remaining = Math.max(0, state.time / maximumTime);
  wire(context, remaining < 0.25 ? PALETTE.warning : PALETTE.cat, 2);
  line(context, { x: 20, y: BOARD_HEIGHT - 14 }, { x: 20 + (BOARD_WIDTH - 40) * remaining, y: BOARD_HEIGHT - 14 });
  wire(context, PALETTE.homeDim, 1);
  line(context, { x: 20, y: BOARD_HEIGHT - 10 }, { x: BOARD_WIDTH - 20, y: BOARD_HEIGHT - 10 });
}