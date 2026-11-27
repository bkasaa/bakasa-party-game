import React from 'react';
import { Clock, Globe2, Layers } from 'lucide-react';
import { FootballGlobalSettings, FootballPoolScope } from '../../data/footballData';
import { formatNumber } from '../../utils/formatNumber';
import { soundManager } from '../../utils/soundManager';

interface FootballSettingsBarProps {
  settings: FootballGlobalSettings;
  onChange: (next: FootballGlobalSettings) => void;
  showRounds?: boolean;
  roundsLabel?: string;
  roundOptions?: number[];
  roundUnit?: string;
  showSeconds?: boolean;
  secondsLabel?: string;
  secondsOptions?: number[];
  title?: string;
}

const SCOPE_OPTIONS: { id: FootballPoolScope; label: string }[] = [
  { id: 'local', label: 'محلي (مصري/عربي)' },
  { id: 'foreign', label: 'أجنبي (عالمي)' },
  { id: 'both', label: 'الاتنين مع بعض' },
];

export const FootballSettingsBar: React.FC<FootballSettingsBarProps> = ({
  settings,
  onChange,
  showRounds = true,
  roundsLabel = 'عدد الجولات / اللفات:',
  roundOptions = [1, 2, 3, 5],
  roundUnit = 'جولات',
  showSeconds = true,
  secondsLabel = 'الوقت لكل دور:',
  secondsOptions = [10, 15, 20, 30, 45],
  title,
}) => {
  return (
    <div className="w-full rounded-3xl qada-card p-4 flex flex-col gap-3.5 text-right">
      {title && (
        <div className="text-xs sm:text-sm font-black text-[#15803D] dark:text-[#34D399]">
          {title}
        </div>
      )}

      {/* Pool Scope: Local / Foreign / Both */}
      <div>
        <div className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5 mb-2">
          <Globe2 className="w-4 h-4 text-[#16A34A]" />
          <span>نطاق اللاعيبة والأندية:</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SCOPE_OPTIONS.map((opt) => {
            const active = settings.scope === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  soundManager.play('click');
                  onChange({ ...settings, scope: opt.id });
                }}
                className={`min-h-[42px] px-2 py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition-all ${
                  active
                    ? 'qada-btn-pitch text-white'
                    : 'bg-[#FFF9F0]/80 dark:bg-[#0F172A]/80 border border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1] hover:text-[#1E293B] dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Customizable Rounds / Laps */}
      {showRounds && (
        <div className="pt-2.5 border-t border-[#E7DEC8]/60 dark:border-[#334155]/70 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#FF6B4A]" />
            <span>{roundsLabel}</span>
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {roundOptions.map((val) => {
              const active = settings.rounds === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    soundManager.play('click');
                    onChange({ ...settings, rounds: val });
                  }}
                  className={`min-w-[46px] min-h-[36px] px-2.5 rounded-xl text-xs font-black tabular-nums transition-all ${
                    active
                      ? 'bg-[#FF6B4A] text-white shadow-[0_3px_0_#D94E30]'
                      : 'bg-[#FFF9F0]/80 dark:bg-[#0F172A]/80 border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                >
                  {formatNumber(val)} {val === 1 ? '' : roundUnit}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Customizable Turn Seconds */}
      {showSeconds && (
        <div className="pt-2.5 border-t border-[#E7DEC8]/60 dark:border-[#334155]/70 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#14B8A6]" />
            <span>{secondsLabel}</span>
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {secondsOptions.map((sec) => {
              const active = settings.turnSeconds === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    soundManager.play('click');
                    onChange({ ...settings, turnSeconds: sec });
                  }}
                  className={`min-w-[44px] min-h-[36px] px-2.5 rounded-xl text-xs font-black tabular-nums transition-all ${
                    active
                      ? 'bg-[#14B8A6] text-white shadow-[0_3px_0_#0D9488]'
                      : 'bg-[#FFF9F0]/80 dark:bg-[#0F172A]/80 border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                >
                  {formatNumber(sec)}ث
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
