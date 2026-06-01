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
import type { SneezeRecord, UserInfo } from 'paranext-extension-sneeze-board';
import { normalizeColor } from '../../util/color';

const DEFAULT_NEW_COLOR = '#00FFEE';

export function UserBar({
  users,
  currentUserId,
  comment,
  setComment,
  editingSneeze,
  onSneeze,
  onCancelEdit,
}: {
  users: UserInfo[];
  currentUserId?: string;
  /** Controlled comment string; lifted to parent so edit-mode can prefill it. */
  comment: string;
  setComment: (value: string) => void;
  /** When set, the Sneeze button becomes "Save edit" and a Cancel button appears. */
  editingSneeze?: SneezeRecord;
  /**
   * Called when the user clicks the Sneeze button. In normal mode this should dispatch a new
   * sneeze; in edit mode it should save the edit.
   */
  onSneeze: (userId: string, comment: string) => void;
  /** Called when the user cancels an edit. */
  onCancelEdit: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_NEW_COLOR);
  const [showAddUser, setShowAddUser] = useState(false);

  // Color-picker draft: only commit on Apply.
  const [colorDraft, setColorDraft] = useState<string | undefined>(undefined);

  const currentUser = users.find((u) => u.userId === currentUserId);
  const currentColor = currentUser ? normalizeColor(currentUser.color) : '#888';
  const displayColor = colorDraft ?? currentColor;
  const isColorEdited =
    !!currentUser && !!colorDraft && colorDraft.toUpperCase() !== currentColor.toUpperCase();

  useEffect(() => setColorDraft(undefined), [currentUserId]);

  useEffect(() => {
    if (!showAddUser) {
      setNewName('');
      setNewColor(DEFAULT_NEW_COLOR);
    }
  }, [showAddUser]);

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

  const isEditing = !!editingSneeze;

  return (
    <div className="sneeze-board__user-bar">
      <Select
        // Use the matched user's id (or '') so a stale lastSneezerId that
        // doesn't exist in the current database falls back to the placeholder
        // instead of rendering as an empty trigger.
        value={currentUser?.userId ?? ''}
        onValueChange={(v) => papi.commands.sendCommand('sneezeBoard.setCurrentUser', v)}
      >
        <SelectTrigger className="tw:min-w-44">
          <SelectValue placeholder="Choose user to sneeze as…" />
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => (
            <SelectItem key={u.userId} value={u.userId}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
          onClick={() => document.getElementById('sneezeBoard-changeColorInput')?.click()}
        >
          Change color
        </Button>
      )}

      <Input
        placeholder={isEditing ? 'Edit comment' : 'Comment'}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button
        disabled={!currentUserId}
        onClick={() => {
          if (!currentUserId) return;
          onSneeze(currentUserId, comment);
        }}
      >
        {isEditing ? 'Save edit' : 'Sneeze'}
      </Button>
      {isEditing && (
        <Button variant="secondary" onClick={onCancelEdit}>
          Cancel edit
        </Button>
      )}
      {!isEditing && (
        <Button variant="secondary" onClick={() => setShowAddUser((s) => !s)}>
          {showAddUser ? '× User' : '+ User'}
        </Button>
      )}
      {showAddUser && !isEditing && (
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
