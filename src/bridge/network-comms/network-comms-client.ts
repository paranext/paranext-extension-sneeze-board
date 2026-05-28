import net from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import { encodePacket, tryDecodePacket } from './packet';
import {
  ApplicationLayerProtocolStatus,
  encodeConnectionInfo,
  NcConnectionType,
} from './connection-info';
import { PT } from './packet-types';

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
export type Unsubscriber = () => void;

/**
 * Generate a C# ShortGuid: base64 of 16 random bytes, with `/` → `_` and `+` → `-`, truncated to 22
 * chars (matches `NetworkCommsDotNet.Tools.ShortGuid.Encode`).
 */
function shortGuid(): string {
  return randomBytes(16)
    .toString('base64')
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    .substring(0, 22);
}

/**
 * Encode a string payload as NetworkComms.Net's ExplicitSerializer encodes a System.String: `[4
 * bytes LE: UTF-8 length][N bytes: UTF-8 bytes]`.
 */
function encodeStringPayload(s: string): Uint8Array {
  const body = Buffer.from(s, 'utf-8');
  const out = Buffer.alloc(4 + body.length);
  out.writeInt32LE(body.length, 0);
  body.copy(out, 4);
  return new Uint8Array(out);
}

/**
 * Decode a NetworkComms.Net `System.String` payload. `[4 bytes LE: UTF-8 length][N bytes: UTF-8
 * bytes]`.
 */
function decodeStringPayload(buf: Uint8Array): string {
  if (buf.length < 4) throw new Error('string payload truncated');
  const len = Buffer.from(buf.buffer, buf.byteOffset, 4).readInt32LE(0);
  if (buf.length < 4 + len) throw new Error('string payload length exceeds buffer');
  return Buffer.from(buf.subarray(4, 4 + len)).toString('utf-8');
}

/** Encode an int32 payload (used for e.g. DatabaseRequested's `int 0`). */
function encodeInt32Payload(value: number): Uint8Array {
  const out = Buffer.alloc(4);
  out.writeInt32LE(value, 0);
  return new Uint8Array(out);
}

export class NetworkCommsClient {
  /** Current connection state. */
  state: ConnectionState = 'idle';

  private socket: net.Socket | undefined;

  private rxBuffer: Buffer = Buffer.alloc(0);

  /** Handlers receive the decoded UTF-8 string payload (post-string-length-prefix). */
  private stringHandlers = new Map<string, Set<(payload: string) => void>>();

  /** Raw handlers receive the un-decoded payload bytes. */
  private rawHandlers = new Map<string, Set<(payload: Uint8Array) => void>>();

  private stateListeners = new Set<(s: ConnectionState, err?: string) => void>();

  private handshakeComplete = false;

