import { useEffect, useRef, useState } from 'react';
import papi from '@papi/frontend';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'platform-bible-react';
import type { SneezeRecord } from 'paranext-extension-sneeze-board';
import { useSneezeBoardState } from './use-sneeze-board-state';
import { ConnectionBar } from './components/connection-bar';
import { UserBar } from './components/user-bar';
import { SneezeGrid } from './components/sneeze-grid';
import { StatsDialog, StatsView } from './components/stats-dialog';
import { estimateApocalypseDate } from '../util/stats';

/**
 * WebView widths below this threshold render Stats inline (replacing the main UI) instead of
 * opening a Dialog — modals don't fit usefully in tiny panels.
 */
const COMPACT_BREAKPOINT_PX = 500;

function SneezeBoardWebView() {
  const state = useSneezeBoardState();
  const [serverIp, setServerIp] = useState('');
  const [showStats, setShowStats] = useState(false);

  /** Controlled comment value for the user bar — lifted here so edit-mode can prefill it. */
  const [comment, setComment] = useState('');
  /** When set, the Sneeze button becomes "Save edit" and operates on this sneeze. */
  const [editingSneeze, setEditingSneeze] = useState<SneezeRecord | undefined>(undefined);

  /** Remove-confirmation dialog target. */
  const [removeTarget, setRemoveTarget] = useState<SneezeRecord | undefined>(undefined);

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

  /** Dispatch the Sneeze button click — either a new sneeze or saving an edit. */
  const handleSneezeOrSave = (userId: string, nextComment: string) => {
    if (editingSneeze) {
      papi.commands.sendCommand('sneezeBoard.updateSneeze', editingSneeze.date, nextComment);
      setEditingSneeze(undefined);
      setComment('');
    } else {
      papi.commands.sendCommand('sneezeBoard.sneeze', userId, nextComment);
      setComment('');
    }
  };

  const cancelEdit = () => {
    setEditingSneeze(undefined);
    setComment('');
  };

  const startEdit = (sneeze: SneezeRecord) => {
    setEditingSneeze(sneeze);
    setComment(sneeze.comment ?? '');
  };

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
          // Use the platform theme background so the grid blends with the
          // surrounding panel in dark mode (no more white block).
          backgroundColor="var(--background)"
          currentUserId={state.currentUserId}
          onEditSneeze={startEdit}
          onRemoveSneeze={(s) => setRemoveTarget(s)}
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
          comment={comment}
          setComment={setComment}
          editingSneeze={editingSneeze}
          onSneeze={handleSneezeOrSave}
          onCancelEdit={cancelEdit}
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

      {/* Remove-confirmation dialog. */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(o) => {
          if (!o) setRemoveTarget(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove sneeze?</DialogTitle>
            <DialogDescription>This will permanently remove the sneeze.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRemoveTarget(undefined)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (removeTarget)
                  papi.commands.sendCommand('sneezeBoard.removeSneeze', removeTarget.date);
                setRemoveTarget(undefined);
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

(globalThis as unknown as { webViewComponent: unknown }).webViewComponent = SneezeBoardWebView;
