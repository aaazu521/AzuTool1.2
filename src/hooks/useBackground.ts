import React, { useState, useCallback, useEffect, useRef } from 'react';
import useLocalStorage from './useLocalStorage';
import { getDominantColor } from '../utils/colorExtractor';
import type { AppSettings } from '../types';

const CUSTOM_BG_URL_KEY = 'pump_app_custom_bg_url';

export const useBackground = (
  settings: AppSettings, 
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>,
  showToast: (message: string) => void
  ) => {
  const [customBgUrl, setCustomBgUrl] = useLocalStorage<string>(CUSTOM_BG_URL_KEY, '');
  const [customBgInput, setCustomBgInput] = useState(customBgUrl.startsWith('data:image') ? '' : customBgUrl);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const bgContainer = document.getElementById('background-container');
    const bgOverlay = document.getElementById('background-overlay');
    if (bgContainer) {
      ['bg-1', 'bg-2', 'bg-3', 'bg-4', 'default-bg-responsive'].forEach(opt => bgContainer.classList.remove(opt));
      bgContainer.style.backgroundImage = '';
      if (customBgUrl) {
        bgContainer.style.backgroundImage = `url('${customBgUrl}')`;
      } else {
        bgContainer.classList.add('default-bg-responsive');
      }
      bgContainer.style.filter = `blur(${settings.blur}px)`;
    }
    if (bgOverlay) {
      bgOverlay.style.opacity = String(settings.opacity);
    }
  }, [customBgUrl, settings.blur, settings.opacity]);
  
  const handleSetCustomBg = useCallback(() => {
    if (customBgInput) {
      setCustomBgUrl(customBgInput);
    }
  }, [customBgInput, setCustomBgUrl]);

  const handleClearCustomBg = useCallback(() => {
    setCustomBgUrl('');
    setCustomBgInput('');
  }, [setCustomBgUrl]);

  const processImageFile = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        if (loadEvent.target?.result) {
          const result = loadEvent.target.result as string;
          setCustomBgUrl(result);
          setCustomBgInput('');
        }
      };
      reader.readAsDataURL(file);
    }
  }, [setCustomBgUrl]);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDraggingOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDraggingOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processImageFile(file);
  }, [processImageFile]);
  
  const handleUploadClick = useCallback(() => fileInputRef.current?.click(), []);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  }, [processImageFile]);

  const handleExtractColor = useCallback(async () => {
    if (!customBgUrl) return;
    try {
      const color = await getDominantColor(customBgUrl);
      setSettings(s => ({...s, themeColor: color}));
      showToast("主题颜色已同步。");
    } catch (error) {
      console.error("Error extracting color:", error);
      showToast("无法提取主题颜色。");
    }
  }, [customBgUrl, setSettings, showToast]);


  return {
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
    resetBackground: handleClearCustomBg,
  };
};