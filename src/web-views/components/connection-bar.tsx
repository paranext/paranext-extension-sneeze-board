import { useState } from 'react';
import papi from '@papi/frontend';
import { Button, Input } from 'platform-bible-react';
import type { ConnectionState } from 'paranext-extension-sneeze-board';

export function ConnectionBar({
  connection,
  error,
  defaultIp,
}: {
  connection: ConnectionState;
  error?: string;
  defaultIp: string;
}) {
  const [ip, setIp] = useState(defaultIp);
  const connect = () => papi.commands.sendCommand('sneezeBoard.connect', ip);
  const disconnect = () => papi.commands.sendCommand('sneezeBoard.disconnect');
  const label =
    connection === 'open'
      ? 'Connected'
      : connection === 'connecting'
        ? 'Connecting...'
        : connection === 'error'
          ? `Failed: ${error ?? 'unknown'}`
          : connection === 'closed'
            ? 'Disconnected'
            : 'Idle';
  return (
    <div className="sneeze-board__connection-bar">
      <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="Server IP" />
      {connection === 'open' ? (
        <Button onClick={disconnect}>Disconnect</Button>
      ) : (
        <Button onClick={connect}>Connect</Button>
      )}
      <span className="sneeze-board__status">{label}</span>
    </div>
  );
}
