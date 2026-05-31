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

import type { Entry } from '../entries/entries';
import type { Maintenance } from './maintenance';

export interface SpendWindow {
  maintenance: number;
  fuel: number;
  total: number;
}

export interface SpendReport {
  thisYear: SpendWindow;
  priorYear: SpendWindow;
  lifetime: SpendWindow;
}

function makeWindow(): SpendWindow {
  return { maintenance: 0, fuel: 0, total: 0 };
}

/**
 * Aggregate per-car spend into a 3×3 (Maintenance/Fuel/Total ×
 * This year/Prior year/Lifetime).
 *
 * @param fuel         Fuel entries for the car (any order).
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

  return { thisYear, priorYear, lifetime };
}
