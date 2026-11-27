const EASTERN_TO_WESTERN_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

/**
 * Unified number formatter across the entire application.
 * Guarantees consistent Western numerals (0-9) everywhere so Eastern Arabic
 * and Western numerals are never mixed across screens, counters, scores, or timers.
 */
export function formatNumber(value: number | string): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '0';
    return String(value);
  }
  return value.replace(/[٠-٩۰-۹]/g, (ch) => EASTERN_TO_WESTERN_MAP[ch] ?? ch);
}

/**
 * Formats a signed numeric score delta consistently (e.g. +100, -100, 0).
 */
export function formatSignedNumber(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const absFormatted = formatNumber(Math.abs(value));
  return value > 0 ? `+${absFormatted}` : `-${absFormatted}`;
}
