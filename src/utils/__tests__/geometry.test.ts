import {
  buildElevationData,
  buildThreeDModel,
  type ElevationDirection
} from '../geometry';
import { createInitialBuildingModel, type BuildingModel } from '../../context/BuildingProvider';

describe('geometry utilities', () => {
  it('produces elevation data for all directions with dimension labels', () => {
    const building = createInitialBuildingModel('rectangle');

    const result = buildElevationData(building);
    expect(result.ok).toBe(true);
    expect(result.views).toHaveLength(4);

    const directions: ElevationDirection[] = ['north', 'south', 'east', 'west'];
    directions.forEach((direction) => {
      const view = result.views.find((item) => item.direction === direction);
      expect(view).toBeDefined();
      expect(view?.dimensionLabel).toMatch(/\|──\d+──\|/);
      expect(view?.floors[0].height).toBe(3000);
      expect(view?.roofLabel).toBe('10/0');
    });
  });

  it('creates extruded meshes for 3D view with sanitized roofs', () => {
    const building = createInitialBuildingModel('rectangle');
    const topFloor = building.floors[0];
    topFloor.roof = { type: 'weird' as never, slopeValue: -5 };

    const result = buildThreeDModel(building);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/屋根|無効|invalid/i);
    expect(result.meshes).toHaveLength(1);
    expect(result.meshes[0].roof.type).toBe('flat');
    expect(result.meshes[0].polygon.bottom[0].z).toBe(0);
    expect(result.meshes[0].polygon.top[0].z).toBe(3000);
  });

  it('falls back to default geometry when the building model is invalid', () => {
    const building: BuildingModel = createInitialBuildingModel('rectangle');
    building.floors[0].polygon = [];

    const elevations = buildElevationData(building);
    expect(elevations.ok).toBe(false);
    expect(elevations.views).not.toHaveLength(0);
    expect(elevations.error).toMatch(/無効|invalid|代替/);

    const meshes = buildThreeDModel(building);
    expect(meshes.ok).toBe(false);
    expect(meshes.meshes).not.toHaveLength(0);
  });
});
