import { PALETTE } from '../rendering/palette';
import { circle, line, polyline, wire, withTransform } from '../rendering/primitives';

export interface HousePose {
  x: number;
  y: number;
  index: number;
  occupied: boolean;
  phase: number;
  /** 0..1 proximity glow when the cat is approaching an open home */
  approach?: number;
}

export function drawHouse(context: CanvasRenderingContext2D, pose: HousePose): void {
  const houseColor = pose.occupied ? PALETTE.cat : PALETTE.homeDim;
  const houseAlpha = pose.occupied ? 1.0 : 0.65;

  withTransform(context, { x: pose.x, y: pose.y }, 0, 1, 1, () => {
    const approach = Math.max(0, Math.min(1, pose.approach ?? 0));
    if (!pose.occupied && approach > 0.02) {
      // Soft approach pulse — stronger as the cat nears an open home
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

    // --- 1. ARCHITECTURAL SANCTUARY / HOUSE PROFILE ---
    wire(context, houseColor, 1.8, houseAlpha, pose.occupied ? 4 : approach > 0.35 ? 6 : 0);

    // Wall & Roof Polygon
    polyline(
      context,
      [
        { x: -28, y: 24 }, // Bottom Left
        { x: -28, y: -2 }, // Left Eaves
        { x: -32, y: -2 }, // Left Eaves Overhang
        { x: 0, y: -26 }, // Roof Peak
        { x: 32, y: -2 }, // Right Eaves Overhang
        { x: 28, y: -2 }, // Right Eaves
        { x: 28, y: 24 }, // Bottom Right
      ],
      true,
    );

    // Base threshold beam
    line(context, { x: -30, y: 24 }, { x: 30, y: 24 });

    // Roof Truss cross-beam
    line(context, { x: -28, y: -2 }, { x: 28, y: -2 });

    // Roof Apex Weather Vane
    line(context, { x: 0, y: -26 }, { x: 0, y: -34 });
    line(context, { x: -3.5, y: -31 }, { x: 3.5, y: -31 });

    // Chimney on left side of roof
    const chimneyX = -18;
    const chimneyY = -12;
    polyline(context, [
      { x: chimneyX - 3, y: chimneyY },
      { x: chimneyX - 3, y: chimneyY - 14 },
      { x: chimneyX + 3, y: chimneyY - 14 },
      { x: chimneyX + 3, y: chimneyY + 4 },
    ]);
    line(context, { x: chimneyX - 4.5, y: chimneyY - 14 }, { x: chimneyX + 4.5, y: chimneyY - 14 });

    // --- 2. ARCHED CAT PORTAL (DOORWAY) ---
    context.beginPath();
    context.arc(0, 10, 12, Math.PI, 0); // Arch top
    context.lineTo(12, 24);
    context.lineTo(-12, 24);
    context.closePath();
    context.stroke();

    if (pose.occupied) {
      // --- OCCUPIED: WARM SAFE HAVEN WITH HAPPY RESCUED CAT ---
      wire(context, PALETTE.cat, 1.8, 1, 4);
      const catHeadY = 9;

      // Head circle
      circle(context, { x: 0, y: catHeadY }, 6.5);
      // Sharp alert ears
      polyline(context, [{ x: -5.5, y: catHeadY - 2 }, { x: -5, y: catHeadY - 11 }, { x: -1, y: catHeadY - 5 }]);
      polyline(context, [{ x: 5.5, y: catHeadY - 2 }, { x: 5, y: catHeadY - 11 }, { x: 1, y: catHeadY - 5 }]);

      // Contented closed crescent eyes
      polyline(context, [{ x: -3.5, y: catHeadY - 0.5 }, { x: -2, y: catHeadY + 0.5 }, { x: -0.5, y: catHeadY - 0.5 }]);
      polyline(context, [{ x: 3.5, y: catHeadY - 0.5 }, { x: 2, y: catHeadY + 0.5 }, { x: 0.5, y: catHeadY - 0.5 }]);

      // Nose & happy cat smile
      polyline(context, [{ x: -0.6, y: catHeadY + 2 }, { x: 0, y: catHeadY + 2.5 }, { x: 0.6, y: catHeadY + 2 }]);

      // Whiskers
      wire(context, PALETTE.catSoft, 1.0, 0.7);
      line(context, { x: -3, y: catHeadY + 2 }, { x: -9, y: catHeadY + 1 });
      line(context, { x: -3, y: catHeadY + 3.5 }, { x: -8.5, y: catHeadY + 5 });
      line(context, { x: 3, y: catHeadY + 2 }, { x: 9, y: catHeadY + 1 });
      line(context, { x: 3, y: catHeadY + 3.5 }, { x: 8.5, y: catHeadY + 5 });

      // Paws resting on threshold
      wire(context, PALETTE.cat, 1.5, 1);
      circle(context, { x: -4, y: 22 }, 2.0);
      circle(context, { x: 4, y: 22 }, 2.0);
    } else {
      // --- UNOCCUPIED: target mat; brightens when cat approaches ---
      const near = Math.max(0, Math.min(1, pose.approach ?? 0));
      wire(context, near > 0.2 ? PALETTE.catSoft : '#1e4834', 1.0, 0.6 + near * 0.35);
      line(context, { x: -8, y: 21 }, { x: 8, y: 21 });
      line(context, { x: -5, y: 18 }, { x: 5, y: 18 });
      if (near > 0.25) {
        wire(context, PALETTE.catGlow, 1.2, 0.35 + near * 0.45, 4);
        line(context, { x: -10, y: 24 }, { x: 10, y: 24 });
      }
    }
  });
}
