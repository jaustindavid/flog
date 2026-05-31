// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// addMonths — add N calendar months to a Date, clamping to the target
// month's last valid day (S3, maintenance-phase-3 §5.1).
//
// Why a bespoke helper rather than `new Date(y, mo + n, d)`: JS-native
// month arithmetic OVERFLOWS — Jan 31 + 1 month asks for "Feb 31",
// which the Date constructor silently rolls forward to Mar 2/3. For a
// service-reminder DUE date that is wrong: an oil change done Jan 31
// with a 1-month interval is due end of February, not early March.
//
// This differs deliberately from dateField.ts: dateField REJECTS an
// overflowing user *input* (returns null) because a typo'd "2026-02-31"
// is a bad value. addMonths must instead PRODUCE a usable due date, so
// it CLAMPS — Jan 31 + 1mo → Feb 28 (or Feb 29 in a leap year).
//
// LOCAL components only (consistent with dateField / computeSpend): the
// result preserves the source's local time-of-day and is built from
// getFullYear/getMonth/getDate, never UTC parsing. `n` is a whole
// number of months (the config form enforces integer-ness; callers pass
// reminder.intervalMonths).

export function addMonths(date: Date, n: number): Date {
  const y = date.getFullYear();
  const mo = date.getMonth();
  const d = date.getDate();

  // Last day of the TARGET month: day 0 of the following month rolls
  // back to the last day of the target month (handles 28/29/30/31 and
  // leap years without a table). Built with local components.
  const lastDayOfTargetMonth = new Date(y, mo + n + 1, 0).getDate();
  const clampedDay = Math.min(d, lastDayOfTargetMonth);

  return new Date(
    y,
    mo + n,
    clampedDay,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
}
