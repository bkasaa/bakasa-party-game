import React, { useEffect, useRef, useState } from 'react';
import { Bird, Car, ChevronLeft, Dices, PaintRoller, Swords, Trophy, Users } from 'lucide-react';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { ARCADE_COLORS, ArcadePlayer } from '../../types/arcade';
import { ArcadeGameId } from '../../types/game';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { CardWatermark } from '../CardWatermark';
import { TopBar } from '../TopBar';

interface ArcadeHubScreenProps {
  players: ArcadePlayer[];
  onSelectGame: (gameId: ArcadeGameId) => void;
  onEditPlayers: () => void;
}

export interface ArcadeGameCard {
  id: ArcadeGameId;
  title: string;
  subtitle: string;
  badgeText: string;
  bgClass: string;
  borderClass: string;
  shadowClass: string;
  thumbGradient: string;
}

export const ARCADE_GAMES: ArcadeGameCard[] = [
  {
    id: 'paint',
    title: 'حرب الرولات',
    subtitle: 'لوّن أكبر مساحة من الشاشة برولتك في ٣٠ ثانية!',
    badgeText: '٣٠ ثانية · مساحة اللون',
    bgClass: 'bg-[#FF6B4A]',
    borderClass: 'border-[#FF9278]/50',
    shadowClass: 'shadow-[0_6px_0_#D94E30,0_10px_20px_rgba(217,78,48,0.18)]',
    thumbGradient: 'from-[#991b1b] to-[#f97316]',
  },
  {
    id: 'knife',
    title: 'تحدي السكاكين',
    subtitle: 'ارمي سكاكينك في الخشبة الدوارة من غير ما تخبط غيرك!',
    badgeText: 'أول ٧ سكاكين · أو ٣٠ ثانية',
    bgClass: 'bg-[#EC4899]',
    borderClass: 'border-[#F472B6]/50',
    shadowClass: 'shadow-[0_6px_0_#BE185D,0_10px_20px_rgba(190,24,93,0.18)]',
    thumbGradient: 'from-[#4c1d95] to-[#ec4899]',
  },
  {
    id: 'frog',
    title: 'صيد الضفادع',
    subtitle: 'اطلع بلسان الضفدع واصطاد الدبان والذهبيات قبل صحابك!',
    badgeText: 'أول ١٥ نقطة · جولات متتالية',
    bgClass: 'bg-[#3B82F6]',
    borderClass: 'border-[#93C5FD]/50',
    shadowClass: 'shadow-[0_6px_0_#1D4ED8,0_10px_20px_rgba(29,78,216,0.18)]',
    thumbGradient: 'from-[#0369a1] to-[#10b981]',
  },
  {
    id: 'birds',
    title: 'الطيور الطائرة',
    subtitle: 'رفرف واجمع النجوم (+١٠) وابعد عن أشواك الحيطان!',
    badgeText: 'رفرفة سريعة · عودة بعد ٣ث',
    bgClass: 'bg-[#14B8A6]',
    borderClass: 'border-[#5EEAD4]/50',
    shadowClass: 'shadow-[0_6px_0_#0D9488,0_10px_20px_rgba(13,148,136,0.18)]',
    thumbGradient: 'from-[#0284c7] to-[#38bdf8]',
  },
  {
    id: 'racing',
    title: 'سباق العربيات',
    subtitle: 'لف الدركسيون في الحلبات الضيقة واجمع التيربو والتجميد!',
    badgeText: 'لفات سريعة · دركسيون وقوى',
    bgClass: 'bg-[#F59E0B]',
    borderClass: 'border-[#FDE68A]/60',
    shadowClass: 'shadow-[0_6px_0_#B45309,0_10px_20px_rgba(180,83,9,0.18)]',
    thumbGradient: 'from-[#dc2626] to-[#f59e0b]',
  },
  {
    id: 'chicken',
    title: 'اصطياد الدجاج',
    subtitle: 'امسك الدجاج الهربان وارجع بيه لحوشك قبل صحابك!',
    badgeText: 'جويستيك ٣٦٠° · ٢٠ دجاجة',
    bgClass: 'bg-[#65A30D]',
    borderClass: 'border-[#BEF264]/50',
    shadowClass: 'shadow-[0_6px_0_#3F6212,0_10px_20px_rgba(63,98,18,0.18)]',
    thumbGradient: 'from-[#4d7c0f] to-[#eab308]',
  },
  {
    id: 'soccer',
    title: 'كرة القدم',
    subtitle: 'مراوغة، شوت، وزحلقة على الكورة بمهارة الجويستيك!',
    badgeText: '١ ضد ١ / ٢ ضد ٢ · أهداف أو وقت',
    bgClass: 'bg-[#10B981]',
    borderClass: 'border-[#6EE7B7]/50',
    shadowClass: 'shadow-[0_6px_0_#047857,0_10px_20px_rgba(4,120,87,0.18)]',
    thumbGradient: 'from-[#15803d] to-[#0ea5e9]',
  },
  {
    id: 'stickman',
    title: 'حرب الستيك مان',
    subtitle: 'قتال فيزيائي مجنون بـ ٥ خرائط وأسلحة ليزر عشوائية!',
    badgeText: '٢ - ٤ لاعبين · راجدول وأسلحة',
    bgClass: 'bg-[#6366F1]',
    borderClass: 'border-[#A5B4FC]/50',
    shadowClass: 'shadow-[0_6px_0_#4338CA,0_10px_20px_rgba(67,56,202,0.22)]',
    thumbGradient: 'from-[#0284c7] via-[#4f46e5] to-[#f97316]',
  },
  {
    id: 'balance',
    title: 'برج التوازن',
    subtitle: 'اسقط الحيوانات فوق اللوح المعلق من غير ما يقعوا في المية!',
    badgeText: '٢ - ٦ لاعبين · بالدور · فيزياء التوازن',
    bgClass: 'bg-[#0EA5E9]',
    borderClass: 'border-[#7DD3FC]/50',
    shadowClass: 'shadow-[0_6px_0_#0369A1,0_10px_20px_rgba(3,105,161,0.2)]',
    thumbGradient: 'from-[#0284c7] to-[#10b981]',
  },
];

