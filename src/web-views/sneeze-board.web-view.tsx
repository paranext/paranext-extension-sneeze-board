import { useEffect, useState } from 'react';
import papi from '@papi/frontend';
import { Button } from 'platform-bible-react';
import { useSneezeBoardState } from './use-sneeze-board-state';
import { ConnectionBar } from './components/connection-bar';
import { UserBar } from './components/user-bar';
import { SneezeGrid } from './components/sneeze-grid';
import { StatsDialog } from './components/stats-dialog';
import { estimateApocalypseDate } from '../util/stats';

function SneezeBoardWebView() {
  const state = useSneezeBoardState();
  const [serverIp, setServerIp] = useState('');
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    papi.settings.get('sneezeBoard.serverIp').then((ip) => {
      if (typeof ip === 'string') setServerIp(ip);
    });
  }, []);

  const isConnected = state.connection === 'open';

  const apocalypseText = (() => {
    if (!state.database) return null;
    const result = estimateApocalypseDate(state.database, 'allTime');
    return result === 'noSneezesInRange'
      ? 'No sneezes in range'
      : (result as Date).toLocaleString();
  })();

  const winBanner =
    state.database && state.database.sneezes.length >= state.database.countdownStart ? (
      <p style={{ color: 'gold', fontWeight: 'bold' }}>We win!</p>
    ) : null;

  return (
    <div className="sneeze-board">
      {/* Grid first — primary content sits at the top. */}
      {state.database ? (
        <SneezeGrid
          database={state.database}
          fontSize={14}
          backgroundColor="#FFF"
          onSneezeAction={(s) => {
            if (s.userId !== state.currentUserId) return; // own sneezes only
            // eslint-disable-next-line no-alert
            const action = window.prompt(`Sneeze options: [E]dit comment or [R]emove?`, 'E');
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
        <div className="sneeze-board__grid-placeholder">No database loaded.</div>
      )}

      <ConnectionBar
        connection={state.connection}
        error={state.error}
        defaultIp={serverIp}
        autoConnect={state.autoConnect}
        versionMismatch={state.versionMismatch}
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
      {winBanner}
      {state.database && (
        <div className="sneeze-board__apocalypse-row">
          <span className="sneeze-board__apocalypse-text">
            Estimated final sneeze date: <strong>{apocalypseText}</strong>
          </span>
          <Button onClick={() => setShowStats(true)} disabled={!isConnected}>
            Stats
          </Button>
        </div>
      )}

      {state.database && (
        <StatsDialog open={showStats} onOpenChange={setShowStats} database={state.database} />
      )}
    </div>
  );
}

(globalThis as unknown as { webViewComponent: unknown }).webViewComponent = SneezeBoardWebView;
