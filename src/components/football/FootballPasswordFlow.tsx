import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Fingerprint,
  KeyRound,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  FOOTBALL_SPY_CATEGORIES,
  FootballGlobalSettings,
  filterByScope,
} from '../../data/footballData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { Player, RoundDelta } from '../../types/game';
import { recordSpyCatch } from '../../utils/sessionStats';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { getCustomContent } from '../../utils/customContentStorage';
import { pickUnseenItem } from '../../utils/usedItemsMemory';
import { ActiveTurnBanner } from '../ActiveTurnBanner';
import { ConfirmModal } from '../ConfirmModal';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { PlayerAvatar } from '../PlayerAvatar';
import { TopBar } from '../TopBar';
import { FootballSettingsBar } from './FootballSettingsBar';

interface FootballPasswordFlowProps {
  players: Player[];
  initialSettings: FootballGlobalSettings;
  onUpdateSettings: (next: FootballGlobalSettings) => void;
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
}

type PasswordPhase =
  | 'READY'
  | 'PASS_DEVICE'
  | 'REVEAL_CARD'
  | 'CLUE_LAP'
  | 'VOTING'
  | 'IDENTITY_REVEAL'
  | 'IMPOSTOR_GUESS'
  | 'ROUND_REVEAL'
  | 'LEADERBOARD';

