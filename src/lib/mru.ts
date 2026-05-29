// Most-recently-used car ID — stored in localStorage per device.
//
// Per dispatch Decision #2: family is overwhelmingly single-device-
// per-person, so a per-device MRU is enough and does NOT justify a
// PRD §5.1 User schema amendment for cross-device sync.
//
// Both helpers no-op (never throw) when localStorage is unavailable —
// SSR-safety guard (we don't SSR, but defensive against future
// change) and access-denied modes (private browsing with cookies
// blocked on some browsers throws on access).

const MRU_CAR_KEY = 'flog:mru:carId';

function safeStorage(): Storage | null {
  try {
    if (typeof globalThis === 'undefined') return null;
    const g = globalThis as { localStorage?: Storage };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getMruCarId(): string | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const v = storage.getItem(MRU_CAR_KEY);
    return typeof v === 'string' && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setMruCarId(carId: string): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(MRU_CAR_KEY, carId);
  } catch {
    // localStorage quota or access-denied — silent.
  }
}
