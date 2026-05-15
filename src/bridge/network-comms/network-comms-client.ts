import net from 'node:net';
import { encodePacket, tryDecodePacket } from './packet';

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
export type Unsubscriber = () => void;

export class NetworkCommsClient {
  private socket: net.Socket | undefined;

  private rxBuffer: Buffer = Buffer.alloc(0);

  private state: ConnectionState = 'idle';

  private handlers = new Map<string, Set<(payload: string) => void>>();

  private stateListeners = new Set<(s: ConnectionState, err?: string) => void>();

  on(packetType: string, handler: (payload: string) => void): Unsubscriber {
    let set = this.handlers.get(packetType);
    if (!set) {
      set = new Set();
      this.handlers.set(packetType, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  onState(handler: (s: ConnectionState, err?: string) => void): Unsubscriber {
    this.stateListeners.add(handler);
    return () => this.stateListeners.delete(handler);
  }

  connect(host: string, port: number): Promise<void> {
    this.setState('connecting');
    let settled = false;
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        settled = true;
        this.setState('open');
        resolve();
      });
      this.socket = socket;
      socket.on('data', (chunk) => this.onData(chunk));
      socket.on('close', () => this.setState('closed'));
      socket.on('error', (err) => {
        this.setState('error', err.message);
        if (!settled) {
          settled = true;
          reject(err);
        }
        // Otherwise the error is reported via setState; the socket will also emit 'close'.
      });
    });
  }

  disconnect(): void {
    this.socket?.end();
    this.socket = undefined;
  }

  send(packetType: string, payload: string): void {
    if (!this.socket || this.state !== 'open') throw new Error('not connected');
    const payloadBytes = new TextEncoder().encode(payload);
    const frame = encodePacket(
      { packetType, payloadPacketSize: payloadBytes.length },
      payloadBytes,
    );
    this.socket.write(frame);
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
        this.send(packetType, payload);
      } catch (e) {
        clearTimeout(timer);
        if (unsub) unsub();
        reject(e);
      }
    });
  }

  private onData(chunk: Buffer): void {
    this.rxBuffer = Buffer.concat([this.rxBuffer, chunk]);
    let r = tryDecodePacket(new Uint8Array(this.rxBuffer));
    while (r) {
      const payloadStr = new TextDecoder('utf-8').decode(r.payload);
      const set = this.handlers.get(r.header.packetType);
      if (set) {
        for (const h of set) {
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
