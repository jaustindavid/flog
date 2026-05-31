// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import type { Entry } from '../entries/entries';
import type { Maintenance } from './maintenance';
import { computeSpend } from './computeSpend';

// ---------------------------------------------------------------------------
// Test helpers — build minimal Entry / Maintenance without Firestore fields
// that computeSpend doesn't read.
// ---------------------------------------------------------------------------

function fuel(
  id: string,
  cost: number,
  loggedAt: Timestamp | null
): Entry {
  return {
    id,
    loggedByUid: 'uid',
    odometer: 0,
    gallons: 10,
    cost,
    loggedAt,
  };
}

function maint(
  id: string,
  cost: number,
  date: Timestamp | null
): Maintenance {
  return {
    id,
    loggedByUid: 'uid',
    date,
    odometer: 0,
    cost,
    note: '',
    resetsReminder: false,
    loggedAt: null,
  };
}

// ---------------------------------------------------------------------------
// empty — all zeros
// ---------------------------------------------------------------------------
describe('computeSpend — empty inputs', () => {
  it('returns all-zero SpendReport when both arrays are empty', () => {
    const r = computeSpend([], [], 2026);
    expect(r.thisYear).toEqual({ maintenance: 0, fuel: 0, total: 0 });
    expect(r.priorYear).toEqual({ maintenance: 0, fuel: 0, total: 0 });
    expect(r.lifetime).toEqual({ maintenance: 0, fuel: 0, total: 0 });
  });
});

// ---------------------------------------------------------------------------
// year-boundary — the MEANINGFUL case (AC-T)
//
// Fixture: Dec 31, 2025 at 23:00 LOCAL (America/New_York, UTC-5 in winter).
//   new Date(2025, 11, 31, 23, 0) → local 2025-12-31T23:00 in NY
//   UTC equivalent                → 2026-01-01T04:00Z
//
//   LOCAL  getFullYear() → 2025  (correct — the service happened in 2025)
//   UTC   toISOString()  → "2026-01-01T04:00:00.000Z" → year 2026 (WRONG)
//
// The test is meaningful because:
//   - The fixture is built from LOCAL components so its local year (2025)
//     DIVERGES from its UTC year (2026).
//   - A correct getFullYear() bucketer puts the $50 in priorYear.fuel.
//   - A buggy toISOString/UTC bucketer puts the $50 in thisYear.fuel.
//   - npm test is pinned to TZ=America/New_York (negative-UTC offset in
//     winter), so the divergence is actually exercised.
//
// referenceYear = 2026: priorYear = 2025, thisYear = 2026.
// ---------------------------------------------------------------------------
describe('computeSpend — year-boundary (Dec-31 local ≠ UTC year)', () => {
  // Dec 31, 2025 at 23:00 LOCAL in America/New_York = 2026-01-01T04:00Z.
  // Local year: 2025. UTC year: 2026.
  const dec31LocalTs = Timestamp.fromDate(new Date(2025, 11, 31, 23, 0));

  it('fuel: Dec-31 23:00 local → priorYear (2025), NOT thisYear (2026)', () => {
    const r = computeSpend(
      [fuel('f1', 50, dec31LocalTs)],
      [],
      2026 // referenceYear; prior = 2025
    );
    // Correct local-year bucketer: $50 is in 2025 → priorYear
    expect(r.priorYear.fuel).toBeCloseTo(50, 6);
    expect(r.thisYear.fuel).toBeCloseTo(0, 6);
    expect(r.lifetime.fuel).toBeCloseTo(50, 6);
    // This assertion FAILS if the code used toISOString UTC bucketing
    // (would put $50 in thisYear instead of priorYear).
  });

  it('maintenance: Dec-31 23:00 local → priorYear (2025), NOT thisYear', () => {
    const r = computeSpend(
      [],
      [maint('m1', 120, dec31LocalTs)],
      2026
    );
    expect(r.priorYear.maintenance).toBeCloseTo(120, 6);
    expect(r.thisYear.maintenance).toBeCloseTo(0, 6);
    expect(r.lifetime.maintenance).toBeCloseTo(120, 6);
  });
});

