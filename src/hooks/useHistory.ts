import { useCallback } from 'react';
import useLocalStorage from './useLocalStorage';

const VISITED_URLS_KEY = 'pump_app_visited_urls';

export const useHistory = () => {
    const [visitedUrls, setVisitedUrls] = useLocalStorage<string[]>(VISITED_URLS_KEY, []);
    const visitedUrlsSet = new Set(visitedUrls);
    
    const handleMarkAsVisited = useCallback((url: string) => {
        if (!visitedUrlsSet.has(url)) {
            setVisitedUrls(prev => [...prev, url]);
        }
    }, [visitedUrlsSet, setVisitedUrls]);

    const resetHistory = useCallback(() => {
        setVisitedUrls([]);
    }, [setVisitedUrls]);

    return { visitedUrls: visitedUrlsSet, handleMarkAsVisited, resetHistory };
};