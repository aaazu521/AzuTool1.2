import React, { memo, useState, useCallback, useEffect, useRef, useContext, useMemo } from 'react';
import type { AppSettings, ApiEndpoint, MediaFavorite } from '../types';
import { SettingsContext } from '../contexts/SettingsContext';
import { UIContext } from '../contexts/UIContext';
import { DataContext } from '../contexts/DataContext';
import { ColorDropperIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon, CommandLineIcon, TrashIcon, RefreshIcon, UploadIcon, SearchHistoryIcon, ClipboardDocumentListIcon, VideoIcon, ImageIcon, BookmarkIcon, StarIcon, DownloadIcon, HomeIcon, SparklesIcon } from './Icons';
import { isColorLight } from '../utils/colorUtils';
import MediaViewerModal from './modals/MediaViewerModal';
import { downloadMedia } from '../utils/csvExporter';

type View = 'main' | 'personalization' | 'moreSearches' | 'hiddenFeatures' | 'unlimitedSearch' | 'omniSearch' | 'debug' | 'searchHistory' | 'apiSettings' | 'mediaFavorites';

const SubViewHeader = ({ title, onBack, onHome }: { title: string; onBack: () => void; onHome: () => void; }) => (
    <div className="sticky top-[-24px] z-10 bg-slate-800/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-2 mb-4">
        <div className="relative flex items-center justify-center">
            <div className="absolute left-0 flex items-center">
                 <button onClick={onHome} className="p-2 -ml-2 mr-1 rounded-full hover:bg-slate-700/50 text-slate-300 hover:text-white transition-colors" aria-label="返回主菜单">
                    <HomeIcon />
                </button>
                <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-700/50 text-slate-300 hover:text-white transition-colors" aria-label="返回">
                    <ChevronLeftIcon />
                </button>
            </div>
            <h2 className="text-2xl font-bold text-white font-sans">{title}</h2>
        </div>
    </div>
);

// A new, more robust component to replace the simple range input
const SettingSlider = ({ label, id, value, onChange, min, max, step, displaySuffix = '' }) => {
    const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(Number(e.target.value));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numValue = e.target.value === '' ? min : parseFloat(e.target.value);
        if (!isNaN(numValue)) {
            const clampedValue = Math.max(min, Math.min(max, numValue));
            onChange(clampedValue);
        }
    };
    
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const numValue = parseFloat(e.target.value);
        if (isNaN(numValue) || numValue < min) {
            onChange(min);
        } else if (numValue > max) {
            onChange(max);
        }
    };

    const stepUp = () => {
        let newValue = parseFloat((value + step).toPrecision(15));
        onChange(Math.min(max, newValue));
    };

    const stepDown = () => {
        let newValue = parseFloat((value - step).toPrecision(15));
        onChange(Math.max(min, newValue));
    };
    
    const displayValue = Number.isInteger(step) ? value : value.toFixed(2);

    return (
        <div>
            <label htmlFor={id} className="block font-medium text-slate-300 mb-2 font-sans">
                {label}: <span className="font-bold text-white">{displayValue}{displaySuffix}</span>
            </label>
            <div className="flex items-center gap-3 text-white">
                <button onClick={stepDown} className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-xl bg-slate-700/50 rounded-md hover:bg-slate-600/50 transition-colors" aria-label={`Decrease ${label}`}>-</button>
                <input
                    type="range"
                    id={id}
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleRangeChange}
                    className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--theme-color)]"
                />
                <button onClick={stepUp} className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-xl bg-slate-700/50 rounded-md hover:bg-slate-600/50 transition-colors" aria-label={`Increase ${label}`}>+</button>
                <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className="w-20 bg-slate-900/70 border border-slate-600 rounded-md px-2 py-1.5 text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-sans"
                    aria-label={label}
                />
            </div>
        </div>
    );
};

const ToggleSwitch = ({ checked, onChange, id }) => (
  <label htmlFor={id} className="relative inline-flex items-center cursor-pointer group">
    <input 
      type="checkbox" 
      id={id} 
      className="sr-only peer"
      checked={checked}
      onChange={onChange}
    />
    <div className="w-11 h-6 bg-slate-300 rounded-full peer-checked:bg-[var(--theme-color)] transition-colors duration-300 ease-in-out group-focus-visible:ring-2 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-slate-800 group-focus-visible:ring-white"></div>
    <div className="absolute top-0.5 left-[2px] h-5 w-5 bg-white rounded-full transition-all duration-300 ease-in-out peer-checked:translate-x-full shadow-lg ring-1 ring-black/5"></div>
  </label>
);

