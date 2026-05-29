// EntriesTable — chronological list of fill-ups on a car. Newest
// first. Per-row MPG computed from each entry paired against the
// entry chronologically prior (i.e., entries[i+1] in newest-first
// order); the oldest row's MPG is "—" because it has no prior.
//
// Decision #5: rows where the per-fill MPG would be negative (M4
// flag-but-accept negative-delta entries) render "—", not the
// negative number. That fall-through happens inside perFillMpg.
//
// Display precision per Decision #8:
//   - Date: locale-aware short form ("May 25"); cross-year entries
//     get the year appended ("May 25, 2025"). Per Decision #9, never
//     relative ("3 days ago"). Implementer call on the exact options.
//   - Odometer: integer ("50300")
//   - Gallons: 2 decimals ("12.30")
//   - Cost: 2 decimals + "$" prefix ("$42.15")
//   - MPG: 1 decimal + " mpg" ("32.4 mpg")
//
// Empty state per Decision #11: "No fill-ups yet." — single line,
// no extra copy. This is a legit context-specific empty state (user
// opened a car they expect fill-ups on; absence is the signal), not
// the milestone-gap placeholder pattern M4 V6 removed.
//
// Mobile-first at 375px: tight padding, smaller font in cells, a
// horizontal overflow wrapper so the table never pushes the page
// out of viewport on the narrowest device. Five short columns fit
// comfortably without the wrap kicking in, but the wrapper is the
// belt-and-suspenders for unusually-wide cost or odometer values.

import type { Entry } from '../entries/entries';
import { perFillMpg } from '../entries/computeMpg';

interface EntriesTableProps {
  entries: Entry[]; // newest-first
}

// Stable across renders; locale defaults pick up the user's browser
// locale (Decision §G3). Cross-year entries get year appended so a
// 2025 entry viewed in 2026 isn't ambiguous.
const FMT_SAME_YEAR = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});
const FMT_CROSS_YEAR = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatDate(loggedAt: Entry['loggedAt']): string {
  if (loggedAt === null) return '—';
  const date = loggedAt.toDate();
  const currentYear = new Date().getFullYear();
  return date.getFullYear() === currentYear
    ? FMT_SAME_YEAR.format(date)
    : FMT_CROSS_YEAR.format(date);
}

export function EntriesTable({ entries }: EntriesTableProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">No fill-ups yet.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="text-gray-500 border-b border-gray-200">
            <th className="py-2 px-2 font-medium">Date</th>
            <th className="py-2 px-2 font-medium text-right">Odometer</th>
            <th className="py-2 px-2 font-medium text-right">Gallons</th>
            <th className="py-2 px-2 font-medium text-right">Cost</th>
            <th className="py-2 px-2 font-medium text-right">MPG</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const prior = entries[i + 1] ?? null;
            const mpg = perFillMpg(entry, prior);
            return (
              <tr
                key={entry.id}
                className="border-b border-gray-100 last:border-b-0"
              >
                <td className="py-2 px-2 text-gray-700 whitespace-nowrap">
                  {formatDate(entry.loggedAt)}
                </td>
                <td className="py-2 px-2 text-gray-900 text-right tabular-nums">
                  {entry.odometer}
                </td>
                <td className="py-2 px-2 text-gray-900 text-right tabular-nums">
                  {entry.gallons.toFixed(2)}
                </td>
                <td className="py-2 px-2 text-gray-900 text-right tabular-nums">
                  ${entry.cost.toFixed(2)}
                </td>
                <td className="py-2 px-2 text-gray-900 text-right tabular-nums">
                  {mpg === null ? '—' : `${mpg.toFixed(1)} mpg`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
