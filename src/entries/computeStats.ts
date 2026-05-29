// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Per-car stat helpers — pure functions, no Firestore, no React.
// Tested in computeStats.test.ts per AGENTS gate.
//
// All functions accept entries in **newest-first** order (matching
// `listEntriesForCar` output). Internally we pair entries
// chronologically: entry i's "prior" is entry i+1 in the array.
//
// Null semantics mirror computeMpg.ts:
//   - null returned whenever the required data is absent or
//     thresholds are not met. Callers render "—" on null.

import type { Entry } from './entries';
import { perFillMpg } from './computeMpg';

/**
 * Per-fill MPGs over adjacent pairs (newest-first input; index i+1
 * is the chronological prior — same convention as EntriesTable).
 * Drops nulls (no-prior / odo-down / zero-gallons) — same exclusions
 * perFillMpg already applies.
 */
export function validMpgs(entriesNewestFirst: Entry[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < entriesNewestFirst.length - 1; i++) {
    const m = perFillMpg(entriesNewestFirst[i], entriesNewestFirst[i + 1]);
    if (m !== null) out.push(m);
  }
  return out;
}

/**
 * Linear-interpolated percentile (Excel PERCENTILE.INC / type 7).
 * p in [0,1]. Matches Google Sheets PERCENTILE() and the owner's
 * spreadsheet — load-bearing for Caterham parity check (V2).
 *
 * Formula: rank = p*(n-1); lo=floor(rank); hi=ceil(rank);
 *          frac=rank-lo; return s[lo] + frac*(s[hi]-s[lo]).
 *
 * Returns null on empty input. Single-element input returns that
 * value (rank=0 → lo=hi=0, frac=0).
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const rank = p * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const frac = rank - lo;
  return s[lo] + frac * (s[hi] - s[lo]);
}

// A tank whose implied per-fill MPG exceeds this multiple of the car's
// median per-fill MPG is treated as a missed-fill DATA GAP, not a real
// tank. A forgotten/under-recorded fill makes one odometer delta span
// two tanks, inflating BOTH the distance and the implied MPG (~2x), so
// the gap masquerades as a giant tank. Excluding it keeps "Longest
// tank" honest. Threshold grounded in the real fleet data (2026-05-29):
// legit tanks top out ~1.3x median; gaps land 1.6x+ — wide daylight
// between, so 1.5x separates cleanly with margin. (Also catches the
// Caterham's fuel-can top-ups, whose under-recorded gallons read as
// 46-65 mpg.) See BACKLOG "Longest tank outlier from data gaps".
const GAP_MPG_MULTIPLE = 1.5;

/**
 * Longest plausible tank: maximum positive odometer delta between
 * adjacent fills (newest-first input; delta = entries[i].odometer -
 * entries[i+1].odometer), EXCLUDING deltas that are missed-fill data
 * gaps — those whose implied per-fill MPG exceeds GAP_MPG_MULTIPLE x
 * the car's median per-fill MPG.
 *
 * Gap detection needs a distribution to judge against: with fewer than
 * 2 valid MPG pairs there's no median, so no delta can be flagged and
 * this returns the raw max positive delta (best effort — a 2-entry car
 * can't tell a gap from a long tank).
 *
 * Returns null if fewer than 2 entries or no positive delta survives.
 */
export function longestTank(entriesNewestFirst: Entry[]): number | null {
  // Reference for "implausibly high MPG" — the car's own median per-fill
  // MPG (robust to the very outliers we're filtering). null when <2
  // pairs, which disables gap filtering (see doc above).
  const mpgs = validMpgs(entriesNewestFirst);
  const medianMpg = mpgs.length >= 2 ? percentile(mpgs, 0.5) : null;

  let max: number | null = null;
  for (let i = 0; i < entriesNewestFirst.length - 1; i++) {
    const d = entriesNewestFirst[i].odometer - entriesNewestFirst[i + 1].odometer;
    if (d <= 0) continue;
    if (medianMpg !== null) {
      const m = perFillMpg(entriesNewestFirst[i], entriesNewestFirst[i + 1]);
      if (m !== null && m > GAP_MPG_MULTIPLE * medianMpg) continue; // gap
    }
    if (max === null || d > max) max = d;
  }
  return max;
}

/**
 * Maximum gallons across all entries.
 * Returns null if no entries.
 */
export function largestFill(entriesNewestFirst: Entry[]): number | null {
  if (entriesNewestFirst.length === 0) return null;
  return Math.max(...entriesNewestFirst.map((e) => e.gallons));
}

// Minimum valid MPG pairs required for percentile-based stats.
const MIN_MPG_PAIRS = 5;

/**
 * 95th-percentile per-fill MPG (linear-interpolated).
 * Returns null if fewer than 5 valid MPG pairs are available.
 */
export function p95Mpg(entriesNewestFirst: Entry[]): number | null {
  const m = validMpgs(entriesNewestFirst);
  if (m.length < MIN_MPG_PAIRS) return null;
  return percentile(m, 0.95);
}

/**
 * Expected range band: { lowMi, highMi }.
 * lowMi  = round(largestFill × P10 mpg)
 * highMi = round(largestFill × P90 mpg)
 *
 * Multiplier is largestFill in GALLONS (not longestTank in miles) —
 * gal × mpg = mi. Mixing longestTank here would be a units error
 * (mi²/gal). Confirmed in design conversation 2026-05-29.
 *
 * Returns null if fewer than 5 valid MPG pairs or no entries.
 */
export function expectedRangeBand(
  entriesNewestFirst: Entry[]
): { lowMi: number; highMi: number } | null {
  const m = validMpgs(entriesNewestFirst);
  if (m.length < MIN_MPG_PAIRS) return null;
  const fill = largestFill(entriesNewestFirst);
  if (fill === null) return null;
  // safe: guarded by length ≥ 5 above — percentile cannot return null
  return {
    lowMi: Math.round(fill * (percentile(m, 0.1) as number)),
    highMi: Math.round(fill * (percentile(m, 0.9) as number)),
  };
}