  on(packetType: string, handler: (payload: string) => void): Unsubscriber {
    let set = this.stringHandlers.get(packetType);
    if (!set) {
      set = new Set();
      this.stringHandlers.set(packetType, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  onRaw(packetType: string, handler: (payload: Uint8Array) => void): Unsubscriber {
    let set = this.rawHandlers.get(packetType);
    if (!set) {
      set = new Set();
      this.rawHandlers.set(packetType, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  onState(handler: (s: ConnectionState, err?: string) => void): Unsubscriber {
    this.stateListeners.add(handler);
    return () => this.stateListeners.delete(handler);
  }

  /**
   * Connect and complete the NetworkComms.Net handshake. Resolves after the server's
   * ConnectionSetup reply has been received (i.e., the connection is actually usable for app-level
   * packets).
   */
  connect(host: string, port: number): Promise<void> {
    // Tear down any leftover socket first so its in-flight events don't
    // clobber the new connection's state (e.g. old socket 'close' arriving
    // mid-handshake and flipping us to 'closed', or buffered 'data' chunks
    // appended to our fresh rxBuffer).
    this.teardownSocket();

    this.setState('connecting');
    let settled = false;

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });
      this.socket = socket;

      // Closure-capture `socket` so events from any previously-orphaned socket
      // (defensive belt-and-suspenders alongside teardownSocket) are no-ops.
      socket.on('data', (chunk) => {
        if (this.socket !== socket) return;
        this.onData(chunk);
      });
      socket.on('close', () => {
        if (this.socket !== socket) return;
        this.socket = undefined;
        this.setState('closed');
      });
      socket.on('error', (err) => {
        if (this.socket !== socket) return;
        this.setState('error', err.message);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      // One-shot handler for the server's ConnectionSetup reply.
      const unsubSetup = this.onRaw(PT.ConnectionSetup, () => {
        if (this.socket !== socket) {
          unsubSetup();
          return;
        }
        if (this.handshakeComplete) return;
        this.handshakeComplete = true;
        unsubSetup();
        this.setState('open');
        if (!settled) {
          settled = true;
          resolve();
        }
      });

      socket.once('connect', () => {
        if (this.socket !== socket) return;
        const infoBytes = encodeConnectionInfo({
          connectionType: NcConnectionType.TCP,
          networkIdentifier: shortGuid(),
          localEndPointAddress: socket.localAddress?.includes(':')
            ? '127.0.0.1'
            : socket.localAddress || '127.0.0.1',
          localEndPointPort: socket.localPort || 0,
          isConnectable: false,
          applicationLayerProtocol: ApplicationLayerProtocolStatus.Enabled,
        });
        const frame = encodePacket(
          { packetType: PT.ConnectionSetup, payloadPacketSize: infoBytes.length },
          infoBytes,
        );
        socket.write(frame);
      });

      // Overall handshake timeout (mirrors NetworkComms.Net's 10s default).
      setTimeout(() => {
        if (this.socket !== socket) return;
        if (!settled) {
          settled = true;
          this.setState('error', 'handshake timeout');
          this.teardownSocket();
          reject(new Error('handshake timeout'));
        }
      }, 10_000);
    });
  }

  disconnect(): void {
    if (!this.socket) return;
    this.teardownSocket();
    this.setState('closed');
  }

  /** Send a string payload (UTF-8 length-prefixed). */
  send(packetType: string, payload: string, options?: { requestedReturn?: string }): void {
    this.sendBinary(packetType, encodeStringPayload(payload), options);
  }

  /** Send a raw payload (already-encoded bytes). */
  sendBinary(
    packetType: string,
    payload: Uint8Array,
    options?: { requestedReturn?: string },
  ): void {
    if (!this.socket) throw new Error('not connected');
    const frame = encodePacket(
      {
        packetType,
        payloadPacketSize: payload.length,
        requestedReturnPacketType: options?.requestedReturn,
        packetIdentifier: options?.requestedReturn ? randomUUID() : undefined,
      },
      payload,
    );
    this.socket.write(frame);
  }

  /** Send an int32 LE payload (for messages like DatabaseRequested). */
  sendInt32(packetType: string, value: number, options?: { requestedReturn?: string }): void {
    this.sendBinary(packetType, encodeInt32Payload(value), options);
  }

  sendAndAwait(
    packetType: string,
    expectedReply: string,
    payload: string,
    timeoutMs = 30000,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let unsub: (() => void) | undefined;
      const timer = setTimeout(() => {
        if (unsub) unsub();
        reject(new Error(`sendAndAwait timeout waiting for ${expectedReply}`));
      }, timeoutMs);
      unsub = this.on(expectedReply, (reply) => {
        clearTimeout(timer);
        if (unsub) unsub();
        resolve(reply);
      });
      try {
        this.send(packetType, payload, { requestedReturn: expectedReply });
      } catch (e) {
        clearTimeout(timer);
        if (unsub) unsub();
        reject(e);
      }
    });
  }

  /**
   * Forcefully tear down the current socket and reset connection-scoped state. Any data/close/error
   * events on the old socket that fire AFTER this call are silently dropped, because the handlers
   * close over `socket` and compare against `this.socket`.
   */
  private teardownSocket(): void {
    const old = this.socket;
    if (!old) return;
    this.socket = undefined;
    this.handshakeComplete = false;
    this.rxBuffer = Buffer.alloc(0);
    try {
      old.removeAllListeners();
    } catch {
      /* noop */
    }
    try {
      old.destroy();
    } catch {
      /* noop */
    }
  }

  private onData(chunk: Buffer): void {
    this.rxBuffer = Buffer.concat([this.rxBuffer, chunk]);
    let r = tryDecodePacket(new Uint8Array(this.rxBuffer));
    while (r) {
      // Dispatch raw handlers (always)
      const rawSet = this.rawHandlers.get(r.header.packetType);
      if (rawSet) {
        for (const h of rawSet) {
          try {
            h(r.payload);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
          }
        }
      }

      // Dispatch string handlers (decode the length-prefixed string payload)
      const strSet = this.stringHandlers.get(r.header.packetType);
      if (strSet) {
        let payloadStr: string;
        try {
          payloadStr = decodeStringPayload(r.payload);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(`could not decode string payload for ${r.header.packetType}:`, e);
          this.rxBuffer = this.rxBuffer.subarray(r.bytesConsumed);
          r = tryDecodePacket(new Uint8Array(this.rxBuffer));
          // eslint-disable-next-line no-continue
          continue;
        }
        for (const h of strSet) {
          try {
            h(payloadStr);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
          }
        }
      }

      this.rxBuffer = this.rxBuffer.subarray(r.bytesConsumed);
      r = tryDecodePacket(new Uint8Array(this.rxBuffer));
    }
  }

  private setState(s: ConnectionState, err?: string): void {
    this.state = s;
    for (const l of this.stateListeners) {
      try {
        l(s, err);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    }
  }
}
