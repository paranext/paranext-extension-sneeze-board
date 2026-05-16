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
import { applyStreakCelebration } from './util/streak-celebration';

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

/** Must match SneezeBoardCommon/SneezeDatabase.cs `currentVersionNumber`. */
const EXPECTED_DB_VERSION = 1;
/** Delay before each auto-reconnect attempt. */
const RECONNECT_DELAY_MS = 5_000;

let bridge: ChildProcess | undefined;
let state: SneezeBoardState = { connection: 'idle', autoConnect: true };
let stateChangeEmitter:
  | ReturnType<typeof papi.network.createNetworkEventEmitter<SneezeBoardStateChange>>
  | undefined;

/** IP we last attempted/successfully connected to — used by auto-reconnect. */
let lastConnectIp: string | undefined;
/** Pending reconnect timer (or undefined if none scheduled). */
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
/** When true, the next 'closed' should NOT trigger auto-reconnect (user-initiated disconnect). */
let userInitiatedDisconnect = false;

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

function cancelReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  if (!state.autoConnect) return;
  if (!lastConnectIp) return;
  if (state.versionMismatch) return; // don't reconnect into a known-bad server version
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    if (
      state.autoConnect &&
      lastConnectIp &&
      state.connection !== 'open' &&
      !state.versionMismatch
    ) {
      logger.info(`auto-reconnect attempt to ${lastConnectIp}`);
      sendToBridge({ kind: 'connect', host: lastConnectIp });
    }
  }, RECONNECT_DELAY_MS);
}

function sendSneezeNotification(record: SneezeRecord) {
  const db = state.database;
  const user = db?.users.find((u) => u.userId === record.userId);
  const name = user?.name ?? 'Someone';
  const sneezeNum =
    db && db.countdownStart > db.sneezes.length ? db.countdownStart - db.sneezes.length : undefined;
  const numberSuffix = sneezeNum !== undefined ? ` (#${sneezeNum})` : '';
  const message = record.comment
    ? `${name} sneezed${numberSuffix}: ${record.comment}`
    : `${name} sneezed${numberSuffix}!`;
  papi.notifications
    .send({ message, severity: 'info' })
    .catch((e) => logger.warn(`notification send failed: ${(e as Error).message}`));
}

