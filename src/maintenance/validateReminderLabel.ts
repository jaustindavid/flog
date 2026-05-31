// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Pure validation helper for a service-reminder label (N3,
// maintenance-phase-3 §5.2). Mirrors validateCarName: trim, block
// empty / over-long. The label is what the banner and the reset
// checkbox display ("Oil change due"), so it must be non-empty; the cap
// is a client-side UX guard (the Car update rule enforces `is string`
// server-side, not a length).

export interface ValidateReminderLabelResult {
  ok: boolean;
  reason?: string;
  value?: string;
}

export const MAX_REMINDER_LABEL_LENGTH = 60;

export function validateReminderLabel(raw: string): ValidateReminderLabelResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'Enter a label' };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'Enter a label' };
  }
  if (trimmed.length > MAX_REMINDER_LABEL_LENGTH) {
    return {
      ok: false,
      reason: `Label is too long (max ${MAX_REMINDER_LABEL_LENGTH} characters)`,
    };
  }
  return { ok: true, value: trimmed };
}
