import { useEffect, useRef, useState } from 'react';
import papi from '@papi/frontend';
import { Button } from 'platform-bible-react';
import { useSneezeBoardState } from './use-sneeze-board-state';
import { ConnectionBar } from './components/connection-bar';
import { UserBar } from './components/user-bar';
import { SneezeGrid } from './components/sneeze-grid';
import { StatsDialog, StatsView } from './components/stats-dialog';
import { estimateApocalypseDate } from '../util/stats';

/** WebView widths below this threshold render Stats inline (replacing the main UI)
 *  instead of opening a Dialog — modals don't fit usefully in tiny panels. */
const COMPACT_BREAKPOINT_PX = 500;

function SneezeBoardWebView() {
  const state = useSneezeBoardState();
  const [serverIp, setServerIp] = useState('');
  const [showStats, setShowStats] = useState(false);

  // Track the WebView's own width — the platform panel size, not window viewport.
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const isCompact = width > 0 && width < COMPACT_BREAKPOINT_PX;

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

  // ── Compact mode: Stats replaces the entire WebView contents ────────────
  if (isCompact && showStats && state.database) {
    return (
      <div ref={rootRef} className="sneeze-board sneeze-board--compact-stats">
        <div className="sneeze-board__compact-stats-header">
          <strong>Sneeze Board Stats</strong>
          <Button size="sm" onClick={() => setShowStats(false)}>
            Back
          </Button>
        </div>
        <div className="sneeze-board__compact-stats-body">
          <StatsView database={state.database} />
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="sneeze-board">
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

      {/* Dialog stats only at non-compact sizes — compact view replaces inline above. */}
      {state.database && !isCompact && (
        <StatsDialog open={showStats} onOpenChange={setShowStats} database={state.database} />
      )}
    </div>
  );
}

(globalThis as unknown as { webViewComponent: unknown }).webViewComponent = SneezeBoardWebView;
