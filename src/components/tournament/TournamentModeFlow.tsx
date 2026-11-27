import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  Crown,
  Dices,
  ListChecks,
  Play,
  SkipForward,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { FootballGlobalSettings } from '../../data/footballData';
import { BANNER_COLOR_CLASSES } from '../../data/gameData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { Player, RoundDelta } from '../../types/game';
import { formatNumber } from '../../utils/formatNumber';
import { getScoreboardRankMap } from '../../utils/scoreboardMood';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { shareStoryCardImage } from '../../utils/storyCardShare';
import { ConfirmModal } from '../ConfirmModal';
import { LoserPunishmentCard } from '../LoserPunishmentCard';
import { PlayerAvatar } from '../PlayerAvatar';
import { SubtleConfettiBurst } from '../SubtleConfettiBurst';
import { TopBar } from '../TopBar';
import { BalanceTowerGame } from '../arcade/BalanceTowerGame';
import { BombGameFlow } from '../bomb/BombGameFlow';
import { DrawGameFlow } from '../draw/DrawGameFlow';
import { ClubChainGameFlow } from '../football/ClubChainGameFlow';
import { FootballAuctionFlow } from '../football/FootballAuctionFlow';
import { FootballCharadesFlow } from '../football/FootballCharadesFlow';
import { FootballPasswordFlow } from '../football/FootballPasswordFlow';
import { FootballThreeGameFlow } from '../football/FootballThreeGameFlow';
import { FootballTicTacToeFlow } from '../football/FootballTicTacToeFlow';
import { PenaltyShootoutFlow } from '../football/PenaltyShootoutFlow';
import { ForgerGameFlow } from '../forger/ForgerGameFlow';
import { HeadsUpGameFlow } from '../headsup/HeadsUpGameFlow';
import { SpyGameFlow } from '../spy/SpyGameFlow';

interface TournamentModeFlowProps {
  players: Player[];
  footballSettings: FootballGlobalSettings;
  onUpdateFootballSettings: (next: FootballGlobalSettings) => void;
  onEditPlayers: () => void;
  onExitToHome: () => void;
}

type TournamentGameId =
  | 'spy'
  | 'headsup'
  | 'bomb_questions'
  | 'bomb_classic'
  | 'draw'
  | 'forger'
  | 'football_spy'
  | 'football_password'
  | 'football_chain'
  | 'football_three'
  | 'football_charades'
  | 'football_penalty'
  | 'football_auction'
  | 'football_tictactoe'
  | 'balance';

interface TournamentGameMeta {
  id: TournamentGameId;
  title: string;
  section: 'ألعاب القعدة' | 'قعدة اللاعيبة ⚽' | 'تحدي 2D';
  minPlayers?: number;
}

const TOURNAMENT_CATALOG: TournamentGameMeta[] = [
  { id: 'spy', title: 'الجاسوس (بره القعدة)', section: 'ألعاب القعدة' },
  { id: 'headsup', title: 'بدون كلام 🎭', section: 'ألعاب القعدة' },
  { id: 'bomb_questions', title: 'أسئلة القنبلة', section: 'ألعاب القعدة' },
  { id: 'bomb_classic', title: 'القنبلة', section: 'ألعاب القعدة' },
  { id: 'draw', title: 'رسمة في 10 ثواني', section: 'ألعاب القعدة' },
  { id: 'forger', title: 'المزور (3+)', section: 'ألعاب القعدة', minPlayers: 3 },
  { id: 'football_spy', title: 'جاسوس الكورة', section: 'قعدة اللاعيبة ⚽' },
  { id: 'football_password', title: 'كلمة السر', section: 'قعدة اللاعيبة ⚽' },
  { id: 'football_chain', title: 'قول اسم لاعب', section: 'قعدة اللاعيبة ⚽' },
  { id: 'football_three', title: 'تحدي الـ 3 في الكورة', section: 'قعدة اللاعيبة ⚽' },
  { id: 'football_charades', title: 'خمن في الكورة', section: 'قعدة اللاعيبة ⚽' },
  { id: 'football_penalty', title: 'ضربات الجزاء', section: 'قعدة اللاعيبة ⚽' },
  { id: 'football_auction', title: 'تحدي المزاد', section: 'قعدة اللاعيبة ⚽' },
  { id: 'football_tictactoe', title: 'إكس أو الكورة', section: 'قعدة اللاعيبة ⚽' },
  { id: 'balance', title: 'برج التوازن 🐘', section: 'تحدي 2D' },
];

