import React, { useEffect, useState } from 'react';
import {
  Eraser,
  Maximize2,
  Minimize2,
  Moon,
  Music,
  Settings,
  Sun,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useFullscreen } from '../hooks/useFullscreen';
import { soundManager } from '../utils/soundManager';
import { useTheme } from '../utils/themeManager';
import { getUsedItemsCount, resetAllUsedItems } from '../utils/usedItemsMemory';
import { ConfirmModal } from './ConfirmModal';
import { RichIconBadge } from './RichGameIcons';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onOpenPlayerSetup?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  onOpenPlayerSetup,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { isFullscreen, isSupported: fsSupported, toggleFullscreen } = useFullscreen();
  const [sfxMuted, setSfxMuted] = useState<boolean>(() => soundManager.isMuted());
  const [musicMuted, setMusicMuted] = useState<boolean>(() => soundManager.isMusicMuted());
  const [usedCount, setUsedCount] = useState<number>(() => getUsedItemsCount());
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const unsubSfx = soundManager.subscribe(setSfxMuted);
    const unsubMusic = soundManager.subscribeMusic(setMusicMuted);
    return () => {
      unsubSfx();
      unsubMusic();
    };
  }, []);

  useEffect(() => {
    if (open) {
      setUsedCount(getUsedItemsCount());
    }
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/82 animate-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="w-full max-w-md max-h-[88dvh] rounded-3xl qada-glass-modal animate-modal-in flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E7DEC8]/70 dark:border-white/10 flex items-center justify-between gap-3 bg-white/40 dark:bg-[#0F172A]/50">
            <h2
              id="settings-modal-title"
              className="text-xl font-black text-[#1E293B] dark:text-white flex items-center gap-2.5"
            >
              <RichIconBadge tone="teal" size="sm">
                <Settings className="w-5 h-5 text-white" />
              </RichIconBadge>
              <span>الإعدادات العامة</span>
            </h2>
            <button
              type="button"
              aria-label="إغلاق"
              onClick={() => {
                soundManager.play('whoosh');
                onClose();
              }}
              className="min-w-[44px] min-h-[44px] rounded-xl qada-glass-pill flex items-center justify-center text-[#1E293B] dark:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-3 text-right">
            {/* Fullscreen Mode Toggle */}
            <button
              type="button"
              onClick={async () => {
                soundManager.unlock();
                soundManager.play('click');
                if (!fsSupported) {
                  setToast('المتصفح الحالي مش بيدعم ملء الشاشة التلقائي');
                  return;
                }
                const entered = await toggleFullscreen();
                setToast(entered ? 'تم تفعيل وضع ملء الشاشة ⛶' : 'تم الخروج من وضع ملء الشاشة');
              }}
              className="w-full min-h-[60px] rounded-2xl qada-card px-4 py-3 flex items-center justify-between gap-3 hover:brightness-[1.02] transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isFullscreen
                      ? 'bg-emerald-500 text-white'
                      : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                  }`}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-5 h-5" />
                  ) : (
                    <Maximize2 className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-black text-[#1E293B] dark:text-white">
                    وضع ملء الشاشة (Fullscreen)
                  </div>
                  <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                    {isFullscreen
                      ? 'شغال — الشاشة مليانة بالكامل'
                      : 'تكبير اللعب وإخفاء شريط المتصفح'}
                  </div>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-xl text-xs font-black shrink-0 ${
                  isFullscreen
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[#FFF5E8] dark:bg-slate-800 text-[#475569] dark:text-slate-300 border border-[#E7DEC8] dark:border-slate-700'
                }`}
              >
                {isFullscreen ? 'مفعّل' : 'تشغيل'}
              </span>
            </button>

            {/* Sound Effects Toggle */}
            <button
              type="button"
              onClick={() => {
                soundManager.unlock();
                soundManager.toggleMute();
              }}
              className="w-full min-h-[60px] rounded-2xl qada-card px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    !sfxMuted
                      ? 'bg-[#14B8A6] text-white'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {sfxMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-black text-[#1E293B] dark:text-white">
                    أصوات التفاعل والتنبيهات
                  </div>
                  <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                    {sfxMuted ? 'مكتومة حالياً' : 'شغالة — كليكات وصفارة الفوز'}
                  </div>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-xl text-xs font-black shrink-0 ${
                  !sfxMuted
                    ? 'bg-[#14B8A6] text-white'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                }`}
              >
                {sfxMuted ? 'مقفول' : 'شغال'}
              </span>
            </button>

            {/* Background Music Toggle */}
            <button
              type="button"
              onClick={() => {
                soundManager.unlock();
                soundManager.toggleMusicMute();
              }}
              className="w-full min-h-[60px] rounded-2xl qada-card px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    !musicMuted
                      ? 'bg-[#F59E0B] text-white'
                      : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Music className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-black text-[#1E293B] dark:text-white">
                    موسيقى التحدي والخلفية
                  </div>
                  <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                    {musicMuted ? 'مقفولة في الألعاب' : 'شغالة أثناء اللعب الحماسي'}
                  </div>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-xl text-xs font-black shrink-0 ${
                  !musicMuted
                    ? 'bg-[#F59E0B] text-[#1E293B]'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {musicMuted ? 'مقفولة' : 'شغالة'}
              </span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => {
                soundManager.unlock();
                soundManager.play('click');
                toggleTheme();
              }}
              className="w-full min-h-[60px] rounded-2xl qada-card px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isDark
                      ? 'bg-indigo-600 text-amber-300'
                      : 'bg-amber-400/25 text-amber-600'
                  }`}
                >
                  {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-black text-[#1E293B] dark:text-white">
                    المظهر العام للتطبيق
                  </div>
                  <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                    {isDark ? 'الوضع الليلي الداكن 🌙' : 'الوضع النهاري المشرق ☀️'}
                  </div>
                </div>
              </div>
              <span className="px-3 py-1 rounded-xl text-xs font-black bg-[#FFF5E8] dark:bg-slate-800 text-[#1E293B] dark:text-white border border-[#E7DEC8] dark:border-slate-700 shrink-0">
                تبديل
              </span>
            </button>

            {/* Quick Player Setup */}
            {onOpenPlayerSetup && (
              <button
                type="button"
                onClick={() => {
                  soundManager.play('next');
                  onClose();
                  onOpenPlayerSetup();
                }}
                className="w-full min-h-[54px] rounded-2xl qada-card px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FF6B4A]/15 text-[#FF6B4A] flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-sm sm:text-base font-black text-[#1E293B] dark:text-white">
                    تخصيص اللاعبين والأفاتار والألوان
                  </span>
                </div>
                <span className="text-xs font-black text-[#FF6B4A]">تعديل</span>
              </button>
            )}

            {/* Reset Saved History */}
            <button
              type="button"
              onClick={() => {
                soundManager.play('click');
                setConfirmReset(true);
              }}
              className="w-full min-h-[54px] rounded-2xl qada-card px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Eraser className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm sm:text-base font-black text-[#1E293B] dark:text-white">
                    تصفير سجل الكلمات والأسئلة
                  </div>
                  <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                    {usedCount > 0
                      ? `${usedCount} عنصر اتلعبوا قبل كده`
                      : 'كل الكلمات والأسئلة متاحة حالياً'}
                  </div>
                </div>
              </div>
              <span className="text-xs font-black text-[#D94E30] dark:text-[#FB7185] shrink-0">
                تصفير
              </span>
            </button>

            {toast && (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 px-3 py-2 text-center text-xs font-black text-emerald-700 dark:text-emerald-300">
                {toast}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[#E7DEC8]/70 dark:border-white/10 bg-white/40 dark:bg-[#0F172A]/50">
            <button
              type="button"
              onClick={() => {
                soundManager.play('whoosh');
                onClose();
              }}
              className="w-full min-h-[48px] rounded-2xl bakasa-btn-green text-white font-black text-base"
            >
              تم
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmReset}
        title="إعادة تصفير الأسئلة المحفوظة؟"
        message="متأكد؟ ده هيخلي كل الأسئلة والكلمات القديمة تظهر تاني من الأول."
        confirmLabel="نعم، صفّر"
        cancelLabel="إلغاء"
        onConfirm={() => {
          resetAllUsedItems();
          setUsedCount(0);
          setConfirmReset(false);
          soundManager.play('next');
          setToast('تم تصفير سجل الأسئلة والكلمات بنجاح ✅');
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
};
