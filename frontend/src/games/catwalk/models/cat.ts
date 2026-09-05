import { PALETTE } from '../rendering/palette';
import { circle, curve, line, polyline, wire, withTransform } from '../rendering/primitives';

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
  const isBlinking = pose.invulnerable && Math.floor(pose.phase * 24) % 2 === 0;
  if (isBlinking) return;

  const hopArc = pose.action === 'hop' ? Math.sin(Math.min(1, pose.phase % 1) * Math.PI) : 0;
  const hopLift = hopArc * 7;
  const stride = pose.action === 'hop' ? Math.sin(pose.phase * Math.PI * 2) * 6 : 0;
  const tailSway = Math.sin(pose.phase * 3.5) * 4;
  const idleBreathe = pose.action === 'idle' ? Math.sin(pose.phase * 2.8) * 0.7 : 0;

  // Direction angle: up is default 0, right is PI/2, down is PI, left is -PI/2
  const rotation =
    pose.direction === 'up'
      ? 0
      : pose.direction === 'right'
        ? Math.PI / 2
        : pose.direction === 'down'
          ? Math.PI
          : -Math.PI / 2;

  withTransform(context, { x: pose.x, y: pose.y - hopLift }, rotation, 1, 1, () => {
    // Subtle vector glow for the protagonist cat
    wire(context, PALETTE.cat, 2.0, 1, 6);

    // --- 1. SLEEK FELINE TORSO (Top-Down / 3/4 Perspective) ---
    // Tail at +Y (behind), Head at -Y (front)
    const shoulderWidth = 8.5;
    const waistWidth = 6.0;
    const hipWidth = 9.0;
    const bodyTop = -6;
    const bodyBottom = 14;

    context.beginPath();
    // Spine & flank contour
    context.moveTo(-shoulderWidth, bodyTop); // Left shoulder
    context.quadraticCurveTo(-shoulderWidth - 1, (bodyTop + bodyBottom) * 0.3, -waistWidth, (bodyTop + bodyBottom) * 0.5); // Waist taper
    context.quadraticCurveTo(-hipWidth - idleBreathe, bodyBottom * 0.8, -hipWidth * 0.8, bodyBottom); // Left hip flare
    context.quadraticCurveTo(0, bodyBottom + 2, hipWidth * 0.8, bodyBottom); // Rump curve
    context.quadraticCurveTo(hipWidth + idleBreathe, bodyBottom * 0.8, waistWidth, (bodyTop + bodyBottom) * 0.5); // Right flank
    context.quadraticCurveTo(shoulderWidth + 1, (bodyTop + bodyBottom) * 0.3, shoulderWidth, bodyTop); // Right shoulder
    context.quadraticCurveTo(0, bodyTop - 2, -shoulderWidth, bodyTop); // Chest crest
    context.closePath();
    context.stroke();

    // Subtle feline spine line
    wire(context, PALETTE.catSoft, 1.2, 0.45);
    line(context, { x: 0, y: bodyTop + 2 }, { x: 0, y: bodyBottom - 2 });

    // --- 2. FELINE HEAD (Heart/triangular wedge with prominent cheek ruffs) ---
    wire(context, PALETTE.cat, 2.0, 1, 6);
    const headY = -14;
    const headWidth = 9.5;
    const snoutY = headY - 6.5;

    context.beginPath();
    context.moveTo(-headWidth, headY); // Left cheek
    context.quadraticCurveTo(-headWidth * 0.7, snoutY + 1, -2.5, snoutY); // Left cheekbone to muzzle
    context.lineTo(0, snoutY - 1); // Nose tip point
    context.lineTo(2.5, snoutY); // Right muzzle
    context.quadraticCurveTo(headWidth * 0.7, snoutY + 1, headWidth, headY); // Right cheek
    context.quadraticCurveTo(headWidth * 0.6, headY + 5, 0, headY + 5); // Chin / throat
    context.quadraticCurveTo(-headWidth * 0.6, headY + 5, -headWidth, headY);
    context.closePath();
    context.stroke();

    // --- 3. PRICKED FELINE EARS (Sharp alert triangles set high on skull) ---
    // Left ear
    polyline(context, [
      { x: -headWidth * 0.75, y: headY - 1 },
      { x: -headWidth * 0.85, y: headY - 12 }, // Tall outer tip
      { x: -2, y: headY - 4 }, // Inner ear base
    ]);
    // Left ear inner pinna detail
    wire(context, PALETTE.catSoft, 1.0, 0.6);
    line(context, { x: -headWidth * 0.65, y: headY - 2 }, { x: -headWidth * 0.75, y: headY - 9 });

    // Right ear
    wire(context, PALETTE.cat, 2.0, 1, 6);
    polyline(context, [
      { x: headWidth * 0.75, y: headY - 1 },
      { x: headWidth * 0.85, y: headY - 12 }, // Tall outer tip
      { x: 2, y: headY - 4 }, // Inner ear base
    ]);
    // Right ear inner pinna detail
    wire(context, PALETTE.catSoft, 1.0, 0.6);
    line(context, { x: headWidth * 0.65, y: headY - 2 }, { x: headWidth * 0.75, y: headY - 9 });

    // --- 4. ALMOND EYES & NOSE LEATHER ---
    wire(context, PALETTE.catGlow, 1.6, 1, 4);
    // Slanted feline almond eyes
    polyline(context, [{ x: -4.5, y: headY - 1.5 }, { x: -2, y: headY - 2.5 }, { x: -1.5, y: headY - 1 }]);
    polyline(context, [{ x: 4.5, y: headY - 1.5 }, { x: 2, y: headY - 2.5 }, { x: 1.5, y: headY - 1 }]);

    // Tiny nose triangle
    polyline(context, [{ x: -1, y: snoutY + 1 }, { x: 0, y: snoutY }, { x: 1, y: snoutY + 1 }], true);

    // --- 5. EXTENDED VIBRISSAE (WHISKERS) ---
    wire(context, PALETTE.catSoft, 1.1, 0.75);
    line(context, { x: -2.5, y: snoutY + 1 }, { x: -12, y: snoutY - 2 });
    line(context, { x: -2.5, y: snoutY + 2 }, { x: -13, y: snoutY + 3 });
    line(context, { x: 2.5, y: snoutY + 1 }, { x: 12, y: snoutY - 2 });
    line(context, { x: 2.5, y: snoutY + 2 }, { x: 13, y: snoutY + 3 });

    // --- 6. PAWS (ANIMATED HOPPING / WALKING STRIDE) ---
    wire(context, PALETTE.cat, 1.8, 1, 4);
    // Front paws
    const flPawY = bodyTop - 3 - stride;
    const frPawY = bodyTop - 3 + stride;
    circle(context, { x: -shoulderWidth + 1, y: flPawY }, 2.2);
    circle(context, { x: shoulderWidth - 1, y: frPawY }, 2.2);

    // Rear haunches and paws
    const rlPawY = bodyBottom + 2 + stride;
    const rrPawY = bodyBottom + 2 - stride;
    circle(context, { x: -hipWidth + 1, y: rlPawY }, 2.4);
    circle(context, { x: hipWidth - 1, y: rrPawY }, 2.4);

    // --- 7. SINUOUS S-CURVE FELINE TAIL ---
    wire(context, PALETTE.cat, 2.0, 1, 5);
    curve(
      context,
      { x: 0, y: bodyBottom },
      { x: -5 + tailSway, y: bodyBottom + 8 },
      { x: 6 + tailSway, y: bodyBottom + 16 },
      { x: 2 + tailSway * 1.4, y: bodyBottom + 22 },
    );
  });
}
