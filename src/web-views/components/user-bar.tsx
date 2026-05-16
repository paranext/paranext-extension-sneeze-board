import { useEffect, useRef, useState } from 'react';
import papi from '@papi/frontend';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'platform-bible-react';
import type { UserInfo } from 'paranext-extension-sneeze-board';
import { normalizeColor } from '../../util/color';

export function UserBar({
  users,
  currentUserId,
  onSneeze,
}: {
  users: UserInfo[];
  currentUserId?: string;
  onSneeze: (userId: string, comment: string) => void;
}) {
  const [comment, setComment] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#00FFEE');
  const [showAddUser, setShowAddUser] = useState(false);
  const changeColorInputRef = useRef<HTMLInputElement>(null);

  const currentUser = users.find((u) => u.userId === currentUserId);
  const colorSwatch = currentUser ? normalizeColor(currentUser.color) : '#888';

  // Reset the new-user form whenever the panel is toggled off.
  useEffect(() => {
    if (!showAddUser) {
      setNewName('');
    }
  }, [showAddUser]);

  return (
    <div className="sneeze-board__user-bar">
      <Select
        value={currentUserId ?? ''}
        onValueChange={(v) => papi.commands.sendCommand('sneezeBoard.setCurrentUser', v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select user" />
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => (
            <SelectItem key={u.userId} value={u.userId}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Color swatch doubles as the "change color" trigger — clicking it opens
          the native color picker via a hidden <input type="color">. This avoids
          window.prompt (blocked by the sandboxed WebView). */}
      <label
        className="sneeze-board__color-swatch-label"
        title={currentUser ? `Change color for ${currentUser.name}` : 'Current color'}
      >
        <span
          className="sneeze-board__swatch"
          style={{ background: colorSwatch }}
          aria-label="current color"
        />
        <input
          ref={changeColorInputRef}
          type="color"
          className="sneeze-board__color-input"
          disabled={!currentUser}
          value={colorSwatch.startsWith('#') ? colorSwatch : '#000000'}
          onChange={(e) => {
            if (!currentUser) return;
            papi.commands.sendCommand(
              'sneezeBoard.updateUser',
              currentUser.userId,
              e.target.value,
            );
          }}
        />
      </label>
      <Button
        variant="secondary"
        disabled={!currentUser}
        onClick={() => changeColorInputRef.current?.click()}
      >
        Change color
      </Button>

      <Input placeholder="Comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button
        disabled={!currentUserId}
        onClick={() => {
          if (!currentUserId) return;
          onSneeze(currentUserId, comment);
          setComment('');
        }}
      >
        Sneeze
      </Button>
      <Button variant="secondary" onClick={() => setShowAddUser((s) => !s)}>
        + User
      </Button>
      {showAddUser && (
        <span className="sneeze-board__add-user-row">
          <Input
            placeholder="New name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            aria-label="new user color"
            className="sneeze-board__color-input sneeze-board__color-input--visible"
          />
          <Button
            onClick={() => {
              if (!newName) return;
              papi.commands.sendCommand('sneezeBoard.addUser', newName, newColor);
              setNewName('');
              setShowAddUser(false);
            }}
          >
            Add
          </Button>
        </span>
      )}
    </div>
  );
}
