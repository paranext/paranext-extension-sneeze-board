import { useEffect, useState } from 'react';
import papi from '@papi/frontend';
import { Button } from 'platform-bible-react';
import { useSneezeBoardState } from './use-sneeze-board-state';
import { ConnectionBar } from './components/connection-bar';
import { UserBar } from './components/user-bar';
import { SneezeGrid } from './components/sneeze-grid';
import { estimateApocalypseDate, findLongestStreaks, findUserStats } from '../util/stats';

function SneezeBoardWebView() {
  const state = useSneezeBoardState();
  const [serverIp, setServerIp] = useState('');
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    papi.settings.get('sneezeBoard.serverIp').then((ip) => {
      if (typeof ip === 'string') setServerIp(ip);
    });
  }, []);

  const apocalypseLine = (() => {
    if (!state.database) return null;
    const result = estimateApocalypseDate(state.database, 'allTime');
    const text =
      result === 'noSneezesInRange'
        ? 'No sneezes in range'
        : (result as Date).toLocaleString();
    return <p>Estimated final sneeze date: {text}</p>;
  })();

  const winBanner =
    state.database && state.database.sneezes.length >= state.database.countdownStart ? (
      <p style={{ color: 'gold', fontWeight: 'bold' }}>We win!</p>
    ) : null;

  return (
    <div className="sneeze-board">
      <ConnectionBar
        connection={state.connection}
        error={state.error}
        defaultIp={serverIp}
      />
      {state.database && (
        <UserBar
          users={state.database.users}
          currentUserId={state.currentUserId}
          onSneeze={(userId, comment) =>
            papi.commands.sendCommand('sneezeBoard.sneeze', userId, comment)
          }
        />
      )}
      {apocalypseLine}
      {winBanner}
      <Button variant="ghost" onClick={() => setShowStats(true)}>
        Stats
      </Button>
      {state.database ? (
        <SneezeGrid
          database={state.database}
          fontSize={14}
          backgroundColor="#FFF"
          onSneezeAction={(s) => {
            if (s.userId !== state.currentUserId) return; // own sneezes only
            // eslint-disable-next-line no-alert
            const action = window.prompt(
              `Sneeze options: [E]dit comment or [R]emove?`,
              'E',
            );
            if (!action) return;
            if (action.toUpperCase() === 'E') {
              // eslint-disable-next-line no-alert
              const newComment = window.prompt('New comment:', s.comment ?? '');
              if (newComment !== null)
                papi.commands.sendCommand('sneezeBoard.updateSneeze', s.date, newComment);
            } else if (action.toUpperCase() === 'R') {
              // eslint-disable-next-line no-alert
              if (window.confirm('Remove this sneeze?'))
                papi.commands.sendCommand('sneezeBoard.removeSneeze', s.date);
            }
          }}
        />
      ) : (
        <p>No database loaded.</p>
      )}
      {showStats && state.database && (
        <div
          className="sneeze-board__stats-overlay"
          onClick={() => setShowStats(false)}
          role="presentation"
        >
          <div
            className="sneeze-board__stats"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h3>Stats</h3>
            <h4>Longest streaks</h4>
            <ul>
              {[...findLongestStreaks(state.database).entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([userId, streak]) => {
                  const user = state.database!.users.find((u) => u.userId === userId);
                  return (
                    <li key={userId}>
                      {user?.name ?? userId}: {streak}
                    </li>
                  );
                })}
            </ul>
            <h4>Sneeze counts</h4>
            <ul>
              {[...findUserStats(state.database).entries()]
                .sort((a, b) => b[1].totalSneezes - a[1].totalSneezes)
                .map(([userId, s]) => {
                  const user = state.database!.users.find((u) => u.userId === userId);
                  return (
                    <li key={userId}>
                      {user?.name ?? userId}: {s.totalSneezes}
                    </li>
                  );
                })}
            </ul>
            <Button onClick={() => setShowStats(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}

(globalThis as unknown as { webViewComponent: unknown }).webViewComponent = SneezeBoardWebView;
