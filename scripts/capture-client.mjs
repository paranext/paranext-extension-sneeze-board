// Listens on port 57632, accepts a connection from SneezeBoardClient.exe,
// logs every byte received in hex, and writes the raw bytes to capture.bin.
// The C# client expects a real server, so it will likely log warnings and
// disconnect after a timeout — but we'll have captured the initial
// DatabaseRequested packet by then.
import net from 'node:net';
import fs from 'node:fs';

const PORT = 57632;
const OUT = 'test/fixtures/wire/client-c2s-capture.bin';

fs.mkdirSync('test/fixtures/wire', { recursive: true });
const sink = fs.createWriteStream(OUT);
const startedAt = Date.now();

const server = net.createServer((socket) => {
  console.log(`[+0ms] client connected from ${socket.remoteAddress}:${socket.remotePort}`);
  socket.on('data', (chunk) => {
    sink.write(chunk);
    console.log(
      `[+${Date.now() - startedAt}ms] C->S ${chunk.length} bytes: ${chunk.toString('hex')}`,
    );
  });
  socket.on('close', () => {
    console.log(`[+${Date.now() - startedAt}ms] client closed`);
    sink.end();
    server.close();
  });
  socket.on('error', (e) => console.log(`socket error: ${e.message}`));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`capture listening on :${PORT} — writing bytes to ${OUT}`);
  console.log('Now run SneezeBoardClient.exe and Connect to 127.0.0.1.');
});

setTimeout(() => {
  console.log('20s elapsed; closing capture');
  sink.end();
  server.close();
  process.exit(0);
}, 20_000);
