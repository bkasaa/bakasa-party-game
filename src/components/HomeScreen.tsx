import React, { useEffect, useState } from 'react';
import {
  Bird,
  BookOpen,
  Bomb,
  Car,
  ChevronLeft,
  Eraser,
  EyeOff,
  Flame,
  Gamepad2,
  Goal,
  Moon,
  PaintRoller,
  Palette,
  PenLine,
  RotateCcw,
  Scale,
  Smile,
  Sparkles,
  Sun,
  Swords,
  Trophy,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { FOOTBALL_GAMES } from '../data/footballData';
import { HUB_GAMES } from '../data/gameData';
import { useTapGuard } from '../hooks/useAntiDoubleTap';
import { soundManager } from '../utils/soundManager';
import { useTheme } from '../utils/themeManager';
import { getUsedItemsCount, resetAllUsedItems } from '../utils/usedItemsMemory';
import { ARCADE_GAMES } from './arcade/ArcadeHubScreen';
import { ConfirmModal } from './ConfirmModal';
import { PWAInstallButton } from './PWAInstallButton';

interface HomeScreenProps {
  playerCount: number;
  arcadePlayerCount: number;
  customTotalCount: number;
  onStartPlay: () => void;
  onStartArcade: () => void;
  onStartFootball: () => void;
  onStartTournament: () => void;
  onOpenCustomContent: () => void;
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toArabicDigits(num: number): string {
  return String(num).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)] ?? d);
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  playerCount,
  arcadePlayerCount,
  customTotalCount,
  onStartPlay,
  onStartArcade,
  onStartFootball,
  onStartTournament,
  onOpenCustomContent,
}) => {
  const guard = useTapGuard(400);
  const { isDark, toggleTheme } = useTheme();
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showResetHistoryModal, setShowResetHistoryModal] = useState(false);
  const [usedCount, setUsedCount] = useState<number>(() => getUsedItemsCount());
  const [resetToast, setResetToast] = useState<string | null>(null);
  const [muted, setMuted] = useState(() => soundManager.isMuted());

  const partyGamesCount = HUB_GAMES.filter((g) => g.active).length;
  const arcadeGamesCount = ARCADE_GAMES.length;
  const footballGamesCount = FOOTBALL_GAMES.length;
  const totalGamesCount = partyGamesCount + arcadeGamesCount + footballGamesCount;

  useEffect(() => {
    return soundManager.subscribe(setMuted);
  }, []);

  useEffect(() => {
    if (!resetToast) return;
    const timer = window.setTimeout(() => setResetToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [resetToast]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Clean Modern Liquid Glass Top Bar with Theme Toggle */}
      <header className="w-full max-w-xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="إعادة تصفير الأسئلة المحفوظة"
            onClick={guard(() => {
              soundManager.unlock();
              soundManager.play('click');
              setShowResetHistoryModal(true);
            })}
            className="w-11 h-11 rounded-full qada-glass-pill hover:brightness-105 active:scale-95 flex items-center justify-center text-[#1E293B] dark:text-[#F8FAFC] transition-all"
          >
            <RotateCcw className="w-5 h-5 text-[#FF6B4A]" />
          </button>

          <button
            type="button"
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            onClick={() => {
              soundManager.unlock();
              soundManager.toggleMute();
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              muted
                ? 'bg-[#FFF1F2]/90 dark:bg-[#4C0519]/90 backdrop-blur-md border-2 border-[#FECDD3] dark:border-[#9F1239] border-b-4 border-b-[#FDA4AF] dark:border-b-[#881337] text-[#E11D48] dark:text-[#FDA4AF]'
                : 'qada-glass-pill hover:brightness-105 text-[#1E293B] dark:text-[#F8FAFC]'
            }`}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <button
            type="button"
            aria-label={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
            onClick={() => {
              soundManager.unlock();
              soundManager.play('click');
              toggleTheme();
            }}
            className="w-11 h-11 rounded-full qada-glass-pill hover:brightness-105 active:scale-95 flex items-center justify-center transition-all"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-[#FBBF24]" />
            ) : (
              <Moon className="w-5 h-5 text-[#475569]" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={guard(() => {
            soundManager.unlock();
            soundManager.play('click');
            setShowRulesModal(true);
          })}
          className="min-h-[44px] px-4 rounded-full qada-glass-pill hover:brightness-105 active:scale-95 text-[#1E293B] dark:text-[#F8FAFC] text-sm font-black flex items-center gap-2 transition-all"
        >
          <BookOpen className="w-4 h-4 text-[#F59E0B]" />
          <span>قواعد الألعاب</span>
        </button>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-4 pt-2 flex flex-col items-center justify-center">
        {/* Custom App Logo Hero */}
        <div className="w-full max-w-md px-4 pb-5 pt-1 text-center relative flex flex-col items-center">
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 w-52 h-36 rounded-full blur-3xl opacity-25 dark:opacity-35 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, #FF6B4A 0%, #F59E0B 50%, #14B8A6 100%)',
            }}
          />

          <img
            src="/app-icon.png"
            alt="قعدة الشلة"
            className="animate-logo-float relative w-[152px] h-[152px] sm:w-[160px] sm:h-[160px] object-contain drop-shadow-[0_14px_24px_rgba(217,78,48,0.26)] dark:drop-shadow-[0_14px_28px_rgba(255,107,74,0.34)] mb-2.5 select-none pointer-events-none"
          />

          <p className="relative text-base sm:text-lg font-black text-[#64748B] dark:text-[#94A3B8] mb-3">
            ألعاب القعدة والتحدي على موبايل واحد
          </p>

          <div className="relative inline-flex items-center gap-2 rounded-2xl qada-glass-pill px-4 py-1.5 text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC]">
            <Users className="w-4 h-4 text-[#FF6B4A]" />
            <span className="tabular-nums">من ٢ إلى ٢٠ لاعب</span>
            <span className="text-[#CBD5E1] dark:text-[#475569]">·</span>
            <span className="text-[#0D9488] dark:text-[#2DD4BF] tabular-nums">
              {toArabicDigits(totalGamesCount)} لعبة وتحدي
            </span>
          </div>

          {/* Prominent Glowing Full Party Night / Tournament Trigger */}
          <button
            type="button"
            onClick={guard(() => {
              soundManager.unlock();
              soundManager.play('victory');
              onStartTournament();
            })}
            className="mt-4 relative overflow-hidden w-full min-h-[56px] rounded-2xl qada-btn-amber qada-spring-card px-4 py-2.5 flex items-center justify-between gap-3 text-[#1E293B] shadow-[0_0_24px_rgba(245,158,11,0.35)] hover:brightness-105"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent animate-shimmer-sweep"
            />
            <div className="relative flex items-center gap-2.5 min-w-0 text-right">
              <div className="w-10 h-10 rounded-xl bg-white/60 border border-white flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-[#B45309] animate-icon-float" />
              </div>
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-black leading-tight flex items-center gap-1.5">
                  <span>ابدأ سهرة كاملة 🏆</span>
                </div>
                <div className="text-[11px] sm:text-xs font-extrabold text-[#78350F] truncate">
                  بطولة متواصلة من ٣ أو ٥ أو ٧ ألعاب وتتويج البطل!
                </div>
              </div>
            </div>
            <ChevronLeft className="relative w-5 h-5 text-[#78350F] shrink-0" />
          </button>
        </div>

        {/* Three Living Mode Cards with Custom Vector Line-Art Watermarks */}
        <div className="w-full max-w-md flex flex-col gap-4">
          {/* Card 1: Party Games */}
          <div className="animate-card-float" style={{ animationDelay: '0s' }}>
          <button
            type="button"
            onClick={guard(() => {
              soundManager.unlock();
              soundManager.play('next');
              onStartPlay();
            })}
            className="group relative overflow-hidden w-full min-h-[88px] rounded-3xl qada-btn-coral qada-spring-card text-white px-5 py-3.5 flex items-center justify-between gap-3 hover:brightness-[1.04]"
          >
            {/* Custom SVG Line-Art: Friends Gathering, Cards, Speech Bubbles & Spy Mask */}
            <svg
              aria-hidden="true"
              viewBox="0 0 240 90"
              className="pointer-events-none absolute inset-0 w-full h-full opacity-20"
              preserveAspectRatio="none"
            >
              {/* Playing cards fanned on left */}
              <rect
                x="14"
                y="18"
                width="30"
                height="44"
                rx="6"
                fill="none"
                stroke="white"
                strokeWidth="2"
                transform="rotate(-12 29 40)"
              />
              <rect
                x="28"
                y="14"
                width="30"
                height="44"
                rx="6"
                fill="none"
                stroke="white"
                strokeWidth="2"
                transform="rotate(8 43 36)"
              />
              {/* Speech bubble */}
              <path
                d="M95 16 H145 Q155 16 155 26 V44 Q155 54 145 54 H116 L104 65 V54 H95 Q85 54 85 44 V26 Q85 16 95 16 Z"
                fill="none"
                stroke="white"
                strokeWidth="2"
              />
              <circle cx="108" cy="35" r="2.5" fill="white" />
              <circle cx="120" cy="35" r="2.5" fill="white" />
              <circle cx="132" cy="35" r="2.5" fill="white" />
              {/* Spy mask / friends circles */}
              <circle cx="195" cy="30" r="10" fill="none" stroke="white" strokeWidth="2" />
              <path d="M179 60 Q195 45 211 60" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="218" cy="35" r="7" fill="none" stroke="white" strokeWidth="1.8" />
            </svg>
            <div className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer-sweep" />

            <div className="relative flex items-center gap-3.5 text-right min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner">
                <Users className="w-6 h-6 text-white animate-icon-float" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black leading-tight">
                  ألعاب القعدة (٢–٢٠ لاعب)
                </div>
                <div className="text-xs sm:text-sm font-bold text-white/95 mt-0.5 tabular-nums truncate">
                  {toArabicDigits(partyGamesCount)} ألعاب: الجاسوس · بدون كلام · القنبلة ({playerCount} مجهزين)
                </div>
              </div>
            </div>
            <ChevronLeft className="relative w-6 h-6 text-white/95 shrink-0 transition-transform group-hover:-translate-x-1" />
          </button>
          </div>

          {/* Card 2: 2D Arcade */}
          <div className="animate-card-float" style={{ animationDelay: '0.6s' }}>
          <button
            type="button"
            onClick={guard(() => {
              soundManager.unlock();
              soundManager.play('next');
              onStartArcade();
            })}
            className="group relative overflow-hidden w-full min-h-[88px] rounded-3xl qada-btn-teal qada-spring-card text-white px-5 py-3.5 flex items-center justify-between gap-3 hover:brightness-[1.04]"
          >
            {/* Custom SVG Line-Art: Arcade Controller, Joysticks & Sparks */}
            <svg
              aria-hidden="true"
              viewBox="0 0 240 90"
              className="pointer-events-none absolute inset-0 w-full h-full opacity-20"
              preserveAspectRatio="none"
            >
              {/* Gamepad silhouette */}
              <path
                d="M28 32 Q36 20 56 24 H84 Q104 20 112 32 L118 58 Q116 70 102 68 L90 54 H50 L38 68 Q24 70 22 58 Z"
                fill="none"
                stroke="white"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* D-pad */}
              <line x1="46" y1="36" x2="46" y2="48" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="40" y1="42" x2="52" y2="42" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
              {/* Action buttons */}
              <circle cx="94" cy="38" r="3" fill="none" stroke="white" strokeWidth="2" />
              <circle cx="102" cy="44" r="3" fill="none" stroke="white" strokeWidth="2" />
              {/* Arcade Joystick & Sparks on right */}
              <rect x="176" y="54" width="38" height="14" rx="5" fill="none" stroke="white" strokeWidth="2" />
              <line x1="195" y1="54" x2="195" y2="34" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="195" cy="28" r="8" fill="none" stroke="white" strokeWidth="2.2" />
              {/* Spark stars */}
              <path d="M148 20 L151 27 L158 30 L151 33 L148 40 L145 33 L138 30 L145 27 Z" fill="none" stroke="white" strokeWidth="1.6" />
              <path d="M222 18 L224 23 L229 25 L224 27 L222 32 L220 27 L215 25 L220 23 Z" fill="none" stroke="white" strokeWidth="1.5" />
            </svg>
            <div
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer-sweep"
              style={{ animationDelay: '2.1s' }}
            />

            <div className="relative flex items-center gap-3.5 text-right min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner">
                <Gamepad2
                  className="w-6 h-6 text-white animate-icon-float"
                  style={{ animationDelay: '0.5s' }}
                />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black leading-tight">
                  تحدي الشاشة 2D (٢–٦ لاعبين)
                </div>
                <div className="text-xs sm:text-sm font-bold text-white/95 mt-0.5 tabular-nums truncate">
                  {toArabicDigits(arcadeGamesCount)} ألعاب حماسية على نفس الشاشة ({arcadePlayerCount}–٦ لاعبين)
                </div>
              </div>
            </div>
            <ChevronLeft className="relative w-6 h-6 text-white/95 shrink-0 transition-transform group-hover:-translate-x-1" />
          </button>
          </div>

          {/* Card 3: Football Section (قعدة اللاعيبة ⚽) */}
          <div className="animate-card-float" style={{ animationDelay: '1.2s' }}>
          <button
            type="button"
            onClick={guard(() => {
              soundManager.unlock();
              soundManager.play('next');
              onStartFootball();
            })}
            className="group relative overflow-hidden w-full min-h-[88px] rounded-3xl qada-btn-pitch qada-spring-card text-white px-5 py-3.5 flex items-center justify-between gap-3 hover:brightness-[1.06]"
          >
            {/* Stadium Pitch Lines & Shimmer */}
            <svg
              aria-hidden="true"
              viewBox="0 0 240 90"
              className="pointer-events-none absolute inset-0 w-full h-full opacity-20"
              preserveAspectRatio="none"
            >
              <line x1="120" y1="0" x2="120" y2="90" stroke="white" strokeWidth="2" />
              <circle cx="120" cy="45" r="24" fill="none" stroke="white" strokeWidth="2" />
              <rect x="0" y="20" width="24" height="50" fill="none" stroke="white" strokeWidth="2" />
              <rect x="216" y="20" width="24" height="50" fill="none" stroke="white" strokeWidth="2" />
            </svg>
            <div
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer-sweep"
              style={{ animationDelay: '1.1s' }}
            />

            <div className="relative flex items-center gap-3.5 text-right min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner">
                <Goal
                  className="w-6 h-6 text-white animate-icon-float"
                  style={{ animationDelay: '1s' }}
                />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black leading-tight flex items-center gap-1.5">
                  <span>قعدة اللاعيبة</span>
                  <span aria-hidden="true">⚽</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-white/95 mt-0.5 tabular-nums truncate">
                  {toArabicDigits(footballGamesCount)} تحديات: جاسوس · مزاد · إكس أو الكورة ({playerCount} مجهزين)
                </div>
              </div>
            </div>
            <ChevronLeft className="relative w-6 h-6 text-white/95 shrink-0 transition-transform group-hover:-translate-x-1" />
          </button>
          </div>
        </div>

        {/* Bottom Utility Actions */}
        <div className="w-full max-w-md mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={guard(() => {
              soundManager.unlock();
              soundManager.play('click');
              onOpenCustomContent();
            })}
            className="w-full max-w-[320px] min-h-[48px] px-4 rounded-2xl qada-glass-pill hover:brightness-105 active:scale-95 text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center justify-center gap-2 transition-all"
          >
            <PenLine className="w-4 h-4 text-[#14B8A6] shrink-0" />
            <span>كلماتك وأسئلتك الخاصة ✍️</span>
            {customTotalCount > 0 && (
              <span className="rounded-lg bg-[#14B8A6] text-white px-2 py-0.5 text-xs tabular-nums">
                {customTotalCount}
              </span>
            )}
          </button>

          <div className="w-full max-w-[300px]">
            <PWAInstallButton />
          </div>

          <div className="flex flex-col items-center gap-1 text-center pt-1">
            <button
              type="button"
              onClick={guard(() => {
                soundManager.unlock();
                soundManager.play('click');
                setShowResetHistoryModal(true);
              })}
              className="min-h-[42px] px-4 rounded-2xl qada-glass-pill hover:brightness-105 active:scale-95 text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center justify-center gap-2 transition-all whitespace-nowrap"
            >
              <Eraser className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <span>إعادة تصفير الأسئلة المحفوظة</span>
              {usedCount > 0 && (
                <span className="text-[#D94E30] dark:text-[#FB7185] tabular-nums">({usedCount})</span>
              )}
            </button>
            <p className="text-[11px] sm:text-xs font-bold text-[#64748B] dark:text-[#94A3B8] leading-snug px-2">
              عشان ترجّع الأسئلة والكلمات اللي اتلعبت قبل كده وتظهر من جديد
            </p>
          </div>
        </div>
      </main>

      <footer dir="ltr" className="w-full max-w-xl mx-auto px-4 pb-5 pt-2 text-center select-none">
        <p className="font-bold text-sm text-[#1E293B] dark:text-[#F8FAFC]">
          Developed by Mina Mansour
        </p>
        <p className="font-normal text-xs text-[#64748B] dark:text-[#94A3B8] opacity-75 mt-0.5">
          Ibrahim Mina
        </p>
      </footer>

      {resetToast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-2xl qada-glass-modal border-[#10B981] px-5 py-3 text-sm font-black text-[#065F46] dark:text-[#6EE7B7] whitespace-nowrap"
        >
          {resetToast}
        </div>
      )}

      <ConfirmModal
        open={showResetHistoryModal}
        title="إعادة تصفير الأسئلة المحفوظة؟"
        message="متأكد؟ ده هيخلي كل الأسئلة والكلمات القديمة تظهر تاني من الأول"
        confirmLabel="نعم، صفّر"
        cancelLabel="إلغاء"
        onConfirm={() => {
          resetAllUsedItems();
          setUsedCount(0);
          setShowResetHistoryModal(false);
          soundManager.play('next');
          setResetToast('تم إعادة تصفير الأسئلة المحفوظة بنجاح');
        }}
        onCancel={() => setShowResetHistoryModal(false)}
      />

      {/* How to Play Modal */}
      {showRulesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/60 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-modal-title"
        >
          <div className="w-full max-w-md max-h-[85vh] rounded-3xl qada-glass-modal flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E7DEC8]/70 dark:border-white/10 flex items-center justify-between gap-3 bg-white/40 dark:bg-[#0F172A]/50">
              <h2 id="rules-modal-title" className="text-xl font-black text-[#1E293B] dark:text-white flex items-center gap-2.5">
                <img
                  src="/app-icon.png"
                  alt=""
                  className="w-9 h-9 rounded-xl border-2 border-amber-400/50 shadow-sm object-cover shrink-0"
                />
                <span>قواعد الألعاب ({toArabicDigits(totalGamesCount)} لعبة)</span>
              </h2>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => {
                  soundManager.play('click');
                  setShowRulesModal(false);
                }}
                className="min-w-[40px] min-h-[40px] rounded-xl qada-glass-pill flex items-center justify-center text-[#1E293B] dark:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex flex-col gap-3.5 text-right">
              <div className="rounded-2xl bg-[#FDF2F8]/85 dark:bg-pink-950/40 border-2 border-[#FBCFE8] dark:border-pink-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#BE185D] dark:text-pink-300 mb-1.5">
                  <EyeOff className="w-5 h-5 shrink-0" />
                  <h3>١. الجاسوس (بره القعدة)</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  كل اللاعبين بيشوفوا نفس الكلمة السرية ما عدا الجاسوس (من ١ لـ ٣ جواسيس). اسألوا
                  بعض أسئلة ذكية من غير ما تحرقوا الكلمة، وبعدين صوّتوا، والجاسوس عنده فرصة أخيرة
                  يخمن الكلمة وياخد +١٠٠ نقطة!
                </p>
              </div>

              <div className="rounded-2xl bg-[#FFF1F2]/85 dark:bg-rose-950/40 border-2 border-[#FECDD3] dark:border-rose-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#D94E30] dark:text-rose-300 mb-1.5">
                  <Flame className="w-5 h-5 shrink-0" />
                  <h3>٢. أسئلة القنبلة</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  سؤال سريع مختلف لكل لاعب — جاوب بسرعة ومرر التليفون قبل ما المؤقت السري ينفجر!
                </p>
              </div>

              <div className="rounded-2xl bg-[#FFFBEB]/85 dark:bg-amber-950/40 border-2 border-[#FDE68A] dark:border-amber-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#B45309] dark:text-amber-300 mb-1.5">
                  <Bomb className="w-5 h-5 shrink-0" />
                  <h3>٣. القنبلة</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  موضوع واحد ثابت طول الجولة وكل لاعب يقول إجابة صح من غير تكرار قبل الانفجار المفاجئ!
                </p>
              </div>

              <div className="rounded-2xl bg-[#F0FDFA]/85 dark:bg-teal-950/40 border-2 border-[#99F6E4] dark:border-teal-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#0F766E] dark:text-teal-300 mb-1.5">
                  <Palette className="w-5 h-5 shrink-0" />
                  <h3>٤. رسمة في ١٠ ثواني</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  ارسم الكلمة بسرعة (مع وضع الشاشة الكاملة) وخلي صاحبك يخمنها في ١٥ ثانية!
                </p>
              </div>

              <div className="rounded-2xl bg-[#ECFDF5]/85 dark:bg-emerald-950/40 border-2 border-[#A7F3D0] dark:border-emerald-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#047857] dark:text-emerald-300 mb-1.5">
                  <UserCheck className="w-5 h-5 shrink-0" />
                  <h3>٥. المزور</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  جولة رسم واحدة كل لاعب بخط متصل — والمزور مش عارف الكلمة وبيحاول يندمج!
                </p>
              </div>

              <div className="rounded-2xl bg-[#F5F3FF]/85 dark:bg-purple-950/40 border-2 border-[#DDD6FE] dark:border-purple-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#6D28D9] dark:text-purple-300 mb-1.5">
                  <Scale className="w-5 h-5 shrink-0" />
                  <h3>٦. محكمة الصحاب</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  صراحة واعترافات بالدور من غير مؤقت — جاوب بصراحة أو اضغط &quot;مش هجاوب — هات عقاب!&quot;.
                </p>
              </div>

              <div className="rounded-2xl bg-[#FFF5F2]/85 dark:bg-orange-950/40 border-2 border-[#FED7AA] dark:border-orange-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#C2410C] dark:text-orange-300 mb-1.5">
                  <Smile className="w-5 h-5 shrink-0" />
                  <h3>٧. بدون كلام 🎭</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  حط الموبايل على جبهتك وخلي صحابك يمثلوا لك الكلمة! ميل لتحت للصح ✅ ولفوق للتخطي
                  ⏭️ أو استخدم الزراير الجانبية.
                </p>
              </div>

              <div className="rounded-2xl bg-[#FFFBEB]/85 dark:bg-amber-950/40 border-2 border-[#FDE68A] dark:border-amber-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#B45309] dark:text-amber-300 mb-1.5">
                  <Sparkles className="w-5 h-5 shrink-0" />
                  <h3>وضع السهرة الكاملة 🏆</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  اختار ٣ أو ٥ أو ٧ ألعاب متواصلة أو شكل السهرة بنفسك، النقط بتتجمع تلقائي وتتوج
                  البطل وتنفذ عقاب الخسران في الآخر!
                </p>
              </div>

              <div className="pt-3 border-t border-[#E7DEC8]/70 dark:border-white/10">
                <div className="text-sm font-black text-[#0D9488] dark:text-[#2DD4BF] mb-3">
                  ألعاب تحدي الشاشة 2D ({toArabicDigits(arcadeGamesCount)} ألعاب · ٢–٦ لاعبين):
                </div>

                <div className="flex flex-col gap-2.5 text-xs sm:text-sm font-bold text-[#475569] dark:text-slate-300">
                  <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-[#E7DEC8] dark:border-white/10 p-3 flex items-start gap-2">
                    <PaintRoller className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                    <span><strong>حرب الرولات:</strong> لوّن أكبر مساحة من الشاشة برولتك في ٣٠ ثانية!</span>
                  </div>
                  <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-[#E7DEC8] dark:border-white/10 p-3 flex items-start gap-2">
                    <Swords className="w-4 h-4 text-[#BE185D] shrink-0 mt-0.5" />
                    <span><strong>تحدي السكاكين:</strong> اثبّت ٧ سكاكين في الخشبة الدوارة من غير تصادم.</span>
                  </div>
                  <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-[#E7DEC8] dark:border-white/10 p-3 flex items-start gap-2">
                    <Gamepad2 className="w-4 h-4 text-[#0369A1] shrink-0 mt-0.5" />
                    <span><strong>صيد الضفادع:</strong> اصطاد الدبان والذهبيات بلسان الضفدع وابعد عن الدبور.</span>
                  </div>
                  <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-[#E7DEC8] dark:border-white/10 p-3 flex items-start gap-2">
                    <Bird className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
                    <span><strong>الطيور الطائرة:</strong> رفرف واجمع النجوم وابعد عن أشواك الحيطان.</span>
                  </div>
                  <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-[#E7DEC8] dark:border-white/10 p-3 flex items-start gap-2">
                    <Car className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                    <span><strong>سباق العربيات:</strong> لف الدركسيون واجمع التيربو والتجميد في الحلبة.</span>
                  </div>
                  <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-[#E7DEC8] dark:border-white/10 p-3 flex items-start gap-2">
                    <Bird className="w-4 h-4 text-[#4D7C0F] shrink-0 mt-0.5" />
                    <span><strong>اصطياد الدجاج:</strong> امسك الدجاج الهربان وارجع بيه لحوشك.</span>
                  </div>
                  <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-[#E7DEC8] dark:border-white/10 p-3 flex items-start gap-2">
                    <Trophy className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
                    <span><strong>كرة القدم 2D:</strong> مراوغة وشوت وزحلقة في ملعب أفقي بالفرق.</span>
                  </div>
                  <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-[#E7DEC8] dark:border-white/10 p-3 flex items-start gap-2">
                    <Swords className="w-4 h-4 text-[#4F46E5] shrink-0 mt-0.5" />
                    <span><strong>حرب الستيك مان:</strong> قتال راجدول في ٥ خرائط بأسلحة ليزر ومطارق!</span>
                  </div>
                  <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-[#E7DEC8] dark:border-white/10 p-3 flex items-start gap-2">
                    <Scale className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
                    <span><strong>برج التوازن (٢–٦ لاعبين):</strong> اسقط الحيوانات على اللوح المعلق بالدور من غير ما تقع!</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E7DEC8]/70 dark:border-white/10">
                <div className="text-sm font-black text-[#15803D] dark:text-emerald-400 mb-2">
                  قعدة اللاعيبة ⚽ ({toArabicDigits(footballGamesCount)} تحديات كروية جماعية):
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#475569] dark:text-slate-300 leading-relaxed">
                  • <strong>جاسوس الكورة:</strong> ٢٢٠+ لاعب محلي وعالمي مع فلتر محلي/أجنبي.<br />
                  • <strong>كلمة السر:</strong> لفات تلميحات بمؤقت لكل لاعب قبل التصويت!<br />
                  • <strong>قول اسم لاعب:</strong> تحدي التوقيت للأندية والمنتخبات.<br />
                  • <strong>تحدي الـ ٣ في الكورة:</strong> قول ٣ أسماء كروية بسرعة.<br />
                  • <strong>خمن في الكورة:</strong> تقسيمة فرق ووصف لاعبين ومدربين وأندية وملاعب.<br />
                  • <strong>ضربات الجزاء:</strong> اختار من ٣ لـ ١٠ جولات شوطة سرّية ضد الحارس!<br />
                  • <strong>تحدي المزاد:</strong> اتزايدوا على عدد الأسماء اللي تقدروا تقولوه قبل التايمر.<br />
                  • <strong>إكس أو الكورة:</strong> شبكة ٣×٣ نادي × شرط بمؤقت وأمثلة مساعدة.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-[#E7DEC8]/70 dark:border-white/10 bg-white/40 dark:bg-[#0F172A]/50">
              <button
                type="button"
                onClick={() => {
                  soundManager.play('click');
                  setShowRulesModal(false);
                }}
                className="w-full min-h-[48px] rounded-2xl bakasa-btn-green text-white font-black text-base"
              >
                تمام، يلا نلعب!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
