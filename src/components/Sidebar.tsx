"use client";

import React, { useState } from 'react';
import { DimensionPanel } from './DimensionPanel';
import { DrawingSupportToolbar } from './DrawingSupportToolbar';
import { OutputToolbar } from './OutputToolbar';
import { TemplateSidebarSection } from './sidebar/TemplateSidebarSection';
import { RoofSidebarSection } from './sidebar/RoofSidebarSection';
import { X, Settings, Layers, FileText, Square, Wand2, Shapes } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    template: false,
    roof: true,
    output: false,
    drawing: false,
    dimension: true
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      {/* オーバーレイ（モバイル用） */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`fixed top-14 left-0 z-40 h-[calc(100vh-3.5rem)] w-80 bg-slate-800 border-r border-slate-700 shadow-xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto`}
      >
        <div className="p-4 space-y-6">
          {/* サイドバーヘッダー */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              設定パネル
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors lg:hidden"
              aria-label="閉じる"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* セクション: テンプレート */}
          <section>
            <button
              type="button"
              onClick={() => toggleSection('template')}
              className="w-full flex items-center justify-between rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
              aria-expanded={openSections.template}
            >
              <span className="flex items-center gap-2">
                <Shapes className="w-4 h-4" />
                テンプレート
              </span>
              <span>{openSections.template ? '−' : '+'}</span>
            </button>
            {openSections.template && (
              <div className="mt-2 bg-slate-700 p-3 rounded-lg">
                <TemplateSidebarSection />
              </div>
            )}
          </section>

          {/* セクション: 屋根設定 */}
          <section>
            <button
              type="button"
              onClick={() => toggleSection('roof')}
              className="w-full flex items-center justify-between rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
              aria-expanded={openSections.roof}
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                屋根設定
              </span>
              <span>{openSections.roof ? '−' : '+'}</span>
            </button>
            {openSections.roof && (
              <div className="mt-2 bg-slate-700 p-3 rounded-lg">
                <RoofSidebarSection />
              </div>
            )}
          </section>

          {/* セクション: 出力オプション */}
          <section>
            <button
              type="button"
              onClick={() => toggleSection('output')}
              className="w-full flex items-center justify-between rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
              aria-expanded={openSections.output}
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                出力オプション
              </span>
              <span>{openSections.output ? '−' : '+'}</span>
            </button>
            {openSections.output && (
              <div className="mt-2 bg-slate-700 p-3 rounded-lg">
                <OutputToolbar />
              </div>
            )}
          </section>

          {/* セクション: 作図サポート */}
          <section>
            <button
              type="button"
              onClick={() => toggleSection('drawing')}
              className="w-full flex items-center justify-between rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
              aria-expanded={openSections.drawing}
            >
              <span className="flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                作図サポート
              </span>
              <span>{openSections.drawing ? '−' : '+'}</span>
            </button>
            {openSections.drawing && (
              <div className="mt-2 bg-slate-700 p-3 rounded-lg">
                <DrawingSupportToolbar />
              </div>
            )}
          </section>

          {/* セクション: 寸法設定 */}
          <section>
            <button
              type="button"
              onClick={() => toggleSection('dimension')}
              className="w-full flex items-center justify-between rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
              aria-expanded={openSections.dimension}
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                寸法設定
              </span>
              <span>{openSections.dimension ? '−' : '+'}</span>
            </button>
            {openSections.dimension && (
              <div className="mt-2 bg-slate-700 p-3 rounded-lg">
                <DimensionPanel />
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
};
