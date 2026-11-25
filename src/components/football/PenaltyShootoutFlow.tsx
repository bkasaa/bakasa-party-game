import React, { useEffect, useRef, useState } from 'react';
import { Goal, Shield, Sparkles, Trophy, Users } from 'lucide-react';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { Player, RoundDelta } from '../../types/game';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { ActiveTurnBanner } from '../ActiveTurnBanner';
import { ConfirmModal } from '../ConfirmModal';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { PlayerAvatar } from '../PlayerAvatar';
import { TopBar } from '../TopBar';

interface PenaltyShootoutFlowProps {
  players: Player[];
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
}

type Zone = 'left' | 'center' | 'right';
type PenaltyPhase = 'READY' | 'KICKER_AIM' | 'KEEPER_DIVE' | 'ANIMATING' | 'MATCH_RESULT' | 'LEADERBOARD';

const ROUND_OPTIONS = [3, 5, 7, 10] as const;

const ZONE_X: Record<Zone, number> = {
  left: 78,
  center: 180,
  right: 282,
};

const ZONE_LABEL: Record<Zone, string> = {
  left: 'شمال',
  center: 'في النص',
  right: 'يمين',
};

export const PenaltyShootoutFlow: React.FC<PenaltyShootoutFlowProps> = ({
  players,
  onApplyDeltas,
  onExitToHub,
  onTournamentFinish,
}) => {
  const guard = useTapGuard(300);

  const [phase, setPhase] = useState<PenaltyPhase>('READY');
  const [totalRounds, setTotalRounds] = useState<number>(5);
  const [playerAId, setPlayerAId] = useState<string>(players[0]?.id ?? '');
  const [playerBId, setPlayerBId] = useState<string>(players[1]?.id ?? players[0]?.id ?? '');

  // Round & turn tracking: each round has half 0 (A kicks vs B keeps) and half 1 (B kicks vs A keeps)
  const [roundNum, setRoundNum] = useState<number>(1);
  const [halfIdx, setHalfIdx] = useState<0 | 1>(0);
  const [historyA, setHistoryA] = useState<boolean[]>([]);
  const [historyB, setHistoryB] = useState<boolean[]>([]);

  const [kickerChoice, setKickerChoice] = useState<Zone>('center');
  const [keeperChoice, setKeeperChoice] = useState<Zone>('center');
  const [animLaunched, setAnimLaunched] = useState<boolean>(false);
  const [animResultVisible, setAnimResultVisible] = useState<boolean>(false);
  const [lastKickIsGoal, setLastKickIsGoal] = useState<boolean>(false);

  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const animTimersRef = useRef<number[]>([]);

  const clearAnimTimers = () => {
    animTimersRef.current.forEach((id) => window.clearTimeout(id));
    animTimersRef.current = [];
  };

  useEffect(() => {
    return () => clearAnimTimers();
  }, []);

  const playerA = players.find((p) => p.id === playerAId) ?? players[0];
  const playerB =
    players.find((p) => p.id === playerBId && p.id !== playerA?.id) ??
    players.find((p) => p.id !== playerA?.id) ??
    players[0];

  const kicker = halfIdx === 0 ? playerA : playerB;
  const keeper = halfIdx === 0 ? playerB : playerA;

  const scoreA = historyA.filter(Boolean).length;
  const scoreB = historyB.filter(Boolean).length;

  const isMatchInProgress =
    phase === 'KICKER_AIM' ||
    phase === 'KEEPER_DIVE' ||
    phase === 'ANIMATING' ||
    phase === 'MATCH_RESULT';

  useNavigationGuard(isMatchInProgress, () => {
    setShowExitConfirm(true);
  });

  const startMatch = guard(() => {
    if (!playerA || !playerB || playerA.id === playerB.id) {
      soundManager.play('error');
      return;
    }
    soundManager.unlock();
    soundManager.play('next');
    clearAnimTimers();

    setRoundNum(1);
    setHalfIdx(0);
    setHistoryA([]);
    setHistoryB([]);
    setRoundDeltas([]);
    setWinnerId(null);
    setPhase('KICKER_AIM');
  });

  const handleKickerPick = guard((zone: Zone) => {
    soundManager.play('click');
    triggerHaptic(15);
    setKickerChoice(zone);
    setPhase('KEEPER_DIVE');
  });

  const handleKeeperPick = guard((diveZone: Zone) => {
    soundManager.play('click');
    triggerHaptic(18);

    const isGoal = kickerChoice !== diveZone;
    setKeeperChoice(diveZone);
    setLastKickIsGoal(isGoal);
    setAnimLaunched(false);
    setAnimResultVisible(false);
    setPhase('ANIMATING');

    clearAnimTimers();

    // Launch ball & keeper animation cleanly on next frame
    const launchTimer = window.setTimeout(() => {
      setAnimLaunched(true);
    }, 60);

    // Reveal Goal / Save outcome mid-animation (~950ms)
    const impactTimer = window.setTimeout(() => {
      setAnimResultVisible(true);
      if (isGoal) {
        soundManager.play('goal');
        triggerHaptic([40, 25, 65]);
      } else {
        soundManager.play('bounce');
        triggerHaptic([65, 30, 35]);
      }
    }, 920);

    // Finish 2-second animation & advance round
    const doneTimer = window.setTimeout(() => {
      const nextHistoryA = halfIdx === 0 ? [...historyA, isGoal] : historyA;
      const nextHistoryB = halfIdx === 1 ? [...historyB, isGoal] : historyB;
      setHistoryA(nextHistoryA);
      setHistoryB(nextHistoryB);

      const nextScoreA = nextHistoryA.filter(Boolean).length;
      const nextScoreB = nextHistoryB.filter(Boolean).length;

      // Check early mathematical clinch during regular rounds or sudden death resolution
      const kicksLeftA = Math.max(0, totalRounds - nextHistoryA.length);
      const kicksLeftB = Math.max(0, totalRounds - nextHistoryB.length);
      const isInRegularRounds = roundNum <= totalRounds;

      let matchEnded = false;
      let resolvedWinnerId: string | null = null;

      if (isInRegularRounds) {
        if (nextScoreA > nextScoreB + kicksLeftB) {
          matchEnded = true;
          resolvedWinnerId = playerA.id;
        } else if (nextScoreB > nextScoreA + kicksLeftA) {
          matchEnded = true;
          resolvedWinnerId = playerB.id;
        } else if (halfIdx === 1 && roundNum === totalRounds && nextScoreA !== nextScoreB) {
          matchEnded = true;
          resolvedWinnerId = nextScoreA > nextScoreB ? playerA.id : playerB.id;
        }
      } else {
        // Sudden death: resolve after both players kicked in the sudden-death round
        if (halfIdx === 1 && nextScoreA !== nextScoreB) {
          matchEnded = true;
          resolvedWinnerId = nextScoreA > nextScoreB ? playerA.id : playerB.id;
        }
      }

      if (matchEnded && resolvedWinnerId) {
        const deltas: RoundDelta[] = players.map((p) => ({
          playerId: p.id,
          delta: p.id === resolvedWinnerId ? 100 : 0,
        }));
        setWinnerId(resolvedWinnerId);
        setRoundDeltas(deltas);
        onApplyDeltas(deltas);
        soundManager.play('victory');
        setPhase('MATCH_RESULT');
        return;
      }

      if (halfIdx === 0) {
        setHalfIdx(1);
      } else {
        setHalfIdx(0);
        setRoundNum((prev) => prev + 1);
      }
      setPhase('KICKER_AIM');
    }, 2050);

    animTimersRef.current = [launchTimer, impactTimer, doneTimer];
  });

  const handleHeaderExit = () => {
    if (isMatchInProgress) {
      setShowExitConfirm(true);
    } else {
      clearAnimTimers();
      onExitToHub();
    }
  };

  const renderDotTrack = (history: boolean[]) => {
    const slots = Math.max(totalRounds, history.length);
    const dotSize = slots >= 7 ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {Array.from({ length: slots }).map((_, idx) => {
          const entry = history[idx];
          if (entry === undefined) {
            return (
              <span
                key={idx}
                className={`${dotSize} rounded-full bg-[#E2E8F0] dark:bg-[#334155] border border-[#CBD5E1] dark:border-[#475569]`}
              />
            );
          }
          return (
            <span
              key={idx}
              className={`${dotSize} rounded-full border ${
                entry
                  ? 'bg-[#10B981] border-[#059669]'
                  : 'bg-[#F43F5E] border-[#BE123C]'
              }`}
            />
          );
        })}
      </div>
    );
  };

  const winnerPlayer = players.find((p) => p.id === winnerId) ?? null;
  const ballTargetX = ZONE_X[kickerChoice];
  const ballFinalX = animResultVisible && !lastKickIsGoal ? ballTargetX + (kickerChoice === 'right' ? 28 : -28) : ballTargetX;
  const ballFinalY = animResultVisible && !lastKickIsGoal ? 132 : 76;
  const keeperTargetX = ZONE_X[keeperChoice];
  const keeperTilt = keeperChoice === 'left' ? -34 : keeperChoice === 'right' ? 34 : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title={phase === 'LEADERBOARD' ? 'النتيجة' : 'ضربات الجزاء ⚽'}
        exitVariant={isMatchInProgress ? 'home' : 'back'}
        onExit={handleHeaderExit}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* PHASE 1: READY & PLAYER MATCHUP */}
        {phase === 'READY' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-5 mb-5">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-950/50 border-2 border-[#A7F3D0] dark:border-emerald-700 flex items-center justify-center text-[#059669] dark:text-emerald-400">
                <Goal className="w-9 h-9" />
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-1.5">
                مواجهة ضربات الجزاء ({totalRounds} جولات)
              </h2>
              <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed mb-4">
                اللاعب اللي بيشوط بيختار الزاوية سرّي (يمين / نص / شمال)، وبعدين الحارس يختار
                هيرمي فين! الفائز في الـ {totalRounds} جولات يكسب +١٠٠ نقطة.
              </p>

              {/* Customizable Rounds Selector */}
              <div className="mb-4 rounded-2xl bg-[#FFF9F0]/90 dark:bg-[#0F172A]/90 border border-[#E7DEC8] dark:border-[#334155] p-3 text-right">
                <div className="text-xs font-black text-[#1E293B] dark:text-[#F8FAFC] mb-2">
                  عدد الجولات:
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {ROUND_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setTotalRounds(r);
                      }}
                      className={`min-h-[38px] rounded-xl text-xs font-black tabular-nums border transition-all ${
                        totalRounds === r
                          ? 'qada-btn-pitch text-white border-transparent'
                          : 'bg-white dark:bg-[#1E293B] border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                      }`}
                    >
                      {r} جولات
                    </button>
                  ))}
                </div>
              </div>

              {/* Select Player A & Player B */}
              <div className="flex flex-col gap-3 text-right">
                <div className="rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] p-3">
                  <div className="text-xs font-black text-[#D94E30] dark:text-[#FF8C73] mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>اللاعب الأول:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {players.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          soundManager.play('click');
                          setPlayerAId(p.id);
                          if (p.id === playerB?.id) {
                            const fallback = players.find((other) => other.id !== p.id);
                            if (fallback) setPlayerBId(fallback.id);
                          }
                        }}
                        className={`min-h-[36px] px-3 rounded-xl text-xs font-black border transition-colors ${
                          playerA?.id === p.id
                            ? 'bg-[#FF6B4A] text-white border-[#D94E30]'
                            : 'bg-white dark:bg-[#1E293B] border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] p-3">
                  <div className="text-xs font-black text-[#0D9488] dark:text-[#2DD4BF] mb-2 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>اللاعب الثاني:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {players
                      .filter((p) => p.id !== playerA?.id)
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            soundManager.play('click');
                            setPlayerBId(p.id);
                          }}
                          className={`min-h-[36px] px-3 rounded-xl text-xs font-black border transition-colors ${
                            playerB?.id === p.id
                              ? 'bg-[#14B8A6] text-white border-[#0D9488]'
                              : 'bg-white dark:bg-[#1E293B] border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={startMatch}
              className="w-full max-w-[270px] min-h-[56px] rounded-2xl qada-btn-pitch text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
            >
              <Sparkles className="w-5 h-5" />
              <span>ابدأ ضربات الجزاء!</span>
            </button>
          </div>
        )}

        {/* SCOREBOARD STRIP DURING MATCH */}
        {(phase === 'KICKER_AIM' || phase === 'KEEPER_DIVE' || phase === 'ANIMATING') &&
          playerA &&
          playerB && (
            <div className="w-full max-w-md mx-auto rounded-2xl qada-card px-3.5 py-2.5 mb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-black text-[#059669] dark:text-emerald-400">
                  {roundNum > totalRounds
                    ? 'ركلات الترجيح الفاصلة! 🔥'
                    : `الجولة ${roundNum} من ${totalRounds}`}
                </span>
                <span className="text-sm font-black text-[#1E293B] dark:text-white tabular-nums">
                  {scoreA} - {scoreB}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col gap-1 items-start">
                  <div className="flex items-center gap-1.5 font-black text-[#1E293B] dark:text-white truncate max-w-full">
                    <PlayerAvatar avatarId={playerA.avatarId} name={playerA.name} size="sm" />
                    <span className="truncate">{playerA.name}</span>
                  </div>
                  {renderDotTrack(historyA)}
                </div>

                <div className="flex flex-col gap-1 items-end">
                  <div className="flex items-center gap-1.5 font-black text-[#1E293B] dark:text-white truncate max-w-full">
                    <span className="truncate">{playerB.name}</span>
                    <PlayerAvatar avatarId={playerB.avatarId} name={playerB.name} size="sm" />
                  </div>
                  {renderDotTrack(historyB)}
                </div>
              </div>
            </div>
          )}

        {/* PHASE 2: KICKER SECRET AIM */}
        {phase === 'KICKER_AIM' && kicker && keeper && (
          <div className="flex-1 flex flex-col items-center py-1">
            <ActiveTurnBanner
              label="المسدد دلوقتي:"
              player={kicker}
              badgeText={`الحارس: ${keeper.name}`}
              accent="coral"
            />

            <div className="w-full max-w-md rounded-3xl qada-card p-5 text-center">
              <h2 className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white mb-1">
                {kicker.name} — اختار زاوية الشوتة (سرّي!)
              </h2>
              <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8] mb-4">
                متخليش {keeper.name} يشوف صباعك وانت بتختار
              </p>

              {/* Spatial Goal Target Picker (LTR so Left=شمال, Center=نص, Right=يمين) */}
              <div
                dir="ltr"
                className="relative rounded-2xl bg-gradient-to-b from-[#0F5132] to-[#15803D] border-4 border-white/85 p-4 pt-6 shadow-inner"
              >
                <div className="grid grid-cols-3 gap-2.5">
                  {(['left', 'center', 'right'] as Zone[]).map((zone) => (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => handleKickerPick(zone)}
                      className="min-h-[120px] rounded-2xl bg-white/15 hover:bg-white/25 active:scale-95 border-2 border-dashed border-white/60 text-white font-black text-lg flex flex-col items-center justify-center gap-2 transition-all"
                    >
                      <span className="text-3xl">⚽</span>
                      <span>{ZONE_LABEL[zone]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 3: KEEPER SECRET DIVE */}
        {phase === 'KEEPER_DIVE' && kicker && keeper && (
          <div className="flex-1 flex flex-col items-center py-1">
            <ActiveTurnBanner
              label="حارس المرمى:"
              player={keeper}
              badgeText={`المسدد: ${kicker.name}`}
              accent="teal"
            />

            <div className="w-full max-w-md rounded-3xl qada-card p-5 text-center">
              <h2 className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white mb-1">
                {keeper.name} — هتترمي فين؟ 🧤
              </h2>
              <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8] mb-4">
                توقّع {kicker.name} شاط فين وصد الكورة!
              </p>

              <div
                dir="ltr"
                className="relative rounded-2xl bg-gradient-to-b from-[#0D9488] to-[#0F766E] border-4 border-white/85 p-4 pt-6 shadow-inner"
              >
                <div className="grid grid-cols-3 gap-2.5">
                  {(['left', 'center', 'right'] as Zone[]).map((zone) => (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => handleKeeperPick(zone)}
                      className="min-h-[120px] rounded-2xl bg-white/15 hover:bg-white/25 active:scale-95 border-2 border-dashed border-white/60 text-white font-black text-lg flex flex-col items-center justify-center gap-2 transition-all"
                    >
                      <span className="text-3xl">🧤</span>
                      <span>{ZONE_LABEL[zone]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 4: 2-SECOND ANIMATED PITCH SHOOTOUT */}
        {phase === 'ANIMATING' && kicker && keeper && (
          <div className="flex-1 flex flex-col items-center py-1">
            <div className="w-full max-w-md rounded-3xl qada-card p-4 relative overflow-hidden">
              <div className="text-center text-sm font-black text-[#1E293B] dark:text-white mb-2">
                {kicker.name} ⚽ ضد {keeper.name} 🧤
              </div>

              <div className="relative rounded-2xl overflow-hidden border-2 border-white/40 bg-[#14532D]">
                <svg viewBox="0 0 360 230" className="w-full h-auto block">
                  {/* Stadium Crowd Top Strip */}
                  <rect x="0" y="0" width="360" height="44" fill="#0F172A" />
                  <rect x="0" y="42" width="360" height="6" fill="#F59E0B" />

                  {/* Lush Striped Grass */}
                  <rect x="0" y="48" width="360" height="182" fill="#15803D" />
                  <rect x="0" y="48" width="360" height="30" fill="#16A34A" opacity="0.5" />
                  <rect x="0" y="108" width="360" height="30" fill="#16A34A" opacity="0.5" />
                  <rect x="0" y="168" width="360" height="30" fill="#16A34A" opacity="0.5" />

                  {/* Penalty Box Lines */}
                  <rect
                    x="36"
                    y="120"
                    width="288"
                    height="96"
                    fill="none"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="2.5"
                  />
                  <circle cx="180" cy="196" r="4" fill="#FFFFFF" />

                  {/* Goal Net Backdrop */}
                  <g
                    style={{
                      transform:
                        animResultVisible && lastKickIsGoal ? 'scale(1.03)' : 'scale(1)',
                      transformOrigin: '180px 80px',
                      transition: 'transform 220ms ease-out',
                    }}
                  >
                    <rect
                      x="46"
                      y="32"
                      width="268"
                      height="90"
                      fill="rgba(255,255,255,0.12)"
                      stroke="#FFFFFF"
                      strokeWidth="5"
                      rx="4"
                    />
                    {/* Net Grid */}
                    {[76, 106, 136, 166, 196, 226, 256, 286].map((nx) => (
                      <line
                        key={nx}
                        x1={nx}
                        y1="34"
                        x2={nx}
                        y2="120"
                        stroke="rgba(255,255,255,0.28)"
                        strokeWidth="1.2"
                      />
                    ))}
                    {[52, 72, 92, 110].map((ny) => (
                      <line
                        key={ny}
                        x1="48"
                        y1={ny}
                        x2="312"
                        y2={ny}
                        stroke="rgba(255,255,255,0.28)"
                        strokeWidth="1.2"
                      />
                    ))}
                  </g>

                  {/* Animated Goalkeeper */}
                  <g
                    style={{
                      transform: animLaunched
                        ? `translate(${keeperTargetX - 180}px, ${keeperChoice === 'center' ? -8 : 4}px) rotate(${keeperTilt}deg)`
                        : 'translate(0px, 0px) rotate(0deg)',
                      transformOrigin: '180px 104px',
                      transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    {/* Keeper Jersey */}
                    <rect x="166" y="88" width="28" height="32" rx="8" fill="#F59E0B" stroke="#0F172A" strokeWidth="2" />
                    {/* Keeper Head */}
                    <circle cx="180" cy="76" r="10" fill="#FDE68A" stroke="#0F172A" strokeWidth="2" />
                    {/* Keeper Gloves Outstretched */}
                    <line x1="166" y1="96" x2="146" y2="86" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
                    <line x1="194" y1="96" x2="214" y2="86" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
                    <circle cx="144" cy="84" r="7" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
                    <circle cx="216" cy="84" r="7" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
                  </g>

                  {/* Animated Soccer Ball */}
                  <g
                    style={{
                      transform: animLaunched
                        ? `translate(${ballFinalX - 180}px, ${ballFinalY - 196}px) scale(0.72) rotate(540deg)`
                        : 'translate(0px, 0px) scale(1) rotate(0deg)',
                      transformOrigin: '180px 196px',
                      transition: animResultVisible && !lastKickIsGoal
                        ? 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)'
                        : 'transform 760ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <circle cx="180" cy="196" r="14" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
                    <polygon points="180,189 186,193 184,201 176,201 174,193" fill="#0F172A" />
                  </g>
                </svg>

                {/* Outcome Overlay Banner */}
                {animResultVisible && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                    <div
                      className={`animate-goal-pop rounded-2xl px-6 py-3 border-2 border-white shadow-2xl text-white text-2xl sm:text-3xl font-black ${
                        lastKickIsGoal ? 'bg-[#10B981]' : 'bg-[#E11D48]'
                      }`}
                    >
                      {lastKickIsGoal ? 'جووول! ⚽🔥' : 'صدّها الحارس! 🧤'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PHASE 5: MATCH RESULT */}
        {phase === 'MATCH_RESULT' && playerA && playerB && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6 animate-reveal-3s">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#FFFBEB] dark:bg-amber-950/50 border-2 border-[#FDE68A] dark:border-amber-700 flex items-center justify-center text-[#D97706]">
                <Trophy className="w-9 h-9" />
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-1">
                {winnerPlayer ? `بطل ضربات الجزاء: ${winnerPlayer.name}! 🏆` : 'انتهت المواجهة!'}
              </h2>
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] mb-5 tabular-nums">
                النتيجة النهائية: {playerA.name} ({scoreA}) - ({scoreB}) {playerB.name}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] p-3 flex flex-col items-center gap-1.5">
                  <PlayerAvatar avatarId={playerA.avatarId} name={playerA.name} size="md" />
                  <span className="text-sm font-black text-[#1E293B] dark:text-white">
                    {playerA.name}
                  </span>
                  <span className="text-xl font-black text-[#059669] dark:text-emerald-400 tabular-nums">
                    {scoreA} أهداف
                  </span>
                </div>

                <div className="rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] p-3 flex flex-col items-center gap-1.5">
                  <PlayerAvatar avatarId={playerB.avatarId} name={playerB.name} size="md" />
                  <span className="text-sm font-black text-[#1E293B] dark:text-white">
                    {playerB.name}
                  </span>
                  <span className="text-xl font-black text-[#059669] dark:text-emerald-400 tabular-nums">
                    {scoreB} أهداف
                  </span>
                </div>
              </div>

              {winnerPlayer && (
                <div className="text-xs font-black text-[#059669] dark:text-emerald-400">
                  {winnerPlayer.name} كسب +١٠٠ نقطة!
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={guard(() => {
                soundManager.play('next');
                setPhase('LEADERBOARD');
              })}
              className="w-full max-w-[260px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black transition-transform"
            >
              عرض الترتيب العام
            </button>
          </div>
        )}

        {/* PHASE 6: LEADERBOARD */}
        {phase === 'LEADERBOARD' && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline={
              winnerPlayer
                ? `فوز ${winnerPlayer.name} بضربات الجزاء (${scoreA} - ${scoreB}) ⚽`
                : 'مواجهة ضربات الجزاء ⚽'
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
        message="مباراة ضربات الجزاء لسه شغالة، لو خرجت دلوقتي النتيجة هتتلغي."
        onConfirm={() => {
          clearAnimTimers();
          setShowExitConfirm(false);
          onExitToHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
