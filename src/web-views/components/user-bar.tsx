import { useEffect, useMemo, useState } from 'react';
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

const DEFAULT_NEW_COLOR = '#00FFEE';

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
  const [newColor, setNewColor] = useState(DEFAULT_NEW_COLOR);
  const [showAddUser, setShowAddUser] = useState(false);

  // Color-picker draft: native <input type="color"> fires onChange on every
  // slider tick; we hold the draft locally and only commit on Apply, so the
  // server isn't hammered with a packet per pixel.
  const [colorDraft, setColorDraft] = useState<string | undefined>(undefined);

  const currentUser = users.find((u) => u.userId === currentUserId);
  const currentColor = currentUser ? normalizeColor(currentUser.color) : '#888';
  const displayColor = colorDraft ?? currentColor;
  const isColorEdited =
    !!currentUser && !!colorDraft && colorDraft.toUpperCase() !== currentColor.toUpperCase();

  // Reset color draft if the selected user changes (so we don't accidentally
  // apply the previous user's draft to the new one).
  useEffect(() => {
    setColorDraft(undefined);
  }, [currentUserId]);

  // Reset the new-user form when the panel is hidden.
  useEffect(() => {
    if (!showAddUser) {
      setNewName('');
      setNewColor(DEFAULT_NEW_COLOR);
    }
  }, [showAddUser]);

  // Validation for Add User: non-empty name, no duplicate names or colors.
  const { addDisabled, addError } = useMemo(() => {
    const trimmedName = newName.trim();
    if (!trimmedName) return { addDisabled: true, addError: '' };
    const normalizedNewColor = normalizeColor(newColor).toUpperCase();
    for (const u of users) {
      if (u.name.localeCompare(trimmedName, undefined, { sensitivity: 'accent' }) === 0) {
        return {
          addDisabled: true,
          addError: `A user named "${u.name}" already exists.`,
        };
      }
      if (normalizeColor(u.color).toUpperCase() === normalizedNewColor) {
        return {
          addDisabled: true,
          addError: `Color is already used by "${u.name}".`,
        };
      }
    }
    return { addDisabled: false, addError: '' };
  }, [newName, newColor, users]);

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

      {/* Color edit: a transparent <input type="color"> overlays the swatch.
          Clicking the swatch or "Change color" opens the picker; selecting a
          color stages it as a draft. The user must click Apply to commit. */}
      <label
        className="sneeze-board__color-swatch-label"
        title={
          currentUser
            ? isColorEdited
              ? `Apply new color to ${currentUser.name}`
              : `Change color for ${currentUser.name}`
            : 'Current color'
        }
      >
        <span
          className="sneeze-board__swatch"
          style={{ background: displayColor }}
          aria-label="current color"
        />
        <input
          id="sneezeBoard-changeColorInput"
          type="color"
          className="sneeze-board__color-input"
          disabled={!currentUser}
          value={displayColor.startsWith('#') ? displayColor : '#000000'}
          onChange={(e) => setColorDraft(e.target.value)}
        />
      </label>
      {isColorEdited ? (
        <>
          <Button
            variant="default"
            onClick={() => {
              if (!currentUser || !colorDraft) return;
              papi.commands.sendCommand('sneezeBoard.updateUser', currentUser.userId, colorDraft);
              setColorDraft(undefined);
            }}
          >
            Apply color
          </Button>
          <Button variant="secondary" onClick={() => setColorDraft(undefined)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="secondary"
          disabled={!currentUser}
          onClick={() =>
            document.getElementById('sneezeBoard-changeColorInput')?.click()
          }
        >
          Change color
        </Button>
      )}

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
        {showAddUser ? '× User' : '+ User'}
      </Button>
      {showAddUser && (
        <span className="sneeze-board__add-user-row">
          <Input
            placeholder="New name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            aria-label="new user color"
            className="sneeze-board__color-input sneeze-board__color-input--visible"
          />
          <Button
            disabled={addDisabled}
            onClick={() => {
              if (addDisabled) return;
              papi.commands.sendCommand('sneezeBoard.addUser', newName.trim(), newColor);
              setShowAddUser(false);
            }}
          >
            Add
          </Button>
          <Button variant="secondary" onClick={() => setShowAddUser(false)}>
            Cancel
          </Button>
          {addError && <span className="sneeze-board__add-user-error">{addError}</span>}
        </span>
      )}
    </div>
  );
}
