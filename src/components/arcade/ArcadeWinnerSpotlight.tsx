import React, { useEffect, useMemo } from 'react';
import { Sparkles, Trophy } from 'lucide-react';
import { ARCADE_COLORS, ArcadePlayer } from '../../types/arcade';
import { formatNumber } from '../../utils/formatNumber';
import { soundManager, triggerHaptic } from '../../utils/soundManager';

interface ArcadeWinnerSpotlightProps {
  winners: ArcadePlayer[];
  seriesScores: Record<string, number>;
  headline: string;
  onContinueToLeaderboard: () => void;
}

const CONFETTI_COLORS = ['#FACC15', '#FFFFFF', '#38BDF8', '#FB7185', '#34D399', '#F97316'];

export const ArcadeWinnerSpotlight: React.FC<ArcadeWinnerSpotlightProps> = ({
  winners,
  seriesScores,
  headline,
  onContinueToLeaderboard,
}) => {
  const primaryWinner = winners[0];
  const winnerTheme = primaryWinner ? ARCADE_COLORS[primaryWinner.colorId] : null;
  const primaryHex = winnerTheme?.hex ?? '#F59E0B';
  const darkHex = winnerTheme?.darkHex ?? '#B45309';

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        leftPct: 6 + ((i * 43) % 88),
        delayMs: (i % 7) * 140,
        durationMs: 1850 + (i % 4) * 320,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        sizeW: 7 + (i % 3) * 3,
        sizeH: 12 + (i % 4) * 3,
      })),
    []
  );

  useEffect(() => {
    soundManager.stopMusic();
    soundManager.play('victory');
    triggerHaptic([40, 50, 90]);

    const t = window.setTimeout(() => {
      onContinueToLeaderboard();
    }, 3000);

    return () => window.clearTimeout(t);
  }, [onContinueToLeaderboard]);

  return (
    <div
      dir="rtl"
      onClick={onContinueToLeaderboard}
      style={{
        background: `radial-gradient(circle at 50% 42%, ${primaryHex} 0%, ${darkHex} 58%, #090F1E 100%)`,
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-5 text-center overflow-hidden select-none cursor-pointer"
    >
      {/* Rotating Sunburst Rays */}
      <div
        aria-hidden="true"
        style={{
          background:
            'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.16) 0deg 12deg, transparent 12deg 28deg)',
        }}
        className="pointer-events-none absolute w-[190vmax] h-[190vmax] rounded-full animate-spotlight-spin opacity-80"
      />

      {/* Subtle Confetti Shower (~1.8s, non-blocking) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {confettiPieces.map((c) => (
          <span
            key={c.id}
            style={{
              left: `${c.leftPct}%`,
              top: '-24px',
              width: `${c.sizeW}px`,
              height: `${c.sizeH}px`,
              backgroundColor: c.color,
              animation: `confetti-fall ${Math.min(1800, c.durationMs)}ms linear ${Math.min(250, c.delayMs)}ms forwards`,
            }}
            className="pointer-events-none absolute rounded-sm opacity-0 shadow-sm"
          />
        ))}
      </div>

      {/* Main Spotlight Champion Card */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Dropping Animated Crown */}
        <div className="animate-crown-drop mb-2 drop-shadow-[0_10px_18px_rgba(0,0,0,0.4)]">
          <svg viewBox="0 0 96 72" className="w-24 h-20" aria-hidden="true">
            <path
              d="M12 58 L6 20 L30 36 L48 10 L66 36 L90 20 L84 58 Z"
              fill="#FACC15"
              stroke="#1E293B"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            <rect
              x="10"
              y="55"
              width="76"
              height="12"
              rx="6"
              fill="#F59E0B"
              stroke="#1E293B"
              strokeWidth="4"
            />
            <circle cx="48" cy="10" r="6" fill="#FEF08A" stroke="#1E293B" strokeWidth="3.2" />
            <circle cx="7" cy="19" r="5" fill="#FEF08A" stroke="#1E293B" strokeWidth="3" />
            <circle cx="89" cy="19" r="5" fill="#FEF08A" stroke="#1E293B" strokeWidth="3" />
            <circle cx="48" cy="43" r="5.5" fill="#EF4444" stroke="#1E293B" strokeWidth="2.5" />
            <circle cx="30" cy="46" r="4" fill="#38BDF8" stroke="#1E293B" strokeWidth="2.2" />
            <circle cx="66" cy="46" r="4" fill="#10B981" stroke="#1E293B" strokeWidth="2.2" />
          </svg>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-black/55 border border-white/30 px-3.5 py-1 text-xs font-black text-amber-200 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{winners.length > 1 ? 'أبطال التحدي!' : 'بطل السلسلة!'}</span>
        </div>

        <div className="w-full rounded-3xl bg-white/95 dark:bg-[#0F172A]/95 border-2 border-white dark:border-[#334155] border-b-[6px] border-b-black/25 p-5 shadow-2xl animate-splash-pop">
          {winners.length > 0 ? (
            <div className="flex flex-col gap-2.5 items-center mb-3">
              {winners.map((w) => {
                const wt = ARCADE_COLORS[w.colorId];
                const pts = seriesScores[w.id] ?? 0;
                return (
                  <div
                    key={w.id}
                    style={{ backgroundColor: wt.hex, color: wt.textOnColor }}
                    className="w-full rounded-2xl border-2 border-black/15 px-4 py-3 flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Trophy className="w-6 h-6 shrink-0 drop-shadow-sm" />
                      <span className="text-xl sm:text-2xl font-black truncate">{w.name}</span>
                    </div>
                    <span className="text-base font-black tabular-nums shrink-0 bg-black/20 px-2.5 py-1 rounded-xl">
                      {formatNumber(pts)} نقطة
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-3 text-xl font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center justify-center gap-2">
              <Trophy className="w-6 h-6 text-[#F59E0B]" />
              <span>انتهى التحدي!</span>
            </div>
          )}

          <p className="text-sm font-extrabold text-[#475569] dark:text-[#CBD5E1] leading-snug mb-4">
            {headline}
          </p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundManager.play('next');
              onContinueToLeaderboard();
            }}
            className="w-full min-h-[48px] rounded-2xl bakasa-btn-green text-white text-base font-black transition-transform"
          >
            عرض الترتيب النهائي 🏆
          </button>
        </div>
      </div>
    </div>
  );
};
