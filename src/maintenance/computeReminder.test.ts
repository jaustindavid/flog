// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// computeReminder tests (maintenance-phase-3 §5.1 / §7 AC-C). Covers:
// inactive (no reminder / no baseline), mileage-due, time-due,
// whichever-first, overage values, baseline selection (latest date,
// odometer tiebreak), null currentOdometer (time can still fire), and a
// null baseline date (mileage can still fire). Runs under the pinned
// TZ=America/New_York; computeReminder is pure (injected now + odometer)
// so it never reads the clock.

import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import type { MaintenanceReminder } from '../cars/cars';
import { computeReminder } from './computeReminder';
import type { Maintenance } from './maintenance';

// Build a maintenance entry; only fields computeReminder reads matter.
function maint(
  id: string,
  odometer: number,
  date: Timestamp | null,
  resetsReminder: boolean
): Maintenance {
  return {
    id,
    loggedByUid: 'uid',
    date,
    odometer,
    cost: 0,
    note: '',
    resetsReminder,
    loggedAt: null,
  };
}

// Local-component Timestamp (matches dateField's local-midnight convention).
function dateTs(y: number, mo: number, d: number): Timestamp {
  return Timestamp.fromDate(new Date(y, mo, d));
}

const milesAndMonths: MaintenanceReminder = {
  label: 'Oil change',
  intervalMiles: 3000,
  intervalMonths: 3,
};
const milesOnly: MaintenanceReminder = {
  label: 'Tire rotation',
  intervalMiles: 5000,
  intervalMonths: null,
};
const monthsOnly: MaintenanceReminder = {
  label: 'Inspection',
  intervalMiles: null,
  intervalMonths: 12,
};

describe('computeReminder — inactive', () => {
  it('null reminder → inactive, not due', () => {
    const s = computeReminder([], null, 10000, new Date(2026, 5, 1));
    expect(s.active).toBe(false);
    expect(s.due).toBe(false);
  });

  it('reminder set but NO baseline entry → inactive', () => {
    // An entry exists but resetsReminder is false → no baseline.
    const ms = [maint('m1', 6000, dateTs(2026, 0, 1), false)];
    const s = computeReminder(ms, milesAndMonths, 10000, new Date(2026, 5, 1));
    expect(s.active).toBe(false);
    expect(s.due).toBe(false);
    expect(s.label).toBe('Oil change');
  });

  it('active but well within both intervals → not due', () => {
    const ms = [maint('m1', 6000, dateTs(2026, 4, 1), true)];
    // +1500 mi, +1 month — under 3000mi / 3mo.
    const s = computeReminder(ms, milesAndMonths, 7500, new Date(2026, 5, 1));
    expect(s.active).toBe(true);
    expect(s.due).toBe(false);
    expect(s.overdueMiles).toBeNull();
    expect(s.overdueDays).toBeNull();
  });
});

describe('computeReminder — mileage-due', () => {
  it('fires when odometer >= baseline + intervalMiles', () => {
    // Worked example (brief §1): oil changed at 6001, 3000mi interval →
    // due at 9001. currentOdometer 9001 → due, overdue 0.
    const ms = [maint('m1', 6001, dateTs(2026, 4, 1), true)];
    const s = computeReminder(ms, milesOnly, 6001 + 5000, new Date(2026, 4, 2));
    expect(s.active).toBe(true);
    expect(s.due).toBe(true);
    expect(s.overdueMiles).toBe(0);
    expect(s.overdueDays).toBeNull();
  });

  it('reports positive overdueMiles past the threshold', () => {
    const ms = [maint('m1', 6000, dateTs(2026, 4, 1), true)];
    // due at 11000; current 11250 → overdue 250.
    const s = computeReminder(ms, milesOnly, 11250, new Date(2026, 4, 2));
    expect(s.overdueMiles).toBe(250);
  });

  it('not due one mile short of the threshold', () => {
    const ms = [maint('m1', 6000, dateTs(2026, 4, 1), true)];
    const s = computeReminder(ms, milesOnly, 10999, new Date(2026, 4, 2));
    expect(s.due).toBe(false);
    expect(s.overdueMiles).toBeNull();
  });

  it('null currentOdometer → mileage dimension cannot fire', () => {
    const ms = [maint('m1', 6000, dateTs(2026, 4, 1), true)];
    const s = computeReminder(ms, milesOnly, null, new Date(2030, 0, 1));
    expect(s.active).toBe(true);
    expect(s.due).toBe(false); // miles-only reminder, no odometer
    expect(s.overdueMiles).toBeNull();
  });
});

