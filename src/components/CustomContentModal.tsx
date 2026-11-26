import React, { useEffect, useState } from 'react';
import {
  Check,
  Flame,
  Layers,
  MessageSquareQuote,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import {
  CustomContentData,
  CustomContentMode,
  CustomContentTab,
  addCustomItem,
  getCustomContent,
  removeCustomItem,
  setCustomMode,
} from '../utils/customContentStorage';
import { soundManager, triggerHaptic } from '../utils/soundManager';
import { RichIconBadge, RichPenIcon } from './RichGameIcons';

interface CustomContentModalProps {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

interface TabMeta {
  id: CustomContentTab;
  label: string;
  shortLabel: string;
  placeholder: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabMeta[] = [
  {
    id: 'words',
    label: 'كلمات الجاسوس والمزور والرسم',
    shortLabel: 'كلمات اللعب',
    placeholder: 'مثال: كشري التحرير، شاي بالنعناع، سبيس تون...',
    hint: 'بتشتغل في الجاسوس، المزور، رسمة في ١٠ ثواني، وبدون كلام!',
    Icon: Layers,
  },
  {
    id: 'questions',
    label: 'أسئلة محكمة الصحاب والقنبلة',
    shortLabel: 'أسئلة القعدة',
    placeholder: 'مثال: إيه أكتر سر خبيته عن الشلة؟',
    hint: 'بتظهر في أسئلة القنبلة ومحكمة الصحاب.',
    Icon: MessageSquareQuote,
  },
  {
    id: 'dares',
    label: 'عقوبات الخسران',
    shortLabel: 'العقوبات 😈',
    placeholder: 'مثال: غني مهرجان باللغة العربية الفصحى!',
    hint: 'بتظهر في عقوبات محكمة الصحاب وعقاب الخسران آخر كل لعبة.',
    Icon: Flame,
  },
  {
    id: 'footballNames',
    label: 'لاعيبة وأندية الكورة',
    shortLabel: 'الكورة ⚽',
    placeholder: 'مثال: تامر بجاتو، نادي الترسانة، زيدان...',
    hint: 'بتنزل في جاسوس الكورة، كلمة السر، خمن في الكورة، وقول اسم لاعب.',
    Icon: Trophy,
  },
];

export const CustomContentModal: React.FC<CustomContentModalProps> = ({
  open,
  onClose,
  onChanged,
}) => {
  const [data, setData] = useState<CustomContentData>(() => getCustomContent());
  const [activeTab, setActiveTab] = useState<CustomContentTab>('words');
  const [inputValue, setInputValue] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const [closing, setClosing] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setData(getCustomContent());
      setInputValue('');
      setFeedback(null);
      setClosing(false);
    }
  }, [open]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 1800);
    return () => window.clearTimeout(t);
  }, [feedback]);

  if (!open) return null;

  const handleAnimatedClose = () => {
    soundManager.play('whoosh');
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 180);
  };

  const currentTabMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const activeItems = data[activeTab];
  const totalCount =
    data.words.length + data.questions.length + data.dares.length + data.footballNames.length;

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      soundManager.play('error');
      return;
    }
    if (activeItems.includes(trimmed)) {
      soundManager.play('error');
      setFeedback('الكلمة دي موجودة بالفعل!');
      return;
    }
    const next = addCustomItem(activeTab, trimmed);
    setData(next);
    setInputValue('');
    soundManager.play('catch');
    triggerHaptic(20);
    setFeedback('تمت الإضافة بنجاح!');
    onChanged?.();
  };

  const handleRemove = (item: string) => {
    const next = removeCustomItem(activeTab, item);
    setData(next);
    soundManager.play('click');
    onChanged?.();
  };

  const handleModeChange = (mode: CustomContentMode) => {
    if (data.mode === mode) return;
    const next = setCustomMode(mode);
    setData(next);
    soundManager.play('click');
    triggerHaptic(15);
    onChanged?.();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/60 backdrop-blur-md ${
        closing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-content-title"
    >
      <div
        className={`w-full max-w-lg max-h-[88vh] rounded-3xl qada-glass-modal flex flex-col overflow-hidden ${
          closing ? 'animate-modal-out' : 'animate-modal-in'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E7DEC8]/70 dark:border-white/10 flex items-center justify-between gap-3 bg-white/45 dark:bg-[#0F172A]/55">
          <div className="flex items-center gap-2.5 min-w-0">
            <RichIconBadge tone="teal" size="sm">
              <RichPenIcon className="w-6 h-6" />
            </RichIconBadge>
            <div className="min-w-0">
              <h2
                id="custom-content-title"
                className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-white truncate"
              >
                كلماتك وأسئلتك الخاصة ✍️
              </h2>
              <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                محفوظة على جهازك ({totalCount} عنصر مضاف)
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="إغلاق"
            onClick={handleAnimatedClose}
            className="min-w-[40px] min-h-[40px] rounded-xl qada-glass-pill flex items-center justify-center text-[#1E293B] dark:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Play Mode Toggle */}
        <div className="px-4 pt-3 pb-2 border-b border-[#E7DEC8]/50 dark:border-white/10 bg-[#FFF9F0]/60 dark:bg-[#0F172A]/40">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleModeChange('merge')}
              className={`min-h-[42px] rounded-2xl px-3 py-1.5 text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 border transition-all ${
                data.mode === 'merge'
                  ? 'bg-[#10B981] text-white border-[#059669] shadow-[0_3px_0_#047857]'
                  : 'bg-white/85 dark:bg-[#1E293B] border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
              }`}
            >
              {data.mode === 'merge' && <Check className="w-4 h-4 shrink-0" />}
              <span>دمج كلماتي مع اللعبة</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('custom_only')}
              className={`min-h-[42px] rounded-2xl px-3 py-1.5 text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 border transition-all ${
                data.mode === 'custom_only'
                  ? 'bg-[#FF6B4A] text-white border-[#D94E30] shadow-[0_3px_0_#B9381C]'
                  : 'bg-white/85 dark:bg-[#1E293B] border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
              }`}
            >
              {data.mode === 'custom_only' && <Sparkles className="w-4 h-4 shrink-0" />}
              <span>العب بكلماتي بس</span>
            </button>
          </div>
          {data.mode === 'custom_only' && activeItems.length === 0 && (
            <p className="text-[11px] font-extrabold text-[#B45309] dark:text-amber-300 mt-1.5 text-center">
              ملاحظة: لو التبويب الحالي فاضي، اللعبة هترجع لمكتبة اللعبة الأساسية تلقائياً.
            </p>
          )}
        </div>

        {/* 4 Category Tabs */}
        <div className="px-4 pt-3 flex items-center gap-1.5 overflow-x-auto pb-2 shrink-0">
          {TABS.map((tab) => {
            const isSelected = tab.id === activeTab;
            const count = data[tab.id].length;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundManager.play('click');
                  setActiveTab(tab.id);
                }}
                className={`shrink-0 min-h-[38px] px-3 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all ${
                  isSelected
                    ? 'bg-[#1E293B] dark:bg-[#FF6B4A] text-white border-transparent shadow-sm'
                    : 'bg-white/85 dark:bg-[#1E293B] border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.shortLabel}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-[#FFF5E8] dark:bg-[#0F172A] text-[#D94E30] dark:text-[#FB7185]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Body: Add Form + List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1 flex flex-col gap-3">
          <div className="rounded-2xl bg-white/75 dark:bg-[#0F172A]/65 border border-[#E7DEC8] dark:border-[#334155] p-3">
            <div className="text-xs font-black text-[#1E293B] dark:text-white mb-1">
              {currentTabMeta.label}
            </div>
            <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] mb-2.5">
              {currentTabMeta.hint}
            </p>

            <form onSubmit={handleAdd} className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={currentTabMeta.placeholder}
                maxLength={120}
                className="flex-1 min-h-[44px] rounded-xl bg-white dark:bg-[#1E293B] border-2 border-[#E7DEC8] dark:border-[#334155] focus:border-[#FF6B4A] outline-none px-3 text-sm font-bold text-[#1E293B] dark:text-white placeholder:text-[#94A3B8]"
              />
              <button
                type="submit"
                aria-label="إضافة"
                className="min-w-[46px] min-h-[44px] px-3.5 rounded-xl bakasa-btn-green text-white font-black text-sm flex items-center justify-center gap-1 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>أضف</span>
              </button>
            </form>

            {feedback && (
              <div className="mt-2 text-xs font-black text-[#059669] dark:text-emerald-400 text-center">
                {feedback}
              </div>
            )}
          </div>

          {activeItems.length === 0 ? (
            <div className="flex-1 min-h-[120px] rounded-2xl border-2 border-dashed border-[#E7DEC8] dark:border-[#334155] flex flex-col items-center justify-center p-5 text-center text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">
              لسه مفيش إضافات هنا — اكتب اللي تحبه فوق واضغط أضف عشان ينزل في القعدة!
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activeItems.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl bg-white/90 dark:bg-[#1E293B]/90 border border-[#E7DEC8] dark:border-[#334155] px-3.5 py-2.5 flex items-center justify-between gap-2.5"
                >
                  <span className="text-sm font-extrabold text-[#1E293B] dark:text-white leading-snug break-words min-w-0">
                    {item}
                  </span>
                  <button
                    type="button"
                    aria-label={`حذف ${item}`}
                    onClick={() => handleRemove(item)}
                    className="min-w-[36px] min-h-[36px] rounded-xl bg-[#FFF1F2] dark:bg-rose-950/50 border border-[#FECDD3] dark:border-rose-800 text-[#E11D48] dark:text-rose-300 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E7DEC8]/70 dark:border-white/10 bg-white/45 dark:bg-[#0F172A]/55">
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="w-full min-h-[48px] rounded-2xl bakasa-btn-green text-white font-black text-base"
          >
            تمام، حفظ ورجوع
          </button>
        </div>
      </div>
    </div>
  );
};
