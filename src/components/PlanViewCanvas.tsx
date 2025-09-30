"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Circle, Layer, Line, Stage, Text } from 'react-konva';
import { useBuildingState } from '../context/BuildingProvider';
import type { FloorModel } from '../context/BuildingProvider';
import type { Point } from '../modules/floorplan/types';
import { buildEaveSegmentsForRendering } from '../modules/canvas/EaveLineRenderer';
import {
  buildPlanDimensionGroups,
  type PlanDimensionGroup,
  type DimensionLineData
} from '../modules/canvas/PlanDimensionRenderer';
import { applyCanvasConstraints } from '../modules/canvas/CanvasConstraintController';

const SCALE = 0.1; // 1px = 10mm
const PADDING = 40;
const DIMENSION_STROKE = '#e2e8f0';
const DIMENSION_FONT_SIZE = 12;
const DIMENSION_TEXT_FILL = '#f1f5f9';
interface ScaledSegment {
  edgeId: string;
  pointsArray: number[];
  color: string;
}

interface ScaledEaveDimensionLine {
  id: string;
  pointsArray: number[];
  labelPosition: Point;
  label: string;
}

interface ScaledDimensionTick {
  id: string;
  pointsArray: number[];
}

interface ScaledDimensionLabel {
  id: string;
  text: string;
  position: Point;
  side: 'top' | 'bottom' | 'left' | 'right';
}

interface ScaledDimensionLine {
  id: string;
  pointsArray: number[];
  ticks: ScaledDimensionTick[];
  labels: ScaledDimensionLabel[];
  orientation: 'horizontal' | 'vertical';
  side: 'top' | 'bottom' | 'left' | 'right';
}

interface ScaledDimensionGroup {
  id: string;
  segment: ScaledDimensionLine | null;
  total: ScaledDimensionLine | null;
}

interface ScaledFloor {
  floor: FloorModel;
  scaledPolygon: Point[];
  pointsArray: number[];
  selectedEdgeIndex: number;
  selectedVertices: Set<number>;
  eaveSegments: ScaledSegment[];
  eaveDimensionLines: ScaledEaveDimensionLine[];
  dimensionGroups: ScaledDimensionGroup[];
}

const scalePoint = (point: Point): Point => ({
  x: point.x * SCALE + PADDING,
  y: point.y * SCALE + PADDING
});

const scaleSegment = (points: Point[]): number[] => {
  const scaled = points.map(scalePoint);
  return scaled.flatMap(({ x, y }) => [x, y]);
};

const scalePointsToArray = (points: Point[]): number[] => points.flatMap(({ x, y }) => [x, y]);

const estimateTextWidth = (text: string, fontSize: number): number => {
  if (!text) {
    return 0;
  }
  return text.length * fontSize * 0.6;
};

const scaleDimensionLine = (line: DimensionLineData | null): ScaledDimensionLine | null => {
  if (!line) return null;
  const start = scalePoint(line.start);
  const end = scalePoint(line.end);
  return {
    id: line.id,
    pointsArray: [start.x, start.y, end.x, end.y],
    ticks: line.ticks.map((tick) => ({
      id: tick.id,
      pointsArray: scalePointsToArray([scalePoint(tick.start), scalePoint(tick.end)])
    })),
    labels: line.labels.map((label) => ({
      id: label.id,
      text: label.text,
      position: scalePoint(label.position),
      side: label.side
    })),
    orientation: line.orientation,
    side: line.side
  };
};

