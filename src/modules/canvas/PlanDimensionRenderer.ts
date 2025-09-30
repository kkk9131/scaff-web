import type { EdgeDimension } from '../../context/BuildingProvider';
import type { Point } from '../floorplan/types';

export type DimensionSide = 'top' | 'bottom' | 'left' | 'right';
export type DimensionOrientation = 'horizontal' | 'vertical';

export interface DimensionLabel {
  id: string;
  text: string;
  position: Point;
  side: DimensionSide;
}

export interface DimensionTick {
  id: string;
  start: Point;
  end: Point;
}

export interface DimensionLineData {
  id: string;
  start: Point;
  end: Point;
  ticks: DimensionTick[];
  labels: DimensionLabel[];
  orientation: DimensionOrientation;
  side: DimensionSide;
}

export interface PlanDimensionGroup {
  id: string;
  side: DimensionSide;
  orientation: DimensionOrientation;
  segment: DimensionLineData | null;
  total: DimensionLineData | null;
}

export interface PlanEaveDimensionLine {
  id: string;
  side: DimensionSide;
  orientation: DimensionOrientation;
  line: DimensionLineData;
}

interface EdgeProjection {
  edgeId: string;
  dimensionLength: number;
  offset: number;
  startCoord: number;
  endCoord: number;
  baseCoord: number;
  orientation: DimensionOrientation;
  side: DimensionSide;
  index: number;
  startPoint: Point;
  endPoint: Point;
}

interface DimensionSequence {
  id: string;
  side: DimensionSide;
  orientation: DimensionOrientation;
  baseCoord: number;
  startCoord: number;
  endCoord: number;
  maxOffset: number;
  totalLength: number;
  segments: {
    id: string;
    startCoord: number;
    endCoord: number;
    length: number;
    offset: number;
    edgeIndex: number;
  }[];
  edges: EdgeProjection[];
  orientationSign: number;
}

interface BuildDimensionsOptions {
  segmentGap?: number;
  totalGap?: number;
  tickLength?: number;
  labelOffset?: number;
  eaveGap?: number;
}

const EPSILON = 1e-6;
const DEFAULT_SEGMENT_GAP = 300;
const DEFAULT_TOTAL_GAP = 500;
const DEFAULT_TICK_LENGTH = 80;
const DEFAULT_LABEL_OFFSET = 80;
const DEFAULT_EAVE_GAP = 200;

const roundPoint = ({ x, y }: Point): Point => ({
  x: Math.round(x * 1000) / 1000,
  y: Math.round(y * 1000) / 1000
});

const polygonOrientation = (points: Point[]): number => {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum >= 0 ? 1 : -1;
};

const computeOutwardNormal = (start: Point, end: Point, orientation: number) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (orientation > 0) {
    return { x: dy, y: -dx };
  }
  return { x: -dy, y: dx };
};

