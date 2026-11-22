import React, { useEffect, useState } from 'react';
import { ArrowRight, Home, Volume2, VolumeX } from 'lucide-react';
import { soundManager } from '../utils/soundManager';

interface TopBarProps {
  title: string;
  onExit?: () => void;
  exitVariant?: 'home' | 'back';
  exitLabel?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onExit,
  exitVariant = 'back',
  exitLabel,
}) => {
  const [muted, setMuted] = useState(() => soundManager.isMuted());

  useEffect(() => {
    return soundManager.subscribe(setMuted);
  }, []);

  const handleMuteToggle = () => {
    soundManager.unlock();
    soundManager.toggleMute();
  };

  return (
    <header className="w-full max-w-xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between gap-3">
      <div className="w-12 flex justify-start shrink-0">
        {onExit && (
          <button
            type="button"
            onClick={() => {
              soundManager.unlock();
              soundManager.play('click');
              onExit();
            }}
            aria-label={exitLabel || (exitVariant === 'home' ? 'إنهاء اللعبة' : 'رجوع')}
            className="min-w-[44px] min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 flex items-center justify-center text-white transition-all"
          >
            {exitVariant === 'home' ? (
              <Home className="w-5 h-5" />
            ) : (
              <ArrowRight className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      <h1 className="text-xl sm:text-2xl font-black text-white text-center truncate tracking-tight drop-shadow">
        {title}
      </h1>

      <div className="w-12 flex justify-end shrink-0">
        <button
          type="button"
          onClick={handleMuteToggle}
          aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          className={`min-w-[44px] min-h-[44px] rounded-2xl border flex items-center justify-center transition-all active:scale-95 ${
            muted
              ? 'bg-red-500/20 border-red-400/40 text-red-200 hover:bg-red-500/30'
              : 'bg-white/10 border-white/15 text-white hover:bg-white/20'
          }`}
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
};
