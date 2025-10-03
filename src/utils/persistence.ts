import {
  DEFAULT_DRAWING_MODES,
  validateBuildingModel,
  type BuildingModel,
  type CardinalDirection,
  type DrawingModes,
  type RoofOrientation
} from '../context/BuildingProvider';

export const BUILDING_STORAGE_KEY = 'scaff-web:building-state';

export interface PersistenceOptions {
  storage?: Storage | null;
}

export interface PersistenceResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const resolveStorage = (options?: PersistenceOptions): Storage | null => {
  if (options?.storage) {
    return options.storage;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
};

export const saveBuildingModel = (
  model: BuildingModel,
  options?: PersistenceOptions
): PersistenceResult<void> => {
  const storage = resolveStorage(options);
  if (!storage) {
    return { ok: false, error: 'Storage is not available.' };
  }

  try {
    const payload = JSON.stringify(model);
    storage.setItem(BUILDING_STORAGE_KEY, payload);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save building model.'
    };
  }
};

const normalizeModes = (modes?: Partial<DrawingModes>): DrawingModes => ({
  rightAngle: modes?.rightAngle ?? DEFAULT_DRAWING_MODES.rightAngle,
  gridSnap: modes?.gridSnap ?? DEFAULT_DRAWING_MODES.gridSnap,
  gridVisible: modes?.gridVisible ?? DEFAULT_DRAWING_MODES.gridVisible,
  gridSpacing: modes?.gridSpacing ?? DEFAULT_DRAWING_MODES.gridSpacing,
  dimensionVisible: modes?.dimensionVisible ?? DEFAULT_DRAWING_MODES.dimensionVisible,
  dimensionVisibleElevation:
    modes?.dimensionVisibleElevation ?? DEFAULT_DRAWING_MODES.dimensionVisibleElevation
});

const normalizeBuildingModel = (model: any): BuildingModel => {
  const floors = Array.isArray(model?.floors)
    ? model.floors.map((floor: any) => {
        const slopeValue = Number(floor?.roof?.slopeValue);
        const ridgeHeight = Number(floor?.roof?.ridgeHeight);
        const parapetHeight = Number(floor?.roof?.parapetHeight);
        const heightValue = Number(floor?.height);
        const height = Number.isFinite(heightValue) && heightValue > 0 ? heightValue : 0;
        const rawType = typeof floor?.roof?.type === 'string' ? floor.roof.type : 'flat';
        const type: 'flat' | 'mono' | 'gable' | 'hip' = ['flat', 'mono', 'gable', 'hip'].includes(rawType)
          ? (rawType as any)
          : 'flat';
        const rawLowSide = typeof floor?.roof?.lowSideDirection === 'string'
          ? (floor.roof.lowSideDirection as string)
          : undefined;
        const normalizedLowSide: CardinalDirection = ['north', 'south', 'east', 'west'].includes(
          rawLowSide as CardinalDirection
        )
          ? (rawLowSide as CardinalDirection)
          : 'south';
        const rawOrientation = typeof floor?.roof?.orientation === 'string'
          ? (floor.roof.orientation as string)
          : undefined;
        const normalizedOrientation: RoofOrientation = ['north-south', 'east-west'].includes(
          rawOrientation as RoofOrientation
        )
          ? (rawOrientation as RoofOrientation)
          : 'north-south';

        let normalizedSlope = Number.isFinite(slopeValue) && slopeValue >= 0 ? slopeValue : 0;
        let normalizedRidge = Number.isFinite(ridgeHeight) && ridgeHeight >= height
          ? ridgeHeight
          : Math.max(height, 0);
        let normalizedParapet = Number.isFinite(parapetHeight) && parapetHeight >= 0
          ? parapetHeight
          : 0;

        if (type === 'flat') {
          normalizedSlope = 0;
          normalizedRidge = Math.max(height + normalizedParapet, height);
        } else {
          normalizedParapet = 0;
        }

        return {
          ...floor,
          locked: typeof floor?.locked === 'boolean' ? floor.locked : false,
          roof: {
            type,
            slopeValue: normalizedSlope,
            ridgeHeight: normalizedRidge,
            parapetHeight: normalizedParapet,
            lowSideDirection: normalizedLowSide,
            orientation: normalizedOrientation
          }
        };
      })
    : [];

  return {
    ...model,
    selectedEdgeId: typeof model?.selectedEdgeId === 'string' ? model.selectedEdgeId : null,
    modes: normalizeModes(model?.modes),
    floors
  } as BuildingModel;
};

const removeIfPossible = (storage: Storage | null) => {
  try {
    storage?.removeItem(BUILDING_STORAGE_KEY);
  } catch (error) {
    // noop: best-effort cleanup
  }
};

export const loadBuildingModel = (
  options?: PersistenceOptions
): PersistenceResult<BuildingModel | null> => {
  const storage = resolveStorage(options);
  if (!storage) {
    return { ok: false, error: 'Storage is not available.' };
  }

  try {
    const raw = storage.getItem(BUILDING_STORAGE_KEY);
    if (!raw) {
      return { ok: true, data: null };
    }

    const parsed = JSON.parse(raw);
    const normalized = normalizeBuildingModel(parsed);
    const validation = validateBuildingModel(normalized);
    if (!validation.valid) {
      removeIfPossible(storage);
      return {
        ok: false,
        error: `データの検証に失敗しました: ${validation.errors.join(', ')}`
      };
    }

    return { ok: true, data: normalized };
  } catch (error) {
    removeIfPossible(storage);
    return {
      ok: false,
      error: error instanceof Error ? `JSONの解析に失敗しました: ${error.message}` : 'JSONの解析に失敗しました。'
    };
  }
};
