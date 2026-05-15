import { useState } from 'react';
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

  const currentUser = users.find((u) => u.userId === currentUserId);
  const colorSwatch = currentUser ? normalizeColor(currentUser.color) : '#888';

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
      <span
        className="sneeze-board__swatch"
        style={{ background: colorSwatch }}
        aria-label="current color"
      />
      <Button
        onClick={() => {
          if (!currentUser) return;
          // eslint-disable-next-line no-alert
          const next = window.prompt('New color (#RRGGBB):', colorSwatch);
          if (next) papi.commands.sendCommand('sneezeBoard.updateUser', currentUser.userId, next);
        }}
      >
        Change color
      </Button>
      <Input
        placeholder="Comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
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
      <Button variant="ghost" onClick={() => setShowAddUser((s) => !s)}>
        + User
      </Button>
      {showAddUser && (
        <span>
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
