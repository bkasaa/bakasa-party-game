import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { BANNER_COLOR_CLASSES } from '../data/gameData';
import { useTapGuard } from '../hooks/useAntiDoubleTap';
import { Player, RoundDelta } from '../types/game';
import { computePartyTitles, copyTextToClipboard } from '../utils/sessionStats';
import { soundManager, triggerHaptic } from '../utils/soundManager';
import { PlayerAvatar } from './PlayerAvatar';

interface LeaderboardScreenProps {
  players: Player[];
  deltas: RoundDelta[];
  summaryHeadline?: string;
  onNewRound: () => void;
  onFinishGame: () => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  players,
  deltas,
  summaryHeadline,
  onNewRound,
  onFinishGame,
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

  const playerTitles = computePartyTitles(sortedPlayers);

  const handleCopySummary = async () => {
    const medals = ['🥇', '🥈', '🥉'];
    const lines: string[] = ['🏆 *نتائج قعدة الشلة* 🏆'];
    if (summaryHeadline) {
      lines.push(`✨ ${summaryHeadline}`);
    }
    lines.push('');
    sortedPlayers.forEach((p, idx) => {
      const rankMark = medals[idx] ?? `${idx + 1}.`;
      const title = playerTitles[p.id] ? ` (${playerTitles[p.id]})` : '';
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

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-8 pt-2 flex flex-col items-center">
      {summaryHeadline && (
        <p className="w-full text-sm sm:text-base font-black text-[#1E293B] dark:text-[#F8FAFC] text-center mb-4 qada-card rounded-2xl px-4 py-2.5">
          {summaryHeadline}
        </p>
      )}

      <div className="w-full flex flex-col gap-3.5 mb-5">
        {sortedPlayers.map((player, index) => {
          const delta = deltaMap.get(player.id) ?? 0;
          const colorKey = delta < 0 ? 'plum' : player.color;
          const style = BANNER_COLOR_CLASSES[colorKey];
          const funTitle = playerTitles[player.id];
          const isLoser = delta < 0;

          return (
            <div
              key={player.id}
              className={`w-full min-h-[68px] rounded-2xl ${style.bg} ${style.shadow} border ${style.border} px-4 py-2.5 flex items-center justify-between gap-3 transition-transform ${
                isLoser ? 'animate-hardluck-shake' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar
                  avatarId={player.avatarId}
                  name={player.name}
                  size="md"
                  rank={index + 1}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-lg font-extrabold text-white truncate">
                      {player.name}
                    </span>
                    {isLoser && (
                      <span className="rounded-lg bg-rose-950/60 border border-rose-300/60 px-2 py-0.5 text-[11px] font-black text-rose-100 whitespace-nowrap">
                        هاردلك! 😅
                      </span>
                    )}
                    {funTitle && (
                      <span className="rounded-lg bg-white/95 px-2 py-0.5 text-[11px] font-black text-[#1E293B] shadow-sm whitespace-nowrap">
                        {funTitle}
                      </span>
                    )}
                  </div>
                  {delta !== 0 && (
                    <div
                      className={`text-xs font-extrabold tabular-nums ${
                        delta > 0 ? 'text-white/95' : 'text-rose-100'
                      }`}
                    >
                      {delta > 0 ? `+${delta} في الدور ده` : `${delta} في الدور ده`}
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-center leading-tight pl-1">
                <div className="text-xl font-black text-white tabular-nums">
                  {player.score}
                </div>
                <div className="text-xs font-bold text-white/90">نقطة</div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleCopySummary}
        className="w-full max-w-[280px] min-h-[46px] mb-4 rounded-2xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 text-[#1E293B] dark:text-[#F8FAFC] text-sm font-black flex items-center justify-center gap-2 transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
            <span className="text-[#059669] dark:text-emerald-400">تم النسخ! ابعتها على الواتساب</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 text-[#F59E0B]" />
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
          دور جديد
        </button>

        <button
          type="button"
          onClick={guard(() => {
            soundManager.play('click');
            onFinishGame();
          })}
          className="w-full min-h-[54px] rounded-2xl bakasa-btn-red text-white text-xl font-black tracking-wide transition-transform"
        >
          إنهاء اللعبة
        </button>
      </div>
    </div>
  );
};
