import { buildElevationData, buildThreeDModel } from '../geometry';
import { createInitialBuildingModel, type BuildingModel } from '../../context/BuildingProvider';

describe('geometry utilities', () => {
  it('creates elevation data for the four cardinal directions with sanitized roof metadata', () => {
    const building = createInitialBuildingModel('rectangle');

    const result = buildElevationData(building);
    expect(result.ok).toBe(true);
    expect(result.views).toHaveLength(4);

    result.views.forEach((view) => {
      expect(view.dimensionLabel).toMatch(/\|──\d+──\|/);
      expect(view.dimensionValue).toBeGreaterThan(0);
      expect(view.totalHeight).toBeGreaterThan(0);
      expect(view.floors.length).toBe(building.floors.length);

      const topFloor = view.floors.at(-1);
      expect(topFloor?.roof.type).toBe(building.floors.at(-1)?.roof.type);
      expect(topFloor?.roof.slopeValue).toBeGreaterThanOrEqual(0);
      expect(view.roofLabel).toBe(`10/${topFloor?.roof.slopeValue ?? 0}`);
    });
  });

  it('preserves gable roof orientation and slope information in elevation data', () => {
    const building = createInitialBuildingModel('rectangle');
    const floor = building.floors[0];
    floor.roof = {
      ...floor.roof,
      type: 'gable',
      slopeValue: 4.5,
      ridgeHeight: floor.height + 1500,
      parapetHeight: 0,
      orientation: 'east-west'
    };

    const result = buildElevationData(building);
    const eastView = result.views.find((view) => view.direction === 'east');
    const northView = result.views.find((view) => view.direction === 'north');

    expect(eastView?.floors.at(-1)?.roof.orientation).toBe('east-west');
    expect(eastView?.roofLabel).toBe('10/4.5');
    expect(northView?.floors.at(-1)?.roof.orientation).toBe('east-west');
  });

  it('raises elevation total height when ridge height exceeds floor height', () => {
    const building = createInitialBuildingModel('rectangle');
    const floor = building.floors[0];
    floor.roof = {
      ...floor.roof,
      type: 'hip',
      slopeValue: 5,
      ridgeHeight: floor.height + 1200,
      parapetHeight: 0,
      orientation: 'north-south'
    };

    const result = buildElevationData(building);
    const expectedHeight = floor.height + 1200;

    result.views.forEach((view) => {
      expect(view.totalHeight).toBeGreaterThanOrEqual(expectedHeight);
    });
  });

  it('sanitizes invalid roof values when generating elevation data', () => {
    const building = createInitialBuildingModel('rectangle');
    building.floors[0].roof = {
      type: 'mono',
      slopeValue: -2,
      ridgeHeight: building.floors[0].height - 500,
      parapetHeight: -100,
      lowSideDirection: 'invalid' as any,
      orientation: 'invalid' as any
    };

    const result = buildElevationData(building);
    const view = result.views[0];
    const roof = view.floors[0].roof;

    expect(roof.type).toBe('mono');
    expect(roof.slopeValue).toBeGreaterThanOrEqual(0);
    expect(roof.ridgeHeight).toBeGreaterThan(0);
    expect(roof.parapetHeight).toBe(0);
    expect(['north', 'south', 'east', 'west']).toContain(roof.lowSideDirection);
    expect(['north-south', 'east-west']).toContain(roof.orientation);
  });

  it('produces 3D meshes with sanitized roof data', () => {
    const building = createInitialBuildingModel('rectangle');
    const topFloor = building.floors[0];
    topFloor.roof = {
      type: 'weird' as never,
      slopeValue: -5,
      ridgeHeight: topFloor.height + 400,
      parapetHeight: -50,
      lowSideDirection: 'south',
      orientation: 'north-south'
    };

    const result = buildThreeDModel(building);
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.meshes).toHaveLength(1);
    expect(result.meshes[0].roof.type).toBe('flat');
    expect(result.meshes[0].polygon.bottom[0].z).toBe(0);
    expect(result.meshes[0].polygon.top[0].z).toBe(topFloor.height);
  });

  it('falls back to default geometry when the building model is invalid', () => {
    const building: BuildingModel = createInitialBuildingModel('rectangle');
    building.floors[0].polygon = [];

    const elevations = buildElevationData(building);
    expect(elevations.ok).toBe(false);
    expect(elevations.views).not.toHaveLength(0);
    expect(elevations.error).toBeDefined();

    const meshes = buildThreeDModel(building);
    expect(meshes.ok).toBe(false);
    expect(meshes.meshes).not.toHaveLength(0);
  });
});
