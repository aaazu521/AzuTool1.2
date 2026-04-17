import React, { useEffect } from 'react';

const SakuraEffect: React.FC = () => {
  useEffect(() => {
    const sakuraContainer = document.getElementById('sakura-container');
    if (!sakuraContainer) return;

    // Clear any existing petals before adding new ones
    sakuraContainer.innerHTML = '';

    const numPetals = 50;

    for (let i = 0; i < numPetals; i++) {
        const petal = document.createElement('div');
        petal.className = 'petal';

        // Randomize properties for each petal
        const startPosition = Math.random() * 100;
        const duration = Math.random() * 8 + 7; // 7s to 15s
        const delay = Math.random() * 10;
        const size = Math.random() * 6 + 5; // 5px to 11px
        const sway = Math.random() * 200 - 100; // Sway from -100px to +100px
        const rotation = Math.random() * 720; // Rotate up to 2 full circles

        petal.style.left = `${startPosition}vw`;
        petal.style.animationDuration = `${duration}s`;
        petal.style.animationDelay = `${delay}s`;
        petal.style.width = `${size}px`;
        petal.style.height = `${size}px`;
        petal.style.opacity = '0'; // Start with opacity 0, animation will make it visible
        petal.style.setProperty('--sway', `${sway}px`);
        petal.style.setProperty('--rotation', `${rotation}deg`);

        // Change color slightly for variation
        const hue = 340 + Math.random() * 20; // Pinks around 340-360 deg
        const lightness = 85 + Math.random() * 10; // 85% to 95%
        petal.style.background = `hsl(${hue}, 100%, ${lightness}%)`;
        petal.style.boxShadow = `0 0 8px hsl(${hue}, 100%, ${lightness}%, 0.7)`;

        sakuraContainer.appendChild(petal);
    }

    // Cleanup function to remove petals when component unmounts
    return () => {
        if (sakuraContainer) {
            sakuraContainer.innerHTML = '';
        }
    };
  }, []); // Empty dependency array means this runs once on mount

  return null; // This component doesn't render anything itself
};

export default SakuraEffect;
