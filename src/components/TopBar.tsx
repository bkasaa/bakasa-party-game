import React, { useEffect, useState } from 'react';
import { ArrowRight, Home, LogOut, Settings, Volume2, VolumeX } from 'lucide-react';
import { useGoHome, useOpenSettings } from '../contexts/NavigationContext';
import { soundManager } from '../utils/soundManager';

interface TopBarProps {
  title: string;
  onExit?: () => void;
  exitVariant?: 'home' | 'back' | 'exit';
  exitLabel?: string;
  showHomeBadge?: boolean;
  showSettingsButton?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onExit,
  exitVariant = 'back',
  exitLabel,
  showHomeBadge = true,
  showSettingsButton = false,
}) => {
  const goHome = useGoHome();
  const openSettings = useOpenSettings();
  const [muted, setMuted] = useState(() => soundManager.isMuted());

  useEffect(() => {
    return soundManager.subscribe(setMuted);
  }, []);

  const handleMuteToggle = () => {
    soundManager.unlock();
    soundManager.toggleMute();
  };

  return (
    <header className="w-full max-w-2xl mx-auto px-3 sm:px-4 pt-3.5 pb-2 flex items-center justify-between gap-2">
      <div className="flex items-center justify-start gap-1.5 shrink-0">
        {onExit && exitVariant === 'home' && (
          <button
            type="button"
            onClick={() => {
              soundManager.unlock();
              soundManager.play('click');
              onExit();
            }}
            aria-label={exitLabel || 'الرئيسية'}
            className="min-h-[42px] px-3 rounded-2xl qada-glass-pill hover:brightness-105 active:scale-95 flex items-center gap-1.5 text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] whitespace-nowrap shrink-0"
          >
            <Home className="w-4 h-4 text-[#FF6B4A]" />
            <span>{exitLabel || 'الرئيسية'}</span>
          </button>
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
            className="min-h-[42px] px-2.5 sm:px-3 rounded-2xl qada-glass-pill hover:brightness-105 active:scale-95 flex items-center gap-1 text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] whitespace-nowrap shrink-0"
          >
            <ArrowRight className="w-4 h-4 shrink-0" />
            <span>{exitLabel || 'رجوع'}</span>
          </button>
        )}

        {onExit && exitVariant === 'exit' && (
          <button
            type="button"
            onClick={() => {
              soundManager.unlock();
              soundManager.play('click');
              onExit();
            }}
            aria-label={exitLabel || 'خروج'}
            className="min-h-[42px] px-3 rounded-2xl bakasa-btn-red text-white active:scale-95 flex items-center gap-1.5 text-xs sm:text-sm font-black whitespace-nowrap shrink-0"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>{exitLabel || 'خروج'}</span>
          </button>
        )}

        {exitVariant === 'back' && showHomeBadge && goHome && (
          <button
            type="button"
            onClick={() => {
              soundManager.unlock();
              soundManager.play('click');
              goHome();
            }}
            aria-label="الرئيسية"
            className="min-h-[42px] px-2.5 sm:px-3 rounded-2xl qada-glass-pill hover:brightness-105 active:scale-95 flex items-center gap-1 text-xs sm:text-sm font-black text-[#0D9488] dark:text-[#2DD4BF] whitespace-nowrap shrink-0"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline sm:inline">الرئيسية</span>
          </button>
        )}
      </div>

      <h1 className="text-base sm:text-xl font-black text-[#1E293B] dark:text-[#F8FAFC] text-center truncate tracking-tight min-w-0">
        {title}
      </h1>

      <div className="flex items-center justify-end gap-1.5 shrink-0">
        {showSettingsButton && openSettings && (
          <button
            type="button"
            onClick={() => {
              soundManager.unlock();
              soundManager.play('click');
              openSettings();
            }}
            aria-label="الإعدادات"
            className="min-w-[42px] min-h-[42px] rounded-2xl qada-glass-pill hover:brightness-105 active:scale-95 flex items-center justify-center text-[#1E293B] dark:text-[#F8FAFC]"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={handleMuteToggle}
          aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          className={`min-w-[42px] min-h-[42px] rounded-2xl border-2 border-b-4 flex items-center justify-center shadow-sm transition-all active:scale-95 ${
            muted
              ? 'bg-[#FFF1F2] dark:bg-[#4C0519] border-[#FECDD3] dark:border-[#9F1239] border-b-[#FDA4AF] dark:border-b-[#881337] text-[#E11D48] dark:text-[#FDA4AF] hover:bg-[#FFE4E6]'
              : 'qada-glass-pill text-[#1E293B] dark:text-[#F8FAFC] hover:brightness-105'
          }`}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
