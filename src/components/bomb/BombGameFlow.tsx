import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bomb, Flame, Lock, RefreshCw, Skull } from 'lucide-react';
import {
  BANNER_COLOR_CLASSES,
  BOMB_PROMPTS,
  BOMB_QUESTION_CATEGORIES,
  CLASSIC_BOMB_CATEGORIES,
  CLASSIC_BOMB_TOPICS,
} from '../../data/gameData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { BombPhase, Player, RoundDelta } from '../../types/game';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { recordBombExplosion } from '../../utils/sessionStats';
import { getCustomContent } from '../../utils/customContentStorage';
import { pickUnseenItem } from '../../utils/usedItemsMemory';
import { ActiveTurnBanner } from '../ActiveTurnBanner';
import { CategoryFilterBar } from '../CategoryFilterBar';
import { ConfirmModal } from '../ConfirmModal';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { PlayerAvatar } from '../PlayerAvatar';
import { TopBar } from '../TopBar';

interface BombGameFlowProps {
  mode: 'questions' | 'classic';
  players: Player[];
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
}

function lerpColor(t: number): string {
  // Interpolate dark slate (#1e293b) -> crimson (#b91c1c) -> glowing red (#ef4444)
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.5) {
    const k = clamped * 2;
    const r = Math.round(30 + (185 - 30) * k);
    const g = Math.round(41 + (28 - 41) * k);
    const b = Math.round(59 + (28 - 59) * k);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const k = (clamped - 0.5) * 2;
  const r = Math.round(185 + (239 - 185) * k);
  const g = Math.round(28 + (68 - 28) * k);
  const b = Math.round(28 + (68 - 28) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

export const BombGameFlow: React.FC<BombGameFlowProps> = ({
  mode,
  players,
  onApplyDeltas,
  onExitToHub,
  onTournamentFinish,
}) => {
  const guard = useTapGuard(400);
  const isClassic = mode === 'classic';
  const gameTitle = isClassic ? 'القنبلة' : 'أسئلة القنبلة';

  const categoryBank = useMemo(() => {
    const base = isClassic ? CLASSIC_BOMB_CATEGORIES : BOMB_QUESTION_CATEGORIES;
    const custom = getCustomContent();
    const customList = isClassic ? custom.words : custom.questions;
    if (customList.length === 0) return base;
    const customCat = {
      id: isClassic ? '__custom_bomb_words__' : '__custom_bomb_questions__',
      name: isClassic ? 'كلماتك الخاصة ✍️' : 'أسئلتك الخاصة ✍️',
      items: customList,
    };
    if (custom.mode === 'custom_only') return [customCat];
    return [customCat, ...base];
  }, [isClassic]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<BombPhase>('READY');
  const [currentPrompt, setCurrentPrompt] = useState<string>(() => {
    if (!isClassic) return '';
    const custom = getCustomContent();
    const initialPool =
      custom.mode === 'custom_only' && custom.words.length > 0
        ? custom.words
        : [...custom.words, ...CLASSIC_BOMB_TOPICS];
    return pickUnseenItem('bomb_classic:all', initialPool);
  });
  const [urgencyLevel, setUrgencyLevel] = useState<'idle' | 'medium' | 'urgent'>('idle');
  const [bombProgress, setBombProgress] = useState<number>(0);
  const [explodingFlash, setExplodingFlash] = useState<boolean>(false);
  const [currentHolderIdx, setCurrentHolderIdx] = useState<number>(0);
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [loserName, setLoserName] = useState<string>('');
  const [passFlash, setPassFlash] = useState<boolean>(false);
  const [shaking, setShaking] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(60000);
  const tickTimeoutRef = useRef<number | null>(null);
  const explodeTimeoutRef = useRef<number | null>(null);
  const blastDelayTimeoutRef = useRef<number | null>(null);
  const urgencyRafRef = useRef<number | null>(null);
  const lastProgressStepRef = useRef<number>(-1);

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
    if (blastDelayTimeoutRef.current !== null) {
      window.clearTimeout(blastDelayTimeoutRef.current);
      blastDelayTimeoutRef.current = null;
    }
    if (urgencyRafRef.current !== null) {
      window.cancelAnimationFrame(urgencyRafRef.current);
      urgencyRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearBombTimers();
  }, [clearBombTimers]);

  const activeCategories = useMemo(
    () =>
      selectedCategoryIds.length === 0
        ? categoryBank
        : categoryBank.filter((cat) => selectedCategoryIds.includes(cat.id)),
    [categoryBank, selectedCategoryIds]
  );

  const pooledItems = useMemo(
    () => Array.from(new Set(activeCategories.flatMap((cat) => cat.items))),
    [activeCategories]
  );

  const bucketKey = useMemo(
    () =>
      `${isClassic ? 'bomb_classic' : 'bomb_questions'}:${
        selectedCategoryIds.length === 0 ? 'all' : [...selectedCategoryIds].sort().join(',')
      }`,
    [isClassic, selectedCategoryIds]
  );

  const advancePrompt = useCallback(() => {
    const fallback = isClassic ? CLASSIC_BOMB_TOPICS : BOMB_PROMPTS;
    const source = pooledItems.length > 0 ? pooledItems : fallback;
    setCurrentPrompt(pickUnseenItem(bucketKey, source));
  }, [bucketKey, isClassic, pooledItems]);

  const handleCategoryFilterChange = useCallback(
    (nextIds: string[]) => {
      setSelectedCategoryIds(nextIds);
      if (isClassic) {
        const nextCats =
          nextIds.length === 0
            ? categoryBank
            : categoryBank.filter((cat) => nextIds.includes(cat.id));
        const nextPool = Array.from(new Set(nextCats.flatMap((cat) => cat.items)));
        const nextBucket = `bomb_classic:${
          nextIds.length === 0 ? 'all' : [...nextIds].sort().join(',')
        }`;
        const source = nextPool.length > 0 ? nextPool : CLASSIC_BOMB_TOPICS;
        setCurrentPrompt(pickUnseenItem(nextBucket, source));
      }
    },
    [categoryBank, isClassic]
  );

  const startBombRound = guard(() => {
    soundManager.unlock();
    clearBombTimers();

    const hiddenSeconds = Math.floor(Math.random() * (180 - 30 + 1)) + 30;
    const hiddenMs = hiddenSeconds * 1000;
    durationRef.current = hiddenMs;
    startTimeRef.current = performance.now();
    lastProgressStepRef.current = 0;

    if (!isClassic) {
      advancePrompt();
    }

    setUrgencyLevel('idle');
    setBombProgress(0);
    setExplodingFlash(false);
    setCurrentHolderIdx(0);
    setRoundDeltas([]);
    setLoserName('');
    setPhase('ACTIVE');

    explodeTimeoutRef.current = window.setTimeout(() => {
      clearBombTimers();
      soundManager.play('explosion');
      triggerHaptic(180);
      setBombProgress(1);
      setShaking(true);
      setExplodingFlash(true);
      window.setTimeout(() => setShaking(false), 600);
      blastDelayTimeoutRef.current = window.setTimeout(() => {
        setExplodingFlash(false);
        setPhase('EXPLODED');
      }, 3000);
    }, hiddenMs);

    const scheduleNextTick = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const progress = Math.min(1, elapsed / durationRef.current);
      if (progress >= 0.995) return;

      soundManager.play(progress > 0.78 ? 'tickUrgent' : 'tick', progress);

      const nextInterval = Math.max(140, 950 - Math.pow(progress, 1.4) * 810);
      tickTimeoutRef.current = window.setTimeout(scheduleNextTick, nextInterval);
    };

    tickTimeoutRef.current = window.setTimeout(scheduleNextTick, 450);

    const updateVisualUrgency = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const progress = Math.min(1, elapsed / durationRef.current);
      if (progress >= 1) return;

      const step = Math.floor(progress * 25);
      if (step !== lastProgressStepRef.current) {
        lastProgressStepRef.current = step;
        setBombProgress(progress);
      }

      if (progress > 0.75) {
        setUrgencyLevel('urgent');
      } else if (progress > 0.45) {
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
    if (players.length > 0) {
      setCurrentHolderIdx((prev) => (prev + 1) % players.length);
    }
    setPassFlash(true);
    window.setTimeout(() => setPassFlash(false), 180);
  });

  const handleAdvanceClassicHolder = () => {
    if (players.length === 0) return;
    soundManager.play('click');
    setCurrentHolderIdx((prev) => (prev + 1) % players.length);
    setPassFlash(true);
    window.setTimeout(() => setPassFlash(false), 150);
  };

  const handleSelectLoser = guard((loser: Player) => {
    soundManager.play('defeat');
    triggerHaptic(30);
    recordBombExplosion(loser.id);
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

  const handleNewRound = () => {
    if (isClassic) {
      advancePrompt();
      setUrgencyLevel('idle');
      setBombProgress(0);
      setPhase('READY');
    } else {
      startBombRound();
    }
  };

  const displayPrompt =
    currentPrompt || (isClassic ? CLASSIC_BOMB_TOPICS[0] : BOMB_PROMPTS[0]);

  const bombBodyColor = lerpColor(Math.pow(bombProgress, 1.15));
  const bombScale = 1 + bombProgress * 0.14;
  // Spark tip moves closer along the fuse curve as bombProgress approaches 1
  const sparkX = 172 - bombProgress * 44;
  const sparkY = 34 + Math.sin(bombProgress * Math.PI) * 14 + bombProgress * 16;

  return (
    <div
      className={`relative min-h-screen flex flex-col overflow-hidden ${
        shaking ? 'animate-screen-shake' : ''
      }`}
    >
      {phase === 'ACTIVE' && urgencyLevel === 'urgent' && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10 shadow-[inset_0_0_95px_34px_rgba(239,68,68,0.82)] animate-danger-vignette"
        />
      )}

      {/* Full-Screen Radial Blast Overlay (exactly 3 seconds) */}
      {explodingFlash && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-rose-600/45 backdrop-blur-[2px]"
        >
          <div className="w-[340px] h-[340px] rounded-full bg-gradient-to-br from-amber-300 via-orange-500 to-rose-600 animate-blast-expand shadow-[0_0_95px_45px_rgba(249,115,22,0.85)]" />
          <div className="absolute text-5xl sm:text-6xl font-black text-white drop-shadow-[0_6px_14px_rgba(0,0,0,0.7)] animate-boom-text-3s">
            بوووم! 💥
          </div>
        </div>
      )}

      <TopBar
        title={phase === 'LEADERBOARD' ? 'النتيجة' : gameTitle}
        exitVariant={isRoundInProgress ? 'exit' : 'back'}
        exitLabel={isRoundInProgress ? 'خروج' : 'رجوع'}
        onExit={handleHeaderExit}
      />

      <main className="relative z-20 flex-1 w-full max-w-xl mx-auto px-4 pb-8 pt-2 flex flex-col">
        {/* PHASE 1: READY */}
        {phase === 'READY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            <div className="w-32 h-32 mb-5 rounded-3xl bg-gradient-to-br from-[#FF6B4A] to-[#F59E0B] border-4 border-white dark:border-[#334155] shadow-lg flex items-center justify-center">
              {isClassic ? (
                <Bomb className="w-16 h-16 text-white animate-bomb-idle" />
              ) : (
                <Flame className="w-16 h-16 text-white animate-bomb-idle" />
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-[#1E293B] dark:text-white mb-2">{gameTitle}</h2>

            {isClassic ? (
              <>
                <p className="text-sm sm:text-base font-bold text-[#64748B] dark:text-[#94A3B8] max-w-sm leading-relaxed mb-5">
                  الموضوع ده هيفضل ثابت طول الدور — مرّروا التليفون بسرعة وكل واحد يقول إجابة
                  تنفع في الموضوع قبل ما القنبلة تنفجر!
                </p>

                <div className="w-full max-w-md rounded-3xl qada-card p-6 mb-4">
                  <div className="text-xs font-extrabold text-[#EA7A18] dark:text-amber-400 mb-2">موضوع الجولة:</div>
                  <p className="text-2xl sm:text-3xl font-black text-[#1E293B] dark:text-white leading-snug">
                    {displayPrompt}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={guard(() => {
                    soundManager.play('click');
                    advancePrompt();
                  })}
                  className="mb-5 min-h-[42px] px-4 rounded-xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] text-xs sm:text-sm font-black text-[#1E293B] dark:text-white flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-[#FF6B4A]" />
                  <span>تغيير الموضوع</span>
                </button>
              </>
            ) : (
              <p className="text-base font-bold text-[#64748B] dark:text-[#94A3B8] max-w-sm leading-relaxed mb-5">
                هيظهر لك سؤال سريع — جاوب بصوت عالي واضغط{' '}
                <span className="text-[#059669] dark:text-emerald-400 font-black">&quot;جاوبت - اللي بعده!&quot;</span>{' '}
                عشان يتغير السؤال ويمرر الموبايل بسرعة! الوقت مخفي بين ٣٠ ثانية و٣ دقايق.
              </p>
            )}

            <div className="w-full max-w-md mb-6">
              <CategoryFilterBar
                categories={categoryBank.map((c) => ({
                  id: c.id,
                  name: c.name,
                  count: c.items.length,
                }))}
                selectedIds={selectedCategoryIds}
                onChange={handleCategoryFilterChange}
                totalAvailable={pooledItems.length}
                unitLabel={isClassic ? 'موضوع' : 'سؤال'}
                accentColor={isClassic ? 'amber' : 'coral'}
              />
            </div>

            <button
              type="button"
              onClick={startBombRound}
              className="w-full max-w-[270px] min-h-[58px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
            >
              {isClassic ? 'ابدأ' : 'ابدأ القنبلة!'}
            </button>
          </div>
        )}

        {/* PHASE 2: ACTIVE GAMEPLAY WITH ANIMATED CHARACTER BOMB */}
        {phase === 'ACTIVE' && (
          <div className="flex-1 flex flex-col items-center justify-between py-2">
            {players.length > 0 && (
              <ActiveTurnBanner
                label="الموبايل دلوقتي مع:"
                player={players[currentHolderIdx % players.length]}
                badgeText={
                  players.length > 1
                    ? `اللي بعده: ${players[(currentHolderIdx + 1) % players.length]?.name}`
                    : undefined
                }
                accent={urgencyLevel === 'urgent' ? 'rose' : 'amber'}
              />
            )}
            <div className="flex-1 flex flex-col items-center justify-center w-full py-2">
              <div
                style={{ transform: `scale(${bombScale})`, transition: 'transform 0.2s ease-out' }}
                className="mb-2"
              >
                <div
                  className={`relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center ${
                    urgencyLevel === 'urgent'
                      ? 'animate-bomb-urgent'
                      : urgencyLevel === 'medium'
                        ? 'animate-bomb-medium'
                        : 'animate-bomb-idle'
                  }`}
                >
                  <svg
                    viewBox="0 0 200 200"
                    className="w-full h-full drop-shadow-[0_14px_22px_rgba(30,41,59,0.28)]"
                    aria-hidden="true"
                  >
                    {/* Fuse Cap */}
                    <rect x="82" y="42" width="32" height="18" rx="5" fill="#475569" />
                    <path
                      d="M126 52 Q148 22 172 34"
                      stroke="#78350F"
                      strokeWidth="7"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.35"
                    />
                    {/* Active Burning Fuse */}
                    <path
                      d={`M102 46 Q128 38 ${sparkX} ${sparkY}`}
                      stroke="#D97706"
                      strokeWidth="6.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    {/* Glowing Spark Tip */}
                    <circle
                      cx={sparkX}
                      cy={sparkY}
                      r={urgencyLevel === 'urgent' ? 14 : 10}
                      fill={urgencyLevel === 'urgent' ? '#EF4444' : '#FBBF24'}
                      opacity="0.9"
                    />
                    <circle cx={sparkX} cy={sparkY} r="5.5" fill="#FFFFFF" />

                    {/* Bomb Sphere shifting color with progress */}
                    <circle
                      cx="96"
                      cy="118"
                      r="64"
                      fill={bombBodyColor}
                      stroke={urgencyLevel === 'urgent' ? '#FCA5A5' : '#334155'}
                      strokeWidth={urgencyLevel === 'urgent' ? '4' : '3'}
                    />
                    {/* Specular Highlight */}
                    <ellipse
                      cx="70"
                      cy="90"
                      rx="18"
                      ry="10"
                      transform="rotate(-28 70 90)"
                      fill="#FFFFFF"
                      opacity="0.18"
                    />

                    {/* Sweat drops appearing as bomb heats up */}
                    {bombProgress > 0.32 && (
                      <g className="animate-sweat-drop">
                        <path
                          d="M48 92 C44 99, 44 104, 48 106 C52 104, 52 99, 48 92 Z"
                          fill="#38BDF8"
                        />
                      </g>
                    )}
                    {bombProgress > 0.62 && (
                      <g className="animate-sweat-drop" style={{ animationDelay: '0.35s' }}>
                        <path
                          d="M144 96 C140 103, 140 108, 144 110 C148 108, 148 103, 144 96 Z"
                          fill="#38BDF8"
                        />
                      </g>
                    )}

                    {/* Character Face (calm/nervous -> angry/panicking) */}
                    {/* Eyes */}
                    <ellipse cx="77" cy="112" rx="8.5" ry={bombProgress > 0.72 ? '10' : '8.5'} fill="#FFFFFF" />
                    <ellipse cx="115" cy="112" rx="8.5" ry={bombProgress > 0.72 ? '10' : '8.5'} fill="#FFFFFF" />
                    <circle cx="78" cy="113" r={bombProgress > 0.72 ? '3.5' : '4.5'} fill="#0F172A" />
                    <circle cx="114" cy="113" r={bombProgress > 0.72 ? '3.5' : '4.5'} fill="#0F172A" />

                    {/* Eyebrows shifting from worried to furious V-shape */}
                    {bombProgress > 0.48 ? (
                      <>
                        <line x1="65" y1="96" x2="86" y2="103" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
                        <line x1="127" y1="96" x2="106" y2="103" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
                      </>
                    ) : (
                      <>
                        <line x1="66" y1="100" x2="85" y2="97" stroke="#CBD5E1" strokeWidth="3.5" strokeLinecap="round" />
                        <line x1="126" y1="100" x2="107" y2="97" stroke="#CBD5E1" strokeWidth="3.5" strokeLinecap="round" />
                      </>
                    )}

                    {/* Mouth: nervous wavy -> open panicked grimace */}
                    {bombProgress > 0.72 ? (
                      <path
                        d="M78 139 L85 133 L92 140 L100 133 L107 140 L114 134"
                        stroke="#FDE047"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    ) : bombProgress > 0.38 ? (
                      <path
                        d="M80 137 Q88 131 96 137 Q104 143 112 137"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        fill="none"
                      />
                    ) : (
                      <line
                        x1="82"
                        y1="137"
                        x2="110"
                        y2="137"
                        stroke="#E2E8F0"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                </div>
              </div>

              {/* Prompt / Locked Topic Card */}
              <div
                className={`w-full max-w-md rounded-3xl border-2 border-b-[6px] p-6 text-center shadow-lg transition-colors duration-150 ${
                  passFlash
                    ? 'bg-[#ECFDF5] dark:bg-emerald-950/80 border-[#10B981] border-b-[#059669]'
                    : isClassic
                      ? 'bg-white dark:bg-[#1E293B] border-[#F59E0B] border-b-[#D97706]'
                      : 'bg-white dark:bg-[#1E293B] border-[#E7DEC8] dark:border-[#334155] border-b-[#D5C7B2] dark:border-b-[#0B1120]'
                }`}
              >
                <div className="text-xs font-extrabold text-[#D94E30] dark:text-[#FB7185] mb-2 flex items-center justify-center gap-1.5">
                  {isClassic ? (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>الموضوع الثابت — مرّر التليفون بسرعة!</span>
                    </>
                  ) : (
                    <>
                      <Flame className="w-4 h-4" />
                      <span>جاوب بسرعة وباصي الموبايل</span>
                    </>
                  )}
                </div>
                <p className="text-2xl sm:text-3xl font-black text-[#1E293B] dark:text-white leading-snug">
                  {displayPrompt}
                </p>
              </div>

              {!isClassic && (
                <button
                  type="button"
                  onClick={guard(() => {
                    soundManager.play('click');
                    advancePrompt();
                  })}
                  className="mt-3 min-h-[40px] px-4 rounded-xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] text-xs font-black text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#FF6B4A]" />
                  <span>تغيير السؤال</span>
                </button>
              )}
            </div>

            {!isClassic ? (
              <div className="w-full max-w-md pt-3">
                <button
                  type="button"
                  onClick={handlePassedBomb}
                  className="w-full min-h-[68px] rounded-2xl bakasa-btn-green text-white text-2xl font-black tracking-wide transition-transform"
                >
                  جاوبت - اللي بعده!
                </button>
              </div>
            ) : (
              <div className="w-full max-w-md pt-3 flex flex-col gap-2 text-center">
                <button
                  type="button"
                  onClick={handleAdvanceClassicHolder}
                  className="w-full min-h-[58px] rounded-2xl bakasa-btn-green text-white text-xl font-black tracking-wide transition-transform"
                >
                  قلت إجابة — باصي للي بعده!
                </button>
                <div className="text-xs font-extrabold text-[#B45309] dark:text-amber-300">
                  كل لاعب يقول إجابة ويدي الموبايل للي جنبه فوراً!
                </div>
              </div>
            )}
          </div>
        )}

        {/* PHASE 3: EXPLODED - SELECT HOLDER */}
        {phase === 'EXPLODED' && (
          <div className="flex-1 flex flex-col items-center py-4">
            <div className="w-full max-w-md rounded-3xl bg-[#FFF1F2] dark:bg-rose-950/75 border-2 border-[#F43F5E] border-b-[6px] border-b-[#BE123C] p-5 text-center shadow-lg mb-5 animate-splash-pop">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#FFE4E6] dark:bg-rose-900/70 border-2 border-[#FDA4AF] dark:border-rose-700 flex items-center justify-center text-[#E11D48] dark:text-rose-200">
                <Skull className="w-9 h-9" />
              </div>
              <h2 className="text-3xl font-black text-[#BE123C] dark:text-rose-200 mb-1">بوووم! انفجرت!</h2>
              <p className="text-sm sm:text-base font-bold text-[#475569] dark:text-rose-100">
                التليفون كان في إيد مين لما انفجرت؟ (يتخصم منه ١٠٠ نقطة)
              </p>
            </div>

            <div className="w-full max-w-md flex flex-col gap-3.5">
              {players.map((player) => {
                const style = BANNER_COLOR_CLASSES[player.color];
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handleSelectLoser(player)}
                    className={`w-full min-h-[64px] rounded-2xl ${style.bg} ${style.shadow} border ${style.border} px-4 py-2 flex items-center justify-between gap-3 text-right transition-transform active:scale-95 hover:brightness-105`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerAvatar avatarId={player.avatarId} name={player.name} size="md" />
                      <span className="text-lg font-black text-white truncate">
                        {player.name}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-xl bg-white/95 px-3 py-1 text-xs font-black text-[#BE123C] tabular-nums shadow-sm">
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
            isTournamentMode={Boolean(onTournamentFinish)}
            onNewRound={handleNewRound}
            onFinishGame={() => {
              clearBombTimers();
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
