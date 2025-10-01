import {
  createInitialBuildingModel,
  validateBuildingModel,
  type BuildingModel,
  type FloorModel,
  type Point,
  type RoofConfig
} from '../context/BuildingProvider';

export type ElevationDirection = 'north' | 'south' | 'east' | 'west';

export interface ElevationOutlineFragment {
  id: string;
  points: Point[];
  roofLine: [Point, Point];
}

export interface ElevationOutline {
  floorId: string;
  outline: Point[];
  base: number;
  height: number;
  roof: RoofConfig;
  color: string;
  fragments?: ElevationOutlineFragment[];
}

export interface ElevationEaveLine {
  floorId: string;
  start: Point;
  end: Point;
  offset: number;
  visible: boolean;
  color: string;
}

export interface ElevationDimensionLine {
  floorId: string;
  start: Point;
  end: Point;
  label: string;
  orientation: 'vertical' | 'horizontal' | 'offset';
}

export interface ElevationView {
  direction: ElevationDirection;
  dimensionLabel: string;
  dimensionValue: number;
  baseStart: number;
  baseEnd: number;
  floors: ElevationOutline[];
  roofLabel: string;
  totalHeight: number;
  showDimensions: boolean;
  heightDimensions: ElevationDimensionLine[];
  eaveLines: ElevationEaveLine[];
  eaveDimensions: ElevationDimensionLine[];
  roofColor: string;
  roofOutline: Point[];
}

export interface ElevationComputation {
  ok: boolean;
  views: ElevationView[];
  error?: string;
}

export interface MeshPoint {
  x: number;
  y: number;
  z: number;
}

export interface ExtrusionPolygon {
  bottom: MeshPoint[];
  top: MeshPoint[];
}

export interface ThreeDMesh {
  floorId: string;
  base: number;
  height: number;
  roof: RoofConfig;
  polygon: ExtrusionPolygon;
  color: string;
}

export interface ThreeDResult {
  ok: boolean;
  meshes: ThreeDMesh[];
  error?: string;
}

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const DIRECTIONS: ElevationDirection[] = ['north', 'south', 'east', 'west'];

const sanitizeRoof = (roof: RoofConfig): RoofConfig => {
  const allowed: RoofConfig['type'][] = ['flat', 'mono', 'gable', 'hip'];
  const type = allowed.includes(roof.type) ? roof.type : 'flat';
  let slopeValue = Number.isFinite(roof.slopeValue) ? Math.max(0, roof.slopeValue) : 0;
  let ridgeHeight = Number.isFinite(roof.ridgeHeight)
    ? Math.max(roof.ridgeHeight, 0)
    : Math.max(slopeValue, 0);
  let parapetHeight = Number.isFinite(roof.parapetHeight)
    ? Math.max(roof.parapetHeight, 0)
    : 0;

  if (type === 'flat') {
    slopeValue = 0;
  } else {
    parapetHeight = 0;
  }

  if (type === 'flat') {
    ridgeHeight = Math.max(ridgeHeight, parapetHeight);
  }

  return { type, slopeValue, ridgeHeight, parapetHeight };
};

const boundingBox = (polygon: Point[]): BoundingBox => {
  if (!polygon.length) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  return polygon.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y)
    }),
    {
      minX: polygon[0].x,
      maxX: polygon[0].x,
      minY: polygon[0].y,
      maxY: polygon[0].y
    }
  );
};

const createDimensionLabel = (value: number): string => `|──${Math.round(value)}──|`;

const DIRECTION_TOLERANCE = 1e-6;

const edgeMatchesDirection = (
  start: Point,
  end: Point,
  box: BoundingBox,
  direction: ElevationDirection
): boolean => {
  switch (direction) {
    case 'north':
      return (
        Math.abs(start.y - box.maxY) <= DIRECTION_TOLERANCE &&
        Math.abs(end.y - box.maxY) <= DIRECTION_TOLERANCE
      );
    case 'south':
      return (
        Math.abs(start.y - box.minY) <= DIRECTION_TOLERANCE &&
        Math.abs(end.y - box.minY) <= DIRECTION_TOLERANCE
      );
    case 'east':
      return (
        Math.abs(start.x - box.maxX) <= DIRECTION_TOLERANCE &&
        Math.abs(end.x - box.maxX) <= DIRECTION_TOLERANCE
      );
    case 'west':
      return (
        Math.abs(start.x - box.minX) <= DIRECTION_TOLERANCE &&
        Math.abs(end.x - box.minX) <= DIRECTION_TOLERANCE
      );
    default:
      return false;
  }
};

