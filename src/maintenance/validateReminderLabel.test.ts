// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { describe, expect, it } from 'vitest';
import {
  MAX_REMINDER_LABEL_LENGTH,
  validateReminderLabel,
} from './validateReminderLabel';

describe('validateReminderLabel', () => {
  it('accepts a normal label and trims surrounding whitespace', () => {
    const r = validateReminderLabel('  Oil change  ');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('Oil change');
  });

  it('rejects an empty string', () => {
    const r = validateReminderLabel('');
    expect(r.ok).toBe(false);
    expect(r.reason).toBeDefined();
  });

  it('rejects a whitespace-only string', () => {
    expect(validateReminderLabel('   ').ok).toBe(false);
  });

  it('rejects an over-long label', () => {
    const r = validateReminderLabel('x'.repeat(MAX_REMINDER_LABEL_LENGTH + 1));
    expect(r.ok).toBe(false);
  });

  it('accepts a label exactly at the cap', () => {
    const r = validateReminderLabel('x'.repeat(MAX_REMINDER_LABEL_LENGTH));
    expect(r.ok).toBe(true);
  });

  it('rejects a non-string', () => {
    expect(validateReminderLabel(undefined as unknown as string).ok).toBe(false);
  });
});
