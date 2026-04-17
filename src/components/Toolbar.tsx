import React, { memo, useContext } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';
import { CardViewIcon, TableViewIcon, ExportIcon, StarIcon } from './Icons';
import { isColorLight } from '../utils/colorUtils';

interface ToolbarProps {
  viewMode: 'card' | 'table';
  onViewChange: (mode: 'card' | 'table') => void;
  onBatchFavorite: () => void;
  onExportCSV: () => void;
  selectedCount: number;
}

export const Toolbar: React.FC<ToolbarProps> = memo(({ viewMode, onViewChange, onBatchFavorite, onExportCSV, selectedCount }) => {
  const { settings } = useContext(SettingsContext);
  
  const baseButtonClass = "px-4 py-2 text-sm font-bold rounded-md transition-colors flex items-center justify-center gap-2";
  const buttonTextColor = isColorLight(settings.themeColor) ? 'text-slate-900' : 'text-white';
  const activeButtonClass = `bg-[var(--theme-color)] ${buttonTextColor} shadow-lg`;
  const inactiveButtonClass = "bg-slate-600/50 hover:bg-slate-600 text-slate-300";

  return (
    <div className="my-6 p-2 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-lg max-w-4xl mx-auto flex flex-col sm:flex-row items-center sm:justify-between gap-2 animate-fade-in-down font-sans">
      <div className="w-full sm:w-auto flex items-center gap-1 bg-slate-700/50 p-1 rounded-lg">
        <button
          onClick={() => onViewChange('card')}
          className={`flex-1 sm:flex-initial ${baseButtonClass} ${viewMode === 'card' ? activeButtonClass : inactiveButtonClass}`}
          aria-pressed={viewMode === 'card'}
        >
          <CardViewIcon />
          <span>卡片视图</span>
        </button>
        <button
          onClick={() => onViewChange('table')}
          className={`flex-1 sm:flex-initial ${baseButtonClass} ${viewMode === 'table' ? activeButtonClass : inactiveButtonClass}`}
          aria-pressed={viewMode === 'table'}
        >
          <TableViewIcon />
          <span>表格视图</span>
        </button>
      </div>

      <div className="w-full sm:w-auto flex items-center gap-2">
        <button
          onClick={onBatchFavorite}
          disabled={selectedCount === 0}
          className={`flex-1 sm:flex-initial ${baseButtonClass} bg-slate-600/50 hover:bg-slate-600 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <StarIcon />
          <span>收藏选中 ({selectedCount})</span>
        </button>
        <button
          onClick={onExportCSV}
          disabled={selectedCount === 0}
          className={`flex-1 sm:flex-initial ${baseButtonClass} bg-slate-600/50 hover:bg-slate-600 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <ExportIcon />
          <span>导出选中 ({selectedCount})</span>
        </button>
      </div>
    </div>
  );
});