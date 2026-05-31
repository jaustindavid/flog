// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// MaintenanceModal — ONE create-or-edit modal for a maintenance entry
// (maintenance-phase-1 §3 #3 / §7.5). No `entry` prop → CREATE mode
// (empty fields, date defaults to today, Save only). An `entry` prop →
// EDIT mode (fields pre-filled, Save + Delete-with-confirm).
//
// Mirrors EditEntryModal's accessibility floor (overlay + centered
// panel, autofocus the first field, Esc-to-close, explicit Cancel,
// backdrop-dismiss, inline error) and its nested-Esc guard (while the
// delete ConfirmDialog is open, this modal's window Esc listener is NOT
// bound, so a single Esc closes only the topmost dialog).
//
// Fields: date (`<input type="date">`, required), odometer (NumericField,
// required), cost (NumericField, required), note (text input, required).
// Phase 3: when the car has a reminder (reminderLabel passed), a
// "↺ Reset [label]" checkbox appears (default OFF) — checking it
// baselines the reminder. resetsReminder is written on BOTH create and
// edit; with no reminder the checkbox is hidden and false is sent.
//
// Validation reuses the fuel numeric validators (validateOdometer /
// validateCost) so the client integer/decimal posture matches the
// entries side (SF4: odometer rejects decimals client-side; the rule
// stays `is number`), plus validateNote and the date helper. Save is
// disabled until all four parse.

import { useEffect, useRef, useState } from 'react';
import { validateCost } from '../entries/validateCost';
import { validateOdometer } from '../entries/validateOdometer';
import {
  createMaintenance,
  deleteMaintenance,
  updateMaintenance,
  type Maintenance,
} from '../maintenance/maintenance';
import {
  dateInputToTimestamp,
  timestampToDateInput,
  todayDateInput,
} from '../maintenance/dateField';
import { validateNote } from '../maintenance/validateNote';
import { ConfirmDialog } from './ConfirmDialog';
import { NumericField } from './NumericField';

