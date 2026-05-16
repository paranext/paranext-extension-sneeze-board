import { useEffect, useState } from 'react';
import papi from '@papi/frontend';
import { Badge, Button, Input, Label, Switch } from 'platform-bible-react';
import type { ConnectionState, SneezeBoardState } from 'paranext-extension-sneeze-board';

export function ConnectionBar({
  connection,
  error,
  defaultIp,
  autoConnect,
  versionMismatch,
}: {
  connection: ConnectionState;
  error?: string;
  defaultIp: string;
  autoConnect: boolean;
  versionMismatch?: SneezeBoardState['versionMismatch'];
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

  const ipFieldDisabled = connection === 'open' || connection === 'connecting';

  // Surface any non-success state with an explanation.
  const showError =
    !!versionMismatch || connection === 'error' || (connection === 'closed' && !!error);
  const errorMessage = versionMismatch
    ? `Server database version (${versionMismatch.serverVersion}) does not match client version (${versionMismatch.clientVersion}). Please update your client or restart the server with a saved database.`
    : error;

  return (
    <div className="sneeze-board__connection-bar">
      <div className="sneeze-board__connection-row">
        <Input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="Server IP (e.g. 127.0.0.1)"
          disabled={ipFieldDisabled}
        />
        {connection === 'open' ? (
          <Button onClick={disconnect}>Disconnect</Button>
        ) : (
          <Button onClick={connect} disabled={connection === 'connecting' || !ip.trim()}>
            Connect
          </Button>
        )}
        <Badge
          variant="secondary"
          className={`sneeze-board__status sneeze-board__status--${connection}`}
        >
          {label}
        </Badge>
        <div className="sneeze-board__autoconnect-toggle">
          <Switch
            id="sneezeBoard-autoConnect"
            checked={autoConnect}
            onCheckedChange={(value) =>
              papi.commands.sendCommand('sneezeBoard.setAutoConnect', value)
            }
          />
          <Label htmlFor="sneezeBoard-autoConnect">Auto-connect</Label>
        </div>
      </div>
      {showError && errorMessage && (
        <div className="sneeze-board__error" role="alert">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}
    </div>
  );
}
