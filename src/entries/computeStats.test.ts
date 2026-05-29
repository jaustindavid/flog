// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { describe, expect, it } from 'vitest';
import {
  expectedRangeBand,
  largestFill,
  longestTank,
  p95Mpg,
  percentile,
  validMpgs,
} from './computeStats';
import type { Entry } from './entries';

// Test-helper: build an Entry without caring about Firestore-shaped
// fields the stat helpers don't read. loggedAt / loggedByUid are
// irrelevant; the formulas only touch odometer and gallons.
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

// ---------------------------------------------------------------------------
// percentile — linear interpolation (Excel PERCENTILE.INC / type 7)
// ---------------------------------------------------------------------------
describe('percentile', () => {
  it('returns null on empty array', () => {
    expect(percentile([], 0.5)).toBeNull();
  });

  it('returns that value for a single-element array', () => {
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0)).toBe(42);
    expect(percentile([42], 1)).toBe(42);
  });

  // Hand-computed reference fixture: s = [10, 20, 30, 40] (sorted)
  //
  // Type-7 formula: rank = p*(n-1); lo=floor; hi=ceil;
  //   frac=rank-lo; result = s[lo] + frac*(s[hi]-s[lo])
  //
  // P50: rank = 0.5*3 = 1.5; lo=1 → s[1]=20; hi=2 → s[2]=30
  //      result = 20 + 0.5*(30-20) = 25
  // P10: rank = 0.1*3 = 0.3; lo=0 → s[0]=10; hi=1 → s[1]=20
  //      result = 10 + 0.3*(20-10) = 13
  // P90: rank = 0.9*3 = 2.7; lo=2 → s[2]=30; hi=3 → s[3]=40
  //      result = 30 + 0.7*(40-30) = 37
  // P0:  rank = 0; lo=hi=0 → s[0] = 10
  // P100: rank = 3; lo=hi=3 → s[3] = 40
  it('[10,20,30,40] → P50 = 25 (linear interp, not nearest-rank)', () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
  });

  it('[10,20,30,40] → P10 = 13', () => {
    expect(percentile([10, 20, 30, 40], 0.1)).toBeCloseTo(13, 10);
  });

  it('[10,20,30,40] → P90 = 37', () => {
    expect(percentile([10, 20, 30, 40], 0.9)).toBeCloseTo(37, 10);
  });

  it('[10,20,30,40] → P0 = 10 (min)', () => {
    expect(percentile([10, 20, 30, 40], 0)).toBe(10);
  });

  it('[10,20,30,40] → P100 = 40 (max)', () => {
    expect(percentile([10, 20, 30, 40], 1)).toBe(40);
  });

  it('sorts input before computing (unsorted input gives same result)', () => {
    // Same values in different order → identical percentile
    expect(percentile([40, 10, 30, 20], 0.5)).toBe(25);
  });

  it('[5] → P75 = 5 (single element, any p)', () => {
    expect(percentile([5], 0.75)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// validMpgs — per-fill MPGs from adjacent newest-first pairs
// ---------------------------------------------------------------------------
describe('validMpgs', () => {
  it('returns [] for an empty array', () => {
    expect(validMpgs([])).toEqual([]);
  });

  it('returns [] for a single entry (no prior to pair with)', () => {
    expect(validMpgs([e('a', 50000, 10)])).toEqual([]);
  });

  it('returns one MPG for two valid entries', () => {
    // newest-first: 50300 → 50000, delta 300, gallons 10 → 30 mpg
    expect(validMpgs([e('b', 50300, 10), e('a', 50000, 9)])).toEqual([30]);
  });

  it('drops null from a negative-odo-delta pair', () => {
    // Entry b has lower odo than a → perFillMpg returns null → dropped
    const entries = [
      e('c', 50500, 10),
      e('b', 49900, 10), // odo went down vs a
      e('a', 50000, 9),
    ];
    // c→b: 50500-49900=600/10=60 ✓; b→a: 49900-50000=-100 → null dropped
    expect(validMpgs(entries)).toEqual([60]);
  });

  it('drops null from zero-gallons entry', () => {
    const entries = [
      e('b', 50300, 0),  // zero gallons → perFillMpg null
      e('a', 50000, 10),
    ];
    expect(validMpgs(entries)).toEqual([]);
  });

  it('pairs correctly in newest-first order (index i with i+1)', () => {
    // 3 entries: newest-first c, b, a
    // c→b: (50500-50250)/10 = 25; b→a: (50250-50000)/8 = 31.25
    const entries = [
      e('c', 50500, 10),
      e('b', 50250, 8),
      e('a', 50000, 9),
    ];
    expect(validMpgs(entries)).toEqual([25, 31.25]);
  });
});

// ---------------------------------------------------------------------------
// longestTank — max positive odometer delta between adjacent fills
// ---------------------------------------------------------------------------
describe('longestTank', () => {
  it('returns null on empty array', () => {
    expect(longestTank([])).toBeNull();
  });

  it('returns null on a single entry (no adjacent pair)', () => {
    expect(longestTank([e('a', 50000, 10)])).toBeNull();
  });

  it('returns the positive delta for two valid entries', () => {
    // 50300 - 50000 = 300
    expect(longestTank([e('b', 50300, 10), e('a', 50000, 9)])).toBe(300);
  });

  it('returns null when all deltas are negative or zero', () => {
    const entries = [
      e('b', 49900, 10), // delta vs a = -100 (negative)
      e('a', 50000, 10),
    ];
    expect(longestTank(entries)).toBeNull();
  });

  it('ignores negative deltas, returns max positive', () => {
    // c→b: 50500-50000=500 ✓; b→a: 50000-50600=-600 (ignored)
    const entries = [
      e('c', 50500, 10),
      e('b', 50000, 10),
      e('a', 50600, 10),
    ];
    expect(longestTank(entries)).toBe(500);
  });

  it('returns the largest positive delta across multiple pairs', () => {
    // d→c: 50800-50500=300; c→b: 50500-50200=300; b→a: 50200-50000=200
    // longest = 300 (tie at 300 picks first encountered, but 300 is max)
    const entries = [
      e('d', 50800, 10),
      e('c', 50500, 10),
      e('b', 50200, 10),
      e('a', 50000, 10),
    ];
    expect(longestTank(entries)).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// largestFill — max gallons across all entries
// ---------------------------------------------------------------------------
describe('largestFill', () => {
  it('returns null on empty array', () => {
    expect(largestFill([])).toBeNull();
  });

  it('returns gallons for a single entry', () => {
    expect(largestFill([e('a', 50000, 9.5)])).toBe(9.5);
  });

  it('returns the maximum gallons across all entries', () => {
    const entries = [
      e('c', 50500, 8),
      e('b', 50200, 12),
      e('a', 50000, 10),
    ];
    expect(largestFill(entries)).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// p95Mpg — 95th-percentile per-fill MPG, null below 5 pairs
// ---------------------------------------------------------------------------
describe('p95Mpg', () => {
  it('returns null with 0 entries', () => {
    expect(p95Mpg([])).toBeNull();
  });

  it('returns null with fewer than 5 valid MPG pairs', () => {
    // 4 entries → 3 pairs (< 5 threshold)
    const entries = [
      e('d', 50800, 10),
      e('c', 50500, 10),
      e('b', 50200, 10),
      e('a', 50000, 10),
    ];
    expect(p95Mpg(entries)).toBeNull();
  });

  // Hand-computed reference fixture with 6 entries → 5 valid pairs:
  //
  // entries (newest-first): odos 600, 500, 400, 300, 200, 100
  // gallons: 10 each → per-fill MPG = 100/10 = 10 for all 5 pairs
  //
  // validMpgs = [10, 10, 10, 10, 10]
  // P95 of 5 identical values = 10
  it('returns correct P95 for exactly 5 valid pairs (uniform)', () => {
    const entries = [
      e('f', 600, 10),
      e('e', 500, 10),
      e('d', 400, 10),
      e('c', 300, 10),
      e('b', 200, 10),
      e('a', 100, 10),
    ];
    expect(p95Mpg(entries)).toBe(10);
  });

  // Hand-computed reference with distinct MPG values:
  // entries (newest-first) — odometers 550, 500, 400, 300, 200, 100
  // pair f→e: 50/10=5; e→d: 100/10=10; d→c: 100/10=10;
  //           c→b: 100/10=10; b→a: 100/10=10
  // validMpgs = [5, 10, 10, 10, 10]
  // sorted: [5, 10, 10, 10, 10]
  // P95: rank = 0.95*4 = 3.8; lo=3→s[3]=10; hi=4→s[4]=10
  //      result = 10 + 0.8*(10-10) = 10
  it('returns correct P95 for 5 pairs with one low outlier → 10 mpg', () => {
    const entries = [
      e('f', 550, 10),
      e('e', 500, 10),
      e('d', 400, 10),
      e('c', 300, 10),
      e('b', 200, 10),
      e('a', 100, 10),
    ];
    expect(p95Mpg(entries)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// expectedRangeBand — { lowMi, highMi }, null below 5 pairs
// ---------------------------------------------------------------------------
describe('expectedRangeBand', () => {
  it('returns null with 0 entries', () => {
    expect(expectedRangeBand([])).toBeNull();
  });

  it('returns null with fewer than 5 valid MPG pairs', () => {
    const entries = [
      e('d', 50800, 10),
      e('c', 50500, 10),
      e('b', 50200, 10),
      e('a', 50000, 10),
    ];
    expect(expectedRangeBand(entries)).toBeNull();
  });

  // Units-trap hand-computed fixture.
  //
  // Entries chosen so largestFill (gallons) and longestTank (miles) are
  // numerically distinct and produce obviously different results, so
  // any wiring of longestTank × mpg instead of largestFill × mpg would
  // produce wrong-magnitude numbers and fail loud.
  //
  // 6 entries (newest-first), odometers 600, 500, 400, 300, 200, 100:
  //   5 pairs all with delta=100. Gallons: 10 on each except the last
  //   (oldest, no MPG attributed to it), so all 5 MPGs = 100/10 = 10.
  //   BUT entry 'e' has 4 gallons to create a larger-gal entry:
  //
  // Let's use a cleaner fixture:
  //   entries: odos 500, 400, 300, 200, 100, 0
  //   gallons: 10, 8, 10, 10, 10, 10 (last irrelevant — oldest entry)
  //
  //   per-fill MPGs:
  //     f→e: (500-400)/10 = 10
  //     e→d: (400-300)/8  = 12.5
  //     d→c: (300-200)/10 = 10
  //     c→b: (200-100)/10 = 10
  //     b→a: (100-0)/10   = 10
  //   validMpgs = [10, 12.5, 10, 10, 10]
  //   sorted   = [10, 10, 10, 10, 12.5]
  //
  //   largestFill = max(10, 8, 10, 10, 10, 10) = 10 gal
  //   longestTank = max(100, 100, 100, 100, 100) = 100 mi   ← DISTINCT
  //
  //   P10: rank = 0.1*4 = 0.4; lo=0 → 10; hi=1 → 10
  //        result = 10 + 0.4*(10-10) = 10
  //   P90: rank = 0.9*4 = 3.6; lo=3 → 10; hi=4 → 12.5
  //        result = 10 + 0.6*(12.5-10) = 11.5
  //
  //   Expected band:
  //     lowMi  = round(10 gal × 10 mpg) = round(100) = 100 mi
  //     highMi = round(10 gal × 11.5 mpg) = round(115) = 115 mi
  //
  //   If incorrect wiring used longestTank (100 mi) instead of
  //   largestFill (10 gal):
  //     lowMi  = round(100 × 10)   = 1000 mi  ← WRONG (10× too large)
  //     highMi = round(100 × 11.5) = 1150 mi  ← WRONG
  //
  it('multiplies largestFill (gallons, not longestTank miles) for band', () => {
    const entries = [
      e('f', 500, 10),
      e('e', 400, 10),
      e('d', 300, 8),
      e('c', 200, 10),
      e('b', 100, 10),
      e('a', 0, 10),
    ];
    const band = expectedRangeBand(entries);
    expect(band).not.toBeNull();

    // Correct: uses largestFill=10 gal
    expect(band!.lowMi).toBe(100);
    expect(band!.highMi).toBe(115);

    // Guard: longestTank for this fixture is 100 mi — numerically
    // distinct from largestFill (10 gal). If the band were computed
    // with longestTank instead, lowMi would be 1000 (not 100).
    expect(band!.lowMi).not.toBe(1000);
    expect(band!.highMi).not.toBe(1150);
  });

  // Simpler uniform fixture: 6 entries, all 100-mi gaps, all 10 gal,
  // so MPG = 10 for all 5 pairs. largestFill = 10 gal.
  // P10 = P90 = 10, so band is {lowMi: 100, highMi: 100}.
  it('returns correct symmetric band for uniform 10-mpg entries', () => {
    const entries = [
      e('f', 600, 10),
      e('e', 500, 10),
      e('d', 400, 10),
      e('c', 300, 10),
      e('b', 200, 10),
      e('a', 100, 10),
    ];
    const band = expectedRangeBand(entries);
    expect(band).not.toBeNull();
    expect(band!.lowMi).toBe(100);
    expect(band!.highMi).toBe(100);
  });
});
