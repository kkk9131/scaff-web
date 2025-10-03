import { applyCanvasConstraints } from '../CanvasConstraintController';
import type { FloorModel } from '../../../context/BuildingProvider';
import type { Point } from '../../floorplan/types';

const createFloor = (polygon: Point[]): FloorModel => ({
  id: 'floor-1',
  name: '1F',
  polygon,
  dimensions: polygon.map((point, index) => ({ edgeId: `edge-${index}`, length: 0, offset: 0 })),
  height: 3000,
  // 軒先方向は平屋根でも保持する
  roof: {
    type: 'flat',
    slopeValue: 0,
    ridgeHeight: 3000,
    parapetHeight: 0,
    lowSideDirection: 'south',
    orientation: 'north-south'
  },
  style: {
    strokeColor: '#2563eb',
    roofStrokeColor: '#000000',
    strokeWidth: 2,
    roofDash: [6, 4]
  },
  locked: false
});

describe('CanvasConstraintController', () => {
  it('snaps points to the configured grid spacing when enabled', () => {
    const floor = createFloor([
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 4000 },
      { x: 0, y: 4000 }
    ]);
    const result = applyCanvasConstraints({
      point: { x: 1233, y: 487 },
      vertexIndex: 0,
      floor,
      modes: {
        rightAngle: false,
        gridSnap: true,
        gridVisible: true,
        gridSpacing: 100,
        dimensionVisible: true,
        dimensionVisibleElevation: true
      }
    });
    expect(result).toEqual({ x: 1200, y: 500 });
  });

  it('enforces right angle alignment relative to previous vertex', () => {
    const floor = createFloor([
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 4000 },
      { x: 0, y: 4000 }
    ]);
    const result = applyCanvasConstraints({
      point: { x: 4100, y: 3900 },
      vertexIndex: 2,
      floor,
      modes: {
        rightAngle: true,
        gridSnap: false,
        gridVisible: true,
        gridSpacing: 100,
        dimensionVisible: true,
        dimensionVisibleElevation: true
      }
    });
    expect(result.x === 6000 || result.y === 0 || result.y === 4000).toBe(true);
  });

  it('returns input when no modes are active', () => {
    const point = { x: 123, y: 456 };
    const result = applyCanvasConstraints({
      point,
      vertexIndex: 1,
      modes: {
        rightAngle: false,
        gridSnap: false,
        gridVisible: true,
        gridSpacing: 100,
        dimensionVisible: true,
        dimensionVisibleElevation: true
      }
    });
    expect(result).toEqual(point);
  });
});
