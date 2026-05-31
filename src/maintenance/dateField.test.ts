// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// dateField round-trip tests (maintenance-phase-1 §7.3, SF3).
//
// The load-bearing assertion: a year-boundary date (2026-01-01)
// survives `input → Timestamp → input` UNCHANGED, and it does so under
// a NON-UTC `TZ`. This catches the classic foot-gun where
// `new Date('2026-01-01')` (UTC) or `toISOString().slice(0,10)` (UTC)
// would shift the day back to 2025-12-31 in a negative-offset zone.
//
// The whole suite is run by the repo under a pinned non-UTC TZ
// (see the npm test invocation note in the handoff). The helper is
// tz-correct BY CONSTRUCTION (local components only), so these pass
// regardless of TZ — but the year-boundary case is the canary.

import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  dateInputToTimestamp,
  timestampToDateInput,
  todayDateInput,
} from './dateField';

describe('dateField — input ↔ Timestamp round-trip', () => {
  // The marquee case: Jan 1 at the year boundary. Under UTC-parsing
  // bugs this would come back as 2025-12-31 in US timezones.
  it('round-trips a year-boundary date (2026-01-01) unchanged', () => {
    const ts = dateInputToTimestamp('2026-01-01');
    expect(ts).not.toBeNull();
    expect(timestampToDateInput(ts!)).toBe('2026-01-01');
  });

  it('round-trips a year-END date (2026-12-31) unchanged', () => {
    const ts = dateInputToTimestamp('2026-12-31');
    expect(ts).not.toBeNull();
    expect(timestampToDateInput(ts!)).toBe('2026-12-31');
  });

  it('round-trips a mid-year date unchanged', () => {
    const ts = dateInputToTimestamp('2026-07-15');
    expect(ts).not.toBeNull();
    expect(timestampToDateInput(ts!)).toBe('2026-07-15');
  });

  it('round-trips a leap-day date unchanged', () => {
    const ts = dateInputToTimestamp('2024-02-29');
    expect(ts).not.toBeNull();
    expect(timestampToDateInput(ts!)).toBe('2024-02-29');
  });

  it('builds LOCAL midnight (not UTC midnight) for a year-boundary date', () => {
    // Asserts the Timestamp is local midnight of the requested day:
    // the constructed Date's local components must match exactly,
    // independent of the running TZ.
    const ts = dateInputToTimestamp('2026-01-01')!;
    const d = ts.toDate();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

describe('dateField — malformed / out-of-range input', () => {
  it('returns null for an empty string', () => {
    expect(dateInputToTimestamp('')).toBeNull();
  });

  it('returns null for a non-date string', () => {
    expect(dateInputToTimestamp('not-a-date')).toBeNull();
  });

  it('returns null for a partial date', () => {
    expect(dateInputToTimestamp('2026-01')).toBeNull();
  });

  it('returns null for a 0 month', () => {
    expect(dateInputToTimestamp('2026-00-10')).toBeNull();
  });

  it('returns null for a 13 month', () => {
    expect(dateInputToTimestamp('2026-13-10')).toBeNull();
  });

  it('returns null for an impossible day (Feb 31)', () => {
    expect(dateInputToTimestamp('2026-02-31')).toBeNull();
  });

  it('returns null for Feb 29 on a non-leap year', () => {
    expect(dateInputToTimestamp('2026-02-29')).toBeNull();
  });
});

describe('dateField — todayDateInput', () => {
  it('formats today via local getters as YYYY-MM-DD', () => {
    const now = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    const expected = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}`;
    expect(todayDateInput()).toBe(expected);
  });

  it('todayDateInput round-trips back to a Timestamp and home', () => {
    const s = todayDateInput();
    const ts = dateInputToTimestamp(s);
    expect(ts).not.toBeNull();
    expect(timestampToDateInput(ts!)).toBe(s);
  });
});

describe('dateField — timestampToDateInput uses local components', () => {
  it('formats a known local-midnight Timestamp correctly', () => {
    const ts = Timestamp.fromDate(new Date(2026, 0, 1)); // local Jan 1
    expect(timestampToDateInput(ts)).toBe('2026-01-01');
  });
});
