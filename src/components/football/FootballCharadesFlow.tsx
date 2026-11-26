import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  Check,
  Clock,
  Mic,
  Shuffle,
  SkipForward,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import {
  FOOTBALL_CHARADES_CARDS,
  FootballCharadesCard,
  FootballGlobalSettings,
  filterByScope,
} from '../../data/footballData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { Player, RoundDelta } from '../../types/game';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { getCustomContent } from '../../utils/customContentStorage';
import { pickUnseenItem } from '../../utils/usedItemsMemory';
import { ActiveTurnBanner } from '../ActiveTurnBanner';
import { ConfirmModal } from '../ConfirmModal';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { PlayerAvatar } from '../PlayerAvatar';
import { TopBar } from '../TopBar';
import { FootballSettingsBar } from './FootballSettingsBar';

interface FootballCharadesFlowProps {
  players: Player[];
  initialSettings: FootballGlobalSettings;
  onUpdateSettings: (next: FootballGlobalSettings) => void;
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
}

type CharadesPhase = 'READY' | 'PASS_PAIR' | 'ACTIVE_TURN' | 'TURN_RESULT' | 'LEADERBOARD';
type TeamId = 'red' | 'blue';

interface CharadesTurn {
  describer: Player;
  team: TeamId;
}

export const FootballCharadesFlow: React.FC<FootballCharadesFlowProps> = ({
  players,
  initialSettings,
  onUpdateSettings,
  onApplyDeltas,
  onExitToHub,
  onTournamentFinish,
}) => {
  const guard = useTapGuard(350);

  const [phase, setPhase] = useState<CharadesPhase>('READY');
  const [settings, setSettings] = useState<FootballGlobalSettings>(() => ({
    ...initialSettings,
    turnSeconds: [30, 45, 60, 90].includes(initialSettings.turnSeconds)
      ? initialSettings.turnSeconds
      : 45,
  }));

  // Manual or random team split (red vs blue)
  const [teamMap, setTeamMap] = useState<Record<string, TeamId>>(() => {
    const map: Record<string, TeamId> = {};
    players.forEach((p, idx) => {
      map[p.id] = idx % 2 === 0 ? 'red' : 'blue';
    });
    return map;
  });

  // Sync teamMap if player list changes while in READY
  useEffect(() => {
    setTeamMap((prev) => {
      const next: Record<string, TeamId> = {};
      players.forEach((p, idx) => {
        next[p.id] = prev[p.id] ?? (idx % 2 === 0 ? 'red' : 'blue');
      });
      return next;
    });
  }, [players]);

  const [turnOrder, setTurnOrder] = useState<CharadesTurn[]>([]);
  const [turnIdx, setTurnIdx] = useState<number>(0);
  const [partnerId, setPartnerId] = useState<string>('');
  const [currentCard, setCurrentCard] = useState<FootballCharadesCard>(FOOTBALL_CHARADES_CARDS[0]);
  const [turnCorrectWords, setTurnCorrectWords] = useState<string[]>([]);
  const [turnSkippedCount, setTurnSkippedCount] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(settings.turnSeconds);
  const [msLeft, setMsLeft] = useState<number>(settings.turnSeconds * 1000);
  const [teamScores, setTeamScores] = useState<Record<TeamId, number>>({ red: 0, blue: 0 });
  const [earnedByPlayer, setEarnedByPlayer] = useState<Record<string, number>>({});
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const deadlineRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(settings.turnSeconds);

  const scopedCards = useMemo(() => {
    const base = filterByScope(FOOTBALL_CHARADES_CARDS, settings.scope);
    const custom = getCustomContent();
    if (custom.footballNames.length === 0) return base;
    const customCards: FootballCharadesCard[] = custom.footballNames.map((name) => ({
      word: name,
      kind: 'لاعب',
      scope: 'local',
      forbidden: [],
    }));
    if (custom.mode === 'custom_only') return customCards;
    return [...customCards, ...base];
  }, [settings.scope]);

  const redPlayers = useMemo(
    () => players.filter((p) => (teamMap[p.id] ?? 'red') === 'red'),
    [players, teamMap]
  );
  const bluePlayers = useMemo(
    () => players.filter((p) => (teamMap[p.id] ?? 'red') === 'blue'),
    [players, teamMap]
  );

  const isRoundInProgress =
    phase === 'PASS_PAIR' || phase === 'ACTIVE_TURN' || phase === 'TURN_RESULT';

  useNavigationGuard(isRoundInProgress, () => {
    setShowExitConfirm(true);
  });

  const drawNextCard = (): FootballCharadesCard => {
    const words = scopedCards.map((c) => c.word);
    const chosenWord = pickUnseenItem(`fb_charades:${settings.scope}`, words);
    return scopedCards.find((c) => c.word === chosenWord) ?? scopedCards[0];
  };

  const currentTurn = turnOrder[turnIdx];
  const describer = currentTurn?.describer ?? players[0];
  const activeTeam = currentTurn?.team ?? 'red';
  const sameTeamGuessers = useMemo(
    () =>
      players.filter(
        (p) => p.id !== describer?.id && (teamMap[p.id] ?? 'red') === activeTeam
      ),
    [players, describer?.id, teamMap, activeTeam]
  );
  const fallbackGuessers = useMemo(
    () => players.filter((p) => p.id !== describer?.id),
    [players, describer?.id]
  );
  const availableGuessers = sameTeamGuessers.length > 0 ? sameTeamGuessers : fallbackGuessers;

  const partner =
    availableGuessers.find((p) => p.id === partnerId) ??
    availableGuessers[0] ??
    describer;

  // Sync default teammate guesser whenever turn changes
  useEffect(() => {
    if (phase === 'PASS_PAIR' && availableGuessers.length > 0) {
      setPartnerId((prev) =>
        availableGuessers.some((p) => p.id === prev) ? prev : availableGuessers[0].id
      );
    }
  }, [turnIdx, phase, availableGuessers]);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'ACTIVE_TURN') return;

    const timer = window.setInterval(() => {
      const remaining = Math.max(0, deadlineRef.current - Date.now());
      const sec = Math.ceil(remaining / 1000);
      setMsLeft(remaining);
      setSecondsLeft(sec);

      if (sec !== lastTickSecRef.current && sec > 0) {
        lastTickSecRef.current = sec;
        if (sec <= 5) {
          soundManager.play('tickUrgent');
          triggerHaptic(20);
        } else if (sec <= 10) {
          soundManager.play('tick');
        }
      }

      if (remaining <= 0) {
        soundManager.play('victory');
        triggerHaptic([45, 35, 65]);
        setPhase('TURN_RESULT');
      }
    }, 80);

    return () => window.clearInterval(timer);
  }, [phase]);

  const handleTogglePlayerTeam = (playerId: string) => {
    soundManager.play('click');
    setTeamMap((prev) => {
      const current = prev[playerId] ?? 'red';
      const target: TeamId = current === 'red' ? 'blue' : 'red';
      const currentCount = players.filter((p) => (prev[p.id] ?? 'red') === current).length;
      if (currentCount <= 1) {
        // Must keep at least 1 player per team: swap with first player from other team
        const swapTarget = players.find((p) => (prev[p.id] ?? 'red') === target);
        if (!swapTarget) return prev;
        return { ...prev, [playerId]: target, [swapTarget.id]: current };
      }
      return { ...prev, [playerId]: target };
    });
  };

  const handleRandomizeTeams = () => {
    soundManager.play('next');
    triggerHaptic(18);
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const next: Record<string, TeamId> = {};
    shuffled.forEach((p, idx) => {
      next[p.id] = idx % 2 === 0 ? 'red' : 'blue';
    });
    setTeamMap(next);
  };

  const startGame = guard(() => {
    soundManager.unlock();
    soundManager.play('next');

    // Alternate Red & Blue turns cleanly so every player gets to describe
    const queue: CharadesTurn[] = [];
    const maxLen = Math.max(redPlayers.length, bluePlayers.length);
    for (let i = 0; i < maxLen; i++) {
      if (redPlayers[i]) queue.push({ describer: redPlayers[i], team: 'red' });
      if (bluePlayers[i]) queue.push({ describer: bluePlayers[i], team: 'blue' });
    }

    const initEarned: Record<string, number> = {};
    players.forEach((p) => {
      initEarned[p.id] = 0;
    });

    setTurnOrder(queue);
    setTurnIdx(0);
    setTeamScores({ red: 0, blue: 0 });
    setEarnedByPlayer(initEarned);
    setRoundDeltas([]);
    setTurnCorrectWords([]);
    setTurnSkippedCount(0);
    setPhase('PASS_PAIR');
  });

  const startTurnTimer = guard(() => {
    soundManager.play('reveal');
    setTurnCorrectWords([]);
    setTurnSkippedCount(0);
    setCurrentCard(drawNextCard());
    deadlineRef.current = Date.now() + settings.turnSeconds * 1000;
    lastTickSecRef.current = settings.turnSeconds;
    setSecondsLeft(settings.turnSeconds);
    setMsLeft(settings.turnSeconds * 1000);
    setPhase('ACTIVE_TURN');
  });

  const handleCorrectCard = () => {
    soundManager.play('catch');
    triggerHaptic(22);
    setTurnCorrectWords((prev) => [...prev, currentCard.word]);
    setCurrentCard(drawNextCard());
  };

  const handleSkipCard = () => {
    soundManager.play('click');
    setTurnSkippedCount((prev) => prev + 1);
    setCurrentCard(drawNextCard());
  };

  const handleFinishTurn = guard(() => {
    const pointsEach = turnCorrectWords.length * 25;
    const updatedEarned = { ...earnedByPlayer };
    if (describer) {
      updatedEarned[describer.id] = (updatedEarned[describer.id] ?? 0) + pointsEach;
    }
    if (partner && partner.id !== describer?.id) {
      updatedEarned[partner.id] = (updatedEarned[partner.id] ?? 0) + pointsEach;
    }
    setEarnedByPlayer(updatedEarned);

    const nextTeamScores: Record<TeamId, number> = {
      ...teamScores,
      [activeTeam]: teamScores[activeTeam] + turnCorrectWords.length,
    };
    setTeamScores(nextTeamScores);

    if (turnIdx + 1 < turnOrder.length) {
      soundManager.play('next');
      setTurnIdx((prev) => prev + 1);
      setPhase('PASS_PAIR');
      return;
    }

    // Team win bonus (+40) if one team beat the other
    const winningTeam: TeamId | null =
      nextTeamScores.red > nextTeamScores.blue
        ? 'red'
        : nextTeamScores.blue > nextTeamScores.red
          ? 'blue'
          : null;

    const deltas: RoundDelta[] = players.map((p) => {
      const bonus = winningTeam && (teamMap[p.id] ?? 'red') === winningTeam ? 40 : 0;
      return {
        playerId: p.id,
        delta: (updatedEarned[p.id] ?? 0) + bonus,
      };
    });
    setRoundDeltas(deltas);
    onApplyDeltas(deltas);
    soundManager.play('victory');
    setPhase('LEADERBOARD');
  });

  const handleHeaderExit = () => {
    if (isRoundInProgress) {
      setShowExitConfirm(true);
    } else {
      onExitToHub();
    }
  };

  const turnDuration = settings.turnSeconds;
  const progressPct = Math.max(0, Math.min(100, (msLeft / (turnDuration * 1000)) * 100));
  const isUrgent = secondsLeft <= 5;
  const turnPoints = turnCorrectWords.length * 25;
  const teamLabel = activeTeam === 'red' ? 'الفريق الأحمر 🔴' : 'الفريق الأزرق 🔵';

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title={phase === 'LEADERBOARD' ? 'النتيجة' : 'خمن في الكورة 🎙️'}
        exitVariant={isRoundInProgress ? 'exit' : 'back'}
        exitLabel={isRoundInProgress ? 'خروج' : 'رجوع'}
        onExit={handleHeaderExit}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* PHASE 1: READY */}
        {phase === 'READY' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center gap-4">
            <div className="w-full max-w-md rounded-3xl qada-card p-5">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#EFF6FF] dark:bg-blue-950/50 border-2 border-[#BFDBFE] dark:border-blue-800 flex items-center justify-center text-[#2563EB] dark:text-blue-400">
                <Mic className="w-9 h-9" />
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-2">
                خمن في الكورة ({turnDuration} ثانية!)
              </h2>
              <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {scopedCards.length} كارت (لاعبين، مدربين، أندية، وملاعب)! اوصف لفريقك من غير ما
                تقول الكلمات الممنوعة. كل إجابة صح تدي +٢٥ نقطة والفريق الفائز ياخد +٤٠ بونص!
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
                secondsLabel="مدة كل جولة:"
                secondsOptions={[30, 45, 60, 90]}
              />
            </div>

            {/* Manual / Random Team Split */}
            <div className="w-full max-w-md rounded-3xl qada-card p-4 text-right">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#FF6B4A]" />
                  <span>تقسيمة الفرق (اضغط على اللاعب للنقل):</span>
                </span>
                <button
                  type="button"
                  onClick={handleRandomizeTeams}
                  className="min-h-[34px] px-3 rounded-xl qada-glass-pill text-xs font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5"
                >
                  <Shuffle className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>توزيع عشوائي</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-[#FFF1F2]/85 dark:bg-rose-950/40 border border-[#FECDD3] dark:border-rose-800/70 p-2.5">
                  <div className="text-xs font-black text-[#BE123C] dark:text-rose-300 mb-2 flex items-center justify-between">
                    <span>الفريق الأحمر 🔴</span>
                    <span className="tabular-nums">{redPlayers.length}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {redPlayers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleTogglePlayerTeam(p.id)}
                        className="w-full min-h-[36px] rounded-xl bg-white/90 dark:bg-[#1E293B]/90 border border-[#FDA4AF] dark:border-rose-700 px-2.5 py-1 text-xs font-black text-[#1E293B] dark:text-white flex items-center justify-between gap-1 hover:brightness-95 transition-all"
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-[#E11D48] shrink-0">⇄</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#EFF6FF]/85 dark:bg-blue-950/40 border border-[#BFDBFE] dark:border-blue-800/70 p-2.5">
                  <div className="text-xs font-black text-[#1D4ED8] dark:text-blue-300 mb-2 flex items-center justify-between">
                    <span>الفريق الأزرق 🔵</span>
                    <span className="tabular-nums">{bluePlayers.length}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {bluePlayers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleTogglePlayerTeam(p.id)}
                        className="w-full min-h-[36px] rounded-xl bg-white/90 dark:bg-[#1E293B]/90 border border-[#93C5FD] dark:border-blue-700 px-2.5 py-1 text-xs font-black text-[#1E293B] dark:text-white flex items-center justify-between gap-1 hover:brightness-95 transition-all"
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-[#2563EB] shrink-0">⇄</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
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

        {/* PHASE 2: PASS PAIR */}
        {phase === 'PASS_PAIR' && describer && partner && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <ActiveTurnBanner
              label="الواصف:"
              player={describer}
              badgeText={`${teamLabel} · دور ${turnIdx + 1}/${turnOrder.length}`}
              accent={activeTeam === 'red' ? 'rose' : 'teal'}
            />

            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6">
              <div className="inline-flex items-center gap-2 rounded-xl px-3 py-1 text-xs font-black mb-3 bg-[#FFF9F0]/90 dark:bg-[#0F172A]/85 border border-[#E7DEC8] dark:border-[#334155]">
                <span>الأحمر 🔴 {teamScores.red}</span>
                <span>—</span>
                <span>{teamScores.blue} 🔵 الأزرق</span>
              </div>

              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="flex flex-col items-center gap-1">
                  <PlayerAvatar avatarId={describer.avatarId} name={describer.name} size="md" />
                  <span className="text-xs font-black text-[#0D9488] dark:text-[#2DD4BF]">
                    الواصف: {describer.name}
                  </span>
                </div>

                <span className="text-xl font-black text-[#94A3B8]">🤝</span>

                <div className="flex flex-col items-center gap-1">
                  <PlayerAvatar avatarId={partner.avatarId} name={partner.name} size="md" />
                  <span className="text-xs font-black text-[#FF6B4A]">
                    المخمن: {partner.name}
                  </span>
                </div>
              </div>

              <h2 className="text-xl font-black text-[#1E293B] dark:text-white mb-1.5">
                الشاشة لـ {describer.name} لوحده!
              </h2>
              <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8] mb-4">
                تأكد إن {partner.name} والفريق مش شايفين الشاشة قبل ما تضغط ابدأ
              </p>

              {availableGuessers.length > 1 && (
                <div className="pt-3 border-t border-[#F1E8DA] dark:border-[#334155]">
                  <div className="text-xs font-black text-[#64748B] dark:text-[#94A3B8] mb-2 flex items-center justify-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>اختار المخمن من فريقك:</span>
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {availableGuessers.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => {
                          soundManager.play('click');
                          setPartnerId(candidate.id);
                        }}
                        className={`min-h-[34px] px-3 rounded-xl text-xs font-black border transition-colors ${
                          partner.id === candidate.id
                            ? 'bg-[#14B8A6] text-white border-[#0D9488]'
                            : 'bg-[#FFF9F0] dark:bg-[#0F172A] border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                        }`}
                      >
                        {candidate.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={startTurnTimer}
              className="w-full max-w-[270px] min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black transition-transform"
            >
              أنا جاهز — ابدأ {turnDuration} ثانية!
            </button>
          </div>
        )}

        {/* PHASE 3: ACTIVE CHARADES */}
        {phase === 'ACTIVE_TURN' && describer && partner && (
          <div className="flex-1 flex flex-col items-center py-2 no-select">
            <ActiveTurnBanner
              label="الواصف:"
              player={describer}
              badgeText={`${teamLabel} · صح ${turnCorrectWords.length}`}
              accent={isUrgent ? 'rose' : activeTeam === 'red' ? 'coral' : 'teal'}
            />

            <div className="w-full max-w-md rounded-3xl qada-card p-5 mb-4 text-center">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-black text-[#0D9488] dark:text-[#2DD4BF]">
                  النوع: {currentCard.kind}
                </span>
                <span
                  className={`text-2xl font-black tabular-nums flex items-center gap-1.5 ${
                    isUrgent
                      ? 'text-[#E11D48] dark:text-rose-400 animate-pulse'
                      : 'text-[#059669] dark:text-emerald-400'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  <span>{secondsLeft} ث</span>
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-[#EAE0D0] dark:bg-[#0F172A] overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all duration-75 ${
                    isUrgent
                      ? 'bg-[#E11D48]'
                      : secondsLeft <= 12
                        ? 'bg-[#F59E0B]'
                        : 'bg-[#14B8A6]'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Secret Card Name */}
              <div className="rounded-2xl bg-[#F0FDFA]/90 dark:bg-[#0F172A]/90 border-2 border-[#99F6E4] dark:border-teal-800 px-4 py-5 mb-4">
                <div className="text-3xl sm:text-4xl font-black text-[#1E293B] dark:text-white leading-tight">
                  {currentCard.word}
                </div>
              </div>

              {/* Forbidden Words */}
              <div className="rounded-2xl bg-[#FFF1F2]/90 dark:bg-rose-950/45 border border-[#FECDD3] dark:border-rose-800/70 p-3.5 text-right">
                <div className="text-xs font-black text-[#BE123C] dark:text-rose-300 flex items-center gap-1.5 mb-2">
                  <Ban className="w-4 h-4 shrink-0" />
                  <span>ممنوع تقول الكلمات دي:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {currentCard.forbidden.map((word) => (
                    <span
                      key={word}
                      className="rounded-lg bg-white dark:bg-[#1E293B] border border-[#FDA4AF] dark:border-rose-800 px-2.5 py-1 text-xs sm:text-sm font-black text-[#9F1239] dark:text-rose-200"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Big Rapid Action Controls */}
            <div className="w-full max-w-md grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCorrectCard}
                className="w-full min-h-[60px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
              >
                <Check className="w-6 h-6" />
                <span>صح! (+١)</span>
              </button>

              <button
                type="button"
                onClick={handleSkipCard}
                className="w-full min-h-[56px] rounded-2xl qada-btn-amber text-[#1E293B] text-lg font-black flex items-center justify-center gap-2 transition-transform"
              >
                <SkipForward className="w-5 h-5" />
                <span>تخطي (Skip)</span>
              </button>
            </div>
          </div>
        )}

        {/* PHASE 4: TURN RESULT */}
        {phase === 'TURN_RESULT' && describer && partner && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6 animate-reveal-3s">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-950/50 border-2 border-[#A7F3D0] dark:border-emerald-700 flex items-center justify-center text-[#059669]">
                <Trophy className="w-9 h-9" />
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-1">
                انتهى الوقت!
              </h2>
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] mb-4">
                {describer.name} و {partner.name} ({teamLabel}) جابوا{' '}
                <span className="text-[#059669] dark:text-emerald-400 font-black tabular-nums">
                  {turnCorrectWords.length} إجابات صح
                </span>{' '}
                (+{turnPoints} نقطة!) · تخطي: {turnSkippedCount}
              </p>

              {turnCorrectWords.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-2 bg-[#FFF9F0]/90 dark:bg-[#0F172A]/90 rounded-2xl p-3.5 border border-[#E7DEC8] dark:border-[#334155]">
                  {turnCorrectWords.map((w, idx) => (
                    <span
                      key={`${w}_${idx}`}
                      className="rounded-xl bg-[#ECFDF5] dark:bg-emerald-950/70 border border-[#A7F3D0] dark:border-emerald-800 px-3 py-1 text-xs sm:text-sm font-black text-[#065F46] dark:text-emerald-200"
                    >
                      ✓ {w}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-[#FFF1F2] dark:bg-rose-950/40 border border-[#FECDD3] dark:border-rose-800 p-3.5 text-sm font-bold text-[#BE123C] dark:text-rose-200">
                  مفيش إجابات اتحسبت في الدور ده — عوضوها في اللي جاي!
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleFinishTurn}
              className="w-full max-w-[260px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black transition-transform"
            >
              {turnIdx + 1 < turnOrder.length ? 'الدور اللي بعده' : 'عرض النتيجة النهائية'}
            </button>
          </div>
        )}

        {/* PHASE 5: LEADERBOARD */}
        {phase === 'LEADERBOARD' && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline={`خمن في الكورة 🎙️ · الأحمر ${teamScores.red} - ${teamScores.blue} الأزرق`}
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
        message="الدور لسه شغال، لو خرجت دلوقتي نقاط الجولة الحالية مش هتتحسب."
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
