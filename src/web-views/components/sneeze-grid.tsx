import { useMemo, useRef, useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { SneezeRecord, SneezeDatabase } from 'paranext-extension-sneeze-board';
import { normalizeColor } from '../../util/color';

// Re-export the React MouseEvent so callers don't have to import it separately.
export type { ReactMouseEvent };

const CELL_PADDING_X = 10;
/** Treat the scroll position as "at the right edge" if within this many pixels. */
const STICK_THRESHOLD_PX = 8;

export function SneezeGrid({
  database,
  fontSize,
  backgroundColor,
  onSneezeAction,
}: {
  database: SneezeDatabase;
  fontSize: number;
  backgroundColor: string;
  /**
   * Called on right-click of a cell. The MouseEvent is forwarded so callers can position a context
   * menu at the cursor (e.clientX / e.clientY).
   */
  onSneezeAction: (sneeze: SneezeRecord, sneezeIndex: number, event: ReactMouseEvent) => void;
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
  // We track whether the user is currently parked at the right edge; if so, any
  // resize / new-column growth re-pins the scroll to the new right edge.
  // `stickRight` starts true (initial scroll-to-end on mount).
  const stickRightRef = useRef(true);

  // Reset stick whenever the user manually scrolls left/right.
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

  // After every render (sneezes/columns may have grown), if we're sticky, jump to the right.
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
          return (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={`${s.userId}-${s.date}-${i}`}
              className={`sneeze-grid__cell${s.comment ? ' has-comment' : ''}`}
              style={{
                left: col * cellWidth,
                top: row * lineHeight,
                color,
                fontSize: `${fontSize}px`,
                lineHeight: `${lineHeight}px`,
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onSneezeAction(s, i, e);
              }}
              title={(() => {
                const name = userName.get(s.userId) ?? 'Unknown';
                const localDate = new Date(s.date).toLocaleString();
                return `Sneeze ${sneezeNum}\n${name}\n${localDate}${s.comment ? `\n\n${s.comment}` : ''}`;
              })()}
            >
              {sneezeNum}
            </span>
          );
        })}
      </div>
    </div>
  );
}
