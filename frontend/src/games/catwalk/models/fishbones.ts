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
  const halfLength = pose.length / 2;
  const skullRadius = pose.kind === 'tuna' ? 14 : pose.kind === 'salmon' ? 12 : 10;
  const ribSpacing = pose.kind === 'sardine' ? 20 : 25;
  const swimFreq = 3.2;

  // Traveling kinematic wave function:
  // Wave travels from skull (X > 0) to caudal fin (X < 0)
  const getSpineY = (x: number): number => {
    // Normalized distance from skull (0 at skull, 1 at tail)
    const norm = Math.max(0, Math.min(1, (halfLength - x) / pose.length));
    // Amplitude increases towards the tail (carangiform swimming mechanics)
    const amp = 1.2 + norm * 5.5;
    // Traveling phase lag along spine
    const wavePhase = pose.phase * swimFreq + norm * Math.PI * 1.8;
    return Math.sin(wavePhase) * amp;
  };

  // Jaw chomping / operculum respiration in rhythm with swim
  const jawGape = Math.max(0, Math.sin(pose.phase * swimFreq * 0.8) * 3.5);

  withTransform(context, { x: pose.x, y: pose.y }, 0, pose.facing, 1, () => {
    // --- 1. SPINAL COLUMN (MULTI-SEGMENT TRAVELING KINEMATIC WAVE) ---
    wire(context, PALETTE.water, 2.0, 0.95, 4);

    const tailRootX = -halfLength + 18;
    const skullRootX = halfLength - skullRadius * 1.2;

    // Draw articulated spline curve through spine nodes
    context.beginPath();
    context.moveTo(skullRootX, getSpineY(skullRootX));

    const step = 14;
    for (let x = skullRootX - step; x >= tailRootX; x -= step) {
      const prevX = x + step;
      const midX = (prevX + x) / 2;
      context.quadraticCurveTo(prevX, getSpineY(prevX), midX, getSpineY(midX));
    }
    context.lineTo(tailRootX, getSpineY(tailRootX));
    context.stroke();

    // --- 2. CAUDAL FIN SKELETON (FLEXING TAIL WITH PHASE LAG) ---
    const tailY = getSpineY(tailRootX);
    const tailLagY = getSpineY(tailRootX - 16);
    const tailTipX = -halfLength + 2;

    polyline(context, [
      { x: tailRootX, y: tailY },
      { x: tailTipX, y: tailLagY - 14 },
      { x: tailTipX + 7, y: tailLagY },
      { x: tailTipX, y: tailLagY + 14 },
      { x: tailRootX, y: tailY },
    ]);
    // Internal fin rays
    line(context, { x: tailRootX - 4, y: tailY }, { x: tailTipX + 3, y: tailLagY - 7 });
    line(context, { x: tailRootX - 4, y: tailY }, { x: tailTipX + 3, y: tailLagY + 7 });

    // Subtle hydrodynamic wake ring behind caudal fin
    const wakePulse = (pose.phase * 2) % 1;
    const wakeX = tailTipX - wakePulse * 16;
    wire(context, PALETTE.waterSoft, 1.0, (1 - wakePulse) * 0.45);
    curve(
      context,
      { x: wakeX, y: tailLagY - 6 },
      { x: wakeX - 4, y: tailLagY },
      { x: wakeX - 4, y: tailLagY },
      { x: wakeX, y: tailLagY + 6 },
    );

    // --- 3. FISH CRANIUM & ARTICULATED JAW ---
    wire(context, PALETTE.water, 2.0, 1, 4);
    const skullCenterX = halfLength - skullRadius;
    const skullY = getSpineY(skullCenterX);

    // Upper cranium & premaxilla
    context.beginPath();
    context.moveTo(skullRootX, skullY - 3);
    context.lineTo(skullCenterX - 2, skullY - skullRadius * 0.85); // Forehead crest
    context.lineTo(skullCenterX + skullRadius * 0.95, skullY - 2); // Snout tip
    context.lineTo(skullCenterX + skullRadius * 0.3, skullY + 2.5); // Upper jawline
    context.stroke();

    // Lower mandible (jaw) that chomps/breathes with swimming
    context.beginPath();
    context.moveTo(skullCenterX + skullRadius * 0.3, skullY + 2.5);
    context.lineTo(skullCenterX + skullRadius * 0.9, skullY + 3 + jawGape); // Lower jaw tip
    context.lineTo(skullCenterX, skullY + skullRadius * 0.7 + jawGape * 0.6); // Chin
    context.lineTo(skullRootX, skullY + 4); // Throat latch
    context.stroke();

    // Operculum (gill slit pulsing with respiration)
    const gillPulse = jawGape * 0.4;
    wire(context, PALETTE.waterSoft, 1.3, 0.75);
    curve(
      context,
      { x: skullRootX + 2, y: skullY - skullRadius * 0.7 },
      { x: skullRootX + 6 + gillPulse, y: skullY },
      { x: skullRootX + 6 + gillPulse, y: skullY + 2 },
      { x: skullRootX + 2, y: skullY + skullRadius * 0.6 },
    );

    // Skeletal eye socket & glowing phosphor pupil
    wire(context, PALETTE.water, 1.8, 1, 3);
    circle(context, { x: skullCenterX + 1, y: skullY - 2 }, skullRadius * 0.32);
    circle(context, { x: skullCenterX + 1.5, y: skullY - 2 }, 1.3);

    // --- 4. ARTICULATED RIBS (CURVED HERRINGBONE WITH LOCAL WAVE SLOPE) ---
    wire(context, PALETTE.water, 1.6, 0.9, 2);
    for (let ribX = tailRootX + 16; ribX < skullRootX - 6; ribX += ribSpacing) {
      const spineY = getSpineY(ribX);
      const nextSpineY = getSpineY(ribX - 2);
      // Slope derivative for organic rib angle
      const slope = (nextSpineY - spineY) / 2;

      const distFromCenter = Math.abs((ribX - 0) / halfLength);
      const ribH = (1 - distFromCenter * 0.65) * 14.5;
      const ribTilt = slope * 10;

      // Dorsal rib (upper)
      line(context, { x: ribX, y: spineY }, { x: ribX - 9 + ribTilt, y: spineY - ribH });
      // Ventral rib (lower)
      line(context, { x: ribX, y: spineY }, { x: ribX - 9 - ribTilt, y: spineY + ribH });

      // Vertebra joint node on spine
      circle(context, { x: ribX, y: spineY }, 1.15);
    }
  });
}
