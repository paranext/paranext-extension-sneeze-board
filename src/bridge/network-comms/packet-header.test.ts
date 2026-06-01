import { describe, it, expect } from 'vitest';
import {
  decodeHeader,
  encodeHeader,
  PacketHeaderLongItem,
  PacketHeaderStringItem,
  type PacketHeader,
} from './packet-header';

describe('PacketHeader codec', () => {
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
      payloadPacketSize: 4,
      requestedReturnPacketType: 'Database object',
      packetIdentifier: 'abc-123',
      sourceNetworkIdentifier: 'aaaaaaaaaaaaaaaaaaaaaa',
    };
    const encoded = encodeHeader(original);
    const decoded = decodeHeader(encoded);
    expect(decoded.packetType).toBe(original.packetType);
    expect(decoded.payloadPacketSize).toBe(original.payloadPacketSize);
    expect(decoded.requestedReturnPacketType).toBe(original.requestedReturnPacketType);
    expect(decoded.packetIdentifier).toBe(original.packetIdentifier);
    expect(decoded.sourceNetworkIdentifier).toBe(original.sourceNetworkIdentifier);
  });

  it('decodes a header with extra long items (e.g., SerializerProcessors) gracefully', () => {
    // Manually construct a header with 3 long items: TotalPayloadSize, SerializerProcessors,
    // PacketSequenceNumber — and 1 string item: PacketType. Mirrors what the C# server emits.
    const out: number[] = [];
    const w32 = (v: number) =>
      out.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
    const w64 = (v: bigint) => {
      let x = v;
      for (let i = 0; i < 8; i++) {
        out.push(Number(x & 0xffn));
        x >>= 8n;
      }
    };
    const wStr = (s: string) => {
      const b = Buffer.from(s, 'utf-8');
      w32(b.length);
      for (let i = 0; i < b.length; i++) out.push(b[i]);
    };

    w32(3); // long count
    w32(PacketHeaderLongItem.TotalPayloadSize);
    w64(42n);
    w32(PacketHeaderLongItem.SerializerProcessors);
    w64(0x0000020300000000n);
    w32(PacketHeaderLongItem.PacketSequenceNumber);
    w64(7n);
    w32(1); // string count
    w32(PacketHeaderStringItem.PacketType);
    wStr('Database object');

    const decoded = decodeHeader(new Uint8Array(out));
    expect(decoded.packetType).toBe('Database object');
    expect(decoded.payloadPacketSize).toBe(42);
    expect(decoded.packetSequenceNumber).toBe(7n);
  });
});
