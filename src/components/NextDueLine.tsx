// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// NextDueLine — per-car relative countdown for the Cars-list rows
// (next-due-display §5.3). Fetches its own maintenance + fuel data,
// computes via computeReminder, and renders a quiet one-line summary.
//
// Mounting discipline (S1): rendered as a DIRECT stable child of
// CarListItem, which itself has a stable key={car.id} in CarListScreen.
// React preserves the instance across useCars refreshes → no re-mount,
// no re-fetch churn. Do NOT wrap in an identity-varying component or
// give it an unstable key.
//
// Accepted staleness (S2): the one-shot getDocs may resolve from the
// Firestore offline cache and won't re-read until re-mount. This is
// intentional — the list countdown is advisory; the detail screen is
// authoritative. No sync mechanism is built here; see handoff note.
//
// Loading/error → renders nothing (invisible; a soft advisory line
// should never show an error message in a list row). N3.

import type { MaintenanceReminder } from '../cars/cars';
import { useMaintenance } from '../maintenance/useMaintenance';
import { useEntries } from '../entries/useEntries';
import { computeReminder } from '../maintenance/computeReminder';

interface NextDueLineProps {
  carId: string;
  reminder: MaintenanceReminder;
}

// Bare magnitude formatters — NO "overdue" word; the wrapper owns the
// framing ("next … in …" vs "… overdue by …") so the word never doubles.
// Math.abs so an overdue (negative) value reads as a positive magnitude.
function fmtMiles(n: number): string {
  return `${Math.abs(n).toLocaleString()} mi`;
}

function fmtDays(n: number): string {
  const abs = Math.abs(n);
  return `${abs} ${abs === 1 ? 'day' : 'days'}`;
}

export function NextDueLine({ carId, reminder }: NextDueLineProps) {
  const { state: maintState } = useMaintenance(carId);
  const { state: entriesState } = useEntries(carId);

  // Loading or error → silent (N3).
  if (maintState.status !== 'ready' || entriesState.status !== 'ready') {
    return null;
  }

  // Guard empty entries: Math.max() of an empty array is -Infinity (N4).
  const currentOdometer =
    entriesState.entries.length > 0
      ? Math.max(...entriesState.entries.map((e) => e.odometer))
      : null;

  const s = computeReminder(
    maintState.maintenance,
    reminder,
    currentOdometer,
    new Date()
  );

  // No baseline → nothing to show on the list row (detail screen handles
  // the "Log a [label] to start" hint; the list row stays clean).
  if (!s.active) return null;

  const mr = s.milesRemaining;
  const dr = s.daysRemaining;
  const milesOverdue = mr !== null && mr <= 0;
  const daysOverdue = dr !== null && dr <= 0;
  const isOverdue = milesOverdue || daysOverdue;

  // When overdue, frame as "overdue by …" and show ONLY the dimension(s)
  // actually past-due (so we never say "overdue by … 3 days" while days
  // is still in the future). When upcoming, show every present dimension.
  const segments: string[] = [];
  if (isOverdue) {
    if (mr !== null && mr <= 0) segments.push(fmtMiles(mr));
    if (dr !== null && dr <= 0) segments.push(fmtDays(dr));
  } else {
    if (mr !== null) segments.push(fmtMiles(mr));
    if (dr !== null) segments.push(fmtDays(dr));
  }
  if (segments.length === 0) return null;

  const countdown = segments.join(' / ');

  return (
    <span className="block text-xs text-gray-500 mt-1">
      {isOverdue
        ? `${s.label} overdue by ${countdown}`
        : `next ${s.label.toLowerCase()} in ${countdown}`}
    </span>
  );
}
