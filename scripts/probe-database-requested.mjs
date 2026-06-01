// Probes the SneezeBoardServer with several candidate DatabaseRequested payload
// encodings and reports which ones (if any) elicit a DatabaseObject reply.
// Usage: node scripts/probe-database-requested.mjs [host] [port]
import net from 'node:net';

const host = process.argv[2] || '127.0.0.1';
const port = Number(process.argv[3] || 57632);

function writeVarint(value) {
  const out = [];
  let v = value >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v & 0x7f);
  return Buffer.from(out);
}

function writeString(value) {
  const bytes = Buffer.from(value, 'utf-8');
  return Buffer.concat([writeVarint(bytes.length), bytes]);
}

function encodeHeader({ packetType, payloadSize, requestedReturn }) {
  // Field 1: PacketType (string, wireType 2)
  // Field 2: PayloadPacketSize (varint, wireType 0)
  // Field 3: RequestedReturnPacketType (string, wireType 2) — optional
  const parts = [];
  parts.push(Buffer.from([(1 << 3) | 2]));
  parts.push(writeString(packetType));
  parts.push(Buffer.from([(2 << 3) | 0]));
  parts.push(writeVarint(payloadSize));
  if (requestedReturn) {
    parts.push(Buffer.from([(3 << 3) | 2]));
    parts.push(writeString(requestedReturn));
  }
  return Buffer.concat(parts);
}

function encodePacket({ packetType, payload, requestedReturn }) {
  const header = encodeHeader({
    packetType,
    payloadSize: payload.length,
    requestedReturn,
  });
  if (header.length > 255) throw new Error('header too large for single-byte prefix');
  return Buffer.concat([Buffer.from([header.length]), header, payload]);
}

function tryDecodeAllPackets(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    if (i + 1 > buf.length) break;
    const hl = buf[i];
    if (i + 1 + hl > buf.length) break;
    const headerBytes = buf.subarray(i + 1, i + 1 + hl);
    // Quick-and-dirty: pull PacketType (field 1, length-delimited)
    let h = 0;
    let packetType = '?';
    let payloadSize = 0;
    while (h < headerBytes.length) {
      const key = headerBytes[h++];
      const tag = key >>> 3;
      const wire = key & 7;
      if (tag === 1 && wire === 2) {
        const len = headerBytes[h++];
        packetType = headerBytes.subarray(h, h + len).toString('utf8');
        h += len;
      } else if (tag === 2 && wire === 0) {
        let v = 0;
        let shift = 0;
        while (true) {
          const b = headerBytes[h++];
          v |= (b & 0x7f) << shift;
          if (!(b & 0x80)) break;
          shift += 7;
        }
        payloadSize = v;
      } else if (wire === 2) {
        const len = headerBytes[h++];
        h += len;
      } else if (wire === 0) {
        while (headerBytes[h++] & 0x80) {}
      } else break;
    }
    if (i + 1 + hl + payloadSize > buf.length) break;
    const payload = buf.subarray(i + 1 + hl, i + 1 + hl + payloadSize);
    out.push({ packetType, payloadSize, payload });
    i += 1 + hl + payloadSize;
  }
  return out;
}

async function probe(label, payload) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let rx = Buffer.alloc(0);
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const packets = tryDecodeAllPackets(rx);
        socket.destroy();
        resolve({ label, replied: false, bytes: rx.length, packets });
      }
    }, 1500);
    socket.on('data', (chunk) => {
      rx = Buffer.concat([rx, chunk]);
      const packets = tryDecodeAllPackets(rx);
      if (packets.some((p) => p.packetType === 'DatabaseObject')) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          socket.destroy();
          resolve({ label, replied: true, bytes: rx.length, packets });
        }
      }
    });
    socket.on('error', (e) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ label, error: e.message });
      }
    });
    socket.on('connect', () => {
      const frame = encodePacket({
        packetType: 'DatabaseRequested',
        payload,
        requestedReturn: 'DatabaseObject',
      });
      socket.write(frame);
    });
  });
}

const candidates = [
  // UTF-8 "0" - current broken behavior
  ['utf8-zero', Buffer.from('0', 'utf8')],
  // Empty payload
  ['empty', Buffer.alloc(0)],
  // Raw 4-byte LE int
  ['int32-le-zero', Buffer.from([0, 0, 0, 0])],
  // Single zero byte
  ['single-zero-byte', Buffer.from([0])],
  // Protobuf-net top-level int32: field 1, varint, value 0  => [0x08, 0x00]
  ['proto-field1-zero', Buffer.from([0x08, 0x00])],
  // Protobuf-net top-level int32: field 1, varint, value 0 (compact) => [0x00]
  ['proto-raw-varint-zero', Buffer.from([0x00])],
  // No requestedReturn header at all, empty payload
];

(async () => {
  for (const [label, payload] of candidates) {
    const res = await probe(label, payload);
    const types = res.packets ? res.packets.map((p) => p.packetType).join(',') : '';
    console.log(
      `${label.padEnd(24)} | bytes=${String(res.bytes ?? 0).padStart(6)} | replied=${res.replied ?? false} | types=[${types}]${
        res.error ? ` | err=${res.error}` : ''
      }`,
    );
  }
  process.exit(0);
})();
