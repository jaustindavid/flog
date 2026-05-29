// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { describe, expect, it } from 'vitest';
import { canonicalEmail } from './canonicalEmail';

describe('canonicalEmail', () => {
  it('lowercases mixed-case addresses', () => {
    expect(canonicalEmail('Austin.David@Gmail.COM')).toBe(
      'austin.david@gmail.com'
    );
  });

  it('trims leading and trailing whitespace', () => {
    expect(canonicalEmail('  someone@example.com  ')).toBe(
      'someone@example.com'
    );
  });

  it('trims and lowercases together', () => {
    expect(canonicalEmail('\tFoo@Bar.com\n')).toBe('foo@bar.com');
  });

  it('is idempotent on already-canonical input', () => {
    const canonical = 'austindavid@gmail.com';
    expect(canonicalEmail(canonical)).toBe(canonical);
    expect(canonicalEmail(canonicalEmail(canonical))).toBe(canonical);
  });

  it('returns empty string for null', () => {
    expect(canonicalEmail(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(canonicalEmail(undefined)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(canonicalEmail('')).toBe('');
  });
});
