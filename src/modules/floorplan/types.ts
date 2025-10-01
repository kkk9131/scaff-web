export type TemplateIdentifier =
  | 'rectangle'
  | 'l-shape'
  | 't-shape'
  | 'u-shape'
  | 'concave'
  | 'convex';

export interface Point {
  x: number;
  y: number;
}

export interface FloorplanTemplateMetadata {
  minWidth: number;
  minDepth: number;
}

export interface EaveConfig {
  defaultOffset: number;
}

export interface FloorplanTemplate {
  id: TemplateIdentifier;
  label: string;
  baseVertices: Point[];
  defaultEave: number;
  metadata: FloorplanTemplateMetadata;
}

export interface FloorplanShape {
  floorId: string;
  vertices: Point[];
  eave: EaveConfig;
}

export interface ConstraintState {
  rightAngle: boolean;
  gridSnap: boolean;
  gridVisible: boolean;
  gridSpacing: number;
  dimensionVisible: boolean;
  dimensionVisibleElevation: boolean;
}

export const DEFAULT_CONSTRAINT_STATE: ConstraintState = {
  rightAngle: false,
  gridSnap: false,
  gridVisible: true,
  gridSpacing: 100,
  dimensionVisible: true,
  dimensionVisibleElevation: true
};

const isPoint = (value: unknown): value is Point => (
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Point).x === 'number' &&
  typeof (value as Point).y === 'number'
);

const isMetadata = (value: unknown): value is FloorplanTemplateMetadata => (
  typeof value === 'object' &&
  value !== null &&
  typeof (value as FloorplanTemplateMetadata).minWidth === 'number' &&
  (value as FloorplanTemplateMetadata).minWidth >= 0 &&
  typeof (value as FloorplanTemplateMetadata).minDepth === 'number' &&
  (value as FloorplanTemplateMetadata).minDepth >= 0
);

export const isEaveConfig = (value: unknown): value is EaveConfig => (
  typeof value === 'object' &&
  value !== null &&
  typeof (value as EaveConfig).defaultOffset === 'number' &&
  (value as EaveConfig).defaultOffset >= 0
);

export const isFloorplanTemplate = (value: unknown): value is FloorplanTemplate => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as FloorplanTemplate;
  if (typeof candidate.id !== 'string') {
    return false;
  }
  if (typeof candidate.label !== 'string') {
    return false;
  }
  if (typeof candidate.defaultEave !== 'number' || candidate.defaultEave < 0) {
    return false;
  }
  if (!Array.isArray(candidate.baseVertices) || candidate.baseVertices.some((point) => !isPoint(point))) {
    return false;
  }
  if (!isMetadata(candidate.metadata)) {
    return false;
  }
  return true;
};

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
}

export const validateTemplateDimensions = (template: FloorplanTemplate): TemplateValidationResult => {
  const errors: string[] = [];
  const xs = template.baseVertices.map((vertex) => vertex.x);
  const ys = template.baseVertices.map((vertex) => vertex.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...ys) - Math.min(...ys);

  if (width < template.metadata.minWidth) {
    errors.push('minWidth');
  }
  if (depth < template.metadata.minDepth) {
    errors.push('minDepth');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
