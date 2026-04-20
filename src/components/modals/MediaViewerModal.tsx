import React, { useEffect, useCallback } from 'react';
import type { MediaFavorite } from '../../types';
import { CloseIcon, ChevronLeftIcon, ChevronRightIcon } from '../Icons';

interface MediaViewerModalProps {
  item: MediaFavorite | null;
  onClose: () => void;
  mediaList?: MediaFavorite[];
  onSelectItem?: (item: MediaFavorite) => void;
}

const MediaViewerModal: React.FC<MediaViewerModalProps> = ({ item, onClose, mediaList = [], onSelectItem }) => {
  const currentIndex = mediaList.findIndex(i => i.url === item?.url);
  const canNavigate = mediaList.length > 1 && onSelectItem && currentIndex !== -1;

  const handleNext = useCallback(() => {
    if (!canNavigate) return;
    const nextIndex = (currentIndex + 1) % mediaList.length;
    onSelectItem(mediaList[nextIndex]);
  }, [canNavigate, currentIndex, mediaList, onSelectItem]);

  const handlePrev = useCallback(() => {
    if (!canNavigate) return;
    const prevIndex = (currentIndex - 1 + mediaList.length) % mediaList.length;
    onSelectItem(mediaList[prevIndex]);
  }, [canNavigate, currentIndex, mediaList, onSelectItem]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);


  if (!item) {
    return null;
  }

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in-down p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full h-full flex items-center justify-center"
        onClick={stopPropagation}
      >
        {item.type === 'image' && (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <img
              src={item.url}
              alt={item.alt || ' viewed image'}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
        {item.type === 'video' && (
          <video
            key={item.url} // Add key to force re-render on item change
            src={item.url}
            title={item.title || 'viewed video'}
            controls
            loop
            playsInline
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl bg-black"
            ref={(el) => {
              if (el) {
                const playPromise = el.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => console.warn('Modal video play interrupted:', e));
                }
              }
            }}
          >
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      {canNavigate && (
        <>
            <button
                onClick={handlePrev}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/30 text-white/70 hover:bg-black/50 hover:text-white transition-all z-10"
                aria-label="上一个"
            >
                <ChevronLeftIcon className="h-6 w-6 sm:h-8 sm:w-8"/>
            </button>
            <button
                onClick={handleNext}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/30 text-white/70 hover:bg-black/50 hover:text-white transition-all z-10"
                aria-label="下一个"
            >
                <ChevronRightIcon className="h-6 w-6 sm:h-8 sm:w-8 text-white/70"/>
            </button>
        </>
      )}

      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10 p-2 rounded-full bg-black/30 hover:bg-black/50"
        aria-label="关闭"
      >
        <CloseIcon />
      </button>
    </div>
  );
};

export default MediaViewerModal;