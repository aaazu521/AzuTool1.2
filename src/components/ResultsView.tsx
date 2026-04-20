import React, { useContext, useEffect, Suspense, lazy, useState, useCallback } from 'react';

// Contexts
import { UIContext } from '../contexts/UIContext';
import { DataContext } from '../contexts/DataContext';
import { SettingsContext } from '../contexts/SettingsContext';

// Components
import { WebsiteCard } from './WebsiteCard';
import { Loader } from './Loader';
import { RefreshIcon, StarIcon, HistoryIcon, ChevronDownIcon, UndoIcon, VideoIcon, ImageIcon, HomeIcon } from './Icons';
import { GroundedSearchResultDisplay } from './GroundedSearchResultDisplay';
import { Toolbar } from './Toolbar';
import { DataTableView } from './DataTableView';

// Utils
import { exportWebsitesToCSV } from '../utils/csvExporter';

// Lazy-loaded Components
const VideoResultsGrid = lazy(() => import('./VideoResultDisplay'));
const ImageResultsGrid = lazy(() => import('./ImageResultDisplay'));


const ResultsView: React.FC = () => {
    const { settings } = useContext(SettingsContext);
    const { showToast } = useContext(UIContext);

    const {
        websites,
        isGenerated,
        isLoading,
        groundedResult,
        videoResult,
        imageResult,
        resultType,
        generationTarget,
        previousResultState,
        handleGenerate,
        cancelGeneration,
        handleUndo,
        returnToHome,
        favorites,
        handleToggleFavorite,
        visitedUrls,
        handleMarkAsVisited,
        allGeneratedWebsites,
        searchQuery,
    } = useContext(DataContext);

    const [isHistoryVisible, setIsHistoryVisible] = useState<boolean>(false);
    const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
    const [selectedWebsiteUrls, setSelectedWebsiteUrls] = useState<Set<string>>(new Set());

    // Reset selections when displayed websites change
    useEffect(() => {
        setSelectedWebsiteUrls(new Set());
    }, [websites]);

    const handleBatchFavoriteClick = useCallback(() => {
        const websitesToFavorite = websites.filter(w => selectedWebsiteUrls.has(w.url));
        handleToggleFavorite(websitesToFavorite, true); // Use batch mode
    }, [websites, selectedWebsiteUrls, handleToggleFavorite]);

    const handleExportCSVClick = useCallback(() => {
        const websitesToExport = websites.filter(w => selectedWebsiteUrls.has(w.url));
        if (websitesToExport.length > 0) {
            exportWebsitesToCSV(websitesToExport);
            showToast(`已导出 ${websitesToExport.length} 个项目。`);
        }
    }, [websites, selectedWebsiteUrls, showToast]);

    const handleSelectionChange = useCallback((url: string, isSelected: boolean) => {
        setSelectedWebsiteUrls(prev => {
            const newSet = new Set(prev);
            if (isSelected) newSet.add(url);
            else newSet.delete(url);
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback((isSelected: boolean) => {
        setSelectedWebsiteUrls(isSelected ? new Set(websites.map(w => w.url)) : new Set());
    }, [websites]);

    const renderAgainGenerator = () => {
        if (!isGenerated) return null;

        const bothMediaEnabled = settings.videoGenerationEnabled && settings.imageGenerationEnabled;
        const isSearchMode = settings.moreSearchesEnabled || settings.omniSearchEnabled;
        
        const isShowingMediaResults = resultType === 'video' || resultType === 'image';
        const isShowingSearchResults = resultType === 'websites' || resultType === 'grounded';

        const handleAgainClick = () => {
            if (isShowingMediaResults) {
                // If showing media, generate another of the same type.
                handleGenerate(searchQuery, resultType as 'video' | 'image');
            } else {
                // If showing search results, perform the search again with the same query.
                handleGenerate(searchQuery);
            }
        };
        
        const getButtonContent = () => {
            const isLoadingSearchRefresh = isLoading && !generationTarget && isShowingSearchResults;
            const isLoadingMediaRefresh = isLoading && generationTarget === resultType;

            if (isLoadingSearchRefresh || isLoadingMediaRefresh) {
                return <><Loader /><span className="hidden sm:inline">生成中...</span></>;
            }

            if (isShowingMediaResults) {
                const icon = resultType === 'video' ? <VideoIcon /> : <ImageIcon />;
                return <>{icon}<span className="hidden sm:inline">再生成一次</span></>;
            }

            // Default to search refresh
            const icon = settings.customRefreshIconUrl
                ? <img src={settings.customRefreshIconUrl} alt="Custom Refresh Icon" className="h-6 w-6 transform group-hover:rotate-180 transition-transform duration-300" />
                : <RefreshIcon />;
            return <>{icon}<span className="hidden sm:inline">换一批</span></>;
        };

        const singleActionButton = (
            <div className="flex items-center">
                <button
                    onClick={handleAgainClick}
                    disabled={isLoading || (isSearchMode && !searchQuery.trim() && isShowingSearchResults)}
                    className="p-3 sm:pl-5 sm:pr-6 flex items-center gap-2 text-sm font-bold text-white bg-slate-800/80 backdrop-blur-sm border border-slate-700/80 rounded-full hover:border-[var(--theme-color)]/70 hover:bg-slate-700/80 hover:shadow-lg hover:shadow-[var(--theme-color)]/20 transform hover:scale-105 active:scale-100 transition-all duration-300 disabled:cursor-not-allowed disabled:text-slate-500 disabled:transform-none disabled:shadow-none">
                    {getButtonContent()}
                </button>
                {isLoading && (
                    <button 
                        onClick={cancelGeneration} 
                        className="ml-2 p-3 bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 border border-red-500/30 rounded-full transition-all flex items-center justify-center font-bold text-sm"
                        title="停止生成"
                    >
                        停止
                    </button>
                )}
            </div>
        );

        const splitMediaButtons = (
            <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-800/80 backdrop-blur-sm border border-slate-700/80 rounded-full shadow-lg overflow-hidden">
                    <button onClick={() => handleGenerate(searchQuery, 'video')} disabled={isLoading} className="px-3 sm:px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700/60 transition-colors flex items-center gap-1.5 disabled:cursor-not-allowed disabled:bg-slate-700/30 disabled:text-slate-500">
                        {isLoading && generationTarget === 'video' ? <Loader /> : <><VideoIcon /><span className="hidden sm:inline ml-1.5">新视频</span></>}
                    </button>
                    <div className="w-px h-5 bg-slate-600"></div>
                    <button onClick={() => handleGenerate(searchQuery, 'image')} disabled={isLoading} className="px-3 sm:px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700/60 transition-colors flex items-center gap-1.5 disabled:cursor-not-allowed disabled:bg-slate-700/30 disabled:text-slate-500">
                        {isLoading && generationTarget === 'image' ? <Loader /> : <><ImageIcon /><span className="hidden sm:inline ml-1.5">新图片</span></>}
                    </button>
                </div>
                {isLoading && (
                    <button 
                        onClick={cancelGeneration} 
                        className="p-2.5 px-4 bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 border border-red-500/30 rounded-full transition-all flex items-center justify-center font-bold text-sm"
                        title="停止生成"
                    >
                        停止
                    </button>
                )}
            </div>
        );


        return (
            <div className="fixed bottom-6 right-6 z-30 p-1.5 sm:p-2 bg-slate-900/85 backdrop-blur-xl rounded-full shadow-2xl border border-slate-700/60 flex items-center gap-1.5 sm:gap-2 animate-fade-in-down w-max max-w-[calc(100vw-3rem)] overflow-hidden">
                {previousResultState && (
                    <button 
                        onClick={handleUndo} 
                        className="p-2.5 sm:p-3 text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/90 rounded-full transition-all duration-300 active:scale-90 flex-shrink-0" 
                        aria-label="撤销" 
                        title="撤销"
                    >
                        <UndoIcon />
                    </button>
                )}

                <button 
                    onClick={returnToHome} 
                    className="p-2.5 sm:p-3 text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/90 rounded-full transition-all duration-300 active:scale-90 flex-shrink-0" 
                    aria-label="返回主页" 
                    title="返回主页"
                >
                    <HomeIcon />
                </button>

                <div className="flex-shrink min-w-0">
                    {isShowingSearchResults ? singleActionButton : (bothMediaEnabled ? splitMediaButtons : singleActionButton)}
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in">
            {/* Toolbar Wrapper to prevent layout shift */}
            <div className="min-h-[88px]">
                {isGenerated && resultType === 'websites' && websites.length > 0 && (
                    <Toolbar
                        viewMode={viewMode}
                        onViewChange={setViewMode}
                        onBatchFavorite={handleBatchFavoriteClick}
                        onExportCSV={handleExportCSVClick}
                        selectedCount={selectedWebsiteUrls.size}
                    />
                )}
            </div>
            
            {/* Unified Results Grid */}
            <div className="grid min-h-[50vh]">
                 {/* Websites */}
                <div
                    className="col-start-1 row-start-1 transition-opacity duration-500 ease-in-out"
                    style={{
                        opacity: (isGenerated && resultType === 'websites' && websites.length > 0) ? 1 : 0,
                        pointerEvents: (isGenerated && resultType === 'websites' && websites.length > 0) ? 'auto' : 'none',
                    }}
                >
                    <div className="mb-12">
                        {viewMode === 'card' ? (
                            <>
                                <h2 className="text-2xl font-bold text-slate-300 border-b-2 border-slate-700 pb-2 mb-6">当前批次</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                                    {websites.map((site, index) => (
                                        <WebsiteCard
                                            key={`${site.url}-${index}`}
                                            site={site}
                                            className="card-entry"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        />
                                    ))}
                                </div>
                            </>
                        ) : (
                            <DataTableView
                                websites={websites}
                                selectedUrls={selectedWebsiteUrls}
                                onSelectionChange={handleSelectionChange}
                                onSelectAll={handleSelectAll}
                            />
                        )}
                    </div>
                </div>

                {/* Video */}
                <div 
                    className="col-start-1 row-start-1 transition-opacity duration-500 ease-in-out"
                    style={{
                        opacity: (isGenerated && resultType === 'video' && videoResult) ? 1 : 0,
                        pointerEvents: (isGenerated && resultType === 'video' && videoResult) ? 'auto' : 'none',
                    }}
                >
                    {videoResult && <Suspense fallback={<Loader />}><VideoResultsGrid results={videoResult} /></Suspense>}
                </div>

                {/* Image */}
                <div 
                    className="col-start-1 row-start-1 transition-opacity duration-500 ease-in-out"
                    style={{
                        opacity: (isGenerated && resultType === 'image' && imageResult) ? 1 : 0,
                        pointerEvents: (isGenerated && resultType === 'image' && imageResult) ? 'auto' : 'none',
                    }}
                >
                    {imageResult && <Suspense fallback={<Loader />}><ImageResultsGrid results={imageResult} /></Suspense>}
                </div>

                {/* Grounded Search */}
                <div
                    className="col-start-1 row-start-1 transition-opacity duration-500 ease-in-out"
                    style={{
                        opacity: (isGenerated && resultType === 'grounded' && groundedResult) ? 1 : 0,
                        pointerEvents: (isGenerated && resultType === 'grounded' && groundedResult) ? 'auto' : 'none',
                    }}
                >
                     {groundedResult && <GroundedSearchResultDisplay result={groundedResult} />}
                </div>
            </div>

            {renderAgainGenerator()}

            {favorites.length > 0 && (
                <div className="mb-12">
                    <h2 className="text-2xl font-bold text-slate-300 border-b-2 border-slate-700 pb-2 mb-6 flex items-center">
                        <StarIcon filled={true} /> <span className="ml-3">我的收藏</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                        {favorites.map((site, index) => (
                            <WebsiteCard key={`fav-${site.url}-${index}`} site={site} isFavorite={true} className="card-entry" style={{ animationDelay: `${index * 50}ms` }} />
                        ))}
                    </div>
                </div>
            )}
            
            {allGeneratedWebsites.length > 0 && (
                <div className="mt-12 border-t-2 border-slate-800 pt-8">
                    <button onClick={() => setIsHistoryVisible(p => !p)} className="w-full text-left text-xl font-bold text-slate-300 hover:text-[var(--theme-color)] flex items-center justify-between transition-colors duration-200 p-2 rounded-lg" aria-expanded={isHistoryVisible}>
                        <div className="flex items-center"> <HistoryIcon /> <span className="ml-3">浏览历史</span> </div>
                        <ChevronDownIcon className={`transition-transform duration-300 ${isHistoryVisible ? 'rotate-180' : ''}`} />
                    </button>
                    {isHistoryVisible && (
                        <div className="mt-4 bg-slate-800/30 backdrop-blur-md border border-slate-700/50 p-4 rounded-lg max-h-96 overflow-y-auto">
                            <ul className="space-y-2">
                                {allGeneratedWebsites.map((site, index) => {
                                    const isVisited = visitedUrls.has(site.url);
                                    return (
                                        <li key={`hist-${site.url}-${index}`} className="flex justify-between items-center text-slate-400 hover:bg-slate-700/50 p-2 rounded-md transition-colors duration-200">
                                            <span className={`font-medium ${isVisited ? 'text-slate-500' : 'text-slate-300'}`}>{site.name}</span>
                                            <a href={site.url} target="_blank" rel="noopener noreferrer" onClick={() => handleMarkAsVisited(site.url)} className={`text-sm truncate ml-4 ${isVisited ? 'text-slate-600' : 'text-[var(--theme-color)] hover:underline'}`} >
                                                {site.url}
                                            </a>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResultsView;