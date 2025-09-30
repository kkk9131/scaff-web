import { buildEaveSegmentsForRendering } from '../EaveLineRenderer';
import type { EdgeDimension } from '../../../context/BuildingProvider';
import type { Point } from '../../floorplan/types';

const rectangle: Point[] = [
  { x: 0, y: 0 },
  { x: 6000, y: 0 },
  { x: 6000, y: 4000 },
  { x: 0, y: 4000 }
];

const dimensions: EdgeDimension[] = rectangle.map((_, index) => ({
  edgeId: `edge-${index}`,
  length: 0,
  offset: 600
}));

describe('EaveLineRenderer', () => {
  it('renders extended eave segments with floor color', () => {
    const segments = buildEaveSegmentsForRendering({
      polygon: rectangle,
      dimensions,
      strokeColor: '#2563eb'
    });

    expect(segments).toHaveLength(4);
    segments.forEach((segment) => {
      expect(segment.points).toHaveLength(2);
      expect(segment.color).toBe('#2563eb');
    });

    const first = segments[0].points[0];
    const last = segments[segments.length - 1].points[1];
    expect(first.x).toBeCloseTo(last.x);
    expect(first.y).toBeCloseTo(last.y);
  });

  it('returns no segments when offsets are zero', () => {
    const zeroOffsets = dimensions.map((dimension) => ({ ...dimension, offset: 0 }));
    const segments = buildEaveSegmentsForRendering({
      polygon: rectangle,
      dimensions: zeroOffsets,
      strokeColor: '#2563eb'
    });
    expect(segments).toHaveLength(0);
  });

  it('skips only the edges with zero offset', () => {
    const mixed = dimensions.map((dimension, index) => ({
      ...dimension,
      offset: index % 2 === 0 ? 600 : 0
    }));
    const segments = buildEaveSegmentsForRendering({
      polygon: rectangle,
      dimensions: mixed,
      strokeColor: '#2563eb'
    });
    expect(segments.map((segment) => segment.edgeId)).toEqual([
      'edge-0',
      'edge-1-connector-in',
      'edge-1-connector-out',
      'edge-2',
      'edge-3-connector-in',
      'edge-3-connector-out'
    ]);
    const connectorToVertex = segments.find((segment) => segment.edgeId === 'edge-1-connector-in');
    expect(connectorToVertex?.points[1]).toEqual({ x: 6000, y: 0 });
  });
});
