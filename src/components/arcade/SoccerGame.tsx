import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Goal, Timer, Trophy } from 'lucide-react';
import { useGoHome } from '../../contexts/NavigationContext';
import { useArcadeTouchLock } from '../../hooks/useArcadeTouchLock';
import { mapScreenDeltaToLandscape, useForceLandscape } from '../../hooks/useForceLandscape';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import {
  ARCADE_COLORS,
  ArcadeDelta,
  ArcadePlayer,
  CornerSlot,
  getCornerPlacements,
} from '../../types/arcade';
import { recordArcadeWin, recordSoccerGoal } from '../../utils/sessionStats';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { ConfirmModal } from '../ConfirmModal';
import { HomeLogoBadge } from '../HomeLogoBadge';
import { ArcadeFloatingHud } from './ArcadeFloatingHud';
import { ArcadeLeaderboardScreen } from './ArcadeLeaderboardScreen';
import { ArcadePreGameSetup } from './ArcadePreGameSetup';
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
  teamIdx: 0 | 1; // 0 = فريق اليسار | 1 = فريق اليمين
  slot: CornerSlot;
  isTop: boolean;
  name: string;
  hex: string;
  darkHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
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
  goalHalfH: number;
}

const JOYSTICK_MAX_R = 36;
const PLAYER_R = 15;
const BALL_R = 10.5;
const POST_R = 5.5;
const RUN_SPEED = 195;
const SLIDE_SPEED = 465;

const TEAM_COLORS = {
  0: { name: 'فريق اليسار', ringHex: '#38bdf8', badgeBg: 'rgba(14, 165, 233, 0.88)' },
  1: { name: 'فريق اليمين', ringHex: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.88)' },
} as const;

const SLOT_CORNER_POS: Record<CornerSlot, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

function getPitchBounds(w: number, h: number): PitchBounds {
  const goalDepth = Math.max(22, Math.min(28, w * 0.036));
  const padX = goalDepth + 12;
  const padY = Math.max(32, Math.min(54, h * 0.095));
  const pitchH = Math.max(180, h - padY * 2);
  return {
    left: padX,
    right: w - padX,
    top: padY,
    bottom: h - padY,
    goalDepth,
    // Goal mouth centered vertically on LEFT & RIGHT edges (25% narrower for higher skill)
    goalHalfH: Math.max(27, Math.min(57, pitchH * 0.1275)),
  };
}

