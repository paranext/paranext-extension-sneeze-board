import papi, { logger } from '@papi/backend';
import type { ExecutionActivationContext, IWebViewProvider, SavedWebViewDefinition, WebViewDefinition } from '@papi/core';
import type { ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import type {
  SneezeBoardState,
  SneezeRecord,
  UserInfo,
} from 'paranext-extension-sneeze-board';

import sneezeBoardWebViewContent from './web-views/sneeze-board.web-view?inline';
import sneezeBoardStyles from './web-views/sneeze-board.web-view.scss?inline';

// Bridge IPC types are duplicated here (importing across the host/bridge boundary is
// awkward; the types are tiny). Keep these in sync with src/bridge/ipc-types.ts.
type BridgeCommand =
  | { kind: 'connect'; host: string; port?: number }
  | { kind: 'disconnect' }
  | { kind: 'sneeze'; record: SneezeRecord }
  | { kind: 'addUser'; user: UserInfo }
  | { kind: 'updateUser'; user: UserInfo }
  | { kind: 'updateSneeze'; record: SneezeRecord }
  | { kind: 'removeSneeze'; record: SneezeRecord };

type BridgeEvent =
  | { kind: 'state'; state: SneezeBoardState['connection']; error?: string }
  | { kind: 'database'; db: NonNullable<SneezeBoardState['database']> }
  | { kind: 'personSneezed'; record: SneezeRecord }
  | { kind: 'userUpdated'; user: UserInfo }
  | { kind: 'sneezeUpdated'; record: SneezeRecord }
  | { kind: 'sneezeRemoved'; record: SneezeRecord }
  | { kind: 'log'; level: 'info' | 'warn' | 'error'; message: string };

const SNEEZE_BOARD_WEB_VIEW_TYPE = 'sneezeBoard.react';
const SNEEZE_BOARD_NETWORK_OBJECT_ID = 'sneezeBoard.state';

let bridge: ChildProcess | undefined;
let state: SneezeBoardState = { connection: 'idle' };
const stateSubscribers = new Set<(s: SneezeBoardState) => void>();

function setState(patch: Partial<SneezeBoardState>) {
  state = { ...state, ...patch };
  for (const s of stateSubscribers) {
    try {
      s(state);
    } catch (e) {
      logger.error(`subscriber error: ${(e as Error).message}`);
    }
  }
}

function sendToBridge(cmd: BridgeCommand) {
  if (!bridge) {
    logger.warn(`bridge not running; dropping ${cmd.kind}`);
    return;
  }
  bridge.send(cmd);
}

function handleBridgeEvent(ev: BridgeEvent) {
  switch (ev.kind) {
    case 'state':
      setState({ connection: ev.state, error: ev.error });
      break;
    case 'database':
      setState({ database: ev.db });
      break;
    case 'personSneezed': {
      const db = state.database;
      if (db) setState({ database: { ...db, sneezes: [...db.sneezes, ev.record] } });
      break;
    }
    case 'userUpdated': {
      const db = state.database;
      if (!db) break;
      const i = db.users.findIndex((u) => u.userId === ev.user.userId);
      const users =
        i >= 0
          ? db.users.map((u) => (u.userId === ev.user.userId ? ev.user : u))
          : [...db.users, ev.user];
      setState({ database: { ...db, users } });
      break;
    }
    case 'sneezeUpdated': {
      const db = state.database;
      if (!db) break;
      const sneezes = db.sneezes.map((s) => (s.date === ev.record.date ? ev.record : s));
      setState({ database: { ...db, sneezes } });
      break;
    }
    case 'sneezeRemoved': {
      const db = state.database;
      if (!db) break;
      const sneezes = db.sneezes.filter((s) => s.date !== ev.record.date);
      setState({ database: { ...db, sneezes } });
      break;
    }
    case 'log':
      logger[ev.level](`[bridge] ${ev.message}`);
      break;
    default: {
      const exhaustive: never = ev;
      logger.warn(`unknown bridge event: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function spawnBridge(context: ExecutionActivationContext) {
  const { createProcess } = context.elevatedPrivileges;
  if (!createProcess) throw new Error('createProcess elevated privilege required');
  bridge = createProcess.fork(context.executionToken, 'assets/bridge/index.js');
  bridge.on('message', (msg) => handleBridgeEvent(msg as BridgeEvent));
  bridge.on('exit', (code, signal) => {
    logger.warn(`bridge exited code=${code} signal=${signal}`);
    bridge = undefined;
    setState({ connection: 'closed', error: 'Bridge process exited' });
  });
}

const sneezeBoardWebViewProvider: IWebViewProvider = {
  async getWebView(
    savedWebView: SavedWebViewDefinition,
  ): Promise<WebViewDefinition | undefined> {
    if (savedWebView.webViewType !== SNEEZE_BOARD_WEB_VIEW_TYPE) return undefined;
    return {
      ...savedWebView,
      webViewType: SNEEZE_BOARD_WEB_VIEW_TYPE,
      title: 'Sneeze Board',
      content: sneezeBoardWebViewContent,
      styles: sneezeBoardStyles,
    } as WebViewDefinition;
  },
};

export async function activate(context: ExecutionActivationContext) {
  logger.info('Sneeze Board is activating!');
  spawnBridge(context);

  const unsubs = await Promise.all([
    papi.commands.registerCommand('sneezeBoard.connect', async (ip: string) => {
      try {
        await papi.settings.set('sneezeBoard.serverIp', ip);
      } catch (e) {
        logger.warn(`could not persist serverIp: ${(e as Error).message}`);
      }
      sendToBridge({ kind: 'connect', host: ip });
    }),
    papi.commands.registerCommand('sneezeBoard.disconnect', async () => {
      sendToBridge({ kind: 'disconnect' });
    }),
    papi.commands.registerCommand(
      'sneezeBoard.sneeze',
      async (userId: string, comment?: string) => {
        sendToBridge({
          kind: 'sneeze',
          record: { userId, date: new Date().toISOString(), comment },
        });
      },
    ),
    papi.commands.registerCommand('sneezeBoard.addUser', async (name: string, color: string) => {
      sendToBridge({ kind: 'addUser', user: { userId: randomUUID(), name, color } });
    }),
    papi.commands.registerCommand(
      'sneezeBoard.updateUser',
      async (userId: string, color: string) => {
        const user = state.database?.users.find((u) => u.userId === userId);
        if (!user) return;
        sendToBridge({ kind: 'updateUser', user: { ...user, color } });
      },
    ),
    papi.commands.registerCommand(
      'sneezeBoard.updateSneeze',
      async (date: string, comment: string) => {
        const record = state.database?.sneezes.find((s) => s.date === date);
        if (!record) return;
        sendToBridge({ kind: 'updateSneeze', record: { ...record, comment } });
      },
    ),
    papi.commands.registerCommand('sneezeBoard.removeSneeze', async (date: string) => {
      const record = state.database?.sneezes.find((s) => s.date === date);
      if (!record) return;
      sendToBridge({ kind: 'removeSneeze', record });
    }),
    papi.commands.registerCommand('sneezeBoard.setCurrentUser', async (userId: string) => {
      try {
        await papi.settings.set('sneezeBoard.lastSneezerId', userId);
      } catch (e) {
        logger.warn(`could not persist lastSneezerId: ${(e as Error).message}`);
      }
      setState({ currentUserId: userId });
    }),
    papi.commands.registerCommand('sneezeBoard.openWebView', async () =>
      papi.webViews.openWebView(SNEEZE_BOARD_WEB_VIEW_TYPE),
    ),
    papi.webViewProviders.registerWebViewProvider(
      SNEEZE_BOARD_WEB_VIEW_TYPE,
      sneezeBoardWebViewProvider,
    ),
  ]);

  // NetworkObject 'sneezeBoard.state' — proxied to web view.
  const stateNetworkObject = await papi.networkObjects.set(SNEEZE_BOARD_NETWORK_OBJECT_ID, {
    getState: () => Promise.resolve(state),
    subscribeState: (cb: (s: SneezeBoardState) => void) => {
      stateSubscribers.add(cb);
      cb(state); // emit current immediately
      const unsub = async () => {
        stateSubscribers.delete(cb);
        return true;
      };
      return Promise.resolve(unsub);
    },
  });

  // Restore current user from settings (if any).
  try {
    const lastSneezerId = await papi.settings.get('sneezeBoard.lastSneezerId');
    if (typeof lastSneezerId === 'string' && lastSneezerId)
      setState({ currentUserId: lastSneezerId });
  } catch (e) {
    logger.warn(`could not restore lastSneezerId: ${(e as Error).message}`);
  }

  for (const u of unsubs) context.registrations.add(u);
  context.registrations.add(stateNetworkObject.dispose);
  context.registrations.add(() => {
    bridge?.kill();
    return true;
  });

  logger.info('Sneeze Board activated.');
}

export async function deactivate() {
  logger.info('Sneeze Board is deactivating!');
  bridge?.kill();
  bridge = undefined;
  return true;
}
