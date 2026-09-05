import type { Direction, CatAction } from '../models/cat';
import type { DogBreed } from '../models/dogs';
import { DOG_PROFILES } from '../models/dogs';
import type { FishboneKind } from '../models/fishbones';
import { BOARD_WIDTH, CELL_SIZE } from '../models/environment';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'defeat';
export type GameEventType = 'step' | 'caught' | 'splash' | 'home' | 'level' | 'start' | 'pause' | 'resume' | 'defeat';

interface MovingLane {
  row: number;
  speed: number;
  gap: number;
  offset: number;
}

export interface DogLane extends MovingLane {
  breed: DogBreed;
}

export interface FishboneLane extends MovingLane {
  length: number;
  kind: FishboneKind;
}

export interface CatState {
  x: number;
  y: number;
  direction: Direction;
  action: CatAction;
  actionTime: number;
  invulnerable: number;
}

export interface GameState {
  status: GameStatus;
  score: number;
  best: number;
  level: number;
  lives: number;
  time: number;
  elapsed: number;
  homes: boolean[];
  cat: CatState;
}

export const HOME_POSITIONS = [72, 216, 360, 504, 648];

export const DOG_LANES: DogLane[] = [
  { row: 7, speed: 62, gap: 330, offset: 30, breed: 'terrier' },
  { row: 8, speed: -72, gap: 360, offset: 175, breed: 'hound' },
  { row: 9, speed: 56, gap: 310, offset: 80, breed: 'bulldog' },
  { row: 10, speed: -68, gap: 350, offset: 250, breed: 'shepherd' },
  { row: 11, speed: 78, gap: 325, offset: 45, breed: 'terrier' },
];

export const FISHBONE_LANES: FishboneLane[] = [
  { row: 1, speed: 40, length: 220, gap: 285, offset: 20, kind: 'tuna' },
  { row: 2, speed: -48, length: 195, gap: 270, offset: 120, kind: 'salmon' },
  { row: 3, speed: 54, length: 245, gap: 320, offset: 185, kind: 'tuna' },
  { row: 4, speed: -43, length: 210, gap: 280, offset: 45, kind: 'salmon' },
  { row: 5, speed: 50, length: 190, gap: 265, offset: 130, kind: 'sardine' },
];

const roundTime = (level: number): number => Math.max(28, 48 - level * 2);
const speedScale = (level: number): number => 1 + Math.min(level - 1, 8) * 0.075;

export function positionsForLane(lane: MovingLane, state: GameState): number[] {
  const shift = lane.offset + state.elapsed * lane.speed * speedScale(state.level);
  const first = ((shift % lane.gap) + lane.gap) % lane.gap - lane.gap;
  const positions: number[] = [];
  for (let center = first; center < BOARD_WIDTH + lane.gap; center += lane.gap) positions.push(center);
  return positions;
}

export class CatwalkEngine {
  readonly state: GameState;
  private events: GameEventType[] = [];

  constructor(best = 0) {
    this.state = {
      status: 'idle',
      score: 0,
      best,
      level: 1,
      lives: 5,
      time: roundTime(1),
      elapsed: 0,
      homes: [false, false, false, false, false],
      cat: this.freshCat(),
    };
  }

  start(): void {
    Object.assign(this.state, {
      status: 'playing', score: 0, level: 1, lives: 5, time: roundTime(1), elapsed: 0,
    });
    this.state.homes.fill(false);
    this.state.cat = this.freshCat();
    this.events.push('start');
  }

  pause(): void {
    if (this.state.status !== 'playing') return;
    this.state.status = 'paused';
    this.events.push('pause');
  }

  resume(): void {
    if (this.state.status !== 'paused') return;
    this.state.status = 'playing';
    this.events.push('resume');
  }

  togglePause(): void {
    if (this.state.status === 'playing') this.pause();
    else if (this.state.status === 'paused') this.resume();
  }

