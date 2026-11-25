import React from 'react';
import { Check, Layers } from 'lucide-react';
import { soundManager } from '../utils/soundManager';

export interface FilterCategoryOption {
  id: string;
  name: string;
  count?: number;
}

interface CategoryFilterBarProps {
  categories: FilterCategoryOption[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  totalAvailable: number;
  unitLabel?: string;
  title?: string;
  accentColor?: 'coral' | 'teal' | 'emerald' | 'amber';
}

const ACCENT_ACTIVE_CLASSES: Record<
  NonNullable<CategoryFilterBarProps['accentColor']>,
  string
> = {
  coral: 'bg-[#FF6B4A] text-white border-[#D94E30] shadow-[0_3px_0_#D94E30]',
  teal: 'bg-[#14B8A6] text-white border-[#0D9488] shadow-[0_3px_0_#0D9488]',
  emerald: 'bg-[#10B981] text-white border-[#059669] shadow-[0_3px_0_#059669]',
  amber: 'bg-[#F59E0B] text-white border-[#D97706] shadow-[0_3px_0_#D97706]',
};

export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  categories,
  selectedIds,
  onChange,
  totalAvailable,
  unitLabel = 'عنصر',
  title = 'الأقسام (تقدر تختار قسم أو أكتر):',
  accentColor = 'teal',
}) => {
  const isAllSelected = selectedIds.length === 0;
  const activeStyle = ACCENT_ACTIVE_CLASSES[accentColor];

  const handleSelectAll = () => {
    soundManager.play('click');
    onChange([]);
  };

  const handleToggleCategory = (categoryId: string) => {
    soundManager.play('click');
    if (isAllSelected) {
      onChange([categoryId]);
      return;
    }

    if (selectedIds.includes(categoryId)) {
      const next = selectedIds.filter((id) => id !== categoryId);
      onChange(next);
      return;
    }

    const next = [...selectedIds, categoryId];
    if (next.length >= categories.length) {
      onChange([]);
    } else {
      onChange(next);
    }
  };

  return (
    <div className="w-full rounded-3xl qada-card p-3.5 sm:p-4 text-right">
      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
        <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[#14B8A6] shrink-0" />
          <span>{title}</span>
        </span>
        <span className="text-[11px] sm:text-xs font-black text-[#0D9488] dark:text-[#2DD4BF] bg-[#F0FDFA] dark:bg-teal-950/60 border border-[#99F6E4] dark:border-teal-800 px-2.5 py-0.5 rounded-lg tabular-nums">
          متاح {totalAvailable} {unitLabel}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSelectAll}
          aria-pressed={isAllSelected}
          className={`min-h-[36px] px-3 rounded-xl border text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all active:scale-95 ${
            isAllSelected
              ? activeStyle
              : 'bg-[#FFF9F0] dark:bg-[#0F172A] border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white'
          }`}
        >
          {isAllSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
          <span>الكل</span>
        </button>

        {categories.map((cat) => {
          const isSelected = !isAllSelected && selectedIds.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleToggleCategory(cat.id)}
              aria-pressed={isSelected}
              className={`min-h-[36px] px-3 rounded-xl border text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition-all active:scale-95 ${
                isSelected
                  ? activeStyle
                  : 'bg-[#FFF9F0] dark:bg-[#0F172A] border-[#E7DEC8] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1] hover:text-[#1E293B] dark:hover:text-white'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
