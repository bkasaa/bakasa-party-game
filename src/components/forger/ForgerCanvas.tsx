import React, { useCallback, useEffect, useRef } from 'react';
import { DrawStroke } from '../draw/DrawingCanvas';

interface ForgerCanvasProps {
  strokes: DrawStroke[];
  activeColor: string;
  canDraw: boolean;
  onCompleteStroke?: (stroke: DrawStroke) => void;
  maxWidthClass?: string;
}

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 880;
const FORGER_BRUSH_SIZE = 12;

function drawSingleStroke(ctx: CanvasRenderingContext2D, stroke: DrawStroke) {
  if (stroke.points.length === 0) return;

  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.points.length === 1) {
    const p = stroke.points[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

  for (let i = 1; i < stroke.points.length - 1; i++) {
    const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
    const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
    ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
  }

  const last = stroke.points[stroke.points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

export const ForgerCanvas: React.FC<ForgerCanvasProps> = ({
  strokes,
  activeColor,
  canDraw,
  onCompleteStroke,
  maxWidthClass = 'w-full',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<DrawStroke | null>(null);
  const strokesRef = useRef<DrawStroke[]>(strokes);
  strokesRef.current = strokes;

  const redrawAll = useCallback((list: DrawStroke[], liveStroke?: DrawStroke | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    for (const s of list) {
      drawSingleStroke(ctx, s);
    }
    if (liveStroke) {
      drawSingleStroke(ctx, liveStroke);
    }
  }, []);

  useEffect(() => {
    redrawAll(strokes, activeStrokeRef.current);
  }, [strokes, redrawAll]);

  const getLogicalPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_WIDTH / Math.max(1, rect.width);
    const scaleY = LOGICAL_HEIGHT / Math.max(1, rect.height);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || activeStrokeRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const pt = getLogicalPoint(e.clientX, e.clientY);
    const newStroke: DrawStroke = {
      color: activeColor,
      size: FORGER_BRUSH_SIZE,
      points: [pt],
    };
    activeStrokeRef.current = newStroke;
    redrawAll(strokesRef.current, newStroke);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || !activeStrokeRef.current) return;
    e.preventDefault();

    const pt = getLogicalPoint(e.clientX, e.clientY);
    const pts = activeStrokeRef.current.points;
    const last = pts[pts.length - 1];
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) {
      return;
    }
    pts.push(pt);
    redrawAll(strokesRef.current, activeStrokeRef.current);
  };

  const finishStroke = () => {
    if (!activeStrokeRef.current) return;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (finished.points.length > 0 && onCompleteStroke) {
      onCompleteStroke(finished);
    }
  };

  return (
    <div
      className={`relative ${maxWidthClass} max-w-[460px] mx-auto aspect-[10/11] max-h-[56dvh] rounded-3xl bg-white overflow-hidden shadow-md border-4 transition-colors ${
        canDraw ? 'border-[#E7DEC8] dark:border-[#334155]' : 'border-[#F59E0B]'
      }`}
      style={{ touchAction: 'none', overscrollBehavior: 'none' }}
    >
      <canvas
        ref={canvasRef}
        width={LOGICAL_WIDTH}
        height={LOGICAL_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onLostPointerCapture={finishStroke}
        className={`w-full h-full block ${canDraw ? 'cursor-crosshair' : 'cursor-default'}`}
        style={{ touchAction: 'none' }}
      />

      {!canDraw && (
        <div className="pointer-events-none absolute top-2.5 right-2.5 rounded-xl bg-[#FEF3C7] border border-[#F59E0B] px-2.5 py-1 text-[11px] font-black text-[#B45309]">
          اللوحة مقفولة
        </div>
      )}
    </div>
  );
};
