import { buildEaveSegments } from '../eaveOffset';
import type { EdgeDimension } from '../../context/BuildingProvider';
import type { Point } from '../../modules/floorplan/types';

describe('buildEaveSegments', () => {
  const rectangle: Point[] = [
    { x: 0, y: 0 },
    { x: 6000, y: 0 },
    { x: 6000, y: 4000 },
    { x: 0, y: 4000 }
  ];

  const dimensions: EdgeDimension[] = rectangle.map((_, index) => ({
    edgeId: `edge-${index}`,
    length: 0,
    offset: 500
  }));

  it('creates offset segments for each edge with positive offset', () => {
    const segments = buildEaveSegments(rectangle, dimensions);
    expect(segments).toHaveLength(4);
    const top = segments[0];
    expect(top.points[0]).toEqual({ x: 0, y: -500 });
    expect(top.points[1]).toEqual({ x: 6000, y: -500 });
    const right = segments[1];
    expect(right.points[0]).toEqual({ x: 6500, y: 0 });
    expect(right.points[1]).toEqual({ x: 6500, y: 4000 });
  });

  it('respects polygon orientation when generating normals', () => {
    const reversed = [...rectangle].reverse();
    const reversedDimensions: EdgeDimension[] = [...dimensions].reverse();
    const segments = buildEaveSegments(reversed, reversedDimensions);
    const topSegment = segments.find((segment) => segment.points.every((point) => point.y === -500));
    expect(topSegment).toBeDefined();
  });
});
