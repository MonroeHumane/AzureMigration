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
  gaitSpeed: number;
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
    gaitSpeed: 1.35, // High-frequency zippy scurry
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
    gaitSpeed: 0.95, // Long, loping ground-covering stride
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
    gaitSpeed: 1.1, // Powerful flying trot
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
    gaitSpeed: 1.0, // Heavy swaggering waddle
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
  const trotCycle = pose.phase * p.gaitSpeed * Math.PI * 2;

  // Quadruped locomotion kinematics (Eadweard Muybridge diagonal trot):
  // Diagonal pair A: Front-Left & Rear-Right
  // Diagonal pair B: Front-Right & Rear-Left
  const sinA = Math.sin(trotCycle);
  const cosA = Math.cos(trotCycle);
  const sinB = Math.sin(trotCycle + Math.PI); // 180 degrees out of phase
  const cosB = Math.cos(trotCycle + Math.PI);

  // Vertical body bounce (two bounces per full gait cycle)
  const verticalBounce = Math.abs(sinA) * 2.2;

  // Spine pitch / roll (shoulders and hips counter-rocking)
  const pitchAngle = sinA * 0.045;

  // Head bob in counter-phase to front foot plant
  const headBob = Math.sin(trotCycle * 2) * 1.8;

  // Tail dynamic wagging & bounce
  const tailWag = Math.sin(trotCycle * 1.5) * 6;
  const tailBounce = Math.cos(trotCycle * 2) * 2.5;

  // Alert jaw pant / bark state
  const isBarking = pose.alert && Math.sin(pose.phase * 14) > 0.15;
  const jawDrop = isBarking ? 4.5 : Math.max(0, Math.sin(trotCycle) * 1.5);

  withTransform(context, { x: pose.x, y: pose.y - verticalBounce }, pitchAngle, pose.facing, 1, () => {
    wire(context, p.color, 1.9, 1, 3);

    // Anatomical body coordinates:
    const chestFront = p.bodyLength * 0.44;
    const rumpBack = -p.bodyLength * 0.44;
    const withersY = -p.bodyHeight * 0.48;
    const chestDeepY = p.bodyHeight * 0.46;
    const loinTuckY = -p.bodyHeight * 0.05; // Dramatic canine waist tuck

    // Dynamic spine arching during motion
    const spineFlex = Math.sin(trotCycle) * 1.4;

    // --- 1. TORSO CONTOUR (Deep forward chest, high tucked abdomen, muscular rump) ---
    context.beginPath();
    context.moveTo(rumpBack, withersY + 2 + spineFlex * 0.5); // Top of rump
    context.quadraticCurveTo(0, withersY - 1 - spineFlex, chestFront * 0.2, withersY); // Flexing spine
    context.lineTo(chestFront, withersY + 5); // Front crest of shoulder
    context.lineTo(chestFront + 3.5, chestDeepY * 0.6); // Forechest point
    context.lineTo(chestFront * 0.3, chestDeepY); // Deepest bottom of ribcage
    context.lineTo(rumpBack * 0.2, loinTuckY); // Dramatic waist tuck! Upward cut
    context.lineTo(rumpBack, loinTuckY + 7); // Lower pelvis/groin
    context.lineTo(rumpBack - 2, withersY + 5); // Rear curve of buttocks
    context.closePath();
    context.stroke();

    // Internal rib/flank subtle accent
    wire(context, p.color, 1.1, 0.4);
    line(context, { x: chestFront * 0.2, y: withersY }, { x: chestFront * 0.1, y: chestDeepY * 0.7 });
    wire(context, p.color, 1.9, 1, 3);

    // --- 2. NECK & HEAD WITH ANIMATED BOB ---
    const neckBaseX = chestFront * 0.7;
    const neckBaseY = withersY + 2;
    const headX = chestFront + p.headRadius * 0.85;
    const headY = withersY - p.headRadius * 0.75 + headBob;

    // Upward-reaching neck lines
    line(context, { x: neckBaseX, y: neckBaseY }, { x: headX - p.headRadius * 0.4, y: headY - p.headRadius * 0.8 });
    line(context, { x: chestFront + 2, y: withersY + 8 }, { x: headX - 2, y: headY + p.headRadius * 0.6 });

    // Cranium (Skull top)
    context.beginPath();
    context.arc(headX, headY, p.headRadius * 0.75, Math.PI * 0.8, Math.PI * 1.8);
    context.stroke();

    // --- 3. CANINE SNOUT & ANIMATED JAW (Panting / Barking) ---
    const stopX = headX + p.headRadius * 0.45;
    const stopY = headY - p.headRadius * 0.25;
    const noseTipX = stopX + p.snoutLength;
    const noseTipY = stopY + 2;
    const chinX = stopX + p.snoutLength * 0.75;
    const chinY = stopY + p.snoutThickness + jawDrop; // Animated jaw drop!
    const throatLatchX = headX - 1;
    const throatLatchY = headY + p.headRadius * 0.6;

    // Upper muzzle & bridge
    context.beginPath();
    context.moveTo(stopX, stopY);
    context.lineTo(noseTipX, noseTipY);
    context.lineTo(noseTipX + 1, noseTipY + 2.5);
    context.lineTo(chinX, stopY + p.snoutThickness); // Upper lip
    context.stroke();

    // Articulated lower mandible (jaw)
    context.beginPath();
    context.moveTo(noseTipX - 1, chinY);
    context.lineTo(chinX, chinY);
    context.lineTo(stopX * 0.9, chinY - 1);
    context.lineTo(throatLatchX, throatLatchY);
    context.stroke();

    if (isBarking || jawDrop > 2) {
      // Panting tongue vector
      wire(context, PALETTE.dogRose, 1.4, 0.9);
      curve(
        context,
        { x: chinX - 2, y: stopY + p.snoutThickness },
        { x: chinX + 2, y: chinY + 1 },
        { x: chinX + 1, y: chinY + 4 },
        { x: chinX - 2, y: chinY + 3 },
      );
      wire(context, p.color, 1.9, 1, 3);
    }

    // Canine nose triangle (pointed front)
    context.beginPath();
    context.moveTo(noseTipX - 2, noseTipY);
    context.lineTo(noseTipX + 1.2, noseTipY + 1.5);
    context.lineTo(noseTipX - 1, noseTipY + 3);
    context.closePath();
    context.stroke();

    // Keen canine eye
    circle(context, { x: headX + 1, y: headY - 2 }, 1.5);

    // --- 4. DYNAMIC EARS (Hound floppy wave, Terrier/Shepherd alert prick) ---
    if (p.earStyle === 'pricked') {
      const earTwitch = Math.sin(trotCycle * 2) * 1.2;
      polyline(context, [
        { x: headX - 4, y: headY - p.headRadius * 0.7 },
        { x: headX - 2 + earTwitch, y: headY - p.headRadius * 1.85 },
        { x: headX + 3, y: headY - p.headRadius * 0.6 },
      ]);
    } else if (p.earStyle === 'shepherd') {
      const earTwitch = Math.sin(trotCycle * 2) * 1.0;
      polyline(context, [
        { x: headX - 5, y: headY - p.headRadius * 0.6 },
        { x: headX - 4 + earTwitch, y: headY - p.headRadius * 2.05 },
        { x: headX + 4, y: headY - p.headRadius * 0.5 },
      ]);
      line(context, { x: headX - 1, y: headY - p.headRadius * 1.5 }, { x: headX + 1, y: headY - p.headRadius * 0.6 });
    } else if (p.earStyle === 'floppy') {
      // Fluid pendulous hound ear with trailing phase lag
      const earFlapLag = Math.sin(trotCycle * 2 - 0.7) * 4.5;
      curve(
        context,
        { x: headX - 2, y: headY - p.headRadius * 0.5 },
        { x: headX - 8, y: headY + 3 },
        { x: headX - 7 + earFlapLag, y: headY + p.headRadius * 1.45 },
        { x: headX - 1 + earFlapLag * 0.5, y: headY + p.headRadius * 1.15 },
      );
    } else {
      // Rose ear
      polyline(context, [
        { x: headX - 5, y: headY - p.headRadius * 0.6 },
        { x: headX - 10, y: headY - p.headRadius * 0.2 },
        { x: headX - 4, y: headY + 1 },
      ]);
    }

    // --- 5. ANIMATED TAILS (Wagging & physics bouncing) ---
    const tailRootX = rumpBack;
    const tailRootY = withersY + 3;

    if (p.tailStyle === 'plume') {
      // High arching terrier tail vibrating in rhythm
      curve(
        context,
        { x: tailRootX, y: tailRootY },
        { x: tailRootX - 10, y: tailRootY - 14 + tailBounce },
        { x: tailRootX - 4 + tailWag, y: tailRootY - 21 + tailBounce },
        { x: tailRootX + 3 + tailWag, y: tailRootY - 18 },
      );
    } else if (p.tailStyle === 'saber') {
      // Fluid hound saber tail undulating
      curve(
        context,
        { x: tailRootX, y: tailRootY },
        { x: tailRootX - 8, y: tailRootY - 10 },
        { x: tailRootX - 14 + tailWag * 0.8, y: tailRootY - 18 + tailBounce },
        { x: tailRootX - 10 + tailWag, y: tailRootY - 23 },
      );
    } else if (p.tailStyle === 'whip') {
      // Long shepherd brush tail streaming with harmonic curl
      curve(
        context,
        { x: tailRootX, y: tailRootY },
        { x: tailRootX - 10, y: tailRootY + 6 + tailBounce },
        { x: tailRootX - 16 + tailWag * 0.7, y: tailRootY + 14 },
        { x: tailRootX - 8 + tailWag, y: tailRootY + 18 },
      );
    } else {
      // Bulldog docked tail twitching
      polyline(context, [
        { x: tailRootX, y: tailRootY },
        { x: tailRootX - 5, y: tailRootY - 4 + tailWag * 0.4 },
        { x: tailRootX - 4, y: tailRootY - 8 + tailWag * 0.6 },
      ]);
    }

    // --- 6. ARTICULATED LEGS (DIAGONAL TROT MECHANICS WITH PAW TUCK) ---
    const shoulderX = chestFront * 0.7;
    const hipX = rumpBack * 0.65;
    const groundY = chestDeepY + p.legLength;

    // Helper for quadruped limb with wrist/hock flex
    const drawForeleg = (startX: number, startY: number, cycleSin: number, isFar: boolean) => {
      const stride = cycleSin * 8;
      const isSwing = cycleSin < 0; // Negative sine = swinging forward
      // When swinging forward, lift wrist up (carpus flex)
      const wristLift = isSwing ? Math.sin(-cycleSin * Math.PI) * 4.5 : 0;
      const kneeX = startX + stride * 0.45;
      const kneeY = startY + p.legLength * 0.48 - wristLift * 0.5;
      const pawX = startX + stride;
      const pawY = groundY - wristLift;

      wire(context, p.color, isFar ? 1.3 : 1.9, isFar ? 0.55 : 1, isFar ? 0 : 3);
      polyline(context, [{ x: startX, y: startY }, { x: kneeX, y: kneeY }, { x: pawX, y: pawY }]);
      line(context, { x: pawX, y: pawY }, { x: pawX + 3.8, y: pawY - (isSwing ? 1 : 0) });
    };

    const drawHindleg = (startX: number, startY: number, cycleSin: number, isFar: boolean) => {
      const stride = cycleSin * 7.5;
      const isSwing = cycleSin < 0;
      const hockLift = isSwing ? Math.sin(-cycleSin * Math.PI) * 4.0 : 0;

      // Canine rear anatomy: Haunch forward, Hock backward, Metatarsus down
      const stifleX = startX + 7 + stride * 0.35; // Stifle (knee) bends forward
      const stifleY = startY + p.legLength * 0.4 - hockLift * 0.4;
      const hockX = startX - 6 + stride * 0.55; // Hock point bends backward!
      const hockY = startY + p.legLength * 0.76 - hockLift;
      const pawX = startX + stride;
      const pawY = groundY - hockLift;

      wire(context, p.color, isFar ? 1.3 : 1.9, isFar ? 0.55 : 1, isFar ? 0 : 3);
      polyline(context, [{ x: startX, y: startY }, { x: stifleX, y: stifleY }, { x: hockX, y: hockY }, { x: pawX, y: pawY }]);
      line(context, { x: pawX, y: pawY }, { x: pawX + 3.8, y: pawY - (isSwing ? 1 : 0) });
    };

    // Draw Far legs first (behind body)
    drawForeleg(shoulderX + 5, chestDeepY * 0.65, sinB, true);
    drawHindleg(hipX + 4, loinTuckY + 1, sinA, true);

    // Draw Near legs second (in front of body)
    drawForeleg(shoulderX, chestDeepY * 0.7, sinA, false);
    drawHindleg(hipX, loinTuckY + 2, sinB, false);
  });
}

