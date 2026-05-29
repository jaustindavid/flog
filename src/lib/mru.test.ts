// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMruCarId, setMruCarId } from './mru';

const MRU_CAR_KEY = 'flog:mru:carId';

// Node's default vitest env has no localStorage. Stub a minimal in-
// memory Storage shim for the happy-path tests; override per-test
// when we want to exercise SSR-absent / throwing paths.

function makeMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
  };
}

describe('mru helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getMruCarId', () => {
    it('returns null when no key set', () => {
      expect(getMruCarId()).toBeNull();
    });

    it('returns the stored value when present', () => {
      globalThis.localStorage.setItem(MRU_CAR_KEY, 'car-abc');
      expect(getMruCarId()).toBe('car-abc');
    });

    it('returns null when localStorage is unavailable (SSR-safety)', () => {
      vi.stubGlobal('localStorage', undefined);
      expect(getMruCarId()).toBeNull();
    });

    it('does not throw when localStorage.getItem throws', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('access denied');
        },
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      } satisfies Storage);
      expect(() => getMruCarId()).not.toThrow();
      expect(getMruCarId()).toBeNull();
    });

    it('treats empty string as missing', () => {
      globalThis.localStorage.setItem(MRU_CAR_KEY, '');
      expect(getMruCarId()).toBeNull();
    });
  });

  describe('setMruCarId', () => {
    it('writes the value to localStorage', () => {
      setMruCarId('car-xyz');
      expect(globalThis.localStorage.getItem(MRU_CAR_KEY)).toBe('car-xyz');
    });

    it('does not throw when localStorage is unavailable', () => {
      vi.stubGlobal('localStorage', undefined);
      expect(() => setMruCarId('car-xyz')).not.toThrow();
    });

    it('does not throw when localStorage.setItem throws (quota)', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: () => {
          throw new Error('quota exceeded');
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      } satisfies Storage);
      expect(() => setMruCarId('car-xyz')).not.toThrow();
    });
  });
});
