"use client";

import React from 'react';
import { Download, Upload, Trash2, Menu } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  onImport: () => void;
  onExport: () => void;
  onDelete: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  onImport,
  onExport,
  onDelete
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-900 border-b border-slate-700 shadow-sm">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="メニューの開閉"
          >
            <Menu className="w-5 h-5 text-slate-300" />
          </button>
          <h1 className="text-xl font-bold text-white">
            scaff
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onImport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="インポート"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">インポート</span>
          </button>

          <button
            onClick={onExport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="エクスポート"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">エクスポート</span>
          </button>

          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
            aria-label="削除"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">削除</span>
          </button>
        </div>
      </div>
    </header>
  );
};