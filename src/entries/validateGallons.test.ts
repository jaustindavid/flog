import { describe, expect, it } from 'vitest';
import { validateGallons } from './validateGallons';

describe('validateGallons', () => {
  it('accepts integer gallons', () => {
    expect(validateGallons('12')).toEqual({ ok: true, value: 12 });
  });

  it('accepts decimal gallons', () => {
    expect(validateGallons('12.345')).toEqual({ ok: true, value: 12.345 });
  });

  it('accepts a leading-dot decimal', () => {
    expect(validateGallons('.5')).toEqual({ ok: true, value: 0.5 });
  });

  it('trims surrounding whitespace', () => {
    expect(validateGallons('  12.5  ')).toEqual({ ok: true, value: 12.5 });
  });

  it('rejects empty string', () => {
    const result = validateGallons('');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/gallons/i);
  });

  it('rejects zero (data error, not free-pump-no-fluid)', () => {
    const result = validateGallons('0');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/positive/i);
  });

  it('rejects zero-as-decimal', () => {
    const result = validateGallons('0.0');
    expect(result.ok).toBe(false);
  });

  it('rejects negative values', () => {
    const result = validateGallons('-5');
    expect(result.ok).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    const result = validateGallons('twelve');
    expect(result.ok).toBe(false);
  });

  it('rejects multiple decimal points', () => {
    const result = validateGallons('12.3.4');
    expect(result.ok).toBe(false);
  });
});
