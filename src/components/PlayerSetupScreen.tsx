import React, { useEffect, useState } from 'react';
import { Eraser, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { BANNER_COLOR_CLASSES } from '../data/gameData';
import { useTapGuard } from '../hooks/useAntiDoubleTap';
import { Player } from '../types/game';
import { soundManager } from '../utils/soundManager';
import { getUsedItemsCount, resetAllUsedItems } from '../utils/usedItemsMemory';
import { ConfirmModal } from './ConfirmModal';
import { PWAInstallButton } from './PWAInstallButton';
import { PlayerAvatar } from './PlayerAvatar';
import { TopBar } from './TopBar';

interface PlayerSetupScreenProps {
  players: Player[];
  onAddPlayer: (name: string) => void;
  onUpdatePlayerName: (id: string, name: string) => void;
  onRemovePlayer: (id: string) => void;
  onResetScores: () => void;
  onContinue: () => void;
  onBackToHome: () => void;
}

export const PlayerSetupScreen: React.FC<PlayerSetupScreenProps> = ({
  players,
  onAddPlayer,
  onUpdatePlayerName,
  onRemovePlayer,
  onResetScores,
  onContinue,
  onBackToHome,
}) => {
  const [newName, setNewName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showHistoryResetConfirm, setShowHistoryResetConfirm] = useState(false);
  const [usedCount, setUsedCount] = useState<number>(() => getUsedItemsCount());
  const [resetToast, setResetToast] = useState<string | null>(null);
  const guard = useTapGuard(400);

  useEffect(() => {
    if (!resetToast) return;
    const timer = window.setTimeout(() => setResetToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [resetToast]);

  const hasAnyScore = players.some((p) => p.score !== 0);

  const handleAdd = (e?: React.FormEvent) => {
    e?.preventDefault();
    soundManager.unlock();

    const trimmed = newName.trim();
    if (!trimmed) {
      soundManager.play('error');
      setErrorMsg('اكتب اسم اللاعب الأول');
      return;
    }
    if (players.length >= 20) {
      soundManager.play('error');
      setErrorMsg('أقصى عدد للاعبين هو ٢٠');
      return;
    }
    if (players.some((p) => p.name.trim() === trimmed)) {
      soundManager.play('error');
      setErrorMsg('الاسم ده موجود بالفعل، اختار اسم مختلف');
      return;
    }

    soundManager.play('click');
    onAddPlayer(trimmed);
    setNewName('');
    setErrorMsg('');
  };

  const handleContinue = guard(() => {
    soundManager.unlock();
    const invalidPlayer = players.find((p) => p.name.trim().length === 0);
    if (invalidPlayer) {
      soundManager.play('error');
      setErrorMsg('تأكد إن كل اللاعبين ليهم أسماء');
      return;
    }
    if (players.length < 2) {
      soundManager.play('error');
      setErrorMsg('لازم لاعبين (٢) على الأقل عشان نبدأ');
      return;
    }
    soundManager.play('next');
    onContinue();
  });

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title="تجهيز اللاعبين"
        exitVariant="home"
        exitLabel="القائمة الرئيسية"
        onExit={onBackToHome}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* Player count & Reset Scores bar */}
        <div className="flex items-center justify-between gap-3 mb-4 px-1">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC]">
            <Users className="w-4 h-4 text-[#FF6B4A]" />
            <span className="tabular-nums">اللاعبين ({players.length} / ٢٠)</span>
            <span className="text-[#CBD5E1] dark:text-[#475569]">·</span>
            <span className="text-[#64748B] dark:text-[#94A3B8]">الحد الأدنى ٢</span>
          </div>

          {hasAnyScore && (
            <button
              type="button"
              onClick={() => {
                soundManager.play('click');
                setShowResetConfirm(true);
              }}
              className="min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 text-xs font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#FF6B4A]" />
              <span>تصفير النقاط</span>
            </button>
          )}
        </div>

        {/* Add player form */}
        <form onSubmit={handleAdd} className="flex items-center gap-2.5 mb-3">
          <input
            type="text"
            value={newName}
            maxLength={20}
            onChange={(e) => {
              setNewName(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="اكتب اسم لاعب جديد..."
            disabled={players.length >= 20}
            className="flex-1 min-h-[50px] rounded-2xl bg-white dark:bg-[#1E293B] border-2 border-[#E7DEC8] dark:border-[#334155] focus:border-[#FF6B4A] outline-none px-4 text-base font-bold text-[#1E293B] dark:text-white placeholder:text-[#94A3B8] shadow-sm transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={players.length >= 20}
            aria-label="إضافة لاعب"
            className="min-w-[54px] min-h-[50px] rounded-2xl bakasa-btn-green text-white font-black flex items-center justify-center gap-1 px-4 disabled:opacity-45 disabled:cursor-not-allowed transition-transform"
          >
            <Plus className="w-6 h-6" />
          </button>
        </form>

        {errorMsg && (
          <p className="text-sm font-bold text-[#E11D48] dark:text-rose-400 mb-3 px-2" role="alert">
            {errorMsg}
          </p>
        )}

        {/* Players list */}
        <div className="flex flex-col gap-3.5 mb-7 mt-1">
          {players.map((player) => {
            const style = BANNER_COLOR_CLASSES[player.color];
            return (
              <div
                key={player.id}
                className={`w-full min-h-[66px] rounded-2xl ${style.bg} ${style.shadow} border ${style.border} px-3.5 py-2 flex items-center justify-between gap-3`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <PlayerAvatar avatarId={player.avatarId} name={player.name} size="md" />
                  <input
                    type="text"
                    value={player.name}
                    maxLength={20}
                    aria-label={`تعديل اسم ${player.name}`}
                    onChange={(e) => {
                      if (errorMsg) setErrorMsg('');
                      onUpdatePlayerName(player.id, e.target.value);
                    }}
                    className="w-full min-h-[40px] bg-black/15 hover:bg-black/20 focus:bg-black/25 rounded-xl px-3 text-base sm:text-lg font-extrabold text-white outline-none border border-transparent focus:border-white/70 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-center leading-tight px-1">
                    <div className="text-base font-black text-white tabular-nums">
                      {player.score}
                    </div>
                    <div className="text-[11px] font-bold text-white/90">نقطة</div>
                  </div>

                  <button
                    type="button"
                    disabled={players.length <= 2}
                    onClick={() => {
                      soundManager.play('click');
                      onRemovePlayer(player.id);
                    }}
                    aria-label={`حذف ${player.name}`}
                    className="min-w-[44px] min-h-[44px] rounded-xl bg-black/15 hover:bg-black/25 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom primary CTA & Settings actions */}
        <div className="mt-auto pt-2 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleContinue}
            className="w-full max-w-[290px] min-h-[56px] rounded-2xl qada-btn-coral text-white text-xl font-black tracking-wide transition-transform"
          >
            التالي — اختر اللعبة
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.play('click');
              setShowHistoryResetConfirm(true);
            }}
            className="w-full max-w-[290px] min-h-[46px] px-4 rounded-2xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 text-xs sm:text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Eraser className="w-4 h-4 text-[#F59E0B] shrink-0" />
            <span>إعادة تصفير الأسئلة المحفوظة</span>
            {usedCount > 0 && (
              <span className="text-[#D94E30] dark:text-[#FB7185] tabular-nums">({usedCount})</span>
            )}
          </button>

          <div className="w-full max-w-[290px]">
            <PWAInstallButton />
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
        open={showResetConfirm}
        title="تصفير كل النقاط؟"
        message="هيتم مسح نقاط كل اللاعبين وترجع صفر مع الاحتفاظ بأسمائهم."
        confirmLabel="نعم، صفّر النقاط"
        cancelLabel="إلغاء"
        onConfirm={() => {
          onResetScores();
          setShowResetConfirm(false);
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      <ConfirmModal
        open={showHistoryResetConfirm}
        title="إعادة تصفير الأسئلة المحفوظة؟"
        message="هيتم مسح سجل الكلمات والأسئلة اللي اتلعبت قبل كده في كل الألعاب عشان تبدأ كلها من جديد."
        confirmLabel="نعم، صفّر السجل"
        cancelLabel="إلغاء"
        onConfirm={() => {
          resetAllUsedItems();
          setUsedCount(0);
          setShowHistoryResetConfirm(false);
          soundManager.play('next');
          setResetToast('تم إعادة تصفير الأسئلة المحفوظة بنجاح');
        }}
        onCancel={() => setShowHistoryResetConfirm(false)}
      />
    </div>
  );
};
