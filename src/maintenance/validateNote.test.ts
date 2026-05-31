// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { describe, expect, it } from 'vitest';
import { MAX_NOTE_LENGTH, validateNote } from './validateNote';

describe('validateNote', () => {
  it('accepts a normal note and returns the trimmed value', () => {
    const r = validateNote('Oil change + filter');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('Oil change + filter');
  });

  it('trims surrounding whitespace', () => {
    const r = validateNote('  Rotated tires  ');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('Rotated tires');
  });

  it('rejects an empty string', () => {
    const r = validateNote('');
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it('rejects a whitespace-only string', () => {
    const r = validateNote('   \t  ');
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it('rejects a non-string input', () => {
    // @ts-expect-error — exercising the runtime guard
    const r = validateNote(undefined);
    expect(r.ok).toBe(false);
  });

  it('accepts a note exactly at the max length', () => {
    const r = validateNote('a'.repeat(MAX_NOTE_LENGTH));
    expect(r.ok).toBe(true);
  });

  it('rejects a note over the max length', () => {
    const r = validateNote('a'.repeat(MAX_NOTE_LENGTH + 1));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('too long');
  });

  it('counts length AFTER trimming (trailing spaces do not push over)', () => {
    const r = validateNote('a'.repeat(MAX_NOTE_LENGTH) + '   ');
    expect(r.ok).toBe(true);
  });
});