// ---------------------------------------------------------------------------
// null-timestamp — counted in lifetime only (decision §4 item 5)
// ---------------------------------------------------------------------------
describe('computeSpend — null timestamps', () => {
  it('fuel with null loggedAt → lifetime only, not this/prior year', () => {
    const r = computeSpend([fuel('f1', 80, null)], [], 2026);
    expect(r.lifetime.fuel).toBeCloseTo(80, 6);
    expect(r.thisYear.fuel).toBe(0);
    expect(r.priorYear.fuel).toBe(0);
  });

  it('maintenance with null date → lifetime only, not this/prior year', () => {
    const r = computeSpend([], [maint('m1', 200, null)], 2026);
    expect(r.lifetime.maintenance).toBeCloseTo(200, 6);
    expect(r.thisYear.maintenance).toBe(0);
    expect(r.priorYear.maintenance).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// cross-stream — fuel + maintenance in the same year, totals correct
// ---------------------------------------------------------------------------
describe('computeSpend — cross-stream (fuel + maintenance, same year)', () => {
  // referenceYear = 2026; entries are in 2026 (this year).
  // Jan 15, 2026 local — safely within 2026 in any UTC offset.
  const jan15_2026 = Timestamp.fromDate(new Date(2026, 0, 15, 10, 0));

  it('sums fuel + maintenance per window; total = maintenance + fuel', () => {
    const r = computeSpend(
      [
        fuel('f1', 60, jan15_2026),   // 2026 → thisYear
        fuel('f2', 40, null),          // null → lifetime only
      ],
      [
        maint('m1', 150, jan15_2026), // 2026 → thisYear
      ],
      2026
    );

    // thisYear: fuel=$60, maintenance=$150, total=$210
    expect(r.thisYear.fuel).toBeCloseTo(60, 6);
    expect(r.thisYear.maintenance).toBeCloseTo(150, 6);
    expect(r.thisYear.total).toBeCloseTo(210, 6);

    // priorYear: all zeros (no 2025 entries)
    expect(r.priorYear.fuel).toBe(0);
    expect(r.priorYear.maintenance).toBe(0);
    expect(r.priorYear.total).toBe(0);

    // lifetime: fuel=$60+$40=$100; maintenance=$150; total=$250
    expect(r.lifetime.fuel).toBeCloseTo(100, 6);
    expect(r.lifetime.maintenance).toBeCloseTo(150, 6);
    expect(r.lifetime.total).toBeCloseTo(250, 6);
  });
});

// ---------------------------------------------------------------------------
// multi-year — this year / prior year / older all bucketed independently
// ---------------------------------------------------------------------------
describe('computeSpend — multi-year bucketing', () => {
  // Timestamps safely interior to their local years.
  const ts2026 = Timestamp.fromDate(new Date(2026, 5, 1));  // Jun 1, 2026
  const ts2025 = Timestamp.fromDate(new Date(2025, 5, 1));  // Jun 1, 2025
  const ts2024 = Timestamp.fromDate(new Date(2024, 5, 1));  // Jun 1, 2024

  it('older entries (2024) land in lifetime but not this/prior year', () => {
    const r = computeSpend(
      [
        fuel('f1', 30, ts2026), // thisYear
        fuel('f2', 20, ts2025), // priorYear
        fuel('f3', 10, ts2024), // older → lifetime only
      ],
      [
        maint('m1', 100, ts2025), // priorYear
        maint('m2', 50, ts2024),  // older → lifetime only
      ],
      2026
    );

    expect(r.thisYear.fuel).toBeCloseTo(30, 6);
    expect(r.thisYear.maintenance).toBe(0);
    expect(r.thisYear.total).toBeCloseTo(30, 6);

    expect(r.priorYear.fuel).toBeCloseTo(20, 6);
    expect(r.priorYear.maintenance).toBeCloseTo(100, 6);
    expect(r.priorYear.total).toBeCloseTo(120, 6);

    // lifetime = all entries regardless of year
    expect(r.lifetime.fuel).toBeCloseTo(60, 6);        // 30+20+10
    expect(r.lifetime.maintenance).toBeCloseTo(150, 6); // 100+50
    expect(r.lifetime.total).toBeCloseTo(210, 6);       // 60+150
  });
});
