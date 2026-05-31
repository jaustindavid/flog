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
  loggedAt: Timestamp | null,
  odometer = 0
): Entry {
  return {
    id,
    loggedByUid: 'uid',
    odometer,
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

// ---------------------------------------------------------------------------
// fuelMiles — empty inputs → all-zero miles
// ---------------------------------------------------------------------------
describe('computeSpend fuelMiles — empty inputs', () => {
  it('returns zero fuelMiles when fuel array is empty', () => {
    const r = computeSpend([], [], 2026);
    expect(r.fuelMiles).toEqual({ thisYear: 0, priorYear: 0, lifetime: 0 });
  });

  it('returns zero fuelMiles for a single entry (no prior)', () => {
    const ts = Timestamp.fromDate(new Date(2026, 0, 15));
    const r = computeSpend([fuel('f1', 40, ts, 50000)], [], 2026);
    expect(r.fuelMiles).toEqual({ thisYear: 0, priorYear: 0, lifetime: 0 });
  });
});

// ---------------------------------------------------------------------------
// fuelMiles — cross-window (deltas bucket to the correct year)
//
// Three entries newest-first:
//   f1: odo 52000, loggedAt = Jun 1, 2026  → delta vs f2 = 2000 → thisYear
//   f2: odo 50000, loggedAt = Jun 1, 2025  → delta vs f3 = 1500 → priorYear
//   f3: odo 48500, loggedAt = Jun 1, 2024  → oldest, no prior → 0
//
// Lifetime = 2000 + 1500 = 3500.
// ---------------------------------------------------------------------------
describe('computeSpend fuelMiles — cross-window bucketing', () => {
  const ts2026 = Timestamp.fromDate(new Date(2026, 5, 1));
  const ts2025 = Timestamp.fromDate(new Date(2025, 5, 1));
  const ts2024 = Timestamp.fromDate(new Date(2024, 5, 1));

  it('buckets deltas by the newer fill\'s local year', () => {
    const r = computeSpend(
      [
        fuel('f1', 30, ts2026, 52000),
        fuel('f2', 20, ts2025, 50000),
        fuel('f3', 10, ts2024, 48500),
      ],
      [],
      2026
    );
    expect(r.fuelMiles.thisYear).toBe(2000);    // f1−f2
    expect(r.fuelMiles.priorYear).toBe(1500);   // f2−f3
    expect(r.fuelMiles.lifetime).toBe(3500);    // 2000+1500
  });
});

// ---------------------------------------------------------------------------
// fuelMiles — gap delta INCLUDED (AC-T: the gap case)
//
// A missed fill means one delta spans two tanks but is the real distance
// driven. The test asserts the big delta is INCLUDED, not excluded.
//
// Entries newest-first:
//   f1: odo 60000, Jun 2026 → delta vs f2 = 500  → normal fill
//   f2: odo 59500, Jun 2026 → delta vs f3 = 3000 → gap (missed fill)
//   f3: odo 56500, Jun 2026 → oldest, no prior → 0
//
// Lifetime = 500 + 3000 = 3500. The gap delta 3000 must be included.
// ---------------------------------------------------------------------------
describe('computeSpend fuelMiles — gap delta INCLUDED', () => {
  const ts2026 = Timestamp.fromDate(new Date(2026, 5, 15));

  it('includes the large gap delta in the total (not excluded)', () => {
    const r = computeSpend(
      [
        fuel('f1', 40, ts2026, 60000),
        fuel('f2', 40, ts2026, 59500),
        fuel('f3', 40, ts2026, 56500),
      ],
      [],
      2026
    );
    // Gap delta (f2−f3 = 3000) must be INCLUDED.
    expect(r.fuelMiles.thisYear).toBe(3500);   // 500 + 3000
    expect(r.fuelMiles.lifetime).toBe(3500);
  });
});

// ---------------------------------------------------------------------------
// fuelMiles — null loggedAt → lifetime only, not this/prior year
// ---------------------------------------------------------------------------
describe('computeSpend fuelMiles — null loggedAt on newer entry', () => {
  it('counts the delta in lifetime only when newer entry has null loggedAt', () => {
    // f1 (null loggedAt, odo 51000) is newer, f2 (2026 ts, odo 50000) is prior.
    // delta = 1000, bucketed by f1.loggedAt = null → lifetime only.
    const ts2026 = Timestamp.fromDate(new Date(2026, 3, 1));
    const r = computeSpend(
      [
        fuel('f1', 40, null, 51000),
        fuel('f2', 40, ts2026, 50000),
      ],
      [],
      2026
    );
    expect(r.fuelMiles.lifetime).toBe(1000);
    expect(r.fuelMiles.thisYear).toBe(0);
    expect(r.fuelMiles.priorYear).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// fuelMiles — year-boundary (MEANINGFUL test, AC-T)
//
// Fixture: Dec 31, 2025 at 23:00 LOCAL (America/New_York, UTC-5 in winter).
//   new Date(2025, 11, 31, 23, 0) → local 2025-12-31T23:00 in NY
//   UTC equivalent                → 2026-01-01T04:00Z
//
//   LOCAL  getFullYear() → 2025  (correct — fill is in 2025)
//   UTC   toISOString()  → "2026-01-01T04:00:00.000Z" → year 2026 (WRONG)
//
// Two entries newest-first:
//   f1: odo 52000, loggedAt = Dec 31 2025 23:00 LOCAL
//   f2: odo 50000, loggedAt = some 2025 date (oldest, no prior)
//
// delta = 2000, bucketed by f1.loggedAt LOCAL year = 2025 = priorYear.
// A toISOString/UTC bucketer would put the 2000 mi in thisYear (2026).
// ---------------------------------------------------------------------------
describe('computeSpend fuelMiles — year-boundary (Dec-31 local ≠ UTC year)', () => {
  // Dec 31, 2025 at 23:00 LOCAL (NY, UTC-5) = 2026-01-01T04:00Z.
  // Local year: 2025. UTC year: 2026.
  const dec31LocalTs = Timestamp.fromDate(new Date(2025, 11, 31, 23, 0));
  const midDec2025Ts = Timestamp.fromDate(new Date(2025, 11, 1, 12, 0));

  it('Dec-31 23:00 local fill → distance buckets to priorYear (2025)', () => {
    const r = computeSpend(
      [
        fuel('f1', 50, dec31LocalTs, 52000),  // local 2025 → priorYear
        fuel('f2', 50, midDec2025Ts, 50000),  // oldest, no prior → 0
      ],
      [],
      2026 // referenceYear; priorYear = 2025
    );
    // Correct local-year bucketer: 2000 mi → priorYear (2025).
    expect(r.fuelMiles.priorYear).toBe(2000);
    expect(r.fuelMiles.thisYear).toBe(0);
    expect(r.fuelMiles.lifetime).toBe(2000);
    // A toISOString/UTC bucketer would put 2000 mi in thisYear — this
    // assertion would fail under that implementation.
  });
});
