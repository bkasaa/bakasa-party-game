import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock,
  ListChecks,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  FOOTBALL_THREE_PROMPTS,
  FootballGlobalSettings,
  filterByScope,
} from '../../data/footballData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { Player, RoundDelta } from '../../types/game';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { pickUnseenItem } from '../../utils/usedItemsMemory';
import { ActiveTurnBanner } from '../ActiveTurnBanner';
import { ConfirmModal } from '../ConfirmModal';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { PlayerAvatar } from '../PlayerAvatar';
import { TopBar } from '../TopBar';
import { FootballSettingsBar } from './FootballSettingsBar';

interface FootballThreeGameFlowProps {
  players: Player[];
  initialSettings: FootballGlobalSettings;
  onUpdateSettings: (next: FootballGlobalSettings) => void;
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
}

type ThreePhase = 'READY' | 'PASS_TURN' | 'ACTIVE_CHALLENGE' | 'SUMMARY' | 'LEADERBOARD';

export const FootballThreeGameFlow: React.FC<FootballThreeGameFlowProps> = ({
  players,
  initialSettings,
  onUpdateSettings,
  onApplyDeltas,
  onExitToHub,
  onTournamentFinish,
}) => {
  const guard = useTapGuard(350);

  const [phase, setPhase] = useState<ThreePhase>('READY');
  const [settings, setSettings] = useState<FootballGlobalSettings>(() => ({
    scope: initialSettings.scope,
    rounds: [1, 2, 3].includes(initialSettings.rounds) ? initialSettings.rounds : 1,
    turnSeconds: [10, 12, 15, 20].includes(initialSettings.turnSeconds)
      ? initialSettings.turnSeconds
      : 12,
  }));

  const [turnQueue, setTurnQueue] = useState<Player[]>([]);
  const [turnIdx, setTurnIdx] = useState<number>(0);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState<number>(settings.turnSeconds);
  const [msLeft, setMsLeft] = useState<number>(settings.turnSeconds * 1000);
  const [timedOut, setTimedOut] = useState<boolean>(false);
  const [earnedByPlayer, setEarnedByPlayer] = useState<Record<string, number>>({});
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const deadlineRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(settings.turnSeconds);

  const scopedPrompts = useMemo(
    () => filterByScope(FOOTBALL_THREE_PROMPTS, settings.scope).map((p) => p.text),
    [settings.scope]
  );

  const challengeDuration = settings.turnSeconds;
  const cycles = Math.max(1, Math.min(3, settings.rounds));

  const isRoundInProgress = phase === 'PASS_TURN' || phase === 'ACTIVE_CHALLENGE';

  useNavigationGuard(isRoundInProgress, () => {
    setShowExitConfirm(true);
  });

  useEffect(() => {
    if (phase !== 'ACTIVE_CHALLENGE' || timedOut) return;

    let stopped = false;
    const timer = window.setInterval(() => {
      if (stopped) return;
      const remaining = Math.max(0, deadlineRef.current - Date.now());
      const sec = Math.ceil(remaining / 1000);
      setMsLeft(remaining);
      setSecondsLeft(sec);

      if (sec !== lastTickSecRef.current && sec > 0) {
        lastTickSecRef.current = sec;
        if (sec <= 3) {
          soundManager.play('tickUrgent');
          triggerHaptic(22);
        } else if (sec <= 6) {
          soundManager.play('tick');
        }
      }

      if (remaining <= 0) {
        stopped = true;
        window.clearInterval(timer);
        setTimedOut(true);
        soundManager.play('explosion');
        triggerHaptic([60, 40, 80]);
      }
    }, 80);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [phase, timedOut]);

  const startGame = guard(() => {
    soundManager.unlock();
    soundManager.play('next');

    const queue: Player[] = [];
    for (let c = 0; c < cycles; c++) {
      const batch = [...players].sort(() => Math.random() - 0.5);
      queue.push(...batch);
    }

    const initScores: Record<string, number> = {};
    players.forEach((p) => {
      initScores[p.id] = 0;
    });

    setTurnQueue(queue);
    setTurnIdx(0);
    setEarnedByPlayer(initScores);
    setRoundDeltas([]);
    setPhase('PASS_TURN');
  });

  const revealAndStartTurn = guard(() => {
    soundManager.play('reveal');
    const prompt = pickUnseenItem(`fb_three:${settings.scope}`, scopedPrompts);
    setCurrentPrompt(prompt);
    deadlineRef.current = Date.now() + challengeDuration * 1000;
    lastTickSecRef.current = challengeDuration;
    setSecondsLeft(challengeDuration);
    setMsLeft(challengeDuration * 1000);
    setTimedOut(false);
    setPhase('ACTIVE_CHALLENGE');
  });

  const advanceOrFinish = (updatedEarned: Record<string, number>) => {
    if (turnIdx + 1 < turnQueue.length) {
      setTurnIdx((prev) => prev + 1);
      setPhase('PASS_TURN');
      return;
    }

    const deltas: RoundDelta[] = players.map((p) => ({
      playerId: p.id,
      delta: updatedEarned[p.id] ?? 0,
    }));
    setRoundDeltas(deltas);
    onApplyDeltas(deltas);
    soundManager.play('victory');
    triggerHaptic([35, 30, 70]);
    setPhase('SUMMARY');
  };

  const handleSuccess = guard(() => {
    const active = turnQueue[turnIdx];
    if (!active) return;

    soundManager.play('catch');
    triggerHaptic(25);
    const updatedEarned = {
      ...earnedByPlayer,
      [active.id]: (earnedByPlayer[active.id] ?? 0) + 50,
    };
    setEarnedByPlayer(updatedEarned);
    advanceOrFinish(updatedEarned);
  });

  const handleFail = guard(() => {
    soundManager.play('error');
    triggerHaptic(35);
    advanceOrFinish(earnedByPlayer);
  });

  const handleHeaderExit = () => {
    if (isRoundInProgress) {
      setShowExitConfirm(true);
    } else {
      onExitToHub();
    }
  };

  const activePlayer = turnQueue[turnIdx];
  const progressPct = Math.max(0, Math.min(100, (msLeft / (challengeDuration * 1000)) * 100));
  const isUrgent = secondsLeft <= 3;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title={phase === 'LEADERBOARD' ? 'النتيجة' : 'تحدي الـ 3 في الكورة 🔥'}
        exitVariant={isRoundInProgress ? 'exit' : 'back'}
        exitLabel={isRoundInProgress ? 'خروج' : 'رجوع'}
        onExit={handleHeaderExit}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* PHASE 1: READY */}
        {phase === 'READY' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center gap-4">
            <div className="w-full max-w-md rounded-3xl qada-card p-6">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#FFFBEB] dark:bg-amber-950/50 border-2 border-[#FDE68A] dark:border-amber-700 flex items-center justify-center text-[#F59E0B]">
                <ListChecks className="w-9 h-9" />
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-2">
                قول 3 حاجات في {challengeDuration} ثانية!
              </h2>
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {scopedPrompts.length} تحدي كروي سريع! في دورك هيطلعلك تحدي ولازم تقول 3 أسماء صح
                في {challengeDuration} ثانية بس عشان تكسب +50 نقطة!
              </p>
            </div>

            <div className="w-full max-w-md">
              <FootballSettingsBar
                settings={settings}
                onChange={(next) => {
                  setSettings(next);
                  onUpdateSettings(next);
                }}
                roundsLabel="عدد الأدوار لكل لاعب:"
                roundOptions={[1, 2, 3]}
                roundUnit="أدوار"
                secondsLabel="وقت التحدي:"
                secondsOptions={[10, 12, 15, 20]}
              />
            </div>

            <button
              type="button"
              onClick={startGame}
              className="w-full max-w-[270px] min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
            >
              <Sparkles className="w-5 h-5" />
              <span>ابدأ التحدي!</span>
            </button>
          </div>
        )}

        {/* PHASE 2: PASS TURN */}
        {phase === 'PASS_TURN' && activePlayer && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <ActiveTurnBanner
              label="اللي هيلعب دلوقتي:"
              player={activePlayer}
              badgeText={`دور ${turnIdx + 1} من ${turnQueue.length}`}
              accent="amber"
            />

            <div className="w-full max-w-md rounded-3xl qada-card px-6 py-10 mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FFFBEB] dark:bg-[#0F172A] border-2 border-[#FDE68A] dark:border-[#334155] flex items-center justify-center">
                <PlayerAvatar avatarId={activePlayer.avatarId} name={activePlayer.name} size="md" />
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-2">
                جاهز يا{' '}
                <span className="text-[#D97706] dark:text-[#FBBF24]">{activePlayer.name}</span>؟
              </h2>
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">
                أول ما تضغط الزرار التحدي هيظهر والـ {challengeDuration} ثانية هيبدأوا فوراً!
              </p>
            </div>

            <button
              type="button"
              onClick={revealAndStartTurn}
              className="w-full max-w-[260px] min-h-[56px] rounded-2xl qada-btn-amber text-[#1E293B] text-xl font-black transition-transform"
            >
              اكشف التحدي وابدأ ⏱️
            </button>
          </div>
        )}

        {/* PHASE 3: ACTIVE CHALLENGE */}
        {phase === 'ACTIVE_CHALLENGE' && activePlayer && (
          <div className="flex-1 flex flex-col items-center py-2">
            <ActiveTurnBanner
              label="الدور على:"
              player={activePlayer}
              badgeText={`دور ${turnIdx + 1} من ${turnQueue.length}`}
              accent={isUrgent || timedOut ? 'rose' : 'amber'}
            />

            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-5 text-center">
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="text-xs font-black text-[#D97706] dark:text-[#FBBF24]">
                  تحدي الـ 3 أسماء
                </span>
                <span
                  className={`text-2xl font-black tabular-nums flex items-center gap-1.5 ${
                    timedOut || isUrgent
                      ? 'text-[#E11D48] dark:text-rose-400 animate-pulse'
                      : 'text-[#059669] dark:text-emerald-400'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  <span>{timedOut ? 'خلص الوقت!' : `${secondsLeft} ث`}</span>
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-[#EAE0D0] dark:bg-[#0F172A] overflow-hidden mb-6">
                <div
                  className={`h-full rounded-full transition-all duration-75 ${
                    timedOut || isUrgent
                      ? 'bg-[#E11D48]'
                      : secondsLeft <= 6
                        ? 'bg-[#F59E0B]'
                        : 'bg-[#10B981]'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="min-h-[120px] rounded-2xl bg-[#FFF9F0]/90 dark:bg-[#0F172A]/90 border-2 border-[#E7DEC8] dark:border-[#334155] p-5 flex items-center justify-center">
                <h2 className="text-2xl sm:text-3xl font-black text-[#1E293B] dark:text-white leading-snug">
                  {currentPrompt}
                </h2>
              </div>
            </div>

            <div className="w-full max-w-md flex flex-col gap-3">
              <button
                type="button"
                onClick={handleSuccess}
                className="w-full min-h-[58px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
              >
                <Check className="w-6 h-6" />
                <span>جابها صح! (+50 نقطة)</span>
              </button>

              <button
                type="button"
                onClick={handleFail}
                className={`w-full min-h-[54px] rounded-2xl bakasa-btn-red text-white text-lg font-black flex items-center justify-center gap-2 transition-transform ${
                  timedOut ? 'animate-pulse ring-4 ring-rose-300' : ''
                }`}
              >
                <XCircle className="w-5 h-5" />
                <span>{timedOut ? 'انتهى الوقت — الدور اللي بعده' : 'فشل / مالحقش'}</span>
              </button>
            </div>
          </div>
        )}

        {/* PHASE 4: SUMMARY */}
        {phase === 'SUMMARY' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6 animate-reveal-3s">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-950/50 border-2 border-[#A7F3D0] dark:border-emerald-700 flex items-center justify-center text-[#059669]">
                <Trophy className="w-9 h-9" />
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-4">
                نتائج تحدي الـ 3 في الكورة
              </h2>

              <div className="flex flex-col gap-2 text-right">
                {players.map((p) => {
                  const delta = roundDeltas.find((d) => d.playerId === p.id)?.delta ?? 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl bg-[#FFF9F0]/90 dark:bg-[#0F172A]/90 border border-[#EAE0D0] dark:border-[#334155] px-3.5 py-2 text-sm font-bold"
                    >
                      <span className="text-[#1E293B] dark:text-white truncate">{p.name}</span>
                      <span
                        className={`font-black tabular-nums ${
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
              className="w-full max-w-[260px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black transition-transform"
            >
              عرض النتيجة
            </button>
          </div>
        )}

        {/* PHASE 5: LEADERBOARD */}
        {phase === 'LEADERBOARD' && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline="أبطال تحدي الـ 3 في الكورة ⚽"
            isTournamentMode={Boolean(onTournamentFinish)}
            onNewRound={() => setPhase('READY')}
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
        message="التحدي لسه شغال، لو خرجت دلوقتي نقاط الجولة دي مش هتتحسب."
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
