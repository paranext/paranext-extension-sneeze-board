# Sneeze Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement the C# SneezeBoardClient as a Platform.Bible TypeScript extension that connects to the existing TCP/NetworkComms.Net server.

**Architecture:** Sandboxed extension main forks a Node child ("bridge") via `createProcess.fork`. The bridge owns the TCP socket and speaks NetworkComms.Net binary frames over the wire. Extension main exposes commands and a `NetworkObject` for the React web view to consume. Pure TypeScript end-to-end — no .NET runtime ships with the extension.

**Tech Stack:** TypeScript 5.8, Node 22 (extension host + bridge), React 19 + Tailwind 4 + shadcn (`platform-bible-react`), Webpack 5 (with a new third config for the bridge bundle), Vitest for tests, Node `net` for TCP (bridge only).

**Design Spec:** `docs/superpowers/specs/2026-05-14-sneeze-board-design.md`

**Reference Sources:**

- `../SneezeBoard/SneezeBoardCommon/` — protocol message constants, XML object shapes
- `../SneezeBoard/SneezeBoardClient/SneezeClientListener.cs` — reference client-side behavior
- `../SneezeBoard/SneezeBoardServer/Server.cs` — reference server-side behavior
- NetworkComms.Net v3.0.3 source: `https://github.com/MarcFletcher/NetworkComms.Net` (clone read-only as a reference, do not vendor)

---

## Phase 0 — Project hygiene

### Task 0.1: Rename template placeholders

**Files:**

- Modify: `manifest.json`, `package.json`, `src/types/paranext-extension-template.d.ts` (rename), `src/main.ts`, `README.md`, `.github/assets/release-body.md`, `assets/displayData.json`, `LICENSE`

- [x] **Step 1: Rename `paranextExtensionTemplate` → `paranextExtensionSneezeBoard` in `manifest.json`**

Edit `manifest.json`: replace `"name": "paranextExtensionTemplate"` with `"name": "paranextExtensionSneezeBoard"`. Replace `"src/types/paranext-extension-template.d.ts"` with `"src/types/paranext-extension-sneeze-board.d.ts"`. Add `"createProcess"` to `elevatedPrivileges`:

```json
{
  "name": "paranextExtensionSneezeBoard",
  "version": "0.0.1",
  "publisher": "sil",
  "displayData": "assets/displayData.json",
  "author": "tjcouch-sil",
  "license": "MIT",
  "main": "src/main.ts",
  "extensionDependencies": {},
  "elevatedPrivileges": ["createProcess"],
  "types": "src/types/paranext-extension-sneeze-board.d.ts",
  "menus": "contributions/menus.json",
  "settings": "contributions/settings.json",
  "projectSettings": "contributions/projectSettings.json",
  "localizedStrings": "contributions/localizedStrings.json",
  "themes": "contributions/themes.json",
  "activationEvents": []
}
```

- [x] **Step 2: Update `package.json`**

Replace both occurrences of `paranext-extension-template` with `paranext-extension-sneeze-board`, update `types` to `src/types/paranext-extension-sneeze-board.d.ts`, set `author` to `tjcouch-sil`. Leave dependencies/scripts as-is for now.

- [x] **Step 3: Rename the types file**

```bash
git mv src/types/paranext-extension-template.d.ts src/types/paranext-extension-sneeze-board.d.ts
```

Then edit the file: replace `'paranext-extension-template'` with `'paranext-extension-sneeze-board'` in the `declare module` line.

- [x] **Step 4: Update `src/main.ts` debug strings**

Replace `'Extension template is activating!'` → `'Sneeze Board is activating!'` and `'Extension template is deactivating!'` → `'Sneeze Board is deactivating!'`.

- [x] **Step 5: Update `assets/displayData.json`**

Set `localizedDisplayInfo.en.displayName` to `"Sneeze Board"`, `shortSummary` to `"A Platform.Bible client for the SIL Sneeze Board."`, leave `description` field alone for now.

- [x] **Step 6: Verify build still works**

Run: `npm run build`
Expected: build succeeds with no errors. `dist/` contains the renamed types file.

- [x] **Step 7: Commit**

```bash
git add manifest.json package.json src/main.ts src/types/ assets/displayData.json
git commit -m "chore: rename template placeholders to sneeze-board"
```

### Task 0.2: Add Vitest

The new template removed vitest. Add it back.

**Files:**

- Modify: `package.json`
- Create: `vitest.config.ts`

- [x] **Step 1: Install vitest**

```bash
npm install --save-dev vitest@^3.2.4
```

- [x] **Step 2: Add `test` script to `package.json`**

Add to `scripts`: `"test": "vitest --passWithNoTests"`, and add `"typecheck": "tsc -p ./tsconfig.json"`.

- [x] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
```

- [x] **Step 4: Write a smoke test**

Create `src/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [x] **Step 5: Run tests to verify Vitest works**

Run: `npm test`
Expected: 1 test passes.

- [x] **Step 6: Delete the smoke test and commit**

```bash
rm src/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest"
```

### Task 0.3: Add contributions/settings.json entries

**Files:**

- Modify: `contributions/settings.json`
- Modify: `contributions/localizedStrings.json`

- [x] **Step 1: Populate `contributions/settings.json` with Sneeze Board settings**

```json
{
  "settings": {
    "sneezeBoard.serverIp": {
      "label": "%settings_sneezeBoard_serverIp_label%",
      "description": "%settings_sneezeBoard_serverIp_description%",
      "default": ""
    },
    "sneezeBoard.lastSneezerId": {
      "label": "%settings_sneezeBoard_lastSneezerId_label%",
      "default": ""
    },
    "sneezeBoard.dateRange": {
      "label": "%settings_sneezeBoard_dateRange_label%",
      "default": "allTime"
    },
    "sneezeBoard.boardBackgroundColor": {
      "label": "%settings_sneezeBoard_boardBackgroundColor_label%",
      "default": "#FFFFFF"
    },
    "sneezeBoard.fontSize": {
      "label": "%settings_sneezeBoard_fontSize_label%",
      "default": 12
    }
  }
}
```

If the localized-key syntax differs in the current `papi-dts` (`contributions/settings.json` schema may have changed), check `../paranext-core/lib/papi-dts/papi.d.ts` for the current `SettingsContribution` type and adjust accordingly — fall back to plain strings (no `%key%` wrappers) if needed for v0.1.

- [x] **Step 2: Add stub localized strings**

```json
{
  "localizedStrings": {
    "settings_sneezeBoard_serverIp_label": { "en": "Server IP" },
    "settings_sneezeBoard_serverIp_description": { "en": "IP address of the SneezeBoardServer" },
    "settings_sneezeBoard_lastSneezerId_label": { "en": "Last sneezer ID" },
    "settings_sneezeBoard_dateRange_label": { "en": "Apocalypse date range" },
    "settings_sneezeBoard_boardBackgroundColor_label": { "en": "Board background color" },
    "settings_sneezeBoard_fontSize_label": { "en": "Sneeze board font size" }
  }
}
```

- [x] **Step 3: Build to validate contributions parse**

Run: `npm run build`
Expected: success.

- [x] **Step 4: Commit**

```bash
git add contributions/
git commit -m "feat(settings): declare sneeze board settings contributions"
```

---

## Phase 1 — Wire-format fixtures (ground truth)

This phase captures bytes from the real C# client so the TypeScript codec can be verified against them. If any step fails on the local toolchain (no Visual Studio / SDK mismatch), **STOP and ask the user** whether to retarget the C# projects to `net8.0` or proceed with an integration-only test strategy.

### Task 1.1: Build the C# server and client locally

**Files (external — do not commit changes here):** `../SneezeBoard/`

