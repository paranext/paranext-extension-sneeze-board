import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import net from 'node:net';
import { NetworkCommsClient } from './network-comms-client';
import { encodePacket, tryDecodePacket } from './packet';

function makeEchoServer(): Promise<{ port: number; close: () => Promise<void> }> {
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
      resolve({
        port,
        close: () =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          }),
      });
    });
  });
}

describe('NetworkCommsClient', () => {
  let server: { port: number; close: () => Promise<void> };
  beforeEach(async () => {
    server = await makeEchoServer();
  });
  afterEach(async () => server.close());

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
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
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
