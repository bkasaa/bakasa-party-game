import React from 'react';
import { soundManager } from '../utils/soundManager';

interface HomeLogoBadgeProps {
  onClick: () => void;
  label?: string;
}

export const HomeLogoBadge: React.FC<HomeLogoBadgeProps> = ({
  onClick,
  label = 'القائمة الرئيسية',
}) => {
  return (
    <button
      type="button"
      onClick={() => {
        soundManager.unlock();
        soundManager.play('click');
        onClick();
      }}
      aria-label={label}
      title={label}
      className="w-9 h-9 rounded-xl overflow-hidden border-2 border-amber-400/50 shadow-sm active:scale-90 transition-transform bg-[#FEF6E1] shrink-0 flex items-center justify-center"
    >
      <img
        src="/app-icon.png"
        alt="قعدة الشلة"
        className="w-full h-full object-cover pointer-events-none select-none animate-float-icon"
      />
    </button>
  );
};
