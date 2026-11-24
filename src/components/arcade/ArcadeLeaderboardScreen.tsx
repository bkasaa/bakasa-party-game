import React, { useEffect, useState } from 'react';
import { Check, Copy, Trophy } from 'lucide-react';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { ARCADE_COLORS, ArcadeDelta, ArcadePlayer } from '../../types/arcade';
import { computeArcadeTitles, copyTextToClipboard } from '../../utils/sessionStats';
import { soundManager, triggerHaptic } from '../../utils/soundManager';

interface ArcadeLeaderboardScreenProps {
  players: ArcadePlayer[];
  deltas: ArcadeDelta[];
  summaryHeadline: string;
  extraContent?: React.ReactNode;
  onNewRound: () => void;
  onBackToArcadeHub: () => void;
}

export const ArcadeLeaderboardScreen: React.FC<ArcadeLeaderboardScreenProps> = ({
  players,
  deltas,
  summaryHeadline,
  extraContent,
  onNewRound,
  onBackToArcadeHub,
}) => {
  const guard = useTapGuard(400);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(t);
  }, [copied]);

  const deltaMap = new Map(deltas.map((d) => [d.playerId, d.delta]));

  const sortedPlayers = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (deltaMap.get(b.id) ?? 0) - (deltaMap.get(a.id) ?? 0);
  });

  const arcadeTitles = computeArcadeTitles(sortedPlayers);

  const handleCopySummary = async () => {
    const medals = ['🥇', '🥈', '🥉'];
    const lines: string[] = ['🏆 *نتائج قعدة الشلة (تحدي 2D)* 🏆'];
    if (summaryHeadline) {
      lines.push(`🏆 ${summaryHeadline}`);
    }
    lines.push('');
    sortedPlayers.forEach((p, idx) => {
      const rankMark = medals[idx] ?? `${idx + 1}.`;
      const title = arcadeTitles[p.id] ? ` (${arcadeTitles[p.id]})` : '';
      lines.push(`${rankMark} ${p.name}: ${p.score} نقطة${title}`);
    });
    const ok = await copyTextToClipboard(lines.join('\n'));
    if (ok) {
      soundManager.play('click');
      triggerHaptic(25);
      setCopied(true);
    } else {
      soundManager.play('error');
    }
  };

  const hasAnyPositiveDelta = deltas.some((d) => d.delta > 0);

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-8 pt-2 flex flex-col items-center">
      <div className="w-full rounded-3xl qada-card px-4 py-3 text-center mb-4 flex items-center justify-center gap-2">
        <Trophy className="w-5 h-5 text-[#F59E0B] shrink-0" />
        <p className="text-sm sm:text-base font-black text-[#1E293B] dark:text-[#F8FAFC]">
          {summaryHeadline}
        </p>
      </div>

      {extraContent && <div className="w-full mb-5">{extraContent}</div>}

      <div className="w-full flex flex-col gap-3 mb-5">
        {sortedPlayers.map((player, index) => {
          const theme = ARCADE_COLORS[player.colorId];
          const delta = deltaMap.get(player.id) ?? 0;
          const funTitle = arcadeTitles[player.id];
          const showHardluck = hasAnyPositiveDelta && delta <= 0 && index > 0;

          return (
            <div
              key={player.id}
              className={`w-full min-h-[68px] rounded-2xl ${theme.bgClass} ${theme.shadowClass} border ${theme.borderClass} px-4 py-2.5 flex items-center justify-between gap-3`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-black/25 border-2 border-white/75 flex items-center justify-center text-white font-black text-base tabular-nums shrink-0">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      style={{ color: theme.textOnColor }}
                      className="text-lg font-black truncate"
                    >
                      {player.name}
                    </span>
                    {funTitle && (
                      <span className="rounded-lg bg-white/95 border border-white px-2 py-0.5 text-[11px] font-black text-[#1E293B] whitespace-nowrap shadow-sm">
                        {funTitle}
                      </span>
                    )}
                    {showHardluck && (
                      <span className="animate-hardluck-shake inline-block rounded-lg bg-white/95 border border-white px-2 py-0.5 text-[11px] font-black text-[#BE123C] whitespace-nowrap shadow-sm">
                        هاردلك! 😅
                      </span>
                    )}
                  </div>
                  {delta > 0 && (
                    <div
                      style={{ color: theme.textOnColor }}
                      className="text-xs font-extrabold opacity-90 tabular-nums"
                    >
                      +{delta} نقطة في الدور ده
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-center leading-tight pl-1">
                <div
                  style={{ color: theme.textOnColor }}
                  className="text-xl font-black tabular-nums"
                >
                  {player.score}
                </div>
                <div
                  style={{ color: theme.textOnColor }}
                  className="text-xs font-bold opacity-90"
                >
                  نقطة
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleCopySummary}
        className="w-full max-w-[280px] min-h-[48px] mb-4 rounded-2xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 border-b-[#D5C7B2] dark:border-b-[#090F1E] text-[#1E293B] dark:text-[#F8FAFC] text-sm font-black flex items-center justify-center gap-2 transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-[#059669] dark:text-[#34D399]" />
            <span className="text-[#059669] dark:text-[#34D399]">
              تم النسخ! ابعتها على الواتساب
            </span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 text-[#D97706] dark:text-[#FBBF24]" />
            <span>نسخ النتيجة للمشاركة 📋</span>
          </>
        )}
      </button>

      <div className="w-full max-w-[260px] flex flex-col gap-3.5">
        <button
          type="button"
          onClick={guard(() => {
            soundManager.play('next');
            onNewRound();
          })}
          className="w-full min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
        >
          العب تاني
        </button>

        <button
          type="button"
          onClick={guard(() => {
            soundManager.play('click');
            onBackToArcadeHub();
          })}
          className="w-full min-h-[54px] rounded-2xl bakasa-btn-red text-white text-xl font-black tracking-wide transition-transform"
        >
          ألعاب 2D تانية
        </button>
      </div>
    </div>
  );
};
