import type { SneezeDatabase } from '../bridge/xml/sneeze-database';

export type UserStats = {
  totalSneezes: number;
  firstSneezeDate: string;
  lastSneezeDate: string;
};

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

const UNKNOWN_USER_ID = '944616bd-20a1-4659-87af-04563043ffde';

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
