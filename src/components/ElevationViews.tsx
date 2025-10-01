"use client";

import React from 'react';
import { buildElevationData } from '../utils/geometry';
import { useBuildingState } from '../context/BuildingProvider';

const SVG_WIDTH = 320;
const SVG_HEIGHT = 220;
const MARGIN = 24;
const DIMENSION_OFFSET = 12;
const DIMENSION_COLOR = '#1f2937';

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

          const convertPoint = ({ x, y }: { x: number; y: number }) => ({
            x: MARGIN + x * scaleX,
            y: SVG_HEIGHT - MARGIN - y * scaleY
          });

          const scaledRoofOutline = view.roofOutline?.map(convertPoint) ?? [];

          const scaledEaveLines = view.eaveLines?.map((line) => ({
            ...line,
            start: convertPoint(line.start),
            end: convertPoint(line.end)
          })) ?? [];

          const scaledHeightDimensions = view.heightDimensions?.map((line) => {
            const start = convertPoint(line.start);
            const end = convertPoint(line.end);
            return {
              ...line,
              start: { x: start.x + DIMENSION_OFFSET, y: start.y },
              end: { x: end.x + DIMENSION_OFFSET, y: end.y }
            };
          }) ?? [];

          const scaledEaveDimensions = view.eaveDimensions?.map((line) => {
            const start = convertPoint(line.start);
            const end = convertPoint(line.end);
            return {
              ...line,
              start: { x: start.x + DIMENSION_OFFSET, y: start.y },
              end: { x: end.x + DIMENSION_OFFSET, y: end.y }
            };
          }) ?? [];

          const transformedFloors = view.floors.map((floor) => {
            const sourceFragments = floor.fragments && floor.fragments.length
              ? floor.fragments
              : [
                  {
                    id: `${floor.floorId}-fallback`,
                    points: floor.outline,
                    roofLine: [
                      floor.outline[3] ?? floor.outline[0],
                      floor.outline[2] ?? floor.outline[1] ?? floor.outline[0]
                    ]
                  }
                ];

            const svgFragments = sourceFragments.map((fragment) => ({
              id: fragment.id,
              svgPoints: fragment.points.map(convertPoint),
              roofLine: fragment.roofLine.map(convertPoint) as [
                { x: number; y: number },
                { x: number; y: number }
              ]
            }));

            return {
              ...floor,
              svgFragments
            };
          });

          const dimensionY = SVG_HEIGHT - MARGIN + 12;
          const baseLineStart = MARGIN + view.baseStart * scaleX;
          const baseLineEnd = MARGIN + view.baseEnd * scaleX;

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
                    {floor.svgFragments.map((fragment) => (
                      <g key={fragment.id}>
                        <polyline
                          points={toSvgPoints([...fragment.svgPoints, fragment.svgPoints[0]])}
                          fill="none"
                          stroke={floor.color}
                          strokeWidth={2}
                        />
                        <line
                          x1={fragment.roofLine[0].x}
                          y1={fragment.roofLine[0].y}
                          x2={fragment.roofLine[1].x}
                          y2={fragment.roofLine[1].y}
                          stroke={floor.color}
                          strokeDasharray="6 4"
                          strokeWidth={2}
                        />
                      </g>
                    ))}
                  </g>
                ))}
                {scaledEaveLines.map((line) => (
                  line.visible ? (
                    <line
                      key={`${view.direction}-${line.floorId}-${line.start.x}-${line.start.y}`}
                      x1={line.start.x}
                      y1={line.start.y}
                      x2={line.end.x}
                      y2={line.end.y}
                      stroke={line.color}
                      strokeDasharray="1 5"
                      strokeLinecap="round"
                      strokeWidth={1.5}
                      data-testid="elevation-eave-line"
                    />
                  ) : null
                ))}
                {scaledRoofOutline.length >= 2 && (
                  <polyline
                    points={toSvgPoints(scaledRoofOutline)}
                    fill="none"
                    stroke={view.roofColor}
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    data-testid="elevation-roof-outline"
                  />
                )}
                <line
                  x1={baseLineStart}
                  y1={dimensionY}
                  x2={baseLineEnd}
                  y2={dimensionY}
                  stroke="#1f2937"
                  strokeWidth={1.5}
                />
                <line
                  x1={baseLineStart}
                  y1={dimensionY - 6}
                  x2={baseLineStart}
                  y2={dimensionY + 6}
                  stroke="#1f2937"
                  strokeWidth={1.5}
                />
                <line
                  x1={baseLineEnd}
                  y1={dimensionY - 6}
                  x2={baseLineEnd}
                  y2={dimensionY + 6}
                  stroke="#1f2937"
                  strokeWidth={1.5}
                />
                <text
                  x={(baseLineStart + baseLineEnd) / 2}
                  y={dimensionY + 16}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={12}
                  fill="#1f2937"
                >
                  {view.dimensionLabel}
                </text>
                {view.showDimensions && (
                  <g data-testid="elevation-dimensions">
                    {scaledHeightDimensions.map((line) => (
                      <g key={`${view.direction}-height-${line.floorId}`}>
                        <line
                          x1={line.start.x}
                          y1={line.start.y}
                          x2={line.end.x}
                          y2={line.end.y}
                          stroke={DIMENSION_COLOR}
                          strokeWidth={1}
                          data-testid="elevation-height-dimension"
                        />
                        <text
                          x={line.start.x + 4}
                          y={(line.start.y + line.end.y) / 2}
                          fontSize={10}
                          fill={DIMENSION_COLOR}
                        >
                          {`${line.label}mm`}
                        </text>
                      </g>
                    ))}

                    {scaledEaveDimensions.map((line, index) => (
                      <g key={`${view.direction}-eave-dim-${line.floorId}-${index}`}>
                        <line
                          x1={line.start.x}
                          y1={line.start.y}
                          x2={line.end.x}
                          y2={line.end.y}
                          stroke={DIMENSION_COLOR}
                          strokeWidth={1}
                          data-testid="elevation-eave-dimension"
                        />
                        <text
                          x={line.start.x + 4}
                          y={(line.start.y + line.end.y) / 2}
                          fontSize={10}
                          fill={DIMENSION_COLOR}
                        >
                          {`${line.label}mm`}
                        </text>
                      </g>
                    ))}
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
