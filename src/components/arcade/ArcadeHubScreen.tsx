import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Users } from 'lucide-react';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { ARCADE_COLORS, ArcadePlayer } from '../../types/arcade';
import { ArcadeGameId } from '../../types/game';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { CardWatermark } from '../CardWatermark';
import { RichArcadeGameIcon, RichDiceIcon, RichIconBadge } from '../RichGameIcons';
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
    id: 'khlawis',
    title: 'خلاويص 🕵️‍♂️',
    subtitle: 'استخبى في ٣ خرائط متاهة عملاقة قبل ما الباحث يكشفك بالكشاف أو الزومبي!',
    badgeText: '٢ - ٢٠ لاعب · ٣ خرائط + ضلمة 🔦 وزومبي 🧟‍♂️',
    bgClass: 'bg-[#7C3AED]',
    borderClass: 'border-[#C4B5FD]/50',
    shadowClass: 'shadow-[0_6px_0_#5B21B6,0_10px_22px_rgba(91,33,182,0.26)]',
    thumbGradient: 'from-[#312e81] via-[#6d28d9] to-[#f59e0b]',
  },
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
    subtitle: 'حرك الجويستيك ٣٦٠° في الحلبات واجمع التيربو والتجميد!',
    badgeText: 'لفات سريعة · جويستيك ٣٦٠° وقوى',
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
    id: 'balance',
    title: 'برج التوازن',
    subtitle: 'دوّر وأسقط الحيوانات بفيزياء واقعية على المنصة من غير ما تقع!',
    badgeText: '٢ - ٢٠ لاعب · تدوير وكاميرا صاعدة',
    bgClass: 'bg-[#0EA5E9]',
    borderClass: 'border-[#7DD3FC]/50',
    shadowClass: 'shadow-[0_6px_0_#0369A1,0_10px_20px_rgba(3,105,161,0.2)]',
    thumbGradient: 'from-[#0284c7] to-[#10b981]',
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
];

function renderArcadeThumb(game: ArcadeGameCard, idx: number) {
  return (
    <RichIconBadge
      gradientClass={game.thumbGradient}
      size="lg"
      floatDelay={(idx % 5) * 0.35}
      className="-my-0.5"
    >
      <RichArcadeGameIcon id={game.id} className="w-10 h-10" />
    </RichIconBadge>
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
        exitLabel="رجوع"
        showSettingsButton
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
          <RichDiceIcon className={`relative z-10 w-6 h-6 shrink-0 ${isSpinning ? 'animate-spin' : ''}`} />
          <span className="relative z-10">
            {isSpinning ? 'بنختار تحدي عشوائي...' : '🎲 فاجئنا! (اختيار عشوائي)'}
          </span>
        </button>

        {/* Colorful 2D Arcade Game Bento Grid */}
        <div className="grid grid-cols-2 gap-3.5">
          {ARCADE_GAMES.map((game, idx) => {
            const isHighlighted = rouletteId === game.id;
            const isFeatured = game.id === 'khlawis' || game.id === 'stickman';
            return (
              <div
                key={game.id}
                className={`animate-card-float ${isFeatured ? 'col-span-2' : 'h-full'}`}
                style={{ animationDelay: `${(idx % 5) * 0.35}s` }}
              >
                <button
                  type="button"
                  onClick={guard(() => {
                    if (isSpinning) return;
                    soundManager.unlock();
                    soundManager.play('next');
                    triggerHaptic(15);
                    onSelectGame(game.id);
                  })}
                  className={`group relative overflow-hidden w-full h-full ${
                    isFeatured
                      ? 'min-h-[88px] px-4 py-3.5 flex items-center justify-between gap-3'
                      : 'min-h-[164px] p-3.5 flex flex-col justify-between gap-2'
                  } rounded-3xl ${game.bgClass} ${game.shadowClass} border ${game.borderClass} qada-spring-card text-right hover:brightness-105 ${
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

                  {isFeatured ? (
                    <>
                      <div className="relative z-10 flex items-center gap-3.5 min-w-0">
                        {renderArcadeThumb(game, idx)}
                        <div className="min-w-0">
                          <div className="text-lg sm:text-xl font-black text-white truncate">
                            {game.title}
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-white/90 truncate mt-0.5">
                            {game.subtitle}
                          </p>
                          <p className="text-[11px] font-extrabold text-white/80 mt-0.5">
                            {game.badgeText}
                          </p>
                        </div>
                      </div>
                      <ChevronLeft className="relative z-10 w-6 h-6 text-white/90 shrink-0 transition-transform group-hover:-translate-x-1" />
                    </>
                  ) : (
                    <>
                      <div className="relative z-10 flex items-start justify-between gap-2 w-full">
                        <RichIconBadge
                          gradientClass={game.thumbGradient}
                          size="md"
                          floatDelay={(idx % 5) * 0.3}
                        >
                          <RichArcadeGameIcon id={game.id} className="w-8 h-8" />
                        </RichIconBadge>
                        <ChevronLeft className="w-5 h-5 text-white/90 shrink-0 mt-1 transition-transform group-hover:-translate-x-1" />
                      </div>
                      <div className="relative z-10 min-w-0 mt-2">
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
      </main>
    </div>
  );
};
