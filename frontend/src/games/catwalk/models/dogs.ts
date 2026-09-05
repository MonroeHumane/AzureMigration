import { PALETTE } from '../rendering/palette';
import { circle, curve, line, polyline, wire, withTransform } from '../rendering/primitives';

export type DogBreed = 'terrier' | 'hound' | 'shepherd' | 'bulldog';

export interface DogProfile {
  breed: DogBreed;
  bodyLength: number;
  bodyHeight: number;
  headRadius: number;
  collisionWidth: number;
  color: string;
  earStyle: 'pricked' | 'floppy' | 'rose' | 'shepherd';
  snoutLength: number;
  snoutThickness: number;
  tailStyle: 'plume' | 'whip' | 'docked' | 'saber';
  legLength: number;
}

export const DOG_PROFILES: Record<DogBreed, DogProfile> = {
  terrier: {
    breed: 'terrier',
    bodyLength: 42,
    bodyHeight: 18,
    headRadius: 9,
    collisionWidth: 54,
    color: PALETTE.dogAmber,
    earStyle: 'pricked',
    snoutLength: 10,
    snoutThickness: 6,
    tailStyle: 'plume',
    legLength: 14,
  },
  hound: {
    breed: 'hound',
    bodyLength: 56,
    bodyHeight: 19,
    headRadius: 10,
    collisionWidth: 70,
    color: PALETTE.dogRose,
    earStyle: 'floppy',
    snoutLength: 16,
    snoutThickness: 6.5,
    tailStyle: 'saber',
    legLength: 17,
  },
  shepherd: {
    breed: 'shepherd',
    bodyLength: 52,
    bodyHeight: 21,
    headRadius: 11,
    collisionWidth: 66,
    color: PALETTE.dogCoral,
    earStyle: 'shepherd',
    snoutLength: 14,
    snoutThickness: 7,
    tailStyle: 'whip',
    legLength: 18,
  },
  bulldog: {
    breed: 'bulldog',
    bodyLength: 44,
    bodyHeight: 22,
    headRadius: 12,
    collisionWidth: 58,
    color: PALETTE.dogAmber,
    earStyle: 'rose',
    snoutLength: 7,
    snoutThickness: 8.5,
    tailStyle: 'docked',
    legLength: 12,
  },
};

export interface DogPose {
  x: number;
  y: number;
  breed: DogBreed;
  facing: 1 | -1;
  phase: number;
  alert?: boolean;
}

