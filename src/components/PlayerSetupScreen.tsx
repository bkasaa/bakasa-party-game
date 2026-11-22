import React, { useState } from 'react';
import { Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { BANNER_COLOR_CLASSES } from '../data/gameData';
import { useTapGuard } from '../hooks/useAntiDoubleTap';
import { Player } from '../types/game';
import { soundManager } from '../utils/soundManager';
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
}

export const PlayerSetupScreen: React.FC<PlayerSetupScreenProps> = ({
  players,
  onAddPlayer,
  onUpdatePlayerName,
  onRemovePlayer,
  onResetScores,
  onContinue,
}) => {
  const [newName, setNewName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const guard = useTapGuard(400);

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
    if (players.length >= 10) {
      soundManager.play('error');
      setErrorMsg('أقصى عدد للاعبين هو ١٠');
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
    if (players.length < 3) {
      soundManager.play('error');
      setErrorMsg('لازم ٣ لاعبين على الأقل عشان نبدأ');
      return;
    }
    soundManager.play('next');
    onContinue();
  });

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="بكاسة — تجهيز اللاعبين" />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* Player count & Reset Scores bar */}
        <div className="flex items-center justify-between gap-3 mb-4 px-1">
          <div className="flex items-center gap-2 text-sm font-bold text-white/85">
            <Users className="w-4 h-4 text-pink-300" />
            <span className="tabular-nums">اللاعبين ({players.length} / ١٠)</span>
            <span className="text-white/40">·</span>
            <span className="text-white/70">الحد الأدنى ٣</span>
          </div>

          {hasAnyScore && (
            <button
              type="button"
              onClick={() => {
                soundManager.play('click');
                setShowResetConfirm(true);
              }}
              className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
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
            disabled={players.length >= 10}
            className="flex-1 min-h-[50px] rounded-2xl bg-[#271047]/90 border-2 border-white/20 focus:border-pink-400 outline-none px-4 text-base font-bold text-white placeholder:text-white/45 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={players.length >= 10}
            aria-label="إضافة لاعب"
            className="min-w-[54px] min-h-[50px] rounded-2xl bakasa-btn-green text-white font-black flex items-center justify-center gap-1 px-4 disabled:opacity-45 disabled:cursor-not-allowed transition-transform"
          >
            <Plus className="w-6 h-6" />
          </button>
        </form>

        {errorMsg && (
          <p className="text-sm font-bold text-rose-300 mb-3 px-2" role="alert">
            {errorMsg}
          </p>
        )}

        {/* Players list */}
        <div className="flex flex-col gap-3 mb-7 mt-1">
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
                    className="w-full min-h-[40px] bg-black/15 hover:bg-black/25 focus:bg-black/35 rounded-xl px-3 text-base sm:text-lg font-extrabold text-white outline-none border border-transparent focus:border-white/50 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-center leading-tight px-1">
                    <div className="text-base font-black text-white tabular-nums">
                      {player.score}
                    </div>
                    <div className="text-[11px] font-bold text-white/85">نقطة</div>
                  </div>

                  <button
                    type="button"
                    disabled={players.length <= 3}
                    onClick={() => {
                      soundManager.play('click');
                      onRemovePlayer(player.id);
                    }}
                    aria-label={`حذف ${player.name}`}
                    className="min-w-[44px] min-h-[44px] rounded-xl bg-black/20 hover:bg-black/35 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom primary CTA */}
        <div className="mt-auto pt-2 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleContinue}
            className="w-full max-w-[280px] min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
          >
            التالي — اختر اللعبة
          </button>
          <div className="w-full max-w-[280px]">
            <PWAInstallButton />
          </div>
        </div>
      </main>

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
    </div>
  );
};
