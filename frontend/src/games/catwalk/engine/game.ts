import type { Direction, CatAction } from '../models/cat';
import type { DogBreed } from '../models/dogs';
import { DOG_PROFILES } from '../models/dogs';
import type { FishboneKind } from '../models/fishbones';
import { BOARD_WIDTH, CELL_SIZE, PLAY_TOP_Y } from '../models/environment';

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

export interface StageConfig {
  name: string;
  subtitle: string;
  roundTime: number;
  speedMultiplier: number;
  dogGaps: [number, number, number, number, number];
  fishboneLengths: [number, number, number, number, number];
  fishboneGaps: [number, number, number, number, number];
}

export const STAGES: Record<number, StageConfig> = {
  1: {
    name: 'Twilight Suburb',
    subtitle: 'Route 01: Low patrol speed, generous gaps & wide fishbone rafts',
    roundTime: 58,
    speedMultiplier: 1.0,
    dogGaps: [350, 370, 330, 360, 340],
    fishboneLengths: [230, 210, 250, 220, 200],
    fishboneGaps: [280, 270, 310, 275, 260],
  },
  2: {
    name: 'Midnight Alley',
    subtitle: 'Route 02: Paced hounds and quicker currents with dependable windows',
    roundTime: 52,
    speedMultiplier: 1.1,
    dogGaps: [330, 350, 310, 340, 320],
    fishboneLengths: [215, 195, 235, 205, 185],
    fishboneGaps: [290, 280, 320, 285, 270],
  },
  3: {
    name: 'Industrial Yards',
    subtitle: 'Route 03: Fast patrols and lean platforms test your rhythm',
    roundTime: 46,
    speedMultiplier: 1.2,
    dogGaps: [310, 330, 290, 320, 305],
    fishboneLengths: [195, 180, 215, 190, 170],
    fishboneGaps: [300, 290, 330, 295, 280],
  },
  4: {
    name: 'Docks & Canals',
    subtitle: 'Route 04: Swift canal rapids, agile shepherds, and concise jumps',
    roundTime: 40,
    speedMultiplier: 1.28,
    dogGaps: [295, 315, 280, 305, 290],
    fishboneLengths: [180, 165, 200, 175, 155],
    fishboneGaps: [310, 300, 340, 305, 290],
  },
  5: {
    name: 'City Expressway',
    subtitle: 'Route 05: Master patrol — fast pacing balanced by fair spacing',
    roundTime: 36,
    speedMultiplier: 1.36,
    dogGaps: [280, 300, 265, 290, 275],
    fishboneLengths: [170, 155, 185, 165, 145],
    fishboneGaps: [320, 310, 350, 315, 300],
  },
};

