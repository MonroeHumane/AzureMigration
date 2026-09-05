import { PALETTE } from '../rendering/palette';
import { circle, curve, line, polyline, resetGlow, wire, withTransform } from '../rendering/primitives';

export type CatAction = 'idle' | 'hop' | 'ride' | 'hit' | 'home';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface CatPose {
  x: number;
  y: number;
  phase: number;
  action: CatAction;
  direction: Direction;
  invulnerable?: boolean;
}

export function drawCat(context: CanvasRenderingContext2D, pose: CatPose): void {
  // Fast sharp blink when invulnerable
  const isBlinking = pose.invulnerable && Math.floor(pose.phase * 26) % 2 === 0;
  if (isBlinking) return;

  // --- KINEMATICS & SECONDARY MOTION ---
  const isHopping = pose.action === 'hop';
  const isRiding = pose.action === 'ride';
  const isIdle = pose.action === 'idle';

  // Hop normalized progress (0 to 1)
  const hopProgress = isHopping ? Math.min(1, Math.max(0, pose.phase % 1)) : 0;
  const hopArc = isHopping ? Math.sin(hopProgress * Math.PI) : 0;

  // Parabolic vertical lift during hop
  const hopLift = hopArc * 9;

  // Squash & Stretch along the leap axis:
  // Launch (0..0.25): squash down & compress
  // Mid-flight (0.25..0.75): athletic stretch forward
  // Landing (0.75..1.0): squash impact absorption
  let stretchY = 1.0;
  let stretchX = 1.0;
  if (isHopping) {
    if (hopProgress < 0.25) {
      const t = hopProgress / 0.25;
      stretchY = 0.88 + t * 0.12;
      stretchX = 1.14 - t * 0.14;
    } else if (hopProgress < 0.75) {
      const t = (hopProgress - 0.25) / 0.5;
      const stretchFactor = Math.sin(t * Math.PI);
      stretchY = 1.0 + stretchFactor * 0.24; // Elongate along leap direction
      stretchX = 1.0 - stretchFactor * 0.15; // Streamline width
    } else {
      const t = (hopProgress - 0.75) / 0.25;
      stretchY = 1.0 - Math.sin(t * Math.PI) * 0.12;
      stretchX = 1.0 + Math.sin(t * Math.PI) * 0.14;
    }
  } else if (isRiding) {
    // Alert low crouching balance stance on moving fishbone
    stretchY = 0.94;
    stretchX = 1.06;
  } else {
    // Gentle idle breathing
    const breath = Math.sin(pose.phase * 3.2);
    stretchY = 1.0 + breath * 0.02;
    stretchX = 1.0 - breath * 0.02;
  }

  // Fluid tail multi-joint sine wave
  const tailFreq = isHopping ? 4.5 : isRiding ? 4.0 : 2.5;
  const tailWave1 = Math.sin(pose.phase * tailFreq) * 5;
  const tailWave2 = Math.sin(pose.phase * tailFreq + 1.2) * 7;
  const tailWave3 = Math.sin(pose.phase * tailFreq + 2.4) * 9;

  // Intermittent alert ear flick (cats flick their ears occasionally)
  const earFlickCycle = (pose.phase * 0.8) % 4.0;
  const leftEarFlick = earFlickCycle < 0.4 ? Math.sin(earFlickCycle * Math.PI * 5) * 2.2 : 0;
  const rightEarFlick = earFlickCycle > 2.0 && earFlickCycle < 2.4 ? Math.sin((earFlickCycle - 2.0) * Math.PI * 5) * 2.2 : 0;

  // Slit pupil blink cycle
  const blinkCycle = (pose.phase * 0.5) % 3.5;
  const isEyeBlinking = blinkCycle < 0.18;

  // Hop paw stride reach
  const pawReach = isHopping ? Math.sin(hopProgress * Math.PI) * 7 : 0;

  // Direction rotation: up is default 0, right is PI/2, down is PI, left is -PI/2
  const rotation =
    pose.direction === 'up'
      ? 0
      : pose.direction === 'right'
        ? Math.PI / 2
        : pose.direction === 'down'
          ? Math.PI
          : -Math.PI / 2;

  withTransform(context, { x: pose.x, y: pose.y - hopLift }, rotation, stretchX, stretchY, () => {
    // Vector neon glow for the hero cat
    wire(context, PALETTE.cat, 2.0, 1, 5);

    // Coordinate system:
    // Tail is at +Y (behind), Head is at -Y (forward in facing direction).
    const shoulderWidth = 8.8;
    const waistWidth = 5.8;
    const hipWidth = 9.2;
    const bodyTop = -6;
    const bodyBottom = 14;

    // --- 1. SLEEK FELINE TORSO CONTOUR ---
    context.beginPath();
    context.moveTo(-shoulderWidth, bodyTop); // Left shoulder
    context.quadraticCurveTo(-shoulderWidth - 1, (bodyTop + bodyBottom) * 0.35, -waistWidth, (bodyTop + bodyBottom) * 0.52); // Waist tuck
    context.quadraticCurveTo(-hipWidth - 1, bodyBottom * 0.78, -hipWidth * 0.82, bodyBottom); // Left hip flare
    context.quadraticCurveTo(0, bodyBottom + 3, hipWidth * 0.82, bodyBottom); // Rump curve
    context.quadraticCurveTo(hipWidth + 1, bodyBottom * 0.78, waistWidth, (bodyTop + bodyBottom) * 0.52); // Right flank
    context.quadraticCurveTo(shoulderWidth + 1, (bodyTop + bodyBottom) * 0.35, shoulderWidth, bodyTop); // Right shoulder
    context.quadraticCurveTo(0, bodyTop - 2.5, -shoulderWidth, bodyTop); // Chest crest
    context.closePath();
    context.stroke();

    // Subtle spine cord line
    wire(context, PALETTE.catSoft, 1.1, 0.45);
    line(context, { x: 0, y: bodyTop + 2 }, { x: 0, y: bodyBottom - 2 });

    // Shoulder blade and pelvis vector accents
    wire(context, PALETTE.catSoft, 0.9, 0.35);
    line(context, { x: -shoulderWidth * 0.7, y: bodyTop + 2 }, { x: -waistWidth * 0.5, y: bodyTop + 6 });
    line(context, { x: shoulderWidth * 0.7, y: bodyTop + 2 }, { x: waistWidth * 0.5, y: bodyTop + 6 });
    line(context, { x: -hipWidth * 0.7, y: bodyBottom - 3 }, { x: -waistWidth * 0.4, y: bodyBottom - 7 });
    line(context, { x: hipWidth * 0.7, y: bodyBottom - 3 }, { x: waistWidth * 0.4, y: bodyBottom - 7 });

    // --- 2. CHISELED FELINE HEAD ---
    wire(context, PALETTE.cat, 2.0, 1, 5);
    const headY = -14;
    const headWidth = 9.8;
    const snoutY = headY - 6.5;

    context.beginPath();
    context.moveTo(-headWidth, headY); // Left cheek ruff
    context.quadraticCurveTo(-headWidth * 0.75, snoutY + 1, -2.8, snoutY); // Left muzzle
    context.lineTo(0, snoutY - 1.2); // Nose leather point
    context.lineTo(2.8, snoutY); // Right muzzle
    context.quadraticCurveTo(headWidth * 0.75, snoutY + 1, headWidth, headY); // Right cheek ruff
    context.quadraticCurveTo(headWidth * 0.65, headY + 5.5, 0, headY + 5.5); // Chin
    context.quadraticCurveTo(-headWidth * 0.65, headY + 5.5, -headWidth, headY);
    context.closePath();
    context.stroke();

    // Cheek fur flare notches
    line(context, { x: -headWidth, y: headY }, { x: -headWidth - 2.5, y: headY - 1.5 });
    line(context, { x: headWidth, y: headY }, { x: headWidth + 2.5, y: headY - 1.5 });

    // --- 3. PRICKED FELINE EARS WITH DYNAMIC TWITCH ---
    // Left ear
    polyline(context, [
      { x: -headWidth * 0.75, y: headY - 1 },
      { x: -headWidth * 0.85 + leftEarFlick, y: headY - 12.5 }, // Tall outer tip with twitch
      { x: -2.2, y: headY - 4 }, // Inner ear base
    ]);
    // Left ear inner pinna ridge
    wire(context, PALETTE.catSoft, 1.0, 0.65);
    line(context, { x: -headWidth * 0.65, y: headY - 2 }, { x: -headWidth * 0.75 + leftEarFlick * 0.8, y: headY - 9.5 });

    // Right ear
    wire(context, PALETTE.cat, 2.0, 1, 5);
    polyline(context, [
      { x: headWidth * 0.75, y: headY - 1 },
      { x: headWidth * 0.85 + rightEarFlick, y: headY - 12.5 }, // Tall outer tip with twitch
      { x: 2.2, y: headY - 4 }, // Inner ear base
    ]);
    // Right ear inner pinna ridge
    wire(context, PALETTE.catSoft, 1.0, 0.65);
    line(context, { x: headWidth * 0.65, y: headY - 2 }, { x: headWidth * 0.75 + rightEarFlick * 0.8, y: headY - 9.5 });

    // --- 4. LUMINESCENT CAT EYES & NOSE ---
    if (!isEyeBlinking) {
      wire(context, PALETTE.catGlow, 1.8, 1, 4);
      // Almond angled eye contours
      polyline(context, [{ x: -5.0, y: headY - 1.5 }, { x: -2.2, y: headY - 3.0 }, { x: -1.6, y: headY - 1.2 }], true);
      polyline(context, [{ x: 5.0, y: headY - 1.5 }, { x: 2.2, y: headY - 3.0 }, { x: 1.6, y: headY - 1.2 }], true);

      // Slit pupils (vertical phosphor slits)
      line(context, { x: -3.3, y: headY - 2.8 }, { x: -3.3, y: headY - 1.4 });
      line(context, { x: 3.3, y: headY - 2.8 }, { x: 3.3, y: headY - 1.4 });
    } else {
      // Contented closed slit during blink
      wire(context, PALETTE.catGlow, 1.4, 0.8, 2);
      line(context, { x: -5.0, y: headY - 1.8 }, { x: -1.8, y: headY - 1.8 });
      line(context, { x: 5.0, y: headY - 1.8 }, { x: 1.8, y: headY - 1.8 });
    }

    // Nose leather triangle
    wire(context, PALETTE.cat, 1.2, 0.9);
    polyline(context, [{ x: -1.2, y: snoutY + 1.2 }, { x: 0, y: snoutY }, { x: 1.2, y: snoutY + 1.2 }], true);

    // --- 5. RESPONSIVE VIBRISSAE (WHISKERS) ---
    // Whiskers fan back slightly during hop forward
    const whiskerLag = isHopping ? pawReach * 0.35 : 0;
    wire(context, PALETTE.catSoft, 1.1, 0.8);
    // Left whiskers
    line(context, { x: -2.5, y: snoutY + 1 }, { x: -13, y: snoutY - 2 + whiskerLag });
    line(context, { x: -2.5, y: snoutY + 2 }, { x: -14, y: snoutY + 3 + whiskerLag });
    line(context, { x: -2.5, y: snoutY + 3 }, { x: -12, y: snoutY + 8 + whiskerLag });
    // Right whiskers
    line(context, { x: 2.5, y: snoutY + 1 }, { x: 13, y: snoutY - 2 + whiskerLag });
    line(context, { x: 2.5, y: snoutY + 2 }, { x: 14, y: snoutY + 3 + whiskerLag });
    line(context, { x: 2.5, y: snoutY + 3 }, { x: 12, y: snoutY + 8 + whiskerLag });

    // --- 6. PAWS (ANIMATED REACH & STANCE) ---
    wire(context, PALETTE.cat, 1.8, 1, 4);
    // Front paws: reach forward during leap
    const flPawY = bodyTop - 3.5 - pawReach;
    const frPawY = bodyTop - 3.5 - pawReach;
    // Paws with toe beans
    circle(context, { x: -shoulderWidth + 1, y: flPawY }, 2.3);
    circle(context, { x: shoulderWidth - 1, y: frPawY }, 2.3);
    if (isHopping && hopProgress > 0.3 && hopProgress < 0.7) {
      // Extended claw tips during mid-air leap
      wire(context, PALETTE.catGlow, 1.2, 0.9);
      line(context, { x: -shoulderWidth + 0.5, y: flPawY - 2 }, { x: -shoulderWidth + 0.5, y: flPawY - 4.5 });
      line(context, { x: shoulderWidth - 0.5, y: frPawY - 2 }, { x: shoulderWidth - 0.5, y: frPawY - 4.5 });
    }

    // Rear haunches & trailing paws
    wire(context, PALETTE.cat, 1.8, 1, 4);
    const rlPawY = bodyBottom + 2.5 + (isHopping ? pawReach * 0.8 : 0);
    const rrPawY = bodyBottom + 2.5 + (isHopping ? pawReach * 0.8 : 0);
    circle(context, { x: -hipWidth + 1.2, y: rlPawY }, 2.5);
    circle(context, { x: hipWidth - 1.2, y: rrPawY }, 2.5);

    // --- 7. DYNAMIC SINUOUS S-CURVE TAIL ---
    wire(context, PALETTE.cat, 2.0, 1, 5);
    const tailBaseX = 0;
    const tailBaseY = bodyBottom;
    const p1X = tailBaseX + tailWave1 * 0.6;
    const p1Y = tailBaseY + 8;
    const p2X = tailBaseX + tailWave2 * 0.9;
    const p2Y = tailBaseY + 16;
    const p3X = tailBaseX + tailWave3 * 1.1;
    const p3Y = tailBaseY + 23;

    curve(
      context,
      { x: tailBaseX, y: tailBaseY },
      { x: p1X, y: p1Y },
      { x: p2X, y: p2Y },
      { x: p3X, y: p3Y },
    );

    // Fluffy tail tip curl
    wire(context, PALETTE.catGlow, 1.6, 0.9, 3);
    circle(context, { x: p3X, y: p3Y }, 1.5);
  });
}
