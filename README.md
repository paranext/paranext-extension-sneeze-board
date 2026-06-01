# paranext-extension-sneeze-board

A Platform.Bible extension that connects to the SIL Sneeze Board server.

WARNING: This extension is entirely AI-generated with essentially zero code oversight. There may be lots of less-than-best practices and examples you do not want to follow.

## Architecture

The extension uses three artifacts that work together:

- **Extension main** (`src/main.ts`) runs in the Platform.Bible extension host
  (a sandboxed Node environment with restricted module access). It owns command
  registration, the `sneezeBoard.state` PAPI Network Object, and the React web
  view provider.
- **Bridge** (`src/bridge/index.ts`, built to `dist/assets/bridge/index.js`)
  runs as a Node child process spawned via
  `papi.elevatedPrivileges.createProcess.fork`. It owns the TCP socket to the
  `SneezeBoardServer`, implements the NetworkComms.Net binary framing, and
  handles XML payload codecs. It is intentionally outside the sandbox.
- **Web view** (`src/web-views/sneeze-board.web-view.tsx`) is a React component
  bundled inline into the extension main. It subscribes to the state Network
  Object and dispatches commands via PAPI.

See `docs/superpowers/specs/2026-05-14-sneeze-board-design.md` for the full
design spec.

## Develop

```bash
npm install
npm run build
npm run start    # runs Platform.Bible with the extension loaded
```

## Test

```bash
npm test                              # unit tests
RUN_INTEGRATION=1 npm test -- integration   # also runs integration tests against a local
                                            # SneezeBoardServer.exe (must be running)
```

`npm run typecheck` runs `tsc --noEmit` with `skipLibCheck`.

## Build / package

```bash
npm run package    # produces release/paranext-extension-sneeze-board_<ver>.zip
```

## Known limitations (v0.1)

- The NetworkComms.Net wire format codec was implemented from documentation
  rather than from captured byte fixtures (the C# build toolchain was not
  available when this was first written). Real-server bytes still flow through
  the same codec; if any framing assumption is wrong, the integration test
  (Phase 10) is the first place to look. See `test/fixtures/wire/README.md`
  for how to capture canonical fixtures with `scripts/tcp-tee.mjs`.
- The `DatabaseRequested` payload is sent as the UTF-8 string `"0"` for now.
  The C# client emits a protobuf-net-wrapped int payload. If the real server
  rejects this, extend `NetworkCommsClient` with a `sendBinary` API and send
  the captured payload bytes verbatim.
- The right-click context menu on sneeze cells uses `window.prompt`/
  `window.confirm` rather than a proper dropdown; v0.2 should replace with
  `platform-bible-react`'s `DropdownMenu`.
- Streak-achievement popups (`GetLongestStreak` message dialogs in the C#
  client) are not yet ported. The data is available in `findLongestStreaks`.
- No system tray / notify-icon (Platform.Bible has no extension analog).
- English-only; localization keys are declared in
  `contributions/localizedStrings.json` but the web view strings are inline.
