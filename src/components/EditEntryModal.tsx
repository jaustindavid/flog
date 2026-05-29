// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// EditEntryModal — edit or delete a single fill-up. Mirrors
// AddCarModal's accessibility floor (overlay + centered panel,
// autofocus the first field, Esc-to-close, explicit Cancel,
// backdrop-dismiss, inline error). Focus-trap + full ARIA roles
// remain the deferred BACKLOG item — not expanded here.
//
// Edits the three numeric fields only (odometer/gallons/cost),
// pre-filled from the entry. loggedByUid and loggedAt are not
// touched — updateEntry never writes them and the entries `update`
// rule's hasOnly guard rejects any attempt to. Reuses the M4
// validators; Save is disabled until all three are valid.
//
// Delete routes through the existing ConfirmDialog (irreversible;
// no soft-delete). Nested-Esc guard (edit-delete-entries N4): while
// the ConfirmDialog is open, the edit modal's window Esc listener is
// NOT bound (the effect depends on `confirming`), so a single Esc
// closes only the topmost dialog (the confirm), never both at once.

import { useEffect, useRef, useState } from 'react';
import type { Entry } from '../entries/entries';
import { deleteEntry, updateEntry } from '../entries/entries';
import { validateCost } from '../entries/validateCost';
import { validateGallons } from '../entries/validateGallons';
import { validateOdometer } from '../entries/validateOdometer';
import { ConfirmDialog } from './ConfirmDialog';
import { NumericField } from './NumericField';

interface EditEntryModalProps {
  carId: string;
  entry: Entry;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export function EditEntryModal({
  carId,
  entry,
  onClose,
  onSaved,
  onDeleted,
}: EditEntryModalProps) {
  // Pre-fill from the entry. Gallons uses String() to preserve the
  // FULL stored precision (US pumps dispense to 0.001 gal, e.g.
  // 5.001) — toFixed(2) here would silently truncate the stored
  // value to 2 dp on the next save (data loss). Cost is dollars
  // (2 dp is correct); odometer is an integer.
  const [odometer, setOdometer] = useState(String(entry.odometer));
  const [gallons, setGallons] = useState(String(entry.gallons));
  const [cost, setCost] = useState(entry.cost.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // Nested-Esc guard: only bind this listener while the confirm
  // dialog is closed. When `confirming` is true the ConfirmDialog
  // owns Esc; this effect's cleanup has already removed our handler,
  // so a single Esc closes only the confirm.
  useEffect(() => {
    if (confirming) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirming, onClose]);

  const odoResult = validateOdometer(odometer);
  const gallonsResult = validateGallons(gallons);
  const costResult = validateCost(cost);

  const odoError =
    odometer.length > 0 && !odoResult.ok ? odoResult.reason ?? null : null;
  const gallonsError =
    gallons.length > 0 && !gallonsResult.ok
      ? gallonsResult.reason ?? null
      : null;
  const costError =
    cost.length > 0 && !costResult.ok ? costResult.reason ?? null : null;

  const canSave =
    odoResult.ok && gallonsResult.ok && costResult.ok && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!odoResult.ok || !gallonsResult.ok || !costResult.ok) return;
    setError(null);
    setSaving(true);
    try {
      await updateEntry(carId, entry.id, {
        odometer: odoResult.value!,
        gallons: gallonsResult.value!,
        cost: costResult.value!,
      });
      onSaved();
    } catch (err: unknown) {
      setSaving(false);
      setError("Couldn't save — try again");
      console.error('updateEntry failed', err);
    }
  }

  async function handleDelete() {
    // Throws on failure so ConfirmDialog surfaces its own inline
    // error (mirrors delete-car). On success the parent unmounts us.
    await deleteEntry(carId, entry.id);
    onDeleted();
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit fill-up"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => {
          // Backdrop dismiss; ignore while the confirm is open so a
          // stray backdrop tap behind it can't also close the editor.
          if (e.target === e.currentTarget && !confirming) onClose();
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 flex flex-col gap-4"
        >
          <h2 className="text-lg font-semibold">Edit fill-up</h2>

          <NumericField
            id="edit-odometer"
            label="Odometer (mi)"
            decimal={false}
            value={odometer}
            onChange={(next) => {
              setOdometer(next);
              if (error) setError(null);
            }}
            error={odoError}
          />
          <NumericField
            id="edit-gallons"
            label="Gallons"
            decimal
            value={gallons}
            onChange={(next) => {
              setGallons(next);
              if (error) setError(null);
            }}
            error={gallonsError}
          />
          <NumericField
            id="edit-cost"
            label="Cost ($)"
            decimal
            value={cost}
            onChange={(next) => {
              setCost(next);
              if (error) setError(null);
            }}
            error={costError}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={saving}
              className="px-4 py-2 text-red-600 underline min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded disabled:opacity-50"
            >
              Delete
            </button>
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
          title="Delete fill-up"
          message="Delete this fill-up? This can't be undone."
          confirmLabel="Delete"
          destructive
          onCancel={() => setConfirming(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
