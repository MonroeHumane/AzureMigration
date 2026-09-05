import { PALETTE } from '../rendering/palette';
import { circle, line, polyline, wire, withTransform } from '../rendering/primitives';

export interface HousePose {
  x: number;
  y: number;
  index: number;
  occupied: boolean;
  phase: number;
}

export function drawHouse(context: CanvasRenderingContext2D, pose: HousePose): void {
  const pulse = pose.occupied ? 1 + Math.sin(pose.phase * 4) * 0.03 : 1;
  const houseColor = pose.occupied ? PALETTE.catGlow : PALETTE.homeDim;
  const houseAlpha = pose.occupied ? 1.0 : 0.65;

  withTransform(context, { x: pose.x, y: pose.y }, 0, pulse, pulse, () => {
    // --- 1. ARCHITECTURAL SANCTUARY / HOUSE PROFILE ---
    wire(context, houseColor, 2.0, houseAlpha, pose.occupied ? 8 : 0);

    // Wall & Roof Polygon (Classic clean Victorian/A-frame cat home)
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

    // Roof Apex Accent (Tiny decorative finial / weather vane)
    line(context, { x: 0, y: -26 }, { x: 0, y: -34 });
    line(context, { x: -3, y: -31 }, { x: 3, y: -31 });

    // --- 2. ARCHED CAT PORTAL (DOORWAY) ---
    // If unoccupied: empty dark portal waiting for cat.
    // If occupied: warm glowing cat silhouette sitting peacefully inside!
    context.beginPath();
    context.arc(0, 10, 12, Math.PI, 0); // Arch top
    context.lineTo(12, 24);
    context.lineTo(-12, 24);
    context.closePath();
    context.stroke();

    if (pose.occupied) {
      // Golden / emerald safe haven glow inside doorway
      wire(context, PALETTE.cat, 2.0, 1, 6);

      // Resting cat head & ears centered in portal
      const catHeadY = 9;
      // Head circle
      circle(context, { x: 0, y: catHeadY }, 6.5);
      // Sharp ears
      polyline(context, [{ x: -5.5, y: catHeadY - 2 }, { x: -5, y: catHeadY - 11 }, { x: -1, y: catHeadY - 5 }]);
      polyline(context, [{ x: 5.5, y: catHeadY - 2 }, { x: 5, y: catHeadY - 11 }, { x: 1, y: catHeadY - 5 }]);

      // Contented closed crescent eyes
      polyline(context, [{ x: -3.5, y: catHeadY - 0.5 }, { x: -2, y: catHeadY + 0.5 }, { x: -0.5, y: catHeadY - 0.5 }]);
      polyline(context, [{ x: 3.5, y: catHeadY - 0.5 }, { x: 2, y: catHeadY + 0.5 }, { x: 0.5, y: catHeadY - 0.5 }]);

      // Tiny nose & happy mouth
      polyline(context, [{ x: -0.5, y: catHeadY + 2 }, { x: 0, y: catHeadY + 2.5 }, { x: 0.5, y: catHeadY + 2 }]);

      // Whiskers
      wire(context, PALETTE.catSoft, 1.0, 0.8);
      line(context, { x: -3, y: catHeadY + 2 }, { x: -9, y: catHeadY + 1 });
      line(context, { x: -3, y: catHeadY + 3.5 }, { x: -8, y: catHeadY + 5 });
      line(context, { x: 3, y: catHeadY + 2 }, { x: 9, y: catHeadY + 1 });
      line(context, { x: 3, y: catHeadY + 3.5 }, { x: 8, y: catHeadY + 5 });

      // Warm paws on windowsill / threshold
      circle(context, { x: -4, y: 22 }, 2.0);
      circle(context, { x: 4, y: 22 }, 2.0);
    } else {
      // Unoccupied: pulsing subtle beacon to guide player
      const beaconGlow = Math.sin(pose.phase * 3 + pose.index) * 0.3 + 0.5;
      wire(context, PALETTE.home, 1.2, beaconGlow);
      // Small landing target mat in front of door
      line(context, { x: -7, y: 20 }, { x: 7, y: 20 });
    }
  });
}
