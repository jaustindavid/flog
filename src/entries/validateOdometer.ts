// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Pure validation helper for odometer input. Integer miles ≥ 0.
//
// Soft posture per dispatch §3 + Decision #8: hard-block only on
// non-numeric / wrong sign / decimal. No upper-bound cap — the
// odometer-monotonicity flag-but-accept covers absurd typos via a
// downstream warning, not a hard block.

export interface ValidateOdometerResult {
  ok: boolean;
  reason?: string;
  value?: number;
}

export function validateOdometer(raw: string): ValidateOdometerResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'Enter the odometer reading' };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'Enter the odometer reading' };
  }
  // Reject leading +/- signs, decimal points, exponential notation up
  // front so we don't lean on Number() coercion quirks (which accepts
  // " 50000 ", "5e4", etc.).
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, reason: 'Odometer must be a whole number of miles' };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return { ok: false, reason: 'Odometer must be a whole number of miles' };
  }
  return { ok: true, value: parsed };
}
