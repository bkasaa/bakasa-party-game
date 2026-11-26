import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  Clock,
  Fingerprint,
  ListOrdered,
  Music,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  DEFAULT_FOOTBALL_SETTINGS,
  FOOTBALL_SPY_CATEGORIES,
  FootballGlobalSettings,
  filterByScope,
} from '../../data/footballData';
import { BANNER_COLOR_CLASSES, SPY_CATEGORIES } from '../../data/gameData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { Player, RoundDelta, SpyCategory, SpyPhase } from '../../types/game';
import { soundManager } from '../../utils/soundManager';
import { recordSpyCatch } from '../../utils/sessionStats';
import { getCustomContent } from '../../utils/customContentStorage';
import { pickUnseenItem } from '../../utils/usedItemsMemory';
import { ActiveTurnBanner } from '../ActiveTurnBanner';
import { BannerThumb } from '../BannerThumb';
import { CardWatermark } from '../CardWatermark';
import { CategoryFilterBar } from '../CategoryFilterBar';
import { ConfirmModal } from '../ConfirmModal';
import { FootballSettingsBar } from '../football/FootballSettingsBar';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { PlayerAvatar } from '../PlayerAvatar';
import { TopBar } from '../TopBar';

interface SpyGameFlowProps {
  players: Player[];
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
  variant?: 'classic' | 'football';
  footballSettings?: FootballGlobalSettings;
  onUpdateFootballSettings?: (next: FootballGlobalSettings) => void;
}

interface QuestionLink {
  asker: Player;
  target: Player;
}

function buildQuestionChain(players: Player[]): QuestionLink[] {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  return shuffled.map((asker, idx) => ({
    asker,
    target: shuffled[(idx + 1) % shuffled.length],
  }));
}

function buildGuessChoices(category: SpyCategory, secretWord: string): string[] {
  const decoys = category.words
    .filter((w) => w !== secretWord)
    .sort(() => Math.random() - 0.5)
    .slice(0, 15);
  return [secretWord, ...decoys].sort(() => Math.random() - 0.5);
}

const AnimatedSpyHatSvg: React.FC<{ variant?: 'detective' | 'alert'; className?: string }> = ({
  variant = 'detective',
  className = 'w-14 h-14',
}) => (
  <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
    {/* Fedora Hat */}
    <ellipse cx="40" cy="36" rx="28" ry="6.5" fill={variant === 'alert' ? '#BE123C' : '#1E293B'} />
    <path
      d="M23 35 L28 14 Q40 10 52 14 L57 35 Z"
      fill={variant === 'alert' ? '#E11D48' : '#334155'}
    />
    <rect
      x="24.5"
      y="29"
      width="31"
      height="4.5"
      rx="2"
      fill={variant === 'alert' ? '#FDE047' : '#FF6B4A'}
    />
    {/* Sunglasses */}
    <g>
      <rect x="19" y="42" width="17" height="10" rx="4" fill="#0F172A" stroke="#94A3B8" strokeWidth="1.5" />
      <rect x="44" y="42" width="17" height="10" rx="4" fill="#0F172A" stroke="#94A3B8" strokeWidth="1.5" />
      <line x1="36" y1="46" x2="44" y2="46" stroke="#94A3B8" strokeWidth="2.5" />
      <line x1="23" y1="45" x2="29" y2="49" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.65" />
      <line x1="48" y1="45" x2="54" y2="49" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.65" />
    </g>
    {/* Scanning Magnifying Glass */}
    <g className="animate-spy-scan" style={{ transformOrigin: '58px 56px' }}>
      <circle cx="57" cy="54" r="9.5" fill="rgba(20, 184, 166, 0.25)" stroke="#14B8A6" strokeWidth="3" />
      <line x1="64" y1="61" x2="72" y2="69" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    </g>
  </svg>
);

