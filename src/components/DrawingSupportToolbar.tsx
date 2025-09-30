"use client";

import React from 'react';
import { useBuildingState, type ToggleableDrawingMode } from '../context/BuildingProvider';
import { Grid, Move, Ruler, Lock, Unlock, Wand2 } from 'lucide-react';

const ToggleButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs transition-colors ${
      active ? 'border-blue-400 bg-blue-500/10 text-blue-200' : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
    }`}
  >
    <span className="h-4 w-4">{icon}</span>
    <span>{label}</span>
  </button>
);

export const DrawingSupportToolbar: React.FC = () => {
  const { state, dispatch } = useBuildingState();
  const activeFloor = state.floors.find((floor) => floor.id === state.activeFloorId) ?? state.floors[0];

  const toggleMode = (mode: ToggleableDrawingMode) => {
    dispatch({ type: 'setDrawingMode', mode, value: !state.modes[mode] });
  };

  const generateEaves = () => {
    dispatch({ type: 'generateEaveOffsets', floorId: activeFloor.id, offset: 500 });
  };

  const toggleLock = () => {
    dispatch({ type: 'toggleFloorLock', floorId: activeFloor.id, locked: !activeFloor.locked });
  };

  return (
    <section aria-label="Drawing support toolbar" className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <Wand2 className="w-4 h-4" />
        作図サポート
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <ToggleButton
          active={state.modes.rightAngle}
          onClick={() => toggleMode('rightAngle')}
          icon={<Ruler className="h-4 w-4" />}
          label="直角モード"
        />
        <ToggleButton
          active={state.modes.gridSnap}
          onClick={() => toggleMode('gridSnap')}
          icon={<Move className="h-4 w-4" />}
          label="グリッドスナップ"
        />
        <ToggleButton
          active={state.modes.gridVisible}
          onClick={() => toggleMode('gridVisible')}
          icon={<Grid className="h-4 w-4" />}
          label="グリッド表示"
        />
        <ToggleButton
          active={state.modes.dimensionVisible}
          onClick={() => toggleMode('dimensionVisible')}
          icon={<Ruler className="h-4 w-4" />}
          label="寸法表示"
        />
        <button
          type="button"
          onClick={generateEaves}
          className="flex flex-col items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <span className="h-4 w-4">
            <Ruler className="h-4 w-4" />
          </span>
          <span>軒の出500mm</span>
        </button>
      </div>
      <button
        type="button"
        onClick={toggleLock}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
      >
        {activeFloor.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />} {activeFloor.locked ? '編集ロック解除' : '編集ロック'}
      </button>
    </section>
  );
};
