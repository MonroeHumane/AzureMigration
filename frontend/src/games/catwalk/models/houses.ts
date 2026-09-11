import { HUD, PALETTE } from '../rendering/palette';
import { circle, line, polyline, wire, withTransform } from '../rendering/primitives';

export type HouseStyle = 'peaked' | 'dormer' | 'shed' | 'aframe' | 'turret';

export interface HousePose {
  x: number;
  y: number;
  index: number;
  occupied: boolean;
  phase: number;
  /** 0..1 proximity glow when the cat is approaching an open home */
  approach?: number;
  /** Optional override; defaults from index for run-to-run silhouette variety */
  style?: HouseStyle;
}

const STYLES: HouseStyle[] = ['peaked', 'dormer', 'shed', 'aframe', 'turret'];

export function houseStyleForIndex(index: number): HouseStyle {
  return STYLES[((index % STYLES.length) + STYLES.length) % STYLES.length];
}

function drawSilhouette(
  context: CanvasRenderingContext2D,
  style: HouseStyle,
): void {
  // Shared threshold beam used by every style
  const drawBase = () => line(context, { x: -30, y: 24 }, { x: 30, y: 24 });

  if (style === 'peaked') {
    polyline(
      context,
      [
        { x: -28, y: 24 },
        { x: -28, y: -2 },
        { x: -32, y: -2 },
        { x: 0, y: -26 },
        { x: 32, y: -2 },
        { x: 28, y: -2 },
        { x: 28, y: 24 },
      ],
      true,
    );
    drawBase();
    line(context, { x: -28, y: -2 }, { x: 28, y: -2 });
    line(context, { x: 0, y: -26 }, { x: 0, y: -34 });
    line(context, { x: -3.5, y: -31 }, { x: 3.5, y: -31 });
    const chimneyX = -18;
    const chimneyY = -12;
    polyline(context, [
      { x: chimneyX - 3, y: chimneyY },
      { x: chimneyX - 3, y: chimneyY - 14 },
      { x: chimneyX + 3, y: chimneyY - 14 },
      { x: chimneyX + 3, y: chimneyY + 4 },
    ]);
    line(context, { x: chimneyX - 4.5, y: chimneyY - 14 }, { x: chimneyX + 4.5, y: chimneyY - 14 });
  } else if (style === 'dormer') {
    // Wider cottage with centered dormer peak
    polyline(
      context,
      [
        { x: -30, y: 24 },
        { x: -30, y: 0 },
        { x: -34, y: 0 },
        { x: -8, y: -18 },
        { x: -4, y: -14 },
        { x: 0, y: -22 },
        { x: 4, y: -14 },
        { x: 8, y: -18 },
        { x: 34, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 24 },
      ],
      true,
    );
    drawBase();
    line(context, { x: -30, y: 0 }, { x: 30, y: 0 });
    // Dormer window diamond
    polyline(context, [
      { x: 0, y: -18 },
      { x: -4, y: -12 },
      { x: 0, y: -6 },
      { x: 4, y: -12 },
    ], true);
    // Side chimney
    polyline(context, [
      { x: 16, y: -6 },
      { x: 16, y: -20 },
      { x: 22, y: -20 },
      { x: 22, y: -2 },
    ]);
  } else if (style === 'shed') {
    // Modern mono-pitch / shed roof
    polyline(
      context,
      [
        { x: -28, y: 24 },
        { x: -28, y: -8 },
        { x: -32, y: -8 },
        { x: -32, y: -14 },
        { x: 32, y: 2 },
        { x: 28, y: 2 },
        { x: 28, y: 24 },
      ],
      true,
    );
    drawBase();
    line(context, { x: -28, y: -8 }, { x: 28, y: 2 });
    // Clerestory dashes
    line(context, { x: -18, y: -6 }, { x: -10, y: -4 });
    line(context, { x: -4, y: -3 }, { x: 4, y: -1 });
    line(context, { x: 10, y: 0 }, { x: 18, y: 2 });
  } else if (style === 'aframe') {
    // Tall A-frame cabin
    polyline(
      context,
      [
        { x: -26, y: 24 },
        { x: -22, y: 8 },
        { x: 0, y: -34 },
        { x: 22, y: 8 },
        { x: 26, y: 24 },
      ],
      true,
    );
    drawBase();
    // Interior ridge + loft cross
    line(context, { x: 0, y: -34 }, { x: 0, y: 8 });
    line(context, { x: -14, y: 0 }, { x: 14, y: 0 });
    // Weather vane
    line(context, { x: 0, y: -34 }, { x: 0, y: -40 });
    line(context, { x: -4, y: -37 }, { x: 4, y: -37 });
  } else {
    // Turret bay: box house + round tower
    polyline(
      context,
      [
        { x: -26, y: 24 },
        { x: -26, y: -2 },
        { x: -8, y: -2 },
        { x: -4, y: -18 },
        { x: 12, y: -18 },
        { x: 16, y: -2 },
        { x: 28, y: -2 },
        { x: 28, y: 24 },
      ],
      true,
    );
    drawBase();
    line(context, { x: -26, y: -2 }, { x: 28, y: -2 });
    // Round turret cupola
    context.beginPath();
    context.arc(4, -18, 10, Math.PI, 0);
    context.stroke();
    line(context, { x: -6, y: -18 }, { x: 14, y: -18 });
    line(context, { x: 4, y: -28 }, { x: 4, y: -34 });
    line(context, { x: 1, y: -32 }, { x: 7, y: -32 });
    // Bay window bump on right
    polyline(context, [
      { x: 28, y: 4 },
      { x: 34, y: 6 },
      { x: 34, y: 18 },
      { x: 28, y: 20 },
    ]);
  }
}

