import type { EdgeDimension } from '../context/BuildingProvider';
import type { Point } from '../modules/floorplan/types';

export interface EaveSegment {
  edgeId: string;
  points: [Point, Point];
}

const polygonOrientation = (points: Point[]): number => {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum >= 0 ? 1 : -1;
};

const normalizePoint = (value: number): number => Math.round(value);

export const buildEaveSegments = (polygon: Point[], dimensions: EdgeDimension[]): EaveSegment[] => {
  if (polygon.length < 2) {
    return [];
  }

  const orientation = polygonOrientation(polygon);
  const segments: EaveSegment[] = [];

  for (let i = 0; i < polygon.length; i += 1) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];
    const dimension = dimensions[i];
    const offset = dimension?.offset ?? 0;
    if (!dimension || offset <= 0) {
      continue;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      continue;
    }

    const normalX = orientation > 0 ? dy : -dy;
    const normalY = orientation > 0 ? -dx : dx;
    const factor = offset / length;
    const offsetX = normalX * factor;
    const offsetY = normalY * factor;

    const shiftedStart: Point = {
      x: normalizePoint(start.x + offsetX),
      y: normalizePoint(start.y + offsetY)
    };
    const shiftedEnd: Point = {
      x: normalizePoint(end.x + offsetX),
      y: normalizePoint(end.y + offsetY)
    };

    segments.push({
      edgeId: dimension.edgeId,
      points: [shiftedStart, shiftedEnd]
    });
  }

  return segments;
};
