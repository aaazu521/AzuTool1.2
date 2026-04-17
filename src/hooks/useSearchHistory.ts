import { useCallback } from 'react';
import useLocalStorage from './useLocalStorage';

const SEARCH_HISTORY_KEY = 'pump_app_search_history';
const MAX_HISTORY_SIZE = 50;

export const useSearchHistory = () => {
    const [searchHistory, setSearchHistory] = useLocalStorage<string[]>(SEARCH_HISTORY_KEY, []);

    const addSearchTerm = useCallback((term: string) => {
        const trimmedTerm = term.trim();
        if (!trimmedTerm) return;

        setSearchHistory(prevHistory => {
            // Remove any existing instance of the term to move it to the top
            const filteredHistory = prevHistory.filter(item => item !== trimmedTerm);
            // Add the new term to the beginning
            const newHistory = [trimmedTerm, ...filteredHistory];
            // Limit the history size
            return newHistory.slice(0, MAX_HISTORY_SIZE);
        });
    }, [setSearchHistory]);

    const clearSearchHistory = useCallback(() => {
        setSearchHistory([]);
    }, [setSearchHistory]);

    return { searchHistory, addSearchTerm, clearSearchHistory };
};