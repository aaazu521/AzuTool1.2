import React, { useEffect, useState } from 'react';
import { CheckCircleIcon } from './Icons';

interface ToastProps {
  message: string;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setIsVisible(true);

    // Set timers for auto-close
    const closeTimer = setTimeout(() => {
      setIsVisible(false); // Animate out
    }, 2500); // Start fade out after 2.5s

    const unmountTimer = setTimeout(() => {
      onClose(); // Unmount component after animation
    }, 3000); // 2500ms + 500ms for animation

    return () => {
      clearTimeout(closeTimer);
      clearTimeout(unmountTimer);
    };
  }, [message, onClose]);

  return (
    <div
      className={`fixed top-5 right-5 z-[9999] transition-all duration-500 ease-in-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur-lg border border-green-500/50 rounded-lg shadow-2xl px-4 py-3 text-white">
        <CheckCircleIcon />
        <span className="font-sans font-medium">{message}</span>
      </div>
    </div>
  );
};

export default Toast;