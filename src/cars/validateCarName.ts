// Pure validation helper for Car names. Trims whitespace, blocks
// empty / over-long. Soft 100-char cap per dispatch §3 ("implementer
// picks; ~100 char default is fine").

export interface ValidateCarNameResult {
  ok: boolean;
  reason?: string;
  value?: string;
}

export const MAX_CAR_NAME_LENGTH = 100;

export function validateCarName(raw: string): ValidateCarNameResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'Enter a name' };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'Enter a name' };
  }
  if (trimmed.length > MAX_CAR_NAME_LENGTH) {
    return {
      ok: false,
      reason: `Name is too long (max ${MAX_CAR_NAME_LENGTH} characters)`,
    };
  }
  return { ok: true, value: trimmed };
}
