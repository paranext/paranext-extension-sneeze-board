import { useCallback, useEffect, useState } from 'react';
import papi from '@papi/frontend';
import { useEvent } from 'platform-bible-react';
import type { SneezeBoardState, SneezeBoardStateChange } from 'paranext-extension-sneeze-board';

const SNEEZE_BOARD_STATE_CHANGE_EVENT = 'sneezeBoard.onDidChangeState';

/**
 * Subscribes to the Sneeze Board state. Pulls the initial value via the `sneezeBoard.getState`
 * command, then listens to the `sneezeBoard.onDidChangeState` network event for updates.
 */
export function useSneezeBoardState(): SneezeBoardState {
  const [state, setState] = useState<SneezeBoardState>({ connection: 'idle', autoConnect: true });

  useEffect(() => {
    let cancelled = false;
    papi.commands
      .sendCommand('sneezeBoard.getState')
      .then((initial) => {
        if (!cancelled && initial) setState(initial);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('sneezeBoard.getState failed:', e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEvent(
    papi.network.getNetworkEvent<SneezeBoardStateChange>(SNEEZE_BOARD_STATE_CHANGE_EVENT),
    useCallback((next: SneezeBoardStateChange) => {
      setState(next);
    }, []),
  );

  return state;
}
