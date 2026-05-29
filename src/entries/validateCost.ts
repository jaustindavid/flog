// Pure validation helper for cost input. Non-negative number; zero
// allowed (free fill-ups exist: promo days, employee fuel).
//
// Decimals allowed (most fill-ups are dollars-and-cents). Soft posture
// per Decision #8 — no upper-bound cap.

export interface ValidateCostResult {
  ok: boolean;
  reason?: string;
  value?: number;
}

export function validateCost(raw: string): ValidateCostResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'Enter cost' };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'Enter cost' };
  }
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(trimmed)) {
    return { ok: false, reason: 'Cost must be a non-negative number' };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, reason: 'Cost must be a non-negative number' };
  }
  return { ok: true, value: parsed };
}
