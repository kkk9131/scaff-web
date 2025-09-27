"use client";

import React, { useMemo } from 'react';
import { Circle, Layer, Line, Stage, Text } from 'react-konva';
import { useBuildingState } from '../context/BuildingProvider';
import type { FloorModel, Point } from '../context/BuildingProvider';

const SCALE = 0.1; // 1px = 10mm
const PADDING = 40;

interface ScaledFloor {
  floor: FloorModel;
  scaledPolygon: Point[];
  pointsArray: number[];
}

const scalePoint = (point: Point): Point => ({
  x: point.x * SCALE + PADDING,
  y: point.y * SCALE + PADDING
});

const buildScaledFloors = (floors: FloorModel[]): ScaledFloor[] =>
  floors.map((floor) => {
    const scaledPolygon = floor.polygon.map(scalePoint);
    const pointsArray = scaledPolygon.flatMap(({ x, y }) => [x, y]);
    return {
      floor,
      scaledPolygon,
      pointsArray
    };
  });

const getCanvasSize = (scaledFloors: ScaledFloor[]): { width: number; height: number } => {
  if (!scaledFloors.length) {
    return { width: 400, height: 400 };
  }

  let maxX = 0;
  let maxY = 0;
  scaledFloors.forEach(({ scaledPolygon }) => {
    scaledPolygon.forEach(({ x, y }) => {
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
  });

  return {
    width: Math.ceil(maxX + PADDING),
    height: Math.ceil(maxY + PADDING)
  };
};

const toModelPoint = (scaledX: number, scaledY: number): Point => ({
  x: Math.round((scaledX - PADDING) / SCALE),
  y: Math.round((scaledY - PADDING) / SCALE)
});

export const PlanViewCanvas: React.FC = () => {
  const { state, dispatch } = useBuildingState();

  const scaledFloors = useMemo(() => buildScaledFloors(state.floors), [state.floors]);
  const { width, height } = useMemo(() => getCanvasSize(scaledFloors), [scaledFloors]);

  const handleVertexDrag = (floorId: string, vertexIndex: number) => (event: any) => {
    const target = event?.target;
    const rawX = typeof target?.x === 'function' ? target.x() : target?.x;
    const rawY = typeof target?.y === 'function' ? target.y() : target?.y;
    if (typeof rawX !== 'number' || typeof rawY !== 'number') {
      return;
    }
    const nextPoint = toModelPoint(rawX, rawY);
    dispatch({ type: 'updateVertex', floorId, vertexIndex, point: nextPoint });
  };

  return (
    <section aria-label="Plan view" className="space-y-2">
      <Stage width={width} height={height} data-testid="plan-stage">
        <Layer>
          {scaledFloors.map(({ floor, scaledPolygon, pointsArray }) => (
            <React.Fragment key={floor.id}>
              <Line
                data-testid="plan-floor-line"
                points={pointsArray}
                stroke={floor.style.strokeColor}
                strokeWidth={floor.style.strokeWidth}
                closed
                listening={false}
                lineCap="round"
                lineJoin="round"
              />
              {scaledPolygon.map((point, index) => (
                <Circle
                  key={`${floor.id}-${index}`}
                  data-testid={`plan-vertex-${index}`}
                  x={point.x}
                  y={point.y}
                  radius={6}
                  fill={floor.style.strokeColor}
                  stroke="white"
                  strokeWidth={1}
                  draggable
                  onDragEnd={handleVertexDrag(floor.id, index)}
                />
              ))}
              <Text
                text={floor.name}
                x={scaledPolygon[0]?.x ?? PADDING}
                y={(scaledPolygon[0]?.y ?? PADDING) - 24}
                fill={floor.style.strokeColor}
                fontSize={14}
              />
            </React.Fragment>
          ))}
        </Layer>
      </Stage>
      {state.lastError && (
        <p role="alert" className="text-sm text-red-600">
          {state.lastError}
        </p>
      )}
    </section>
  );
};
