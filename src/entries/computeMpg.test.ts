// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { describe, expect, it } from 'vitest';
import {
  avgLastNMpg,
  lastFillMpg,
  lifetimeMpg,
  perFillMpg,
} from './computeMpg';
import type { Entry } from './entries';

// Test-helper: build an Entry without caring about Firestore-shaped
// fields the MPG helpers don't read. loggedAt / loggedByUid are
// irrelevant to computation; the formulas only touch odometer and
// gallons.
function e(
  id: string,
  odometer: number,
  gallons: number,
  cost = 0
): Entry {
  return {
    id,
    loggedByUid: 'uid',
    odometer,
    gallons,
    cost,
    loggedAt: null,
  };
}

describe('perFillMpg', () => {
  it('returns null when prior is null (first entry on car)', () => {
    expect(perFillMpg(e('a', 50100, 10), null)).toBeNull();
  });

  it('returns correct MPG for a valid positive-delta pair', () => {
    // 50300 - 50000 = 300 miles on 10 gallons = 30 mpg
    expect(perFillMpg(e('b', 50300, 10), e('a', 50000, 9))).toBe(30);
  });

  it('returns null on negative odo delta (M4 flag-but-accept case)', () => {
    expect(perFillMpg(e('b', 49900, 10), e('a', 50000, 9))).toBeNull();
  });

  it('returns null on zero odo delta', () => {
    expect(perFillMpg(e('b', 50000, 10), e('a', 50000, 9))).toBeNull();
  });

  it('returns null on zero gallons (defensive; would divide by zero)', () => {
    expect(perFillMpg(e('b', 50300, 0), e('a', 50000, 9))).toBeNull();
  });

  it('returns null on negative gallons (defensive)', () => {
    expect(perFillMpg(e('b', 50300, -5), e('a', 50000, 9))).toBeNull();
  });

  it('produces a decimal MPG for non-round inputs', () => {
    // 250 / 8 = 31.25
    expect(perFillMpg(e('b', 50250, 8), e('a', 50000, 9))).toBe(31.25);
  });
});

describe('lastFillMpg', () => {
  it('returns null on empty array', () => {
    expect(lastFillMpg([])).toBeNull();
  });

  it('returns null on a single entry (no prior to pair with)', () => {
    expect(lastFillMpg([e('a', 50000, 10)])).toBeNull();
  });

  it('returns MPG of the newest pair for two valid entries', () => {
    // newest-first: 50300 -> 50000, delta 300, gallons 10 → 30 mpg
    expect(
      lastFillMpg([e('b', 50300, 10), e('a', 50000, 9)])
    ).toBe(30);
  });

  it('returns null on negative-delta newest pair (no fall-through, Decision #5b)', () => {
    // Newest pair is invalid (odo went down). Even though the older
    // pair would be valid, we do NOT fall through — tile shows "—"
    // matching the per-row "—" in the table.
    const entries = [
      e('c', 49900, 10), // newest — odo dropped vs prior
      e('b', 50000, 10),
      e('a', 49700, 9),  // older pair (b vs a) is valid: 300/10 = 30
    ];
    expect(lastFillMpg(entries)).toBeNull();
  });

  it('returns null on zero-gallons newest entry (no fall-through)', () => {
    const entries = [
      e('c', 50500, 0),  // newest — zero gallons
      e('b', 50300, 10),
      e('a', 50000, 9),
    ];
    expect(lastFillMpg(entries)).toBeNull();
  });
});

