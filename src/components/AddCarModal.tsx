// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// AddCarModal — minimal accessibility floor per dispatch §8 U3:
// autofocus primary input, Esc-to-close, explicit Cancel button.
// Focus-trap + full ARIA roles are deferred (BACKLOG → Later if
// they earn keep).

import { useEffect, useRef, useState } from 'react';
import { validateCarName } from '../cars/validateCarName';

interface AddCarModalProps {
  onCancel: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function AddCarModal({ onCancel, onCreate }: AddCarModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateCarName(name);
    if (!result.ok || !result.value) {
      setError(result.reason ?? 'Enter a name');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onCreate(result.value);
    } catch (err: unknown) {
      setSubmitting(false);
      setError("Couldn't save — try again");
      console.error('createCar failed', err);
    }
  }

  const isEmpty = name.trim().length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add a car"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        // Click on backdrop dismisses; clicks inside the dialog
        // (which stops propagation below) do not.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 flex flex-col gap-4"
      >
        <h2 className="text-lg font-semibold">Add a car</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-700">Name</span>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            className="border border-gray-300 rounded-md px-3 py-2 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Minivan"
            maxLength={120}
            disabled={submitting}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-blue-600 underline min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isEmpty || submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md min-h-[44px] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
