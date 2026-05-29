// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// ShareForm — owner-only. Adds a sharee by email. Pre-write UI
// guardrails per dispatch §3:
//   - empty → "Enter an email"
//   - invalid → "Enter a valid email"
//   - self → "You already have access to this car"
//   - duplicate → "Already shared with X"
// Canonical email via canonicalEmail() before any read/write.

import { useState } from 'react';
import type { Car } from '../cars/cars';
import { shareCar } from '../cars/cars';
import { canonicalEmail } from '../auth/canonicalEmail';
import { isValidEmailFormat } from '../cars/isValidEmailFormat';
import { useAuth } from '../auth/useAuth';

interface ShareFormProps {
  car: Car;
  onShared: () => void | Promise<void>;
}

export function ShareForm({ car, onShared }: ShareFormProps) {
  const { user } = useAuth();
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      setError('Enter an email');
      return;
    }
    const canonical = canonicalEmail(trimmed);
    if (!isValidEmailFormat(canonical)) {
      setError('Enter a valid email');
      return;
    }
    const selfEmail = canonicalEmail(user?.email);
    if (canonical === selfEmail) {
      setError('You already have access to this car');
      return;
    }
    if (car.shareeEmails.includes(canonical)) {
      setError(`Already shared with ${canonical}`);
      return;
    }

    setSubmitting(true);
    try {
      await shareCar(car.id, canonical);
      setSubmitting(false);
      setRaw('');
      await onShared();
    } catch (err: unknown) {
      setSubmitting(false);
      setError("Couldn't save — try again");
      console.error('shareCar failed', err);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-700">Share with email</span>
        <input
          type="email"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            if (error) setError(null);
          }}
          disabled={submitting}
          className="border border-gray-300 rounded-md px-3 py-2 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="person@example.com"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || raw.trim().length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md min-h-[44px] hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  );
}
