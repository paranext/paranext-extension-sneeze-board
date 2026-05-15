import { NetworkCommsClient } from './network-comms/network-comms-client';
import { encodeSneezeRecord, decodeSneezeRecord } from './xml/sneeze-record';
import { encodeUserInfo, decodeUserInfo } from './xml/user-info';
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

client.on('DatabaseObject', (xml) => {
  try {
    send({ kind: 'database', db: decodeSneezeDatabase(xml) });
  } catch (e) {
    log('error', `decode DatabaseObject: ${(e as Error).message}`);
  }
});
client.on('PersonSneezed', (xml) => {
  try {
    send({ kind: 'personSneezed', record: decodeSneezeRecord(xml) });
  } catch (e) {
    log('error', `decode PersonSneezed: ${(e as Error).message}`);
  }
});
client.on('UserUpdated', (xml) => {
  try {
    send({ kind: 'userUpdated', user: decodeUserInfo(xml) });
  } catch (e) {
    log('error', `decode UserUpdated: ${(e as Error).message}`);
  }
});
client.on('SneezeUpdated', (xml) => {
  try {
    send({ kind: 'sneezeUpdated', record: decodeSneezeRecord(xml) });
  } catch (e) {
    log('error', `decode SneezeUpdated: ${(e as Error).message}`);
  }
});
client.on('SneezeRemoved', (xml) => {
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
        // Request the database immediately after connect (mirrors C# client's GetDatabase flow).
        //
        // NOTE: the C# client sends `int 0` as the payload. NetworkComms.Net's int serializer
        // emits the protobuf-net wrapper which for a default(int)=0 is an empty payload, but
        // the wire fixture has not yet been captured to confirm. For now we send the UTF-8
        // string "0"; if the real server rejects this, swap for `client.send('DatabaseRequested', '')`
        // or extend `NetworkCommsClient` with a `sendBinary` API.
        client.send('DatabaseRequested', '0');
        break;
      }
      case 'disconnect':
        client.disconnect();
        break;
      case 'sneeze':
        client.send('Sneeze', encodeSneezeRecord(msg.record));
        break;
      case 'addUser':
        client.send('AddUser', encodeUserInfo(msg.user));
        break;
      case 'updateUser':
        client.send('UpdateUser', encodeUserInfo(msg.user));
        break;
      case 'updateSneeze':
        client.send('UpdateSneeze', encodeSneezeRecord(msg.record));
        break;
      case 'removeSneeze':
        client.send('RemoveSneeze', encodeSneezeRecord(msg.record));
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
