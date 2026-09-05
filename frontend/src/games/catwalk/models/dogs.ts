import { PALETTE } from '../rendering/palette';
import { circle, curve, ellipse, jointedLimb, line, polyline, wire, withTransform } from '../rendering/primitives';

export type DogBreed = 'terrier' | 'hound' | 'shepherd' | 'bulldog';

export interface DogProfile {
  breed: DogBreed;
  bodyLength: number;
  bodyHeight: number;
  headRadius: number;
  legLength: number;
  collisionWidth: number;
  color: string;
  ear: 'point' | 'flop' | 'rose';
}

export const DOG_PROFILES: Record<DogBreed, DogProfile> = {
  terrier: { breed: 'terrier', bodyLength: 48, bodyHeight: 22, headRadius: 12, legLength: 17, collisionWidth: 66, color: PALETTE.dogAmber, ear: 'point' },
  hound: { breed: 'hound', bodyLength: 68, bodyHeight: 20, headRadius: 13, legLength: 15, collisionWidth: 88, color: PALETTE.dogRose, ear: 'flop' },
  shepherd: { breed: 'shepherd', bodyLength: 58, bodyHeight: 25, headRadius: 14, legLength: 19, collisionWidth: 78, color: PALETTE.dogCoral, ear: 'point' },
  bulldog: { breed: 'bulldog', bodyLength: 50, bodyHeight: 29, headRadius: 16, legLength: 11, collisionWidth: 72, color: PALETTE.dogAmber, ear: 'rose' },
};

export interface DogPose {
  x: number;
  y: number;
  breed: DogBreed;
  facing: 1 | -1;
  phase: number;
  alert?: boolean;
}

function drawEars(context: CanvasRenderingContext2D, profile: DogProfile, headX: number, headY: number): void {
  if (profile.ear === 'point') {
    polyline(context, [{ x: headX - 8, y: headY - 8 }, { x: headX - 6, y: headY - 22 }, { x: headX + 1, y: headY - 10 }]);
    polyline(context, [{ x: headX + 4, y: headY - 10 }, { x: headX + 10, y: headY - 20 }, { x: headX + 11, y: headY - 5 }]);
  } else if (profile.ear === 'flop') {
    curve(context, { x: headX - 6, y: headY - 5 }, { x: headX - 16, y: headY }, { x: headX - 13, y: headY + 15 }, { x: headX - 5, y: headY + 10 });
  } else {
    polyline(context, [{ x: headX - 8, y: headY - 5 }, { x: headX - 13, y: headY + 2 }, { x: headX - 5, y: headY + 1 }]);
    polyline(context, [{ x: headX + 4, y: headY - 7 }, { x: headX + 10, y: headY }, { x: headX + 3, y: headY + 1 }]);
  }
}

export function drawDog(context: CanvasRenderingContext2D, pose: DogPose): void {
  const profile = DOG_PROFILES[pose.breed];
  const gait = Math.sin(pose.phase * Math.PI * 2);
  const bodyLift = Math.abs(Math.cos(pose.phase * Math.PI * 2)) * 1.3;
  const halfBody = profile.bodyLength / 2;
  const headX = halfBody + profile.headRadius * 0.72;
  const headY = -profile.bodyHeight * 0.15;

  withTransform(context, { x: pose.x, y: pose.y - bodyLift }, 0, pose.facing, 1, () => {
    wire(context, profile.color, 2.2);
    ellipse(context, { x: 0, y: 0 }, halfBody, profile.bodyHeight / 2);
    circle(context, { x: headX, y: headY }, profile.headRadius);
    ellipse(context, { x: headX + profile.headRadius * 0.82, y: headY + 2 }, profile.headRadius * 0.55, profile.headRadius * 0.38);
    drawEars(context, profile, headX, headY);

    circle(context, { x: headX + 4, y: headY - 3 }, 1.8);
    circle(context, { x: headX + profile.headRadius * 1.25, y: headY }, 1.8);
    curve(context, { x: -halfBody + 3, y: -4 }, { x: -halfBody - 12, y: -16 }, { x: -halfBody - 18, y: -2 }, { x: -halfBody - 12, y: 5 });

    const legY = profile.bodyHeight * 0.34;
    const pawY = legY + profile.legLength;
    jointedLimb(context, { x: -halfBody * 0.58, y: legY }, { x: -halfBody * 0.64 + gait * 4, y: pawY - 7 }, { x: -halfBody * 0.64 + gait * 8, y: pawY });
    jointedLimb(context, { x: -halfBody * 0.25, y: legY }, { x: -halfBody * 0.18 - gait * 4, y: pawY - 7 }, { x: -halfBody * 0.18 - gait * 8, y: pawY });
    jointedLimb(context, { x: halfBody * 0.48, y: legY }, { x: halfBody * 0.48 - gait * 4, y: pawY - 7 }, { x: halfBody * 0.48 - gait * 8, y: pawY });
    jointedLimb(context, { x: halfBody * 0.78, y: legY }, { x: halfBody * 0.78 + gait * 4, y: pawY - 7 }, { x: halfBody * 0.78 + gait * 8, y: pawY });

    line(context, { x: headX - 5, y: headY + 7 }, { x: headX + 2, y: headY + 9 });
    if (pose.alert) {
      line(context, { x: headX + 5, y: headY - 20 }, { x: headX + 7, y: headY - 28 });
      line(context, { x: headX + 13, y: headY - 17 }, { x: headX + 19, y: headY - 23 });
    }
  });
}