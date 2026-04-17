import { useCallback } from 'react';
import useLocalStorage from './useLocalStorage';
import type { Website } from '../types';

const FAVORITES_KEY = 'pump_app_favorites';

export const useFavorites = () => {
  const [favorites, setFavorites] = useLocalStorage<Website[]>(FAVORITES_KEY, []);

  const isFavorite = useCallback((websiteUrl: string) => favorites.some(fav => fav.url === websiteUrl), [favorites]);

  const handleToggleFavorite = useCallback((websiteToToggle: Website) => {
    setFavorites(prevFavorites => {
      const isFavorited = prevFavorites.some(fav => fav.url === websiteToToggle.url);
      if (isFavorited) {
        return prevFavorites.filter(fav => fav.url !== websiteToToggle.url);
      } else {
        return [...prevFavorites, websiteToToggle];
      }
    });
  }, [setFavorites]);
  
  const handleBatchFavorite = useCallback((websitesToFavorite: Website[]) => {
    setFavorites(prev => {
      const newFavoritesMap = new Map(prev.map(f => [f.url, f]));
      websitesToFavorite.forEach(w => newFavoritesMap.set(w.url, w));
      return Array.from(newFavoritesMap.values());
    });
  }, [setFavorites]);

  const resetFavorites = useCallback(() => {
    setFavorites([]);
  }, [setFavorites]);

  return { favorites, setFavorites, isFavorite, handleToggleFavorite, handleBatchFavorite, resetFavorites };
};