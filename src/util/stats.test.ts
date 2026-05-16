import { describe, it, expect } from 'vitest';
import {
  findUserStats,
  findLongestStreaks,
  estimateApocalypseDate,
  findAllStreaks,
  findExtendedUserStats,
  computeStreakSituation,
  UNKNOWN_USER_ID,
} from './stats';
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

describe('computeStreakSituation', () => {
  const baseDb = { version: 1, countdownStart: 100, users: [] };

  it('reports currentStreak=1 when this user has no prior sneeze at the end of db', () => {
    const s = computeStreakSituation(
      {
        ...baseDb,
        sneezes: [
          { userId: 'u1', date: 'd1' },
          { userId: 'u2', date: 'd2' },
        ],
      },
      'u1',
    );
    expect(s.currentStreak).toBe(1); // just the new sneeze
    expect(s.longestStreak).toBe(1);
  });

  it('detects breaking another user\'s record', () => {
    const s = computeStreakSituation(
      {
        ...baseDb,
        sneezes: [
          { userId: 'u1', date: 'd1' },
          { userId: 'u1', date: 'd2' },
          { userId: 'u1', date: 'd3' }, // u1's run: 3 (longest)
          { userId: 'u2', date: 'd4' },
          { userId: 'u2', date: 'd5' },
          { userId: 'u2', date: 'd6' }, // u2 has 3 in a row at the end; new sneeze makes 4
        ],
      },
      'u2',
    );
    expect(s.currentStreak).toBe(4);
    expect(s.longestStreak).toBe(3);
    expect(s.streakWinnerId).toBe('u1');
    expect(s.sneezesToVictory).toBe(0); // 3 + 1 - 4
  });

  it('detects about-to-tie (sneezesToVictory === 1)', () => {
    const s = computeStreakSituation(
      {
        ...baseDb,
        sneezes: [
          { userId: 'u1', date: 'd1' },
          { userId: 'u1', date: 'd2' },
          { userId: 'u1', date: 'd3' },
          { userId: 'u2', date: 'd4' },
          { userId: 'u2', date: 'd5' }, // u2 has 2 in a row at end; new sneeze makes 3
        ],
      },
      'u2',
    );
    expect(s.currentStreak).toBe(3);
    expect(s.longestStreak).toBe(3);
    expect(s.sneezesToVictory).toBe(1);
  });

  it('detects legend-continues (same user extending own record)', () => {
    const s = computeStreakSituation(
      {
        ...baseDb,
        sneezes: [
          { userId: 'u1', date: 'd1' },
          { userId: 'u1', date: 'd2' },
          { userId: 'u1', date: 'd3' },
          { userId: 'u1', date: 'd4' }, // u1 owns the record at 4
        ],
      },
      'u1',
    );
    expect(s.currentStreak).toBe(5);
    expect(s.longestStreak).toBe(4);
    expect(s.streakWinnerId).toBe('u1');
    expect(s.sneezesToVictory).toBe(0); // 4 + 1 - 5
  });
});

describe('findAllStreaks', () => {
  it('returns every contiguous streak, sorted by length desc, skipping Unknown user', () => {
    const streaks = findAllStreaks({
      ...db,
      sneezes: [
        { userId: 'u1', date: 'd1' },
        { userId: 'u1', date: 'd2' },
        { userId: 'u2', date: 'd3' },
        { userId: UNKNOWN_USER_ID, date: 'd4' },
        { userId: UNKNOWN_USER_ID, date: 'd5' },
        { userId: 'u1', date: 'd6' },
        { userId: 'u1', date: 'd7' },
        { userId: 'u1', date: 'd8' },
      ],
    });
    expect(streaks).toEqual([
      { userId: 'u1', length: 3 },
      { userId: 'u1', length: 2 },
      { userId: 'u2', length: 1 },
    ]);
  });
});

describe('findExtendedUserStats', () => {
  it('computes total/percentage/participationDays/avgDaysPerSneeze and excludes Unknown from %', () => {
    const stats = findExtendedUserStats({
      version: 1,
      countdownStart: 100,
      users: [],
      sneezes: [
        // 4 sneezes by u1 spanning 4 days
        { userId: 'u1', date: '2024-01-01T00:00:00Z' },
        { userId: 'u1', date: '2024-01-02T00:00:00Z' },
        { userId: 'u1', date: '2024-01-03T00:00:00Z' },
        { userId: 'u1', date: '2024-01-04T00:00:00Z' },
        // 1 sneeze by u2 on day 5
        { userId: 'u2', date: '2024-01-05T00:00:00Z' },
        // Unknown user sneezes don't count toward the percentage denominator
        { userId: UNKNOWN_USER_ID, date: '2024-01-06T00:00:00Z' },
      ],
    });
    const u1 = stats.get('u1')!;
    expect(u1.totalSneezes).toBe(4);
    expect(u1.sneezePercentage).toBeCloseTo(80, 2); // 4 of 5 known
    expect(u1.participationDays).toBeCloseTo(3, 2); // Jan 1 → Jan 4 = 3 days
    expect(u1.avgDaysPerSneeze).toBeCloseTo(0.75, 2);
    const unknown = stats.get(UNKNOWN_USER_ID)!;
    expect(unknown.sneezePercentage).toBe(0); // explicitly zeroed for Unknown
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
