"use client";

import React from 'react';
import { buildElevationData } from '../utils/geometry';
import { useBuildingState } from '../context/BuildingProvider';

const SVG_WIDTH = 320;
const SVG_HEIGHT = 220;
const MARGIN = 24;

const toSvgPoints = (points: Array<{ x: number; y: number }>): string =>
  points.map((p) => `${p.x},${p.y}`).join(' ');

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
          const scaleX = view.dimensionValue > 0 ? (SVG_WIDTH - MARGIN * 2) / view.dimensionValue : 1;
          const scaleY = view.totalHeight > 0 ? (SVG_HEIGHT - MARGIN * 2) / view.totalHeight : 1;

          const transformedFloors = view.floors.map((floor) => {
            const svgPoints = floor.outline.map((point) => ({
              x: MARGIN + point.x * scaleX,
              y: SVG_HEIGHT - MARGIN - point.y * scaleY
            }));
            const roofLine: [Point, Point] = [
              svgPoints[3] ?? { x: MARGIN, y: SVG_HEIGHT - MARGIN },
              svgPoints[2] ?? { x: SVG_WIDTH - MARGIN, y: SVG_HEIGHT - MARGIN }
            ];
            return {
              ...floor,
              svgPoints,
              roofLine
            };
          });

          const dimensionY = SVG_HEIGHT - MARGIN + 12;
          const dimensionLineStart = MARGIN;
          const dimensionLineEnd = MARGIN + view.dimensionValue * scaleX;

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
                {transformedFloors.map((floor) => (
                  <g key={floor.floorId}>
                    <polyline
                      points={toSvgPoints([...floor.svgPoints, floor.svgPoints[0]])}
                      fill="none"
                      stroke={floor.color}
                      strokeWidth={2}
                    />
                    <line
                      x1={floor.roofLine[0].x}
                      y1={floor.roofLine[0].y}
                      x2={floor.roofLine[1].x}
                      y2={floor.roofLine[1].y}
                      stroke={floor.color}
                      strokeDasharray="6 4"
                      strokeWidth={2}
                    />
                  </g>
                ))}
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
