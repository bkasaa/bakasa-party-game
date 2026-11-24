import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Goal, Timer, Trophy } from 'lucide-react';
import { useGoHome } from '../../contexts/NavigationContext';
import { useArcadeTouchLock } from '../../hooks/useArcadeTouchLock';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { ARCADE_COLORS, ArcadeDelta, ArcadePlayer, CornerSlot } from '../../types/arcade';
import { recordArcadeWin, recordSoccerGoal } from '../../utils/sessionStats';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { ConfirmModal } from '../ConfirmModal';
import { HomeLogoBadge } from '../HomeLogoBadge';
import { ArcadeFloatingHud } from './ArcadeFloatingHud';
import { ArcadeLeaderboardScreen } from './ArcadeLeaderboardScreen';
import { ArcadePreGameSetup } from './ArcadePreGameSetup';
import { ArcadeSeriesOverlay } from './ArcadeSeriesOverlay';
import { ArcadeWinnerSpotlight } from './ArcadeWinnerSpotlight';

interface SoccerGameProps {
  players: ArcadePlayer[];
  onApplyDeltas: (deltas: ArcadeDelta[]) => void;
  onExitToArcadeHub: () => void;
}

type MatchPhase =
  | 'SETUP'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'INTER_ROUND'
  | 'WINNER_SPOTLIGHT'
  | 'LEADERBOARD';
type SoccerWinMode = 'goals' | 'time';

interface StadiumSpectator {
  x: number;
  y: number;
  color: string;
  seed: number;
}

interface SoccerPlayerEntity {
  playerIdx: number;
  teamIdx: 0 | 1; // 0 = فريق 1 (تحت) | 1 = فريق 2 (فوق)
  slot: CornerSlot;
  isTop: boolean;
  name: string;
  hex: string;
  darkHex: string;
  x: number;
  y: number;
  angle: number;
  slideUntil: number;
  slideVx: number;
  slideVy: number;
  tackleCooldownUntil: number;
  grabCooldownUntil: number;
}

interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  possessorIdx: number | null;
  lastTouchIdx: number | null;
  spin: number;
}

interface SkidParticle {
  x: number;
  y: number;
  color: string;
  life: number;
}

interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface JoystickState {
  dx: number;
  dy: number;
  kx: number;
  ky: number;
  active: boolean;
  lastValidDx: number;
  lastValidDy: number;
  lastValidPull: number;
}

interface PitchBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  goalDepth: number;
  goalHalfW: number;
}

const JOYSTICK_MAX_R = 26;
const PLAYER_R = 15;
const BALL_R = 10.5;
const POST_R = 5.5;
const RUN_SPEED = 195;
const SLIDE_SPEED = 465;

const TEAM_COLORS = {
  0: { name: 'فريق 1 (تحت)', ringHex: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.88)' },
  1: { name: 'فريق 2 (فوق)', ringHex: '#38bdf8', badgeBg: 'rgba(14, 165, 233, 0.88)' },
} as const;

const SLOT_QUADRANT_POS: Record<CornerSlot, string> = {
  'top-left': 'top-0 left-0',
  'top-right': 'top-0 right-0',
  'bottom-left': 'bottom-0 left-0',
  'bottom-right': 'bottom-0 right-0',
};

const SLOT_REST_ANCHOR: Record<CornerSlot, string> = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-3 right-3',
  'bottom-left': 'bottom-3 left-3',
  'bottom-right': 'bottom-3 right-3',
};

function getSoccerCornerSlots(count: number): Array<{ slot: CornerSlot; isTop: boolean; teamIdx: 0 | 1 }> {
  if (count === 2) {
    return [
      { slot: 'bottom-left', isTop: false, teamIdx: 0 }, // Player 1: Bottom Team
      { slot: 'top-right', isTop: true, teamIdx: 1 }, // Player 2: Top Team
    ];
  }
  if (count === 3) {
    return [
      { slot: 'bottom-left', isTop: false, teamIdx: 0 }, // Player 1: Bottom Team
      { slot: 'bottom-right', isTop: false, teamIdx: 0 }, // Player 2: Bottom Team
      { slot: 'top-right', isTop: true, teamIdx: 1 }, // Player 3: Top Team
    ];
  }
  // 4 Players: Bottom Team (P1 Bottom-Left + P2 Bottom-Right) vs Top Team (P3 Top-Right + P4 Top-Left)
  return [
    { slot: 'bottom-left', isTop: false, teamIdx: 0 },
    { slot: 'bottom-right', isTop: false, teamIdx: 0 },
    { slot: 'top-right', isTop: true, teamIdx: 1 },
    { slot: 'top-left', isTop: true, teamIdx: 1 },
  ];
}

function getPitchBounds(w: number, h: number): PitchBounds {
  const padX = Math.max(22, Math.min(34, w * 0.065));
  const padY = Math.max(76, Math.min(98, h * 0.125));
  const pitchW = w - padX * 2;
  return {
    left: padX,
    right: w - padX,
    top: padY,
    bottom: h - padY,
    goalDepth: 22,
    // Narrow goal width: 23% of pitch width (halfW = 0.115 * pitchW)
    goalHalfW: Math.max(30, pitchW * 0.115),
  };
}

