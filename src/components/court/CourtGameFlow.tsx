import React, { useState } from 'react';
import {
  ArrowLeft,
  Dices,
  Flame,
  RefreshCw,
  Scale,
  Shuffle,
  Users,
} from 'lucide-react';
import { COURT_DARES, COURT_QUESTIONS } from '../../data/courtData';
import { BANNER_COLOR_CLASSES } from '../../data/gameData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { Player } from '../../types/game';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { resolvePoolWithCustom } from '../../utils/customContentStorage';
import { pickUnseenItem } from '../../utils/usedItemsMemory';
import { ConfirmModal } from '../ConfirmModal';
import { PlayerAvatar } from '../PlayerAvatar';
import { TopBar } from '../TopBar';

interface CourtGameFlowProps {
  players: Player[];
  onExitToHub: () => void;
}

type TurnOrderMode = 'sequential' | 'random';

export const CourtGameFlow: React.FC<CourtGameFlowProps> = ({ players, onExitToHub }) => {
  const guard = useTapGuard(260);
  const [turnMode, setTurnMode] = useState<TurnOrderMode>('sequential');
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState<number>(0);
  const [turnCount, setTurnCount] = useState<number>(1);
  const questionPool = resolvePoolWithCustom(COURT_QUESTIONS, 'questions');

  const [question, setQuestion] = useState<string>(() =>
    pickUnseenItem('court_questions', questionPool)
  );
  const [activeDare, setActiveDare] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  useNavigationGuard(true, () => setShowExitConfirm(true));

  const currentPlayer = players[currentPlayerIdx % Math.max(1, players.length)] ?? players[0];
  const bannerStyle = BANNER_COLOR_CLASSES[currentPlayer?.color ?? 'plum'];

  const handleChangeQuestion = guard(() => {
    soundManager.unlock();
    soundManager.play('click');
    triggerHaptic(15);
    setQuestion(pickUnseenItem('court_questions', resolvePoolWithCustom(COURT_QUESTIONS, 'questions')));
    setActiveDare(null);
  });

  const handleTriggerDare = guard(() => {
    soundManager.unlock();
    soundManager.play('sting');
    triggerHaptic([35, 35, 70]);
    setActiveDare(pickUnseenItem('court_dares', resolvePoolWithCustom(COURT_DARES, 'dares')));
  });

  const handleRerollDare = guard(() => {
    soundManager.unlock();
    soundManager.play('powerup');
    triggerHaptic(25);
    setActiveDare(pickUnseenItem('court_dares', resolvePoolWithCustom(COURT_DARES, 'dares')));
  });

  const handleNextPlayer = guard(() => {
    soundManager.unlock();
    soundManager.play('next');
    triggerHaptic(20);

    let nextIdx = (currentPlayerIdx + 1) % players.length;
    if (turnMode === 'random' && players.length > 1) {
      const candidates = players
        .map((_, idx) => idx)
        .filter((idx) => idx !== currentPlayerIdx);
      nextIdx = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
    }

    setCurrentPlayerIdx(nextIdx);
    setTurnCount((prev) => prev + 1);
    setQuestion(pickUnseenItem('court_questions', resolvePoolWithCustom(COURT_QUESTIONS, 'questions')));
    setActiveDare(null);
  });

  const handleToggleTurnMode = (mode: TurnOrderMode) => {
    if (mode === turnMode) return;
    soundManager.unlock();
    soundManager.play('click');
    setTurnMode(mode);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title="محكمة الصحاب"
        exitVariant="back"
        exitLabel="رجوع للألعاب"
        onExit={() => setShowExitConfirm(true)}
      />

      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-8 pt-2 flex flex-col justify-between gap-4">
        {/* Top Turn Mode Selector & Turn Counter */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-2xl bg-white dark:bg-[#1E293B] border-2 border-[#E7DEC8] dark:border-[#334155] p-1 shadow-sm">
            <button
              type="button"
              onClick={() => handleToggleTurnMode('sequential')}
              className={`min-h-[36px] px-3 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                turnMode === 'sequential'
                  ? 'bg-[#8B5CF6] text-white shadow-sm'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>بالدور</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleTurnMode('random')}
              className={`min-h-[36px] px-3 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                turnMode === 'random'
                  ? 'bg-[#8B5CF6] text-white shadow-sm'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>عشوائي</span>
            </button>
          </div>

          <div className="rounded-2xl bg-white/90 dark:bg-[#1E293B]/90 border-2 border-[#E7DEC8] dark:border-[#334155] px-3 py-1.5 text-xs font-black text-[#64748B] dark:text-[#94A3B8] tabular-nums flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>سؤال #{turnCount}</span>
          </div>
        </div>

        {/* Active Player Spotlight Banner */}
        {currentPlayer && (
          <div
            className={`w-full rounded-3xl ${bannerStyle.bg} ${bannerStyle.shadow} border ${bannerStyle.border} px-5 py-4 flex items-center justify-between gap-3`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <PlayerAvatar
                avatarId={currentPlayer.avatarId}
                name={currentPlayer.name}
                size="lg"
              />
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-white/85">
                  الدور على:
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white truncate leading-tight">
                  {currentPlayer.name}
                </div>
              </div>
            </div>
            <div className="shrink-0 rounded-2xl bg-black/20 border border-white/25 px-3 py-1.5 text-xs font-black text-white">
              في قفص الاتهام ⚖️
            </div>
          </div>
        )}

        {/* Question Card OR Revealed Dare Card */}
        <div className="flex-1 flex flex-col justify-center gap-4">
          {!activeDare ? (
            <div className="w-full rounded-3xl qada-card p-6 sm:p-7 text-center relative overflow-hidden">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F3E8FF] dark:bg-purple-950/60 border border-[#D8B4FE] dark:border-purple-800 px-3.5 py-1 text-xs font-black text-[#6D28D9] dark:text-purple-300 mb-4">
                <Scale className="w-3.5 h-3.5" />
                <span>سؤال المحكمة (بدون وقت)</span>
              </div>

              <p className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-[#F8FAFC] leading-relaxed mb-6">
                {question}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleChangeQuestion}
                  className="w-full min-h-[48px] rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] hover:bg-[#FFF3E0] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 text-[#1E293B] dark:text-[#F8FAFC] text-sm sm:text-base font-black flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <RefreshCw className="w-4 h-4 text-[#8B5CF6]" />
                  <span>تغيير السؤال</span>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerDare}
                  className="w-full min-h-[54px] rounded-2xl bakasa-btn-red text-white text-base sm:text-lg font-black flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <Flame className="w-5 h-5" />
                  <span>مش هجاوب — هات عقاب! 🔥</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full rounded-3xl bg-[#FFF1F2] dark:bg-[#2A1219] border-2 border-[#FDA4AF] dark:border-rose-700 border-b-[6px] border-b-[#E11D48] dark:border-b-rose-950 p-6 sm:p-7 text-center shadow-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E11D48] px-4 py-1 text-xs font-black text-white mb-4 shadow-sm">
                <Flame className="w-4 h-4" />
                <span>عقاب المحكمة على {currentPlayer?.name}!</span>
              </div>

              <p className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-[#F8FAFC] leading-relaxed mb-6">
                {activeDare}
              </p>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleRerollDare}
                  className="w-full min-h-[48px] rounded-2xl qada-btn-amber text-[#1E293B] text-base font-black flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <Dices className="w-5 h-5" />
                  <span>عقاب تاني 🎲</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.play('click');
                    setActiveDare(null);
                  }}
                  className="w-full min-h-[40px] rounded-xl text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white transition-colors"
                >
                  رجوع للسؤال الأصلي
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Next Player Primary Action */}
        <button
          type="button"
          onClick={handleNextPlayer}
          className="w-full min-h-[58px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2.5 transition-transform active:scale-95"
        >
          <span>التالي (اللاعب اللي بعده)</span>
          <ArrowLeft className="w-6 h-6" />
        </button>
      </main>

      <ConfirmModal
        open={showExitConfirm}
        title="الخروج من محكمة الصحاب؟"
        message="عايز ترجع لقائمة ألعاب القعدة؟"
        confirmLabel="نعم، اخرج"
        cancelLabel="كمّل لعب"
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitToHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
