import {
  createInitialBuildingModel,
  BuildingModel,
  buildingReducer,
  type BuildingAction
} from '../BuildingProvider';

describe('Building reducer actions', () => {
  const dispatch = (state: BuildingModel, action: BuildingAction) => buildingReducer(state, action);

  it('switches template and resets floors to the new polygon', () => {
    const initial = createInitialBuildingModel('rectangle');

    const next = dispatch(initial, {
      type: 'selectTemplate',
      template: 'l-shape'
    });

    expect(next.template).toBe('l-shape');
    expect(next.floors).toHaveLength(1);
    expect(next.floors[0].polygon).toEqual([
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 2000 },
      { x: 2000, y: 2000 },
      { x: 2000, y: 4000 },
      { x: 0, y: 4000 }
    ]);
    expect(next.floors[0].dimensions).toHaveLength(6);
  });

  it('updates a vertex and recalculates adjacent edge lengths', () => {
    const initial = createInitialBuildingModel('rectangle');

    const next = dispatch(initial, {
      type: 'updateVertex',
      floorId: initial.activeFloorId,
      vertexIndex: 0,
      point: { x: 1000, y: 0 }
    });

    const floor = next.floors[0];
    expect(floor.polygon[0]).toEqual({ x: 1000, y: 0 });
    expect(floor.dimensions[0].length).toBe(5000);
    const adjacentLength = Math.round(Math.sqrt((0 - 1000) ** 2 + (4000 - 0) ** 2));
    expect(floor.dimensions[3].length).toBe(adjacentLength);
  });

  it('inserts and removes vertices keeping dimensions in sync', () => {
    const initial = createInitialBuildingModel('rectangle');

    const withVertex = dispatch(initial, {
      type: 'addVertex',
      floorId: initial.activeFloorId,
      edgeIndex: 1,
      point: { x: 6000, y: 2000 }
    });

    expect(withVertex.floors[0].polygon).toHaveLength(5);
    expect(withVertex.floors[0].dimensions).toHaveLength(5);

    const removed = dispatch(withVertex, {
      type: 'removeVertex',
      floorId: initial.activeFloorId,
      vertexIndex: 2
    });

    expect(removed.floors[0].polygon).toHaveLength(4);
    expect(removed.floors[0].dimensions).toHaveLength(4);
  });

  it('updates edge dimension length and moves the corresponding point', () => {
    const initial = createInitialBuildingModel('rectangle');

    const resized = dispatch(initial, {
      type: 'updateEdgeLength',
      floorId: initial.activeFloorId,
      edgeId: initial.floors[0].dimensions[0].edgeId,
      length: 7000
    });

    const floor = resized.floors[0];
    expect(floor.dimensions[0].length).toBe(7000);
    expect(floor.polygon[1]).toEqual({ x: 7000, y: 0 });
  });

  it('duplicates the active floor with a new identifier', () => {
    const initial = createInitialBuildingModel('rectangle');

    const duplicated = dispatch(initial, {
      type: 'duplicateFloor',
      floorId: initial.activeFloorId
    });

    expect(duplicated.floors).toHaveLength(2);
    expect(duplicated.floors[1].polygon).toEqual(duplicated.floors[0].polygon);
    expect(duplicated.floors[1].id).not.toBe(duplicated.floors[0].id);
  });

  it('adds and removes floors while maintaining an active floor', () => {
    const initial = createInitialBuildingModel('rectangle');

    const added = dispatch(initial, {
      type: 'addFloor'
    });

    expect(added.floors).toHaveLength(2);
    expect(added.activeFloorId).toBe(added.floors[1].id);
    expect(added.lastError).toBeNull();

    const removed = dispatch(added, {
      type: 'removeFloor',
      floorId: added.floors[0].id
    });

    expect(removed.floors).toHaveLength(1);
    expect(removed.activeFloorId).toBe(removed.floors[0].id);
    expect(removed.lastError).toBeNull();
  });

  it('rejects operations that cause self-intersections and reports an error', () => {
    const initial = createInitialBuildingModel('rectangle');

    const invalid = dispatch(initial, {
      type: 'updateVertex',
      floorId: initial.activeFloorId,
      vertexIndex: 1,
      point: { x: 0, y: 4000 }
    });

    expect(invalid.floors).toBe(initial.floors);
    expect(invalid.lastError).toMatch(/自己交差/);

    const recovered = dispatch(invalid, {
      type: 'updateVertex',
      floorId: initial.activeFloorId,
      vertexIndex: 1,
      point: { x: 6000, y: 0 }
    });

    expect(recovered.lastError).toBeNull();
  });
});
