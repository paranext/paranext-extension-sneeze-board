import { describe, it, expect } from 'vitest';
import { tryDecodePacket } from './packet';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const wireDir = 'test/fixtures/wire';
const files = existsSync(wireDir) ? readdirSync(wireDir).filter((f) => f.endsWith('.bin')) : [];

describe('wire fixture coverage', () => {
  it.skipIf(files.length === 0)(
    'decodes every captured byte from every fixture into one or more packets',
    () => {
      for (const file of files) {
        const buf = new Uint8Array(readFileSync(join(wireDir, file)));
        let offset = 0;
        let packets = 0;
        while (offset < buf.length) {
          const r = tryDecodePacket(buf.subarray(offset));
          expect(r, `failed to decode at offset ${offset} of ${file}`).not.toBeNull();
          offset += r!.bytesConsumed;
          packets += 1;
        }
        // eslint-disable-next-line no-console
        console.log(`${file}: ${packets} packet(s)`);
        expect(offset).toBe(buf.length);
      }
    },
  );
});
