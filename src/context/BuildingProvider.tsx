"use client";

import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { loadBuildingModel, saveBuildingModel } from '../utils/persistence';
import {
  DEFAULT_CONSTRAINT_STATE,
  type ConstraintState,
  type Point,
  type TemplateIdentifier,
  validateTemplateDimensions
} from '../modules/floorplan/types';
import { buildTemplateShape, getTemplateById } from '../modules/templates/catalog';

export type TemplateType = TemplateIdentifier;

export type RoofType = 'flat' | 'mono' | 'gable' | 'hip';

export interface EdgeDimension {
  edgeId: string;
  length: number;
  offset: number;
}

export interface RoofConfig {
  type: RoofType;
  slopeValue: number;
  ridgeHeight: number;
  parapetHeight: number;
}

export type DrawingModes = ConstraintState;

export type ToggleableDrawingMode = Exclude<keyof DrawingModes, 'gridSpacing'>;

export interface LayerState {
  id: string;
  name: string;
  locked: boolean;
}

export interface FloorStyle {
  strokeColor: string;
  roofStrokeColor: string;
  strokeWidth: number;
  roofDash: [number, number];
}

export interface FloorModel {
  id: string;
  name: string;
  polygon: Point[];
  dimensions: EdgeDimension[];
  height: number;
  roof: RoofConfig;
  style: FloorStyle;
  locked: boolean;
}

export interface BuildingModel {
  template: TemplateType;
  floors: FloorModel[];
  activeFloorId: string;
  selectedEdgeId: string | null;
  modes: DrawingModes;
  lastError: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const BASE_HEIGHT = 3000;
const DEFAULT_SLOPE = 0;
const DEFAULT_RIDGE_INCREMENT = 0;
const DEFAULT_PARAPET_HEIGHT = 0;

export const DEFAULT_DRAWING_MODES: DrawingModes = {
  ...DEFAULT_CONSTRAINT_STATE
};

const FLOOR_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626'];

const FALLBACK_TEMPLATE_ID: TemplateType = 'rectangle';

interface TemplateResolutionOptions {
  allowFallback?: boolean;
}

function resolveTemplateShape(
  templateId: TemplateType,
  floorId: string,
  options?: TemplateResolutionOptions
) {
  const template = getTemplateById(templateId);
  if (!template) {
    if (!options?.allowFallback) {
      return {
        resolvedTemplate: templateId,
        error: '指定したテンプレートが見つかりません。'
      } as const;
    }
  } else {
    const validation = validateTemplateDimensions(template);
    if (!validation.valid) {
      if (!options?.allowFallback) {
        return {
          resolvedTemplate: templateId,
          error: 'テンプレートが最小寸法要件を満たしていません。'
        } as const;
      }
    } else {
      const shape = buildTemplateShape({ templateId, floorId });
      if (shape) {
        return { shape, resolvedTemplate: templateId } as const;
      }
    }
  }

  if (options?.allowFallback) {
    const fallbackShape = buildTemplateShape({ templateId: FALLBACK_TEMPLATE_ID, floorId });
    if (!fallbackShape) {
      throw new Error('テンプレート定義が見つかりません。');
    }
    return {
      shape: fallbackShape,
      resolvedTemplate: FALLBACK_TEMPLATE_ID
    } as const;
  }

  return {
    resolvedTemplate: templateId,
    error: 'テンプレートを読み込めませんでした。'
  } as const;
}


const generateFloorStyle = (index: number): FloorStyle => ({
  strokeColor: FLOOR_COLORS[index % FLOOR_COLORS.length],
  roofStrokeColor: '#000000',
  strokeWidth: 2,
  roofDash: [6, 4]
});

const distance = (a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const edgeIntersects = (a1: Point, a2: Point, b1: Point, b2: Point): boolean => {
  const det = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  const onSegment = (p: Point, q: Point, r: Point) =>
    Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) &&
    Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);

  const d1 = det(a1, a2, b1);
  const d2 = det(a1, a2, b2);
  const d3 = det(b1, b2, a1);
  const d4 = det(b1, b2, a2);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  if (d1 === 0 && onSegment(a1, b1, a2)) return true;
  if (d2 === 0 && onSegment(a1, b2, a2)) return true;
  if (d3 === 0 && onSegment(b1, a1, b2)) return true;
  if (d4 === 0 && onSegment(b1, a2, b2)) return true;

