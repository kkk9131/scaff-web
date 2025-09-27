import { validateBuildingModel, type BuildingModel } from '../context/BuildingProvider';

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

    const parsed = JSON.parse(raw) as BuildingModel;
    const validation = validateBuildingModel(parsed);
    if (!validation.valid) {
      removeIfPossible(storage);
      return {
        ok: false,
        error: `データの検証に失敗しました: ${validation.errors.join(', ')}`
      };
    }

    return { ok: true, data: parsed };
  } catch (error) {
    removeIfPossible(storage);
    return {
      ok: false,
      error: error instanceof Error ? `JSONの解析に失敗しました: ${error.message}` : 'JSONの解析に失敗しました。'
    };
  }
};
