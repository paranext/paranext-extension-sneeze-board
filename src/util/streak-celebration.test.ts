import { describe, expect, it } from 'vitest';
import { applyStreakCelebration } from './streak-celebration';
import { UNKNOWN_USER_ID } from './stats';
import type { SneezeDatabase } from '../bridge/xml/sneeze-database';

const A = 'user-A';
const B = 'user-B';

function db(sneezes: { userId: string; date: string }[]): SneezeDatabase {
  return {
    version: 1,
    countdownStart: 100,
    users: [
      { userId: A, color: '#FF0000', name: 'Alice' },
      { userId: B, color: '#00FF00', name: 'Bob' },
    ],
    sneezes,
  };
}

describe('applyStreakCelebration', () => {
  it('returns empty celebration on an empty database', () => {
    const result = applyStreakCelebration(db([]), A, 'hello', 'Alice');
    expect(result).toEqual({ comment: 'hello' });
  });

  it('returns empty celebration for the Unknown / Nemo user', () => {
    const result = applyStreakCelebration(
      db([{ userId: UNKNOWN_USER_ID, date: 'd1' }]),
      UNKNOWN_USER_ID,
      'nemo',
      'Nemo',
    );
    expect(result).toEqual({ comment: 'nemo' });
  });

  it('emits a chase notification at currentStreak === 3 against a leader with a bigger streak', () => {
    // A has streak of 5 already. B has 2 in a row → next sneeze makes 3.
    const result = applyStreakCelebration(
      db([
        { userId: A, date: 'd1' },
        { userId: A, date: 'd2' },
        { userId: A, date: 'd3' },
        { userId: A, date: 'd4' },
        { userId: A, date: 'd5' },
        { userId: B, date: 'd6' },
        { userId: B, date: 'd7' },
      ]),
      B,
      '',
      'Bob',
    );
    expect(result.notification).toContain("Alice's 5");
    expect(result.notification).toMatch(/sneeze 3 more times/);
    expect(result.comment).toBe('');
  });

  it('emits a TIE notification when sneezesToVictory === 1', () => {
    // A has 4 in a row (record). B has 3 in a row → next makes 4 (ties).
    const result = applyStreakCelebration(
      db([
        { userId: A, date: 'd1' },
        { userId: A, date: 'd2' },
        { userId: A, date: 'd3' },
        { userId: A, date: 'd4' },
        { userId: B, date: 'd5' },
        { userId: B, date: 'd6' },
        { userId: B, date: 'd7' },
      ]),
      B,
      '',
      'Bob',
    );
    expect(result.notification).toMatch(/tied/i);
    expect(result.notification).toMatch(/Alice/);
    expect(result.notification).toMatch(/4/);
    // Tying alone should NOT add a comment suffix.
    expect(result.comment).toBe('');
  });

  it('emits the break notification AND the "X beat Y\'s sneeze streak record." comment on the first-time break', () => {
    // A has 4 (record). B has 4 in a row already (tied) — next sneeze (5) breaks.
    const result = applyStreakCelebration(
      db([
        { userId: A, date: 'd1' },
        { userId: A, date: 'd2' },
        { userId: A, date: 'd3' },
        { userId: A, date: 'd4' },
        { userId: B, date: 'd5' },
        { userId: B, date: 'd6' },
        { userId: B, date: 'd7' },
        { userId: B, date: 'd8' },
      ]),
      B,
      '',
      'Bob',
    );
    expect(result.notification).toContain('Congratulations Bob');
    expect(result.notification).toContain("Alice's 4");
    expect(result.comment).toBe("Bob beat Alice's sneeze streak record.");
  });

  it('preserves the user\'s typed comment when appending the break suffix', () => {
    const result = applyStreakCelebration(
      db([
        { userId: A, date: 'd1' },
        { userId: A, date: 'd2' },
        { userId: B, date: 'd3' },
        { userId: B, date: 'd4' },
      ]),
      B,
      'hello world',
      'Bob',
    );
    // currentStreak=3, longestStreak=2 (A's run), sneezesToVictory=0
    expect(result.comment).toBe("hello world\nBob beat Alice's sneeze streak record.");
  });

  it('emits the "legend continues" notification and comment when the same user extends their own record', () => {
    // B is already the leader at 5. New sneeze makes 6.
    const result = applyStreakCelebration(
      db([
        { userId: A, date: 'd1' },
        { userId: A, date: 'd2' },
        { userId: B, date: 'd3' },
        { userId: B, date: 'd4' },
        { userId: B, date: 'd5' },
        { userId: B, date: 'd6' },
        { userId: B, date: 'd7' },
      ]),
      B,
      '',
      'Bob',
    );
    expect(result.notification).toContain('legend');
    expect(result.comment).toBe('The legend continues!');
  });

  it('does NOT fire any celebration on a routine sneeze (currentStreak not at 3/tie/break)', () => {
    const result = applyStreakCelebration(
      db([
        { userId: A, date: 'd1' },
        { userId: A, date: 'd2' },
        { userId: A, date: 'd3' },
        { userId: A, date: 'd4' },
        { userId: A, date: 'd5' },
        { userId: B, date: 'd6' },
      ]),
      B,
      'hi',
      'Bob',
    );
    expect(result.notification).toBeUndefined();
    expect(result.comment).toBe('hi');
  });
});
