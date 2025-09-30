import type { DrawingModes, FloorModel } from '../../context/BuildingProvider';
import type { Point } from '../floorplan/types';

const snapValueToGrid = (value: number, spacing: number): number => {
  if (!Number.isFinite(spacing) || spacing <= 0) {
    return Math.round(value);
  }
  return Math.round(value / spacing) * spacing;
};

const snapPointToGrid = (point: Point, spacing: number): Point => ({
  x: snapValueToGrid(point.x, spacing),
  y: snapValueToGrid(point.y, spacing)
});

const applyRightAngleConstraint = (point: Point, floor: FloorModel, vertexIndex: number): Point => {
  const polygon = floor.polygon;
  if (!Array.isArray(polygon) || polygon.length < 2) {
    return point;
  }
  const prevIndex = (vertexIndex - 1 + polygon.length) % polygon.length;
  const prevPoint = polygon[prevIndex];
  const dx = Math.abs(point.x - prevPoint.x);
  const dy = Math.abs(point.y - prevPoint.y);
  if (dx < dy) {
    return { x: prevPoint.x, y: point.y };
  }
  return { x: point.x, y: prevPoint.y };
};

export interface ConstraintParameters {
  point: Point;
  vertexIndex: number;
  floor?: FloorModel;
  modes: DrawingModes;
}

export const applyCanvasConstraints = ({
  point,
  vertexIndex,
  floor,
  modes
}: ConstraintParameters): Point => {
  let nextPoint: Point = { ...point };
  if (modes.gridSnap) {
    nextPoint = snapPointToGrid(nextPoint, modes.gridSpacing);
  }
  if (modes.rightAngle && floor) {
    nextPoint = applyRightAngleConstraint(nextPoint, floor, vertexIndex);
  }
  return {
    x: Math.round(nextPoint.x),
    y: Math.round(nextPoint.y)
  };
};