  move(direction: Direction): void {
    if (this.state.status !== 'playing' || this.state.cat.actionTime > 0.06) return;
    const previousY = this.state.cat.y;
    this.state.cat.direction = direction;
    this.state.cat.action = 'hop';
    this.state.cat.actionTime = 0.16;
    if (direction === 'up') this.state.cat.y = Math.max(CELL_SIZE / 2, this.state.cat.y - CELL_SIZE);
    if (direction === 'down') this.state.cat.y = Math.min(12 * CELL_SIZE + CELL_SIZE / 2, this.state.cat.y + CELL_SIZE);
    if (direction === 'left') this.state.cat.x = Math.max(CELL_SIZE / 2, this.state.cat.x - CELL_SIZE);
    if (direction === 'right') this.state.cat.x = Math.min(BOARD_WIDTH - CELL_SIZE / 2, this.state.cat.x + CELL_SIZE);
    if (this.state.cat.y < previousY) this.addScore(10);
    this.events.push('step');
  }

  update(delta: number): void {
    if (this.state.status !== 'playing') return;
    this.state.elapsed += delta;
    this.state.time -= delta;
    this.state.cat.actionTime = Math.max(0, this.state.cat.actionTime - delta);
    this.state.cat.invulnerable = Math.max(0, this.state.cat.invulnerable - delta);
    if (this.state.cat.actionTime === 0) this.state.cat.action = 'idle';
    if (this.state.time <= 0) {
      this.loseLife('splash');
      return;
    }

    const row = Math.floor(this.state.cat.y / CELL_SIZE);
    if (row === 0) {
      this.reachHome();
      return;
    }

    if (row >= 7 && row <= 11 && this.state.cat.invulnerable === 0) {
      const lane = DOG_LANES.find((candidate) => candidate.row === row);
      if (lane) {
        const collisionWidth = DOG_PROFILES[lane.breed].collisionWidth * 0.82;
        const caught = positionsForLane(lane, this.state).some((center) => Math.abs(this.state.cat.x - center) < collisionWidth / 2 + 12);
        if (caught) {
          this.loseLife('caught');
          return;
        }
      }
    }

    if (row >= 1 && row <= 5) {
      const lane = FISHBONE_LANES.find((candidate) => candidate.row === row);
      if (!lane) return;
      const platform = positionsForLane(lane, this.state).find((center) => Math.abs(this.state.cat.x - center) < lane.length / 2 - 8);
      if (platform === undefined) {
        if (this.state.cat.invulnerable === 0) this.loseLife('splash');
        return;
      }
      this.state.cat.action = 'ride';
      this.state.cat.x += lane.speed * speedScale(this.state.level) * delta;
      if (this.state.cat.x < 12 || this.state.cat.x > BOARD_WIDTH - 12) this.loseLife('splash');
    }
  }

  drainEvents(): GameEventType[] {
    return this.events.splice(0);
  }

  private reachHome(): void {
    const homeIndex = HOME_POSITIONS.findIndex((homeX) => Math.abs(this.state.cat.x - homeX) < 35);
    if (homeIndex < 0 || this.state.homes[homeIndex]) {
      this.loseLife('splash');
      return;
    }
    this.state.homes[homeIndex] = true;
    this.addScore(500 + Math.ceil(this.state.time) * 10);
    this.events.push('home');
    if (this.state.homes.every(Boolean)) {
      this.state.level += 1;
      this.addScore(1000);
      this.state.homes.fill(false);
      this.events.push('level');
    }
    this.resetCat();
  }

  private loseLife(event: 'caught' | 'splash'): void {
    this.state.lives -= 1;
    this.events.push(event);
    if (this.state.lives <= 0) {
      this.state.status = 'defeat';
      this.events.push('defeat');
      return;
    }
    this.resetCat();
  }

  private resetCat(): void {
    this.state.cat = this.freshCat();
    this.state.time = roundTime(this.state.level);
  }

  private freshCat(): CatState {
    return {
      x: BOARD_WIDTH / 2,
      y: 12 * CELL_SIZE + CELL_SIZE / 2,
      direction: 'up',
      action: 'idle',
      actionTime: 0,
      invulnerable: 1.2,
    };
  }

  private addScore(points: number): void {
    this.state.score += points;
    this.state.best = Math.max(this.state.best, this.state.score);
  }
}