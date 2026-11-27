import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bird } from 'lucide-react';
import { useGoHome } from '../../contexts/NavigationContext';
import { useArcadeTouchLock } from '../../hooks/useArcadeTouchLock';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import {
  ARCADE_COLORS,
  ArcadeDelta,
  ArcadePlayer,
  CornerSlot,
  getCornerPlacements,
} from '../../types/arcade';
import { recordArcadeWin } from '../../utils/sessionStats';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { ConfirmModal } from '../ConfirmModal';
import { HomeLogoBadge } from '../HomeLogoBadge';
import { ArcadeFloatingHud } from './ArcadeFloatingHud';
import { ArcadeLeaderboardScreen } from './ArcadeLeaderboardScreen';
import { ArcadePreGameSetup } from './ArcadePreGameSetup';
import { ArcadeSeriesOverlay } from './ArcadeSeriesOverlay';
import { ArcadeWinnerSpotlight } from './ArcadeWinnerSpotlight';

interface ChickenCatchGameProps {
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

interface PenRect {
  x: number;
  y: number;
  w: number;
  h: number;
  slot: CornerSlot;
}

interface PlayerEntity {
  playerIdx: number;
  name: string;
  hex: string;
  darkHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  carryingIds: number[];
  capturedCount: number;
  pen: PenRect;
  nestShieldUntil: number;
  bumpCooldownUntil: number;
}

interface ChickenEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  state: 'loose' | 'carried' | 'penned';
  carrierIdx: number | null;
  penIdx: number | null;
  panicking: boolean;
  nextWanderAt: number;
  pickupCooldownUntil: number;
  flapSeed: number;
}

interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface JoystickVisual {
  kx: number;
  ky: number;
  active: boolean;
  x: number | null;
  y: number | null;
}

const CHICKEN_POOL = 20;
const MAX_CARRY = 2;
const DEFAULT_MATCH_SECONDS = 45;
const PLAYER_SPEED = 205;
const JOYSTICK_MAX_R = 36;

const SLOT_CORNER_POS: Record<CornerSlot, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

function computePenRect(slot: CornerSlot, w: number, h: number): PenRect {
  const pw = Math.max(96, Math.min(138, w * 0.31));
  const ph = Math.max(104, Math.min(150, h * 0.22));
  const pad = 10;
  if (slot === 'top-left') return { x: pad, y: pad, w: pw, h: ph, slot };
  if (slot === 'top-right') return { x: w - pw - pad, y: pad, w: pw, h: ph, slot };
  if (slot === 'bottom-left') return { x: pad, y: h - ph - pad, w: pw, h: ph, slot };
  return { x: w - pw - pad, y: h - ph - pad, w: pw, h: ph, slot };
}

function drawChickenSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  scale: number,
  panicking: boolean,
  now: number,
  seed: number
) {
  const wingSpread = panicking ? Math.sin(now * 0.03 + seed) * 4.5 : Math.sin(now * 0.01 + seed) * 1.5;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(angle);

  // Soft shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(-1, 3, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Orange beak pointing +X
  ctx.fillStyle = '#f97316';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(9, -3);
  ctx.lineTo(15, 0);
  ctx.lineTo(9, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Flapping wings
  ctx.fillStyle = '#f1f5f9';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-1, side * (8 + wingSpread * 0.4), 6, 3.5, side * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Plump white body
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10.5, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Red comb on head
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(3, 0, 3.3, 0, Math.PI * 2);
  ctx.arc(-1, 0, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(6, -3.2, 1.4, 0, Math.PI * 2);
  ctx.arc(6, 3.2, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPlayerCharacter(
  ctx: CanvasRenderingContext2D,
  player: PlayerEntity,
  now: number
) {
  ctx.save();
  ctx.translate(player.x, player.y);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.arc(2, 4, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(player.angle);

  // Extended catching hands
  ctx.fillStyle = player.hex;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(12, side * 11, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Torso / Shoulders
  ctx.fillStyle = player.hex;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head / Cap
  ctx.fillStyle = player.darkHex;
  ctx.beginPath();
  ctx.arc(1, 0, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eyes facing +X
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(6, -4, 2.4, 0, Math.PI * 2);
  ctx.arc(6, 4, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Render carried chicken(s) over the player's head!
  player.carryingIds.forEach((cid, cIdx) => {
    const offsetX = player.carryingIds.length === 2 ? (cIdx === 0 ? -9 : 9) : 0;
    const bobY = -20 + Math.sin(now * 0.014 + cid) * 2.5;
    drawChickenSprite(ctx, offsetX, bobY, -Math.PI / 2, 0.85, true, now, cid);
  });

  ctx.restore();
}

export const ChickenCatchGame: React.FC<ChickenCatchGameProps> = ({
  players,
  onApplyDeltas,
  onExitToArcadeHub,
}) => {
  const [phase, setPhase] = useState<MatchPhase>('SETUP');
  const [totalRounds, setTotalRounds] = useState<number>(3);
  const [matchSeconds, setMatchSeconds] = useState<number>(DEFAULT_MATCH_SECONDS);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [seriesScores, setSeriesScores] = useState<Record<string, number>>({});
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [secondsLeft, setSecondsLeft] = useState<number>(DEFAULT_MATCH_SECONDS);
  const [capturedCounts, setCapturedCounts] = useState<number[]>(() => players.map(() => 0));
  const [carryingCounts, setCarryingCounts] = useState<number[]>(() => players.map(() => 0));
  const [looseLeft, setLooseLeft] = useState<number>(CHICKEN_POOL);
  const [joyVisuals, setJoyVisuals] = useState<JoystickVisual[]>(() =>
    players.map(() => ({ kx: 0, ky: 0, active: false, x: null, y: null }))
  );
  const [roundDeltas, setRoundDeltas] = useState<ArcadeDelta[]>([]);
  const [finalSeriesDeltas, setFinalSeriesDeltas] = useState<ArcadeDelta[]>([]);
  const [seriesWinners, setSeriesWinners] = useState<ArcadePlayer[]>([]);
  const [summaryText, setSummaryText] = useState<string>('');
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => soundManager.isMuted());

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const arenaSizeRef = useRef<{ w: number; h: number }>({ w: 390, h: 760 });
  const playerEntitiesRef = useRef<PlayerEntity[]>([]);
  const chickensRef = useRef<ChickenEntity[]>([]);
  const popupsRef = useRef<FloatingPopup[]>([]);
  const joyPointersRef = useRef<
    Map<number, { playerIdx: number; cx: number; cy: number; x: number; y: number; rect: DOMRect }>
  >(new Map());
  const joyVectorsRef = useRef<Array<{ dx: number; dy: number; active: boolean }>>(
    players.map(() => ({ dx: 0, dy: 0, active: false }))
  );
  const lastJoyHapticRef = useRef<Array<{ angle: number; time: number }>>(
    players.map(() => ({ angle: 0, time: 0 }))
  );
  const roundStartRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(DEFAULT_MATCH_SECONDS);
  const finishedRef = useRef<boolean>(false);

  const placements = getCornerPlacements(players.length);
  const goHome = useGoHome();
  const isRoundActive = phase === 'COUNTDOWN' || phase === 'PLAYING';

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

  const syncArenaSize = useCallback(() => {
    const el = arenaRef.current;
    if (!el) return;
    arenaSizeRef.current = {
      w: Math.max(300, Math.round(el.clientWidth)),
      h: Math.max(420, Math.round(el.clientHeight)),
    };
  }, []);

  const resetMatchState = useCallback(() => {
    syncArenaSize();
    const { w, h } = arenaSizeRef.current;
    const cx = w / 2;
    const cy = h / 2;
    const currentPlacements = getCornerPlacements(players.length);

    playerEntitiesRef.current = players.map((p, idx) => {
      const theme = ARCADE_COLORS[p.colorId];
      const slot = currentPlacements[idx]?.slot ?? 'bottom-right';
      const pen = computePenRect(slot, w, h);
      const px = pen.x + pen.w / 2;
      const py = pen.y + pen.h / 2;
      const startX = px + Math.sign(cx - px) * 34;
      const startY = py + Math.sign(cy - py) * 34;
      return {
        playerIdx: idx,
        name: p.name,
        hex: theme.hex,
        darkHex: theme.darkHex,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        angle: Math.atan2(cy - startY, cx - startX),
        carryingIds: [],
        capturedCount: 0,
        pen,
        nestShieldUntil: 0,
        bumpCooldownUntil: 0,
      };
    });

    const yardR = Math.min(w, h) * 0.34;
    const chickens: ChickenEntity[] = [];
    for (let i = 0; i < CHICKEN_POOL; i++) {
      const ang = (i / CHICKEN_POOL) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 16 + Math.random() * (yardR * 0.78);
      const wandAng = Math.random() * Math.PI * 2;
      chickens.push({
        id: i + 1,
        x: cx + Math.cos(ang) * dist,
        y: cy + Math.sin(ang) * dist,
        vx: Math.cos(wandAng) * 48,
        vy: Math.sin(wandAng) * 48,
        angle: wandAng,
        state: 'loose',
        carrierIdx: null,
        penIdx: null,
        panicking: false,
        nextWanderAt: performance.now() + 700 + Math.random() * 1100,
        pickupCooldownUntil: 0,
        flapSeed: Math.random() * 10,
      });
    }
    chickensRef.current = chickens;
    popupsRef.current = [];
    joyPointersRef.current.clear();
    joyVectorsRef.current = players.map(() => ({ dx: 0, dy: 0, active: false }));
    finishedRef.current = false;
    setJoyVisuals(players.map(() => ({ kx: 0, ky: 0, active: false, x: null, y: null })));
    setCapturedCounts(players.map(() => 0));
    setCarryingCounts(players.map(() => 0));
    setLooseLeft(CHICKEN_POOL);
  }, [players, syncArenaSize]);

  const finishRound = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const counts = playerEntitiesRef.current.map((p) => p.capturedCount);
    const best = Math.max(...counts, 0);
    const winners = players.filter((_, idx) => counts[idx] === best && best > 0);
    const winnerIds = new Set(winners.map((w) => w.id));
    winnerIds.forEach((id) => recordArcadeWin(id));

    const roundHeadline =
      winners.length > 1
        ? `تعادل (${best} دجاجات): ${winners.map((w) => w.name).join(' و ')}`
        : winners.length === 1
          ? `صياد المزرعة: ${winners[0].name} (${best} دجاجات)!`
          : 'انتهى الوقت!';

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
          ? `أبطال المزرعة (${totalRounds} جولات): ${champs.map((c) => c.name).join(' و ')}`
          : champs.length === 1
            ? `بطل المزرعة (${totalRounds} جولات): ${champs[0].name}! 🏆`
            : `انتهت سلسلة الـ ${totalRounds} جولات!`;
      setSummaryText(seriesHeadline);
      setSeriesWinners(champs);
      setFinalSeriesDeltas(
        players.map((p) => ({ playerId: p.id, delta: nextSeriesScores[p.id] ?? 0 }))
      );
      setPhase('WINNER_SPOTLIGHT');
    }
  }, [currentRound, onApplyDeltas, players, seriesScores, totalRounds]);

  const drawScene = useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = arenaSizeRef.current;
    const cx = w / 2;
    const cy = h / 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Farmyard grass background
    ctx.fillStyle = '#7ec82a';
    ctx.fillRect(0, 0, w, h);

    // Subtle decorative grass bushes around edges
    ctx.fillStyle = '#5da418';
    const bushSpots = [
      { x: w * 0.5, y: 24, r: 24 },
      { x: w * 0.5, y: h - 24, r: 24 },
      { x: 24, y: h * 0.5, r: 22 },
      { x: w - 24, y: h * 0.5, r: 22 },
    ];
    for (const b of bushSpots) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Central muddy octagonal farm corral
    const yardR = Math.min(w, h) * 0.43;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    const sides = 10;
    for (let i = 0; i < sides; i++) {
      const a = (i * Math.PI * 2) / sides;
      const px = Math.cos(a) * yardR;
      const py = Math.sin(a) * yardR;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#a86523';
    ctx.fill();
    ctx.strokeStyle = '#6b3b12';
    ctx.lineWidth = 7;
    ctx.stroke();

    // Subtle dirt texture patches
    ctx.fillStyle = 'rgba(120, 63, 12, 0.25)';
    ctx.beginPath();
    ctx.arc(-yardR * 0.35, -yardR * 0.2, yardR * 0.16, 0, Math.PI * 2);
    ctx.arc(yardR * 0.32, yardR * 0.26, yardR * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Corner fenced player pens/houses
    for (const pe of playerEntitiesRef.current) {
      const { pen } = pe;
      ctx.save();
      ctx.fillStyle = 'rgba(132, 204, 22, 0.85)';
      ctx.strokeStyle = pe.hex;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(pen.x, pen.y, pen.w, pen.h, 16);
      ctx.fill();
      ctx.stroke();

      // Inner house icon & score count badge inside pen center
      const houseX =
        pen.slot === 'top-left' || pen.slot === 'bottom-left'
          ? pen.x + pen.w - 28
          : pen.x + 28;
      const houseY =
        pen.slot === 'top-left' || pen.slot === 'top-right'
          ? pen.y + pen.h - 26
          : pen.y + 26;

      ctx.fillStyle = pe.darkHex;
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(houseX - 18, houseY - 14, 36, 28, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 15px Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pe.capturedCount}`, houseX, houseY + 1);

      // Active 1.5s Protective Nest Shield after a steal
      if (pe.nestShieldUntil > now) {
        const shieldRatio = Math.max(0, Math.min(1, (pe.nestShieldUntil - now) / 1500));
        const pulse = 0.22 + Math.sin(now * 0.02) * 0.08;
        ctx.fillStyle = `rgba(56, 189, 248, ${pulse})`;
        ctx.beginPath();
        ctx.roundRect(pen.x - 2, pen.y - 2, pen.w + 4, pen.h + 4, 18);
        ctx.fill();

        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.roundRect(pen.x - 2, pen.y - 2, pen.w + 4, pen.h + 4, 18);
        ctx.stroke();
        ctx.setLineDash([]);

        // Circular shield countdown ring around pen center
        const ringX = pen.x + pen.w / 2;
        const ringY = pen.y + pen.h / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(ringX, ringY, 18, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(ringX, ringY, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * shieldRatio);
        ctx.stroke();

        ctx.font = '900 14px Cairo, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('🛡️', ringX, ringY + 1);
      }

      ctx.restore();
    }

    // Loose & penned chickens (carried ones are drawn above player heads)
    for (const ch of chickensRef.current) {
      if (ch.state === 'carried') continue;
      drawChickenSprite(
        ctx,
        ch.x,
        ch.y,
        ch.angle,
        ch.state === 'penned' ? 0.78 : 1,
        ch.panicking,
        now,
        ch.flapSeed
      );
    }

    // Players (with carried chickens rendered on top)
    for (const pe of playerEntitiesRef.current) {
      drawPlayerCharacter(ctx, pe, now);
    }

    // Popups
    for (const pop of popupsRef.current) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pop.life);
      ctx.font = '900 17px Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 4;
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    ctx.restore();
  }, []);

  // Countdown sequence
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    resetMatchState();
    drawScene(performance.now());
    setCountdownNum(3);
    setSecondsLeft(matchSeconds);
    lastTickSecRef.current = matchSeconds;
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
  }, [phase, matchSeconds, resetMatchState, drawScene]);

  // Auto-advance after 3s floating inter-round banner
  useEffect(() => {
    if (phase !== 'INTER_ROUND') return;
    const t = window.setTimeout(() => {
      setCurrentRound((prev) => prev + 1);
      setPhase('COUNTDOWN');
    }, 3000);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Main 60fps loop
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    let rafId = 0;
    let lastUiSync = 0;

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameRef.current) / 1000));
      lastFrameRef.current = now;

      const elapsedSec = (now - roundStartRef.current) / 1000;
      const remaining = Math.max(0, Math.ceil(matchSeconds - elapsedSec));
      if (remaining !== lastTickSecRef.current) {
        lastTickSecRef.current = remaining;
        setSecondsLeft(remaining);
        if (remaining > 0 && remaining <= 5) {
          soundManager.play('tickUrgent');
        }
      }

      if (elapsedSec >= matchSeconds) {
        drawScene(now);
        finishRound();
        return;
      }

      const { w, h } = arenaSizeRef.current;
      let uiDirty = false;

      // Move players with responsive 360° analog joystick & smooth acceleration
      for (let i = 0; i < playerEntitiesRef.current.length; i++) {
        const pe = playerEntitiesRef.current[i];
        const joy = joyVectorsRef.current[i];
        if (joy && joy.active) {
          const mag = Math.min(1, Math.hypot(joy.dx, joy.dy) / JOYSTICK_MAX_R);
          const dirAngle = Math.atan2(joy.dy, joy.dx);
          pe.angle = dirAngle;
          const carryPenalty = pe.carryingIds.length >= 2 ? 0.92 : 1;
          const curvedMag = Math.pow(mag, 0.82);
          const targetSpd = PLAYER_SPEED * (0.28 + 0.72 * curvedMag) * carryPenalty;
          const accelAlpha = 1 - Math.exp(-20 * dt);
          pe.vx += (Math.cos(dirAngle) * targetSpd - pe.vx) * accelAlpha;
          pe.vy += (Math.sin(dirAngle) * targetSpd - pe.vy) * accelAlpha;
        } else {
          const decelAlpha = Math.exp(-16 * dt);
          pe.vx *= decelAlpha;
          pe.vy *= decelAlpha;
        }
        pe.x += pe.vx * dt;
        pe.y += pe.vy * dt;

        const margin = 20;
        pe.x = Math.max(margin, Math.min(w - margin, pe.x));
        pe.y = Math.max(margin, Math.min(h - margin, pe.y));

        // Deposit carried chickens inside player's own corner pen
        if (pe.carryingIds.length > 0) {
          const { pen } = pe;
          const insideOwnPen =
            pe.x >= pen.x + 6 &&
            pe.x <= pen.x + pen.w - 6 &&
            pe.y >= pen.y + 6 &&
            pe.y <= pen.y + pen.h - 6;

          if (insideOwnPen) {
            const countDeposited = pe.carryingIds.length;
            for (const cid of pe.carryingIds) {
              const ch = chickensRef.current.find((c) => c.id === cid);
              if (ch) {
                ch.state = 'penned';
                ch.carrierIdx = null;
                ch.penIdx = i;
                ch.panicking = false;
                ch.x = pen.x + 22 + Math.random() * (pen.w - 44);
                ch.y = pen.y + 22 + Math.random() * (pen.h - 44);
              }
            }
            pe.carryingIds = [];
            pe.capturedCount += countDeposited;
            uiDirty = true;
            soundManager.play('gold');
            triggerHaptic(25);
            popupsRef.current.push({
              x: pe.x,
              y: pe.y - 22,
              text: `+${countDeposited}`,
              color: '#fde047',
              life: 1.1,
            });
          }
        }

        // Steal a chicken directly from an opponent's unshielded nest/pen!
        if (pe.carryingIds.length < MAX_CARRY) {
          for (let j = 0; j < playerEntitiesRef.current.length; j++) {
            if (j === i) continue;
            const targetPe = playerEntitiesRef.current[j];
            if (targetPe.capturedCount <= 0 || now < targetPe.nestShieldUntil) continue;

            const tPen = targetPe.pen;
            const insideTargetPen =
              pe.x >= tPen.x + 4 &&
              pe.x <= tPen.x + tPen.w - 4 &&
              pe.y >= tPen.y + 4 &&
              pe.y <= tPen.y + tPen.h - 4;

            if (insideTargetPen) {
              const stolen = chickensRef.current.find(
                (c) => c.state === 'penned' && c.penIdx === j
              );
              if (stolen) {
                stolen.state = 'carried';
                stolen.carrierIdx = i;
                stolen.penIdx = null;
                stolen.panicking = true;
                pe.carryingIds.push(stolen.id);
                targetPe.capturedCount = Math.max(0, targetPe.capturedCount - 1);
                targetPe.nestShieldUntil = now + 1500; // 1.5s shield cooldown!
                uiDirty = true;
                soundManager.play('sting');
                triggerHaptic([35, 30]);
                popupsRef.current.push({
                  x: pe.x,
                  y: pe.y - 26,
                  text: 'سرقة! 😈',
                  color: '#38BDF8',
                  life: 1.15,
                });
                break;
              }
            }
          }
        }
      }

      // Soft player-to-player collision + mid-field bump knock-loose stealing
      for (let i = 0; i < playerEntitiesRef.current.length; i++) {
        for (let j = i + 1; j < playerEntitiesRef.current.length; j++) {
          const a = playerEntitiesRef.current[i];
          const b = playerEntitiesRef.current[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.01 && d < 30) {
            const nx = dx / d;
            const ny = dy / d;
            const push = (30 - d) * 0.5;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;

            if (now >= a.bumpCooldownUntil && now >= b.bumpCooldownUntil) {
              const aSpeedToward = a.vx * nx + a.vy * ny;
              const bSpeedToward = -(b.vx * nx + b.vy * ny);
              let victim: PlayerEntity | null = null;
              let dirX = nx;
              let dirY = ny;

              if (b.carryingIds.length > 0 && aSpeedToward > bSpeedToward + 15) {
                victim = b;
              } else if (a.carryingIds.length > 0 && bSpeedToward > aSpeedToward + 15) {
                victim = a;
                dirX = -nx;
                dirY = -ny;
              }

              if (victim) {
                const droppedId = victim.carryingIds.pop();
                const dropped = chickensRef.current.find((c) => c.id === droppedId);
                if (dropped) {
                  dropped.state = 'loose';
                  dropped.carrierIdx = null;
                  dropped.panicking = true;
                  dropped.x = victim.x + dirX * 18;
                  dropped.y = victim.y + dirY * 18;
                  const scatterAng = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 0.9;
                  dropped.vx = Math.cos(scatterAng) * 175;
                  dropped.vy = Math.sin(scatterAng) * 175;
                  dropped.pickupCooldownUntil = now + 450;
                  a.bumpCooldownUntil = now + 680;
                  b.bumpCooldownUntil = now + 680;
                  uiDirty = true;
                  soundManager.play('hit');
                  triggerHaptic(28);
                  popupsRef.current.push({
                    x: victim.x,
                    y: victim.y - 24,
                    text: 'طارت الفرخة! 💨',
                    color: '#FB923C',
                    life: 1.0,
                  });
                }
              }
            }
          }
        }
      }

      // Update chickens (flee from nearby players, pick up on touch, or wander in pen)
      let looseCount = 0;
      const safeMarginX = Math.max(46, w * 0.1);
      const safeMarginY = Math.max(54, h * 0.1);

      for (const ch of chickensRef.current) {
        if (ch.state === 'carried') continue;

        if (ch.state === 'penned' && ch.penIdx !== null) {
          const pen = playerEntitiesRef.current[ch.penIdx]?.pen;
          if (pen) {
            if (now >= ch.nextWanderAt) {
              ch.nextWanderAt = now + 900 + Math.random() * 1200;
              const a = Math.random() * Math.PI * 2;
              ch.vx = Math.cos(a) * 26;
              ch.vy = Math.sin(a) * 26;
            }
            ch.x += ch.vx * dt;
            ch.y += ch.vy * dt;
            if (ch.x < pen.x + 16 || ch.x > pen.x + pen.w - 16) ch.vx = -ch.vx;
            if (ch.y < pen.y + 16 || ch.y > pen.y + pen.h - 16) ch.vy = -ch.vy;
            ch.x = Math.max(pen.x + 16, Math.min(pen.x + pen.w - 16, ch.x));
            ch.y = Math.max(pen.y + 16, Math.min(pen.y + pen.h - 16, ch.y));
            ch.angle = Math.atan2(ch.vy, ch.vx);
          }
          continue;
        }

        // Loose chicken
        looseCount++;

        // Check player pickup first (respecting post-knock cooldown)
        let pickedUp = false;
        if (now >= ch.pickupCooldownUntil) {
          for (const pe of playerEntitiesRef.current) {
            if (pe.carryingIds.length < MAX_CARRY && Math.hypot(pe.x - ch.x, pe.y - ch.y) < 28) {
              ch.state = 'carried';
              ch.carrierIdx = pe.playerIdx;
              pe.carryingIds.push(ch.id);
              pickedUp = true;
              uiDirty = true;
              soundManager.play('catch');
              triggerHaptic(25);
              break;
            }
          }
        }
        if (pickedUp) {
          looseCount--;
          continue;
        }

        // Flee when nearest player gets close
        let nearestDist = Infinity;
        let nearestPlayer: PlayerEntity | null = null;
        for (const pe of playerEntitiesRef.current) {
          const d = Math.hypot(pe.x - ch.x, pe.y - ch.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearestPlayer = pe;
          }
        }

        if (nearestPlayer && nearestDist < 118) {
          ch.panicking = true;
          const fleeAngle = Math.atan2(ch.y - nearestPlayer.y, ch.x - nearestPlayer.x);
          const fleeSpeed = 148;
          ch.vx = Math.cos(fleeAngle) * fleeSpeed;
          ch.vy = Math.sin(fleeAngle) * fleeSpeed;
        } else {
          ch.panicking = false;
          if (now >= ch.nextWanderAt) {
            ch.nextWanderAt = now + 800 + Math.random() * 1400;
            const a = Math.random() * Math.PI * 2;
            const spd = 45 + Math.random() * 35;
            ch.vx = Math.cos(a) * spd;
            ch.vy = Math.sin(a) * spd;
          }
        }

        ch.x += ch.vx * dt;
        ch.y += ch.vy * dt;

        // Bounce cleanly off outer bounds so chickens stay inside reachable yard
        if (ch.x < safeMarginX) {
          ch.x = safeMarginX;
          ch.vx = Math.abs(ch.vx);
        } else if (ch.x > w - safeMarginX) {
          ch.x = w - safeMarginX;
          ch.vx = -Math.abs(ch.vx);
        }
        if (ch.y < safeMarginY) {
          ch.y = safeMarginY;
          ch.vy = Math.abs(ch.vy);
        } else if (ch.y > h - safeMarginY) {
          ch.y = h - safeMarginY;
          ch.vy = -Math.abs(ch.vy);
        }
        ch.angle = Math.atan2(ch.vy, ch.vx);
      }

      popupsRef.current = popupsRef.current
        .map((p) => ({ ...p, y: p.y - 30 * dt, life: p.life - 1.5 * dt }))
        .filter((p) => p.life > 0);

      // End immediately if all chickens have been deposited in houses!
      const totalCaptured = playerEntitiesRef.current.reduce((s, p) => s + p.capturedCount, 0);
      if (totalCaptured >= CHICKEN_POOL) {
        setCapturedCounts(playerEntitiesRef.current.map((p) => p.capturedCount));
        setCarryingCounts(playerEntitiesRef.current.map((p) => p.carryingIds.length));
        setLooseLeft(0);
        drawScene(now);
        finishRound();
        return;
      }

      if (uiDirty || now - lastUiSync > 140) {
        lastUiSync = now;
        setCapturedCounts(playerEntitiesRef.current.map((p) => p.capturedCount));
        setCarryingCounts(playerEntitiesRef.current.map((p) => p.carryingIds.length));
        setLooseLeft(looseCount);
      }

      drawScene(now);
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [phase, matchSeconds, drawScene, finishRound]);

  // Strictly Fixed-Base Multi-Touch 360° Joystick Handlers
  const updateJoy = (playerIdx: number, rawDx: number, rawDy: number) => {
    const dist = Math.hypot(rawDx, rawDy);
    const active = dist > 0.5;
    const clampedDist = Math.min(JOYSTICK_MAX_R, dist);
    const nx = dist > 0.01 ? (rawDx / dist) * (clampedDist / JOYSTICK_MAX_R) : 0;
    const ny = dist > 0.01 ? (rawDy / dist) * (clampedDist / JOYSTICK_MAX_R) : 0;
    joyVectorsRef.current[playerIdx] = { dx: rawDx, dy: rawDy, active };

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
    const rawDx = e.clientX - cx;
    const rawDy = e.clientY - cy;
    lastJoyHapticRef.current[playerIdx] = {
      angle: Math.hypot(rawDx, rawDy) > 1 ? Math.atan2(rawDy, rawDx) : 0,
      time: performance.now(),
    };
    updateJoy(playerIdx, rawDx, rawDy);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const entry = joyPointersRef.current.get(e.pointerId);
    if (!entry) return;
    e.preventDefault();
    const rawDx = e.clientX - entry.cx;
    const rawDy = e.clientY - entry.cy;
    updateJoy(entry.playerIdx, rawDx, rawDy);
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
    joyVectorsRef.current[entry.playerIdx] = { dx: 0, dy: 0, active: false };
    setJoyVisuals((prev) =>
      prev.map((item, idx) =>
        idx === entry.playerIdx ? { kx: 0, ky: 0, active: false, x: null, y: null } : item
      )
    );
  };

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] flex flex-col select-none overflow-hidden">
      {phase === 'SETUP' && (
        <div className="flex-1 overflow-y-auto">
          <ArcadePreGameSetup
            title="اصطياد الدجاج"
            subtitle="امسك الدجاج الهربان في الساحة (حد أقصى 2 فوق راسك) ورجّعهم لحوشك قبل صحابك!"
            players={players}
            accentBgClass="bg-gradient-to-br from-[#65a30d] to-[#ca8a04]"
            icon={<Bird className="w-12 h-12 text-white" />}
            roundOptions={[3, 5, 7]}
            defaultRounds={3}
            durationLabel="مدة كل جولة:"
            durationOptions={[
              { value: 30, label: '30 ثانية' },
              { value: 45, label: '45 ثانية' },
              { value: 60, label: '60 ثانية' },
            ]}
            defaultDuration={45}
            onStartSeries={(rounds, secs) => {
              setTotalRounds(rounds);
              setMatchSeconds(secs);
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
          stageLabel={`جولة ${currentRound}/${totalRounds} · 🐔 ${looseLeft}`}
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
            className="w-full h-full block bg-[#7ec82a]"
          />

          {phase === 'COUNTDOWN' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/45 px-6 text-center z-20">
              <div className="text-lg font-black text-amber-300 mb-1 tabular-nums">
                جولة {currentRound} من {totalRounds}
              </div>
              <div className="text-8xl font-black text-white drop-shadow-[0_6px_0_#111827] tabular-nums">
                {countdownNum}
              </div>
              <div className="mt-3 text-sm sm:text-base font-black text-white/95">
                احمل حتى دجاجتين، ادخل حوشك أو اسرق من عش خصمك (درع 1.5 ثانية بعد كل سرقة)!
              </div>
            </div>
          )}

          {/* Strictly Fixed Base 360° Corner Joysticks */}
          {players.map((player, idx) => {
            const placement = placements[idx];
            const theme = ARCADE_COLORS[player.colorId];
            if (!placement) return null;
            const jv = joyVisuals[idx] ?? { kx: 0, ky: 0, active: false, x: null, y: null };
            const cap = capturedCounts[idx] ?? 0;
            const car = carryingCounts[idx] ?? 0;

            return (
              <div
                key={player.id}
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => handleJoyDown(e, idx)}
                onPointerMove={handleJoyMove}
                onPointerUp={handleJoyUp}
                onPointerCancel={handleJoyUp}
                onLostPointerCapture={handleJoyUp}
                className={`absolute ${SLOT_CORNER_POS[placement.slot]} z-20 w-[106px] h-[106px] rounded-full cursor-pointer select-none flex items-center justify-center`}
              >
                <div
                  style={{
                    borderColor: theme.hex,
                    backgroundColor: jv.active
                      ? 'rgba(15, 23, 42, 0.72)'
                      : 'rgba(15, 23, 42, 0.52)',
                  }}
                  className="pointer-events-none relative w-full h-full rounded-full border-[3.5px] shadow-[0_4px_0_rgba(0,0,0,0.35)] flex items-center justify-center"
                >
                  <span
                    className={`pointer-events-none absolute -top-5 px-2 py-0.5 rounded-full bg-black/70 text-[10px] font-black text-white truncate max-w-[100px] tabular-nums ${
                      placement.isTop ? 'rotate-180 -bottom-5 top-auto' : ''
                    }`}
                  >
                    {player.name} ({cap}){car > 0 ? ` +${car}🐔` : ''}
                  </span>

                  <div
                    style={{
                      backgroundColor: theme.hex,
                      transform: `translate3d(${jv.kx * JOYSTICK_MAX_R}px, ${jv.ky * JOYSTICK_MAX_R}px, 0) scale(${jv.active ? 1.08 : 1})`,
                    }}
                    className={`pointer-events-none w-10 h-10 rounded-full border-[3px] border-[#111827] shadow-[0_3px_0_#111827] ${
                      jv.active ? '' : 'transition-transform duration-150'
                    }`}
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
            badge: `${capturedCounts[idx] ?? 0} 🐔`,
          }))}
          durationMs={3000}
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
            <h1 className="text-2xl font-black text-[#1E293B] dark:text-[#F8FAFC]">نتيجة التحدي</h1>
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
        title="الخروج من اصطياد الدجاج؟"
        message="الجولة لسه شغالة، لو خرجت دلوقتي النتيجة مش هتتحسب."
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitToArcadeHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