export const SpyGameFlow: React.FC<SpyGameFlowProps> = ({
  players,
  onApplyDeltas,
  onExitToHub,
  onTournamentFinish,
  variant = 'classic',
  footballSettings,
  onUpdateFootballSettings,
}) => {
  const isFootballMode = variant === 'football';
  const [fbSettings, setFbSettings] = useState<FootballGlobalSettings>(
    () => footballSettings ?? DEFAULT_FOOTBALL_SETTINGS
  );
  const categorySource = useMemo(() => {
    const base = isFootballMode
      ? filterByScope(FOOTBALL_SPY_CATEGORIES, fbSettings.scope)
      : SPY_CATEGORIES;
    const custom = getCustomContent();
    const customList = isFootballMode ? custom.footballNames : custom.words;
    if (customList.length === 0) return base;
    const customCat: SpyCategory = {
      id: isFootballMode ? '__custom_fb_spy__' : '__custom_classic_spy__',
      name: isFootballMode ? 'أسمائك الخاصة ✍️' : 'كلماتك الخاصة ✍️',
      color: 'coral',
      iconType: isFootballMode ? 'sports' : 'daily_life',
      words: customList,
    };
    if (custom.mode === 'custom_only') {
      return [customCat];
    }
    return [customCat, ...base];
  }, [isFootballMode, fbSettings.scope]);
  const guard = useTapGuard(400);

  const maxSpies = players.length >= 6 ? 3 : players.length >= 4 ? 2 : 1;

  const [phase, setPhase] = useState<SpyPhase>('CATEGORY_SELECT');
  const [discussionMinutes, setDiscussionMinutes] = useState<number>(5);
  const [spyCount, setSpyCount] = useState<number>(1);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<SpyCategory | null>(null);
  const [secretWord, setSecretWord] = useState<string>('');
  const [spyIds, setSpyIds] = useState<string[]>([]);

  // Reveal turn state
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState<number>(0);
  const [isHoldingCard, setIsHoldingCard] = useState<boolean>(false);
  const [hasPeekedCurrent, setHasPeekedCurrent] = useState<boolean>(false);

  // Discussion timer & optional question order state
  const [secondsLeft, setSecondsLeft] = useState<number>(300);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [questionChain, setQuestionChain] = useState<QuestionLink[]>([]);
  const [showQuestionOrderModal, setShowQuestionOrderModal] = useState<boolean>(false);
  const [musicMuted, setMusicMuted] = useState<boolean>(() => soundManager.isMusicMuted());

  // Voting state (multi-spy support)
  const [voterIdx, setVoterIdx] = useState<number>(0);
  const [selectedSuspectIds, setSelectedSuspectIds] = useState<string[]>([]);
  const [votes, setVotes] = useState<Record<string, string[]>>({});

  // Spy's Last Chance guess state
  const [guessOptions, setGuessOptions] = useState<string[]>([]);
  const [selectedSpyGuess, setSelectedSpyGuess] = useState<string | null>(null);
  const [spyGuessedCorrectly, setSpyGuessedCorrectly] = useState<boolean>(false);

  // Results state
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);

  // Safe exit modal
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const timerExpiredPlayedRef = useRef<boolean>(false);

  const effectiveSpyCount = Math.min(spyCount, maxSpies);

  const isRoundInProgress =
    phase === 'PASS_DEVICE' ||
    phase === 'REVEAL_CARD' ||
    phase === 'DISCUSSION' ||
    phase === 'VOTING' ||
    phase === 'SPY_IDENTITY_REVEAL' ||
    phase === 'SPY_FINAL_GUESS' ||
    phase === 'ROUND_REVEAL';

  useNavigationGuard(isRoundInProgress, () => {
    setShowExitConfirm(true);
  });

  useEffect(() => {
    return soundManager.subscribeMusic(setMusicMuted);
  }, []);

  // Mysterious low-volume Spy suspense loop during DISCUSSION & VOTING
  useEffect(() => {
    if (phase === 'DISCUSSION' || phase === 'VOTING') {
      soundManager.startMusic('spy');
    } else {
      soundManager.stopMusic();
    }
    return () => {
      soundManager.stopMusic();
    };
  }, [phase]);

  // Clamp spy count dynamically if player count changes
  useEffect(() => {
    if (spyCount > maxSpies) {
      setSpyCount(maxSpies);
    }
  }, [maxSpies, spyCount]);

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

  const activeSpyCategories = useMemo(
    () =>
      selectedCategoryIds.length === 0
        ? categorySource
        : categorySource.filter((cat) => selectedCategoryIds.includes(cat.id)),
    [categorySource, selectedCategoryIds]
  );

  const totalSpyWords = useMemo(
    () => activeSpyCategories.reduce((sum, cat) => sum + cat.words.length, 0),
    [activeSpyCategories]
  );

  const startRoundWithCategory = guard((category: SpyCategory) => {
    soundManager.unlock();
    soundManager.play('next');

    const unseenPrefix = isFootballMode ? 'fb_spy' : 'spy';
    const chosenWord = pickUnseenItem(`${unseenPrefix}:${category.id}`, category.words);

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const chosenSpies = shuffled.slice(0, effectiveSpyCount).map((p) => p.id);

    setSelectedCategory(category);
    setSecretWord(chosenWord);
    setSpyIds(chosenSpies);
    setQuestionChain(buildQuestionChain(players));
    setShowQuestionOrderModal(false);

    setCurrentPlayerIdx(0);
    setIsHoldingCard(false);
    setHasPeekedCurrent(false);

    setSecondsLeft(discussionMinutes * 60);
    setIsTimerRunning(false);
    timerExpiredPlayedRef.current = false;

    setVoterIdx(0);
    setSelectedSuspectIds([]);
    setVotes({});

    setGuessOptions(buildGuessChoices(category, chosenWord));
    setSelectedSpyGuess(null);
    setSpyGuessedCorrectly(false);
    setRoundDeltas([]);

    setPhase('PASS_DEVICE');
  });

  const startRoundFromSelectedFilter = () => {
    const pool = activeSpyCategories.length > 0 ? activeSpyCategories : categorySource;
    const chosenCat = pool[Math.floor(Math.random() * pool.length)];
    startRoundWithCategory(chosenCat);
  };

  const handlePassDeviceNext = guard(() => {
    soundManager.play('click');
    setIsHoldingCard(false);
    setHasPeekedCurrent(false);
    setPhase('REVEAL_CARD');
  });

  const handleRevealNext = guard(() => {
    if (!hasPeekedCurrent) return;
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
    setShowQuestionOrderModal(false);
    setVoterIdx(0);
    setSelectedSuspectIds([]);
    setVotes({});
    setPhase('VOTING');
  });

  const handleToggleCandidate = (candidateId: string) => {
    if (effectiveSpyCount === 1) {
      soundManager.play('click');
      setSelectedSuspectIds([candidateId]);
      return;
    }

    setSelectedSuspectIds((prev) => {
      if (prev.includes(candidateId)) {
        soundManager.play('click');
        return prev.filter((id) => id !== candidateId);
      }
      if (prev.length >= effectiveSpyCount) {
        soundManager.play('error');
        return prev;
      }
      soundManager.play('click');
      return [...prev, candidateId];
    });
  };

  const handleVoteNext = guard(() => {
    if (selectedSuspectIds.length !== effectiveSpyCount) {
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
      setPhase('SPY_IDENTITY_REVEAL');
    }
  });

  const handleConfirmSpyGuess = guard(() => {
    if (!selectedSpyGuess) {
      soundManager.play('error');
      return;
    }

    const isCorrect = selectedSpyGuess === secretWord;
    setSpyGuessedCorrectly(isCorrect);

    const deltas: RoundDelta[] = players.map((p) => {
      const isSpy = spyIds.includes(p.id);
      if (isSpy) {
        return { playerId: p.id, delta: isCorrect ? 100 : 0 };
      }
      const pickedIds = votes[p.id] ?? [];
      const correctPicks = pickedIds.filter((id) => spyIds.includes(id)).length;
      if (correctPicks > 0) {
        recordSpyCatch(p.id);
      }
      return { playerId: p.id, delta: correctPicks * 100 };
    });

    setRoundDeltas(deltas);
    onApplyDeltas(deltas);
    soundManager.play(isCorrect ? 'victory' : 'next');
    setPhase('ROUND_REVEAL');
  });

  const voteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    players.forEach((p) => {
      counts[p.id] = 0;
    });
    Object.values(votes).forEach((pickedList) => {
      pickedList.forEach((id) => {
        counts[id] = (counts[id] ?? 0) + 1;
      });
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
      soundManager.stopMusic();
      onExitToHub();
    }
  };

  const currentPlayer = players[currentPlayerIdx];
  const currentVoter = players[voterIdx];
  const isCurrentSpy = currentPlayer ? spyIds.includes(currentPlayer.id) : false;

  const spyPlayers = players.filter((p) => spyIds.includes(p.id));
  const spyNamesText = spyPlayers.map((p) => p.name).join(' و ');
  const teammateNames = currentPlayer
    ? spyPlayers
        .filter((p) => p.id !== currentPlayer.id)
        .map((p) => p.name)
        .join(' و ')
    : '';

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title={
          phase === 'CATEGORY_SELECT'
            ? isFootballMode
              ? 'جاسوس الكورة ⚽'
              : 'اختر القسم'
            : phase === 'VOTING'
              ? 'مرحلة التصويت'
              : phase === 'SPY_FINAL_GUESS'
                ? 'فرصة الجاسوس الأخيرة'
                : phase === 'LEADERBOARD'
                  ? 'النتيجة'
                  : isFootballMode
                    ? 'جاسوس الكورة ⚽'
                    : 'الجاسوس (بره القعدة)'
        }
        exitVariant={isRoundInProgress ? 'exit' : 'back'}
        exitLabel={isRoundInProgress ? 'خروج' : 'رجوع'}
        onExit={handleHeaderExit}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10 pt-2 flex flex-col">
        {/* PHASE 1: CATEGORY SELECT */}
        {phase === 'CATEGORY_SELECT' && (
          <div className="flex flex-col">
            <div className="mb-5 rounded-3xl qada-card p-4 flex flex-col gap-3">
              {/* Discussion time */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#14B8A6]" />
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
                          ? 'bg-[#10B981] text-white shadow-[0_3px_0_#059669]'
                          : 'bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white'
                      }`}
                    >
                      {min}د
                    </button>
                  ))}
                </div>
              </div>

              {/* Spy count */}
              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#F1E8DA] dark:border-[#334155] flex-wrap">
                <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#FF6B4A]" />
                  <span>عدد الجواسيس:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3].map((count) => {
                    const disabled = count > maxSpies;
                    return (
                      <button
                        key={count}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          soundManager.play('click');
                          setSpyCount(count);
                        }}
                        className={`min-w-[62px] min-h-[36px] px-2.5 rounded-xl text-xs sm:text-sm font-black transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
                          effectiveSpyCount === count
                            ? 'bg-[#FF6B4A] text-white shadow-[0_3px_0_#D94E30]'
                            : 'bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white'
                        }`}
                      >
                        {count === 1 ? '١ جاسوس' : count === 2 ? '٢ جواسيس' : '٣ جواسيس'}
                      </button>
                    );
                  })}
                </div>
              </div>
              {maxSpies < 3 && (
                <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] text-right">
                  * ٢ جواسيس من ٤ لاعبين فأكثر · ٣ جواسيس من ٦ لاعبين فأكثر
                </p>
              )}
            </div>

            {isFootballMode && (
              <div className="mb-4">
                <FootballSettingsBar
                  settings={fbSettings}
                  onChange={(next) => {
                    setFbSettings(next);
                    setSelectedCategoryIds([]);
                    onUpdateFootballSettings?.(next);
                  }}
                  showRounds={false}
                  showSeconds={false}
                />
              </div>
            )}

            {/* Multi-select Category Filter Bar */}
            <div className="mb-4 flex flex-col gap-3">
              <CategoryFilterBar
                categories={categorySource.map((c) => ({
                  id: c.id,
                  name: c.name,
                  count: c.words.length,
                }))}
                selectedIds={selectedCategoryIds}
                onChange={setSelectedCategoryIds}
                totalAvailable={totalSpyWords}
                unitLabel={isFootballMode ? 'لاعب' : 'كلمة'}
                accentColor={isFootballMode ? 'emerald' : 'coral'}
              />

              <button
                type="button"
                onClick={startRoundFromSelectedFilter}
                className="w-full min-h-[56px] rounded-2xl bakasa-btn-green text-white text-lg sm:text-xl font-black tracking-wide flex items-center justify-center gap-2 transition-transform"
              >
                <Sparkles className="w-5 h-5" />
                <span>
                  {selectedCategoryIds.length === 0
                    ? isFootballMode
                      ? 'ابدأ عشوائي من كل اللاعيبة!'
                      : 'ابدأ عشوائي من كل الأقسام!'
                    : selectedCategoryIds.length === 1
                      ? `ابدأ ${activeSpyCategories[0]?.name ?? ''}!`
                      : `ابدأ عشوائي من ${selectedCategoryIds.length} أقسام مختارة!`}
                </span>
              </button>
            </div>

            {/* Category Cards */}
            <div className="flex flex-col gap-5">
              {activeSpyCategories.map((category, idx) => {
                const style = BANNER_COLOR_CLASSES[category.color];
                return (
                  <div
                    key={category.id}
                    className="animate-card-float"
                    style={{ animationDelay: `${(idx % 5) * 0.45}s` }}
                  >
                    <button
                      type="button"
                      onClick={() => startRoundWithCategory(category)}
                      className={`group relative overflow-hidden w-full min-h-[72px] rounded-3xl ${style.bg} ${style.shadow} border ${style.border} qada-spring-card px-4 py-2.5 flex items-center justify-between gap-3 text-right hover:brightness-105`}
                    >
                      <CardWatermark kind={category.iconType} />
                      <div className="pointer-events-none absolute -bottom-5 -left-5 w-20 h-20 rounded-full bg-white/10" />
                      <div
                        className="pointer-events-none absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/18 to-transparent animate-shimmer-sweep"
                        style={{ animationDelay: `${(idx % 4) * 1.1}s` }}
                      />
                      <div className="relative flex items-center gap-4 min-w-0">
                        <BannerThumb type={category.iconType} floatDelay={(idx % 5) * 0.3} />
                        <span className="text-xl font-black text-white truncate">
                          {category.name}
                        </span>
                      </div>
                      <ChevronLeft className="relative w-6 h-6 text-white/90 shrink-0 transition-transform group-hover:-translate-x-1" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE 2: PASS DEVICE COVER SCREEN */}
        {phase === 'PASS_DEVICE' && currentPlayer && (
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <ActiveTurnBanner
              label="دور استلام الكارت:"
              player={currentPlayer}
              badgeText={`${currentPlayerIdx + 1} من ${players.length}`}
              accent="coral"
            />

            <div className="mb-3 flex items-center gap-2 text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8] tabular-nums">
              <span className="text-[#1E293B] dark:text-[#F8FAFC]">{selectedCategory?.name}</span>
            </div>

            <div className="relative w-full max-w-md rounded-3xl qada-card px-6 py-11 text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FFF7EA] dark:bg-[#0F172A] border-2 border-[#FDE68A] dark:border-[#334155] flex items-center justify-center">
                <PlayerAvatar
                  avatarId={currentPlayer.avatarId}
                  name={currentPlayer.name}
                  size="md"
                />
              </div>

              <p className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white leading-relaxed">
                ادي الموبايل لـ <span className="text-[#FF6B4A]">{currentPlayer.name}</span> عشان
                يعرف هو الجاسوس ولا لا!
              </p>

              <p className="mt-2 text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">
                تأكد إن مفيش حد تاني باصص على الشاشة
              </p>
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
          <div className="flex-1 flex flex-col items-center justify-center py-2 no-select">
            <ActiveTurnBanner
              label="اللي بيكشف الكارت دلوقتي:"
              player={currentPlayer}
              badgeText={`${currentPlayerIdx + 1} من ${players.length}`}
              accent="teal"
            />

            <div className="flex items-center gap-3 mb-4">
              <PlayerAvatar avatarId={currentPlayer.avatarId} name={currentPlayer.name} size="md" />
              <div className="text-right">
                <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">دور اللاعب</div>
                <div className="text-xl font-black text-[#1E293B] dark:text-white">{currentPlayer.name}</div>
              </div>
            </div>

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
              className={`relative w-full max-w-md min-h-[245px] rounded-3xl border-2 border-b-[6px] transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center shadow-lg no-select ${
                isHoldingCard
                  ? isCurrentSpy
                    ? 'bg-[#FFF1F2] dark:bg-rose-950/85 border-[#F43F5E] border-b-[#BE123C] scale-[1.01]'
                    : 'bg-[#ECFDF5] dark:bg-emerald-950/85 border-[#10B981] border-b-[#047857] scale-[1.01]'
                  : 'bg-gradient-to-br from-[#FFF4D6] to-[#FFE7C7] dark:from-[#1E293B] dark:to-[#0F172A] border-[#F59E0B] dark:border-[#F59E0B]/80 border-b-[#D97706] hover:brightness-[1.02]'
              }`}
            >
              {!isHoldingCard ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#0F172A] border-2 border-[#FCD34D] dark:border-[#F59E0B]/60 shadow-sm flex items-center justify-center text-[#FF6B4A]">
                    <Fingerprint className="w-9 h-9 animate-pulse" />
                  </div>
                  <p className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-white">
                    اضغط وخليك دايس على الكارت
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">
                    أول ما ترفع صباعك الكارت هيختفي فوراً عشان محدش يبص
                  </p>
                </div>
              ) : isCurrentSpy ? (
                <div className="flex flex-col items-center gap-2">
                  <AnimatedSpyHatSvg variant="alert" className="w-16 h-16" />
                  <div className="text-2xl sm:text-3xl font-black text-[#BE123C] dark:text-rose-300">
                    أنت الجاسوس!
                  </div>
                  <p className="text-sm font-bold text-[#475569] dark:text-rose-100 max-w-xs">
                    القسم: {selectedCategory?.name} — حاول تفهم الكلمة من أسئلة صحابك من غير ما
                    تتكشف!
                  </p>
                  {teammateNames && (
                    <div className="mt-1 rounded-xl bg-[#FFE4E6] dark:bg-rose-900/60 border border-[#FDA4AF] dark:border-rose-700 px-3 py-1.5 text-xs font-extrabold text-[#9F1239] dark:text-rose-100">
                      الجواسيس التانيين معاك: {teammateNames}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-xs font-extrabold text-[#0D9488] dark:text-[#2DD4BF]">
                    القسم: {selectedCategory?.name}
                  </div>
                  <div className="text-sm font-bold text-[#475569] dark:text-emerald-200">
                    {isFootballMode ? 'اللاعب السري هو:' : 'الكلمة السرية هي:'}
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-[#1E293B] dark:text-white tracking-wide py-1">
                    {secretWord}
                  </div>
                  <p className="text-xs font-bold text-[#059669] dark:text-emerald-300 mt-1">
                    {isFootballMode
                      ? 'اسأل أسئلة ذكية عن النادي أو المنتخب من غير ما تحرق اسم اللاعب!'
                      : 'اسأل أسئلة ذكية تكشف الجاسوس من غير ما تحرق الكلمة!'}
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
                <span className="text-xs font-bold text-[#B45309] dark:text-[#FCD34D]">
                  لازم تشوف كارتك الأول قبل ما تكمل
                </span>
              )}
            </div>
          </div>
        )}

        {/* PHASE 4: DISCUSSION TIMER + ANIMATED SPY SVG + SUSPENSE MUSIC */}
        {phase === 'DISCUSSION' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6 relative overflow-hidden">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs sm:text-sm font-extrabold text-[#FF6B4A]">
                  القسم: {selectedCategory?.name} · {spyIds.length} جاسوس
                </div>
                <button
                  type="button"
                  onClick={() => soundManager.toggleMusicMute()}
                  className={`min-h-[32px] px-2.5 rounded-xl border text-[11px] font-black flex items-center gap-1 transition-colors ${
                    musicMuted
                      ? 'bg-[#FFF1F2] dark:bg-rose-950/50 border-[#FECDD3] dark:border-rose-800 text-[#E11D48] dark:text-rose-300'
                      : 'bg-[#FFF9F0] dark:bg-[#0F172A] border-[#E7DEC8] dark:border-[#334155] text-[#0D9488] dark:text-[#2DD4BF]'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>{musicMuted ? 'الموسيقى مقفولة' : 'موسيقى التوتر'}</span>
                </button>
              </div>

              <div className="flex justify-center my-1">
                <AnimatedSpyHatSvg className="w-16 h-16" />
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-3">وقت الأسئلة والنقاش</h2>

              <div
                className={`text-6xl font-black tabular-nums tracking-wider mb-6 ${
                  secondsLeft === 0
                    ? 'text-[#E11D48] dark:text-rose-400'
                    : secondsLeft <= 30
                      ? 'text-[#D97706] dark:text-amber-400'
                      : 'text-[#1E293B] dark:text-white'
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
                  className="min-h-[46px] px-5 rounded-xl bg-[#FFF9F0] dark:bg-[#0F172A] hover:bg-[#FFF1DC] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] text-[#1E293B] dark:text-white font-black text-sm flex items-center gap-2 transition-colors"
                >
                  {isTimerRunning ? (
                    <>
                      <Pause className="w-4 h-4 text-[#FF6B4A]" />
                      <span>إيقاف مؤقت</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 text-[#10B981]" />
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
                  className="min-h-[46px] px-4 rounded-xl bg-[#FFF9F0] dark:bg-[#0F172A] hover:bg-[#FFF1DC] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] text-[#1E293B] dark:text-white font-bold text-sm tabular-nums transition-colors"
                >
                  +١ دقيقة
                </button>
              </div>

              {/* Optional Balanced Question Order Button */}
              <button
                type="button"
                onClick={() => {
                  soundManager.play('click');
                  setShowQuestionOrderModal(true);
                }}
                className="w-full min-h-[48px] rounded-2xl qada-btn-teal text-white font-black text-base flex items-center justify-center gap-2 transition-all"
              >
                <ListOrdered className="w-5 h-5" />
                <span>ترتيب الأسئلة (اختياري)</span>
              </button>
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

        {/* PHASE 5: VOTING */}
        {phase === 'VOTING' && currentVoter && (
          <div className="flex-1 flex flex-col items-center pt-2 pb-4">
            <ActiveTurnBanner
              label="اللي بيصوّت دلوقتي:"
              player={currentVoter}
              badgeText={`${voterIdx + 1} من ${players.length}`}
              accent="coral"
            />
            <div className="mt-8 relative w-full max-w-md rounded-3xl qada-card px-5 pt-14 pb-6 flex flex-col items-center">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                <PlayerAvatar
                  avatarId={currentVoter.avatarId}
                  name={currentVoter.name}
                  size="xl"
                />
              </div>

              <h2 className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-white text-center mb-1 leading-snug">
                {effectiveSpyCount === 1
                  ? `${currentVoter.name} اختار الشخص اللي شاكك فيه`
                  : `${currentVoter.name} اختار ${effectiveSpyCount} أشخاص شاكك فيهم`}
              </h2>

              {effectiveSpyCount > 1 && (
                <p className="text-xs font-extrabold text-[#D94E30] dark:text-[#FB7185] mb-4 tabular-nums">
                  تم اختيار {selectedSuspectIds.length} من {effectiveSpyCount}
                </p>
              )}
              {effectiveSpyCount === 1 && <div className="mb-4" />}

              <div className="w-full flex flex-col gap-3 mb-6">
                {players
                  .filter((p) => p.id !== currentVoter.id)
                  .map((candidate) => {
                    const isSelected = selectedSuspectIds.includes(candidate.id);
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => handleToggleCandidate(candidate.id)}
                        className={`w-full min-h-[54px] rounded-2xl px-4 flex items-center justify-between gap-3 font-extrabold text-base sm:text-lg transition-all ${
                          isSelected
                            ? 'bg-[#ECFDF5] dark:bg-emerald-950/75 border-2 border-[#10B981] text-[#065F46] dark:text-emerald-200 shadow-sm scale-[1.01]'
                            : 'bg-[#FFF9F0] dark:bg-[#0F172A] border-2 border-[#E7DEC8] dark:border-[#334155] text-[#1E293B] dark:text-white hover:bg-[#FFF1DC] dark:hover:bg-[#334155]'
                        }`}
                      >
                        <span className="w-6" aria-hidden="true" />
                        <span className="truncate">{candidate.name}</span>
                        <span className="w-6 flex justify-end">
                          {isSelected && <Check className="w-5 h-5 text-[#059669] dark:text-emerald-400" />}
                        </span>
                      </button>
                    );
                  })}
              </div>

              <button
                type="button"
                disabled={selectedSuspectIds.length !== effectiveSpyCount}
                onClick={handleVoteNext}
                className="w-full max-w-[220px] min-h-[52px] rounded-2xl bakasa-btn-green text-white text-xl font-black transition-all disabled:opacity-45 disabled:cursor-not-allowed"
              >
                التالي
              </button>
            </div>
          </div>
        )}

        {/* PHASE 6A: SPY IDENTITY REVEAL */}
        {phase === 'SPY_IDENTITY_REVEAL' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6 animate-reveal-3s">
              <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-[#FFF1F2] dark:bg-rose-950/60 border-2 border-[#FECDD3] dark:border-rose-800 flex items-center justify-center">
                <AnimatedSpyHatSvg variant="alert" className="w-16 h-16" />
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-2">
                {spyPlayers.length > 1 ? 'الجواسيس في الدور ده هما:' : 'الجاسوس في الدور ده هو:'}
              </h2>

              <div className="flex flex-wrap items-center justify-center gap-3 my-4">
                {spyPlayers.map((spy) => (
                  <div
                    key={spy.id}
                    className="flex items-center gap-2.5 rounded-2xl bg-[#FFF1F2] dark:bg-rose-950/65 border-2 border-[#FDA4AF] dark:border-rose-700 px-4 py-2.5"
                  >
                    <PlayerAvatar avatarId={spy.avatarId} name={spy.name} size="md" />
                    <span className="text-xl font-black text-[#BE123C] dark:text-rose-200">{spy.name}</span>
                  </div>
                ))}
              </div>

              <p className="text-sm font-bold text-[#B45309] dark:text-[#FCD34D] mb-4">
                الكلمة السرية لسه مخفية — قدام الجاسوس فرصة أخيرة يخمنها!
              </p>

              <div className="text-right flex flex-col gap-1.5 bg-[#FFF9F0] dark:bg-[#0F172A] rounded-2xl p-3.5 border border-[#E7DEC8] dark:border-[#334155]">
                <div className="text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8] mb-1">الأصوات:</div>
                {players.map((p) => {
                  const pickedNames = (votes[p.id] ?? [])
                    .map((id) => players.find((x) => x.id === id)?.name ?? '')
                    .filter(Boolean)
                    .join('، ');
                  const isSpy = spyIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC]"
                    >
                      <span className="truncate">
                        {p.name}{' '}
                        {isSpy && <span className="text-[#E11D48] dark:text-rose-400 font-black">(جاسوس)</span>}
                      </span>
                      <span className="text-[#64748B] dark:text-[#94A3B8] truncate">
                        اختار: {pickedNames || '—'} ({voteCounts[p.id] ?? 0} صوت)
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
                setPhase('SPY_FINAL_GUESS');
              })}
              className="w-full max-w-[280px] min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
            >
              فرصة الجاسوس الأخيرة
            </button>
          </div>
        )}

        {/* PHASE 6B: SPY'S LAST CHANCE MULTIPLE CHOICE GRID */}
        {phase === 'SPY_FINAL_GUESS' && (
          <div className="flex-1 flex flex-col items-center py-2">
            <ActiveTurnBanner
              label={spyPlayers.length > 1 ? 'اللي بيخمن دلوقتي (الجواسيس):' : 'اللي بيخمن دلوقتي (الجاسوس):'}
              player={spyPlayers.length === 1 ? spyPlayers[0] : undefined}
              playerNameOverride={spyNamesText}
              accent="rose"
            />
            <div className="w-full rounded-3xl qada-card p-4 text-center mb-4">
              <div className="text-xs font-extrabold text-[#FF6B4A] mb-1">
                القسم: {selectedCategory?.name}
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#1E293B] dark:text-white">
                {spyPlayers.length > 1
                  ? `${spyNamesText} — اتفقوا واختاروا الكلمة السرية!`
                  : `${spyNamesText} — اختار الكلمة السرية الصح!`}
              </h2>
              <p className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] mt-1">
                لو اخترت الكلمة الصح هتكسب +١٠٠ نقطة!
              </p>
            </div>

            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
              {guessOptions.map((word) => {
                const isSelected = selectedSpyGuess === word;
                return (
                  <button
                    key={word}
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setSelectedSpyGuess(word);
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
              disabled={!selectedSpyGuess}
              onClick={handleConfirmSpyGuess}
              className="w-full max-w-[260px] min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-all disabled:opacity-45 disabled:cursor-not-allowed"
            >
              تأكيد الاختيار
            </button>
          </div>
        )}

        {/* PHASE 7: FINAL WORD REVEAL */}
        {phase === 'ROUND_REVEAL' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-6 animate-reveal-3s">
              <div
                className={`w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
                  spyGuessedCorrectly
                    ? 'bg-[#FFFBEB] dark:bg-amber-950/50 border-2 border-[#FDE68A] dark:border-amber-700 text-[#D97706] dark:text-amber-400'
                    : 'bg-[#ECFDF5] dark:bg-emerald-950/50 border-2 border-[#A7F3D0] dark:border-emerald-700 text-[#059669] dark:text-emerald-400'
                }`}
              >
                {spyGuessedCorrectly ? (
                  <Sparkles className="w-9 h-9" />
                ) : (
                  <ShieldAlert className="w-9 h-9" />
                )}
              </div>

              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-1">
                {spyGuessedCorrectly
                  ? 'عاش! الجاسوس خمن الكلمة صح!'
                  : 'الجاسوس معرفش الكلمة السرية!'}
              </h2>
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] mb-5">
                {spyGuessedCorrectly
                  ? `${spyNamesText} كسب +١٠٠ نقطة في الفرصة الأخيرة`
                  : `${spyNamesText} اختار "${selectedSpyGuess}" وخسر الفرصة الأخيرة`}
              </p>

              <div className="rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] border-2 border-[#E7DEC8] dark:border-[#334155] p-4 mb-5 flex flex-col gap-1.5">
                <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                  {isFootballMode ? 'اللاعب السري كان:' : 'الكلمة السرية كانت:'}
                </div>
                <div className="text-3xl font-black text-[#0D9488] dark:text-[#2DD4BF]">{secretWord}</div>
                <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] mt-1">
                  الجاسوس: <span className="text-[#E11D48] dark:text-rose-400 font-black">{spyNamesText}</span>
                </div>
              </div>

              <div className="text-right flex flex-col gap-2">
                <div className="text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8] mb-1">نقاط الدور ده:</div>
                {players.map((p) => {
                  const delta = roundDeltas.find((d) => d.playerId === p.id)?.delta ?? 0;
                  const isSpy = spyIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#EAE0D0] dark:border-[#334155] px-3 py-2 text-xs sm:text-sm font-bold"
                    >
                      <span className="text-[#1E293B] dark:text-white truncate">
                        {p.name}{' '}
                        {isSpy && <span className="text-[#E11D48] dark:text-rose-400 font-black">(جاسوس)</span>}
                      </span>
                      <span
                        className={`tabular-nums font-black ${
                          delta > 0 ? 'text-[#059669] dark:text-emerald-400' : 'text-[#94A3B8]'
                        }`}
                      >
                        {delta > 0 ? `+${delta} نقطة` : '٠ نقطة'}
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
        {phase === 'LEADERBOARD' && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline={`الجاسوس: ${spyNamesText} · ${isFootballMode ? 'اللاعب' : 'الكلمة'}: ${secretWord}`}
            isTournamentMode={Boolean(onTournamentFinish)}
            onNewRound={() => setPhase('CATEGORY_SELECT')}
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

      {/* Balanced Circular Question Order Modal */}
      {showQuestionOrderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/65 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="question-order-title"
        >
          <div className="w-full max-w-md max-h-[85vh] rounded-3xl bg-white dark:bg-[#1E293B] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-[6px] border-b-[#D5C7B2] dark:border-b-[#0B1120] shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b-2 border-[#F1E8DA] dark:border-[#334155] bg-[#FFF9F0] dark:bg-[#0F172A] flex items-center justify-between gap-3">
              <h2
                id="question-order-title"
                className="text-xl font-black text-[#1E293B] dark:text-white flex items-center gap-2"
              >
                <ListOrdered className="w-5 h-5 text-[#14B8A6]" />
                <span>ترتيب الأسئلة</span>
              </h2>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => {
                  soundManager.play('click');
                  setShowQuestionOrderModal(false);
                }}
                className="min-w-[40px] min-h-[40px] rounded-xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] flex items-center justify-center text-[#1E293B] dark:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex flex-col gap-2.5">
              <p className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] text-center mb-1">
                كل لاعب بيسأل مرة واحدة وبيتسأل مرة واحدة بالعدل:
              </p>

              {questionChain.map((link, idx) => (
                <div
                  key={link.asker.id}
                  className="rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] px-4 py-3 flex items-center justify-between gap-2 text-sm sm:text-base font-black"
                >
                  <span className="text-[#0D9488] dark:text-[#2DD4BF] truncate">{link.asker.name}</span>
                  <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1 shrink-0">
                    <span>اسأل</span>
                    <ArrowLeft className="w-4 h-4 text-[#10B981]" />
                  </span>
                  <span className="text-[#FF6B4A] truncate">{link.target.name}</span>
                  <span className="text-[11px] text-[#94A3B8] tabular-nums shrink-0">#{idx + 1}</span>
                </div>
              ))}
            </div>

            <div className="p-4 border-t-2 border-[#F1E8DA] dark:border-[#334155] bg-[#FFF9F0] dark:bg-[#0F172A] flex gap-3">
              <button
                type="button"
                onClick={() => {
                  soundManager.play('click');
                  setQuestionChain(buildQuestionChain(players));
                }}
                className="min-h-[48px] px-4 rounded-2xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] text-[#1E293B] dark:text-white font-black text-sm flex items-center justify-center gap-1.5 shrink-0"
              >
                <RefreshCw className="w-4 h-4 text-[#FF6B4A]" />
                <span>تبديل</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundManager.play('click');
                  setShowQuestionOrderModal(false);
                }}
                className="flex-1 min-h-[48px] rounded-2xl bakasa-btn-green text-white font-black text-base"
              >
                تمام
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showExitConfirm}
        title="هل أنت متأكد من الخروج؟"
        message="الدور لسه مخلصش، لو خرجت دلوقتي تقدم الجولة الحالية هيتلغي."
        onConfirm={() => {
          soundManager.stopMusic();
          setShowExitConfirm(false);
          onExitToHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