const buildScaledFloors = (
  floors: FloorModel[],
  selectedEdgeId: string | null,
  activeFloorId: string,
  dimensionVisible: boolean
): ScaledFloor[] => {
  const multipleFloors = floors.length > 1;
  return floors.map((floor) => {
    const scaledPolygon = floor.polygon.map(scalePoint);
    const pointsArray = scaledPolygon.flatMap(({ x, y }) => [x, y]);
    const isActive = floor.id === activeFloorId;
    const showDimensions = dimensionVisible && (!multipleFloors || isActive);
    const selectedEdgeIndex = isActive && selectedEdgeId
      ? floor.dimensions.findIndex((dimension) => dimension.edgeId === selectedEdgeId)
      : -1;
    const selectedVertices = new Set<number>();
    if (selectedEdgeIndex >= 0 && floor.polygon.length >= 2) {
      selectedVertices.add(selectedEdgeIndex);
      selectedVertices.add((selectedEdgeIndex + 1) % floor.polygon.length);
    }
    const rawEaveSegments = buildEaveSegmentsForRendering({
      polygon: floor.polygon,
      dimensions: floor.dimensions,
      strokeColor: floor.style.strokeColor
    });
    const eaveSegments = rawEaveSegments.map((segment) => ({
      edgeId: segment.edgeId,
      pointsArray: scaleSegment(segment.points),
      color: segment.color
    }));

    const eaveDimensionLines = showDimensions
      ? floor.dimensions.reduce<ScaledEaveDimensionLine[]>((acc, dimension, index) => {
        const offset = dimension.offset ?? 0;
        if (offset <= 0) {
          return acc;
        }
        const start = floor.polygon[index];
        const end = floor.polygon[(index + 1) % floor.polygon.length];
        if (!start || !end) {
          return acc;
        }
        const matchingSegment = rawEaveSegments.find((segment) => segment.edgeId === dimension.edgeId);
        if (!matchingSegment) {
          return acc;
        }
        const [offsetStart, offsetEnd] = matchingSegment.points;
        const baseMidpoint: Point = {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2
        };
        const offsetMidpoint: Point = {
          x: (offsetStart.x + offsetEnd.x) / 2,
          y: (offsetStart.y + offsetEnd.y) / 2
        };
        const labelPoint: Point = {
          x: (baseMidpoint.x + offsetMidpoint.x) / 2,
          y: (baseMidpoint.y + offsetMidpoint.y) / 2
        };

        acc.push({
          id: dimension.edgeId,
          pointsArray: scaleSegment([baseMidpoint, offsetMidpoint]),
          labelPosition: scalePoint(labelPoint),
          label: `${offset}mm`
        });
        return acc;
      }, [])
      : [];

    const dimensionGroups = showDimensions
      ? buildPlanDimensionGroups(floor.polygon, floor.dimensions)
      : [];
    return {
      floor,
      scaledPolygon,
      pointsArray,
      selectedEdgeIndex: isActive ? selectedEdgeIndex : -1,
      selectedVertices,
      eaveSegments,
      eaveDimensionLines,
      dimensionGroups: dimensionGroups.map((group) => ({
        id: group.id,
        segment: scaleDimensionLine(group.segment),
        total: scaleDimensionLine(group.total)
      }))
    };
  });
};

