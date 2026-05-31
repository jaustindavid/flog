// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// ReminderConfigForm — owner-only inline config for the per-car service
// reminder (maintenance-phase-3 §5.2). Mirrors RenameCarForm's inline
// edit posture (single section, low-stakes, keeps the user's place on
// the car-detail screen) rather than a full modal.
//
// Display mode: shows the current reminder ("Oil change — every 3,000 mi
// or 3 months") or "No service reminder", plus a Set/Edit button.
// Edit mode: label (validateReminderLabel) + intervalMiles + interval
// months (both NumericField, integer, optional) with ≥1 required (Save
// disabled otherwise), Save, Cancel, and — when one exists — Remove.
//
// Interval integer-ness is enforced client-side via validateOdometer
// (the project's positive-integer validator — same SF4 posture as the
// odometer field: the rule stays `is number`, the client enforces int).
// A blank interval field means "this dimension is unset" (null).

import { useEffect, useRef, useState } from 'react';
import type { Car, MaintenanceReminder } from '../cars/cars';
import { setMaintenanceReminder } from '../cars/cars';
import { validateOdometer } from '../entries/validateOdometer';
import { validateReminderLabel } from '../maintenance/validateReminderLabel';
import { NumericField } from './NumericField';

interface ReminderConfigFormProps {
  car: Car;
  onChanged: () => void | Promise<void>;
}

// Parse an optional interval field: '' → null (dimension unset); a valid
// positive integer → that number; anything else → invalid (string flag).
function parseInterval(raw: string): { value: number | null; valid: boolean } {
  if (raw.trim().length === 0) return { value: null, valid: true };
  const r = validateOdometer(raw); // positive-integer validator
  if (r.ok && r.value != null && r.value > 0) {
    return { value: r.value, valid: true };
  }
  return { value: null, valid: false };
}

export function ReminderConfigForm({ car, onChanged }: ReminderConfigFormProps) {
  const reminder = car.maintenanceReminder;

  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(reminder?.label ?? 'Oil change');
  const [miles, setMiles] = useState(
    reminder?.intervalMiles != null ? String(reminder.intervalMiles) : ''
  );
  const [months, setMonths] = useState(
    reminder?.intervalMonths != null ? String(reminder.intervalMonths) : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) labelRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setLabel(reminder?.label ?? 'Oil change');
    setMiles(
      reminder?.intervalMiles != null ? String(reminder.intervalMiles) : ''
    );
    setMonths(
      reminder?.intervalMonths != null ? String(reminder.intervalMonths) : ''
    );
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  const labelResult = validateReminderLabel(label);
  const milesParsed = parseInterval(miles);
  const monthsParsed = parseInterval(months);
  const hasOneInterval =
    milesParsed.value != null || monthsParsed.value != null;

  const milesError =
    miles.trim().length > 0 && !milesParsed.valid
      ? 'Whole number of miles'
      : null;
  const monthsError =
    months.trim().length > 0 && !monthsParsed.valid
      ? 'Whole number of months'
      : null;

  const canSave =
    labelResult.ok
    && milesParsed.valid
    && monthsParsed.valid
    && hasOneInterval
    && !submitting;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !labelResult.value) {
      if (!hasOneInterval) {
        setError('Set a mileage interval, a months interval, or both.');
      }
      return;
    }
    const next: MaintenanceReminder = {
      label: labelResult.value,
      intervalMiles: milesParsed.value,
      intervalMonths: monthsParsed.value,
    };
    setSubmitting(true);
    setError(null);
    try {
      await setMaintenanceReminder(car.id, next);
      setSubmitting(false);
      setEditing(false);
      await onChanged();
    } catch (err: unknown) {
      setSubmitting(false);
      setError("Couldn't save — try again");
      console.error('setMaintenanceReminder failed', err);
    }
  }

  async function remove() {
    setSubmitting(true);
    setError(null);
    try {
      await setMaintenanceReminder(car.id, null);
      setSubmitting(false);
      setEditing(false);
      await onChanged();
    } catch (err: unknown) {
      setSubmitting(false);
      setError("Couldn't remove — try again");
      console.error('setMaintenanceReminder(null) failed', err);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2">
        <div className="text-sm text-gray-700 flex-1">
          {reminder ? (
            <>
              <span className="font-medium">{reminder.label}</span>
              <span className="text-gray-500">
                {' '}
                — every{' '}
                {reminder.intervalMiles != null &&
                  `${reminder.intervalMiles.toLocaleString()} mi`}
                {reminder.intervalMiles != null &&
                  reminder.intervalMonths != null &&
                  ' or '}
                {reminder.intervalMonths != null &&
                  `${reminder.intervalMonths} ${
                    reminder.intervalMonths === 1 ? 'month' : 'months'
                  }`}
              </span>
            </>
          ) : (
            <span className="text-gray-500">No service reminder</span>
          )}
        </div>
        <button
          type="button"
          onClick={startEdit}
          className="text-blue-600 underline text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          {reminder ? 'Edit' : 'Set reminder'}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-3 rounded-md border border-gray-200 px-3 py-3"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="reminder-label"
          className="text-sm font-medium text-gray-800"
        >
          Reminder label
        </label>
        <input
          id="reminder-label"
          ref={labelRef}
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancel();
          }}
          disabled={submitting}
          autoComplete="off"
          placeholder="Oil change"
          className="min-h-[44px] px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <NumericField
        id="reminder-miles"
        label="Every (miles)"
        decimal={false}
        value={miles}
        onChange={(next) => {
          setMiles(next);
          if (error) setError(null);
        }}
        error={milesError}
      />
      <NumericField
        id="reminder-months"
        label="Every (months)"
        decimal={false}
        value={months}
        onChange={(next) => {
          setMonths(next);
          if (error) setError(null);
        }}
        error={monthsError}
      />

      <p className="text-xs text-gray-500">
        Set a mileage interval, a months interval, or both.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        {reminder ? (
          <button
            type="button"
            onClick={() => {
              void remove();
            }}
            disabled={submitting}
            className="px-4 py-2 text-red-600 underline min-h-[44px] rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Remove reminder
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={submitting}
            className="px-4 py-2 text-blue-600 underline min-h-[44px] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md min-h-[44px] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}
