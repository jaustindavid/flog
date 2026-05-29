// MPG computation — pure helpers. No Firestore, no React; importable
// from any context. Tested in computeMpg.test.ts per AGENTS gate
// ("MPG computation: (odo_now - odo_prev) / gallons_now, handling
// the 'no prior entry' case").
//
// All functions accept entries in **newest-first** order (matching
// `listEntriesForCar`'s output) so callers don't have to re-sort.
// Internally we pair entries chronologically: entry i's "prior" is
// entry i+1 in the array.
//
// Null semantics:
//   - perFillMpg: null when no valid pair (no prior, non-positive
//     odo delta, non-positive gallons).
//   - lastFillMpg: per Decision #5b — does NOT fall through to the
//     next-valid pair; if the newest pair is invalid, the tile
//     shows "—" (matching the per-row "—" in the table).
//   - lifetimeMpg / avgLastNMpg: strict tank-to-tank methodology.
//     Skip the chronologically first entry's gallons since that
//     fill happened before tracking began (no odo delta to
//     attribute it to). Decision #2: clean-data assumption — if
//     bad data is present (M4 flag-but-accept negative-delta
//     entries) the formula may return null or unexpected numbers.
//     That's the user's signal to fix data, not M5's problem to
//     engineer around.

import type { Entry } from './entries';

/**
 * Per-fill MPG between two chronologically-adjacent entries.
 * `prior` is null when `current` is the chronologically-first entry
 * on the car (no prior to compute against). Returns null on any of:
 * null prior, non-positive odo delta, non-positive gallons.
 */
export function perFillMpg(
  current: Entry,
  prior: Entry | null
): number | null {
  if (prior === null) return null;
  const odoDelta = current.odometer - prior.odometer;
  if (odoDelta <= 0) return null;
  if (current.gallons <= 0) return null;
  return odoDelta / current.gallons;
}

/**
 * MPG of the most-recent entry, using its immediate chronological
 * prior. Does NOT fall through to next-valid pair (Decision #5b);
 * if the newest pair is invalid, returns null — matching the "—"
 * the table shows for the newest row in that case.
 */
export function lastFillMpg(
  entriesNewestFirst: Entry[]
): number | null {
  if (entriesNewestFirst.length < 2) return null;
  return perFillMpg(entriesNewestFirst[0], entriesNewestFirst[1]);
}

/**
 * Strict tank-to-tank lifetime MPG. Skips the chronologically first
 * entry's gallons (its fill happened before tracking began, so there
 * is no odo delta to attribute it to).
 *
 *   numerator   = newest.odometer - oldest.odometer
 *   denominator = sum(gallons) EXCLUDING the oldest entry
 *
 * In newest-first ordering: newest is at index 0, oldest is at the
 * last index. We sum gallons from indices 0..length-2 (inclusive),
 * skipping the entry at index length-1.
 *
 * Returns null when fewer than 2 entries, or net distance is
 * non-positive, or fuel sum is non-positive.
 */
export function lifetimeMpg(
  entriesNewestFirst: Entry[]
): number | null {
  if (entriesNewestFirst.length < 2) return null;
  const newest = entriesNewestFirst[0];
  const oldest = entriesNewestFirst[entriesNewestFirst.length - 1];
  const distance = newest.odometer - oldest.odometer;
  if (distance <= 0) return null;
  let fuel = 0;
  for (let i = 0; i < entriesNewestFirst.length - 1; i++) {
    fuel += entriesNewestFirst[i].gallons;
  }
  if (fuel <= 0) return null;
  return distance / fuel;
}

/**
 * Strict tank-to-tank MPG over the N most-recent entries. Same
 * methodology as `lifetimeMpg`, scoped to a window.
 *
 * For n=5 with >=5 entries: computes over exactly the 5 most-recent.
 * For n=5 with 3 entries: computes over the 3 available (still >=2
 * needed for any number).
 *
 * Implementation note (per dispatch §9 #9): composed via
 * `lifetimeMpg(slice)` rather than inlined. Both produce the same
 * result; composing keeps the methodology definition in one place
 * so future formula tweaks land once.
 */
export function avgLastNMpg(
  entriesNewestFirst: Entry[],
  n: number
): number | null {
  const window = entriesNewestFirst.slice(
    0,
    Math.min(n, entriesNewestFirst.length)
  );
  return lifetimeMpg(window);
}
