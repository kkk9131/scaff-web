"use client";

import React from 'react';
import { useBuildingState, type TemplateType } from '../context/BuildingProvider';

interface TemplateOption {
  id: TemplateType;
  label: string;
  description: string;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: 'rectangle', label: '矩形', description: '一般的な四角形テンプレート' },
  { id: 'l-shape', label: 'L字型', description: '角をくり抜いた外形' },
  { id: 'concave', label: '凹型', description: '中庭を持つコの字型外形' },
  { id: 'convex', label: '凸型', description: '張り出しを備えた外形' }
];

export const TemplateSelectorPanel: React.FC = () => {
  const { state, dispatch } = useBuildingState();

  const applyTemplate = (template: TemplateType) => {
    dispatch({ type: 'applyTemplateToActiveFloor', template });
  };

  return (
    <section aria-label="テンプレート選択" className="mb-4">
      <h2 className="text-sm font-semibold text-slate-300 mb-2">外形テンプレート</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {TEMPLATE_OPTIONS.map((option) => {
          const isActive = state.template === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => applyTemplate(option.id)}
              className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
                isActive
                  ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                  : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="mt-1 text-xs text-slate-400">{option.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
