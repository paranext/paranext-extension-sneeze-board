// Connects to paranext-core's WebSocket and triggers sneezeBoard commands.
// Usage: node scripts/ws-test.mjs <command> [args...]
//   examples:
//     node scripts/ws-test.mjs sneezeBoard.openWebView
//     node scripts/ws-test.mjs sneezeBoard.connect 127.0.0.1
//     node scripts/ws-test.mjs sneezeBoard.getState
// Uses Node 22's built-in WebSocket (browser-style API).

const cmd = process.argv[2];
const args = process.argv.slice(3);
if (!cmd) {
  console.error('usage: node scripts/ws-test.mjs <command> [args...]');
  process.exit(1);
}

const url = 'ws://localhost:8876';
const ws = new WebSocket(url);
let nextId = 1;

ws.addEventListener('open', () => {
  console.log(`connected to ${url}`);
  const req = {
    jsonrpc: '2.0',
    id: nextId++,
    method: `command:${cmd}`,
    params: args,
  };
  console.log('->', JSON.stringify(req));
  ws.send(JSON.stringify(req));
});

ws.addEventListener('message', (event) => {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch (e) {
    console.error('failed to parse:', event.data.slice?.(0, 200));
    return;
  }
  const out = JSON.stringify(msg);
  console.log('<-', out.length > 1200 ? `${out.slice(0, 1200)}…(truncated ${out.length}b)` : out);
  if (msg.id !== undefined && msg.id !== null) {
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 200);
  }
});

ws.addEventListener('error', (e) => {
  console.error('ws error', e.message || e);
  process.exit(2);
});

setTimeout(() => {
  console.error('timeout');
  ws.close();
  process.exit(3);
}, 15_000);
