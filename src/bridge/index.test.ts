// Smoke test: spawn the bridge as a child process and exchange IPC messages
// against an in-memory NetworkCommsServer echo. Defer the harder integration
// test to Phase 10.
import { describe, it, expect } from 'vitest';
import { fork, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { existsSync } from 'node:fs';

const bridgeBundlePath = path.resolve('dist/assets/bridge/index.js');
const bundleExists = existsSync(bridgeBundlePath);

describe.skipIf(!bundleExists)('bridge IPC smoke', () => {
  it('sends connect/disconnect and emits state events', async () => {
    const sockets: net.Socket[] = [];
    const server = net.createServer((socket) => {
      sockets.push(socket);
      // Swallow client-side close/reset so vitest doesn't see unhandled errors.
      socket.on('error', () => {});
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const { port } = server.address() as net.AddressInfo;

    const bridge: ChildProcess = fork(bridgeBundlePath, [], { silent: true });
    const events: unknown[] = [];
    bridge.on('message', (m) => events.push(m));

    bridge.send({ kind: 'connect', host: '127.0.0.1', port });
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
    expect(events.map((e: { kind: string } | unknown) => (e as { kind: string }).kind)).toContain(
      'state',
    );

    bridge.send({ kind: 'disconnect' });
    // Wait a beat for the bridge to disconnect cleanly before killing the process.
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    bridge.kill();
    await new Promise<void>((resolve) => {
      bridge.on('exit', () => resolve());
    });
    for (const s of sockets) s.destroy();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });
});
