import React, { memo, useContext } from 'react';
import type { Website } from '../types';
import { SettingsContext } from '../contexts/SettingsContext';
import { DataContext } from '../contexts/DataContext';
import { ArrowUpRightIcon, StarIcon, CommandLineIcon } from './Icons';
import { Loader } from './Loader';
import { isColorLight } from '../utils/colorUtils';

interface WebsiteCardProps {
  site: Website;
  isFavorite?: boolean; // Now optional as it can be derived from context
  className?: string;
  style?: React.CSSProperties;
}

export const WebsiteCard: React.FC<WebsiteCardProps> = memo(({ site, isFavorite: isFavoriteProp, className, style }) => {
  const { settings } = useContext(SettingsContext);
  const {
    isFavorite: isFavoriteFromContext,
    handleToggleFavorite,
    handleMarkAsVisited,
    handleAnalyzeWebsite,
    handleViewAnalysis,
  } = useContext(DataContext);

  const isFavorite = isFavoriteProp ?? isFavoriteFromContext(site.url);

  const cardStyle: React.CSSProperties = {
    backgroundColor: `rgba(30, 41, 59, ${settings.cardOpacity})`, // slate-800
    backdropFilter: `blur(${settings.cardBlur}px)`,
    WebkitBackdropFilter: `blur(${settings.cardBlur}px)`,
    ...style,
  };
  
  const handleToggle = () => handleToggleFavorite(site);
  
  const isThemeLight = isColorLight(settings.themeColor);
  const hoverTextColorClass = isThemeLight ? 'hover:text-slate-900' : 'hover:text-white';

  const AnalysisButton = () => {
    const baseClasses = `inline-flex items-center text-sm font-semibold text-white bg-slate-700/80 px-4 py-2 rounded-full hover:bg-[var(--theme-color)] transition-colors duration-200 font-sans disabled:bg-slate-600 disabled:cursor-wait whitespace-nowrap ${hoverTextColorClass}`;
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
            <span>智能分析</span>
        </button>
    );
  };

  return (
    <div 
      style={cardStyle}
      className={`relative rounded-xl p-6 flex flex-col border-t border-l border-white/5 border-b border-r border-black/20 shadow-lg shadow-black/40 hover:border-[var(--theme-color)] hover:shadow-lg hover:shadow-[var(--theme-color)]/20 transition-[transform,border-color,box-shadow] duration-300 ease-in-out transform hover:-translate-y-1 ${className}`}
    >
      <button 
        onClick={handleToggle}
        className="absolute top-4 right-4 text-slate-500 hover:text-yellow-400 transition-colors duration-200 z-10 p-1"
        aria-label={isFavorite ? '取消收藏' : '添加到收藏夹'}
      >
        <StarIcon filled={isFavorite} />
      </button>
      <div>
        <h3 className="text-xl font-bold text-[var(--theme-color)] mb-2 pr-8">{site.name}</h3>
        <p className="text-slate-300 text-sm leading-relaxed mb-4">{site.description}</p>
        <div className="flex flex-wrap gap-2 text-xs font-sans">
          {site.region && <span className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded-full">{site.region}</span>}
          {site.type && <span className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded-full">{site.type}</span>}
        </div>
      </div>
      <div className="flex items-center justify-between mt-6 gap-2">
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => handleMarkAsVisited(site.url)}
          className={`inline-flex items-center text-sm font-semibold text-white bg-slate-700/80 px-4 py-2 rounded-full hover:bg-[var(--theme-color)] transition-colors duration-200 font-sans whitespace-nowrap ${hoverTextColorClass}`}
        >
          访问网站
          <ArrowUpRightIcon />
        </a>
        <AnalysisButton />
      </div>
    </div>
  );
});