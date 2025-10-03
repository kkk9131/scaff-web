"use client";

import React from 'react';
import { buildElevationData } from '../utils/geometry';
import type { ElevationOutline, ElevationDirection } from '../utils/geometry';
import { buildEaveSegments } from '../utils/eaveOffset';
import { useBuildingState } from '../context/BuildingProvider';
import type { FloorModel, CardinalDirection } from '../context/BuildingProvider';

const SVG_WIDTH = 320;
const SVG_HEIGHT = 220;
const MARGIN = 24;

const toSvgPoints = (points: Array<{ x: number; y: number }>): string =>
  points.map((p) => `${p.x},${p.y}`).join(' ');

type Axis = 'x' | 'y';

interface SvgPoint {
  x: number;
  y: number;
}

interface TransformedElevationFloor extends ElevationOutline {
  svgPoints: SvgPoint[];
  roofLine: [SvgPoint, SvgPoint];
  roofSegments: Array<[SvgPoint, SvgPoint]>;
  sourceFloor?: FloorModel;
  roofStrokeColor: string;
  roofDash: [number, number];
}

const OPPOSITE_DIRECTION: Record<CardinalDirection, CardinalDirection> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east'
};

const VIEW_LATERAL_SIDES: Record<ElevationDirection, { left: CardinalDirection; right: CardinalDirection }> = {
  north: { left: 'west', right: 'east' },
  south: { left: 'east', right: 'west' },
  east: { left: 'north', right: 'south' },
  west: { left: 'south', right: 'north' }
};

const mapHeightToSvg = (heightMm: number, scaleY: number): number =>
  SVG_HEIGHT - MARGIN - heightMm * scaleY;

const projectValue = (point: { x: number; y: number }, axis: Axis): number =>
  axis === 'x' ? point.x : point.y;

const computeEaveOffsets = (floor: FloorModel | undefined, axis: Axis) => {
  if (!floor || floor.polygon.length < 2) {
    return { negative: 0, positive: 0 } as const;
  }

  let minBase = Infinity;
  let maxBase = -Infinity;
  floor.polygon.forEach((point) => {
    const value = projectValue(point, axis);
    minBase = Math.min(minBase, value);
    maxBase = Math.max(maxBase, value);
  });

  let minExtended = minBase;
  let maxExtended = maxBase;
  const segments = buildEaveSegments(floor.polygon, floor.dimensions);
  segments.forEach((segment) => {
    segment.points.forEach((point) => {
      const value = projectValue(point, axis);
      minExtended = Math.min(minExtended, value);
      maxExtended = Math.max(maxExtended, value);
    });
  });

  return {
    negative: Math.max(0, minBase - minExtended),
    positive: Math.max(0, maxExtended - maxBase)
  } as const;
};

const computePlanSpan = (floor: FloorModel | undefined, axis: Axis) => {
  if (!floor || floor.polygon.length < 2) {
    return 0;
  }

  let minValue = Infinity;
  let maxValue = -Infinity;
  floor.polygon.forEach((point) => {
    const value = projectValue(point, axis);
    minValue = Math.min(minValue, value);
    maxValue = Math.max(maxValue, value);
  });

  return Math.max(0, maxValue - minValue);
};

const dashPattern = (dash?: [number, number]) => (dash ? dash.join(' ') : '6 4');

