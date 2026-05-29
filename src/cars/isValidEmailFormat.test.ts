import { describe, expect, it } from 'vitest';
import { isValidEmailFormat } from './isValidEmailFormat';

describe('isValidEmailFormat', () => {
  it('accepts a typical email', () => {
    expect(isValidEmailFormat('alice@example.com')).toBe(true);
  });

  it('accepts a plus-addressed email', () => {
    expect(isValidEmailFormat('alice+tag@example.com')).toBe(true);
  });

  it('accepts a multi-dot domain', () => {
    expect(isValidEmailFormat('alice@mail.co.uk')).toBe(true);
  });

  it('rejects missing @', () => {
    expect(isValidEmailFormat('aliceexample.com')).toBe(false);
  });

  it('rejects missing domain TLD', () => {
    expect(isValidEmailFormat('alice@example')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(isValidEmailFormat('alice @example.com')).toBe(false);
    expect(isValidEmailFormat('alice@ex ample.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidEmailFormat('')).toBe(false);
  });

  it('rejects just @', () => {
    expect(isValidEmailFormat('@')).toBe(false);
  });
});
