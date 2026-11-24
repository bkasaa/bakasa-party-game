import React, { useEffect, useState } from 'react';
import { Check, Clock, Fingerprint, Palette, Pencil, X } from 'lucide-react';
import { DRAW_WORDS } from '../../data/gameData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { DrawPhase, Player, RoundDelta } from '../../types/game';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { recordDrawWin } from '../../utils/sessionStats';
import { pickUnseenBatch } from '../../utils/usedItemsMemory';
import { ConfirmModal } from '../ConfirmModal';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { PlayerAvatar } from '../PlayerAvatar';
import { TopBar } from '../TopBar';
import { DrawingCanvas, DrawStroke } from './DrawingCanvas';

interface DrawGameFlowProps {
  players: Player[];
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
}

interface DrawTurn {
  drawer: Player;
  guesser: Player;
  word: string;
}

function buildCircularTurns(players: Player[]): DrawTurn[] {
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  const pickedWords = pickUnseenBatch('draw', DRAW_WORDS, shuffledPlayers.length);

  return shuffledPlayers.map((drawer, idx) => ({
    drawer,
    guesser: shuffledPlayers[(idx + 1) % shuffledPlayers.length],
    word: pickedWords[idx % pickedWords.length] ?? DRAW_WORDS[idx % DRAW_WORDS.length],
  }));
}

const DEFAULT_DRAW_SECONDS = 10;
const DRAW_TIME_OPTIONS = [10, 15, 20, 25, 30] as const;
const GUESS_SECONDS = 15;

