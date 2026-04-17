import React, { createContext } from 'react';
import { useSettings } from '../hooks/useSettings';
import type { AppSettings } from '../types';

interface SettingsContextType {
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    showEasterEggModal: boolean;
    setShowEasterEggModal: React.Dispatch<React.SetStateAction<boolean>>;
    handleIconClick: () => void;
    resetSettings: () => void;
}

export const SettingsContext = createContext<SettingsContextType>(null!);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { settings, setSettings, showEasterEggModal, setShowEasterEggModal, handleIconClick, resetSettings } = useSettings();
    
    const value = {
        settings,
        setSettings,
        showEasterEggModal,
        setShowEasterEggModal,
        handleIconClick,
        resetSettings,
    };

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};