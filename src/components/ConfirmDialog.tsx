// ConfirmDialog — generic confirm/cancel. Same accessibility floor
// as AddCarModal: autofocus the confirm button, Esc-to-close, explicit
// Cancel button. Used by delete-car.

import { useEffect, useRef, useState } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (err: unknown) {
      setSubmitting(false);
      setError("Couldn't complete — try again");
      console.error('ConfirmDialog onConfirm failed', err);
    }
  }

  const confirmClass = destructive
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-blue-600 hover:bg-blue-700';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-gray-700">{message}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-blue-600 underline min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={submitting}
            className={`px-4 py-2 text-white rounded-md min-h-[44px] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${confirmClass}`}
          >
            {submitting ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
