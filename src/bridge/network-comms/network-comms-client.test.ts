import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import net from 'node:net';
import { NetworkCommsClient } from './network-comms-client';
import { encodePacket, tryDecodePacket } from './packet';
import { decodeConnectionInfo, encodeConnectionInfo } from './connection-info';
import { PT } from './packet-types';

/**
 * Minimal fake NetworkComms.Net server: completes the ConnectionSetup handshake (with a hardcoded
 * ConnectionInfo reply) and echoes any other packet back with the same packetType and string
 * payload.
 */
function makeFakeServer(): Promise<{ port: number; close: () => Promise<void> }> {
  // Rename to avoid shadowing the inner Promise's resolve below.
  // eslint-disable-next-line promise/param-names
  return new Promise((resolveOuter) => {
    const server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        let r = tryDecodePacket(new Uint8Array(buffer));
        while (r) {
          if (r.header.packetType === PT.ConnectionSetup) {
            // Decode the client's ConnectionInfo (we don't actually need it,
            // but verify it parses) and reply with our own.
            try {
              decodeConnectionInfo(r.payload);
            } catch {
              /* tolerate */
            }
            const reply = encodeConnectionInfo({
              connectionType: 1,
              networkIdentifier: 'AAAAAAAAAAAAAAAAAAAAAA',
              localEndPointAddress: '127.0.0.1',
              localEndPointPort: 0,
              isConnectable: true,
              applicationLayerProtocol: 1,
            });
            const frame = encodePacket(
              { packetType: PT.ConnectionSetup, payloadPacketSize: reply.length },
              reply,
            );
            socket.write(frame);
          } else {
            // Echo back with the same packetType and payload bytes.
            const echo = encodePacket(
              { packetType: r.header.packetType, payloadPacketSize: r.payload.length },
              r.payload,
            );
            socket.write(echo);
          }
          buffer = buffer.subarray(r.bytesConsumed);
          r = tryDecodePacket(new Uint8Array(buffer));
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolveOuter({
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
    server = await makeFakeServer();
  });
  afterEach(async () => server.close());

  it('connects through the handshake, sends a string packet, receives the echo', async () => {
    const client = new NetworkCommsClient();
    const received = new Promise<string>((resolve) => {
      client.on('Sneeze', (payload) => resolve(payload));
    });
    await client.connect('127.0.0.1', server.port);
    client.send('Sneeze', '<x/>');
    await expect(received).resolves.toBe('<x/>');
    client.disconnect();
  });

  it('reports state transitions through the handshake', async () => {
    const client = new NetworkCommsClient();
    const states: string[] = [];
    client.onState((s) => states.push(s));
    await client.connect('127.0.0.1', server.port);
    expect(states).toContain('connecting');
    expect(states).toContain('open');
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
