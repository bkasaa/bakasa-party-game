import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Clock, Eye, EyeOff, Pause, Play, ShieldAlert, Users } from 'lucide-react';
import { BANNER_COLOR_CLASSES, SPY_CATEGORIES } from '../../data/gameData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { Player, RoundDelta, SpyCategory, SpyPhase } from '../../types/game';
import { soundManager } from '../../utils/soundManager';
import { BannerThumb } from '../BannerThumb';
import { ConfirmModal } from '../ConfirmModal';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { PlayerAvatar } from '../PlayerAvatar';
import { TopBar } from '../TopBar';

interface SpyGameFlowProps {
  players: Player[];
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
}

export const SpyGameFlow: React.FC<SpyGameFlowProps> = ({
  players,
  onApplyDeltas,
  onExitToHub,
}) => {
  const guard = useTapGuard(400);

  const [phase, setPhase] = useState<SpyPhase>('CATEGORY_SELECT');
  const [discussionMinutes, setDiscussionMinutes] = useState<number>(5);
  const [spyCount, setSpyCount] = useState<number>(1);
  const [selectedCategory, setSelectedCategory] = useState<SpyCategory | null>(null);
  const [secretWord, setSecretWord] = useState<string>('');
  const [spyIds, setSpyIds] = useState<string[]>([]);
  const [lastWord, setLastWord] = useState<string>('');

  // Reveal turn state
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState<number>(0);
  const [isHoldingCard, setIsHoldingCard] = useState<boolean>(false);
  const [hasPeekedCurrent, setHasPeekedCurrent] = useState<boolean>(false);

  // Discussion timer state
  const [secondsLeft, setSecondsLeft] = useState<number>(300);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [starterName, setStarterName] = useState<string>('');

  // Voting state
  const [voterIdx, setVoterIdx] = useState<number>(0);
  const [selectedSuspectId, setSelectedSuspectId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, string>>({});

  // Results state
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [spiesCaught, setSpiesCaught] = useState<boolean>(false);

  // Safe exit modal
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const timerExpiredPlayedRef = useRef<boolean>(false);

  const isRoundInProgress =
    phase === 'PASS_DEVICE' ||
    phase === 'REVEAL_CARD' ||
    phase === 'DISCUSSION' ||
    phase === 'VOTING' ||
    phase === 'ROUND_REVEAL';

  useNavigationGuard(isRoundInProgress, () => {
    setShowExitConfirm(true);
  });

  // Clamp spy count if players shrink
  useEffect(() => {
    if (players.length < 6 && spyCount > 1) {
      setSpyCount(1);
    }
  }, [players.length, spyCount]);

  // Discussion countdown effect
  useEffect(() => {
    if (phase !== 'DISCUSSION' || !isTimerRunning) return;

    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (!timerExpiredPlayedRef.current) {
            timerExpiredPlayedRef.current = true;
            soundManager.play('tickUrgent');
          }
          setIsTimerRunning(false);
          return 0;
        }
        if (prev <= 11) {
          soundManager.play('tick');
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [phase, isTimerRunning]);

  const startRoundWithCategory = guard((category: SpyCategory) => {
    soundManager.unlock();
    soundManager.play('next');

    const candidateWords = category.words.filter((w) => w !== lastWord);
    const pool = candidateWords.length > 0 ? candidateWords : category.words;
    const chosenWord = pool[Math.floor(Math.random() * pool.length)];

    // Pick unbiased random spy/spies
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const effectiveSpyCount = players.length >= 6 ? spyCount : 1;
    const chosenSpies = shuffled.slice(0, effectiveSpyCount).map((p) => p.id);

    const randomStarter = players[Math.floor(Math.random() * players.length)];

    setSelectedCategory(category);
    setSecretWord(chosenWord);
    setLastWord(chosenWord);
    setSpyIds(chosenSpies);
    setStarterName(randomStarter.name);

    setCurrentPlayerIdx(0);
    setIsHoldingCard(false);
    setHasPeekedCurrent(false);

    setSecondsLeft(discussionMinutes * 60);
    setIsTimerRunning(false);
    timerExpiredPlayedRef.current = false;

    setVoterIdx(0);
    setSelectedSuspectId(null);
    setVotes({});
    setRoundDeltas([]);

    setPhase('PASS_DEVICE');
  });

  const handlePassDeviceNext = guard(() => {
    soundManager.play('click');
    setIsHoldingCard(false);
    setHasPeekedCurrent(false);
    setPhase('REVEAL_CARD');
  });

  const handleRevealNext = guard(() => {
    if (!hasPeekedCurrent) return;
    // Immediately wipe reveal state before transition (Anti-peek lock)
    setIsHoldingCard(false);
    setHasPeekedCurrent(false);
    soundManager.play('next');

    if (currentPlayerIdx + 1 < players.length) {
      setCurrentPlayerIdx((prev) => prev + 1);
      setPhase('PASS_DEVICE');
    } else {
      setSecondsLeft(discussionMinutes * 60);
      setIsTimerRunning(true);
      timerExpiredPlayedRef.current = false;
      setPhase('DISCUSSION');
    }
  });

  const handleStartVoting = guard(() => {
    soundManager.play('next');
    setIsTimerRunning(false);
    setVoterIdx(0);
    setSelectedSuspectId(null);
    setVotes({});
    setPhase('VOTING');
  });

  const finalizeVoting = (finalVotes: Record<string, string>) => {
    const tally: Record<string, number> = {};
    players.forEach((p) => {
      tally[p.id] = 0;
    });
    Object.values(finalVotes).forEach((suspectId) => {
      tally[suspectId] = (tally[suspectId] ?? 0) + 1;
    });

    let maxVotes = 0;
    Object.values(tally).forEach((count) => {
      if (count > maxVotes) maxVotes = count;
    });

    const topSuspectIds = Object.entries(tally)
      .filter(([, count]) => count === maxVotes && maxVotes > 0)
      .map(([id]) => id);

    // Caught if strictly a spy is the top voted suspect (or only spies in top suspects)
    const caught =
      topSuspectIds.length > 0 && topSuspectIds.every((id) => spyIds.includes(id));

    const deltas: RoundDelta[] = players.map((p) => {
      const isSpy = spyIds.includes(p.id);
      if (caught) {
        return { playerId: p.id, delta: isSpy ? 0 : 100 };
      }
      return { playerId: p.id, delta: isSpy ? 100 : 0 };
    });

    setSpiesCaught(caught);
    setRoundDeltas(deltas);
    onApplyDeltas(deltas);
    soundManager.play('victory');
    setPhase('ROUND_REVEAL');
  };

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
      finalizeVoting(updatedVotes);
    }
  });

  const voteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    players.forEach((p) => {
      counts[p.id] = 0;
    });
    Object.values(votes).forEach((id) => {
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, [players, votes]);

  const formatClock = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleHeaderExit = () => {
    if (isRoundInProgress) {
      setShowExitConfirm(true);
    } else {
      onExitToHub();
    }
  };

  const currentPlayer = players[currentPlayerIdx];
  const currentVoter = players[voterIdx];
  const isCurrentSpy = currentPlayer ? spyIds.includes(currentPlayer.id) : false;

  const spyNamesText = players
    .filter((p) => spyIds.includes(p.id))
    .map((p) => p.name)
    .join(' و ');

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title={
          phase === 'CATEGORY_SELECT'
            ? 'تلعب ايه'
            : phase === 'VOTING'
              ? 'مرحلة التصويت'
              : phase === 'LEADERBOARD'
                ? 'النتيجة'
                : 'الجاسوس (برا اللعبة)'
        }
        exitVariant={isRoundInProgress ? 'home' : 'back'}
        onExit={handleHeaderExit}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* PHASE 1: CATEGORY SELECT */}
        {phase === 'CATEGORY_SELECT' && (
          <div className="flex flex-col">
            {/* Compact round settings */}
            <div className="mb-5 rounded-2xl bg-[#271047]/80 border border-white/15 p-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-extrabold text-white/85 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-300" />
                  <span>وقت النقاش:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {[3, 4, 5, 6, 7].map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setDiscussionMinutes(min);
                      }}
                      className={`min-w-[40px] min-h-[36px] rounded-xl text-xs sm:text-sm font-black tabular-nums transition-colors ${
                        discussionMinutes === min
                          ? 'bg-[#3a9b54] text-white shadow'
                          : 'bg-black/30 text-white/70 hover:text-white'
                      }`}
                    >
                      {min}د
                    </button>
                  ))}
                </div>
              </div>

              {players.length >= 6 && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <span className="text-xs sm:text-sm font-extrabold text-white/85 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-pink-300" />
                    <span>عدد الجواسيس:</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => {
                          soundManager.play('click');
                          setSpyCount(count);
                        }}
                        className={`min-w-[54px] min-h-[36px] px-3 rounded-xl text-xs sm:text-sm font-black transition-colors ${
                          spyCount === count
                            ? 'bg-[#b55a92] text-white shadow'
                            : 'bg-black/30 text-white/70 hover:text-white'
                        }`}
                      >
                        {count === 1 ? '١ جاسوس' : '٢ جواسيس'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Category Cards matching Screenshot 4 */}
            <div className="flex flex-col gap-5">
              {SPY_CATEGORIES.map((category) => {
                const style = BANNER_COLOR_CLASSES[category.color];
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => startRoundWithCategory(category)}
                    className={`w-full min-h-[72px] rounded-2xl ${style.bg} ${style.shadow} border ${style.border} px-4 py-2.5 flex items-center justify-between gap-3 text-right transition-transform active:scale-[0.98] hover:brightness-105`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <BannerThumb type={category.iconType} />
                      <span className="text-xl font-black text-white truncate">
                        {category.name}
                      </span>
                    </div>
                    <ChevronLeft className="w-6 h-6 text-white/90 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE 2: PASS DEVICE COVER SCREEN (Screenshot 3 exact look) */}
        {phase === 'PASS_DEVICE' && currentPlayer && (
          <div className="flex-1 flex flex-col items-center justify-center py-6">
            <div className="mb-4 flex items-center gap-2 text-xs font-extrabold text-white/70 tabular-nums">
              <span>
                اللاعب {currentPlayerIdx + 1} من {players.length}
              </span>
              <span>·</span>
              <span>{selectedCategory?.name}</span>
            </div>

            {/* Dark Cyber-Bordered Cover Box matching Screenshot 3 */}
            <div className="relative w-full max-w-md rounded-2xl bg-[#0e121a] border border-white/10 shadow-[0_18px_40px_rgba(0,0,0,0.65)] px-6 py-12 text-center mb-9">
              {/* Cyan brackets (left side) */}
              <span className="pointer-events-none absolute top-3 left-3 w-7 h-7 border-t-[3.5px] border-l-[3.5px] border-[#38bdf8] rounded-tl-lg" />
              <span className="pointer-events-none absolute bottom-3 left-3 w-7 h-7 border-b-[3.5px] border-l-[3.5px] border-[#38bdf8] rounded-bl-lg" />

              {/* Pink/Magenta brackets (right side) */}
              <span className="pointer-events-none absolute top-3 right-3 w-7 h-7 border-t-[3.5px] border-r-[3.5px] border-[#ec4899] rounded-tr-lg" />
              <span className="pointer-events-none absolute bottom-3 right-3 w-7 h-7 border-b-[3.5px] border-r-[3.5px] border-[#ec4899] rounded-br-lg" />

              <p className="text-xl sm:text-2xl font-black text-white leading-relaxed">
                ادي الموبايل لـ <span className="text-[#38bdf8]">{currentPlayer.name}</span> عشان
                يعرف هو اللي برا اللعبة ولا لا !
              </p>

              {/* Center bottom dual-diamond emblem */}
              <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-[#0e121a] px-3 flex items-center gap-0.5">
                <span className="w-4 h-4 rotate-45 rounded-[3px] border-2 border-[#38bdf8] bg-[#0e121a]" />
                <span className="w-4 h-4 -mr-1.5 rotate-45 rounded-[3px] border-2 border-[#ec4899] bg-[#0e121a]" />
              </div>
            </div>

            <button
              type="button"
              onClick={handlePassDeviceNext}
              className="w-full max-w-[240px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
            >
              التالي
            </button>
          </div>
        )}

        {/* PHASE 3: ANTI-PEEK HOLD TO REVEAL CARD */}
        {phase === 'REVEAL_CARD' && currentPlayer && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 no-select">
            <div className="flex items-center gap-3 mb-5">
              <PlayerAvatar avatarId={currentPlayer.avatarId} name={currentPlayer.name} size="md" />
              <div className="text-right">
                <div className="text-xs font-bold text-white/70">دور اللاعب</div>
                <div className="text-xl font-black text-white">{currentPlayer.name}</div>
              </div>
            </div>

            {/* Hold-to-Reveal Interactive Neon Card */}
            <div
              role="button"
              tabIndex={0}
              aria-label="اضغط مطولاً لكشف الكارت"
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
              className={`relative w-full max-w-md min-h-[240px] rounded-2xl bg-[#0e121a] border-2 transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center shadow-[0_18px_40px_rgba(0,0,0,0.65)] no-select ${
                isHoldingCard
                  ? isCurrentSpy
                    ? 'border-[#ec4899] scale-[1.01]'
                    : 'border-[#38bdf8] scale-[1.01]'
                  : 'border-white/15 hover:border-white/30'
              }`}
            >
              <span className="pointer-events-none absolute top-3 left-3 w-7 h-7 border-t-[3.5px] border-l-[3.5px] border-[#38bdf8] rounded-tl-lg" />
              <span className="pointer-events-none absolute bottom-3 left-3 w-7 h-7 border-b-[3.5px] border-l-[3.5px] border-[#38bdf8] rounded-bl-lg" />
              <span className="pointer-events-none absolute top-3 right-3 w-7 h-7 border-t-[3.5px] border-r-[3.5px] border-[#ec4899] rounded-tr-lg" />
              <span className="pointer-events-none absolute bottom-3 right-3 w-7 h-7 border-b-[3.5px] border-r-[3.5px] border-[#ec4899] rounded-br-lg" />

              {!isHoldingCard ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-[#38bdf8]">
                    <Eye className="w-8 h-8" />
                  </div>
                  <p className="text-lg sm:text-xl font-black text-white">
                    اضغط وخليك دايس على الكارت
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-white/65">
                    أول ما ترفع صباعك الكارت هيختفي فوراً عشان محدش يبص
                  </p>
                </div>
              ) : isCurrentSpy ? (
                <div className="flex flex-col items-center gap-2.5">
                  <div className="w-14 h-14 rounded-2xl bg-[#ec4899]/20 border border-[#ec4899] flex items-center justify-center text-[#f472b6]">
                    <EyeOff className="w-7 h-7" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-[#f472b6]">
                    أنت برا اللعبة! (الجاسوس)
                  </div>
                  <p className="text-sm font-bold text-white/85 max-w-xs">
                    القسم: {selectedCategory?.name} — حاول تفهم الكلمة من أسئلة صحابك من غير ما
                    تتكشف!
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-xs font-extrabold text-[#38bdf8]">
                    القسم: {selectedCategory?.name}
                  </div>
                  <div className="text-sm font-bold text-white/75">الكلمة السرية هي:</div>
                  <div className="text-3xl sm:text-4xl font-black text-white tracking-wide py-1">
                    {secretWord}
                  </div>
                  <p className="text-xs font-bold text-emerald-300/90 mt-1">
                    اسأل أسئلة ذكية تكشف الجاسوس من غير ما تحرق الكلمة!
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 w-full max-w-[260px] flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={!hasPeekedCurrent}
                onClick={handleRevealNext}
                className="w-full min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                التالي
              </button>
              {!hasPeekedCurrent && (
                <span className="text-xs font-bold text-amber-200/90">
                  لازم تشوف كارتك الأول قبل ما تكمل
                </span>
              )}
            </div>
          </div>
        )}

        {/* PHASE 4: DISCUSSION TIMER */}
        {phase === 'DISCUSSION' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl bg-[#271047]/90 border border-white/15 p-6 shadow-2xl mb-7">
              <div className="text-sm font-extrabold text-pink-300 mb-1">
                القسم: {selectedCategory?.name}
              </div>
              <h2 className="text-2xl font-black text-white mb-5">وقت الأسئلة والنقاش</h2>

              <div
                className={`text-6xl font-black tabular-nums tracking-wider mb-6 ${
                  secondsLeft === 0
                    ? 'text-rose-400'
                    : secondsLeft <= 30
                      ? 'text-amber-300'
                      : 'text-white'
                }`}
              >
                {formatClock(secondsLeft)}
              </div>

              <div className="flex items-center justify-center gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.play('click');
                    setIsTimerRunning((prev) => !prev);
                  }}
                  className="min-h-[46px] px-5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-black text-sm flex items-center gap-2 transition-colors"
                >
                  {isTimerRunning ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>إيقاف مؤقت</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>استئناف</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.play('click');
                    setSecondsLeft((prev) => prev + 60);
                    timerExpiredPlayedRef.current = false;
                  }}
                  className="min-h-[46px] px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-sm tabular-nums transition-colors"
                >
                  +١ دقيقة
                </button>
              </div>

              <div className="rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm font-bold text-white/85">
                اقتراح البداية: خلي <span className="text-emerald-300 font-black">{starterName}</span>{' '}
                يسأل أول سؤال!
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartVoting}
              className="w-full max-w-[260px] min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
            >
              بدء التصويت
            </button>
          </div>
        )}

        {/* PHASE 5: VOTING (Screenshot 2 exact look) */}
        {phase === 'VOTING' && currentVoter && (
          <div className="flex-1 flex flex-col items-center pt-10 pb-4">
            <div className="relative w-full max-w-md rounded-3xl bg-[#69269c] border border-white/15 shadow-[0_18px_40px_rgba(0,0,0,0.5)] px-5 pt-14 pb-6 flex flex-col items-center">
              {/* Overlapping voter avatar */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                <PlayerAvatar
                  avatarId={currentVoter.avatarId}
                  name={currentVoter.name}
                  size="xl"
                />
              </div>

              <h2 className="text-lg sm:text-xl font-black text-white text-center mb-5 leading-snug">
                {currentVoter.name} اختار الشخص اللي شاكك فيه
              </h2>

              <div className="w-full flex flex-col gap-3 mb-6">
                {players
                  .filter((p) => p.id !== currentVoter.id)
                  .map((candidate) => {
                    const isSelected = selectedSuspectId === candidate.id;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => {
                          soundManager.play('click');
                          setSelectedSuspectId(candidate.id);
                        }}
                        className={`w-full min-h-[54px] rounded-2xl px-4 flex items-center justify-between gap-3 font-extrabold text-base sm:text-lg transition-all ${
                          isSelected
                            ? 'bg-[#25103d] border-2 border-[#4cb056] text-white shadow-[0_0_0_2px_rgba(76,176,86,0.3)] scale-[1.01]'
                            : 'bg-[#3c195c] border-2 border-transparent text-white/90 hover:bg-[#451d69]'
                        }`}
                      >
                        <span className="w-6" aria-hidden="true" />
                        <span className="truncate">{candidate.name}</span>
                        <span className="w-6 flex justify-end">
                          {isSelected && <Check className="w-5 h-5 text-[#4cb056]" />}
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

        {/* PHASE 6: ROUND REVEAL BEFORE LEADERBOARD */}
        {phase === 'ROUND_REVEAL' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl bg-[#271047]/95 border border-white/20 p-6 shadow-2xl mb-6">
              <div
                className={`w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
                  spiesCaught
                    ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                    : 'bg-rose-500/20 border border-rose-400/50 text-rose-300'
                }`}
              >
                <ShieldAlert className="w-9 h-9" />
              </div>

              <h2 className="text-2xl font-black text-white mb-1">
                {spiesCaught ? 'قفشتوا الجاسوس!' : 'الجاسوس هرب منكم!'}
              </h2>
              <p className="text-sm font-bold text-white/80 mb-5">
                {spiesCaught
                  ? 'أصحاب الكلمة كسبوا +١٠٠ نقطة لكل واحد'
                  : 'الجاسوس خدعكم وكسب +١٠٠ نقطة!'}
              </p>

              <div className="rounded-2xl bg-black/35 border border-white/10 p-4 mb-5 flex flex-col gap-2">
                <div className="text-sm font-bold text-white/75">اللي كان برا اللعبة:</div>
                <div className="text-2xl font-black text-pink-300">{spyNamesText}</div>
                <div className="pt-2 border-t border-white/10 text-sm font-bold text-white/75">
                  الكلمة السرية: <span className="text-cyan-300 font-black">{secretWord}</span>
                </div>
              </div>

              <div className="text-right flex flex-col gap-2">
                <div className="text-xs font-extrabold text-white/65 mb-1">ملخص التصويت:</div>
                {players.map((p) => {
                  const votedFor = players.find((x) => x.id === votes[p.id]);
                  const count = voteCounts[p.id] ?? 0;
                  const isSpy = spyIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs sm:text-sm font-bold"
                    >
                      <span className="text-white truncate">
                        {p.name}{' '}
                        {isSpy && <span className="text-pink-300 font-black">(الجاسوس)</span>}
                      </span>
                      <span className="text-white/70 truncate">
                        صوّت لـ {votedFor?.name ?? '—'} ·{' '}
                        <span className="text-white tabular-nums">{count} أصوات</span>
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

        {/* PHASE 7: LEADERBOARD ("النتيجة" Screenshot 1) */}
        {phase === 'LEADERBOARD' && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline={`الجاسوس: ${spyNamesText} · الكلمة: ${secretWord}`}
            onNewRound={() => setPhase('CATEGORY_SELECT')}
            onFinishGame={onExitToHub}
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
