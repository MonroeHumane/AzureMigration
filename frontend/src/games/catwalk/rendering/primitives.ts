export interface Point {
  x: number;
  y: number;
}

export function wire(context: CanvasRenderingContext2D, color: string, width = 2, alpha = 1): void {
  context.strokeStyle = color;
  context.lineWidth = width;
  context.globalAlpha = alpha;
  context.lineCap = 'round';
  context.lineJoin = 'round';
}

export function line(context: CanvasRenderingContext2D, start: Point, end: Point): void {
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

export function polyline(context: CanvasRenderingContext2D, points: Point[], close = false): void {
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  if (close) context.closePath();
  context.stroke();
}

export function ellipse(
  context: CanvasRenderingContext2D,
  center: Point,
  radiusX: number,
  radiusY: number,
  rotation = 0,
): void {
  context.beginPath();
  context.ellipse(center.x, center.y, radiusX, radiusY, rotation, 0, Math.PI * 2);
  context.stroke();
}

export function circle(context: CanvasRenderingContext2D, center: Point, radius: number): void {
  ellipse(context, center, radius, radius);
}

export function curve(
  context: CanvasRenderingContext2D,
  start: Point,
  controlA: Point,
  controlB: Point,
  end: Point,
): void {
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.bezierCurveTo(controlA.x, controlA.y, controlB.x, controlB.y, end.x, end.y);
  context.stroke();
}

export function jointedLimb(
  context: CanvasRenderingContext2D,
  hip: Point,
  knee: Point,
  paw: Point,
  jointRadius = 1.8,
): void {
  polyline(context, [hip, knee, paw]);
  circle(context, knee, jointRadius);
}

export function withTransform(
  context: CanvasRenderingContext2D,
  position: Point,
  rotation: number,
  scaleX: number,
  scaleY: number,
  draw: () => void,
): void {
  context.save();
  context.translate(position.x, position.y);
  context.rotate(rotation);
  context.scale(scaleX, scaleY);
  draw();
  context.restore();
}