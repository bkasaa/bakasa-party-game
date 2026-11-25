import React, { useEffect, useMemo, useState } from 'react';

interface SubtleConfettiBurstProps {
  active?: boolean;
}

const CONFETTI_COLORS = [
  '#FACC15',
  '#FF6B4A',
  '#14B8A6',
  '#38BDF8',
  '#10B981',
  '#FB7185',
  '#F59E0B',
];

export const SubtleConfettiBurst: React.FC<SubtleConfettiBurstProps> = ({ active = true }) => {
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 2050);
    return () => window.clearTimeout(timer);
  }, [active]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const isCircle = i % 5 === 0;
        const driftX = ((i % 7) - 3) * 16;
        const rotDeg = (i % 2 === 0 ? 1 : -1) * (240 + (i % 5) * 75);
        return {
          id: i,
          leftPct: 4 + ((i * 31) % 92),
          delayMs: (i % 6) * 45,
          durationMs: 1450 + (i % 4) * 110,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          width: isCircle ? 8 : 6 + (i % 3) * 2,
          height: isCircle ? 8 : 11 + (i % 3) * 3,
          isCircle,
          driftX,
          rotDeg,
        };
      }),
    []
  );

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none motion-reduce:hidden"
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          style={
            {
              left: `${p.leftPct}%`,
              top: '-18px',
              width: `${p.width}px`,
              height: `${p.height}px`,
              backgroundColor: p.color,
              '--confetti-dx': `${p.driftX}px`,
              '--confetti-rot': `${p.rotDeg}deg`,
              animation: `subtle-confetti-burst ${p.durationMs}ms cubic-bezier(0.22, 0.8, 0.32, 1) ${p.delayMs}ms forwards`,
            } as React.CSSProperties
          }
          className={`pointer-events-none absolute opacity-0 ${
            p.isCircle ? 'rounded-full' : 'rounded-[3px]'
          }`}
        />
      ))}
    </div>
  );
};
