import { useEffect, useState } from 'react';
import papi from '@papi/frontend';
import {
  Badge,
  Button,
  Input,
  Label,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'platform-bible-react';
import { Loader2 } from 'lucide-react';
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
  const isConnecting = connection === 'connecting';

  // Keep the error banner visible across the whole non-open lifecycle (including
  // 'connecting' so the user can read the last failure while an auto-reconnect
  // is in flight). It clears on successful connect ('open') and isn't shown
  // in the idle state.
  const showError =
    !!versionMismatch || (!!error && connection !== 'open' && connection !== 'idle');
  const errorMessage = versionMismatch
    ? `Server database version (${versionMismatch.serverVersion}) does not match client version (${versionMismatch.clientVersion}). Please update your client or restart the server with a saved database.`
    : error;

  const ipInput = (
    <Input
      value={ip}
      onChange={(e) => setIp(e.target.value)}
      placeholder="Server IP (e.g. 127.0.0.1)"
      disabled={ipFieldDisabled}
    />
  );

  return (
    <div className="sneeze-board__connection-bar">
      <div className="sneeze-board__connection-row">
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            {/* Wrap in a span so the trigger is hoverable even when the inner
                <Input> is disabled (disabled elements don't dispatch pointer events). */}
            <TooltipTrigger asChild>
              <span className="sneeze-board__ip-trigger">{ipInput}</span>
            </TooltipTrigger>
            {ipFieldDisabled && (
              <TooltipContent>Disconnect to change the server IP.</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        {connection === 'open' ? (
          <Button variant="secondary" onClick={disconnect}>
            Disconnect
          </Button>
        ) : (
          <Button onClick={connect} disabled={isConnecting || !ip.trim()}>
            {isConnecting && (
              <Loader2 className="tw:animate-spin tw:mr-1 tw:h-4 tw:w-4" aria-hidden />
            )}
            {isConnecting ? 'Connecting…' : 'Connect'}
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
