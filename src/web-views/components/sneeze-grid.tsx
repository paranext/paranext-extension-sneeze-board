import { useMemo, useRef, useEffect, useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from 'platform-bible-react';
import type { SneezeRecord, SneezeDatabase } from 'paranext-extension-sneeze-board';
import { normalizeColor } from '../../util/color';

const CELL_PADDING_X = 10;
/** Treat the scroll position as "at the right edge" if within this many pixels. */
const STICK_THRESHOLD_PX = 8;

export function SneezeGrid({
  database,
  fontSize,
  backgroundColor,
  currentUserId,
  onEditSneeze,
  onRemoveSneeze,
}: {
  database: SneezeDatabase;
  fontSize: number;
  backgroundColor: string;
  /**
   * UserId whose sneezes are editable. Cells for this user are wrapped in a ContextMenu
   * (right-click → Edit / Remove); other cells are plain spans.
   */
  currentUserId?: string;
  onEditSneeze: (sneeze: SneezeRecord) => void;
  onRemoveSneeze: (sneeze: SneezeRecord) => void;
}) {
  const userColor = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of database.users) m.set(u.userId, normalizeColor(u.color));
    return m;
  }, [database.users]);

  const userName = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of database.users) m.set(u.userId, u.name);
    return m;
  }, [database.users]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setContainerHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lineHeight = Math.ceil(fontSize * 1.2);
  const rowsPerColumn = Math.max(1, Math.floor(containerHeight / lineHeight));
  const cellWidth =
    String(database.countdownStart).length * Math.ceil(fontSize * 0.62) + CELL_PADDING_X;
  const totalColumns = Math.ceil(database.sneezes.length / rowsPerColumn);
  const totalWidth = totalColumns * cellWidth;

  // Stick the scroll to the right edge so the latest sneezes are always visible.
  const stickRightRef = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - STICK_THRESHOLD_PX;
      stickRightRef.current = atRight;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (stickRightRef.current) {
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    }
  });

  return (
    <div ref={containerRef} className="sneeze-grid" style={{ background: backgroundColor }}>
      <div
        className="sneeze-grid__inner"
        style={{ width: totalWidth, height: '100%', position: 'relative' }}
      >
        {database.sneezes.map((s, i) => {
          const col = Math.floor(i / rowsPerColumn);
          const row = i % rowsPerColumn;
          const sneezeNum = database.countdownStart - i;
          const color = userColor.get(s.userId) ?? '#000';
          const title = (() => {
            const name = userName.get(s.userId) ?? 'Unknown';
            const localDate = new Date(s.date).toLocaleString();
            return `Sneeze ${sneezeNum}\n${name}\n${localDate}${s.comment ? `\n\n${s.comment}` : ''}`;
          })();
          const style = {
            left: col * cellWidth,
            top: row * lineHeight,
            color,
            fontSize: `${fontSize}px`,
            lineHeight: `${lineHeight}px`,
          };
          const className = `sneeze-grid__cell${s.comment ? ' has-comment' : ''}`;
          // eslint-disable-next-line react/no-array-index-key
          const key = `${s.userId}-${s.date}-${i}`;

          const cell = (
            <span className={className} style={style} title={title}>
              {sneezeNum}
            </span>
          );

          // Only own sneezes get the Edit/Remove context menu.
          if (currentUserId && s.userId === currentUserId) {
            return (
              <ContextMenu key={key}>
                <ContextMenuTrigger asChild>{cell}</ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => onEditSneeze(s)}>Edit sneeze</ContextMenuItem>
                  <ContextMenuItem variant="destructive" onSelect={() => onRemoveSneeze(s)}>
                    Remove sneeze
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          }
          return (
            <span key={key} className={className} style={style} title={title}>
              {sneezeNum}
            </span>
          );
        })}
      </div>
    </div>
  );
}