const classifyEdge = (
  index: number,
  points: Point[],
  dimensions: EdgeDimension[],
  orientationSign: number
): EdgeProjection | null => {
  const start = points[index];
  const end = points[(index + 1) % points.length];
  const dimension = dimensions[index];
  if (!start || !end || !dimension) {
    return null;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;

  const isHorizontal = Math.abs(dy) <= Math.abs(dx);
  const isVertical = Math.abs(dx) < Math.abs(dy);

  if (!isHorizontal && !isVertical) {
    return null;
  }

  const normal = computeOutwardNormal(start, end, orientationSign);

  if (isHorizontal) {
    const side: DimensionSide = normal.y < 0 ? 'top' : 'bottom';
    const startCoord = Math.min(start.x, end.x);
    const endCoord = Math.max(start.x, end.x);
    const baseCoord = (start.y + end.y) / 2;
    return {
      edgeId: dimension.edgeId,
      dimensionLength: Math.round(dimension.length),
      offset: Math.max(0, dimension.offset),
      startCoord,
      endCoord,
      baseCoord,
      orientation: 'horizontal',
      side,
      index,
      startPoint: start,
      endPoint: end
    };
  }

  const side: DimensionSide = normal.x < 0 ? 'left' : 'right';
  const startCoord = Math.min(start.y, end.y);
  const endCoord = Math.max(start.y, end.y);
  const baseCoord = (start.x + end.x) / 2;
  return {
    edgeId: dimension.edgeId,
    dimensionLength: Math.round(dimension.length),
    offset: Math.max(0, dimension.offset),
    startCoord,
    endCoord,
    baseCoord,
    orientation: 'vertical',
    side,
    index,
    startPoint: start,
    endPoint: end
  };
};

const buildSequenceForSide = (
  side: DimensionSide,
  edges: EdgeProjection[],
  orientationSign: number
): DimensionSequence | null => {
  if (!edges.length) {
    return null;
  }

  const normalizedEdges = edges
    .map((edge) => ({
      ...edge,
      startCoord: Math.min(edge.startCoord, edge.endCoord),
      endCoord: Math.max(edge.startCoord, edge.endCoord)
    }))
    .sort((a, b) => a.startCoord - b.startCoord || a.index - b.index);

  const startCoord = normalizedEdges.reduce(
    (min, edge) => Math.min(min, edge.startCoord),
    Number.POSITIVE_INFINITY
  );
  const endCoord = normalizedEdges.reduce(
    (max, edge) => Math.max(max, edge.endCoord),
    Number.NEGATIVE_INFINITY
  );

  if (endCoord - startCoord < EPSILON) {
    return null;
  }

  const totalLength = Math.round(endCoord - startCoord);
  const maxOffset = normalizedEdges.reduce((max, edge) => Math.max(max, edge.offset), 0);

  const comparator = side === 'top' || side === 'left' ? Math.min : Math.max;
  const outerCoord = normalizedEdges.reduce(
    (acc, edge) => comparator(acc, edge.baseCoord),
    normalizedEdges[0].baseCoord
  );

  const segments = normalizedEdges.map((edge) => ({
    id: edge.edgeId,
    startCoord: edge.startCoord,
    endCoord: edge.endCoord,
    length: edge.dimensionLength,
    offset: edge.offset,
    edgeIndex: edge.index
  }));

  return {
    id: `${side}-sequence`,
    side,
    orientation: normalizedEdges[0].orientation,
    baseCoord: outerCoord,
    startCoord,
    endCoord,
    maxOffset,
    totalLength,
    segments,
    edges: normalizedEdges,
    orientationSign
  };
};

const collectSequencesBySide = (
  polygon: Point[],
  dimensions: EdgeDimension[]
): Map<DimensionSide, DimensionSequence> => {
  const sequences = new Map<DimensionSide, DimensionSequence>();

  if (polygon.length < 2 || polygon.length !== dimensions.length) {
    return sequences;
  }

  const orientationSign = polygonOrientation(polygon);
  const projections: EdgeProjection[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const projection = classifyEdge(i, polygon, dimensions, orientationSign);
    if (projection) {
      projections.push(projection);
    }
  }

  const groups = new Map<DimensionSide, EdgeProjection[]>();
  projections.forEach((projection) => {
    if (!groups.has(projection.side)) {
      groups.set(projection.side, []);
    }
    groups.get(projection.side)!.push(projection);
  });

  (['top', 'bottom', 'left', 'right'] as DimensionSide[]).forEach((side) => {
    const edges = groups.get(side);
    if (!edges || !edges.length) return;
    const sequence = buildSequenceForSide(side, edges, orientationSign);
    if (sequence) {
      sequences.set(side, sequence);
    }
  });

  return sequences;
};

const buildLineData = (
  sequence: DimensionSequence,
  type: 'segment' | 'total',
  options?: BuildDimensionsOptions
): DimensionLineData | null => {
  const segmentGap = options?.segmentGap ?? DEFAULT_SEGMENT_GAP;
  const totalGap = options?.totalGap ?? DEFAULT_TOTAL_GAP;
  const tickLength = options?.tickLength ?? DEFAULT_TICK_LENGTH;
  const labelOffset = options?.labelOffset ?? DEFAULT_LABEL_OFFSET;
  const baseLabelOffset = options?.labelOffset ?? DEFAULT_LABEL_OFFSET;
  const effectiveLabelOffset = type === 'total' ? baseLabelOffset * 1.8 : baseLabelOffset;

  if (sequence.endCoord - sequence.startCoord < EPSILON) {
    return null;
  }

  const gap = type === 'segment' ? segmentGap : totalGap;
  const direction = sequence.side === 'top' || sequence.side === 'left' ? -1 : 1;
  const lineCoord = sequence.baseCoord + direction * (sequence.maxOffset + gap);

  const startPoint = sequence.orientation === 'horizontal'
    ? { x: sequence.startCoord, y: lineCoord }
    : { x: lineCoord, y: sequence.startCoord };
  const endPoint = sequence.orientation === 'horizontal'
    ? { x: sequence.endCoord, y: lineCoord }
    : { x: lineCoord, y: sequence.endCoord };

  const ticks: DimensionTick[] = [];

  const tickPositions: number[] = [];
  const pushTickPosition = (position: number) => {
    const exists = tickPositions.some((value) => Math.abs(value - position) < EPSILON);
    if (!exists) {
      tickPositions.push(position);
    }
  };

  if (type === 'segment') {
    const boundarySet = new Set<number>();
    boundarySet.add(sequence.startCoord);
    boundarySet.add(sequence.endCoord);
    sequence.segments.forEach((segment) => {
      boundarySet.add(segment.startCoord);
      boundarySet.add(segment.endCoord);
    });

    const boundaries = Array.from(boundarySet).sort((a, b) => a - b);
    if (boundaries.length <= 2) {
      return null;
    }

    boundaries.forEach(pushTickPosition);

    const labels: DimensionLabel[] = [];
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const startBoundary = boundaries[index];
      const endBoundary = boundaries[index + 1];
      const length = Math.round(endBoundary - startBoundary);
      if (length <= 0) {
        continue;
      }
      const mid = (startBoundary + endBoundary) / 2;
      const position = sequence.orientation === 'horizontal'
        ? {
            x: mid,
            y:
              lineCoord + (sequence.side === 'top' ? -effectiveLabelOffset : effectiveLabelOffset)
          }
        : {
            x:
              lineCoord + (sequence.side === 'left' ? -effectiveLabelOffset : effectiveLabelOffset),
            y: mid
          };
      labels.push({
        id: `${sequence.id}-${type}-label-${index}`,
        text: length.toString(),
        position: roundPoint(position),
        side: sequence.side
      });
    }

    if (!labels.length) {
      return null;
    }

    boundaries.forEach((boundary, index) => {
      if (sequence.orientation === 'horizontal') {
        const start = { x: boundary, y: lineCoord - tickLength / 2 };
        const end = { x: boundary, y: lineCoord + tickLength / 2 };
        ticks.push({
          id: `${sequence.id}-${type}-tick-${index}`,
          start: roundPoint(start),
          end: roundPoint(end)
        });
      } else {
        const start = { x: lineCoord - tickLength / 2, y: boundary };
        const end = { x: lineCoord + tickLength / 2, y: boundary };
        ticks.push({
          id: `${sequence.id}-${type}-tick-${index}`,
          start: roundPoint(start),
          end: roundPoint(end)
        });
      }
    });

    return {
      id: `${sequence.id}-${type}`,
      start: roundPoint(startPoint),
      end: roundPoint(endPoint),
      ticks,
      labels,
      orientation: sequence.orientation,
      side: sequence.side
    };
  } else {
    pushTickPosition(sequence.startCoord);
    pushTickPosition(sequence.endCoord);
  }

  tickPositions.sort((a, b) => a - b);

  tickPositions.forEach((position, index) => {
    if (sequence.orientation === 'horizontal') {
      const start = { x: position, y: lineCoord - tickLength / 2 };
      const end = { x: position, y: lineCoord + tickLength / 2 };
      ticks.push({
        id: `${sequence.id}-${type}-tick-${index}`,
        start: roundPoint(start),
        end: roundPoint(end)
      });
      return;
    }
    const start = { x: lineCoord - tickLength / 2, y: position };
    const end = { x: lineCoord + tickLength / 2, y: position };
    ticks.push({
      id: `${sequence.id}-${type}-tick-${index}`,
      start: roundPoint(start),
      end: roundPoint(end)
    });
  });

  const labels: DimensionLabel[] = [];

  if (type === 'segment') {
    // handled earlier
  } else {
    const mid = (sequence.startCoord + sequence.endCoord) / 2;
    const total = sequence.totalLength;
    const position = sequence.orientation === 'horizontal'
      ? {
          x: mid,
          y: lineCoord + (sequence.side === 'top' ? -effectiveLabelOffset : effectiveLabelOffset)
        }
      : {
          x: lineCoord + (sequence.side === 'left' ? -effectiveLabelOffset : effectiveLabelOffset),
          y: mid
        };
    labels.push({
      id: `${sequence.id}-${type}-label-total`,
      text: total.toString(),
      position: roundPoint(position),
      side: sequence.side
    });
  }

  return {
    id: `${sequence.id}-${type}`,
    start: roundPoint(startPoint),
    end: roundPoint(endPoint),
    ticks,
    labels,
    orientation: sequence.orientation,
    side: sequence.side
  };
};

export const buildPlanDimensionGroups = (
  polygon: Point[],
  dimensions: EdgeDimension[],
  options?: BuildDimensionsOptions
): PlanDimensionGroup[] => {
  const result: PlanDimensionGroup[] = [];
  const sequences = collectSequencesBySide(polygon, dimensions);

  (['top', 'bottom', 'left', 'right'] as DimensionSide[]).forEach((side) => {
    const sequence = sequences.get(side);
    if (!sequence) return;
    const segmentLine = sequence.segments.length > 1
      ? buildLineData(sequence, 'segment', options)
      : null;
    const totalLine = buildLineData(sequence, 'total', options);
    if (!segmentLine && !totalLine) return;
    result.push({
      id: `${side}`,
      side,
      orientation: sequence.orientation,
      segment: segmentLine,
      total: totalLine
    });
  });

  return result;
};

export const buildPlanEaveDimensionLines = (
  _polygon: Point[],
  _dimensions: EdgeDimension[],
  _options?: BuildDimensionsOptions
): PlanEaveDimensionLine[] => [];
