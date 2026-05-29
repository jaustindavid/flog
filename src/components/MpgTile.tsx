// MpgTile — one of the three MPG summary tiles at the top of the
// Fill-ups section on CarDetailScreen.
//
// Renders the label, then either the value (one decimal + " mpg")
// or a "—" placeholder when the value is null. Per Decision #12,
// the tile preserves its layout slot regardless of value state —
// callers get a consistent 3-column grid even when some tiles have
// no number to show.
//
// Optional subtitleWhenEmpty (e.g., "need 2+ fills") renders only
// when value is null and the prop is supplied, giving lightweight
// context for why a tile is showing "—".

interface MpgTileProps {
  label: string;
  value: number | null;
  subtitleWhenEmpty?: string;
}

export function MpgTile({ label, value, subtitleWhenEmpty }: MpgTileProps) {
  return (
    <div className="flex flex-col gap-1 p-3 border border-gray-200 rounded-md bg-white">
      <div className="text-xs text-gray-500 leading-tight">{label}</div>
      <div className="text-xl font-semibold text-gray-900 leading-tight">
        {value === null ? '—' : `${value.toFixed(1)} mpg`}
      </div>
      {value === null && subtitleWhenEmpty && (
        <div className="text-[10px] text-gray-400 leading-tight">
          {subtitleWhenEmpty}
        </div>
      )}
    </div>
  );
}
