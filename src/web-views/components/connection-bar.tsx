import { useEffect, useState } from 'react';
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

  // Keep the input in sync if the persisted IP loads after first render.
  useEffect(() => {
    if (defaultIp && !ip) setIp(defaultIp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultIp]);

  const connect = () => {
    if (!ip.trim()) return;
    papi.commands.sendCommand('sneezeBoard.connect', ip.trim());
  };
  const disconnect = () => papi.commands.sendCommand('sneezeBoard.disconnect');
  const label =
    connection === 'open'
      ? 'Connected'
      : connection === 'connecting'
        ? 'Connecting...'
        : connection === 'error'
          ? 'Connection failed'
          : connection === 'closed'
            ? 'Disconnected'
            : 'Idle';

  const isError = connection === 'error' || (connection === 'closed' && !!error);

  return (
    <div className="sneeze-board__connection-bar">
      <div className="sneeze-board__connection-row">
        <Input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="Server IP (e.g. 127.0.0.1)"
        />
        {connection === 'open' ? (
          <Button onClick={disconnect}>Disconnect</Button>
        ) : (
          <Button onClick={connect} disabled={connection === 'connecting'}>
            Connect
          </Button>
        )}
        <span className={`sneeze-board__status sneeze-board__status--${connection}`}>{label}</span>
      </div>
      {isError && error && (
        <div className="sneeze-board__error" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
