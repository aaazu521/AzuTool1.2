import React, { useContext, useEffect, Suspense, lazy, useState } from 'react';

// Contexts
import { UIContext } from './contexts/UIContext';
import { DataContext } from './contexts/DataContext';
import { SettingsContext } from './contexts/SettingsContext';

// Components
import { Loader } from './components/Loader';
import { Header } from './components/Header';
import { RefreshIcon, SearchIcon, VideoIcon, ImageIcon, SparklesIcon, MusicIcon } from './components/Icons';
import { ClickParticles } from './components/ClickParticles';
import SakuraEffect from './components/SakuraEffect';
import SettingsPanel from './components/SettingsPanel';
import CustomBgPanel from './components/panels/CustomBgPanel';
import QBindModal from './components/modals/QBindModal';
import VideoParserModal from './components/modals/VideoParserModal';
import Toast from './components/Toast';

// Hooks
import { useAnimatedVisibility } from './hooks/useAnimatedVisibility';

// Utils
import { isColorLight } from './utils/colorUtils';

// Lazy-loaded Components
const AnalysisModal = lazy(() => import('./components/modals/AnalysisModal'));
const EasterEggModal = lazy(() => import('./components/modals/EasterEggModal'));
const MusicModal = lazy(() => import('./components/modals/MusicModal'));
const ResultsView = lazy(() => import('./components/ResultsView'));