function renderArcadeThumb(game: ArcadeGameCard, idx: number) {
  return (
    <div
      className={`relative shrink-0 w-16 h-16 sm:w-[70px] sm:h-[70px] -my-2 rounded-2xl bg-gradient-to-br ${game.thumbGradient} border-2 border-white/85 shadow-lg flex items-center justify-center overflow-hidden`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.28),transparent_60%)]" />
      <div
        className="animate-icon-float flex items-center justify-center"
        style={{ animationDelay: `${(idx % 5) * 0.35}s` }}
      >
      {game.id === 'paint' && <PaintRoller className="w-8 h-8 text-white drop-shadow" />}
      {game.id === 'knife' && <Swords className="w-8 h-8 text-white drop-shadow" />}
      {game.id === 'frog' && (
        <svg viewBox="0 0 48 48" className="w-9 h-9 drop-shadow" aria-hidden="true">
          <circle cx="24" cy="26" r="15" fill="#22c55e" stroke="#111827" strokeWidth="3" />
          <circle cx="17" cy="15" r="5" fill="#ffffff" stroke="#111827" strokeWidth="2.5" />
          <circle cx="31" cy="15" r="5" fill="#ffffff" stroke="#111827" strokeWidth="2.5" />
          <circle cx="17" cy="15" r="2" fill="#111827" />
          <circle cx="31" cy="15" r="2" fill="#111827" />
          <path
            d="M17 29 Q24 35 31 29"
            stroke="#111827"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      )}
      {game.id === 'birds' && <Bird className="w-8 h-8 text-white drop-shadow" />}
      {game.id === 'racing' && <Car className="w-8 h-8 text-white drop-shadow" />}
      {game.id === 'chicken' && (
        <svg viewBox="0 0 48 48" className="w-9 h-9 drop-shadow" aria-hidden="true">
          <ellipse cx="23" cy="27" rx="13" ry="11" fill="#ffffff" stroke="#111827" strokeWidth="2.8" />
          <circle cx="23" cy="14" r="4" fill="#ef4444" stroke="#111827" strokeWidth="2" />
          <polygon points="34,24 42,27 34,30" fill="#f97316" stroke="#111827" strokeWidth="2" />
          <circle cx="28" cy="24" r="2.2" fill="#111827" />
        </svg>
      )}
      {game.id === 'soccer' && <Trophy className="w-8 h-8 text-white drop-shadow" />}
      {game.id === 'stickman' && (
        <svg viewBox="0 0 48 48" className="w-9 h-9 drop-shadow" aria-hidden="true">
          <line x1="8" y1="38" x2="36" y2="10" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" />
          <line x1="40" y1="38" x2="12" y2="10" stroke="#FB923C" strokeWidth="4" strokeLinecap="round" />
          <circle cx="24" cy="14" r="5" fill="#FACC15" stroke="#0F172A" strokeWidth="2" />
          <line x1="24" y1="19" x2="24" y2="30" stroke="#FACC15" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="24" y1="30" x2="18" y2="40" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
          <line x1="24" y1="30" x2="30" y2="40" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {game.id === 'balance' && (
        <svg viewBox="0 0 48 48" className="w-9 h-9 drop-shadow" aria-hidden="true">
          <rect x="7" y="31" width="34" height="6" rx="3" fill="#F59E0B" stroke="#0F172A" strokeWidth="2.2" transform="rotate(-8 24 34)" />
          <rect x="14" y="16" width="20" height="14" rx="4" fill="#60A5FA" stroke="#0F172A" strokeWidth="2.2" />
          <circle cx="20" cy="22" r="2" fill="#0F172A" />
          <circle cx="28" cy="22" r="2" fill="#0F172A" />
        </svg>
      )}
      </div>
    </div>
  );
}