describe('computeReminder — time-due', () => {
  it('fires when now >= addMonths(baseline.date, intervalMonths)', () => {
    // Baseline Jan 15 2025, 12mo → due Jan 15 2026. now = Jan 15 2026.
    const ms = [maint('m1', 6000, dateTs(2025, 0, 15), true)];
    const s = computeReminder(ms, monthsOnly, 6500, new Date(2026, 0, 15));
    expect(s.due).toBe(true);
    expect(s.overdueDays).toBe(0);
    expect(s.overdueMiles).toBeNull();
  });

  it('reports whole days overdue', () => {
    const ms = [maint('m1', 6000, dateTs(2025, 0, 15), true)];
    // due Jan 15 2026; now Jan 25 2026 → 10 days overdue.
    const s = computeReminder(ms, monthsOnly, 6500, new Date(2026, 0, 25));
    expect(s.overdueDays).toBe(10);
  });

  it('not due the day before the due date', () => {
    const ms = [maint('m1', 6000, dateTs(2025, 0, 15), true)];
    const s = computeReminder(ms, monthsOnly, 6500, new Date(2026, 0, 14));
    expect(s.due).toBe(false);
    expect(s.overdueDays).toBeNull();
  });

  it('month-end clamp: baseline Jan 31 + 1mo due Feb 28 (non-leap)', () => {
    const ms = [maint('m1', 6000, dateTs(2026, 0, 31), true)];
    const reminder: MaintenanceReminder = {
      label: 'X',
      intervalMiles: null,
      intervalMonths: 1,
    };
    // Feb 28 2026 → due; Feb 27 → not due.
    expect(
      computeReminder(ms, reminder, null, new Date(2026, 1, 28)).due
    ).toBe(true);
    expect(
      computeReminder(ms, reminder, null, new Date(2026, 1, 27)).due
    ).toBe(false);
  });

  it('null baseline date → time dimension cannot fire', () => {
    const ms = [maint('m1', 6000, null, true)];
    const s = computeReminder(ms, monthsOnly, 6500, new Date(2030, 0, 1));
    expect(s.active).toBe(true);
    expect(s.due).toBe(false);
    expect(s.overdueDays).toBeNull();
  });

  it('null baseline date still allows mileage to fire (both-interval)', () => {
    const ms = [maint('m1', 6000, null, true)];
    // miles+months reminder; no date but odometer crosses → due on miles.
    const s = computeReminder(ms, milesAndMonths, 9500, new Date(2026, 5, 1));
    expect(s.due).toBe(true);
    expect(s.overdueMiles).toBe(500);
    expect(s.overdueDays).toBeNull();
  });
});

describe('computeReminder — whichever-first', () => {
  it('due when ONLY the time threshold is crossed', () => {
    // +3 months but under 3000mi.
    const ms = [maint('m1', 6000, dateTs(2026, 0, 1), true)];
    const s = computeReminder(ms, milesAndMonths, 7000, new Date(2026, 3, 1));
    expect(s.due).toBe(true);
    expect(s.overdueDays).not.toBeNull();
    expect(s.overdueMiles).toBeNull();
  });

  it('due when ONLY the mileage threshold is crossed', () => {
    // +3000mi but under 3 months.
    const ms = [maint('m1', 6000, dateTs(2026, 0, 1), true)];
    const s = computeReminder(ms, milesAndMonths, 9200, new Date(2026, 1, 1));
    expect(s.due).toBe(true);
    expect(s.overdueMiles).toBe(200);
    expect(s.overdueDays).toBeNull();
  });

  it('reports BOTH overages when both thresholds crossed', () => {
    const ms = [maint('m1', 6000, dateTs(2025, 0, 1), true)];
    const s = computeReminder(ms, milesAndMonths, 9500, new Date(2026, 0, 1));
    expect(s.overdueMiles).toBe(500);
    expect(s.overdueDays).not.toBeNull();
  });
});

