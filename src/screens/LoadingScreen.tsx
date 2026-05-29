// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

export function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 gap-4"
      role="status"
      aria-live="polite"
    >
      <p className="text-gray-600">Loading…</p>
    </div>
  );
}
