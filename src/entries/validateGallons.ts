// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Pure validation helper for gallons input. Strictly positive number.
//
// Zero is rejected: a fill-up of 0 gallons is a data error, not a
// "free pump dispensed no fluid" event. Decimals allowed (most
// fill-ups are e.g. 12.34 gal). Soft posture per Decision #8 — no
// upper-bound cap.

export interface ValidateGallonsResult {
  ok: boolean;
  reason?: string;
  value?: number;
}

export function validateGallons(raw: string): ValidateGallonsResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'Enter gallons' };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'Enter gallons' };
  }
  // Accept digits + at most one decimal point (locale-agnostic; the
  // numeric keypad uses `.` by convention on en-US devices). Reject
  // leading +/-, exponents, multiple dots.
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(trimmed)) {
    return { ok: false, reason: 'Gallons must be a positive number' };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, reason: 'Gallons must be a positive number' };
  }
  return { ok: true, value: parsed };
}
