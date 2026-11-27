import React, { useEffect, useState } from 'react';
import { Camera, Check, Trophy } from 'lucide-react';
import { BANNER_COLOR_CLASSES } from '../data/gameData';
import { useTapGuard } from '../hooks/useAntiDoubleTap';
import { Player, RoundDelta } from '../types/game';
import { formatNumber, formatSignedNumber } from '../utils/formatNumber';
import { computePartyTitles } from '../utils/sessionStats';
import { getScoreboardRankMap } from '../utils/scoreboardMood';
import { soundManager, triggerHaptic } from '../utils/soundManager';
import { shareStoryCardImage } from '../utils/storyCardShare';
import { LoserPunishmentCard } from './LoserPunishmentCard';
import { PlayerAvatar } from './PlayerAvatar';
import { SubtleConfettiBurst } from './SubtleConfettiBurst';

interface LeaderboardScreenProps {
  players: Player[];
  deltas: RoundDelta[];
  summaryHeadline?: string;
  onNewRound: () => void;
  onFinishGame: () => void;
  isTournamentMode?: boolean;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  players,
  deltas,
  summaryHeadline,
  onNewRound,
  onFinishGame,
  isTournamentMode = false,
}) => {
  const guard = useTapGuard(400);
  const [selectedDare, setSelectedDare] = useState<string | null>(null);
  const [storyStatus, setStoryStatus] = useState<'idle' | 'sharing' | 'done'>('idle');

  useEffect(() => {
    if (storyStatus !== 'done') return;
    const t = window.setTimeout(() => setStoryStatus('idle'), 2600);
    return () => window.clearTimeout(t);
  }, [storyStatus]);

  const deltaMap = new Map(deltas.map((d) => [d.playerId, d.delta]));

  const sortedPlayers = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (deltaMap.get(b.id) ?? 0) - (deltaMap.get(a.id) ?? 0);
  });

  const playerTitles = computePartyTitles(sortedPlayers);
  const rankMap = getScoreboardRankMap(sortedPlayers);
  const hasDistinctLoser =
    sortedPlayers.length >= 2 &&
    sortedPlayers[0].score > sortedPlayers[sortedPlayers.length - 1].score;
  const hasFinalWinner =
    sortedPlayers.length >= 2 &&
    (sortedPlayers[0].score > 0 || hasDistinctLoser);
  const lowestScore = hasDistinctLoser ? sortedPlayers[sortedPlayers.length - 1].score : null;
  const lastPlaceIds = new Set(
    lowestScore !== null
      ? sortedPlayers.filter((p) => p.score === lowestScore).map((p) => p.id)
      : []
  );
  const loserNames = hasDistinctLoser
    ? sortedPlayers.filter((p) => lastPlaceIds.has(p.id)).map((p) => p.name)
    : [];

  const handleShareStory = async () => {
    if (storyStatus === 'sharing') return;
    soundManager.unlock();
    soundManager.play('click');
    setStoryStatus('sharing');
    const result = await shareStoryCardImage({
      headline: summaryHeadline || 'نتائج قعدة الشلة',
      entries: sortedPlayers.map((p) => ({ name: p.name, score: p.score })),
      loserName: loserNames.length > 0 ? loserNames.join(' و ') : null,
      dareText: selectedDare,
    });
    if (result === 'error') {
      soundManager.play('error');
      setStoryStatus('idle');
    } else {
      soundManager.play('victory');
      triggerHaptic(25);
      setStoryStatus('done');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-8 pt-2 flex flex-col items-center">
      <SubtleConfettiBurst active={hasFinalWinner} />

      {summaryHeadline && (
        <p className="w-full text-sm sm:text-base font-black text-[#1E293B] dark:text-[#F8FAFC] text-center mb-4 qada-card rounded-2xl px-4 py-2.5">
          {summaryHeadline}
        </p>
      )}

      <div className="w-full flex flex-col gap-3.5 mb-5">
        {sortedPlayers.map((player) => {
          const delta = deltaMap.get(player.id) ?? 0;
          const colorKey = delta < 0 ? 'plum' : player.color;
          const style = BANNER_COLOR_CLASSES[colorKey];
          const funTitle = playerTitles[player.id];
          const isLoser = delta < 0;
          const isLastPlace = lastPlaceIds.has(player.id);
          const rankInfo = rankMap.get(player.id);

          return (
            <div
              key={player.id}
              className={`w-full min-h-[68px] rounded-2xl ${style.bg} ${style.shadow} border ${style.border} px-4 py-2.5 flex items-center justify-between gap-3 transition-transform ${
                isLoser ? 'animate-hardluck-shake' : ''
              } ${isLastPlace ? 'ring-3 ring-rose-300/90 dark:ring-rose-400/80' : ''}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar
                  avatarId={player.avatarId}
                  name={player.name}
                  size="md"
                  rank={rankInfo?.rank}
                  showAllRanks
                  mood={rankInfo?.mood}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-lg font-extrabold text-white truncate">
                      {player.name}
                    </span>
                    {isLastPlace && (
                      <span className="rounded-lg bg-rose-950/75 border border-rose-300/70 px-2 py-0.5 text-[11px] font-black text-rose-100 whitespace-nowrap">
                        المركز الأخير 😈
                      </span>
                    )}
                    {isLoser && !isLastPlace && (
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
                      {formatSignedNumber(delta)} في الدور ده
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-center leading-tight pl-1">
                <div className="text-xl font-black text-white tabular-nums">
                  {formatNumber(player.score)}
                </div>
                <div className="text-xs font-bold text-white/90">نقطة</div>
              </div>
            </div>
          );
        })}
      </div>

      <LoserPunishmentCard loserNames={loserNames} onDareChange={setSelectedDare} />

      <div className="w-full max-w-[300px] flex flex-col gap-2.5 mb-4">
        <button
          type="button"
          onClick={handleShareStory}
          disabled={storyStatus === 'sharing'}
          className="w-full min-h-[48px] rounded-2xl qada-btn-amber text-[#1E293B] text-sm font-black flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-75"
        >
          {storyStatus === 'done' ? (
            <>
              <Check className="w-4 h-4 text-[#059669]" />
              <span>تم تجهيز صورة الستوري! 📸</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>{storyStatus === 'sharing' ? 'جاري تجهيز الصورة...' : 'صور النتيجة للستوري 📸'}</span>
            </>
          )}
        </button>
      </div>

      {isTournamentMode ? (
        <div className="w-full max-w-[280px]">
          <button
            type="button"
            onClick={guard(() => {
              soundManager.play('next');
              onFinishGame();
            })}
            className="w-full min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
          >
            <Trophy className="w-5 h-5" />
            <span>كمّل السهرة 🏆</span>
          </button>
        </div>
      ) : (
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
      )}
    </div>
  );
};
