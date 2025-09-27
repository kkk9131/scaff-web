"use client";

import { BuildingProvider } from '../context/BuildingProvider';
import { PlanViewCanvas } from '../components/PlanViewCanvas';
import { DimensionPanel } from '../components/DimensionPanel';
import { ElevationViews } from '../components/ElevationViews';
import { ThreeDView } from '../components/ThreeDView';
import { OutputToolbar } from '../components/OutputToolbar';

export default function HomePage() {
  return (
    <BuildingProvider initialTemplate="rectangle">
      <main className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">scaff-web — Multi View Editor</h1>
          <p className="text-slate-600">
            平面・立面・3Dビューを同期させながら建物外形を編集するPoCです。寸法変更や頂点操作が全ビューへ即時反映されます。
          </p>
        </header>

        <OutputToolbar />

        <section className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <PlanViewCanvas />
          <DimensionPanel />
        </section>

        <ElevationViews />
        <ThreeDView />
      </main>
    </BuildingProvider>
  );
}
