import { describe, it, expect } from 'vitest';
import { decodeUserInfo, encodeUserInfo } from './user-info';
import { readFileSync } from 'node:fs';

describe('UserInfo XML codec', () => {
  it('decodes the fixture', () => {
    const xml = readFileSync('test/fixtures/xml/user-info-sample.xml', 'utf8');
    const u = decodeUserInfo(xml);
    expect(u.userId).toBe('c897cd73-9100-4e6a-8a32-fe237f1e9928');
    expect(u.color).toBe('#FF8800');
    expect(u.name).toBe('Tim');
  });

  it('round-trips a user', () => {
    const u = { userId: 'a', color: '#102030', name: 'X & Y' };
    expect(decodeUserInfo(encodeUserInfo(u))).toEqual(u);
  });

  it('decodes a named-color value into the same string (caller normalizes)', () => {
    // C# may emit color="Sienna" for the built-in Nemo user. Preserve verbatim;
    // the consumer maps known names to #RRGGBB.
    const xml =
      '<UserInfo userId="944616BD-20A1-4659-87AF-04563043FFDE" color="Sienna">Nemo</UserInfo>';
    expect(decodeUserInfo(xml).color).toBe('Sienna');
  });
});