export function getStageConfig(level: number): StageConfig {
  if (level in STAGES) return STAGES[level];
  // Level 6+: smooth, asymptotic cap so it remains fair, never impossible
  const extra = Math.min(level - 5, 10);
  const base = STAGES[5];
  return {
    name: `Deep Sector ${level}`,
    subtitle: `Route 0${level}`.slice(-8) + ': Veteran patrol with disciplined pace',
    roundTime: Math.max(28, base.roundTime - extra * 0.8),
    speedMultiplier: Math.min(1.5, base.speedMultiplier + extra * 0.015),
    dogGaps: [
      Math.max(260, base.dogGaps[0] - extra * 2),
      Math.max(275, base.dogGaps[1] - extra * 2),
      Math.max(250, base.dogGaps[2] - extra * 2),
      Math.max(270, base.dogGaps[3] - extra * 2),
      Math.max(255, base.dogGaps[4] - extra * 2),
    ],
    fishboneLengths: [
      Math.max(150, base.fishboneLengths[0] - extra * 2),
      Math.max(135, base.fishboneLengths[1] - extra * 2),
      Math.max(165, base.fishboneLengths[2] - extra * 2),
      Math.max(145, base.fishboneLengths[3] - extra * 2),
      Math.max(125, base.fishboneLengths[4] - extra * 2),
    ],
    fishboneGaps: [
      Math.min(350, base.fishboneGaps[0] + extra * 3),
      Math.min(340, base.fishboneGaps[1] + extra * 3),
      Math.min(380, base.fishboneGaps[2] + extra * 3),
      Math.min(345, base.fishboneGaps[3] + extra * 3),
      Math.min(330, base.fishboneGaps[4] + extra * 3),
    ],
  };
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

export const BASE_DOG_LANES: DogLane[] = [
  { row: 7, speed: 60, gap: 350, offset: 30, breed: 'terrier' },
  { row: 8, speed: -70, gap: 370, offset: 175, breed: 'hound' },
  { row: 9, speed: 54, gap: 330, offset: 80, breed: 'bulldog' },
  { row: 10, speed: -66, gap: 360, offset: 250, breed: 'shepherd' },
  { row: 11, speed: 76, gap: 340, offset: 45, breed: 'terrier' },
];

export const BASE_FISHBONE_LANES: FishboneLane[] = [
  { row: 1, speed: 38, length: 230, gap: 280, offset: 20, kind: 'tuna' },
  { row: 2, speed: -46, length: 210, gap: 270, offset: 120, kind: 'salmon' },
  { row: 3, speed: 52, length: 250, gap: 310, offset: 185, kind: 'tuna' },
  { row: 4, speed: -42, length: 220, gap: 275, offset: 45, kind: 'salmon' },
  { row: 5, speed: 48, length: 200, gap: 260, offset: 130, kind: 'sardine' },
];

export function getDogLanesForStage(level: number): DogLane[] {
  const stage = getStageConfig(level);
  return BASE_DOG_LANES.map((lane, i) => ({
    ...lane,
    gap: stage.dogGaps[i],
    speed: lane.speed * stage.speedMultiplier,
  }));
}

export function getFishboneLanesForStage(level: number): FishboneLane[] {
  const stage = getStageConfig(level);
  return BASE_FISHBONE_LANES.map((lane, i) => ({
    ...lane,
    length: stage.fishboneLengths[i],
    gap: stage.fishboneGaps[i],
    speed: lane.speed * stage.speedMultiplier,
  }));
}

export const DOG_LANES = BASE_DOG_LANES;
export const FISHBONE_LANES = BASE_FISHBONE_LANES;

const STARTING_LIVES = 6;
const STARTING_INVULNERABILITY = 0.45;

export function positionsForLane(lane: MovingLane, state: GameState): number[] {
  const shift = lane.offset + state.elapsed * lane.speed;
  const first = (((shift % lane.gap) + lane.gap) % lane.gap) - lane.gap;
  const positions: number[] = [];
  for (let center = first; center < BOARD_WIDTH + lane.gap; center += lane.gap) positions.push(center);
  return positions;
}

export class CatwalkEngine {
  readonly state: GameState;
  private events: GameEventType[] = [];

  constructor(best = 0) {
    const stage = getStageConfig(1);
    this.state = {
      status: 'idle',
      score: 0,
      best,
      level: 1,
      lives: STARTING_LIVES,
      time: stage.roundTime,
      elapsed: 0,
      homes: [false, false, false, false, false],
      cat: this.freshCat(),
    };
  }

  start(): void {
    const stage = getStageConfig(1);
    Object.assign(this.state, {
      status: 'playing',
      score: 0,
      level: 1,
      lives: STARTING_LIVES,
      time: stage.roundTime,
      elapsed: 0,
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

    const minY = PLAY_TOP_Y + CELL_SIZE / 2;
    const maxY = PLAY_TOP_Y + 12 * CELL_SIZE + CELL_SIZE / 2;

    if (direction === 'up') this.state.cat.y = Math.max(minY, this.state.cat.y - CELL_SIZE);
    if (direction === 'down') this.state.cat.y = Math.min(maxY, this.state.cat.y + CELL_SIZE);
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

    const row = Math.floor((this.state.cat.y - PLAY_TOP_Y) / CELL_SIZE);
    if (row === 0) {
      this.reachHome();
      return;
    }

    const dogLanes = getDogLanesForStage(this.state.level);
    if (row >= 7 && row <= 11 && this.state.cat.invulnerable === 0) {
      const lane = dogLanes.find((candidate) => candidate.row === row);
      if (lane) {
        const collisionWidth = DOG_PROFILES[lane.breed].collisionWidth * 0.8;
        const caught = positionsForLane(lane, this.state).some(
          (center) => Math.abs(this.state.cat.x - center) < collisionWidth / 2 + 12,
        );
        if (caught) {
          this.loseLife('caught');
          return;
        }
      }
    }

    const fishboneLanes = getFishboneLanesForStage(this.state.level);
    if (row >= 1 && row <= 5) {
      const lane = fishboneLanes.find((candidate) => candidate.row === row);
      if (!lane) return;
      const platform = positionsForLane(lane, this.state).find(
        (center) => Math.abs(this.state.cat.x - center) < lane.length / 2 - 8,
      );
      if (platform === undefined) {
        if (this.state.cat.invulnerable === 0) this.loseLife('splash');
        return;
      }
      this.state.cat.action = 'ride';
      this.state.cat.x += lane.speed * delta;
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
      this.addScore(1000 + this.state.level * 250);
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
    this.state.time = getStageConfig(this.state.level).roundTime;
  }

  private freshCat(): CatState {
    return {
      x: BOARD_WIDTH / 2,
      y: PLAY_TOP_Y + 12 * CELL_SIZE + CELL_SIZE / 2,
      direction: 'up',
      action: 'idle',
      actionTime: 0,
      invulnerable: STARTING_INVULNERABILITY,
    };
  }

  private addScore(points: number): void {
    this.state.score += points;
    this.state.best = Math.max(this.state.best, this.state.score);
  }
}
