import { useState, useCallback, useEffect } from 'react';
import useLocalStorage from './useLocalStorage';
import type { AppSettings } from '../types';

const defaultVideoApiId = 'default-video-1';
const defaultImageApiId = 'default-image-1';

const defaultSettings: AppSettings = {
  themeColor: '#ffffff',
  blur: 0,
  opacity: 0.05,
  cardBlur: 7,
  cardOpacity: 0.1,
  moreSearchesEnabled: false,
  videoGenerationEnabled: true,
  imageGenerationEnabled: true,
  randomSearchEnabled: false,
  randomizeOrderEnabled: false,
  easterEggUnlocked: false,
  unlimitedSearchEnabled: false,
  unlimitedSearchCount: 12,
  omniSearchUnlocked: false,
  omniSearchEnabled: false,
  searchEngine: 'gemini',
  apiEngine: 'gemini-2.5-flash',
  customRefreshIconUrl: '',
  breakSafetyLimits: false,
  sakuraEffectEnabled: true,
  videoApiEndpoints: [{ id: defaultVideoApiId, name: '阿族接口', url: 'http://api.yujn.cn/api/rewu.php?type=video' }],
  imageApiEndpoints: [
    { id: defaultImageApiId, name: '阿族的二次元图片', url: 'https://moe.jitsu.top/img/' },
    { id: 'backup-image-1', name: '随机二次元(备用)', url: 'https://api.oick.cn/api/anime' }
  ],
  selectedVideoApiId: defaultVideoApiId,
  selectedImageApiId: defaultImageApiId,
  customMusicSources: [],
  hideOfficialMusicSources: false,
};

const SETTINGS_KEY = 'pump_app_settings';

export const useSettings = () => {
  const [settings, setSettings] = useLocalStorage<AppSettings>(SETTINGS_KEY, defaultSettings);
  const [iconClicks, setIconClicks] = useState(0);
  const [showEasterEggModal, setShowEasterEggModal] = useState(false);

  // Migration: Update old image/video API endpoints to new ones if present
  useEffect(() => {
    const oldImageUrl = 'https://api.dwo.cc/api/hs_img';
    const oldVideoUrl = 'https://api.dwo.cc/api/viodes';
    const currentVideoUrlWithoutType = 'http://api.yujn.cn/api/rewu.php';
    
    const hasOldImageApi = settings.imageApiEndpoints.some(api => api.url === oldImageUrl);
    const hasOldVideoApi = settings.videoApiEndpoints.some(api => api.url === oldVideoUrl || api.url === currentVideoUrlWithoutType);
    
    if (hasOldImageApi || hasOldVideoApi) {
      setSettings(prev => ({
        ...prev,
        imageApiEndpoints: prev.imageApiEndpoints.map(api => 
          api.url === oldImageUrl 
            ? { ...api, name: '阿族的二次元图片', url: 'https://moe.jitsu.top/img/' }
            : api
        ),
        videoApiEndpoints: prev.videoApiEndpoints.map(api => 
          (api.url === oldVideoUrl || api.url === currentVideoUrlWithoutType)
            ? { ...api, name: '阿族接口', url: 'http://api.yujn.cn/api/rewu.php?type=video' }
            : api
        )
      }));
    }

    // Migration: Remove problematic domains from custom music sources
    if (settings.customMusicSources && settings.customMusicSources.length > 0) {
      let sourcesUpdated = false;
      const updatedSources = settings.customMusicSources.map(source => {
        if (source.content && (source.content.includes('api.huibq.com') || source.content.includes('api.lingchuan.com'))) {
          sourcesUpdated = true;
          let newContent = source.content;
          newContent = newContent.replace(/api\.huibq\.com/g, "blocked.api");
          newContent = newContent.replace(/api\.lingchuan\.com/g, "blocked.api");
          return { ...source, content: newContent };
        }
        return source;
      });

      if (sourcesUpdated) {
        setSettings(prev => ({
          ...prev,
          customMusicSources: updatedSources
        }));
      }
    }
  }, [settings.imageApiEndpoints, settings.videoApiEndpoints, settings.customMusicSources, setSettings]);

  const handleIconClick = useCallback(() => {
    const newClicks = iconClicks + 1;
    setIconClicks(newClicks);
    if (newClicks >= 5 && !settings.easterEggUnlocked) {
      setSettings(s => ({ ...s, easterEggUnlocked: true }));
      setShowEasterEggModal(true);
      setIconClicks(0);
    }
  }, [iconClicks, settings.easterEggUnlocked, setSettings]);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, [setSettings]);

  return {
    settings,
    setSettings,
    showEasterEggModal,
    setShowEasterEggModal,
    handleIconClick,
    resetSettings,
    defaultSettings,
  };
};