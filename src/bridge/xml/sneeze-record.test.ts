import { describe, it, expect } from 'vitest';
import { decodeSneezeRecord, encodeSneezeRecord } from './sneeze-record';
import { readFileSync } from 'node:fs';

describe('SneezeRecord XML codec', () => {
  it('decodes the fixture', () => {
    const xml = readFileSync('test/fixtures/xml/sneeze-record-sample.xml', 'utf8');
    const r = decodeSneezeRecord(xml);
    expect(r.userId).toBe('c897cd73-9100-4e6a-8a32-fe237f1e9928');
    expect(r.date).toBe('2024-01-15T18:30:00Z');
    expect(r.comment).toBe('First sneeze of the day');
  });

  it('encodes with no XML decl and no namespaces', () => {
    const xml = encodeSneezeRecord({
      userId: 'c897cd73-9100-4e6a-8a32-fe237f1e9928',
      date: '2024-01-15T18:30:00Z',
      comment: 'hi',
    });
    expect(xml).not.toContain('<?xml');
    expect(xml).not.toContain('xmlns');
    expect(xml).toContain('userId="c897cd73-9100-4e6a-8a32-fe237f1e9928"');
    expect(xml).toContain('date="2024-01-15T18:30:00Z"');
    expect(xml).toContain('>hi<');
  });

  it('round-trips empty comment', () => {
    const r = { userId: 'a', date: 'b' };
    expect(decodeSneezeRecord(encodeSneezeRecord(r))).toEqual({
      userId: 'a',
      date: 'b',
      comment: '',
    });
  });

  it('encodes special XML characters safely', () => {
    const xml = encodeSneezeRecord({ userId: 'x', date: 'y', comment: 'a & b <c>' });
    const back = decodeSneezeRecord(xml);
    expect(back.comment).toBe('a & b <c>');
  });
});