export const ElevationViews: React.FC = () => {
  const { state } = useBuildingState();
  const result = React.useMemo(() => buildElevationData(state), [state]);

  return (
    <section aria-label="Elevation views" className="h-full flex flex-col">
      {result.error && (
        <div className="mb-4 p-3 bg-amber-900/50 border border-amber-700 rounded-lg">
          <p role="alert" className="text-sm text-amber-300">
            {result.error}
          </p>
        </div>
      )}
      <div className="flex-1 grid gap-6 md:grid-cols-2 xl:grid-cols-4 overflow-auto">
        {result.views.map((view) => {
          const isWidthDirection = view.direction === 'north' || view.direction === 'south';
          const axis: Axis = isWidthDirection ? 'x' : 'y';
          const topFloorRaw = view.floors[view.floors.length - 1];
          const topSourceFloor = state.floors.find((item) => item.id === topFloorRaw?.floorId);
          const isFlatRoof = topSourceFloor?.roof.type === 'flat';
          const isMonoRoof = topSourceFloor?.roof.type === 'mono';
          const isGableRoof = topSourceFloor?.roof.type === 'gable';
          const isHipRoof = topSourceFloor?.roof.type === 'hip';
          const viewDirection = view.direction as CardinalDirection;
          const eaveOffsets = topSourceFloor ? computeEaveOffsets(topSourceFloor, axis) : { negative: 0, positive: 0 };
          const leftOffsetMm = Math.max(0, eaveOffsets.negative);
          const rightOffsetMm = Math.max(0, eaveOffsets.positive);

          const monoLowDirection = isMonoRoof ? topSourceFloor?.roof.lowSideDirection : undefined;
          const monoHighDirection = monoLowDirection ? OPPOSITE_DIRECTION[monoLowDirection] : undefined;
          const isLowFace = isMonoRoof && monoLowDirection === viewDirection;
          const isHighFace = isMonoRoof && monoHighDirection === viewDirection;
          const isMonoPerpendicularFace = isMonoRoof && !isLowFace && !isHighFace;

          const gableOrientation = topSourceFloor?.roof.orientation ?? 'north-south';
          const gableFacingDirections: CardinalDirection[] =
            gableOrientation === 'north-south' ? ['north', 'south'] : ['east', 'west'];
          const isGableFace = isGableRoof && gableFacingDirections.includes(viewDirection);
          const hipRidgeDirections: CardinalDirection[] = gableFacingDirections;
          const isHipRidgeFace = isHipRoof && hipRidgeDirections.includes(viewDirection);
          const isHipApexFace = isHipRoof && !isHipRidgeFace;

          const lowHeightAbs = topFloorRaw ? topFloorRaw.base + topFloorRaw.height : 0;
          const ridgeRelative = topSourceFloor?.roof.ridgeHeight ?? topSourceFloor?.height ?? topFloorRaw?.height ?? 0;
          let highHeightAbs = topFloorRaw ? topFloorRaw.base + ridgeRelative : lowHeightAbs;
          const perpendicularAxis: Axis = axis === 'x' ? 'y' : 'x';
          const perpSpanMm = topSourceFloor ? computePlanSpan(topSourceFloor, perpendicularAxis) : 0;
          const perpOffsets = topSourceFloor ? computeEaveOffsets(topSourceFloor, perpendicularAxis) : { negative: 0, positive: 0 };
          const perpTotalSpanMm = perpSpanMm + Math.max(0, perpOffsets.negative) + Math.max(0, perpOffsets.positive);
          const slopeValueGeneral = Math.max(0, topSourceFloor?.roof.slopeValue ?? 0);
          let slopeRatioGeneral = slopeValueGeneral > 0 ? slopeValueGeneral / 10 : 0;
          let riseMm = Math.max(0, highHeightAbs - lowHeightAbs);
          if (perpTotalSpanMm > 0) {
            const halfPerpSpan = perpTotalSpanMm / 2;
            if (riseMm <= 0 && slopeRatioGeneral > 0) {
              riseMm = slopeRatioGeneral * halfPerpSpan;
              highHeightAbs = lowHeightAbs + riseMm;
            } else if (slopeRatioGeneral <= 0 && riseMm > 0) {
              slopeRatioGeneral = riseMm / halfPerpSpan;
            }
          }

          const lateralSides = VIEW_LATERAL_SIDES[view.direction];

          const dimensionBaseMm = view.dimensionValue;
          const totalSpanMm = dimensionBaseMm + leftOffsetMm + rightOffsetMm;
          const scaleX = totalSpanMm > 0 ? (SVG_WIDTH - MARGIN * 2) / totalSpanMm : 1;
          const scaleY = view.totalHeight > 0 ? (SVG_HEIGHT - MARGIN * 2) / view.totalHeight : 1;

          const transformedFloors: TransformedElevationFloor[] = view.floors.map((floor) => {
            const svgPoints = floor.outline.map((point) => ({
              x: MARGIN + (leftOffsetMm + point.x) * scaleX,
              y: SVG_HEIGHT - MARGIN - point.y * scaleY
            }));
            const roofLine: [SvgPoint, SvgPoint] = [
              svgPoints[3] ?? { x: MARGIN + leftOffsetMm * scaleX, y: SVG_HEIGHT - MARGIN },
              svgPoints[2] ?? { x: SVG_WIDTH - MARGIN - rightOffsetMm * scaleX, y: SVG_HEIGHT - MARGIN }
            ];
            const sourceFloor = state.floors.find((item) => item.id === floor.floorId);
            const roofStrokeColor = floor.color;
            const roofDash = sourceFloor?.style.roofDash ?? [6, 4];
            return {
              ...floor,
              svgPoints,
              roofLine,
              roofSegments: [roofLine],
              sourceFloor,
              roofStrokeColor,
              roofDash
            };
          });

          const dimensionY = SVG_HEIGHT - MARGIN + 12;
          const dimensionLineStart = MARGIN + leftOffsetMm * scaleX;
          const dimensionLineEnd = dimensionLineStart + dimensionBaseMm * scaleX;
          const showDimensions = state.modes.dimensionVisibleElevation;
          const topFloorData = transformedFloors[transformedFloors.length - 1];

          const roofOverlaySegments: React.ReactNode[] = [];

          if (topFloorData && topSourceFloor) {
            const leftOffset = leftOffsetMm;
            const rightOffset = rightOffsetMm;
            const stroke = topFloorData.color;
            const dash = dashPattern(topFloorData.roofDash);
            const wallStrokeWidth = topFloorData.sourceFloor?.style.strokeWidth ?? 2;
            const lowTopSvgY = mapHeightToSvg(lowHeightAbs, scaleY);
            const highTopSvgY = mapHeightToSvg(highHeightAbs, scaleY);
            const wallLeftXBase = topFloorData.roofLine[0].x;
            const wallRightXBase = topFloorData.roofLine[1].x;
            const wallTopYBase = topFloorData.roofLine[0].y;
            const bottomLeftBase = topFloorData.svgPoints[0];
            const bottomRightBase = topFloorData.svgPoints[1];

            if (isGableRoof) {
              const apexX = wallLeftXBase + (wallRightXBase - wallLeftXBase) / 2;
              const roofLeftPoint: SvgPoint = {
                x: wallLeftXBase - leftOffset * scaleX,
                y: lowTopSvgY
              };
              const roofRightPoint: SvgPoint = {
                x: wallRightXBase + rightOffset * scaleX,
                y: lowTopSvgY
              };

              if (isGableFace) {
                const apexPoint: SvgPoint = { x: apexX, y: highTopSvgY };
                const slopeLeft = roofLeftPoint.x === apexPoint.x
                  ? 0
                  : (roofLeftPoint.y - apexPoint.y) / (roofLeftPoint.x - apexPoint.x);
                const slopeRight = roofRightPoint.x === apexPoint.x
                  ? 0
                  : (roofRightPoint.y - apexPoint.y) / (roofRightPoint.x - apexPoint.x);
                const wallApexLeftY = wallLeftXBase === apexPoint.x
                  ? apexPoint.y
                  : lowTopSvgY - (wallLeftXBase - apexPoint.x) * slopeLeft;
                const wallApexRightY = wallRightXBase === apexPoint.x
                  ? apexPoint.y
                  : lowTopSvgY - (wallRightXBase - apexPoint.x) * slopeRight;
                const wallApexY = Math.min(wallApexLeftY, wallApexRightY);
                const wallApexPoint: SvgPoint = { x: apexX, y: wallApexY };
                const wallOutline: SvgPoint[] = [
                  bottomLeftBase ?? { x: wallLeftXBase, y: SVG_HEIGHT - MARGIN },
                  bottomRightBase ?? { x: wallRightXBase, y: SVG_HEIGHT - MARGIN },
                  { x: wallRightXBase, y: lowTopSvgY },
                  wallApexPoint,
                  { x: wallLeftXBase, y: lowTopSvgY }
                ];
                topFloorData.svgPoints = wallOutline;
                topFloorData.roofSegments = [
                  [apexPoint, roofLeftPoint],
                  [apexPoint, roofRightPoint]
                ];
                topFloorData.roofLine = [roofLeftPoint, roofRightPoint];

                if (leftOffset > 0) {
                  roofOverlaySegments.push(
                    <line
                      key="gable-left-eave"
                      data-testid="elevation-eave-line"
                      x1={wallLeftXBase}
                      y1={lowTopSvgY}
                      x2={roofLeftPoint.x}
                      y2={lowTopSvgY}
                      stroke={stroke}
                      strokeWidth={1.5}
                      strokeDasharray={dash}
                    />
                  );
                }

                if (rightOffset > 0) {
                  roofOverlaySegments.push(
                    <line
                      key="gable-right-eave"
                      data-testid="elevation-eave-line"
                      x1={wallRightXBase}
                      y1={lowTopSvgY}
                      x2={roofRightPoint.x}
                      y2={lowTopSvgY}
                      stroke={stroke}
                      strokeWidth={1.5}
                      strokeDasharray={dash}
                    />
                  );
                }
              } else {
                const ridgeLeftX = roofLeftPoint.x;
                const ridgeRightX = roofRightPoint.x;
                const ridgeTopY = highTopSvgY;
                const ridgeSegment: [SvgPoint, SvgPoint] = [
                  { x: ridgeLeftX, y: ridgeTopY },
                  { x: ridgeRightX, y: ridgeTopY }
                ];
                const leftVertical: [SvgPoint, SvgPoint] = [
                  { x: ridgeLeftX, y: ridgeTopY },
                  { x: ridgeLeftX, y: lowTopSvgY }
                ];
                const rightVertical: [SvgPoint, SvgPoint] = [
                  { x: ridgeRightX, y: ridgeTopY },
                  { x: ridgeRightX, y: lowTopSvgY }
                ];

                topFloorData.roofSegments = [ridgeSegment];
                if (ridgeTopY !== lowTopSvgY) {
                  topFloorData.roofSegments = [ridgeSegment, leftVertical, rightVertical];
                }
                topFloorData.roofLine = ridgeSegment;

                if (leftOffset > 0) {
                  roofOverlaySegments.push(
                    <line
                      key="gable-rect-left-eave"
                      data-testid="elevation-eave-line"
                      x1={wallLeftXBase}
                      y1={lowTopSvgY}
                      x2={roofLeftPoint.x}
                      y2={lowTopSvgY}
                      stroke={stroke}
                      strokeWidth={1.5}
                      strokeDasharray={dash}
                    />
                  );
                }

                if (rightOffset > 0) {
                  roofOverlaySegments.push(
                    <line
                      key="gable-rect-right-eave"
                      data-testid="elevation-eave-line"
                      x1={wallRightXBase}
                      y1={lowTopSvgY}
                      x2={roofRightPoint.x}
                      y2={lowTopSvgY}
                      stroke={stroke}
                      strokeWidth={1.5}
                      strokeDasharray={dash}
                    />
                  );
                }
              }
            } else if (isHipRoof) {
              const slopeRatio = slopeRatioGeneral > 0 ? slopeRatioGeneral : riseMm > 0 && totalSpanMm > 0 ? riseMm / (totalSpanMm / 2) : 0;
              const eaveLeftPoint: SvgPoint = {
                x: wallLeftXBase - leftOffset * scaleX,
                y: lowTopSvgY
              };
              const eaveRightPoint: SvgPoint = {
                x: wallRightXBase + rightOffset * scaleX,
                y: lowTopSvgY
              };
              const centerRunMm = totalSpanMm / 2;
              const safeSlopeRatio = slopeRatio > 0 ? slopeRatio : riseMm > 0 && centerRunMm > 0 ? riseMm / centerRunMm : 0;
              const runToEaveMm = safeSlopeRatio > 0 && riseMm > 0 ? Math.min(centerRunMm, riseMm / safeSlopeRatio) : centerRunMm;
              const runToEavePx = runToEaveMm * scaleX;

              const ridgeLeftPoint: SvgPoint = {
                x: eaveLeftPoint.x + runToEavePx,
                y: highTopSvgY
              };
              const ridgeRightPoint: SvgPoint = {
                x: eaveRightPoint.x - runToEavePx,
                y: highTopSvgY
              };

              const becamePyramid = ridgeRightPoint.x - ridgeLeftPoint.x <= 2;

              if (isHipRidgeFace && !becamePyramid) {
                topFloorData.roofSegments = [
                  [ridgeLeftPoint, ridgeRightPoint],
                  [ridgeLeftPoint, eaveLeftPoint],
                  [ridgeRightPoint, eaveRightPoint]
                ];
                topFloorData.roofLine = [ridgeLeftPoint, ridgeRightPoint];

                if (leftOffset > 0) {
                  roofOverlaySegments.push(
                    <line
                      key="hip-ridge-left-eave"
                      data-testid="elevation-eave-line"
                      x1={wallLeftXBase}
                      y1={lowTopSvgY}
                      x2={eaveLeftPoint.x}
                      y2={lowTopSvgY}
                      stroke={stroke}
                      strokeWidth={1.5}
                      strokeDasharray={dash}
                    />
                  );
                }

                if (rightOffset > 0) {
                  roofOverlaySegments.push(
                    <line
                      key="hip-ridge-right-eave"
                      data-testid="elevation-eave-line"
                      x1={wallRightXBase}
                      y1={lowTopSvgY}
                      x2={eaveRightPoint.x}
                      y2={lowTopSvgY}
                      stroke={stroke}
                      strokeWidth={1.5}
                      strokeDasharray={dash}
                    />
                  );
                }
              } else {
                const apexX = wallLeftXBase + (wallRightXBase - wallLeftXBase) / 2;
                const apexPoint: SvgPoint = { x: apexX, y: highTopSvgY };
                topFloorData.roofSegments = [
                  [apexPoint, eaveLeftPoint],
                  [apexPoint, eaveRightPoint]
                ];
                topFloorData.roofLine = [eaveLeftPoint, eaveRightPoint];

                if (leftOffset > 0) {
                  roofOverlaySegments.push(
                    <line
                      key="hip-apex-left-eave"
                      data-testid="elevation-eave-line"
                      x1={wallLeftXBase}
                      y1={lowTopSvgY}
                      x2={eaveLeftPoint.x}
                      y2={lowTopSvgY}
                      stroke={stroke}
                      strokeWidth={1.5}
                      strokeDasharray={dash}
                    />
                  );
                }

                if (rightOffset > 0) {
                  roofOverlaySegments.push(
                    <line
                      key="hip-apex-right-eave"
                      data-testid="elevation-eave-line"
                      x1={wallRightXBase}
                      y1={lowTopSvgY}
                      x2={eaveRightPoint.x}
                      y2={lowTopSvgY}
                      stroke={stroke}
                      strokeWidth={1.5}
                      strokeDasharray={dash}
                    />
                  );
                }
              }
            } else if (isFlatRoof) {
              const parapetHeight = Math.max(0, topSourceFloor.roof.parapetHeight ?? 0);

              if (parapetHeight > 0 || leftOffset > 0 || rightOffset > 0) {
                const roofLeftX = wallLeftXBase - leftOffset * scaleX;
                const roofRightX = wallRightXBase + rightOffset * scaleX;
                const roofBottomY = wallTopYBase;
                const roofTopY = roofBottomY - parapetHeight * scaleY;

                const leftVerticalX = parapetHeight > 0 ? (leftOffset > 0 ? roofLeftX : wallLeftXBase) : roofLeftX;
                const rightVerticalX = parapetHeight > 0 ? (rightOffset > 0 ? roofRightX : wallRightXBase) : roofRightX;

                const outlinePoints: SvgPoint[] = [
                  { x: leftVerticalX, y: roofBottomY },
                  { x: leftVerticalX, y: roofTopY },
                  { x: rightVerticalX, y: roofTopY },
                  { x: rightVerticalX, y: roofBottomY }
                ];

                roofOverlaySegments.push(
                  <polyline
                    key="flat-roof-outline"
                   
                    points={toSvgPoints(outlinePoints)}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={2}
                    strokeDasharray={dash}
                  />
                );

                if (leftOffset > 0) {
                  roofOverlaySegments.push(
                    <line
                      key="flat-roof-bottom-left"
                      data-testid="elevation-eave-line"
                      
                      x1={roofLeftX}
                      y1={roofBottomY}
                      x2={wallLeftXBase}
                      y2={roofBottomY}
                      stroke={stroke}
                      strokeWidth={2}
                      strokeDasharray={dash}
                    />
                  );
                }

                if (rightOffset > 0) {
                  roofOverlaySegments.push(
                    <line
                      key="flat-roof-bottom-right"
                      data-testid="elevation-eave-line"
                      
                      x1={wallRightXBase}
                      y1={roofBottomY}
                      x2={roofRightX}
                      y2={roofBottomY}
                      stroke={stroke}
                      strokeWidth={2}
                      strokeDasharray={dash}
                    />
                  );
                }
              }
            } else if (isMonoRoof) {
              const bottomLeft = bottomLeftBase;
              const bottomRight = bottomRightBase;
              const wallLeftX = bottomLeft?.x ?? wallLeftXBase;
              const wallRightX = bottomRight?.x ?? wallRightXBase;
              let leftTopY = lowTopSvgY;
              let rightTopY = lowTopSvgY;

              if (isHighFace) {
                leftTopY = highTopSvgY;
                rightTopY = highTopSvgY;
              } else if (isMonoPerpendicularFace && monoHighDirection) {
                const leftDir = lateralSides.left;
                const rightDir = lateralSides.right;
                leftTopY = leftDir === monoHighDirection ? highTopSvgY : leftTopY;
                rightTopY = rightDir === monoHighDirection ? highTopSvgY : rightTopY;
              }

              if (topFloorData.svgPoints.length >= 4) {
                const updatedPoints = [...topFloorData.svgPoints];
                updatedPoints[3] = { x: wallLeftX, y: leftTopY };
                updatedPoints[2] = { x: wallRightX, y: rightTopY };
                topFloorData.svgPoints = updatedPoints;
              }

              const eaveLeftX = wallLeftX - leftOffset * scaleX;
              const eaveRightX = wallRightX + rightOffset * scaleX;
              const leftExtensionPx = leftOffset * scaleX;
              const rightExtensionPx = rightOffset * scaleX;
              const wallSpanPx = Math.max(0, wallRightX - wallLeftX);
              let roofLeftY = leftTopY;
              let roofRightY = rightTopY;

              if (wallSpanPx > 0) {
                const slopePerPx = (rightTopY - leftTopY) / wallSpanPx;
                roofLeftY = leftTopY - slopePerPx * leftExtensionPx;
                roofRightY = rightTopY + slopePerPx * rightExtensionPx;
              }

              const roofLeftPoint: SvgPoint = { x: eaveLeftX, y: roofLeftY };
              const roofRightPoint: SvgPoint = { x: eaveRightX, y: roofRightY };
              topFloorData.roofLine = [roofLeftPoint, roofRightPoint];
              topFloorData.roofSegments = [[roofLeftPoint, roofRightPoint]];

              const eaveThicknessPx = Math.max(4, Math.min(14, 6 + scaleY * 6));

              if (isLowFace || isHighFace) {
                const baseY = isLowFace ? lowTopSvgY : highTopSvgY;
                const rectHeight = eaveThicknessPx;
                const rectY = baseY - rectHeight;
                const eaveWidth = eaveRightX - eaveLeftX;
                roofOverlaySegments.push(
                  <rect
                    key="mono-face-eave"
                    x={eaveLeftX}
                    y={rectY}
                    width={eaveWidth}
                    height={rectHeight}
                    fill={stroke}
                    fillOpacity={0.12}
                    stroke={stroke}
                    strokeWidth={1.5}
                    strokeDasharray={dash}
                  />
                );

                if (isLowFace) {
                  roofOverlaySegments.push(
                    <line
                      key="mono-low-vertical-left"
                      x1={eaveLeftX}
                      y1={lowTopSvgY}
                      x2={eaveLeftX}
                      y2={highTopSvgY}
                      stroke={stroke}
                      strokeWidth={2}
                      strokeDasharray={dash}
                    />
                  );
                  roofOverlaySegments.push(
                    <line
                      key="mono-low-top"
                      x1={eaveLeftX}
                      y1={highTopSvgY}
                      x2={eaveRightX}
                      y2={highTopSvgY}
                      stroke={stroke}
                      strokeWidth={2}
                      strokeDasharray={dash}
                    />
                  );
                  roofOverlaySegments.push(
                    <line
                      key="mono-low-vertical-right"
                      x1={eaveRightX}
                      y1={lowTopSvgY}
                      x2={eaveRightX}
                      y2={highTopSvgY}
                      stroke={stroke}
                      strokeWidth={2}
                      strokeDasharray={dash}
                    />
                  );
                  if (leftOffset > 0) {
                  roofOverlaySegments.push(
                    <line
                      key="mono-low-bottom-left"
                      data-testid="elevation-eave-line"
                      x1={eaveLeftX}
                      y1={lowTopSvgY}
                      x2={wallLeftX}
                        y2={lowTopSvgY}
                        stroke={stroke}
                        strokeWidth={2}
                        strokeDasharray={dash}
                      />
                    );
                  }
                  if (rightOffset > 0) {
                    roofOverlaySegments.push(
                      <line
                        key="mono-low-bottom-right"
                        data-testid="elevation-eave-line"
                        x1={wallRightX}
                        y1={lowTopSvgY}
                        x2={eaveRightX}
                        y2={lowTopSvgY}
                        stroke={stroke}
                        strokeWidth={2}
                        strokeDasharray={dash}
                      />
                    );
                  }

                  const ridgeSegment: [SvgPoint, SvgPoint] = [
                    { x: eaveLeftX, y: highTopSvgY },
                    { x: eaveRightX, y: highTopSvgY }
                  ];
                  topFloorData.roofLine = ridgeSegment;
                  topFloorData.roofSegments = [ridgeSegment];
                } else if (isHighFace) {
                  if (leftOffset > 0) {
                    roofOverlaySegments.push(
                      <line
                        key="mono-high-overhang-left"
                        data-testid="elevation-eave-line"
                        x1={eaveLeftX}
                        y1={highTopSvgY}
                        x2={wallLeftX}
                        y2={highTopSvgY}
                        stroke={stroke}
                        strokeWidth={2}
                        strokeDasharray={dash}
                      />
                    );
                  }
                  if (rightOffset > 0) {
                    roofOverlaySegments.push(
                      <line
                        key="mono-high-overhang-right"
                        data-testid="elevation-eave-line"
                        x1={wallRightX}
                        y1={highTopSvgY}
                        x2={eaveRightX}
                        y2={highTopSvgY}
                        stroke={stroke}
                        strokeWidth={2}
                        strokeDasharray={dash}
                      />
                    );
                  }

                  const ridgeSegment: [SvgPoint, SvgPoint] = [
                    { x: wallLeftX, y: highTopSvgY },
                    { x: wallRightX, y: highTopSvgY }
                  ];
                  topFloorData.roofLine = ridgeSegment;
                  topFloorData.roofSegments = [ridgeSegment];
                }
              } else if (isMonoPerpendicularFace) {
                const polygonPoints: SvgPoint[] = [
                  { x: eaveLeftX, y: roofLeftY },
                  { x: eaveRightX, y: roofRightY },
                  { x: eaveRightX, y: roofRightY - eaveThicknessPx },
                  { x: eaveLeftX, y: roofLeftY - eaveThicknessPx }
                ];
                roofOverlaySegments.push(
                  <polygon
                    key="mono-slope-eave"
                    points={toSvgPoints(polygonPoints)}
                    fill={stroke}
                    fillOpacity={0.12}
                    stroke={stroke}
                    strokeWidth={1.5}
                    strokeDasharray={dash}
                  />
                );
                topFloorData.roofSegments = [[roofLeftPoint, roofRightPoint]];
                topFloorData.roofLine = [roofLeftPoint, roofRightPoint];
              }
            }
          }

          return (
            <article
              key={view.direction}
              data-testid={`elevation-${view.direction}`}
              className="bg-slate-800 rounded-lg border border-slate-700 shadow-sm overflow-hidden flex flex-col"
            >
              <header className="px-4 py-3 bg-slate-700 border-b border-slate-600">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-white uppercase tracking-wide">{view.direction}</h3>
                  <span className="text-sm text-slate-400">{view.roofLabel}</span>
                </div>
              </header>

              <div className="flex-1 p-4">
                <svg
                  role="img"
                  aria-label={`${view.direction} elevation`}
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                  className="w-full h-full"
                  preserveAspectRatio="xMidYMid meet"
                >
                <rect
                  x={MARGIN}
                  y={MARGIN}
                  width={SVG_WIDTH - MARGIN * 2}
                  height={SVG_HEIGHT - MARGIN * 2}
                  fill="none"
                  stroke="transparent"
                />
                {transformedFloors.map((floor) => {
                  const hideRoofLine = isFlatRoof && topFloorData?.floorId === floor.floorId;
                  const roofSegments = hideRoofLine ? [] : floor.roofSegments;
                  return (
                    <g key={floor.floorId}>
                      <polyline
                        points={toSvgPoints([...floor.svgPoints, floor.svgPoints[0]])}
                        fill="none"
                        stroke={floor.color}
                        strokeWidth={2}
                      />
                      {roofSegments.map(([start, end], index) => (
                        <line
                          key={`${floor.floorId}-roof-${index}`}
                          x1={start.x}
                          y1={start.y}
                          x2={end.x}
                          y2={end.y}
                          stroke={floor.roofStrokeColor}
                          strokeDasharray={dashPattern(floor.roofDash)}
                          strokeWidth={2}
                        />
                      ))}
                    </g>
                  );
                })}
                {roofOverlaySegments.length > 0 && (
                  <g data-testid="elevation-roof-outline">{roofOverlaySegments}</g>
                )}
                {showDimensions && (
                  <g data-testid="elevation-dimensions">
                    <line
                      x1={dimensionLineStart}
                      y1={dimensionY}
                      x2={dimensionLineEnd}
                      y2={dimensionY}
                      stroke="#1f2937"
                      strokeWidth={1.5}
                    />
                    <line
                      x1={dimensionLineStart}
                      y1={dimensionY - 6}
                      x2={dimensionLineStart}
                      y2={dimensionY + 6}
                      stroke="#1f2937"
                      strokeWidth={1.5}
                    />
                    <line
                      x1={dimensionLineEnd}
                      y1={dimensionY - 6}
                      x2={dimensionLineEnd}
                      y2={dimensionY + 6}
                      stroke="#1f2937"
                      strokeWidth={1.5}
                    />
                    <text
                      x={(dimensionLineStart + dimensionLineEnd) / 2}
                      y={dimensionY + 16}
                      textAnchor="middle"
                      className="font-mono"
                      fontSize={12}
                      fill="#1f2937"
                    >
                      {view.dimensionLabel}
                    </text>
                  </g>
                )}
                </svg>
              </div>

              <div className="px-4 py-3 bg-slate-700 border-t border-slate-600">
                <ul className="space-y-1 text-sm text-slate-300">
                  {view.floors.map((floor) => (
                    <li key={`${view.direction}-${floor.floorId}`} className="flex justify-between">
                      <span className="font-medium">{floor.floorId}</span>
                      <span>{floor.height}mm</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
