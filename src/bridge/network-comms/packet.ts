import { decodeHeader, encodeHeader, type PacketHeader } from './packet-header';

export type Packet = {
  header: PacketHeader;
  payload: Uint8Array;
};

export type DecodeResult = Packet & { bytesConsumed: number };

export function encodePacket(header: PacketHeader, payload: Uint8Array): Uint8Array {
  const headerBytes = encodeHeader({ ...header, payloadPacketSize: payload.length });
  if (headerBytes.length > 255) throw new Error('Header too large for single-byte length prefix');
  const out = new Uint8Array(1 + headerBytes.length + payload.length);
  out[0] = headerBytes.length;
  out.set(headerBytes, 1);
  out.set(payload, 1 + headerBytes.length);
  return out;
}

export function tryDecodePacket(buf: Uint8Array): DecodeResult | null {
  if (buf.length < 1) return null;
  const headerLen = buf[0];
  if (buf.length < 1 + headerLen) return null;
  const headerBytes = buf.subarray(1, 1 + headerLen);
  const header = decodeHeader(headerBytes);
  const payloadStart = 1 + headerLen;
  const payloadEnd = payloadStart + header.payloadPacketSize;
  if (buf.length < payloadEnd) return null;
  return {
    header,
    payload: buf.subarray(payloadStart, payloadEnd),
    bytesConsumed: payloadEnd,
  };
}
