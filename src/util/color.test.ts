import { describe, it, expect } from 'vitest';
import { normalizeColor } from './color';

describe('normalizeColor', () => {
  it('passes #RRGGBB through unchanged', () => {
    expect(normalizeColor('#FF0000')).toBe('#FF0000');
  });
  it('maps Sienna to #A0522D', () => {
    expect(normalizeColor('Sienna')).toBe('#A0522D');
  });
  it('lowercases the name lookup', () => {
    expect(normalizeColor('sienna')).toBe('#A0522D');
  });
  it('returns the input as-is for unknown values (caller decides fallback)', () => {
    expect(normalizeColor('NotAColor')).toBe('NotAColor');
  });
  it('handles #rrggbb (lowercase) by uppercasing', () => {
    expect(normalizeColor('#ff0000')).toBe('#FF0000');
  });
});
