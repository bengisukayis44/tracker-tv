import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for synchronizing state with LocalStorage.
 * @param {string} key - LocalStorage key
 * @param {*} initialValue - Default value if key is not found
 * @returns {[*, Function]} State and state setter
 */
export function useLocalStorage(key, initialValue) {
    // Pass initial state function to useState so logic is only executed once
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            // Parse stored json or if none return initialValue
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading LocalStorage key "${key}":`, error);
            return initialValue;
        }
    });

    // Persist every change; runs after React has applied all queued updates
    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(storedValue));
        } catch (error) {
            console.error(`Error setting LocalStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    // Functional updates receive the latest state, so rapid successive calls are not lost
    const setValue = useCallback((value) => {
        setStoredValue(prev => (value instanceof Function ? value(prev) : value));
    }, []);

    return [storedValue, setValue];
}
