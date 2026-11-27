import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Gavel, HelpCircle, Minus, Plus, RefreshCw, X } from 'lucide-react';
import { FootballGlobalSettings } from '../../data/footballData';
import { FOOTBALL_AUCTION_PROMPTS, FootballAuctionPrompt } from '../../data/footballExpandedData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { Player, RoundDelta } from '../../types/game';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { ActiveTurnBanner } from '../ActiveTurnBanner';
import { ConfirmModal } from '../ConfirmModal';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { TopBar } from '../TopBar';
import { FootballSettingsBar } from './FootballSettingsBar';

interface FootballAuctionFlowProps {
  players: Player[];
  initialSettings: FootballGlobalSettings;
  onUpdateSettings: (next: FootballGlobalSettings) => void;
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
}

type AuctionPhase = 'READY' | 'BIDDING' | 'VERIFYING' | 'ROUND_RESULT' | 'LEADERBOARD';

export const FootballAuctionFlow: React.FC<FootballAuctionFlowProps> = ({
  players,
  initialSettings,
  onUpdateSettings,
  onApplyDeltas,
  onExitToHub,
  onTournamentFinish,
}) => {
  const guard = useTapGuard(350);

  const [settings, setSettings] = useState<FootballGlobalSettings>(() => ({
    ...initialSettings,
    turnSeconds: initialSettings.turnSeconds < 20 ? 30 : initialSettings.turnSeconds,
    rounds: [1, 2, 3, 5].includes(initialSettings.rounds) ? initialSettings.rounds : 3,
  }));

  const [phase, setPhase] = useState<AuctionPhase>('READY');
  const [roundNum, setRoundNum] = useState<number>(1);
  const [currentPrompt, setCurrentPrompt] = useState<FootballAuctionPrompt>(
    FOOTBALL_AUCTION_PROMPTS[0]
  );
  const [showHint, setShowHint] = useState<boolean>(false);
  const [bidderIndex, setBidderIndex] = useState<number>(0);
  const [targetBid, setTargetBid] = useState<number>(5);

  const [progress, setProgress] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [lastOutcome, setLastOutcome] = useState<{
    won: boolean;
    bidder: Player;
    target: number;
    achieved: number;
    delta: number;
  } | null>(null);

  const [deltasMap, setDeltasMap] = useState<Record<string, number>>({});
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const usedPromptIdsRef = useRef<Set<string>>(new Set());

  const isRoundInProgress = phase === 'BIDDING' || phase === 'VERIFYING';
  useNavigationGuard(isRoundInProgress, () => setShowExitConfirm(true));

  const scopedPrompts = useMemo(() => {
    if (settings.scope === 'both') return FOOTBALL_AUCTION_PROMPTS;
    return FOOTBALL_AUCTION_PROMPTS.filter((p) => p.scope === settings.scope);
  }, [settings.scope]);

  const handleSettingsChange = (next: FootballGlobalSettings) => {
    setSettings(next);
    onUpdateSettings(next);
  };

  const pickNextPrompt = (): FootballAuctionPrompt => {
    let available = scopedPrompts.filter((p) => !usedPromptIdsRef.current.has(p.id));
    if (available.length === 0) {
      usedPromptIdsRef.current.clear();
      available = scopedPrompts;
    }
    const chosen = available[Math.floor(Math.random() * available.length)] ?? scopedPrompts[0];
    usedPromptIdsRef.current.add(chosen.id);
    return chosen;
  };

  const finishVerification = (won: boolean, finalCount: number) => {
    const bidder = players[bidderIndex] ?? players[0];
    const delta = won ? targetBid * 15 : -15;
    const updated = {
      ...deltasMap,
      [bidder.id]: (deltasMap[bidder.id] ?? 0) + delta,
    };
    setDeltasMap(updated);
    setLastOutcome({
      won,
      bidder,
      target: targetBid,
      achieved: finalCount,
      delta,
    });
    if (won) {
      soundManager.play('victory');
      triggerHaptic([30, 40, 50]);
    } else {
      soundManager.play('error');
      triggerHaptic(55);
    }
    setPhase('ROUND_RESULT');
  };

  useEffect(() => {
    if (phase !== 'VERIFYING') return;
    if (timeLeft <= 0) {
      finishVerification(progress >= targetBid, progress);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft, progress, targetBid]);

  const handleStartAuction = guard(() => {
    soundManager.unlock();
    soundManager.play('next');
    usedPromptIdsRef.current.clear();
    setRoundNum(1);
    setDeltasMap({});
    setRoundDeltas([]);
    setBidderIndex(0);
    setTargetBid(5);
    setShowHint(false);
    setCurrentPrompt(pickNextPrompt());
    setPhase('BIDDING');
  });

  const handleStartVerifying = guard(() => {
    soundManager.play('next');
    setProgress(0);
    setTimeLeft(settings.turnSeconds);
    setPhase('VERIFYING');
  });

  const handleIncrementAnswer = () => {
    if (phase !== 'VERIFYING') return;
    const next = progress + 1;
    setProgress(next);
    soundManager.play('catch');
    triggerHaptic(20);
    if (next >= targetBid) {
      finishVerification(true, next);
    }
  };

  const handleNextRoundOrFinish = guard(() => {
    soundManager.play('next');
    if (roundNum < settings.rounds) {
      setRoundNum((r) => r + 1);
      setBidderIndex((idx) => (idx + 1) % players.length);
      setTargetBid(5);
      setShowHint(false);
      setCurrentPrompt(pickNextPrompt());
      setPhase('BIDDING');
      return;
    }

    const finalDeltas: RoundDelta[] = players.map((p) => ({
      playerId: p.id,
      delta: deltasMap[p.id] ?? 0,
    }));
    onApplyDeltas(finalDeltas);
    setRoundDeltas(finalDeltas);
    soundManager.play('victory');
    setPhase('LEADERBOARD');
  });

  const selectedBidder = players[bidderIndex] ?? players[0];

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title="تحدي المزاد ⚽"
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
            <div className="rounded-3xl qada-card p-4 text-right">
              <div className="flex items-center gap-2 mb-1.5">
                <Gavel className="w-5 h-5 text-[#16A34A]" />
                <h2 className="text-base sm:text-lg font-black text-[#1E293B] dark:text-[#F8FAFC]">
                  أشهر تحدي كورة: مين يزايد أكتر؟
                </h2>
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                بنديكم شرط كروي، وكل واحد يزايد: «أنا أقدر أقول 5 لاعيبة... لا أنا 7!». أعلى
                مزايد بيدخل التايمر ويثبت كلامه، ولو كسب بياخد 15 نقطة على كل اسم!
              </p>
            </div>

            <FootballSettingsBar
              settings={settings}
              onChange={handleSettingsChange}
              roundOptions={[1, 2, 3, 5]}
              secondsOptions={[20, 30, 45, 60]}
            />

            <button
              type="button"
              onClick={handleStartAuction}
              className="w-full min-h-[56px] rounded-2xl qada-btn-pitch text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
            >
              <Gavel className="w-5 h-5" />
              <span>افتح المزاد! 🔨</span>
            </button>
          </div>
        )}

        {phase === 'BIDDING' && (
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-[#15803D] dark:text-[#34D399] bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-xl">
                جولة {roundNum} من {settings.rounds}
              </span>
              <button
                type="button"
                onClick={() => {
                  soundManager.play('click');
                  setShowHint(false);
                  setCurrentPrompt(pickNextPrompt());
                }}
                className="text-xs font-black text-[#D94E30] dark:text-[#FF8C73] flex items-center gap-1 px-2.5 py-1 rounded-xl qada-glass-pill"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تغيير السؤال</span>
              </button>
            </div>

            {/* Prompt Card */}
            <div className="rounded-3xl qada-card p-5 text-center border-2 border-[#16A34A]/40">
              <span className="inline-block text-[11px] font-black text-[#15803D] dark:text-[#34D399] bg-emerald-100/80 dark:bg-emerald-950/70 px-2.5 py-0.5 rounded-lg mb-2">
                {currentPrompt.scope === 'local' ? 'محلي / عربي 🌍' : 'أوروبا والعالم ⚽'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-[#F8FAFC] leading-snug">
                {currentPrompt.text}
              </h2>

              <button
                type="button"
                onClick={() => {
                  soundManager.play('click');
                  setShowHint((s) => !s);
                }}
                className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>{showHint ? 'إخفاء الأمثلة' : 'شوف أمثلة مساعدة'}</span>
              </button>
              {showHint && (
                <p className="mt-2 text-xs font-bold text-[#0D9488] dark:text-[#2DD4BF] bg-[#F0FDFA] dark:bg-teal-950/50 rounded-xl p-2">
                  مثال: {currentPrompt.hint}
                </p>
              )}
            </div>

            {/* Choose Highest Bidder */}
            <div className="rounded-3xl qada-card p-4">
              <div className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] mb-2.5">
                مين كسب المزاد وهيدخل التحدي؟
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {players.map((p, idx) => {
                  const active = idx === bidderIndex;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setBidderIndex(idx);
                      }}
                      className={`min-h-[42px] px-2.5 rounded-xl text-xs sm:text-sm font-black truncate transition-all ${
                        active
                          ? 'qada-btn-pitch text-white'
                          : 'bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>

              {/* Target Bid Stepper */}
              <div className="mt-4 pt-3 border-t border-[#E7DEC8]/70 dark:border-[#334155]/70 flex items-center justify-between">
                <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC]">
                  الرقم المطلوب:
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setTargetBid((v) => Math.max(2, v - 1));
                    }}
                    className="w-10 h-10 rounded-xl bg-[#FFF9F0] dark:bg-[#0F172A] border-2 border-[#E7DEC8] dark:border-[#334155] flex items-center justify-center font-black"
                    aria-label="نقص الرقم"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-2xl font-black text-[#16A34A] dark:text-[#34D399] tabular-nums min-w-[36px] text-center">
                    {targetBid}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setTargetBid((v) => Math.min(20, v + 1));
                    }}
                    className="w-10 h-10 rounded-xl bg-[#FFF9F0] dark:bg-[#0F172A] border-2 border-[#E7DEC8] dark:border-[#334155] flex items-center justify-center font-black"
                    aria-label="زود الرقم"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartVerifying}
              className="w-full min-h-[56px] rounded-2xl bakasa-btn-green text-white text-lg sm:text-xl font-black transition-transform"
            >
              ابدأ العداد لـ {selectedBidder.name} ({targetBid} في {settings.turnSeconds}ث) 🔥
            </button>
          </div>
        )}

        {phase === 'VERIFYING' && (
          <div className="w-full flex flex-col gap-4">
            <ActiveTurnBanner
              label="المزايد:"
              player={selectedBidder}
              badgeText={`${progress} / ${targetBid}`}
              accent="emerald"
            />

            {/* Countdown Bar */}
            <div className="rounded-2xl qada-card p-3">
              <div className="flex items-center justify-between text-xs font-black mb-1.5">
                <span className="text-[#64748B] dark:text-[#94A3B8]">الوقت المتبقي</span>
                <span
                  className={`text-base tabular-nums ${
                    timeLeft <= 5
                      ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                      : 'text-[#15803D] dark:text-[#34D399]'
                  }`}
                >
                  {timeLeft} ثانية
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    timeLeft <= 5 ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.max(0, Math.min(100, (timeLeft / settings.turnSeconds) * 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* Prompt + Big Counter */}
            <div className="rounded-3xl qada-card p-5 text-center">
              <p className="text-sm font-black text-[#475569] dark:text-[#CBD5E1] mb-3">
                {currentPrompt.text}
              </p>
              <div className="text-5xl font-black text-[#16A34A] dark:text-[#34D399] tabular-nums">
                {progress} <span className="text-2xl text-[#64748B]">/ {targetBid}</span>
              </div>
              <p className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] mt-1">
                دوس «صح +1» مع كل إجابة صح يقولها {selectedBidder.name}
              </p>
            </div>

            <button
              type="button"
              onClick={handleIncrementAnswer}
              className="w-full min-h-[76px] rounded-3xl bakasa-btn-green text-white text-2xl font-black flex items-center justify-center gap-2.5 active:scale-95 transition-transform"
            >
              <Check className="w-7 h-7" />
              <span>صح +1 ✅</span>
            </button>

            <button
              type="button"
              onClick={guard(() => finishVerification(false, progress))}
              className="w-full min-h-[48px] rounded-2xl bakasa-btn-red text-white text-base font-black flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              <span>استسلم / غلط ❌</span>
            </button>
          </div>
        )}

        {phase === 'ROUND_RESULT' && lastOutcome && (
          <div className="w-full flex flex-col gap-4">
            <div
              className={`rounded-3xl p-6 text-center border-2 shadow-lg ${
                lastOutcome.won
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-900 dark:text-emerald-100'
                  : 'bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-900 dark:text-rose-100'
              }`}
            >
              <div className="text-5xl mb-2">{lastOutcome.won ? '🏆🔥' : '😅💔'}</div>
              <h2 className="text-2xl font-black mb-1">
                {lastOutcome.won
                  ? `${lastOutcome.bidder.name} كسب المزاد!`
                  : `هاردلك يا ${lastOutcome.bidder.name}!`}
              </h2>
              <p className="text-sm font-bold opacity-90">
                جاب {lastOutcome.achieved} من أصل {lastOutcome.target} مطلوبين
              </p>
              <div className="mt-3 inline-block rounded-2xl bg-white/80 dark:bg-black/30 px-4 py-1.5 text-lg font-black tabular-nums">
                {lastOutcome.delta > 0 ? `+${lastOutcome.delta} نقطة` : `${lastOutcome.delta} نقطة`}
              </div>
            </div>

            <button
              type="button"
              onClick={handleNextRoundOrFinish}
              className="w-full min-h-[56px] rounded-2xl qada-btn-pitch text-white text-xl font-black"
            >
              {roundNum < settings.rounds ? 'السؤال اللي بعده ➡️' : 'الترتيب النهائي 🏆'}
            </button>
          </div>
        )}

        {phase === 'LEADERBOARD' && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline="نتائج تحدي المزاد في الكورة 🔨⚽"
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
        message="المزاد شغال دلوقتي، لو خرجت الجولة هتتلغي."
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