interface ProjectionOptions {
  useWidth: boolean;
  origin: number;
  widthMin: number;
  widthMax: number;
  leftOverhang: number;
  rightOverhang: number;
  extendToOverhang?: boolean;
}

const projectEdgeToView = (
  start: Point,
  end: Point,
  options: ProjectionOptions
): [number, number] => {
  const axisKey = options.useWidth ? 'x' : 'y';
  let minCoord = Math.min(start[axisKey], end[axisKey]);
  let maxCoord = Math.max(start[axisKey], end[axisKey]);

  if (options.extendToOverhang) {
    const touchesMin =
      Math.abs(start[axisKey] - options.widthMin) <= DIRECTION_TOLERANCE ||
      Math.abs(end[axisKey] - options.widthMin) <= DIRECTION_TOLERANCE;
    const touchesMax =
      Math.abs(start[axisKey] - options.widthMax) <= DIRECTION_TOLERANCE ||
      Math.abs(end[axisKey] - options.widthMax) <= DIRECTION_TOLERANCE;

    if (touchesMin) {
      minCoord = Math.min(minCoord, options.widthMin - options.leftOverhang);
    }
    if (touchesMax) {
      maxCoord = Math.max(maxCoord, options.widthMax + options.rightOverhang);
    }
  }

  return [minCoord - options.origin, maxCoord - options.origin];
};

const createHeightDimension = (
  floorId: string,
  xPosition: number,
  base: number,
  height: number
): ElevationDimensionLine => ({
  floorId,
  start: { x: xPosition, y: base },
  end: { x: xPosition, y: base + height },
  label: `${Math.round(height)}`,
  orientation: 'vertical'
});

const createEaveDimension = (
  floorId: string,
  xPosition: number,
  base: number,
  offset: number
): ElevationDimensionLine => ({
  floorId,
  start: { x: xPosition, y: base },
  end: { x: xPosition, y: base + offset },
  label: `${Math.round(offset)}`,
  orientation: 'offset'
});

interface OutlineFragmentOptions {
  base: number;
  height: number;
  floorId: string;
  direction: ElevationDirection;
  segments: Array<{ start: number; end: number }>;
}

const SEGMENT_TOLERANCE = 1e-3;

const normalizeSegments = (
  segments: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> =>
  segments
    .map((segment) => ({
      start: Math.min(segment.start, segment.end),
      end: Math.max(segment.start, segment.end)
    }))
    .filter((segment) => segment.end - segment.start > SEGMENT_TOLERANCE);

const mergeSegments = (
  segments: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> => {
  if (!segments.length) {
    return [];
  }

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [
    { ...sorted[0] }
  ];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];
    if (current.start <= last.end + SEGMENT_TOLERANCE) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
};

const buildOutlineFragments = ({
  base,
  height,
  floorId,
  direction,
  segments
}: OutlineFragmentOptions): ElevationOutlineFragment[] => {
  const mergedSegments = mergeSegments(normalizeSegments(segments));
  return mergedSegments.map((segment, index) => {
    const top = base + height;
    const startPoint = { x: segment.start, y: base };
    const endPoint = { x: segment.end, y: base };
    return {
      id: `${floorId}-${direction}-fragment-${index}`,
      points: [
        startPoint,
        { x: segment.start, y: top },
        { x: segment.end, y: top },
        endPoint
      ],
      roofLine: [
        { x: segment.start, y: top },
        { x: segment.end, y: top }
      ]
    };
  });
};

interface RoofOutlineOptions {
  left: number;
  right: number;
  baseHeight: number;
  roof: RoofConfig;
}

const buildRoofOutline = ({ left, right, baseHeight, roof }: RoofOutlineOptions): Point[] => {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return [];
  }
  if (right < left) {
    [left, right] = [right, left];
  }
  if (Math.abs(right - left) < DIRECTION_TOLERANCE) {
    return [];
  }

  const span = right - left;
  const slopeRatio = Math.max(Number.isFinite(roof.slopeValue) ? roof.slopeValue : 0, 0) / 10;
  let derivedRidge = baseHeight;
  switch (roof.type) {
    case 'mono':
      derivedRidge = baseHeight + span * slopeRatio;
      break;
    case 'hip':
    case 'gable':
      derivedRidge = baseHeight + (span / 2) * slopeRatio;
      break;
    case 'flat':
    default:
      derivedRidge = baseHeight;
      break;
  }

  const explicitRidge = Number.isFinite(roof.ridgeHeight) ? roof.ridgeHeight : baseHeight;
  const ridgeHeight = Math.max(derivedRidge, explicitRidge ?? baseHeight, baseHeight);

  switch (roof.type) {
    case 'flat': {
      const parapetTop = baseHeight + Math.max(roof.parapetHeight ?? 0, 0);
      if (parapetTop > baseHeight + DIRECTION_TOLERANCE) {
        return [
          { x: left, y: baseHeight },
          { x: left, y: parapetTop },
          { x: right, y: parapetTop },
          { x: right, y: baseHeight }
        ];
      }
      return [
        { x: left, y: baseHeight },
        { x: right, y: baseHeight }
      ];
    }
    case 'mono':
      return [
        { x: left, y: baseHeight },
        { x: left, y: ridgeHeight },
        { x: right, y: baseHeight }
      ];
    case 'hip': {
      const span = right - left;
      const inset = Math.min(span / 4, Math.max(span / 10, 0));
      const ridgeStart = left + inset;
      const ridgeEnd = right - inset;
      if (ridgeEnd <= ridgeStart) {
        const midpoint = (left + right) / 2;
        return [
          { x: left, y: baseHeight },
          { x: midpoint, y: ridgeHeight },
          { x: right, y: baseHeight }
        ];
      }
      return [
        { x: left, y: baseHeight },
        { x: ridgeStart, y: ridgeHeight },
        { x: ridgeEnd, y: ridgeHeight },
        { x: right, y: baseHeight }
      ];
    }
    case 'gable':
    default: {
      const midpoint = (left + right) / 2;
      return [
        { x: left, y: baseHeight },
        { x: midpoint, y: ridgeHeight },
        { x: right, y: baseHeight }
      ];
    }
  }
};

