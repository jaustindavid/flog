// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { describe, expect, it } from 'vitest';
import { validateCost } from './validateCost';

describe('validateCost', () => {
  it('accepts a normal cost', () => {
    expect(validateCost('42.50')).toEqual({ ok: true, value: 42.5 });
  });

  it('accepts integer cost', () => {
    expect(validateCost('40')).toEqual({ ok: true, value: 40 });
  });

  it('accepts zero (free fill-up: promo day, employee fuel)', () => {
    expect(validateCost('0')).toEqual({ ok: true, value: 0 });
  });

  it('accepts zero-as-decimal', () => {
    expect(validateCost('0.00')).toEqual({ ok: true, value: 0 });
  });

  it('trims surrounding whitespace', () => {
    expect(validateCost('  42.5  ')).toEqual({ ok: true, value: 42.5 });
  });

  it('rejects empty string', () => {
    const result = validateCost('');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/cost/i);
  });

  it('rejects negative values', () => {
    const result = validateCost('-10');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/non-negative/i);
  });

  it('rejects non-numeric strings', () => {
    const result = validateCost('forty');
    expect(result.ok).toBe(false);
  });

  it('rejects multiple decimal points', () => {
    const result = validateCost('40.5.0');
    expect(result.ok).toBe(false);
  });
});