export const FootballPasswordFlow: React.FC<FootballPasswordFlowProps> = ({
  players,
  initialSettings,
  onUpdateSettings,
  onApplyDeltas,
  onExitToHub,
  onTournamentFinish,
}) => {
  const guard = useTapGuard(350);

  const [phase, setPhase] = useState<PasswordPhase>('READY');
  const [settings, setSettings] = useState<FootballGlobalSettings>(() => ({
    scope: initialSettings.scope,
    rounds: Math.min(4, Math.max(1, initialSettings.rounds || 2)),
    turnSeconds: [10, 15, 20, 30].includes(initialSettings.turnSeconds)
      ? initialSettings.turnSeconds
      : 15,
  }));

  const maxImpostors = players.length >= 5 ? 2 : 1;
  const [impostorCount, setImpostorCount] = useState<number>(1);
  const effectiveImpostorCount = Math.min(impostorCount, maxImpostors);

  const [secretCategoryName, setSecretCategoryName] = useState<string>('');
  const [secretFootballer, setSecretFootballer] = useState<string>('');
  const [impostorIds, setImpostorIds] = useState<string[]>([]);
  const [guessOptions, setGuessOptions] = useState<string[]>([]);

  // Card reveal turn state
  const [revealIdx, setRevealIdx] = useState<number>(0);
  const [isHoldingCard, setIsHoldingCard] = useState<boolean>(false);
  const [hasPeeked, setHasPeeked] = useState<boolean>(false);

  // Turn-by-turn Clue Laps state
  const [clueOrder, setClueOrder] = useState<Player[]>([]);
  const [currentLap, setCurrentLap] = useState<number>(1);
  const [clueTurnIdx, setClueTurnIdx] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(settings.turnSeconds);
  const [msLeft, setMsLeft] = useState<number>(settings.turnSeconds * 1000);
  const [turnTimedOut, setTurnTimedOut] = useState<boolean>(false);

  // Voting & Impostor guess
  const [voterIdx, setVoterIdx] = useState<number>(0);
  const [selectedSuspectIds, setSelectedSuspectIds] = useState<string[]>([]);
  const [votes, setVotes] = useState<Record<string, string[]>>({});
  const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
  const [impostorGuessedRight, setImpostorGuessedRight] = useState<boolean>(false);
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const deadlineRef = useRef<number>(0);
  const lastTickRef = useRef<number>(settings.turnSeconds);

  const activeCategories = useMemo(() => {
    const base = filterByScope(FOOTBALL_SPY_CATEGORIES, settings.scope);
    const custom = getCustomContent();
    if (custom.footballNames.length === 0) return base;
    const customCat = {
      id: '__custom_fb_pwd__',
      name: 'أسمائك الخاصة ✍️',
      color: 'coral' as const,
      iconType: 'sports' as const,
      scope: 'local' as const,
      words: custom.footballNames,
    };
    if (custom.mode === 'custom_only') return [customCat];
    return [customCat, ...base];
  }, [settings.scope]);

  const isRoundInProgress = phase !== 'READY' && phase !== 'LEADERBOARD';

  useNavigationGuard(isRoundInProgress, () => {
    setShowExitConfirm(true);
  });

  const handleSettingsChange = (next: FootballGlobalSettings) => {
    setSettings(next);
    onUpdateSettings(next);
  };

  const resetClueTimer = (secs: number) => {
    deadlineRef.current = Date.now() + secs * 1000;
    lastTickRef.current = secs;
    setSecondsLeft(secs);
    setMsLeft(secs * 1000);
    setTurnTimedOut(false);
  };

  useEffect(() => {
    if (phase !== 'CLUE_LAP' || turnTimedOut) return;

    const timer = window.setInterval(() => {
      const remaining = Math.max(0, deadlineRef.current - Date.now());
      const sec = Math.ceil(remaining / 1000);
      setMsLeft(remaining);
      setSecondsLeft(sec);

      if (sec !== lastTickRef.current && sec > 0) {
        lastTickRef.current = sec;
        if (sec <= 3) {
          soundManager.play('tickUrgent');
          triggerHaptic(22);
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

  const startGame = guard(() => {
    soundManager.unlock();
    soundManager.play('next');

    const pool = activeCategories.length > 0 ? activeCategories : FOOTBALL_SPY_CATEGORIES;
    const chosenCat = pool[Math.floor(Math.random() * pool.length)];
    const chosenWord = pickUnseenItem(`fb_pwd:${settings.scope}:${chosenCat.id}`, chosenCat.words);

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const chosenImpostors = shuffled.slice(0, effectiveImpostorCount).map((p) => p.id);

    const decoys = chosenCat.words
      .filter((w) => w !== chosenWord)
      .sort(() => Math.random() - 0.5)
      .slice(0, 15);

    setSecretCategoryName(chosenCat.name);
    setSecretFootballer(chosenWord);
    setImpostorIds(chosenImpostors);
    setGuessOptions([chosenWord, ...decoys].sort(() => Math.random() - 0.5));

    setClueOrder([...players].sort(() => Math.random() - 0.5));
    setRevealIdx(0);
    setIsHoldingCard(false);
    setHasPeeked(false);
    setCurrentLap(1);
    setClueTurnIdx(0);
    setVoterIdx(0);
    setSelectedSuspectIds([]);
    setVotes({});
    setSelectedGuess(null);
    setImpostorGuessedRight(false);
    setRoundDeltas([]);

    setPhase('PASS_DEVICE');
  });

  const handleRevealNext = guard(() => {
    if (!hasPeeked) return;
    setIsHoldingCard(false);
    setHasPeeked(false);
    soundManager.play('next');

    if (revealIdx + 1 < players.length) {
      setRevealIdx((prev) => prev + 1);
      setPhase('PASS_DEVICE');
    } else {
      setCurrentLap(1);
      setClueTurnIdx(0);
      resetClueTimer(settings.turnSeconds);
      setPhase('CLUE_LAP');
    }
  });

  const handleClueDone = guard(() => {
    soundManager.play('next');
    triggerHaptic(18);

    if (clueTurnIdx + 1 < clueOrder.length) {
      setClueTurnIdx((prev) => prev + 1);
      resetClueTimer(settings.turnSeconds);
      return;
    }

    if (currentLap < settings.rounds) {
      setCurrentLap((prev) => prev + 1);
      setClueTurnIdx(0);
      resetClueTimer(settings.turnSeconds);
      return;
    }

    setVoterIdx(0);
    setSelectedSuspectIds([]);
    setVotes({});
    setPhase('VOTING');
  });

  const handleToggleSuspect = (candidateId: string) => {
    if (effectiveImpostorCount === 1) {
      soundManager.play('click');
      setSelectedSuspectIds([candidateId]);
      return;
    }
    setSelectedSuspectIds((prev) => {
      if (prev.includes(candidateId)) {
        soundManager.play('click');
        return prev.filter((id) => id !== candidateId);
      }
      if (prev.length >= effectiveImpostorCount) {
        soundManager.play('error');
        return prev;
      }
      soundManager.play('click');
      return [...prev, candidateId];
    });
  };

  const handleVoteNext = guard(() => {
    if (selectedSuspectIds.length !== effectiveImpostorCount) {
      soundManager.play('error');
      return;
    }

    const voter = players[voterIdx];
    const updatedVotes = { ...votes, [voter.id]: selectedSuspectIds };
    setVotes(updatedVotes);
    setSelectedSuspectIds([]);

    if (voterIdx + 1 < players.length) {
      soundManager.play('vote');
      setVoterIdx((prev) => prev + 1);
    } else {
      soundManager.play('reveal');
      setPhase('IDENTITY_REVEAL');
    }
  });

  const handleConfirmGuess = guard(() => {
    if (!selectedGuess) {
      soundManager.play('error');
      return;
    }

    const isCorrect = selectedGuess === secretFootballer;
    setImpostorGuessedRight(isCorrect);

    const deltas: RoundDelta[] = players.map((p) => {
      const isImp = impostorIds.includes(p.id);
      if (isImp) {
        return { playerId: p.id, delta: isCorrect ? 100 : 0 };
      }
      const picked = votes[p.id] ?? [];
      const correctPicks = picked.filter((id) => impostorIds.includes(id)).length;
      if (correctPicks > 0) recordSpyCatch(p.id);
      return { playerId: p.id, delta: correctPicks * 100 };
    });

    setRoundDeltas(deltas);
    onApplyDeltas(deltas);
    soundManager.play(isCorrect ? 'victory' : 'next');
    setPhase('ROUND_REVEAL');
  });

  const currentRevealPlayer = players[revealIdx];
  const isCurrentImpostor = currentRevealPlayer ? impostorIds.includes(currentRevealPlayer.id) : false;
  const currentCluePlayer = clueOrder[clueTurnIdx];
  const currentVoter = players[voterIdx];
  const impostorPlayers = players.filter((p) => impostorIds.includes(p.id));
  const impostorNamesText = impostorPlayers.map((p) => p.name).join(' و ');

  const progressPct = Math.max(0, Math.min(100, (msLeft / (settings.turnSeconds * 1000)) * 100));
  const isUrgent = secondsLeft <= 3;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title={phase === 'LEADERBOARD' ? 'النتيجة' : 'كلمة السر (كورة) 🔑'}
        exitVariant={isRoundInProgress ? 'home' : 'back'}
        onExit={() => {
          if (isRoundInProgress) setShowExitConfirm(true);
          else onExitToHub();
        }}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* PHASE 1: READY */}
        {phase === 'READY' && (
          <div className="flex-1 flex flex-col items-center justify-center py-3 gap-4">
            <div className="w-full max-w-md rounded-3xl qada-card p-5 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#EFF6FF] dark:bg-blue-950/50 border-2 border-[#BFDBFE] dark:border-blue-800 flex items-center justify-center text-[#0284C7] dark:text-sky-400">
                <KeyRound className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-1.5">
                كلمة السر — تلميح بمعلومة!
              </h2>
              <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                الكل هيعرف اسم اللاعب السري ما عدا واحد بره اللعبة! في كل لفة، كل لاعب يقول
                معلومة واحدة عن اللاعب في دوره ويضغط &quot;تمام، قولت معلومتي&quot; قبل ما
                الوقت يخلص.
              </p>

              {maxImpostors > 1 && (
                <div className="mt-4 pt-3 border-t border-[#E7DEC8]/60 dark:border-[#334155]/70 flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#FF6B4A]" />
                    <span>عدد اللي بره اللعبة:</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          soundManager.play('click');
                          setImpostorCount(c);
                        }}
                        className={`min-w-[66px] min-h-[36px] px-2.5 rounded-xl text-xs font-black transition-colors ${
                          effectiveImpostorCount === c
                            ? 'bg-[#FF6B4A] text-white shadow-[0_3px_0_#D94E30]'
                            : 'bg-[#FFF9F0]/80 dark:bg-[#0F172A]/80 border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]'
                        }`}
                      >
                        {c === 1 ? '١ لاعب' : '٢ لاعيبة'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-full max-w-md">
              <FootballSettingsBar
                settings={settings}
                onChange={handleSettingsChange}
                roundsLabel="عدد اللفات:"
                roundOptions={[1, 2, 3, 4]}
                roundUnit="لفات"
                secondsLabel="الوقت لكل لاعب:"
                secondsOptions={[10, 15, 20, 30]}
              />
            </div>

            <button
              type="button"
              onClick={startGame}
              className="w-full max-w-[270px] min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
            >
              <Sparkles className="w-5 h-5" />
              <span>ابدأ كلمة السر!</span>
            </button>
          </div>
        )}

        {/* PHASE 2: PASS DEVICE */}
        {phase === 'PASS_DEVICE' && currentRevealPlayer && (
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <ActiveTurnBanner
              label="دور استلام الكارت:"
              player={currentRevealPlayer}
              badgeText={`${revealIdx + 1} من ${players.length}`}
              accent="teal"
            />

            <div className="w-full max-w-md rounded-3xl qada-card px-6 py-10 text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F0FDFA] dark:bg-[#0F172A] border-2 border-[#99F6E4] dark:border-[#334155] flex items-center justify-center">
                <PlayerAvatar
                  avatarId={currentRevealPlayer.avatarId}
                  name={currentRevealPlayer.name}
                  size="md"
                />
              </div>

              <p className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white leading-relaxed">
                ادي الموبايل لـ <span className="text-[#0D9488] dark:text-[#2DD4BF]">{currentRevealPlayer.name}</span>
              </p>
              <p className="mt-2 text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">
                محدش يبص غيره عشان يعرف كلمة السر!
              </p>
            </div>

            <button
              type="button"
              onClick={guard(() => {
                soundManager.play('click');
                setIsHoldingCard(false);
                setHasPeeked(false);
                setPhase('REVEAL_CARD');
              })}
              className="w-full max-w-[240px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black"
            >
              التالي
            </button>
          </div>
        )}

        {/* PHASE 3: HOLD TO REVEAL */}
        {phase === 'REVEAL_CARD' && currentRevealPlayer && (
          <div className="flex-1 flex flex-col items-center justify-center py-2 no-select">
            <ActiveTurnBanner
              label="بيشوف الكارت:"
              player={currentRevealPlayer}
              badgeText={`${revealIdx + 1} من ${players.length}`}
              accent="teal"
            />

            <div
              role="button"
              tabIndex={0}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                soundManager.play('reveal');
                setIsHoldingCard(true);
                setHasPeeked(true);
              }}
              onPointerUp={() => setIsHoldingCard(false)}
              onPointerCancel={() => setIsHoldingCard(false)}
              onLostPointerCapture={() => setIsHoldingCard(false)}
              className={`w-full max-w-md min-h-[235px] rounded-3xl border-2 border-b-[6px] transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center shadow-lg ${
                isHoldingCard
                  ? isCurrentImpostor
                    ? 'bg-[#FFF1F2] dark:bg-rose-950/85 border-[#F43F5E] border-b-[#BE123C]'
                    : 'bg-[#ECFDF5] dark:bg-emerald-950/85 border-[#10B981] border-b-[#047857]'
                  : 'qada-card'
              }`}
            >
              {!isHoldingCard ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] border-2 border-[#FCD34D] flex items-center justify-center text-[#FF6B4A]">
                    <Fingerprint className="w-9 h-9 animate-pulse" />
                  </div>
                  <p className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-white">
                    اضغط وخليك دايس على الكارت
                  </p>
                  <p className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                    أول ما ترفع صباعك هيختفي فوراً
                  </p>
                </div>
              ) : isCurrentImpostor ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-2xl sm:text-3xl font-black text-[#BE123C] dark:text-rose-300">
                    أنت بره كلمة السر! 🕵️‍♂️
                  </div>
                  <p className="text-sm font-bold text-[#475569] dark:text-rose-100 max-w-xs">
                    القسم: {secretCategoryName} — اسمع تلميحاتهم وادي تلميح عام يبان إنك عارف اللاعب!
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-xs font-extrabold text-[#0D9488] dark:text-[#2DD4BF]">
                    القسم: {secretCategoryName}
                  </div>
                  <div className="text-sm font-bold text-[#475569] dark:text-emerald-200">
                    كلمة السر (اللاعب):
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-[#1E293B] dark:text-white">
                    {secretFootballer}
                  </div>
                  <p className="text-xs font-bold text-[#059669] dark:text-emerald-300 mt-1">
                    لما ييجي دورك، قول معلومة ذكية متفضحش الاسم للمتسلل!
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!hasPeeked}
              onClick={handleRevealNext}
              className="mt-7 w-full max-w-[260px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        )}

        {/* PHASE 4: TURN-BY-TURN CLUE LAPS */}
        {phase === 'CLUE_LAP' && currentCluePlayer && (
          <div className="flex-1 flex flex-col items-center py-2">
            <ActiveTurnBanner
              label="الدور على:"
              player={currentCluePlayer}
              badgeText={`اللفة ${currentLap} من ${settings.rounds}`}
              accent={isUrgent || turnTimedOut ? 'rose' : 'emerald'}
            />

            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-5 text-center">
              <div className="text-xs font-extrabold text-[#0D9488] dark:text-[#2DD4BF] mb-3">
                القسم: {secretCategoryName} · الدور {clueTurnIdx + 1} من {clueOrder.length}
              </div>

              <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-[#ECFDF5] dark:bg-[#0F172A] border-2 border-[#A7F3D0] dark:border-[#334155] flex items-center justify-center">
                <PlayerAvatar
                  avatarId={currentCluePlayer.avatarId}
                  name={currentCluePlayer.name}
                  size="lg"
                />
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-[#1E293B] dark:text-white mb-1">
                {currentCluePlayer.name}
              </h2>
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] mb-5">
                قول تلميح بمعلومة واحدة عن اللاعب السري بصوت عالي!
              </p>

              {/* Countdown */}
              <div className="rounded-2xl bg-[#FFF9F0]/90 dark:bg-[#0F172A]/90 border border-[#E7DEC8] dark:border-[#334155] p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                    <Clock className={`w-4 h-4 ${isUrgent || turnTimedOut ? 'text-[#E11D48]' : 'text-[#10B981]'}`} />
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
                      turnTimedOut || isUrgent ? 'bg-[#E11D48]' : 'bg-[#10B981]'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClueDone}
              className={`w-full max-w-md min-h-[60px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform ${
                turnTimedOut ? 'ring-4 ring-rose-300' : ''
              }`}
            >
              <Check className="w-6 h-6" />
              <span>تمام، قولت معلومتي ✅</span>
            </button>

            {/* Turn Order Progress */}
            <div className="w-full max-w-md flex flex-wrap justify-center gap-1.5 mt-4">
              {clueOrder.map((p, idx) => (
                <span
                  key={p.id}
                  className={`rounded-xl px-2.5 py-1 text-xs font-black border ${
                    idx < clueTurnIdx
                      ? 'bg-[#ECFDF5] dark:bg-emerald-950/60 border-[#10B981] text-[#059669] dark:text-emerald-300'
                      : idx === clueTurnIdx
                        ? 'bg-[#FF6B4A] border-[#D94E30] text-white scale-105'
                        : 'bg-white/75 dark:bg-[#1E293B]/75 border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                >
                  {idx < clueTurnIdx ? '✓ ' : ''}
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* PHASE 5: VOTING */}
        {phase === 'VOTING' && currentVoter && (
          <div className="flex-1 flex flex-col items-center pt-2 pb-4">
            <ActiveTurnBanner
              label="اللي بيصوّت دلوقتي:"
              player={currentVoter}
              badgeText={`${voterIdx + 1} من ${players.length}`}
              accent="coral"
            />
            <div className="w-full max-w-md rounded-3xl qada-card p-5 flex flex-col items-center">
              <h2 className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-white text-center mb-4">
                {effectiveImpostorCount === 1
                  ? `${currentVoter.name} — مين اللي كان بره كلمة السر؟`
                  : `${currentVoter.name} — اختار ${effectiveImpostorCount} لاعيبة شاكك فيهم`}
              </h2>

              <div className="w-full flex flex-col gap-2.5 mb-5">
                {players
                  .filter((p) => p.id !== currentVoter.id)
                  .map((candidate) => {
                    const selected = selectedSuspectIds.includes(candidate.id);
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => handleToggleSuspect(candidate.id)}
                        className={`w-full min-h-[52px] rounded-2xl px-4 flex items-center justify-between font-extrabold text-base transition-all ${
                          selected
                            ? 'bg-[#ECFDF5] dark:bg-emerald-950/75 border-2 border-[#10B981] text-[#065F46] dark:text-emerald-200'
                            : 'bg-[#FFF9F0]/80 dark:bg-[#0F172A]/80 border-2 border-[#E7DEC8] dark:border-[#334155] text-[#1E293B] dark:text-white'
                        }`}
                      >
                        <span className="truncate">{candidate.name}</span>
                        {selected && <Check className="w-5 h-5 text-[#059669]" />}
                      </button>
                    );
                  })}
              </div>

              <button
                type="button"
                disabled={selectedSuspectIds.length !== effectiveImpostorCount}
                onClick={handleVoteNext}
                className="w-full max-w-[220px] min-h-[52px] rounded-2xl bakasa-btn-green text-white text-xl font-black disabled:opacity-45"
              >
                التالي
              </button>
            </div>
          </div>
        )}

        {/* PHASE 6: IDENTITY REVEAL */}
        {phase === 'IDENTITY_REVEAL' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6 animate-reveal-3s">
              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-3">
                {impostorPlayers.length > 1 ? 'اللي بره كلمة السر كانوا:' : 'اللي بره كلمة السر كان:'}
              </h2>

              <div className="flex flex-wrap items-center justify-center gap-3 my-4">
                {impostorPlayers.map((imp) => (
                  <div
                    key={imp.id}
                    className="flex items-center gap-2 rounded-2xl bg-[#FFF1F2] dark:bg-rose-950/65 border-2 border-[#FDA4AF] px-4 py-2.5"
                  >
                    <PlayerAvatar avatarId={imp.avatarId} name={imp.name} size="md" />
                    <span className="text-xl font-black text-[#BE123C] dark:text-rose-200">
                      {imp.name}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-sm font-bold text-[#B45309] dark:text-[#FCD34D]">
                لسه قدام {impostorNamesText} فرصة يخمن كلمة السر من التلميحات!
              </p>
            </div>

            <button
              type="button"
              onClick={guard(() => {
                soundManager.play('next');
                setPhase('IMPOSTOR_GUESS');
              })}
              className="w-full max-w-[260px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black"
            >
              تخمين كلمة السر
            </button>
          </div>
        )}

        {/* PHASE 7: IMPOSTOR GUESS */}
        {phase === 'IMPOSTOR_GUESS' && (
          <div className="flex-1 flex flex-col items-center py-2">
            <ActiveTurnBanner
              label="تخمين:"
              player={impostorPlayers.length === 1 ? impostorPlayers[0] : undefined}
              playerNameOverride={impostorNamesText}
              accent="rose"
            />
            <div className="w-full rounded-3xl qada-card p-4 text-center mb-4">
              <div className="text-xs font-extrabold text-[#FF6B4A] mb-1">
                القسم: {secretCategoryName}
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-white">
                {impostorNamesText} — مين كان اللاعب السري؟
              </h2>
            </div>

            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
              {guessOptions.map((word) => {
                const selected = selectedGuess === word;
                return (
                  <button
                    key={word}
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setSelectedGuess(word);
                    }}
                    className={`min-h-[54px] rounded-2xl px-3 py-2 text-sm font-black text-center transition-all flex items-center justify-center ${
                      selected
                        ? 'bg-[#10B981] border-2 border-[#047857] text-white scale-[1.02]'
                        : 'qada-card text-[#1E293B] dark:text-white'
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
              onClick={handleConfirmGuess}
              className="w-full max-w-[260px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black disabled:opacity-45"
            >
              تأكيد الاختيار
            </button>
          </div>
        )}

        {/* PHASE 8: ROUND REVEAL */}
        {phase === 'ROUND_REVEAL' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6 animate-reveal-3s">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-950/50 border-2 border-[#A7F3D0] flex items-center justify-center text-[#059669]">
                {impostorGuessedRight ? <Sparkles className="w-9 h-9" /> : <ShieldAlert className="w-9 h-9" />}
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-2">
                {impostorGuessedRight
                  ? `عاش! ${impostorNamesText} خمن كلمة السر صح!`
                  : `${impostorNamesText} معرفش كلمة السر!`}
              </h2>

              <div className="rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] border-2 border-[#E7DEC8] dark:border-[#334155] p-4 mb-4">
                <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">كلمة السر كانت:</div>
                <div className="text-3xl font-black text-[#0D9488] dark:text-[#2DD4BF] mt-1">
                  {secretFootballer}
                </div>
              </div>

              <div className="flex flex-col gap-2 text-right">
                {players.map((p) => {
                  const delta = roundDeltas.find((d) => d.playerId === p.id)?.delta ?? 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#EAE0D0] dark:border-[#334155] px-3 py-2 text-xs sm:text-sm font-bold"
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
              className="w-full max-w-[260px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black"
            >
              عرض الترتيب
            </button>
          </div>
        )}

        {/* PHASE 9: LEADERBOARD */}
        {phase === 'LEADERBOARD' && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline={`كلمة السر: ${secretFootballer} · المتسلل: ${impostorNamesText}`}
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
        message="الدور لسه مخلصش، لو خرجت دلوقتي تقدم الجولة الحالية هيتلغي."
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitToHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
