"use client";

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  useBuildingState,
  type RoofType,
  type CardinalDirection,
  type BuildingStateValue,
  type RoofOrientation
} from '../../context/BuildingProvider';

interface RoofTypeOption {
  id: RoofType;
  label: string;
}

interface DirectionOption {
  id: CardinalDirection;
  label: string;
}

interface OrientationOption {
  id: RoofOrientation;
  label: string;
  description: string;
}

const ROOF_TYPE_OPTIONS: RoofTypeOption[] = [
  { id: 'flat', label: 'フラット' },
  { id: 'mono', label: '片流れ' },
  { id: 'gable', label: '切妻' },
  { id: 'hip', label: '寄棟' }
];

const EAVE_DIRECTION_OPTIONS: DirectionOption[] = [
  { id: 'north', label: '北面' },
  { id: 'south', label: '南面' },
  { id: 'east', label: '東面' },
  { id: 'west', label: '西面' }
];

const GABLE_ORIENTATION_OPTIONS: OrientationOption[] = [
  { id: 'north-south', label: 'N-S', description: '妻面：北・南' },
  { id: 'east-west', label: 'W-E', description: '妻面：東・西' }
];

const findActiveFloor = (state: BuildingStateValue['state']) =>
  state.floors.find((floor) => floor.id === state.activeFloorId) ?? state.floors[0];

