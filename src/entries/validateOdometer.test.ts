// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { describe, expect, it } from 'vitest';
import { validateOdometer } from './validateOdometer';

describe('validateOdometer', () => {
  it('accepts a normal integer', () => {
    expect(validateOdometer('50000')).toEqual({ ok: true, value: 50000 });
  });

  it('accepts zero', () => {
    expect(validateOdometer('0')).toEqual({ ok: true, value: 0 });
  });

  it('trims surrounding whitespace', () => {
    expect(validateOdometer('  12345  ')).toEqual({ ok: true, value: 12345 });
  });

  it('rejects empty string', () => {
    const result = validateOdometer('');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/odometer/i);
  });

  it('rejects whitespace-only string', () => {
    const result = validateOdometer('   ');
    expect(result.ok).toBe(false);
  });

  it('rejects decimal values', () => {
    const result = validateOdometer('50000.5');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/whole number/i);
  });

  it('rejects negative values', () => {
    const result = validateOdometer('-100');
    expect(result.ok).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    const result = validateOdometer('fifty thousand');
    expect(result.ok).toBe(false);
  });

  it('rejects exponential notation', () => {
    const result = validateOdometer('5e4');
    expect(result.ok).toBe(false);
  });
});
