import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock,
  RefreshCw,
  Shield,
  Shirt,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  FOOTBALL_CLUBS,
  FootballClubItem,
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
import { TopBar } from '../TopBar';
import { FootballSettingsBar } from './FootballSettingsBar';

interface ClubChainGameFlowProps {
  players: Player[];
  initialSettings: FootballGlobalSettings;
  onUpdateSettings: (next: FootballGlobalSettings) => void;
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
}

type ChainPhase = 'READY' | 'ACTIVE' | 'ROUND_RESULT' | 'LEADERBOARD';

export const ClubChainGameFlow: React.FC<ClubChainGameFlowProps> = ({
  players,
  initialSettings,
  onUpdateSettings,
  onApplyDeltas,
  onExitToHub,
  onTournamentFinish,
}) => {
  const guard = useTapGuard(350);

  const [phase, setPhase] = useState<ChainPhase>('READY');
  const [settings, setSettings] = useState<FootballGlobalSettings>(() => ({
    ...initialSettings,
    turnSeconds: [8, 10, 12, 15, 20].includes(initialSettings.turnSeconds)
      ? initialSettings.turnSeconds
      : 10,
  }));
  const [currentClub, setCurrentClub] = useState<FootballClubItem>(FOOTBALL_CLUBS[0]);
  const [turnOrder, setTurnOrder] = useState<Player[]>(players);
  const [eliminatedIds, setEliminatedIds] = useState<Set<string>>(new Set());
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [passCounts, setPassCounts] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState<number>(settings.turnSeconds);
  const [msLeft, setMsLeft] = useState<number>(settings.turnSeconds * 1000);
  const [turnTimedOut, setTurnTimedOut] = useState<boolean>(false);
  const [winnerPlayer, setWinnerPlayer] = useState<Player | null>(null);
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const lastTickSecRef = useRef<number>(settings.turnSeconds);
  const deadlineRef = useRef<number>(0);

  const filteredClubs = useMemo(
    () => filterByScope(FOOTBALL_CLUBS, settings.scope),
    [settings.scope]
  );

  const turnDuration = settings.turnSeconds;
  const isRoundInProgress = phase === 'ACTIVE' || phase === 'ROUND_RESULT';

  useNavigationGuard(isRoundInProgress, () => {
    setShowExitConfirm(true);
  });

  const pickNextClub = () => {
    const names = filteredClubs.map((c) => c.name);
    const chosenName = pickUnseenItem(`fb_chain:${settings.scope}`, names);
    return filteredClubs.find((c) => c.name === chosenName) ?? filteredClubs[0];
  };

  const resetTurnTimer = () => {
    deadlineRef.current = Date.now() + turnDuration * 1000;
    lastTickSecRef.current = turnDuration;
    setSecondsLeft(turnDuration);
    setMsLeft(turnDuration * 1000);
    setTurnTimedOut(false);
  };

  // Turn countdown timer
  useEffect(() => {
    if (phase !== 'ACTIVE' || turnTimedOut) return;

    const timer = window.setInterval(() => {
      const remaining = Math.max(0, deadlineRef.current - Date.now());
      const sec = Math.ceil(remaining / 1000);
      setMsLeft(remaining);
      setSecondsLeft(sec);

      if (sec !== lastTickSecRef.current && sec > 0) {
        lastTickSecRef.current = sec;
        if (sec <= 3) {
          soundManager.play('tickUrgent');
          triggerHaptic(20);
        } else if (sec <= 5) {
          soundManager.play('tick');
        }
      }

      if (remaining <= 0) {
        setTurnTimedOut(true);
        soundManager.play('explosion');
        triggerHaptic([60, 40, 80]);
      }
    }, 80);

    return () => window.clearInterval(timer);
  }, [phase, turnTimedOut]);

  const startRound = guard(() => {
    soundManager.unlock();
    soundManager.play('next');

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const club = pickNextClub();
    const initCounts: Record<string, number> = {};
    players.forEach((p) => {
      initCounts[p.id] = 0;
    });

    setTurnOrder(shuffled);
    setEliminatedIds(new Set());
    setCurrentIdx(0);
    setPassCounts(initCounts);
    setCurrentClub(club);
    setWinnerPlayer(null);
    setRoundDeltas([]);
    resetTurnTimer();
    setPhase('ACTIVE');
  });

  const findNextActiveIdx = (fromIdx: number, nextEliminated: Set<string>): number => {
    for (let step = 1; step <= turnOrder.length; step++) {
      const candidateIdx = (fromIdx + step) % turnOrder.length;
      if (!nextEliminated.has(turnOrder[candidateIdx].id)) {
        return candidateIdx;
      }
    }
    return fromIdx;
  };

  const activePlayer = turnOrder[currentIdx];
  const survivors = turnOrder.filter((p) => !eliminatedIds.has(p.id));

  const handleTurnSuccess = guard(() => {
    if (!activePlayer) return;
    soundManager.play('next');
    triggerHaptic(18);

    setPassCounts((prev) => ({
      ...prev,
      [activePlayer.id]: (prev[activePlayer.id] ?? 0) + 1,
    }));

    const nextIdx = findNextActiveIdx(currentIdx, eliminatedIds);
    setCurrentIdx(nextIdx);
    resetTurnTimer();
  });

  const handleTurnFail = guard(() => {
    if (!activePlayer) return;

    const nextEliminated = new Set(eliminatedIds);
    nextEliminated.add(activePlayer.id);
    setEliminatedIds(nextEliminated);

    const remainingSurvivors = turnOrder.filter((p) => !nextEliminated.has(p.id));
    if (remainingSurvivors.length <= 1) {
      const champ = remainingSurvivors[0] ?? null;
      const deltas: RoundDelta[] = players.map((p) => {
        const passes = passCounts[p.id] ?? 0;
        const winBonus = champ && p.id === champ.id ? 100 : 0;
        return {
          playerId: p.id,
          delta: passes * 15 + winBonus,
        };
      });

      setWinnerPlayer(champ);
      setRoundDeltas(deltas);
      onApplyDeltas(deltas);
      soundManager.play('victory');
      triggerHaptic([35, 30, 70]);
      setPhase('ROUND_RESULT');
      return;
    }

    soundManager.play('error');
    triggerHaptic(35);
    const nextIdx = findNextActiveIdx(currentIdx, nextEliminated);
    setCurrentIdx(nextIdx);
    resetTurnTimer();
  });

  const handleSwapClub = guard(() => {
    soundManager.play('click');
    setCurrentClub(pickNextClub());
    resetTurnTimer();
  });

  const handleHeaderExit = () => {
    if (isRoundInProgress) {
      setShowExitConfirm(true);
    } else {
      onExitToHub();
    }
  };

  const progressPct = Math.max(0, Math.min(100, (msLeft / (turnDuration * 1000)) * 100));
  const isUrgent = secondsLeft <= 3;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title={phase === 'LEADERBOARD' ? 'النتيجة' : 'قول اسم لاعب 👕'}
        exitVariant={isRoundInProgress ? 'home' : 'back'}
        onExit={handleHeaderExit}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* PHASE 1: READY */}
        {phase === 'READY' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center gap-4">
            <div className="w-full max-w-md rounded-3xl qada-card p-6">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#FFF5F2] dark:bg-rose-950/50 border-2 border-[#FECDD3] dark:border-rose-800 flex items-center justify-center text-[#FF6B4A]">
                <Shirt className="w-9 h-9" />
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-2">
                تحدي الـ {turnDuration} ثواني للأندية
              </h2>
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                هيظهر اسم نادي أو منتخب كبير ({filteredClubs.length} نادي). كل لاعب في دوره قدامه{' '}
                {turnDuration} ثانية بس يقول اسم لاعب حالي أو سابق لعب للنادي ده من غير تكرار! آخر
                واحد يفضل صامد يكسب +١٠٠ نقطة.
              </p>
            </div>

            <div className="w-full max-w-md">
              <FootballSettingsBar
                settings={settings}
                onChange={(next) => {
                  setSettings(next);
                  onUpdateSettings(next);
                }}
                showRounds={false}
                secondsLabel="وقت كل لاعب:"
                secondsOptions={[8, 10, 12, 15, 20]}
              />
            </div>

            <button
              type="button"
              onClick={startRound}
              className="w-full max-w-[270px] min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
            >
              <Sparkles className="w-5 h-5" />
              <span>ابدأ التحدي!</span>
            </button>
          </div>
        )}

        {/* PHASE 2: ACTIVE */}
        {phase === 'ACTIVE' && activePlayer && (
          <div className="flex-1 flex flex-col items-center py-2">
            <ActiveTurnBanner
              label="الدور على:"
              player={activePlayer}
              badgeText={`باقي ${survivors.length} من ${turnOrder.length}`}
              accent={isUrgent || turnTimedOut ? 'rose' : 'coral'}
            />

            {/* Club Display Card */}
            <div className="w-full max-w-md rounded-3xl qada-card p-5 mb-4 text-center relative overflow-hidden">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8]">
                  {currentClub.region}
                </span>
                <button
                  type="button"
                  onClick={handleSwapClub}
                  className="min-h-[34px] px-3 rounded-xl qada-glass-pill text-xs font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>تغيير النادي</span>
                </button>
              </div>

              {/* Jersey Emblem */}
              <div
                className="w-20 h-20 mx-auto mb-3 rounded-2xl border-4 flex items-center justify-center shadow-md"
                style={{
                  backgroundColor: currentClub.primaryHex,
                  borderColor: currentClub.accentHex,
                }}
              >
                <Shield
                  className="w-10 h-10"
                  style={{
                    color:
                      currentClub.primaryHex === '#F8FAFC' ||
                      currentClub.primaryHex === '#FACC15' ||
                      currentClub.primaryHex === '#EAB308'
                        ? '#1E293B'
                        : '#FFFFFF',
                  }}
                />
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-[#1E293B] dark:text-white mb-4">
                {currentClub.name}
              </h2>

              {/* Visual Countdown */}
              <div className="rounded-2xl bg-[#FFF9F0]/90 dark:bg-[#0F172A]/90 border-2 border-[#E7DEC8] dark:border-[#334155] p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                    <Clock
                      className={`w-4 h-4 ${
                        isUrgent || turnTimedOut ? 'text-[#E11D48]' : 'text-[#10B981]'
                      }`}
                    />
                    <span>{turnTimedOut ? 'انتهى الوقت!' : 'الوقت المتبقي'}</span>
                  </span>
                  <span
                    className={`text-2xl font-black tabular-nums ${
                      turnTimedOut || isUrgent
                        ? 'text-[#E11D48] dark:text-rose-400 animate-pulse'
                        : 'text-[#059669] dark:text-emerald-400'
                    }`}
                  >
                    {secondsLeft} ث
                  </span>
                </div>

                <div className="w-full h-3 rounded-full bg-[#EAE0D0] dark:bg-[#1E293B] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${
                      turnTimedOut || isUrgent
                        ? 'bg-[#E11D48]'
                        : secondsLeft <= 5
                          ? 'bg-[#F59E0B]'
                          : 'bg-[#10B981]'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full max-w-md grid grid-cols-1 gap-3 mb-4">
              <button
                type="button"
                onClick={handleTurnSuccess}
                className="w-full min-h-[58px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
              >
                <Check className="w-6 h-6" />
                <span>تم! (اللاعب اللي بعده)</span>
              </button>

              <button
                type="button"
                onClick={handleTurnFail}
                className={`w-full min-h-[54px] rounded-2xl bakasa-btn-red text-white text-lg font-black flex items-center justify-center gap-2 transition-transform ${
                  turnTimedOut ? 'animate-pulse ring-4 ring-rose-300' : ''
                }`}
              >
                <XCircle className="w-5 h-5" />
                <span>{turnTimedOut ? 'خلص الوقت — استبعاد اللاعب' : 'غلط / متأخر — استبعاد'}</span>
              </button>
            </div>

            {/* Players Alive Status */}
            <div className="w-full max-w-md flex flex-wrap items-center justify-center gap-2">
              {turnOrder.map((p) => {
                const isOut = eliminatedIds.has(p.id);
                const isCurrent = p.id === activePlayer.id;
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl px-3 py-1.5 text-xs font-black border tabular-nums transition-all ${
                      isOut
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-500 line-through opacity-60'
                        : isCurrent
                          ? 'bg-[#FFF5F2] dark:bg-amber-950/50 border-[#FF6B4A] text-[#D94E30] dark:text-[#FF8C73] scale-105'
                          : 'bg-white/80 dark:bg-[#1E293B]/80 border-[#E7DEC8] dark:border-[#334155] text-[#1E293B] dark:text-[#F8FAFC]'
                    }`}
                  >
                    {p.name} ({passCounts[p.id] ?? 0})
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE 3: ROUND RESULT */}
        {phase === 'ROUND_RESULT' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6 animate-reveal-3s">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#FFFBEB] dark:bg-amber-950/50 border-2 border-[#FDE68A] dark:border-amber-700 flex items-center justify-center text-[#D97706]">
                <Trophy className="w-9 h-9" />
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-1">
                {winnerPlayer ? `بطل الجولة: ${winnerPlayer.name}!` : 'انتهت الجولة!'}
              </h2>
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] mb-5">
                النادي: {currentClub.name} · +١٠٠ نقطة للصمود الأخير و+١٥ لكل إجابة صح!
              </p>

              <div className="flex flex-col gap-2 text-right">
                {players.map((p) => {
                  const delta = roundDeltas.find((d) => d.playerId === p.id)?.delta ?? 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl bg-[#FFF9F0]/90 dark:bg-[#0F172A]/90 border border-[#EAE0D0] dark:border-[#334155] px-3.5 py-2 text-sm font-bold"
                    >
                      <span className="text-[#1E293B] dark:text-white truncate">{p.name}</span>
                      <span className="text-[#059669] dark:text-emerald-400 font-black tabular-nums">
                        +{delta} نقطة
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

        {/* PHASE 4: LEADERBOARD */}
        {phase === 'LEADERBOARD' && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline={
              winnerPlayer
                ? `صاحب النفس الطويل في ${currentClub.name}: ${winnerPlayer.name}`
                : `تحدي ${currentClub.name}`
            }
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
        title="هل أنت متأكد من الخروج؟"
        message="الجولة شغالة دلوقتي، لو خرجت هيتلغي تقدم الجولة الحالية."
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitToHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
