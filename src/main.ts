import papi, { logger } from '@papi/backend';
import type {
  ExecutionActivationContext,
  IWebViewProvider,
  SavedWebViewDefinition,
  WebViewDefinition,
} from '@papi/core';
import type { ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import type {
  SneezeBoardState,
  SneezeBoardStateChange,
  SneezeRecord,
  UserInfo,
} from 'paranext-extension-sneeze-board';

import sneezeBoardWebViewContent from './web-views/sneeze-board.web-view?inline';
import sneezeBoardStyles from './web-views/sneeze-board.web-view.scss?inline';

// Bridge IPC types are duplicated here (importing across the host/bridge boundary is
// awkward; the types are tiny). Keep in sync with src/bridge/ipc-types.ts.
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
const SNEEZE_BOARD_STATE_CHANGE_EVENT = 'sneezeBoard.onDidChangeState';

let bridge: ChildProcess | undefined;
let state: SneezeBoardState = { connection: 'idle' };
let stateChangeEmitter:
  | ReturnType<typeof papi.network.createNetworkEventEmitter<SneezeBoardStateChange>>
  | undefined;

function emitState() {
  try {
    stateChangeEmitter?.emit(state);
  } catch (e) {
    logger.error(`emitState failed: ${(e as Error).message}`);
  }
}

function setState(patch: Partial<SneezeBoardState>) {
  state = { ...state, ...patch };
  emitState();
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
      // Dedupe: optimistic local update may have already added this sneeze.
      if (db && !db.sneezes.some((s) => s.date === ev.record.date))
        setState({ database: { ...db, sneezes: [...db.sneezes, ev.record] } });
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
  async getWebView(savedWebView: SavedWebViewDefinition): Promise<WebViewDefinition | undefined> {
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

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DATE_RANGE_VALUES = [
  'oneWeek',
  'twoWeeks',
  'oneMonth',
  'threeMonths',
  'sixMonths',
  'year',
  'allTime',
] as const;

export async function activate(context: ExecutionActivationContext) {
  logger.info('Sneeze Board is activating!');

  try {
    stateChangeEmitter = papi.network.createNetworkEventEmitter<SneezeBoardStateChange>(
      SNEEZE_BOARD_STATE_CHANGE_EVENT,
    );
    // Register dispose immediately so a partial-activation failure still tears it down.
    context.registrations.add(stateChangeEmitter.dispose);
  } catch (e) {
    logger.warn(
      `createNetworkEventEmitter failed (likely already registered from a previous load): ${(e as Error).message}. Web view will not receive state updates until host restart.`,
    );
    stateChangeEmitter = undefined;
  }

  spawnBridge(context);

  const validators = await Promise.all([
    papi.settings.registerValidator(
      'sneezeBoard.serverIp',
      async (newValue) => typeof newValue === 'string',
    ),
    papi.settings.registerValidator(
      'sneezeBoard.lastSneezerId',
      async (newValue) => typeof newValue === 'string',
    ),
    papi.settings.registerValidator(
      'sneezeBoard.dateRange',
      async (newValue) =>
        typeof newValue === 'string' && (DATE_RANGE_VALUES as readonly string[]).includes(newValue),
    ),
    papi.settings.registerValidator(
      'sneezeBoard.boardBackgroundColor',
      async (newValue) => typeof newValue === 'string' && HEX_COLOR_RE.test(newValue),
    ),
    papi.settings.registerValidator(
      'sneezeBoard.fontSize',
      async (newValue) =>
        typeof newValue === 'number' &&
        Number.isInteger(newValue) &&
        newValue >= 6 &&
        newValue <= 96,
    ),
  ]);

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
        const record = { userId, date: new Date().toISOString(), comment };
        sendToBridge({ kind: 'sneeze', record });
        // Optimistic local update — the C# server's broadcast back to the sender
        // fails on localhost, so apply locally too. Duplicate broadcasts later are deduped.
        const db = state.database;
        if (db) setState({ database: { ...db, sneezes: [...db.sneezes, record] } });
      },
    ),
    papi.commands.registerCommand('sneezeBoard.addUser', async (name: string, color: string) => {
      const user = { userId: randomUUID(), name, color };
      sendToBridge({ kind: 'addUser', user });
      const db = state.database;
      if (db) setState({ database: { ...db, users: [...db.users, user] } });
    }),
    papi.commands.registerCommand(
      'sneezeBoard.updateUser',
      async (userId: string, color: string) => {
        const user = state.database?.users.find((u) => u.userId === userId);
        if (!user) return;
        const updated = { ...user, color };
        sendToBridge({ kind: 'updateUser', user: updated });
        const db = state.database;
        if (db)
          setState({
            database: { ...db, users: db.users.map((u) => (u.userId === userId ? updated : u)) },
          });
      },
    ),
    papi.commands.registerCommand(
      'sneezeBoard.updateSneeze',
      async (date: string, comment: string) => {
        const record = state.database?.sneezes.find((s) => s.date === date);
        if (!record) return;
        const updated = { ...record, comment };
        sendToBridge({ kind: 'updateSneeze', record: updated });
        const db = state.database;
        if (db)
          setState({
            database: { ...db, sneezes: db.sneezes.map((s) => (s.date === date ? updated : s)) },
          });
      },
    ),
    papi.commands.registerCommand('sneezeBoard.removeSneeze', async (date: string) => {
      const record = state.database?.sneezes.find((s) => s.date === date);
      if (!record) return;
      sendToBridge({ kind: 'removeSneeze', record });
      const db = state.database;
      if (db) setState({ database: { ...db, sneezes: db.sneezes.filter((s) => s.date !== date) } });
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
    papi.commands.registerCommand('sneezeBoard.getState', async () => state),
    papi.webViewProviders.registerWebViewProvider(
      SNEEZE_BOARD_WEB_VIEW_TYPE,
      sneezeBoardWebViewProvider,
    ),
  ]);

  // Restore current user from settings (if any).
  try {
    const lastSneezerId = await papi.settings.get('sneezeBoard.lastSneezerId');
    if (typeof lastSneezerId === 'string' && lastSneezerId)
      setState({ currentUserId: lastSneezerId });
  } catch (e) {
    logger.warn(`could not restore lastSneezerId: ${(e as Error).message}`);
  }

  for (const u of validators) context.registrations.add(u);
  for (const u of unsubs) context.registrations.add(u);
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
  // stateChangeEmitter is disposed via context.registrations; don't dispose twice here.
  stateChangeEmitter = undefined;
  return true;
}