export const DrawGameFlow: React.FC<DrawGameFlowProps> = ({
  players,
  onApplyDeltas,
  onExitToHub,
}) => {
  const guard = useTapGuard(400);

  const [phase, setPhase] = useState<DrawPhase>('READY');
  const [drawDuration, setDrawDuration] = useState<number>(DEFAULT_DRAW_SECONDS);
  const [turns, setTurns] = useState<DrawTurn[]>([]);
  const [turnIdx, setTurnIdx] = useState<number>(0);

  // Word reveal anti-peek state
  const [isHoldingWord, setIsHoldingWord] = useState<boolean>(false);
  const [hasPeekedWord, setHasPeekedWord] = useState<boolean>(false);

  // Canvas & timers
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [drawSecondsLeft, setDrawSecondsLeft] = useState<number>(DEFAULT_DRAW_SECONDS);
  const [canvasLocked, setCanvasLocked] = useState<boolean>(false);
  const [guessSecondsLeft, setGuessSecondsLeft] = useState<number>(GUESS_SECONDS);

  // Turn & round scoring
  const [turnSucceeded, setTurnSucceeded] = useState<boolean>(false);
  const [roundScoreMap, setRoundScoreMap] = useState<Record<string, number>>({});
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);

  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const currentTurn = turns[turnIdx];

  const isRoundInProgress =
    phase === 'PASS_DRAWER' ||
    phase === 'REVEAL_WORD' ||
    phase === 'DRAWING' ||
    phase === 'GUESSING' ||
    phase === 'TURN_RESULT';

  useNavigationGuard(isRoundInProgress, () => {
    setShowExitConfirm(true);
  });

  // Drawing countdown timer using selected drawDuration (10-30s)
  useEffect(() => {
    if (phase !== 'DRAWING' || canvasLocked) return;

    const timer = window.setInterval(() => {
      setDrawSecondsLeft((prev) => {
        if (prev <= 1) {
          soundManager.play('tickUrgent');
          setCanvasLocked(true);
          return 0;
        }
        soundManager.play(prev <= 4 ? 'tickUrgent' : 'tick', (drawDuration - prev) / drawDuration);
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, canvasLocked, drawDuration]);

  // 15-second guessing countdown timer
  useEffect(() => {
    if (phase !== 'GUESSING') return;

    const timer = window.setInterval(() => {
      setGuessSecondsLeft((prev) => {
        if (prev <= 1) {
          soundManager.play('error');
          return 0;
        }
        if (prev <= 5) {
          soundManager.play('tickUrgent');
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  const startNewRound = guard(() => {
    soundManager.unlock();
    soundManager.play('next');

    const newTurns = buildCircularTurns(players);
    const initialScores: Record<string, number> = {};
    players.forEach((p) => {
      initialScores[p.id] = 0;
    });

    setTurns(newTurns);
    setTurnIdx(0);
    setRoundScoreMap(initialScores);
    setRoundDeltas([]);
    setStrokes([]);
    setIsHoldingWord(false);
    setHasPeekedWord(false);
    setCanvasLocked(false);
    setPhase('PASS_DRAWER');
  });

  const handlePassDrawerNext = guard(() => {
    soundManager.play('click');
    setIsHoldingWord(false);
    setHasPeekedWord(false);
    setPhase('REVEAL_WORD');
  });

  const handleStartDrawing = guard(() => {
    if (!hasPeekedWord) return;
    const clampedDuration = Math.min(30, Math.max(10, drawDuration));
    setIsHoldingWord(false);
    setHasPeekedWord(false);
    setStrokes([]);
    setDrawSecondsLeft(clampedDuration);
    setCanvasLocked(false);
    soundManager.play('next');
    setPhase('DRAWING');
  });

  const handleMoveToGuessing = guard(() => {
    setCanvasLocked(true);
    setGuessSecondsLeft(GUESS_SECONDS);
    soundManager.play('next');
    setPhase('GUESSING');
  });

  const handleGuessOutcome = guard((isCorrect: boolean) => {
    if (!currentTurn) return;

    const updatedMap = { ...roundScoreMap };
    if (isCorrect) {
      updatedMap[currentTurn.drawer.id] = (updatedMap[currentTurn.drawer.id] ?? 0) + 100;
      updatedMap[currentTurn.guesser.id] = (updatedMap[currentTurn.guesser.id] ?? 0) + 100;
      recordDrawWin(currentTurn.drawer.id);
      recordDrawWin(currentTurn.guesser.id);
      triggerHaptic(25);
      soundManager.play('victory');
    } else {
      soundManager.play('error');
    }

    setRoundScoreMap(updatedMap);
    setTurnSucceeded(isCorrect);
    setPhase('TURN_RESULT');
  });

  const handleNextTurnOrLeaderboard = guard(() => {
    if (turnIdx + 1 < turns.length) {
      soundManager.play('next');
      setTurnIdx((prev) => prev + 1);
      setStrokes([]);
      setIsHoldingWord(false);
      setHasPeekedWord(false);
      setCanvasLocked(false);
      setPhase('PASS_DRAWER');
    } else {
      const deltas: RoundDelta[] = players.map((p) => ({
        playerId: p.id,
        delta: roundScoreMap[p.id] ?? 0,
      }));
      setRoundDeltas(deltas);
      onApplyDeltas(deltas);
      soundManager.play('victory');
      setPhase('LEADERBOARD');
    }
  });

  const handleHeaderExit = () => {
    if (isRoundInProgress) {
      setShowExitConfirm(true);
    } else {
      onExitToHub();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title={phase === 'LEADERBOARD' ? 'النتيجة' : 'رسمة في ١٠ ثواني'}
        exitVariant={isRoundInProgress ? 'home' : 'back'}
        onExit={handleHeaderExit}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-8 pt-2 flex flex-col">
        {/* PHASE 1: READY */}
        {phase === 'READY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            <div className="w-32 h-32 mb-5 rounded-3xl bg-gradient-to-br from-[#14B8A6] to-[#0EA5E9] border-4 border-white dark:border-[#334155] flex items-center justify-center shadow-lg">
              <Palette className="w-16 h-16 text-white animate-float-slow" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-[#1E293B] dark:text-white mb-3">
              رسمة في ١٠ ثواني
            </h2>
            <p className="text-sm sm:text-base font-bold text-[#64748B] dark:text-[#94A3B8] max-w-sm leading-relaxed mb-5">
              كل لاعب هيرسم مرة ويخمن مرة في دايرة متبادلة! قدامك{' '}
              <span className="text-[#0D9488] dark:text-[#2DD4BF] font-black tabular-nums">{drawDuration} ثانية</span>{' '}
              ترسم الكلمة وقدام صاحبك{' '}
              <span className="text-[#059669] dark:text-emerald-400 font-black">١٥ ثانية</span> يخمنها. لو صح الاتنين
              بتاخدوا <span className="text-[#D97706] dark:text-amber-400 font-black">+١٠٠ نقطة</span>!
            </p>

            {/* Pre-Game Drawing Time Selector (10s - 30s) */}
            <div className="w-full max-w-md rounded-3xl qada-card p-4 mb-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#14B8A6]" />
                  <span>مدة الرسم لكل لاعب:</span>
                </span>
                <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                  من ١٠ إلى ٣٠ ثانية
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2 mb-3">
                {DRAW_TIME_OPTIONS.map((secs) => {
                  const isActive = drawDuration === secs;
                  return (
                    <button
                      key={secs}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setDrawDuration(Math.min(30, Math.max(10, secs)));
                      }}
                      className={`min-h-[44px] rounded-xl text-sm font-black tabular-nums transition-colors ${
                        isActive
                          ? 'bg-[#10B981] text-white shadow-[0_3px_0_#059669]'
                          : 'bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white'
                      }`}
                    >
                      {secs}ث
                    </button>
                  );
                })}
              </div>

              <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] tabular-nums pt-2 border-t border-[#F1E8DA] dark:border-[#334155]">
                عدد الأدوار في الجولة دي: {players.length} رسمات
              </div>
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

        {/* PHASE 2: PASS TO DRAWER (ANTI-PEEK COVER) */}
        {phase === 'PASS_DRAWER' && currentTurn && (
          <div className="flex-1 flex flex-col items-center justify-center py-6">
            <div className="mb-4 flex items-center gap-2 text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8] tabular-nums">
              <span>
                الدور {turnIdx + 1} من {turns.length}
              </span>
              <span>·</span>
              <span className="text-[#1E293B] dark:text-white">المخمن: {currentTurn.guesser.name}</span>
            </div>

            <div className="relative w-full max-w-md rounded-3xl qada-card px-6 py-11 text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FFF7EA] dark:bg-[#0F172A] border-2 border-[#FDE68A] dark:border-[#334155] flex items-center justify-center">
                <PlayerAvatar
                  avatarId={currentTurn.drawer.avatarId}
                  name={currentTurn.drawer.name}
                  size="md"
                />
              </div>
              <p className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white leading-relaxed">
                ادي الموبايل لـ <span className="text-[#FF6B4A]">{currentTurn.drawer.name}</span>{' '}
                عشان يشوف الكلمة السرية
              </p>
              <p className="mt-2 text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">
                تأكد إن {currentTurn.guesser.name} مش باصص على الشاشة
              </p>
            </div>

            <button
              type="button"
              onClick={handlePassDrawerNext}
              className="w-full max-w-[240px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
            >
              التالي
            </button>
          </div>
        )}

        {/* PHASE 3: ANTI-PEEK WORD REVEAL */}
        {phase === 'REVEAL_WORD' && currentTurn && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 no-select">
            <div className="flex items-center gap-3 mb-5">
              <PlayerAvatar
                avatarId={currentTurn.drawer.avatarId}
                name={currentTurn.drawer.name}
                size="md"
              />
              <div className="text-right">
                <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                  الرسام (هترسم لـ {currentTurn.guesser.name})
                </div>
                <div className="text-xl font-black text-[#1E293B] dark:text-white">{currentTurn.drawer.name}</div>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              aria-label="اضغط مطولاً لكشف الكلمة"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                soundManager.play('reveal');
                setIsHoldingWord(true);
                setHasPeekedWord(true);
              }}
              onPointerUp={() => setIsHoldingWord(false)}
              onPointerCancel={() => setIsHoldingWord(false)}
              onLostPointerCapture={() => setIsHoldingWord(false)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  if (!isHoldingWord) {
                    soundManager.play('reveal');
                    setIsHoldingWord(true);
                    setHasPeekedWord(true);
                  }
                }
              }}
              onKeyUp={() => setIsHoldingWord(false)}
              className={`relative w-full max-w-md min-h-[220px] rounded-3xl border-2 border-b-[6px] transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center shadow-lg no-select ${
                isHoldingWord
                  ? 'bg-[#ECFDF5] dark:bg-emerald-950/85 border-[#10B981] border-b-[#047857] scale-[1.01]'
                  : 'bg-gradient-to-br from-[#FFF4D6] to-[#FFE7C7] dark:from-[#1E293B] dark:to-[#0F172A] border-[#F59E0B] border-b-[#D97706] hover:brightness-[1.02]'
              }`}
            >
              {!isHoldingWord ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#0F172A] border-2 border-[#FCD34D] dark:border-[#F59E0B]/60 shadow-sm flex items-center justify-center text-[#FF6B4A]">
                    <Fingerprint className="w-8 h-8 animate-pulse" />
                  </div>
                  <p className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-white">
                    اضغط وخليك دايس عشان تشوف الكلمة
                  </p>
                  <p className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                    تأكد إن {currentTurn.guesser.name} مش باصص على الشاشة!
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-xs font-extrabold text-[#0D9488] dark:text-[#2DD4BF]">الكلمة اللي هترسمها:</div>
                  <div className="text-3xl sm:text-4xl font-black text-[#1E293B] dark:text-white py-2">
                    {currentTurn.word}
                  </div>
                  <p className="text-xs font-bold text-[#B45309] dark:text-amber-300 tabular-nums">
                    ركز! قدامك {drawDuration} ثانية بس أول ما تضغط &quot;ابدأ الرسم&quot;
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 w-full max-w-[260px] flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={!hasPeekedWord}
                onClick={handleStartDrawing}
                className="w-full min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Pencil className="w-5 h-5" />
                <span>ابدأ الرسم</span>
              </button>
              {!hasPeekedWord && (
                <span className="text-xs font-bold text-[#B45309] dark:text-amber-300">
                  شوف الكلمة الأول عشان يفتح زر الرسم
                </span>
              )}
            </div>
          </div>
        )}

        {/* PHASE 4: 10-SECOND DRAWING CANVAS */}
        {phase === 'DRAWING' && currentTurn && (
          <div className="flex-1 flex flex-col gap-3">
            {/* Prominent countdown bar */}
            <div className="w-full rounded-2xl qada-card px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] shrink-0">ارسم:</span>
                  <span className="text-base sm:text-lg font-black text-[#0D9488] dark:text-[#2DD4BF] truncate">
                    {currentTurn.word}
                  </span>
                </div>

                <div
                  className={`flex items-center gap-1.5 text-xl font-black tabular-nums shrink-0 ${
                    drawSecondsLeft <= 3 ? 'text-[#E11D48] dark:text-rose-400' : 'text-[#1E293B] dark:text-white'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  <span>{drawSecondsLeft} ث</span>
                </div>
              </div>

              <div className="w-full h-3 rounded-full bg-[#F1E8DA] dark:bg-[#0F172A] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    drawSecondsLeft <= 3
                      ? 'bg-[#F43F5E]'
                      : drawSecondsLeft <= 6
                        ? 'bg-[#F59E0B]'
                        : 'bg-[#10B981]'
                  }`}
                  style={{ width: `${(drawSecondsLeft / drawDuration) * 100}%` }}
                />
              </div>
            </div>

            <DrawingCanvas
              locked={canvasLocked}
              strokes={strokes}
              onStrokesChange={setStrokes}
            />

            {canvasLocked ? (
              <div className="mt-1 flex flex-col items-center gap-2">
                <div className="text-sm font-black text-[#B45309] dark:text-amber-300 tabular-nums">
                  خلصت الـ {drawDuration} ثانية! اتقفلت اللوحة.
                </div>
                <button
                  type="button"
                  onClick={handleMoveToGuessing}
                  className="w-full max-w-[290px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-lg font-black tracking-wide transition-transform"
                >
                  مرر لـ {currentTurn.guesser.name} للتخمين
                </button>
              </div>
            ) : (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={handleMoveToGuessing}
                  className="min-h-[42px] px-5 rounded-xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] text-xs sm:text-sm font-extrabold text-[#1E293B] dark:text-white transition-colors"
                >
                  خلصت رسم — مرر للمخمن
                </button>
              </div>
            )}
          </div>
        )}

        {/* PHASE 5: PASS & GUESS (15-SECOND COUNTDOWN) */}
        {phase === 'GUESSING' && currentTurn && (
          <div className="flex-1 flex flex-col gap-3.5">
            <div className="w-full rounded-2xl qada-card px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <PlayerAvatar
                  avatarId={currentTurn.guesser.avatarId}
                  name={currentTurn.guesser.name}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">التخمين</div>
                  <div className="text-sm sm:text-base font-black text-[#1E293B] dark:text-white truncate">
                    مرر الموبايل للمخمن ({currentTurn.guesser.name})
                  </div>
                </div>
              </div>

              <div
                className={`shrink-0 rounded-xl px-3 py-1.5 text-lg font-black tabular-nums flex items-center gap-1.5 border ${
                  guessSecondsLeft === 0
                    ? 'bg-[#FFF1F2] dark:bg-rose-950/60 text-[#E11D48] dark:text-rose-300 border-[#FECDD3] dark:border-rose-800'
                    : guessSecondsLeft <= 5
                      ? 'bg-[#FFFBEB] dark:bg-amber-950/60 text-[#D97706] dark:text-amber-300 border-[#FDE68A] dark:border-amber-800'
                      : 'bg-[#FFF9F0] dark:bg-[#0F172A] text-[#1E293B] dark:text-white border-[#E7DEC8] dark:border-[#334155]'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{guessSecondsLeft}ث</span>
              </div>
            </div>

            <DrawingCanvas locked strokes={strokes} />

            <div className="w-full flex flex-col gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleGuessOutcome(true)}
                className="w-full min-h-[58px] rounded-2xl bakasa-btn-green text-white text-lg sm:text-xl font-black flex items-center justify-center gap-2 transition-transform"
              >
                <Check className="w-6 h-6" />
                <span>صح! (+١٠٠ نقطة للاتنين)</span>
              </button>

              <button
                type="button"
                onClick={() => handleGuessOutcome(false)}
                className="w-full min-h-[54px] rounded-2xl bakasa-btn-red text-white text-lg font-black flex items-center justify-center gap-2 transition-transform"
              >
                <X className="w-5 h-5" />
                <span>غلط / خلص الوقت</span>
              </button>
            </div>
          </div>
        )}

        {/* PHASE 6: TURN RESULT REVEAL */}
        {phase === 'TURN_RESULT' && currentTurn && (
          <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6">
              <div
                className={`w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
                  turnSucceeded
                    ? 'bg-[#ECFDF5] dark:bg-emerald-950/60 border-2 border-[#A7F3D0] dark:border-emerald-700 text-[#059669] dark:text-emerald-400'
                    : 'bg-[#FFF1F2] dark:bg-rose-950/60 border-2 border-[#FECDD3] dark:border-rose-700 text-[#E11D48] dark:text-rose-400'
                }`}
              >
                {turnSucceeded ? <Check className="w-9 h-9" /> : <X className="w-9 h-9" />}
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-2">
                {turnSucceeded ? 'برافو! تخمين صح!' : 'راحت عليكم المرة دي!'}
              </h2>
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] mb-5">
                {turnSucceeded
                  ? `${currentTurn.drawer.name} و ${currentTurn.guesser.name} كسبوا +١٠٠ نقطة لكل واحد`
                  : 'مفيش نقط اتضافت في الدور ده'}
              </p>

              <div className="rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] border-2 border-[#E7DEC8] dark:border-[#334155] p-4">
                <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] mb-1">الكلمة كانت:</div>
                <div className="text-3xl font-black text-[#0D9488] dark:text-[#2DD4BF]">{currentTurn.word}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNextTurnOrLeaderboard}
              className="w-full max-w-[260px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
            >
              {turnIdx + 1 < turns.length ? 'الدور اللي بعده' : 'عرض النتيجة'}
            </button>
          </div>
        )}

        {/* PHASE 7: LEADERBOARD */}
        {phase === 'LEADERBOARD' && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline="انتهت جولة الرسم السريع!"
            onNewRound={startNewRound}
            onFinishGame={onExitToHub}
          />
        )}
      </main>

      <ConfirmModal
        open={showExitConfirm}
        title="هل أنت متأكد من الخروج؟"
        message="جولة الرسم لسه مخلصتش، لو خرجت دلوقتي تقدم الجولة الحالية هيتلغي."
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitToHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
