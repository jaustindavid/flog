// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// SharedWithList — renders Car.shareeEmails. When canUnshare is true
// (owner view), each row shows a Remove button that fires
// unshareCar + parent refresh.

import { useState } from 'react';
import type { Car } from '../cars/cars';
import { unshareCar } from '../cars/cars';

interface SharedWithListProps {
  car: Car;
  canUnshare: boolean;
  onUnshared: () => void | Promise<void>;
}

export function SharedWithList({
  car,
  canUnshare,
  onUnshared,
}: SharedWithListProps) {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (car.shareeEmails.length === 0) {
    return (
      <p className="text-sm text-gray-500">Not shared with anyone yet.</p>
    );
  }

  async function remove(email: string) {
    setPendingEmail(email);
    setError(null);
    try {
      await unshareCar(car.id, email);
      setPendingEmail(null);
      await onUnshared();
    } catch (err: unknown) {
      setPendingEmail(null);
      setError("Couldn't remove — try again");
      console.error('unshareCar failed', err);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {car.shareeEmails.map((email) => (
          <li
            key={email}
            className="flex items-center justify-between gap-3 border border-gray-200 rounded-md px-3 py-2"
          >
            <span className="text-sm break-all">{email}</span>
            {canUnshare && (
              <button
                type="button"
                onClick={() => {
                  void remove(email);
                }}
                disabled={pendingEmail === email}
                aria-label={`Remove ${email}`}
                className="text-red-600 underline text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded disabled:opacity-50"
              >
                {pendingEmail === email ? 'Removing…' : 'Remove'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
