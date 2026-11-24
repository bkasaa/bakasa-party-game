import React, { useEffect, useState } from 'react';
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { useGoHome } from '../contexts/NavigationContext';
import { soundManager } from '../utils/soundManager';
import { HomeLogoBadge } from './HomeLogoBadge';

interface TopBarProps {
  title: string;
  onExit?: () => void;
  exitVariant?: 'home' | 'back';
  exitLabel?: string;
  showHomeBadge?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onExit,
  exitVariant = 'back',
  exitLabel,
  showHomeBadge = true,
}) => {
  const goHome = useGoHome();
  const [muted, setMuted] = useState(() => soundManager.isMuted());

  useEffect(() => {
    return soundManager.subscribe(setMuted);
  }, []);

  const handleMuteToggle = () => {
    soundManager.unlock();
    soundManager.toggleMute();
  };

  return (
    <header className="w-full max-w-xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between gap-2">
      <div className="min-w-[48px] flex items-center justify-start gap-2 shrink-0">
        {onExit && exitVariant === 'home' && (
          <HomeLogoBadge onClick={onExit} label={exitLabel || 'إنهاء اللعبة'} />
        )}

        {onExit && exitVariant === 'back' && (
          <button
            type="button"
            onClick={() => {
              soundManager.unlock();
              soundManager.play('click');
              onExit();
            }}
            aria-label={exitLabel || 'رجوع'}
            className="min-w-[44px] min-h-[44px] rounded-2xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] active:scale-95 border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 border-b-[#D5C7B2] dark:border-b-[#0B1120] flex items-center justify-center text-[#1E293B] dark:text-[#F8FAFC] shadow-sm transition-all"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        )}

        {exitVariant !== 'home' && showHomeBadge && goHome && (
          <HomeLogoBadge onClick={goHome} label="القائمة الرئيسية" />
        )}
      </div>

      <h1 className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-[#F8FAFC] text-center truncate tracking-tight">
        {title}
      </h1>

      <div className="min-w-[48px] flex justify-end shrink-0">
        <button
          type="button"
          onClick={handleMuteToggle}
          aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          className={`min-w-[44px] min-h-[44px] rounded-2xl border-2 border-b-4 flex items-center justify-center shadow-sm transition-all active:scale-95 ${
            muted
              ? 'bg-[#FFF1F2] dark:bg-[#4C0519] border-[#FECDD3] dark:border-[#9F1239] border-b-[#FDA4AF] dark:border-b-[#881337] text-[#E11D48] dark:text-[#FDA4AF] hover:bg-[#FFE4E6]'
              : 'bg-white dark:bg-[#1E293B] border-[#E7DEC8] dark:border-[#334155] border-b-[#D5C7B2] dark:border-b-[#0B1120] text-[#1E293B] dark:text-[#F8FAFC] hover:bg-[#FFF5E8] dark:hover:bg-[#334155]'
          }`}
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
};
