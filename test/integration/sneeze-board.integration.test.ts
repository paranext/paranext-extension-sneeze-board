// Integration test against a real SneezeBoardServer.exe. Gated by RUN_INTEGRATION=1.
// Skipped by default (and in CI) because the server requires a .NET runtime and may not be
// available in every environment.
//
// To run: build the C# server (see test/fixtures/wire/README.md), then:
//   RUN_INTEGRATION=1 npm test -- integration
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { NetworkCommsClient } from '../../src/bridge/network-comms/network-comms-client';
import { decodeSneezeDatabase } from '../../src/bridge/xml/sneeze-database';
import { encodeUserInfo } from '../../src/bridge/xml/user-info';
import { encodeSneezeRecord } from '../../src/bridge/xml/sneeze-record';

const SERVER_EXE = '../SneezeBoard/SneezeBoardServer/bin/Debug/SneezeBoardServer.exe';
const PORT = 57632;
const runIntegration = process.env.RUN_INTEGRATION === '1' && existsSync(SERVER_EXE);

describe.skipIf(!runIntegration)('integration: real SneezeBoardServer', () => {
  let server: ChildProcess | undefined;

  beforeAll(async () => {
    server = spawn(SERVER_EXE, [], { stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('server boot timeout')), 10_000);
      server!.stdout!.on('data', (d: Buffer) => {
        if (d.toString().includes('listening')) {
          clearTimeout(timer);
          resolve();
        }
      });
      server!.on('error', reject);
    });
  }, 15_000);

  afterAll(() => {
    server?.kill();
  });

  it('connects, requests database, receives a SneezeDatabase reply', async () => {
    const client = new NetworkCommsClient();
    const gotDb = new Promise<string>((resolve) => {
      client.on('DatabaseObject', (payload) => resolve(payload));
    });
    await client.connect('127.0.0.1', PORT);
    client.send('DatabaseRequested', '0');
    const xml = await Promise.race([
      gotDb,
      new Promise<string>((_, r) => {
        setTimeout(() => r(new Error('timeout')), 5000);
      }),
    ]);
    const db = decodeSneezeDatabase(xml);
    expect(db.version).toBeGreaterThan(0);
    client.disconnect();
  });

  it('round-trips a Sneeze', async () => {
    const client = new NetworkCommsClient();
    const personSneezed = new Promise<string>((resolve) => {
      client.on('PersonSneezed', (payload) => resolve(payload));
    });
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
    await new Promise((r) => {
      setTimeout(r, 200);
    });

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
      new Promise<string>((_, r) => {
        setTimeout(() => r(new Error('timeout')), 5000);
      }),
    ]);
    expect(echoXml).toContain('integration test');
    client.disconnect();
  });
});
