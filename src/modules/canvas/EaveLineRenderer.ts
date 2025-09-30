import type { EdgeDimension } from '../../context/BuildingProvider';
import type { Point } from '../floorplan/types';

export interface RenderEaveInput {
  polygon: Point[];
  dimensions: EdgeDimension[];
  strokeColor: string;
}

export interface RenderedEaveSegment {
  edgeId: string;
  color: string;
  points: [Point, Point];
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

const roundPoint = ({ x, y }: Point): Point => ({ x: round(x), y: round(y) });

const polygonOrientation = (points: Point[]): number => {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum >= 0 ? 1 : -1;
};

interface OffsetLine {
  start: Point;
  end: Point;
}

const computeOffsetLine = (
  start: Point,
  end: Point,
  offset: number,
  orientation: number
): OffsetLine => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return {
      start: roundPoint(start),
      end: roundPoint(end)
    };
  }
  const normalX = orientation > 0 ? dy : -dy;
  const normalY = orientation > 0 ? -dx : dx;
  const factor = offset / length;
  const shiftX = normalX * factor;
  const shiftY = normalY * factor;
  return {
    start: roundPoint({ x: start.x + shiftX, y: start.y + shiftY }),
    end: roundPoint({ x: end.x + shiftX, y: end.y + shiftY })
  };
};

const intersectLines = (a: OffsetLine, b: OffsetLine): Point | null => {
  const x1 = a.start.x;
  const y1 = a.start.y;
  const x2 = a.end.x;
  const y2 = a.end.y;
  const x3 = b.start.x;
  const y3 = b.start.y;
  const x4 = b.end.x;
  const y4 = b.end.y;

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 1e-6) {
    return null;
  }

  const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denominator;
  const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denominator;
  return roundPoint({ x: px, y: py });
};

export const buildEaveSegmentsForRendering = ({
  polygon,
  dimensions,
  strokeColor
}: RenderEaveInput): RenderedEaveSegment[] => {
  if (polygon.length < 3 || polygon.length !== dimensions.length) {
    return [];
  }

  const orientation = polygonOrientation(polygon);
  const offsetLines: OffsetLine[] = polygon.map((point, index) => {
    const nextPoint = polygon[(index + 1) % polygon.length];
    const dimension = dimensions[index];
    const offset = dimension?.offset ?? 0;
    return computeOffsetLine(point, nextPoint, offset, orientation);
  });

  const intersections: Point[] = offsetLines.map((line, index) => {
    const prev = offsetLines[(index - 1 + offsetLines.length) % offsetLines.length];
    return intersectLines(prev, line) ?? roundPoint(line.start);
  });

  const total = polygon.length;
  const segments: RenderedEaveSegment[] = [];

  for (let index = 0; index < total; index += 1) {
    const dimension = dimensions[index];
    const offset = dimension?.offset ?? 0;
    const baseId = dimension?.edgeId ?? `edge-${index}`;
    const nextIndex = (index + 1) % total;

    if (offset > 0) {
      segments.push({
        edgeId: baseId,
        color: strokeColor,
        points: [intersections[index], intersections[nextIndex]]
      });
      continue;
    }

    const prevIndex = (index - 1 + total) % total;
    const prevOffset = dimensions[prevIndex]?.offset ?? 0;
    const nextOffset = dimensions[nextIndex]?.offset ?? 0;

    if (prevOffset > 0) {
      segments.push({
        edgeId: `${baseId}-connector-in`,
        color: strokeColor,
        points: [intersections[index], roundPoint(polygon[index])]
      });
    }

    if (nextOffset > 0) {
      segments.push({
        edgeId: `${baseId}-connector-out`,
        color: strokeColor,
        points: [roundPoint(polygon[nextIndex]), intersections[nextIndex]]
      });
    }
  }

  return segments;
};