function drawSoccerPlayer(
  ctx: CanvasRenderingContext2D,
  p: SoccerPlayerEntity,
  hasBall: boolean,
  now: number
) {
  const isSliding = p.slideUntil > now;
  const stunned = p.grabCooldownUntil > now && !hasBall;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  // Matching Team Ring (Team 1 Bottom = Red, Team 2 Top = Sky Blue)
  ctx.strokeStyle = TEAM_COLORS[p.teamIdx].ringHex;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_R + 5, 0, Math.PI * 2);
  ctx.stroke();

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(-1, 3, isSliding ? 18 : 13, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sliding outstretched cleats
  if (isSliding) {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(8, -5, 13, 10, 4);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = p.hex;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, isSliding ? 16 : 12.5, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.fillStyle = stunned ? '#cbd5e1' : p.darkHex;
  ctx.beginPath();
  ctx.arc(2, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(6.5, -3, 2, 0, Math.PI * 2);
  ctx.arc(6.5, 3, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSoccerBall(ctx: CanvasRenderingContext2D, ball: BallState) {
  ctx.save();
  ctx.translate(ball.x, ball.y);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.arc(2, 3, BALL_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(ball.spin);

  // White ball sphere
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Classic pentagon patches
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 8.2, Math.sin(a) * 8.2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export const SoccerGame: React.FC<SoccerGameProps> = ({
  players,
  onApplyDeltas,
  onExitToArcadeHub,
}) => {
  const [phase, setPhase] = useState<MatchPhase>('SETUP');
  const [totalRounds, setTotalRounds] = useState<number>(3);
  const [winMode, setWinMode] = useState<SoccerWinMode>('goals');
  const [targetGoals, setTargetGoals] = useState<number>(3);
  const [matchSeconds, setMatchSeconds] = useState<number>(90);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [seriesScores, setSeriesScores] = useState<Record<string, number>>({});
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [secondsLeft, setSecondsLeft] = useState<number>(90);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [joyVisuals, setJoyVisuals] = useState<
    Array<{ kx: number; ky: number; active: boolean; x: number | null; y: number | null }>
  >(() => players.map(() => ({ kx: 0, ky: 0, active: false, x: null, y: null })));
  const [roundDeltas, setRoundDeltas] = useState<ArcadeDelta[]>([]);
  const [finalSeriesDeltas, setFinalSeriesDeltas] = useState<ArcadeDelta[]>([]);
  const [seriesWinners, setSeriesWinners] = useState<ArcadePlayer[]>([]);
  const [summaryText, setSummaryText] = useState<string>('');
  const [goalBanner, setGoalBanner] = useState<{ teamIdx: 0 | 1; scorerName?: string } | null>(
    null
  );
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => soundManager.isMuted());

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const arenaSizeRef = useRef<{ w: number; h: number }>({ w: 390, h: 760 });
  const entitiesRef = useRef<SoccerPlayerEntity[]>([]);
  const spectatorsRef = useRef<StadiumSpectator[]>([]);
  const ballRef = useRef<BallState>({
    x: 195,
    y: 380,
    vx: 0,
    vy: 0,
    possessorIdx: null,
    lastTouchIdx: null,
    spin: 0,
  });
  const scoresRef = useRef<[number, number]>([0, 0]);
  const skidsRef = useRef<SkidParticle[]>([]);
  const popupsRef = useRef<FloatingPopup[]>([]);
  const goalPauseUntilRef = useRef<number>(0);
  const goalCelebrateUntilRef = useRef<number>(0);
  const goalTimeoutRef = useRef<number | null>(null);
  const joyPointersRef = useRef<
    Map<number, { playerIdx: number; cx: number; cy: number; x: number; y: number }>
  >(new Map());
  const joysRef = useRef<JoystickState[]>(
    players.map(() => ({
      dx: 0,
      dy: 0,
      kx: 0,
      ky: 0,
      active: false,
      lastValidDx: 1,
      lastValidDy: 0,
      lastValidPull: 0,
    }))
  );
  const roundStartRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(90);
  const lastWallSoundTimeRef = useRef<number>(0);
  const finishedRef = useRef<boolean>(false);

  const cornerDefs = getSoccerCornerSlots(players.length);
  const effectiveDuration = winMode === 'goals' ? 180 : matchSeconds;
  const goHome = useGoHome();
  const isRoundActive = phase === 'COUNTDOWN' || phase === 'PLAYING' || phase === 'INTER_ROUND';

  useNavigationGuard(isRoundActive, () => setShowExitConfirm(true));
  useArcadeTouchLock(isRoundActive, arenaRef);

  useEffect(() => {
    return soundManager.subscribe(setMuted);
  }, []);

  useEffect(() => {
    if (phase === 'PLAYING') {
      soundManager.startMusic('arcade');
    } else {
      soundManager.stopMusic();
    }
    return () => soundManager.stopMusic();
  }, [phase]);

  useEffect(() => {
    return () => {
      if (goalTimeoutRef.current !== null) {
        window.clearTimeout(goalTimeoutRef.current);
      }
    };
  }, []);

  const syncArenaSize = useCallback(() => {
    const el = arenaRef.current;
    if (!el) return;
    arenaSizeRef.current = {
      w: Math.max(300, Math.round(el.clientWidth)),
      h: Math.max(420, Math.round(el.clientHeight)),
    };
  }, []);

  const placeKickoffPositions = useCallback(() => {
    const { w, h } = arenaSizeRef.current;
    const pb = getPitchBounds(w, h);
    const cx = (pb.left + pb.right) / 2;
    const cy = (pb.top + pb.bottom) / 2;
    const pitchW = pb.right - pb.left;
    const pitchH = pb.bottom - pb.top;

    const team0 = entitiesRef.current.filter((e) => e.teamIdx === 0);
    const team1 = entitiesRef.current.filter((e) => e.teamIdx === 1);

    team0.forEach((ent, i) => {
      const spreadX =
        team0.length === 1 ? 0 : (i === 0 ? -1 : 1) * (pitchW * 0.22);
      ent.x = cx + spreadX;
      ent.y = cy + pitchH * 0.22;
      ent.angle = -Math.PI / 2; // Facing UP toward Top Goal
      ent.slideUntil = 0;
      ent.tackleCooldownUntil = 0;
      ent.grabCooldownUntil = 0;
    });

    team1.forEach((ent, i) => {
      const spreadX =
        team1.length === 1 ? 0 : (i === 0 ? 1 : -1) * (pitchW * 0.22);
      ent.x = cx + spreadX;
      ent.y = cy - pitchH * 0.22;
      ent.angle = Math.PI / 2; // Facing DOWN toward Bottom Goal
      ent.slideUntil = 0;
      ent.tackleCooldownUntil = 0;
      ent.grabCooldownUntil = 0;
    });

    ballRef.current = {
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      possessorIdx: null,
      lastTouchIdx: null,
      spin: 0,
    };
  }, []);

  const resetMatchState = useCallback(() => {
    syncArenaSize();
    const defs = getSoccerCornerSlots(players.length);

    entitiesRef.current = players.map((p, idx) => {
      const theme = ARCADE_COLORS[p.colorId];
      const def = defs[idx];
      return {
        playerIdx: idx,
        teamIdx: def.teamIdx,
        slot: def.slot,
        isTop: def.isTop,
        name: p.name,
        hex: theme.hex,
        darkHex: theme.darkHex,
        x: 0,
        y: 0,
        angle: 0,
        slideUntil: 0,
        slideVx: 0,
        slideVy: 0,
        tackleCooldownUntil: 0,
        grabCooldownUntil: 0,
      };
    });

    placeKickoffPositions();
    const { w, h } = arenaSizeRef.current;
    const pb = getPitchBounds(w, h);
    const crowdColors = ['#ef4444', '#38bdf8', '#facc15', '#10b981', '#ffffff', '#f97316'];
    const specs: StadiumSpectator[] = [];
    const usableTop = pb.top + 64;
    const usableBottom = pb.bottom - 64;
    const rows = Math.max(6, Math.floor((usableBottom - usableTop) / 26));
    for (let r = 0; r < rows; r++) {
      const sy = usableTop + ((r + 0.5) * (usableBottom - usableTop)) / rows;
      specs.push({
        x: Math.max(8, pb.left * 0.45),
        y: sy,
        color: crowdColors[r % crowdColors.length],
        seed: r * 0.9,
      });
      specs.push({
        x: Math.min(w - 8, w - pb.left * 0.45),
        y: sy + 6,
        color: crowdColors[(r + 3) % crowdColors.length],
        seed: r * 1.3 + 2,
      });
    }
    spectatorsRef.current = specs;

    if (goalTimeoutRef.current !== null) {
      window.clearTimeout(goalTimeoutRef.current);
      goalTimeoutRef.current = null;
    }
    setGoalBanner(null);
    goalCelebrateUntilRef.current = 0;
    scoresRef.current = [0, 0];
    setScores([0, 0]);
    skidsRef.current = [];
    popupsRef.current = [];
    goalPauseUntilRef.current = 0;
    joyPointersRef.current.clear();
    joysRef.current = players.map(() => ({
      dx: 0,
      dy: 0,
      kx: 0,
      ky: 0,
      active: false,
      lastValidDx: 0,
      lastValidDy: -1,
      lastValidPull: 0,
    }));
    lastWallSoundTimeRef.current = 0;
    finishedRef.current = false;
    setJoyVisuals(players.map(() => ({ kx: 0, ky: 0, active: false, x: null, y: null })));
  }, [placeKickoffPositions, players, syncArenaSize]);

  const finishRound = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const sc = scoresRef.current;
    const best = Math.max(sc[0], sc[1]);
    const winningTeams = new Set<number>();
    if (best > 0) {
      if (sc[0] === best) winningTeams.add(0);
      if (sc[1] === best) winningTeams.add(1);
    }

    const winnerPlayers = entitiesRef.current.filter((e) => winningTeams.has(e.teamIdx));
    const winnerIds = new Set(winnerPlayers.map((e) => players[e.playerIdx].id));
    winnerIds.forEach((id) => recordArcadeWin(id));

    let roundHeadline = `انتهت الجولة ${currentRound}!`;
    if (winningTeams.size > 1) {
      roundHeadline = `تعادل (${best} - ${best})!`;
    } else if (winningTeams.size === 1) {
      const teamWinIdx = Array.from(winningTeams)[0] as 0 | 1;
      if (players.length === 2 && winnerPlayers.length === 1) {
        roundHeadline = `فاز ${winnerPlayers[0].name} (${sc[teamWinIdx]} أهداف)! ⚽`;
      } else {
        roundHeadline = `فاز ${TEAM_COLORS[teamWinIdx].name} (${sc[0]} : ${sc[1]})! ⚽`;
      }
    } else {
      roundHeadline = 'انتهت بالتعادل السلبي!';
    }

    const deltas: ArcadeDelta[] = players.map((p) => ({
      playerId: p.id,
      delta: winnerIds.has(p.id) ? 100 : 0,
    }));

    setRoundDeltas(deltas);
    onApplyDeltas(deltas);

    const nextSeriesScores: Record<string, number> = { ...seriesScores };
    deltas.forEach((d) => {
      nextSeriesScores[d.playerId] = (nextSeriesScores[d.playerId] ?? 0) + d.delta;
    });
    setSeriesScores(nextSeriesScores);

    if (currentRound < totalRounds) {
      soundManager.play('victory');
      setSummaryText(roundHeadline);
      setPhase('INTER_ROUND');
    } else {
      const topSeries = Math.max(...players.map((p) => nextSeriesScores[p.id] ?? 0), 0);
      const champs = players.filter((p) => (nextSeriesScores[p.id] ?? 0) === topSeries && topSeries > 0);
      const seriesHeadline =
        champs.length > 1
          ? `أبطال البطولة (${totalRounds} مباريات): ${champs.map((c) => c.name).join(' و ')}`
          : champs.length === 1
            ? `بطل البطولة (${totalRounds} مباريات): ${champs[0].name}! 🏆`
            : `انتهت سلسلة الـ ${totalRounds} مباريات!`;
      setSummaryText(seriesHeadline);
      setSeriesWinners(champs);
      setFinalSeriesDeltas(
        players.map((p) => ({ playerId: p.id, delta: nextSeriesScores[p.id] ?? 0 }))
      );
      setPhase('WINNER_SPOTLIGHT');
    }
  }, [currentRound, onApplyDeltas, players, seriesScores, totalRounds]);

  const drawScene = useCallback(
    (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { w, h } = arenaSizeRef.current;
      const pb = getPitchBounds(w, h);
      const cx = (pb.left + pb.right) / 2;
      const cy = (pb.top + pb.bottom) / 2;
      const pitchW = pb.right - pb.left;
      const pitchH = pb.bottom - pb.top;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Outer stadium turf
      ctx.fillStyle = '#0f6a29';
      ctx.fillRect(0, 0, w, h);

      // Animated sideline stadium spectator crowd
      const isCrowdCheering = now < goalCelebrateUntilRef.current;
      for (const sp of spectatorsRef.current) {
        const bounce = isCrowdCheering
          ? Math.abs(Math.sin(now * 0.022 + sp.seed)) * 6.5
          : Math.sin(now * 0.0045 + sp.seed) * 1.6;
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y + 3, 5.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = sp.color;
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y - bounce, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Horizontal mowed grass stripes for vertical portrait pitch
      const stripeCount = 12;
      const stripeH = pitchH / stripeCount;
      for (let s = 0; s < stripeCount; s++) {
        ctx.fillStyle = s % 2 === 0 ? '#1ea346' : '#188f3b';
        ctx.fillRect(pb.left, pb.top + s * stripeH, pitchW, stripeH + 0.6);
      }

      // White pitch boundary lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 3;
      ctx.strokeRect(pb.left, pb.top, pitchW, pitchH);

      // Horizontal halfway line across the middle + center circle
      ctx.beginPath();
      ctx.moveTo(pb.left, cy);
      ctx.lineTo(pb.right, cy);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(pitchW, pitchH) * 0.165, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Top & Bottom Penalty Boxes
      const boxW = Math.min(pitchW * 0.56, pb.goalHalfW * 3.1);
      const boxH = pitchH * 0.12;
      ctx.strokeRect(cx - boxW / 2, pb.top, boxW, boxH);
      ctx.strokeRect(cx - boxW / 2, pb.bottom - boxH, boxW, boxH);

      const drawGoalCage = (
        gx: number,
        gy: number,
        gw: number,
        gh: number,
        accent: string,
        postY: number
      ) => {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(gx, gy, gw, gh);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.4;
        for (let nx = gx + 6; nx < gx + gw; nx += 7) {
          ctx.beginPath();
          ctx.moveTo(nx, gy);
          ctx.lineTo(nx, gy + gh);
          ctx.stroke();
        }
        for (let ny = gy + 6; ny < gy + gh; ny += 7) {
          ctx.beginPath();
          ctx.moveTo(gx, ny);
          ctx.lineTo(gx + gw, ny);
          ctx.stroke();
        }
        ctx.strokeStyle = accent;
        ctx.lineWidth = 4;
        ctx.strokeRect(gx, gy, gw, gh);

        // Solid Goalposts on both sides of the goal mouth
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2.4;
        for (const px of [gx, gx + gw]) {
          ctx.beginPath();
          ctx.arc(px, postY, POST_R, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      };

      // TOP GOAL (Defended by Team 2 Top = Sky Blue)
      drawGoalCage(
        cx - pb.goalHalfW,
        pb.top - pb.goalDepth,
        pb.goalHalfW * 2,
        pb.goalDepth,
        TEAM_COLORS[1].ringHex,
        pb.top
      );

      // BOTTOM GOAL (Defended by Team 1 Bottom = Red)
      drawGoalCage(
        cx - pb.goalHalfW,
        pb.bottom,
        pb.goalHalfW * 2,
        pb.goalDepth,
        TEAM_COLORS[0].ringHex,
        pb.bottom
      );

      // Slide skid particles
      for (const sk of skidsRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, sk.life * 0.6);
        ctx.fillStyle = sk.color;
        ctx.beginPath();
        ctx.arc(sk.x, sk.y, 4.5 * sk.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const ball = ballRef.current;

      // Shorter (~50% length) Directional Aim Arrow when possessor aims with joystick
      if (ball.possessorIdx !== null) {
        const joy = joysRef.current[ball.possessorIdx];
        if (joy && joy.active && joy.lastValidPull > 0.14) {
          const aimLen = 14 + joy.lastValidPull * 26;
          const aimAng = Math.atan2(joy.lastValidDy, joy.lastValidDx);
          const ax = ball.x + Math.cos(aimAng) * aimLen;
          const ay = ball.y + Math.sin(aimAng) * aimLen;

          ctx.save();
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ball.x, ball.y);
          ctx.lineTo(ax, ay);
          ctx.stroke();

          ctx.fillStyle = '#fde047';
          ctx.translate(ax, ay);
          ctx.rotate(aimAng);
          ctx.beginPath();
          ctx.moveTo(7.5, 0);
          ctx.lineTo(-3.5, -5);
          ctx.lineTo(-3.5, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // Players
      for (const p of entitiesRef.current) {
        drawSoccerPlayer(ctx, p, ball.possessorIdx === p.playerIdx, now);
      }

      // Ball
      drawSoccerBall(ctx, ball);

      // Popups
      for (const pop of popupsRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pop.life);
        ctx.font = '900 18px Cairo, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 4;
        ctx.strokeText(pop.text, pop.x, pop.y);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }

      ctx.restore();
    },
    []
  );

  // Countdown sequence
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    resetMatchState();
    drawScene(performance.now());
    setCountdownNum(3);
    setSecondsLeft(effectiveDuration);
    lastTickSecRef.current = effectiveDuration;
    soundManager.play('tick');

    const t1 = window.setTimeout(() => {
      setCountdownNum(2);
      soundManager.play('tick');
    }, 600);
    const t2 = window.setTimeout(() => {
      setCountdownNum(1);
      soundManager.play('tick');
    }, 1200);
    const t3 = window.setTimeout(() => {
      soundManager.play('next');
      const now = performance.now();
      roundStartRef.current = now;
      lastFrameRef.current = now;
      setPhase('PLAYING');
    }, 1800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [phase, effectiveDuration, resetMatchState, drawScene]);

  // Auto-advance after 2.5s floating inter-round banner
  useEffect(() => {
    if (phase !== 'INTER_ROUND') return;
    const t = window.setTimeout(() => {
      setCurrentRound((prev) => prev + 1);
      setPhase('COUNTDOWN');
    }, 2500);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Main 60fps loop
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    let rafId = 0;

    const handleGoalScored = (scoringTeamIdx: 0 | 1, now: number) => {
      scoresRef.current[scoringTeamIdx] = (scoresRef.current[scoringTeamIdx] ?? 0) + 1;
      setScores([...scoresRef.current]);
      soundManager.play('goal');
      triggerHaptic([35, 35, 70]);

      let scorerName: string | undefined;
      if (ballRef.current.lastTouchIdx !== null) {
        const scorer = players[ballRef.current.lastTouchIdx];
        if (scorer) {
          scorerName = scorer.name;
          recordSoccerGoal(scorer.id);
        }
      }

      const isWinningGoal =
        winMode === 'goals' && scoresRef.current[scoringTeamIdx] >= targetGoals;

      // Freeze physics & show 1.5s "جووووون!" celebration overlay on EVERY goal
      goalPauseUntilRef.current = now + 1500;
      goalCelebrateUntilRef.current = now + 1500;
      ballRef.current.possessorIdx = null;
      ballRef.current.vx = 0;
      ballRef.current.vy = 0;
      setGoalBanner({ teamIdx: scoringTeamIdx, scorerName });

      if (goalTimeoutRef.current !== null) {
        window.clearTimeout(goalTimeoutRef.current);
      }
      goalTimeoutRef.current = window.setTimeout(() => {
        goalTimeoutRef.current = null;
        setGoalBanner(null);
        if (isWinningGoal) {
          finishRound();
        } else {
          placeKickoffPositions();
        }
      }, 1500);
    };

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameRef.current) / 1000));
      lastFrameRef.current = now;

      const elapsedSec = (now - roundStartRef.current) / 1000;
      const remaining = Math.max(0, Math.ceil(effectiveDuration - elapsedSec));
      if (remaining !== lastTickSecRef.current) {
        lastTickSecRef.current = remaining;
        setSecondsLeft(remaining);
        if (winMode === 'time' && remaining > 0 && remaining <= 5) {
          soundManager.play('tickUrgent');
        }
      }

      if (elapsedSec >= effectiveDuration && now >= goalCelebrateUntilRef.current) {
        drawScene(now);
        finishRound();
        return;
      }

      const { w, h } = arenaSizeRef.current;
      const pb = getPitchBounds(w, h);
      const cx = (pb.left + pb.right) / 2;
      const cy = (pb.top + pb.bottom) / 2;
      const ball = ballRef.current;

      if (now >= goalPauseUntilRef.current) {
        // Move players (joystick or slide tackle dash)
        for (let i = 0; i < entitiesRef.current.length; i++) {
          const p = entitiesRef.current[i];
          const isSliding = p.slideUntil > now;

          if (isSliding) {
            p.x += p.slideVx * dt;
            p.y += p.slideVy * dt;

            if (Math.random() < 0.75) {
              skidsRef.current.push({
                x: p.x,
                y: p.y,
                color: '#bef264',
                life: 1,
              });
            }

            // STRICT RULE: Slide tackle steals ONLY if slider's tackle hitbox directly touches the ball itself!
            const bootX = p.x + Math.cos(p.angle) * 14;
            const bootY = p.y + Math.sin(p.angle) * 14;
            const touchedBall =
              Math.hypot(bootX - ball.x, bootY - ball.y) <= BALL_R + 12 ||
              Math.hypot(p.x - ball.x, p.y - ball.y) <= PLAYER_R + BALL_R + 3;

            if (touchedBall && ball.possessorIdx !== i) {
              if (ball.possessorIdx !== null) {
                const prevHolder = entitiesRef.current[ball.possessorIdx];
                if (prevHolder) {
                  prevHolder.grabCooldownUntil = now + 420;
                }
                popupsRef.current.push({
                  x: ball.x,
                  y: ball.y - 18,
                  text: 'تدخل نظيف!',
                  color: '#38bdf8',
                  life: 1,
                });
              }
              ball.possessorIdx = i;
              ball.lastTouchIdx = i;
              p.slideUntil = 0;
              soundManager.play('hit');
              triggerHaptic(25);
            }
          } else {
            const joy = joysRef.current[i];
            if (joy && joy.active) {
              const mag = Math.min(1, Math.hypot(joy.dx, joy.dy) / JOYSTICK_MAX_R);
              const dirAng = Math.atan2(joy.dy, joy.dx);
              p.angle = dirAng;
              const spd = RUN_SPEED * (0.45 + 0.55 * mag);
              p.x += Math.cos(dirAng) * spd * dt;
              p.y += Math.sin(dirAng) * spd * dt;
            }
          }

          // Clamp players comfortably within pitch perimeter
          p.x = Math.max(pb.left + 8, Math.min(pb.right - 8, p.x));
          p.y = Math.max(pb.top + 8, Math.min(pb.bottom - 8, p.y));
        }

        // Player-to-player soft bump (never steals ball!)
        for (let i = 0; i < entitiesRef.current.length; i++) {
          for (let j = i + 1; j < entitiesRef.current.length; j++) {
            const a = entitiesRef.current[i];
            const b = entitiesRef.current[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            if (d > 0.01 && d < PLAYER_R * 2) {
              const push = (PLAYER_R * 2 - d) * 0.5;
              a.x -= (dx / d) * push;
              a.y -= (dy / d) * push;
              b.x += (dx / d) * push;
              b.y += (dy / d) * push;
            }
          }
        }

        // Ball possession / dribble OR free ball physics
        if (ball.possessorIdx !== null) {
          const holder = entitiesRef.current[ball.possessorIdx];
          if (holder) {
            ball.x = holder.x + Math.cos(holder.angle) * (PLAYER_R + 7);
            ball.y = holder.y + Math.sin(holder.angle) * (PLAYER_R + 7);
            ball.vx = 0;
            ball.vy = 0;
            ball.spin += 6 * dt;
          } else {
            ball.possessorIdx = null;
          }
        } else {
          // Free ball movement + grass friction
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;
          const friction = Math.pow(0.24, dt);
          ball.vx *= friction;
          ball.vy *= friction;
          ball.spin += Math.hypot(ball.vx, ball.vy) * 0.04 * dt;

          // Auto-dribble attach when a player touches free ball
          for (let i = 0; i < entitiesRef.current.length; i++) {
            const p = entitiesRef.current[i];
            if (p.grabCooldownUntil > now) continue;
            if (Math.hypot(p.x - ball.x, p.y - ball.y) <= PLAYER_R + BALL_R + 3) {
              ball.possessorIdx = i;
              ball.lastTouchIdx = i;
              soundManager.play('tick');
              break;
            }
          }
        }

        // Solid goalpost circle collisions (so narrow goals bounce cleanly off posts!)
        const posts = [
          { x: cx - pb.goalHalfW, y: pb.top },
          { x: cx + pb.goalHalfW, y: pb.top },
          { x: cx - pb.goalHalfW, y: pb.bottom },
          { x: cx + pb.goalHalfW, y: pb.bottom },
        ];
        if (ball.possessorIdx === null) {
          for (const post of posts) {
            const dx = ball.x - post.x;
            const dy = ball.y - post.y;
            const dist = Math.hypot(dx, dy);
            const minDist = BALL_R + POST_R;
            if (dist > 0.01 && dist < minDist) {
              const nx = dx / dist;
              const ny = dy / dist;
              ball.x = post.x + nx * minDist;
              ball.y = post.y + ny * minDist;
              const dot = ball.vx * nx + ball.vy * ny;
              if (dot < 0) {
                const vn = dot * dt;
                ball.vx = (ball.vx - 2 * dot * nx) * 0.82;
                ball.vy = (ball.vy - 2 * dot * ny) * 0.82;
                if (Math.abs(vn) > 2.5 && now - lastWallSoundTimeRef.current >= 250) {
                  lastWallSoundTimeRef.current = now;
                  soundManager.play('wallBounce');
                }
              }
            }
          }
        }

        // Check Goal Scoring (Top Goal & Bottom Goal on vertical pitch)
        const inGoalX = Math.abs(ball.x - cx) <= pb.goalHalfW - BALL_R * 0.3;

        // TOP GOAL entered -> Team 0 (Bottom Team / فريق 1) scores!
        if (ball.y <= pb.top - 4 && inGoalX) {
          handleGoalScored(0, now);
        }
        // BOTTOM GOAL entered -> Team 1 (Top Team / فريق 2) scores!
        else if (ball.y >= pb.bottom + 4 && inGoalX) {
          handleGoalScored(1, now);
        } else if (ball.possessorIdx === null) {
          // Free-ball pitch boundary bounces (only trigger audio on sharp impacts with 250ms cooldown)
          if (ball.x - BALL_R < pb.left) {
            const vn = ball.vx * dt;
            ball.x = pb.left + BALL_R;
            ball.vx = Math.abs(ball.vx) * 0.78;
            if (Math.abs(vn) > 2.5 && now - lastWallSoundTimeRef.current >= 250) {
              lastWallSoundTimeRef.current = now;
              soundManager.play('wallBounce');
            }
          } else if (ball.x + BALL_R > pb.right) {
            const vn = ball.vx * dt;
            ball.x = pb.right - BALL_R;
            ball.vx = -Math.abs(ball.vx) * 0.78;
            if (Math.abs(vn) > 2.5 && now - lastWallSoundTimeRef.current >= 250) {
              lastWallSoundTimeRef.current = now;
              soundManager.play('wallBounce');
            }
          }

          if (ball.y - BALL_R < pb.top && !inGoalX) {
            const vn = ball.vy * dt;
            ball.y = pb.top + BALL_R;
            ball.vy = Math.abs(ball.vy) * 0.78;
            if (Math.abs(vn) > 2.5 && now - lastWallSoundTimeRef.current >= 250) {
              lastWallSoundTimeRef.current = now;
              soundManager.play('wallBounce');
            }
          } else if (ball.y + BALL_R > pb.bottom && !inGoalX) {
            const vn = ball.vy * dt;
            ball.y = pb.bottom - BALL_R;
            ball.vy = -Math.abs(ball.vy) * 0.78;
            if (Math.abs(vn) > 2.5 && now - lastWallSoundTimeRef.current >= 250) {
              lastWallSoundTimeRef.current = now;
              soundManager.play('wallBounce');
            }
          }
        } else {
          // Gently clamp ball when possessed by a dribbling player — never play bounce sound!
          ball.x = Math.max(pb.left + BALL_R, Math.min(pb.right - BALL_R, ball.x));
          if (!inGoalX) {
            ball.y = Math.max(pb.top + BALL_R, Math.min(pb.bottom - BALL_R, ball.y));
          }
        }
      }

      skidsRef.current = skidsRef.current
        .map((s) => ({ ...s, life: s.life - 3.2 * dt }))
        .filter((s) => s.life > 0);

      popupsRef.current = popupsRef.current
        .map((p) => ({ ...p, y: p.y - 28 * dt, life: p.life - 1.3 * dt }))
        .filter((p) => p.life > 0);

      drawScene(now);
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    phase,
    effectiveDuration,
    winMode,
    targetGoals,
    drawScene,
    finishRound,
    placeKickoffPositions,
  ]);

  // Floating Multi-Touch Joystick Handlers (Release-to-Kick OR Release-to-Slide-Tackle)
  const updateJoy = (
    playerIdx: number,
    rawDx: number,
    rawDy: number,
    spawnX: number,
    spawnY: number
  ) => {
    const dist = Math.hypot(rawDx, rawDy);
    const active = dist > 3;
    const clampedDist = Math.min(JOYSTICK_MAX_R, dist);
    const pull = clampedDist / JOYSTICK_MAX_R;
    const nx = dist > 0.01 ? (rawDx / dist) * pull : 0;
    const ny = dist > 0.01 ? (rawDy / dist) * pull : 0;

    const j = joysRef.current[playerIdx];
    j.dx = rawDx;
    j.dy = rawDy;
    j.kx = nx;
    j.ky = ny;
    j.active = active;
    if (dist > 6) {
      j.lastValidDx = rawDx / dist;
      j.lastValidDy = rawDy / dist;
      j.lastValidPull = pull;
    }

    setJoyVisuals((prev) =>
      prev.map((item, idx) =>
        idx === playerIdx ? { kx: nx, ky: ny, active: true, x: spawnX, y: spawnY } : item
      )
    );
  };

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>, playerIdx: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    soundManager.unlock();
    const rect = e.currentTarget.getBoundingClientRect();
    const localX = Math.max(41, Math.min(rect.width - 41, e.clientX - rect.left));
    const localY = Math.max(41, Math.min(rect.height - 41, e.clientY - rect.top));
    const cx = rect.left + localX;
    const cy = rect.top + localY;
    joyPointersRef.current.set(e.pointerId, { playerIdx, cx, cy, x: localX, y: localY });
    const j = joysRef.current[playerIdx];
    j.lastValidPull = 0;
    updateJoy(playerIdx, e.clientX - cx, e.clientY - cy, localX, localY);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const entry = joyPointersRef.current.get(e.pointerId);
    if (!entry) return;
    updateJoy(entry.playerIdx, e.clientX - entry.cx, e.clientY - entry.cy, entry.x, entry.y);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const entry = joyPointersRef.current.get(e.pointerId);
    if (!entry) return;
    joyPointersRef.current.delete(e.pointerId);

    const idx = entry.playerIdx;
    const j = joysRef.current[idx];
    const p = entitiesRef.current[idx];
    const ball = ballRef.current;
    const now = performance.now();

    if (phase === 'PLAYING' && p && now >= goalPauseUntilRef.current) {
      const aimLen = Math.hypot(j.lastValidDx, j.lastValidDy);
      const ax = aimLen > 0.01 ? j.lastValidDx / aimLen : Math.cos(p.angle);
      const ay = aimLen > 0.01 ? j.lastValidDy / aimLen : Math.sin(p.angle);
      const pullPower = Math.max(0.25, j.lastValidPull);

      if (ball.possessorIdx === idx) {
        // Release joystick -> KICK / PASS in aimed direction!
        const kickSpeed = 420 + pullPower * 460;
        ball.possessorIdx = null;
        ball.lastTouchIdx = idx;
        ball.vx = ax * kickSpeed;
        ball.vy = ay * kickSpeed;
        p.grabCooldownUntil = now + 260;
        soundManager.play('hit');
      } else if (j.lastValidPull >= 0.34 && now >= p.tackleCooldownUntil) {
        // Quick flick/release without ball -> SLIDE TACKLE DASH!
        p.angle = Math.atan2(ay, ax);
        p.slideVx = ax * SLIDE_SPEED;
        p.slideVy = ay * SLIDE_SPEED;
        p.slideUntil = now + 260;
        p.tackleCooldownUntil = now + 820;
        soundManager.play('bounce');
      }
    }

    j.dx = 0;
    j.dy = 0;
    j.kx = 0;
    j.ky = 0;
    j.active = false;
    setJoyVisuals((prev) =>
      prev.map((item, i) =>
        i === idx ? { kx: 0, ky: 0, active: false, x: null, y: null } : item
      )
    );
  };

  // Top floating scoreboard string (Team 1 Bottom : Team 2 Top)
  const scoreboardText = `${scores[0]} : ${scores[1]}`;

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] flex flex-col select-none overflow-hidden">
      {phase === 'SETUP' && (
        <div className="flex-1 overflow-y-auto">
          <ArcadePreGameSetup
            title="كرة القدم"
            subtitle={
              players.length >= 3
                ? 'فريق ١ (تحت) ضد فريق ٢ (فوق): اسحب الجويستيك للتحرك، وسيبه للشوت أو الزحلقة على الكورة!'
                : '١ ضد ١ (تحت ضد فوق): المس الكورة للمراوغة، وسيب الجويستيك للشوت أو الزحلقة!'
            }
            players={players}
            accentBgClass="bg-gradient-to-br from-[#15803d] to-[#0ea5e9]"
            icon={<Trophy className="w-12 h-12 text-white" />}
            roundOptions={[3, 5, 7]}
            defaultRounds={3}
            customConfigSlot={
              <div className="pt-3 border-t border-[#F1E8DA] dark:border-[#334155] flex flex-col gap-3">
                <div>
                  <div className="text-xs sm:text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2 mb-2">
                    {winMode === 'goals' ? (
                      <Goal className="w-4 h-4 text-[#059669] dark:text-[#34D399]" />
                    ) : (
                      <Timer className="w-4 h-4 text-[#14B8A6]" />
                    )}
                    <span>نظام الفوز في كل مباراة:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setWinMode('goals');
                      }}
                      className={`min-h-[44px] rounded-xl text-sm font-black transition-all ${
                        winMode === 'goals'
                          ? 'qada-btn-teal text-white'
                          : 'bg-[#FFF9F0] dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#FFF3E0] dark:hover:bg-[#334155] hover:text-[#1E293B] dark:hover:text-[#F8FAFC] border-2 border-[#E7DEC8] dark:border-[#334155]'
                      }`}
                    >
                      عدد الأهداف
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setWinMode('time');
                      }}
                      className={`min-h-[44px] rounded-xl text-sm font-black transition-all ${
                        winMode === 'time'
                          ? 'qada-btn-teal text-white'
                          : 'bg-[#FFF9F0] dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#FFF3E0] dark:hover:bg-[#334155] hover:text-[#1E293B] dark:hover:text-[#F8FAFC] border-2 border-[#E7DEC8] dark:border-[#334155]'
                      }`}
                    >
                      وقت محدد
                    </button>
                  </div>
                </div>

                {winMode === 'goals' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[3, 5].map((g) => {
                      const active = targetGoals === g;
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            soundManager.play('click');
                            setTargetGoals(g);
                          }}
                          className={`min-h-[44px] rounded-xl text-sm font-black tabular-nums transition-all ${
                            active
                              ? 'bakasa-btn-green text-white'
                              : 'bg-[#FFF9F0] dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#FFF3E0] dark:hover:bg-[#334155] hover:text-[#1E293B] dark:hover:text-[#F8FAFC] border-2 border-[#E7DEC8] dark:border-[#334155]'
                          }`}
                        >
                          {g} أهداف
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {[60, 90, 120].map((sec) => {
                      const active = matchSeconds === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => {
                            soundManager.play('click');
                            setMatchSeconds(sec);
                          }}
                          className={`min-h-[44px] rounded-xl text-sm font-black tabular-nums transition-all ${
                            active
                              ? 'bakasa-btn-green text-white'
                              : 'bg-[#FFF9F0] dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#FFF3E0] dark:hover:bg-[#334155] hover:text-[#1E293B] dark:hover:text-[#F8FAFC] border-2 border-[#E7DEC8] dark:border-[#334155]'
                          }`}
                        >
                          {sec} ثانية
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            }
            onStartSeries={(rounds) => {
              setTotalRounds(rounds);
              setCurrentRound(1);
              setSeriesScores({});
              setPhase('COUNTDOWN');
            }}
            onBack={onExitToArcadeHub}
          />
        </div>
      )}

      {isRoundActive && (
        <ArcadeFloatingHud
          secondsLeft={secondsLeft}
          stageLabel={`مباراة ${currentRound}/${totalRounds} · ⚽ ${scoreboardText}`}
          muted={muted}
          onRequestExit={() => setShowExitConfirm(true)}
        />
      )}

      {isRoundActive && (
        <div
          ref={arenaRef}
          dir="ltr"
          style={{ touchAction: 'none' }}
          className="relative w-full h-full overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            style={{ touchAction: 'none' }}
            className="w-full h-full block bg-[#0f6a29]"
          />

          {phase === 'COUNTDOWN' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/50 px-6 text-center z-20">
              <div className="text-lg font-black text-amber-300 mb-1 tabular-nums">
                مباراة {currentRound} من {totalRounds} ·{' '}
                {winMode === 'goals' ? `أول ${targetGoals} أهداف` : `${matchSeconds} ثانية`}
              </div>
              <div className="text-8xl font-black text-white drop-shadow-[0_6px_0_#111827] tabular-nums">
                {countdownNum}
              </div>
              <div className="mt-3 text-sm sm:text-base font-black text-white/95">
                سيب الجويستيك للشوت · اسحب وسيب بسرعة للزحلقة على الكورة!
              </div>
            </div>
          )}

          {/* 1.5s Animated Goal Celebration Overlay on Every Goal */}
          {goalBanner && (
            <div
              dir="rtl"
              className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overflow-hidden"
            >
              <div className="absolute inset-0 overflow-hidden">
                {Array.from({ length: 16 }, (_, ci) => (
                  <span
                    key={ci}
                    style={{
                      left: `${8 + ((ci * 37) % 84)}%`,
                      top: '15%',
                      width: '10px',
                      height: '16px',
                      backgroundColor:
                        ci % 3 === 0
                          ? TEAM_COLORS[goalBanner.teamIdx].ringHex
                          : ci % 3 === 1
                            ? '#FACC15'
                            : '#FFFFFF',
                      animation: `confetti-fall 1350ms linear ${(ci % 4) * 90}ms forwards`,
                    }}
                    className="absolute rounded-sm"
                  />
                ))}
              </div>
              <div
                style={{ borderColor: TEAM_COLORS[goalBanner.teamIdx].ringHex }}
                className="relative animate-goal-pop rounded-3xl bg-[#0F172A]/95 border-4 px-8 py-6 text-center shadow-2xl"
              >
                <div className="text-4xl sm:text-5xl font-black text-[#FACC15] drop-shadow mb-2">
                  جووووون! ⚽🔥
                </div>
                <div
                  style={{ color: TEAM_COLORS[goalBanner.teamIdx].ringHex }}
                  className="text-lg font-black"
                >
                  {goalBanner.scorerName
                    ? `بقدم ${goalBanner.scorerName}!`
                    : TEAM_COLORS[goalBanner.teamIdx].name}
                </div>
              </div>
            </div>
          )}

          {/* Compact Floating Corner 360° Joysticks with Short Player-Only Pill Badge */}
          {players.map((player, idx) => {
            const def = cornerDefs[idx];
            const theme = ARCADE_COLORS[player.colorId];
            if (!def) return null;
            const jv = joyVisuals[idx] ?? { kx: 0, ky: 0, active: false, x: null, y: null };
            const teamInfo = TEAM_COLORS[def.teamIdx];
            const isFloating = jv.x !== null && jv.y !== null;

            return (
              <div
                key={player.id}
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => handleJoyDown(e, idx)}
                onPointerMove={handleJoyMove}
                onPointerUp={handleJoyUp}
                onPointerCancel={handleJoyUp}
                onLostPointerCapture={handleJoyUp}
                className={`absolute ${SLOT_QUADRANT_POS[def.slot]} z-20 w-[38vw] max-w-[162px] h-[30dvh] max-h-[188px] cursor-pointer select-none`}
              >
                <div
                  style={{
                    borderColor: teamInfo.ringHex,
                    backgroundColor: jv.active
                      ? 'rgba(15, 23, 42, 0.45)'
                      : 'rgba(15, 23, 42, 0.28)',
                    ...(isFloating
                      ? {
                          left: jv.x!,
                          top: jv.y!,
                          transform: 'translate(-50%, -50%)',
                        }
                      : {}),
                  }}
                  className={`pointer-events-none absolute ${
                    isFloating ? '' : SLOT_REST_ANCHOR[def.slot]
                  } w-[82px] h-[82px] rounded-full border-3 backdrop-blur-[1px] shadow-lg flex items-center justify-center`}
                >
                  <span
                    style={{
                      backgroundColor: teamInfo.badgeBg,
                      textOverflow: 'ellipsis',
                    }}
                    className={`pointer-events-none absolute -top-5 px-1.5 py-0.5 rounded-full border border-white/35 text-[10px] font-black text-white whitespace-nowrap overflow-hidden max-w-[72px] shadow ${
                      def.isTop ? 'rotate-180 -bottom-5 top-auto' : ''
                    }`}
                  >
                    {player.name}
                  </span>

                  <div
                    style={{
                      backgroundColor: theme.hex,
                      borderColor: teamInfo.ringHex,
                      transform: `translate3d(${jv.kx * JOYSTICK_MAX_R}px, ${jv.ky * JOYSTICK_MAX_R}px, 0) scale(${jv.active ? 1.1 : 1})`,
                    }}
                    className="pointer-events-none w-9 h-9 rounded-full border-3 shadow-[0_3px_0_#111827] transition-transform duration-75"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {phase === 'INTER_ROUND' && (
        <ArcadeSeriesOverlay
          players={players}
          seriesScores={seriesScores}
          roundDeltas={roundDeltas}
          roundNum={currentRound}
          totalRounds={totalRounds}
          headline={summaryText}
          extraRows={players.map((p, idx) => ({
            playerId: p.id,
            badge: `${scores[cornerDefs[idx]?.teamIdx ?? 0] ?? 0} ⚽`,
          }))}
          durationMs={2500}
        />
      )}

      {phase === 'WINNER_SPOTLIGHT' && (
        <ArcadeWinnerSpotlight
          winners={seriesWinners}
          seriesScores={seriesScores}
          headline={summaryText}
          onContinueToLeaderboard={() => setPhase('LEADERBOARD')}
        />
      )}

      {phase === 'LEADERBOARD' && (
        <div className="flex-1 flex flex-col pt-4 overflow-y-auto">
          <div className="w-full max-w-xl mx-auto px-4 pb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onExitToArcadeHub}
              className="min-h-[44px] px-3 rounded-2xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 border-b-[#D5C7B2] dark:border-b-[#090F1E] text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
              <span>ألعاب 2D</span>
            </button>
            <h1 className="text-2xl font-black text-[#1E293B] dark:text-[#F8FAFC]">
              نتيجة البطولة
            </h1>
            <div className="w-20 flex justify-end">
              {goHome && <HomeLogoBadge onClick={goHome} />}
            </div>
          </div>

          <ArcadeLeaderboardScreen
            players={players}
            deltas={finalSeriesDeltas}
            summaryHeadline={summaryText}
            onNewRound={() => {
              setCurrentRound(1);
              setSeriesScores({});
              setPhase('SETUP');
            }}
            onBackToArcadeHub={onExitToArcadeHub}
          />
        </div>
      )}

      <ConfirmModal
        open={showExitConfirm}
        title="الخروج من كرة القدم؟"
        message="المباراة لسه شغالة، لو خرجت دلوقتي النتيجة مش هتتحسب."
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitToArcadeHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
