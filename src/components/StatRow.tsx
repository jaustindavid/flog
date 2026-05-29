// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// StatRow — labeled list row for the per-car stats section on
// LogFillupScreen. Quieter than MpgTile (these are reference/vanity
// stats, not the primary glance). Label left, value right.
//
// New file — NOT a reuse or modification of MpgTile. The stats
// section intentionally uses a list layout (one row per stat) rather
// than the tile grid, and handles mixed units + the Expected-range band.

interface StatRowProps {
  label: string;
  // Pre-formatted display string (the screen formats units/precision/
  // band), or null → renders "—".
  display: string | null;
  // Expected range row: enlarges the value, heavier label weight.
  emphasis?: boolean;
  // Optional quiet hint shown below the label when display is null.
  subtitleWhenEmpty?: string;
}

export function StatRow({
  label,
  display,
  emphasis = false,
  subtitleWhenEmpty,
}: StatRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <div className="flex flex-col">
        <span
          className={
            emphasis
              ? 'text-base font-medium text-gray-800'
              : 'text-sm text-gray-600'
          }
        >
          {label}
        </span>
        {display === null && subtitleWhenEmpty && (
          <span className="text-xs text-gray-400 leading-tight">
            {subtitleWhenEmpty}
          </span>
        )}
      </div>
      <span
        className={
          emphasis
            ? 'text-xl font-semibold text-gray-900 text-right'
            : 'text-base font-semibold text-gray-900 text-right'
        }
      >
        {display ?? '—'}
      </span>
    </div>
  );
}
