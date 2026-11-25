import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { ARCADE_COLORS, ArcadeDelta, ArcadePlayer } from '../../types/arcade';

interface ArcadeSeriesOverlayProps {
  players: ArcadePlayer[];
  seriesScores: Record<string, number>;
  roundDeltas: ArcadeDelta[];
  roundNum: number;
  totalRounds: number;
  headline: string;
  extraRows?: Array<{ playerId: string; badge: string }>;
  durationMs?: number;
}

export const ArcadeSeriesOverlay: React.FC<ArcadeSeriesOverlayProps> = ({
  players,
  seriesScores,
  roundDeltas,
  roundNum,
  totalRounds,
  headline,
  extraRows,
  durationMs = 3000,
}) => {
  const [barShrink, setBarShrink] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setBarShrink(true), 40);
    return () => window.clearTimeout(t);
  }, []);

  const deltaMap = new Map(roundDeltas.map((d) => [d.playerId, d.delta]));
  const extraMap = new Map((extraRows ?? []).map((r) => [r.playerId, r.badge]));
  const hasWinner = roundDeltas.some((d) => d.delta > 0);

  const sorted = [...players].sort(
    (a, b) => (seriesScores[b.id] ?? 0) - (seriesScores[a.id] ?? 0)
  );

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#1E293B]/55 dark:bg-[#020617]/75 backdrop-blur-sm select-none"
    >
      <div className="w-full max-w-sm rounded-3xl qada-card p-5 shadow-2xl text-center">
        <div className="text-xs font-extrabold text-[#0D9488] dark:text-[#2DD4BF] tabular-nums mb-1">
          انتهت الجولة {roundNum} من {totalRounds}
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-[#F59E0B] shrink-0" />
          <h2 className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-[#F8FAFC] leading-snug">
            {headline}
          </h2>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {sorted.map((p) => {
            const theme = ARCADE_COLORS[p.colorId];
            const pts = seriesScores[p.id] ?? 0;
            const gained = deltaMap.get(p.id) ?? 0;
            const extra = extraMap.get(p.id);
            const showHardluck = hasWinner && gained <= 0;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] border-2 border-[#E7DEC8] dark:border-[#334155] px-3.5 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    style={{ backgroundColor: theme.hex }}
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm shrink-0"
                  />
                  <span className="text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] truncate">
                    {p.name}
                  </span>
                  {extra && (
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] tabular-nums shrink-0">
                      ({extra})
                    </span>
                  )}
                  {showHardluck && (
                    <span className="animate-hardluck-shake inline-block rounded-lg bg-[#FEE2E2] dark:bg-[#451A2B] border border-[#FECACA] dark:border-[#881337] px-1.5 py-0.5 text-[10px] font-black text-[#BE123C] dark:text-[#FDA4AF] shrink-0">
                      هاردلك! 😅
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  {gained > 0 && (
                    <span className="text-xs font-black text-[#059669] dark:text-[#34D399]">
                      +{gained}
                    </span>
                  )}
                  <span className="text-base font-black text-[#D94E30] dark:text-[#FF8C73]">
                    {pts} ن
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8] mb-2">
          الجولة الجاية هتبدأ تلقائياً...
        </div>
        <div className="w-full h-2.5 rounded-full bg-[#F1E8DA] dark:bg-[#0F172A] overflow-hidden">
          <div
            style={{
              transitionDuration: `${durationMs}ms`,
              width: barShrink ? '0%' : '100%',
            }}
            className="h-full bg-[#10B981] transition-[width] ease-linear"
          />
        </div>
      </div>
    </div>
  );
};
