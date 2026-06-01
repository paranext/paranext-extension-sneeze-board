import { useMemo, useRef, useEffect, useLayoutEffect, useState } from 'react';
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
/** Extra columns rendered on each side of the viewport so fast scrolls don't flash empty. */
const OVERSCAN_COLUMNS = 3;

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
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      setContainerHeight(el.clientHeight);
      setContainerWidth(el.clientWidth);
    });
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
      setScrollLeft(el.scrollLeft);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Compute the visible column window from scrollLeft/containerWidth.
  // Because the layout is column-major with fixed cellWidth, a scroll position maps
  // directly to a column index — no measurement needed. We slice the sneezes array
  // to just the indices in [firstIdx, lastIdx] and keep their absolute positioning;
  // the inner div's full `totalWidth` keeps the scrollbar accurate.
  const firstVisibleCol = Math.max(0, Math.floor(scrollLeft / cellWidth) - OVERSCAN_COLUMNS);
  const lastVisibleCol = Math.min(
    Math.max(0, totalColumns - 1),
    Math.ceil((scrollLeft + Math.max(containerWidth, 1)) / cellWidth) + OVERSCAN_COLUMNS,
  );
  const firstVisibleIdx = firstVisibleCol * rowsPerColumn;
  const lastVisibleIdx = Math.min(
    database.sneezes.length - 1,
    (lastVisibleCol + 1) * rowsPerColumn - 1,
  );
  const visibleSneezes =
    database.sneezes.length === 0
      ? []
      : database.sneezes.slice(firstVisibleIdx, lastVisibleIdx + 1);

  // Run before paint so a virtualized re-render at the right edge happens in
  // the same frame (avoids a flash of empty viewport on initial mount and on
  // grid growth). Intentionally no deps: we need to check stick-right after
  // every render. setScrollLeft is safe here because React bails out on
  // same-value state sets, so we don't loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (stickRightRef.current) {
      const target = Math.max(0, el.scrollWidth - el.clientWidth);
      el.scrollLeft = target;
      setScrollLeft(target);
    }
  });

  return (
    <div ref={containerRef} className="sneeze-grid" style={{ background: backgroundColor }}>
      <div
        className="sneeze-grid__inner"
        style={{ width: totalWidth, height: '100%', position: 'relative' }}
      >
        {visibleSneezes.map((s, offset) => {
          const i = firstVisibleIdx + offset;
          const col = Math.floor(i / rowsPerColumn);
          const row = i % rowsPerColumn;
          const sneezeNum = database.countdownStart - i;
          // Fall back to the theme foreground so orphaned sneezes (whose user
          // is missing from the database) still render in dark mode.
          const color = userColor.get(s.userId) ?? 'var(--foreground)';
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
