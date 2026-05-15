import { useEffect, useState } from 'react';
import papi from '@papi/frontend';
import type {
  SneezeBoardState,
  SneezeBoardStateNetworkObject,
} from 'paranext-extension-sneeze-board';

export function useSneezeBoardState(): SneezeBoardState {
  const [state, setState] = useState<SneezeBoardState>({ connection: 'idle' });

  useEffect(() => {
    let unsub: undefined | (() => Promise<boolean>);
    let cancelled = false;
    (async () => {
      const obj = await papi.networkObjects.get<SneezeBoardStateNetworkObject>('sneezeBoard.state');
      if (cancelled || !obj) return;
      unsub = await obj.subscribeState((s) => setState(s));
    })();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  return state;
}
