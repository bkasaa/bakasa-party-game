import React, { useState } from 'react';
import { Dices, Flame, Skull } from 'lucide-react';
import { COURT_DARES } from '../data/courtData';
import { resolvePoolWithCustom } from '../utils/customContentStorage';
import { soundManager, triggerHaptic } from '../utils/soundManager';
import { pickUnseenItem } from '../utils/usedItemsMemory';

interface LoserPunishmentCardProps {
  loserNames: string[];
  onDareChange?: (dare: string | null) => void;
}

export const LoserPunishmentCard: React.FC<LoserPunishmentCardProps> = ({
  loserNames,
  onDareChange,
}) => {
  const [dare, setDare] = useState<string | null>(null);

  if (loserNames.length === 0) return null;

  const handlePickDare = () => {
    soundManager.unlock();
    soundManager.play('sting');
    triggerHaptic([30, 30, 60]);
    const pool = resolvePoolWithCustom(COURT_DARES, 'dares');
    const nextDare = pickUnseenItem('court_dares', pool);
    setDare(nextDare);
    onDareChange?.(nextDare);
  };

  const label =
    loserNames.length === 1
      ? `المركز الأخير (الخسران): ${loserNames[0]}`
      : `المركز الأخير (تعادل): ${loserNames.join(' و ')}`;

  return (
    <div
      dir="rtl"
      className="w-full mb-5 rounded-3xl bg-white dark:bg-[#1E293B] border-2 border-[#FDA4AF] dark:border-rose-800/70 border-b-4 border-b-[#F43F5E] dark:border-b-rose-950 p-4 shadow-md"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-center shrink-0">
            <Skull className="w-5 h-5 text-[#E11D48] dark:text-rose-400" />
          </div>
          <div className="text-right min-w-0">
            <div className="text-xs font-extrabold text-[#9F1239] dark:text-rose-300 truncate">
              {label}
            </div>
            <div className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
              مينفعش يخرج من القعدة كده من غير عقاب!
            </div>
          </div>
        </div>
      </div>

      {dare ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-[#FFF1F2] dark:bg-rose-950/40 border-2 border-[#FECDD3] dark:border-rose-800/60 p-3.5 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-[#E11D48] dark:text-rose-300 mb-1.5">
              <Flame className="w-4 h-4" />
              <span>عقاب الخسران</span>
            </div>
            <p className="text-sm sm:text-base font-black text-[#1E293B] dark:text-[#F8FAFC] leading-relaxed">
              {dare}
            </p>
          </div>

          <button
            type="button"
            onClick={handlePickDare}
            className="w-full min-h-[44px] rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] hover:bg-[#FFF3E0] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 text-[#1E293B] dark:text-[#F8FAFC] text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Dices className="w-4 h-4 text-[#FF6B4A]" />
            <span>عقاب تاني 🎲</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePickDare}
          className="w-full min-h-[48px] rounded-2xl bakasa-btn-red text-white text-sm sm:text-base font-black flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <Flame className="w-5 h-5" />
          <span>اقترح عقاب للخسران 😈</span>
        </button>
      )}
    </div>
  );
};
