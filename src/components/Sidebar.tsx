"use client";

import React from 'react';
import { DimensionPanel } from './DimensionPanel';
import { OutputToolbar } from './OutputToolbar';
import { X, Settings, Layers, FileText } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
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

          {/* セクション: 出力オプション */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              出力オプション
            </h3>
            <div className="bg-slate-700 p-3 rounded-lg">
              <OutputToolbar />
            </div>
          </section>

          {/* セクション: 寸法設定 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              寸法設定
            </h3>
            <div className="bg-slate-700 p-3 rounded-lg">
              <DimensionPanel />
            </div>
          </section>
        </div>
      </aside>
    </>
  );
};