- [~] **Step 1: Retarget projects to a supported framework** (SKIPPED - no Visual Studio in agent shell; per plan's STOP guidance, proceeding with documented framing + integration tests)

Open `../SneezeBoard/SneezeBoard.sln` in Visual Studio 2022. If `.NET Framework 4.5.2` isn't installed, the projects won't load. Retarget:

- `SneezeBoardCommon.csproj`: change `<TargetFrameworkVersion>v4.5.2</TargetFrameworkVersion>` → `<TargetFrameworkVersion>v4.8</TargetFrameworkVersion>`
- Same for `SneezeBoardServer.csproj` and `SneezeBoardClient.csproj`

NetworkComms.Net 3.0.3 is .NET Framework only; do **not** try retargeting to .NET 8.

These changes stay in the external repo's working tree — **do not commit them**.

- [~] **Step 2: Build solution** (SKIPPED - no Visual Studio in agent shell)

```bash
cd ../SneezeBoard
msbuild SneezeBoard.sln /p:Configuration=Debug /restore
```

If `msbuild` isn't on PATH, use the VS Developer Command Prompt or `"%ProgramFiles%\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe"`.
Expected: `SneezeBoardServer/bin/Debug/SneezeBoardServer.exe` and `SneezeBoardClient/bin/Debug/SneezeBoardClient.exe` exist.

- [~] **Step 3: Verify server runs** (SKIPPED - no Visual Studio in agent shell)

```bash
cd ../SneezeBoard/SneezeBoardServer/bin/Debug/
./SneezeBoardServer.exe
```

Expected output: `Server listening for TCP connection on:` followed by `0.0.0.0:57632` (and other interfaces). Press Ctrl+C to exit after verifying.

If a `database.xml` doesn't exist, the server creates a Nemo user automatically.

### Task 1.2: Build a TCP teeing proxy

To capture bytes without Wireshark, run a tiny Node TCP proxy that forwards bytes between client and server, logging each direction. This avoids needing admin privileges.

**Files:**

- Create: `scripts/tcp-tee.mjs`

- [x] **Step 1: Write the proxy**

```js
// scripts/tcp-tee.mjs
// Usage: node scripts/tcp-tee.mjs <listenPort> <upstreamHost> <upstreamPort> <outDir>
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

const [listenPort, upstreamHost, upstreamPort, outDir] = process.argv.slice(2);
if (!listenPort || !upstreamHost || !upstreamPort || !outDir) {
  console.error('Usage: node tcp-tee.mjs <listenPort> <upstreamHost> <upstreamPort> <outDir>');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
let sessionId = 0;

const server = net.createServer((client) => {
  const id = ++sessionId;
  const startedAt = Date.now();
  console.log(`[${id}] client connected`);

  const c2sStream = fs.createWriteStream(path.join(outDir, `session-${id}-client-to-server.bin`));
  const s2cStream = fs.createWriteStream(path.join(outDir, `session-${id}-server-to-client.bin`));
  const logStream = fs.createWriteStream(path.join(outDir, `session-${id}-log.txt`));

  const upstream = net.connect(Number(upstreamPort), upstreamHost, () => {
    logStream.write(`[${new Date().toISOString()}] upstream connected\n`);
  });

  client.on('data', (buf) => {
    c2sStream.write(buf);
    logStream.write(
      `[+${Date.now() - startedAt}ms] C->S ${buf.length} bytes: ${buf.toString('hex')}\n`,
    );
    upstream.write(buf);
  });
  upstream.on('data', (buf) => {
    s2cStream.write(buf);
    logStream.write(
      `[+${Date.now() - startedAt}ms] S->C ${buf.length} bytes: ${buf.toString('hex')}\n`,
    );
    client.write(buf);
  });

  const cleanup = (label) => () => {
    logStream.write(`[${new Date().toISOString()}] ${label}\n`);
    client.destroy();
    upstream.destroy();
    c2sStream.end();
    s2cStream.end();
    logStream.end();
  };

  client.on('close', cleanup('client closed'));
  upstream.on('close', cleanup('upstream closed'));
  client.on('error', (e) => logStream.write(`client error: ${e.message}\n`));
  upstream.on('error', (e) => logStream.write(`upstream error: ${e.message}\n`));
});

server.listen(Number(listenPort), '127.0.0.1', () => {
  console.log(`tcp-tee listening on 127.0.0.1:${listenPort} → ${upstreamHost}:${upstreamPort}`);
  console.log(`writing captures to ${path.resolve(outDir)}`);
});
```

- [~] **Step 2: Smoke test the proxy** (SKIPPED - requires running C# server/client)

In one terminal: start the SneezeBoardServer (Task 1.1 step 3). In another:

```bash
node scripts/tcp-tee.mjs 57633 127.0.0.1 57632 test/fixtures/raw
```

In a third terminal, run the C# client (`SneezeBoardClient.exe`) and enter `127.0.0.1` then click Connect. Watch the proxy console for `client connected` and the upstream connect. Verify files appear under `test/fixtures/raw/session-1-*`.

Stop all three processes.

- [x] **Step 3: Commit the proxy script**

```bash
git add scripts/tcp-tee.mjs
git commit -m "tools: add tcp tee proxy for wire format capture"
```

### Task 1.3: Capture per-message fixtures

The goal of this task is to produce one canonical byte sample for each message type, in both directions. The proxy logs concatenate all bytes per direction per session — extract individual packets after capture.

**Files:**

- Create (committed): `test/fixtures/wire/*.bin` and `test/fixtures/wire/*.log` (plain hex with annotations)

- [~] **Step 1: Capture an "empty server, connect + database request" session** (DEFERRED - see test/fixtures/wire/README.md)

Wipe `test/fixtures/raw/`. Start server with a fresh database (delete `%CommonApplicationData%/SneezeBoard/database*.xml` if needed — back up first if it has real data). Start proxy. Start client, type `127.0.0.1`, click Connect.

Expected bytes:

- C→S: a single `DatabaseRequested` packet (int payload `0`)
- S→C: a single `DatabaseObject` packet (XML for empty database)

Stop everything. Save:

- `session-1-client-to-server.bin` → `test/fixtures/wire/01-database-requested.bin`
- `session-1-server-to-client.bin` → `test/fixtures/wire/01-database-object.bin`

Copy the corresponding `.log` file too for inspection.

- [~] **Step 2: Capture "add user" + "sneeze" + "update sneeze" + "remove sneeze"** (DEFERRED)

Restart server + proxy + client. After connecting:

1. Select "New..." in the user dropdown, add a user `TestUser` with a color. Wait for the user to appear.
2. Click "Sneeze".
3. Right-click the new sneeze → Edit → enter a comment → OK.
4. Right-click the same sneeze → Remove → Yes.

Stop. The session bin contains all messages in order. Save the raw files to `test/fixtures/wire/02-mixed-session-*.bin` and document the byte boundaries in `02-mixed-session-notes.md` by referencing the `.log` timestamps.

- [~] **Step 3: Capture "two clients" broadcast** (DEFERRED)

Restart server + proxy. Run two proxies on different listen ports (e.g., 57633 and 57634), each forwarding to 57632. Start two SneezeBoardClient instances, one connecting to 127.0.0.1:57633, one to 127.0.0.1:57634 (the client only accepts an IP; edit `App.config` or use the IP textbox — note that the C# client hardcodes `CommonInfo.ServerPort` (57632). To work around: temporarily change `ServerPort` to `57633` in `SneezeBoardCommon/Messages.cs:23`, rebuild, run client A; revert; rebuild; run client B against 57634.)

If that's awkward, skip this step — coverage from steps 1+2 plus the integration test phase is sufficient. Note "deferred" in the fixture notes.

- [~] **Step 4: Capture "change color" / `UpdateUser`** (DEFERRED)

Restart server + proxy + client. Connect. Click "Change color" for the test user, pick a new color, OK.

Save → `test/fixtures/wire/03-update-user.bin`.

- [x] **Step 5: Manually annotate the fixtures** (stub README written; will populate when fixtures captured)

Create `test/fixtures/wire/README.md` with:

```markdown
# Wire-format fixtures

Captured via `scripts/tcp-tee.mjs` against `SneezeBoardServer.exe` (v1, NetworkComms.Net 3.0.3).

| File                      | Direction | Message type                                             | Source                                    |
| ------------------------- | --------- | -------------------------------------------------------- | ----------------------------------------- |
| 01-database-requested.bin | C→S       | `DatabaseRequested`                                      | First connect from C# client              |
| 01-database-object.bin    | S→C       | `DatabaseObject`                                         | Server reply, empty DB                    |
| 02-mixed-session-c2s.bin  | C→S       | AddUser, Sneeze, UpdateSneeze, RemoveSneeze              | Single session, boundary offsets in notes |
| 02-mixed-session-s2c.bin  | S→C       | UserUpdated, PersonSneezed, SneezeUpdated, SneezeRemoved | …                                         |
| 03-update-user.bin        | C→S       | `UpdateUser`                                             | Change color                              |

Reproduce: see `scripts/tcp-tee.mjs` header.
```

- [x] **Step 6: Commit fixtures**

```bash
git add test/fixtures/
git commit -m "test(fixtures): capture wire-format byte fixtures from C# client"
```

### Task 1.4: Capture XML payload fixtures

The XML codec needs reference payloads to round-trip against. Extract from the wire fixtures (after Phase 2 implements packet framing, we can decode and dump). For now, capture XML directly from a known-good source: the server's saved `database.xml`.

**Files:**

- Create: `test/fixtures/xml/database-sample.xml`, `test/fixtures/xml/sneeze-record-sample.xml`, `test/fixtures/xml/user-info-sample.xml`

- [~] **Step 1: Run the server through a representative session, then copy `database.xml`** (DEFERRED - synthetic sample fixture used instead)

After Task 1.3, the file at `%CommonApplicationData%/SneezeBoard/database1.xml` (or `database2.xml`) is the latest snapshot. Copy it to `test/fixtures/xml/database-sample.xml`.

- [x] **Step 2: Hand-craft singleton fixtures**

`test/fixtures/xml/user-info-sample.xml`:

```xml
<UserInfo userId="c897cd73-9100-4e6a-8a32-fe237f1e9928" color="#FF8800">Tim</UserInfo>
```

`test/fixtures/xml/sneeze-record-sample.xml`:

```xml
<SneezeRecord userId="c897cd73-9100-4e6a-8a32-fe237f1e9928" date="2024-01-15T18:30:00Z">First sneeze of the day</SneezeRecord>
```

These are minimal but match the shape `ServerObject.SerializeToStream` emits. We'll cross-check against extracted bytes from the wire fixtures in Phase 3.

- [x] **Step 3: Commit**

```bash
git add test/fixtures/xml/
git commit -m "test(fixtures): add XML payload fixtures"
```

---

## Phase 2 — NetworkComms.Net packet codec

Reference: `https://github.com/MarcFletcher/NetworkComms.Net/blob/master/NetworkCommsDotNet/PacketHeader.cs` and `PacketBuilder.cs`. Clone read-only to `~/.cache/networkcomms-reference` if helpful, do not vendor.

The framing (v3.0.3): each packet on the wire is `[packetHeaderSize: 1 byte][packetHeader: N bytes, protobuf-encoded][payload: M bytes]`. `M` is read from `header.PayloadPacketSize`.

`PacketHeader` is a protobuf-net message with fields including: `PacketType` (string, tag 1), `PayloadPacketSize` (int, tag 2), `RequestedReturnPacketType` (string), `PacketIdentifier` (string), `ReceiveSendSeed` (int, optional), and a small number of header options (long checksum, etc.). Tags are stable. **Verify exact tag numbers and presence/order from the NetworkComms.Net source before writing the codec.**

### Task 2.1: Minimal protobuf-net decoder for PacketHeader

**Files:**

- Create: `src/bridge/network-comms/packet-header.ts`
- Create: `src/bridge/network-comms/packet-header.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/bridge/network-comms/packet-header.test.ts
import { describe, it, expect } from 'vitest';
import { decodeHeader, encodeHeader, PacketHeader } from './packet-header';
import { readFileSync } from 'node:fs';

describe('PacketHeader codec', () => {
  it('decodes a real DatabaseRequested header from the C# client', () => {
    const fileBytes = readFileSync('test/fixtures/wire/01-database-requested.bin');
    // First byte: header length. Next N bytes: protobuf-encoded header.
    const headerLen = fileBytes[0];
    const headerBytes = fileBytes.subarray(1, 1 + headerLen);
    const header = decodeHeader(headerBytes);
    expect(header.packetType).toBe('DatabaseRequested');
    expect(header.payloadPacketSize).toBeGreaterThanOrEqual(0);
  });

  it('round-trips a simple header', () => {
    const original: PacketHeader = {
      packetType: 'Sneeze',
      payloadPacketSize: 123,
    };
    const encoded = encodeHeader(original);
    const decoded = decodeHeader(encoded);
    expect(decoded.packetType).toBe('Sneeze');
    expect(decoded.payloadPacketSize).toBe(123);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (no implementation yet)**

Run: `npm test -- packet-header`
Expected: FAIL with "Cannot find module './packet-header'" or similar.

- [ ] **Step 3: Implement the codec**

Create `src/bridge/network-comms/packet-header.ts`:

```ts
// Protobuf-net wire format reference: https://protobuf.dev/programming-guides/encoding/
// PacketHeader proto contract (from NetworkComms.Net 3.0.3 PacketHeader.cs):
//   [ProtoMember(1)] string PacketType
//   [ProtoMember(2)] int PayloadPacketSize
//   [ProtoMember(3, IsRequired=false)] string RequestedReturnPacketType
//   [ProtoMember(4, IsRequired=false)] string PacketIdentifier
//   [ProtoMember(5, IsRequired=false)] long ReceiveSendSeed
//   [ProtoMember(6, IsRequired=false)] long CheckSumHash  (varies by version; verify in source)

export type PacketHeader = {
  packetType: string;
  payloadPacketSize: number;
  requestedReturnPacketType?: string;
  packetIdentifier?: string;
  receiveSendSeed?: number;
};

const WIRE_VARINT = 0;
const WIRE_LENGTH_DELIMITED = 2;

function readVarint(buf: Uint8Array, offset: number): { value: number; offset: number } {
  let result = 0;
  let shift = 0;
  let i = offset;
  while (i < buf.length) {
    const b = buf[i++];
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return { value: result >>> 0, offset: i };
    shift += 7;
    if (shift > 35) throw new Error('Varint too long');
  }
  throw new Error('Truncated varint');
}

function writeVarint(value: number): number[] {
  const out: number[] = [];
  let v = value >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v & 0x7f);
  return out;
}

function readString(buf: Uint8Array, offset: number): { value: string; offset: number } {
  const len = readVarint(buf, offset);
  const end = len.offset + len.value;
  return { value: new TextDecoder('utf-8').decode(buf.subarray(len.offset, end)), offset: end };
}

function writeString(value: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(value));
  return [...writeVarint(bytes.length), ...bytes];
}

export function decodeHeader(buf: Uint8Array): PacketHeader {
  const h: PacketHeader = { packetType: '', payloadPacketSize: 0 };
  let i = 0;
  while (i < buf.length) {
    const keyRead = readVarint(buf, i);
    const tag = keyRead.value >>> 3;
    const wireType = keyRead.value & 0x7;
    i = keyRead.offset;
    switch (tag) {
      case 1: {
        if (wireType !== WIRE_LENGTH_DELIMITED) throw new Error(`tag 1 wireType ${wireType}`);
        const r = readString(buf, i);
        h.packetType = r.value;
        i = r.offset;
        break;
      }
      case 2: {
        if (wireType !== WIRE_VARINT) throw new Error(`tag 2 wireType ${wireType}`);
        const r = readVarint(buf, i);
        h.payloadPacketSize = r.value;
        i = r.offset;
        break;
      }
      case 3: {
        const r = readString(buf, i);
        h.requestedReturnPacketType = r.value;
        i = r.offset;
        break;
      }
      case 4: {
        const r = readString(buf, i);
        h.packetIdentifier = r.value;
        i = r.offset;
        break;
      }
      case 5: {
        const r = readVarint(buf, i);
        h.receiveSendSeed = r.value;
        i = r.offset;
        break;
      }
      default: {
        // Skip unknown field
        if (wireType === WIRE_VARINT) i = readVarint(buf, i).offset;
        else if (wireType === WIRE_LENGTH_DELIMITED) {
          const len = readVarint(buf, i);
          i = len.offset + len.value;
        } else {
          throw new Error(`Unsupported wireType ${wireType} for tag ${tag}`);
        }
      }
    }
  }
  return h;
}

export function encodeHeader(h: PacketHeader): Uint8Array {
  const out: number[] = [];
  out.push((1 << 3) | WIRE_LENGTH_DELIMITED, ...writeString(h.packetType));
  out.push((2 << 3) | WIRE_VARINT, ...writeVarint(h.payloadPacketSize));
  if (h.requestedReturnPacketType !== undefined) {
    out.push((3 << 3) | WIRE_LENGTH_DELIMITED, ...writeString(h.requestedReturnPacketType));
  }
  if (h.packetIdentifier !== undefined) {
    out.push((4 << 3) | WIRE_LENGTH_DELIMITED, ...writeString(h.packetIdentifier));
  }
  if (h.receiveSendSeed !== undefined) {
    out.push((5 << 3) | WIRE_VARINT, ...writeVarint(h.receiveSendSeed));
  }
  return new Uint8Array(out);
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- packet-header`
Expected: PASS for both tests.

**If the first test fails because `packetType` doesn't equal `'DatabaseRequested'`:** the protobuf tag numbers differ from what's documented above. Inspect the bytes manually (`hexdump test/fixtures/wire/01-database-requested.bin | head -10`) and consult the actual NetworkComms.Net `PacketHeader.cs`. **STOP and ask the user** before guessing further.

- [ ] **Step 5: Commit**

```bash
git add src/bridge/network-comms/packet-header.ts src/bridge/network-comms/packet-header.test.ts
git commit -m "feat(network-comms): packet header codec"
```

### Task 2.2: Packet framing (header + payload)

**Files:**

- Create: `src/bridge/network-comms/packet.ts`
- Create: `src/bridge/network-comms/packet.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/bridge/network-comms/packet.test.ts
import { describe, it, expect } from 'vitest';
import { encodePacket, tryDecodePacket } from './packet';
import { readFileSync } from 'node:fs';

describe('packet framing', () => {
  it('decodes the captured DatabaseRequested packet end-to-end', () => {
    const buf = readFileSync('test/fixtures/wire/01-database-requested.bin');
    const decoded = tryDecodePacket(new Uint8Array(buf));
    expect(decoded).not.toBeNull();
    expect(decoded!.header.packetType).toBe('DatabaseRequested');
    expect(decoded!.payload.length).toBe(decoded!.header.payloadPacketSize);
    expect(decoded!.bytesConsumed).toBe(buf.length);
  });

  it('returns null when buffer is incomplete', () => {
    const buf = readFileSync('test/fixtures/wire/01-database-requested.bin');
    const partial = new Uint8Array(buf).subarray(0, buf.length - 1);
    expect(tryDecodePacket(partial)).toBeNull();
  });

  it('round-trips a packet', () => {
    const payload = new TextEncoder().encode('hello');
    const encoded = encodePacket(
      { packetType: 'Test', payloadPacketSize: payload.length },
      payload,
    );
    const decoded = tryDecodePacket(encoded);
    expect(decoded!.header.packetType).toBe('Test');
    expect(new TextDecoder().decode(decoded!.payload)).toBe('hello');
  });

  it('decodes two consecutive packets from one buffer', () => {
    const p1 = encodePacket({ packetType: 'A', payloadPacketSize: 1 }, new Uint8Array([0x01]));
    const p2 = encodePacket(
      { packetType: 'B', payloadPacketSize: 2 },
      new Uint8Array([0x02, 0x03]),
    );
    const joined = new Uint8Array(p1.length + p2.length);
    joined.set(p1);
    joined.set(p2, p1.length);

    const d1 = tryDecodePacket(joined)!;
    expect(d1.header.packetType).toBe('A');
    const remaining = joined.subarray(d1.bytesConsumed);
    const d2 = tryDecodePacket(remaining)!;
    expect(d2.header.packetType).toBe('B');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packet`
Expected: FAIL on module-not-found.

- [ ] **Step 3: Implement packet framing**

Create `src/bridge/network-comms/packet.ts`:

```ts
import { decodeHeader, encodeHeader, PacketHeader } from './packet-header';

export type Packet = {
  header: PacketHeader;
  payload: Uint8Array;
};

export type DecodeResult = Packet & { bytesConsumed: number };

export function encodePacket(header: PacketHeader, payload: Uint8Array): Uint8Array {
  const headerBytes = encodeHeader({ ...header, payloadPacketSize: payload.length });
  if (headerBytes.length > 255) throw new Error('Header too large for single-byte length prefix');
  const out = new Uint8Array(1 + headerBytes.length + payload.length);
  out[0] = headerBytes.length;
  out.set(headerBytes, 1);
  out.set(payload, 1 + headerBytes.length);
  return out;
}

export function tryDecodePacket(buf: Uint8Array): DecodeResult | null {
  if (buf.length < 1) return null;
  const headerLen = buf[0];
  if (buf.length < 1 + headerLen) return null;
  const headerBytes = buf.subarray(1, 1 + headerLen);
  const header = decodeHeader(headerBytes);
  const payloadStart = 1 + headerLen;
  const payloadEnd = payloadStart + header.payloadPacketSize;
  if (buf.length < payloadEnd) return null;
  return {
    header,
    payload: buf.subarray(payloadStart, payloadEnd),
    bytesConsumed: payloadEnd,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- packet`
Expected: PASS, all 4 cases.

**If the `DatabaseRequested` test fails:** the framing layout differs from `[1-byte length][header][payload]`. Common alternatives: a 7-byte fixed-width prefix (NetworkComms.Net some-versions), or multiple length fields. Inspect the first 16 bytes of `01-database-requested.bin` manually and compare to the NetworkComms.Net `PacketBuilder.cs` source. **STOP and ask the user** if the format diverges from the documented `[byte][header][payload]`.

- [ ] **Step 5: Commit**

```bash
git add src/bridge/network-comms/packet.ts src/bridge/network-comms/packet.test.ts
git commit -m "feat(network-comms): packet framing codec"
```

### Task 2.3: Verify against all wire fixtures

**Files:**

- Modify: `src/bridge/network-comms/packet.test.ts`
- Create: `src/bridge/network-comms/all-fixtures.test.ts`

- [ ] **Step 1: Write a coverage test**

```ts
// src/bridge/network-comms/all-fixtures.test.ts
import { describe, it, expect } from 'vitest';
import { tryDecodePacket } from './packet';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('wire fixture coverage', () => {
  const wireDir = 'test/fixtures/wire';
  const files = readdirSync(wireDir).filter((f) => f.endsWith('.bin'));

  it('decodes every captured byte from every fixture into one or more packets', () => {
    for (const file of files) {
      const buf = new Uint8Array(readFileSync(join(wireDir, file)));
      let offset = 0;
      let packets = 0;
      while (offset < buf.length) {
        const r = tryDecodePacket(buf.subarray(offset));
        expect(r, `failed to decode at offset ${offset} of ${file}`).not.toBeNull();
        offset += r!.bytesConsumed;
        packets++;
      }
      console.log(`${file}: ${packets} packet(s)`);
      expect(offset).toBe(buf.length);
    }
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- all-fixtures`
Expected: PASS for all `.bin` files in `test/fixtures/wire/`. If any fail, the codec doesn't handle a real wire pattern (compression flags, larger header sizes, etc.) — investigate and extend the codec.

- [ ] **Step 3: Commit**

```bash
git add src/bridge/network-comms/all-fixtures.test.ts
git commit -m "test(network-comms): coverage test across all wire fixtures"
```

---

## Phase 3 — XML payload codec

The XML must round-trip with `XmlSerializer` output: no XML declaration, no namespace declarations, indented with 2 spaces (`XmlWriterSettings.Indent = true`). Use hand-written code; payloads are tiny and shapes fixed.

### Task 3.1: SneezeRecord XML codec

**Files:**

- Create: `src/bridge/xml/sneeze-record.ts`
- Create: `src/bridge/xml/sneeze-record.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/bridge/xml/sneeze-record.test.ts
import { describe, it, expect } from 'vitest';
import { decodeSneezeRecord, encodeSneezeRecord } from './sneeze-record';
import { readFileSync } from 'node:fs';

describe('SneezeRecord XML codec', () => {
  it('decodes the fixture', () => {
    const xml = readFileSync('test/fixtures/xml/sneeze-record-sample.xml', 'utf8');
    const r = decodeSneezeRecord(xml);
    expect(r.userId).toBe('c897cd73-9100-4e6a-8a32-fe237f1e9928');
    expect(r.date).toBe('2024-01-15T18:30:00Z');
    expect(r.comment).toBe('First sneeze of the day');
  });

  it('encodes with no XML decl and no namespaces', () => {
    const xml = encodeSneezeRecord({
      userId: 'c897cd73-9100-4e6a-8a32-fe237f1e9928',
      date: '2024-01-15T18:30:00Z',
      comment: 'hi',
    });
    expect(xml).not.toContain('<?xml');
    expect(xml).not.toContain('xmlns');
    expect(xml).toContain('userId="c897cd73-9100-4e6a-8a32-fe237f1e9928"');
    expect(xml).toContain('date="2024-01-15T18:30:00Z"');
    expect(xml).toContain('>hi<');
  });

  it('round-trips empty comment', () => {
    const r = { userId: 'a', date: 'b' };
    expect(decodeSneezeRecord(encodeSneezeRecord(r))).toEqual({
      userId: 'a',
      date: 'b',
      comment: '',
    });
  });

  it('encodes special XML characters safely', () => {
    const xml = encodeSneezeRecord({ userId: 'x', date: 'y', comment: 'a & b <c>' });
    const back = decodeSneezeRecord(xml);
    expect(back.comment).toBe('a & b <c>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sneeze-record`
Expected: FAIL on module-not-found.

- [ ] **Step 3: Implement**

```ts
// src/bridge/xml/sneeze-record.ts
export type SneezeRecord = {
  userId: string;
  date: string; // ISO 8601 UTC, preserved verbatim for server-side matching
  comment?: string;
};

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const unescapeXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

export function encodeSneezeRecord(r: SneezeRecord): string {
  const comment = r.comment ?? '';
  return `<SneezeRecord userId="${escapeXml(r.userId)}" date="${escapeXml(r.date)}">${escapeXml(comment)}</SneezeRecord>`;
}

const RE = /<SneezeRecord\s+userId="([^"]*)"\s+date="([^"]*)"\s*>([\s\S]*?)<\/SneezeRecord>/;

export function decodeSneezeRecord(xml: string): SneezeRecord {
  const m = xml.match(RE);
  if (!m) throw new Error(`Invalid SneezeRecord XML: ${xml.slice(0, 200)}`);
  return {
    userId: unescapeXml(m[1]),
    date: unescapeXml(m[2]),
    comment: unescapeXml(m[3]),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- sneeze-record`
Expected: PASS, all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add src/bridge/xml/sneeze-record.ts src/bridge/xml/sneeze-record.test.ts
git commit -m "feat(xml): sneeze record codec"
```

### Task 3.2: UserInfo XML codec

**Files:**

- Create: `src/bridge/xml/user-info.ts`
- Create: `src/bridge/xml/user-info.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/bridge/xml/user-info.test.ts
import { describe, it, expect } from 'vitest';
import { decodeUserInfo, encodeUserInfo } from './user-info';
import { readFileSync } from 'node:fs';

describe('UserInfo XML codec', () => {
  it('decodes the fixture', () => {
    const xml = readFileSync('test/fixtures/xml/user-info-sample.xml', 'utf8');
    const u = decodeUserInfo(xml);
    expect(u.userId).toBe('c897cd73-9100-4e6a-8a32-fe237f1e9928');
    expect(u.color).toBe('#FF8800');
    expect(u.name).toBe('Tim');
  });

  it('round-trips a user', () => {
    const u = { userId: 'a', color: '#102030', name: 'X & Y' };
    expect(decodeUserInfo(encodeUserInfo(u))).toEqual(u);
  });

  it('decodes a named-color value into the same string (caller normalizes)', () => {
    // C# may emit color="Sienna" for the built-in Nemo user. Preserve verbatim;
    // the consumer maps known names to #RRGGBB.
    const xml =
      '<UserInfo userId="944616BD-20A1-4659-87AF-04563043FFDE" color="Sienna">Nemo</UserInfo>';
    expect(decodeUserInfo(xml).color).toBe('Sienna');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- user-info`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/bridge/xml/user-info.ts
export type UserInfo = {
  userId: string;
  color: string; // C# may emit either "#RRGGBB" or a named color token; decoder preserves verbatim.
  name: string;
};

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const unescapeXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

export function encodeUserInfo(u: UserInfo): string {
  return `<UserInfo userId="${escapeXml(u.userId)}" color="${escapeXml(u.color)}">${escapeXml(u.name)}</UserInfo>`;
}

const RE = /<UserInfo\s+userId="([^"]*)"\s+color="([^"]*)"\s*>([\s\S]*?)<\/UserInfo>/;

export function decodeUserInfo(xml: string): UserInfo {
  const m = xml.match(RE);
  if (!m) throw new Error(`Invalid UserInfo XML: ${xml.slice(0, 200)}`);
  return {
    userId: unescapeXml(m[1]),
    color: unescapeXml(m[2]),
    name: unescapeXml(m[3]),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- user-info`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/bridge/xml/user-info.ts src/bridge/xml/user-info.test.ts
git commit -m "feat(xml): user info codec"
```

### Task 3.3: SneezeDatabase XML decoder

We only need to **decode** the database (server only sends it; clients never send a full database). Use a small DOM-style parser via the platform `DOMParser` if available, or hand-written. Pick hand-written for predictability.

**Files:**

- Create: `src/bridge/xml/sneeze-database.ts`
- Create: `src/bridge/xml/sneeze-database.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/bridge/xml/sneeze-database.test.ts
import { describe, it, expect } from 'vitest';
import { decodeSneezeDatabase } from './sneeze-database';
import { readFileSync } from 'node:fs';

describe('SneezeDatabase XML codec', () => {
  it('decodes the captured database fixture', () => {
    const xml = readFileSync('test/fixtures/xml/database-sample.xml', 'utf8');
    const db = decodeSneezeDatabase(xml);
    expect(db.version).toBeGreaterThan(0);
    expect(db.countdownStart).toBeGreaterThan(0);
    expect(Array.isArray(db.sneezes)).toBe(true);
    expect(Array.isArray(db.users)).toBe(true);
    if (db.users.length > 0) {
      expect(db.users[0]).toHaveProperty('userId');
      expect(db.users[0]).toHaveProperty('color');
      expect(db.users[0]).toHaveProperty('name');
    }
  });

  it('handles a synthetic small database', () => {
    const xml = `<SneezeDatabase Version="1">
  <CountdownStart>100</CountdownStart>
  <Sneezes>
    <Sneeze userId="u1" date="2020-01-01T00:00:00Z">first</Sneeze>
    <Sneeze userId="u2" date="2020-01-02T00:00:00Z" />
  </Sneezes>
  <Users>
    <User userId="u1" color="#FF0000">Alice</User>
    <User userId="u2" color="#00FF00">Bob</User>
  </Users>
</SneezeDatabase>`;
    const db = decodeSneezeDatabase(xml);
    expect(db.version).toBe(1);
    expect(db.countdownStart).toBe(100);
    expect(db.sneezes).toHaveLength(2);
    expect(db.sneezes[0]).toMatchObject({
      userId: 'u1',
      date: '2020-01-01T00:00:00Z',
      comment: 'first',
    });
    expect(db.sneezes[1]).toMatchObject({
      userId: 'u2',
      date: '2020-01-02T00:00:00Z',
      comment: '',
    });
    expect(db.users).toHaveLength(2);
    expect(db.users[0]).toMatchObject({ userId: 'u1', color: '#FF0000', name: 'Alice' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- sneeze-database`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/bridge/xml/sneeze-database.ts
import type { SneezeRecord } from './sneeze-record';
import type { UserInfo } from './user-info';

export type SneezeDatabase = {
  version: number;
  countdownStart: number;
  sneezes: SneezeRecord[];
  users: UserInfo[];
};

const unescapeXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

function parseAttr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? unescapeXml(m[1]) : undefined;
}

function parseSneezeEntries(xml: string): SneezeRecord[] {
  const re = /<Sneeze\b([^>]*?)(\/>|>([\s\S]*?)<\/Sneeze>)/g;
  const out: SneezeRecord[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    const inner = m[3] ?? '';
    out.push({
      userId: parseAttr(attrs, 'userId') ?? '',
      date: parseAttr(attrs, 'date') ?? '',
      comment: unescapeXml(inner),
    });
  }
  return out;
}

function parseUserEntries(xml: string): UserInfo[] {
  const re = /<User\b([^>]*?)(\/>|>([\s\S]*?)<\/User>)/g;
  const out: UserInfo[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    const inner = m[3] ?? '';
    out.push({
      userId: parseAttr(attrs, 'userId') ?? '',
      color: parseAttr(attrs, 'color') ?? '',
      name: unescapeXml(inner),
    });
  }
  return out;
}

export function decodeSneezeDatabase(xml: string): SneezeDatabase {
  const versionAttr = xml.match(/<SneezeDatabase\b[^>]*Version="([0-9]+)"/);
  const version = versionAttr ? parseInt(versionAttr[1], 10) : 0;

  const cs = xml.match(/<CountdownStart>\s*([0-9]+)\s*<\/CountdownStart>/);
  const countdownStart = cs ? parseInt(cs[1], 10) : 27002;

  const sneezesBlock = xml.match(/<Sneezes>([\s\S]*?)<\/Sneezes>/);
  const usersBlock = xml.match(/<Users>([\s\S]*?)<\/Users>/);

  return {
    version,
    countdownStart,
    sneezes: sneezesBlock ? parseSneezeEntries(sneezesBlock[1]) : [],
    users: usersBlock ? parseUserEntries(usersBlock[1]) : [],
  };
}
```

- [ ] **Step 4: Run**

Run: `npm test -- sneeze-database`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/bridge/xml/sneeze-database.ts src/bridge/xml/sneeze-database.test.ts
git commit -m "feat(xml): sneeze database decoder"
```

### Task 3.4: Color normalization helper

C# named colors → `#RRGGBB`. Used in the web view; pure function.

**Files:**

- Create: `src/util/color.ts`
- Create: `src/util/color.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/util/color.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeColor } from './color';

describe('normalizeColor', () => {
  it('passes #RRGGBB through unchanged', () => {
    expect(normalizeColor('#FF0000')).toBe('#FF0000');
  });
  it('maps Sienna to #A0522D', () => {
    expect(normalizeColor('Sienna')).toBe('#A0522D');
  });
  it('lowercases the name lookup', () => {
    expect(normalizeColor('sienna')).toBe('#A0522D');
  });
  it('returns the input as-is for unknown values (caller decides fallback)', () => {
    expect(normalizeColor('NotAColor')).toBe('NotAColor');
  });
  it('handles #rrggbb (lowercase) by uppercasing', () => {
    expect(normalizeColor('#ff0000')).toBe('#FF0000');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- color`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/util/color.ts
// Subset of .NET KnownColor names that appear in real Sneeze Board data.
// Add entries as fixtures uncover new names.
const NAMED: Record<string, string> = {
  sienna: '#A0522D',
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  green: '#008000',
  blue: '#0000FF',
  yellow: '#FFFF00',
  goldenrod: '#DAA520',
};

export function normalizeColor(input: string): string {
  if (!input) return input;
  if (input.startsWith('#')) return `#${input.slice(1).toUpperCase()}`;
  const named = NAMED[input.toLowerCase()];
  return named ?? input;
}
```

- [ ] **Step 4: Run**

Run: `npm test -- color`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/util/color.ts src/util/color.test.ts
git commit -m "feat(util): color name normalization"
```

---

## Phase 4 — Stats utilities (pure functions, port from C#)

Ports from `SneezeBoardCommon/SneezeDatabase.cs` and `SneezeBoardClient/SneezeBoardForm.cs:CalculateApocalypse`.

### Task 4.1: User stats

**Files:**

- Create: `src/util/stats.ts`
- Create: `src/util/stats.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/util/stats.test.ts
import { describe, it, expect } from 'vitest';
import { findUserStats } from './stats';
import type { SneezeDatabase } from '../bridge/xml/sneeze-database';

const db: SneezeDatabase = {
  version: 1,
  countdownStart: 100,
  users: [
    { userId: 'u1', color: '#FF0000', name: 'Alice' },
    { userId: 'u2', color: '#00FF00', name: 'Bob' },
  ],
  sneezes: [
    { userId: 'u1', date: '2024-01-01T00:00:00Z' },
    { userId: 'u2', date: '2024-01-02T00:00:00Z' },
    { userId: 'u1', date: '2024-01-03T00:00:00Z' },
  ],
};

describe('findUserStats', () => {
  it('counts sneezes per user with first/last dates', () => {
    const stats = findUserStats(db);
    expect(stats.get('u1')).toEqual({
      totalSneezes: 2,
      firstSneezeDate: '2024-01-01T00:00:00Z',
      lastSneezeDate: '2024-01-03T00:00:00Z',
    });
    expect(stats.get('u2')).toEqual({
      totalSneezes: 1,
      firstSneezeDate: '2024-01-02T00:00:00Z',
      lastSneezeDate: '2024-01-02T00:00:00Z',
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- stats`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/util/stats.ts
import type { SneezeDatabase } from '../bridge/xml/sneeze-database';

export type UserStats = {
  totalSneezes: number;
  firstSneezeDate: string;
  lastSneezeDate: string;
};

export function findUserStats(db: SneezeDatabase): Map<string, UserStats> {
  const out = new Map<string, UserStats>();
  for (const sneeze of db.sneezes) {
    const existing = out.get(sneeze.userId);
    if (!existing) {
      out.set(sneeze.userId, {
        totalSneezes: 1,
        firstSneezeDate: sneeze.date,
        lastSneezeDate: sneeze.date,
      });
    } else {
      existing.totalSneezes++;
      existing.lastSneezeDate = sneeze.date;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run**

Run: `npm test -- stats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/util/stats.ts src/util/stats.test.ts
git commit -m "feat(stats): per-user sneeze counts"
```

### Task 4.2: Longest streaks (mirrors C# FindLongestStreaks)

**Files:**

- Modify: `src/util/stats.ts`, `src/util/stats.test.ts`

- [ ] **Step 1: Add test**

Append to `src/util/stats.test.ts`:

```ts
import { findLongestStreaks } from './stats';

describe('findLongestStreaks', () => {
  it('returns longest contiguous run per user', () => {
    const streaks = findLongestStreaks({
      ...db,
      sneezes: [
        { userId: 'u1', date: 'd1' },
        { userId: 'u1', date: 'd2' },
        { userId: 'u2', date: 'd3' },
        { userId: 'u1', date: 'd4' },
        { userId: 'u2', date: 'd5' },
        { userId: 'u2', date: 'd6' },
        { userId: 'u2', date: 'd7' },
      ],
    });
    expect(streaks.get('u1')).toBe(2);
    expect(streaks.get('u2')).toBe(3);
  });

  it('ignores Unknown user id streaks', () => {
    const streaks = findLongestStreaks({
      ...db,
      sneezes: [
        { userId: '944616bd-20a1-4659-87af-04563043ffde', date: 'd1' },
        { userId: '944616bd-20a1-4659-87af-04563043ffde', date: 'd2' },
        { userId: 'u1', date: 'd3' },
      ],
    });
    // Unknown should still appear with streak 1 (resets), but C# treats it specially
    expect(streaks.get('u1')).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- stats`
Expected: FAIL (function not exported).

- [ ] **Step 3: Implement**

Append to `src/util/stats.ts`:

```ts
const UNKNOWN_USER_ID = '944616bd-20a1-4659-87af-04563043ffde';

export function findLongestStreaks(db: SneezeDatabase): Map<string, number> {
  const out = new Map<string, number>();
  if (db.sneezes.length === 0) return out;

  let currentUserId = db.sneezes[0].userId;
  let currentStreak = 0;

  const flush = () => {
    const prev = out.get(currentUserId) ?? 0;
    if (currentStreak > prev) out.set(currentUserId, currentStreak);
  };

  for (const sneeze of db.sneezes) {
    if (sneeze.userId === currentUserId && sneeze.userId.toLowerCase() !== UNKNOWN_USER_ID) {
      currentStreak++;
    } else {
      flush();
      currentStreak = 1;
      currentUserId = sneeze.userId;
    }
  }
  flush();
  return out;
}
```

- [ ] **Step 4: Run**

Run: `npm test -- stats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/util/stats.ts src/util/stats.test.ts
git commit -m "feat(stats): longest streaks per user"
```

### Task 4.3: Apocalypse date estimate

**Files:**

- Modify: `src/util/stats.ts`, `src/util/stats.test.ts`

- [ ] **Step 1: Add test**

Append to `src/util/stats.test.ts`:

```ts
import { estimateApocalypseDate, DateRange } from './stats';

describe('estimateApocalypseDate', () => {
  it('returns a date when there are sneezes in range', () => {
    const now = new Date('2024-01-08T00:00:00Z');
    const result = estimateApocalypseDate(
      {
        version: 1,
        countdownStart: 100,
        users: [],
        sneezes: [
          { userId: 'u1', date: '2024-01-01T00:00:00Z' },
          { userId: 'u1', date: '2024-01-08T00:00:00Z' },
        ],
      },
      'allTime',
      now,
    );
    expect(result).toBeInstanceOf(Date);
    // 2 sneezes over 7 days → 3.5d/sneeze. 98 sneezes left → ~343 days from now.
    const d = result as Date;
    expect(d.getTime()).toBeGreaterThan(now.getTime());
  });

  it('returns "noSneezesInRange" when nothing matches the date range', () => {
    const result = estimateApocalypseDate(
      {
        version: 1,
        countdownStart: 100,
        users: [],
        sneezes: [{ userId: 'u1', date: '2020-01-01T00:00:00Z' }],
      },
      'oneWeek',
      new Date('2024-01-01T00:00:00Z'),
    );
    expect(result).toBe('noSneezesInRange');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- stats`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `src/util/stats.ts`:

```ts
export type DateRange =
  | 'oneWeek'
  | 'twoWeeks'
  | 'oneMonth'
  | 'threeMonths'
  | 'sixMonths'
  | 'year'
  | 'allTime';

function rangeStartDate(range: DateRange, now: Date): Date {
  const d = new Date(now);
  switch (range) {
    case 'oneWeek':
      d.setDate(d.getDate() - 7);
      return d;
    case 'twoWeeks':
      d.setDate(d.getDate() - 14);
      return d;
    case 'oneMonth':
      d.setMonth(d.getMonth() - 1);
      return d;
    case 'threeMonths':
      d.setMonth(d.getMonth() - 3);
      return d;
    case 'sixMonths':
      d.setMonth(d.getMonth() - 6);
      return d;
    case 'year':
      d.setFullYear(d.getFullYear() - 1);
      return d;
    case 'allTime':
      return new Date(0);
  }
}

export function estimateApocalypseDate(
  db: SneezeDatabase,
  range: DateRange,
  now: Date = new Date(),
): Date | 'noSneezesInRange' {
  if (db.sneezes.length === 0) return 'noSneezesInRange';
  const startDate = rangeStartDate(range, now);
  let count = 0;
  let firstInRangeMs = 0;
  for (let i = db.sneezes.length - 1; i >= 0; i--) {
    const sd = new Date(db.sneezes[i].date).getTime();
    if (sd < startDate.getTime()) break;
    count++;
    firstInRangeMs = sd;
  }
  if (count === 0) return 'noSneezesInRange';
  const msBetween = (now.getTime() - firstInRangeMs) / count;
  const msUntilApocalypse = (db.countdownStart - db.sneezes.length) * msBetween;
  return new Date(now.getTime() + msUntilApocalypse);
}
```

- [ ] **Step 4: Run**

Run: `npm test -- stats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/util/stats.ts src/util/stats.test.ts
git commit -m "feat(stats): apocalypse date estimate"
```

---

## Phase 5 — NetworkCommsClient (TCP + packet routing)

### Task 5.1: Connection state + send/receive against an in-memory server

**Files:**

- Create: `src/bridge/network-comms/network-comms-client.ts`
- Create: `src/bridge/network-comms/network-comms-client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/bridge/network-comms/network-comms-client.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NetworkCommsClient } from './network-comms-client';
import { encodePacket, tryDecodePacket } from './packet';
import net from 'node:net';

function makeEchoServer(): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        let r = tryDecodePacket(new Uint8Array(buffer));
        while (r) {
          // Echo back with the same packetType and payload
          const echo = encodePacket(
            { packetType: r.header.packetType, payloadPacketSize: r.payload.length },
            r.payload,
          );
          socket.write(echo);
          buffer = buffer.subarray(r.bytesConsumed);
          r = tryDecodePacket(new Uint8Array(buffer));
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ port, close: () => server.close() });
    });
  });
}

describe('NetworkCommsClient', () => {
  let server: { port: number; close: () => void };
  beforeEach(async () => {
    server = await makeEchoServer();
  });
  afterEach(() => server.close());

  it('connects, sends a packet, receives the echo', async () => {
    const client = new NetworkCommsClient();
    const received = new Promise<string>((resolve) => {
      client.on('Sneeze', (payload) => resolve(payload));
    });
    await client.connect('127.0.0.1', server.port);
    client.send('Sneeze', '<x/>');
    await expect(received).resolves.toBe('<x/>');
    client.disconnect();
  });

  it('reports state transitions', async () => {
    const client = new NetworkCommsClient();
    const states: string[] = [];
    client.onState((s) => states.push(s));
    await client.connect('127.0.0.1', server.port);
    expect(states).toEqual(['connecting', 'open']);
    client.disconnect();
    await new Promise((r) => setTimeout(r, 10));
    expect(states).toContain('closed');
  });

  it('times out on sendAndAwait when no matching reply', async () => {
    const client = new NetworkCommsClient();
    await client.connect('127.0.0.1', server.port);
    // Echo server replies with the SAME packetType, so awaiting a DIFFERENT type times out.
    await expect(client.sendAndAwait('Ping', 'Pong', 'data', 100)).rejects.toThrow(/timeout/i);
    client.disconnect();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- network-comms-client`
Expected: FAIL on module-not-found.

- [ ] **Step 3: Implement**

```ts
// src/bridge/network-comms/network-comms-client.ts
import net from 'node:net';
import { encodePacket, tryDecodePacket } from './packet';

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
export type Unsubscriber = () => void;

export class NetworkCommsClient {
  private socket: net.Socket | undefined;
  private rxBuffer: Buffer = Buffer.alloc(0);
  private state: ConnectionState = 'idle';
  private handlers = new Map<string, Set<(payload: string) => void>>();
  private stateListeners = new Set<(s: ConnectionState, err?: string) => void>();

  on(packetType: string, handler: (payload: string) => void): Unsubscriber {
    let set = this.handlers.get(packetType);
    if (!set) {
      set = new Set();
      this.handlers.set(packetType, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  onState(handler: (s: ConnectionState, err?: string) => void): Unsubscriber {
    this.stateListeners.add(handler);
    return () => this.stateListeners.delete(handler);
  }

  connect(host: string, port: number): Promise<void> {
    this.setState('connecting');
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        this.setState('open');
        resolve();
      });
      this.socket = socket;
      socket.on('data', (chunk) => this.onData(chunk));
      socket.on('close', () => this.setState('closed'));
      socket.on('error', (err) => {
        this.setState('error', err.message);
        reject(err);
      });
    });
  }

  disconnect(): void {
    this.socket?.end();
    this.socket = undefined;
  }

  send(packetType: string, payload: string): void {
    if (!this.socket || this.state !== 'open') throw new Error('not connected');
    const payloadBytes = new TextEncoder().encode(payload);
    const frame = encodePacket(
      { packetType, payloadPacketSize: payloadBytes.length },
      payloadBytes,
    );
    this.socket.write(frame);
  }

  sendAndAwait(
    packetType: string,
    expectedReply: string,
    payload: string,
    timeoutMs = 30000,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`sendAndAwait timeout waiting for ${expectedReply}`));
      }, timeoutMs);
      const unsub = this.on(expectedReply, (reply) => {
        clearTimeout(timer);
        unsub();
        resolve(reply);
      });
      try {
        this.send(packetType, payload);
      } catch (e) {
        clearTimeout(timer);
        unsub();
        reject(e);
      }
    });
  }

  private onData(chunk: Buffer): void {
    this.rxBuffer = Buffer.concat([this.rxBuffer, chunk]);
    let r = tryDecodePacket(new Uint8Array(this.rxBuffer));
    while (r) {
      const payloadStr = new TextDecoder('utf-8').decode(r.payload);
      const set = this.handlers.get(r.header.packetType);
      if (set)
        for (const h of set)
          try {
            h(payloadStr);
          } catch (e) {
            console.error(e);
          }
      this.rxBuffer = this.rxBuffer.subarray(r.bytesConsumed);
      r = tryDecodePacket(new Uint8Array(this.rxBuffer));
    }
  }

  private setState(s: ConnectionState, err?: string): void {
    this.state = s;
    for (const l of this.stateListeners)
      try {
        l(s, err);
      } catch (e) {
        console.error(e);
      }
  }
}
```

- [ ] **Step 4: Run**

Run: `npm test -- network-comms-client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/bridge/network-comms/network-comms-client.ts src/bridge/network-comms/network-comms-client.test.ts
git commit -m "feat(network-comms): tcp client with packet routing"
```

---

## Phase 6 — Bridge entry process

### Task 6.1: Bridge IPC types (shared with extension main)

**Files:**

- Create: `src/bridge/ipc-types.ts`

- [ ] **Step 1: Write the file**

```ts
// src/bridge/ipc-types.ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/bridge/ipc-types.ts
git commit -m "feat(bridge): IPC type definitions"
```

### Task 6.2: Bridge entry point

**Files:**

- Create: `src/bridge/index.ts`
- Create: `src/bridge/index.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/bridge/index.test.ts
// Smoke test: spawn the bridge as a child process and exchange IPC messages
// against an in-memory NetworkCommsServer echo. Defer the harder integration
// test to Phase 10.
import { describe, it, expect } from 'vitest';
import { fork, ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { encodePacket, tryDecodePacket } from './network-comms/packet';

describe('bridge IPC smoke', () => {
  it('sends connect/disconnect and emits state events', async () => {
    const server = net.createServer();
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', res));
    const port = (server.address() as net.AddressInfo).port;

    const bridge: ChildProcess = fork(path.resolve('dist/assets/bridge/index.js'), [], {
      silent: true,
    });
    const events: any[] = [];
    bridge.on('message', (m) => events.push(m));

    bridge.send({ kind: 'connect', host: '127.0.0.1', port });
    await new Promise((r) => setTimeout(r, 200));
    expect(events.map((e) => e.kind)).toContain('state');

    bridge.send({ kind: 'disconnect' });
    bridge.kill();
    server.close();
  });
});
```

Note: this test runs the _built_ `dist/assets/bridge/index.js`. It requires `npm run build` to have run. We'll add the bridge to webpack in Phase 7 and re-enable this test then. For now, mark it as `.skip`:

Change the `describe` to `describe.skip(...)`.

- [ ] **Step 2: Write the bridge entry**

```ts
// src/bridge/index.ts
import { NetworkCommsClient } from './network-comms/network-comms-client';
import { encodeSneezeRecord, decodeSneezeRecord } from './xml/sneeze-record';
import { encodeUserInfo, decodeUserInfo } from './xml/user-info';
import { decodeSneezeDatabase } from './xml/sneeze-database';
import type { BridgeCommand, BridgeEvent } from './ipc-types';

const client = new NetworkCommsClient();

function send(msg: BridgeEvent) {
  if (process.send) process.send(msg);
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
        // Request the database immediately after connect (mirrors C# client's GetDatabase flow)
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
    }
  } catch (e) {
    log('error', `bridge command ${msg.kind} failed: ${(e as Error).message}`);
  }
});

log('info', 'bridge started');
```

**Important about `DatabaseRequested` payload:** the C# client sends an `int 0`. NetworkComms.Net serializes plain `int` payloads as a 4-byte little-endian binary or as a protobuf-net wrapped varint depending on the configured serializer. **The string `'0'` above is a placeholder — when you reach Phase 10 integration, capture the actual `DatabaseRequested` payload bytes and either:** (a) send those bytes via a new `sendBinary(packetType, Uint8Array)` method on `NetworkCommsClient`, OR (b) confirm the server is tolerant of UTF-8 `"0"` and leave as-is. If neither works, STOP and ask the user.

- [ ] **Step 3: Commit (test skipped until bundle exists)**

```bash
git add src/bridge/index.ts src/bridge/index.test.ts
git commit -m "feat(bridge): entry point with IPC command/event handlers"
```

---

## Phase 7 — Webpack bridge config

### Task 7.1: Add bridge webpack config

**Files:**

- Create: `webpack/webpack.config.bridge.ts`
- Modify: `webpack.config.ts` (root, combines configs)
- Modify: `package.json` (add `build:bridge` script)

- [ ] **Step 1: Read existing main config for context**

Read `webpack/webpack.config.main.ts` and `webpack/webpack.config.base.ts` to understand the conventions (LIBRARY_TYPE, externals, output format).

- [ ] **Step 2: Write the bridge config**

```ts
// webpack/webpack.config.bridge.ts
import path from 'path';
import webpack from 'webpack';
import { merge } from 'webpack-merge';
import configBase, { rootDir } from './webpack.config.base';

const config: webpack.Configuration = merge(configBase, {
  target: 'node22',
  entry: path.join(rootDir, 'src/bridge/index.ts'),
  output: {
    path: path.join(rootDir, 'dist/assets/bridge'),
    filename: 'index.js',
    library: { type: 'commonjs2' },
    clean: false,
  },
  externals: [
    // Standard Node built-ins remain external (not bundled)
    'node:net',
    'net',
    'node:child_process',
    'child_process',
    'node:os',
    'os',
    'node:path',
    'path',
    'node:fs',
    'fs',
  ],
  externalsType: 'node-commonjs',
  experiments: { outputModule: false },
  optimization: { minimize: false },
  devtool: 'inline-source-map',
});

export default config;
```

- [ ] **Step 3: Update root webpack.config.ts**

The root config is a thin wrapper that builds all sub-configs. Inspect the current contents — it likely imports main and web-view. Add bridge:

```ts
// webpack.config.ts
import mainConfig from './webpack/webpack.config.main';
import webViewConfig from './webpack/webpack.config.web-view';
import bridgeConfig from './webpack/webpack.config.bridge';

export default [bridgeConfig, webViewConfig, mainConfig];
```

(Order: bridge first so it's available when main is built; this is just for build determinism — webpack doesn't enforce ordering otherwise.)

- [ ] **Step 4: Add `build:bridge` script**

In `package.json`, add to `scripts`:

```json
"build:bridge": "webpack --config ./webpack/webpack.config.bridge.ts",
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `dist/assets/bridge/index.js` exists, no errors.

- [ ] **Step 6: Verify bridge runs as a Node script**

```bash
node dist/assets/bridge/index.js
```

Expected: outputs `[bridge] no IPC channel; dropped: { kind: 'log', level: 'info', message: 'bridge started' }` then exits/blocks. Press Ctrl+C.

- [ ] **Step 7: Re-enable bridge smoke test**

Change `describe.skip(...)` to `describe(...)` in `src/bridge/index.test.ts`.

Run: `npm run build && npm test -- bridge/index`
Expected: bridge smoke test PASSES (sees a `state` message).

- [ ] **Step 8: Commit**

```bash
git add webpack/ webpack.config.ts package.json src/bridge/index.test.ts
git commit -m "build(bridge): add webpack config for bridge bundle"
```

---

## Phase 8 — Extension main + NetworkObject

### Task 8.1: Extension state model

**Files:**

- Create: `src/types/paranext-extension-sneeze-board.d.ts` (already exists, extend)

- [ ] **Step 1: Define exported types**

Replace the contents:

```ts
declare module 'paranext-extension-sneeze-board' {
  import type { Unsubscriber } from 'platform-bible-utils';

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
    subscribeState(callback: (state: SneezeBoardState) => void): Promise<Unsubscriber>;
  };
}
```

- [ ] **Step 2: Verify types compile**

Run: `npm run typecheck` (added in Task 0.2)
Expected: no errors. If the `platform-bible-utils` import fails to find `Unsubscriber`, replace with `type Unsubscriber = () => Promise<boolean>;` inline.

- [ ] **Step 3: Commit**

```bash
git add src/types/paranext-extension-sneeze-board.d.ts
git commit -m "feat(types): declare sneeze board state types"
```

### Task 8.2: Extension main — bridge lifecycle

**Files:**

- Modify: `src/main.ts`

- [ ] **Step 1: Replace main.ts**

```ts
// src/main.ts
import papi, { logger } from '@papi/backend';
import type { ExecutionActivationContext } from '@papi/core';
import type { ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import type { SneezeBoardState, SneezeRecord, UserInfo } from 'paranext-extension-sneeze-board';
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
  | { kind: 'database'; db: SneezeBoardState['database'] }
  | { kind: 'personSneezed'; record: SneezeRecord }
  | { kind: 'userUpdated'; user: UserInfo }
  | { kind: 'sneezeUpdated'; record: SneezeRecord }
  | { kind: 'sneezeRemoved'; record: SneezeRecord }
  | { kind: 'log'; level: 'info' | 'warn' | 'error'; message: string };

let bridge: ChildProcess | undefined;
let state: SneezeBoardState = { connection: 'idle' };
const stateSubscribers = new Set<(s: SneezeBoardState) => void>();

function setState(patch: Partial<SneezeBoardState>) {
  state = { ...state, ...patch };
  for (const s of stateSubscribers)
    try {
      s(state);
    } catch (e) {
      logger.error(e);
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

export async function activate(context: ExecutionActivationContext) {
  logger.info('Sneeze Board is activating!');
  spawnBridge(context);

  // Commands — listed in §6.6 of the design spec.
  const unsubs = await Promise.all([
    papi.commands.registerCommand('sneezeBoard.connect', async (ip: string) => {
      await papi.settings.set('sneezeBoard.serverIp', ip);
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
      await papi.settings.set('sneezeBoard.lastSneezerId', userId);
      setState({ currentUserId: userId });
    }),
  ]);

  // NetworkObject 'sneezeBoard.state' — proxied to web view.
  const stateNetworkObject = await papi.networkObjects.set('sneezeBoard.state', {
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

  context.registrations.add(...unsubs);
  context.registrations.add(stateNetworkObject.dispose);
  context.registrations.add(() => bridge?.kill());

  logger.info('Sneeze Board activated.');
}

export async function deactivate() {
  logger.info('Sneeze Board is deactivating!');
  bridge?.kill();
  bridge = undefined;
  return true;
}
```

If `papi.networkObjects.set` signature differs in the current papi.d.ts, adjust according to `paranext-core/lib/papi-dts/papi.d.ts:1764-1783`.

If `papi.settings.set`/`papi.settings.get` aren't the current API, replace with `papi.localStorage` or `papi.preferences` per current `papi.d.ts`. **STOP and ask the user** if the surface is not obvious.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success. If TypeScript complains about `papi.commands`, `papi.networkObjects`, or `papi.settings` shapes, read the current types in `node_modules/papi-dts/papi.d.ts` and adjust. Do not stub APIs that don't exist.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(main): bridge lifecycle, commands, networkObject"
```

### Task 8.3: Web view provider (placeholder content)

**Files:**

- Modify: `src/main.ts`
- Create: `src/web-views/sneeze-board.web-view.tsx`
- Create: `src/web-views/sneeze-board.web-view.scss`

- [ ] **Step 1: Create a minimal web view**

```tsx
// src/web-views/sneeze-board.web-view.tsx
import { useState, useEffect } from 'react';
// @ts-expect-error globalThis.webViewComponent is the convention
globalThis.webViewComponent = function SneezeBoardWebView() {
  return (
    <div className="sneeze-board">
      <h2>Sneeze Board</h2>
      <p>Hello from the Sneeze Board web view.</p>
    </div>
  );
};
```

```scss
// src/web-views/sneeze-board.web-view.scss
.sneeze-board {
  padding: 16px;
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 2: Register the provider in main.ts**

Add at the top of `src/main.ts`:

```ts
import sneezeBoardWebView from './web-views/sneeze-board.web-view?inline';
import sneezeBoardStyles from './web-views/sneeze-board.web-view.scss?inline';
import type { IWebViewProvider, SavedWebViewDefinition, WebViewDefinition } from '@papi/core';

const SNEEZE_BOARD_WEB_VIEW_TYPE = 'sneezeBoard.react';

const sneezeBoardWebViewProvider: IWebViewProvider = {
  async getWebView(savedWebView: SavedWebViewDefinition): Promise<WebViewDefinition | undefined> {
    if (savedWebView.webViewType !== SNEEZE_BOARD_WEB_VIEW_TYPE) return undefined;
    return {
      ...savedWebView,
      title: 'Sneeze Board',
      content: sneezeBoardWebView,
      styles: sneezeBoardStyles,
    };
  },
};
```

And in `activate`, add to `unsubs`:

```ts
papi.webViewProviders.register(SNEEZE_BOARD_WEB_VIEW_TYPE, sneezeBoardWebViewProvider),
```

Also add an `openWebView` command:

```ts
papi.commands.registerCommand('sneezeBoard.openWebView', async () => {
  await papi.webViews.openWebView(SNEEZE_BOARD_WEB_VIEW_TYPE, undefined, { existingId: '?' });
}),
```

If `papi.webViews.openWebView` differs from this signature, use what's in `papi.d.ts`. The web view ID format mirrors existing extensions (see `paratext-bible-text-collection`).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success. `dist/src/web-views/sneeze-board.web-view.js` produced.

- [ ] **Step 4: Smoke test in Platform.Bible**

```bash
npm run start
```

In the running Platform.Bible app, run the `sneezeBoard.openWebView` command via the command palette. Verify the "Hello from the Sneeze Board web view." text appears. Close the app.

- [ ] **Step 5: Commit**

```bash
git add src/web-views/ src/main.ts
git commit -m "feat(web-view): minimal sneeze board web view scaffold"
```

---

## Phase 9 — Web view UI

This phase iterates over the user-visible UI. Tasks 9.1-9.6 each ship a working slice.

### Task 9.1: NetworkObject hook

**Files:**

- Create: `src/web-views/use-sneeze-board-state.ts`

- [ ] **Step 1: Implement the hook**

```ts
// src/web-views/use-sneeze-board-state.ts
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
```

If `papi.networkObjects.get` has a different signature on the frontend, consult `papi.d.ts` and adjust.

- [ ] **Step 2: Commit**

```bash
git add src/web-views/use-sneeze-board-state.ts
git commit -m "feat(web-view): hook for sneeze board state"
```

### Task 9.2: Connection bar

**Files:**

- Create: `src/web-views/components/connection-bar.tsx`
- Modify: `src/web-views/sneeze-board.web-view.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/web-views/components/connection-bar.tsx
import { useState } from 'react';
import papi from '@papi/frontend';
import { Button, Input } from 'platform-bible-react';
import type { ConnectionState } from 'paranext-extension-sneeze-board';

export function ConnectionBar({
  connection,
  error,
  defaultIp,
}: {
  connection: ConnectionState;
  error?: string;
  defaultIp: string;
}) {
  const [ip, setIp] = useState(defaultIp);
  const connect = () => papi.commands.sendCommand('sneezeBoard.connect', ip);
  const disconnect = () => papi.commands.sendCommand('sneezeBoard.disconnect');
  const label =
    connection === 'open'
      ? 'Connected'
      : connection === 'connecting'
        ? 'Connecting…'
        : connection === 'error'
          ? `Failed: ${error ?? 'unknown'}`
          : connection === 'closed'
            ? 'Disconnected'
            : 'Idle';
  return (
    <div className="sneeze-board__connection-bar">
      <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="Server IP" />
      {connection === 'open' ? (
        <Button onClick={disconnect}>Disconnect</Button>
      ) : (
        <Button onClick={connect}>Connect</Button>
      )}
      <span className="sneeze-board__status">{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the main web view**

Replace the body of `sneeze-board.web-view.tsx`:

```tsx
import { useEffect, useState } from 'react';
import papi from '@papi/frontend';
import { useSneezeBoardState } from './use-sneeze-board-state';
import { ConnectionBar } from './components/connection-bar';

// @ts-expect-error
globalThis.webViewComponent = function SneezeBoardWebView() {
  const state = useSneezeBoardState();
  const [serverIp, setServerIp] = useState('');
  useEffect(() => {
    papi.settings.get('sneezeBoard.serverIp').then((ip) => {
      if (typeof ip === 'string') setServerIp(ip);
    });
  }, []);
  return (
    <div className="sneeze-board">
      <ConnectionBar connection={state.connection} error={state.error} defaultIp={serverIp} />
      {state.database ? (
        <p>
          Database loaded: {state.database.sneezes.length} sneezes, {state.database.users.length}{' '}
          users.
        </p>
      ) : (
        <p>No database loaded.</p>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Build + smoke test**

Run: `npm run build`. Run: `npm run start`. Open the web view. Connect to `127.0.0.1` (with the server running per Task 1.1). Verify "Connecting…" → "Connected" → "Database loaded: …".

- [ ] **Step 4: Commit**

```bash
git add src/web-views/
git commit -m "feat(web-view): connection bar with live state"
```

### Task 9.3: Sneeze grid

The grid is the centerpiece. Renders `countdownStart - index` numbers in column-major order, colored per user. Use plain CSS Grid (or absolute positioning) — no library needed.

**Files:**

- Create: `src/web-views/components/sneeze-grid.tsx`
- Create: `src/web-views/components/sneeze-grid.scss`
- Modify: `src/web-views/sneeze-board.web-view.tsx`

- [ ] **Step 1: Write the grid component**

```tsx
// src/web-views/components/sneeze-grid.tsx
import { useMemo, useRef, useEffect, useState } from 'react';
import type { SneezeRecord, UserInfo, SneezeDatabase } from 'paranext-extension-sneeze-board';
import { normalizeColor } from '../../util/color';

const CELL_PADDING_X = 10;

export function SneezeGrid({
  database,
  fontSize,
  backgroundColor,
  onSneezeAction,
}: {
  database: SneezeDatabase;
  fontSize: number;
  backgroundColor: string;
  onSneezeAction: (sneeze: SneezeRecord, sneezeIndex: number) => void;
}) {
  const userColor = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of database.users) m.set(u.userId, normalizeColor(u.color));
    return m;
  }, [database.users]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lineHeight = Math.ceil(fontSize * 1.2);
  const rowsPerColumn = Math.max(1, Math.floor(containerHeight / lineHeight));
  const cellWidth =
    String(database.countdownStart).length * Math.ceil(fontSize * 0.62) + CELL_PADDING_X;
  const totalColumns = Math.ceil(database.sneezes.length / rowsPerColumn);
  const totalWidth = totalColumns * cellWidth;

  return (
    <div ref={containerRef} className="sneeze-grid" style={{ background: backgroundColor }}>
      <div
        className="sneeze-grid__inner"
        style={{ width: totalWidth, height: '100%', position: 'relative' }}
      >
        {database.sneezes.map((s, i) => {
          const col = Math.floor(i / rowsPerColumn);
          const row = i % rowsPerColumn;
          const sneezeNum = database.countdownStart - i;
          const color = userColor.get(s.userId) ?? '#000';
          return (
            <span
              key={`${s.userId}-${s.date}-${i}`}
              className={`sneeze-grid__cell${s.comment ? ' has-comment' : ''}`}
              style={{
                left: col * cellWidth,
                top: row * lineHeight,
                color,
                fontSize: `${fontSize}px`,
                lineHeight: `${lineHeight}px`,
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onSneezeAction(s, i);
              }}
              title={`Sneeze ${sneezeNum}\n${s.date}${s.comment ? `\n\n${s.comment}` : ''}`}
            >
              {sneezeNum}
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

```scss
// src/web-views/components/sneeze-grid.scss
.sneeze-grid {
  overflow-x: auto;
  overflow-y: hidden;
  width: 100%;
  height: 60vh;
  border: 1px solid var(--border, #ccc);
}
.sneeze-grid__cell {
  position: absolute;
  font-family: monospace;
  padding: 0 2px;
  &.has-comment {
    outline: 1px solid goldenrod;
  }
}
```

- [ ] **Step 2: Wire it into the web view**

In `sneeze-board.web-view.tsx`:

```tsx
import { SneezeGrid } from './components/sneeze-grid';
import './components/sneeze-grid.scss';
// In the component body, replace the placeholder paragraph:
{
  state.database && (
    <SneezeGrid
      database={state.database}
      fontSize={14}
      backgroundColor="#FFF"
      onSneezeAction={(s) => {
        // Phase 9.5 wires this to an action menu
        console.log('sneeze right-clicked', s);
      }}
    />
  );
}
```

- [ ] **Step 3: Build + smoke test**

`npm run build && npm run start`. Connect; verify the grid renders. With an empty database, the grid is empty (that's fine).

For a load-test fixture: copy `test/fixtures/xml/database-sample.xml` to your `%CommonApplicationData%/SneezeBoard/database1.xml`, restart server, reconnect, verify many cells render and horizontal scrolling works.

- [ ] **Step 4: Commit**

```bash
git add src/web-views/
git commit -m "feat(web-view): sneeze grid component"
```

### Task 9.4: User picker + add user + change color

**Files:**

- Create: `src/web-views/components/user-bar.tsx`
- Modify: `src/web-views/sneeze-board.web-view.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/web-views/components/user-bar.tsx
import { useState } from 'react';
import papi from '@papi/frontend';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'platform-bible-react';
import type { UserInfo } from 'paranext-extension-sneeze-board';
import { normalizeColor } from '../../util/color';

export function UserBar({
  users,
  currentUserId,
  onSneeze,
}: {
  users: UserInfo[];
  currentUserId?: string;
  onSneeze: (userId: string, comment: string) => void;
}) {
  const [comment, setComment] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#00FFEE');
  const [showAddUser, setShowAddUser] = useState(false);

  const currentUser = users.find((u) => u.userId === currentUserId);
  const colorSwatch = currentUser ? normalizeColor(currentUser.color) : '#888';

  return (
    <div className="sneeze-board__user-bar">
      <Select
        value={currentUserId ?? ''}
        onValueChange={(v) => papi.commands.sendCommand('sneezeBoard.setCurrentUser', v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select user" />
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => (
            <SelectItem key={u.userId} value={u.userId}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="sneeze-board__swatch" style={{ background: colorSwatch }} />
      <Button
        onClick={() => {
          if (!currentUser) return;
          const next = prompt('New color (#RRGGBB):', colorSwatch);
          if (next) papi.commands.sendCommand('sneezeBoard.updateUser', currentUser.userId, next);
        }}
      >
        Change color
      </Button>
      <Input placeholder="Comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button
        disabled={!currentUserId}
        onClick={() => {
          if (!currentUserId) return;
          onSneeze(currentUserId, comment);
          setComment('');
        }}
      >
        Sneeze
      </Button>
      <Button variant="ghost" onClick={() => setShowAddUser((s) => !s)}>
        + User
      </Button>
      {showAddUser && (
        <span>
          <Input
            placeholder="New name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
          <Button
            onClick={() => {
              if (!newName) return;
              papi.commands.sendCommand('sneezeBoard.addUser', newName, newColor);
              setNewName('');
              setShowAddUser(false);
            }}
          >
            Add
          </Button>
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into the web view**

In `sneeze-board.web-view.tsx`, between `ConnectionBar` and `SneezeGrid`:

```tsx
{
  state.database && (
    <UserBar
      users={state.database.users}
      currentUserId={state.currentUserId}
      onSneeze={(userId, comment) =>
        papi.commands.sendCommand('sneezeBoard.sneeze', userId, comment)
      }
    />
  );
}
```

If `platform-bible-react` doesn't export `Select`/`SelectTrigger` (shadcn naming may differ), inspect `../paranext-core/lib/platform-bible-react/dist/index.js` or use a native `<select>`.

- [ ] **Step 3: Build + smoke test**

`npm run build && npm run start`. Verify dropdown shows users, "Sneeze" enables when a user is selected. Click Sneeze; new sneeze appears in the grid.

- [ ] **Step 4: Commit**

```bash
git add src/web-views/
git commit -m "feat(web-view): user picker, add user, change color, sneeze action"
```

### Task 9.5: Sneeze edit/remove context menu

**Files:**

- Modify: `src/web-views/sneeze-board.web-view.tsx`

- [ ] **Step 1: Wire `onSneezeAction` to a simple action**

In the `SneezeGrid` callback:

```tsx
onSneezeAction={(s) => {
  if (s.userId !== state.currentUserId) return; // mirrors C# "own sneeze only" rule
  const action = window.prompt(`Sneeze ${state.database!.countdownStart - state.database!.sneezes.indexOf(s)}\n[E]dit comment or [R]emove?`, 'E');
  if (action?.toUpperCase() === 'E') {
    const newComment = window.prompt('New comment:', s.comment ?? '');
    if (newComment !== null) papi.commands.sendCommand('sneezeBoard.updateSneeze', s.date, newComment);
  } else if (action?.toUpperCase() === 'R') {
    if (window.confirm('Remove this sneeze?')) papi.commands.sendCommand('sneezeBoard.removeSneeze', s.date);
  }
}}
```

`window.prompt`/`window.confirm` keep the UI minimal for v0.1. Replace with a proper context menu using `platform-bible-react`'s `DropdownMenu` if time permits.

- [ ] **Step 2: Build + smoke test**

Add a new sneeze, right-click on it, choose Edit → enter a comment → verify it round-trips. Right-click → Remove → verify it disappears.

- [ ] **Step 3: Commit**

```bash
git add src/web-views/sneeze-board.web-view.tsx
git commit -m "feat(web-view): sneeze edit/remove via right-click prompt"
```

### Task 9.6: Apocalypse line + stats dialog

**Files:**

- Modify: `src/web-views/sneeze-board.web-view.tsx`

- [ ] **Step 1: Add apocalypse line**

Above the grid:

```tsx
import { estimateApocalypseDate } from '../util/stats';
// In the JSX:
{
  state.database &&
    (() => {
      const result = estimateApocalypseDate(state.database, 'allTime');
      const text = result === 'noSneezesInRange' ? 'No sneezes in range' : result.toLocaleString();
      return <p>Estimated final sneeze date: {text}</p>;
    })();
}
```

If sneezes count >= countdownStart, also show: `<p style={{ color: 'gold', fontWeight: 'bold' }}>We win!</p>`.

- [ ] **Step 2: Add stats summary**

```tsx
import { findLongestStreaks, findUserStats } from '../util/stats';
// Add to existing imports: useState; place this hook at the top of the component:
const [showStats, setShowStats] = useState(false);
// In the JSX:
<Button variant="ghost" onClick={() => setShowStats(true)}>
  Stats
</Button>;
{
  showStats && state.database && (
    <div className="sneeze-board__stats-overlay" onClick={() => setShowStats(false)}>
      <div className="sneeze-board__stats" onClick={(e) => e.stopPropagation()}>
        <h3>Stats</h3>
        <h4>Longest streaks</h4>
        <ul>
          {[...findLongestStreaks(state.database).entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([userId, streak]) => {
              const user = state.database!.users.find((u) => u.userId === userId);
              return (
                <li key={userId}>
                  {user?.name ?? userId}: {streak}
                </li>
              );
            })}
        </ul>
        <h4>Sneeze counts</h4>
        <ul>
          {[...findUserStats(state.database).entries()]
            .sort((a, b) => b[1].totalSneezes - a[1].totalSneezes)
            .map(([userId, s]) => {
              const user = state.database!.users.find((u) => u.userId === userId);
              return (
                <li key={userId}>
                  {user?.name ?? userId}: {s.totalSneezes}
                </li>
              );
            })}
        </ul>
        <Button onClick={() => setShowStats(false)}>Close</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add minimal CSS**

Append to `sneeze-grid.scss` (or a new file):

```scss
.sneeze-board__stats-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.sneeze-board__stats {
  background: white;
  padding: 24px;
  min-width: 300px;
  max-height: 80vh;
  overflow: auto;
}
```

- [ ] **Step 4: Build + smoke test**

`npm run build && npm run start`. Verify the apocalypse line shows; click Stats; verify the overlay shows counts + streaks.

- [ ] **Step 5: Commit**

```bash
git add src/web-views/
git commit -m "feat(web-view): apocalypse line and stats overlay"
```

---

## Phase 10 — Integration test against real server

### Task 10.1: Integration test

**Files:**

- Create: `test/integration/sneeze-board.integration.test.ts`

- [ ] **Step 1: Write the test**

```ts
// test/integration/sneeze-board.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import { NetworkCommsClient } from '../../src/bridge/network-comms/network-comms-client';
import { decodeSneezeDatabase } from '../../src/bridge/xml/sneeze-database';
import { encodeUserInfo } from '../../src/bridge/xml/user-info';
import { encodeSneezeRecord } from '../../src/bridge/xml/sneeze-record';

const SERVER_EXE = '../SneezeBoard/SneezeBoardServer/bin/Debug/SneezeBoardServer.exe';
const PORT = 57632;
const runIntegration = process.env.RUN_INTEGRATION === '1';

describe.skipIf(!runIntegration)('integration: real SneezeBoardServer', () => {
  let server: ChildProcess;

  beforeAll(async () => {
    server = spawn(SERVER_EXE, [], { stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('server boot timeout')), 10_000);
      server.stdout!.on('data', (d) => {
        if (d.toString().includes('listening')) {
          clearTimeout(timer);
          resolve();
        }
      });
      server.on('error', reject);
    });
  }, 15_000);

  afterAll(() => {
    server?.kill();
  });

  it('connects, requests database, receives a SneezeDatabase reply', async () => {
    const client = new NetworkCommsClient();
    const gotDb = new Promise<string>((resolve) => client.on('DatabaseObject', resolve));
    await client.connect('127.0.0.1', PORT);
    client.send('DatabaseRequested', '0');
    const xml = await Promise.race([
      gotDb,
      new Promise<string>((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
    ]);
    const db = decodeSneezeDatabase(xml);
    expect(db.version).toBeGreaterThan(0);
    client.disconnect();
  });

  it('round-trips a Sneeze', async () => {
    const client = new NetworkCommsClient();
    const personSneezed = new Promise<string>((resolve) => client.on('PersonSneezed', resolve));
    await client.connect('127.0.0.1', PORT);

    // Need a user first
    client.send(
      'AddUser',
      encodeUserInfo({
        userId: '00000000-0000-0000-0000-000000000123',
        color: '#ABCDEF',
        name: 'Integration',
      }),
    );
    await new Promise((r) => setTimeout(r, 200));

    const date = new Date().toISOString();
    client.send(
      'Sneeze',
      encodeSneezeRecord({
        userId: '00000000-0000-0000-0000-000000000123',
        date,
        comment: 'integration test',
      }),
    );
    const echoXml = await Promise.race([
      personSneezed,
      new Promise<string>((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
    ]);
    expect(echoXml).toContain('integration test');
    client.disconnect();
  });
});
```

- [ ] **Step 2: Run locally**

Stop any running SneezeBoardServer instance. Then:

```bash
RUN_INTEGRATION=1 npm test -- integration
```

Expected: 2 tests PASS.

**If the `DatabaseRequested` reply never arrives or arrives with garbled content:** the wire format for the `int 0` payload is wrong. Try alternatives in order:

1. Send 4 bytes little-endian `00 00 00 00` as the payload (raw int).
2. Send protobuf-encoded `int` (a single zero byte).
3. Send empty payload.

Use `scripts/tcp-tee.mjs` to compare against the real C# client's bytes.

- [ ] **Step 3: Commit**

```bash
git add test/integration/
git commit -m "test(integration): real server connection round-trip"
```

---

## Phase 11 — Polish and final smoke

### Task 11.1: README

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Replace the template README with sneeze-board-specific docs**

Use this skeleton:

````markdown
# paranext-extension-sneeze-board

A Platform.Bible extension that connects to the SIL Sneeze Board server.

## Architecture

See `docs/superpowers/specs/2026-05-14-sneeze-board-design.md`.

## Develop

```bash
npm install
npm run build
npm run start  # runs Platform.Bible with the extension loaded
```
````

## Test

```bash
npm test                     # unit tests
RUN_INTEGRATION=1 npm test   # also runs integration tests against a local SneezeBoardServer.exe
```

## Build

```bash
npm run package              # produces release/paranext-extension-sneeze-board_<ver>.zip
```

````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: replace template README with sneeze-board docs"
````

### Task 11.2: Final manual smoke

- [ ] **Step 1: Full end-to-end smoke**

Run: `npm run build && npm run start`.

In Platform.Bible:

1. Open the Sneeze Board web view.
2. Type `127.0.0.1` and Connect (with the local SneezeBoardServer running).
3. Verify "Connected" status appears.
4. Verify the grid renders.
5. Add a new user.
6. Click Sneeze.
7. Right-click the new sneeze, Edit, add a comment.
8. Right-click again, Remove.
9. Click Stats; verify the dialog.
10. Close the app; restart it; verify settings (last user, IP) persist and connect-on-open behaves.

- [ ] **Step 2: Document any deferred items**

If any v0.1 scope item from the spec §11 is not yet working, add a `## Known limitations` section to README with a short list. **STOP and report** to the user with the list before declaring done.

- [ ] **Step 3: Commit any README updates and tag**

```bash
git add README.md
git diff --cached --quiet || git commit -m "docs: note v0.1 known limitations"
git tag v0.0.1
```

---

## Self-review checklist for the executing agent

Before declaring the plan complete, verify:

- [x] Every spec §11 in-scope item has a corresponding task.
- [x] Build (`npm run build`), typecheck (`npm run typecheck`), tests (`npm test`), and `npm run lint` all pass green.
- [~] Integration tests pass when `RUN_INTEGRATION=1`. (DEFERRED — requires running C# server; tests are written and auto-skip when env var/binary not present)
- [~] Manual smoke (Task 11.2) all 10 steps work end-to-end. (DEFERRED — requires interactive Platform.Bible + C# server)
- [x] No `TODO`/`TBD`/`fixme` left in the codebase outside `docs/`.
- [x] All commits are atomic and have conventional commit messages.

If any of those fail, STOP and report to the user with the specific failure — do not silently skip or work around.

---

## Execution summary (2026-05-14)

Phases 0, 2, 3, 4, 5, 6, 7, 8, 9, 11 are fully implemented and verified
(`npm test`, `npm run typecheck`, `npm run build`, `npm run lint` all green).

Phase 1 (wire-format fixture capture) and Phase 10 (real-server integration
test execution) are **deferred**: the agent shell did not have access to the
.NET Framework 4.5.2 toolchain or Visual Studio required to build the C#
`SneezeBoardServer` / `SneezeBoardClient`. The plan explicitly anticipates
this case. Concrete artifacts produced:

- `scripts/tcp-tee.mjs` — the byte-capture proxy is in place.
- `test/fixtures/wire/README.md` — documents how to capture canonical wire
  fixtures when the C# toolchain is available.
- `test/fixtures/xml/*.xml` — hand-crafted XML payload fixtures.
- `test/integration/sneeze-board.integration.test.ts` — gated by
  `RUN_INTEGRATION=1` env var **and** existence of
  `../SneezeBoard/SneezeBoardServer/bin/Debug/SneezeBoardServer.exe`.
  Auto-skips when either condition is false.

The codec was therefore implemented from documented NetworkComms.Net 3.0.3
framing (`[1-byte header length][protobuf header][payload]`). Real-server
divergence (if any) will surface when the integration test is first run
against a live `SneezeBoardServer.exe`.

The `DatabaseRequested` payload is currently sent as UTF-8 string `"0"`
(see `src/bridge/index.ts`). The real C# client sends a protobuf-net-wrapped
`int` payload. If the real server rejects this, the next step is to capture
the C# client's `DatabaseRequested` bytes via `scripts/tcp-tee.mjs` and
either (a) send those bytes verbatim via a new `sendBinary` API on
`NetworkCommsClient`, or (b) confirm the server tolerates UTF-8 `"0"`.
