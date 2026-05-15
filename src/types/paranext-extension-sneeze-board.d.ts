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

  /** Event payload broadcast on every state change. */
  export type SneezeBoardStateChange = SneezeBoardState;
}

declare module 'papi-shared-types' {
  interface SettingTypes {
    'sneezeBoard.serverIp': string;
    'sneezeBoard.lastSneezerId': string;
    'sneezeBoard.dateRange': string;
    'sneezeBoard.boardBackgroundColor': string;
    'sneezeBoard.fontSize': number;
  }

  interface CommandHandlers {
    'sneezeBoard.connect': (ip: string) => Promise<void>;
    'sneezeBoard.disconnect': () => Promise<void>;
    'sneezeBoard.sneeze': (userId: string, comment?: string) => Promise<void>;
    'sneezeBoard.addUser': (name: string, color: string) => Promise<void>;
    'sneezeBoard.updateUser': (userId: string, color: string) => Promise<void>;
    'sneezeBoard.updateSneeze': (date: string, comment: string) => Promise<void>;
    'sneezeBoard.removeSneeze': (date: string) => Promise<void>;
    'sneezeBoard.setCurrentUser': (userId: string) => Promise<void>;
    'sneezeBoard.openWebView': () => Promise<string | undefined>;
    'sneezeBoard.getState': () => Promise<
      import('paranext-extension-sneeze-board').SneezeBoardState
    >;
  }
}