type TournamentPhase = 'SETUP' | 'TRANSITION' | 'PLAYING' | 'FINAL_PODIUM';

export const TournamentModeFlow: React.FC<TournamentModeFlowProps> = ({
  players,
  footballSettings,
  onUpdateFootballSettings,
  onEditPlayers,
  onExitToHome,
}) => {
  const guard = useTapGuard(350);

  const [phase, setPhase] = useState<TournamentPhase>('SETUP');
  const [gameCount, setGameCount] = useState<3 | 5 | 7>(5);
  const [pickMode, setPickMode] = useState<'random' | 'custom'>('random');
  const [customSelectedIds, setCustomSelectedIds] = useState<TournamentGameId[]>([
    'spy',
    'headsup',
    'bomb_questions',
    'football_auction',
    'balance',
  ]);

  const [lineup, setLineup] = useState<TournamentGameId[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [tournamentPlayers, setTournamentPlayers] = useState<Player[]>(() =>
    players.map((p) => ({ ...p, score: 0 }))
  );
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [selectedDare, setSelectedDare] = useState<string | null>(null);
  const [storyStatus, setStoryStatus] = useState<'idle' | 'sharing' | 'done'>('idle');

  // Keep player list synced during setup
  useEffect(() => {
    if (phase === 'SETUP') {
      setTournamentPlayers(players.map((p) => ({ ...p, score: 0 })));
    }
  }, [phase, players]);

  useEffect(() => {
    if (storyStatus !== 'done') return;
    const t = window.setTimeout(() => setStoryStatus('idle'), 2600);
    return () => window.clearTimeout(t);
  }, [storyStatus]);

  useNavigationGuard(phase === 'TRANSITION' || phase === 'PLAYING', () => {
    setShowExitConfirm(true);
  });

  const eligibleCatalog = useMemo(
    () => TOURNAMENT_CATALOG.filter((g) => (g.minPlayers ?? 2) <= players.length),
    [players.length]
  );

  const toggleCustomGame = (id: TournamentGameId) => {
    soundManager.play('click');
    setCustomSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) {
          soundManager.play('error');
          return prev;
        }
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const handleStartTournament = guard(() => {
    soundManager.unlock();
    soundManager.play('victory');
    triggerHaptic([25, 35, 45]);

    let finalLineup: TournamentGameId[] = [];
    if (pickMode === 'random') {
      const shuffled = [...eligibleCatalog].sort(() => Math.random() - 0.5);
      finalLineup = shuffled.slice(0, Math.min(gameCount, shuffled.length)).map((g) => g.id);
    } else {
      const eligibleIds = customSelectedIds.filter((id) =>
        eligibleCatalog.some((g) => g.id === id)
      );
      finalLineup =
        eligibleIds.length > 0 ? eligibleIds : eligibleCatalog.slice(0, 3).map((g) => g.id);
    }

    setTournamentPlayers(players.map((p) => ({ ...p, score: 0 })));
    setLineup(finalLineup);
    setCurrentIdx(0);
    setSelectedDare(null);
    setPhase('TRANSITION');
  });

  const handleApplyGameDeltas = (deltas: RoundDelta[]) => {
    const map = new Map(deltas.map((d) => [d.playerId, d.delta]));
    setTournamentPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        score: p.score + (map.get(p.id) ?? 0),
      }))
    );
  };

  const handleAdvanceNextGame = () => {
    if (currentIdx + 1 < lineup.length) {
      setCurrentIdx((idx) => idx + 1);
      setPhase('TRANSITION');
    } else {
      soundManager.play('victory');
      triggerHaptic([40, 50, 80]);
      setPhase('FINAL_PODIUM');
    }
  };

  const currentGameId = lineup[currentIdx];
  const currentMeta = TOURNAMENT_CATALOG.find((g) => g.id === currentGameId);

  const sortedStandings = useMemo(
    () => [...tournamentPlayers].sort((a, b) => b.score - a.score),
    [tournamentPlayers]
  );

  // Render active sub-game inside Tournament Mode
  if (phase === 'PLAYING' && currentGameId) {
    const exitCurrentToConfirm = () => setShowExitConfirm(true);
    return (
      <>
        {currentGameId === 'spy' && (
          <SpyGameFlow
            players={tournamentPlayers}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'headsup' && (
          <HeadsUpGameFlow
            players={tournamentPlayers}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'bomb_questions' && (
          <BombGameFlow
            mode="questions"
            players={tournamentPlayers}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'bomb_classic' && (
          <BombGameFlow
            mode="classic"
            players={tournamentPlayers}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'draw' && (
          <DrawGameFlow
            players={tournamentPlayers}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'forger' && (
          <ForgerGameFlow
            players={tournamentPlayers}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'football_spy' && (
          <SpyGameFlow
            variant="football"
            players={tournamentPlayers}
            footballSettings={footballSettings}
            onUpdateFootballSettings={onUpdateFootballSettings}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'football_password' && (
          <FootballPasswordFlow
            players={tournamentPlayers}
            initialSettings={footballSettings}
            onUpdateSettings={onUpdateFootballSettings}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'football_chain' && (
          <ClubChainGameFlow
            players={tournamentPlayers}
            initialSettings={footballSettings}
            onUpdateSettings={onUpdateFootballSettings}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'football_three' && (
          <FootballThreeGameFlow
            players={tournamentPlayers}
            initialSettings={footballSettings}
            onUpdateSettings={onUpdateFootballSettings}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'football_charades' && (
          <FootballCharadesFlow
            players={tournamentPlayers}
            initialSettings={footballSettings}
            onUpdateSettings={onUpdateFootballSettings}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'football_penalty' && (
          <PenaltyShootoutFlow
            players={tournamentPlayers}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'football_auction' && (
          <FootballAuctionFlow
            players={tournamentPlayers}
            initialSettings={footballSettings}
            onUpdateSettings={onUpdateFootballSettings}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'football_tictactoe' && (
          <FootballTicTacToeFlow
            players={tournamentPlayers}
            initialSettings={footballSettings}
            onUpdateSettings={onUpdateFootballSettings}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}
        {currentGameId === 'balance' && (
          <BalanceTowerGame
            players={tournamentPlayers}
            onApplyDeltas={handleApplyGameDeltas}
            onExitToArcadeHub={exitCurrentToConfirm}
            onTournamentFinish={handleAdvanceNextGame}
          />
        )}

        <ConfirmModal
          open={showExitConfirm}
          title="إنهاء السهرة الكاملة؟"
          message="السهرة الكاملة شغالة دلوقتي، لو خرجت للرئيسية البطولة هتتلغي."
          onConfirm={() => {
            setShowExitConfirm(false);
            onExitToHome();
          }}
          onCancel={() => setShowExitConfirm(false)}
        />
      </>
    );
  }

  const champion = sortedStandings[0];
  const rankMap = getScoreboardRankMap(sortedStandings);
  const hasDistinctLoser =
    sortedStandings.length >= 2 &&
    sortedStandings[0].score > sortedStandings[sortedStandings.length - 1].score;
  const lowestScore = hasDistinctLoser ? sortedStandings[sortedStandings.length - 1].score : null;
  const loserNames = hasDistinctLoser
    ? sortedStandings.filter((p) => p.score === lowestScore).map((p) => p.name)
    : [];

  const handleShareFinalStory = async () => {
    if (storyStatus === 'sharing') return;
    soundManager.unlock();
    soundManager.play('click');
    setStoryStatus('sharing');
    const result = await shareStoryCardImage({
      headline: champion ? `بطل السهرة الكاملة: ${champion.name} 👑` : 'نتائج السهرة الكاملة 🏆',
      subtitle: `بطولة من ${lineup.length} ألعاب متواصلة`,
      entries: sortedStandings.map((p) => ({ name: p.name, score: p.score })),
      loserName: loserNames.length > 0 ? loserNames.join(' و ') : null,
      dareText: selectedDare,
    });
    if (result === 'error') {
      soundManager.play('error');
      setStoryStatus('idle');
    } else {
      soundManager.play('victory');
      triggerHaptic(30);
      setStoryStatus('done');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title="وضع السهرة الكاملة 🏆"
        exitVariant="back"
        exitLabel="الرئيسية"
        onExit={() => {
          if (phase === 'TRANSITION') {
            setShowExitConfirm(true);
          } else {
            onExitToHome();
          }
        }}
      />

      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-10 pt-2 flex flex-col items-center">
        {phase === 'SETUP' && (
          <div className="w-full flex flex-col gap-4">
            {/* Hero Intro */}
            <div className="rounded-3xl qada-card p-4 text-right border-2 border-[#F59E0B]/45">
              <div className="flex items-center gap-2 mb-1.5">
                <Trophy className="w-5 h-5 text-[#F59E0B]" />
                <h2 className="text-base sm:text-lg font-black text-[#1E293B] dark:text-[#F8FAFC]">
                  بطولة القعدة الشاملة!
                </h2>
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                العبوا سلسلة ألعاب ورا بعض بنفس اللاعبين، النقط بتتجمع تلقائي، وفي الآخر نتوج بطل
                السهرة وننفذ عقاب الأخير!
              </p>
            </div>

            {/* Active Players Strip */}
            <div className="rounded-3xl qada-card p-3.5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#14B8A6]" />
                  <span className="tabular-nums">المشاركين ({formatNumber(players.length)} لاعبين)</span>
                </span>
                <button
                  type="button"
                  onClick={guard(() => {
                    soundManager.play('click');
                    onEditPlayers();
                  })}
                  className="text-xs font-black text-[#0D9488] dark:text-[#2DD4BF] px-3 py-1 rounded-xl qada-glass-pill"
                >
                  تعديل اللاعبين
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {players.map((p) => (
                  <span
                    key={p.id}
                    className="px-2.5 py-1 rounded-xl bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-xs font-extrabold text-[#1E293B] dark:text-[#F8FAFC]"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Mode Picker: Random 3/5/7 vs Custom Select */}
            <div className="rounded-3xl qada-card p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.play('click');
                    setPickMode('random');
                  }}
                  className={`min-h-[44px] rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all ${
                    pickMode === 'random'
                      ? 'qada-btn-amber text-[#1E293B]'
                      : 'bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                >
                  <Dices className="w-4 h-4" />
                  <span>تشكيلة عشوائية</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.play('click');
                    setPickMode('custom');
                  }}
                  className={`min-h-[44px] rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all ${
                    pickMode === 'custom'
                      ? 'bg-[#14B8A6] text-white shadow-[0_3px_0_#0D9488]'
                      : 'bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                >
                  <ListChecks className="w-4 h-4" />
                  <span>اختار بنفسك</span>
                </button>
              </div>

              {pickMode === 'random' ? (
                <div className="pt-2 border-t border-[#E7DEC8]/60 dark:border-[#334155]/70">
                  <div className="text-xs font-black text-[#1E293B] dark:text-[#F8FAFC] mb-2">
                    عدد ألعاب السهرة:
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([3, 5, 7] as const).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          soundManager.play('click');
                          setGameCount(cnt);
                        }}
                        className={`min-h-[48px] rounded-2xl font-black text-sm flex flex-col items-center justify-center transition-all ${
                          gameCount === cnt
                            ? 'bg-[#FF6B4A] text-white shadow-[0_4px_0_#D94E30]'
                            : 'bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                        }`}
                      >
                        <span className="text-base tabular-nums">{formatNumber(cnt)} ألعاب</span>
                        <span className="text-[10px] opacity-85">
                          {cnt === 3 ? 'سريعة' : cnt === 5 ? 'متوازنة' : 'ماراثون'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-[#E7DEC8]/60 dark:border-[#334155]/70 flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
                  <div className="text-xs font-black text-[#1E293B] dark:text-[#F8FAFC] tabular-nums">
                    اختار الألعاب ({formatNumber(customSelectedIds.length)} مختارة):
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {eligibleCatalog.map((game) => {
                      const active = customSelectedIds.includes(game.id);
                      return (
                        <button
                          key={game.id}
                          type="button"
                          onClick={() => toggleCustomGame(game.id)}
                          className={`min-h-[46px] px-2.5 py-2 rounded-2xl border text-right flex items-center justify-between gap-1.5 text-xs font-black transition-all ${
                            active
                              ? 'bg-[#ECFDF5] dark:bg-emerald-950/70 border-[#10B981] text-[#065F46] dark:text-emerald-200'
                              : 'bg-[#FFF9F0] dark:bg-[#0F172A] border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate">{game.title}</div>
                            <div className="text-[10px] opacity-70 truncate">{game.section}</div>
                          </div>
                          {active && <Check className="w-4 h-4 text-[#059669] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleStartTournament}
              className="w-full min-h-[58px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>ابدأ السهرة الكاملة 🏆</span>
            </button>
          </div>
        )}

        {phase === 'TRANSITION' && currentMeta && (
          <div className="w-full flex flex-col gap-4">
            <div className="rounded-3xl qada-card p-6 text-center border-2 border-[#F59E0B]/55">
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-3 py-1 text-xs font-black text-amber-800 dark:text-amber-300 mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="tabular-nums">
                  اللعبة {formatNumber(currentIdx + 1)} من {formatNumber(lineup.length)}
                </span>
              </div>

              <div className="text-xs font-extrabold text-[#0D9488] dark:text-[#2DD4BF] mb-1">
                {currentMeta.section}
              </div>
              <h2 className="text-3xl font-black text-[#1E293B] dark:text-[#F8FAFC] mb-2">
                {currentMeta.title}
              </h2>
              <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">
                استعدوا! نقط اللعبة دي هتتضاف لترتيب البطولة العام.
              </p>
            </div>

            {/* Live Cumulative Standings Preview */}
            <div className="rounded-3xl qada-card p-4">
              <div className="text-xs font-black text-[#64748B] dark:text-[#94A3B8] mb-2.5">
                الترتيب التراكمي دلوقتي:
              </div>
              <div className="flex flex-col gap-2">
                {sortedStandings.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-2xl bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-black w-5 text-center tabular-nums">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${formatNumber(idx + 1)}.`}
                      </span>
                      <span className="text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] truncate">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-sm font-black text-[#D94E30] dark:text-[#FF8C73] tabular-nums">
                      {formatNumber(p.score)} نقطة
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={guard(() => {
                soundManager.play('next');
                setPhase('PLAYING');
              })}
              className="w-full min-h-[58px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>ابدأ {currentMeta.title}! 🔥</span>
            </button>

            {lineup.length > 1 && (
              <button
                type="button"
                onClick={guard(() => {
                  soundManager.play('click');
                  handleAdvanceNextGame();
                })}
                className="w-full min-h-[44px] rounded-2xl qada-glass-pill text-xs font-black text-[#64748B] dark:text-[#CBD5E1] flex items-center justify-center gap-1.5"
              >
                <SkipForward className="w-4 h-4" />
                <span>تخطي اللعبة دي</span>
              </button>
            )}
          </div>
        )}

        {phase === 'FINAL_PODIUM' && (
          <div className="w-full flex flex-col items-center">
            <SubtleConfettiBurst active />

            {champion && (
              <div className="w-full rounded-3xl qada-card p-6 text-center border-2 border-[#F59E0B] mb-5 relative overflow-hidden">
                <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-amber-100 dark:bg-amber-950/70 border-2 border-amber-400 flex items-center justify-center text-amber-500 animate-bounce">
                  <Crown className="w-7 h-7" />
                </div>
                <div className="text-xs font-black text-[#D97706] dark:text-[#FBBF24] mb-1 tabular-nums">
                  👑 بطل السهرة الكاملة ({formatNumber(lineup.length)} ألعاب)
                </div>
                <div className="flex justify-center my-3">
                  <PlayerAvatar
                    avatarId={champion.avatarId}
                    name={champion.name}
                    size="lg"
                    rank={1}
                    showAllRanks
                    mood="winner"
                  />
                </div>
                <h2 className="text-3xl font-black text-[#1E293B] dark:text-white">
                  {champion.name}
                </h2>
                <div className="mt-1 text-lg font-black text-[#16A34A] dark:text-[#34D399] tabular-nums">
                  {formatNumber(champion.score)} نقطة إجمالية 🏆
                </div>
              </div>
            )}

            {/* Full Podium List */}
            <div className="w-full flex flex-col gap-3 mb-5">
              {sortedStandings.map((player) => {
                const style = BANNER_COLOR_CLASSES[player.color];
                const rankInfo = rankMap.get(player.id);
                const isLastPlace =
                  hasDistinctLoser && lowestScore !== null && player.score === lowestScore;
                return (
                  <div
                    key={player.id}
                    className={`w-full min-h-[64px] rounded-2xl ${style.bg} ${style.shadow} border ${style.border} px-4 py-2 flex items-center justify-between gap-3 ${
                      isLastPlace ? 'ring-3 ring-rose-300/90' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerAvatar
                        avatarId={player.avatarId}
                        name={player.name}
                        size="md"
                        rank={rankInfo?.rank}
                        showAllRanks
                        mood={rankInfo?.mood}
                      />
                      <span className="text-lg font-black text-white truncate">{player.name}</span>
                    </div>
                    <div className="text-center leading-tight shrink-0">
                      <div className="text-xl font-black text-white tabular-nums">
                        {formatNumber(player.score)}
                      </div>
                      <div className="text-[11px] font-bold text-white/90">نقطة</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <LoserPunishmentCard loserNames={loserNames} onDareChange={setSelectedDare} />

            <div className="w-full max-w-[300px] flex flex-col gap-3 mb-3">
              <button
                type="button"
                onClick={handleShareFinalStory}
                disabled={storyStatus === 'sharing'}
                className="w-full min-h-[50px] rounded-2xl qada-btn-amber text-[#1E293B] text-sm font-black flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                {storyStatus === 'done' ? (
                  <>
                    <Check className="w-4 h-4 text-[#059669]" />
                    <span>تم تجهيز صورة الستوري! 📸</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>
                      {storyStatus === 'sharing' ? 'جاري تجهيز الصورة...' : 'صور النتيجة للستوري 📸'}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={guard(() => {
                  soundManager.play('next');
                  setPhase('SETUP');
                })}
                className="w-full min-h-[54px] rounded-2xl bakasa-btn-green text-white text-lg font-black"
              >
                سهرة جديدة 🏆
              </button>

              <button
                type="button"
                onClick={guard(() => {
                  soundManager.play('click');
                  onExitToHome();
                })}
                className="w-full min-h-[48px] rounded-2xl bakasa-btn-red text-white text-base font-black"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        )}
      </main>

      <ConfirmModal
        open={showExitConfirm}
        title="إنهاء السهرة الكاملة؟"
        message="السهرة الكاملة شغالة دلوقتي، لو خرجت للرئيسية نقاط البطولة الحالية هتتلغي."
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitToHome();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