const normalizeFloorsForGeometry = (
  building: BuildingModel
): { floors: FloorModel[]; ok: boolean; error?: string } => {
  const validation = validateBuildingModel(building);
  if (validation.valid) {
    return { floors: building.floors, ok: true };
  }

  const usableFloors = building.floors.filter((floor) => floor.polygon.length >= 3);
  if (usableFloors.length) {
    return {
      floors: usableFloors,
      ok: false,
      error: `一部の階層を除外しました: ${validation.errors.join(', ')}`
    };
  }

  const fallback = createInitialBuildingModel('rectangle');
  return {
    floors: fallback.floors,
    ok: false,
    error: `モデルが無効のため矩形テンプレートで代替しました: ${validation.errors.join(', ')}`
  };
};

type SideKey = 'minX' | 'maxX' | 'minY' | 'maxY';

const axisForSide = (side: SideKey): 'x' | 'y' =>
  side === 'minX' || side === 'maxX' ? 'x' : 'y';

const computeSideOverhang = (floor: FloorModel, box: BoundingBox, side: SideKey): number => {
  const axisKey = axisForSide(side);
  const sideValue = box[side];
  return floor.dimensions.reduce((max, dimension, index) => {
    const offset = Math.max(0, dimension?.offset ?? 0);
    if (offset <= 0) {
      return max;
    }
    const start = floor.polygon[index];
    const end = floor.polygon[(index + 1) % floor.polygon.length];
    if (!start || !end) {
      return max;
    }
    const touchesSide =
      Math.abs(start[axisKey] - sideValue) <= DIRECTION_TOLERANCE ||
      Math.abs(end[axisKey] - sideValue) <= DIRECTION_TOLERANCE;
    if (!touchesSide) {
      return max;
    }
    return Math.max(max, offset);
  }, 0);
};