const normalizeNumber = (value: string): number | null => {
  if (value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

export const RoofSidebarSection: React.FC = () => {
  const { state, dispatch } = useBuildingState();
  const activeFloor = useMemo(() => findActiveFloor(state), [state]);
  const isLocked = activeFloor?.locked ?? false;

  const initialOffset = useMemo(() => activeFloor?.dimensions[0]?.offset ?? 0, [activeFloor]);

  const [draftSlope, setDraftSlope] = useState(() => String(activeFloor?.roof.slopeValue ?? 0));
  const [draftRidge, setDraftRidge] = useState(() => String(activeFloor?.roof.ridgeHeight ?? 0));
  const [draftParapet, setDraftParapet] = useState(() => String(activeFloor?.roof.parapetHeight ?? 0));
  const [draftEave, setDraftEave] = useState(() => String(initialOffset));
  const [fieldErrors, setFieldErrors] = useState<{
    slope?: string;
    ridge?: string;
    parapet?: string;
    eave?: string;
  }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    setDraftSlope(String(activeFloor?.roof.slopeValue ?? 0));
    setDraftRidge(String(activeFloor?.roof.ridgeHeight ?? 0));
    setDraftParapet(String(activeFloor?.roof.parapetHeight ?? 0));
    setDraftEave(String(activeFloor?.dimensions[0]?.offset ?? 0));
    setFieldErrors({});
  }, [activeFloor]);

  useEffect(() => {
    if (!state.lastError) {
      setGeneralError(null);
      return;
    }
    if (/屋根|軒/.test(state.lastError)) {
      setGeneralError(state.lastError);
    }
  }, [state.lastError]);

  const handleSelectType = useCallback((type: RoofType) => {
    if (!activeFloor || isLocked || activeFloor.roof.type === type) {
      return;
    }
    dispatch({ type: 'updateRoof', floorId: activeFloor.id, roof: { type } });
  }, [activeFloor, dispatch, isLocked]);

  const commitSlope = useCallback(() => {
    if (!activeFloor || isLocked) {
      return;
    }
    const parsed = normalizeNumber(draftSlope);
    if (parsed === null || parsed < 0) {
      setDraftSlope(String(activeFloor.roof.slopeValue));
      setFieldErrors((prev) => ({ ...prev, slope: '屋根勾配は0以上で入力してください。' }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, slope: undefined }));
    dispatch({ type: 'updateRoof', floorId: activeFloor.id, roof: { slopeValue: parsed } });
    setDraftSlope(String(parsed));
  }, [activeFloor, dispatch, draftSlope, isLocked]);

  const commitRidgeHeight = useCallback(() => {
    if (!activeFloor || isLocked) {
      return;
    }
    const parsed = normalizeNumber(draftRidge);
    if (parsed === null || parsed < activeFloor.height) {
      setDraftRidge(String(activeFloor.roof.ridgeHeight));
       setFieldErrors((prev) => ({ ...prev, ridge: '最高高さは階高以上で入力してください。' }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, ridge: undefined }));
    dispatch({ type: 'updateRoof', floorId: activeFloor.id, roof: { ridgeHeight: parsed } });
    setDraftRidge(String(parsed));
  }, [activeFloor, dispatch, draftRidge, isLocked]);

  const commitParapet = useCallback(() => {
    if (!activeFloor || isLocked) {
      return;
    }
    const parsed = normalizeNumber(draftParapet);
    if (parsed === null || parsed < 0) {
      setDraftParapet(String(activeFloor.roof.parapetHeight ?? 0));
      setFieldErrors((prev) => ({ ...prev, parapet: '立ち上がりは0以上で入力してください。' }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, parapet: undefined }));
    dispatch({ type: 'updateRoof', floorId: activeFloor.id, roof: { parapetHeight: parsed } });
    setDraftParapet(String(parsed));
  }, [activeFloor, dispatch, draftParapet, isLocked]);

  const commitEave = useCallback(() => {
    if (!activeFloor || isLocked) {
      return;
    }
    const parsed = normalizeNumber(draftEave);
    if (parsed === null || parsed < 0) {
      setDraftEave(String(activeFloor.dimensions[0]?.offset ?? 0));
      setFieldErrors((prev) => ({ ...prev, eave: '軒の出は0以上で入力してください。' }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, eave: undefined }));
    dispatch({ type: 'updateEaveOffset', floorId: activeFloor.id, offset: parsed });
    setDraftEave(String(parsed));
  }, [activeFloor, dispatch, draftEave, isLocked]);

  const toggleElevationDimensions = useCallback(() => {
    dispatch({
      type: 'setDrawingMode',
      mode: 'dimensionVisibleElevation',
      value: !state.modes.dimensionVisibleElevation
    });
  }, [dispatch, state.modes.dimensionVisibleElevation]);

  const handleSelectEaveDirection = useCallback(
    (direction: CardinalDirection) => {
      if (!activeFloor || isLocked || activeFloor.roof.lowSideDirection === direction) {
        return;
      }
      dispatch({ type: 'updateRoof', floorId: activeFloor.id, roof: { lowSideDirection: direction } });
    },
    [activeFloor, dispatch, isLocked]
  );

  const handleSelectGableOrientation = useCallback(
    (orientation: RoofOrientation) => {
      if (!activeFloor || isLocked || activeFloor.roof.orientation === orientation) {
        return;
      }
      dispatch({ type: 'updateRoof', floorId: activeFloor.id, roof: { orientation } });
    },
    [activeFloor, dispatch, isLocked]
  );

  if (!activeFloor) {
    return null;
  }

  const isFlat = activeFloor.roof.type === 'flat';
  const isMono = activeFloor.roof.type === 'mono';
  const isGable = activeFloor.roof.type === 'gable';

  return (
    <section aria-label="屋根設定" className="space-y-4">
      <header>
        <h3 className="text-sm font-semibold text-slate-300">屋根</h3>
        <p className="text-xs text-slate-500">屋根タイプと数値設定を編集します。</p>
      </header>

      <div className="space-y-2">
        <p className="text-xs text-slate-400">屋根タイプ</p>
        <div className="grid grid-cols-2 gap-2">
          {ROOF_TYPE_OPTIONS.map((option) => {
            const isActive = activeFloor.roof.type === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`rounded border px-3 py-2 text-sm transition-colors ${
                  isActive ? 'border-blue-400 bg-blue-500/10 text-blue-200' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                aria-pressed={isActive}
                aria-disabled={isLocked ? 'true' : 'false'}
                disabled={isLocked}
                onClick={() => handleSelectType(option.id)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {isFlat ? (
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span>立ち上がり (mm)</span>
            <input
              type="number"
              min={0}
              step={50}
              value={draftParapet}
              onChange={(event) => setDraftParapet(event.target.value)}
              onBlur={commitParapet}
              disabled={isLocked}
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100 disabled:opacity-60"
              aria-label="立ち上がり"
            />
            {fieldErrors.parapet && (
              <span className="text-xs text-amber-400">{fieldErrors.parapet}</span>
            )}
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              <span>勾配 (10/〇)</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={draftSlope}
                onChange={(event) => setDraftSlope(event.target.value)}
                onBlur={commitSlope}
                disabled={isLocked}
                className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100 disabled:opacity-60"
                aria-label="勾配"
              />
              {fieldErrors.slope && (
                <span className="text-xs text-amber-400">{fieldErrors.slope}</span>
              )}
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-200">
              <span>最高高さ (mm)</span>
              <input
                type="number"
                min={activeFloor.height}
                step={100}
                value={draftRidge}
                onChange={(event) => setDraftRidge(event.target.value)}
                onBlur={commitRidgeHeight}
                disabled={isLocked}
                className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100 disabled:opacity-60"
                aria-label="最高高さ"
              />
              {fieldErrors.ridge && (
                <span className="text-xs text-amber-400">{fieldErrors.ridge}</span>
              )}
            </label>
          </>
        )}

        <label className="flex flex-col gap-1 text-sm text-slate-200">
          <span>軒の出 (mm)</span>
          <input
            type="number"
            min={0}
            step={50}
            value={draftEave}
            onChange={(event) => setDraftEave(event.target.value)}
            onBlur={commitEave}
            disabled={isLocked}
            className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100 disabled:opacity-60"
            aria-label="軒の出"
          />
          {fieldErrors.eave && (
            <span className="text-xs text-amber-400">{fieldErrors.eave}</span>
          )}
        </label>

        {isGable && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">屋根向き</p>
            <div className="grid grid-cols-2 gap-2">
              {GABLE_ORIENTATION_OPTIONS.map((option) => {
                const isActive = activeFloor.roof.orientation === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`rounded border px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                        : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                    aria-pressed={isActive}
                    aria-disabled={isLocked ? 'true' : 'false'}
                    aria-label={`屋根向き ${option.description}`}
                    disabled={isLocked}
                    onClick={() => handleSelectGableOrientation(option.id)}
                  >
                    <span className="block text-base font-semibold leading-tight">{option.label}</span>
                    <span className="block text-[11px] text-slate-400">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isMono && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">軒先方向</p>
            <div className="grid grid-cols-2 gap-2">
              {EAVE_DIRECTION_OPTIONS.map((option) => {
                const isActive = activeFloor.roof.lowSideDirection === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`rounded border px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                        : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                    aria-pressed={isActive}
                    aria-disabled={isLocked ? 'true' : 'false'}
                    disabled={isLocked}
                    onClick={() => handleSelectEaveDirection(option.id)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-700">
        <button
          type="button"
          className={`w-full rounded border px-3 py-2 text-sm transition-colors ${
            state.modes.dimensionVisibleElevation
              ? 'border-blue-400 bg-blue-500/10 text-blue-200'
              : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          aria-pressed={state.modes.dimensionVisibleElevation}
          onClick={toggleElevationDimensions}
        >
          立面寸法表示
        </button>
      </div>

      {generalError && (
        <p className="text-xs text-amber-400" role="alert">
          {generalError}
        </p>
      )}
    </section>
  );
};