interface MaintenanceModalProps {
  carId: string;
  // No entry → create mode; entry present → edit mode.
  entry?: Maintenance;
  loggedByUid: string;
  // Phase 3: the car's reminder label when one is configured, else null.
  // Drives whether the reset checkbox renders ("↺ Reset [label]").
  reminderLabel?: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export function MaintenanceModal({
  carId,
  entry,
  loggedByUid,
  reminderLabel,
  onClose,
  onSaved,
  onDeleted,
}: MaintenanceModalProps) {
  const isEdit = entry !== undefined;
  const hasReminder =
    typeof reminderLabel === 'string' && reminderLabel.length > 0;

  // Pre-fill in edit mode; sensible blanks (date=today) in create mode.
  // Cost shows 2 dp (dollars); odometer is an integer; the date pre-fill
  // uses LOCAL getters via timestampToDateInput (never toISOString).
  const [dateStr, setDateStr] = useState(
    entry?.date ? timestampToDateInput(entry.date) : todayDateInput()
  );
  const [odometer, setOdometer] = useState(
    entry ? String(entry.odometer) : ''
  );
  const [cost, setCost] = useState(entry ? entry.cost.toFixed(2) : '');
  const [note, setNote] = useState(entry ? entry.note : '');
  // Reset checkbox (Phase 3): default OFF in create mode (Decision #3 —
  // even the banner-tap create flow defaults OFF); in edit mode pre-fill
  // the entry's stored resetsReminder so editing a baseline entry keeps
  // it a baseline unless the user unchecks.
  const [resetsReminder, setResetsReminder] = useState(
    entry?.resetsReminder ?? false
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // Nested-Esc guard (mirrors EditEntryModal): only bind while the
  // confirm dialog is closed. When `confirming` the ConfirmDialog owns
  // Esc; this effect's cleanup has already removed our handler.
  useEffect(() => {
    if (confirming) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirming, onClose]);

  const dateTs = dateInputToTimestamp(dateStr);
  const odoResult = validateOdometer(odometer);
  const costResult = validateCost(cost);
  const noteResult = validateNote(note);

  const dateError =
    dateStr.length > 0 && dateTs === null ? 'Enter a valid date' : null;
  const odoError =
    odometer.length > 0 && !odoResult.ok ? odoResult.reason ?? null : null;
  const costError =
    cost.length > 0 && !costResult.ok ? costResult.reason ?? null : null;
  const noteError =
    note.length > 0 && !noteResult.ok ? noteResult.reason ?? null : null;

  const canSave =
    dateTs !== null
    && odoResult.ok
    && costResult.ok
    && noteResult.ok
    && !saving;

  function clearError() {
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (dateTs === null || !odoResult.ok || !costResult.ok || !noteResult.ok) {
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const fields = {
        date: dateTs,
        odometer: odoResult.value!,
        cost: costResult.value!,
        note: noteResult.value!,
      };
      // Only send a true reset when the car actually has a reminder —
      // hasReminder gates the checkbox, so without one resetsReminder
      // stays false regardless of any stale state.
      const reset = hasReminder ? resetsReminder : false;
      if (isEdit) {
        await updateMaintenance(carId, entry.id, {
          ...fields,
          resetsReminder: reset,
        });
      } else {
        await createMaintenance(carId, fields, loggedByUid, reset);
      }
      onSaved();
    } catch (err: unknown) {
      setSaving(false);
      setError("Couldn't save — try again");
      console.error('saveMaintenance failed', err);
    }
  }

  async function handleDelete() {
    // Throws on failure so ConfirmDialog surfaces its own inline error
    // (mirrors EditEntryModal). On success the parent unmounts us.
    if (!isEdit) return;
    await deleteMaintenance(carId, entry.id);
    onDeleted();
  }

  const title = isEdit ? 'Edit maintenance' : 'Log maintenance';

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !confirming) onClose();
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 flex flex-col gap-4"
        >
          <h2 className="text-lg font-semibold">{title}</h2>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="maint-date"
              className="text-sm font-medium text-gray-800"
            >
              Date
            </label>
            <input
              id="maint-date"
              ref={firstFieldRef}
              type="date"
              value={dateStr}
              onChange={(e) => {
                setDateStr(e.target.value);
                clearError();
              }}
              className={
                dateError
                  ? 'min-h-[44px] px-3 py-2 rounded-md border-2 border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500'
                  : 'min-h-[44px] px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
              }
              aria-invalid={dateError ? 'true' : 'false'}
              aria-describedby={dateError ? 'maint-date-error' : undefined}
            />
            {dateError && (
              <p id="maint-date-error" className="text-xs text-red-600">
                {dateError}
              </p>
            )}
          </div>

          <NumericField
            id="maint-odometer"
            label="Odometer (mi)"
            decimal={false}
            value={odometer}
            onChange={(next) => {
              setOdometer(next);
              clearError();
            }}
            error={odoError}
          />
          <NumericField
            id="maint-cost"
            label="Cost ($)"
            decimal
            value={cost}
            onChange={(next) => {
              setCost(next);
              clearError();
            }}
            error={costError}
          />

          <div className="flex flex-col gap-1">
            <label
              htmlFor="maint-note"
              className="text-sm font-medium text-gray-800"
            >
              Note
            </label>
            <input
              id="maint-note"
              type="text"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                clearError();
              }}
              autoComplete="off"
              placeholder="What happened (e.g. oil change + filter)"
              className={
                noteError
                  ? 'min-h-[44px] px-3 py-2 rounded-md border-2 border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500'
                  : 'min-h-[44px] px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
              }
              aria-invalid={noteError ? 'true' : 'false'}
              aria-describedby={noteError ? 'maint-note-error' : undefined}
            />
            {noteError && (
              <p id="maint-note-error" className="text-xs text-red-600">
                {noteError}
              </p>
            )}
          </div>

          {hasReminder && (
            <label className="flex items-center gap-2 text-sm text-gray-800 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={resetsReminder}
                onChange={(e) => {
                  setResetsReminder(e.target.checked);
                  clearError();
                }}
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span>↺ Reset {reminderLabel}</span>
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            {isEdit ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={saving}
                className="px-4 py-2 text-red-600 underline min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded disabled:opacity-50"
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-blue-600 underline min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md min-h-[44px] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Delete maintenance"
          message="Delete this maintenance entry? This can't be undone."
          confirmLabel="Delete"
          destructive
          onCancel={() => setConfirming(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
