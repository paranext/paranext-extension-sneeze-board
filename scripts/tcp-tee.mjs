// scripts/tcp-tee.mjs
// Usage: node scripts/tcp-tee.mjs <listenPort> <upstreamHost> <upstreamPort> <outDir>
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

const [listenPort, upstreamHost, upstreamPort, outDir] = process.argv.slice(2);
if (!listenPort || !upstreamHost || !upstreamPort || !outDir) {
  console.error('Usage: node tcp-tee.mjs <listenPort> <upstreamHost> <upstreamPort> <outDir>');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
let sessionId = 0;

const server = net.createServer((client) => {
  const id = ++sessionId;
  const startedAt = Date.now();
  console.log(`[${id}] client connected`);

  const c2sStream = fs.createWriteStream(path.join(outDir, `session-${id}-client-to-server.bin`));
  const s2cStream = fs.createWriteStream(path.join(outDir, `session-${id}-server-to-client.bin`));
  const logStream = fs.createWriteStream(path.join(outDir, `session-${id}-log.txt`));

  const upstream = net.connect(Number(upstreamPort), upstreamHost, () => {
    logStream.write(`[${new Date().toISOString()}] upstream connected\n`);
  });

  client.on('data', (buf) => {
    c2sStream.write(buf);
    logStream.write(
      `[+${Date.now() - startedAt}ms] C->S ${buf.length} bytes: ${buf.toString('hex')}\n`,
    );
    upstream.write(buf);
  });
  upstream.on('data', (buf) => {
    s2cStream.write(buf);
    logStream.write(
      `[+${Date.now() - startedAt}ms] S->C ${buf.length} bytes: ${buf.toString('hex')}\n`,
    );
    client.write(buf);
  });

  const cleanup = (label) => () => {
    logStream.write(`[${new Date().toISOString()}] ${label}\n`);
    client.destroy();
    upstream.destroy();
    c2sStream.end();
    s2cStream.end();
    logStream.end();
  };

  client.on('close', cleanup('client closed'));
  upstream.on('close', cleanup('upstream closed'));
  client.on('error', (e) => logStream.write(`client error: ${e.message}\n`));
  upstream.on('error', (e) => logStream.write(`upstream error: ${e.message}\n`));
});

server.listen(Number(listenPort), '127.0.0.1', () => {
  console.log(`tcp-tee listening on 127.0.0.1:${listenPort} -> ${upstreamHost}:${upstreamPort}`);
  console.log(`writing captures to ${path.resolve(outDir)}`);
});
