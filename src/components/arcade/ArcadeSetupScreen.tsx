import React, { useState } from 'react';
import { Gamepad2, RotateCcw, Smartphone, Users } from 'lucide-react';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import {
  ARCADE_COLOR_ORDER,
  ARCADE_COLORS,
  ArcadeColorId,
  ArcadePlayer,
  CornerSlot,
  getCornerPlacements,
} from '../../types/arcade';
import { soundManager } from '../../utils/soundManager';
import { ConfirmModal } from '../ConfirmModal';
import { TopBar } from '../TopBar';

interface ArcadeSetupScreenProps {
  players: ArcadePlayer[];
  playerCount: 2 | 3 | 4;
  onChangePlayerCount: (count: 2 | 3 | 4) => void;
  onUpdatePlayerName: (id: string, name: string) => void;
  onSelectPlayerColor: (playerId: string, colorId: ArcadeColorId) => void;
  onResetScores: () => void;
  onContinue: () => void;
  onBackToHome: () => void;
}

const SLOT_POSITION_CLASSES: Record<CornerSlot, string> = {
  'top-left': 'top-2.5 left-2.5',
  'top-right': 'top-2.5 right-2.5',
  'bottom-left': 'bottom-2.5 left-2.5',
  'bottom-right': 'bottom-2.5 right-2.5',
};

