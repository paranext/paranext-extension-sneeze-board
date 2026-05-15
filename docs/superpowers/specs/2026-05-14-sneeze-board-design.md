# Sneeze Board — Platform.Bible Extension (Design Spec)

**Date:** 2026-05-14
**Author:** Claude (Opus 4.7) + tj_couch@sil.org
**Status:** Draft for review

## 1. Goal

Reimplement the existing C# `SneezeBoardClient` (`../SneezeBoard/SneezeBoardClient`) as a Platform.Bible extension written in TypeScript. The new extension must connect to the existing `SneezeBoardServer` and faithfully reproduce the client's behavior: receiving the live sneeze database on connect, displaying the numbered sneeze grid, logging new sneezes, editing/removing own sneezes, adding/recoloring users, and showing the apocalypse-date estimate.

## 2. Critical findings (what makes this hard)

### 2.1 The server speaks raw TCP, not WebSocket

`SneezeBoardServer/Server.cs` uses `NetworkCommsDotNet 3.0.3` listening on TCP port `57632` (`CommonInfo.ServerPort` in `SneezeBoardCommon/Messages.cs:23`). The wire format is NetworkComms.Net's binary packet protocol — a Protobuf-encoded `PacketHeader` followed by serialized payload bytes. There is no HTTP, no WebSocket, and no JSON. Payloads for our message types are .NET `XmlSerializer` output (UTF-8 strings).

**Message vocabulary (constants from `SneezeBoardCommon/Messages.cs`):**

Outbound (client → server):

- `DatabaseRequested` — `int` payload (`0`); server replies `DatabaseObject`
- `Sneeze` — `SneezeRecord` XML; server broadcasts `PersonSneezed`
- `AddUser` — `UserInfo` XML; server broadcasts `UserUpdated`
- `UpdateUser` — `UserInfo` XML; server broadcasts `UserUpdated`
- `UpdateSneeze` — `SneezeRecord` XML; server broadcasts `SneezeUpdated`
- `RemoveSneeze` — `SneezeRecord` XML; server broadcasts `SneezeRemoved`

Inbound (server → client):

- `DatabaseObject` — `SneezeDatabase` XML (response to `DatabaseRequested`)
- `PersonSneezed` — `SneezeRecord` XML (broadcast)
- `UserUpdated` — `UserInfo` XML (broadcast)
- `SneezeUpdated` — `SneezeRecord` XML (broadcast)
- `SneezeRemoved` — `SneezeRecord` XML (broadcast)

**XML payload shapes (from `SneezeBoardCommon/`):**

```xml
<SneezeRecord userId="GUID" date="ISO8601-UTC">optional comment text</SneezeRecord>
<UserInfo userId="GUID" color="#RRGGBB">user display name</UserInfo>
<SneezeDatabase Version="1">
  <Sneezes>
    <Sneeze userId="GUID" date="ISO8601-UTC">comment</Sneeze>
    ...
  </Sneezes>
  <Users>
    <User userId="GUID" color="#RRGGBB">name</User>
    ...
  </Users>
</SneezeDatabase>
```

The `CountdownStart` field (default `27002`) is also a child of `SneezeDatabase`. `ServerObject.SerializeToStream` emits no XML declaration, no namespaces, with indentation.

### 2.2 Platform.Bible sandboxes extensions

`paranext-core/src/extension-host/services/extension.service.ts:1316-1348` monkey-patches `Module.prototype.require` to only allow:

- `@papi/backend`, `@papi/core`, `@sillsdev/scripture`, `platform-bible-utils`, `crypto`

And it deletes these globals: `eval`, `Function`, `XMLHttpRequest`, `WebSocket`. `fetch` is replaced with `papi.fetch` (HTTP only).

**Implication: extension code cannot open a TCP socket directly.** We must use `papi.elevatedPrivileges.createProcess.fork()` (`papi.d.ts:6168-6171`) to spawn a Node child process. The child runs as a normal Node process with full access to `net`, `tls`, etc., and communicates with the extension via Node's built-in `child_process` IPC (`process.send` / `child.on('message')`).

