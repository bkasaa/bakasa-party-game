import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Compass, LogOut, Play, RotateCw, SkipForward, Sparkles, Timer } from 'lucide-react';
import { HEADSUP_CATEGORIES } from '../../data/headsUpData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { CategoryBank, Player, RoundDelta } from '../../types/game';
import { getCustomContent } from '../../utils/customContentStorage';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { ActiveTurnBanner } from '../ActiveTurnBanner';
import { CategoryFilterBar } from '../CategoryFilterBar';
import { ConfirmModal } from '../ConfirmModal';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { TopBar } from '../TopBar';

interface HeadsUpGameFlowProps {
  players: Player[];
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
}

type HeadsUpPhase = 'READY' | 'PASS_PLAYER' | 'ACTIVE_FOREHEAD' | 'TURN_SUMMARY' | 'LEADERBOARD';

interface TurnCardLog {
  word: string;
  outcome: 'correct' | 'skip';
}

const CUSTOM_CAT_ID = '__custom_headsup_words__';
const POINTS_PER_CORRECT = 25;

export const HeadsUpGameFlow: React.FC<HeadsUpGameFlowProps> = ({
  players,
  onApplyDeltas,
  onExitToHub,
  onTournamentFinish,
}) => {
  const guard = useTapGuard(350);

  const [phase, setPhase] = useState<HeadsUpPhase>('READY');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [durationSec, setDurationSec] = useState<45 | 60 | 90>(60);
  const [roundsPerPlayer, setRoundsPerPlayer] = useState<1 | 2>(1);

  const [turnOrder, setTurnOrder] = useState<number[]>([]);
  const [turnStep, setTurnStep] = useState<number>(0);
  const [deltasMap, setDeltasMap] = useState<Record<string, number>>({});
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);

  // Active turn state
  const [deck, setDeck] = useState<string[]>([]);
  const [deckIndex, setDeckIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [turnLogs, setTurnLogs] = useState<TurnCardLog[]>([]);
  const [flashState, setFlashState] = useState<'none' | 'correct' | 'skip'>('none');
  const [landscapeCard, setLandscapeCard] = useState<boolean>(false);
  const [cardAreaSize, setCardAreaSize] = useState<{ w: number; h: number }>({ w: 360, h: 560 });

  // Gyroscope tilt state
  const [gyroSupported, setGyroSupported] = useState<boolean>(false);
  const [gyroEnabled, setGyroEnabled] = useState<boolean>(true);
  const [gyroPermissionState, setGyroPermissionState] = useState<
    'unknown' | 'needs_prompt' | 'granted' | 'denied'
  >('unknown');
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const cardAreaRef = useRef<HTMLDivElement | null>(null);
  const baselineSamplesRef = useRef<number[]>([]);
  const baselineAngleRef = useRef<number | null>(null);
  const lastTiltActionAtRef = useRef<number>(0);
  const tiltNeutralReadyRef = useRef<boolean>(true);
  const usedWordsRef = useRef<Set<string>>(new Set());
  const flashTimerRef = useRef<number | null>(null);

  const isRoundInProgress = phase === 'PASS_PLAYER' || phase === 'ACTIVE_FOREHEAD';

  useNavigationGuard(isRoundInProgress, () => {
    setShowExitConfirm(true);
  });

  const availableCategories = useMemo<CategoryBank[]>(() => {
    const custom = getCustomContent();
    if (custom.mode === 'custom_only' && custom.words.length > 0) {
      return [
        {
          id: CUSTOM_CAT_ID,
          name: 'كلماتك الخاصة ✍️',
          items: custom.words,
        },
      ];
    }
    if (custom.words.length > 0) {
      return [
        {
          id: CUSTOM_CAT_ID,
          name: 'كلماتك الخاصة ✍️',
          items: custom.words,
        },
        ...HEADSUP_CATEGORIES,
      ];
    }
    return HEADSUP_CATEGORIES;
  }, []);

  const filteredPool = useMemo(() => {
    const activeCats =
      selectedCategoryIds.length === 0
        ? availableCategories
        : availableCategories.filter((c) => selectedCategoryIds.includes(c.id));
    const seen = new Set<string>();
    const out: string[] = [];
    for (const cat of activeCats) {
      for (const word of cat.items) {
        if (!seen.has(word)) {
          seen.add(word);
          out.push(word);
        }
      }
    }
    return out;
  }, [availableCategories, selectedCategoryIds]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setGyroSupported(false);
      return;
    }
    setGyroSupported(true);
    const doe = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof doe?.requestPermission === 'function') {
      setGyroPermissionState('needs_prompt');
    } else {
      setGyroPermissionState('granted');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (phase !== 'ACTIVE_FOREHEAD') return;
    const syncCardArea = () => {
      const el = cardAreaRef.current;
      if (!el) return;
      setCardAreaSize({
        w: Math.max(240, Math.round(el.clientWidth)),
        h: Math.max(240, Math.round(el.clientHeight)),
      });
    };
    syncCardArea();
    const ro = new ResizeObserver(syncCardArea);
    if (cardAreaRef.current) ro.observe(cardAreaRef.current);
    window.addEventListener('resize', syncCardArea);
    window.addEventListener('orientationchange', syncCardArea);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncCardArea);
      window.removeEventListener('orientationchange', syncCardArea);
    };
  }, [phase]);

  const requestGyroPermission = async () => {
    soundManager.unlock();
    soundManager.play('click');
    const doe = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof doe?.requestPermission !== 'function') {
      setGyroPermissionState('granted');
      return;
    }
    try {
      const res = await doe.requestPermission();
      setGyroPermissionState(res === 'granted' ? 'granted' : 'denied');
      if (res === 'granted') {
        soundManager.play('catch');
      }
    } catch {
      setGyroPermissionState('denied');
    }
  };

  const buildShuffledDeck = useCallback((): string[] => {
    const source = filteredPool.length > 0 ? filteredPool : HEADSUP_CATEGORIES[0].items;
    let unused = source.filter((w) => !usedWordsRef.current.has(w));
    if (unused.length < 15) {
      usedWordsRef.current.clear();
      unused = [...source];
    }
    return [...unused].sort(() => Math.random() - 0.5);
  }, [filteredPool]);

  const currentPlayerIndex = turnOrder[turnStep] ?? 0;
  const currentPlayer = players[currentPlayerIndex] ?? players[0];

  const handleStartSession = guard(() => {
    soundManager.unlock();
    soundManager.play('next');
    usedWordsRef.current.clear();

    const order: number[] = [];
    for (let r = 0; r < roundsPerPlayer; r++) {
      for (let i = 0; i < players.length; i++) {
        order.push(i);
      }
    }
    setTurnOrder(order);
    setTurnStep(0);
    setDeltasMap({});
    setRoundDeltas([]);
    setPhase('PASS_PLAYER');
  });

  const handleStartTurn = guard(() => {
    soundManager.unlock();
    soundManager.play('next');
    const nextDeck = buildShuffledDeck();
    setDeck(nextDeck);
    setDeckIndex(0);
    setTurnLogs([]);
    setTimeLeft(durationSec);
    setFlashState('none');
    baselineSamplesRef.current = [];
    baselineAngleRef.current = null;
    tiltNeutralReadyRef.current = true;
    lastTiltActionAtRef.current = Date.now() + 650;
    setPhase('ACTIVE_FOREHEAD');
  });

  const advanceCard = useCallback(
    (outcome: 'correct' | 'skip') => {
      setDeck((prevDeck) => {
        const word = prevDeck[deckIndex] ?? 'كلمة';
        usedWordsRef.current.add(word);
        setTurnLogs((logs) => [...logs, { word, outcome }]);
        if (outcome === 'correct') {
          soundManager.play('catch');
          triggerHaptic([25, 35, 30]);
        } else {
          soundManager.play('whoosh');
          triggerHaptic(18);
        }

        if (flashTimerRef.current !== null) {
          window.clearTimeout(flashTimerRef.current);
        }
        setFlashState(outcome);
        flashTimerRef.current = window.setTimeout(() => {
          setFlashState('none');
        }, 420);

        if (deckIndex + 1 >= prevDeck.length) {
          const fresh = buildShuffledDeck();
          setDeckIndex(0);
          return fresh;
        }
        setDeckIndex((idx) => idx + 1);
        return prevDeck;
      });
    },
    [buildShuffledDeck, deckIndex]
  );

  // Countdown timer during ACTIVE_FOREHEAD
  useEffect(() => {
    if (phase !== 'ACTIVE_FOREHEAD') return;
    if (timeLeft <= 0) {
      soundManager.play('sting');
      triggerHaptic([60, 40, 80]);
      setPhase('TURN_SUMMARY');
      return;
    }

    const t = window.setTimeout(() => {
      const next = timeLeft - 1;
      setTimeLeft(next);
      if (next > 0 && next <= 5) {
        soundManager.play('tickUrgent');
      }
    }, 1000);

    return () => window.clearTimeout(t);
  }, [phase, timeLeft]);

  // Gyroscope DeviceOrientation tilt controls during ACTIVE_FOREHEAD
  // Uses orientation-invariant screen normal projection nz = cos(beta) * cos(gamma)
  // so nodding down (screen faces floor -> negative) = Correct, and tilting up = Skip
  useEffect(() => {
    if (
      phase !== 'ACTIVE_FOREHEAD' ||
      !gyroSupported ||
      !gyroEnabled ||
      gyroPermissionState !== 'granted'
    ) {
      return;
    }

    const computePitchDeg = (beta: number, gamma: number): number => {
      const bRad = (beta * Math.PI) / 180;
      const gRad = (gamma * Math.PI) / 180;
      const nz = Math.max(-1, Math.min(1, Math.cos(bRad) * Math.cos(gRad)));
      return (Math.asin(nz) * 180) / Math.PI;
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      const pitchDeg = computePitchDeg(e.beta, e.gamma);

      if (baselineAngleRef.current === null) {
        baselineSamplesRef.current.push(pitchDeg);
        if (baselineSamplesRef.current.length >= 3) {
          const avg =
            baselineSamplesRef.current.reduce((s, v) => s + v, 0) /
            baselineSamplesRef.current.length;
          baselineAngleRef.current = avg;
        }
        return;
      }

      const delta = pitchDeg - baselineAngleRef.current;
      const now = Date.now();

      if (Math.abs(delta) < 10) {
        tiltNeutralReadyRef.current = true;
        return;
      }

      if (!tiltNeutralReadyRef.current || now - lastTiltActionAtRef.current < 750) {
        return;
      }

      // Forward/downward nod (nz becomes negative -> delta < -22°) -> correct
      // Upward/backward nod (nz becomes positive -> delta > +22°) -> skip
      if (delta <= -22) {
        tiltNeutralReadyRef.current = false;
        lastTiltActionAtRef.current = now;
        advanceCard('correct');
      } else if (delta >= 22) {
        tiltNeutralReadyRef.current = false;
        lastTiltActionAtRef.current = now;
        advanceCard('skip');
      }
    };

    const resetCalibration = () => {
      baselineSamplesRef.current = [];
      baselineAngleRef.current = null;
    };

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('orientationchange', resetCalibration);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('orientationchange', resetCalibration);
    };
  }, [phase, gyroSupported, gyroEnabled, gyroPermissionState, advanceCard]);

  const handleConfirmTurnAndAdvance = guard(() => {
    soundManager.play('next');
    const correctCount = turnLogs.filter((l) => l.outcome === 'correct').length;
    const earned = correctCount * POINTS_PER_CORRECT;
    const updatedMap = {
      ...deltasMap,
      [currentPlayer.id]: (deltasMap[currentPlayer.id] ?? 0) + earned,
    };
    setDeltasMap(updatedMap);

    if (turnStep + 1 < turnOrder.length) {
      setTurnStep((s) => s + 1);
      setPhase('PASS_PLAYER');
      return;
    }

    const finalDeltas: RoundDelta[] = players.map((p) => ({
      playerId: p.id,
      delta: updatedMap[p.id] ?? 0,
    }));
    onApplyDeltas(finalDeltas);
    setRoundDeltas(finalDeltas);
    soundManager.play('victory');
    setPhase('LEADERBOARD');
  });

  const activeWord = deck[deckIndex] ?? 'استعد...';
  const correctSoFar = turnLogs.filter((l) => l.outcome === 'correct').length;
  const timeRatio = Math.max(0, Math.min(100, (timeLeft / durationSec) * 100));

  if (phase === 'ACTIVE_FOREHEAD') {
    const bgClass =
      flashState === 'correct'
        ? 'bg-emerald-600 dark:bg-emerald-700'
        : flashState === 'skip'
          ? 'bg-amber-600 dark:bg-amber-700'
          : 'bg-[#131C31]';

    return (
      <>
        <div
          className={`fixed inset-0 z-50 flex flex-col justify-between ${bgClass} text-white transition-colors duration-200 p-3 sm:p-5 select-none touch-none`}
        >
          {/* Top Bar with Pinned Active Player + Timer + Sensor Toggle & Exit */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  soundManager.play('click');
                  setShowExitConfirm(true);
                }}
                className="min-h-[38px] px-3 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-300/60 text-xs font-black flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج</span>
              </button>

              <div className="flex items-center gap-2 rounded-2xl bg-slate-800/90 border border-white/25 px-3 py-1.5">
                <span className="text-xs font-extrabold text-white/80">اللي بيمثل:</span>
                <span className="text-sm sm:text-base font-black text-amber-300">
                  {currentPlayer.name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`rounded-2xl px-3.5 py-1.5 font-black text-base sm:text-lg tabular-nums border ${
                  timeLeft <= 8
                    ? 'bg-rose-600 border-rose-300 animate-pulse'
                    : 'bg-white/15 border-white/25'
                }`}
              >
                ⏱ {timeLeft}ث
              </div>
              <div className="rounded-2xl bg-emerald-500/25 border border-emerald-300/50 px-3 py-1.5 text-sm font-black tabular-nums">
                ✅ {correctSoFar}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {gyroSupported && gyroPermissionState === 'granted' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setGyroEnabled((prev) => {
                        const next = !prev;
                        if (next) {
                          baselineSamplesRef.current = [];
                          baselineAngleRef.current = null;
                        }
                        return next;
                      });
                    }}
                    className={`min-h-[36px] px-2.5 rounded-xl text-xs font-black flex items-center gap-1 border transition-colors ${
                      gyroEnabled
                        ? 'bg-emerald-500/30 border-emerald-300/60 text-emerald-100'
                        : 'bg-white/10 border-white/20 text-white/75'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>المستشعار: {gyroEnabled ? 'شغال' : 'مقفول'}</span>
                  </button>
                  {gyroEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        baselineSamplesRef.current = [];
                        baselineAngleRef.current = null;
                        soundManager.play('click');
                      }}
                      className="min-h-[36px] px-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-black"
                    >
                      معايرة
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  soundManager.play('click');
                  setLandscapeCard((v) => !v);
                }}
                className="min-h-[36px] px-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-black flex items-center gap-1"
                title="تدوير الكارت"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>تدوير</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundManager.play('click');
                  setPhase('TURN_SUMMARY');
                }}
                className="min-h-[36px] px-3 rounded-xl bg-amber-500/85 hover:bg-amber-400 text-slate-950 text-xs font-black"
              >
                إنهاء الدور
              </button>
            </div>
          </div>

          {/* Countdown Progress Bar */}
          <div className="w-full h-2.5 rounded-full bg-white/15 overflow-hidden my-2">
            <div
              className={`h-full transition-all duration-500 ${
                timeLeft <= 8 ? 'bg-rose-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${timeRatio}%` }}
            />
          </div>

          {/* Main Giant Word Card + Huge Thumb-Friendly Side Tap Buttons */}
          {(() => {
            const useRotatedLandscape = landscapeCard && cardAreaSize.h > cardAreaSize.w;
            return (
              <div
                ref={cardAreaRef}
                className="flex-1 relative min-h-0 w-full flex items-center justify-center overflow-hidden my-1"
              >
                <div
                  style={
                    useRotatedLandscape
                      ? {
                          width: `${cardAreaSize.h}px`,
                          height: `${cardAreaSize.w}px`,
                          transform: 'rotate(90deg)',
                          transformOrigin: 'center center',
                        }
                      : undefined
                  }
                  className={
                    useRotatedLandscape
                      ? 'shrink-0 flex flex-row items-stretch gap-3 p-1'
                      : 'w-full h-full flex flex-row items-stretch gap-2.5 sm:gap-4'
                  }
                >
                  {/* Skip Button (Right side in RTL) */}
                  <button
                    type="button"
                    onClick={() => advanceCard('skip')}
                    className={`${
                      useRotatedLandscape
                        ? 'w-[25%] min-w-[118px] text-xl'
                        : 'w-26 sm:w-44 text-base sm:text-xl'
                    } h-full min-h-[120px] rounded-3xl bg-amber-500/95 hover:bg-amber-400 active:scale-95 border-2 border-amber-200/80 shadow-xl flex flex-col items-center justify-center gap-2.5 px-3 py-4 text-slate-950 font-black transition-transform shrink-0`}
                  >
                    <SkipForward className={useRotatedLandscape ? 'w-10 h-10' : 'w-7 h-7 sm:w-9 sm:h-9'} />
                    <span>تخطي ⏭️</span>
                  </button>

                  {/* Giant Secret Word Display */}
                  <div className="flex-1 h-full rounded-3xl bg-slate-900/75 border-2 border-white/30 shadow-2xl flex flex-col items-center justify-center p-4 sm:p-6 text-center min-w-0">
                    {flashState === 'correct' ? (
                      <div className="text-4xl sm:text-6xl font-black text-white animate-bounce">
                        صح! ✅ +{POINTS_PER_CORRECT}
                      </div>
                    ) : flashState === 'skip' ? (
                      <div className="text-4xl sm:text-6xl font-black text-white">تخطي ⏭️</div>
                    ) : (
                      <>
                        <span className="text-xs sm:text-sm font-extrabold text-white/75 mb-2">
                          المطلوب تمثيله أو وصفه بدون كلام:
                        </span>
                        <div
                          className={`${
                            useRotatedLandscape ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-6xl'
                          } font-black leading-tight text-white drop-shadow-lg break-words max-w-full`}
                        >
                          {activeWord}
                        </div>
                        {gyroSupported && gyroPermissionState === 'granted' && gyroEnabled && (
                          <span className="mt-4 text-[11px] font-bold text-white/70">
                            ميل لتحت = صح ✅ · لفوق = تخطي ⏭️ (أو اضغط الزراير الجانبية)
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Correct Button (Left side in RTL) */}
                  <button
                    type="button"
                    onClick={() => advanceCard('correct')}
                    className={`${
                      useRotatedLandscape
                        ? 'w-[25%] min-w-[118px] text-xl'
                        : 'w-26 sm:w-44 text-base sm:text-xl'
                    } h-full min-h-[120px] rounded-3xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 border-2 border-emerald-200/80 shadow-xl flex flex-col items-center justify-center gap-2.5 px-3 py-4 text-white font-black transition-transform shrink-0`}
                  >
                    <Check className={useRotatedLandscape ? 'w-11 h-11' : 'w-8 h-8 sm:w-10 sm:h-10'} />
                    <span>صح! ✅</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        <ConfirmModal
          open={showExitConfirm}
          title="متأكد إنك عايز تخرج من اللعبة؟"
          message="الجولة لسه شغالة، لو خرجت دلوقتي تقدم الدور هيتلغي."
          confirmLabel="نعم، اخرج"
          cancelLabel="كمل لعب"
          onConfirm={() => {
            setShowExitConfirm(false);
            onExitToHub();
          }}
          onCancel={() => setShowExitConfirm(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title="بدون كلام 🎭"
        exitVariant={isRoundInProgress ? 'exit' : 'back'}
        exitLabel={isRoundInProgress ? 'خروج' : 'رجوع'}
        onExit={() => {
          if (isRoundInProgress) setShowExitConfirm(true);
          else onExitToHub();
        }}
      />

      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-10 pt-2 flex flex-col items-center">
        {phase === 'READY' && (
          <div className="w-full flex flex-col gap-4">
            <ActiveTurnBanner
              label="هيبدأ الدور:"
              player={players[0]}
              badgeText={`${players.length} لاعبين`}
              accent="coral"
            />

            <div className="rounded-3xl qada-card p-4 text-right">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-[#FF6B4A]" />
                <h2 className="text-base font-black text-[#1E293B] dark:text-[#F8FAFC]">
                  تحدي الجبهة والتمثيل (بدون كلام!)
                </h2>
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                حط الموبايل على جبهتك بحيث صحابك يشوفوا الكلمة ويمثلوها أو يوصفوها لك من غير ما
                ينطقوها!
              </p>
            </div>

            <CategoryFilterBar
              categories={availableCategories.map((c) => ({
                id: c.id,
                name: c.name,
                count: c.items.length,
              }))}
              selectedIds={selectedCategoryIds}
              onChange={setSelectedCategoryIds}
              totalAvailable={filteredPool.length}
              unitLabel="كلمة"
              accentColor="coral"
            />

            {/* Duration + Rounds */}
            <div className="rounded-3xl qada-card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-[#14B8A6]" />
                  <span>وقت الدور:</span>
                </span>
                <div className="flex gap-1.5">
                  {([45, 60, 90] as const).map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setDurationSec(sec);
                      }}
                      className={`min-w-[48px] min-h-[36px] px-2.5 rounded-xl text-xs font-black tabular-nums ${
                        durationSec === sec
                          ? 'bg-[#14B8A6] text-white shadow-[0_3px_0_#0D9488]'
                          : 'bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      {sec}ث
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2.5 border-t border-[#E7DEC8]/60 dark:border-[#334155]/70 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC]">
                  عدد الجولات لكل لاعب:
                </span>
                <div className="flex gap-1.5">
                  {([1, 2] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setRoundsPerPlayer(r);
                      }}
                      className={`min-w-[56px] min-h-[36px] px-3 rounded-xl text-xs font-black ${
                        roundsPerPlayer === r
                          ? 'bg-[#FF6B4A] text-white shadow-[0_3px_0_#D94E30]'
                          : 'bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      {r === 1 ? 'جولة' : 'جولتين'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartSession}
              className="w-full min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>ابدأ تحدي بدون كلام 🎭</span>
            </button>
          </div>
        )}

        {phase === 'PASS_PLAYER' && (
          <div className="w-full flex flex-col gap-4">
            <ActiveTurnBanner
              label="الدور على:"
              player={currentPlayer}
              badgeText={`دور ${turnStep + 1} / ${turnOrder.length}`}
              accent="coral"
            />

            <div className="rounded-3xl qada-card p-5 text-center flex flex-col items-center gap-3">
              <div className="text-4xl">🎭📱</div>
              <h2 className="text-xl font-black text-[#1E293B] dark:text-[#F8FAFC]">
                ادي الموبايل لـ {currentPlayer.name}
              </h2>
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                لما تدوس ابدأ، حط الموبايل على جبهتك! ميل لتحت لما صحابك يخلّوك تخمّن صح، أو ميل
                لفوق للتخطي (وتقدر تدوس الزراير على الشاشة كمان).
              </p>

              {gyroSupported && gyroPermissionState === 'needs_prompt' && (
                <button
                  type="button"
                  onClick={requestGyroPermission}
                  className="w-full min-h-[44px] rounded-2xl bg-[#FFFBEB] dark:bg-amber-950/50 border-2 border-[#F59E0B] text-[#B45309] dark:text-[#FBBF24] text-sm font-black flex items-center justify-center gap-2"
                >
                  <Compass className="w-4 h-4" />
                  <span>تفعيل مستشعر الميلان (الجيروسكوب)</span>
                </button>
              )}

              {gyroPermissionState === 'granted' && (
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-xl">
                  ✅ مستشعر الميلان والزراير شغالين معاك
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleStartTurn}
              className="w-full min-h-[58px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>جاهز! ابدأ الـ {durationSec} ثانية 🔥</span>
            </button>
          </div>
        )}

        {phase === 'TURN_SUMMARY' && (
          <div className="w-full flex flex-col gap-4">
            <ActiveTurnBanner
              label="خلص دور:"
              player={currentPlayer}
              badgeText={`+${correctSoFar * POINTS_PER_CORRECT} نقطة`}
              accent="emerald"
            />

            <div className="rounded-3xl qada-card p-4">
              <h2 className="text-base font-black text-[#1E293B] dark:text-[#F8FAFC] mb-3 text-center">
                ملخص دور {currentPlayer.name} ({correctSoFar} صح ✅)
              </h2>

              {turnLogs.length === 0 ? (
                <p className="text-center text-sm font-bold text-[#64748B] dark:text-[#94A3B8] py-4">
                  مفيش كلمات اتلعبت في الدور ده!
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {turnLogs.map((item, idx) => (
                    <div
                      key={`${item.word}_${idx}`}
                      className={`rounded-2xl px-3.5 py-2.5 flex items-center justify-between text-sm font-black border ${
                        item.outcome === 'correct'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                      }`}
                    >
                      <span>{item.word}</span>
                      <span>
                        {item.outcome === 'correct' ? `✅ +${POINTS_PER_CORRECT}` : '⏭️ تخطي'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleConfirmTurnAndAdvance}
              className="w-full min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black transition-transform"
            >
              {turnStep + 1 < turnOrder.length ? 'الدور اللي بعده ➡️' : 'النتيجة النهائية 🏆'}
            </button>
          </div>
        )}

        {phase === 'LEADERBOARD' && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline="نتائج تحدي بدون كلام 🎭"
            isTournamentMode={Boolean(onTournamentFinish)}
            onNewRound={() => {
              setPhase('READY');
            }}
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
        message="الجولة لسه شغالة، لو خرجت دلوقتي تقدم الدور هيتلغي."
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
