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
  Moon,
  PaintRoller,
  Palette,
  RotateCcw,
  Sun,
  Swords,
  Trophy,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useTapGuard } from '../hooks/useAntiDoubleTap';
import { soundManager } from '../utils/soundManager';
import { useTheme } from '../utils/themeManager';
import { getUsedItemsCount, resetAllUsedItems } from '../utils/usedItemsMemory';
import { ConfirmModal } from './ConfirmModal';
import { PWAInstallButton } from './PWAInstallButton';

interface HomeScreenProps {
  playerCount: number;
  arcadePlayerCount: number;
  onStartPlay: () => void;
  onStartArcade: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  playerCount,
  arcadePlayerCount,
  onStartPlay,
  onStartArcade,
}) => {
  const guard = useTapGuard(400);
  const { isDark, toggleTheme } = useTheme();
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showResetHistoryModal, setShowResetHistoryModal] = useState(false);
  const [usedCount, setUsedCount] = useState<number>(() => getUsedItemsCount());
  const [resetToast, setResetToast] = useState<string | null>(null);
  const [muted, setMuted] = useState(() => soundManager.isMuted());

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
      {/* Clean Modern Top Bar with Theme Toggle */}
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
            className="w-11 h-11 rounded-full bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] active:scale-95 border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 border-b-[#D5C7B2] dark:border-b-[#0B1120] flex items-center justify-center text-[#1E293B] dark:text-[#F8FAFC] shadow-sm transition-all"
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
            className={`w-11 h-11 rounded-full border-2 border-b-4 flex items-center justify-center shadow-sm transition-all active:scale-95 ${
              muted
                ? 'bg-[#FFF1F2] dark:bg-[#4C0519] border-[#FECDD3] dark:border-[#9F1239] border-b-[#FDA4AF] dark:border-b-[#881337] text-[#E11D48] dark:text-[#FDA4AF]'
                : 'bg-white dark:bg-[#1E293B] border-[#E7DEC8] dark:border-[#334155] border-b-[#D5C7B2] dark:border-b-[#0B1120] text-[#1E293B] dark:text-[#F8FAFC] hover:bg-[#FFF5E8] dark:hover:bg-[#334155]'
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
            className="w-11 h-11 rounded-full bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] active:scale-95 border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 border-b-[#D5C7B2] dark:border-b-[#0B1120] flex items-center justify-center shadow-sm transition-all"
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
          className="min-h-[44px] px-4 rounded-full bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] active:scale-95 border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 border-b-[#D5C7B2] dark:border-b-[#0B1120] text-[#1E293B] dark:text-[#F8FAFC] text-sm font-black flex items-center gap-2 shadow-sm transition-all"
        >
          <BookOpen className="w-4 h-4 text-[#F59E0B]" />
          <span>قواعد الألعاب</span>
        </button>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-8 pt-2 flex flex-col items-center justify-center">
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
            className="animate-float-slow relative w-[152px] h-[152px] sm:w-[160px] sm:h-[160px] object-contain drop-shadow-[0_14px_24px_rgba(217,78,48,0.26)] dark:drop-shadow-[0_14px_28px_rgba(255,107,74,0.34)] mb-2.5 select-none pointer-events-none"
          />

          <p className="relative text-base sm:text-lg font-black text-[#64748B] dark:text-[#94A3B8] mb-3">
            ألعاب القعدة والتحدي على موبايل واحد
          </p>

          <div className="relative inline-flex items-center gap-2 rounded-2xl bg-white/90 dark:bg-[#1E293B]/90 border-2 border-[#E7DEC8] dark:border-[#334155] px-4 py-1.5 text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] shadow-sm">
            <Users className="w-4 h-4 text-[#FF6B4A]" />
            <span className="tabular-nums">من ٢ إلى ٢٠ لاعب</span>
            <span className="text-[#CBD5E1] dark:text-[#475569]">·</span>
            <span className="text-[#0D9488] dark:text-[#2DD4BF]">١٢ لعبة جماعية</span>
          </div>
        </div>

        {/* Two Living Mode Cards */}
        <div className="w-full max-w-md flex flex-col gap-4">
          <button
            type="button"
            onClick={guard(() => {
              soundManager.unlock();
              soundManager.play('next');
              onStartPlay();
            })}
            className="group relative overflow-hidden w-full min-h-[86px] rounded-3xl qada-btn-coral text-white px-5 py-3.5 flex items-center justify-between gap-3 transition-transform active:scale-95 hover:brightness-[1.04]"
          >
            {/* Floating Decorative Background Icons & Shimmer */}
            <div className="pointer-events-none absolute -top-2 -left-2 opacity-15 animate-float-slow">
              <Bomb className="w-16 h-16 -rotate-12" />
            </div>
            <div className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer-sweep" />

            <div className="relative flex items-center gap-3.5 text-right min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black leading-tight">
                  ألعاب القعدة (٢–٢٠ لاعب)
                </div>
                <div className="text-xs sm:text-sm font-bold text-white/95 mt-0.5 tabular-nums truncate">
                  الجاسوس · القنبلة · رسم · مزور ({playerCount} مجهزين)
                </div>
              </div>
            </div>
            <ChevronLeft className="relative w-6 h-6 text-white/95 shrink-0 transition-transform group-hover:-translate-x-1" />
          </button>

          <button
            type="button"
            onClick={guard(() => {
              soundManager.unlock();
              soundManager.play('next');
              onStartArcade();
            })}
            className="group relative overflow-hidden w-full min-h-[86px] rounded-3xl qada-btn-teal text-white px-5 py-3.5 flex items-center justify-between gap-3 transition-transform active:scale-95 hover:brightness-[1.04]"
          >
            {/* Floating Decorative Background Icons & Shimmer */}
            <div className="pointer-events-none absolute -bottom-2 -left-1 opacity-15 animate-float-alt">
              <Trophy className="w-16 h-16 rotate-12" />
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer-sweep"
              style={{ animationDelay: '2.1s' }}
            />

            <div className="relative flex items-center gap-3.5 text-right min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black leading-tight">
                  تحدي الشاشة 2D (٢–٤ لاعبين)
                </div>
                <div className="text-xs sm:text-sm font-bold text-white/95 mt-0.5 tabular-nums truncate">
                  ٧ ألعاب حماسية على نفس الشاشة ({arcadePlayerCount} لاعبين)
                </div>
              </div>
            </div>
            <ChevronLeft className="relative w-6 h-6 text-white/95 shrink-0 transition-transform group-hover:-translate-x-1" />
          </button>
        </div>

        {/* Bottom Utility Actions */}
        <div className="w-full max-w-md mt-6 flex flex-col items-center gap-3">
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
              className="min-h-[42px] px-4 rounded-2xl bg-white/85 dark:bg-[#1E293B] hover:bg-white dark:hover:bg-[#334155] active:scale-95 border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 border-b-[#D5C7B2] dark:border-b-[#0B1120] text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center justify-center gap-2 transition-all whitespace-nowrap"
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

      {resetToast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-white dark:bg-[#1E293B] border-2 border-[#10B981] border-b-4 px-5 py-3 text-sm font-black text-[#065F46] dark:text-[#6EE7B7] shadow-xl whitespace-nowrap"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/65 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-modal-title"
        >
          <div className="w-full max-w-md max-h-[85vh] rounded-3xl bg-white dark:bg-[#1E293B] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-[6px] border-b-[#D5C7B2] dark:border-b-[#0B1120] shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b-2 border-[#F1E8DA] dark:border-[#334155] flex items-center justify-between gap-3 bg-[#FFF9F0] dark:bg-[#0F172A]">
              <h2 id="rules-modal-title" className="text-xl font-black text-[#1E293B] dark:text-white flex items-center gap-2.5">
                <img
                  src="/app-icon.png"
                  alt=""
                  className="w-9 h-9 rounded-xl border-2 border-amber-400/50 shadow-sm object-cover shrink-0"
                />
                <span>قواعد الألعاب</span>
              </h2>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => {
                  soundManager.play('click');
                  setShowRulesModal(false);
                }}
                className="min-w-[40px] min-h-[40px] rounded-xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] flex items-center justify-center text-[#1E293B] dark:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex flex-col gap-3.5 text-right bg-[#FFFDF9] dark:bg-[#1E293B]">
              <div className="rounded-2xl bg-[#FDF2F8] dark:bg-pink-950/35 border-2 border-[#FBCFE8] dark:border-pink-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#BE185D] dark:text-pink-300 mb-1.5">
                  <EyeOff className="w-5 h-5 shrink-0" />
                  <h3>١. الجاسوس (بره القعدة)</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  كل اللاعبين بيشوفوا نفس الكلمة السرية ما عدا الجاسوس (من ١ لـ ٣ جواسيس). اسألوا
                  بعض أسئلة ذكية من غير ما تحرقوا الكلمة. في التصويت، كل لاعب يختار عدد
                  مشتبهين بيساوي عدد الجواسيس، وكل اختيار صح بيدي +١٠٠ نقطة. وفي الآخر الجاسوس
                  عنده &quot;فرصة أخيرة&quot; يختار الكلمة السرية من وسط اختيارات القسم عشان
                  يكسب +١٠٠ نقطة!
                </p>
              </div>

              <div className="rounded-2xl bg-[#FFF1F2] dark:bg-rose-950/35 border-2 border-[#FECDD3] dark:border-rose-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#D94E30] dark:text-rose-300 mb-1.5">
                  <Flame className="w-5 h-5 shrink-0" />
                  <h3>٢. أسئلة القنبلة</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  بيظهر سؤال سريع مختلف لكل لاعب. جاوب بصوت عالي واضغط &quot;جاوبت - اللي
                  بعده!&quot; عشان يتغير السؤال ويمرر التليفون للي بعدك. المؤقت المخفي عشوائي
                  بين ٣٠ ثانية و٣ دقايق في كل جولة، واللي التليفون في إيده وقت الانفجار بيتخصم
                  منه ١٠٠ نقطة!
                </p>
              </div>

              <div className="rounded-2xl bg-[#FFFBEB] dark:bg-amber-950/35 border-2 border-[#FDE68A] dark:border-amber-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#B45309] dark:text-amber-300 mb-1.5">
                  <Bomb className="w-5 h-5 shrink-0" />
                  <h3>٣. القنبلة</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  بيظهر موضوع واحد ثابت طول الجولة (زي: حاجات في التلاجة). اضغط &quot;ابدأ&quot;
                  ومرروا التليفون بسرعة وكل واحد يقول إجابة صح عن نفس الموضوع من غير تكرار
                  لحد ما القنبلة تنفجر فجأة (بين ٣٠ ثانية و٣ دقايق)! اللي التليفون في إيده
                  بيتخصم منه ١٠٠ نقطة.
                </p>
              </div>

              <div className="rounded-2xl bg-[#F0FDFA] dark:bg-teal-950/35 border-2 border-[#99F6E4] dark:border-teal-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#0F766E] dark:text-teal-300 mb-1.5">
                  <Palette className="w-5 h-5 shrink-0" />
                  <h3>٤. رسمة في ١٠ ثواني</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  كل لاعب بيرسم للي بعده في دايرة متبادلة! تقدر تختار مدة الرسم قبل ما تبدأ (من
                  ١٠ لـ ٣٠ ثانية)، وبعدين اللوحة بتتقفل وتتمرر للمخمن اللي قدامه ١٥ ثانية يخمن
                  الكلمة. لو صح الاتنين بيكسبوا +١٠٠ نقطة!
                </p>
              </div>

              <div className="rounded-2xl bg-[#ECFDF5] dark:bg-emerald-950/35 border-2 border-[#A7F3D0] dark:border-emerald-800/60 p-4">
                <div className="flex items-center gap-2 text-lg font-black text-[#047857] dark:text-emerald-300 mb-1.5">
                  <UserCheck className="w-5 h-5 shrink-0" />
                  <h3>٥. المزور</h3>
                </div>
                <p className="text-sm font-bold text-[#334155] dark:text-slate-200 leading-relaxed">
                  كل لاعب بياخد لون مختلف وبيشوف الكلمة ما عدا &quot;المزور&quot; اللي بيشوف
                  القسم بس! كل واحد بيرسم خط واحد متصل في كل جولة (جولتين). بعد التصويت، المزور
                  ليه فرصة أخيرة يخمن الكلمة عشان يكسب +١٠٠ نقطة، واللي يقفش المزور بياخد
                  +١٠٠ نقطة!
                </p>
              </div>

              <div className="pt-3 border-t-2 border-[#F1E8DA] dark:border-[#334155]">
                <div className="text-sm font-black text-[#0D9488] dark:text-[#2DD4BF] mb-3">
                  ألعاب تحدي الشاشة 2D (٢–٤ لاعبين على نفس الشاشة):
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="rounded-2xl bg-[#FFF5F2] dark:bg-red-950/30 border border-[#FECACA] dark:border-red-800/50 p-3.5">
                    <div className="flex items-center gap-2 text-base font-black text-[#DC2626] dark:text-rose-300 mb-1">
                      <PaintRoller className="w-4 h-4 shrink-0" />
                      <h4>حرب الرولات (Paint Fight)</h4>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-[#475569] dark:text-slate-300 leading-relaxed">
                      كل لاعب بيتحكم في رولة دهان من زاويته. وجه رولتك عشان تغطي أكبر مساحة من
                      الشاشة بلونك وتاخد +١٠٠ نقطة!
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#FDF2F8] dark:bg-pink-950/30 border border-[#FBCFE8] dark:border-pink-800/50 p-3.5">
                    <div className="flex items-center gap-2 text-base font-black text-[#BE185D] dark:text-pink-300 mb-1">
                      <Swords className="w-4 h-4 shrink-0" />
                      <h4>تحدي السكاكين (Knife Hit)</h4>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-[#475569] dark:text-slate-300 leading-relaxed">
                      اضغط زاويتك عشان ترمي السكينة في الخشبة الدوارة! لو خبطت في سكينة تانية
                      هتتصدم. أول واحد يثبت ٧ سكاكين (أو الأكثر في الوقت) يكسب +١٠٠ نقطة.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#F0F9FF] dark:bg-sky-950/30 border border-[#BAE6FD] dark:border-sky-800/50 p-3.5">
                    <div className="flex items-center gap-2 text-base font-black text-[#0369A1] dark:text-sky-300 mb-1">
                      <Gamepad2 className="w-4 h-4 shrink-0" />
                      <h4>صيد الضفادع (Frog Fly Catch)</h4>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-[#475569] dark:text-slate-300 leading-relaxed">
                      اضغط زاويتك عشان تطلع لسان الضفدع وتصطاد الحشرات: الذبابة (+١)، الذهبية
                      (+٣)، والدبور (-٢)!
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#F0FDFA] dark:bg-teal-950/30 border border-[#99F6E4] dark:border-teal-800/50 p-3.5">
                    <div className="flex items-center gap-2 text-base font-black text-[#0F766E] dark:text-teal-300 mb-1">
                      <Bird className="w-4 h-4 shrink-0" />
                      <h4>الطيور الطائرة (Happy Birds)</h4>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-[#475569] dark:text-slate-300 leading-relaxed">
                      اضغط زاويتك عشان ترفرف بعصفورك، اجمع النجوم (+١٠ نقاط) وخد +٢ نقطة كل
                      ثانية وابعد عن أشواك الحيطان!
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#FFFBEB] dark:bg-amber-950/30 border border-[#FDE68A] dark:border-amber-800/50 p-3.5">
                    <div className="flex items-center gap-2 text-base font-black text-[#B45309] dark:text-amber-300 mb-1">
                      <Car className="w-4 h-4 shrink-0" />
                      <h4>سباق العربيات (Racing)</h4>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-[#475569] dark:text-slate-300 leading-relaxed">
                      لف الدركسيون في زاويتك واجمع النجوم والتيربو وتجميد المنافسين عشان تخلّص
                      اللفات أول واحد وتكسب +١٠٠ نقطة.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#F7FEE7] dark:bg-lime-950/30 border border-[#D9F99D] dark:border-lime-800/50 p-3.5">
                    <div className="flex items-center gap-2 text-base font-black text-[#4D7C0F] dark:text-lime-300 mb-1">
                      <Bird className="w-4 h-4 shrink-0" />
                      <h4>اصطياد الدجاج (Chicken Catch)</h4>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-[#475569] dark:text-slate-300 leading-relaxed">
                      اجري بالجويستيك وامسك الدجاج الهربان (حتى دجاجتين فوق راسك) وارجع حطهم
                      في حوشك الملون!
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#ECFDF5] dark:bg-emerald-950/30 border border-[#A7F3D0] dark:border-emerald-800/50 p-3.5">
                    <div className="flex items-center gap-2 text-base font-black text-[#047857] dark:text-emerald-300 mb-1">
                      <Trophy className="w-4 h-4 shrink-0" />
                      <h4>كرة القدم (Arcade Soccer)</h4>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-[#475569] dark:text-slate-300 leading-relaxed">
                      المس الكورة للمراوغة، وجّه بالجويستيك وسيبه للشوت! ولو الكورة مش معاك،
                      اسحب وسيب بسرعة عشان تتزحلق وتخطفها من الخصم.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t-2 border-[#F1E8DA] dark:border-[#334155] bg-[#FFF9F0] dark:bg-[#0F172A]">
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
