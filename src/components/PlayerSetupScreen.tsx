import React, { useEffect, useState } from 'react';
import { Check, Eraser, Palette, Plus, RotateCcw, Trash2, Users, X } from 'lucide-react';
import { BANNER_COLOR_CLASSES, PLAYER_COLOR_CYCLE } from '../data/gameData';
import { useTapGuard } from '../hooks/useAntiDoubleTap';
import { BannerColor, Player } from '../types/game';
import { soundManager } from '../utils/soundManager';
import { getUsedItemsCount, resetAllUsedItems } from '../utils/usedItemsMemory';
import { ConfirmModal } from './ConfirmModal';
import { PWAInstallButton } from './PWAInstallButton';
import { AVATAR_OPTIONS, PlayerAvatar } from './PlayerAvatar';
import { TopBar } from './TopBar';

interface PlayerSetupScreenProps {
  players: Player[];
  onAddPlayer: (name: string) => void;
  onUpdatePlayerName: (id: string, name: string) => void;
  onUpdatePlayerAppearance: (id: string, avatarId: number, color: BannerColor) => void;
  onRemovePlayer: (id: string) => void;
  onResetScores: () => void;
  onContinue: () => void;
  onBackToHome: () => void;
}

export const PlayerSetupScreen: React.FC<PlayerSetupScreenProps> = ({
  players,
  onAddPlayer,
  onUpdatePlayerName,
  onUpdatePlayerAppearance,
  onRemovePlayer,
  onResetScores,
  onContinue,
  onBackToHome,
}) => {
  const [newName, setNewName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showHistoryResetConfirm, setShowHistoryResetConfirm] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [usedCount, setUsedCount] = useState<number>(() => getUsedItemsCount());
  const [resetToast, setResetToast] = useState<string | null>(null);
  const guard = useTapGuard(400);

  useEffect(() => {
    if (!resetToast) return;
    const timer = window.setTimeout(() => setResetToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [resetToast]);

  const hasAnyScore = players.some((p) => p.score !== 0);
  const editingPlayer = players.find((p) => p.id === editingPlayerId) ?? null;

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
        exitLabel="الرئيسية"
        showSettingsButton
        onExit={onBackToHome}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* Player count & Reset Scores bar */}
        <div className="flex items-center justify-between gap-3 mb-4 px-1">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC]">
            <Users className="w-4 h-4 text-[#FF6B4A]" />
            <span className="tabular-nums">اللاعبين ({players.length} / ٢٠)</span>
            <span className="text-[#CBD5E1] dark:text-[#475569]">·</span>
            <span className="text-[#64748B] dark:text-[#94A3B8]">اضغط على الشخصية للتخصيص</span>
          </div>

          {hasAnyScore && (
            <button
              type="button"
              onClick={() => {
                soundManager.play('click');
                setShowResetConfirm(true);
              }}
              className="min-h-[40px] px-3 rounded-xl qada-glass-pill text-xs font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
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
            const style = BANNER_COLOR_CLASSES[player.color] ?? BANNER_COLOR_CLASSES.coral;
            return (
              <div
                key={player.id}
                className={`w-full min-h-[68px] rounded-2xl ${style.bg} ${style.shadow} border ${style.border} px-3 py-2 flex items-center justify-between gap-2.5`}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setEditingPlayerId(player.id);
                    }}
                    aria-label={`تخصيص شخصية ولون ${player.name}`}
                    className="relative shrink-0 rounded-full hover:scale-105 active:scale-95 transition-transform"
                  >
                    <PlayerAvatar avatarId={player.avatarId} name={player.name} size="md" />
                    <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-white text-[#1E293B] border border-slate-200 shadow flex items-center justify-center">
                      <Palette className="w-3 h-3 text-[#FF6B4A]" />
                    </span>
                  </button>

                  <input
                    type="text"
                    value={player.name}
                    maxLength={20}
                    aria-label={`تعديل اسم ${player.name}`}
                    onChange={(e) => {
                      if (errorMsg) setErrorMsg('');
                      onUpdatePlayerName(player.id, e.target.value);
                    }}
                    className="w-full min-h-[42px] bg-black/15 hover:bg-black/20 focus:bg-black/25 rounded-xl px-3 text-base sm:text-lg font-extrabold text-white outline-none border border-transparent focus:border-white/70 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
                    className="min-w-[42px] min-h-[42px] rounded-xl bg-black/15 hover:bg-black/25 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
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
            className="w-full max-w-[290px] min-h-[46px] px-4 rounded-2xl qada-glass-pill text-xs sm:text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
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

      {/* Avatar & Unique Color Picker Modal */}
      {editingPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/82 animate-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-picker-title"
        >
          <div className="w-full max-w-md max-h-[88dvh] rounded-3xl qada-glass-modal animate-modal-in flex flex-col overflow-hidden">
            {(() => {
              const activeStyle = BANNER_COLOR_CLASSES[editingPlayer.color] ?? BANNER_COLOR_CLASSES.coral;
              return (
                <div className={`px-5 py-4 ${activeStyle.bg} text-white flex items-center justify-between gap-3`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerAvatar avatarId={editingPlayer.avatarId} name={editingPlayer.name} size="md" />
                    <div className="min-w-0">
                      <h2 id="avatar-picker-title" className="text-lg font-black truncate">
                        {editingPlayer.name}
                      </h2>
                      <p className="text-xs font-bold text-white/90">
                        اللون: {activeStyle.name} · {AVATAR_OPTIONS[Math.abs(editingPlayer.avatarId) % AVATAR_OPTIONS.length].label}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="إغلاق"
                    onClick={() => {
                      soundManager.play('whoosh');
                      setEditingPlayerId(null);
                    }}
                    className="min-w-[40px] min-h-[40px] rounded-xl bg-black/20 hover:bg-black/30 flex items-center justify-center text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              );
            })()}

            <div className="p-4 overflow-y-auto flex flex-col gap-5 text-right">
              {/* 16 Unique Colors */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-sm font-black text-[#1E293B] dark:text-white">
                    اختار اللون المميز (١٦ لون)
                  </span>
                  <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                    كل لاعب بلون مختلف
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {PLAYER_COLOR_CYCLE.map((cKey) => {
                    const cStyle = BANNER_COLOR_CLASSES[cKey];
                    const selected = editingPlayer.color === cKey;
                    const owner = players.find((p) => p.id !== editingPlayer.id && p.color === cKey);
                    return (
                      <button
                        key={cKey}
                        type="button"
                        onClick={() => {
                          soundManager.play('click');
                          onUpdatePlayerAppearance(editingPlayer.id, editingPlayer.avatarId, cKey);
                        }}
                        style={{ backgroundColor: cStyle.hex }}
                        className={`min-h-[48px] rounded-2xl px-2 py-1.5 flex flex-col items-center justify-center text-white text-[11px] font-black border-2 transition-transform active:scale-95 ${
                          selected
                            ? 'border-white ring-3 ring-slate-900/50 dark:ring-white/80 scale-[1.04]'
                            : owner
                              ? 'border-white/30 opacity-80'
                              : 'border-white/60 hover:scale-[1.03]'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                          <span>{cStyle.name}</span>
                        </div>
                        {owner && (
                          <span className="text-[9px] font-bold bg-black/30 px-1.5 rounded-full truncate max-w-full mt-0.5">
                            مع {owner.name}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 24 Avatars */}
              <div>
                <div className="text-sm font-black text-[#1E293B] dark:text-white mb-2.5">
                  اختار الشخصية (٢٤ أفاتار)
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                  {AVATAR_OPTIONS.map((av) => {
                    const active = editingPlayer.avatarId === av.id;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => {
                          soundManager.play('click');
                          onUpdatePlayerAppearance(editingPlayer.id, av.id, editingPlayer.color);
                        }}
                        className={`rounded-2xl p-1.5 flex flex-col items-center gap-1 border-2 transition-all active:scale-95 ${
                          active
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-[#10B981] ring-2 ring-[#10B981]/50'
                            : 'bg-[#FFF9F0] dark:bg-[#0F172A] border-[#E7DEC8] dark:border-[#334155] hover:border-[#FF6B4A]/60'
                        }`}
                      >
                        <PlayerAvatar avatarId={av.id} name={av.label} size="sm" />
                        <span className="text-[10px] font-extrabold text-[#334155] dark:text-slate-300 truncate max-w-full">
                          {av.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E7DEC8]/70 dark:border-white/10 bg-white/40 dark:bg-[#0F172A]/50">
              <button
                type="button"
                onClick={() => {
                  soundManager.play('next');
                  setEditingPlayerId(null);
                }}
                className="w-full min-h-[48px] rounded-2xl bakasa-btn-green text-white font-black text-base"
              >
                حفظ التغييرات ✅
              </button>
            </div>
          </div>
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
