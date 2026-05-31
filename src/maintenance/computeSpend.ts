// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// computeSpend — pure per-car spend aggregator (PRD §14.4, Phase 2).
// No Firestore, no React, no Date.now() calls — fully deterministic
// given its inputs. Tested in computeSpend.test.ts.
//
// Year bucketing: local calendar year from ts.toDate().getFullYear()
// (LOCAL getter, never toISOString() which is UTC). Fuel entries
// bucket by `loggedAt`; maintenance entries by `date` (service date).
// A null timestamp is counted in lifetime only — can't bucket without
// a date. Mirrors the dateField.ts LOCAL-component convention.
//
// fuelMiles bucketing: IDENTICAL local-year bucketing as fuel cost so
// cost and distance line up window-for-window. Gap deltas are
// INCLUDED — a missed fill inflates one delta but the odometer span
// is real distance driven; do NOT exclude outliers here (that's only
// for longestTank). Each delta is bucketed by entries[i].loggedAt
// (the newer fill's timestamp), same as the cost for that fill.

import type { Entry } from '../entries/entries';
import type { Maintenance } from './maintenance';

export interface SpendWindow {
  maintenance: number;
  fuel: number;
  total: number;
}

export interface FuelMilesWindow {
  thisYear: number;
  priorYear: number;
  lifetime: number;
}

export interface SpendReport {
  thisYear: SpendWindow;
  priorYear: SpendWindow;
  lifetime: SpendWindow;
  /** Distance driven (miles) per window, Fuel row only. */
  fuelMiles: FuelMilesWindow;
}

function makeWindow(): SpendWindow {
  return { maintenance: 0, fuel: 0, total: 0 };
}

/**
 * Aggregate per-car spend into a 3×3 (Maintenance/Fuel/Total ×
 * This year/Prior year/Lifetime), plus per-window fuel distance.
 *
 * @param fuel         Fuel entries for the car (newest-first).
 * @param maintenance  Maintenance entries for the car (any order).
 * @param referenceYear  The current calendar year (injected by the
 *                       caller — never read inside this fn).
 */
export function computeSpend(
  fuel: Entry[],
  maintenance: Maintenance[],
  referenceYear: number
): SpendReport {
  const thisYear = makeWindow();
  const priorYear = makeWindow();
  const lifetime = makeWindow();

  const priorYearNum = referenceYear - 1;

  // --- fuel cost bucketing ---
  for (const entry of fuel) {
    lifetime.fuel += entry.cost;

    if (entry.loggedAt === null) continue; // null → lifetime only

    const year = entry.loggedAt.toDate().getFullYear(); // LOCAL getter
    if (year === referenceYear) {
      thisYear.fuel += entry.cost;
    } else if (year === priorYearNum) {
      priorYear.fuel += entry.cost;
    }
  }

  // --- fuel distance bucketing (SAME local-year as cost) ---
  // Entries are newest-first. For each entry i with a chronological
  // prior (entries[i+1]), delta = entries[i].odometer - entries[i+1].odometer.
  // Only positive deltas count (data integrity guard). Bucketed by
  // entries[i].loggedAt's LOCAL year — the same fill whose cost
  // buckets there. Gap deltas are INCLUDED (no gap exclusion).
  // The oldest entry (entries[last]) has no prior → contributes 0.
  // Null loggedAt → count delta in lifetime only.
  const fuelMiles: FuelMilesWindow = {
    thisYear: 0,
    priorYear: 0,
    lifetime: 0,
  };

  for (let i = 0; i < fuel.length - 1; i++) {
    const current = fuel[i];
    const prior = fuel[i + 1];
    const delta = current.odometer - prior.odometer;
    if (delta <= 0) continue; // skip non-positive deltas

    fuelMiles.lifetime += delta;

    if (current.loggedAt === null) continue; // null → lifetime only

    const year = current.loggedAt.toDate().getFullYear(); // LOCAL getter
    if (year === referenceYear) {
      fuelMiles.thisYear += delta;
    } else if (year === priorYearNum) {
      fuelMiles.priorYear += delta;
    }
  }

  // --- maintenance cost bucketing ---
  for (const m of maintenance) {
    lifetime.maintenance += m.cost;

    if (m.date === null) continue; // null → lifetime only

    const year = m.date.toDate().getFullYear(); // LOCAL getter
    if (year === referenceYear) {
      thisYear.maintenance += m.cost;
    } else if (year === priorYearNum) {
      priorYear.maintenance += m.cost;
    }
  }

  thisYear.total = thisYear.maintenance + thisYear.fuel;
  priorYear.total = priorYear.maintenance + priorYear.fuel;
  lifetime.total = lifetime.maintenance + lifetime.fuel;

  return { thisYear, priorYear, lifetime, fuelMiles };
}
