import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bird, Sparkles } from 'lucide-react';
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

interface HappyBirdsGameProps {
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

interface BirdEntity {
  playerIdx: number;
  name: string;
  hex: string;
  darkHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  frozenUntil: number;
  invulnUntil: number;
  aliveAccum: number;
  flapPulse: number;
}

interface WallSpike {
  side: 'left' | 'right';
  y: number;
  size: number;
}

interface StarPickup {
  id: number;
  x: number;
  y: number;
  bobSeed: number;
}

interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface CloudBg {
  x: number;
  y: number;
  scale: number;
  speed: number;
}

const DEFAULT_MATCH_SECONDS = 30;
const GRAVITY = 860;
const FLAP_VY = -335;
const RESPAWN_FREEZE_MS = 3000;
const RESPAWN_INVULN_MS = 3000;

const SLOT_CORNER_POS: Record<CornerSlot, string> = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-3 right-3',
  'bottom-left': 'bottom-3 left-3',
  'bottom-right': 'bottom-3 right-3',
};

const SLOT_ROTATE_STYLE: Record<CornerSlot, string> = {
  'top-left': 'rotate-[135deg]',
  'top-right': '-rotate-[135deg]',
  'bottom-left': 'rotate-45',
  'bottom-right': '-rotate-45',
};

function generateWallSpikes(side: 'left' | 'right', h: number, count: number): WallSpike[] {
  const usableTop = h * 0.16;
  const usableBottom = h * 0.84;
  const slots = 7;
  const slotStep = (usableBottom - usableTop) / slots;
  const indices = Array.from({ length: slots }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, Math.min(count, slots)).map((slotIdx) => ({
    side,
    y: usableTop + (slotIdx + 0.5) * slotStep,
    size: 22,
  }));
}

function spawnStar(id: number, w: number, h: number): StarPickup {
  return {
    id,
    x: w * 0.24 + Math.random() * (w * 0.52),
    y: h * 0.22 + Math.random() * (h * 0.56),
    bobSeed: Math.random() * Math.PI * 2,
  };
}

