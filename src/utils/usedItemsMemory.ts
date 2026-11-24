const STORAGE_KEY = 'bakasa_used_items';
const RESET_THRESHOLD = 0.9;

type UsedItemsStore = Record<string, string[]>;

function readStore(): UsedItemsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as UsedItemsStore;
    }
  } catch {
    // Ignore storage read errors
  }
  return {};
}

function writeStore(store: UsedItemsStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Picks a single unseen item from the given bucket.
 * Automatically resets the bucket once >= 90% of its items have been played.
 */
export function pickUnseenItem(bucketKey: string, items: string[]): string {
  if (items.length === 0) return '';

  const store = readStore();
  let used = Array.isArray(store[bucketKey]) ? store[bucketKey] : [];

  if (used.length >= Math.floor(items.length * RESET_THRESHOLD)) {
    used = [];
  }

  let usedSet = new Set(used);
  let unseen = items.filter((item) => !usedSet.has(item));

  if (unseen.length === 0) {
    used = [];
    usedSet = new Set();
    unseen = [...items];
  }

  const chosen = unseen[Math.floor(Math.random() * unseen.length)];
  store[bucketKey] = [...used, chosen];
  writeStore(store);
  return chosen;
}

/**
 * Picks N distinct unseen items from the given bucket (e.g., for multi-turn rounds).
 * Resets the bucket once >= 90% of items have been played.
 */
export function pickUnseenBatch(bucketKey: string, items: string[], count: number): string[] {
  if (items.length === 0 || count <= 0) return [];

  const store = readStore();
  let used = Array.isArray(store[bucketKey]) ? store[bucketKey] : [];

  if (used.length >= Math.floor(items.length * RESET_THRESHOLD)) {
    used = [];
  }

  let usedSet = new Set(used);
  let unseen = items.filter((item) => !usedSet.has(item)).sort(() => Math.random() - 0.5);

  const picked: string[] = [];

  for (const item of unseen) {
    if (picked.length >= count) break;
    picked.push(item);
  }

  if (picked.length < count) {
    // Reset bucket and top up without duplicating items already picked in this batch
    used = [];
    const pickedSet = new Set(picked);
    const remaining = items.filter((item) => !pickedSet.has(item)).sort(() => Math.random() - 0.5);
    for (const item of remaining) {
      if (picked.length >= count) break;
      picked.push(item);
    }
  }

  store[bucketKey] = [...used, ...picked];
  writeStore(store);
  return picked;
}

export function resetAllUsedItems(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function getUsedItemsCount(): number {
  const store = readStore();
  return Object.values(store).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );
}
