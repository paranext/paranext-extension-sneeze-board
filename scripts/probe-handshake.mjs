// Tries the full NetworkComms.Net handshake against the live server:
//  1. TCP connect
//  2. Send ConnectionSetup with serialized ConnectionInfo
//  3. Wait for the server's ConnectionSetup reply
//  4. Send DatabaseRequested with int(0) payload
//  5. Wait for DatabaseObject reply
// Usage: node scripts/probe-handshake.mjs [host] [port]
import net from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';

function shortGuid() {
  // C# ShortGuid: base64 of 16 random bytes, '/' -> '_', '+' -> '-', first 22 chars
  return randomBytes(16)
    .toString('base64')
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    .substring(0, 22);
}

const host = process.argv[2] || '127.0.0.1';
const port = Number(process.argv[3] || 57632);

// ---- helpers ----
function w32(buf, v) {
  buf.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}
function w64(buf, vBig) {
  let v = BigInt(vBig);
  for (let i = 0; i < 8; i++) {
    buf.push(Number(v & 0xffn));
    v >>= 8n;
  }
}
function r32(buf, off) {
  return buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24);
}
function wStr(buf, s) {
  const b = Buffer.from(s, 'utf8');
  w32(buf, b.length);
  for (const c of b) buf.push(c);
}

// Enum constants
const LONG_TotalPayloadSize = 0;
const STR_PacketType = 0;
const STR_RequestedReturnPacketType = 2;
const STR_PacketIdentifier = 5;

function encodeHeader({ packetType, payloadSize, requestedReturn, packetIdentifier }) {
  // longItems: TotalPayloadSize
  const longs = [[LONG_TotalPayloadSize, BigInt(payloadSize)]];
  // stringItems: PacketType + optional RequestedReturn + optional PacketIdentifier
  const strings = [[STR_PacketType, packetType]];
  if (requestedReturn) strings.push([STR_RequestedReturnPacketType, requestedReturn]);
  if (packetIdentifier) strings.push([STR_PacketIdentifier, packetIdentifier]);

  const out = [];
  w32(out, longs.length);
  for (const [k, v] of longs) {
    w32(out, k);
    w64(out, v);
  }
  w32(out, strings.length);
  for (const [k, v] of strings) {
    w32(out, k);
    wStr(out, v);
  }
  return Buffer.from(out);
}

function decodeHeader(buf) {
  let i = 0;
  const longs = new Map();
  const strings = new Map();
  const longCount = r32(buf, i);
  i += 4;
  for (let n = 0; n < longCount; n++) {
    const k = r32(buf, i);
    i += 4;
    // Read 8-byte LE as bigint
    let v = 0n;
    for (let b = 7; b >= 0; b--) v = (v << 8n) | BigInt(buf[i + b]);
    longs.set(k, v);
    i += 8;
  }
  const stringCount = r32(buf, i);
  i += 4;
  for (let n = 0; n < stringCount; n++) {
    const k = r32(buf, i);
    i += 4;
    const len = r32(buf, i);
    i += 4;
    const s = buf.subarray(i, i + len).toString('utf8');
    i += len;
    strings.set(k, s);
  }
  return {
    packetType: strings.get(0) ?? '',
    payloadPacketSize: Number(longs.get(LONG_TotalPayloadSize) ?? 0n),
    requestedReturn: strings.get(STR_RequestedReturnPacketType),
    packetIdentifier: strings.get(STR_PacketIdentifier),
    bytesConsumed: i,
  };
}

function frame(header, payload) {
  if (header.length > 255) throw new Error('header too big');
  const out = Buffer.alloc(1 + header.length + payload.length);
  out[0] = header.length;
  header.copy(out, 1);
  payload.copy(out, 1 + header.length);
  return out;
}

