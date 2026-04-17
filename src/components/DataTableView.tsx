import React, { memo, useMemo, useContext } from 'react';
import type { Website } from '../types';
import { DataContext } from '../contexts/DataContext';
import { ArrowUpRightIcon, StarIcon, CommandLineIcon } from './Icons';
import { Loader } from './Loader';

interface DataTableViewProps {
  websites: Website[];
  selectedUrls: Set<string>;
  onSelectionChange: (url: string, isSelected: boolean) => void;
  onSelectAll: (isSelected: boolean) => void;
}

export const DataTableView: React.FC<DataTableViewProps> = memo(({
  websites,
  selectedUrls,
  onSelectionChange,
  onSelectAll,
}) => {
  const { 
    isFavorite,
    handleToggleFavorite,
    handleMarkAsVisited,
    handleAnalyzeWebsite,
    handleViewAnalysis,
   } = useContext(DataContext);

  const areAllSelected = useMemo(() => websites.length > 0 && selectedUrls.size === websites.length, [websites, selectedUrls]);

  const handleSelectAllCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectAll(e.target.checked);
  };

  const AnalysisButton = ({ site }: { site: Website }) => {
    const baseClasses = "inline-flex items-center text-xs font-semibold text-white bg-slate-700/80 px-3 py-1.5 rounded-full hover:bg-[var(--theme-color)] transition-colors duration-200 group self-start font-sans disabled:bg-slate-600 disabled:cursor-wait";
    if (site.isAnalyzing) {
        return (
            <button className={baseClasses} disabled>
                <Loader />
                <span className="ml-1.5">分析中...</span>
            </button>
        );
    }
    if (site.analysis) {
        return <button onClick={() => handleViewAnalysis(site)} className={baseClasses}>查看分析</button>;
    }
    return (
        <button onClick={() => handleAnalyzeWebsite(site)} className={baseClasses}>
            <CommandLineIcon className="h-4 w-4 mr-1.5" />
            <span>分析</span>
        </button>
    );
  };

  return (
    <div className="my-8 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-lg max-w-full mx-auto animate-fade-in-down overflow-x-auto font-sans">
      <table className="w-full min-w-[1024px] text-sm text-left text-slate-300">
        <thead className="text-xs text-slate-400 uppercase bg-slate-700/30">
          <tr>
            <th scope="col" className="p-4">
              <input 
                type="checkbox"
                className="w-4 h-4 text-[var(--theme-color)] bg-slate-600 border-slate-500 rounded focus:ring-[var(--theme-color)] focus:ring-2"
                checked={areAllSelected}
                onChange={handleSelectAllCheckbox}
                aria-label="Select all rows"
              />
            </th>
            <th scope="col" className="px-6 py-3">公司名称</th>
            <th scope="col" className="px-6 py-3">类型</th>
            <th scope="col" className="px-6 py-3">地区</th>
            <th scope="col" className="px-6 py-3">主要产品</th>
            <th scope="col" className="px-6 py-3 min-w-[20rem]">描述</th>
            <th scope="col" className="px-6 py-3">分析</th>
            <th scope="col" className="px-6 py-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {websites.map(site => (
            <tr key={site.url} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
              <td className="w-4 p-4">
                 <input 
                  type="checkbox"
                  className="w-4 h-4 text-[var(--theme-color)] bg-slate-600 border-slate-500 rounded focus:ring-[var(--theme-color)] focus:ring-2"
                  checked={selectedUrls.has(site.url)}
                  onChange={(e) => onSelectionChange(site.url, e.target.checked)}
                  aria-label={`Select ${site.name}`}
                 />
              </td>
              <th scope="row" className="px-6 py-4 font-bold text-white whitespace-nowrap">{site.name}</th>
              <td className="px-6 py-4">{site.type || 'N/A'}</td>
              <td className="px-6 py-4">{site.region || 'N/A'}</td>
              <td className="px-6 py-4">{site.mainProducts || 'N/A'}</td>
              <td className="px-6 py-4">{site.description}</td>
              <td className="px-6 py-4">
                <AnalysisButton site={site} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <button onClick={() => handleToggleFavorite(site)} aria-label="Toggle Favorite" className="text-slate-500 hover:text-yellow-400 transition-colors">
                    <StarIcon filled={isFavorite(site.url)} />
                  </button>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleMarkAsVisited(site.url)}
                    className="text-slate-400 hover:text-[var(--theme-color)]"
                    title="Visit Website"
                  >
                    <ArrowUpRightIcon />
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});