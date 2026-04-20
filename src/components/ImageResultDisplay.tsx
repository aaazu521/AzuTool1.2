import React, { memo, useState, useContext, useEffect } from 'react';
import type { ImageGenerationResultItem } from '../types';
import { DataContext } from '../contexts/DataContext';
import { UIContext } from '../contexts/UIContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { ImageIcon, StarIcon, DownloadIcon } from './Icons';
import { downloadMedia } from '../utils/csvExporter';

interface ImageCardProps {
    item: ImageGenerationResultItem;
    aspectRatio: string;
    className?: string;
    style?: React.CSSProperties;
}

const ImageCard: React.FC<ImageCardProps> = ({ item, aspectRatio, className, style }) => {
    const [isLoading, setIsLoading] = useState(true);
    const { settings } = useContext(SettingsContext);
    const { isMediaFavorite, toggleMediaFavorite } = useContext(DataContext);
    const { showToast } = useContext(UIContext);
    const isFav = isMediaFavorite(item.url);
    
    useEffect(() => {
        setIsLoading(true);
    }, [item.url]);

    const handleImageLoad = () => {
        setIsLoading(false);
    };

    const handleToggleFav = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const selectedApi = settings.imageApiEndpoints.find(api => api.id === settings.selectedImageApiId);
        toggleMediaFavorite({ 
            ...item, 
            type: 'image',
            apiId: selectedApi?.id,
            apiName: selectedApi?.name,
        });
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        showToast("开始下载...");
        const selectedApi = settings.imageApiEndpoints.find(api => api.id === settings.selectedImageApiId);
        const apiName = selectedApi?.name || 'General';
        const originalFilename = item.url.split('/').pop()?.split('?')[0] || `generated-image.${item.url.split('.').pop()?.split('?')[0] || 'jpg'}`;
        const filename = `AzuTool/${apiName}/${item.alt || originalFilename}`;
        try {
            await downloadMedia(item.url, filename);
        } catch (error) {
            showToast("下载失败。");
        }
    };

    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`group relative block bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700 hover:border-[var(--theme-color)] transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-[var(--theme-color)]/20 ${className}`}
            style={style}
            aria-label={`查看图片: ${item.alt}`}
        >
            <div 
                className="overflow-hidden relative bg-slate-900 flex justify-center items-center transition-all duration-500 ease-in-out min-h-[200px] media-container"
                style={{ aspectRatio: (aspectRatio === 'auto' || !aspectRatio) ? '3 / 4' : aspectRatio }}
            >
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50 skeleton-pulse">
                         <div className="w-10 h-10 border-4 border-[var(--theme-color)]/20 border-t-[var(--theme-color)] rounded-full animate-spin"></div>
                    </div>
                )}
                <img 
                    src={item.url} 
                    alt={item.alt}
                    loading="eager"
                    referrerPolicy="no-referrer"
                    onLoad={handleImageLoad}
                    className={`w-full h-full object-contain transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`} 
                    onError={(e) => { 
                        console.error(`Failed to load image: ${item.url}`);
                        // Try to use the original URL if it was proxied, as a last resort
                        if (item.url.includes('/api/proxy')) {
                            const originalUrl = new URLSearchParams(item.url.split('?')[1]).get('url');
                            if (originalUrl) {
                                e.currentTarget.src = originalUrl;
                                return;
                            }
                        }
                        e.currentTarget.src = "https://via.placeholder.com/1280x720/1e293b/64748b?text=Image+Load+Error"; 
                        setIsLoading(false);
                    }}
                />
            </div>
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button 
                    onClick={handleToggleFav}
                    className="p-2 rounded-full text-white/80 bg-black/40 backdrop-blur-sm hover:text-yellow-400 hover:bg-black/60 transition-all duration-200"
                    aria-label={isFav ? '取消收藏' : '添加到收藏夹'}
                >
                    <StarIcon filled={isFav} className="h-5 w-5" />
                </button>
                <button
                    onClick={handleDownload}
                    className="p-2 rounded-full text-white/80 bg-black/40 backdrop-blur-sm hover:text-white hover:bg-black/60 transition-all duration-200"
                    aria-label="下载图片"
                >
                    <DownloadIcon className="h-5 w-5" />
                </button>
            </div>
        </a>
    );
};

interface ImageResultsGridProps {
  results: { item: ImageGenerationResultItem, aspectRatio: string }[];
}

const ImageResultsGrid: React.FC<ImageResultsGridProps> = memo(({ results }) => {
  if (!results || results.length === 0) {
    return (
        <div className="my-8 p-6 text-center bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-lg max-w-4xl mx-auto animate-fade-in-down font-sans">
            <h3 className="text-lg font-bold text-slate-400">未生成任何图片。</h3>
            <p className="text-slate-500 mt-2">请尝试使用不同的提示词或检查您的API端点配置。</p>
        </div>
    );
  }

  return (
    <div className="my-8 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-300 border-b-2 border-slate-700 pb-2 mb-6 flex items-center gap-3">
        <ImageIcon />
        图片生成结果
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {results.map((result, index) => (
          <ImageCard 
            key={`${result.item.url || index}-${index}`} 
            item={result.item}
            aspectRatio={result.aspectRatio}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          />
        ))}
      </div>
    </div>
  );
});

export default ImageResultsGrid;