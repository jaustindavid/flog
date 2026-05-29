// NumericField — labeled numeric input with appropriate mobile keypad.
//
// `decimal=false` → integer keypad (odometer); `inputmode="numeric"` +
// `pattern="[0-9]*"` summons the digit-only keypad on iOS Safari and
// Chrome Android.
//
// `decimal=true` → decimal keypad (gallons, cost); `inputmode="decimal"`
// + `pattern="[0-9]*[.,]?[0-9]*"` summons the digit-and-dot keypad.
//
// `type="number"` is intentionally NOT used. Mobile Safari renders
// `type="number"` with a spinner that wastes tap surface, the
// localization is unpredictable on commas vs. dots, and most
// importantly the browser's own validation eats the value before our
// pure validators can normalize it. `type="text"` + `inputmode` gives
// us the right keypad without the value-mangling.

interface NumericFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  decimal: boolean;
  // Optional inline error message — when present, the field renders a
  // red border and the message below. Owners pass null for "valid /
  // not yet validated."
  error?: string | null;
  // Optional id so the label can target a specific input; defaults
  // to a label-derived slug.
  id?: string;
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function NumericField({
  label,
  value,
  onChange,
  decimal,
  error,
  id,
}: NumericFieldProps) {
  const inputId = id ?? `numeric-${slug(label)}`;
  const inputMode = decimal ? 'decimal' : 'numeric';
  const pattern = decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*';

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-800">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        inputMode={inputMode}
        pattern={pattern}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className={
          error
            ? 'min-h-[44px] px-3 py-2 rounded-md border-2 border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500'
            : 'min-h-[44px] px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
        }
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : undefined}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
