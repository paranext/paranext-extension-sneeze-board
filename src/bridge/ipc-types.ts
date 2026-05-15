import type { SneezeRecord } from './xml/sneeze-record';
import type { UserInfo } from './xml/user-info';
import type { SneezeDatabase } from './xml/sneeze-database';

export type BridgeCommand =
  | { kind: 'connect'; host: string; port?: number }
  | { kind: 'disconnect' }
  | { kind: 'sneeze'; record: SneezeRecord }
  | { kind: 'addUser'; user: UserInfo }
  | { kind: 'updateUser'; user: UserInfo }
  | { kind: 'updateSneeze'; record: SneezeRecord }
  | { kind: 'removeSneeze'; record: SneezeRecord };

export type BridgeEvent =
  | { kind: 'state'; state: 'idle' | 'connecting' | 'open' | 'closed' | 'error'; error?: string }
  | { kind: 'database'; db: SneezeDatabase }
  | { kind: 'personSneezed'; record: SneezeRecord }
  | { kind: 'userUpdated'; user: UserInfo }
  | { kind: 'sneezeUpdated'; record: SneezeRecord }
  | { kind: 'sneezeRemoved'; record: SneezeRecord }
  | { kind: 'log'; level: 'info' | 'warn' | 'error'; message: string };
