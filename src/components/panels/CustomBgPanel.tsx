import React, { useContext } from 'react';
import { UIContext } from '../../contexts/UIContext';
import { ImageIcon, FolderOpenIcon, UploadIcon, CloseIcon } from '../Icons';

const CustomBgPanel: React.FC = () => {
  const {
    isCustomBgPanelOpen,
    customBgInput,
    setCustomBgInput,
    handleSetCustomBg,
    handleClearCustomBg,
    handleUploadClick,
    isDraggingOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    setIsCustomBgPanelOpen
  } = useContext(UIContext);

  // Stop propagation to prevent clicks inside the modal from closing it
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => { handleDrop(e); setIsCustomBgPanelOpen(false); }}
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] sm:backdrop-blur-sm z-40 flex items-center justify-center font-sans"
      onClick={() => setIsCustomBgPanelOpen(false)} // Click on backdrop closes modal
    >
      <div
        onClick={stopPropagation}
        className={`relative w-full max-w-lg bg-slate-800/80 sm:bg-slate-800/60 backdrop-blur-md sm:backdrop-blur-lg border rounded-2xl shadow-2xl p-6 m-4 transition-all duration-300 ${isDraggingOver ? 'border-[var(--theme-color)] border-dashed' : 'border-slate-700'} ${isCustomBgPanelOpen ? 'animate-fade-in-down' : 'animate-fade-out-up'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-bg-title"
      >
        <button
          onClick={() => setIsCustomBgPanelOpen(false)}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-10 p-2 rounded-full hover:bg-slate-700/50"
          aria-label="关闭"
        >
          <CloseIcon />
        </button>

        <h3 id="custom-bg-title" className="text-lg font-bold text-[var(--theme-color)] mb-3 flex items-center">
          <ImageIcon />
          <span className="ml-2">设置自定义背景</span>
        </h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={customBgInput}
              onChange={(e) => setCustomBgInput(e.target.value)}
              placeholder="粘贴图片URL"
              className="flex-grow bg-slate-900/70 border border-slate-600 rounded-md px-3 py-2 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition font-sans"
            />
            <button
              onClick={() => { handleSetCustomBg(); setIsCustomBgPanelOpen(false); }}
              disabled={!customBgInput}
              className="flex-shrink-0 px-4 py-2 text-sm font-bold text-white bg-[var(--theme-color)] rounded-md hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-[var(--theme-color)] disabled:bg-gray-600 disabled:text-slate-400 disabled:cursor-not-allowed disabled:brightness-100 min-w-[60px]"
            >
              保存
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleUploadClick} className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-slate-300 bg-slate-600/50 rounded-md hover:bg-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-slate-500" title="从设备选择图片" >
              <FolderOpenIcon /> <span className="ml-1 hidden sm:inline">从设备上传</span><span className="ml-1 sm:hidden">上传</span>
            </button>
            <button onClick={() => { handleClearCustomBg(); setIsCustomBgPanelOpen(false); }} className="flex-1 px-4 py-2 text-sm font-bold text-slate-300 bg-slate-600/50 rounded-md hover:bg-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-slate-500" >
              清除
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3 font-sans">您也可以将图片文件拖放到此窗口以上传。本地上传的图片不会被保存到服务器。</p>
        {isDraggingOver && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--theme-color)] z-10 pointer-events-none">
            <UploadIcon />
            <p className="mt-2 text-lg text-[var(--theme-color)] font-bold">将图片拖放到此处以上传</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomBgPanel;