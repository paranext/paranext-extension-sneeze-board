import type { SneezeDatabase } from '../bridge/xml/sneeze-database';

export type UserStats = {
  totalSneezes: number;
  firstSneezeDate: string;
  lastSneezeDate: string;
};

/** ID of the built-in Nemo / "Unknown" user — excluded from most aggregate stats. */
export const UNKNOWN_USER_ID = '944616bd-20a1-4659-87af-04563043ffde';

export function findUserStats(db: SneezeDatabase): Map<string, UserStats> {
  const out = new Map<string, UserStats>();
  for (const sneeze of db.sneezes) {
    const existing = out.get(sneeze.userId);
    if (!existing) {
      out.set(sneeze.userId, {
        totalSneezes: 1,
        firstSneezeDate: sneeze.date,
        lastSneezeDate: sneeze.date,
      });
    } else {
      existing.totalSneezes += 1;
      existing.lastSneezeDate = sneeze.date;
    }
  }
  return out;
}

/** A single contiguous run of sneezes by one user. */
export type Streak = { userId: string; length: number };

/**
 * Returns every streak (contiguous run of sneezes by one user) in the database, sorted by length
 * descending. Mirrors the C# `SneezeDatabase.FindAllStreaks` shape used by the Streak Hall of Fame
 * visualization, but flattened.
 *
 * Streaks attributed to the Unknown user are skipped (matches the C# behavior of not crediting
 * them).
 */
export function findAllStreaks(db: SneezeDatabase): Streak[] {
  const out: Streak[] = [];
  if (db.sneezes.length === 0) return out;
  let currentUserId = db.sneezes[0].userId;
  let currentLength = 0;
  const flush = () => {
    if (currentLength === 0) return;
    if (currentUserId.toLowerCase() !== UNKNOWN_USER_ID) {
      out.push({ userId: currentUserId, length: currentLength });
    }
  };
  for (const sneeze of db.sneezes) {
    if (sneeze.userId === currentUserId) {
      currentLength += 1;
    } else {
      flush();
      currentUserId = sneeze.userId;
      currentLength = 1;
    }
  }
  flush();
  return out.sort((a, b) => b.length - a.length);
}

/** Per-user extended stats matching the C# StatsForm Random Stats table. */
export type ExtendedUserStats = UserStats & {
  /** Percentage of total non-Unknown sneezes attributable to this user. */
  sneezePercentage: number;
  /** Days between first and last sneeze (inclusive of both endpoints). */
  participationDays: number;
  /** Average days between sneezes during the user's participation. */
  avgDaysPerSneeze: number;
};

export function findExtendedUserStats(db: SneezeDatabase): Map<string, ExtendedUserStats> {
  const base = findUserStats(db);
  // Total sneezes excluding the Unknown user (matches C# Random Stats denominator).
  let totalKnownSneezes = 0;
  for (const [userId, s] of base) {
    if (userId.toLowerCase() !== UNKNOWN_USER_ID) totalKnownSneezes += s.totalSneezes;
  }
  const out = new Map<string, ExtendedUserStats>();
  for (const [userId, s] of base) {
    const firstMs = new Date(s.firstSneezeDate).getTime();
    const lastMs = new Date(s.lastSneezeDate).getTime();
    const participationDays = Math.max(0, (lastMs - firstMs) / (24 * 60 * 60 * 1000));
    const avgDaysPerSneeze = s.totalSneezes > 0 ? participationDays / s.totalSneezes : 0;
    const sneezePercentage =
      totalKnownSneezes > 0 && userId.toLowerCase() !== UNKNOWN_USER_ID
        ? (s.totalSneezes * 100) / totalKnownSneezes
        : 0;
    out.set(userId, { ...s, sneezePercentage, participationDays, avgDaysPerSneeze });
  }
  return out;
}

export function findLongestStreaks(db: SneezeDatabase): Map<string, number> {
  const out = new Map<string, number>();
  if (db.sneezes.length === 0) return out;

  let currentUserId = db.sneezes[0].userId;
  let currentStreak = 0;

  const flush = () => {
    if (currentUserId.toLowerCase() === UNKNOWN_USER_ID) return;
    const prev = out.get(currentUserId) ?? 0;
    if (currentStreak > prev) out.set(currentUserId, currentStreak);
  };

  for (const sneeze of db.sneezes) {
    if (sneeze.userId === currentUserId) {
      currentStreak += 1;
    } else {
      flush();
      currentStreak = 1;
      currentUserId = sneeze.userId;
    }
  }
  flush();
  return out;
}

export type DateRange =
  | 'oneWeek'
  | 'twoWeeks'
  | 'oneMonth'
  | 'threeMonths'
  | 'sixMonths'
  | 'year'
  | 'allTime';

function rangeStartDate(range: DateRange, now: Date): Date {
  const d = new Date(now);
  switch (range) {
    case 'oneWeek':
      d.setDate(d.getDate() - 7);
      return d;
    case 'twoWeeks':
      d.setDate(d.getDate() - 14);
      return d;
    case 'oneMonth':
      d.setMonth(d.getMonth() - 1);
      return d;
    case 'threeMonths':
      d.setMonth(d.getMonth() - 3);
      return d;
    case 'sixMonths':
      d.setMonth(d.getMonth() - 6);
      return d;
    case 'year':
      d.setFullYear(d.getFullYear() - 1);
      return d;
    case 'allTime':
    default:
      return new Date(0);
  }
}

export function estimateApocalypseDate(
  db: SneezeDatabase,
  range: DateRange,
  now: Date = new Date(),
): Date | 'noSneezesInRange' {
  if (db.sneezes.length === 0) return 'noSneezesInRange';
  const startDate = rangeStartDate(range, now);
  let count = 0;
  let firstInRangeMs = 0;
  for (let i = db.sneezes.length - 1; i >= 0; i -= 1) {
    const sd = new Date(db.sneezes[i].date).getTime();
    if (sd < startDate.getTime()) break;
    count += 1;
    firstInRangeMs = sd;
  }
  if (count === 0) return 'noSneezesInRange';
  const msBetween = (now.getTime() - firstInRangeMs) / count;
  const msUntilApocalypse = (db.countdownStart - db.sneezes.length) * msBetween;
  return new Date(now.getTime() + msUntilApocalypse);
}
