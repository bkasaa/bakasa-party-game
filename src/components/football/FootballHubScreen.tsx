import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  Dices,
  EyeOff,
  Gavel,
  Goal,
  Grid3X3,
  KeyRound,
  ListChecks,
  Mic,
  Shirt,
  Trophy,
  Users,
} from 'lucide-react';
import { FOOTBALL_GAMES, FootballGlobalSettings } from '../../data/footballData';
import { BANNER_COLOR_CLASSES } from '../../data/gameData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { FootballGameId, Player } from '../../types/game';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { CardWatermark } from '../CardWatermark';
import { PlayerAvatar } from '../PlayerAvatar';
import { TopBar } from '../TopBar';
import { FootballSettingsBar } from './FootballSettingsBar';

interface FootballHubScreenProps {
  players: Player[];
  settings: FootballGlobalSettings;
  onChangeSettings: (next: FootballGlobalSettings) => void;
  onSelectGame: (gameId: FootballGameId) => void;
  onEditPlayers: () => void;
  onBackToHome: () => void;
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toArabicDigits(num: number): string {
  return String(num).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)] ?? d);
}

function getFootballGameIcon(id: FootballGameId) {
  switch (id) {
    case 'football_spy':
      return EyeOff;
    case 'football_password':
      return KeyRound;
    case 'football_chain':
      return Shirt;
    case 'football_three':
      return ListChecks;
    case 'football_charades':
      return Mic;
    case 'football_penalty':
      return Goal;
    case 'football_auction':
      return Gavel;
    case 'football_tictactoe':
      return Grid3X3;
  }
}