export const ArcadeSetupScreen: React.FC<ArcadeSetupScreenProps> = ({
  players,
  playerCount,
  onChangePlayerCount,
  onUpdatePlayerName,
  onSelectPlayerColor,
  onResetScores,
  onContinue,
  onBackToHome,
}) => {
  const guard = useTapGuard(400);
  const [errorMsg, setErrorMsg] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const activePlayers = players.slice(0, playerCount);
  const placements = getCornerPlacements(playerCount);
  const hasAnyScore = players.some((p) => p.score !== 0);

  const handleContinue = guard(() => {
    soundManager.unlock();
    const hasEmpty = activePlayers.some((p) => p.name.trim().length === 0);
    if (hasEmpty) {
      soundManager.play('error');
      setErrorMsg('اكتب اسم كل لاعب قبل ما تبدأ');
      return;
    }
    soundManager.play('next');
    onContinue();
  });

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title="تحدي الشاشة 2D"
        exitVariant="home"
        exitLabel="القائمة الرئيسية"
        onExit={onBackToHome}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* Player count selector (2, 3, or 4) */}
        <section className="rounded-3xl qada-card p-4 mb-4">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <span className="text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#14B8A6]" />
              <span>عدد اللاعبين على الشاشة:</span>
            </span>

            {hasAnyScore && (
              <button
                type="button"
                onClick={() => {
                  soundManager.play('click');
                  setShowResetConfirm(true);
                }}
                className="min-h-[38px] px-3 rounded-xl bg-[#FFF5E8] dark:bg-[#0F172A] hover:bg-[#FEEBC8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] text-xs font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#D94E30] dark:text-[#FB7185]" />
                <span>تصفير النقاط</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {([2, 3, 4] as const).map((count) => {
              const active = playerCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => {
                    soundManager.play('click');
                    setErrorMsg('');
                    onChangePlayerCount(count);
                  }}
                  className={`min-h-[48px] rounded-xl text-sm sm:text-base font-black transition-all ${
                    active
                      ? 'qada-btn-teal text-white'
                      : 'bg-[#FFF9F0] dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#FFF3E0] dark:hover:bg-[#334155] hover:text-[#1E293B] dark:hover:text-[#F8FAFC] border-2 border-[#E7DEC8] dark:border-[#334155]'
                  }`}
                >
                  {count === 2 ? '٢ لاعبين' : count === 3 ? '٣ لاعبين' : '٤ لاعبين'}
                </button>
              );
            })}
          </div>
        </section>

        {/* Live Corner Touch-Zone Preview */}
        <section className="rounded-3xl qada-card p-4 mb-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs sm:text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#FF6B4A]" />
              <span>أماكن اللمس على الشاشة:</span>
            </span>
            <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
              كل لاعب يمسك زاويته
            </span>
          </div>

          <div
            dir="ltr"
            className="relative w-full max-w-[310px] h-[170px] mx-auto rounded-2xl bg-[#FFF5E8] dark:bg-[#0F172A] border-2 border-[#D9CCB8] dark:border-[#334155] shadow-inner overflow-hidden flex items-center justify-center"
          >
            <div className="text-center px-4 pointer-events-none">
              <Gamepad2 className="w-7 h-7 text-[#94A3B8] dark:text-[#64748B] mx-auto mb-1" />
              <div className="text-[11px] font-extrabold text-[#64748B] dark:text-[#94A3B8]">
                منطقة اللعب 2D
              </div>
            </div>

            {activePlayers.map((player, idx) => {
              const theme = ARCADE_COLORS[player.colorId];
              const placement = placements[idx];
              if (!placement) return null;

              return (
                <div
                  key={player.id}
                  style={{
                    backgroundColor: theme.hex,
                    color: theme.textOnColor,
                  }}
                  className={`absolute ${SLOT_POSITION_CLASSES[placement.slot]} min-w-[96px] max-w-[132px] rounded-xl border-2 border-white dark:border-white/90 px-2.5 py-1.5 shadow-md text-center ${
                    placement.isTop ? 'rotate-180' : ''
                  }`}
                >
                  <div className="text-xs font-black truncate">{player.name || '...'}</div>
                  <div className="text-[10px] font-extrabold opacity-85">{placement.label}</div>
                </div>
              );
            })}
          </div>
        </section>

        {errorMsg && (
          <p className="text-sm font-extrabold text-[#E11D48] dark:text-[#FDA4AF] mb-3 px-2" role="alert">
            {errorMsg}
          </p>
        )}

        {/* Active player cards (Name + Color Picker) */}
        <div className="flex flex-col gap-3 mb-7">
          {activePlayers.map((player, idx) => {
            const theme = ARCADE_COLORS[player.colorId];
            const placement = placements[idx];
            return (
              <div
                key={player.id}
                className={`w-full rounded-2xl ${theme.bgClass} ${theme.shadowClass} border ${theme.borderClass} px-3.5 py-3 flex flex-col gap-2.5`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      style={{ color: theme.textOnColor }}
                      className="text-xs font-black px-2 py-1 rounded-lg bg-black/15 shrink-0"
                    >
                      {placement?.label}
                    </span>
                    <input
                      type="text"
                      value={player.name}
                      maxLength={16}
                      aria-label={`اسم اللاعب ${idx + 1}`}
                      onChange={(e) => {
                        if (errorMsg) setErrorMsg('');
                        onUpdatePlayerName(player.id, e.target.value);
                      }}
                      style={{ color: theme.textOnColor }}
                      className="w-full min-h-[42px] bg-black/15 hover:bg-black/20 focus:bg-black/25 rounded-xl px-3 text-base font-extrabold placeholder:opacity-60 outline-none border border-transparent focus:border-white/70 transition-colors"
                    />
                  </div>

                  <div className="text-center leading-tight px-2 shrink-0">
                    <div
                      style={{ color: theme.textOnColor }}
                      className="text-base font-black tabular-nums"
                    >
                      {player.score}
                    </div>
                    <div
                      style={{ color: theme.textOnColor }}
                      className="text-[11px] font-bold opacity-85"
                    >
                      نقطة
                    </div>
                  </div>
                </div>

                {/* Color swatches */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-black/15">
                  <span
                    style={{ color: theme.textOnColor }}
                    className="text-xs font-extrabold opacity-90"
                  >
                    اللون: {theme.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {ARCADE_COLOR_ORDER.map((cId) => {
                      const c = ARCADE_COLORS[cId];
                      const selected = player.colorId === cId;
                      return (
                        <button
                          key={cId}
                          type="button"
                          aria-label={`اختيار اللون ${c.name}`}
                          onClick={() => {
                            soundManager.play('click');
                            onSelectPlayerColor(player.id, cId);
                          }}
                          style={{ backgroundColor: c.hex }}
                          className={`w-8 h-8 rounded-full border-2 transition-transform ${
                            selected
                              ? 'border-white scale-110 ring-2 ring-black/40'
                              : 'border-black/40 opacity-80 hover:opacity-100'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-auto pt-2 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleContinue}
            className="w-full max-w-[290px] min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
          >
            التالي — اختر لعبة 2D
          </button>
        </div>
      </main>

      <ConfirmModal
        open={showResetConfirm}
        title="تصفير نقاط تحدي الشاشة؟"
        message="هيتم مسح نقاط كل لاعبين ألعاب الـ 2D وترجع صفر."
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