### 2.3 The existing extension is obsolete

`paranext-extension-sneeze-board/` imports `papi-frontend`/`papi-backend` (renamed to `@papi/frontend`/`@papi/backend`), uses Vite (template uses Webpack), Node 18 (template requires Node 22 via Volta), `papi-components` (replaced by `platform-bible-react` / shadcn), and an old `IDataProviderEngine` shape. The web-view provider, manifest, and package.json formats have all changed. The extension uses mock data (`lib/sneeze-board.data.json`) — no real connection.

## 3. Decision: rebuild from blank template

**Rebuild.** The amount of code that survives is roughly: the JSON mock data (for offline dev mode) and the conceptual UI layout. Build system, manifest, package.json, every TS file, the entire data-provider model, and the web-view shape all need to change. Updating in place would leave non-canonical patterns and a non-standard Vite build that diverges from the rest of the Platform.Bible ecosystem.

**Requested action from user:** Set up a fresh `paranext-extension-template` clone in this directory before the implementation plan runs. The expected starting state is the file layout in `../paranext-extension-template` with placeholders renamed to `paranext-extension-sneeze-board` / `paranextExtensionSneezeBoard` per the template README's "Replace placeholders" section, manifest `elevatedPrivileges: ["createProcess"]`, and an empty `src/main.ts` activate/deactivate scaffold.

## 4. Approach decision: how to reach the TCP server

Three options were considered:

| Option                                 | Pros                                                                           | Cons                                                                      | Verdict           |
| -------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------- |
| **A. Pure TS in extension main**       | Single artifact; no IPC                                                        | Blocked by sandbox (`net` not requireable)                                | ❌ Infeasible     |
| **B. C# bridge binary**                | Reuses proven NetworkComms.Net library                                         | Ship 30–60 MB self-contained binary per platform; .NET runtime dependency | Possible fallback |
| **C. Forked Node bridge (TypeScript)** | Pure TS; uses Node built-ins (`net`); IPC via `process.send`; no extra runtime | Must reimplement NetworkComms.Net wire format                             | ✅ **Chosen**     |

**Chosen: Option C.** NetworkComms.Net v3.0.3 is open-source and pinned. We implement only the framing and packet types this app needs. Verification: golden-byte fixtures captured from a real C# client + integration tests against a locally-spawned `SneezeBoardServer.exe`.

