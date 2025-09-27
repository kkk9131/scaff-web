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
    <section aria-label="Elevation views" className="space-y-4">
      {result.error && (
        <p role="alert" className="text-sm text-amber-600">
          {result.error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
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
              className="space-y-3 rounded border border-slate-200 p-4"
            >
              <header className="flex items-baseline justify-between">
                <h3 className="text-base font-semibold text-slate-700 uppercase">{view.direction}</h3>
                <span className="text-sm text-slate-500">{view.roofLabel}</span>
              </header>
              <svg
                role="img"
                aria-label={`${view.direction} elevation`}
                width="100%"
                height={SVG_HEIGHT}
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className="w-full"
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
              <ul className="space-y-1 text-sm text-slate-600">
                {view.floors.map((floor) => (
                  <li key={`${view.direction}-${floor.floorId}`}>
                    {floor.floorId}: {floor.height}mm
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
};