function drawSoccerPlayer(
  ctx: CanvasRenderingContext2D,
  p: SoccerPlayerEntity,
  hasBall: boolean,
  now: number,
  teamRingHex: string
) {
  const isSliding = p.slideUntil > now;
  const stunned = p.grabCooldownUntil > now && !hasBall;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  // Matching Team Ring
  ctx.strokeStyle = teamRingHex;
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
  const [roundWins, setRoundWins] = useState<[number, number]>([0, 0]);
  const [joyVisuals, setJoyVisuals] = useState<
    Array<{ kx: number; ky: number; active: boolean; x: number | null; y: number | null }>
  >(() => players.map(() => ({ kx: 0, ky: 0, active: false, x: null, y: null })));
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
  const roundWinsRef = useRef<[number, number]>([0, 0]);
  const skidsRef = useRef<SkidParticle[]>([]);
  const popupsRef = useRef<FloatingPopup[]>([]);
  const goalPauseUntilRef = useRef<number>(0);
  const goalCelebrateUntilRef = useRef<number>(0);
  const goalTimeoutRef = useRef<number | null>(null);
  const joyPointersRef = useRef<
    Map<number, { playerIdx: number; cx: number; cy: number; x: number; y: number; rect: DOMRect }>
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
  const lastJoyHapticRef = useRef<Array<{ angle: number; time: number }>>(
    players.map(() => ({ angle: 0, time: 0 }))
  );
  const roundStartRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(90);
  const lastWallSoundTimeRef = useRef<number>(0);
  const finishedRef = useRef<boolean>(false);

  const cornerDefs = getCornerPlacements(players.length).map((placement) => ({
    ...placement,
    // Left-side corners (top-left & bottom-left) = Team 0 (Left); Right-side corners (top-right & bottom-right) = Team 1 (Right)
    teamIdx: (placement.slot.includes('left') ? 0 : 1) as 0 | 1,
  }));
  const leftLeadIdx = cornerDefs.findIndex((d) => d.teamIdx === 0);
  const rightLeadIdx = cornerDefs.findIndex((d) => d.teamIdx === 1);
  const leftTeamTheme = ARCADE_COLORS[players[leftLeadIdx >= 0 ? leftLeadIdx : 1]?.colorId ?? 'blue'];
  const rightTeamTheme = ARCADE_COLORS[players[rightLeadIdx >= 0 ? rightLeadIdx : 0]?.colorId ?? 'red'];
  const effectiveDuration = winMode === 'goals' ? 180 : matchSeconds;
  const goHome = useGoHome();
  const isRoundActive = phase === 'COUNTDOWN' || phase === 'PLAYING';
  const { isRotatedPortrait } = useForceLandscape(isRoundActive);

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
      h: Math.max(300, Math.round(el.clientHeight)),
    };
  }, []);

  const placeKickoffPositions = useCallback(() => {
    const { w, h } = arenaSizeRef.current;
    const pb = getPitchBounds(w, h);
    const cx = (pb.left + pb.right) / 2;
    const cy = (pb.top + pb.bottom) / 2;
    const pitchW = pb.right - pb.left;
    const pitchH = pb.bottom - pb.top;

    const team0 = entitiesRef.current.filter((e) => e.teamIdx === 0); // Left Team
    const team1 = entitiesRef.current.filter((e) => e.teamIdx === 1); // Right Team

    team0.forEach((ent) => {
      const spreadY =
        team0.length === 1 ? 0 : (ent.slot.includes('top') ? -1 : 1) * (pitchH * 0.22);
      ent.x = cx - pitchW * 0.22;
      ent.y = cy + spreadY;
      ent.vx = 0;
      ent.vy = 0;
      ent.angle = 0; // Facing RIGHT toward Right Goal
      ent.slideUntil = 0;
      ent.tackleCooldownUntil = 0;
      ent.grabCooldownUntil = 0;
    });

    team1.forEach((ent) => {
      const spreadY =
        team1.length === 1 ? 0 : (ent.slot.includes('top') ? -1 : 1) * (pitchH * 0.22);
      ent.x = cx + pitchW * 0.22;
      ent.y = cy + spreadY;
      ent.vx = 0;
      ent.vy = 0;
      ent.angle = Math.PI; // Facing LEFT toward Left Goal
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
    const defs = getCornerPlacements(players.length);

    entitiesRef.current = players.map((p, idx) => {
      const theme = ARCADE_COLORS[p.colorId];
      const placement = defs[idx];
      return {
        playerIdx: idx,
        teamIdx: (placement.slot.includes('left') ? 0 : 1) as 0 | 1,
        slot: placement.slot,
        isTop: placement.isTop,
        name: p.name,
        hex: theme.hex,
        darkHex: theme.darkHex,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
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
    const usableLeft = pb.left + 84;
    const usableRight = pb.right - 84;
    const cols = Math.max(6, Math.floor((usableRight - usableLeft) / 34));
    for (let c = 0; c < cols; c++) {
      const sx = usableLeft + ((c + 0.5) * (usableRight - usableLeft)) / cols;
      specs.push({
        x: sx,
        y: Math.max(10, pb.top * 0.45),
        color: crowdColors[c % crowdColors.length],
        seed: c * 0.9,
      });
      specs.push({
        x: sx + 6,
        y: Math.min(h - 10, pb.bottom + (h - pb.bottom) * 0.55),
        color: crowdColors[(c + 3) % crowdColors.length],
        seed: c * 1.3 + 2,
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
    joysRef.current = players.map((_, idx) => {
      const isLeft = defs[idx]?.slot.includes('left');
      return {
        dx: 0,
        dy: 0,
        kx: 0,
        ky: 0,
        active: false,
        lastValidDx: isLeft ? 1 : -1,
        lastValidDy: 0,
        lastValidPull: 0,
      };
    });
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

    if (sc[0] > sc[1]) {
      roundWinsRef.current = [roundWinsRef.current[0] + 1, roundWinsRef.current[1]];
    } else if (sc[1] > sc[0]) {
      roundWinsRef.current = [roundWinsRef.current[0], roundWinsRef.current[1] + 1];
    }
    setRoundWins([...roundWinsRef.current]);

    const winnerPlayers = entitiesRef.current.filter((e) => winningTeams.has(e.teamIdx));
    const winnerIds = new Set(winnerPlayers.map((e) => players[e.playerIdx].id));
    winnerIds.forEach((id) => recordArcadeWin(id));

    const deltas: ArcadeDelta[] = players.map((p) => ({
      playerId: p.id,
      delta: winnerIds.has(p.id) ? 100 : 0,
    }));

    onApplyDeltas(deltas);

    const nextSeriesScores: Record<string, number> = { ...seriesScores };
    deltas.forEach((d) => {
      nextSeriesScores[d.playerId] = (nextSeriesScores[d.playerId] ?? 0) + d.delta;
    });
    setSeriesScores(nextSeriesScores);

    if (currentRound < totalRounds) {
      soundManager.play('victory');
      setCurrentRound((prev) => prev + 1);
      setPhase('COUNTDOWN');
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

      // Vertical mowed grass stripes for horizontal pitch
      const stripeCount = 12;
      const stripeW = pitchW / stripeCount;
      for (let s = 0; s < stripeCount; s++) {
        ctx.fillStyle = s % 2 === 0 ? '#1ea346' : '#188f3b';
        ctx.fillRect(pb.left + s * stripeW, pb.top, stripeW + 0.6, pitchH);
      }

      // White pitch boundary lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 3;
      ctx.strokeRect(pb.left, pb.top, pitchW, pitchH);

      // Vertical halfway line down the middle + center circle
      ctx.beginPath();
      ctx.moveTo(cx, pb.top);
      ctx.lineTo(cx, pb.bottom);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(pitchW, pitchH) * 0.175, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Left & Right Penalty Boxes
      const boxW = Math.min(pitchW * 0.14, 96);
      const boxH = Math.min(pitchH * 0.56, pb.goalHalfH * 2.55);
      ctx.strokeRect(pb.left, cy - boxH / 2, boxW, boxH);
      ctx.strokeRect(pb.right - boxW, cy - boxH / 2, boxW, boxH);

      const drawGoalCage = (
        gx: number,
        gy: number,
        gw: number,
        gh: number,
        accent: string,
        postX: number
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

        // Solid Goalposts on top & bottom edges of the vertical goal mouth
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2.4;
        for (const py of [gy, gy + gh]) {
          ctx.beginPath();
          ctx.arc(postX, py, POST_R, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      };

      // LEFT GOAL (Defended by Left Team / Team 0)
      drawGoalCage(
        pb.left - pb.goalDepth,
        cy - pb.goalHalfH,
        pb.goalDepth,
        pb.goalHalfH * 2,
        leftTeamTheme.hex,
        pb.left
      );

      // RIGHT GOAL (Defended by Right Team / Team 1)
      drawGoalCage(
        pb.right,
        cy - pb.goalHalfH,
        pb.goalDepth,
        pb.goalHalfH * 2,
        rightTeamTheme.hex,
        pb.right
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

      // Directional Aim Arrow when possessor aims with joystick
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
        const ringHex = p.teamIdx === 0 ? leftTeamTheme.hex : rightTeamTheme.hex;
        drawSoccerPlayer(ctx, p, ball.possessorIdx === p.playerIdx, now, ringHex);
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
    [leftTeamTheme.hex, rightTeamTheme.hex]
  );

  useEffect(() => {
    if (!isRoundActive) return;
    const handleResize = () => {
      syncArenaSize();
      if (phase === 'COUNTDOWN') {
        placeKickoffPositions();
        drawScene(performance.now());
      }
    };
    const raf = window.requestAnimationFrame(handleResize);
    const ro = new ResizeObserver(handleResize);
    if (arenaRef.current) ro.observe(arenaRef.current);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isRoundActive, isRotatedPortrait, phase, syncArenaSize, placeKickoffPositions, drawScene]);

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

      // Brief 1.1s non-blocking goal celebration banner
      goalPauseUntilRef.current = now + 1100;
      goalCelebrateUntilRef.current = now + 1100;
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
      }, 1100);
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
              if (skidsRef.current.length >= 60) {
                skidsRef.current.shift();
              }
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
              const curvedMag = Math.pow(mag, 0.82);
              const targetSpd = RUN_SPEED * (0.28 + 0.72 * curvedMag);
              const accelAlpha = 1 - Math.exp(-22 * dt);
              p.vx += (Math.cos(dirAng) * targetSpd - p.vx) * accelAlpha;
              p.vy += (Math.sin(dirAng) * targetSpd - p.vy) * accelAlpha;
            } else {
              const decelAlpha = Math.exp(-16 * dt);
              p.vx *= decelAlpha;
              p.vy *= decelAlpha;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
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

        // Solid goalpost circle collisions (left & right goalposts)
        const posts = [
          { x: pb.left, y: cy - pb.goalHalfH },
          { x: pb.left, y: cy + pb.goalHalfH },
          { x: pb.right, y: cy - pb.goalHalfH },
          { x: pb.right, y: cy + pb.goalHalfH },
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

        // Check Goal Scoring (Left Goal & Right Goal on horizontal pitch)
        const inGoalY = Math.abs(ball.y - cy) <= pb.goalHalfH - BALL_R * 0.3;

        // LEFT GOAL entered -> Right Team (Team 1) scores!
        if (ball.x <= pb.left - 4 && inGoalY) {
          handleGoalScored(1, now);
        }
        // RIGHT GOAL entered -> Left Team (Team 0) scores!
        else if (ball.x >= pb.right + 4 && inGoalY) {
          handleGoalScored(0, now);
        } else if (ball.possessorIdx === null) {
          // Free-ball pitch boundary bounces (only trigger audio on sharp impacts with 250ms cooldown)
          if (ball.x - BALL_R < pb.left && !inGoalY) {
            const vn = ball.vx * dt;
            ball.x = pb.left + BALL_R;
            ball.vx = Math.abs(ball.vx) * 0.78;
            if (Math.abs(vn) > 2.5 && now - lastWallSoundTimeRef.current >= 250) {
              lastWallSoundTimeRef.current = now;
              soundManager.play('wallBounce');
            }
          } else if (ball.x + BALL_R > pb.right && !inGoalY) {
            const vn = ball.vx * dt;
            ball.x = pb.right - BALL_R;
            ball.vx = -Math.abs(ball.vx) * 0.78;
            if (Math.abs(vn) > 2.5 && now - lastWallSoundTimeRef.current >= 250) {
              lastWallSoundTimeRef.current = now;
              soundManager.play('wallBounce');
            }
          }

          if (ball.y - BALL_R < pb.top) {
            const vn = ball.vy * dt;
            ball.y = pb.top + BALL_R;
            ball.vy = Math.abs(ball.vy) * 0.78;
            if (Math.abs(vn) > 2.5 && now - lastWallSoundTimeRef.current >= 250) {
              lastWallSoundTimeRef.current = now;
              soundManager.play('wallBounce');
            }
          } else if (ball.y + BALL_R > pb.bottom) {
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
          if (!inGoalY) {
            ball.x = Math.max(pb.left + BALL_R, Math.min(pb.right - BALL_R, ball.x));
          }
          ball.y = Math.max(pb.top + BALL_R, Math.min(pb.bottom - BALL_R, ball.y));
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
    return () => {
      window.cancelAnimationFrame(rafId);
      if (goalTimeoutRef.current !== null) {
        window.clearTimeout(goalTimeoutRef.current);
        goalTimeoutRef.current = null;
      }
    };
  }, [
    phase,
    effectiveDuration,
    winMode,
    targetGoals,
    drawScene,
    finishRound,
    placeKickoffPositions,
  ]);

  // Ultra-Responsive Floating Multi-Touch Joystick Handlers
  const updateJoy = (
    playerIdx: number,
    rawDx: number,
    rawDy: number,
    spawnX: number,
    spawnY: number
  ) => {
    const dist = Math.hypot(rawDx, rawDy);
    const active = dist > 0.5;
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
    if (dist > 3) {
      j.lastValidDx = rawDx / dist;
      j.lastValidDy = rawDy / dist;
      j.lastValidPull = pull;
    }

    if (dist > 6) {
      const ang = Math.atan2(rawDy, rawDx);
      const prevH = lastJoyHapticRef.current[playerIdx];
      const now = performance.now();
      if (prevH) {
        let diff = ang - prevH.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) >= 0.85 && now - prevH.time >= 95) {
          triggerHaptic(15);
          prevH.angle = ang;
          prevH.time = now;
        }
      }
    }

    setJoyVisuals((prev) =>
      prev.map((item, idx) =>
        idx === playerIdx ? { kx: nx, ky: ny, active: true, x: null, y: null } : item
      )
    );
  };

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>, playerIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic capture failures
    }
    soundManager.unlock();
    triggerHaptic(15);
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    joyPointersRef.current.set(e.pointerId, {
      playerIdx,
      cx,
      cy,
      x: rect.width / 2,
      y: rect.height / 2,
      rect,
    });
    const j = joysRef.current[playerIdx];
    j.lastValidPull = 0;
    const { dx: rawDx, dy: rawDy } = mapScreenDeltaToLandscape(
      e.clientX - cx,
      e.clientY - cy,
      isRotatedPortrait
    );
    lastJoyHapticRef.current[playerIdx] = {
      angle: Math.hypot(rawDx, rawDy) > 1 ? Math.atan2(rawDy, rawDx) : 0,
      time: performance.now(),
    };
    updateJoy(playerIdx, rawDx, rawDy, rect.width / 2, rect.height / 2);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const entry = joyPointersRef.current.get(e.pointerId);
    if (!entry) return;
    e.preventDefault();
    const { dx, dy } = mapScreenDeltaToLandscape(
      e.clientX - entry.cx,
      e.clientY - entry.cy,
      isRotatedPortrait
    );
    updateJoy(entry.playerIdx, dx, dy, entry.x, entry.y);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const entry = joyPointersRef.current.get(e.pointerId);
    if (!entry) return;
    joyPointersRef.current.delete(e.pointerId);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }

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

  // Top floating scoreboard string (Left Team : Right Team)
  const scoreboardText = `${scores[0]} : ${scores[1]}`;

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] flex flex-col select-none overflow-hidden">
      {phase === 'SETUP' && (
        <div className="flex-1 overflow-y-auto">
          <ArcadePreGameSetup
            title="كرة القدم"
            subtitle={
              players.length >= 3
                ? 'فريق اليسار ضد فريق اليمين: اسحب الجويستيك للتحرك، وسيبه للشوت أو الزحلقة على الكورة!'
                : '1 ضد 1 (يسار ضد يمين): المس الكورة للمراوغة، وسيب الجويستيك للشوت أو الزحلقة!'
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
              roundWinsRef.current = [0, 0];
              setRoundWins([0, 0]);
              setPhase('COUNTDOWN');
            }}
            onBack={onExitToArcadeHub}
          />
        </div>
      )}

      {isRoundActive && (
        <div
          ref={arenaRef}
          dir="ltr"
          style={
            isRotatedPortrait
              ? {
                  width: '100dvh',
                  height: '100vw',
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(90deg)',
                  transformOrigin: 'center center',
                  touchAction: 'none',
                }
              : { touchAction: 'none' }
          }
          className={
            isRotatedPortrait
              ? 'overflow-hidden bg-[#0f6a29] z-10'
              : 'relative w-full h-full overflow-hidden'
          }
        >
          <ArcadeFloatingHud
            secondsLeft={secondsLeft}
            stageLabel={`مباراة ${currentRound}/${totalRounds}`}
            muted={muted}
            positionMode="absolute"
            onRequestExit={() => setShowExitConfirm(true)}
          />

          <div
            dir="ltr"
            className="pointer-events-none absolute top-[36px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-black/80 border border-white/15 px-3 py-0.5 shadow-md text-[11px] sm:text-xs font-black text-white tabular-nums whitespace-nowrap"
          >
            <span className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/70"
                style={{ backgroundColor: leftTeamTheme.hex }}
              />
              <span>{leftTeamTheme.name}</span>
            </span>
            <span className="text-amber-300 text-xs sm:text-sm">
              {roundWins[0]} - {roundWins[1]}
            </span>
            <span className="flex items-center gap-1">
              <span>{rightTeamTheme.name}</span>
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/70"
                style={{ backgroundColor: rightTeamTheme.hex }}
              />
            </span>
            <span className="text-white/30">|</span>
            <span className="text-emerald-300">⚽ {scoreboardText}</span>
          </div>

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

          {/* Brief 1.1s Non-Blocking Goal Banner */}
          {goalBanner && (
            <div
              dir="rtl"
              className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center px-4 overflow-visible"
            >
              <div
                style={{
                  borderColor:
                    goalBanner.teamIdx === 0 ? leftTeamTheme.hex : rightTeamTheme.hex,
                }}
                className="relative animate-goal-pop rounded-2xl bg-[#0F172A]/90 border-4 px-7 py-4 text-center shadow-2xl"
              >
                <div className="text-3xl sm:text-4xl font-black text-[#FACC15] drop-shadow mb-1">
                  جووووون! ⚽🔥
                </div>
                <div
                  style={{
                    color: goalBanner.teamIdx === 0 ? leftTeamTheme.hex : rightTeamTheme.hex,
                  }}
                  className="text-sm sm:text-base font-black"
                >
                  {goalBanner.scorerName
                    ? `بقدم ${goalBanner.scorerName}!`
                    : TEAM_COLORS[goalBanner.teamIdx].name}
                </div>
              </div>
            </div>
          )}

          {/* Strictly Fixed Base Corner 360° Joysticks */}
          {players.map((player, idx) => {
            const def = cornerDefs[idx];
            const theme = ARCADE_COLORS[player.colorId];
            if (!def) return null;
            const jv = joyVisuals[idx] ?? { kx: 0, ky: 0, active: false, x: null, y: null };
            const teamHex = def.teamIdx === 0 ? leftTeamTheme.hex : rightTeamTheme.hex;

            return (
              <div
                key={player.id}
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => handleJoyDown(e, idx)}
                onPointerMove={handleJoyMove}
                onPointerUp={handleJoyUp}
                onPointerCancel={handleJoyUp}
                onLostPointerCapture={handleJoyUp}
                className={`absolute ${SLOT_CORNER_POS[def.slot]} z-20 w-[106px] h-[106px] rounded-full cursor-pointer select-none flex items-center justify-center`}
              >
                <div
                  style={{
                    borderColor: teamHex,
                    backgroundColor: jv.active
                      ? 'rgba(15, 23, 42, 0.72)'
                      : 'rgba(15, 23, 42, 0.52)',
                  }}
                  className="pointer-events-none relative w-full h-full rounded-full border-[3.5px] shadow-[0_4px_0_rgba(0,0,0,0.35)] flex items-center justify-center"
                >
                  <span
                    style={{
                      backgroundColor: teamHex,
                      textOverflow: 'ellipsis',
                    }}
                    className={`pointer-events-none absolute -top-5 px-2 py-0.5 rounded-full border border-white/45 text-[10px] font-black text-white whitespace-nowrap overflow-hidden max-w-[92px] shadow ${
                      def.isTop ? 'rotate-180 -bottom-5 top-auto' : ''
                    }`}
                  >
                    {player.name}
                  </span>

                  <div
                    style={{
                      backgroundColor: theme.hex,
                      borderColor: teamHex,
                      transform: `translate3d(${jv.kx * JOYSTICK_MAX_R}px, ${jv.ky * JOYSTICK_MAX_R}px, 0) scale(${jv.active ? 1.08 : 1})`,
                    }}
                    className={`pointer-events-none w-10 h-10 rounded-full border-[3px] shadow-[0_3px_0_#111827] ${
                      jv.active ? '' : 'transition-transform duration-150'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
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
              roundWinsRef.current = [0, 0];
              setRoundWins([0, 0]);
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
