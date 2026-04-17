import React, { createContext, useState, useCallback, useContext } from 'react';
import { useBackground } from '../hooks/useBackground';
import { SettingsContext } from './SettingsContext';
import type { Website } from '../types';

interface UIContextType {
    // Toast
    toastMessage: string;
    showToast: (message: string) => void;
    setToastMessage: React.Dispatch<React.SetStateAction<string>>;
    
    // UI State
    isSettingsOpen: boolean;
    setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isCustomBgPanelOpen: boolean;
    setIsCustomBgPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isQBindModalOpen: boolean;
    setIsQBindModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isMusicModalOpen: boolean;
    setIsMusicModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isVideoParserModalOpen: boolean;
    setIsVideoParserModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    selectedAnalysis: Website | null;
    setSelectedAnalysis: React.Dispatch<React.SetStateAction<Website | null>>;

    // Background
    customBgUrl: string;
    customBgInput: string;
    setCustomBgInput: React.Dispatch<React.SetStateAction<string>>;
    isDraggingOver: boolean;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleSetCustomBg: () => void;
    handleClearCustomBg: () => void;
    handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    handleUploadClick: () => void;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleExtractColor: () => Promise<void>;
    resetBackground: () => void;
}

export const UIContext = createContext<UIContextType>(null!);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { settings, setSettings } = useContext(SettingsContext);
    const [toastMessage, setToastMessage] = useState<string>('');
    const showToast = useCallback((message: string) => setToastMessage(message), []);
    
    const { customBgUrl, customBgInput, setCustomBgInput, isDraggingOver, fileInputRef, handleSetCustomBg, handleClearCustomBg, handleDragOver, handleDragLeave, handleDrop, handleUploadClick, handleFileChange, handleExtractColor, resetBackground } = useBackground(settings, setSettings, showToast);
    
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isCustomBgPanelOpen, setIsCustomBgPanelOpen] = useState(false);
    const [isQBindModalOpen, setIsQBindModalOpen] = useState(false);
    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
    const [isVideoParserModalOpen, setIsVideoParserModalOpen] = useState(false);
    const [selectedAnalysis, setSelectedAnalysis] = useState<Website | null>(null);

    const value = {
        toastMessage,
        setToastMessage,
        showToast,
        isSettingsOpen,
        setIsSettingsOpen,
        isCustomBgPanelOpen,
        setIsCustomBgPanelOpen,
        isQBindModalOpen,
        setIsQBindModalOpen,
        isMusicModalOpen,
        setIsMusicModalOpen,
        isVideoParserModalOpen,
        setIsVideoParserModalOpen,
        selectedAnalysis,
        setSelectedAnalysis,
        customBgUrl,
        customBgInput,
        setCustomBgInput,
        isDraggingOver,
        fileInputRef,
        handleSetCustomBg,
        handleClearCustomBg,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleUploadClick,
        handleFileChange,
        handleExtractColor,
        resetBackground,
    };

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}