import React, { useEffect, useState } from 'react';

interface SplashIntroProps {
  onComplete: () => void;
}

const SPARKS = [
  { x: '-110px', y: '-94px', color: '#FF6B4A', size: 'w-3 h-3', delay: '0.08s' },
  { x: '112px', y: '-86px', color: '#14B8A6', size: 'w-3.5 h-3.5', delay: '0.12s' },
  { x: '-128px', y: '22px', color: '#F59E0B', size: 'w-2.5 h-2.5', delay: '0.16s' },
  { x: '126px', y: '28px', color: '#EC4899', size: 'w-3 h-3', delay: '0.1s' },
  { x: '-84px', y: '108px', color: '#38BDF8', size: 'w-3 h-3', delay: '0.18s' },
  { x: '88px', y: '102px', color: '#10B981', size: 'w-2.5 h-2.5', delay: '0.14s' },
  { x: '0px', y: '-126px', color: '#FBBF24', size: 'w-3.5 h-3.5', delay: '0.06s' },
  { x: '0px', y: '122px', color: '#FF6B4A', size: 'w-2.5 h-2.5', delay: '0.2s' },
];

export const SplashIntro: React.FC<SplashIntroProps> = ({ onComplete }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFading(true), 1200);
    const doneTimer = window.setTimeout(() => onComplete(), 1550);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <div
      onClick={() => {
        setFading(true);
        window.setTimeout(onComplete, 180);
      }}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 bakasa-bg transition-all duration-350 ${
        fading ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      aria-label="شاشة الترحيب"
    >
      <div className="relative flex flex-col items-center justify-center">
        {/* Ambient Radial Aura */}
        <div
          className="absolute w-72 h-72 rounded-full blur-3xl opacity-35 dark:opacity-45 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #FF6B4A 0%, #F59E0B 45%, #14B8A6 100%)',
          }}
        />

        {/* Bursting Confetti Sparkles + Custom App Logo */}
        <div className="relative flex items-center justify-center mb-4">
          {SPARKS.map((sp, i) => (
            <span
              key={i}
              className={`absolute rounded-full ${sp.size} opacity-0 pointer-events-none`}
              style={{
                backgroundColor: sp.color,
                boxShadow: `0 0 10px ${sp.color}`,
                transform: `translate(${sp.x}, ${sp.y})`,
                animation: `splash-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) ${sp.delay} forwards`,
              }}
            />
          ))}

          <img
            src="/app-icon.png"
            alt="قعدة الشلة"
            className="animate-splash-pop relative w-44 h-44 sm:w-52 sm:h-52 object-contain drop-shadow-[0_18px_28px_rgba(217,78,48,0.3)] select-none pointer-events-none"
          />
        </div>

        <p
          className="animate-splash-pop text-sm sm:text-base font-extrabold text-[#64748B] dark:text-[#94A3B8] text-center"
          style={{ animationDelay: '0.14s' }}
        >
          ألعاب القعدة والتحدي على موبايل واحد
        </p>
      </div>
    </div>
  );
};
