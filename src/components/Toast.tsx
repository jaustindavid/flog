// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Minimal toast notifier — fixed-position banner near the bottom of
// the viewport with success / warning / error variants. Auto-dismiss
// after 4 seconds; manual dismiss via tap.
//
// Per dispatch §9 #6: simplest thing that works. Inline render in the
// owning screen (no portal, no animation library, no global state
// manager). Multi-toast behavior is "newest replaces oldest" — the
// owning screen holds a single ToastState and overwrites it on every
// notification (dispatch §9 #11).

import { useEffect } from 'react';

export type ToastVariant = 'success' | 'warning' | 'error';

export interface ToastState {
  variant: ToastVariant;
  message: string;
  // Increments on every new notification so an identical message
  // re-triggers the auto-dismiss timer. The owning screen bumps this
  // alongside variant + message via a small helper (see below).
  nonce: number;
}

interface ToastProps {
  state: ToastState | null;
  onDismiss: () => void;
  // Auto-dismiss in ms; defaults to 4000.
  durationMs?: number;
}

export function Toast({ state, onDismiss, durationMs = 4000 }: ToastProps) {
  useEffect(() => {
    if (!state) return;
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
    // Re-arms when nonce changes — even an identical message re-shows
    // the toast and resets the timer.
  }, [state, durationMs, onDismiss]);

  if (!state) return null;

  const palette: Record<ToastVariant, string> = {
    success: 'bg-blue-600 text-white',
    warning: 'bg-amber-500 text-white',
    error: 'bg-red-600 text-white',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-50 flex justify-center pointer-events-none px-4"
    >
      <button
        type="button"
        onClick={onDismiss}
        className={`pointer-events-auto rounded-md shadow-lg px-4 py-3 max-w-md w-full text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300 ${palette[state.variant]}`}
      >
        {state.message}
      </button>
    </div>
  );
}
