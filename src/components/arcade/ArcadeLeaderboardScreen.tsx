import React, { useEffect, useState } from 'react';
import { Camera, Check, Trophy } from 'lucide-react';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import {
  ARCADE_COLOR_ORDER,
  ARCADE_COLORS,
  ArcadeDelta,
  ArcadePlayer,
} from '../../types/arcade';
import { getScoreboardRankMap } from '../../utils/scoreboardMood';
import { computeArcadeTitles } from '../../utils/sessionStats';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { shareStoryCardImage } from '../../utils/storyCardShare';
import { LoserPunishmentCard } from '../LoserPunishmentCard';
import { PlayerAvatar } from '../PlayerAvatar';
import { SubtleConfettiBurst } from '../SubtleConfettiBurst';

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

  const arcadeTitles = computeArcadeTitles(sortedPlayers);

  const hasAnyPositiveDelta = deltas.some((d) => d.delta > 0);
  const hasDistinctLoser =
    sortedPlayers.length >= 2 &&
    sortedPlayers[0].score > sortedPlayers[sortedPlayers.length - 1].score;
  const hasFinalWinner =
    sortedPlayers.length >= 1 &&
    (sortedPlayers[0].score > 0 || hasDistinctLoser);
  const rankMap = getScoreboardRankMap(sortedPlayers);
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
      headline: summaryHeadline || 'تحدي الشاشة 2D',
      subtitle: 'تحدي الشاشة 2D',
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
          const isLastPlace = lastPlaceIds.has(player.id);
          const rankInfo = rankMap.get(player.id);
          const colorAvatarIdx = Math.max(0, ARCADE_COLOR_ORDER.indexOf(player.colorId));

          return (
            <div
              key={player.id}
              className={`w-full min-h-[68px] rounded-2xl ${theme.bgClass} ${theme.shadowClass} border ${theme.borderClass} px-4 py-2.5 flex items-center justify-between gap-3 ${
                isLastPlace ? 'ring-3 ring-rose-300/90 dark:ring-rose-400/80' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar
                  avatarId={colorAvatarIdx}
                  name={player.name}
                  size="md"
                  rank={rankInfo?.rank}
                  showAllRanks
                  mood={rankInfo?.mood}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      style={{ color: theme.textOnColor }}
                      className="text-lg font-black truncate"
                    >
                      {player.name}
                    </span>
                    {isLastPlace && (
                      <span className="rounded-lg bg-rose-950/80 border border-rose-200/70 px-2 py-0.5 text-[11px] font-black text-rose-100 whitespace-nowrap shadow-sm">
                        المركز الأخير 😈
                      </span>
                    )}
                    {funTitle && (
                      <span className="rounded-lg bg-white/95 border border-white px-2 py-0.5 text-[11px] font-black text-[#1E293B] whitespace-nowrap shadow-sm">
                        {funTitle}
                      </span>
                    )}
                    {showHardluck && !isLastPlace && (
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
