import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Trash2, Undo2 } from 'lucide-react';
import { soundManager } from '../../utils/soundManager';

export interface DrawStroke {
  color: string;
  size: number;
  points: Array<{ x: number; y: number }>;
}

interface DrawingCanvasProps {
  locked?: boolean;
  strokes: DrawStroke[];
  onStrokesChange?: (strokes: DrawStroke[]) => void;
}

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 600;

const COLOR_SWATCHES = [
  { id: 'black', hex: '#111827', label: 'أسود', isEraser: false },
  { id: 'red', hex: '#ef4444', label: 'أحمر', isEraser: false },
  { id: 'blue', hex: '#2563eb', label: 'أزرق', isEraser: false },
  { id: 'green', hex: '#16a34a', label: 'أخضر', isEraser: false },
  { id: 'yellow', hex: '#eab308', label: 'أصفر', isEraser: false },
  { id: 'orange', hex: '#f97316', label: 'برتقالي', isEraser: false },
  { id: 'purple', hex: '#9333ea', label: 'بنفسجي', isEraser: false },
  { id: 'eraser', hex: '#ffffff', label: 'ممحاة', isEraser: true },
] as const;

const BRUSH_SIZES = [
  { id: 'sm', size: 6, dotClass: 'w-2.5 h-2.5', label: 'رفيع' },
  { id: 'md', size: 14, dotClass: 'w-4 h-4', label: 'متوسط' },
  { id: 'lg', size: 26, dotClass: 'w-6 h-6', label: 'عريض' },
] as const;

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

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  locked = false,
  strokes,
  onStrokesChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<DrawStroke | null>(null);
  const strokesRef = useRef<DrawStroke[]>(strokes);
  strokesRef.current = strokes;

  const [selectedColor, setSelectedColor] = useState<string>('#111827');
  const [brushSize, setBrushSize] = useState<number>(14);

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

  // If locked suddenly flips to true mid-stroke, commit active stroke cleanly
  useEffect(() => {
    if (locked && activeStrokeRef.current) {
      const finished = activeStrokeRef.current;
      activeStrokeRef.current = null;
      if (finished.points.length > 0 && onStrokesChange) {
        onStrokesChange([...strokesRef.current, finished]);
      }
    }
  }, [locked, onStrokesChange]);

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
    if (locked) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const pt = getLogicalPoint(e.clientX, e.clientY);
    const effectiveSize = selectedColor === '#ffffff' ? Math.max(22, brushSize * 1.6) : brushSize;
    const newStroke: DrawStroke = {
      color: selectedColor,
      size: effectiveSize,
      points: [pt],
    };
    activeStrokeRef.current = newStroke;
    redrawAll(strokesRef.current, newStroke);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked || !activeStrokeRef.current) return;
    e.preventDefault();

    const pt = getLogicalPoint(e.clientX, e.clientY);
    const pts = activeStrokeRef.current.points;
    const last = pts[pts.length - 1];
    // Skip redundant sub-pixel samples
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) {
      return;
    }
    pts.push(pt);
    redrawAll(strokesRef.current, activeStrokeRef.current);
  };

  const finishActiveStroke = () => {
    if (!activeStrokeRef.current) return;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (finished.points.length > 0 && onStrokesChange) {
      onStrokesChange([...strokesRef.current, finished]);
    }
  };

  const handleUndo = () => {
    if (locked || strokes.length === 0 || !onStrokesChange) return;
    soundManager.play('click');
    onStrokesChange(strokes.slice(0, -1));
  };

  const handleClear = () => {
    if (locked || strokes.length === 0 || !onStrokesChange) return;
    soundManager.play('click');
    onStrokesChange([]);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Bright white drawing board */}
      <div
        className={`relative w-full aspect-[4/3] rounded-3xl bg-white overflow-hidden shadow-md border-4 transition-colors ${
          locked ? 'border-[#F59E0B]' : 'border-[#E7DEC8] dark:border-[#334155]'
        }`}
        style={{ touchAction: 'none', overscrollBehavior: 'none' }}
      >
        <canvas
          ref={canvasRef}
          width={LOGICAL_WIDTH}
          height={LOGICAL_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishActiveStroke}
          onPointerCancel={finishActiveStroke}
          onLostPointerCapture={finishActiveStroke}
          className={`w-full h-full block ${locked ? 'cursor-default' : 'cursor-crosshair'}`}
          style={{ touchAction: 'none' }}
        />

        {locked && (
          <div className="pointer-events-none absolute top-2.5 right-2.5 rounded-xl bg-[#FEF3C7] border border-[#F59E0B] px-2.5 py-1 text-[11px] font-black text-[#B45309]">
            اللوحة مقفولة
          </div>
        )}
      </div>

      {/* Compact bottom toolbar (hidden when locked) */}
      {!locked && (
        <div className="w-full rounded-2xl qada-card p-2.5 flex flex-col gap-2.5">
          {/* Row 1: Color Swatches */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            {COLOR_SWATCHES.map((swatch) => {
              const isActive = selectedColor === swatch.hex;
              return (
                <button
                  key={swatch.id}
                  type="button"
                  aria-label={swatch.label}
                  onClick={() => {
                    soundManager.play('click');
                    setSelectedColor(swatch.hex);
                  }}
                  className={`min-w-[36px] min-h-[36px] flex-1 max-w-[44px] rounded-xl flex items-center justify-center transition-transform ${
                    isActive
                      ? 'ring-2 ring-[#FF6B4A] ring-offset-2 ring-offset-white dark:ring-offset-[#1E293B] scale-105'
                      : 'opacity-90 hover:opacity-100'
                  } ${swatch.isEraser ? 'border-2 border-[#CBD5E1] text-[#1E293B]' : 'border border-black/15'}`}
                  style={{ backgroundColor: swatch.hex }}
                >
                  {swatch.isEraser && <Eraser className="w-4 h-4" />}
                </button>
              );
            })}
          </div>

          {/* Row 2: Brush sizes + Undo & Clear */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F1E8DA] dark:border-[#334155]">
            <div className="flex items-center gap-1.5">
              {BRUSH_SIZES.map((b) => {
                const isActive = brushSize === b.size;
                return (
                  <button
                    key={b.id}
                    type="button"
                    aria-label={`حجم الفرشاة ${b.label}`}
                    onClick={() => {
                      soundManager.play('click');
                      setBrushSize(b.size);
                    }}
                    className={`min-w-[44px] min-h-[40px] rounded-xl flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-[#14B8A6] text-white shadow-sm'
                        : 'bg-[#FFF9F0] dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white'
                    }`}
                  >
                    <span className={`${b.dotClass} rounded-full bg-current`} />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="تراجع عن آخر خطوة"
                disabled={strokes.length === 0}
                onClick={handleUndo}
                className="min-w-[48px] min-h-[40px] px-3 rounded-xl bg-[#FFF9F0] dark:bg-[#0F172A] hover:bg-[#FFF1DC] dark:hover:bg-[#334155] border border-[#E7DEC8] dark:border-[#334155] disabled:opacity-35 disabled:cursor-not-allowed text-[#1E293B] dark:text-white text-xs font-black flex items-center justify-center gap-1 transition-colors"
              >
                <Undo2 className="w-4 h-4" />
                <span>تراجع</span>
              </button>
              <button
                type="button"
                aria-label="مسح اللوحة"
                disabled={strokes.length === 0}
                onClick={handleClear}
                className="min-w-[44px] min-h-[40px] px-3 rounded-xl bg-[#FFF1F2] dark:bg-rose-950/60 hover:bg-[#FFE4E6] border border-[#FECDD3] dark:border-rose-800 disabled:opacity-35 disabled:cursor-not-allowed text-[#E11D48] dark:text-rose-300 text-xs font-black flex items-center justify-center gap-1 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>مسح</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
