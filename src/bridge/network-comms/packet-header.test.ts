import { describe, it, expect } from 'vitest';
import { decodeHeader, encodeHeader, type PacketHeader } from './packet-header';
import { existsSync, readFileSync } from 'node:fs';

const fixturePath = 'test/fixtures/wire/01-database-requested.bin';
const fixtureExists = existsSync(fixturePath);

describe('PacketHeader codec', () => {
  it.skipIf(!fixtureExists)('decodes a real DatabaseRequested header from the C# client', () => {
    const fileBytes = readFileSync(fixturePath);
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

  it('round-trips a header with optional fields', () => {
    const original: PacketHeader = {
      packetType: 'DatabaseRequested',
      payloadPacketSize: 1,
      requestedReturnPacketType: 'DatabaseObject',
      packetIdentifier: 'abc-123',
      receiveSendSeed: 42,
    };
    const encoded = encodeHeader(original);
    const decoded = decodeHeader(encoded);
    expect(decoded).toEqual(original);
  });

  it('skips unknown fields gracefully', () => {
    // Build a buffer that has tag 1 (packetType), tag 2 (size), and an unknown tag 99 with varint.
    const known = encodeHeader({ packetType: 'X', payloadPacketSize: 0 });
    // Unknown field: tag 99, wire type varint (0). key = (99 << 3) | 0 = 792 = varint encoded
    // 792 = 0x318 = 1100011000b in varint: low 7 bits = 0001100 (0x18), high 7 bits = 0000110 (0x6)
    // varint bytes: 0x98 0x06
    const unknown = new Uint8Array([0x98, 0x06, 0x2a]);
    const combined = new Uint8Array(known.length + unknown.length);
    combined.set(known);
    combined.set(unknown, known.length);
    const decoded = decodeHeader(combined);
    expect(decoded.packetType).toBe('X');
    expect(decoded.payloadPacketSize).toBe(0);
  });
});
