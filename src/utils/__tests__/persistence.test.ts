import {
  BUILDING_STORAGE_KEY,
  loadBuildingModel,
  saveBuildingModel
} from '../persistence';
import { createInitialBuildingModel, type BuildingModel } from '../../context/BuildingProvider';

describe('building state persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves and loads a valid model', () => {
    const model = createInitialBuildingModel('rectangle');
    const saveResult = saveBuildingModel(model);
    expect(saveResult.ok).toBe(true);

    const loadResult = loadBuildingModel();
    expect(loadResult.ok).toBe(true);
    expect(loadResult.data?.activeFloorId).toBe(model.activeFloorId);
  });

  it('returns ok with null data when nothing is stored', () => {
    const loadResult = loadBuildingModel();
    expect(loadResult.ok).toBe(true);
    expect(loadResult.data).toBeNull();
  });

  it('fails to load when JSON is corrupted', () => {
    window.localStorage.setItem(BUILDING_STORAGE_KEY, '{');

    const result = loadBuildingModel();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/解析/);
    expect(window.localStorage.getItem(BUILDING_STORAGE_KEY)).toBeNull();
  });

  it('fails to load when validation fails', () => {
    const invalidModel: BuildingModel = {
      template: 'rectangle',
      activeFloorId: 'missing',
      floors: [],
      selectedEdgeId: null,
      modes: {
        rightAngle: false,
        gridSnap: false,
        gridVisible: true,
        gridSpacing: 100,
        dimensionVisible: true,
        dimensionVisibleElevation: true
      },
      lastError: null
    } as any;

    window.localStorage.setItem(BUILDING_STORAGE_KEY, JSON.stringify(invalidModel));

    const result = loadBuildingModel();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/検証|validation/i);
    expect(window.localStorage.getItem(BUILDING_STORAGE_KEY)).toBeNull();
  });


  it('applies defaults for models stored without latest fields', () => {
    const legacy = createInitialBuildingModel('rectangle') as any;
    const shallowLegacy = { ...legacy };
    delete shallowLegacy.selectedEdgeId;
    delete shallowLegacy.modes;
    shallowLegacy.floors = shallowLegacy.floors.map((floor: any) => {
      const copy = { ...floor };
      delete copy.locked;
      return copy;
    });
    window.localStorage.setItem(BUILDING_STORAGE_KEY, JSON.stringify(shallowLegacy));

    const result = loadBuildingModel();
    expect(result.ok).toBe(true);
    expect(result.data?.selectedEdgeId).toBeNull();
    expect(result.data?.modes).toEqual({
      rightAngle: false,
      gridSnap: false,
      gridVisible: true,
      gridSpacing: 100,
      dimensionVisible: true,
      dimensionVisibleElevation: true
    });
    expect(result.data?.floors.every((floor) => floor.locked === false)).toBe(true);
  });
  it('handles storage write errors gracefully', () => {
    const model = createInitialBuildingModel('rectangle');

    const failingStorage: Storage = {
      length: 0,
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error('quota exceeded');
      }
    };

    const result = saveBuildingModel(model, { storage: failingStorage });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/quota/i);
  });
});