const buildElevationForDirection = (
  floors: FloorModel[],
  direction: ElevationDirection,
  options?: { showDimensions?: boolean }
): ElevationView => {
  const useWidth = direction === 'north' || direction === 'south';
  const minSideKey = (useWidth ? 'minX' : 'minY') as SideKey;
  const maxSideKey = (useWidth ? 'maxX' : 'maxY') as SideKey;
  const showDimensions = options?.showDimensions ?? true;

  interface FloorProjectionContext {
    floor: FloorModel;
    box: BoundingBox;
    widthMin: number;
    widthMax: number;
    leftOverhang: number;
    rightOverhang: number;
  }

  const floorContexts: FloorProjectionContext[] = [];
  let globalWidthMin = Number.POSITIVE_INFINITY;
  let globalWidthMax = Number.NEGATIVE_INFINITY;
  let globalBaseMin = Number.POSITIVE_INFINITY;
  let globalBaseMax = Number.NEGATIVE_INFINITY;

  floors.forEach((floor) => {
    const box = boundingBox(floor.polygon);
    const widthMin = useWidth ? box.minX : box.minY;
    const widthMax = useWidth ? box.maxX : box.maxY;
    const leftOverhang = computeSideOverhang(floor, box, minSideKey);
    const rightOverhang = computeSideOverhang(floor, box, maxSideKey);

    globalWidthMin = Math.min(globalWidthMin, widthMin - leftOverhang);
    globalWidthMax = Math.max(globalWidthMax, widthMax + rightOverhang);
    globalBaseMin = Math.min(globalBaseMin, widthMin);
    globalBaseMax = Math.max(globalBaseMax, widthMax);

    floorContexts.push({
      floor,
      box,
      widthMin,
      widthMax,
      leftOverhang,
      rightOverhang
    });
  });

  if (!Number.isFinite(globalWidthMin) || !Number.isFinite(globalWidthMax)) {
    globalWidthMin = 0;
    globalWidthMax = 0;
  }

  const origin = globalWidthMin;
  const globalSpan = Math.max(globalWidthMax - globalWidthMin, 0);
  const globalBaseSpan = Math.max(globalBaseMax - globalBaseMin, 0);

  let accumulatedHeight = 0;
  let totalHeight = 0;
  const viewHeightDimensions: ElevationDimensionLine[] = [];
  const viewEaveLines: ElevationEaveLine[] = [];
  const viewEaveDimensions: ElevationDimensionLine[] = [];

  const outlines = floorContexts.map((context) => {
    const { floor, box, widthMin, widthMax, leftOverhang, rightOverhang } = context;
    const sanitizedRoof = sanitizeRoof(floor.roof);
    const baseStart = widthMin - origin;
    const baseEnd = widthMax - origin;

    const outline: Point[] = [
      { x: baseStart, y: accumulatedHeight },
      { x: baseEnd, y: accumulatedHeight },
      { x: baseEnd, y: accumulatedHeight + floor.height },
      { x: baseStart, y: accumulatedHeight + floor.height }
    ];

    const profile: ElevationOutline = {
      floorId: floor.id,
      outline,
      base: accumulatedHeight,
      height: floor.height,
      roof: sanitizedRoof,
      color: floor.style.strokeColor
    };

    const projectionBase: ProjectionOptions = {
      useWidth,
      origin,
      widthMin,
      widthMax,
      leftOverhang,
      rightOverhang
    };

    const projectedSegments: Array<{ start: number; end: number }> = [];

    if (showDimensions) {
      viewHeightDimensions.push(
        createHeightDimension(floor.id, baseEnd, accumulatedHeight, floor.height)
      );
    }

    floor.dimensions.forEach((dimension, index) => {
      const offset = Math.max(0, dimension?.offset ?? 0);
      if (offset <= 0) {
        return;
      }
      const start = floor.polygon[index];
      const end = floor.polygon[(index + 1) % floor.polygon.length];
      if (!start || !end) {
        return;
      }
      if (!edgeMatchesDirection(start, end, box, direction)) {
        return;
      }

      const [segmentStart, segmentEnd] = projectEdgeToView(start, end, projectionBase);
      projectedSegments.push({
        start: Math.min(segmentStart, segmentEnd),
        end: Math.max(segmentStart, segmentEnd)
      });

      const [eaveStartRaw, eaveEndRaw] = projectEdgeToView(start, end, {
        ...projectionBase,
        extendToOverhang: true
      });
      const eaveStart = Math.min(eaveStartRaw, eaveEndRaw);
      const eaveEnd = Math.max(eaveStartRaw, eaveEndRaw);
      const baseY = accumulatedHeight + floor.height;
      viewEaveLines.push({
        floorId: floor.id,
        start: { x: eaveStart, y: baseY },
        end: { x: eaveEnd, y: baseY },
        offset,
        visible: true,
        color: floor.style.strokeColor
      });

      if (showDimensions) {
        const centerX = (eaveStart + eaveEnd) / 2;
        viewEaveDimensions.push(createEaveDimension(floor.id, centerX, baseY, offset));
      }
    });

    const fragments = buildOutlineFragments({
      base: accumulatedHeight,
      height: floor.height,
      floorId: floor.id,
      direction,
      segments: projectedSegments
    });

    if (fragments.length) {
      profile.fragments = fragments;
    } else {
      const baseY = accumulatedHeight;
      const topY = baseY + floor.height;
      profile.fragments = [
        {
          id: `${floor.id}-${direction}-fragment-0`,
          points: [
            { x: baseStart, y: baseY },
            { x: baseStart, y: topY },
            { x: baseEnd, y: topY },
            { x: baseEnd, y: baseY }
          ],
          roofLine: [
            { x: baseStart, y: topY },
            { x: baseEnd, y: topY }
          ]
        }
      ];
    }

    accumulatedHeight += floor.height;
    totalHeight = accumulatedHeight;
    return profile;
  });

  const topFloorContext = floorContexts[floorContexts.length - 1];
  const sanitizedTopRoof = sanitizeRoof(topFloorContext.floor.roof);
  const roofLabel = sanitizedTopRoof.type === 'flat'
    ? sanitizedTopRoof.parapetHeight > 0
      ? `立上${Math.round(sanitizedTopRoof.parapetHeight)}mm`
      : 'フラット'
    : `10/${sanitizedTopRoof.slopeValue}`;
  const flatTopHeight = sanitizedTopRoof.type === 'flat'
    ? totalHeight + sanitizedTopRoof.parapetHeight
    : sanitizedTopRoof.ridgeHeight ?? totalHeight;
  const totalRidgeHeight = Math.max(totalHeight, flatTopHeight);

  const topFloorEaveLines = viewEaveLines.filter(
    (line) => line.floorId === topFloorContext.floor.id
  );

  let roofSpanStart = 0;
  let roofSpanEnd = globalSpan;
  if (topFloorEaveLines.length) {
    roofSpanStart = Math.min(
      ...topFloorEaveLines.map((line) => Math.min(line.start.x, line.end.x))
    );
    roofSpanEnd = Math.max(
      ...topFloorEaveLines.map((line) => Math.max(line.start.x, line.end.x))
    );
  } else {
    roofSpanStart = topFloorContext.widthMin - topFloorContext.leftOverhang - origin;
    roofSpanEnd = topFloorContext.widthMax + topFloorContext.rightOverhang - origin;
  }

  const roofOutline = buildRoofOutline({
    left: roofSpanStart,
    right: roofSpanEnd,
    baseHeight: totalHeight,
    roof: sanitizedTopRoof
  });

  return {
    direction,
    dimensionLabel: createDimensionLabel(globalBaseSpan),
    dimensionValue: globalSpan,
    baseStart: globalBaseMin - origin,
    baseEnd: globalBaseMax - origin,
    floors: outlines,
    roofLabel,
    totalHeight: totalRidgeHeight,
    showDimensions,
    heightDimensions: viewHeightDimensions,
    eaveLines: viewEaveLines,
    eaveDimensions: viewEaveDimensions,
    roofColor: topFloorContext.floor.style.strokeColor,
    roofOutline
  };
};