export function drawDog(context: CanvasRenderingContext2D, pose: DogPose): void {
  const p = DOG_PROFILES[pose.breed];
  const trot = pose.phase * Math.PI * 2;
  const legCycle = Math.sin(trot);
  const bodyBob = Math.abs(legCycle) * 1.5;

  withTransform(context, { x: pose.x, y: pose.y - bodyBob }, 0, pose.facing, 1, () => {
    // --- 1. TORSO CONTOUR (Deep forward chest, high tucked abdomen, muscular rump) ---
    // Origin (0,0) is center of back.
    // +X is forward (towards head), -X is rear (towards tail).
    // -Y is up (spine), +Y is down (belly/legs).
    const chestFront = p.bodyLength * 0.44;
    const rumpBack = -p.bodyLength * 0.44;
    const withersY = -p.bodyHeight * 0.48;
    const chestDeepY = p.bodyHeight * 0.46;
    const loinTuckY = -p.bodyHeight * 0.05; // High belly tuck - KEY distinction from pigs!

    wire(context, p.color, 1.8, 1, 3);
    context.beginPath();
    context.moveTo(rumpBack, withersY + 2); // Top of rump
    context.lineTo(chestFront * 0.2, withersY); // Along spine to withers
    context.lineTo(chestFront, withersY + 5); // Front crest of shoulder
    context.lineTo(chestFront + 3, chestDeepY * 0.6); // Forechest point
    context.lineTo(chestFront * 0.3, chestDeepY); // Deepest bottom of ribcage
    context.lineTo(rumpBack * 0.2, loinTuckY); // Dramatic waist tuck! Upward cut
    context.lineTo(rumpBack, loinTuckY + 7); // Lower pelvis/groin
    context.lineTo(rumpBack - 2, withersY + 5); // Rear curve of buttocks
    context.closePath();
    context.stroke();

    // Internal rib/flank subtle accent for wireframe feel
    wire(context, p.color, 1.2, 0.4);
    line(context, { x: chestFront * 0.2, y: withersY }, { x: chestFront * 0.1, y: chestDeepY * 0.7 });
    wire(context, p.color, 1.8, 1, 3);

    // --- 2. NECK & HEAD ---
    const neckBaseX = chestFront * 0.7;
    const neckBaseY = withersY + 2;
    const headX = chestFront + p.headRadius * 0.8;
    const headY = withersY - p.headRadius * 0.75;

    // Upward-reaching neck lines
    line(context, { x: neckBaseX, y: neckBaseY }, { x: headX - p.headRadius * 0.4, y: headY - p.headRadius * 0.8 }); // Crest of neck
    line(context, { x: chestFront + 2, y: withersY + 8 }, { x: headX - 2, y: headY + p.headRadius * 0.6 }); // Throat

    // Cranium (Skull top)
    context.beginPath();
    context.arc(headX, headY, p.headRadius * 0.75, Math.PI * 0.8, Math.PI * 1.8);
    context.stroke();

    // --- 3. CANINE SNOUT & MUZZLE (Pronounced wedge with clean jawline - NEVER a pig disc!) ---
    const stopX = headX + p.headRadius * 0.45;
    const stopY = headY - p.headRadius * 0.25;
    const noseTipX = stopX + p.snoutLength;
    const noseTipY = stopY + 2;
    const chinX = stopX + p.snoutLength * 0.75;
    const chinY = stopY + p.snoutThickness;
    const throatLatchX = headX - 1;
    const throatLatchY = headY + p.headRadius * 0.6;

    // Muzzle upper bridge and jaw
    context.beginPath();
    context.moveTo(stopX, stopY);
    context.lineTo(noseTipX, noseTipY); // Muzzle bridge to nose
    context.lineTo(noseTipX + 1, noseTipY + 2.5); // Nose leather vertical drop
    context.lineTo(chinX, chinY); // Upper lip & mouth line
    context.lineTo(stopX * 0.9, chinY - 1); // Lower jaw/mandible
    context.lineTo(throatLatchX, throatLatchY); // Under jaw into throat
    context.stroke();

    // Canine nose triangle (pointed front)
    context.beginPath();
    context.moveTo(noseTipX - 2, noseTipY);
    context.lineTo(noseTipX + 1, noseTipY + 1.5);
    context.lineTo(noseTipX - 1, noseTipY + 3);
    context.closePath();
    context.stroke();

    // Keen canine eye
    circle(context, { x: headX + 1, y: headY - 2 }, 1.5);

    // --- 4. DISTINCT BREED EARS ---
    if (p.earStyle === 'pricked') {
      // Tall, sharp upright triangle ears (Terrier)
      polyline(context, [
        { x: headX - 4, y: headY - p.headRadius * 0.7 },
        { x: headX - 2, y: headY - p.headRadius * 1.8 },
        { x: headX + 3, y: headY - p.headRadius * 0.6 },
      ]);
    } else if (p.earStyle === 'shepherd') {
      // Large erect German Shepherd ear with fold base
      polyline(context, [
        { x: headX - 5, y: headY - p.headRadius * 0.6 },
        { x: headX - 4, y: headY - p.headRadius * 2.0 },
        { x: headX + 4, y: headY - p.headRadius * 0.5 },
      ]);
      line(context, { x: headX - 1, y: headY - p.headRadius * 1.5 }, { x: headX + 1, y: headY - p.headRadius * 0.6 });
    } else if (p.earStyle === 'floppy') {
      // Long droop hound ear hanging down past jaw
      curve(
        context,
        { x: headX - 2, y: headY - p.headRadius * 0.5 },
        { x: headX - 8, y: headY + 3 },
        { x: headX - 6, y: headY + p.headRadius * 1.4 },
        { x: headX - 1, y: headY + p.headRadius * 1.1 },
      );
    } else {
      // Rose ear (Bulldog folded back ear)
      polyline(context, [
        { x: headX - 5, y: headY - p.headRadius * 0.6 },
        { x: headX - 10, y: headY - p.headRadius * 0.2 },
        { x: headX - 4, y: headY + 1 },
      ]);
    }

    // --- 5. TAIL (Canine tails: plume, saber, whip, or docked) ---
    const tailRootX = rumpBack;
    const tailRootY = withersY + 3;
    if (p.tailStyle === 'plume') {
      curve(
        context,
        { x: tailRootX, y: tailRootY },
        { x: tailRootX - 10, y: tailRootY - 14 },
        { x: tailRootX - 4, y: tailRootY - 20 },
        { x: tailRootX + 3, y: tailRootY - 18 },
      );
    } else if (p.tailStyle === 'saber') {
      curve(
        context,
        { x: tailRootX, y: tailRootY },
        { x: tailRootX - 8, y: tailRootY - 10 },
        { x: tailRootX - 14, y: tailRootY - 18 },
        { x: tailRootX - 10, y: tailRootY - 22 },
      );
    } else if (p.tailStyle === 'whip') {
      curve(
        context,
        { x: tailRootX, y: tailRootY },
        { x: tailRootX - 10, y: tailRootY + 6 },
        { x: tailRootX - 16, y: tailRootY + 14 },
        { x: tailRootX - 8, y: tailRootY + 18 },
      );
    } else {
      polyline(context, [
        { x: tailRootX, y: tailRootY },
        { x: tailRootX - 5, y: tailRootY - 4 },
        { x: tailRootX - 4, y: tailRootY - 8 },
      ]);
    }

    // --- 6. LEGS WITH CANINE HOCK & STIFLE (Backward-angled hock joints on rear legs!) ---
    const shoulderX = chestFront * 0.7;
    const hipX = rumpBack * 0.65;
    const groundY = chestDeepY + p.legLength;

    // Front Left Leg (near)
    const flStride = legCycle * 7;
    const flKneeX = shoulderX + flStride * 0.5;
    const flKneeY = chestDeepY + p.legLength * 0.45;
    const flPawX = shoulderX + flStride;
    const flPawY = groundY;
    polyline(context, [{ x: shoulderX, y: chestDeepY * 0.7 }, { x: flKneeX, y: flKneeY }, { x: flPawX, y: flPawY }]);
    line(context, { x: flPawX, y: flPawY }, { x: flPawX + 3.5, y: flPawY }); // Forward paw pad

    // Front Right Leg (far - darker / dimmer for depth)
    const frStride = -legCycle * 7;
    const frPawX = shoulderX + 5 + frStride;
    wire(context, p.color, 1.3, 0.6);
    polyline(context, [
      { x: shoulderX + 5, y: chestDeepY * 0.65 },
      { x: shoulderX + 5 + frStride * 0.5, y: chestDeepY + p.legLength * 0.45 },
      { x: frPawX, y: groundY - 1 },
    ]);
    line(context, { x: frPawX, y: groundY - 1 }, { x: frPawX + 3, y: groundY - 1 });

    // Rear Left Leg (near - Anatomical Dog Leg: Haunch forward, Hock backward, Metatarsus down)
    wire(context, p.color, 1.8, 1, 3);
    const rlStride = -legCycle * 6.5;
    const rlStifleX = hipX + 7 + rlStride * 0.4; // Knee bends FORWARD
    const rlStifleY = loinTuckY + p.legLength * 0.4;
    const rlHockX = hipX - 6 + rlStride * 0.6; // Hock point bends BACKWARD (Canine signature!)
    const rlHockY = loinTuckY + p.legLength * 0.75;
    const rlPawX = hipX + rlStride;
    const rlPawY = groundY;
    polyline(context, [
      { x: hipX, y: loinTuckY + 2 },
      { x: rlStifleX, y: rlStifleY },
      { x: rlHockX, y: rlHockY },
      { x: rlPawX, y: rlPawY },
    ]);
    line(context, { x: rlPawX, y: rlPawY }, { x: rlPawX + 3.5, y: rlPawY }); // Paw pad

    // Rear Right Leg (far)
    const rrStride = legCycle * 6.5;
    const rrPawX = hipX + 4 + rrStride;
    wire(context, p.color, 1.3, 0.6);
    polyline(context, [
      { x: hipX + 4, y: loinTuckY + 1 },
      { x: hipX + 11 + rrStride * 0.4, y: loinTuckY + p.legLength * 0.4 },
      { x: hipX - 2 + rrStride * 0.6, y: loinTuckY + p.legLength * 0.75 },
      { x: rrPawX, y: groundY - 1 },
    ]);
    line(context, { x: rrPawX, y: groundY - 1 }, { x: rrPawX + 3, y: groundY - 1 });

    // --- 7. ALERT / BARK VECTORS (when player is close in lane) ---
    if (pose.alert) {
      wire(context, PALETTE.warning, 1.6, 0.9, 4);
      line(context, { x: noseTipX + 5, y: noseTipY - 6 }, { x: noseTipX + 13, y: noseTipY - 12 });
      line(context, { x: noseTipX + 8, y: noseTipY + 2 }, { x: noseTipX + 17, y: noseTipY + 3 });
      line(context, { x: noseTipX + 5, y: noseTipY + 10 }, { x: noseTipX + 14, y: noseTipY + 16 });
    }
  });
}