describe('computeReminder — baseline selection', () => {
  it('picks the latest-date resetsReminder entry as baseline', () => {
    const ms = [
      maint('old', 6000, dateTs(2025, 0, 1), true),
      maint('new', 9000, dateTs(2026, 0, 1), true), // newer → baseline
      maint('noreset', 12000, dateTs(2026, 5, 1), false),
    ];
    // Baseline odo 9000 + 3000 = 12000 due. current 12100 → overdue 100.
    const s = computeReminder(ms, milesAndMonths, 12100, new Date(2026, 0, 2));
    expect(s.overdueMiles).toBe(100);
  });

  it('tiebreaks equal dates by greater odometer', () => {
    const ms = [
      maint('a', 8000, dateTs(2026, 0, 1), true),
      maint('b', 9000, dateTs(2026, 0, 1), true), // same date, higher odo
    ];
    // Baseline odo 9000 + 3000 = 12000. current 12000 → overdue 0.
    const s = computeReminder(ms, milesAndMonths, 12000, new Date(2026, 0, 2));
    expect(s.overdueMiles).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Projection fields: dueOdometer / dueDate / milesRemaining / daysRemaining
// ---------------------------------------------------------------------------

describe('computeReminder — projection: dueOdometer / milesRemaining', () => {
  it('both-intervals: dueOdometer = baseline + intervalMiles', () => {
    const ms = [maint('m1', 6000, dateTs(2026, 0, 1), true)];
    // baseline 6000 + 3000 mi interval → dueOdometer 9000
    const s = computeReminder(ms, milesAndMonths, 7500, new Date(2026, 1, 1));
    expect(s.dueOdometer).toBe(9000);
  });

  it('both-intervals: milesRemaining = dueOdometer - currentOdometer', () => {
    const ms = [maint('m1', 6000, dateTs(2026, 0, 1), true)];
    // 9000 - 7500 = 1500 remaining
    const s = computeReminder(ms, milesAndMonths, 7500, new Date(2026, 1, 1));
    expect(s.milesRemaining).toBe(1500);
  });

  it('miles-only: dueOdometer set, dueDate null', () => {
    const ms = [maint('m1', 5000, dateTs(2026, 0, 1), true)];
    const s = computeReminder(ms, milesOnly, 6000, new Date(2026, 1, 1));
    expect(s.dueOdometer).toBe(10000);
    expect(s.dueDate).toBeNull();
    expect(s.milesRemaining).toBe(4000);
    expect(s.daysRemaining).toBeNull();
  });

  it('months-only: dueOdometer null, milesRemaining null', () => {
    const ms = [maint('m1', 6000, dateTs(2025, 0, 15), true)];
    const s = computeReminder(ms, monthsOnly, 6500, new Date(2025, 6, 1));
    expect(s.dueOdometer).toBeNull();
    expect(s.milesRemaining).toBeNull();
  });

  it('overdue: milesRemaining is negative', () => {
    const ms = [maint('m1', 6000, dateTs(2026, 0, 1), true)];
    // due at 11000; current 11250 → -250
    const s = computeReminder(ms, milesOnly, 11250, new Date(2026, 1, 1));
    expect(s.milesRemaining).toBe(-250);
    expect(s.overdueMiles).toBe(250); // legacy field still correct
  });

  it('exactly at threshold: milesRemaining == 0 (S4 boundary)', () => {
    const ms = [maint('m1', 6000, dateTs(2026, 0, 1), true)];
    // due at 11000; current 11000 → 0
    const s = computeReminder(ms, milesOnly, 11000, new Date(2026, 1, 1));
    expect(s.milesRemaining).toBe(0);
    expect(s.overdueMiles).toBe(0);
    expect(s.due).toBe(true);
  });

  it('null currentOdometer: milesRemaining null, dueOdometer still set', () => {
    const ms = [maint('m1', 6000, dateTs(2026, 0, 1), true)];
    const s = computeReminder(ms, milesOnly, null, new Date(2026, 1, 1));
    expect(s.dueOdometer).toBe(11000);
    expect(s.milesRemaining).toBeNull();
  });

  it('no baseline: all projection fields null', () => {
    const ms = [maint('m1', 6000, dateTs(2026, 0, 1), false)];
    const s = computeReminder(ms, milesAndMonths, 10000, new Date(2026, 5, 1));
    expect(s.active).toBe(false);
    expect(s.dueOdometer).toBeNull();
    expect(s.dueDate).toBeNull();
    expect(s.milesRemaining).toBeNull();
    expect(s.daysRemaining).toBeNull();
  });
});

describe('computeReminder — projection: dueDate / daysRemaining', () => {
  it('not-yet-due: daysRemaining is positive', () => {
    // Baseline Jan 15 2026, 3mo → due Apr 15 2026. now = Mar 1 2026 → 45d
    const reminder3mo: MaintenanceReminder = {
      label: 'Inspection',
      intervalMiles: null,
      intervalMonths: 3,
    };
    const ms = [maint('m1', 6000, dateTs(2026, 0, 15), true)];
    const s = computeReminder(ms, reminder3mo, 6500, new Date(2026, 2, 1));
    // Mar 1 → Apr 15: 31 (Mar) - 1 + 15 = 45 days
    expect(s.daysRemaining).toBe(45);
    expect(s.dueDate).not.toBeNull();
  });

  it('overdue: daysRemaining is negative', () => {
    // due Jan 15 2026; now Jan 25 2026 → -10
    const ms = [maint('m1', 6000, dateTs(2025, 0, 15), true)];
    const s = computeReminder(ms, monthsOnly, 6500, new Date(2026, 0, 25));
    expect(s.daysRemaining).toBe(-10);
    expect(s.overdueDays).toBe(10); // legacy field still correct
  });

  it('exactly at threshold: daysRemaining == 0 (S4 boundary)', () => {
    // Baseline Jan 15 2025, 12mo → due Jan 15 2026. now = Jan 15 2026
    const ms = [maint('m1', 6000, dateTs(2025, 0, 15), true)];
    const s = computeReminder(ms, monthsOnly, 6500, new Date(2026, 0, 15));
    expect(s.daysRemaining).toBe(0);
    expect(s.overdueDays).toBe(0);
    expect(s.due).toBe(true);
  });

  it('null baseline date: dueDate null, daysRemaining null', () => {
    const ms = [maint('m1', 6000, null, true)];
    const s = computeReminder(ms, monthsOnly, 6500, new Date(2026, 5, 1));
    expect(s.dueDate).toBeNull();
    expect(s.daysRemaining).toBeNull();
  });

  // S3 — DST-safe daysRemaining under TZ=America/New_York.
  // Spring-forward: 2026-03-08 02:00 clocks jump to 03:00 (23h day).
  // Baseline: Jan 1 2026 with 3mo interval → due Apr 1 2026 (local midnight).
  // now = Mar 1 2026 (local midnight). Calendar diff = 31 days remaining.
  // A naive ms-division would read 30d on a spring-forward day inside the
  // window because the 23h day makes the window 1h short; localMidnightMs
  // floors both to local midnight so the DST shift cancels.
  it('DST-safe: daysRemaining correct across spring-forward (S3)', () => {
    // Spring-forward: 2026-03-08 02:00 NY clocks jump to 03:00 (23h day).
    // Baseline Jan 1 2026; 3mo → due Apr 1 2026 (local midnight NY).
    // now = Mar 1 2026 00:00 NY. Calendar days remaining = 31.
    // Naive ms-division on the 23h spring-forward day gives wrong result;
    // local-midnight flooring is DST-immune.
    const reminder3mo: MaintenanceReminder = {
      label: 'Inspection',
      intervalMiles: null,
      intervalMonths: 3,
    };
    const ms = [maint('m1', 6000, dateTs(2026, 0, 1), true)];
    const s = computeReminder(
      ms,
      reminder3mo,
      6500,
      new Date(2026, 2, 1) // Mar 1 2026 local midnight
    );
    // dueDate is Apr 1 2026 local midnight; Mar 1 → Apr 1 = 31 calendar days
    expect(s.daysRemaining).toBe(31);
  });

  // Fall-back: 2025-11-02 02:00 clocks fall back to 01:00 (25h day).
  // Baseline: Aug 1 2025 with 12mo interval → due Aug 1 2026.
  // now = Nov 1 2025 (before fall-back). Calendar diff = 273 days remaining.
  // Naive ms-division would give 273 + rounding error on the 25h day;
  // local-midnight diff is exact.
  it('DST-safe: daysRemaining correct across fall-back (S3)', () => {
    // Baseline Aug 1 2025; 12mo → due Aug 1 2026 local midnight.
    // now = Nov 1 2025 00:00 NY. Calendar days Aug1→Nov1 = 92 elapsed;
    // Nov1→Aug1 2026 = 273 remaining.
    const ms = [maint('m1', 6000, dateTs(2025, 7, 1), true)];
    const s = computeReminder(
      ms,
      monthsOnly,
      6500,
      new Date(2025, 10, 1) // Nov 1 2025 local midnight
    );
    // Aug 1 2026 - Nov 1 2025 = 273 calendar days
    expect(s.daysRemaining).toBe(273);
  });
});