export const buildElevationData = (building: BuildingModel): ElevationComputation => {
  const normalized = normalizeFloorsForGeometry(building);
  const floors = normalized.floors;

  if (!floors.length) {
    return { ok: false, views: [], error: normalized.error ?? '有効な階層がありません。' };
  }

  const showDimensions = building.modes?.dimensionVisibleElevation ?? true;
  const views = DIRECTIONS.map((direction) =>
    buildElevationForDirection(floors, direction, { showDimensions })
  );
  const enhancedViews = views.map((view) => ({
    ...view,
    showDimensions,
    heightDimensions: showDimensions ? view.heightDimensions : [],
    eaveDimensions: showDimensions ? view.eaveDimensions : []
  }));

  return {
    ok: normalized.ok,
    views: enhancedViews,
    error: normalized.error
  };
};

export const buildThreeDModel = (building: BuildingModel): ThreeDResult => {
  const normalized = normalizeFloorsForGeometry(building);
  const floors = normalized.floors;

  if (!floors.length) {
    return { ok: false, meshes: [], error: normalized.error ?? '有効な階層がありません。' };
  }

  let base = 0;
  const meshes: ThreeDMesh[] = floors.map((floor) => {
    const roof = sanitizeRoof(floor.roof);
    const bottom: MeshPoint[] = floor.polygon.map((point) => ({ x: point.x, y: point.y, z: base }));
    const top: MeshPoint[] = floor.polygon.map((point) => ({ x: point.x, y: point.y, z: base + floor.height }));
    const mesh: ThreeDMesh = {
      floorId: floor.id,
      base,
      height: floor.height,
      roof,
      polygon: { bottom, top },
      color: floor.style.strokeColor
    };
    base += floor.height;
    return mesh;
  });

  return {
    ok: normalized.ok,
    meshes,
    error: normalized.error
  };
};
