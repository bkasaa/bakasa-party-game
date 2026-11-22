import React, { useEffect, useState } from 'react';
import { ChevronLeft, Lock, Users } from 'lucide-react';
import { BANNER_COLOR_CLASSES, HUB_GAMES } from '../data/gameData';
import { useTapGuard } from '../hooks/useAntiDoubleTap';
import { GameId, Player } from '../types/game';
import { soundManager } from '../utils/soundManager';
import { BannerThumb } from './BannerThumb';
import { PWAInstallButton } from './PWAInstallButton';
import { PlayerAvatar } from './PlayerAvatar';
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

  useEffect(() => {
    if (!comingSoonToast) return;
    const timer = window.setTimeout(() => setComingSoonToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [comingSoonToast]);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  const handleCardTap = guard((gameId: GameId, active: boolean, title: string) => {
    soundManager.unlock();
    if (!active) {
      soundManager.play('error');
      setComingSoonToast(`لعبة "${title}" جاية في التحديث الجاي!`);
      return;
    }
    soundManager.play('next');
    onSelectGame(gameId);
  });

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="تلعب ايه" exitVariant="back" exitLabel="تعديل اللاعبين" onExit={onEditPlayers} />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* Active players score summary strip */}
        <section
          aria-label="ملخص نقاط اللاعبين"
          className="mb-6 rounded-2xl bg-[#271047]/80 border border-white/15 p-3"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
            <span className="text-xs font-extrabold text-white/80 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-pink-300" />
              <span>القعدة الحالية ({players.length} لاعبين)</span>
            </span>
            <button
              type="button"
              onClick={guard(() => {
                soundManager.play('click');
                onEditPlayers();
              })}
              className="text-xs font-extrabold text-emerald-300 hover:text-emerald-200 min-h-[32px] px-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              تعديل اللاعبين
            </button>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {sortedPlayers.map((player) => (
              <div
                key={player.id}
                className="shrink-0 flex items-center gap-2 rounded-xl bg-black/25 border border-white/10 px-2.5 py-1.5"
              >
                <PlayerAvatar avatarId={player.avatarId} name={player.name} size="sm" />
                <div className="leading-tight">
                  <div className="text-xs font-extrabold text-white max-w-[84px] truncate">
                    {player.name}
                  </div>
                  <div className="text-[11px] font-bold text-pink-200 tabular-nums">
                    {player.score} نقطة
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5 Colorful Bakasa Game Banners */}
        <div className="flex flex-col gap-5">
          {HUB_GAMES.map((game) => {
            const style = BANNER_COLOR_CLASSES[game.color];
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => handleCardTap(game.id, game.active, game.title)}
                className={`w-full min-h-[76px] rounded-2xl ${style.bg} ${style.shadow} border ${style.border} px-4 py-2.5 flex items-center justify-between gap-3 text-right transition-transform active:scale-[0.98] ${
                  !game.active ? 'opacity-80' : 'hover:brightness-105'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <BannerThumb type={game.id} locked={!game.active} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg sm:text-xl font-black text-white truncate">
                        {game.title}
                      </span>
                      {!game.active && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-black/35 border border-white/20 px-2 py-0.5 text-[11px] font-black text-amber-200 shrink-0">
                          <Lock className="w-3 h-3" />
                          قريباً
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white/85 truncate mt-0.5">
                      {game.subtitle}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-white/90">
                  {game.active ? (
                    <ChevronLeft className="w-6 h-6" />
                  ) : (
                    <Lock className="w-5 h-5 text-white/75" />
                  )}
                </div>
              </button>
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-[#190a37]/95 border border-amber-300/40 px-5 py-3 text-sm font-black text-amber-200 shadow-2xl whitespace-nowrap"
          >
            {comingSoonToast}
          </div>
        )}
      </main>
    </div>
  );
};
