import React, { useCallback, useEffect, useRef } from 'react';

export const ClickParticles: React.FC = () => {
    // Refs to hold timer IDs, mouse position, and long-press state
    const longPressTimerRef = useRef<number | null>(null);
    const particleIntervalRef = useRef<number | null>(null);
    const mousePosRef = useRef({ x: 0, y: 0 });
    const isLongPressActiveRef = useRef(false);
    
    const createParticleAtPosition = useCallback((x: number, y: number, isLongPress: boolean) => {
        const particle = document.createElement('div');
        particle.className = 'particle';
        document.body.appendChild(particle);

        const size = Math.random() * (isLongPress ? 2 : 4) + 2; // Long press particles are smaller
        const angle = Math.random() * 360;
        const distance = Math.random() * (isLongPress ? 40 : 70) + 40; // Long press particles travel less

        particle.style.setProperty('--x', `${x}px`);
        particle.style.setProperty('--y', `${y}px`);
        particle.style.setProperty('--size', `${size}px`);
        particle.style.setProperty('--angle', `${angle}deg`);
        particle.style.setProperty('--distance', `${distance}px`);

        if (Math.random() > 0.7) {
            particle.classList.add('particle--alt');
        }

        particle.addEventListener('animationend', () => {
            particle.remove();
        });
    }, []);

    const createParticleBurst = useCallback((e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, a, input, [role="button"]')) {
            return;
        }
        const { clientX, clientY } = e;
        const particleCount = 15;
        for (let i = 0; i < particleCount; i++) {
            createParticleAtPosition(clientX, clientY, false);
        }
    }, [createParticleAtPosition]);
    
    const createContinuousParticles = useCallback(() => {
        const { x, y } = mousePosRef.current;
        createParticleAtPosition(x, y, true);
    }, [createParticleAtPosition]);
    
    const handleMouseMove = useCallback((e: MouseEvent) => {
        mousePosRef.current = { x: e.clientX, y: e.clientY };
    }, []);

    const clearTimers = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        if (particleIntervalRef.current) {
            clearInterval(particleIntervalRef.current);
            particleIntervalRef.current = null;
        }
    }, []);

    const handleMouseDown = useCallback((e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, a, input, [role="button"]')) {
            return;
        }
        
        isLongPressActiveRef.current = false;
        mousePosRef.current = { x: e.clientX, y: e.clientY };
        document.addEventListener('mousemove', handleMouseMove);

        longPressTimerRef.current = window.setTimeout(() => {
            isLongPressActiveRef.current = true;
            particleIntervalRef.current = window.setInterval(createContinuousParticles, 50);
        }, 200);
    }, [handleMouseMove, createContinuousParticles]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        clearTimers();
        document.removeEventListener('mousemove', handleMouseMove);
        
        if (!isLongPressActiveRef.current) {
            createParticleBurst(e);
        }
        isLongPressActiveRef.current = false;
    }, [clearTimers, createParticleBurst, handleMouseMove]);
    
    useEffect(() => {
        document.body.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            document.body.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mousemove', handleMouseMove);
            clearTimers();
        };
    }, [handleMouseDown, handleMouseUp, handleMouseMove, clearTimers]);

    return null;
};
