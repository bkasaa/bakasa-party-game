export type CustomContentTab = 'words' | 'questions' | 'dares' | 'footballNames';

export type CustomContentMode = 'merge' | 'custom_only';

export interface CustomContentData {
  words: string[];
  questions: string[];
  dares: string[];
  footballNames: string[];
  mode: CustomContentMode;
}

const STORAGE_KEY = 'qada_custom_content_v1';

const DEFAULT_CUSTOM_CONTENT: CustomContentData = {
  words: [],
  questions: [],
  dares: [],
  footballNames: [],
  mode: 'merge',
};

function sanitizeList(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function getCustomContent(): CustomContentData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CUSTOM_CONTENT };
    const parsed = JSON.parse(raw) as Partial<CustomContentData>;
    return {
      words: sanitizeList(parsed.words),
      questions: sanitizeList(parsed.questions),
      dares: sanitizeList(parsed.dares),
      footballNames: sanitizeList(parsed.footballNames),
      mode: parsed.mode === 'custom_only' ? 'custom_only' : 'merge',
    };
  } catch {
    return { ...DEFAULT_CUSTOM_CONTENT };
  }
}

export function saveCustomContent(next: CustomContentData): CustomContentData {
  const clean: CustomContentData = {
    words: sanitizeList(next.words),
    questions: sanitizeList(next.questions),
    dares: sanitizeList(next.dares),
    footballNames: sanitizeList(next.footballNames),
    mode: next.mode === 'custom_only' ? 'custom_only' : 'merge',
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota errors
  }
  return clean;
}

export function addCustomItem(tab: CustomContentTab, value: string): CustomContentData {
  const current = getCustomContent();
  const trimmed = value.trim();
  if (!trimmed) return current;
  const list = current[tab];
  if (list.includes(trimmed)) return current;
  return saveCustomContent({
    ...current,
    [tab]: [trimmed, ...list],
  });
}

export function removeCustomItem(tab: CustomContentTab, value: string): CustomContentData {
  const current = getCustomContent();
  return saveCustomContent({
    ...current,
    [tab]: current[tab].filter((item) => item !== value),
  });
}

export function setCustomMode(mode: CustomContentMode): CustomContentData {
  const current = getCustomContent();
  return saveCustomContent({
    ...current,
    mode,
  });
}

export function getCustomTotalCount(): number {
  const c = getCustomContent();
  return c.words.length + c.questions.length + c.dares.length + c.footballNames.length;
}

/**
 * Resolves a default word/question/dare/football pool with the user's custom entries.
 * - If mode === 'custom_only' and custom list is non-empty -> strictly returns custom items.
 * - If mode === 'merge' and custom list is non-empty -> prepends custom items & deduplicates.
 * - Falls back safely to defaultPool if custom list is empty.
 */
export function resolvePoolWithCustom(defaultPool: string[], tab: CustomContentTab): string[] {
  const data = getCustomContent();
  const customList = data[tab];
  if (customList.length === 0) {
    return defaultPool;
  }
  if (data.mode === 'custom_only') {
    return [...customList];
  }
  const seen = new Set<string>(customList);
  const merged = [...customList];
  for (const item of defaultPool) {
    if (!seen.has(item)) {
      seen.add(item);
      merged.push(item);
    }
  }
  return merged;
}
