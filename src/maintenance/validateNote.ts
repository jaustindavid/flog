// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Pure validation helper for a maintenance note. Required,
// trimmed-non-empty, with a max length (maintenance-phase-1 §3 / §7.5).
//
// With no category taxonomy (PRD §14.6), the note carries the entry's
// meaning — an unlabeled cost ages badly — so it is required, mirroring
// validateCarName's trim-and-cap style. Cap at 280 (a tweet-length
// "what happened"); the maintenance `note` rule enforces non-empty
// server-side, the cap is a client-side UX guard.

export interface ValidateNoteResult {
  ok: boolean;
  reason?: string;
  value?: string;
}

export const MAX_NOTE_LENGTH = 280;

export function validateNote(raw: string): ValidateNoteResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'Enter a note' };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'Enter a note' };
  }
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      reason: `Note is too long (max ${MAX_NOTE_LENGTH} characters)`,
    };
  }
  return { ok: true, value: trimmed };
}
