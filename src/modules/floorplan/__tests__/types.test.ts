import {
  isFloorplanTemplate,
  validateTemplateDimensions,
  DEFAULT_CONSTRAINT_STATE,
  isEaveConfig,
  type FloorplanTemplate,
  type EaveConfig
} from '../types';

const makeTemplate = (override?: Partial<FloorplanTemplate>): FloorplanTemplate => ({
  id: 'l-shape',
  label: 'L字型',
  baseVertices: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 2000 },
    { x: 2000, y: 2000 },
    { x: 2000, y: 4000 },
    { x: 0, y: 4000 }
  ],
  defaultEave: 600,
  metadata: {
    minWidth: 2000,
    minDepth: 2000
  },
  ...override
});

describe('Floorplan type helpers', () => {
  it('detects a valid floorplan template shape', () => {
    const template = makeTemplate();
    expect(isFloorplanTemplate(template)).toBe(true);
  });

  it('rejects invalid template metadata', () => {
    const template = makeTemplate({ metadata: { minWidth: -10, minDepth: 0 } });
    expect(isFloorplanTemplate(template)).toBe(false);
  });

  it('validates bounding box against metadata', () => {
    const template = makeTemplate({
      baseVertices: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 }
      ]
    });
    const result = validateTemplateDimensions(template);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('minWidth');
  });

  it('exposes default constraint state with 100mm grid spacing', () => {
    expect(DEFAULT_CONSTRAINT_STATE.gridSpacing).toBe(100);
  });

  it('identifies valid eave config objects', () => {
    const config: EaveConfig = { defaultOffset: 500 };
    expect(isEaveConfig(config)).toBe(true);
    expect(isEaveConfig({ defaultOffset: -100 })).toBe(false);
  });
});
