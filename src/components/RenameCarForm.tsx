// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// RenameCarForm — inline edit (chosen over modal: rename is a single
// field, low-stakes, and the inline form keeps the user's place on
// the car detail screen). Toggles between display name + "Rename"
// button and an inline text-input + Save/Cancel pair.
//
// Implementer judgment per dispatch §3; flagged in handoff.

import { useEffect, useRef, useState } from 'react';
import type { Car } from '../cars/cars';
import { renameCar } from '../cars/cars';
import { validateCarName } from '../cars/validateCarName';

interface RenameCarFormProps {
  car: Car;
  onRenamed: () => void | Promise<void>;
}

export function RenameCarForm({ car, onRenamed }: RenameCarFormProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(car.name);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(car.name);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setDraft(car.name);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const result = validateCarName(draft);
    if (!result.ok || !result.value) {
      setError(result.reason ?? 'Enter a name');
      return;
    }
    if (result.value === car.name) {
      setEditing(false);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await renameCar(car.id, result.value);
      setSubmitting(false);
      setEditing(false);
      await onRenamed();
    } catch (err: unknown) {
      setSubmitting(false);
      setError("Couldn't save — try again");
      console.error('renameCar failed', err);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold flex-1 break-words">{car.name}</h1>
        <button
          type="button"
          onClick={startEdit}
          className="text-blue-600 underline text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          Rename
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel();
        }}
        disabled={submitting}
        maxLength={120}
        className="border border-gray-300 rounded-md px-3 py-2 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
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
          disabled={submitting || draft.trim().length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md min-h-[44px] hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
