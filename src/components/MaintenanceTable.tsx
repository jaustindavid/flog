// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// MaintenanceTable — per-car list of maintenance entries. Mirrors
// EntriesTable (maintenance-phase-1 §7.5). Newest-service-date first
// (the list arrives ordered by `date` desc from listMaintenanceForCar).
//
// Columns: date / odometer / cost / note. No MPG column — maintenance
// is not part of the fuel-economy stream (PRD §14 intro).
//
// Date formatting mirrors EntriesTable: locale-aware short form, with
// the year appended for cross-year rows so a prior-year service date
// isn't ambiguous. Formats the user-set `date` (not loggedAt).
//
// N2: the table OWNS its empty state ("No maintenance logged yet.") —
// exactly like EntriesTable's "No fill-ups yet." The CarDetailScreen
// section does NOT also render a section-level empty state.
//
// N3: the note cell is width-capped + truncated (max-w + truncate) so a
// long note can't blow out the row on a 375px screen. The horizontal
// overflow wrapper is the belt-and-suspenders for unusually-wide
// odometer/cost values.

import type { KeyboardEvent } from 'react';
import type { Maintenance } from '../maintenance/maintenance';

interface MaintenanceTableProps {
  maintenance: Maintenance[]; // newest-date-first
  // Editability decided by the parent (owner edits any row; a
  // logger-sharee edits only their own), mirroring EntriesTable. When
  // omitted, rows render static.
  canEditMaintenance?: (m: Maintenance) => boolean;
  onEditMaintenance?: (m: Maintenance) => void;
}

const FMT_SAME_YEAR = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});
const FMT_CROSS_YEAR = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatDate(date: Maintenance['date']): string {
  if (date === null) return '—';
  const d = date.toDate();
  const currentYear = new Date().getFullYear();
  return d.getFullYear() === currentYear
    ? FMT_SAME_YEAR.format(d)
    : FMT_CROSS_YEAR.format(d);
}

export function MaintenanceTable({
  maintenance,
  canEditMaintenance,
  onEditMaintenance,
}: MaintenanceTableProps) {
  if (maintenance.length === 0) {
    return <p className="text-sm text-gray-500">No maintenance logged yet.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="text-gray-500 border-b border-gray-200">
            <th className="py-2 px-2 font-medium">Date</th>
            <th className="py-2 px-2 font-medium text-right">Odometer</th>
            <th className="py-2 px-2 font-medium text-right">Cost</th>
            <th className="py-2 px-2 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {maintenance.map((m) => {
            const editable =
              !!onEditMaintenance && (canEditMaintenance?.(m) ?? false);
            const cellPad = editable ? 'py-3 px-2' : 'py-2 px-2';
            const onKeyDown = editable
              ? (e: KeyboardEvent<HTMLTableRowElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEditMaintenance?.(m);
                  }
                }
              : undefined;
            return (
              <tr
                key={m.id}
                className={
                  editable
                    ? 'border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500'
                    : 'border-b border-gray-100 last:border-b-0'
                }
                role={editable ? 'button' : undefined}
                tabIndex={editable ? 0 : undefined}
                aria-label={editable ? 'Edit maintenance' : undefined}
                onClick={editable ? () => onEditMaintenance?.(m) : undefined}
                onKeyDown={onKeyDown}
              >
                <td className={`${cellPad} text-gray-700 whitespace-nowrap`}>
                  {formatDate(m.date)}
                </td>
                <td
                  className={`${cellPad} text-gray-900 text-right tabular-nums`}
                >
                  {m.odometer}
                </td>
                <td
                  className={`${cellPad} text-gray-900 text-right tabular-nums`}
                >
                  ${m.cost.toFixed(2)}
                </td>
                <td
                  className={`${cellPad} text-gray-900 max-w-[8rem] truncate`}
                  title={m.note}
                >
                  {m.note}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
