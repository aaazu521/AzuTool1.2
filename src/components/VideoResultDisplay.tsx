import React, { memo, useState, useEffect, useContext, useRef } from 'react';
import type { VideoGenerationResultItem } from '../types';
import { DataContext } from '../contexts/DataContext';
import { UIContext } from '../contexts/UIContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { VideoIcon, StarIcon, DownloadIcon, PlayIcon } from './Icons';
import { Loader } from './Loader';
import { downloadMedia } from '../utils/csvExporter';

interface VideoResultsGridProps {
  results: { item: VideoGenerationResultItem; aspectRatio: string }[];
}

const VideoCard: React.FC<{ item: VideoGenerationResultItem; aspectRatio: string; style?: React.CSSProperties }> = ({ item, aspectRatio, style }) => {
    const { settings } = useContext(SettingsContext);
    const { isMediaFavorite, toggleMediaFavorite } = useContext(DataContext);
    const { showToast } = useContext(UIContext);
    const isFav = isMediaFavorite(item.url);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        // Reset state for new video URLs
        setIsInitialized(false);
    }, [item.url]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        const handleReady = () => {
            if (videoRef.current) { // Ensure ref is still valid
                setIsInitialized(true);
                // Handle autoplay manually to catch interruptions
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch((e) => {
                        console.warn('Autoplay interrupted:', e);
                        setIsPlaying(false);
                    });
                } else {
                    setIsPlaying(!videoRef.current.paused);
                }
            }
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('canplay', handleReady);

        // Fallback for cached videos that might not fire 'canplay'
        if (video.readyState >= 3) { // HAVE_FUTURE_DATA
            handleReady();
        }

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('canplay', handleReady);
        };
    }, [item.url]);

    const togglePlay = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    console.warn('Video play was interrupted:', error);
                });
            }
        } else {
            video.pause();
        }
    };

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        const selectedApi = settings.videoApiEndpoints.find(api => api.id === settings.selectedVideoApiId);
        toggleMediaFavorite({ 
            ...item, 
            type: 'video',
            apiId: selectedApi?.id,
            apiName: selectedApi?.name,
        });
    }

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        showToast("开始下载...");
        const selectedApi = settings.videoApiEndpoints.find(api => api.id === settings.selectedVideoApiId);
        const apiName = selectedApi?.name || 'General';
        const originalFilename = item.url.split('/').pop()?.split('?')[0] || `generated-video.${item.url.split('.').pop()?.split('?')[0] || 'mp4'}`;
        const filename = `AzuTool/${apiName}/${item.title || originalFilename}`;
        try {
             await downloadMedia(item.url, filename);
        } catch (error) {
             showToast("下载失败。");
        }
    };

    return (
        <div 
            className="group relative w-full bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700 animate-fade-in"
            style={style}
            onClick={togglePlay}
        >
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button 
                    onClick={handleToggleFavorite}
                    className="p-2 rounded-full text-white/80 bg-black/40 backdrop-blur-sm hover:text-yellow-400 hover:bg-black/60 transition-all duration-200"
                    aria-label={isFav ? '取消收藏' : '添加到收藏夾'}
                >
                    <StarIcon filled={isFav} className="h-5 w-5" />
                </button>
                <button
                    onClick={handleDownload}
                    className="p-2 rounded-full text-white/80 bg-black/40 backdrop-blur-sm hover:text-white hover:bg-black/60 transition-all duration-200"
                    aria-label="下载视频"
                >
                    <DownloadIcon className="h-5 w-5" />
                </button>
            </div>
            <div 
                className="relative overflow-hidden bg-slate-900 w-full flex items-center justify-center cursor-pointer transition-all duration-500 ease-in-out min-h-[200px] media-container"
                style={{ 
                    aspectRatio: aspectRatio === 'auto' ? '9 / 16' : aspectRatio,
                }}
            >
                <video 
                    ref={videoRef}
                    key={item.url}
                    src={item.url} 
                    title={item.title}
                    loop
                    playsInline
                    preload="metadata"
                    poster={item.thumbnail || ''}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                        console.error(`Failed to load video: ${item.url}`);
                        // Try to use the original URL if it was proxied, as a last resort
                        if (item.url.includes('/api/proxy')) {
                            const originalUrl = new URLSearchParams(item.url.split('?')[1]).get('url');
                            if (originalUrl) {
                                e.currentTarget.src = originalUrl;
                                return;
                            }
                        }
                    }}
                    className="w-full h-full object-contain"
                >
                  您的浏览器不支持视频播放。
                </video>
                 {isInitialized && !isPlaying && (
                     <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                        <PlayIcon className="h-16 w-16 text-white/80 drop-shadow-lg" />
                    </div>
                )}
            </div>
        </div>
    );
};

const VideoResultsGrid: React.FC<VideoResultsGridProps> = memo(({ results }) => {
  if (!results || results.length === 0) {
    return (
        <div className="my-8 p-6 text-center bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-lg max-w-4xl mx-auto animate-fade-in-down font-sans">
            <h3 className="text-lg font-bold text-slate-400">未生成任何视频。</h3>
            <p className="text-slate-500 mt-2">请尝试使用不同的提示词或检查您的API端点配置。</p>
        </div>
    );
  }
  
  return (
    <div className="my-8 w-full max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-300 border-b-2 border-slate-700 pb-2 mb-6 flex items-center gap-3">
        <VideoIcon />
        视频生成结果
      </h2>
      <div className="flex flex-col gap-6">
        {results.map((result, index) => (
          <VideoCard 
            key={`${result.item.url || index}-${index}`} 
            item={result.item} 
            aspectRatio={result.aspectRatio}
            style={{ animationDelay: `${index * 100}ms` }}
          />
        ))}
      </div>
    </div>
  );
});

export default VideoResultsGrid;