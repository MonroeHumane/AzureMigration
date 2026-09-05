import { PALETTE } from '../rendering/palette';
import { circle, curve, ellipse, jointedLimb, line, polyline, wire, withTransform } from '../rendering/primitives';

export type CatAction = 'idle' | 'hop' | 'ride' | 'hit' | 'home';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface CatPose {
  x: number;
  y: number;
  phase: number;
  action: CatAction;
  direction: Direction;
  invulnerable?: boolean;
}

const directionRotation: Record<Direction, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

export function drawCat(context: CanvasRenderingContext2D, pose: CatPose): void {
  const blink = pose.invulnerable && Math.floor(pose.phase * 9) % 2 === 0;
  const hopLift = pose.action === 'hop' ? Math.sin(Math.min(1, pose.phase % 1) * Math.PI) * 5 : 0;
  const breathing = pose.action === 'idle' ? Math.sin(pose.phase * 2.2) * 0.8 : 0;
  const stride = pose.action === 'hop' ? Math.sin(pose.phase * Math.PI * 2) * 5 : 0;
  const tailWave = Math.sin(pose.phase * 3.1) * 5;

  withTransform(context, { x: pose.x, y: pose.y - hopLift }, directionRotation[pose.direction], 1, 1, () => {
    wire(context, PALETTE.cat, 2.4, blink ? 0.3 : 1);

    ellipse(context, { x: 0, y: 5 }, 12.5 + breathing * 0.2, 17 + breathing);
    ellipse(context, { x: 0, y: -13 }, 13, 10.5);
    polyline(context, [{ x: -11, y: -18 }, { x: -10, y: -29 }, { x: -2, y: -22 }]);
    polyline(context, [{ x: 11, y: -18 }, { x: 10, y: -29 }, { x: 2, y: -22 }]);

    line(context, { x: -7, y: -14 }, { x: -3, y: -14 });
    line(context, { x: 7, y: -14 }, { x: 3, y: -14 });
    polyline(context, [{ x: -3, y: -8 }, { x: 0, y: -5 }, { x: 3, y: -8 }]);
    line(context, { x: -5, y: -6 }, { x: -18, y: -9 });
    line(context, { x: 5, y: -6 }, { x: 18, y: -9 });
    line(context, { x: -5, y: -3 }, { x: -18, y: 0 });
    line(context, { x: 5, y: -3 }, { x: 18, y: 0 });

    jointedLimb(context, { x: -8, y: 0 }, { x: -14 - stride * 0.3, y: 8 }, { x: -14 - stride, y: 17 });
    jointedLimb(context, { x: 8, y: 0 }, { x: 14 + stride * 0.3, y: 8 }, { x: 14 + stride, y: 17 });
    jointedLimb(context, { x: -8, y: 12 }, { x: -12 + stride * 0.25, y: 19 }, { x: -10 + stride, y: 25 });
    jointedLimb(context, { x: 8, y: 12 }, { x: 12 - stride * 0.25, y: 19 }, { x: 10 - stride, y: 25 });

    curve(
      context,
      { x: 8, y: 14 },
      { x: 26, y: 19 },
      { x: 26 + tailWave, y: -2 },
      { x: 18 + tailWave, y: -8 },
    );
    circle(context, { x: 0, y: 4 }, 2.2);
  });
}