function drawBlockyBird(
  ctx: CanvasRenderingContext2D,
  bird: BirdEntity,
  now: number
) {
  const isFrozen = bird.frozenUntil > now;
  const isInvuln = !isFrozen && bird.invulnUntil > now;
  const invulnProgress = isInvuln
    ? Math.max(0, Math.min(1, (bird.invulnUntil - now) / RESPAWN_INVULN_MS))
    : 0;

  const facingRight = bird.vx >= 0;
  const dir = facingRight ? 1 : -1;
  const tilt = Math.max(-0.35, Math.min(0.35, bird.vy / 720)) * dir;

  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(tilt);

  // White speed lines trailing behind the bird (when alive)
  if (!isFrozen) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    const tailX = -dir * 23;
    const offsets = [-8, 0, 8];
    const lengths = [12, 16, 10];
    offsets.forEach((oy, idx) => {
      ctx.beginPath();
      ctx.moveTo(tailX, oy);
      ctx.lineTo(tailX - dir * lengths[idx], oy);
      ctx.stroke();
    });
  }

  // Colored comb/crest on top + bottom belly puff (matching Happy Birds blocky sprite)
  ctx.fillStyle = isFrozen ? '#7dd3fc' : bird.hex;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';

  // Top crest
  ctx.beginPath();
  ctx.arc(dir * -5, -17, 5.5, 0, Math.PI * 2);
  ctx.arc(dir * 2, -18, 6, 0, Math.PI * 2);
  ctx.arc(dir * 9, -16, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Bottom belly frill
  ctx.beginPath();
  ctx.arc(dir * -6, 16, 5.5, 0, Math.PI * 2);
  ctx.arc(dir * 2, 17, 6, 0, Math.PI * 2);
  ctx.arc(dir * 9, 15, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Orange triangular beak
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(dir * 16, -5);
  ctx.lineTo(dir * 26, 1);
  ctx.lineTo(dir * 16, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Blocky rounded-square white body
  ctx.fillStyle = isFrozen ? '#e0f2fe' : '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-17, -16, 34, 32, 9);
  ctx.fill();
  ctx.stroke();

  // Crisp eye dot
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(dir * 8, 5, 3, 0, Math.PI * 2);
  ctx.fill();

  // Tiny wing flap indicator
  const wingY = bird.flapPulse > 0 ? 4 : -1;
  ctx.fillStyle = isFrozen ? '#bae6fd' : bird.hex;
  ctx.beginPath();
  ctx.roundRect(-10, wingY - 4, 12, 8, 4);
  ctx.fill();
  ctx.stroke();

  // Frozen stun overlay + countdown seconds
  if (isFrozen) {
    ctx.fillStyle = 'rgba(125, 211, 252, 0.5)';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-21, -21, 42, 42, 10);
    ctx.fill();
    ctx.stroke();

    const rem = Math.ceil((bird.frozenUntil - now) / 1000);
    ctx.rotate(-tilt);
    ctx.font = '900 16px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.strokeText(`${rem}`, 0, -26);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${rem}`, 0, -26);
  }

  // Respawn 3s protective bubble shield + circular countdown ring
  if (isInvuln) {
    ctx.rotate(-tilt);
    const pulse = 1 + Math.sin(now * 0.015) * 0.04;
    const shieldR = 29 * pulse;

    // Soft glowing shield dome
    const domeGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, shieldR);
    domeGrad.addColorStop(0, 'rgba(125, 211, 252, 0.08)');
    domeGrad.addColorStop(0.75, 'rgba(56, 189, 248, 0.24)');
    domeGrad.addColorStop(1, 'rgba(250, 204, 21, 0.42)');
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(0, 0, shieldR, 0, Math.PI * 2);
    ctx.fill();

    // Subtle track circle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, shieldR, 0, Math.PI * 2);
    ctx.stroke();

    // Bright circular countdown progress arc
    ctx.strokeStyle = invulnProgress > 0.33 ? '#7dd3fc' : '#facc15';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      shieldR,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * invulnProgress
    );
    ctx.stroke();

    const secRem = Math.max(1, Math.ceil((bird.invulnUntil - now) / 1000));
    ctx.font = '900 12px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5;
    ctx.strokeText(`🛡️ ${secRem}`, 0, -shieldR - 5);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillText(`🛡️ ${secRem}`, 0, -shieldR - 5);
  }

  ctx.restore();
}

