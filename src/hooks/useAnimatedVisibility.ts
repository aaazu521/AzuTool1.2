import { useState, useEffect } from 'react';

// Custom hook for smooth animated mounting/unmounting
export const useAnimatedVisibility = (isOpen: boolean, duration: number = 300) => {
    const [isRendered, setIsRendered] = useState(isOpen);

    useEffect(() => {
        if (isOpen) {
            setIsRendered(true);
        } else {
            const timer = setTimeout(() => setIsRendered(false), duration);
            return () => clearTimeout(timer);
        }
    }, [isOpen, duration]);

    return isRendered;
};