import React, { useState } from 'react';
import { ArrowRight, Clock, Layers, Play } from 'lucide-react';
import { useGoHome } from '../../contexts/NavigationContext';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { ARCADE_COLORS, ArcadePlayer } from '../../types/arcade';
import { soundManager } from '../../utils/soundManager';
import { HomeLogoBadge } from '../HomeLogoBadge';

interface DurationOption {
  value: number;
  label: string;
}

interface ArcadePreGameSetupProps {
  title: string;
  subtitle: string;
  players: ArcadePlayer[];
  accentBgClass?: string;
  icon: React.ReactNode;
  roundOptions?: number[];
  defaultRounds?: number;
  durationLabel?: string;
  durationOptions?: DurationOption[];
  defaultDuration?: number;
  customConfigSlot?: React.ReactNode;
  onStartSeries: (totalRounds: number, roundDurationOrLaps: number) => void;
  onBack: () => void;
}

export const ArcadePreGameSetup: React.FC<ArcadePreGameSetupProps> = ({
  title,
  subtitle,
  players,
  accentBgClass = 'bg-gradient-to-br from-[#FF6B4A] to-[#F59E0B]',
  icon,
  roundOptions = [3, 5, 7],
  defaultRounds = 3,
  durationLabel,
  durationOptions,
  defaultDuration,
  customConfigSlot,
  onStartSeries,
  onBack,
}) => {
  const guard = useTapGuard(400);
  const goHome = useGoHome();
  const [selectedRounds, setSelectedRounds] = useState<number>(defaultRounds);
  const [selectedDuration, setSelectedDuration] = useState<number>(
    defaultDuration ?? durationOptions?.[0]?.value ?? 30
  );

  return (
    <div className="min-h-[100dvh] w-full flex flex-col">
      <header className="w-full max-w-xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={guard(() => {
              soundManager.play('click');
              onBack();
            })}
            aria-label="رجوع"
            className="min-w-[44px] min-h-[44px] rounded-2xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 border-b-[#D5C7B2] dark:border-b-[#090F1E] flex items-center justify-center text-[#1E293B] dark:text-[#F8FAFC]"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          {goHome && <HomeLogoBadge onClick={goHome} />}
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-[#F8FAFC] truncate">
          {title}
        </h1>
        <div className="w-11 shrink-0" />
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-4 py-6 flex flex-col items-center justify-center text-center">
        <div
          className={`w-28 h-28 mb-5 rounded-3xl ${accentBgClass} border-2 border-white dark:border-white/80 flex items-center justify-center shadow-xl animate-float-slow`}
        >
          {icon}
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-[#1E293B] dark:text-[#F8FAFC] mb-2">
          {title}
        </h2>
        <p className="text-sm sm:text-base font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed mb-6">
          {subtitle}
        </p>

        {/* Active players strip */}
        <div className="w-full flex items-center justify-center gap-2 flex-wrap mb-5">
          {players.map((p) => {
            const theme = ARCADE_COLORS[p.colorId];
            return (
              <div
                key={p.id}
                className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-[#1E293B] border-2 border-[#E7DEC8] dark:border-[#334155] px-3 py-1.5 text-xs font-extrabold text-[#1E293B] dark:text-[#F8FAFC] shadow-sm"
              >
                <span
                  style={{ backgroundColor: theme.hex }}
                  className="w-3 h-3 rounded-full border border-white shadow-sm shrink-0"
                />
                <span>{p.name}</span>
              </div>
            );
          })}
        </div>

        {/* Series Rounds & Duration Setup Card */}
        <div className="w-full rounded-3xl qada-card p-4 mb-7 flex flex-col gap-4 text-right">
          <div>
            <div className="text-xs sm:text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2 mb-2.5">
              <Layers className="w-4 h-4 text-[#FF6B4A]" />
              <span>عدد الجولات المتتالية:</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {roundOptions.map((rounds) => {
                const active = selectedRounds === rounds;
                return (
                  <button
                    key={rounds}
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setSelectedRounds(rounds);
                    }}
                    className={`min-h-[46px] rounded-xl text-sm font-black tabular-nums transition-all ${
                      active
                        ? 'bakasa-btn-green text-white'
                        : 'bg-[#FFF9F0] dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#FFF3E0] dark:hover:bg-[#334155] hover:text-[#1E293B] dark:hover:text-[#F8FAFC] border-2 border-[#E7DEC8] dark:border-[#334155]'
                    }`}
                  >
                    {rounds} جولات
                  </button>
                );
              })}
            </div>
          </div>

          {durationOptions && durationOptions.length > 0 && (
            <div className="pt-3 border-t border-[#F1E8DA] dark:border-[#334155]">
              <div className="text-xs sm:text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2 mb-2.5">
                <Clock className="w-4 h-4 text-[#14B8A6]" />
                <span>{durationLabel ?? 'مدة كل جولة:'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {durationOptions.map((opt) => {
                  const active = selectedDuration === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setSelectedDuration(opt.value);
                      }}
                      className={`min-h-[46px] rounded-xl text-sm font-black tabular-nums transition-all ${
                        active
                          ? 'qada-btn-teal text-white'
                          : 'bg-[#FFF9F0] dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#FFF3E0] dark:hover:bg-[#334155] hover:text-[#1E293B] dark:hover:text-[#F8FAFC] border-2 border-[#E7DEC8] dark:border-[#334155]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {customConfigSlot}

          <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] text-center pt-1">
            الجولات بتبدأ ورا بعض تلقائياً من غير ما ترجع للقائمة!
          </p>
        </div>

        <button
          type="button"
          onClick={guard(() => {
            soundManager.unlock();
            soundManager.play('next');
            onStartSeries(selectedRounds, selectedDuration);
          })}
          className="w-full max-w-[280px] min-h-[58px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2.5 transition-transform active:scale-95"
        >
          <Play className="w-6 h-6 fill-current" />
          <span>ابدأ التحدي!</span>
        </button>
      </main>
    </div>
  );
};
