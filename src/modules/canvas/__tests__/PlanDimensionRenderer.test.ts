import { buildPlanDimensionGroups, buildPlanEaveDimensionLines } from '../PlanDimensionRenderer';
import type { EdgeDimension } from '../../../context/BuildingProvider';
import type { Point } from '../../floorplan/types';

describe('buildPlanDimensionGroups', () => {
  const buildDimensions = (polygon: Point[]): EdgeDimension[] =>
    polygon.map((point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      const dx = next.x - point.x;
      const dy = next.y - point.y;
      const length = Math.round(Math.hypot(dx, dy));
      return {
        edgeId: `edge-${index}`,
        length,
        offset: 0
      };
    });

  it('creates segment and total dimension lines for horizontal sequences', () => {
    const polygon: Point[] = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 700, y: 0 },
      { x: 700, y: 400 },
      { x: 0, y: 400 }
    ];

    const dimensions = buildDimensions(polygon);
    const groups = buildPlanDimensionGroups(polygon, dimensions);
    expect(groups.filter((group) => group.side === 'top')).toHaveLength(1);
    const topGroup = groups.find((group) => group.side === 'top');

    expect(topGroup).toBeDefined();
    expect(topGroup?.orientation).toBe('horizontal');
    expect(topGroup?.segment).not.toBeNull();
    expect(topGroup?.total).not.toBeNull();

    const segmentLabels = topGroup?.segment?.labels.map((label) => label.text) ?? [];
    expect(segmentLabels).toEqual(['500', '200']);

    const totalLabel = topGroup?.total?.labels[0]?.text;
    expect(totalLabel).toBe('700');

    expect(topGroup?.segment?.ticks).toHaveLength(3);
    expect(topGroup?.total?.ticks).toHaveLength(2);

    expect(topGroup?.segment?.start).toEqual({ x: 0, y: -300 });
    expect(topGroup?.segment?.end).toEqual({ x: 700, y: -300 });
  });

  it('merges concave sides into a single outer dimension line', () => {
    const polygon: Point[] = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 400 },
      { x: 0, y: 400 }
    ];

    const dimensions = buildDimensions(polygon);
    const groups = buildPlanDimensionGroups(polygon, dimensions);
    const topGroup = groups.find((group) => group.side === 'top');

    expect(topGroup).toBeDefined();
    expect(topGroup?.segment).not.toBeNull();
    expect(topGroup?.segment?.labels.map((label) => label.text)).toEqual(['200', '100', '200']);
    expect(topGroup?.total?.labels[0]?.text).toBe('500');
  });

  it('omits detail dimension line when side has no break', () => {
    const polygon: Point[] = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 400 },
      { x: 0, y: 400 }
    ];

    const dimensions = buildDimensions(polygon);
    const groups = buildPlanDimensionGroups(polygon, dimensions);
    const topGroup = groups.find((group) => group.side === 'top');

    expect(topGroup).toBeDefined();
    expect(topGroup?.segment).toBeNull();
    expect(topGroup?.total).not.toBeNull();
    expect(topGroup?.total?.labels[0]?.text).toBe('500');
  });

  it('keeps detail dimension line for outward jogs', () => {
    const polygon: Point[] = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: -100 },
      { x: 300, y: -100 },
      { x: 300, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 400 },
      { x: 0, y: 400 }
    ];

    const dimensions = buildDimensions(polygon);
    const groups = buildPlanDimensionGroups(polygon, dimensions);
    const topGroup = groups.find((group) => group.side === 'top');

    expect(topGroup).toBeDefined();
    expect(topGroup?.segment).not.toBeNull();
    expect(topGroup?.segment?.labels.map((label) => label.text)).toEqual(['200', '100', '200']);
  });
});

describe('buildPlanEaveDimensionLines', () => {
  it('returns an empty array regardless of offsets', () => {
    const polygon: Point[] = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 }
    ];

    const dimensions: EdgeDimension[] = polygon.map((point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      const length = Math.round(Math.hypot(next.x - point.x, next.y - point.y));
      return {
        edgeId: `edge-${index}`,
        length,
        offset: index % 2 === 0 ? 500 : 0
      };
    });

    const lines = buildPlanEaveDimensionLines(polygon, dimensions);
    expect(lines).toHaveLength(0);
  });
});
