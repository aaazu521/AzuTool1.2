import { useCallback } from 'react';
import useLocalStorage from './useLocalStorage';
import type { MediaFavorite } from '../types';

const MEDIA_FAVORITES_KEY = 'pump_app_media_favorites';

export const useMediaFavorites = () => {
  const [mediaFavorites, setMediaFavorites] = useLocalStorage<MediaFavorite[]>(MEDIA_FAVORITES_KEY, []);

  const isMediaFavorite = useCallback((url: string) => 
    mediaFavorites.some(fav => fav.url === url), 
  [mediaFavorites]);

  const toggleMediaFavorite = useCallback((item: MediaFavorite) => {
    setMediaFavorites(prev => {
      const isFavorited = prev.some(fav => fav.url === item.url);
      if (isFavorited) {
        return prev.filter(fav => fav.url !== item.url);
      } else {
        return [item, ...prev]; // Add to the beginning of the list
      }
    });
  }, [setMediaFavorites]);
  
  const resetMediaFavorites = useCallback(() => {
    setMediaFavorites([]);
  }, [setMediaFavorites]);

  return { mediaFavorites, toggleMediaFavorite, isMediaFavorite, resetMediaFavorites };
};
