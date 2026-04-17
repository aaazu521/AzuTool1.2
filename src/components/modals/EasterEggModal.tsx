import React from 'react';
import { isColorLight } from '../../utils/colorUtils';

interface EasterEggModalProps {
  onClose: () => void;
  themeColor: string;
}

const EasterEggModal: React.FC<EasterEggModalProps> = ({ onClose, themeColor }) => {
  const modalButtonTextColor = isColorLight(themeColor) ? '#1e293b' : '#ffffff';
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div 
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center font-sans"
      onClick={onClose}
    >
      <div 
        onClick={stopPropagation}
        className="relative w-full max-w-sm bg-slate-800/80 backdrop-blur-lg border border-[var(--theme-color)] rounded-2xl shadow-2xl p-6 m-4 animate-fade-in-down text-center"
      >
        <h3 className="text-xl font-bold text-[var(--theme-color)] mb-4">恭喜您！</h3>
        <p className="text-slate-200 mb-6">发现隐藏功能彩蛋，会在设置里生成一个子设置“隐藏功能”。</p>
        <button
          onClick={onClose}
          className="px-6 py-2 font-bold bg-[var(--theme-color)] rounded-md hover:brightness-110 transition-all"
          style={{ color: modalButtonTextColor }}
        >
          关闭
        </button>
      </div>
    </div>
  );
};

export default EasterEggModal;