  return false;
};

const polygonHasSelfIntersection = (points: Point[]): boolean => {
  const n = points.length;
  if (n < 4) {
    return false;
  }

  for (let i = 0; i < n; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];

    for (let j = i + 1; j < n; j += 1) {
      const skipAdjacent = j === i || j === i + 1 || (i === 0 && j === n - 1);
      if (skipAdjacent) continue;

      const b1 = points[j];
      const b2 = points[(j + 1) % n];

      if (edgeIntersects(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  return false;
};

const createDimensions = (floorId: string, polygon: Point[]): EdgeDimension[] =>
  polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return {
      edgeId: `${floorId}-edge-${index + 1}`,
      length: Math.round(distance(point, next)),
      offset: 0
    };
  });

export const createInitialBuildingModel = (template: TemplateType): BuildingModel => {
  const floorId = 'floor-1';
  const { shape, resolvedTemplate } = resolveTemplateShape(template, floorId, { allowFallback: true });
  if (!shape) {
    throw new Error('初期テンプレートの生成に失敗しました。');
  }
  const polygon = shape.vertices.map(({ x, y }) => ({ x, y }));

  const floor: FloorModel = {
    id: floorId,
    name: '1F',
    polygon,
    dimensions: createDimensions(floorId, polygon),
    height: BASE_HEIGHT,
    roof: {
      type: 'flat',
      slopeValue: DEFAULT_SLOPE,
      ridgeHeight: BASE_HEIGHT + DEFAULT_RIDGE_INCREMENT,
      parapetHeight: DEFAULT_PARAPET_HEIGHT
    },
    style: generateFloorStyle(0),
    locked: false
  };

  return {
    template: resolvedTemplate,
    floors: [floor],
    activeFloorId: floorId,
    selectedEdgeId: null,
    modes: { ...DEFAULT_DRAWING_MODES },
    lastError: null
  };
};

export const validateBuildingModel = (model: BuildingModel): ValidationResult => {
  const errors: string[] = [];

  if (!model.floors.length) {
    errors.push('少なくとも1つの階層が必要です。');
  }

  model.floors.forEach((floor, index) => {
    if (floor.polygon.length < 3) {
      errors.push(`${floor.name} の頂点数が不足しています。`);
    }

    const hasDuplicatePoint = floor.polygon.some((point, i) =>
      floor.polygon.some((other, j) => j !== i && other.x === point.x && other.y === point.y)
    );
    if (hasDuplicatePoint) {
      errors.push(`${floor.name} に重複した頂点があります。`);
    }

    if (polygonHasSelfIntersection(floor.polygon)) {
      errors.push(`${floor.name} のポリゴンが自己交差しています。`);
    }

    if (floor.height <= 0) {
      errors.push(`${floor.name} の階高が正しくありません。`);
    }

    floor.dimensions.forEach((dimension) => {
      if (dimension.length <= 0) {
        errors.push(`${floor.name} の寸法 ${dimension.edgeId} が無効です。`);
      }
      if (dimension.offset < 0) {
        errors.push(`${floor.name} の寸法 ${dimension.edgeId} のオフセットが負です。`);
      }
    });

    if (floor.dimensions.length !== floor.polygon.length) {
      errors.push(`${floor.name} の寸法数が辺数と一致していません。`);
    }

    if (!floor.style) {
      errors.push(`${floor.name} のスタイル情報が不足しています。`);
    } else {
      if (!floor.style.strokeColor) {
        errors.push(`${floor.name} の線色が設定されていません。`);
      }
    }

    if (!floor.roof) {
      errors.push(`${floor.name} の屋根情報が不足しています。`);
    } else {
      if (!['flat', 'mono', 'gable', 'hip'].includes(floor.roof.type)) {
        errors.push(`${floor.name} の屋根タイプが無効です。`);
      }
      if (
        typeof floor.roof.ridgeHeight !== 'number' ||
        Number.isNaN(floor.roof.ridgeHeight) ||
        floor.roof.ridgeHeight < floor.height
      ) {
        errors.push(`${floor.name} の屋根最高高さが正しくありません。`);
      }
      if (
        typeof floor.roof.parapetHeight !== 'number' ||
        Number.isNaN(floor.roof.parapetHeight) ||
        floor.roof.parapetHeight < 0
      ) {
        errors.push(`${floor.name} の立ち上がり高さが正しくありません。`);
      }
    }

    if (typeof floor.locked !== 'boolean') {
      errors.push(`${floor.name} のロック状態が無効です。`);
    }

    if (!floor.id) {
      errors.push(`階層 ${index} のIDが空です。`);
    }
  });

  if (!model.floors.some((floor) => floor.id === model.activeFloorId)) {
    errors.push('アクティブな階層IDが存在しません。');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

const clonePoint = (point: Point): Point => ({ x: point.x, y: point.y });

const clonePolygon = (polygon: Point[]): Point[] => polygon.map(clonePoint);

const recalculateFloor = (floor: FloorModel, polygon: Point[]): FloorModel => ({
  ...floor,
  polygon,
  dimensions: createDimensions(floor.id, polygon)
});

const nextFloorId = (floors: FloorModel[]): string => {
  const suffix = floors.reduce((max, floor) => {
    const match = floor.id.match(/(\d+)$/);
    const value = match ? parseInt(match[1], 10) : 0;
    return Math.max(max, value);
  }, 0);
  return `floor-${suffix + 1}`;
};

const floorNameForIndex = (index: number): string => `${index + 1}F`;

const duplicateFloor = (floor: FloorModel, index: number, newId: string): FloorModel => ({
  ...floor,
  id: newId,
  name: floorNameForIndex(index),
  polygon: clonePolygon(floor.polygon),
  dimensions: createDimensions(newId, clonePolygon(floor.polygon)),
  style: generateFloorStyle(index),
  locked: false
});

export type BuildingAction =
  | { type: 'noop' }
  | { type: 'selectTemplate'; template: TemplateType }
  | { type: 'applyTemplateToActiveFloor'; template: TemplateType }
  | { type: 'selectEdge'; edgeId: string | null }
  | { type: 'setDrawingMode'; mode: ToggleableDrawingMode; value: boolean }
  | { type: 'generateEaveOffsets'; floorId: string; offset: number }
  | { type: 'updateEaveOffset'; floorId: string; offset: number }
  | { type: 'toggleFloorLock'; floorId: string; locked: boolean }
  | { type: 'setActiveFloor'; floorId: string }
  | { type: 'updateVertex'; floorId: string; vertexIndex: number; point: Point }
  | { type: 'addVertex'; floorId: string; edgeIndex: number; point: Point }
  | { type: 'removeVertex'; floorId: string; vertexIndex: number }
  | { type: 'updateEdgeLength'; floorId: string; edgeId: string; length: number }
  | { type: 'updateEdgeOffset'; floorId: string; edgeId: string; offset: number }
  | { type: 'updateFloorHeight'; floorId: string; height: number }
  | { type: 'updateRoof'; floorId: string; roof: Partial<RoofConfig> }
  | { type: 'addFloor' }
  | { type: 'duplicateFloor'; floorId: string }
  | { type: 'removeFloor'; floorId: string }
  | { type: 'hydrate'; model: BuildingModel };

export interface BuildingStateValue {
  state: BuildingModel;
  dispatch: React.Dispatch<BuildingAction>;
}

const BuildingContext = createContext<BuildingStateValue | undefined>(undefined);

interface FloorUpdateResult {
  floor: FloorModel;
  changed: boolean;
  error?: string;
}

const noChange = (floor: FloorModel, error?: string): FloorUpdateResult => ({
  floor,
  changed: false,
  error
});

const withChange = (floor: FloorModel): FloorUpdateResult => ({ floor, changed: true });

const updateFloors = (
  floors: FloorModel[],
  floorId: string,
  updater: (floor: FloorModel, index: number) => FloorUpdateResult,
  options?: { ignoreLock?: boolean }
): { floors: FloorModel[]; changed: boolean; error?: string } => {
  let changed = false;
  let error: string | undefined;

  const nextFloors = floors.map((floor, index) => {
    if (floor.id !== floorId) {
      return floor;
    }
    if (floor.locked && !options?.ignoreLock) {
      error = 'この階層はロックされています。';
      return floor;
    }
    const result = updater(floor, index);
    if (result.changed) {
      changed = true;
    }
    if (result.error) {
      error = result.error;
    }
    return result.floor;
  });

  return { floors: nextFloors, changed, error };
};

const applyFloorUpdate = (
  state: BuildingModel,
  floorId: string,
  updater: (floor: FloorModel, index: number) => FloorUpdateResult,
  missingFloorMessage?: string,
  options?: { ignoreLock?: boolean }
): BuildingModel => {
  if (!state.floors.some((floor) => floor.id === floorId)) {
    return missingFloorMessage ? { ...state, lastError: missingFloorMessage } : state;
  }
  const { floors, changed, error } = updateFloors(state.floors, floorId, updater, options);
  if (!changed) {
    if (error) {
      return { ...state, lastError: error };
    }
    return state;
  }
  return {
    ...state,
    floors,
    lastError: null
  };
};

const movePointAlongEdge = (start: Point, end: Point, length: number): Point => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const magnitude = Math.sqrt(dx * dx + dy * dy);
  if (magnitude === 0) {
    return clonePoint(end);
  }
  const factor = length / magnitude;
  const nextX = start.x + dx * factor;
  const nextY = start.y + dy * factor;
  return { x: Math.round(nextX), y: Math.round(nextY) };
};

export const buildingReducer = (state: BuildingModel, action: BuildingAction): BuildingModel => {
  switch (action.type) {
    case 'hydrate': {
      return { ...action.model, lastError: null };
    }
    case 'selectTemplate': {
      return createInitialBuildingModel(action.template);
    }
    case 'applyTemplateToActiveFloor': {
      const resolution = resolveTemplateShape(action.template, state.activeFloorId);
      if (!resolution.shape) {
        return {
          ...state,
          lastError: resolution.error ?? 'テンプレートを読み込めませんでした。'
        };
      }
      const nextState = applyFloorUpdate(
        state,
        state.activeFloorId,
        (floor) => {
          if (floor.locked) {
            return noChange(floor, 'この階層はロックされているためテンプレートを適用できません。');
          }
          const nextPolygon = resolution.shape.vertices.map(clonePoint);
          return withChange(recalculateFloor(floor, nextPolygon));
        },
        '対象の階層が見つかりません。'
      );
      if (nextState === state && nextState.lastError) {
        return nextState;
      }
      return {
        ...nextState,
        template: resolution.resolvedTemplate,
        selectedEdgeId: null,
        lastError: resolution.error ?? nextState.lastError
      };
    }
    case 'selectEdge': {
      return { ...state, selectedEdgeId: action.edgeId, lastError: null };
    }
    case 'setDrawingMode': {
      if (!(action.mode in state.modes)) {
        return state;
      }
      if (state.modes[action.mode] === action.value) {
        return state;
      }
      return {
        ...state,
        modes: { ...state.modes, [action.mode]: action.value },
        lastError: null
      };
    }
    case 'setActiveFloor': {
      if (!state.floors.some((floor) => floor.id === action.floorId)) {
        return { ...state, lastError: '指定した階層が見つかりません。' };
      }
      return { ...state, activeFloorId: action.floorId, lastError: null };
    }
    case 'updateVertex': {
      const { floorId, vertexIndex, point } = action;
      return applyFloorUpdate(
        state,
        floorId,
        (floor) => {
          if (vertexIndex < 0 || vertexIndex >= floor.polygon.length) {
            return noChange(floor, '頂点のインデックスが不正です。');
          }
          const nextPolygon = clonePolygon(floor.polygon);
          nextPolygon[vertexIndex] = clonePoint(point);
          if (polygonHasSelfIntersection(nextPolygon)) {
            return noChange(floor, '頂点の操作によりポリゴンが自己交差しました。');
          }
          return withChange(recalculateFloor(floor, nextPolygon));
        },
        '対象の階層が見つかりません。'
      );
    }
    case 'addVertex': {
      const { floorId, edgeIndex, point } = action;
      return applyFloorUpdate(
        state,
        floorId,
        (floor) => {
          if (floor.polygon.length < 2) {
            return noChange(floor, 'ポリゴンの頂点が不足しています。');
          }
          const index = ((edgeIndex % floor.polygon.length) + floor.polygon.length) % floor.polygon.length;
          const nextPolygon = clonePolygon(floor.polygon);
          nextPolygon.splice(index + 1, 0, clonePoint(point));
          if (polygonHasSelfIntersection(nextPolygon)) {
            return noChange(floor, '頂点追加によりポリゴンが自己交差しました。');
          }
          return withChange(recalculateFloor(floor, nextPolygon));
        },
        '対象の階層が見つかりません。'
      );
    }
    case 'removeVertex': {
      const { floorId, vertexIndex } = action;
      return applyFloorUpdate(
        state,
        floorId,
        (floor) => {
          if (floor.polygon.length <= 3) {
            return noChange(floor, 'ポリゴンは最低3つの頂点が必要です。');
          }
          if (vertexIndex < 0 || vertexIndex >= floor.polygon.length) {
            return noChange(floor, '頂点のインデックスが不正です。');
          }
          const nextPolygon = clonePolygon(floor.polygon);
          nextPolygon.splice(vertexIndex, 1);
          if (polygonHasSelfIntersection(nextPolygon)) {
            return noChange(floor, '頂点削除によりポリゴンが自己交差しました。');
          }
          return withChange(recalculateFloor(floor, nextPolygon));
        },
        '対象の階層が見つかりません。'
      );
    }
    case 'generateEaveOffsets': {
      if (action.offset < 0) {
        return { ...state, lastError: '軒の出オフセットは0以上で指定してください。' };
      }
      const nextState = applyFloorUpdate(
        state,
        action.floorId,
        (floor) => {
          if (floor.locked) {
            return noChange(floor, 'この階層はロックされています。');
          }
          const nextDimensions = floor.dimensions.map((dimension) => ({
            ...dimension,
            offset: action.offset
          }));
          return withChange({ ...floor, dimensions: nextDimensions });
        },
        '対象の階層が見つかりません。'
      );
      if (nextState === state && nextState.lastError) {
        return nextState;
      }
      return { ...nextState, selectedEdgeId: null };
    }
    case 'updateEdgeLength': {
      const { floorId, edgeId, length } = action;
      if (length <= 0) {
        return { ...state, lastError: '寸法は正の値で指定してください。' };
      }
      return applyFloorUpdate(
        state,
        floorId,
        (floor) => {
          const edgeIndex = floor.dimensions.findIndex((edge) => edge.edgeId === edgeId);
          if (edgeIndex === -1) {
            return noChange(floor, '対象の寸法が見つかりません。');
          }
          const nextPolygon = clonePolygon(floor.polygon);
          const startIndex = edgeIndex;
          const endIndex = (edgeIndex + 1) % nextPolygon.length;
          const start = nextPolygon[startIndex];
          const end = nextPolygon[endIndex];
          const updatedEnd = movePointAlongEdge(start, end, length);
          nextPolygon[endIndex] = updatedEnd;
          if (polygonHasSelfIntersection(nextPolygon)) {
            return noChange(floor, '寸法変更によりポリゴンが自己交差しました。');
          }
          return withChange(recalculateFloor(floor, nextPolygon));
        },
        '対象の階層が見つかりません。'
      );
    }
    case 'toggleFloorLock': {
      return applyFloorUpdate(
        state,
        action.floorId,
        (floor) => {
          if (floor.locked === action.locked) {
            return noChange(floor);
          }
          return withChange({ ...floor, locked: action.locked });
        },
        '対象の階層が見つかりません。',
        { ignoreLock: true }
      );
    }
    case 'updateEdgeOffset': {
      const { floorId, edgeId, offset } = action;
      if (offset < 0) {
        return { ...state, lastError: '境界距離は0以上で指定してください。' };
      }
      return applyFloorUpdate(
        state,
        floorId,
        (floor) => {
          const edgeIndex = floor.dimensions.findIndex((dimension) => dimension.edgeId === edgeId);
          if (edgeIndex === -1) {
            return noChange(floor, '対象の寸法が見つかりません。');
          }
          if (floor.dimensions[edgeIndex].offset === offset) {
            return noChange(floor);
          }
          const nextDimensions = floor.dimensions.map((dimension) =>
            dimension.edgeId === edgeId ? { ...dimension, offset } : dimension
          );
          return withChange({ ...floor, dimensions: nextDimensions });
        },
        '対象の階層が見つかりません。'
      );
    }
    case 'updateFloorHeight': {
      const { floorId, height } = action;
      if (height <= 0) {
        return { ...state, lastError: '階高は正の値で指定してください。' };
      }
      return applyFloorUpdate(
        state,
        floorId,
        (floor) => {
          if (floor.height === height) {
            return noChange(floor);
          }
          return withChange({ ...floor, height });
        },
        '対象の階層が見つかりません。'
      );
    }
    case 'updateRoof': {
      const { floorId, roof } = action;
      return applyFloorUpdate(
        state,
        floorId,
        (floor) => {
          const nextType = (roof.type ?? floor.roof.type) as RoofType;
          if (!['flat', 'mono', 'gable', 'hip'].includes(nextType)) {
            return noChange(floor, '屋根タイプが無効です。');
          }

          const rawSlope = roof.slopeValue !== undefined ? Number(roof.slopeValue) : floor.roof.slopeValue;
          if (roof.slopeValue !== undefined && (!Number.isFinite(rawSlope) || rawSlope < 0)) {
            return noChange(floor, '屋根勾配は0以上で指定してください。');
          }

          const requestedSlope = Number.isFinite(rawSlope) ? rawSlope : floor.roof.slopeValue;

          const rawRidge =
            roof.ridgeHeight !== undefined ? Number(roof.ridgeHeight) : floor.roof.ridgeHeight;

          const rawParapet =
            roof.parapetHeight !== undefined ? Number(roof.parapetHeight) : floor.roof.parapetHeight;

          if (roof.parapetHeight !== undefined && (!Number.isFinite(rawParapet) || rawParapet < 0)) {
            return noChange(floor, '立ち上がりは0以上で指定してください。');
          }

          let slopeValue = Number.isFinite(requestedSlope) ? Math.max(0, requestedSlope) : 0;
          let ridgeHeight = Number.isFinite(rawRidge) ? rawRidge : floor.roof.ridgeHeight;
          let parapetHeight = Math.max(0, Number.isFinite(rawParapet) ? rawParapet : 0);

          if (nextType === 'flat') {
            slopeValue = 0;
            const parapetTop = floor.height + parapetHeight;
            ridgeHeight = Math.max(parapetTop, floor.height);
          } else {
            parapetHeight = 0;
            if (
              roof.ridgeHeight !== undefined &&
              (!Number.isFinite(rawRidge) || rawRidge < floor.height)
            ) {
              return noChange(floor, '屋根最高高さは階高以上で指定してください。');
            }
            ridgeHeight = Number.isFinite(rawRidge) ? rawRidge : floor.roof.ridgeHeight;
            if (!Number.isFinite(ridgeHeight) || ridgeHeight < floor.height) {
              return noChange(floor, '屋根最高高さは階高以上で指定してください。');
            }
          }

          if (!Number.isFinite(ridgeHeight)) {
            return noChange(floor, '屋根最高高さが無効です。');
          }

          const nextRoof: RoofConfig = {
            type: nextType,
            slopeValue,
            ridgeHeight,
            parapetHeight
          };

          if (
            nextRoof.type === floor.roof.type &&
            nextRoof.slopeValue === floor.roof.slopeValue &&
            nextRoof.ridgeHeight === floor.roof.ridgeHeight &&
            nextRoof.parapetHeight === floor.roof.parapetHeight
          ) {
            return noChange(floor);
          }

          return withChange({ ...floor, roof: nextRoof });
        },
        '対象の階層が見つかりません。'
      );
    }
    case 'updateEaveOffset': {
      const { floorId, offset } = action;
      const normalized = Number(offset);
      if (!Number.isFinite(normalized) || normalized < 0) {
        return { ...state, lastError: '軒の出は0以上で指定してください。' };
      }
      return applyFloorUpdate(
        state,
        floorId,
        (floor) => {
          const nextDimensions = floor.dimensions.map((dimension) =>
            dimension.offset === normalized ? dimension : { ...dimension, offset: normalized }
          );
          const changed = nextDimensions.some((dimension, index) => dimension !== floor.dimensions[index]);
          if (!changed) {
            return noChange(floor);
          }
          return withChange({ ...floor, dimensions: nextDimensions });
        },
        '対象の階層が見つかりません。'
      );
    }
    case 'addFloor': {
      const activeFloor = state.floors.find((floor) => floor.id === state.activeFloorId);
      const sourceFloor = activeFloor ?? state.floors[0];
      const newIndex = state.floors.length;
      const newId = nextFloorId(state.floors);
      const templateResolution = resolveTemplateShape(state.template, newId, { allowFallback: true });
      if (!sourceFloor && !templateResolution.shape) {
        throw new Error('テンプレート初期化に失敗しました。');
      }
      const polygon = sourceFloor
        ? clonePolygon(sourceFloor.polygon)
        : clonePolygon(templateResolution.shape!.vertices);
      const roof = sourceFloor?.roof ?? {
        type: 'flat',
        slopeValue: DEFAULT_SLOPE,
        ridgeHeight: BASE_HEIGHT + DEFAULT_RIDGE_INCREMENT,
        parapetHeight: DEFAULT_PARAPET_HEIGHT
      };
      const newFloor: FloorModel = {
        id: newId,
        name: floorNameForIndex(newIndex),
        polygon,
        dimensions: createDimensions(newId, polygon),
        height: sourceFloor?.height ?? BASE_HEIGHT,
        roof: { ...roof },
        style: generateFloorStyle(newIndex),
        locked: false
      };
      return {
        ...state,
        floors: [...state.floors, newFloor],
        activeFloorId: newFloor.id,
        lastError: null
      };
    }
    case 'duplicateFloor': {
      const targetIndex = state.floors.findIndex((floor) => floor.id === action.floorId);
      if (targetIndex === -1) {
        return { ...state, lastError: '複製対象の階層が見つかりません。' };
      }
      const newId = nextFloorId(state.floors);
      const insertionIndex = targetIndex + 1;
      const newFloor = duplicateFloor(state.floors[targetIndex], insertionIndex, newId);
      const newFloors = [
        ...state.floors.slice(0, insertionIndex),
        newFloor,
        ...state.floors.slice(insertionIndex)
      ].map((floor, index) => ({
        ...floor,
        name: floorNameForIndex(index),
        style: generateFloorStyle(index)
      }));
      return {
        ...state,
        floors: newFloors,
        activeFloorId: newFloor.id,
        lastError: null
      };
    }
    case 'removeFloor': {
      if (state.floors.length <= 1) {
        return { ...state, lastError: '階層は最低1つ必要です。' };
      }
      if (!state.floors.some((floor) => floor.id === action.floorId)) {
        return { ...state, lastError: '削除対象の階層が見つかりません。' };
      }
      const filtered = state.floors.filter((floor) => floor.id !== action.floorId);
      const updatedFloors = filtered.map((floor, index) => ({
        ...floor,
        name: floorNameForIndex(index),
        style: generateFloorStyle(index)
      }));
      const activeFloorId = updatedFloors.some((floor) => floor.id === state.activeFloorId)
        ? state.activeFloorId
        : updatedFloors[updatedFloors.length - 1].id;
      return {
        ...state,
        floors: updatedFloors,
        activeFloorId,
        lastError: null
      };
    }
    case 'noop':
    default:
      return state;
  }
};

export interface BuildingProviderProps {
  initialTemplate?: TemplateType;
  children: React.ReactNode;
}

export const BuildingProvider: React.FC<BuildingProviderProps> = ({
  initialTemplate = 'rectangle',
  children
}) => {
  const initialState = useMemo(() => createInitialBuildingModel(initialTemplate), [initialTemplate]);

  const [state, dispatch] = useReducer(buildingReducer, initialState);
  const skipFirstSave = useRef(true);

  useEffect(() => {
    const result = loadBuildingModel();
    if (result.ok && result.data) {
      dispatch({ type: 'hydrate', model: { ...result.data, lastError: null } });
    }
  }, []);

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    saveBuildingModel({ ...state, lastError: null });
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <BuildingContext.Provider value={value}>{children}</BuildingContext.Provider>;
};

export const useBuildingState = (): BuildingStateValue => {
  const context = useContext(BuildingContext);
  if (!context) {
    throw new Error('useBuildingState must be used within a BuildingProvider');
  }
  return context;
};