If protocol reimplementation hits a wall, the fallback is Option B without changing the public extension surface (same IPC contract; bridge becomes a C# binary spawned via `createProcess.spawn`).

## 5. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Platform.Bible Extension (paranext-extension-sneeze-board)        │
│                                                                   │
│  ┌────────────────────────────┐    ┌───────────────────────────┐ │
│  │ Extension main             │    │ Web view (React)          │ │
│  │ (sandboxed Node)           │◄──►│ src/web-views/             │ │
│  │ src/main.ts                │PAPI│   sneeze-board.web-view   │ │
│  │ - spawns bridge            │    │ - SneezeGrid              │ │
│  │ - IPC to bridge            │    │ - User picker             │ │
│  │ - NetworkObject state      │    │ - Add-sneeze form         │ │
│  │ - registers commands       │    │ - Stats dialog            │ │
│  │ - web view provider        │    │ - Connection bar          │ │
│  └─────────────┬──────────────┘    └───────────────────────────┘ │
│                │ Node IPC (process.send / .on('message'))         │
│  ┌─────────────▼──────────────┐                                   │
│  │ Bridge process (Node)      │                                   │
│  │ assets/bridge/index.js     │                                   │
│  │ - SneezeBoardClient        │                                   │
│  │ - NetworkCommsClient       │                                   │
│  │ - PacketHeader codec       │                                   │
│  │ - XML codec                │                                   │
│  └─────────────┬──────────────┘                                   │
└────────────────┼─────────────────────────────────────────────────┘
                 │ TCP :57632 (NetworkComms.Net binary frames)
                 ▼
         SneezeBoardServer.exe
```

Boundaries:

- **Web view**: pure React, no networking. Reads state from a PAPI Network Object; calls commands via `papi.commands.sendCommand`.
- **Extension main**: thin proxy. Owns the bridge subprocess lifecycle. Exposes commands and a Network Object. Persists user settings.
- **Bridge**: owns the TCP socket. Implements NetworkComms.Net framing and XML codecs. Stateless from the extension's perspective — extension restarts the bridge if it dies.

## 6. Component design

### 6.1 Bridge: `src/bridge/network-comms-codec.ts`

Pure functions, no I/O.

```ts
type PacketHeader = {
  packetType: string;
  totalPayloadSize: number;
  packetIdentifier?: string;
  requestedReturnPacketType?: string;
  packetSerializerId?: number; // Protobuf default = 1, NullSerializer = 0
  payloadDataProcessors?: number[];
};

export function encodeHeader(h: PacketHeader): Buffer;
export function decodeHeader(buf: Buffer): PacketHeader;
export function encodePacket(header: PacketHeader, payload: Buffer): Buffer;
// Returns null if not enough bytes; otherwise consumed bytes and the packet.
export function tryDecodePacket(
  buf: Buffer,
): { header: PacketHeader; payload: Buffer; bytesConsumed: number } | null;
```

The packet frame on the wire (NetworkComms.Net v3.0.3, per its open-source `PacketBuilder`/`PacketHeader` source):

```
[ 1 byte:  packet header serializer length ]
[ N bytes: protobuf-encoded PacketHeader   ]
[ M bytes: payload                          ]
```

Where `M = header.totalPayloadSize`. The header carries `payloadPacketType`, `payloadSize`, and optional `requestedReturnPacketType`, `packetIdentifier`. Verified by capturing real bytes (§9.2).

### 6.2 Bridge: `src/bridge/network-comms-client.ts`

Wraps a Node `net.Socket`.

```ts
export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export class NetworkCommsClient {
  connect(host: string, port: number): Promise<void>;
  disconnect(): void;
  send(packetType: string, payload: string): void;
  sendAndAwait(
    packetType: string,
    expectedReply: string,
    payload: string,
    timeoutMs?: number,
  ): Promise<string>;
  on(packetType: string, handler: (payload: string) => void): () => void;
  onState(handler: (s: ConnectionState, err?: string) => void): () => void;
}
```

- Single TCP socket per instance.
- Buffers incoming bytes; calls `tryDecodePacket` in a loop until no more complete frames.
- Routes packets by `header.packetType` to registered handlers.
- `sendAndAwait` records a one-shot correlation by `requestedReturnPacketType` (used only for `DatabaseRequested` → `DatabaseObject`, the one synchronous-ish call in the C# client).
- Default timeout 30000 ms, matching `SneezeClientListener.GetFromServer` 30 s timeout.

### 6.3 Bridge: `src/bridge/xml-codec.ts`

Hand-written XML emitters/parsers. Reason: must byte-match `XmlSerializer` output (no decl, indented, no namespaces) to avoid the C# server choking. We do not need a full XML library — payloads are tiny and shape is fixed.

```ts
type SneezeRecord = { userId: string; date: string /* ISO 8601 UTC */; comment?: string };
type UserInfo = { userId: string; name: string; color: string /* #RRGGBB */ };
type SneezeDatabase = {
  version: number;
  countdownStart: number;
  sneezes: SneezeRecord[];
  users: UserInfo[];
};

export function encodeSneezeRecord(r: SneezeRecord): string;
export function decodeSneezeRecord(xml: string): SneezeRecord;
export function encodeUserInfo(u: UserInfo): string;
export function decodeUserInfo(xml: string): UserInfo;
export function decodeSneezeDatabase(xml: string): SneezeDatabase;
```

Color: C# `ColorTranslator.ToHtml` emits `#RRGGBB` for arbitrary RGB and named-color tokens (e.g. `Sienna`) for known palette entries. The TS encoder always emits `#RRGGBB`. The decoder accepts both `#RRGGBB` and the named-color tokens that appear in real data (we'll enumerate from `database.xml` once captured; otherwise default unknown names to a fallback color and log).

Date: C# `DateTime.ToUniversalTime().ToString()` via `XmlSerializer` produces `YYYY-MM-DDTHH:mm:ss.fffffffZ` (round-trippable). Encoder emits ISO-8601 UTC with millisecond precision (sufficient — the server matches sneezes by exact `Date` equality; we must echo back the same string the server sends us when updating/removing).

### 6.4 Bridge: `src/bridge/sneeze-board-bridge.ts` (entry point)

The forked Node script. Reads IPC messages from extension main, calls into `NetworkCommsClient`, emits events back.

IPC protocol (JSON over `process.send`):

Main → bridge (`Command` messages):

```ts
{ kind: 'connect', host: string, port?: number }
{ kind: 'disconnect' }
{ kind: 'sneeze', record: SneezeRecord }
{ kind: 'addUser', user: UserInfo }
{ kind: 'updateUser', user: UserInfo }
{ kind: 'updateSneeze', record: SneezeRecord }
{ kind: 'removeSneeze', record: SneezeRecord }
```

Bridge → main (`Event` messages):

```ts
{ kind: 'state', state: ConnectionState, error?: string }
{ kind: 'database', db: SneezeDatabase }
{ kind: 'personSneezed', record: SneezeRecord }
{ kind: 'userUpdated', user: UserInfo }
{ kind: 'sneezeUpdated', record: SneezeRecord }
{ kind: 'sneezeRemoved', record: SneezeRecord }
{ kind: 'log', level: 'info'|'warn'|'error', message: string }
```

### 6.5 Extension main: `src/main.ts`

```ts
import papi, { logger } from '@papi/backend';
import type { ExecutionActivationContext, ... } from '@papi/core';
import sneezeBoardWebViewContent from './web-views/sneeze-board.web-view?inline';

export async function activate(context: ExecutionActivationContext) {
  const { createProcess } = context.elevatedPrivileges;
  if (!createProcess) throw new Error('createProcess privilege required');
  const bridge = createProcess.fork(context.executionToken, 'assets/bridge/index.js');
  // - wire bridge.on('message'), bridge.on('exit'), auto-restart on crash
  // - expose NetworkObject 'sneezeBoard.state' (papi.networkObjects.set)
  // - register every command from §6.6 via papi.commands.registerCommand
  // - register web view provider 'sneezeBoard.react' via papi.webViewProviders.register
  // - return a combined Unsubscriber so deactivate cleans up bridge + registrations
}
```

State held in main:

- `connectionState`, `database`, `currentUserId`, `error` — mirrored to NetworkObject
- Bridge child process handle, restart-count, last-known-good IP

### 6.6 Commands (PAPI)

| Command                      | Args                                 | Behavior                                                                                                                                          |
| ---------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sneezeBoard.connect`        | `ip: string`                         | Send `connect` to bridge. Update settings.                                                                                                        |
| `sneezeBoard.disconnect`     | —                                    | Send `disconnect` to bridge.                                                                                                                      |
| `sneezeBoard.sneeze`         | `userId: string`, `comment?: string` | Builds `SneezeRecord(userId, nowUtc, comment)`, sends to bridge.                                                                                  |
| `sneezeBoard.addUser`        | `name: string`, `color: string`      | New GUID, sends.                                                                                                                                  |
| `sneezeBoard.updateUser`     | `userId: string`, `color: string`    | Sends user with current name from cached DB.                                                                                                      |
| `sneezeBoard.updateSneeze`   | `date: string`, `comment: string`    | Looks up sneeze by date, mutates comment, sends.                                                                                                  |
| `sneezeBoard.removeSneeze`   | `date: string`                       | Looks up sneeze by date, sends remove.                                                                                                            |
| `sneezeBoard.openWebView`    | —                                    | Opens or focuses the `sneezeBoard.react` web view via the PAPI web view API (exact method finalized against the current `@papi/backend` surface). |
| `sneezeBoard.setCurrentUser` | `userId: string`                     | Updates the "last sneezer" setting.                                                                                                               |

### 6.7 Settings (PAPI settings store, mirrors C# `Settings.Default`)

`contributions/settings.json` declares:

- `sneezeBoard.serverIp` (string, default `''`)
- `sneezeBoard.lastSneezerId` (string, default `''`)
- `sneezeBoard.dateRange` (enum: `oneWeek`/`twoWeeks`/`oneMonth`/`threeMonths`/`sixMonths`/`year`/`allTime`, default `allTime`)
- `sneezeBoard.boardBackgroundColor` (string `#RRGGBB`, default `#FFFFFF`)
- `sneezeBoard.fontSize` (number, default `12`)

### 6.8 Web view: `src/web-views/sneeze-board.web-view.tsx`

Layout (top-down):

1. **Connection bar**: IP `Input` + `Connect` button + status badge (Idle/Connecting/Connected/Failed).
2. **User row**: `Select` user dropdown with "New..." sentinel + color swatch + `Change color` button (opens color picker dialog) + comment `Input` + `Sneeze` button + Settings/Stats icon buttons.
3. **Apocalypse line**: `Estimated final sneeze date: <computed>` — recomputed from sneezes + date range.
4. **Sneeze grid** (main area): horizontally scrollable grid with fixed-width cells. Each cell shows a countdown number (`countdownStart - index`), colored by the sneezer, with a gold border if the sneeze has a comment. Hover shows tooltip (`Sneeze N`, username, local date, comment). Right-click on own sneeze opens context menu: Edit comment / Remove.
5. **"We win!"** banner appears when `sneezes.length >= countdownStart`.

UI library: `platform-bible-react` (Button, Input, Select, Tooltip, Dialog, Label). The grid is custom CSS — column-major, fixed cell width based on `fontSize`. Implementation mirrors `SneezeBoardForm.lbl_sneeze_display_Paint` (`SneezeBoardClient/SneezeBoardForm.cs:177-239`).

Color picker: HTML `<input type="color">` inside a dialog, with the "color taken" check ported from `SneezeBoardForm.ColorTaken` (`SneezeBoardClient/SneezeBoardForm.cs:546-555`).

Data: subscribes to NetworkObject `sneezeBoard.state` via `usePromise`/`useEvent` hooks. Dispatches commands via `papi.commands.sendCommand`.

### 6.9 Stats logic: `src/util/stats.ts`

Pure functions ported from C#:

- `findUserStats(db)` → `Map<userId, { total, first, last }>` (mirrors `SneezeDatabase.FindUserStats`)
- `findLongestStreaks(db)` → `Map<userId, number>` (mirrors `FindLongestStreaks`)
- `estimateApocalypseDate(db, dateRange)` → `Date | 'noSneezesInRange'` (mirrors `SneezeBoardForm.CalculateApocalypse`)
- `getLongestStreakMessage(db, currentUserId, currentStreak)` → message string or empty (mirrors `GetLongestStreak`)

## 7. Data flow walkthroughs

**Connect:**

1. Web view: user clicks Connect → `papi.commands.sendCommand('sneezeBoard.connect', ip)`
2. Main: sets `connectionState='connecting'`, persists IP, sends `{kind:'connect',host:ip,port:57632}` to bridge
3. Bridge: `socket.connect(57632, ip)` → on `'connect'`: `client.sendAndAwait('DatabaseRequested','DatabaseObject', protobufVarintZero)` and emit `state: 'open'`
4. Server responds with `DatabaseObject` carrying XML `SneezeDatabase`
5. Bridge: decode XML, emit `{kind:'database', db}` to main
6. Main: updates NetworkObject with `database`
7. Web view: re-renders the grid

**Sneeze:**

1. Web view dispatches `sneezeBoard.sneeze(userId, comment)`
2. Main composes record `{userId, date: new Date().toISOString(), comment}`, IPC to bridge
3. Bridge XML-encodes the record, `client.send('Sneeze', xml)`
4. Server appends to database, saves, broadcasts `PersonSneezed` to all clients
5. Bridge receives `PersonSneezed`, XML-decodes, emits `{kind:'personSneezed', record}` to main
6. Main appends to `database.sneezes` in NetworkObject
7. Web view re-renders

**Update / Remove sneeze:** server matches by exact `Date` equality. We must send back the exact same date string we received. Bridge keeps the raw ISO string from the inbound XML; the extension passes the same string back through. Decoder preserves the original string in a parallel field (`SneezeRecord.rawDate`) when needed; encoder uses it preferentially when present.

## 8. Error handling

- **TCP socket error / `'close'` event**: bridge emits `state:'closed'` (or `'error'` with message). Main flips NetworkObject. Web view shows "Connection to server was lost" (red, matches C# `lbl_sneeze_display_Paint`).
- **`sendAndAwait` timeout** (30 s): bridge emits `state:'error', error:'Failed to connect'`. Web view shows "Failed to connect to server at specified IP."
- **`database.version !== 1`**: bridge closes the socket, emits `state:'error', error:'VersionNumberConflict'`. Web view shows the C#-matching message.
- **Protocol decode error**: bridge logs, closes the socket, emits `error`. No silent drops.
- **Bridge child process crashes**: main marks `state:'error'`, exposes a `Reconnect` command that respawns the bridge.
- **Reconnect**: manual via the Connect button only (matches C# behavior).

## 9. Testing strategy

### 9.1 Vitest layout

```
src/bridge/
  network-comms-codec.test.ts        # unit, no I/O
  xml-codec.test.ts                   # unit, no I/O
  network-comms-client.test.ts        # uses an in-memory net.Server
  sneeze-board-bridge.test.ts         # ipc happy paths against fake socket
src/util/
  stats.test.ts                       # pure unit
test/integration/
  real-server.integration.test.ts     # gated by RUN_INTEGRATION=1
test/fixtures/
  packet-database-requested.bin       # captured from real C# client
  packet-database-object.bin
  packet-sneeze.bin
  packet-person-sneezed.bin
  ... (one per message type, both directions)
  xml-database.xml                    # captured from a real database.xml
  xml-sneeze-record.xml
  xml-user-info.xml
```

### 9.2 Golden-byte fixture capture (one-time, manual)

1. Build `SneezeBoardServer` and `SneezeBoardClient` locally (Visual Studio or `dotnet build` on the .NET Framework 4.5.2 projects via mono/dotnet retargeting).
2. Run server: `mono SneezeBoardServer.exe` (or `SneezeBoardServer.exe` on Windows).
3. Run client, point at `127.0.0.1`.
4. Capture TCP traffic with Wireshark (`tcp.port == 57632`) while exercising each message type (connect → request DB, sneeze, add user, update user, update sneeze, remove sneeze).
5. Save each direction's payload for each message type to `test/fixtures/*.bin`.
6. Tests assert: `encodePacket(headerFor('Sneeze'), xmlBuf).equals(fixture)` and vice-versa for decode.

This locks the wire format. If NetworkComms.Net adds undocumented behavior (length-prefixing variants, compression flags), fixtures expose it immediately.

### 9.3 Unit tests

- **Codec round-trip**: for each captured byte fixture, decode → re-encode → assert equality.
- **XML round-trip**: load each XML fixture, decode → re-encode → assert equality.
- **Stats**: ported test cases from C# `SneezeDatabase.FindLongestStreaks` (manually constructed sneeze sequences).

### 9.4 Integration tests (gated `RUN_INTEGRATION=1`)

- `beforeAll`: find a free port; spawn `SneezeBoardServer.exe` bound to that port (CLI flag added if needed, or use a fresh per-test `database.xml` directory via env var); wait for "listening" line.
- `afterAll`: kill the server, clean up temp dir.
- Tests:
  - Connect + request database → receive database (verify shape, version).
  - Add user → expect `UserUpdated` echo.
  - Sneeze → expect `PersonSneezed` echo.
  - Update sneeze comment → expect `SneezeUpdated` echo with new comment.
  - Remove sneeze → expect `SneezeRemoved` echo; subsequent database request omits it.
  - Two clients: client A sneezes, client B receives `PersonSneezed`.

Runs locally on dev machines; CI runs the unit suite only (the server-side `.NET Framework 4.5.2` toolchain on GH Actions is more friction than it's worth for v0.1).

### 9.5 Web view / UI

Manual smoke testing in Platform.Bible (`npm run start`). Vitest snapshot tests for `SneezeGrid` rendering of a small fixture database. No browser-automation suite for v0.1.

## 10. Build / packaging

Three webpack configs (extend the template's two with one more):

- `webpack.config.main.ts` — extension host bundle (`dist/src/main.js`)
- `webpack.config.web-view.ts` — bundled React WebView (`dist/src/web-views/sneeze-board.web-view.js`)
- **NEW** `webpack.config.bridge.ts` — Node target, CommonJS, no externals beyond Node built-ins, outputs `dist/assets/bridge/index.js`. The bridge bundle is fully self-contained — it does not run inside the sandbox.

The manifest's `elevatedPrivileges` adds `"createProcess"`. Assets layout under `dist/assets/bridge/` is copied via `CopyWebpackPlugin` if needed.

## 11. Scope

**In scope (v0.1):**

- All six message types correctly framed and exchanged.
- Web view: grid, connect bar, user picker, add user, change color, sneeze, edit own sneeze, remove own sneeze, comments, apocalypse-date estimate, "we win" banner, connection-state messaging.
- Settings: server IP, last sneezer, date range, board background color, font size.
- Stats dialog: longest streaks list (port of `StatsForm`).

**Out of scope (v0.1):**

- System tray / notify-icon (no Platform.Bible analog for extensions).
- Streak-achievement popups (`GetLongestStreak` message dialogs) — port as a stretch goal.
- Multi-language localization — English-only initially.
- Modifying the server (server changes not part of this work).

## 12. Risks & mitigations

| Risk                                                               | Likelihood | Impact | Mitigation                                                                                                                            |
| ------------------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| NetworkComms.Net wire format has undocumented quirks               | Medium     | High   | Golden-byte fixtures + integration tests against real server. Fallback to C# bridge if blocked.                                       |
| XML encoder doesn't match C# `XmlSerializer` exactly               | Medium     | High   | Captured XML fixtures + round-trip tests. Server matches `SneezeRecord` by date equality only, so most XML differences are tolerated. |
| `createProcess.fork` semantics differ from raw Node `fork`         | Low        | Medium | Verify with a smoke test early; the `papi.d.ts` doc snippet shows direct equivalence.                                                 |
| Real server may have updated since 2019                            | Low        | Low    | Use the C# client source as authoritative; if server diverges, observed bytes win.                                                    |
| Color encoder: server stored `Sienna` (named) instead of `#A0522D` | Low        | Low    | Decoder accepts both forms; encoder always normalizes to `#RRGGBB`.                                                                   |
| Date-string format drift across UTC/local                          | Medium     | High   | Preserve raw inbound date string verbatim for update/remove operations.                                                               |

## 13. Salvage from current repo

- `lib/sneeze-board.data.json`: keep as a dev-mode "demo" fixture if useful (low priority).
- The conceptual UI from `lib/sneeze-board.web-view.tsx` informs the new web view layout, but no code carries over.
- `finalSneezeDate` algorithm in the old web view ≈ `CalculateApocalypse` in C# — port from C# (more complete with date ranges) into `src/util/stats.ts`.

## 14. Open questions deferred to implementation

These will be resolved during implementation, not in this spec:

- Exact `packetSerializerId` value emitted by C# for `string` payloads vs `int` payloads (settle from a single captured fixture).
- Whether NetworkComms.Net's first message includes a connection handshake or just goes straight to the first packet (settle from captured bytes).
- Whether the bridge needs to send a periodic keep-alive (the C# client doesn't — investigate if disconnects happen during idle).