const getCanvasSize = (scaledFloors: ScaledFloor[]): { width: number; height: number } => {
  if (!scaledFloors.length) {
    return { width: 400, height: 400 };
  }

  let maxX = 0;
  let maxY = 0;
  scaledFloors.forEach(({ scaledPolygon, dimensionGroups }) => {
    scaledPolygon.forEach(({ x, y }) => {
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    const considerLine = (line: ScaledDimensionLine | null) => {
      if (!line) return;
      for (let i = 0; i < line.pointsArray.length; i += 2) {
        const x = line.pointsArray[i];
        const y = line.pointsArray[i + 1];
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      line.ticks.forEach((tick) => {
        for (let i = 0; i < tick.pointsArray.length; i += 2) {
          const x = tick.pointsArray[i];
          const y = tick.pointsArray[i + 1];
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      });
      line.labels.forEach((label) => {
        maxX = Math.max(maxX, label.position.x);
        maxY = Math.max(maxY, label.position.y);
      });
    };

    dimensionGroups.forEach((group) => {
      considerLine(group.segment);
      considerLine(group.total);
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
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);

  const scaledFloors = useMemo(
    () => buildScaledFloors(state.floors, state.selectedEdgeId, state.activeFloorId, state.modes.dimensionVisible),
    [state.floors, state.selectedEdgeId, state.activeFloorId, state.modes.dimensionVisible]
  );
  const contentSize = useMemo(() => getCanvasSize(scaledFloors), [scaledFloors]);
  const gridSpacingPx = useMemo(() => {
    const spacing = state.modes.gridSpacing > 0 ? state.modes.gridSpacing : 100;
    return Math.max(spacing * SCALE, 1);
  }, [state.modes.gridSpacing]);

  const gridBounds = useMemo(() => {
    const safeScale = transform.scale || 1;
    const inverseScale = 1 / safeScale;
    const minX = Math.min((-transform.x) * inverseScale, (stageSize.width - transform.x) * inverseScale);
    const maxX = Math.max((-transform.x) * inverseScale, (stageSize.width - transform.x) * inverseScale);
    const minY = Math.min((-transform.y) * inverseScale, (stageSize.height - transform.y) * inverseScale);
    const maxY = Math.max((-transform.y) * inverseScale, (stageSize.height - transform.y) * inverseScale);
    return { minX, maxX, minY, maxY };
  }, [stageSize.width, stageSize.height, transform.x, transform.y, transform.scale]);
  const { minX: gridMinX, maxX: gridMaxX, minY: gridMinY, maxY: gridMaxY } = gridBounds;

  const verticalGridLines = useMemo(() => {
    if (!state.modes.gridVisible || !Number.isFinite(gridSpacingPx) || gridSpacingPx <= 0) {
      return [];
    }
    const startIndex = Math.floor(gridMinX / gridSpacingPx) - 1;
    const endIndex = Math.ceil(gridMaxX / gridSpacingPx) + 1;
    const lines: number[] = [];
    for (let index = startIndex; index <= endIndex; index += 1) {
      lines.push(index * gridSpacingPx);
    }
    return lines;
  }, [state.modes.gridVisible, gridSpacingPx, gridMinX, gridMaxX]);

  const horizontalGridLines = useMemo(() => {
    if (!state.modes.gridVisible || !Number.isFinite(gridSpacingPx) || gridSpacingPx <= 0) {
      return [];
    }
    const startIndex = Math.floor(gridMinY / gridSpacingPx) - 1;
    const endIndex = Math.ceil(gridMaxY / gridSpacingPx) + 1;
    const lines: number[] = [];
    for (let index = startIndex; index <= endIndex; index += 1) {
      lines.push(index * gridSpacingPx);
    }
    return lines;
  }, [state.modes.gridVisible, gridSpacingPx, gridMinY, gridMaxY]);

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

  const scale = useMemo(() => {
    const scaleX = (stageSize.width - PADDING * 2) / (contentSize.width - PADDING * 2);
    const scaleY = (stageSize.height - PADDING * 2) / (contentSize.height - PADDING * 2);
    return Math.min(scaleX, scaleY, 1.5);
  }, [stageSize, contentSize]);

  const offset = useMemo(() => {
    const scaledWidth = contentSize.width * scale;
    const scaledHeight = contentSize.height * scale;
    return {
      x: (stageSize.width - scaledWidth) / 2,
      y: (stageSize.height - scaledHeight) / 2
    };
  }, [stageSize, contentSize, scale]);

  useEffect(() => {
    if (!hasInteracted) {
      setTransform({ scale, x: offset.x, y: offset.y });
    }
  }, [scale, offset.x, offset.y, hasInteracted]);

  const handleWheel = (event: any) => {
    event.evt.preventDefault();
    const stage = event.target?.getStage?.();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    setHasInteracted(true);

    const scaleBy = 1.05;
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const oldScale = stage.scaleX();
    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.min(5, Math.max(0.2, newScale));

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    };

    setTransform({ scale: newScale, x: newPos.x, y: newPos.y });
  };

  const handleStageDragEnd = (event: any) => {
    setHasInteracted(true);
    const { x, y } = event.target.position();
    setTransform((prev) => ({ ...prev, x, y }));
  };

  const handleVertexDrag = (floorId: string, vertexIndex: number) => (event: any) => {
    const stage = event?.target?.getStage?.();
    if (!stage || typeof stage.getPointerPosition !== 'function') return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    let contentPoint: Point;
    if (typeof stage.getAbsoluteTransform === 'function') {
      const inverseTransform = stage.getAbsoluteTransform().copy().invert();
      contentPoint = inverseTransform.point(pointer) as Point;
    } else {
      contentPoint = {
        x: (pointer.x - transform.x) / transform.scale,
        y: (pointer.y - transform.y) / transform.scale
      };
    }

    const floor = state.floors.find((item) => item.id === floorId);
    const nextPoint = applyCanvasConstraints({
      point: toModelPoint(contentPoint.x, contentPoint.y),
      vertexIndex,
      floor,
      modes: state.modes
    });

    if (event?.target && typeof event.target.position === 'function') {
      const canvasPoint = scalePoint(nextPoint);
      event.target.position({ x: canvasPoint.x, y: canvasPoint.y });
      event.target.getLayer?.().batchDraw?.();
    }

    dispatch({ type: 'updateVertex', floorId, vertexIndex, point: nextPoint });
  };

  const renderDimensionLine = (
    line: ScaledDimensionLine | null,
    keyPrefix: string,
    variant: 'segment' | 'total'
  ) => {
    if (!line) return null;
    const baseKey = `${keyPrefix}-${variant}-${line.id}`;
    const lineTestId = variant === 'segment'
      ? 'plan-dimension-line-segment'
      : 'plan-dimension-line-total';
    return (
      <React.Fragment key={baseKey}>
        <Line
          data-testid={lineTestId}
          points={line.pointsArray}
          stroke={DIMENSION_STROKE}
          strokeWidth={1.2}
          listening={false}
        />
        {line.ticks.map((tick) => (
          <Line
            key={`${baseKey}-tick-${tick.id}`}
            data-testid="plan-dimension-tick"
            points={tick.pointsArray}
            stroke={DIMENSION_STROKE}
            strokeWidth={1}
            listening={false}
          />
        ))}
        {line.labels.map((label) => {
          const textWidth = estimateTextWidth(label.text, DIMENSION_FONT_SIZE);
          return (
            <Text
              key={`${baseKey}-label-${label.id}`}
              text={label.text}
              x={label.position.x}
              y={label.position.y}
              fontSize={DIMENSION_FONT_SIZE}
              fill={DIMENSION_TEXT_FILL}
              listening={false}
              offsetX={textWidth / 2}
              offsetY={DIMENSION_FONT_SIZE / 2}
            />
          );
        })}
      </React.Fragment>
    );
  };

  return (
    <section aria-label="Plan view" className="h-full flex flex-col">
      <div ref={containerRef} className="flex-1 relative bg-slate-800 rounded-lg overflow-hidden">
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          data-testid="plan-stage"
          scale={{ x: transform.scale, y: transform.scale }}
          x={transform.x}
          y={transform.y}
          draggable
          onDragStart={() => {
            setHasInteracted(true);
          }}
          onDragEnd={handleStageDragEnd}
          onWheel={handleWheel}
        >
          <Layer>
            {state.modes.gridVisible && (
              <>
                {verticalGridLines.map((x, index) => (
                  <Line
                    key={`grid-v-${index}`}
                    data-testid="plan-grid-line"
                    points={[x, gridMinY - gridSpacingPx, x, gridMaxY + gridSpacingPx]}
                    stroke="#475569"
                    strokeWidth={0.5}
                    listening={false}
                  />
                ))}
                {horizontalGridLines.map((y, index) => (
                  <Line
                    key={`grid-h-${index}`}
                    data-testid="plan-grid-line"
                    points={[gridMinX - gridSpacingPx, y, gridMaxX + gridSpacingPx, y]}
                    stroke="#475569"
                    strokeWidth={0.5}
                    listening={false}
                  />
                ))}
              </>
            )}

            {scaledFloors.map(({ floor, scaledPolygon, pointsArray, selectedEdgeIndex, selectedVertices, eaveSegments, eaveDimensionLines, dimensionGroups }) => (
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

                {selectedEdgeIndex >= 0 && scaledPolygon.length > 1 && (
                  <Line
                    points={(() => {
                      const start = scaledPolygon[selectedEdgeIndex];
                      const end = scaledPolygon[(selectedEdgeIndex + 1) % scaledPolygon.length];
                      return [start.x, start.y, end.x, end.y];
                    })()}
                    stroke="#f97316"
                    strokeWidth={floor.style.strokeWidth + 2}
                    listening={false}
                    lineCap="round"
                  />
                )}

                {eaveSegments.map((segment) => (
                  <Line
                    key={`eave-${floor.id}-${segment.edgeId}`}
                    data-testid="plan-eave-line"
                    points={segment.pointsArray}
                    stroke={segment.color}
                    strokeWidth={1.5}
                    dash={[8, 6]}
                    listening={false}
                  />
                ))}

                {state.modes.dimensionVisible && dimensionGroups.map((group) => (
                  <React.Fragment key={`${floor.id}-dimension-${group.id}`}>
                    {renderDimensionLine(group.segment, `${floor.id}-dimension-${group.id}`, 'segment')}
                    {renderDimensionLine(group.total, `${floor.id}-dimension-${group.id}`, 'total')}
                  </React.Fragment>
                ))}

                {state.modes.dimensionVisible && eaveDimensionLines.map((line) => (
                  <React.Fragment key={`eave-dimension-${floor.id}-${line.id}`}>
                    <Line
                      data-testid="plan-dimension-line-eave"
                      points={line.pointsArray}
                      stroke={DIMENSION_STROKE}
                      strokeWidth={1}
                      dash={[6, 4]}
                      listening={false}
                    />
                    <Text
                      text={line.label}
                      x={line.labelPosition.x}
                      y={line.labelPosition.y}
                      fontSize={DIMENSION_FONT_SIZE}
                      fill={DIMENSION_TEXT_FILL}
                      offsetX={estimateTextWidth(line.label, DIMENSION_FONT_SIZE) / 2}
                      offsetY={DIMENSION_FONT_SIZE / 2}
                      listening={false}
                    />
                  </React.Fragment>
                ))}

                {scaledPolygon.map((point, index) => (
                  <Circle
                    key={`${floor.id}-${index}`}
                    data-testid={`plan-vertex-${index}`}
                    x={point.x}
                    y={point.y}
                    radius={selectedVertices.has(index) ? 8 : 6}
                    fill={selectedVertices.has(index) ? '#f97316' : floor.style.strokeColor}
                    stroke="white"
                    strokeWidth={2}
                    draggable
                    onMouseDown={(event) => {
                      if (floor.locked) {
                        event.cancelBubble = true;
                        return;
                      }
                    }}
                    onDragMove={(event) => {
                      if (floor.locked) {
                        event.cancelBubble = true;
                        event.target?.position?.({ x: point.x, y: point.y });
                        event.target?.getLayer?.().batchDraw?.();
                        return;
                      }
                      setHasInteracted(true);
                      handleVertexDrag(floor.id, index)(event);
                    }}
                    onDragEnd={(event) => {
                      if (floor.locked) {
                        event.cancelBubble = true;
                        event.target?.position?.({ x: point.x, y: point.y });
                        event.target?.getLayer?.().batchDraw?.();
                        return;
                      }
                      setHasInteracted(true);
                      handleVertexDrag(floor.id, index)(event);
                    }}
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
