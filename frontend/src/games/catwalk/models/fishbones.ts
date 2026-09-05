import { PALETTE } from '../rendering/palette';
import { circle, curve, line, polyline, wire, withTransform } from '../rendering/primitives';

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
  const swimFlex = Math.sin(pose.phase * 2.8) * 3.5;
  const halfLength = pose.length / 2;
  const skullRadius = pose.kind === 'tuna' ? 14 : pose.kind === 'salmon' ? 12 : 10;
  const ribSpacing = pose.kind === 'sardine' ? 20 : 26;
  const ribAngle = 0.55;

  withTransform(context, { x: pose.x, y: pose.y }, 0, pose.facing, 1, () => {
    // --- 1. SPINAL COLUMN WITH AQUATIC GLOW ---
    wire(context, PALETTE.water, 2.0, 0.95, 4);

    const tailRootX = -halfLength + 20;
    const skullRootX = halfLength - skullRadius * 1.2;

    // Curved undulation spine
    curve(
      context,
      { x: tailRootX, y: 0 },
      { x: -halfLength * 0.3, y: -swimFlex },
      { x: halfLength * 0.2, y: swimFlex },
      { x: skullRootX, y: 0 },
    );

    // --- 2. CAUDAL FIN (TAIL SKELETON) ---
    const tailTipX = -halfLength + 2;
    polyline(context, [
      { x: tailRootX, y: 0 },
      { x: tailTipX, y: -13 },
      { x: tailTipX + 7, y: 0 },
      { x: tailTipX, y: 13 },
      { x: tailRootX, y: 0 },
    ]);
    // Tail fin rays
    line(context, { x: tailRootX - 4, y: 0 }, { x: tailTipX + 3, y: -7 });
    line(context, { x: tailRootX - 4, y: 0 }, { x: tailTipX + 3, y: 7 });

    // --- 3. FISH SKULL (Chiseled Vector Cranium with Open Jaw & Large Eye) ---
    const skullCenterX = halfLength - skullRadius;

    // Cranium top arch to snout point
    context.beginPath();
    context.moveTo(skullRootX, -3);
    context.lineTo(skullCenterX - 2, -skullRadius * 0.85); // Forehead peak
    context.lineTo(skullCenterX + skullRadius * 0.9, -2); // Snout point
    context.lineTo(skullCenterX + skullRadius * 0.3, 3); // Gape of mouth
    context.lineTo(skullCenterX + skullRadius * 0.8, 4); // Lower jaw tip
    context.lineTo(skullCenterX, skullRadius * 0.7); // Chin curve
    context.lineTo(skullRootX, 4); // Operculum / Gill cover edge
    context.closePath();
    context.stroke();

    // Operculum (gill slit arc)
    wire(context, PALETTE.waterSoft, 1.3, 0.7);
    curve(
      context,
      { x: skullRootX + 2, y: -skullRadius * 0.7 },
      { x: skullRootX + 6, y: 0 },
      { x: skullRootX + 6, y: 2 },
      { x: skullRootX + 2, y: skullRadius * 0.6 },
    );

    // X-Ray Orbit & Sclerotic Eye Ring
    wire(context, PALETTE.water, 1.8, 1, 3);
    circle(context, { x: skullCenterX + 1, y: -2 }, skullRadius * 0.32);
    circle(context, { x: skullCenterX + 1.5, y: -2 }, 1.2);

    // --- 4. ARTICULATED RIBS (HERRINGBONE ARCHITECTURE) ---
    wire(context, PALETTE.water, 1.6, 0.85, 2);
    for (let ribX = tailRootX + 16; ribX < skullRootX - 8; ribX += ribSpacing) {
      // Height of ribs tapers toward tail and head, tallest in mid-body
      const distFromCenter = Math.abs(ribX / halfLength);
      const ribH = (1 - distFromCenter * 0.65) * 14;

      // Upper dorsal rib (pointing back toward tail)
      line(context, { x: ribX, y: 0 }, { x: ribX - ribH * ribAngle, y: -ribH });
      // Lower ventral rib
      line(context, { x: ribX, y: 0 }, { x: ribX - ribH * ribAngle, y: ribH });

      // Vertebra joint node on spine
      circle(context, { x: ribX, y: 0 }, 1.1);
    }
  });
}
