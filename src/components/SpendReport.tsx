// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// SpendReport — renders the per-car 3×3 spend table (PRD §14.4).
//
// Rows: Maintenance / Fuel / Total.
// Columns: This year / Prior year (headline) / Lifetime.
//
// Prior year is the headline column — visually emphasized — because
// it's the tax-filing number. Column labels are derived from the
// injected referenceYear so they're never hard-coded.
//
// Currency format mirrors EntriesTable: `$${n.toFixed(2)}`. No shared
// formatter — that's expected per dispatch brief.
//
// Pure presentational: no data fetching, no side effects.

import type { SpendReport as SpendReportData } from '../maintenance/computeSpend';

interface SpendReportProps {
  report: SpendReportData;
  referenceYear: number;
}

function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function SpendReport({ report, referenceYear }: SpendReportProps) {
  const priorYearNum = referenceYear - 1;

  const rows: Array<{
    label: string;
    thisYear: number;
    priorYear: number;
    lifetime: number;
  }> = [
    {
      label: 'Maintenance',
      thisYear: report.thisYear.maintenance,
      priorYear: report.priorYear.maintenance,
      lifetime: report.lifetime.maintenance,
    },
    {
      label: 'Fuel',
      thisYear: report.thisYear.fuel,
      priorYear: report.priorYear.fuel,
      lifetime: report.lifetime.fuel,
    },
    {
      label: 'Total',
      thisYear: report.thisYear.total,
      priorYear: report.priorYear.total,
      lifetime: report.lifetime.total,
    },
  ];

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="text-gray-500 border-b border-gray-200">
            <th className="py-2 px-2 font-medium" />
            <th className="py-2 px-2 font-medium text-right">
              {String(referenceYear)}
            </th>
            {/* Prior year is the headline — bold + slightly wider tap area */}
            <th className="py-2 px-2 font-semibold text-right text-gray-800">
              {String(priorYearNum)}
            </th>
            <th className="py-2 px-2 font-medium text-right">Lifetime</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isTotal = i === rows.length - 1;
            const rowBase = isTotal
              ? 'border-t border-gray-200 font-semibold'
              : 'border-b border-gray-100 last:border-b-0';
            return (
              <tr key={row.label} className={rowBase}>
                <td className="py-2 px-2 text-gray-600">{row.label}</td>
                <td className="py-2 px-2 text-gray-700 text-right tabular-nums">
                  {fmt(row.thisYear)}
                </td>
                {/* Prior year: headline emphasis */}
                <td className="py-2 px-2 text-gray-900 font-semibold text-right tabular-nums">
                  {fmt(row.priorYear)}
                </td>
                <td className="py-2 px-2 text-gray-700 text-right tabular-nums">
                  {fmt(row.lifetime)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
