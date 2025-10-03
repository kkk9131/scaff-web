import {
  createInitialBuildingModel,
  validateBuildingModel,
  type BuildingModel,
  type FloorModel,
  type Point,
  type RoofConfig
} from '../context/BuildingProvider';

export type ElevationDirection = 'north' | 'south' | 'east' | 'west';

export interface ElevationOutline {
  floorId: string;
  outline: Point[];
  base: number;
  height: number;
  roof: RoofConfig;
  color: string;
}

export interface ElevationView {
  direction: ElevationDirection;
  dimensionLabel: string;
  dimensionValue: number;
  floors: ElevationOutline[];
  roofLabel: string;
  totalHeight: number;
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
  const slopeValue = Number.isFinite(roof.slopeValue) ? Math.max(0, roof.slopeValue) : 0;
  const ridgeHeight = Number.isFinite(roof.ridgeHeight) ? Math.max(0, roof.ridgeHeight) : 0;
  const parapetHeight = Number.isFinite(roof.parapetHeight) ? Math.max(0, roof.parapetHeight) : 0;
  const directions: RoofConfig['lowSideDirection'][] = ['north', 'south', 'east', 'west'];
  const lowSideDirection = directions.includes(roof.lowSideDirection)
    ? roof.lowSideDirection
    : 'south';
  const orientations: RoofConfig['orientation'][] = ['north-south', 'east-west'];
  const orientation = orientations.includes(roof.orientation) ? roof.orientation : 'north-south';
  return { type, slopeValue, ridgeHeight, parapetHeight, lowSideDirection, orientation };
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

const buildElevationForDirection = (
  floors: FloorModel[],
  direction: ElevationDirection
): ElevationView => {
  const useWidth = direction === 'north' || direction === 'south';
  let accumulatedHeight = 0;
  let totalHeight = 0;
  const globalAxis = floors.reduce(
    (acc, floor) => {
      floor.polygon.forEach((point) => {
        const value = useWidth ? point.x : point.y;
        acc.min = Math.min(acc.min, value);
        acc.max = Math.max(acc.max, value);
      });
      return acc;
    },
    { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
  );

  const globalOrigin = Number.isFinite(globalAxis.min) ? globalAxis.min : 0;
  const globalSpan = Number.isFinite(globalAxis.max) && Number.isFinite(globalAxis.min)
    ? Math.max(0, globalAxis.max - globalAxis.min)
    : 0;

  const outlines = floors.map((floor) => {
    const box = boundingBox(floor.polygon);
    const floorMin = useWidth ? box.minX : box.minY;
    const floorMax = useWidth ? box.maxX : box.maxY;
    const span = Math.max(0, floorMax - floorMin);
    const offsetStart = floorMin - globalOrigin;
    const offsetEnd = offsetStart + span;

    const outline: Point[] = [
      { x: offsetStart, y: accumulatedHeight },
      { x: offsetEnd, y: accumulatedHeight },
      { x: offsetEnd, y: accumulatedHeight + floor.height },
      { x: offsetStart, y: accumulatedHeight + floor.height }
    ];

    const roof = sanitizeRoof(floor.roof);
    const profile: ElevationOutline = {
      floorId: floor.id,
      outline,
      base: accumulatedHeight,
      height: floor.height,
      roof,
      color: floor.style.strokeColor
    };

    const floorTopHeight = accumulatedHeight + floor.height;
    const ridgeHeight = accumulatedHeight + Math.max(floor.height, roof.ridgeHeight);
    totalHeight = Math.max(totalHeight, floorTopHeight, ridgeHeight);

    accumulatedHeight += floor.height;
    return profile;
  });

  if (totalHeight === 0) {
    totalHeight = accumulatedHeight;
  }

  const topFloor = floors[floors.length - 1];
  const roofLabel = `10/${sanitizeRoof(topFloor.roof).slopeValue}`;

  return {
    direction,
    dimensionLabel: createDimensionLabel(globalSpan),
    dimensionValue: globalSpan,
    floors: outlines,
    roofLabel,
    totalHeight
  };
};

export const buildElevationData = (building: BuildingModel): ElevationComputation => {
  const normalized = normalizeFloorsForGeometry(building);
  const floors = normalized.floors;

  if (!floors.length) {
    return { ok: false, views: [], error: normalized.error ?? '有効な階層がありません。' };
  }

  const views = DIRECTIONS.map((direction) => buildElevationForDirection(floors, direction));

  return {
    ok: normalized.ok,
    views,
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
