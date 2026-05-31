// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// computeReminder — pure derived service-reminder status (PRD §14.3,
// maintenance-phase-3 §5.1). No Firestore, no React, NO `new Date()`
// inside: the caller injects `now` and `currentOdometer`, mirroring
// computeSpend's injected-referenceYear discipline. Fully deterministic
// given its inputs; tested in computeReminder.test.ts.
//
// The "last done" baseline is DERIVED here, never stored: the most-
// recent maintenance entry flagged resetsReminder (latest by `date`,
// tiebreak greater `odometer`). No reminder, or no such entry → not
// active → no banner.
//
// Phase 3 is BINARY (due/overdue only). A lead-margin "due soon" state
// is a deferred refinement (PRD §14.3) and is intentionally NOT computed
// here.

import type { MaintenanceReminder } from '../cars/cars';
import { addMonths } from './addMonths';
import type { Maintenance } from './maintenance';

export interface ReminderStatus {
  // Reminder configured AND a baseline (a resetsReminder entry) exists.
  active: boolean;
  // active AND at least one threshold (mileage OR time) crossed.
  due: boolean;
  label: string;
  // currentOdometer - dueOdometer when mileage-due (≥ 0); else null.
  overdueMiles: number | null;
  // whole days past the time-due date when time-due (≥ 0); else null.
  overdueDays: number | null;

  // Projection fields (next-due-display, additive — banner ignores these).
  // baseline.odometer + intervalMiles; null when no mileage interval.
  dueOdometer: number | null;
  // addMonths(baseline.date, intervalMonths); null when no months interval
  // or no baseline date.
  dueDate: Date | null;
  // dueOdometer - currentOdometer (negative = overdue); null when
  // dueOdometer or currentOdometer is null.
  milesRemaining: number | null;
  // Local-calendar-day diff (DST-safe, §5.1 S3): floor both instants to
  // local midnight then divide. Negative = overdue; null when dueDate null.
  daysRemaining: number | null;
}

const MS_PER_DAY = 86_400_000;

// localMidnightMs — floor a Date to local midnight (LOCAL getters, never
// UTC). DST-safe: both operands are floored the same way, so a DST
// transition inside the window shifts both midnights equally and cancels.
function localMidnightMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// localCalendarDayDiff — signed whole-day difference (b − a) in local
// calendar days. Positive = b is in the future; negative = b is in the
// past.
function localCalendarDayDiff(a: Date, b: Date): number {
  return Math.round((localMidnightMs(b) - localMidnightMs(a)) / MS_PER_DAY);
}

// Pick the baseline: the latest-`date` entry with resetsReminder === true,
// tiebroken by greater odometer. Entries with a null date are eligible
// only as a last resort (they can't anchor the time dimension but can
// still anchor mileage); a dated entry always wins over an undated one.
function pickBaseline(maintenance: Maintenance[]): Maintenance | null {
  let best: Maintenance | null = null;
  for (const m of maintenance) {
    if (m.resetsReminder !== true) continue;
    if (best === null) {
      best = m;
      continue;
    }
    const bestMs = best.date ? best.date.toMillis() : -Infinity;
    const curMs = m.date ? m.date.toMillis() : -Infinity;
    if (curMs > bestMs) {
      best = m;
    } else if (curMs === bestMs && m.odometer > best.odometer) {
      best = m;
    }
  }
  return best;
}

export function computeReminder(
  // Maintenance entries for the car (any order — pickBaseline scans).
  maintenance: Maintenance[],
  reminder: MaintenanceReminder | null,
  // Latest/true current mileage = MAX odometer across fuel entries (the
  // caller computes the max; S2). null when the car has no fuel entries
  // — mileage-due then can't fire, but time-due still can.
  currentOdometer: number | null,
  // The current instant, injected by the caller (never read inside).
  now: Date
): ReminderStatus {
  const nullProjection = {
    dueOdometer: null,
    dueDate: null,
    milesRemaining: null,
    daysRemaining: null,
  };

  if (reminder === null) {
    return {
      active: false,
      due: false,
      label: '',
      overdueMiles: null,
      overdueDays: null,
      ...nullProjection,
    };
  }

  const baseline = pickBaseline(maintenance);
  if (baseline === null) {
    return {
      active: false,
      due: false,
      label: reminder.label,
      overdueMiles: null,
      overdueDays: null,
      ...nullProjection,
    };
  }

  // Mileage dimension: needs an interval, a current odometer, and the
  // baseline's odometer. baseline.odometer is always a number (the
  // maintenance type guarantees it). dueOdometer = baseline + interval.
  let overdueMiles: number | null = null;
  let dueOdometer: number | null = null;
  let milesRemaining: number | null = null;
  if (reminder.intervalMiles != null) {
    dueOdometer = baseline.odometer + reminder.intervalMiles;
    if (currentOdometer != null) {
      milesRemaining = dueOdometer - currentOdometer;
      if (currentOdometer >= dueOdometer) {
        overdueMiles = currentOdometer - dueOdometer;
      }
    }
  }

  // Time dimension: needs an interval and a baseline date. addMonths
  // clamps month-end so a Jan-31 baseline yields a valid Feb due date.
  let overdueDays: number | null = null;
  let dueDate: Date | null = null;
  let daysRemaining: number | null = null;
  if (reminder.intervalMonths != null && baseline.date != null) {
    dueDate = addMonths(baseline.date.toDate(), reminder.intervalMonths);
    // DST-safe local-calendar-day diff (S3): floor both to local midnight,
    // divide. A positive result = days until due; negative = overdue by.
    daysRemaining = localCalendarDayDiff(now, dueDate);
    if (now.getTime() >= dueDate.getTime()) {
      // floor absorbs any sub-day DST wobble (both are instants).
      overdueDays = Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY);
    }
  }

  const due = overdueMiles !== null || overdueDays !== null;

  return {
    active: true,
    due,
    label: reminder.label,
    overdueMiles,
    overdueDays,
    dueOdometer,
    dueDate,
    milesRemaining,
    daysRemaining,
  };
}
