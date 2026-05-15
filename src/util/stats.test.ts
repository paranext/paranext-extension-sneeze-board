import { describe, it, expect } from 'vitest';
import { findUserStats, findLongestStreaks, estimateApocalypseDate } from './stats';
import type { SneezeDatabase } from '../bridge/xml/sneeze-database';

const db: SneezeDatabase = {
  version: 1,
  countdownStart: 100,
  users: [
    { userId: 'u1', color: '#FF0000', name: 'Alice' },
    { userId: 'u2', color: '#00FF00', name: 'Bob' },
  ],
  sneezes: [
    { userId: 'u1', date: '2024-01-01T00:00:00Z' },
    { userId: 'u2', date: '2024-01-02T00:00:00Z' },
    { userId: 'u1', date: '2024-01-03T00:00:00Z' },
  ],
};

describe('findUserStats', () => {
  it('counts sneezes per user with first/last dates', () => {
    const stats = findUserStats(db);
    expect(stats.get('u1')).toEqual({
      totalSneezes: 2,
      firstSneezeDate: '2024-01-01T00:00:00Z',
      lastSneezeDate: '2024-01-03T00:00:00Z',
    });
    expect(stats.get('u2')).toEqual({
      totalSneezes: 1,
      firstSneezeDate: '2024-01-02T00:00:00Z',
      lastSneezeDate: '2024-01-02T00:00:00Z',
    });
  });
});

describe('findLongestStreaks', () => {
  it('returns longest contiguous run per user', () => {
    const streaks = findLongestStreaks({
      ...db,
      sneezes: [
        { userId: 'u1', date: 'd1' },
        { userId: 'u1', date: 'd2' },
        { userId: 'u2', date: 'd3' },
        { userId: 'u1', date: 'd4' },
        { userId: 'u2', date: 'd5' },
        { userId: 'u2', date: 'd6' },
        { userId: 'u2', date: 'd7' },
      ],
    });
    expect(streaks.get('u1')).toBe(2);
    expect(streaks.get('u2')).toBe(3);
  });

  it('returns 1 when a user has only single sneezes interspersed', () => {
    const streaks = findLongestStreaks({
      ...db,
      sneezes: [
        { userId: 'u1', date: 'd1' },
        { userId: 'u2', date: 'd2' },
        { userId: 'u1', date: 'd3' },
      ],
    });
    expect(streaks.get('u1')).toBe(1);
    expect(streaks.get('u2')).toBe(1);
  });
});

describe('estimateApocalypseDate', () => {
  it('returns a date when there are sneezes in range', () => {
    const now = new Date('2024-01-08T00:00:00Z');
    const result = estimateApocalypseDate(
      {
        version: 1,
        countdownStart: 100,
        users: [],
        sneezes: [
          { userId: 'u1', date: '2024-01-01T00:00:00Z' },
          { userId: 'u1', date: '2024-01-08T00:00:00Z' },
        ],
      },
      'allTime',
      now,
    );
    expect(result).toBeInstanceOf(Date);
    const d = result as Date;
    expect(d.getTime()).toBeGreaterThan(now.getTime());
  });

  it('returns "noSneezesInRange" when nothing matches the date range', () => {
    const result = estimateApocalypseDate(
      {
        version: 1,
        countdownStart: 100,
        users: [],
        sneezes: [{ userId: 'u1', date: '2020-01-01T00:00:00Z' }],
      },
      'oneWeek',
      new Date('2024-01-01T00:00:00Z'),
    );
    expect(result).toBe('noSneezesInRange');
  });
});
