import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bomb, Flame, RefreshCw, Skull } from 'lucide-react';
import { BANNER_COLOR_CLASSES, BOMB_PROMPTS } from '../../data/gameData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { BombPhase, Player, RoundDelta } from '../../types/game';
import { soundManager } from '../../utils/soundManager';
import { ConfirmModal } from '../ConfirmModal';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { PlayerAvatar } from '../PlayerAvatar';
import { TopBar } from '../TopBar';

interface BombGameFlowProps {
  players: Player[];
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
}

function shufflePrompts(list: string[]): string[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const BombGameFlow: React.FC<BombGameFlowProps> = ({
  players,
  onApplyDeltas,
  onExitToHub,
}) => {
  const guard = useTapGuard(400);

  const [phase, setPhase] = useState<BombPhase>('READY');
  const [promptDeck, setPromptDeck] = useState<string[]>(() => shufflePrompts(BOMB_PROMPTS));
  const [promptIdx, setPromptIdx] = useState<number>(0);
  const [urgencyLevel, setUrgencyLevel] = useState<'idle' | 'medium' | 'urgent'>('idle');
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [loserName, setLoserName] = useState<string>('');
  const [passFlash, setPassFlash] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(25000);
  const tickTimeoutRef = useRef<number | null>(null);
  const explodeTimeoutRef = useRef<number | null>(null);
  const urgencyRafRef = useRef<number | null>(null);

  const isRoundInProgress = phase === 'ACTIVE' || phase === 'EXPLODED';

  useNavigationGuard(isRoundInProgress, () => {
    setShowExitConfirm(true);
  });

  const clearBombTimers = useCallback(() => {
    if (tickTimeoutRef.current !== null) {
      window.clearTimeout(tickTimeoutRef.current);
      tickTimeoutRef.current = null;
    }
    if (explodeTimeoutRef.current !== null) {
      window.clearTimeout(explodeTimeoutRef.current);
      explodeTimeoutRef.current = null;
    }
    if (urgencyRafRef.current !== null) {
      window.cancelAnimationFrame(urgencyRafRef.current);
      urgencyRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearBombTimers();
  }, [clearBombTimers]);

  const advancePrompt = useCallback(() => {
    setPromptIdx((prev) => {
      if (prev + 1 >= promptDeck.length) {
        setPromptDeck(shufflePrompts(BOMB_PROMPTS));
        return 0;
      }
      return prev + 1;
    });
  }, [promptDeck.length]);

  const startBombRound = guard(() => {
    soundManager.unlock();
    clearBombTimers();

    // Hidden random timer between 15 and 45 seconds
    const hiddenMs = 15000 + Math.random() * 30000;
    durationRef.current = hiddenMs;
    startTimeRef.current = performance.now();

    advancePrompt();
    setUrgencyLevel('idle');
    setRoundDeltas([]);
    setLoserName('');
    setPhase('ACTIVE');

    // Explosion trigger
    explodeTimeoutRef.current = window.setTimeout(() => {
      clearBombTimers();
      soundManager.play('explosion');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([250, 90, 350]);
      }
      setPhase('EXPLODED');
    }, hiddenMs);

    // Accelerating tick scheduler
    const scheduleNextTick = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const progress = Math.min(1, elapsed / durationRef.current);
      if (progress >= 0.99) return;

      soundManager.play(progress > 0.74 ? 'tickUrgent' : 'tick', progress);

      // Interval speeds up from ~920ms down to ~135ms
      const nextInterval = Math.max(135, 920 - Math.pow(progress, 1.35) * 785);
      tickTimeoutRef.current = window.setTimeout(scheduleNextTick, nextInterval);
    };

    tickTimeoutRef.current = window.setTimeout(scheduleNextTick, 400);

    // Smooth visual urgency state watcher
    const updateVisualUrgency = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const progress = elapsed / durationRef.current;
      if (progress >= 1) return;

      if (progress > 0.72) {
        setUrgencyLevel('urgent');
      } else if (progress > 0.42) {
        setUrgencyLevel('medium');
      } else {
        setUrgencyLevel('idle');
      }
      urgencyRafRef.current = window.requestAnimationFrame(updateVisualUrgency);
    };
    urgencyRafRef.current = window.requestAnimationFrame(updateVisualUrgency);
  });

  const handlePassedBomb = guard(() => {
    soundManager.play('next');
    advancePrompt();
    setPassFlash(true);
    window.setTimeout(() => setPassFlash(false), 180);
  });

  const handleSelectLoser = guard((loser: Player) => {
    soundManager.play('error');
    const deltas: RoundDelta[] = players.map((p) => ({
      playerId: p.id,
      delta: p.id === loser.id ? -100 : 0,
    }));
    setRoundDeltas(deltas);
    setLoserName(loser.name);
    onApplyDeltas(deltas);
    setPhase('LEADERBOARD');
  });

  const handleHeaderExit = () => {
    if (isRoundInProgress) {
      setShowExitConfirm(true);
    } else {
      clearBombTimers();
      onExitToHub();
    }
  };

  const currentPrompt = promptDeck[promptIdx] ?? BOMB_PROMPTS[0];

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Danger vignette overlay during final quarter */}
      {phase === 'ACTIVE' && urgencyLevel === 'urgent' && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10 shadow-[inset_0_0_90px_30px_rgba(239,68,68,0.8)] animate-danger-vignette"
        />
      )}

      <TopBar
        title={phase === 'LEADERBOARD' ? 'النتيجة' : 'القنبلة الموقوتة'}
        exitVariant={isRoundInProgress ? 'home' : 'back'}
        onExit={handleHeaderExit}
      />

      <main className="relative z-20 flex-1 w-full max-w-xl mx-auto px-4 pb-8 pt-2 flex flex-col">
        {/* PHASE 1: READY */}
        {phase === 'READY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            <div className="w-36 h-36 mb-6 rounded-full bg-gradient-to-br from-[#7f1d1d]/60 to-[#f97316]/30 border-2 border-orange-300/30 flex items-center justify-center shadow-2xl">
              <Bomb className="w-20 h-20 text-orange-300 animate-bomb-idle" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              القنبلة الموقوتة
            </h2>
            <p className="text-base font-bold text-white/85 max-w-sm leading-relaxed mb-8">
              هيظهر لك سؤال سريع — جاوب بصوت عالي واضغط{' '}
              <span className="text-emerald-300 font-black">&quot;جاوبت - اللي بعده!&quot;</span>{' '}
              وباصي الموبايل فوراً! الوقت مخفي وممكن تنفجر في أي لحظة.
            </p>

            <button
              type="button"
              onClick={startBombRound}
              className="w-full max-w-[270px] min-h-[58px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
            >
              ابدأ القنبلة!
            </button>
          </div>
        )}

        {/* PHASE 2: ACTIVE GAMEPLAY */}
        {phase === 'ACTIVE' && (
          <div className="flex-1 flex flex-col items-center justify-between py-2">
            {/* Animated Bomb Graphic */}
            <div className="flex-1 flex flex-col items-center justify-center w-full py-2">
              <div
                className={`relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center ${
                  urgencyLevel === 'urgent'
                    ? 'animate-bomb-urgent'
                    : urgencyLevel === 'medium'
                      ? 'animate-bomb-medium'
                      : 'animate-bomb-idle'
                }`}
              >
                <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_18px_28px_rgba(0,0,0,0.65)]" aria-hidden="true">
                  {/* Fuse rope */}
                  <path
                    d="M126 52 Q148 22 172 34"
                    stroke="#d97706"
                    strokeWidth="8"
                    strokeLinecap="round"
                    fill="none"
                  />
                  {/* Spark */}
                  <circle
                    cx="173"
                    cy="34"
                    r={urgencyLevel === 'urgent' ? '14' : '10'}
                    fill={urgencyLevel === 'urgent' ? '#ef4444' : '#fbbf24'}
                  />
                  <circle cx="173" cy="34" r="5" fill="#ffffff" />

                  {/* Bomb Cap */}
                  <rect x="86" y="42" width="32" height="18" rx="5" fill="#475569" />
                  <path d="M102 42 Q115 44 126 52" stroke="#f59e0b" strokeWidth="6" fill="none" />

                  {/* Bomb Sphere */}
                  <defs>
                    <radialGradient id="bombGrad" cx="35%" cy="32%" r="68%">
                      <stop offset="0%" stopColor="#475569" />
                      <stop offset="45%" stopColor="#1e293b" />
                      <stop offset="100%" stopColor="#090d16" />
                    </radialGradient>
                  </defs>
                  <circle cx="96" cy="116" r="64" fill="url(#bombGrad)" stroke="#334155" strokeWidth="3" />
                  {/* Gloss highlight */}
                  <ellipse
                    cx="73"
                    cy="92"
                    rx="18"
                    ry="11"
                    transform="rotate(-28 73 92)"
                    fill="#ffffff"
                    opacity="0.16"
                  />
                  {/* Warning emblem on bomb */}
                  <circle
                    cx="96"
                    cy="122"
                    r="20"
                    fill={urgencyLevel === 'urgent' ? '#dc2626' : '#f97316'}
                    opacity="0.9"
                  />
                  <path
                    d="M96 111 L96 124 M96 130 L96 132"
                    stroke="#ffffff"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Prompt Card */}
              <div
                className={`w-full max-w-md rounded-3xl border-2 p-6 text-center shadow-2xl transition-colors duration-150 ${
                  passFlash
                    ? 'bg-emerald-900/80 border-emerald-400'
                    : 'bg-[#1a0b33]/95 border-white/20'
                }`}
              >
                <div className="text-xs font-extrabold text-orange-300 mb-2 flex items-center justify-center gap-1.5">
                  <Flame className="w-4 h-4" />
                  <span>جاوب بسرعة وباصي الموبايل</span>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-white leading-snug">
                  {currentPrompt}
                </p>
              </div>

              <button
                type="button"
                onClick={guard(() => {
                  soundManager.play('click');
                  advancePrompt();
                })}
                className="mt-3 min-h-[40px] px-4 rounded-xl text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تغيير السؤال</span>
              </button>
            </div>

            {/* Huge Bottom Action CTA */}
            <div className="w-full max-w-md pt-3">
              <button
                type="button"
                onClick={handlePassedBomb}
                className="w-full min-h-[68px] rounded-2xl bakasa-btn-green text-white text-2xl font-black tracking-wide transition-transform"
              >
                جاوبت - اللي بعده!
              </button>
            </div>
          </div>
        )}

        {/* PHASE 3: EXPLODED - SELECT HOLDER */}
        {phase === 'EXPLODED' && (
          <div className="flex-1 flex flex-col items-center py-4">
            <div className="w-full max-w-md rounded-3xl bg-[#3d1122]/90 border-2 border-[#cf5b54] p-5 text-center shadow-2xl mb-5">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#cf5b54]/25 border border-[#cf5b54] flex items-center justify-center text-[#fca5a5]">
                <Skull className="w-9 h-9" />
              </div>
              <h2 className="text-3xl font-black text-white mb-1">بوووم! انفجرت!</h2>
              <p className="text-sm sm:text-base font-bold text-rose-200">
                اختار مين اللي كان ماسك الموبايل عشان يتخصم منه ١٠٠ نقطة
              </p>
            </div>

            <div className="w-full max-w-md flex flex-col gap-3">
              {players.map((player) => {
                const style = BANNER_COLOR_CLASSES[player.color];
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handleSelectLoser(player)}
                    className={`w-full min-h-[64px] rounded-2xl ${style.bg} ${style.shadow} border ${style.border} px-4 py-2 flex items-center justify-between gap-3 text-right transition-transform active:scale-[0.98] hover:brightness-105`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerAvatar avatarId={player.avatarId} name={player.name} size="md" />
                      <span className="text-lg font-black text-white truncate">
                        {player.name}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-xl bg-black/30 px-3 py-1 text-xs font-black text-rose-200 tabular-nums">
                      -١٠٠ نقطة
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE 4: LEADERBOARD */}
        {phase === 'LEADERBOARD' && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline={`القنبلة انفجرت في ${loserName} (-١٠٠ نقطة)`}
            onNewRound={() => startBombRound()}
            onFinishGame={() => {
              clearBombTimers();
              onExitToHub();
            }}
          />
        )}
      </main>

      <ConfirmModal
        open={showExitConfirm}
        title="هل أنت متأكد من الخروج؟"
        message="القنبلة لسه شغالة، لو خرجت دلوقتي الدور الحالي هيتلغي."
        onConfirm={() => {
          clearBombTimers();
          setShowExitConfirm(false);
          onExitToHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
