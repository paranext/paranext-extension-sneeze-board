import type { SneezeDatabase } from '../bridge/xml/sneeze-database';
import { computeStreakSituation, UNKNOWN_USER_ID } from './stats';

export type StreakCelebration = {
  /** Final comment to attach to the new sneeze (user-typed comment + optional auto suffix). */
  comment: string;
  /** Notification text to surface via papi.notifications, or undefined if nothing notable. */
  notification?: string;
};

/**
 * Streak-celebration logic ported from the C# `SneezeBoardForm.GetLongestStreak`. Given the current
 * database (BEFORE the new sneeze is appended), the user about to sneeze, and the user-typed
 * comment, returns the final comment (possibly with an auto-appended suffix) and the notification
 * text (if any) to display.
 *
 *  Behavior:
 *
 *  - currentStreak === 3, user is NOT the leader, sneezesToVictory > 1
 *      → notification: "the longest streak is X's N — sneeze M more to beat it"
 *  - sneezesToVictory === 1 (this sneeze ties the record)
 *      → notification: "you tied X's record of N — one more to take the lead"
 *      → no comment suffix
 *  - sneezesToVictory === 0 (this sneeze sets a new record)
 *      → if the previous holder was a different user
 *          - notification: "🎉 you beat X's record"
 *          - comment suffix: "<user> beat <prev>'s sneeze streak record."
 *      → if the user already held the record (extending)
 *          - notification: "🎉 the legend continues"
 *          - comment suffix: "The legend continues!"
 *
 *  Guards: returns the input comment unchanged for empty databases and for the Unknown / Nemo user
 *  (matches C# `if (database.Sneezes.Count == 0 || CurrentUser.UserGuid == CommonInfo.UnknownUserId)
 *  return ""`).
 */
export function applyStreakCelebration(
  db: SneezeDatabase | undefined,
  userId: string,
  userComment: string,
  userName: string,
): StreakCelebration {
  if (!db || db.sneezes.length === 0) return { comment: userComment };
  if (userId.toLowerCase() === UNKNOWN_USER_ID) return { comment: userComment };

  const { currentStreak, longestStreak, streakWinnerId, sneezesToVictory } =
    computeStreakSituation(db, userId);
  const winner = streakWinnerId ? db.users.find((u) => u.userId === streakWinnerId) : undefined;
  const winnerName = winner?.name ?? 'someone';

  let notification: string | undefined;
  let suffix = '';

  if (currentStreak === 3 && userId !== streakWinnerId && sneezesToVictory > 1) {
    notification = `The longest sneeze streak is ${winnerName}'s ${longestStreak}. You need to sneeze ${sneezesToVictory} more times to beat it!`;
  } else if (sneezesToVictory === 1) {
    // We just tied the current record. C# called this "one away from breaking",
    // but it's clearer to celebrate the tie explicitly.
    notification =
      userId === streakWinnerId
        ? `You just tied your own ${longestStreak}-sneeze streak record! One more to beat it.`
        : `🤝 You just tied ${winnerName}'s ${longestStreak}-sneeze streak record! One more to take the lead.`;
  } else if (sneezesToVictory === 0) {
    if (userId !== streakWinnerId) {
      notification = `🎉 Congratulations ${userName}! You set a new sneeze streak record! Your ${currentStreak}-sneeze streak beat ${winnerName}'s ${longestStreak}-sneeze streak.`;
      suffix = `${userName} beat ${winnerName}'s sneeze streak record.`;
    } else {
      notification = `🎉 Congratulations ${userName}! You have become a sneezing legend. You have increased your lead and set a new sneeze streak record!`;
      suffix = `The legend continues!`;
    }
  }

  let comment = userComment;
  if (suffix) comment = comment ? `${comment}\n${suffix}` : suffix;
  return { comment, notification };
}
