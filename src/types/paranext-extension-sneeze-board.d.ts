declare module 'paranext-extension-sneeze-board' {
  export type SneezeRecord = { userId: string; date: string; comment?: string };
  export type UserInfo = { userId: string; color: string; name: string };
  export type SneezeDatabase = {
    version: number;
    countdownStart: number;
    sneezes: SneezeRecord[];
    users: UserInfo[];
  };

  export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

  export type SneezeBoardState = {
    connection: ConnectionState;
    error?: string;
    database?: SneezeDatabase;
    currentUserId?: string;
  };

  /** PAPI NetworkObject contract for the Sneeze Board */
  export type SneezeBoardStateNetworkObject = {
    getState(): Promise<SneezeBoardState>;
    subscribeState(callback: (state: SneezeBoardState) => void): Promise<() => Promise<boolean>>;
  };
}