// =================================================================
// Main Content Component
// =================================================================
const MainContent: React.FC = () => {
    const { settings } = useContext(SettingsContext);

    const {
        isGenerated,
        isLoading,
        error,
        generationTarget,
        handleGenerate,
        cancelGeneration,
        favorites,
        searchQuery,
        setSearchQuery
    } = useContext(DataContext);

    const { 
        setIsVideoParserModalOpen, 
        setIsQBindModalOpen,
        setIsMusicModalOpen
    } = useContext(UIContext);

    const [isMediaSelectionVisible, setIsMediaSelectionVisible] = useState(false);

    const isThemeLight = isColorLight(settings.themeColor);
    const dynamicButtonTextColor = isThemeLight ? 'text-slate-900' : 'text-white';
    const baseButtonClasses = `relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white font-sans group backdrop-blur-md border-2 border-slate-700/80 bg-slate-800/50 rounded-2xl shadow-lg transition-all duration-300 hover:border-[var(--theme-color)]/70 hover:bg-slate-800/80 hover:shadow-2xl hover:shadow-[var(--theme-color)]/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-[var(--theme-color)] active:scale-95 disabled:bg-slate-800/20 disabled:border-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none`;
    
    const isSearchMode = settings.moreSearchesEnabled || settings.omniSearchEnabled;
    const isMediaGenerationMode = settings.videoGenerationEnabled || settings.imageGenerationEnabled;
    const bothMediaEnabled = settings.videoGenerationEnabled && settings.imageGenerationEnabled;

    // --- Button Content Logic for single button mode ---
    let actionButtonText = '发现全球公司网站';
    let actionButtonIcon: React.ReactNode = <RefreshIcon />;

    if (settings.customRefreshIconUrl && !isMediaGenerationMode) {
        actionButtonIcon = <img src={settings.customRefreshIconUrl} alt="Custom Refresh Icon" className="h-6 w-6 transform group-hover:rotate-180 transition-transform duration-300" />;
    }

    if (settings.videoGenerationEnabled) {
        actionButtonText = '生成视频';
        actionButtonIcon = <VideoIcon />;
    } else if (settings.imageGenerationEnabled) {
        actionButtonText = '生成图片';
        actionButtonIcon = <ImageIcon />;
    }
    
    const renderInitialGenerator = () => {
        if (isGenerated) return null;

        return (
            <div className="flex flex-col items-center justify-center gap-4 my-8 px-4 sm:px-0">
                {!isMediaSelectionVisible ? (
                    <div className="flex items-center">
                        <button onClick={() => setIsMediaSelectionVisible(true)} className={baseButtonClasses}>
                            <SparklesIcon /><span className="ml-2">开始使用</span>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-down">
                        <button
                            onClick={() => setIsVideoParserModalOpen(true)}
                            className={baseButtonClasses}
                        >
                            <VideoIcon /><span className="ml-2">视频解析</span>
                        </button>
                        <button
                            onClick={() => setIsMusicModalOpen(true)}
                            className={baseButtonClasses}
                        >
                            <MusicIcon /><span className="ml-2">音乐解析</span>
                        </button>
                        <button
                            onClick={() => setIsQBindModalOpen(true)}
                            className={baseButtonClasses}
                        >
                            <SearchIcon /><span className="ml-2">Q绑查询</span>
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderFloatingMediaButtons = () => {
        if (isGenerated || !isMediaGenerationMode) return null;

        const stopButton = isLoading ? (
            <button 
                onClick={cancelGeneration} 
                className="p-2.5 px-4 bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 border border-red-500/30 rounded-full transition-all flex items-center justify-center font-bold text-sm"
                title="停止生成"
            >
                停止
            </button>
        ) : null;

        return (
            <div className="fixed bottom-6 right-6 z-30 p-1.5 sm:p-2 bg-slate-900/85 backdrop-blur-xl rounded-full shadow-2xl border border-slate-700/60 flex items-center gap-1.5 sm:gap-2 animate-fade-in-down w-max max-w-[calc(100vw-3rem)] overflow-hidden">
                <div className="flex items-center bg-slate-800/80 backdrop-blur-sm border border-slate-700/80 rounded-full shadow-lg overflow-hidden">
                    {settings.videoGenerationEnabled && (
                        <button onClick={() => handleGenerate('', 'video')} disabled={isLoading} className="px-3 sm:px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700/60 transition-colors flex items-center gap-1.5 disabled:cursor-not-allowed disabled:bg-slate-700/30 disabled:text-slate-500">
                            {isLoading && generationTarget === 'video' ? <Loader /> : <><VideoIcon /><span className="hidden sm:inline ml-1.5">生成视频</span></>}
                        </button>
                    )}
                    {settings.videoGenerationEnabled && settings.imageGenerationEnabled && (
                        <div className="w-px h-5 bg-slate-600"></div>
                    )}
                    {settings.imageGenerationEnabled && (
                        <button onClick={() => handleGenerate('', 'image')} disabled={isLoading} className="px-3 sm:px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700/60 transition-colors flex items-center gap-1.5 disabled:cursor-not-allowed disabled:bg-slate-700/30 disabled:text-slate-500">
                            {isLoading && generationTarget === 'image' ? <Loader /> : <><ImageIcon /><span className="hidden sm:inline ml-1.5">生成图片</span></>}
                        </button>
                    )}
                </div>
                {stopButton}
            </div>
        );
    };

    return (
        <div className="w-full max-w-7xl mx-auto pb-safe pb-28 sm:pb-32">
            <Header />

            {isSearchMode && !isGenerated && (
                <div className="my-6 max-w-2xl mx-auto animate-fade-in-down">
                    <div className="flex items-center gap-2 p-1.5 bg-slate-900/70 border border-slate-600 rounded-xl focus-within:ring-2 focus-within:ring-[var(--theme-color)] transition-shadow">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery.trim()) handleGenerate(searchQuery); }}
                            placeholder="更好的搜索网站官网，移除无用广告"
                            className="w-full bg-transparent px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none transition font-sans text-lg"
                        />
                        <button
                            onClick={() => handleGenerate(searchQuery)}
                            disabled={isLoading || !searchQuery.trim()}
                            className={`flex-shrink-0 inline-flex items-center justify-center px-4 sm:px-5 py-2.5 text-sm font-bold ${dynamicButtonTextColor} bg-[var(--theme-color)] rounded-lg hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-[var(--theme-color)] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed disabled:brightness-100`}
                            aria-label="搜索"
                        >
                            <SearchIcon />
                            <span className="hidden sm:inline ml-2">搜索</span>
                        </button>
                    </div>
                </div>
            )}
            
            {renderInitialGenerator()}

            {error && (
                <div className="text-center bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative my-6" role="alert">
                    <strong className="font-bold">发生错误!</strong>
                    <span className="block sm:inline ml-2">{error}</span>
                </div>
            )}
            
            {isGenerated && (
                <Suspense fallback={<div className="flex justify-center items-center min-h-[50vh]"><Loader /></div>}>
                    <ResultsView />
                </Suspense>
            )}

            {!isGenerated && !isLoading && !favorites.length && !isSearchMode && !isMediaGenerationMode && (
                <div className="text-center text-slate-500 mt-12"> <p>点击按钮开始发现全球优秀公司网站。</p> </div>
            )}

            {isSearchMode && !isGenerated && !isLoading && !isMediaGenerationMode && (
                <div className="text-center text-slate-500 mt-12 animate-fade-in-down">
                    <p className="font-sans">更好的搜索出你想要的官网，如果加载失败可能需要配合魔法上网。</p>
                </div>
            )}

            {renderFloatingMediaButtons()}
        </div>
    );
};


// =================================================================
// Main Application Component
// =================================================================
const App: React.FC = () => {
    const { settings, showEasterEggModal, setShowEasterEggModal } = useContext(SettingsContext);
    const {
        toastMessage,
        setToastMessage,
        isSettingsOpen,
        isCustomBgPanelOpen,
        isQBindModalOpen,
        isMusicModalOpen,
        setIsMusicModalOpen,
        isVideoParserModalOpen,
        setIsVideoParserModalOpen,
        selectedAnalysis,
        setSelectedAnalysis,
        fileInputRef,
        handleFileChange,
        setIsCustomBgPanelOpen
    } = useContext(UIContext);

    // --- UI STATE ---
    const isSettingsPanelRendered = useAnimatedVisibility(isSettingsOpen);
    const isCustomBgPanelRendered = useAnimatedVisibility(isCustomBgPanelOpen);
    const isQBindModalRendered = useAnimatedVisibility(isQBindModalOpen);
    const isVideoParserModalRendered = useAnimatedVisibility(isVideoParserModalOpen);
    const isMusicModalRendered = useAnimatedVisibility(isMusicModalOpen);
    const isAnalysisModalRendered = useAnimatedVisibility(!!selectedAnalysis);

    // --- DERIVED STATE & EFFECTS ---
    useEffect(() => {
        document.documentElement.style.setProperty('--theme-color', settings.themeColor);
    }, [settings.themeColor]);

    return (
        <div className="relative z-10 min-h-[100dvh] text-slate-100 font-pixel flex flex-col items-center p-4 sm:p-6 lg:p-8">
            {settings.sakuraEffectEnabled && <SakuraEffect />}
            <ClickParticles />
            {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}

            {isSettingsPanelRendered && <SettingsPanel />}
            {isCustomBgPanelRendered && <CustomBgPanel />}
            {isQBindModalRendered && <QBindModal />}
            {isVideoParserModalRendered && <VideoParserModal isOpen={isVideoParserModalOpen} onClose={() => setIsVideoParserModalOpen(false)} />}

            <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"><Loader /></div>}>
                {isMusicModalRendered && <MusicModal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} />}

                <input type="file" ref={fileInputRef} onChange={(e) => { handleFileChange(e); setIsCustomBgPanelOpen(false); }} accept="image/*" className="hidden" />

                {isAnalysisModalRendered && selectedAnalysis?.analysis && (
                    <AnalysisModal
                        isOpen={!!selectedAnalysis}
                        website={selectedAnalysis}
                        onClose={() => setSelectedAnalysis(null)}
                    />
                )}

                {showEasterEggModal && <EasterEggModal onClose={() => setShowEasterEggModal(false)} themeColor={settings.themeColor} />}
            </Suspense>

            <MainContent />
        </div>
    );
};

export default App;