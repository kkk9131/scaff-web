'use client';

import React, { useState } from 'react';
import { toJpeg, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';

const triggerDownload = (data: string, filename: string) => {
  if (typeof document === 'undefined') return;
  if (typeof window !== 'undefined' && window.navigator?.userAgent?.includes('jsdom')) {
    return;
  }
  const link = document.createElement('a');
  link.href = data;
  link.download = filename;
  link.click();
};

const exportSvg = async (node: HTMLElement) => {
  const svgContent = await toSvg(node);
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'plan-view.svg');
    URL.revokeObjectURL(url);
    return;
  }
  const encoded = `data:image/svg+xml;base64,${typeof window !== 'undefined' ? window.btoa(svgContent) : svgContent}`;
  triggerDownload(encoded, 'plan-view.svg');
};

const exportJpeg = async (node: HTMLElement) => {
  const dataUrl = await toJpeg(node, { quality: 0.95 });
  triggerDownload(dataUrl, 'plan-view.jpg');
};

const exportPdf = async (node: HTMLElement) => {
  const dataUrl = await toJpeg(node, { quality: 0.95 });
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [node.clientWidth, node.clientHeight] });
  pdf.addImage(dataUrl, 'JPEG', 0, 0, node.clientWidth, node.clientHeight);
  pdf.save('plan-view.pdf');
};

const findPlanNode = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  return document.querySelector('[data-testid="plan-stage"]') as HTMLElement | null;
};

export const OutputToolbar: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = async (action: (node: HTMLElement) => Promise<void>, label: string) => {
    const node = findPlanNode();
    if (!node) {
      setMessage('エクスポート対象のビューが見つかりませんでした。');
      return;
    }
    try {
      await action(node);
      setMessage(`${label}をエクスポートしました。`);
    } catch (error) {
      setMessage('エクスポートに失敗しました。再度お試しください。');
      // eslint-disable-next-line no-console
      console.error(error);
    }
  };

  return (
    <section aria-label="Output toolbar" className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-1"
        onClick={() => handleExport(exportSvg, 'SVG')}
      >
        Export SVG
      </button>
      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-1"
        onClick={() => handleExport(exportJpeg, 'JPEG')}
      >
        Export JPEG
      </button>
      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-1"
        onClick={() => handleExport(exportPdf, 'PDF')}
      >
        Export PDF
      </button>
      {message && (
        <span role="status" className="text-sm text-slate-500">
          {message}
        </span>
      )}
    </section>
  );
};
