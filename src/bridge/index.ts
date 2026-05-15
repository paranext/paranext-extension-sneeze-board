import { NetworkCommsClient } from './network-comms/network-comms-client';
import { PT } from './network-comms/packet-types';
import { decodeSneezeRecord, encodeSneezeRecord } from './xml/sneeze-record';
import { decodeUserInfo, encodeUserInfo } from './xml/user-info';
import { decodeSneezeDatabase } from './xml/sneeze-database';
import type { BridgeCommand, BridgeEvent } from './ipc-types';

const client = new NetworkCommsClient();

function send(msg: BridgeEvent) {
  if (process.send) process.send(msg);
  // eslint-disable-next-line no-console
  else console.error('[bridge] no IPC channel; dropped:', msg);
}

function log(level: 'info' | 'warn' | 'error', message: string) {
  send({ kind: 'log', level, message });
}

client.onState((state, error) => send({ kind: 'state', state, error }));

client.on(PT.DatabaseObject, (xml) => {
  try {
    send({ kind: 'database', db: decodeSneezeDatabase(xml) });
  } catch (e) {
    log('error', `decode DatabaseObject: ${(e as Error).message}`);
  }
});
client.on(PT.PersonSneezed, (xml) => {
  try {
    send({ kind: 'personSneezed', record: decodeSneezeRecord(xml) });
  } catch (e) {
    log('error', `decode PersonSneezed: ${(e as Error).message}`);
  }
});
client.on(PT.UserUpdated, (xml) => {
  try {
    send({ kind: 'userUpdated', user: decodeUserInfo(xml) });
  } catch (e) {
    log('error', `decode UserUpdated: ${(e as Error).message}`);
  }
});
client.on(PT.SneezeUpdated, (xml) => {
  try {
    send({ kind: 'sneezeUpdated', record: decodeSneezeRecord(xml) });
  } catch (e) {
    log('error', `decode SneezeUpdated: ${(e as Error).message}`);
  }
});
client.on(PT.SneezeRemoved, (xml) => {
  try {
    send({ kind: 'sneezeRemoved', record: decodeSneezeRecord(xml) });
  } catch (e) {
    log('error', `decode SneezeRemoved: ${(e as Error).message}`);
  }
});

process.on('message', async (msg: BridgeCommand) => {
  try {
    switch (msg.kind) {
      case 'connect': {
        await client.connect(msg.host, msg.port ?? 57632);
        // After successful handshake, request the full database (mirrors C#
        // SneezeClientListener.GetDatabase). Payload is `int 0` (4 bytes LE).
        client.sendInt32(PT.DatabaseRequested, 0, { requestedReturn: PT.DatabaseObject });
        log('info', 'sent DatabaseRequested');
        break;
      }
      case 'disconnect':
        client.disconnect();
        break;
      case 'sneeze':
        client.send(PT.Sneeze, encodeSneezeRecord(msg.record));
        break;
      case 'addUser':
        client.send(PT.AddUser, encodeUserInfo(msg.user));
        break;
      case 'updateUser':
        client.send(PT.UpdateUser, encodeUserInfo(msg.user));
        break;
      case 'updateSneeze':
        client.send(PT.UpdateSneeze, encodeSneezeRecord(msg.record));
        break;
      case 'removeSneeze':
        client.send(PT.RemoveSneeze, encodeSneezeRecord(msg.record));
        break;
      default: {
        const exhaustive: never = msg;
        log('error', `unknown bridge command: ${JSON.stringify(exhaustive)}`);
      }
    }
  } catch (e) {
    log('error', `bridge command ${(msg as BridgeCommand).kind} failed: ${(e as Error).message}`);
  }
});

process.on('uncaughtException', (err) => {
  log('error', `uncaughtException: ${err.message}`);
});
process.on('unhandledRejection', (reason) => {
  log('error', `unhandledRejection: ${String(reason)}`);
});
const onExit = () => {
  try {
    client.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(0);
};
process.on('SIGTERM', onExit);
process.on('SIGINT', onExit);

log('info', 'bridge started');