function handleBridgeEvent(ev: BridgeEvent) {
  switch (ev.kind) {
    case 'state': {
      setState({ connection: ev.state, error: ev.error });
      if (ev.state === 'open') {
        cancelReconnect();
        // Successful connect clears any stale version mismatch.
        if (state.versionMismatch) setState({ versionMismatch: undefined });
      } else if (ev.state === 'closed' || ev.state === 'error') {
        if (userInitiatedDisconnect) {
          userInitiatedDisconnect = false;
        } else {
          scheduleReconnect();
        }
      }
      break;
    }
    case 'database': {
      if (ev.db.version !== EXPECTED_DB_VERSION) {
        logger.warn(
          `Server database version ${ev.db.version} != client expected ${EXPECTED_DB_VERSION}. Disconnecting.`,
        );
        setState({
          versionMismatch: { serverVersion: ev.db.version, clientVersion: EXPECTED_DB_VERSION },
          database: undefined,
        });
        // Disconnect to mirror C# SneezeClientListener.VerifyDatabase behavior.
        userInitiatedDisconnect = true; // suppress auto-reconnect
        sendToBridge({ kind: 'disconnect' });
        cancelReconnect();
        break;
      }
      setState({ database: ev.db });
      break;
    }
    case 'personSneezed': {
      const db = state.database;
      // Dedupe: optimistic local update may have already added this sneeze.
      if (db && !db.sneezes.some((s) => s.date === ev.record.date)) {
        setState({ database: { ...db, sneezes: [...db.sneezes, ev.record] } });
        if (ev.record.userId !== state.currentUserId) sendSneezeNotification(ev.record);
      }
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
    papi.settings.registerValidator(
      'sneezeBoard.autoConnect',
      async (newValue) => typeof newValue === 'boolean',
    ),
  ]);

  const unsubs = await Promise.all([
    papi.commands.registerCommand('sneezeBoard.connect', async (ip: string) => {
      const trimmed = ip.trim();
      try {
        await papi.settings.set('sneezeBoard.serverIp', trimmed);
      } catch (e) {
        logger.warn(`could not persist serverIp: ${(e as Error).message}`);
      }
      lastConnectIp = trimmed;
      cancelReconnect();
      userInitiatedDisconnect = false;
      // Clearing the version-mismatch flag here lets a user retry against an updated server.
      if (state.versionMismatch) setState({ versionMismatch: undefined });
      sendToBridge({ kind: 'connect', host: trimmed });
    }),
    papi.commands.registerCommand('sneezeBoard.disconnect', async () => {
      userInitiatedDisconnect = true;
      cancelReconnect();
      sendToBridge({ kind: 'disconnect' });
    }),
    papi.commands.registerCommand(
      'sneezeBoard.sneeze',
      async (userId: string, comment?: string) => {
        const user = state.database?.users.find((u) => u.userId === userId);
        const { comment: finalComment, notification } = applyStreakCelebration(
          state.database,
          userId,
          comment ?? '',
          user?.name ?? 'You',
        );
        const record = {
          userId,
          date: new Date().toISOString(),
          comment: finalComment || undefined,
        };
        sendToBridge({ kind: 'sneeze', record });
        // Optimistic local update — the C# server's broadcast back to the sender
        // fails on localhost, so apply locally too. Duplicate broadcasts later are deduped.
        const db = state.database;
        if (db) setState({ database: { ...db, sneezes: [...db.sneezes, record] } });
        if (notification) {
          papi.notifications
            .send({ message: notification, severity: 'info' })
            .catch((e) => logger.warn(`streak notification failed: ${(e as Error).message}`));
        }
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
    papi.commands.registerCommand('sneezeBoard.setAutoConnect', async (value: boolean) => {
      // Coerce in case a caller sent a string (e.g. CLI tests via JSON-RPC).
      const coerced = value === true || (value as unknown) === 'true';
      try {
        await papi.settings.set('sneezeBoard.autoConnect', coerced);
      } catch (e) {
        logger.warn(`could not persist autoConnect: ${(e as Error).message}`);
      }
      setState({ autoConnect: coerced });
      if (coerced) {
        // Turned on: try to (re)connect if we have an IP and we're not already open.
        if (state.connection !== 'open' && lastConnectIp && !state.versionMismatch) {
          cancelReconnect();
          sendToBridge({ kind: 'connect', host: lastConnectIp });
        }
      } else {
        // Turned off: cancel any pending reconnect.
        cancelReconnect();
      }
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

  // Restore autoConnect from settings.
  let autoConnect = true;
  try {
    const stored = await papi.settings.get('sneezeBoard.autoConnect');
    if (typeof stored === 'boolean') autoConnect = stored;
  } catch (e) {
    logger.warn(`could not restore autoConnect: ${(e as Error).message}`);
  }
  setState({ autoConnect });

  // Auto-connect at startup if enabled and an IP is configured.
  try {
    const storedIp = await papi.settings.get('sneezeBoard.serverIp');
    if (typeof storedIp === 'string' && storedIp.trim()) {
      lastConnectIp = storedIp.trim();
      if (autoConnect) {
        logger.info(`auto-connecting to ${lastConnectIp}`);
        sendToBridge({ kind: 'connect', host: lastConnectIp });
      }
    }
  } catch (e) {
    logger.warn(`could not read serverIp on activate: ${(e as Error).message}`);
  }

  for (const u of validators) context.registrations.add(u);
  for (const u of unsubs) context.registrations.add(u);
  context.registrations.add(() => {
    cancelReconnect();
    bridge?.kill();
    return true;
  });

  logger.info('Sneeze Board activated.');
}

export async function deactivate() {
  logger.info('Sneeze Board is deactivating!');
  cancelReconnect();
  bridge?.kill();
  bridge = undefined;
  // stateChangeEmitter is disposed via context.registrations; don't dispose twice here.
  stateChangeEmitter = undefined;
  return true;
}
