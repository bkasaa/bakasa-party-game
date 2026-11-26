import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Lock, Users } from 'lucide-react';
import { BANNER_COLOR_CLASSES, HUB_GAMES } from '../data/gameData';
import { useTapGuard } from '../hooks/useAntiDoubleTap';
import { GameId, Player } from '../types/game';
import { soundManager, triggerHaptic } from '../utils/soundManager';
import { BannerThumb } from './BannerThumb';
import { CardWatermark } from './CardWatermark';
import { PWAInstallButton } from './PWAInstallButton';
import { PlayerAvatar } from './PlayerAvatar';
import { RichDiceIcon } from './RichGameIcons';
import { TopBar } from './TopBar';

interface MainHubScreenProps {
  players: Player[];
  onSelectGame: (gameId: GameId) => void;
  onEditPlayers: () => void;
}

export const MainHubScreen: React.FC<MainHubScreenProps> = ({
  players,
  onSelectGame,
  onEditPlayers,
}) => {
  const guard = useTapGuard(400);
  const [comingSoonToast, setComingSoonToast] = useState<string | null>(null);
  const [rouletteId, setRouletteId] = useState<GameId | null>(null);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const spinTimersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!comingSoonToast) return;
    const timer = window.setTimeout(() => setComingSoonToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [comingSoonToast]);

  useEffect(() => {
    return () => {
      spinTimersRef.current.forEach((id) => window.clearTimeout(id));
      spinTimersRef.current = [];
    };
  }, []);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const activeGames = HUB_GAMES.filter((g) => g.active);

  const handleCardTap = guard((gameId: GameId, active: boolean, title: string) => {
    if (isSpinning) return;
    soundManager.unlock();
    if (!active) {
      soundManager.play('error');
      setComingSoonToast(`لعبة "${title}" جاية في التحديث الجاي!`);
      return;
    }
    soundManager.play('next');
    onSelectGame(gameId);
  });

  const handleRandomPick = guard(() => {
    if (isSpinning || activeGames.length === 0) return;
    soundManager.unlock();
    setIsSpinning(true);

    spinTimersRef.current.forEach((id) => window.clearTimeout(id));
    spinTimersRef.current = [];

    const finalGame = activeGames[Math.floor(Math.random() * activeGames.length)];
    const steps = 8;
    let delay = 0;

    for (let i = 0; i < steps; i++) {
      const interval = 75 + i * 24;
      delay += interval;
      const isLast = i === steps - 1;
      const candidate = isLast
        ? finalGame
        : activeGames[(i + Math.floor(Math.random() * activeGames.length)) % activeGames.length];

      const t = window.setTimeout(() => {
        setRouletteId(candidate.id);
        if (isLast) {
          soundManager.play('victory');
          triggerHaptic(25);
        } else {
          soundManager.play('tick', i / steps);
        }
      }, delay);
      spinTimersRef.current.push(t);
    }

    const launchTimer = window.setTimeout(() => {
      setIsSpinning(false);
      setRouletteId(null);
      onSelectGame(finalGame.id);
    }, delay + 340);
    spinTimersRef.current.push(launchTimer);
  });

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title="تلعبوا إيه؟"
        exitVariant="back"
        exitLabel="رجوع"
        showSettingsButton
        onExit={onEditPlayers}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* Active players score summary strip */}
        <section
          aria-label="ملخص نقاط اللاعبين"
          className="mb-4 rounded-3xl qada-card p-3.5"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
            <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#FF6B4A]" />
              <span>الشلة الحالية ({players.length} لاعبين)</span>
            </span>
            <button
              type="button"
              onClick={guard(() => {
                soundManager.play('click');
                onEditPlayers();
              })}
              className="text-xs font-black text-[#0D9488] dark:text-[#2DD4BF] hover:text-[#0F766E] min-h-[34px] px-2.5 rounded-xl bg-[#F0FDFA] dark:bg-teal-950/50 border border-[#99F6E4] dark:border-teal-800 transition-colors"
            >
              تعديل اللاعبين
            </button>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {sortedPlayers.map((player) => (
              <div
                key={player.id}
                className="shrink-0 flex items-center gap-2 rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A]/80 border border-[#EAE0D0] dark:border-[#334155] px-2.5 py-1.5"
              >
                <PlayerAvatar avatarId={player.avatarId} name={player.name} size="sm" />
                <div className="leading-tight">
                  <div className="text-xs font-extrabold text-[#1E293B] dark:text-[#F8FAFC] max-w-[84px] truncate">
                    {player.name}
                  </div>
                  <div className="text-[11px] font-black text-[#D94E30] dark:text-[#FB7185] tabular-nums">
                    {player.score} نقطة
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Random Game Picker Roulette Button */}
        <button
          type="button"
          disabled={isSpinning}
          onClick={handleRandomPick}
          className="mb-5 w-full min-h-[54px] rounded-2xl qada-btn-amber px-4 py-2.5 flex items-center justify-center gap-2.5 text-[#1E293B] font-black text-base sm:text-lg transition-transform active:scale-95 disabled:opacity-85"
        >
          <RichDiceIcon className={`w-6 h-6 shrink-0 ${isSpinning ? 'animate-spin' : ''}`} />
          <span>{isSpinning ? 'بنختار لكم لعبة...' : '🎲 فاجئنا! (اختيار عشوائي)'}</span>
        </button>

        {/* Liquid Glass Asymmetrical Bento Grid for Party Games */}
        <div className="grid grid-cols-2 gap-3.5">
          {HUB_GAMES.map((game, idx) => {
            const style = BANNER_COLOR_CLASSES[game.color];
            const isHighlighted = rouletteId === game.id;
            const isFeatured = idx === 0;
            return (
              <div
                key={game.id}
                className={`animate-card-float ${isFeatured ? 'col-span-2' : 'h-full'}`}
                style={{ animationDelay: `${idx * 0.35}s` }}
              >
                <button
                  type="button"
                  onClick={() => handleCardTap(game.id, game.active, game.title)}
                  className={`group relative overflow-hidden w-full h-full ${
                    isFeatured
                      ? 'min-h-[88px] px-4 py-3.5 flex items-center justify-between gap-3'
                      : 'min-h-[152px] p-3.5 flex flex-col justify-between gap-2'
                  } rounded-3xl ${style.bg} ${style.shadow} border ${style.border} qada-spring-card text-right ${
                    !game.active ? 'opacity-80' : 'hover:brightness-105'
                  } ${
                    isHighlighted
                      ? 'ring-4 ring-[#F59E0B] scale-[1.03] brightness-110'
                      : isSpinning
                        ? 'opacity-65'
                        : ''
                  }`}
                >
                  <CardWatermark kind={game.id} />
                  <div className="pointer-events-none absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white/10" />
                  {game.active && (
                    <div
                      className="pointer-events-none absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-sweep"
                      style={{ animationDelay: `${idx * 0.9}s` }}
                    />
                  )}

                  {isFeatured ? (
                    <>
                      <div className="relative flex items-center gap-3.5 min-w-0">
                        <BannerThumb type={game.id} locked={!game.active} floatDelay={idx * 0.35} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg sm:text-xl font-black text-white truncate">
                              {game.title}
                            </span>
                            {!game.active && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-black/25 border border-white/25 px-2 py-0.5 text-[11px] font-black text-amber-100 shrink-0">
                                <Lock className="w-3 h-3" />
                                قريباً
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-white/90 truncate mt-0.5">
                            {game.subtitle}
                          </p>
                        </div>
                      </div>
                      <div className="relative shrink-0 text-white/95 transition-transform group-hover:-translate-x-1">
                        {game.active ? (
                          <ChevronLeft className="w-6 h-6" />
                        ) : (
                          <Lock className="w-5 h-5 text-white/75" />
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative flex items-start justify-between gap-2 w-full">
                        <BannerThumb type={game.id} locked={!game.active} floatDelay={idx * 0.35} />
                        <span className="shrink-0 text-white/90 mt-1 transition-transform group-hover:-translate-x-1">
                          {game.active ? (
                            <ChevronLeft className="w-5 h-5" />
                          ) : (
                            <Lock className="w-4 h-4 text-white/75" />
                          )}
                        </span>
                      </div>
                      <div className="relative min-w-0">
                        <div className="text-base sm:text-lg font-black text-white leading-tight truncate">
                          {game.title}
                        </div>
                        <p className="text-[11px] sm:text-xs font-bold text-white/90 line-clamp-2 mt-1 leading-snug">
                          {game.subtitle}
                        </p>
                      </div>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-center">
          <div className="w-full max-w-[260px]">
            <PWAInstallButton />
          </div>
        </div>

        {comingSoonToast && (
          <div
            role="status"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-white dark:bg-[#1E293B] border-2 border-[#F59E0B] border-b-4 px-5 py-3 text-sm font-black text-[#B45309] dark:text-[#FCD34D] shadow-xl whitespace-nowrap"
          >
            {comingSoonToast}
          </div>
        )}
      </main>
    </div>
  );
};
