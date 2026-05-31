// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// addMonths tests (maintenance-phase-3 §5.1, S3 — the month-end clamp).
//
// The load-bearing cases are the overflow rollovers: Jan 31 + 1mo must
// land on Feb 28/29 (NOT Mar 2/3, NOT null), and a year-boundary add
// (Dec + 1mo) must roll into the next January. These run under the
// pinned TZ=America/New_York (npm test) — addMonths uses LOCAL
// components by construction, so the assertions hold under any offset,
// but the non-UTC runner is what makes a local-vs-UTC regression bite.

import { describe, expect, it } from 'vitest';
import { addMonths } from './addMonths';

// Helper: assert the local Y/M/D of a Date (months 0-indexed here, as in
// the Date API). Avoids toISOString (UTC) which would defeat the point.
function ymd(d: Date): [number, number, number] {
  return [d.getFullYear(), d.getMonth(), d.getDate()];
}

describe('addMonths — month-end clamp (S3)', () => {
  it('Jan 31 + 1mo clamps to Feb 28 in a NON-leap year (2026)', () => {
    expect(ymd(addMonths(new Date(2026, 0, 31), 1))).toEqual([2026, 1, 28]);
  });

  it('Jan 31 + 1mo clamps to Feb 29 in a LEAP year (2028)', () => {
    expect(ymd(addMonths(new Date(2028, 0, 31), 1))).toEqual([2028, 1, 29]);
  });

  it('Jan 31 + 1mo does NOT overflow to March (the native-Date bug)', () => {
    const result = addMonths(new Date(2026, 0, 31), 1);
    expect(result.getMonth()).toBe(1); // February, not March (2)
  });

  it('Mar 31 + 1mo clamps to Apr 30 (30-day month)', () => {
    expect(ymd(addMonths(new Date(2026, 2, 31), 1))).toEqual([2026, 3, 30]);
  });
});

describe('addMonths — year boundary', () => {
  it('Dec 15 + 1mo rolls into next January', () => {
    expect(ymd(addMonths(new Date(2025, 11, 15), 1))).toEqual([2026, 0, 15]);
  });

  it('Dec 31 + 1mo rolls into Jan 31 of next year', () => {
    expect(ymd(addMonths(new Date(2025, 11, 31), 1))).toEqual([2026, 0, 31]);
  });

  it('Nov 30 + 3mo lands on Feb 28 next year (clamp + boundary)', () => {
    expect(ymd(addMonths(new Date(2025, 10, 30), 3))).toEqual([2026, 1, 28]);
  });
});

describe('addMonths — non-clamping cases', () => {
  it('Jun 15 + 3mo → Sep 15 (no clamp needed)', () => {
    expect(ymd(addMonths(new Date(2026, 5, 15), 3))).toEqual([2026, 8, 15]);
  });

  it('Jan 15 + 12mo → Jan 15 next year', () => {
    expect(ymd(addMonths(new Date(2026, 0, 15), 12))).toEqual([2027, 0, 15]);
  });

  it('preserves local time-of-day', () => {
    const result = addMonths(new Date(2026, 0, 15, 14, 30, 0), 1);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });
});
