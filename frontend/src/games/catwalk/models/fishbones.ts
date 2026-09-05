import { PALETTE } from '../rendering/palette';
import { circle, curve, ellipse, line, polyline, wire, withTransform } from '../rendering/primitives';

export type FishboneKind = 'sardine' | 'tuna' | 'salmon';

export interface FishbonePose {
  x: number;
  y: number;
  length: number;
  facing: 1 | -1;
  phase: number;
  kind: FishboneKind;
}

export function drawFishbone(context: CanvasRenderingContext2D, pose: FishbonePose): void {
  const flex = Math.sin(pose.phase * 2.4) * 3;
  const halfLength = pose.length / 2;
  const skullRadius = pose.kind === 'tuna' ? 15 : pose.kind === 'salmon' ? 13 : 11;
  const ribSpacing = pose.kind === 'sardine' ? 22 : 28;

  withTransform(context, { x: pose.x, y: pose.y }, 0, pose.facing, 1, () => {
    wire(context, PALETTE.water, 2.1);
    curve(context, { x: -halfLength + 18, y: 0 }, { x: -halfLength * 0.25, y: -flex }, { x: halfLength * 0.35, y: flex }, { x: halfLength - skullRadius * 1.3, y: 0 });
    ellipse(context, { x: halfLength - skullRadius, y: 0 }, skullRadius, skullRadius * 0.75);
    circle(context, { x: halfLength - skullRadius * 0.72, y: -2 }, 2.3);
    polyline(context, [
      { x: -halfLength + 20, y: 0 },
      { x: -halfLength + 2, y: -14 },
      { x: -halfLength + 4, y: 14 },
    ], true);

    for (let ribX = -halfLength + 34; ribX < halfLength - skullRadius * 2.1; ribX += ribSpacing) {
      line(context, { x: ribX, y: 0 }, { x: ribX - 10, y: -13 });
      line(context, { x: ribX, y: 0 }, { x: ribX - 10, y: 13 });
    }
  });
}