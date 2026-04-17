import React, { createContext, useState, useCallback, useContext } from 'react';
import { useWebsiteGenerator } from '../hooks/useWebsiteGenerator';
import { useFavorites } from '../hooks/useFavorites';
import { useHistory } from '../hooks/useHistory';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useMediaFavorites } from '../hooks/useMediaFavorites';
import { analyzeWebsite } from '../services/geminiService';
import { SettingsContext } from './SettingsContext';
import { UIContext } from './UIContext';
import type { Website, GroundedSearchResult, WebsiteAnalysis, VideoGenerationResultItem, ImageGenerationResultItem, MediaFavorite } from '../types';

interface DisplayableMediaItem<T> {
    item: T;
    aspectRatio: string;
}

interface DataContextType {
    // Website Generator
    websites: Website[];
    allGeneratedWebsites: Website[];
    isGenerated: boolean;
    isLoading: boolean;
    error: string | null;
    groundedResult: GroundedSearchResult | null;
    videoResult: DisplayableMediaItem<VideoGenerationResultItem>[] | null;
    imageResult: DisplayableMediaItem<ImageGenerationResultItem>[] | null;
    resultType: 'websites' | 'grounded' | 'video' | 'image' | null;
    generationTarget: 'video' | 'image' | null;
    previousResultState: { 
        websites: Website[];
        groundedResult: GroundedSearchResult | null;
        videoResult: DisplayableMediaItem<VideoGenerationResultItem>[] | null;
        imageResult: DisplayableMediaItem<ImageGenerationResultItem>[] | null;
        resultType: 'websites' | 'grounded' | 'video' | 'image' | null;
    } | null;
    handleGenerate: (searchQuery: string, forceType?: 'video' | 'image') => Promise<void>;
    cancelGeneration: () => void;
    handleUndo: () => void;
    returnToHome: () => void;
    searchQuery: string;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
    resetGenerator: () => void;
    
    // Website Favorites
    favorites: Website[];
    isFavorite: (url: string) => boolean;
    handleToggleFavorite: (websiteOrWebsites: Website | Website[], isBatch?: boolean) => void;
    resetFavorites: () => void;

    // Media Favorites
    mediaFavorites: MediaFavorite[];
    isMediaFavorite: (url: string) => boolean;
    toggleMediaFavorite: (item: MediaFavorite) => void;
    resetMediaFavorites: () => void;

    // History
    visitedUrls: Set<string>;
    handleMarkAsVisited: (url: string) => void;
    resetHistory: () => void;

    // Search History
    searchHistory: string[];
    clearSearchHistory: () => void;
    
    // Analysis
    handleAnalyzeWebsite: (websiteToAnalyze: Website) => Promise<void>;
    handleViewAnalysis: (website: Website) => void;
}

export const DataContext = createContext<DataContextType>(null!);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { settings } = useContext(SettingsContext);
    const { showToast, setSelectedAnalysis } = useContext(UIContext);

    const [searchQuery, setSearchQuery] = useState('');
    const { searchHistory, addSearchTerm, clearSearchHistory } = useSearchHistory();
    const { 
        websites, setWebsites, allGeneratedWebsites, isGenerated, isLoading, error, 
        groundedResult, videoResult, imageResult, resultType, generationTarget, previousResultState, 
        handleGenerate, handleUndo, returnToHome, resetGenerator, setAllGeneratedWebsites, cancelGeneration
    } = useWebsiteGenerator(settings, addSearchTerm);
    
    const { favorites, setFavorites, isFavorite, handleToggleFavorite, handleBatchFavorite, resetFavorites } = useFavorites();
    const { mediaFavorites, toggleMediaFavorite, isMediaFavorite, resetMediaFavorites } = useMediaFavorites();
    const { visitedUrls, handleMarkAsVisited, resetHistory } = useHistory();

    const handleCombinedToggleFavorite = useCallback((websiteOrWebsites: Website | Website[], isBatch: boolean = false) => {
        if (isBatch && Array.isArray(websiteOrWebsites)) {
            handleBatchFavorite(websiteOrWebsites);
            showToast(`已收藏 ${websiteOrWebsites.length} 个项目。`);
        } else if (!isBatch && !Array.isArray(websiteOrWebsites)) {
            handleToggleFavorite(websiteOrWebsites);
        }
    }, [handleBatchFavorite, handleToggleFavorite, showToast]);
    
    const handleAnalyzeWebsite = useCallback(async (websiteToAnalyze: Website) => {
        const updateAnalyzingState = (isAnalyzing: boolean, analysisResult?: WebsiteAnalysis) => {
            const updater = (prev: Website[]) => prev.map(w =>
                w.url === websiteToAnalyze.url
                    ? { ...w, isAnalyzing, ...(analysisResult && { analysis: analysisResult }) }
                    : w
            );
            setWebsites(updater);
            setAllGeneratedWebsites(updater);
            setFavorites(updater);
        };

        updateAnalyzingState(true);

        try {
            const analysis = await analyzeWebsite(websiteToAnalyze.url, settings);
            updateAnalyzingState(false, analysis);
            setSelectedAnalysis({ ...websiteToAnalyze, analysis });
            showToast(`“${websiteToAnalyze.name}”分析完成。`);
        } catch (e) {
            showToast(e instanceof Error ? e.message : '分析失败，请稍后再试。');
            updateAnalyzingState(false);
        }
    }, [setWebsites, setAllGeneratedWebsites, setFavorites, showToast, setSelectedAnalysis, settings]);

    const handleViewAnalysis = useCallback((website: Website) => {
        setSelectedAnalysis(website);
    }, [setSelectedAnalysis]);
    
    const value = {
        websites,
        allGeneratedWebsites,
        isGenerated,
        isLoading,
        error,
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
        searchQuery,
        setSearchQuery,
        resetGenerator,
        favorites,
        isFavorite,
        handleToggleFavorite: handleCombinedToggleFavorite,
        resetFavorites,
        mediaFavorites,
        toggleMediaFavorite,
        isMediaFavorite,
        resetMediaFavorites,
        visitedUrls,
        handleMarkAsVisited,
        resetHistory,
        searchHistory,
        clearSearchHistory,
        handleAnalyzeWebsite,
        handleViewAnalysis,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}