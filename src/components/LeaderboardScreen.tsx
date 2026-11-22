import React from 'react';
import { BANNER_COLOR_CLASSES } from '../data/gameData';
import { useTapGuard } from '../hooks/useAntiDoubleTap';
import { Player, RoundDelta } from '../types/game';
import { soundManager } from '../utils/soundManager';
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

  const deltaMap = new Map(deltas.map((d) => [d.playerId, d.delta]));

  const sortedPlayers = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (deltaMap.get(b.id) ?? 0) - (deltaMap.get(a.id) ?? 0);
  });

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-8 pt-2 flex flex-col items-center">
      {summaryHeadline && (
        <p className="text-sm sm:text-base font-bold text-white/85 text-center mb-4 bg-white/10 rounded-2xl px-4 py-2 border border-white/15">
          {summaryHeadline}
        </p>
      )}

      <div className="w-full flex flex-col gap-3 mb-7">
        {sortedPlayers.map((player, index) => {
          const delta = deltaMap.get(player.id) ?? 0;
          const colorKey = delta < 0 ? 'plum' : player.color;
          const style = BANNER_COLOR_CLASSES[colorKey];

          return (
            <div
              key={player.id}
              className={`w-full min-h-[68px] rounded-2xl ${style.bg} ${style.shadow} border ${style.border} px-4 py-2.5 flex items-center justify-between gap-3 transition-transform`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar
                  avatarId={player.avatarId}
                  name={player.name}
                  size="md"
                  rank={index + 1}
                />
                <div className="min-w-0">
                  <div className="text-lg font-extrabold text-white truncate">
                    {player.name}
                  </div>
                  {delta !== 0 && (
                    <div
                      className={`text-xs font-extrabold tabular-nums ${
                        delta > 0 ? 'text-emerald-100' : 'text-rose-200'
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