describe('avgLastNMpg', () => {
  it('returns null on empty array', () => {
    expect(avgLastNMpg([], 5)).toBeNull();
  });

  it('returns null on a single entry (window of 1)', () => {
    expect(avgLastNMpg([e('a', 50000, 10)], 5)).toBeNull();
  });

  it('returns MPG over the available pair when only 2 entries exist', () => {
    // newest-first: 50300 -> 50000, distance 300; skip oldest's
    // gallons → fuel = 10 → 30 mpg
    expect(
      avgLastNMpg([e('b', 50300, 10), e('a', 50000, 9)], 5)
    ).toBe(30);
  });

  it('computes MPG over exactly the most-recent N when entries.length === n', () => {
    // 5 entries, n=5; ascending odometers 100, 200, 300, 400, 500
    // distance = 500 - 100 = 400; fuel = sum of newest 4 gallons
    // (skip oldest at index 4): 10 + 10 + 10 + 10 = 40 → 10 mpg
    const entries = [
      e('e', 500, 10),
      e('d', 400, 10),
      e('c', 300, 10),
      e('b', 200, 10),
      e('a', 100, 10),
    ];
    expect(avgLastNMpg(entries, 5)).toBe(10);
  });

  it('uses only the most-recent N when entries.length > n (older entries excluded)', () => {
    // 10 entries; n=5; older 5 have very different MPG to prove they
    // are NOT in the calculation.
    const entries: Entry[] = [
      e('j', 1500, 10),  // newest
      e('i', 1400, 10),
      e('h', 1300, 10),
      e('g', 1200, 10),
      e('f', 1100, 10),
      // these older five would push the average around if included:
      e('e', 500, 999),
      e('d', 400, 999),
      e('c', 300, 999),
      e('b', 200, 999),
      e('a', 100, 999),
    ];
    // Window [j..f]: distance 1500-1100=400, fuel = 10+10+10+10 = 40
    // (skip f, the oldest in window) → 10 mpg
    expect(avgLastNMpg(entries, 5)).toBe(10);
  });

  it('returns null on net non-positive window distance', () => {
    // All-same odometer within window
    const entries = [
      e('c', 50000, 10),
      e('b', 50000, 10),
      e('a', 50000, 10),
    ];
    expect(avgLastNMpg(entries, 5)).toBeNull();
  });

  it('falls back to all-available entries when n exceeds length', () => {
    // n=5 but only 3 entries: window is all 3.
    // distance = 50400 - 50000 = 400; fuel = 10 + 10 = 20 → 20 mpg
    const entries = [
      e('c', 50400, 10),
      e('b', 50200, 10),
      e('a', 50000, 10),
    ];
    expect(avgLastNMpg(entries, 5)).toBe(20);
  });
});

describe('lifetimeMpg', () => {
  it('returns null on empty array', () => {
    expect(lifetimeMpg([])).toBeNull();
  });

  it('returns null on a single entry', () => {
    expect(lifetimeMpg([e('a', 50000, 10)])).toBeNull();
  });

  it('returns MPG over the available pair when only 2 entries exist', () => {
    // distance = 50300 - 50000 = 300; fuel = 10 (skip oldest) → 30 mpg
    expect(
      lifetimeMpg([e('b', 50300, 10), e('a', 50000, 9)])
    ).toBe(30);
  });

  // T14 — hand-computed reference test. Small fixture with
  // strictly-monotonic odometer; round inputs chosen for clean
  // expected decimal output. See dispatch §9 #10.
  //
  // Fixture (chronological, oldest first):
  //   entry 1: odo  50000, gallons  9.00  (excluded from fuel sum)
  //   entry 2: odo  50250, gallons  8.00
  //   entry 3: odo  50500, gallons 10.00
  //   entry 4: odo  50800, gallons 10.00
  //
  // Lifetime MPG hand-compute:
  //   distance = 50800 - 50000 = 800
  //   fuel     = 8 + 10 + 10 = 28   (excluding entry 1)
  //   mpg      = 800 / 28 = 28.571428571428573
  //
  // Per-fill MPGs (each pair):
  //   entry 2: 250 / 8  = 31.25
  //   entry 3: 250 / 10 = 25.0
  //   entry 4: 300 / 10 = 30.0
  //
  // avgLastNMpg(entries, 5) with 4 entries → same as lifetime
  // (window is all 4).
  //
  // avgLastNMpg(entries, 3) → window = newest 3:
  //   distance = 50800 - 50250 = 550
  //   fuel     = 10 + 10 = 20  (excluding the oldest-in-window, entry 2)
  //   mpg      = 550 / 20 = 27.5
  it('matches hand-computed reference for a 4-entry fixture (T14)', () => {
    const entries = [
      e('d', 50800, 10),   // newest
      e('c', 50500, 10),
      e('b', 50250, 8),
      e('a', 50000, 9),    // oldest (its gallons excluded)
    ];

    // Lifetime: 800 miles / 28 gallons = 28.571428…
    const lifetime = lifetimeMpg(entries);
    expect(lifetime).not.toBeNull();
    expect(lifetime).toBeCloseTo(800 / 28, 10);

    // Last fill: 300 / 10 = 30 exactly
    expect(lastFillMpg(entries)).toBe(30);

    // Per-row MPG of entry 'c': (50500 - 50250) / 10 = 25.0
    expect(perFillMpg(entries[1], entries[2])).toBe(25);

    // Per-row MPG of entry 'b': (50250 - 50000) / 8 = 31.25
    expect(perFillMpg(entries[2], entries[3])).toBe(31.25);

    // Per-row MPG of entry 'a' (oldest): null (no prior)
    expect(perFillMpg(entries[3], null)).toBeNull();

    // Avg last 5 with 4 entries: window is all 4 → equals lifetime
    expect(avgLastNMpg(entries, 5)).toBe(lifetime);

    // Avg last 3: distance 550 / fuel 20 = 27.5 exactly
    expect(avgLastNMpg(entries, 3)).toBe(27.5);
  });
});