const MainView = memo(({ onNavClick, easterEggUnlocked, isSearchEnabled }: { onNavClick: (view: View) => void, easterEggUnlocked: boolean, isSearchEnabled: boolean }) => (
    <>
      <h2 className="text-2xl font-bold text-white mb-6 font-sans">设置</h2>
      <div className="space-y-2 text-white">
        <button 
          onClick={() => onNavClick('personalization')} 
          className="w-full flex justify-between items-center p-4 rounded-lg hover:bg-slate-700/50 transition-colors text-left font-sans"
        >
          <span>个性化设置</span>
          <ChevronRightIcon />
        </button>
        <button 
          onClick={() => onNavClick('moreSearches')} 
          className="w-full flex justify-between items-center p-4 rounded-lg hover:bg-slate-700/50 transition-colors text-left font-sans"
        >
          <span>更多搜索</span>
          <ChevronRightIcon />
        </button>
        <button
          onClick={() => onNavClick('apiSettings')}
          className="w-full flex justify-between items-center p-4 rounded-lg hover:bg-slate-700/50 transition-colors text-left font-sans"
        >
          <span>API 设置</span>
          <ChevronRightIcon />
        </button>
         <button 
            onClick={() => onNavClick('mediaFavorites')} 
            className="w-full flex justify-between items-center p-4 rounded-lg hover:bg-slate-700/50 transition-colors text-left font-sans"
          >
            <span className="flex items-center"><BookmarkIcon /> <span className="ml-3">媒体收藏夹</span></span>
            <ChevronRightIcon />
        </button>
         {isSearchEnabled && (
          <button 
            onClick={() => onNavClick('searchHistory')} 
            className="w-full flex justify-between items-center p-4 rounded-lg hover:bg-slate-700/50 transition-colors text-left font-sans"
          >
            <span className="flex items-center"><SearchHistoryIcon /> <span className="ml-3">搜索记录</span></span>
            <ChevronRightIcon />
          </button>
        )}
        {easterEggUnlocked && (
           <button 
             onClick={() => onNavClick('hiddenFeatures')} 
             className="w-full flex justify-between items-center p-4 rounded-lg hover:bg-slate-700/50 transition-colors text-left font-sans"
           >
             <span className="text-[var(--theme-color)]">🌟 隐藏功能</span>
             <ChevronRightIcon />
           </button>
        )}
        <button 
            onClick={() => onNavClick('debug')} 
            className="w-full flex justify-between items-center p-4 rounded-lg hover:bg-slate-700/50 transition-colors text-left font-sans"
        >
            <span className="flex items-center"><CommandLineIcon className="mr-3 text-slate-400" /> <span>调试功能</span></span>
            <ChevronRightIcon />
        </button>
      </div>
    </>
));

const PersonalizationView = memo(({ onBack, onHome, localSettings, handleSettingChange }) => {
  const { handleExtractColor, customBgUrl } = useContext(UIContext);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const handleIconUploadClick = () => {
    iconInputRef.current?.click();
  };

  const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 64; 
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            const hRatio = canvas.width / img.width;
            const vRatio = canvas.height / img.height;
            const ratio = Math.min(hRatio, vRatio);
            const newWidth = img.width * ratio;
            const newHeight = img.height * ratio;
            const centerShiftX = (canvas.width - newWidth) / 2;
            const centerShiftY = (canvas.height - newHeight) / 2;
            ctx.clearRect(0, 0, size, size);
            ctx.drawImage(img, centerShiftX, centerShiftY, newWidth, newHeight);
            const dataUrl = canvas.toDataURL('image/png');
            handleSettingChange('customRefreshIconUrl', dataUrl);
          }
        };
        img.src = loadEvent.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };
  
  const resetCustomIcon = () => {
      handleSettingChange('customRefreshIconUrl', '');
  };

  return (
    <>
        <SubViewHeader title="个性化设置" onBack={onBack} onHome={onHome} />
        <div className="space-y-6 text-sm">
            <div className="space-y-4">
                <h3 className="font-bold text-slate-300 tracking-wide font-sans">主题与背景</h3>
                <div>
                <label htmlFor="themeColor" className="block font-medium text-slate-300 mb-2 font-sans">
                    主题颜色
                </label>
                <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10">
                    <input
                        type="color"
                        id="themeColor"
                        value={localSettings.themeColor}
                        onChange={(e) => handleSettingChange('themeColor', e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label="颜色选择器"
                    />
                    <div 
                        className="w-full h-full rounded-full border-2 border-slate-600"
                        style={{ backgroundColor: localSettings.themeColor }}
                    ></div>
                    </div>
                    <button
                    onClick={handleExtractColor}
                    disabled={!customBgUrl}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-slate-600/50 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700 font-sans"
                    title={customBgUrl ? "从当前背景图中提取主色调" : "此功能仅在设置自定义图片背景后可用"}
                    >
                    <ColorDropperIcon />
                    <span>同步背景颜色</span>
                    </button>
                </div>
                </div>
                <SettingSlider
                id="bgBlur"
                label="背景模糊度"
                value={localSettings.blur}
                onChange={(v) => handleSettingChange('blur', v)}
                min={0}
                max={32}
                step={1}
                displaySuffix="px"
                />
                <SettingSlider
                id="bgOpacity"
                label="背景蒙版不透明度"
                value={Math.round(localSettings.opacity * 100)}
                onChange={(v) => handleSettingChange('opacity', v / 100)}
                min={0}
                max={100}
                step={1}
                displaySuffix="%"
                />
                <div className="flex items-center justify-between pt-2">
                    <label htmlFor="sakura-effect-toggle" className="font-medium text-slate-300 font-sans">
                        樱花飘落特效
                    </label>
                    <ToggleSwitch 
                        id="sakura-effect-toggle"
                        checked={localSettings.sakuraEffectEnabled}
                        onChange={(e) => handleSettingChange('sakuraEffectEnabled', e.target.checked)}
                    />
                </div>
            </div>
            
            <div className="border-t border-slate-700/50"></div>

            <div className="space-y-4">
                <h3 className="font-bold text-slate-300 tracking-wide font-sans">卡片外观 (毛玻璃)</h3>
                <SettingSlider
                    id="cardBlur"
                    label="卡片模糊度"
                    value={localSettings.cardBlur}
                    onChange={(v) => handleSettingChange('cardBlur', v)}
                    min={0}
                    max={32}
                    step={1}
                    displaySuffix="px"
                />
                <SettingSlider
                    id="cardOpacity"
                    label="卡片背景不透明度"
                    value={Math.round(localSettings.cardOpacity * 100)}
                    onChange={(v) => handleSettingChange('cardOpacity', v / 100)}
                    min={0}
                    max={100}
                    step={1}
                    displaySuffix="%"
                />
            </div>

            <div className="border-t border-slate-700/50"></div>

            <div className="space-y-4">
                <h3 className="font-bold text-slate-300 tracking-wide font-sans">图标自定义</h3>
                <div>
                    <label className="block font-medium text-slate-300 mb-2 font-sans">
                    “换一批”按钮图标
                    </label>
                    <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-slate-700/50 rounded-md">
                        {localSettings.customRefreshIconUrl ? (
                        <img src={localSettings.customRefreshIconUrl} alt="Custom Icon Preview" className="h-6 w-6 object-contain" />
                        ) : (
                        <RefreshIcon />
                        )}
                    </div>
                    <input type="file" ref={iconInputRef} onChange={handleIconFileChange} accept="image/*" className="hidden" />
                    <button
                        onClick={handleIconUploadClick}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-slate-600/50 rounded-lg hover:bg-slate-600 transition-colors font-sans"
                    >
                        <UploadIcon className="h-5 w-5" />
                        <span>上传</span>
                    </button>
                    <button
                        onClick={resetCustomIcon}
                        disabled={!localSettings.customRefreshIconUrl}
                        className="inline-flex items-center justify-center p-2.5 font-semibold text-white bg-slate-600/50 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700"
                        aria-label="Reset Icon"
                    >
                        <TrashIcon />
                    </button>
                    </div>
                </div>
            </div>
        </div>
    </>
)});

