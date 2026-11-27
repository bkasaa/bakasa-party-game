import React, { useEffect, useState } from 'react';
import { Check, Grid3X3, Lightbulb, RefreshCw, SkipForward, Trophy, X } from 'lucide-react';
import { FootballGlobalSettings } from '../../data/footballData';
import {
  generateValidatedFootballGrid,
  ValidatedTicTacToeGrid,
} from '../../data/footballExpandedData';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { Player, RoundDelta } from '../../types/game';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { ActiveTurnBanner } from '../ActiveTurnBanner';
import { ConfirmModal } from '../ConfirmModal';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { TopBar } from '../TopBar';
import { FootballSettingsBar } from './FootballSettingsBar';

interface FootballTicTacToeFlowProps {
  players: Player[];
  initialSettings: FootballGlobalSettings;
  onUpdateSettings: (next: FootballGlobalSettings) => void;
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
}

type TTTPhase = 'READY' | 'PLAYING' | 'MATCH_OVER' | 'LEADERBOARD';
type Mark = 'X' | 'O';

const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const FootballTicTacToeFlow: React.FC<FootballTicTacToeFlowProps> = ({
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
    turnSeconds: [15, 20, 30, 45].includes(initialSettings.turnSeconds)
      ? initialSettings.turnSeconds
      : 20,
  }));

  const [phase, setPhase] = useState<TTTPhase>('READY');
  const [playerXIdx, setPlayerXIdx] = useState<number>(0);
  const [playerOIdx, setPlayerOIdx] = useState<number>(players.length > 1 ? 1 : 0);

  const [grid, setGrid] = useState<ValidatedTicTacToeGrid>(() =>
    generateValidatedFootballGrid(initialSettings.scope)
  );
  const [board, setBoard] = useState<(Mark | null)[]>(Array(9).fill(null));
  const [turnMark, setTurnMark] = useState<Mark>('X');
  const [timeLeft, setTimeLeft] = useState<number>(settings.turnSeconds);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [showExamples, setShowExamples] = useState<boolean>(false);

  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [winnerMark, setWinnerMark] = useState<Mark | 'DRAW' | null>(null);
  const [deltasMap, setDeltasMap] = useState<Record<string, number>>({});
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const isRoundInProgress = phase === 'PLAYING';
  useNavigationGuard(isRoundInProgress, () => setShowExitConfirm(true));

  const safePlayerXIdx = Math.min(playerXIdx, Math.max(0, players.length - 1));
  const safePlayerOIdx = Math.min(playerOIdx, Math.max(0, players.length - 1));
  const playerX = players[safePlayerXIdx] ?? players[0];
  const playerO = players[safePlayerOIdx] ?? players[1] ?? players[0];
  const currentPlayer = turnMark === 'X' ? playerX : playerO;

  const handleSettingsChange = (next: FootballGlobalSettings) => {
    setSettings(next);
    onUpdateSettings(next);
  };

  const startFreshMatch = (scopeOverride = settings.scope) => {
    setGrid(generateValidatedFootballGrid(scopeOverride));
    setBoard(Array(9).fill(null));
    setTurnMark('X');
    setTimeLeft(settings.turnSeconds);
    setSelectedCell(null);
    setShowExamples(false);
    setWinningLine(null);
    setWinnerMark(null);
  };

  const handleStartGame = guard(() => {
    soundManager.unlock();
    soundManager.play('next');
    setDeltasMap({});
    setRoundDeltas([]);
    startFreshMatch(settings.scope);
    setPhase('PLAYING');
  });

  const handleSkipTurn = () => {
    soundManager.play('error');
    triggerHaptic(20);
    setSelectedCell(null);
    setShowExamples(false);
    setTurnMark((m) => (m === 'X' ? 'O' : 'X'));
    setTimeLeft(settings.turnSeconds);
  };

  useEffect(() => {
    if (phase !== 'PLAYING') return;
    if (timeLeft <= 0) {
      handleSkipTurn();
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
  }, [phase, timeLeft]);

  const handleConfirmCellClaim = () => {
    if (selectedCell === null || board[selectedCell] !== null) return;
    const nextBoard = [...board];
    nextBoard[selectedCell] = turnMark;
    setBoard(nextBoard);
    setSelectedCell(null);
    setShowExamples(false);

    // Check win
    const matchedLine = WIN_LINES.find(
      ([a, b, c]) =>
        nextBoard[a] !== null && nextBoard[a] === nextBoard[b] && nextBoard[a] === nextBoard[c]
    );

    if (matchedLine) {
      soundManager.play('victory');
      triggerHaptic([35, 45, 65]);
      setWinningLine(matchedLine);
      setWinnerMark(turnMark);
      const winner = turnMark === 'X' ? playerX : playerO;
      setDeltasMap((prev) => ({
        ...prev,
        [winner.id]: (prev[winner.id] ?? 0) + 100,
      }));
      setPhase('MATCH_OVER');
      return;
    }

    // Check draw
    if (nextBoard.every((cell) => cell !== null)) {
      soundManager.play('sting');
      setWinnerMark('DRAW');
      setDeltasMap((prev) => ({
        ...prev,
        [playerX.id]: (prev[playerX.id] ?? 0) + 30,
        [playerO.id]: (prev[playerO.id] ?? 0) + 30,
      }));
      setPhase('MATCH_OVER');
      return;
    }

    soundManager.play('catch');
    triggerHaptic(20);
    setTurnMark((m) => (m === 'X' ? 'O' : 'X'));
    setTimeLeft(settings.turnSeconds);
  };

  const handleGoToLeaderboard = guard(() => {
    soundManager.play('victory');
    const finalDeltas: RoundDelta[] = players.map((p) => ({
      playerId: p.id,
      delta: deltasMap[p.id] ?? 0,
    }));
    onApplyDeltas(finalDeltas);
    setRoundDeltas(finalDeltas);
    setPhase('LEADERBOARD');
  });

  const selectedRow = selectedCell !== null ? Math.floor(selectedCell / 3) : 0;
  const selectedCol = selectedCell !== null ? selectedCell % 3 : 0;
  const selectedExamples =
    selectedCell !== null ? grid.examples[`${selectedRow}_${selectedCol}`] ?? [] : [];

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title="إكس أو الكورة ⚽"
        exitVariant={isRoundInProgress ? 'exit' : 'back'}
        exitLabel={isRoundInProgress ? 'خروج' : 'رجوع'}
        onExit={() => {
          if (isRoundInProgress) setShowExitConfirm(true);
          else onExitToHub();
        }}
      />

      <main className="flex-1 w-full max-w-md mx-auto px-3.5 pb-10 pt-2 flex flex-col items-center">
        {phase === 'READY' && (
          <div className="w-full flex flex-col gap-4">
            <div className="rounded-3xl qada-card p-4 text-right">
              <div className="flex items-center gap-2 mb-1.5">
                <Grid3X3 className="w-5 h-5 text-[#16A34A]" />
                <h2 className="text-base sm:text-lg font-black text-[#1E293B] dark:text-[#F8FAFC]">
                  شبكة إكس أو الكروية (3×3)
                </h2>
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                كل خانة بتجمع بين نادي فوق وشرط في الجنب. قول اسم لاعب حقيقي حقق الشرطين عشان
                تحط علامتك وتقفل صف أو عمود أو قطر!
              </p>
            </div>

            <FootballSettingsBar
              settings={settings}
              onChange={handleSettingsChange}
              showRounds={false}
              secondsOptions={[15, 20, 30, 45]}
            />

            {/* Player X vs Player O Picker */}
            <div className="rounded-3xl qada-card p-4 flex flex-col gap-3">
              <div>
                <div className="text-xs font-black text-[#D94E30] dark:text-[#FF8C73] mb-1.5">
                  اختار لاعب X (أحمر):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {players.map((p, idx) => (
                    <button
                      key={`x_${p.id}`}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setPlayerXIdx(idx);
                        if (idx === playerOIdx && players.length > 1) {
                          setPlayerOIdx((idx + 1) % players.length);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black ${
                        playerXIdx === idx
                          ? 'bg-[#FF6B4A] text-white shadow-[0_3px_0_#D94E30]'
                          : 'bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2.5 border-t border-[#E7DEC8]/70 dark:border-[#334155]/70">
                <div className="text-xs font-black text-[#0D9488] dark:text-[#2DD4BF] mb-1.5">
                  اختار لاعب O (تيل):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {players.map((p, idx) => (
                    <button
                      key={`o_${p.id}`}
                      type="button"
                      disabled={players.length > 1 && idx === playerXIdx}
                      onClick={() => {
                        soundManager.play('click');
                        setPlayerOIdx(idx);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black disabled:opacity-40 ${
                        playerOIdx === idx
                          ? 'bg-[#14B8A6] text-white shadow-[0_3px_0_#0D9488]'
                          : 'bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartGame}
              className="w-full min-h-[56px] rounded-2xl qada-btn-pitch text-white text-xl font-black transition-transform"
            >
              ابدأ الماتش ❌⭕
            </button>
          </div>
        )}

        {(phase === 'PLAYING' || phase === 'MATCH_OVER') && (
          <div className="w-full flex flex-col gap-3">
            {phase === 'PLAYING' && (
              <ActiveTurnBanner
                label={turnMark === 'X' ? 'دور X:' : 'دور O:'}
                player={currentPlayer}
                badgeText={`⏱ ${timeLeft}ث`}
                accent={turnMark === 'X' ? 'coral' : 'teal'}
              />
            )}

            {phase === 'MATCH_OVER' && (
              <div className="rounded-3xl qada-card p-4 text-center border-2 border-amber-400">
                <div className="text-3xl mb-1">
                  {winnerMark === 'DRAW' ? '🤝 تعادل!' : '🏆 هدف الفوز!'}
                </div>
                <h2 className="text-xl font-black text-[#1E293B] dark:text-[#F8FAFC]">
                  {winnerMark === 'DRAW'
                    ? 'تعادل حماس! +30 نقطة لكل واحد'
                    : `${winnerMark === 'X' ? playerX.name : playerO.name} (${winnerMark}) كسب +100 نقطة!`}
                </h2>
              </div>
            )}

            {/* 3x3 Grid with Club Columns + Condition Rows */}
            <div className="w-full rounded-3xl qada-card p-2.5 sm:p-3">
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2 items-stretch">
                {/* Top-Right Corner Cell */}
                <div className="rounded-2xl bg-[#FFF9F0]/70 dark:bg-[#0F172A]/70 border border-[#E7DEC8]/70 dark:border-[#334155] flex items-center justify-center p-1 text-center">
                  <span className="text-[10px] sm:text-xs font-black text-[#64748B] dark:text-[#94A3B8]">
                    الشرط ╲ النادي
                  </span>
                </div>

                {/* 3 Club Column Headers */}
                {grid.cols.map((club) => (
                  <div
                    key={club.id}
                    style={{ borderColor: club.primaryHex }}
                    className="rounded-2xl bg-white dark:bg-[#0F172A] border-2 px-1.5 py-2 flex flex-col items-center justify-center text-center shadow-sm"
                  >
                    <span
                      className="w-3 h-3 rounded-full mb-1 shrink-0"
                      style={{ backgroundColor: club.primaryHex }}
                    />
                    <span className="text-[11px] sm:text-xs font-black text-[#1E293B] dark:text-[#F8FAFC] leading-tight">
                      {club.name}
                    </span>
                  </div>
                ))}

                {/* 3 Rows: Row Header + 3 Playable Cells */}
                {grid.rows.map((cond, rIdx) => (
                  <React.Fragment key={cond.id}>
                    <div className="rounded-2xl bg-[#F0FDFA] dark:bg-teal-950/50 border border-[#99F6E4] dark:border-teal-800 px-1.5 py-2 flex items-center justify-center text-center">
                      <span className="text-[11px] sm:text-xs font-black text-[#0F766E] dark:text-[#5EEAD4] leading-tight">
                        {cond.label}
                      </span>
                    </div>

                    {grid.cols.map((club, cIdx) => {
                      const idx = rIdx * 3 + cIdx;
                      const mark = board[idx];
                      const isWinningCell = winningLine?.includes(idx);
                      const isSelected = selectedCell === idx;

                      return (
                        <button
                          key={`${cond.id}_${club.id}`}
                          type="button"
                          disabled={phase !== 'PLAYING' || mark !== null}
                          onClick={() => {
                            soundManager.play('click');
                            setSelectedCell(idx);
                            setShowExamples(false);
                          }}
                          className={`aspect-square rounded-2xl border-2 flex items-center justify-center text-3xl sm:text-4xl font-black transition-all ${
                            isWinningCell
                              ? 'bg-amber-300 dark:bg-amber-500/40 border-amber-500 scale-105 shadow-lg'
                              : isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-[#16A34A] ring-2 ring-[#16A34A]/50'
                                : mark === 'X'
                                  ? 'bg-[#FFF5F2] dark:bg-rose-950/50 border-[#FF6B4A] text-[#FF6B4A]'
                                  : mark === 'O'
                                    ? 'bg-[#F0FDFA] dark:bg-teal-950/50 border-[#14B8A6] text-[#14B8A6]'
                                    : 'bg-[#FFF9F0] dark:bg-[#0F172A] border-[#E7DEC8] dark:border-[#334155] hover:border-[#16A34A] active:scale-95'
                          }`}
                        >
                          {mark === 'X' ? (
                            'X'
                          ) : mark === 'O' ? (
                            'O'
                          ) : (
                            <span className="text-xs font-extrabold text-[#CBD5E1] dark:text-[#475569]">
                              +
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Cell Claim Panel when a cell is tapped */}
            {phase === 'PLAYING' && selectedCell !== null && (
              <div className="rounded-3xl qada-card p-4 border-2 border-[#16A34A]/50 flex flex-col gap-3">
                <div className="text-center">
                  <div className="text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8]">
                    الخانة المختارة:
                  </div>
                  <div className="text-base font-black text-[#1E293B] dark:text-[#F8FAFC] mt-0.5">
                    {grid.cols[selectedCol].name} × {grid.rows[selectedRow].label}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.play('click');
                    setShowExamples((s) => !s);
                  }}
                  className="mx-auto inline-flex items-center gap-1 text-xs font-black text-[#D97706] dark:text-[#FBBF24]"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>{showExamples ? 'إخفاء أمثلة الإجابة' : 'تلميح أمثلة إجابة 💡'}</span>
                </button>

                {showExamples && selectedExamples.length > 0 && (
                  <div className="text-center text-xs font-black text-[#0F766E] dark:text-[#5EEAD4] bg-[#F0FDFA] dark:bg-teal-950/60 rounded-xl p-2">
                    أمثلة صحيحة: {selectedExamples.join(' · ')}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleConfirmCellClaim}
                    className="min-h-[46px] rounded-2xl bakasa-btn-green text-white text-sm font-black flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>صح! حط {turnMark}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setSelectedCell(null);
                    }}
                    className="min-h-[46px] rounded-2xl bg-white dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#CBD5E1] text-sm font-black flex items-center justify-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>إلغاء</span>
                  </button>
                </div>
              </div>
            )}

            {/* Action Footer */}
            {phase === 'PLAYING' ? (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleSkipTurn}
                  className="min-h-[48px] rounded-2xl qada-btn-amber text-[#1E293B] text-sm font-black flex items-center justify-center gap-1.5"
                >
                  <SkipForward className="w-4 h-4" />
                  <span>غلط / تخطي الدور</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.play('click');
                    startFreshMatch(settings.scope);
                  }}
                  className="min-h-[48px] rounded-2xl bg-white dark:bg-[#1E293B] border-2 border-[#E7DEC8] dark:border-[#334155] text-[#1E293B] dark:text-[#F8FAFC] text-sm font-black flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>شبكة جديدة 🔄</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={guard(() => {
                    soundManager.play('next');
                    if (players.length > 2) {
                      setPhase('READY');
                    } else {
                      startFreshMatch(settings.scope);
                      setPhase('PLAYING');
                    }
                  })}
                  className="w-full min-h-[52px] rounded-2xl qada-btn-pitch text-white text-lg font-black"
                >
                  ماتش جديد ❌⭕
                </button>
                <button
                  type="button"
                  onClick={handleGoToLeaderboard}
                  className="w-full min-h-[52px] rounded-2xl bakasa-btn-green text-white text-lg font-black flex items-center justify-center gap-2"
                >
                  <Trophy className="w-5 h-5" />
                  <span>الترتيب النهائي 🏆</span>
                </button>
              </div>
            )}
          </div>
        )}

        {phase === 'LEADERBOARD' && (
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline="نتائج إكس أو الكورة ❌⭕⚽"
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
        message="الماتش شغال دلوقتي، لو خرجت الجولة الحالية هتتلغي."
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
