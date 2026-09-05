import { PALETTE } from '../rendering/palette';
import { circle, curve, ellipse, line, polyline, wire, withTransform } from '../rendering/primitives';

export interface HousePose {
  x: number;
  y: number;
  index: number;
  occupied: boolean;
  phase: number;
}

const roofStyles = ['gable', 'round', 'offset', 'antenna', 'porch'] as const;

export function drawHouse(context: CanvasRenderingContext2D, pose: HousePose): void {
  const style = roofStyles[pose.index % roofStyles.length];
  const pulse = pose.occupied ? 1 + Math.sin(pose.phase * 3) * 0.03 : 1;

  withTransform(context, { x: pose.x, y: pose.y }, 0, pulse, pulse, () => {
    wire(context, pose.occupied ? PALETTE.cat : PALETTE.homeDim, 2);
    if (style === 'round') {
      context.beginPath();
      context.arc(0, -1, 25, Math.PI, 0);
      context.lineTo(25, 22);
      context.lineTo(-25, 22);
      context.closePath();
      context.stroke();
    } else {
      const peakX = style === 'offset' ? -8 : 0;
      polyline(context, [{ x: -27, y: 22 }, { x: -27, y: -2 }, { x: peakX, y: -25 }, { x: 27, y: -2 }, { x: 27, y: 22 }]);
      line(context, { x: -27, y: 22 }, { x: 27, y: 22 });
    }

    context.beginPath();
    context.arc(0, 22, 9, Math.PI, 0);
    context.stroke();
    if (style === 'antenna') {
      line(context, { x: 0, y: -25 }, { x: 0, y: -35 });
      line(context, { x: -6, y: -32 }, { x: 0, y: -35 });
      line(context, { x: 6, y: -32 }, { x: 0, y: -35 });
    }
    if (style === 'porch') {
      line(context, { x: -33, y: 22 }, { x: 33, y: 22 });
      line(context, { x: -30, y: 17 }, { x: -30, y: 27 });
      line(context, { x: 30, y: 17 }, { x: 30, y: 27 });
    }

    if (pose.occupied) {
      ellipse(context, { x: 0, y: 7 }, 7, 6);
      polyline(context, [{ x: -6, y: 3 }, { x: -5, y: -4 }, { x: -1, y: 1 }]);
      polyline(context, [{ x: 6, y: 3 }, { x: 5, y: -4 }, { x: 1, y: 1 }]);
      circle(context, { x: -2.5, y: 6 }, 0.8);
      circle(context, { x: 2.5, y: 6 }, 0.8);
      curve(context, { x: -2, y: 10 }, { x: -1, y: 12 }, { x: 1, y: 12 }, { x: 2, y: 10 });
    }
  });
}