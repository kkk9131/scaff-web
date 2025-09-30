import { buildTemplateShape, getTemplateById, scaleShape } from '../catalog';

const floorId = 'floor-test';

describe('Template catalog', () => {
  it('exposes predefined templates', () => {
    const lShape = getTemplateById('l-shape');
    const concave = getTemplateById('concave');
    const convex = getTemplateById('convex');
    const tee = getTemplateById('t-shape');
    const uShape = getTemplateById('u-shape');
    expect(lShape?.label).toContain('L');
    expect(concave).toBeDefined();
    expect(convex).toBeDefined();
    expect(tee).toBeDefined();
    expect(uShape).toBeDefined();
  });

  it('builds a floorplan shape with default eave offset', () => {
    const shape = buildTemplateShape({ templateId: 'l-shape', floorId });
    expect(shape).toBeDefined();
    expect(shape?.floorId).toBe(floorId);
    expect(shape?.vertices.length).toBeGreaterThan(4);
    expect(shape?.eave.defaultOffset).toBeGreaterThan(0);
  });

  it('scales template vertices by the provided factor', () => {
    const shape = buildTemplateShape({ templateId: 'l-shape', floorId });
    expect(shape).toBeDefined();
    const scaled = scaleShape(shape!, 0.5);
    expect(scaled.vertices[1].x).toBeCloseTo(shape!.vertices[1].x * 0.5);
  });
});