export const HappyBirdsGame: React.FC<HappyBirdsGameProps> = ({
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
  const [scores, setScores] = useState<number[]>(() => players.map(() => 0));
  const [frozenStates, setFrozenStates] = useState<boolean[]>(() => players.map(() => false));
  const [roundDeltas, setRoundDeltas] = useState<ArcadeDelta[]>([]);
  const [finalSeriesDeltas, setFinalSeriesDeltas] = useState<ArcadeDelta[]>([]);
  const [seriesWinners, setSeriesWinners] = useState<ArcadePlayer[]>([]);
  const [summaryText, setSummaryText] = useState<string>('');
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => soundManager.isMuted());
  const [shaking, setShaking] = useState<boolean>(false);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const arenaSizeRef = useRef<{ w: number; h: number }>({ w: 390, h: 760 });
  const birdsRef = useRef<BirdEntity[]>([]);
  const spikesRef = useRef<WallSpike[]>([]);
  const starsRef = useRef<StarPickup[]>([]);
  const cloudsRef = useRef<CloudBg[]>([]);
  const popupsRef = useRef<FloatingPopup[]>([]);
  const scoresRef = useRef<number[]>(players.map(() => 0));
  const nextStarIdRef = useRef<number>(1);
  const nextSpikeShiftRef = useRef<number>(0);
  const roundStartRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(DEFAULT_MATCH_SECONDS);
  const finishedRef = useRef<boolean>(false);

  const placements = getCornerPlacements(players.length);
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
    const speedX = 148 + (currentRound - 1) * 14;

    birdsRef.current = players.map((p, idx) => {
      const theme = ARCADE_COLORS[p.colorId];
      const rowOffset = (idx - (players.length - 1) / 2) * 58;
      return {
        playerIdx: idx,
        name: p.name,
        hex: theme.hex,
        darkHex: theme.darkHex,
        x: w * 0.5 + (idx % 2 === 0 ? -36 : 36),
        y: Math.max(h * 0.25, Math.min(h * 0.75, h * 0.5 + rowOffset)),
        vx: (idx % 2 === 0 ? 1 : -1) * speedX,
        vy: -140,
        frozenUntil: 0,
        invulnUntil: 0,
        aliveAccum: 0,
        flapPulse: 0,
      };
    });

    const spikeCount = Math.min(4, 2 + Math.floor(currentRound / 2));
    spikesRef.current = [
      ...generateWallSpikes('left', h, spikeCount),
      ...generateWallSpikes('right', h, spikeCount),
    ];

    starsRef.current = [
      spawnStar(nextStarIdRef.current++, w, h),
      spawnStar(nextStarIdRef.current++, w, h),
      spawnStar(nextStarIdRef.current++, w, h),
    ];

    cloudsRef.current = [
      { x: w * 0.2, y: h * 0.22, scale: 1.0, speed: 12 },
      { x: w * 0.72, y: h * 0.45, scale: 0.82, speed: 8 },
      { x: w * 0.35, y: h * 0.72, scale: 1.15, speed: 10 },
    ];

    popupsRef.current = [];
    scoresRef.current = players.map(() => 0);
    finishedRef.current = false;
    setScores(players.map(() => 0));
    setFrozenStates(players.map(() => false));
  }, [currentRound, players, syncArenaSize]);

  const finishRound = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const pts = scoresRef.current;
    const best = Math.max(...pts, 0);
    const winners = players.filter((_, idx) => pts[idx] === best && best > 0);
    const winnerIds = new Set(winners.map((w) => w.id));
    winnerIds.forEach((id) => recordArcadeWin(id));

    const roundHeadline =
      winners.length > 1
        ? `تعادل (${best} ن): ${winners.map((w) => w.name).join(' و ')}`
        : winners.length === 1
          ? `بطل الجولة: ${winners[0].name} (${best} نقطة)`
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
          ? `أبطال التحدي (${totalRounds} جولات): ${champs.map((c) => c.name).join(' و ')}`
          : champs.length === 1
            ? `بطل التحدي (${totalRounds} جولات): ${champs[0].name}!`
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Sky-blue backdrop matching Happy Birds reference
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#c4ebff');
    sky.addColorStop(1, '#9cd9fa');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Soft clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (const c of cloudsRef.current) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.arc(-20, 6, 16, 0, Math.PI * 2);
      ctx.arc(22, 6, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Dark purple wall spikes on left & right walls
    for (const sp of spikesRef.current) {
      ctx.save();
      ctx.fillStyle = '#4c2a59';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (sp.side === 'left') {
        ctx.moveTo(0, sp.y - sp.size);
        ctx.lineTo(sp.size * 1.15, sp.y);
        ctx.lineTo(0, sp.y + sp.size);
      } else {
        ctx.moveTo(w, sp.y - sp.size);
        ctx.lineTo(w - sp.size * 1.15, sp.y);
        ctx.lineTo(w, sp.y + sp.size);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Glowing golden stars (+10)
    for (const st of starsRef.current) {
      const pulse = 1 + Math.sin(now * 0.007 + st.bobSeed) * 0.12;
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.scale(pulse, pulse);

      ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 14 : 6.5;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Birds
    for (const bird of birdsRef.current) {
      drawBlockyBird(ctx, bird, now);
    }

    // Score popups
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
      nextSpikeShiftRef.current = now + 4500;
      setPhase('PLAYING');
    }, 1800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [phase, matchSeconds, resetMatchState, drawScene]);

  // Auto-advance after 3s floating inter-round scoreboard banner
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

      // Drift clouds
      for (const c of cloudsRef.current) {
        c.x += c.speed * dt;
        if (c.x > w + 50) c.x = -50;
      }

      // Periodically shift spike placements so edges keep evolving
      if (now >= nextSpikeShiftRef.current) {
        nextSpikeShiftRef.current = now + 4600;
        const spikeCount = Math.min(4, 2 + Math.floor(currentRound / 2));
        spikesRef.current = [
          ...generateWallSpikes('left', h, spikeCount),
          ...generateWallSpikes('right', h, spikeCount),
        ];
      }

      let scoresDirty = false;
      const wallMargin = 19;

      for (const bird of birdsRef.current) {
        bird.flapPulse = Math.max(0, bird.flapPulse - dt * 5);

        // Respawn in center cleanly after 3s spike freeze with 3s protective bubble shield
        if (bird.frozenUntil > 0 && now >= bird.frozenUntil) {
          bird.frozenUntil = 0;
          bird.invulnUntil = now + RESPAWN_INVULN_MS;
          bird.x = w * 0.5;
          bird.y = h * 0.48;
          bird.vy = -120;
          bird.vx = (Math.random() < 0.5 ? 1 : -1) * Math.abs(bird.vx);
          popupsRef.current.push({
            x: bird.x,
            y: bird.y - 34,
            text: '🛡️ درع ٣ث!',
            color: '#7dd3fc',
            life: 1.1,
          });
          soundManager.play('next');
        }

        if (bird.frozenUntil > now) continue;

        // +2 survival points per second while alive
        bird.aliveAccum += 2 * dt;
        if (bird.aliveAccum >= 1) {
          const gained = Math.floor(bird.aliveAccum);
          bird.aliveAccum -= gained;
          scoresRef.current[bird.playerIdx] += gained;
          scoresDirty = true;
        }

        bird.vy += GRAVITY * dt;
        bird.x += bird.vx * dt;
        bird.y += bird.vy * dt;

        // Top & bottom soft arena bumpers
        const minY = 58;
        const maxY = h - 58;
        if (bird.y < minY) {
          bird.y = minY;
          bird.vy = Math.max(90, -bird.vy * 0.35);
        } else if (bird.y > maxY) {
          bird.y = maxY;
          bird.vy = -270;
        }

        // Left / right wall bounce & spike check
        const hitLeft = bird.x <= wallMargin && bird.vx < 0;
        const hitRight = bird.x >= w - wallMargin && bird.vx > 0;
        if (hitLeft || hitRight) {
          const wallSide = hitLeft ? 'left' : 'right';
          bird.x = hitLeft ? wallMargin : w - wallMargin;

          const spiked =
            bird.invulnUntil <= now &&
            spikesRef.current.some(
              (sp) => sp.side === wallSide && Math.abs(bird.y - sp.y) < sp.size + 13
            );

          if (spiked) {
            bird.frozenUntil = now + RESPAWN_FREEZE_MS;
            bird.vy = 0;
            soundManager.play('sting');
            triggerHaptic(150);
            setShaking(true);
            window.setTimeout(() => setShaking(false), 260);
            popupsRef.current.push({
              x: bird.x + (hitLeft ? 26 : -26),
              y: bird.y - 12,
              text: '💥 ٣ث!',
              color: '#f87171',
              life: 1.2,
            });
          } else {
            bird.vx = -bird.vx;
            soundManager.play('bounce');
          }
        }

        // Star pickups (+10 pts)
        for (let sIdx = starsRef.current.length - 1; sIdx >= 0; sIdx--) {
          const st = starsRef.current[sIdx];
          if (Math.hypot(bird.x - st.x, bird.y - st.y) <= 30) {
            starsRef.current.splice(sIdx, 1);
            scoresRef.current[bird.playerIdx] += 10;
            scoresDirty = true;
            soundManager.play('gold');
            triggerHaptic(25);
            popupsRef.current.push({
              x: st.x,
              y: st.y - 10,
              text: '+١٠',
              color: '#fde047',
              life: 1.1,
            });
            starsRef.current.push(spawnStar(nextStarIdRef.current++, w, h));
          }
        }
      }

      popupsRef.current = popupsRef.current
        .map((p) => ({ ...p, y: p.y - 34 * dt, life: p.life - 1.4 * dt }))
        .filter((p) => p.life > 0);

      if (scoresDirty || now - lastUiSync > 140) {
        lastUiSync = now;
        setScores([...scoresRef.current]);
        setFrozenStates(birdsRef.current.map((b) => b.frozenUntil > now));
      }

      drawScene(now);
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [phase, matchSeconds, currentRound, drawScene, finishRound]);

  const handleCornerFlap = (playerIdx: number) => {
    if (phase !== 'PLAYING' || finishedRef.current) return;
    const bird = birdsRef.current[playerIdx];
    if (!bird) return;
    if (bird.frozenUntil > performance.now()) return;
    bird.vy = FLAP_VY;
    bird.flapPulse = 1;
    soundManager.play('tick');
  };

  return (
    <div
      className={`fixed inset-0 w-screen h-[100dvh] flex flex-col select-none overflow-hidden ${
        shaking ? 'animate-screen-shake' : ''
      }`}
    >
      {phase === 'SETUP' && (
        <div className="flex-1 overflow-y-auto">
          <ArcadePreGameSetup
            title="الطيور الطائرة"
            subtitle="اضغط زاويتك عشان تطيّر العصفور، اجمع النجوم (+١٠) وابعد عن أشواك الحيطان!"
            players={players}
            accentBgClass="bg-gradient-to-br from-[#0284c7] to-[#38bdf8]"
            icon={<Bird className="w-12 h-12 text-white" />}
            roundOptions={[3, 5, 7]}
            defaultRounds={3}
            durationLabel="مدة كل جولة:"
            durationOptions={[
              { value: 30, label: '٣٠ ثانية' },
              { value: 45, label: '٤٥ ثانية' },
              { value: 60, label: '٦٠ ثانية' },
            ]}
            defaultDuration={30}
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
          stageLabel={`جولة ${currentRound}/${totalRounds}`}
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
            className="w-full h-full block bg-[#b6e4ff]"
          />

          {phase === 'COUNTDOWN' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/45 px-6 text-center z-20">
              <div className="text-lg font-black text-amber-300 mb-1 tabular-nums">
                جولة {currentRound} من {totalRounds}
              </div>
              <div className="text-8xl font-black text-white drop-shadow-[0_6px_0_#111827] tabular-nums">
                {countdownNum}
              </div>
              <div className="mt-3 text-sm sm:text-base font-black text-white/95 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span>نجمة (+١٠) · بقاء (+٢/ث) · درع حماية ٣ث بعد العودة!</span>
              </div>
            </div>
          )}

          {/* Sleek Circular Corner Flap Pads */}
          {players.map((player, idx) => {
            const placement = placements[idx];
            const theme = ARCADE_COLORS[player.colorId];
            if (!placement) return null;
            const pts = scores[idx] ?? 0;
            const isFrozen = frozenStates[idx] ?? false;

            return (
              <button
                key={player.id}
                type="button"
                style={{
                  touchAction: 'none',
                  backgroundColor: isFrozen ? 'rgba(56, 189, 248, 0.72)' : theme.hex,
                  color: isFrozen ? '#0f172a' : theme.textOnColor,
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  soundManager.unlock();
                  handleCornerFlap(idx);
                }}
                className={`absolute ${SLOT_CORNER_POS[placement.slot]} z-20 w-[96px] h-[96px] rounded-full border-4 border-[#111827] shadow-[0_5px_0_#111827] active:scale-95 flex flex-col items-center justify-center p-1 cursor-pointer select-none transition-transform`}
              >
                <div
                  className={`flex flex-col items-center justify-center text-center ${SLOT_ROTATE_STYLE[placement.slot]}`}
                >
                  <span className="text-[11px] font-black truncate max-w-[74px]">
                    {player.name}
                  </span>
                  <span className="text-base font-black tabular-nums leading-tight">
                    {pts}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold opacity-90 ${
                      isFrozen ? 'animate-hardluck-shake text-[#991B1B]' : ''
                    }`}
                  >
                    {isFrozen ? 'هاردلك! 😅' : 'ترفرف!'}
                  </span>
                </div>
              </button>
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
            badge: `${scores[idx] ?? 0} ن`,
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
        title="الخروج من الطيور الطائرة؟"
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