export const FootballHubScreen: React.FC<FootballHubScreenProps> = ({
  players,
  settings,
  onChangeSettings,
  onSelectGame,
  onEditPlayers,
  onBackToHome,
}) => {
  const guard = useTapGuard(400);
  const [rouletteId, setRouletteId] = useState<FootballGameId | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const spinTimersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      spinTimersRef.current.forEach((id) => window.clearTimeout(id));
      spinTimersRef.current = [];
    };
  }, []);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  const handleCardTap = guard((gameId: FootballGameId) => {
    if (isSpinning) return;
    soundManager.unlock();
    soundManager.play('next');
    onSelectGame(gameId);
  });

  const handleRandomPick = guard(() => {
    if (isSpinning || FOOTBALL_GAMES.length === 0) return;
    soundManager.unlock();
    setIsSpinning(true);

    spinTimersRef.current.forEach((id) => window.clearTimeout(id));
    spinTimersRef.current = [];

    const finalGame = FOOTBALL_GAMES[Math.floor(Math.random() * FOOTBALL_GAMES.length)];
    const steps = 8;
    let delay = 0;

    for (let i = 0; i < steps; i++) {
      const interval = 75 + i * 24;
      delay += interval;
      const isLast = i === steps - 1;
      const candidate = isLast
        ? finalGame
        : FOOTBALL_GAMES[(i + Math.floor(Math.random() * FOOTBALL_GAMES.length)) % FOOTBALL_GAMES.length];

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
        title="قعدة اللاعيبة ⚽"
        exitVariant="back"
        exitLabel="الرئيسية"
        onExit={onBackToHome}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* Stadium Hero Strip */}
        <section className="relative overflow-hidden mb-4 rounded-3xl qada-btn-pitch text-white p-4">
          <svg
            aria-hidden="true"
            viewBox="0 0 360 120"
            className="pointer-events-none absolute inset-0 w-full h-full opacity-20"
            preserveAspectRatio="none"
          >
            <rect x="8" y="8" width="344" height="104" rx="14" fill="none" stroke="white" strokeWidth="2.5" />
            <line x1="180" y1="8" x2="180" y2="112" stroke="white" strokeWidth="2" />
            <circle cx="180" cy="60" r="26" fill="none" stroke="white" strokeWidth="2" />
            <rect x="8" y="34" width="36" height="52" fill="none" stroke="white" strokeWidth="2" />
            <rect x="316" y="34" width="36" height="52" fill="none" stroke="white" strokeWidth="2" />
          </svg>

          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-300 shrink-0" />
                <h2 className="text-lg sm:text-xl font-black leading-tight">
                  ملعب الشلة الكروي
                </h2>
              </div>
              <p className="text-xs sm:text-sm font-bold text-white/90 mt-1 leading-snug tabular-nums">
                {toArabicDigits(FOOTBALL_GAMES.length)} تحديات كورة جماعية بتشتغل ١٠٠٪ أوفلاين بنفس أسماء الشلة
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-sm flex items-center justify-center text-2xl shrink-0">
              <span className="animate-icon-float inline-block">⚽</span>
            </div>
          </div>
        </section>

        {/* Active Players Strip */}
        <section
          aria-label="اللاعبون المشاركون"
          className="mb-4 rounded-3xl qada-card p-3.5"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
            <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#16A34A]" />
              <span>التشكيلة الحالية ({players.length} لاعبين)</span>
            </span>
            <button
              type="button"
              onClick={guard(() => {
                soundManager.play('click');
                onEditPlayers();
              })}
              className="text-xs font-black text-[#0F766E] dark:text-[#34D399] hover:text-[#065F46] min-h-[34px] px-3 rounded-xl qada-glass-pill transition-colors"
            >
              تعديل اللاعبين
            </button>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {sortedPlayers.map((player) => (
              <div
                key={player.id}
                className="shrink-0 flex items-center gap-2 rounded-2xl bg-[#FFF9F0]/85 dark:bg-[#0F172A]/80 border border-[#EAE0D0] dark:border-[#334155] px-2.5 py-1.5"
              >
                <PlayerAvatar avatarId={player.avatarId} name={player.name} size="sm" />
                <div className="leading-tight">
                  <div className="text-xs font-extrabold text-[#1E293B] dark:text-[#F8FAFC] max-w-[84px] truncate">
                    {player.name}
                  </div>
                  <div className="text-[11px] font-black text-[#059669] dark:text-[#34D399] tabular-nums">
                    {player.score} نقطة
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Global Football Scope & Timing Settings */}
        <section className="mb-4">
          <FootballSettingsBar
            title="إعدادات قعدة اللاعيبة العامة ⚙️"
            settings={settings}
            onChange={onChangeSettings}
            roundOptions={[1, 2, 3, 5, 7]}
            secondsOptions={[10, 15, 20, 30, 45]}
          />
        </section>

        {/* Random Football Game Button */}
        <button
          type="button"
          disabled={isSpinning}
          onClick={handleRandomPick}
          className="mb-5 w-full min-h-[54px] rounded-2xl qada-btn-amber px-4 py-2.5 flex items-center justify-center gap-2.5 text-[#1E293B] font-black text-base sm:text-lg transition-transform active:scale-95 disabled:opacity-85"
        >
          <Dices className={`w-5 h-5 shrink-0 ${isSpinning ? 'animate-spin' : ''}`} />
          <span>{isSpinning ? 'بنختار تحدي كروي...' : '🎲 فاجئنا! (تحدي كروي عشوائي)'}</span>
        </button>

        {/* 6 Football Party Mini-Games */}
        <div className="flex flex-col gap-4">
          {FOOTBALL_GAMES.map((game, idx) => {
            const style = BANNER_COLOR_CLASSES[game.color];
            const Icon = getFootballGameIcon(game.id);
            const isHighlighted = rouletteId === game.id;
            return (
              <div
                key={game.id}
                className="animate-card-float"
                style={{ animationDelay: `${idx * 0.45}s` }}
              >
                <button
                  type="button"
                  onClick={() => handleCardTap(game.id)}
                  className={`group relative overflow-hidden w-full min-h-[82px] rounded-3xl ${style.bg} ${style.shadow} border ${style.border} qada-spring-card px-4 py-3.5 flex items-center justify-between gap-3 text-right hover:brightness-105 ${
                    isHighlighted
                      ? 'ring-4 ring-[#F59E0B] scale-[1.03] brightness-110'
                      : isSpinning
                        ? 'opacity-65'
                        : ''
                  }`}
                >
                  <CardWatermark kind={game.id} />
                  <div className="pointer-events-none absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white/10" />
                  <div
                    className="pointer-events-none absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-sweep"
                    style={{ animationDelay: `${idx * 0.7}s` }}
                  />

                  <div className="relative flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner">
                      <div
                        className="animate-icon-float flex items-center justify-center"
                        style={{ animationDelay: `${idx * 0.35}s` }}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg sm:text-xl font-black text-white truncate">
                          {game.title}
                        </span>
                        <span className="text-xs font-black text-white/85 tabular-nums shrink-0">
                          · {game.badgeText}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-white/90 truncate mt-0.5">
                        {game.subtitle}
                      </p>
                    </div>
                  </div>

                  <ChevronLeft className="relative w-6 h-6 text-white/95 shrink-0 transition-transform group-hover:-translate-x-1" />
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};
