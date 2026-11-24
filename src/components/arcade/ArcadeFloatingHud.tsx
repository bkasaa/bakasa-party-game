import React, { useEffect, useState } from 'react';
import { Music, Volume2, VolumeX, X } from 'lucide-react';
import { soundManager } from '../../utils/soundManager';

interface ArcadeFloatingHudProps {
  secondsLeft: number;
  stageLabel?: string;
  muted: boolean;
  onRequestExit: () => void;
}

export const ArcadeFloatingHud: React.FC<ArcadeFloatingHudProps> = ({
  secondsLeft,
  stageLabel,
  muted,
  onRequestExit,
}) => {
  const [musicMuted, setMusicMuted] = useState<boolean>(() => soundManager.isMusicMuted());

  useEffect(() => {
    return soundManager.subscribeMusic(setMusicMuted);
  }, []);

  return (
    <div
      dir="rtl"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.42)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      className="pointer-events-none fixed top-[6px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 shadow-md max-w-[calc(100vw-180px)]"
    >
      <button
        type="button"
        aria-label="خروج"
        onClick={() => {
          soundManager.play('click');
          onRequestExit();
        }}
        className="pointer-events-auto w-6 h-6 shrink-0 rounded-full bg-white/10 hover:bg-rose-500/45 text-white/85 hover:text-white flex items-center justify-center transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="pointer-events-none px-1 flex items-center gap-1 text-[11px] sm:text-xs font-black tabular-nums select-none min-w-0">
        {stageLabel && (
          <>
            <span className="text-amber-300 truncate">{stageLabel}</span>
            <span className="text-white/30">·</span>
          </>
        )}
        <span
          className={`shrink-0 ${
            secondsLeft <= 5 ? 'text-rose-400' : 'text-emerald-300'
          }`}
        >
          {secondsLeft}ث
        </span>
      </div>

      <button
        type="button"
        aria-label={musicMuted ? 'تشغيل الموسيقى' : 'كتم الموسيقى'}
        onClick={() => {
          soundManager.unlock();
          soundManager.toggleMusicMute();
        }}
        className={`pointer-events-auto w-6 h-6 shrink-0 rounded-full flex items-center justify-center transition-colors ${
          musicMuted
            ? 'bg-white/5 text-white/40 hover:bg-white/20'
            : 'bg-white/15 text-amber-300 hover:bg-white/25'
        }`}
      >
        <Music className="w-3 h-3" />
      </button>

      <button
        type="button"
        aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
        onClick={() => {
          soundManager.unlock();
          soundManager.toggleMute();
        }}
        className="pointer-events-auto w-6 h-6 shrink-0 rounded-full bg-white/10 hover:bg-white/25 text-white/85 hover:text-white flex items-center justify-center transition-colors"
      >
        {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};
