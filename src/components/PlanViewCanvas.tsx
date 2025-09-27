"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  const scaledFloors = useMemo(() => buildScaledFloors(state.floors), [state.floors]);
  const contentSize = useMemo(() => getCanvasSize(scaledFloors), [scaledFloors]);

  // コンテナサイズに合わせてキャンバスをリサイズ
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setStageSize({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // コンテンツを中央に配置するための計算
  const scale = useMemo(() => {
    const scaleX = (stageSize.width - PADDING * 2) / (contentSize.width - PADDING * 2);
    const scaleY = (stageSize.height - PADDING * 2) / (contentSize.height - PADDING * 2);
    return Math.min(scaleX, scaleY, 1.5); // 最大1.5倍まで拡大
  }, [stageSize, contentSize]);

  const offset = useMemo(() => {
    const scaledWidth = contentSize.width * scale;
    const scaledHeight = contentSize.height * scale;
    return {
      x: (stageSize.width - scaledWidth) / 2,
      y: (stageSize.height - scaledHeight) / 2
    };
  }, [stageSize, contentSize, scale]);

  const handleVertexDrag = (floorId: string, vertexIndex: number) => (event: any) => {
    const target = event?.target;
    const stage = target?.getStage();
    if (!stage) return;

    // スケーリングとオフセットを考慮した座標変換
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const adjustedX = (pos.x - offset.x) / scale;
    const adjustedY = (pos.y - offset.y) / scale;

    const nextPoint = toModelPoint(adjustedX, adjustedY);
    dispatch({ type: 'updateVertex', floorId, vertexIndex, point: nextPoint });
  };

  return (
    <section aria-label="Plan view" className="h-full flex flex-col">
      <div ref={containerRef} className="flex-1 relative bg-slate-800 rounded-lg overflow-hidden">
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          data-testid="plan-stage"
          scale={{ x: scale, y: scale }}
          x={offset.x}
          y={offset.y}
        >
          <Layer>
            {/* グリッド背景 */}
            {Array.from({ length: Math.ceil(contentSize.width / 50) }).map((_, i) => (
              <Line
                key={`grid-v-${i}`}
                points={[i * 50, 0, i * 50, contentSize.height]}
                stroke="#475569"
                strokeWidth={0.5}
                listening={false}
              />
            ))}
            {Array.from({ length: Math.ceil(contentSize.height / 50) }).map((_, i) => (
              <Line
                key={`grid-h-${i}`}
                points={[0, i * 50, contentSize.width, i * 50]}
                stroke="#475569"
                strokeWidth={0.5}
                listening={false}
              />
            ))}

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
                    strokeWidth={2}
                    draggable
                    onDragEnd={handleVertexDrag(floor.id, index)}
                    onMouseEnter={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container) {
                        container.style.cursor = 'grab';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container) {
                        container.style.cursor = 'crosshair';
                      }
                    }}
                  />
                ))}
                <Text
                  text={floor.name}
                  x={scaledPolygon[0]?.x ?? PADDING}
                  y={(scaledPolygon[0]?.y ?? PADDING) - 24}
                  fill={floor.style.strokeColor}
                  fontSize={14}
                  fontStyle="bold"
                />
              </React.Fragment>
            ))}
          </Layer>
        </Stage>
      </div>
      {state.lastError && (
        <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-900/90 border border-red-700 rounded-lg backdrop-blur-sm">
          <p role="alert" className="text-sm text-red-300">
            {state.lastError}
          </p>
        </div>
      )}
    </section>
  );
};
