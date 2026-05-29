import { describe, expect, it } from 'vitest';
import {
  MAX_CAR_NAME_LENGTH,
  validateCarName,
} from './validateCarName';

describe('validateCarName', () => {
  it('accepts a normal name', () => {
    expect(validateCarName('Minivan')).toEqual({
      ok: true,
      value: 'Minivan',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(validateCarName('  Sedan  ')).toEqual({
      ok: true,
      value: 'Sedan',
    });
  });

  it('rejects empty string', () => {
    const result = validateCarName('');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Enter a name');
  });

  it('rejects whitespace-only string', () => {
    const result = validateCarName('   \t  ');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Enter a name');
  });

  it('accepts at exactly the max length', () => {
    const name = 'a'.repeat(MAX_CAR_NAME_LENGTH);
    expect(validateCarName(name)).toEqual({ ok: true, value: name });
  });

  it('rejects one character beyond max length', () => {
    const name = 'a'.repeat(MAX_CAR_NAME_LENGTH + 1);
    const result = validateCarName(name);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/too long/i);
  });
});
