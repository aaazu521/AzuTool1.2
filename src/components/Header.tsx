import React, { memo, useContext } from 'react';
import { UIContext } from '../contexts/UIContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { VipIcon, PaletteIcon, SettingsIcon, SearchIcon, VideoIcon } from './Icons';

export const Header: React.FC = memo(() => {
  const { 
    setIsCustomBgPanelOpen, 
    setIsSettingsOpen, 
    setIsQBindModalOpen,
    setIsVideoParserModalOpen
  } = useContext(UIContext);
  
  const { 
    handleIconClick, 
    settings 
  } = useContext(SettingsContext);


  return (
    <header className="relative text-center pt-20 pb-8 sm:py-8">
      <div className="flex flex-col sm:flex-row items-center justify-center sm:gap-x-3">
        <h1 
          className={`text-3xl sm:text-5xl lg:text-6xl font-anime ${settings.easterEggUnlocked ? 'text-title-cool' : ''}`}
          style={{ color: 'var(--theme-color)' }}
        >
          AzuTool
        </h1>
        <div className="mt-2 sm:mt-0 flex items-center gap-1.5 text-slate-400 sm:self-end sm:pb-2">
          <button onClick={handleIconClick} aria-label="开发者信息图标" className="group">
            <VipIcon unlocked={settings.easterEggUnlocked} />
          </button>
          <span className={`text-xs font-medium tracking-wider whitespace-nowrap ${settings.easterEggUnlocked ? 'text-vip-animated-gradient' : ''}`}>开发者 阿族</span>
        </div>
      </div>
      <p 
        className={`mt-4 text-base sm:text-lg text-slate-200 max-w-2xl mx-auto font-anime ${settings.easterEggUnlocked ? 'text-cool-animated-gradient' : ''}`}
        style={!settings.easterEggUnlocked ? { textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)' } : {}}
      >
        《重生之谁敢想我居然会无聊的搞成这样》
      </p>
      <div className="absolute top-4 right-4 sm:top-8 sm:right-0 flex items-center gap-2">
        <button
          onClick={() => setIsSettingsOpen(p => !p)}
          aria-label="个性化设置"
          className="p-2 rounded-full text-slate-300 hover:text-[var(--theme-color)] hover:bg-slate-700/50 transition-all duration-300"
        >
          <SettingsIcon />
        </button>
        <button
          onClick={() => setIsCustomBgPanelOpen(p => !p)}
          aria-label="自定义背景"
          className="p-2 rounded-full text-slate-300 hover:text-[var(--theme-color)] hover:bg-slate-700/50 transition-all duration-300"
        >
          <PaletteIcon />
        </button>
      </div>
    </header>
  );
});