import {
  type FloorplanTemplate,
  type FloorplanShape,
  type TemplateIdentifier,
  type Point,
  validateTemplateDimensions,
  isFloorplanTemplate
} from '../floorplan/types';

const clonePoint = ({ x, y }: Point): Point => ({ x, y });

const TEMPLATE_DEFINITIONS: FloorplanTemplate[] = [
  {
    id: 'rectangle',
    label: '矩形',
    baseVertices: [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 4000 },
      { x: 0, y: 4000 }
    ],
    defaultEave: 500,
    metadata: {
      minWidth: 3000,
      minDepth: 2000
    }
  },
  {
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
      minWidth: 3000,
      minDepth: 3000
    }
  },
  {
    id: 'concave',
    label: '凹型',
    baseVertices: [
      { x: 0, y: 0 },
      { x: 2500, y: 0 },
      { x: 2500, y: 1500 },
      { x: 3500, y: 1500 },
      { x: 3500, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 4000 },
      { x: 0, y: 4000 }
    ],
    defaultEave: 600,
    metadata: {
      minWidth: 4000,
      minDepth: 3000
    }
  },
  {
    id: 't-shape',
    label: 'T字型',
    baseVertices: [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 1500 },
      { x: 4000, y: 1500 },
      { x: 4000, y: 4000 },
      { x: 2000, y: 4000 },
      { x: 2000, y: 1500 },
      { x: 0, y: 1500 }
    ],
    defaultEave: 600,
    metadata: {
      minWidth: 4000,
      minDepth: 3000
    }
  },
  {
    id: 'u-shape',
    label: 'U字型',
    baseVertices: [
      { x: 0, y: 0 },
      { x: 1500, y: 0 },
      { x: 1500, y: 3000 },
      { x: 4500, y: 3000 },
      { x: 4500, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 4000 },
      { x: 0, y: 4000 }
    ],
    defaultEave: 600,
    metadata: {
      minWidth: 4000,
      minDepth: 3000
    }
  },
  {
    id: 'convex',
    label: '凸型',
    baseVertices: [
      { x: 2000, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 1000 },
      { x: 6000, y: 1000 },
      { x: 6000, y: 4000 },
      { x: 0, y: 4000 },
      { x: 0, y: 1000 },
      { x: 2000, y: 1000 }
    ],
    defaultEave: 600,
    metadata: {
      minWidth: 4000,
      minDepth: 3000
    }
  }
];

const TEMPLATE_MAP: Record<TemplateIdentifier, FloorplanTemplate> = TEMPLATE_DEFINITIONS.reduce(
  (acc, template) => {
    if (isFloorplanTemplate(template)) {
      acc[template.id] = template;
    }
    return acc;
  },
  {} as Record<TemplateIdentifier, FloorplanTemplate>
);

export const listTemplates = (): FloorplanTemplate[] => TEMPLATE_DEFINITIONS.map((template) => ({
  ...template,
  baseVertices: template.baseVertices.map(clonePoint)
}));

export const getTemplateById = (id: TemplateIdentifier): FloorplanTemplate | undefined => {
  const template = TEMPLATE_MAP[id];
  if (!template) {
    return undefined;
  }
  return {
    ...template,
    baseVertices: template.baseVertices.map(clonePoint)
  };
};

interface BuildTemplateShapeOptions {
  templateId: TemplateIdentifier;
  floorId: string;
  scale?: number;
}

export const buildTemplateShape = ({
  templateId,
  floorId,
  scale = 1
}: BuildTemplateShapeOptions): FloorplanShape | undefined => {
  const template = getTemplateById(templateId);
  if (!template) {
    return undefined;
  }

  const validation = validateTemplateDimensions(template);
  if (!validation.valid) {
    return undefined;
  }

  const scaledVertices = template.baseVertices.map(({ x, y }) => ({
    x: Math.round(x * scale),
    y: Math.round(y * scale)
  }));

  return {
    floorId,
    vertices: scaledVertices,
    eave: {
      defaultOffset: template.defaultEave
    }
  };
};

export const scaleShape = (shape: FloorplanShape, factor: number): FloorplanShape => ({
  ...shape,
  vertices: shape.vertices.map(({ x, y }) => ({
    x: Math.round(x * factor),
    y: Math.round(y * factor)
  }))
});
