# Wire-format fixtures

These fixtures should be captured via `scripts/tcp-tee.mjs` against a running
`SneezeBoardServer.exe` (NetworkComms.Net 3.0.3), exercising each client
operation with the canonical C# `SneezeBoardClient.exe`.

## Status: deferred

The fixture capture (Task 1.3 / 1.4 in the implementation plan) requires
building the C# server and client locally with Visual Studio 2022 plus the
.NET Framework 4.5.2 (or 4.8) developer pack. This is not feasible in the
non-interactive agent shell that produced the initial implementation; the
C# client is also a WinForms GUI that requires user interaction.

The Phase 2/3 codec implementation therefore relies on the documented
NetworkComms.Net 3.0.3 framing (see comments in
`src/bridge/network-comms/packet-header.ts`) and on synthetic round-trip
tests. Phase 10's integration test (`test/integration/`, gated by
`RUN_INTEGRATION=1`) exercises the real server, which is the canonical
source-of-truth check.

## How to capture (when the C# toolchain is available)

1. Build the C# solution (see Task 1.1 in the implementation plan).
2. Start the server: `SneezeBoardServer.exe`.
3. Start the tee proxy:
   `node scripts/tcp-tee.mjs 57633 127.0.0.1 57632 test/fixtures/raw`.
4. Run the C# client, point it at `127.0.0.1` (the client hard-codes
   `CommonInfo.ServerPort = 57632`; to route through the proxy, temporarily
   change that constant to `57633`, rebuild, and revert after).
5. Exercise each message type:
   - Connect (captures `DatabaseRequested` + `DatabaseObject`)
   - Add a user (captures `AddUser` + `UserUpdated`)
   - Sneeze (captures `Sneeze` + `PersonSneezed`)
   - Right-click sneeze → Edit comment (captures `UpdateSneeze` + `SneezeUpdated`)
   - Right-click sneeze → Remove (captures `RemoveSneeze` + `SneezeRemoved`)
   - Change color (captures `UpdateUser`)
6. Copy the per-session `.bin` files into this folder using the file naming
   convention below.

## Naming convention

| File | Direction | Message type | Source |
|---|---|---|---|
| `01-database-requested.bin` | C->S | `DatabaseRequested` | First connect from C# client |
| `01-database-object.bin` | S->C | `DatabaseObject` | Server reply, empty DB |
| `02-mixed-session-c2s.bin` | C->S | AddUser, Sneeze, UpdateSneeze, RemoveSneeze | Single session |
| `02-mixed-session-s2c.bin` | S->C | UserUpdated, PersonSneezed, SneezeUpdated, SneezeRemoved | ... |
| `03-update-user.bin` | C->S | `UpdateUser` | Change color |

Once present, the `all-fixtures.test.ts` test in
`src/bridge/network-comms/` will automatically verify every `.bin` decodes
end-to-end.
