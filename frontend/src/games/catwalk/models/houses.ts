import { PALETTE } from '../rendering/palette';
import { circle, curve, line, polyline, wire, withTransform } from '../rendering/primitives';

export interface HousePose {
  x: number;
  y: number;
  index: number;
  occupied: boolean;
  phase: number;
}

export function drawHouse(context: CanvasRenderingContext2D, pose: HousePose): void {
  const pulse = pose.occupied ? 1 + Math.sin(pose.phase * 4) * 0.025 : 1;
  const houseColor = pose.occupied ? PALETTE.catGlow : PALETTE.homeDim;
  const houseAlpha = pose.occupied ? 1.0 : 0.65;

  withTransform(context, { x: pose.x, y: pose.y }, 0, pulse, pulse, () => {
    // --- 1. ARCHITECTURAL SANCTUARY / HOUSE PROFILE ---
    wire(context, houseColor, 2.0, houseAlpha, pose.occupied ? 6 : 0);

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
      // 1. Chimney wireframe smoke puffs rising
      const smokePhase = (pose.phase * 1.5 + pose.index * 0.4) % 1;
      const smokeY = chimneyY - 16 - smokePhase * 20;
      const smokeDrift = Math.sin(smokePhase * Math.PI * 2) * 4;
      const smokeAlpha = Math.max(0, 1 - smokePhase) * 0.7;
      wire(context, PALETTE.catSoft, 1.2, smokeAlpha);
      circle(context, { x: chimneyX + smokeDrift, y: smokeY }, 3 + smokePhase * 4);

      // 2. Glowing hearth cat inside doorway
      wire(context, PALETTE.cat, 2.0, 1, 6);

      const breath = Math.sin(pose.phase * 3.5) * 0.6;
      const catHeadY = 9 + breath;

      // Head circle
      circle(context, { x: 0, y: catHeadY }, 6.5);
      // Sharp alert ears
      polyline(context, [{ x: -5.5, y: catHeadY - 2 }, { x: -5, y: catHeadY - 11 }, { x: -1, y: catHeadY - 5 }]);
      polyline(context, [{ x: 5.5, y: catHeadY - 2 }, { x: 5, y: catHeadY - 11 }, { x: 1, y: catHeadY - 5 }]);

      // Contented crescent eyes (slow happy blinking)
      const blink = (pose.phase * 0.6 + pose.index) % 3 < 0.25;
      if (!blink) {
        polyline(context, [{ x: -3.5, y: catHeadY - 0.5 }, { x: -2, y: catHeadY + 0.5 }, { x: -0.5, y: catHeadY - 0.5 }]);
        polyline(context, [{ x: 3.5, y: catHeadY - 0.5 }, { x: 2, y: catHeadY + 0.5 }, { x: 0.5, y: catHeadY - 0.5 }]);
      } else {
        line(context, { x: -3.5, y: catHeadY }, { x: -0.5, y: catHeadY });
        line(context, { x: 0.5, y: catHeadY }, { x: 3.5, y: catHeadY });
      }

      // Nose & happy cat smile
      polyline(context, [{ x: -0.6, y: catHeadY + 2 }, { x: 0, y: catHeadY + 2.5 }, { x: 0.6, y: catHeadY + 2 }]);

      // Whiskers
      wire(context, PALETTE.catSoft, 1.0, 0.8);
      line(context, { x: -3, y: catHeadY + 2 }, { x: -9, y: catHeadY + 1 });
      line(context, { x: -3, y: catHeadY + 3.5 }, { x: -8.5, y: catHeadY + 5 });
      line(context, { x: 3, y: catHeadY + 2 }, { x: 9, y: catHeadY + 1 });
      line(context, { x: 3, y: catHeadY + 3.5 }, { x: 8.5, y: catHeadY + 5 });

      // Paws resting on threshold
      wire(context, PALETTE.cat, 1.6, 1, 3);
      circle(context, { x: -4, y: 22 }, 2.0);
      circle(context, { x: 4, y: 22 }, 2.0);
    } else {
      // --- UNOCCUPIED: PULSING HOMING BEACON & DOCKING RUNWAY CHEVRONS ---
      // Homing radar sweep over the weather vane
      const radarWave = (pose.phase * 2.2 + pose.index * 0.3) % 1;
      const radarRadius = 4 + radarWave * 14;
      const radarAlpha = (1 - radarWave) * 0.65;
      wire(context, PALETTE.home, 1.2, radarAlpha);
      context.beginPath();
      context.arc(0, -34, radarRadius, -Math.PI * 0.8, -Math.PI * 0.2);
      context.stroke();

      // Pulsing runway docking chevrons in front of open doorway
      const chevronStep = (pose.phase * 3.5) % 1;
      wire(context, PALETTE.catSoft, 1.3, 0.45 + Math.sin(pose.phase * 4) * 0.25);
      for (let c = 0; c < 2; c++) {
        const cy = 20 - c * 5 + chevronStep * 3;
        polyline(context, [{ x: -5, y: cy + 3 }, { x: 0, y: cy }, { x: 5, y: cy + 3 }]);
      }
    }
  });
}
