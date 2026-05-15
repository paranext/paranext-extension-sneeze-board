import { describe, it, expect } from 'vitest';
import { encodePacket, tryDecodePacket } from './packet';
import { existsSync, readFileSync } from 'node:fs';

const fixturePath = 'test/fixtures/wire/01-database-requested.bin';
const fixtureExists = existsSync(fixturePath);

describe('packet framing', () => {
  it.skipIf(!fixtureExists)('decodes the captured DatabaseRequested packet end-to-end', () => {
    const buf = readFileSync(fixturePath);
    const decoded = tryDecodePacket(new Uint8Array(buf));
    expect(decoded).not.toBeNull();
    expect(decoded!.header.packetType).toBe('DatabaseRequested');
    expect(decoded!.payload.length).toBe(decoded!.header.payloadPacketSize);
    expect(decoded!.bytesConsumed).toBe(buf.length);
  });

  it('returns null when buffer is incomplete', () => {
    const payload = new TextEncoder().encode('hello world');
    const packet = encodePacket({ packetType: 'Test', payloadPacketSize: payload.length }, payload);
    const partial = packet.subarray(0, packet.length - 1);
    expect(tryDecodePacket(partial)).toBeNull();
  });

  it('returns null on empty buffer', () => {
    expect(tryDecodePacket(new Uint8Array(0))).toBeNull();
  });

  it('returns null when header is incomplete', () => {
    const packet = encodePacket({ packetType: 'Test', payloadPacketSize: 0 }, new Uint8Array(0));
    const shortHeader = packet.subarray(0, 2); // header length byte + 1 byte of header
    expect(tryDecodePacket(shortHeader)).toBeNull();
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
    expect(decoded!.bytesConsumed).toBe(encoded.length);
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
