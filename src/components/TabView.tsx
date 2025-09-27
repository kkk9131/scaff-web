"use client";

import React, { useState } from 'react';
import { PlanViewCanvas } from './PlanViewCanvas';
import { ElevationViews } from './ElevationViews';
import { ThreeDView } from './ThreeDView';
import { Layers, Box, Grid3x3 } from 'lucide-react';

type TabType = 'plan' | 'elevation' | '3d';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'plan', label: '平面図', icon: <Grid3x3 className="w-4 h-4" /> },
  { id: 'elevation', label: '立面図', icon: <Layers className="w-4 h-4" /> },
  { id: '3d', label: '3Dビュー', icon: <Box className="w-4 h-4" /> },
];

export const TabView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('plan');

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* タブナビゲーション */}
      <div className="bg-slate-900 border-b border-slate-700">
        <nav className="flex" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              className={`
                flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all
                border-b-2 hover:bg-slate-800
                ${activeTab === tab.id
                  ? 'text-blue-400 border-blue-400 bg-slate-800'
                  : 'text-slate-400 border-transparent hover:text-slate-300'
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-hidden">
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          className="h-full"
        >
          {activeTab === 'plan' && (
            <div className="h-full">
              <PlanViewCanvas />
            </div>
          )}

          {activeTab === 'elevation' && (
            <div className="h-full overflow-auto">
              <ElevationViews />
            </div>
          )}

          {activeTab === '3d' && (
            <div className="h-full">
              <ThreeDView />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};