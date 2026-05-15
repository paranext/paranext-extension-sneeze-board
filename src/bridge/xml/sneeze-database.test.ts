import { describe, it, expect } from 'vitest';
import { decodeSneezeDatabase } from './sneeze-database';
import { readFileSync } from 'node:fs';

describe('SneezeDatabase XML codec', () => {
  it('decodes the captured database fixture', () => {
    const xml = readFileSync('test/fixtures/xml/database-sample.xml', 'utf8');
    const db = decodeSneezeDatabase(xml);
    expect(db.version).toBeGreaterThan(0);
    expect(db.countdownStart).toBeGreaterThan(0);
    expect(Array.isArray(db.sneezes)).toBe(true);
    expect(Array.isArray(db.users)).toBe(true);
    if (db.users.length > 0) {
      expect(db.users[0]).toHaveProperty('userId');
      expect(db.users[0]).toHaveProperty('color');
      expect(db.users[0]).toHaveProperty('name');
    }
  });

  it('handles a synthetic small database', () => {
    const xml = `<SneezeDatabase Version="1">
  <CountdownStart>100</CountdownStart>
  <Sneezes>
    <Sneeze userId="u1" date="2020-01-01T00:00:00Z">first</Sneeze>
    <Sneeze userId="u2" date="2020-01-02T00:00:00Z" />
  </Sneezes>
  <Users>
    <User userId="u1" color="#FF0000">Alice</User>
    <User userId="u2" color="#00FF00">Bob</User>
  </Users>
</SneezeDatabase>`;
    const db = decodeSneezeDatabase(xml);
    expect(db.version).toBe(1);
    expect(db.countdownStart).toBe(100);
    expect(db.sneezes).toHaveLength(2);
    expect(db.sneezes[0]).toMatchObject({
      userId: 'u1',
      date: '2020-01-01T00:00:00Z',
      comment: 'first',
    });
    expect(db.sneezes[1]).toMatchObject({
      userId: 'u2',
      date: '2020-01-02T00:00:00Z',
      comment: '',
    });
    expect(db.users).toHaveLength(2);
    expect(db.users[0]).toMatchObject({ userId: 'u1', color: '#FF0000', name: 'Alice' });
  });
});