const ApiManager: React.FC<{
  title: string;
  endpoints: ApiEndpoint[];
  selectedId: string | null;
  onAdd: (name: string, url: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  buttonTextColor: string;
}> = ({ title, endpoints, selectedId, onAdd, onDelete, onSelect, buttonTextColor }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const handleSave = () => {
    if (newName.trim() && newUrl.trim()) {
      onAdd(newName.trim(), newUrl.trim());
      setNewName('');
      setNewUrl('');
      setIsAdding(false);
    }
  };

  return (
    <div>
      <h4 className="font-bold text-white font-sans mb-3">{title}</h4>
      <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
        {endpoints.length > 1 && (
            <div className={`flex items-center justify-between p-2 rounded-md transition-colors ${selectedId === 'random' ? 'bg-[var(--theme-color)]/20 border border-[var(--theme-color)]/30' : 'bg-slate-700/30'}`}>
               <button
                 onClick={() => onSelect('random')}
                 className="flex-1 text-left group"
               >
                 <p className="font-semibold text-white group-hover:text-[var(--theme-color)] transition-colors truncate flex items-center gap-1.5">
                    <SparklesIcon /> 随机生成 ({endpoints.length}个接口)
                 </p>
                 <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate mt-0.5">每次生成随机选择一个API</p>
               </button>
            </div>
        )}
        {endpoints.map(api => (
          <div key={api.id} className={`flex items-center justify-between p-2 rounded-md transition-colors ${selectedId === api.id ? 'bg-[var(--theme-color)]/20 border border-[var(--theme-color)]/30' : 'bg-slate-700/30'}`}>
            <button
              onClick={() => onSelect(api.id)}
              className="flex-1 text-left group"
            >
              <p className="font-semibold text-white group-hover:text-[var(--theme-color)] transition-colors truncate flex items-center gap-1.5">
                {selectedId === api.id && <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-color)]"></span>}
                {api.name}
              </p>
              <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate mt-0.5">{api.url}</p>
            </button>
            <button
              onClick={() => onDelete(api.id)}
              className="p-2 pl-3 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 border-l border-slate-600/50 ml-2"
              aria-label={`删除 ${api.name}`}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
         {endpoints.length === 0 && !isAdding && (
            <p className="text-center text-xs text-slate-500 py-2">没有API。请添加一个。</p>
        )}
      </div>

      {isAdding && (
        <div className="mt-3 pt-3 border-t border-slate-600/50 space-y-2 animate-fade-in-down">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="API 名称"
            className="w-full bg-slate-800/80 border border-slate-600 rounded-md px-2 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)] font-sans text-sm"
          />
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="API URL"
            className="w-full bg-slate-800/80 border border-slate-600 rounded-md px-2 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)] font-sans text-sm"
          />
          <div className="flex gap-2">
            <button onClick={() => setIsAdding(false)} className="flex-1 px-3 py-1.5 text-sm font-bold text-slate-300 bg-slate-600/50 rounded-md hover:bg-slate-600 transition-colors">取消</button>
            <button
              onClick={handleSave}
              className="flex-1 px-3 py-1.5 text-sm font-bold bg-[var(--theme-color)] rounded-md hover:brightness-110 transition-all"
              style={{ color: buttonTextColor }}
            >
              保存
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsAdding(p => !p)}
        className="w-full mt-3 px-4 py-2 text-sm font-bold text-slate-300 bg-slate-600/50 rounded-md hover:bg-slate-600 transition-colors"
      >
        {isAdding ? '收起' : '+ 添加新 API'}
      </button>
    </div>
  );
};


const MoreSearchesView = memo(({ onBack, onHome, localSettings, handleSettingChange, buttonTextColor }) => {
  const { showToast } = useContext(UIContext);
  
  const handleToggle = (key: keyof AppSettings, name: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = e.target.checked;
    handleSettingChange(key, isEnabled);
    showToast(`已${isEnabled ? '开启' : '关闭'}${name}`);
  };
  
  // --- API Management Logic ---
  const handleApiAdd = (type: 'video' | 'image') => (name: string, url: string) => {
    const newApi: ApiEndpoint = { id: `custom-${Date.now()}`, name, url };
    const key = type === 'video' ? 'videoApiEndpoints' : 'imageApiEndpoints';
    const updatedEndpoints = [...localSettings[key], newApi];
    handleSettingChange(key, updatedEndpoints);
    // Automatically select the newly added API
    handleApiSelect(type)(newApi.id);
  };

  const handleApiDelete = (type: 'video' | 'image') => (idToDelete: string) => {
    const key = type === 'video' ? 'videoApiEndpoints' : 'imageApiEndpoints';
    const selectedKey = type === 'video' ? 'selectedVideoApiId' : 'selectedImageApiId';
    
    const updatedEndpoints = localSettings[key].filter(api => api.id !== idToDelete);
    handleSettingChange(key, updatedEndpoints);

    // If the deleted API was the selected one, select the first one in the list or null
    if (localSettings[selectedKey] === idToDelete) {
      handleSettingChange(selectedKey, updatedEndpoints.length > 0 ? updatedEndpoints[0].id : null);
    }
  };

  const handleApiSelect = (type: 'video' | 'image') => (idToSelect: string) => {
    const key = type === 'video' ? 'selectedVideoApiId' : 'selectedImageApiId';
    handleSettingChange(key, idToSelect);
  };

  return (
    <>
      <SubViewHeader title="更多搜索" onBack={onBack} onHome={onHome} />
      <div className="space-y-4">
        <div className="bg-amber-900/20 border border-amber-700/50 p-3 rounded-lg text-xs text-amber-200/80 font-sans leading-relaxed">
          <p className="font-bold mb-1">💡 提示：</p>
          <p>开启视频或图片生成后，系统会自动在后台预加载媒体资源以提升“换一批”的响应速度。如果您发现加载缓慢或失败，可能是因为触发了 API 的频率限制。您可以尝试关闭预加载或更换 API 端点。</p>
        </div>

        {/* Video Generation */}
        <div className="bg-slate-700/30 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white font-sans flex items-center gap-2"><VideoIcon /> 启用视频生成</h4>
              <p className="text-xs text-slate-400 mt-1 font-sans">使用自定义API端点生成视频。</p>
            </div>
            <ToggleSwitch 
              id="video-generation-toggle"
              checked={localSettings.videoGenerationEnabled}
              onChange={handleToggle('videoGenerationEnabled', '视频生成')}
            />
          </div>
          {localSettings.videoGenerationEnabled && (
            <div className="mt-3 pt-3 border-t border-slate-600/50 animate-fade-in-down">
              <ApiManager
                title="视频 API 端点"
                endpoints={localSettings.videoApiEndpoints}
                selectedId={localSettings.selectedVideoApiId}
                onAdd={handleApiAdd('video')}
// FIX: Corrected function name from `handleDelete` to `handleApiDelete`.
                onDelete={handleApiDelete('video')}
                onSelect={handleApiSelect('video')}
                buttonTextColor={buttonTextColor}
              />
              <p className="text-xs text-slate-500 mt-2 font-sans">
                API应返回JSON数组：
                <code className="block text-[10px] mt-1 p-1 bg-slate-900/50 rounded whitespace-pre-wrap leading-tight">
{`[{"url": "...", "thumbnail": "...", "title": "..."}]`}
                </code>
              </p>
            </div>
          )}
        </div>

        {/* Image Generation */}
        <div className="bg-slate-700/30 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white font-sans flex items-center gap-2"><ImageIcon /> 启用图片生成</h4>
              <p className="text-xs text-slate-400 mt-1 font-sans">使用自定义API端点生成图片。</p>
            </div>
            <ToggleSwitch 
              id="image-generation-toggle"
              checked={localSettings.imageGenerationEnabled}
              onChange={handleToggle('imageGenerationEnabled', '图片生成')}
            />
          </div>
          {localSettings.imageGenerationEnabled && (
            <div className="mt-3 pt-3 border-t border-slate-600/50 animate-fade-in-down">
              <ApiManager
                title="图片 API 端点"
                endpoints={localSettings.imageApiEndpoints}
                selectedId={localSettings.selectedImageApiId}
                onAdd={handleApiAdd('image')}
// FIX: Corrected function name from `handleDelete` to `handleApiDelete`.
                onDelete={handleApiDelete('image')}
                onSelect={handleApiSelect('image')}
                buttonTextColor={buttonTextColor}
              />
              <p className="text-xs text-slate-500 mt-2 font-sans">
                API应返回JSON数组：
                <code className="block text-[10px] mt-1 p-1 bg-slate-900/50 rounded whitespace-pre-wrap leading-tight">
{`[{"url": "...", "alt": "..."}]`}
                </code>
              </p>
            </div>
          )}
        </div>

        {/* Other Searches */}
        <div className="flex items-center justify-between bg-slate-700/30 p-4 rounded-lg">
          <div>
            <h4 className="font-bold text-white font-sans">启用自定义搜索</h4>
            <p className="text-xs text-slate-400 mt-1 font-sans">更好的搜索出你想要的官网，如果加载失败可能需要配合魔法上网。</p>
          </div>
          <ToggleSwitch 
            id="more-searches-toggle"
            checked={localSettings.moreSearchesEnabled}
            onChange={handleToggle('moreSearchesEnabled', '自定义搜索')}
          />
        </div>
        <div className="flex items-center justify-between bg-slate-700/30 p-4 rounded-lg">
          <div>
            <h4 className="font-bold text-white font-sans">启用随机搜索</h4>
            <p className="text-xs text-slate-400 mt-1 font-sans">在不输入内容时，“换一批”将探索随机主题。</p>
          </div>
          <ToggleSwitch 
            id="random-search-toggle"
            checked={localSettings.randomSearchEnabled}
            onChange={handleToggle('randomSearchEnabled', '随机搜索')}
          />
        </div>
        <div className="flex items-center justify-between bg-slate-700/30 p-4 rounded-lg">
          <div>
            <h4 className="font-bold text-white font-sans">网站随机顺序生成</h4>
            <p className="text-xs text-slate-400 mt-1 font-sans">将生成的网站列表顺序随机打乱。</p>
          </div>
          <ToggleSwitch 
            id="randomize-order-toggle"
            checked={localSettings.randomizeOrderEnabled}
            onChange={handleToggle('randomizeOrderEnabled', '网站随机顺序')}
          />
        </div>
      </div>
    </>
  );
});


const SearchHistoryView = memo(({ onBack, onHome }) => {
    const { setIsSettingsOpen } = useContext(UIContext);
    const { searchHistory, clearSearchHistory, handleGenerate, setSearchQuery } = useContext(DataContext);

    const handleHistoryClick = (term: string) => {
        setSearchQuery(term);
        handleGenerate(term);
        setIsSettingsOpen(false);
    };

    return (
        <>
            <SubViewHeader title="搜索记录" onBack={onBack} onHome={onHome} />
            {searchHistory.length > 0 ? (
                <>
                    <ul className="space-y-2">
                        {searchHistory.map((term, index) => (
                            <li key={index}>
                                <button
                                    onClick={() => handleHistoryClick(term)}
                                    className="w-full text-left p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/60 transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)]"
                                >
                                    <p className="text-slate-200 truncate font-sans">{term}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <button
                        onClick={clearSearchHistory}
                        className="w-full mt-4 inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-slate-300 bg-slate-600/50 rounded-md hover:bg-slate-600 transition-colors font-sans"
                    >
                        <TrashIcon className="mr-1.5" />
                        <span>清除记录</span>
                    </button>
                </>
            ) : (
                <div className="text-center py-8 text-slate-400">
                    <ClipboardDocumentListIcon />
                    <p className="mt-2 font-sans">暂无搜索记录。</p>
                </div>
            )}
        </>
    );
});

const HiddenFeaturesView = memo(({ onBack, onHome, onNavClick, onOmniSearchClick, localSettings, handleSettingChange }) => {
  const { showToast } = useContext(UIContext);

  const handleSafetyToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = e.target.checked;
    handleSettingChange('breakSafetyLimits', isEnabled);
    showToast(`已${isEnabled ? '开启' : '关闭'}安全限制突破`);
  };

  return (
    <>
      <SubViewHeader title="隐藏功能" onBack={onBack} onHome={onHome} />
      <div className="space-y-4">
        <div className="space-y-2">
            <button 
                onClick={() => onNavClick('unlimitedSearch')} 
                className="w-full flex justify-between items-center p-4 rounded-lg hover:bg-slate-700/50 transition-colors text-left font-sans"
            >
                <span>无限制搜索</span>
                <ChevronRightIcon />
            </button>
            <button 
                onClick={onOmniSearchClick} 
                className="w-full flex justify-between items-center p-4 rounded-lg hover:bg-slate-700/50 transition-colors text-left font-sans"
            >
                <span>万物搜索</span>
                <ChevronRightIcon />
            </button>
        </div>
        <div className="border-t border-slate-700/50 pt-4">
          <div className="flex items-center justify-between bg-slate-700/30 p-4 rounded-lg">
            <div>
              <h4 className="font-bold text-white font-sans">突破安全限制</h4>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                尝试使用最低安全阈值请求API。注意：此功能无法绕过核心安全策略，极端请求仍会被阻止。
              </p>
            </div>
            <ToggleSwitch
              id="break-safety-limits-toggle"
              checked={localSettings.breakSafetyLimits}
              onChange={handleSafetyToggle}
            />
          </div>
        </div>
      </div>
    </>
  );
});


const UnlimitedSearchView = memo(({ onBack, onHome, localSettings, handleSettingChange }) => {
  const { showToast } = useContext(UIContext);
  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = e.target.checked;
    handleSettingChange('unlimitedSearchEnabled', isEnabled);
    showToast(`已${isEnabled ? '开启' : '关闭'}无限制搜索功能`);
  };

  return (
    <>
      <SubViewHeader title="无限制搜索" onBack={onBack} onHome={onHome} />
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-slate-700/30 p-4 rounded-lg">
          <div>
            <h4 className="font-bold text-white font-sans">启用无限制搜索</h4>
            <p className="text-xs text-slate-400 mt-1 font-sans">自定义单次生成的网站数量。</p>
          </div>
          <ToggleSwitch
            id="unlimited-search-toggle"
            checked={localSettings.unlimitedSearchEnabled}
            onChange={handleToggle}
          />
        </div>
        {localSettings.unlimitedSearchEnabled && (
          <div className="p-4 bg-slate-700/30 rounded-lg animate-fade-in-down">
            <SettingSlider
              id="unlimitedSearchCount"
              label="生成数量"
              value={localSettings.unlimitedSearchCount}
              onChange={(v) => handleSettingChange('unlimitedSearchCount', v)}
              min={1}
              max={50}
              step={1}
            />
          </div>
        )}
      </div>
    </>
  );
});

const OmniSearchView = memo(({ onBack, onHome, localSettings, handleSettingChange, buttonTextColor }) => {
  const { showToast } = useContext(UIContext);
  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = e.target.checked;
    handleSettingChange('omniSearchEnabled', isEnabled);
    showToast(`已${isEnabled ? '开启' : '关闭'}万物搜索`);
  };

  const handleEngineChange = (engine: 'gemini' | 'google') => {
      handleSettingChange('searchEngine', engine);
  };

  return (
    <>
      <SubViewHeader title="万物搜索" onBack={onBack} onHome={onHome} />
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-slate-700/30 p-4 rounded-lg">
          <div>
            <h4 className="font-bold text-white font-sans">启用万物搜索</h4>
            <p className="text-xs text-slate-400 mt-1 font-sans">突破限制，搜索任何您感兴趣的内容。</p>
          </div>
          <ToggleSwitch
            id="omni-search-toggle"
            checked={localSettings.omniSearchEnabled}
            onChange={handleToggle}
          />
        </div>
        {localSettings.omniSearchEnabled && (
          <div className="p-4 bg-slate-700/30 rounded-lg animate-fade-in-down">
            <label className="block font-medium text-slate-300 mb-3 font-sans">搜索引擎</label>
            <div className="flex gap-2 font-sans">
              <button
                  onClick={() => handleEngineChange('gemini')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${localSettings.searchEngine === 'gemini' ? 'bg-[var(--theme-color)] shadow-lg' : 'bg-slate-600/50 hover:bg-slate-600 text-slate-300'}`}
                  style={{ color: localSettings.searchEngine === 'gemini' ? buttonTextColor : undefined }}
              >智能生成</button>
              <button
                  onClick={() => handleEngineChange('google')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${localSettings.searchEngine === 'google' ? 'bg-[var(--theme-color)] shadow-lg' : 'bg-slate-600/50 hover:bg-slate-600 text-slate-300'}`}
                  style={{ color: localSettings.searchEngine === 'google' ? buttonTextColor : undefined }}
              >网页搜索</button>
            </div>
             <p className="text-xs text-slate-400 mt-3 font-sans">“智能生成”利用AI的创造力，而“网页搜索”提供基于最新网络信息的回答。</p>
          </div>
        )}
      </div>
    </>
  );
});

const ApiSettingsView = memo(({ onBack, onHome, localSettings, handleSettingChange, buttonTextColor }) => {
  const handleEngineChange = (engine: 'gemini-2.5-flash' | 'gemini-2.5-pro') => {
      handleSettingChange('apiEngine', engine);
  };

  return (
    <>
      <SubViewHeader title="API 设置" onBack={onBack} onHome={onHome} />
      <div className="space-y-4">
        <div className="p-4 bg-slate-700/30 rounded-lg">
          <label className="block font-medium text-slate-300 mb-3 font-sans">列表生成模型</label>
          <div className="flex gap-2 font-sans">
            <button
                onClick={() => handleEngineChange('gemini-2.5-flash')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${localSettings.apiEngine === 'gemini-2.5-flash' ? 'bg-[var(--theme-color)] shadow-lg' : 'bg-slate-600/50 hover:bg-slate-600 text-slate-300'}`}
                style={{ color: localSettings.apiEngine === 'gemini-2.5-flash' ? buttonTextColor : undefined }}
            >Flash</button>
            <button
                onClick={() => handleEngineChange('gemini-2.5-pro')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${localSettings.apiEngine === 'gemini-2.5-pro' ? 'bg-[var(--theme-color)] shadow-lg' : 'bg-slate-600/50 hover:bg-slate-600 text-slate-300'}`}
                style={{ color: localSettings.apiEngine === 'gemini-2.5-pro' ? buttonTextColor : undefined }}
            >Pro</button>
          </div>
           <p className="text-xs text-slate-400 mt-3 font-sans">
            {localSettings.apiEngine === 'gemini-2.5-flash'
              ? 'Flash: 速度更快，适合快速生成。'
              : 'Pro: 功能更强大，结果更精准，但可能稍慢且有不同的配额限制。'}
          </p>
        </div>
      </div>
    </>
  );
});

const DebugView = memo(({ onBack, onHome, onResetClick }: { onBack: () => void, onHome: () => void, onResetClick: () => void }) => {
    return (
        <>
            <SubViewHeader title="调试功能" onBack={onBack} onHome={onHome} />
            <div className="space-y-4">
                <div className="bg-slate-700/30 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-white font-sans">遗忘重置功能</h4>
                            <p className="text-xs text-slate-400 mt-1 font-sans">将所有设置、历史记录和收藏夹重置为初始状态。</p>
                        </div>
                        <button
                            onClick={onResetClick}
                            className="inline-flex items-center px-4 py-2 text-sm font-bold text-white bg-red-600/80 rounded-md hover:bg-red-600 transition-colors font-sans"
                        >
                            <TrashIcon className="mr-1.5" />
                            <span>重置</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
});

const FavoriteItemCard: React.FC<{ item: MediaFavorite, onRemove: (url: string) => void, onOpen: (item: MediaFavorite) => void }> = memo(({ item, onRemove, onOpen }) => {
    const { showToast } = useContext(UIContext);
    const [aspectRatio, setAspectRatio] = useState('auto');

    useEffect(() => {
        setAspectRatio('auto'); // Reset on item change
    }, [item.url]);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        const img = e.currentTarget;
        setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
    };

    const handleVideoMetaLoad = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        const vid = e.currentTarget;
        setAspectRatio(`${vid.videoWidth} / ${vid.videoHeight}`);
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        showToast("开始下载...");
        const apiName = item.apiName || 'General';
        const originalFilename = item.url.split('/').pop()?.split('?')[0] || `${item.type}-media`;
        const filename = `AzuTool/${apiName}/${(item.type === 'video' ? item.title : item.alt) || originalFilename}`;
        try {
            await downloadMedia(item.url, filename);
        } catch (error) {
            showToast("下载失败。");
        }
    };

    return (
        <div 
            className="relative group bg-slate-800 rounded-lg overflow-hidden border border-transparent hover:border-[var(--theme-color)] transition-colors mb-3"
            style={{ breakInside: 'avoid-column' }}
        >
            <button onClick={() => onOpen(item)} className="w-full h-full" aria-label={`查看 ${item.type === 'video' ? item.title : item.alt}`}>
                <div className="relative bg-slate-900/50 flex items-center justify-center" style={{ aspectRatio }}>
                    {item.type === 'image' ? (
                        <img src={item.url} alt={item.alt || 'Favorite image'} className="w-full h-full object-contain" onLoad={handleImageLoad} referrerPolicy="no-referrer" />
                    ) : (
                        <video 
                            key={item.url}
                            src={item.url}
                            poster={item.thumbnail || ''}
                            muted
                            playsInline
                            preload="metadata"
                            onLoadedMetadata={handleVideoMetaLoad}
                            className="w-full h-full object-contain"
                        >
                            您的浏览器不支持视频缩略图。
                        </video>
                    )}
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                    <p className="text-white text-xs font-bold text-center leading-tight">{(item.type === 'video' ? item.title : item.alt) || '无标题'}</p>
                </div>
            </button>
             <div className="absolute top-1.5 right-1.5 z-10 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(item.url); }}
                    className="p-1.5 rounded-full text-yellow-400 bg-black/40 hover:bg-black/60 transition-all"
                    aria-label="取消收藏"
                >
                    <StarIcon filled={true} className="h-4 w-4"/>
                </button>
                <button
                    onClick={handleDownload}
                    className="p-1.5 rounded-full text-white bg-black/40 hover:bg-black/60 transition-all"
                    aria-label="下载"
                >
                    <DownloadIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
});

const MediaFavoritesView = memo(({ onBack, onHome, buttonTextColor }: { onBack: () => void; onHome: () => void; buttonTextColor: string }) => {
    const { mediaFavorites, toggleMediaFavorite } = useContext(DataContext);
    const { showToast } = useContext(UIContext);
    const [viewingMedia, setViewingMedia] = useState<MediaFavorite | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const categories = useMemo(() => {
        const apiMap = new Map<string, string>();
        mediaFavorites.forEach(item => {
            if (item.apiId && item.apiName) {
                apiMap.set(item.apiId, item.apiName);
            }
        });
        return Array.from(apiMap, ([id, name]) => ({ id, name }));
    }, [mediaFavorites]);

    const filteredFavorites = useMemo(() => {
        if (selectedCategory === 'all') {
            return mediaFavorites;
        }
        return mediaFavorites.filter(item => item.apiId === selectedCategory);
    }, [mediaFavorites, selectedCategory]);

    const handleRemove = (url: string) => {
        const itemToRemove = mediaFavorites.find(fav => fav.url === url);
        if (itemToRemove) {
            toggleMediaFavorite(itemToRemove);
            showToast("已从收藏夹中移除。");
        }
    };

    return (
        <>
            <div className="sticky top-[-24px] z-10 bg-slate-800/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-2 mb-4">
                 <div className="relative flex items-center justify-center">
                    <div className="absolute left-0 flex items-center">
                        <button onClick={onHome} className="p-2 -ml-2 mr-1 rounded-full hover:bg-slate-700/50 text-slate-300 hover:text-white transition-colors" aria-label="返回主菜单">
                            <HomeIcon />
                        </button>
                        <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-700/50 text-slate-300 hover:text-white transition-colors" aria-label="返回">
                            <ChevronLeftIcon />
                        </button>
                    </div>
                    <h2 className="text-2xl font-bold text-white font-sans">媒体收藏夹</h2>
                </div>
                {mediaFavorites.length > 0 && (
                    <div className="mt-4 pb-2 flex items-center gap-2 overflow-x-auto">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-3 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap transition-colors ${selectedCategory === 'all' ? 'bg-[var(--theme-color)]' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                             style={{ color: selectedCategory === 'all' ? buttonTextColor : undefined }}
                        >
                            全部收藏
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-3 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap transition-colors ${selectedCategory === cat.id ? 'bg-[var(--theme-color)]' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                style={{ color: selectedCategory === cat.id ? buttonTextColor : undefined }}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
             {filteredFavorites.length > 0 ? (
                <div className="columns-2 sm:columns-3 gap-3">
                    {filteredFavorites.map(item => (
                        <FavoriteItemCard key={item.url} item={item} onRemove={handleRemove} onOpen={setViewingMedia} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-8 text-slate-400">
                    <ClipboardDocumentListIcon />
                    <p className="mt-2 font-sans">{mediaFavorites.length > 0 ? "此分类下没有项目。" : "您的收藏夹是空的。"}</p>
                </div>
            )}
            {viewingMedia && (
                <MediaViewerModal
                    item={viewingMedia}
                    onClose={() => setViewingMedia(null)}
                    mediaList={filteredFavorites}
                    onSelectItem={setViewingMedia}
                />
            )}
        </>
    );
});

export const SettingsPanel: React.FC = memo(() => {
  const {
    settings,
    setSettings,
    resetSettings,
  } = useContext(SettingsContext);

  const {
    isSettingsOpen,
    setIsSettingsOpen,
    showToast,
    resetBackground
  } = useContext(UIContext);

  const {
    resetGenerator,
    resetFavorites,
    resetMediaFavorites,
    resetHistory,
    clearSearchHistory,
    setSearchQuery
  } = useContext(DataContext);

  const handleResetAllSettings = useCallback(() => {
    resetGenerator();
    resetFavorites();
    resetMediaFavorites();
    resetHistory();
    resetBackground();
    resetSettings();
    clearSearchHistory();
    setSearchQuery('');
    setIsSettingsOpen(false);
    showToast('所有设置已重置为初始状态。');
  }, [
    resetGenerator,
    resetFavorites,
    resetMediaFavorites,
    resetHistory,
    resetBackground,
    resetSettings,
    clearSearchHistory,
    setSearchQuery,
    setIsSettingsOpen,
    showToast
  ]);
  
  const [view, setView] = useState<View>('main');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  
  const buttonTextColor = isColorLight(localSettings.themeColor) ? '#1e293b' : '#ffffff';

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
      if(isSettingsOpen) {
          setView('main');
      }
  }, [isSettingsOpen]);

  const handleSettingChange = useCallback((key: keyof AppSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setSettings(prev => ({ ...prev, [key]: value }));
  }, [setSettings]);

  const handleOmniSearchClick = () => {
    if (localSettings.omniSearchUnlocked) {
      setView('omniSearch');
    } else {
      setIsPasswordModalOpen(true);
      setPasswordInput('');
      setPasswordError('');
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '666') {
      handleSettingChange('omniSearchUnlocked', true);
      setIsPasswordModalOpen(false);
      setView('omniSearch');
      showToast('已解锁万物搜索功能');
    } else {
      setPasswordError('密码错误，请重试。');
    }
  };
  
  const isSearchEnabled = settings.moreSearchesEnabled || settings.omniSearchEnabled;

  const renderContent = () => {
    const onHome = () => setView('main');
    switch (view) {
      case 'personalization': return <PersonalizationView onBack={() => setView('main')} onHome={onHome} localSettings={localSettings} handleSettingChange={handleSettingChange} />;
      case 'moreSearches': return <MoreSearchesView onBack={() => setView('main')} onHome={onHome} localSettings={localSettings} handleSettingChange={handleSettingChange} buttonTextColor={buttonTextColor} />;
      case 'searchHistory': return <SearchHistoryView onBack={() => setView('main')} onHome={onHome} />;
      case 'mediaFavorites': return <MediaFavoritesView onBack={() => setView('main')} onHome={onHome} buttonTextColor={buttonTextColor} />;
      case 'hiddenFeatures': return <HiddenFeaturesView onBack={() => setView('main')} onHome={onHome} onNavClick={setView} onOmniSearchClick={handleOmniSearchClick} localSettings={localSettings} handleSettingChange={handleSettingChange} />;
      case 'unlimitedSearch': return <UnlimitedSearchView onBack={() => setView('hiddenFeatures')} onHome={onHome} localSettings={localSettings} handleSettingChange={handleSettingChange} />;
      case 'omniSearch': return <OmniSearchView onBack={() => setView('hiddenFeatures')} onHome={onHome} localSettings={localSettings} handleSettingChange={handleSettingChange} buttonTextColor={buttonTextColor} />;
      case 'apiSettings': return <ApiSettingsView onBack={() => setView('main')} onHome={onHome} localSettings={localSettings} handleSettingChange={handleSettingChange} buttonTextColor={buttonTextColor} />;
      case 'debug': return <DebugView onBack={() => setView('main')} onHome={onHome} onResetClick={() => setIsResetConfirmOpen(true)} />;
      default: return <MainView onNavClick={setView} easterEggUnlocked={settings.easterEggUnlocked} isSearchEnabled={isSearchEnabled} />;
    }
  };

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] sm:backdrop-blur-sm z-40 flex items-center justify-center font-sans"
        onClick={() => setIsSettingsOpen(false)}
    >
      <div 
        onClick={stopPropagation}
        className={`relative w-full max-w-sm bg-slate-800/80 sm:bg-slate-800/60 backdrop-blur-md sm:backdrop-blur-lg border border-slate-700 rounded-2xl shadow-2xl m-4 p-6 overflow-y-auto ${isSettingsOpen ? 'animate-fade-in-down' : 'animate-fade-out-up'}`}
        style={{ maxHeight: 'clamp(400px, 90vh, 800px)' }}
    >
        {isPasswordModalOpen && (
          <div className="absolute inset-0 bg-slate-800/80 backdrop-blur-md z-20 flex items-center justify-center rounded-2xl">
            <form onSubmit={handlePasswordSubmit} className="w-full p-4 animate-fade-in-down">
              <h3 className="text-lg font-bold text-center text-white mb-4 font-sans">需要密码</h3>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
                className="w-full bg-slate-900/70 border border-slate-600 rounded-md px-3 py-2 text-center text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition font-sans"
              />
              {passwordError && <p className="text-red-400 text-xs text-center mt-2 font-sans">{passwordError}</p>}
              <div className="flex gap-2 mt-4">
                 <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="flex-1 px-4 py-2 text-sm font-bold text-slate-300 bg-slate-600/50 rounded-md hover:bg-slate-600 transition-colors font-sans">
                    取消
                 </button>
                 <button
                   type="submit"
                   className="flex-1 px-4 py-2 text-sm font-bold bg-[var(--theme-color)] rounded-md hover:brightness-110 transition-all font-sans"
                   style={{ color: buttonTextColor }}
                 >
                    解锁
                 </button>
              </div>
            </form>
          </div>
        )}
        {isResetConfirmOpen && (
            <div className="absolute inset-0 bg-slate-800/80 backdrop-blur-md z-20 flex items-center justify-center rounded-2xl">
                <div className="w-full p-4 animate-fade-in-down text-center">
                    <h3 className="text-lg font-bold text-white mb-2 font-sans">确认重置？</h3>
                    <p className="text-sm text-slate-300 mb-6 font-sans">此操作将清除所有个性化设置、收藏夹和历史记录，且无法撤销。</p>
                    <div className="flex gap-2 mt-4">
                        <button type="button" onClick={() => setIsResetConfirmOpen(false)} className="flex-1 px-4 py-2 text-sm font-bold text-slate-300 bg-slate-600/50 rounded-md hover:bg-slate-600 transition-colors font-sans">
                            取消
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsResetConfirmOpen(false);
                                handleResetAllSettings();
                            }}
                            className="flex-1 px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-md hover:brightness-110 transition-all font-sans"
                        >
                            确认重置
                        </button>
                    </div>
                </div>
            </div>
        )}
        <button 
          onClick={() => setIsSettingsOpen(false)}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-30"
          aria-label="关闭设置"
        >
          <CloseIcon />
        </button>
        {renderContent()}
      </div>
    </div>
  );
});

export default SettingsPanel;