"use client";

import React from 'react';
import { buildElevationData } from '../utils/geometry';
import type { ElevationOutline } from '../utils/geometry';
import { buildEaveSegments } from '../utils/eaveOffset';
import { useBuildingState } from '../context/BuildingProvider';
import type { FloorModel } from '../context/BuildingProvider';

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
  sourceFloor?: FloorModel;
  roofStrokeColor: string;
  roofDash: [number, number];
}

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
          const rawOffsets = isFlatRoof && topSourceFloor ? computeEaveOffsets(topSourceFloor, axis) : { negative: 0, positive: 0 };
          const leftOffsetMm = Math.max(0, rawOffsets.negative);
          const rightOffsetMm = Math.max(0, rawOffsets.positive);

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

          const flatRoofSegments: React.ReactNode[] = [];

          if (isFlatRoof && topFloorData && topSourceFloor) {
            const leftOffset = leftOffsetMm;
            const rightOffset = rightOffsetMm;
            const parapetHeight = Math.max(0, topSourceFloor.roof.parapetHeight ?? 0);

            if (parapetHeight > 0 || leftOffset > 0 || rightOffset > 0) {
              const wallLeftX = topFloorData.roofLine[0].x;
              const wallRightX = topFloorData.roofLine[1].x;
              const wallTopY = topFloorData.roofLine[0].y;
              const roofLeftX = wallLeftX - leftOffset * scaleX;
              const roofRightX = wallRightX + rightOffset * scaleX;
              const roofBottomY = wallTopY;
              const roofTopY = roofBottomY - parapetHeight * scaleY;
              const stroke = topFloorData.color;
              const dash = dashPattern(topFloorData.roofDash);

              const leftVerticalX = parapetHeight > 0 ? (leftOffset > 0 ? roofLeftX : wallLeftX) : roofLeftX;
              const rightVerticalX = parapetHeight > 0 ? (rightOffset > 0 ? roofRightX : wallRightX) : roofRightX;

              const outlinePoints: SvgPoint[] = [
                { x: leftVerticalX, y: roofBottomY },
                { x: leftVerticalX, y: roofTopY },
                { x: rightVerticalX, y: roofTopY },
                { x: rightVerticalX, y: roofBottomY }
              ];

              flatRoofSegments.push(
                <polyline
                  key="flat-roof-outline"
                  data-testid="elevation-eave-line"
                  points={toSvgPoints(outlinePoints)}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={2}
                  strokeDasharray={dash}
                />
              );

              if (leftOffset > 0) {
                flatRoofSegments.push(
                  <line
                    key="flat-roof-bottom-left"
                    data-testid="elevation-eave-line"
                    x1={roofLeftX}
                    y1={roofBottomY}
                    x2={wallLeftX}
                    y2={roofBottomY}
                    stroke={stroke}
                    strokeWidth={2}
                    strokeDasharray={dash}
                  />
                );
              }

              if (rightOffset > 0) {
                flatRoofSegments.push(
                  <line
                    key="flat-roof-bottom-right"
                    data-testid="elevation-eave-line"
                    x1={wallRightX}
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
                  return (
                    <g key={floor.floorId}>
                      <polyline
                        points={toSvgPoints([...floor.svgPoints, floor.svgPoints[0]])}
                        fill="none"
                        stroke={floor.color}
                        strokeWidth={2}
                      />
                      {!hideRoofLine && (
                        <line
                          x1={floor.roofLine[0].x}
                          y1={floor.roofLine[0].y}
                          x2={floor.roofLine[1].x}
                          y2={floor.roofLine[1].y}
                          stroke={floor.roofStrokeColor}
                          strokeDasharray={dashPattern(floor.roofDash)}
                          strokeWidth={2}
                        />
                      )}
                    </g>
                  );
                })}
                {flatRoofSegments.length > 0 && (
                  <g data-testid="elevation-roof-outline">{flatRoofSegments}</g>
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
