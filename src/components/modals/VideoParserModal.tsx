import React, { useState, useContext } from 'react';
import { UIContext } from '../../contexts/UIContext';
import { SettingsContext } from '../../contexts/SettingsContext';
import { VideoIcon, ImageIcon, DownloadIcon, Loader as LoaderIcon, XIcon, LinkIcon, SparklesIcon } from '../Icons';
import { Loader } from '../Loader';
import { isColorLight } from '../../utils/colorUtils';

interface VideoParserModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const VideoParserModal: React.FC<VideoParserModalProps> = ({ isOpen, onClose }) => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [downloadingItems, setDownloadingItems] = useState<Record<string, boolean>>({});
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [isBatchDownloading, setIsBatchDownloading] = useState(false);
    const { showToast } = useContext(UIContext);
    const { settings } = useContext(SettingsContext);

    const isThemeLight = isColorLight(settings.themeColor);
    const dynamicButtonTextColor = isThemeLight ? 'text-slate-900' : 'text-white';

    if (!isOpen) return null;

    const handleParse = async () => {
        if (!url) {
            showToast("请输入链接");
            return;
        }

        setLoading(true);
        setResult(null);
        setSelectedImages([]);
        try {
            let endpoint = `/api/parse/xhs?url=${encodeURIComponent(url)}`;
            if (url.includes('kuaishou.com') || url.includes('kuaishouapp.com')) {
                endpoint = `/api/parse/ks?url=${encodeURIComponent(url)}`;
            } else if (url.includes('douyin.com') || url.includes('iesdouyin.com')) {
                endpoint = `/api/parse/dy?url=${encodeURIComponent(url)}`;
            }
            
            const response = await fetch(endpoint);
            const data = await response.json();
            if (data.code === 200) {
                setResult(data.data);
                showToast("解析成功");
            } else {
                showToast(data.msg || "解析失败");
            }
        } catch (error) {
            console.error("Parse error:", error);
            showToast("解析请求失败");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (mediaUrl: string, filename: string, silent = false) => {
        if (downloadingItems[mediaUrl]) return false;
        
        setDownloadingItems(prev => ({ ...prev, [mediaUrl]: true }));
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(mediaUrl)}&download=${encodeURIComponent(filename)}`;
        
        try {
            if (!silent) showToast("正在缓冲文件，请稍候...");
            const response = await fetch(proxyUrl);
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                if (!silent) showToast("下载受阻：请点击右上角按钮在新窗口打开应用");
                return false;
            }

            if (!response.ok) throw new Error('Network response was not ok');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            if (!silent) showToast("下载完成");
            return true;
        } catch (error) {
            console.error("Download error:", error);
            if (!silent) showToast("下载失败，请重试");
            return false;
        } finally {
            setDownloadingItems(prev => ({ ...prev, [mediaUrl]: false }));
        }
    };

    const toggleSelection = (url: string) => {
        setSelectedImages(prev => 
            prev.includes(url) ? prev.filter(item => item !== url) : [...prev, url]
        );
    };

    const handleSelectAll = () => {
        if (selectedImages.length === result.images.length) {
            setSelectedImages([]);
        } else {
            setSelectedImages([...result.images]);
        }
    };

    const handleBatchDownload = async () => {
        if (selectedImages.length === 0) return;
        setIsBatchDownloading(true);
        showToast(`开始批量下载 ${selectedImages.length} 张图片...`);
        
        let successCount = 0;
        for (let i = 0; i < selectedImages.length; i++) {
            const imgUrl = selectedImages[i];
            const originalIdx = result.images.indexOf(imgUrl);
            const success = await handleDownload(imgUrl, `xhs-img-${originalIdx}-${Date.now()}.jpg`, true);
            if (success) successCount++;
            // Small delay to prevent browser from blocking multiple rapid downloads
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        showToast(`批量下载完成，成功 ${successCount}/${selectedImages.length} 张`);
        setIsBatchDownloading(false);
        setSelectedImages([]);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-slate-900 sm:border sm:border-slate-700 sm:rounded-3xl w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-black/50">
                {/* Header */}
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--theme-color)]/10 rounded-xl">
                            <VideoIcon className="text-[var(--theme-color)] h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">媒体解析助手</h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">AzuTool Parser Engine</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => window.open(window.location.href, '_blank')}
                            className="p-2 hover:bg-slate-800 rounded-full transition-all text-slate-400 hover:text-[var(--theme-color)]"
                            title="在新窗口打开以解决下载问题"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-all hover:rotate-90">
                            <XIcon className="h-6 w-6 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8">
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1 group">
                                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-[var(--theme-color)] transition-colors" />
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="粘贴小红书/快手/抖音分享链接..."
                                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)]/30 focus:border-[var(--theme-color)] transition-all font-sans"
                                />
                            </div>
                            <button
                                onClick={handleParse}
                                disabled={loading}
                                className={`flex-shrink-0 px-8 py-4 bg-[var(--theme-color)] hover:brightness-110 active:scale-95 disabled:opacity-50 ${dynamicButtonTextColor} font-bold rounded-2xl transition-all flex items-center justify-center gap-2 min-w-[100px] whitespace-nowrap shadow-lg shadow-[var(--theme-color)]/20`}
                            >
                                {loading ? (
                                    <LoaderIcon className="animate-spin h-5 w-5" />
                                ) : (
                                    <>
                                        <SparklesIcon className="h-5 w-5" />
                                        <span>解析</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="text-[11px] text-center text-slate-500">支持从小红书/快手/抖音复制的包含文字的整段内容</p>
                    </div>

                    {loading && (
                        <div className="py-12 flex flex-col items-center justify-center gap-4">
                            <Loader />
                            <p className="text-slate-400 animate-pulse">正在解析中，请稍候...</p>
                        </div>
                    )}

                    {result && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Info */}
                            <div className="flex gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                <img src={`/api/proxy?url=${encodeURIComponent(result.cover)}`} referrerPolicy="no-referrer" alt="Cover" className="w-24 h-32 object-cover rounded-lg shadow-lg" />
                                <div className="flex-1 space-y-2">
                                    <h3 className="font-bold text-white line-clamp-1">{result.title || "无标题"}</h3>
                                    <p className="text-sm text-slate-400 line-clamp-2">{result.desc}</p>
                                    <div className="flex items-center gap-2 pt-2">
                                        <img src={`/api/proxy?url=${encodeURIComponent(result.author.avatar)}`} alt="Avatar" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                                        <span className="text-xs text-slate-300">{result.author.name}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Media Display */}
                            <div className="space-y-4">
                                {result.type === 'video' && result.url && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                                <VideoIcon className="h-4 w-4" /> 视频内容
                                            </span>
                                            <button 
                                                onClick={() => handleDownload(result.url, `xhs-video-${Date.now()}.mp4`)}
                                                className="text-xs text-[var(--theme-color)] hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                                disabled={downloadingItems[result.url]}
                                            >
                                                {downloadingItems[result.url] ? <LoaderIcon className="h-3 w-3 animate-spin" /> : <DownloadIcon className="h-3 w-3" />} 
                                                {downloadingItems[result.url] ? '缓冲中...' : '下载无水印视频'}
                                            </button>
                                        </div>
                                        <video 
                                            src={`/api/proxy?url=${encodeURIComponent(result.url)}`} 
                                            controls 
                                            className="w-full rounded-xl border border-slate-700 shadow-xl"
                                            poster={`/api/proxy?url=${encodeURIComponent(result.cover)}`}
                                            referrerPolicy="no-referrer"
                                        />
                                    </div>
                                )}

                                {(result.type === 'image' || result.type === 'live') && result.images.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                                <ImageIcon className="h-4 w-4" /> 图文内容 ({result.images.length}张)
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleSelectAll}
                                                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                                >
                                                    {selectedImages.length === result.images.length ? '取消全选' : '全选'}
                                                </button>
                                                {selectedImages.length > 0 && (
                                                    <button
                                                        onClick={handleBatchDownload}
                                                        disabled={isBatchDownloading}
                                                        className={`text-xs px-3 py-1.5 rounded-lg bg-[var(--theme-color)] ${dynamicButtonTextColor} font-medium hover:brightness-110 transition-all flex items-center gap-1 disabled:opacity-50`}
                                                    >
                                                        {isBatchDownloading ? <LoaderIcon className="h-3 w-3 animate-spin" /> : <DownloadIcon className="h-3 w-3" />}
                                                        下载已选 ({selectedImages.length})
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {result.images.map((img: string, idx: number) => (
                                                <div 
                                                    key={idx} 
                                                    className={`group relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${selectedImages.includes(img) ? 'border-[var(--theme-color)]' : 'border-slate-700 hover:border-slate-500'}`}
                                                    onClick={() => toggleSelection(img)}
                                                >
                                                    <img 
                                                        src={`/api/proxy?url=${encodeURIComponent(img)}`} 
                                                        alt={`Image ${idx}`} 
                                                        className="w-full h-full object-cover" 
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    
                                                    {/* Checkbox */}
                                                    <div className="absolute top-2 right-2 z-10">
                                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedImages.includes(img) ? 'bg-[var(--theme-color)] border-[var(--theme-color)]' : 'border-white/70 bg-black/20'}`}>
                                                            {selectedImages.includes(img) && (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${dynamicButtonTextColor}`} viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Single Download Button */}
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownload(img, `xhs-img-${idx}-${Date.now()}.jpg`);
                                                        }}
                                                        className={`absolute bottom-2 right-2 z-10 p-2 rounded-full bg-black/60 text-white backdrop-blur-sm transition-all hover:bg-[var(--theme-color)] ${downloadingItems[img] ? 'opacity-100 cursor-not-allowed' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}
                                                        disabled={downloadingItems[img]}
                                                    >
                                                        {downloadingItems[img] ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {result.type === 'live' && result.live_photo.length > 0 && (
                                    <div className="space-y-3 pt-4 border-t border-slate-800">
                                        <span className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                            <VideoIcon className="h-4 w-4" /> 实况视频 ({result.live_photo.length}个)
                                        </span>
                                        <div className="grid grid-cols-2 gap-3">
                                            {result.live_photo.map((live: any, idx: number) => (
                                                <div key={idx} className="space-y-2">
                                                    <video 
                                                        src={`/api/proxy?url=${encodeURIComponent(live.video)}`} 
                                                        controls 
                                                        className="w-full rounded-lg border border-slate-700"
                                                        poster={`/api/proxy?url=${encodeURIComponent(live.image)}`}
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <button 
                                                        onClick={() => handleDownload(live.video, `xhs-live-${idx}-${Date.now()}.mp4`)}
                                                        className="w-full py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        disabled={downloadingItems[live.video]}
                                                    >
                                                        {downloadingItems[live.video] ? <LoaderIcon className="h-3 w-3 animate-spin" /> : <DownloadIcon className="h-3 w-3" />} 
                                                        {downloadingItems[live.video] ? '缓冲中...' : '下载实况视频'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-4">
                    <div className="h-1 w-12 bg-slate-700 rounded-full sm:hidden"></div>
                </div>
            </div>
        </div>
    );
};

export default VideoParserModal;
