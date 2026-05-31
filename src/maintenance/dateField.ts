// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// dateField — the LOCAL-midnight bridge between an
// `<input type="date">` value (a `YYYY-MM-DD` string the browser
// interprets in the user's local calendar) and a Firestore
// `Timestamp`. (maintenance-phase-1 §7.3, SF3 — load-bearing.)
//
// The trap this module exists to avoid: `new Date('2026-01-01')`
// parses the string as **UTC** midnight. In any US timezone that
// instant renders back as the PREVIOUS calendar day, and a Jan-1 /
// Dec-31 service date can bucket into the wrong calendar year (Phase 2
// reports by the calendar year of `date` — PRD §14.4). The fix is to
// never let the string touch UTC parsing or formatting:
//
//   - input → Timestamp: build the Date from explicit LOCAL components
//     `new Date(y, mo - 1, d)` — local midnight on that calendar day.
//   - Timestamp → input: format via LOCAL getters
//     (getFullYear / getMonth / getDate) — NEVER
//     `toISOString().slice(0, 10)`, which is UTC and reintroduces the
//     off-by-one-day bug.
//
// Because both directions use only local components, the round-trip is
// stable under ANY `TZ` (the unit test asserts a year-boundary date
// survives under a non-UTC `TZ`).

import { Timestamp } from 'firebase/firestore';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// `YYYY-MM-DD` → local-midnight Timestamp. Returns null for an empty
// or malformed string so callers can treat "no date" as invalid
// (the modal disables Save until the field parses).
export function dateInputToTimestamp(raw: string): Timestamp | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (m === null) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Reject out-of-range month/day up front; the Date constructor would
  // otherwise silently roll over (e.g. month 13 → next year).
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  // Guard against rollover (e.g. 2026-02-31 → Mar 3): the constructed
  // Date must echo the same local components back.
  if (
    date.getFullYear() !== y
    || date.getMonth() !== mo - 1
    || date.getDate() !== d
  ) {
    return null;
  }
  return Timestamp.fromDate(date);
}

// Timestamp → `YYYY-MM-DD`, using LOCAL getters. Used to pre-fill the
// date input in edit mode. Never toISOString().
export function timestampToDateInput(ts: Timestamp): string {
  const date = ts.toDate();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

// Today's date as a `YYYY-MM-DD` string in local time — the create-mode
// default for the date input. Local getters, never toISOString().
export function todayDateInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`;
}
