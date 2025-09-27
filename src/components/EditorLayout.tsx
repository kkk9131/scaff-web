"use client";

import React, { useState, useCallback } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { TabView } from './TabView';
import { useBuildingState } from '../context/BuildingProvider';

interface EditorLayoutProps {
  children?: React.ReactNode;
}

export const EditorLayout: React.FC<EditorLayoutProps> = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { state, dispatch } = useBuildingState();

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const model = JSON.parse(text);
        dispatch({ type: 'hydrate', model });
        alert('プロジェクトをインポートしました');
      } catch (error) {
        alert('インポートに失敗しました');
        console.error(error);
      }
    };
    input.click();
  }, [dispatch]);

  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `scaff-project-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [state]);

  const handleDelete = useCallback(() => {
    if (confirm('現在のプロジェクトを削除してリセットしますか？')) {
      dispatch({ type: 'selectTemplate', template: 'rectangle' });
      localStorage.removeItem('buildingModel');
      alert('プロジェクトをリセットしました');
    }
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-slate-900">
      <Header
        onToggleSidebar={handleToggleSidebar}
        onImport={handleImport}
        onExport={handleExport}
        onDelete={handleDelete}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* メインコンテンツエリア */}
      <main className={`pt-14 transition-all duration-300 ${
        isSidebarOpen ? 'lg:ml-80' : ''
      }`}>
        <div className="h-[calc(100vh-3.5rem)]">
          <TabView />
        </div>
      </main>
    </div>
  );
};