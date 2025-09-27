"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useBuildingState } from '../context/BuildingProvider';

interface DraftState {
  height: string;
  roofSlope: string;
  dimensionLengths: Record<string, string>;
  dimensionOffsets: Record<string, string>;
}

interface ErrorState {
  [field: string]: string;
}

const buildDraftState = (floorId: string, options: { lengths: DraftState['dimensionLengths']; offsets: DraftState['dimensionOffsets']; height: number; roofSlope: number }): DraftState => ({
  height: options.height.toString(),
  roofSlope: options.roofSlope.toString(),
  dimensionLengths: { ...options.lengths },
  dimensionOffsets: { ...options.offsets }
});

export const DimensionPanel: React.FC = () => {
  const { state, dispatch } = useBuildingState();
  const activeFloor = useMemo(
    () => state.floors.find((floor) => floor.id === state.activeFloorId) ?? state.floors[0],
    [state.floors, state.activeFloorId]
  );

  const [drafts, setDrafts] = useState<DraftState>(() =>
    buildDraftState(activeFloor.id, {
      lengths: Object.fromEntries(activeFloor.dimensions.map((d) => [d.edgeId, d.length.toString()])),
      offsets: Object.fromEntries(activeFloor.dimensions.map((d) => [d.edgeId, d.offset.toString()])),
      height: activeFloor.height,
      roofSlope: activeFloor.roof.slopeValue
    })
  );
  const [errors, setErrors] = useState<ErrorState>({});

  useEffect(() => {
    setDrafts(
      buildDraftState(activeFloor.id, {
        lengths: Object.fromEntries(activeFloor.dimensions.map((d) => [d.edgeId, d.length.toString()])),
        offsets: Object.fromEntries(activeFloor.dimensions.map((d) => [d.edgeId, d.offset.toString()])),
        height: activeFloor.height,
        roofSlope: activeFloor.roof.slopeValue
      })
    );
    setErrors({});
  }, [activeFloor]);

  const updateError = (field: string, message?: string) => {
    setErrors((prev) => {
      if (!message) {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }
      if (prev[field] === message) return prev;
      return { ...prev, [field]: message };
    });
  };

  const handleDimensionChange = (edgeId: string, field: 'dimensionLengths' | 'dimensionOffsets') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setDrafts((prev) => ({
        ...prev,
        [field]: {
          ...prev[field],
          [edgeId]: value
        }
      }));
    };

  const commitDimensionLength = (edgeId: string) => {
    const raw = drafts.dimensionLengths[edgeId];
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      updateError(edgeId, '長さは0より大きい値で入力してください。');
      return;
    }
    updateError(edgeId);
    dispatch({ type: 'updateEdgeLength', floorId: activeFloor.id, edgeId, length: parsed });
  };

  const commitDimensionOffset = (edgeId: string) => {
    const raw = drafts.dimensionOffsets[edgeId];
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      updateError(`${edgeId}-offset`, '境界距離は0以上で入力してください。');
      return;
    }
    updateError(`${edgeId}-offset`);
    dispatch({ type: 'updateEdgeOffset', floorId: activeFloor.id, edgeId, offset: parsed });
  };

  const commitHeight = () => {
    const parsed = Number(drafts.height);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      updateError('height', '階高は0より大きい値で入力してください。');
      return;
    }
    updateError('height');
    dispatch({ type: 'updateFloorHeight', floorId: activeFloor.id, height: parsed });
  };

  const commitRoofSlope = () => {
    const parsed = Number(drafts.roofSlope);
    if (!Number.isFinite(parsed) || parsed < 0) {
      updateError('roofSlope', '屋根勾配は0以上で入力してください。');
      return;
    }
    updateError('roofSlope');
    dispatch({ type: 'updateRoof', floorId: activeFloor.id, roof: { slopeValue: parsed } });
  };

  const handleFloorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch({ type: 'setActiveFloor', floorId: event.target.value });
  };

  const addFloor = () => dispatch({ type: 'addFloor' });
  const duplicateFloor = () => dispatch({ type: 'duplicateFloor', floorId: activeFloor.id });
  const removeFloor = () => dispatch({ type: 'removeFloor', floorId: activeFloor.id });

  return (
    <section aria-label="Dimension panel" className="space-y-4">
      <header className="flex items-center gap-3">
        <label className="text-sm text-slate-300" htmlFor="floor-selector">
          階層
        </label>
        <select
          id="floor-selector"
          aria-label="Floor selector"
          className="rounded border border-slate-600 bg-slate-700 text-white px-2 py-1"
          value={activeFloor.id}
          onChange={handleFloorChange}
        >
          {state.floors.map((floor) => (
            <option key={floor.id} value={floor.id}>
              {floor.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <button type="button" className="rounded border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-600 transition-colors" onClick={addFloor}>
            Add Floor
          </button>
          <button type="button" className="rounded border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-600 transition-colors" onClick={duplicateFloor}>
            Duplicate
          </button>
          <button
            type="button"
            className="rounded border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-600 transition-colors disabled:opacity-40"
            disabled={state.floors.length <= 1}
            onClick={removeFloor}
          >
            Remove
          </button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {activeFloor.dimensions.map((dimension, index) => (
          <div key={dimension.edgeId} className="space-y-1 rounded border border-slate-600 bg-slate-800 p-3">
            <h3 className="text-sm font-semibold text-white">Edge {index + 1}</h3>
            <label className="flex flex-col text-sm text-slate-300">
              長さ (mm)
              <input
                aria-label={`Edge ${index + 1} Length (mm)`}
                className="mt-1 rounded border border-slate-600 bg-slate-700 text-white px-2 py-1"
                value={drafts.dimensionLengths[dimension.edgeId] ?? ''}
                onChange={handleDimensionChange(dimension.edgeId, 'dimensionLengths')}
                onBlur={() => commitDimensionLength(dimension.edgeId)}
                inputMode="numeric"
              />
            </label>
            {errors[dimension.edgeId] && (
              <p role="alert" className="text-xs text-red-400">
                {errors[dimension.edgeId]}
              </p>
            )}
            <label className="flex flex-col text-sm text-slate-300">
              境界距離 (mm)
              <input
                aria-label={`Edge ${index + 1} Offset (mm)`}
                className="mt-1 rounded border border-slate-600 bg-slate-700 text-white px-2 py-1"
                value={drafts.dimensionOffsets[dimension.edgeId] ?? ''}
                onChange={handleDimensionChange(dimension.edgeId, 'dimensionOffsets')}
                onBlur={() => commitDimensionOffset(dimension.edgeId)}
                inputMode="numeric"
              />
            </label>
            {errors[`${dimension.edgeId}-offset`] && (
              <p role="alert" className="text-xs text-red-400">
                {errors[`${dimension.edgeId}-offset`]}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col text-sm text-slate-300">
          階高 (mm)
          <input
            aria-label="Floor Height (mm)"
            className="mt-1 rounded border border-slate-600 bg-slate-700 text-white px-2 py-1"
            value={drafts.height}
            onChange={(event) => setDrafts((prev) => ({ ...prev, height: event.target.value }))}
            onBlur={commitHeight}
            inputMode="numeric"
          />
        </label>
        {errors.height && (
          <p role="alert" className="text-xs text-red-600">
            {errors.height}
          </p>
        )}
        <label className="flex flex-col text-sm text-slate-300">
          屋根勾配 (10/x)
          <input
            aria-label="Roof Slope (10/x)"
            className="mt-1 rounded border border-slate-600 bg-slate-700 text-white px-2 py-1"
            value={drafts.roofSlope}
            onChange={(event) => setDrafts((prev) => ({ ...prev, roofSlope: event.target.value }))}
            onBlur={commitRoofSlope}
            inputMode="numeric"
          />
        </label>
        {errors.roofSlope && (
          <p role="alert" className="text-xs text-red-600">
            {errors.roofSlope}
          </p>
        )}
      </div>

      {state.lastError && (
        <p role="alert" className="text-sm text-red-600">
          {state.lastError}
        </p>
      )}
    </section>
  );
};