export function drawHouse(context: CanvasRenderingContext2D, pose: HousePose): void {
  const houseColor = pose.occupied ? PALETTE.cat : PALETTE.homeDim;
  const houseAlpha = pose.occupied ? 1.0 : 0.65;
  const style = pose.style ?? houseStyleForIndex(pose.index);

  withTransform(context, { x: pose.x, y: pose.y }, 0, 1, 1, () => {
    const approach = Math.max(0, Math.min(1, pose.approach ?? 0));
    if (!pose.occupied && approach > 0.02) {
      const pulse = 0.55 + 0.45 * Math.sin(pose.phase * 7);
      const glow = approach * pulse;
      wire(context, PALETTE.catGlow, 2.2, 0.25 + glow * 0.55, 10 + glow * 14);
      context.beginPath();
      context.ellipse(0, 18, 34 + glow * 10, 14 + glow * 4, 0, 0, Math.PI * 2);
      context.stroke();
      wire(context, PALETTE.warning, 1.4, 0.15 + glow * 0.45, 6);
      context.beginPath();
      context.arc(0, 8, 16 + glow * 6, Math.PI * 0.15, Math.PI * 0.85);
      context.stroke();
    }

    wire(context, houseColor, 1.8, houseAlpha, pose.occupied ? 4 : approach > 0.35 ? 6 : 0);
    drawSilhouette(context, style);

    // --- ARCHED CAT PORTAL (DOORWAY) — shared across styles ---
    context.beginPath();
    context.arc(0, 10, 12, Math.PI, 0);
    context.lineTo(12, 24);
    context.lineTo(-12, 24);
    context.closePath();
    context.stroke();

    if (pose.occupied) {
      wire(context, PALETTE.cat, 1.8, 1, 4);
      const catHeadY = 9;

      circle(context, { x: 0, y: catHeadY }, 6.5);
      polyline(context, [{ x: -5.5, y: catHeadY - 2 }, { x: -5, y: catHeadY - 11 }, { x: -1, y: catHeadY - 5 }]);
      polyline(context, [{ x: 5.5, y: catHeadY - 2 }, { x: 5, y: catHeadY - 11 }, { x: 1, y: catHeadY - 5 }]);

      polyline(context, [{ x: -3.5, y: catHeadY - 0.5 }, { x: -2, y: catHeadY + 0.5 }, { x: -0.5, y: catHeadY - 0.5 }]);
      polyline(context, [{ x: 3.5, y: catHeadY - 0.5 }, { x: 2, y: catHeadY + 0.5 }, { x: 0.5, y: catHeadY - 0.5 }]);

      polyline(context, [{ x: -0.6, y: catHeadY + 2 }, { x: 0, y: catHeadY + 2.5 }, { x: 0.6, y: catHeadY + 2 }]);

      wire(context, PALETTE.catSoft, 1.0, 0.7);
      line(context, { x: -3, y: catHeadY + 2 }, { x: -9, y: catHeadY + 1 });
      line(context, { x: -3, y: catHeadY + 3.5 }, { x: -8.5, y: catHeadY + 5 });
      line(context, { x: 3, y: catHeadY + 2 }, { x: 9, y: catHeadY + 1 });
      line(context, { x: 3, y: catHeadY + 3.5 }, { x: 8.5, y: catHeadY + 5 });

      wire(context, PALETTE.cat, 1.5, 1);
      circle(context, { x: -4, y: 22 }, 2.0);
      circle(context, { x: 4, y: 22 }, 2.0);
    } else {
      const near = Math.max(0, Math.min(1, pose.approach ?? 0));
      wire(context, near > 0.2 ? PALETTE.catSoft : HUD.frame, 1.0, 0.6 + near * 0.35);
      line(context, { x: -8, y: 21 }, { x: 8, y: 21 });
      line(context, { x: -5, y: 18 }, { x: 5, y: 18 });
      if (near > 0.25) {
        wire(context, PALETTE.catGlow, 1.2, 0.35 + near * 0.45, 4);
        line(context, { x: -10, y: 24 }, { x: 10, y: 24 });
      }
    }
  });
}