export const ArcadeHubScreen: React.FC<ArcadeHubScreenProps> = ({
  players,
  onSelectGame,
  onEditPlayers,
}) => {
  const guard = useTapGuard(400);
  const [rouletteId, setRouletteId] = useState<ArcadeGameId | null>(null);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const spinTimersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      spinTimersRef.current.forEach((id) => window.clearTimeout(id));
      spinTimersRef.current = [];
    };
  }, []);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  const handleRandomPick = guard(() => {
    if (isSpinning || ARCADE_GAMES.length === 0) return;
    soundManager.unlock();
    setIsSpinning(true);

    spinTimersRef.current.forEach((id) => window.clearTimeout(id));
    spinTimersRef.current = [];

    const finalGame = ARCADE_GAMES[Math.floor(Math.random() * ARCADE_GAMES.length)];
    const steps = 9;
    let delay = 0;

    for (let i = 0; i < steps; i++) {
      const interval = 70 + i * 22;
      delay += interval;
      const isLast = i === steps - 1;
      const candidate = isLast
        ? finalGame
        : ARCADE_GAMES[(i + Math.floor(Math.random() * ARCADE_GAMES.length)) % ARCADE_GAMES.length];

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
        title="تحدي الشاشة 2D"
        exitVariant="back"
        exitLabel="تعديل اللاعبين"
        onExit={onEditPlayers}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* Active 2-4 players score strip */}
        <section
          aria-label="نقاط لاعبين تحدي الشاشة"
          className="mb-4 rounded-3xl qada-card p-3.5"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
            <span className="text-xs font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#14B8A6]" />
              <span className="tabular-nums">التحدي الحالي ({players.length} لاعبين)</span>
            </span>
            <button
              type="button"
              onClick={guard(() => {
                soundManager.play('click');
                onEditPlayers();
              })}
              className="text-xs font-extrabold text-[#0D9488] dark:text-[#2DD4BF] hover:text-[#0F766E] min-h-[36px] px-3 rounded-xl qada-glass-pill transition-colors"
            >
              تعديل اللاعبين
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {sortedPlayers.map((player) => {
              const theme = ARCADE_COLORS[player.colorId];
              return (
                <div
                  key={player.id}
                  className="flex items-center gap-2 rounded-2xl bg-[#FFF9F0]/85 dark:bg-[#0F172A]/85 border-2 border-[#E7DEC8] dark:border-[#334155] px-2.5 py-2"
                >
                  <span
                    style={{ backgroundColor: theme.hex }}
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm shrink-0"
                  />
                  <div className="min-w-0 leading-tight">
                    <div className="text-xs font-extrabold text-[#1E293B] dark:text-[#F8FAFC] truncate">
                      {player.name}
                    </div>
                    <div className="text-[11px] font-extrabold text-[#D94E30] dark:text-[#FF8C73] tabular-nums">
                      {player.score} نقطة
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Random Game Picker Roulette Button */}
        <button
          type="button"
          disabled={isSpinning}
          onClick={handleRandomPick}
          className="relative overflow-hidden mb-5 w-full min-h-[54px] rounded-2xl qada-btn-amber px-4 py-2.5 flex items-center justify-center gap-2.5 text-[#1E293B] font-black text-base sm:text-lg transition-transform active:scale-95 disabled:opacity-85"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-shimmer-sweep"
          />
          <Dices className={`relative z-10 w-5 h-5 shrink-0 ${isSpinning ? 'animate-spin' : ''}`} />
          <span className="relative z-10">
            {isSpinning ? 'بنختار تحدي عشوائي...' : '🎲 فاجئنا! (اختيار عشوائي)'}
          </span>
        </button>

        {/* Colorful 2D Arcade Game Banners */}
        <div className="flex flex-col gap-5">
          {ARCADE_GAMES.map((game, idx) => {
            const isHighlighted = rouletteId === game.id;
            return (
              <div
                key={game.id}
                className="animate-card-float"
                style={{ animationDelay: `${(idx % 5) * 0.45}s` }}
              >
                <button
                  type="button"
                  onClick={guard(() => {
                    if (isSpinning) return;
                    soundManager.unlock();
                    soundManager.play('next');
                    onSelectGame(game.id);
                  })}
                  className={`group relative overflow-hidden w-full min-h-[82px] rounded-3xl ${game.bgClass} ${game.shadowClass} border ${game.borderClass} qada-spring-card px-4 py-3 flex items-center justify-between gap-3 text-right hover:brightness-105 ${
                    isHighlighted
                      ? 'ring-4 ring-[#F59E0B] scale-[1.03] brightness-105 shadow-[0_0_28px_rgba(245,158,11,0.45)]'
                      : isSpinning
                        ? 'opacity-65'
                        : ''
                  }`}
                >
                  <CardWatermark kind={game.id} />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-5 -left-5 w-20 h-20 rounded-full bg-white/10"
                  />
                  <div className="relative z-10 flex items-center gap-3.5 min-w-0">
                    {renderArcadeThumb(game, idx)}
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-black text-white truncate">
                        {game.title}
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-white/90 truncate mt-0.5">
                        {game.subtitle}
                      </p>
                      <p className="text-[11px] font-extrabold text-white/75 mt-0.5">
                        {game.badgeText}
                      </p>
                    </div>
                  </div>

                  <ChevronLeft className="relative z-10 w-6 h-6 text-white/90 shrink-0 transition-transform group-hover:-translate-x-1" />
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};
