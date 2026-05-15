// NetworkComms.Net v3.0.3 PacketHeader wire format (custom IExplicitlySerialize):
//
//   [ 4 bytes LE: longItems count ]
//   for each long item:
//     [ 4 bytes LE: PacketHeaderLongItems key ]
//     [ 8 bytes LE: value ]
//   [ 4 bytes LE: stringItems count ]
//   for each string item:
//     [ 4 bytes LE: PacketHeaderStringItems key ]
//     [ 4 bytes LE: UTF-8 byte length ]
//     [ N bytes:    UTF-8 string bytes ]
//
// Reference: decompiled NetworkCommsDotNet.PacketHeader.Serialize / Deserialize.

export enum PacketHeaderLongItem {
  TotalPayloadSize = 0,
  SerializerProcessors = 1,
  PacketSequenceNumber = 2,
  PacketCreationTime = 3,
}

export enum PacketHeaderStringItem {
  PacketType = 0,
  ReceiveConfirmationRequired = 1,
  RequestedReturnPacketType = 2,
  CheckSumHash = 3,
  SourceNetworkIdentifier = 4,
  PacketIdentifier = 5,
  NullDataSection = 6,
}

export type PacketHeader = {
  packetType: string;
  payloadPacketSize: number;
  requestedReturnPacketType?: string;
  packetIdentifier?: string;
  sourceNetworkIdentifier?: string;
  packetSequenceNumber?: bigint;
  packetCreationTime?: bigint;
};

function writeInt32LE(buf: number[], value: number) {
  buf.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function readInt32LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24);
}

function writeInt64LE(buf: number[], value: bigint) {
  let v = value;
  for (let i = 0; i < 8; i++) {
    buf.push(Number(v & 0xffn));
    v >>= 8n;
  }
}

function readInt64LE(buf: Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 7; i >= 0; i--) {
    v = (v << 8n) | BigInt(buf[offset + i]);
  }
  // Handle two's complement for negative values (rare for our use)
  if (v >= 1n << 63n) v -= 1n << 64n;
  return v;
}

function writeStringEntry(buf: number[], key: PacketHeaderStringItem, value: string) {
  writeInt32LE(buf, key);
  const bytes = Buffer.from(value, 'utf-8');
  writeInt32LE(buf, bytes.length);
  for (let i = 0; i < bytes.length; i++) buf.push(bytes[i]);
}

function writeLongEntry(buf: number[], key: PacketHeaderLongItem, value: bigint) {
  writeInt32LE(buf, key);
  writeInt64LE(buf, value);
}

export function encodeHeader(h: PacketHeader): Uint8Array {
  const longItems: Array<[PacketHeaderLongItem, bigint]> = [];
  longItems.push([PacketHeaderLongItem.TotalPayloadSize, BigInt(h.payloadPacketSize)]);
  if (h.packetSequenceNumber !== undefined)
    longItems.push([PacketHeaderLongItem.PacketSequenceNumber, h.packetSequenceNumber]);
  if (h.packetCreationTime !== undefined)
    longItems.push([PacketHeaderLongItem.PacketCreationTime, h.packetCreationTime]);

  const stringItems: Array<[PacketHeaderStringItem, string]> = [];
  stringItems.push([PacketHeaderStringItem.PacketType, h.packetType]);
  if (h.requestedReturnPacketType !== undefined)
    stringItems.push([
      PacketHeaderStringItem.RequestedReturnPacketType,
      h.requestedReturnPacketType,
    ]);
  if (h.packetIdentifier !== undefined)
    stringItems.push([PacketHeaderStringItem.PacketIdentifier, h.packetIdentifier]);
  if (h.sourceNetworkIdentifier !== undefined)
    stringItems.push([PacketHeaderStringItem.SourceNetworkIdentifier, h.sourceNetworkIdentifier]);

  const out: number[] = [];
  writeInt32LE(out, longItems.length);
  for (const [k, v] of longItems) writeLongEntry(out, k, v);
  writeInt32LE(out, stringItems.length);
  for (const [k, v] of stringItems) writeStringEntry(out, k, v);
  return new Uint8Array(out);
}

export function decodeHeader(buf: Uint8Array): PacketHeader {
  let i = 0;
  const longCount = readInt32LE(buf, i);
  i += 4;
  const longs = new Map<PacketHeaderLongItem, bigint>();
  for (let n = 0; n < longCount; n++) {
    const key = readInt32LE(buf, i) as PacketHeaderLongItem;
    i += 4;
    const value = readInt64LE(buf, i);
    i += 8;
    longs.set(key, value);
  }
  const stringCount = readInt32LE(buf, i);
  i += 4;
  const strings = new Map<PacketHeaderStringItem, string>();
  for (let n = 0; n < stringCount; n++) {
    const key = readInt32LE(buf, i) as PacketHeaderStringItem;
    i += 4;
    const len = readInt32LE(buf, i);
    i += 4;
    const value = Buffer.from(buf.subarray(i, i + len)).toString('utf-8');
    i += len;
    strings.set(key, value);
  }

  const payloadPacketSize = Number(longs.get(PacketHeaderLongItem.TotalPayloadSize) ?? 0n);
  const packetType = strings.get(PacketHeaderStringItem.PacketType) ?? '';

  return {
    packetType,
    payloadPacketSize,
    requestedReturnPacketType: strings.get(PacketHeaderStringItem.RequestedReturnPacketType),
    packetIdentifier: strings.get(PacketHeaderStringItem.PacketIdentifier),
    sourceNetworkIdentifier: strings.get(PacketHeaderStringItem.SourceNetworkIdentifier),
    packetSequenceNumber: longs.get(PacketHeaderLongItem.PacketSequenceNumber),
    packetCreationTime: longs.get(PacketHeaderLongItem.PacketCreationTime),
  };
}
