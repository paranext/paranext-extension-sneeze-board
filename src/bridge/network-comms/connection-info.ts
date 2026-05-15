// NetworkCommsDotNet.ConnectionInfo wire format (custom IExplicitlySerialize):
//
//   [ 4 bytes LE: ConnectionType (1=TCP) ]
//   [ 4 bytes LE: NetworkIdentifier UTF-8 length ]
//   [ N bytes:    NetworkIdentifier UTF-8 bytes ]
//   [ 4 bytes LE: localEndPointAddress UTF-8 length ]
//   [ N bytes:    localEndPointAddress UTF-8 bytes ]
//   [ 4 bytes LE: localEndPointPort ]
//   [ 1 byte:     IsConnectable (bool) ]
//   [ 4 bytes LE: ApplicationLayerProtocolStatus (1=Enabled) ]
//
// Reference: decompiled NetworkCommsDotNet.ConnectionInfo.Serialize.

export enum NcConnectionType {
  Undefined = 0,
  TCP = 1,
  UDP = 2,
}

export enum ApplicationLayerProtocolStatus {
  Undefined = 0,
  Enabled = 1,
  Disabled = 2,
}

export type ConnectionInfo = {
  connectionType: NcConnectionType;
  networkIdentifier: string;
  localEndPointAddress: string;
  localEndPointPort: number;
  isConnectable: boolean;
  applicationLayerProtocol: ApplicationLayerProtocolStatus;
};

function writeInt32LE(buf: number[], value: number) {
  buf.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function readInt32LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24);
}

function writeStringLE(out: number[], value: string) {
  const bytes = Buffer.from(value, 'utf-8');
  writeInt32LE(out, bytes.length);
  for (let i = 0; i < bytes.length; i++) out.push(bytes[i]);
}

export function encodeConnectionInfo(info: ConnectionInfo): Uint8Array {
  const out: number[] = [];
  writeInt32LE(out, info.connectionType);
  writeStringLE(out, info.networkIdentifier);
  writeStringLE(out, info.localEndPointAddress);
  writeInt32LE(out, info.localEndPointPort);
  out.push(info.isConnectable ? 1 : 0);
  writeInt32LE(out, info.applicationLayerProtocol);
  return new Uint8Array(out);
}

export function decodeConnectionInfo(buf: Uint8Array): ConnectionInfo {
  let i = 0;
  const connectionType = readInt32LE(buf, i) as NcConnectionType;
  i += 4;
  const nidLen = readInt32LE(buf, i);
  i += 4;
  const networkIdentifier = Buffer.from(buf.subarray(i, i + nidLen)).toString('utf-8');
  i += nidLen;
  const addrLen = readInt32LE(buf, i);
  i += 4;
  const localEndPointAddress = Buffer.from(buf.subarray(i, i + addrLen)).toString('utf-8');
  i += addrLen;
  const localEndPointPort = readInt32LE(buf, i);
  i += 4;
  const isConnectable = buf[i] !== 0;
  i += 1;
  const applicationLayerProtocol = readInt32LE(buf, i) as ApplicationLayerProtocolStatus;
  i += 4;
  return {
    connectionType,
    networkIdentifier,
    localEndPointAddress,
    localEndPointPort,
    isConnectable,
    applicationLayerProtocol,
  };
}
