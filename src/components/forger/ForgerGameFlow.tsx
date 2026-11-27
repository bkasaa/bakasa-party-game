import React, { useMemo, useState } from 'react';
import { Check, EyeOff, Fingerprint, Lock, Pencil, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import { FORGER_BRUSH_COLORS, FORGER_CATEGORIES } from '../../data/gameData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { ForgerCategory, ForgerPhase, Player, RoundDelta } from '../../types/game';
import { soundManager } from '../../utils/soundManager';
import { recordSpyCatch } from '../../utils/sessionStats';
import { getCustomContent } from '../../utils/customContentStorage';
import { pickUnseenItem } from '../../utils/usedItemsMemory';
import { ActiveTurnBanner } from '../ActiveTurnBanner';
import { CategoryFilterBar } from '../CategoryFilterBar';
import { ConfirmModal } from '../ConfirmModal';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { PlayerAvatar } from '../PlayerAvatar';
import { DrawStroke } from '../draw/DrawingCanvas';
import { TopBar } from '../TopBar';
import { ForgerCanvas } from './ForgerCanvas';

interface ForgerGameFlowProps {
  players: Player[];
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
}

interface PlayerBrush {
  hex: string;
  name: string;
}

export const ForgerGameFlow: React.FC<ForgerGameFlowProps> = ({
  players,
  onApplyDeltas,
  onExitToHub,
  onTournamentFinish,
}) => {
  const guard = useTapGuard(400);

  const [phase, setPhase] = useState<ForgerPhase>('READY');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [category, setCategory] = useState<ForgerCategory>(FORGER_CATEGORIES[0]);
  const [secretWord, setSecretWord] = useState<string>('');
  const [forgerId, setForgerId] = useState<string>('');
  const [playerBrushes, setPlayerBrushes] = useState<Record<string, PlayerBrush>>({});

  // Anti-peek role reveal
  const [revealIdx, setRevealIdx] = useState<number>(0);
  const [isHoldingCard, setIsHoldingCard] = useState<boolean>(false);
  const [hasPeekedCurrent, setHasPeekedCurrent] = useState<boolean>(false);

  // Collaborative 2-round drawing state
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [drawOrder, setDrawOrder] = useState<Player[]>([]);
  const [drawStepIdx, setDrawStepIdx] = useState<number>(0);
  const [turnStrokeDone, setTurnStrokeDone] = useState<boolean>(false);

  // Voting state
  const [voterIdx, setVoterIdx] = useState<number>(0);
  const [selectedSuspectId, setSelectedSuspectId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, string>>({});

  // Fake Artist Last Chance guess state
  const [guessOptions, setGuessOptions] = useState<string[]>([]);
  const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
  const [forgerGuessedRight, setForgerGuessedRight] = useState<boolean>(false);
  const [forgerEscapedVotes, setForgerEscapedVotes] = useState<boolean>(false);

  // Results
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const isRoundInProgress =
    phase === 'PASS_REVEAL' ||
    phase === 'REVEAL_ROLE' ||
    phase === 'DRAW_STROKE' ||
    phase === 'VOTING' ||
    phase === 'FORGER_IDENTITY_REVEAL' ||
    phase === 'FORGER_FINAL_GUESS';

  useNavigationGuard(isRoundInProgress, () => {
    setShowExitConfirm(true);
  });

  const forgerCategoryBank = useMemo(() => {
    const custom = getCustomContent();
    if (custom.words.length === 0) return FORGER_CATEGORIES;
    const customCat: ForgerCategory = {
      id: '__custom_forger_words__',
      name: 'كلماتك الخاصة ✍️',
      words: custom.words,
    };
    if (custom.mode === 'custom_only') return [customCat];
    return [customCat, ...FORGER_CATEGORIES];
  }, []);

  const activeForgerCategories = useMemo(
    () =>
      selectedCategoryIds.length === 0
        ? forgerCategoryBank
        : forgerCategoryBank.filter((cat) => selectedCategoryIds.includes(cat.id)),
    [forgerCategoryBank, selectedCategoryIds]
  );

  const totalForgerWords = useMemo(
    () => activeForgerCategories.reduce((sum, cat) => sum + cat.words.length, 0),
    [activeForgerCategories]
  );

  const startNewRound = guard(() => {
    soundManager.unlock();
    soundManager.play('next');

    const categoryPool =
      activeForgerCategories.length > 0 ? activeForgerCategories : forgerCategoryBank;
    const chosenCategory = categoryPool[Math.floor(Math.random() * categoryPool.length)];
    const chosenWord = pickUnseenItem(`forger:${chosenCategory.id}`, chosenCategory.words);

    const chosenForger = players[Math.floor(Math.random() * players.length)];

    // Assign each player a distinct, high-contrast brush color
    const brushes: Record<string, PlayerBrush> = {};
    players.forEach((p, idx) => {
      brushes[p.id] = FORGER_BRUSH_COLORS[idx % FORGER_BRUSH_COLORS.length];
    });

    // Randomize player turn order for drawing (1 fast round)
    const shuffledDrawers = [...players].sort(() => Math.random() - 0.5);

    setCategory(chosenCategory);
    setSecretWord(chosenWord);
    setForgerId(chosenForger.id);
    setPlayerBrushes(brushes);

    setRevealIdx(0);
    setIsHoldingCard(false);
    setHasPeekedCurrent(false);

    setStrokes([]);
    setDrawOrder(shuffledDrawers);
    setDrawStepIdx(0);
    setTurnStrokeDone(false);

    setVoterIdx(0);
    setSelectedSuspectId(null);
    setVotes({});

    const decoys = chosenCategory.words
      .filter((w) => w !== chosenWord)
      .sort(() => Math.random() - 0.5)
      .slice(0, 15);
    setGuessOptions([chosenWord, ...decoys].sort(() => Math.random() - 0.5));
    setSelectedGuess(null);
    setForgerGuessedRight(false);
    setForgerEscapedVotes(false);
    setRoundDeltas([]);

    setPhase('PASS_REVEAL');
  });

  const handlePassRevealNext = guard(() => {
    soundManager.play('click');
    setIsHoldingCard(false);
    setHasPeekedCurrent(false);
    setPhase('REVEAL_ROLE');
  });

  const handleRoleNext = guard(() => {
    if (!hasPeekedCurrent) return;
    setIsHoldingCard(false);
    setHasPeekedCurrent(false);
    soundManager.play('next');

    if (revealIdx + 1 < players.length) {
      setRevealIdx((prev) => prev + 1);
      setPhase('PASS_REVEAL');
    } else {
      setDrawStepIdx(0);
      setTurnStrokeDone(false);
      setPhase('DRAW_STROKE');
    }
  });

  const handleStrokeComplete = (stroke: DrawStroke) => {
    soundManager.play('click');
    setStrokes((prev) => [...prev, stroke]);
    setTurnStrokeDone(true);
  };

  const totalDrawTurns = drawOrder.length;

  const handleAdvanceDrawTurn = guard(() => {
    if (!turnStrokeDone) return;
    soundManager.play('next');

    if (drawStepIdx + 1 < totalDrawTurns) {
      setDrawStepIdx((prev) => prev + 1);
      setTurnStrokeDone(false);
    } else {
      setVoterIdx(0);
      setSelectedSuspectId(null);
      setVotes({});
      setPhase('VOTING');
    }
  });

  const handleVoteNext = guard(() => {
    if (!selectedSuspectId) {
      soundManager.play('error');
      return;
    }

    const voter = players[voterIdx];
    const updatedVotes = { ...votes, [voter.id]: selectedSuspectId };
    setVotes(updatedVotes);
    setSelectedSuspectId(null);

    if (voterIdx + 1 < players.length) {
      soundManager.play('vote');
      setVoterIdx((prev) => prev + 1);
    } else {
      soundManager.play('reveal');
      setPhase('FORGER_IDENTITY_REVEAL');
    }
  });

  const handleConfirmForgerGuess = guard(() => {
    if (!selectedGuess) {
      soundManager.play('error');
      return;
    }

    const guessedRight = selectedGuess === secretWord;
    const forgerVotesCount = Object.entries(votes).filter(
      ([voterId, suspectId]) => voterId !== forgerId && suspectId === forgerId
    ).length;
    const nobodyCaught = forgerVotesCount === 0;

    setForgerGuessedRight(guessedRight);
    setForgerEscapedVotes(nobodyCaught);

    const deltas: RoundDelta[] = players.map((p) => {
      if (p.id === forgerId) {
        let pts = 0;
        if (guessedRight) pts += 100;
        if (nobodyCaught) pts += 100;
        return { playerId: p.id, delta: pts };
      }
      const votedForForger = votes[p.id] === forgerId;
      if (votedForForger) {
        recordSpyCatch(p.id);
      }
      return { playerId: p.id, delta: votedForForger ? 100 : 0 };
    });

    setRoundDeltas(deltas);
    onApplyDeltas(deltas);
    soundManager.play(guessedRight || nobodyCaught ? 'victory' : 'next');
    setPhase('ROUND_REVEAL');
  });

  const voteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    players.forEach((p) => {
      counts[p.id] = 0;
    });
    Object.values(votes).forEach((suspectId) => {
      counts[suspectId] = (counts[suspectId] ?? 0) + 1;
    });
    return counts;
  }, [players, votes]);

  const handleHeaderExit = () => {
    if (isRoundInProgress) {
      setShowExitConfirm(true);
    } else {
      onExitToHub();
    }
  };

  const revealPlayer = players[revealIdx];
  const isRevealForger = revealPlayer?.id === forgerId;
  const revealBrush = revealPlayer ? playerBrushes[revealPlayer.id] : undefined;

  const activeDrawer = drawOrder[drawStepIdx % Math.max(1, drawOrder.length)];
  const nextDrawer =
    drawStepIdx + 1 < totalDrawTurns
      ? drawOrder[(drawStepIdx + 1) % Math.max(1, drawOrder.length)]
      : null;
  const activeDrawerBrush = activeDrawer ? playerBrushes[activeDrawer.id] : undefined;

  const currentVoter = players[voterIdx];
  const forgerPlayer = players.find((p) => p.id === forgerId);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title={
          phase === 'VOTING'
            ? 'مرحلة التصويت'
            : phase === 'FORGER_FINAL_GUESS'
              ? 'فرصة المزور الأخيرة'
              : phase === 'LEADERBOARD'
                ? 'النتيجة'
                : 'المزور'
        }
        exitVariant={isRoundInProgress ? 'exit' : 'back'}
        exitLabel={isRoundInProgress ? 'خروج' : 'رجوع'}
        onExit={handleHeaderExit}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-8 pt-2 flex flex-col">
        {/* PHASE 1: READY */}
        {phase === 'READY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            <div className="w-32 h-32 mb-5 rounded-3xl bg-gradient-to-br from-[#10B981] to-[#14B8A6] border-4 border-white dark:border-[#334155] flex items-center justify-center shadow-lg">
              <UserCheck className="w-16 h-16 text-white animate-float-slow" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-[#1E293B] dark:text-white mb-3">المزور</h2>
            <p className="text-sm sm:text-base font-bold text-[#64748B] dark:text-[#94A3B8] max-w-sm leading-relaxed mb-6">
              كل لاعب ليه لون فرشاة مختلف! الكل عارف الكلمة ما عدا{' '}
              <span className="text-[#E11D48] dark:text-rose-400 font-black">&quot;المزور&quot;</span>. كل واحد هيرسم{' '}
              <span className="text-[#059669] dark:text-emerald-400 font-black">خط واحد متصل</span> في دوره (جولة واحدة سريعة!) وبعدين تصوتوا مين المزور!
            </p>

            {players.length < 3 && (
              <div className="w-full max-w-sm rounded-2xl bg-[#FFFBEB] dark:bg-amber-950/50 border-2 border-[#FDE68A] dark:border-amber-800 px-4 py-2.5 text-xs font-extrabold text-[#B45309] dark:text-amber-300 mb-5 tabular-nums">
                ملاحظة: يفضّل 3 لاعبين أو أكتر لمتعة المزور، لكن تقدروا تلعبوا بـ 2 عادي!
              </div>
            )}

            <div className="w-full max-w-md mb-6">
              <CategoryFilterBar
                categories={FORGER_CATEGORIES.map((c) => ({
                  id: c.id,
                  name: c.name,
                  count: c.words.length,
                }))}
                selectedIds={selectedCategoryIds}
                onChange={setSelectedCategoryIds}
                totalAvailable={totalForgerWords}
                unitLabel="كلمة"
                accentColor="emerald"
              />
            </div>

            <button
              type="button"
              onClick={startNewRound}
              className="w-full max-w-[270px] min-h-[58px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
            >
              ابدأ اللعب!
            </button>
          </div>
        )}

        {/* PHASE 2: PASS TO PLAYER FOR ANTI-PEEK ROLE REVEAL */}
        {phase === 'PASS_REVEAL' && revealPlayer && (
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <ActiveTurnBanner
              label="دور استلام الكارت:"
              player={revealPlayer}
              swatchHex={revealBrush?.hex}
              badgeText={`${revealIdx + 1} من ${players.length}`}
              accent="emerald"
            />

            <div className="mb-3 flex items-center gap-2 text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8] tabular-nums">
              <span className="text-[#1E293B] dark:text-white">القسم: {category.name}</span>
            </div>

            <div className="relative w-full max-w-md rounded-3xl qada-card px-6 py-10 text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FFF7EA] dark:bg-[#0F172A] border-2 border-[#FDE68A] dark:border-[#334155] flex items-center justify-center">
                <PlayerAvatar
                  avatarId={revealPlayer.avatarId}
                  name={revealPlayer.name}
                  size="md"
                />
              </div>

              <p className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white leading-relaxed mb-4">
                ادي الموبايل لـ <span className="text-[#FF6B4A]">{revealPlayer.name}</span> عشان
                يشوف دوره
              </p>

              {revealBrush && (
                <div className="inline-flex items-center gap-2 rounded-xl bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] px-3 py-1.5 text-xs font-black text-[#1E293B] dark:text-white">
                  <span
                    className="w-4 h-4 rounded-full border border-black/20"
                    style={{ backgroundColor: revealBrush.hex }}
                  />
                  <span>لون فرشتك: {revealBrush.name}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handlePassRevealNext}
              className="w-full max-w-[240px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
            >
              التالي
            </button>
          </div>
        )}

        {/* PHASE 3: TAP & HOLD ROLE REVEAL */}
        {phase === 'REVEAL_ROLE' && revealPlayer && (
          <div className="flex-1 flex flex-col items-center justify-center py-2 no-select">
            <ActiveTurnBanner
              label="اللي بيشوف دوره دلوقتي:"
              player={revealPlayer}
              swatchHex={revealBrush?.hex}
              badgeText={`${revealIdx + 1} من ${players.length}`}
              accent="teal"
            />

            <div className="flex items-center gap-3 mb-4">
              <PlayerAvatar avatarId={revealPlayer.avatarId} name={revealPlayer.name} size="md" />
              <div className="text-right">
                <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">دور اللاعب</div>
                <div className="text-xl font-black text-[#1E293B] dark:text-white flex items-center gap-2">
                  <span>{revealPlayer.name}</span>
                  {revealBrush && (
                    <span
                      className="w-4 h-4 rounded-full border-2 border-white dark:border-[#1E293B] shadow inline-block"
                      style={{ backgroundColor: revealBrush.hex }}
                      title={revealBrush.name}
                    />
                  )}
                </div>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              aria-label="اضغط مطولاً لكشف الدور"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                soundManager.play('reveal');
                setIsHoldingCard(true);
                setHasPeekedCurrent(true);
              }}
              onPointerUp={() => setIsHoldingCard(false)}
              onPointerCancel={() => setIsHoldingCard(false)}
              onLostPointerCapture={() => setIsHoldingCard(false)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  if (!isHoldingCard) {
                    soundManager.play('reveal');
                    setIsHoldingCard(true);
                    setHasPeekedCurrent(true);
                  }
                }
              }}
              onKeyUp={() => setIsHoldingCard(false)}
              className={`relative w-full max-w-md min-h-[245px] rounded-3xl border-2 border-b-[6px] transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center shadow-lg no-select ${
                isHoldingCard
                  ? isRevealForger
                    ? 'bg-[#FFF1F2] dark:bg-rose-950/85 border-[#F43F5E] border-b-[#BE123C] scale-[1.01]'
                    : 'bg-[#ECFDF5] dark:bg-emerald-950/85 border-[#10B981] border-b-[#047857] scale-[1.01]'
                  : 'bg-gradient-to-br from-[#FFF4D6] to-[#FFE7C7] dark:from-[#1E293B] dark:to-[#0F172A] border-[#F59E0B] border-b-[#D97706] hover:brightness-[1.02]'
              }`}
            >
              {!isHoldingCard ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#0F172A] border-2 border-[#FCD34D] dark:border-[#F59E0B]/60 shadow-sm flex items-center justify-center text-[#FF6B4A]">
                    <Fingerprint className="w-9 h-9 animate-pulse" />
                  </div>
                  <p className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-white">
                    اضغط وخليك دايس عشان تشوف دورك
                  </p>
                  <p className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                    أول ما ترفع صباعك الشاشة هتقفل فوراً
                  </p>
                </div>
              ) : isRevealForger ? (
                <div className="flex flex-col items-center gap-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFE4E6] dark:bg-rose-900/70 border-2 border-[#FDA4AF] dark:border-rose-700 flex items-center justify-center text-[#E11D48] dark:text-rose-200">
                    <EyeOff className="w-6 h-6" />
                  </div>
                  <div className="text-lg sm:text-xl font-black text-[#BE123C] dark:text-rose-200 leading-snug">
                    أنت المزور! متعرفش الكلمة.. ارسم خط ذكي ومتتكشفش
                  </div>
                  <div className="text-sm font-extrabold text-[#B45309] dark:text-amber-300">
                    القسم: {category.name}
                  </div>
                  {revealBrush && (
                    <div className="mt-1 inline-flex items-center gap-2 rounded-xl bg-white dark:bg-[#0F172A] border border-[#FECDD3] dark:border-rose-800 px-3 py-1.5 text-xs font-black text-[#1E293B] dark:text-white">
                      <span
                        className="w-4 h-4 rounded-full border border-black/20"
                        style={{ backgroundColor: revealBrush.hex }}
                      />
                      <span>لونك: {revealBrush.name}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-xs font-extrabold text-[#0D9488] dark:text-[#2DD4BF]">
                    القسم: {category.name}
                  </div>
                  <div className="text-sm font-bold text-[#475569] dark:text-emerald-200">الكلمة السرية هي:</div>
                  <div className="text-3xl sm:text-4xl font-black text-[#1E293B] dark:text-white py-1">
                    {secretWord}
                  </div>
                  {revealBrush && (
                    <div className="mt-1 inline-flex items-center gap-2 rounded-xl bg-white dark:bg-[#0F172A] border border-[#A7F3D0] dark:border-emerald-700 px-3 py-1.5 text-xs font-black text-[#1E293B] dark:text-white">
                      <span
                        className="w-4 h-4 rounded-full border border-black/20"
                        style={{ backgroundColor: revealBrush.hex }}
                      />
                      <span>لون فرشتك: {revealBrush.name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 w-full max-w-[260px] flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={!hasPeekedCurrent}
                onClick={handleRoleNext}
                className="w-full min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                التالي
              </button>
              {!hasPeekedCurrent && (
                <span className="text-xs font-bold text-[#B45309] dark:text-amber-300">
                  لازم تشوف دورك الأول قبل ما تكمل
                </span>
              )}
            </div>
          </div>
        )}

        {/* PHASE 4: COLLABORATIVE SHARED CANVAS (1 SINGLE ROUND, 1 CONTINUOUS STROKE PER TURN) */}
        {phase === 'DRAW_STROKE' && activeDrawer && activeDrawerBrush && (
          <div className="flex-1 flex flex-col gap-2.5">
            <ActiveTurnBanner
              label="اللي بيرسم دلوقتي:"
              player={activeDrawer}
              swatchHex={activeDrawerBrush.hex}
              badgeText={`دور ${drawStepIdx + 1} من ${totalDrawTurns}`}
              accent="emerald"
            />

            {/* Active turn details */}
            <div className="w-full rounded-2xl qada-card px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="text-xs sm:text-sm font-extrabold text-[#64748B] dark:text-[#94A3B8] truncate">
                القسم: <span className="text-[#1E293B] dark:text-white">{category.name}</span> · لونك: {activeDrawerBrush.name}
              </div>

              <div className="shrink-0 rounded-xl bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] px-3 py-1.5 text-xs font-black text-[#0D9488] dark:text-[#2DD4BF] flex items-center gap-1.5">
                {turnStrokeDone ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-[#D97706]" />
                    <span className="text-[#B45309] dark:text-amber-300">اتقفل</span>
                  </>
                ) : (
                  <>
                    <Pencil className="w-3.5 h-3.5" />
                    <span>خط واحد فقط</span>
                  </>
                )}
              </div>
            </div>

            {/* Color Legend Bar */}
            <div className="w-full flex items-center gap-2 overflow-x-auto pb-1">
              {drawOrder.map((p) => {
                const brush = playerBrushes[p.id];
                const isActive = p.id === activeDrawer.id;
                return (
                  <div
                    key={p.id}
                    className={`shrink-0 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-extrabold border transition-all ${
                      isActive
                        ? 'bg-[#1E293B] dark:bg-[#FF6B4A] text-white border-[#1E293B] dark:border-[#FF6B4A] shadow-md scale-[1.03]'
                        : 'bg-white dark:bg-[#1E293B] text-[#1E293B] dark:text-slate-200 border-[#E7DEC8] dark:border-[#334155]'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/25 shrink-0"
                      style={{ backgroundColor: brush?.hex }}
                    />
                    <span className="max-w-[90px] truncate">{p.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Shared White Canvas */}
            <ForgerCanvas
              strokes={strokes}
              activeColor={activeDrawerBrush.hex}
              canDraw={!turnStrokeDone}
              onCompleteStroke={handleStrokeComplete}
            />

            {/* Lock & Pass Action */}
            {turnStrokeDone ? (
              <button
                type="button"
                onClick={handleAdvanceDrawTurn}
                className="w-full min-h-[58px] rounded-2xl bakasa-btn-green text-white text-lg sm:text-xl font-black tracking-wide transition-transform mt-1"
              >
                {nextDrawer
                  ? `تم! مرر الموبايل لـ ${nextDrawer.name}`
                  : 'انتهى الرسم! بدء التصويت'}
              </button>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-[#1E293B] border-2 border-[#E7DEC8] dark:border-[#334155] px-4 py-3 text-center text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">
                ارسم خط واحد متصل بلونك — أول ما ترفع صباعك اللوحة هتقفل تلقائياً!
              </div>
            )}
          </div>
        )}

        {/* PHASE 5: VOTING WITH COMPLETED GROUP DRAWING VISIBLE */}
        {phase === 'VOTING' && currentVoter && (
          <div className="flex-1 flex flex-col items-center gap-4 pb-4">
            <ActiveTurnBanner
              label="اللي بيصوّت دلوقتي:"
              player={currentVoter}
              swatchHex={playerBrushes[currentVoter.id]?.hex}
              badgeText={`${voterIdx + 1} من ${players.length}`}
              accent="coral"
            />

            {/* Completed Drawing visible at top */}
            <div className="w-full max-w-sm flex flex-col items-center gap-2">
              <ForgerCanvas
                strokes={strokes}
                activeColor="#111827"
                canDraw={false}
                maxWidthClass="w-full"
              />
              <div className="w-full flex items-center justify-center gap-2 flex-wrap">
                {drawOrder.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-[#1E293B] border border-[#E7DEC8] dark:border-[#334155] px-2 py-1 text-[11px] font-bold text-[#1E293B] dark:text-white"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: playerBrushes[p.id]?.hex }}
                    />
                    <span>{p.name}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Voting Panel */}
            <div className="relative w-full max-w-md rounded-3xl qada-card px-5 pt-12 pb-6 mt-6 flex flex-col items-center">
              <div className="absolute -top-9 left-1/2 -translate-x-1/2">
                <PlayerAvatar
                  avatarId={currentVoter.avatarId}
                  name={currentVoter.name}
                  size="lg"
                />
              </div>

              <h2 className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-white text-center mb-4 leading-snug">
                مين المزور؟ — {currentVoter.name} اختار اللي شاكك فيه
              </h2>

              <div className="w-full flex flex-col gap-2.5 mb-5">
                {players
                  .filter((p) => p.id !== currentVoter.id)
                  .map((candidate) => {
                    const isSelected = selectedSuspectId === candidate.id;
                    const brush = playerBrushes[candidate.id];
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => {
                          soundManager.play('click');
                          setSelectedSuspectId(candidate.id);
                        }}
                        className={`w-full min-h-[52px] rounded-2xl px-4 flex items-center justify-between gap-3 font-extrabold text-base sm:text-lg transition-all ${
                          isSelected
                            ? 'bg-[#ECFDF5] dark:bg-emerald-950/75 border-2 border-[#10B981] text-[#065F46] dark:text-emerald-200 shadow-sm scale-[1.01]'
                            : 'bg-[#FFF9F0] dark:bg-[#0F172A] border-2 border-[#E7DEC8] dark:border-[#334155] text-[#1E293B] dark:text-white hover:bg-[#FFF1DC] dark:hover:bg-[#334155]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: brush?.hex }}
                        />
                        <span className="truncate">{candidate.name}</span>
                        <span className="w-6 flex justify-end shrink-0">
                          {isSelected && <Check className="w-5 h-5 text-[#059669] dark:text-emerald-400" />}
                        </span>
                      </button>
                    );
                  })}
              </div>

              <button
                type="button"
                disabled={!selectedSuspectId}
                onClick={handleVoteNext}
                className="w-full max-w-[220px] min-h-[52px] rounded-2xl bakasa-btn-green text-white text-xl font-black transition-all disabled:opacity-45 disabled:cursor-not-allowed"
              >
                التالي
              </button>
            </div>
          </div>
        )}

        {/* PHASE 6A: REVEAL FAKE ARTIST IDENTITY */}
        {phase === 'FORGER_IDENTITY_REVEAL' && forgerPlayer && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6 animate-reveal-3s">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#FFF1F2] dark:bg-rose-950/60 border-2 border-[#FECDD3] dark:border-rose-800 flex items-center justify-center text-[#E11D48] dark:text-rose-300">
                <EyeOff className="w-9 h-9" />
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-3">المزور في الدور ده هو:</h2>

              <div className="inline-flex items-center gap-3 rounded-2xl bg-[#FFF1F2] dark:bg-rose-950/65 border-2 border-[#FDA4AF] dark:border-rose-700 px-5 py-3 mb-4">
                <PlayerAvatar avatarId={forgerPlayer.avatarId} name={forgerPlayer.name} size="md" />
                <span className="text-2xl font-black text-[#BE123C] dark:text-rose-200">{forgerPlayer.name}</span>
                <span
                  className="w-4 h-4 rounded-full border border-black/20"
                  style={{ backgroundColor: playerBrushes[forgerPlayer.id]?.hex }}
                />
              </div>

              <p className="text-sm font-bold text-[#B45309] dark:text-amber-300 mb-4">
                الكلمة السرية لسه مخفية — قدام المزور فرصة أخيرة يخمنها!
              </p>

              <div className="text-right flex flex-col gap-1.5 bg-[#FFF9F0] dark:bg-[#0F172A] rounded-2xl p-3.5 border border-[#E7DEC8] dark:border-[#334155]">
                <div className="text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8] mb-1">الأصوات:</div>
                {players.map((p) => {
                  const votedFor = players.find((x) => x.id === votes[p.id]);
                  const isForger = p.id === forgerId;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 text-xs font-bold text-[#1E293B] dark:text-white"
                    >
                      <span className="truncate">
                        {p.name}{' '}
                        {isForger && <span className="text-[#E11D48] dark:text-rose-400 font-black">(المزور)</span>}
                      </span>
                      <span className="text-[#64748B] dark:text-[#94A3B8] truncate">
                        اختار: {votedFor?.name ?? '—'} ({voteCounts[p.id] ?? 0} صوت)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={guard(() => {
                soundManager.play('next');
                setPhase('FORGER_FINAL_GUESS');
              })}
              className="w-full max-w-[280px] min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
            >
              فرصة المزور الأخيرة
            </button>
          </div>
        )}

        {/* PHASE 6B: FAKE ARTIST'S LAST CHANCE */}
        {phase === 'FORGER_FINAL_GUESS' && forgerPlayer && (
          <div className="flex-1 flex flex-col items-center py-2">
            <ActiveTurnBanner
              label="اللي بيخمن دلوقتي (المزور):"
              player={forgerPlayer}
              swatchHex={playerBrushes[forgerPlayer.id]?.hex}
              accent="rose"
            />
            <div className="w-full rounded-3xl qada-card p-4 text-center mb-4">
              <div className="text-xs font-extrabold text-[#FF6B4A] mb-1">
                القسم: {category.name}
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-white tabular-nums">
                {forgerPlayer.name} — اختار الكلمة السرية من الـ 16 اختيار!
              </h2>
              <p className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] mt-1 tabular-nums">
                لو اخترت الكلمة الصح هتكسب +100 نقطة!
              </p>
            </div>

            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
              {guessOptions.map((word) => {
                const isSelected = selectedGuess === word;
                return (
                  <button
                    key={word}
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setSelectedGuess(word);
                    }}
                    className={`min-h-[56px] rounded-2xl px-3 py-2 text-sm sm:text-base font-black text-center transition-all flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#10B981] border-2 border-[#047857] text-white shadow-[0_4px_0_#047857] scale-[1.02]'
                        : 'bg-white dark:bg-[#1E293B] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 text-[#1E293B] dark:text-white hover:bg-[#FFF5E8] dark:hover:bg-[#334155]'
                    }`}
                  >
                    {word}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!selectedGuess}
              onClick={handleConfirmForgerGuess}
              className="w-full max-w-[260px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-all disabled:opacity-45 disabled:cursor-not-allowed"
            >
              تأكيد الاختيار
            </button>
          </div>
        )}

        {/* PHASE 7: FINAL WORD REVEAL & SCORE BREAKDOWN */}
        {phase === 'ROUND_REVEAL' && forgerPlayer && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6 animate-reveal-3s">
              <div
                className={`w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
                  forgerGuessedRight || forgerEscapedVotes
                    ? 'bg-[#FFFBEB] dark:bg-amber-950/50 border-2 border-[#FDE68A] dark:border-amber-700 text-[#D97706] dark:text-amber-400'
                    : 'bg-[#ECFDF5] dark:bg-emerald-950/50 border-2 border-[#A7F3D0] dark:border-emerald-700 text-[#059669] dark:text-emerald-400'
                }`}
              >
                {forgerGuessedRight || forgerEscapedVotes ? (
                  <Sparkles className="w-9 h-9" />
                ) : (
                  <ShieldAlert className="w-9 h-9" />
                )}
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-1">
                {forgerGuessedRight
                  ? 'المزور خمن الكلمة صح!'
                  : forgerEscapedVotes
                    ? 'محدش قفش المزور!'
                    : 'قفشتوا المزور!'}
              </h2>
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] mb-5 tabular-nums">
                {forgerEscapedVotes && forgerGuessedRight
                  ? `${forgerPlayer.name} هرب من التصويت وخمن الكلمة (+200 نقطة!)`
                  : forgerGuessedRight
                    ? `${forgerPlayer.name} كسب +100 نقطة في الفرصة الأخيرة`
                    : forgerEscapedVotes
                      ? `محدش صوّت ضد ${forgerPlayer.name} فكسب +100 نقطة إضافية`
                      : `كل اللي صوّتوا ضد ${forgerPlayer.name} كسبوا +100 نقطة`}
              </p>

              <div className="rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] border-2 border-[#E7DEC8] dark:border-[#334155] p-4 mb-5 flex flex-col gap-1.5">
                <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">الكلمة السرية كانت:</div>
                <div className="text-3xl font-black text-[#0D9488] dark:text-[#2DD4BF]">{secretWord}</div>
                <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] mt-1">
                  المزور: <span className="text-[#E11D48] dark:text-rose-400 font-black">{forgerPlayer.name}</span>
                </div>
              </div>

              <div className="text-right flex flex-col gap-2">
                <div className="text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8] mb-1">نقاط الدور ده:</div>
                {players.map((p) => {
                  const delta = roundDeltas.find((d) => d.playerId === p.id)?.delta ?? 0;
                  const isForger = p.id === forgerId;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#EAE0D0] dark:border-[#334155] px-3 py-2 text-xs sm:text-sm font-bold"
                    >
                      <span className="text-[#1E293B] dark:text-white truncate">
                        {p.name}{' '}
                        {isForger && <span className="text-[#E11D48] dark:text-rose-400 font-black">(المزور)</span>}
                      </span>
                      <span
                        className={`tabular-nums font-black ${
                          delta > 0 ? 'text-[#059669] dark:text-emerald-400' : 'text-[#94A3B8]'
                        }`}
                      >
                        {delta > 0 ? `+${delta} نقطة` : '0 نقطة'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={guard(() => {
                soundManager.play('next');
                setPhase('LEADERBOARD');
              })}
              className="w-full max-w-[260px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
            >
              عرض النتيجة
            </button>
          </div>
        )}

        {/* PHASE 8: LEADERBOARD */}
        {phase === 'LEADERBOARD' && forgerPlayer && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline={`المزور: ${forgerPlayer.name} · الكلمة: ${secretWord}`}
            isTournamentMode={Boolean(onTournamentFinish)}
            onNewRound={startNewRound}
            onFinishGame={() => {
              if (onTournamentFinish) {
                onTournamentFinish(roundDeltas);
              } else {
                onExitToHub();
              }
            }}
          />
        )}
      </main>

      <ConfirmModal
        open={showExitConfirm}
        title="متأكد إنك عايز تخرج من اللعبة؟"
        message="جولة المزور لسه مخلصتش، لو خرجت دلوقتي تقدم الجولة الحالية هيتلغي."
        confirmLabel="نعم، اخرج"
        cancelLabel="كمل لعب"
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitToHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