function tryDecodePacket(buf) {
  if (buf.length < 1) return null;
  const hLen = buf[0];
  if (buf.length < 1 + hLen) return null;
  const headerBytes = buf.subarray(1, 1 + hLen);
  const header = decodeHeader(headerBytes);
  if (buf.length < 1 + hLen + header.payloadPacketSize) return null;
  const payload = buf.subarray(1 + hLen, 1 + hLen + header.payloadPacketSize);
  return { header, payload, bytesConsumed: 1 + hLen + header.payloadPacketSize };
}

// ConnectionInfo serialization
function encodeConnectionInfo({
  connectionType,
  networkIdentifier,
  addr,
  port: p,
  isConnectable,
  applicationLayerProtocol,
}) {
  const out = [];
  w32(out, connectionType);
  wStr(out, networkIdentifier);
  wStr(out, addr);
  w32(out, p);
  out.push(isConnectable ? 1 : 0);
  w32(out, applicationLayerProtocol);
  return Buffer.from(out);
}

function int32Payload(value) {
  const out = Buffer.alloc(4);
  out.writeInt32LE(value, 0);
  return out;
}

function stringPayload(s) {
  const body = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeInt32LE(body.length, 0);
  return Buffer.concat([len, body]);
}

// ---- main ----
(async () => {
  console.log(`connecting to ${host}:${port}`);
  const socket = net.createConnection({ host, port });
  let rx = Buffer.alloc(0);

  socket.on('error', (e) => {
    console.error('socket error', e);
    process.exit(2);
  });

  let setupReplyReceived = false;
  socket.on('data', (chunk) => {
    rx = Buffer.concat([rx, chunk]);
    while (true) {
      const r = tryDecodePacket(rx);
      if (!r) break;
      console.log(
        `<- packet type=${r.header.packetType} payloadSize=${r.header.payloadPacketSize}`,
      );
      if (r.header.packetType === 'ConnectionSetup' && !setupReplyReceived) {
        setupReplyReceived = true;
        // Server's setup received. Send DatabaseRequested.
        const payload = int32Payload(0);
        const header = encodeHeader({
          packetType: 'DatabaseRequested',
          payloadSize: payload.length,
          requestedReturn: 'DatabaseObject',
          packetIdentifier: randomUUID(),
        });
        socket.write(frame(header, payload));
        console.log('-> DatabaseRequested (int32 0)');
      }
      if (r.header.packetType === 'Database object') {
        const payloadLen = r.payload.readInt32LE(0);
        const xml = r.payload.subarray(4, 4 + payloadLen).toString('utf8');
        console.log(`  database xml (first 400 chars): ${xml.slice(0, 400)}`);
        console.log('SUCCESS: Database object received');
        socket.destroy();
        process.exit(0);
      }
      rx = rx.subarray(r.bytesConsumed);
    }
  });

  socket.on('connect', () => {
    console.log(`connected (localPort=${socket.localPort}), sending ConnectionSetup`);

    const myInfo = encodeConnectionInfo({
      connectionType: 1, // TCP
      networkIdentifier: shortGuid(),
      addr: socket.localAddress?.includes(':') ? '127.0.0.1' : socket.localAddress || '127.0.0.1',
      port: socket.localPort || 0,
      isConnectable: false,
      applicationLayerProtocol: 1, // Enabled
    });
    const setupHeader = encodeHeader({
      packetType: 'ConnectionSetup',
      payloadSize: myInfo.length,
    });
    const packet = frame(setupHeader, myInfo);
    console.log(`-> header (${setupHeader.length}b): ${setupHeader.toString('hex')}`);
    console.log(`-> payload (${myInfo.length}b): ${myInfo.toString('hex')}`);
    console.log(`-> full packet (${packet.length}b): ${packet.toString('hex')}`);
    socket.write(packet);

    // Wait for server's ConnectionSetup reply before sending anything else.
    // (Defer DatabaseRequested until we observe the reply in the data handler.)
  });

  setTimeout(() => {
    console.log('timeout (20s)');
    socket.destroy();
    process.exit(1);
  }, 20_000);
})();
