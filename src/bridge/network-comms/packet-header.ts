// Protobuf-net wire format reference: https://protobuf.dev/programming-guides/encoding/
// PacketHeader proto contract (from NetworkComms.Net 3.0.3 PacketHeader.cs):
//   [ProtoMember(1)] string PacketType
//   [ProtoMember(2)] int PayloadPacketSize
//   [ProtoMember(3, IsRequired=false)] string RequestedReturnPacketType
//   [ProtoMember(4, IsRequired=false)] string PacketIdentifier
//   [ProtoMember(5, IsRequired=false)] long ReceiveSendSeed
//   [ProtoMember(6, IsRequired=false)] long CheckSumHash  (varies by version; verify against captured fixtures)

export type PacketHeader = {
  packetType: string;
  payloadPacketSize: number;
  requestedReturnPacketType?: string;
  packetIdentifier?: string;
  receiveSendSeed?: number;
};

const WIRE_VARINT = 0;
const WIRE_LENGTH_DELIMITED = 2;
const WIRE_FIXED32 = 5;
const WIRE_FIXED64 = 1;

function readVarint(buf: Uint8Array, offset: number): { value: number; offset: number } {
  let result = 0;
  let shift = 0;
  let i = offset;
  while (i < buf.length) {
    const b = buf[i];
    i += 1;
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
        } else if (wireType === WIRE_FIXED32) {
          i += 4;
        } else if (wireType === WIRE_FIXED64) {
          i += 8;
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
