'use client';

import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Line } from '@react-three/drei';
import { buildThreeDModel } from '../utils/geometry';
import { useBuildingState } from '../context/BuildingProvider';

const SCALE = 0.001; // mm => m のスケールで描画

interface LineSegment {
  id: string;
  points: [number, number, number][];
  color: string;
}

const buildLineSegments = (meshes: ReturnType<typeof buildThreeDModel>['meshes']): LineSegment[] => {
  const segments: LineSegment[] = [];
  meshes.forEach((mesh) => {
    const bottom = mesh.polygon.bottom.map((p) => ({ x: p.x * SCALE, y: p.y * SCALE, z: p.z * SCALE }));
    const top = mesh.polygon.top.map((p) => ({ x: p.x * SCALE, y: p.y * SCALE, z: p.z * SCALE }));
    const count = bottom.length;
    for (let i = 0; i < count; i += 1) {
      const nextIndex = (i + 1) % count;
      segments.push({
        id: `${mesh.floorId}-bottom-${i}`,
        points: [
          [bottom[i].x, bottom[i].z, bottom[i].y],
          [bottom[nextIndex].x, bottom[nextIndex].z, bottom[nextIndex].y]
        ],
        color: mesh.color
      });
      segments.push({
        id: `${mesh.floorId}-top-${i}`,
        points: [
          [top[i].x, top[i].z, top[i].y],
          [top[nextIndex].x, top[nextIndex].z, top[nextIndex].y]
        ],
        color: mesh.color
      });
      segments.push({
        id: `${mesh.floorId}-vertical-${i}`,
        points: [
          [bottom[i].x, bottom[i].z, bottom[i].y],
          [top[i].x, top[i].z, top[i].y]
        ],
        color: mesh.color
      });
    }
  });

  return segments;
};

const centerSegments = (segments: LineSegment[]): LineSegment[] => {
  if (!segments.length) return segments;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  segments.forEach((segment) => {
    segment.points.forEach(([x, y, z]) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    });
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  return segments.map((segment) => ({
    ...segment,
    points: segment.points.map(([x, y, z]) => [x - centerX, y - centerY, z - centerZ]) as [
      number,
      number,
      number
    ][]
  }));
};

const WireframeScene: React.FC<{ segments: LineSegment[] }> = ({ segments }) => (
  <>
    <ambientLight intensity={0.8} />
    <PerspectiveCamera makeDefault position={[4, 4, 6]} fov={50} />
    {segments.map((segment) => (
      <Line key={segment.id} points={segment.points} color={segment.color} lineWidth={2} />
    ))}
    <OrbitControls enablePan={false} enableZoom enableRotate />
  </>
);

export const ThreeDView: React.FC = () => {
  const { state } = useBuildingState();
  const result = React.useMemo(() => buildThreeDModel(state), [state]);

  const segments = useMemo(() => centerSegments(buildLineSegments(result.meshes)), [result.meshes]);
  const isJsDom = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom');

  return (
    <section aria-label="3D view" className="space-y-3">
      <Canvas data-testid="three-canvas" style={{ width: '100%', height: 240 }}>
        {!isJsDom && (
          <Suspense fallback={null}>
            <WireframeScene segments={segments} />
          </Suspense>
        )}
      </Canvas>
      <div data-testid="three-summary" className="space-y-1 text-sm text-slate-700">
        {result.meshes.map((mesh) => (
          <div key={mesh.floorId}>
            <strong className="font-semibold">{mesh.floorId}</strong> — height: {mesh.height}mm — roof:{' '}
            {mesh.roof.type} (10/{mesh.roof.slopeValue})
          </div>
        ))}
      </div>
      {result.error && (
        <p role="alert" className="text-sm text-amber-600">{result.error}</p>
      )}
    </section>
  );
};
