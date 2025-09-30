"use client";

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useBuildingState, type TemplateType } from '../../context/BuildingProvider';
import { listTemplates } from '../../modules/templates/catalog';

export const TemplateSidebarSection: React.FC = () => {
  const { state, dispatch } = useBuildingState();
  const [open, setOpen] = useState(false);
  const templates = useMemo(() => listTemplates(), []);

  const toggle = () => setOpen((prev) => !prev);

  const applyTemplate = (templateId: TemplateType) => {
    dispatch({ type: 'applyTemplateToActiveFloor', template: templateId });
  };

  return (
    <section aria-label="テンプレートセクション" className="space-y-3">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        aria-expanded={open}
      >
        <span>テンプレート一覧</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <div
          data-testid="template-list"
          className="space-y-2"
        >
          {templates.map((template) => {
            const isActive = state.template === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template.id as TemplateType)}
                aria-pressed={isActive}
                className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                  isActive
                    ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                    : 'border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className="block text-sm font-semibold">{template.label}</span>
                <span className="block text-xs text-slate-400">
                  {template.metadata.minWidth / 1000}m × {template.metadata.minDepth / 1000}m 以上
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
