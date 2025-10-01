import {
  buildElevationData,
  buildThreeDModel,
  type ElevationDirection
} from '../geometry';
import { createInitialBuildingModel, type BuildingModel } from '../../context/BuildingProvider';

describe('geometry utilities', () => {
  it('produces elevation data for all directions with dimension metadata', () => {
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
      expect(view?.roofLabel).toBe('フラット');
      expect(view?.roofColor).toBe(view?.floors.at(-1)?.color);
      expect(view?.showDimensions).toBe(true);
      expect(view?.heightDimensions?.length).toBeGreaterThan(0);
      expect(view?.eaveLines).toBeDefined();
      expect(view?.roofOutline.length).toBeGreaterThan(0);
    });
  });

  it('includes eave line information for directions with positive offsets', () => {
    const building = createInitialBuildingModel('rectangle');
    building.floors[0].dimensions = building.floors[0].dimensions.map((dimension, index) =>
      index === 2 ? { ...dimension, offset: 650 } : dimension
    );

    const result = buildElevationData(building);
    const northView = result.views.find((view) => view.direction === 'north');
    expect(northView).toBeDefined();
    expect(northView?.eaveLines?.some((line) => line.visible)).toBe(true);
    expect(northView?.eaveLines?.every((line) => line.color)).toBe(true);
    expect(northView?.eaveDimensions?.some((dimension) => dimension.label.includes('650'))).toBe(true);
    expect(northView?.roofOutline.length).toBeGreaterThanOrEqual(2);
    expect(northView?.roofColor).toBe(northView?.floors.at(-1)?.color);
  });

  it('reflects parapet height for flat roofs in roof outline and labels', () => {
    const building = createInitialBuildingModel('rectangle');
    building.floors[0].roof = {
      ...building.floors[0].roof,
      parapetHeight: 500
    };

    const result = buildElevationData(building);
    const eastView = result.views.find((view) => view.direction === 'east');
    expect(eastView).toBeDefined();
    expect(eastView?.roofLabel).toMatch(/立上500mm/);
    const outline = eastView?.roofOutline ?? [];
    expect(outline.length).toBeGreaterThanOrEqual(4);
    const topY = Math.max(...outline.map((point) => point.y));
    const baseY = Math.min(...outline.map((point) => point.y));
    expect(topY - baseY).toBeCloseTo(500, -1);
  });

  it('derives elevation facade fragments from the plan outline', () => {
    const building = createInitialBuildingModel('rectangle');
    const customPolygon = [
      { x: 0, y: 0 },
      { x: 9000, y: 0 },
      { x: 9000, y: 9000 },
      { x: 6000, y: 9000 },
      { x: 6000, y: 6000 },
      { x: 3000, y: 6000 },
      { x: 3000, y: 9000 },
      { x: 0, y: 9000 }
    ];
    const floor = building.floors[0];
    floor.polygon = customPolygon;
    floor.dimensions = customPolygon.map((point, index) => {
      const next = customPolygon[(index + 1) % customPolygon.length];
      const length = Math.round(Math.hypot(next.x - point.x, next.y - point.y));
      const offset = index === 2 || index === 6 ? 750 : 0;
      return {
        edgeId: `custom-edge-${index}`,
        length,
        offset
      };
    });

    const result = buildElevationData(building);
    const northView = result.views.find((view) => view.direction === 'north');
    expect(northView).toBeDefined();
    const fragments = northView?.floors[0].fragments ?? [];
    expect(fragments.length).toBe(2);
    const baseStart = northView?.baseStart ?? 0;
    expect(fragments[0].points[0].x).toBeCloseTo(baseStart);
    expect(fragments[0].points[2].x).toBeCloseTo(baseStart + 3000);
    expect(fragments[1].points[0].x).toBeCloseTo(baseStart + 6000);
    expect(fragments[1].points[2].x).toBeCloseTo(baseStart + 9000);
  });

  it('honors the elevation dimension visibility toggle', () => {
    const building = createInitialBuildingModel('rectangle');
    building.modes.dimensionVisibleElevation = false;

    const result = buildElevationData(building);
    expect(result.views.every((view) => view.showDimensions === false)).toBe(true);
  });

  it('builds gable roof outline with a peak at the center', () => {
    const building = createInitialBuildingModel('rectangle');
    const topFloor = building.floors[0];
    building.floors[0] = {
      ...topFloor,
      roof: { type: 'gable', slopeValue: 5, ridgeHeight: topFloor.height + 1500, parapetHeight: 0 }
    };

    const result = buildElevationData(building);
    const northView = result.views.find((view) => view.direction === 'north');
    expect(northView).toBeDefined();
    const outline = northView?.roofOutline ?? [];
    expect(outline.length).toBeGreaterThanOrEqual(3);
    const peak = outline[Math.floor(outline.length / 2)];
    expect(peak.y).toBeGreaterThan(topFloor.height);
  });

  it('creates extruded meshes for 3D view with sanitized roofs', () => {
    const building = createInitialBuildingModel('rectangle');
    const topFloor = building.floors[0];
    topFloor.roof = {
      type: 'weird' as never,
      slopeValue: -5,
      ridgeHeight: topFloor.height + 400,
      parapetHeight: -50
    };

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
