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
// Fuel row shows cost on the first line and distance on the second
// (a literal line break, not a "/" — so the compact "4.6k mi" unit
// can't wrap mid-token in a narrow column). Maintenance + Total rows
// unchanged. Distance format is compact: sub-1k rounds to nearest whole
// mile; 1k+ shows one decimal place + "k".
//
// Currency format mirrors EntriesTable: `$${n.toFixed(2)}`. No shared
// formatter — that's expected per dispatch brief.
//
// Pure presentational: no data fetching, no side effects.

import type { ReactNode } from 'react';
import type { SpendReport as SpendReportData } from '../maintenance/computeSpend';

interface SpendReportProps {
  report: SpendReportData;
  referenceYear: number;
}

function fmtCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Compact mile formatter: e.g. 0 → "0 mi", 750 → "750 mi", 3400 → "3.4k mi" */
function fmtMiles(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k mi`;
  }
  return `${Math.round(n)} mi`;
}

/**
 * Fuel cell: cost on the first line, distance on the second (line break,
 * not "/"). `whitespace-nowrap` on the miles keeps "4.6k mi" from
 * breaking between the number and the unit. Cost only when miles is 0.
 */
function fuelCell(cost: number, miles: number): ReactNode {
  if (miles === 0) return fmtCost(cost);
  return (
    <>
      {fmtCost(cost)}
      <br />
      <span className="whitespace-nowrap">{fmtMiles(miles)}</span>
    </>
  );
}

export function SpendReport({ report, referenceYear }: SpendReportProps) {
  const priorYearNum = referenceYear - 1;

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
          {/* Maintenance row — cost only, unchanged */}
          <tr className="border-b border-gray-100">
            <td className="py-2 px-2 text-gray-600">Maintenance</td>
            <td className="py-2 px-2 text-gray-700 text-right tabular-nums">
              {fmtCost(report.thisYear.maintenance)}
            </td>
            <td className="py-2 px-2 text-gray-900 font-semibold text-right tabular-nums">
              {fmtCost(report.priorYear.maintenance)}
            </td>
            <td className="py-2 px-2 text-gray-700 text-right tabular-nums">
              {fmtCost(report.lifetime.maintenance)}
            </td>
          </tr>

          {/* Fuel row — cost / distance per window */}
          <tr className="border-b border-gray-100">
            <td className="py-2 px-2 text-gray-600">Fuel</td>
            <td className="py-2 px-2 text-gray-700 text-right tabular-nums">
              {fuelCell(
                report.thisYear.fuel,
                report.fuelMiles.thisYear
              )}
            </td>
            <td className="py-2 px-2 text-gray-900 font-semibold text-right tabular-nums">
              {fuelCell(
                report.priorYear.fuel,
                report.fuelMiles.priorYear
              )}
            </td>
            <td className="py-2 px-2 text-gray-700 text-right tabular-nums">
              {fuelCell(
                report.lifetime.fuel,
                report.fuelMiles.lifetime
              )}
            </td>
          </tr>

          {/* Total row — cost only, unchanged */}
          <tr className="border-t border-gray-200 font-semibold">
            <td className="py-2 px-2 text-gray-600">Total</td>
            <td className="py-2 px-2 text-gray-700 text-right tabular-nums">
              {fmtCost(report.thisYear.total)}
            </td>
            <td className="py-2 px-2 text-gray-900 font-semibold text-right tabular-nums">
              {fmtCost(report.priorYear.total)}
            </td>
            <td className="py-2 px-2 text-gray-700 text-right tabular-nums">
              {fmtCost(report.lifetime.total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
