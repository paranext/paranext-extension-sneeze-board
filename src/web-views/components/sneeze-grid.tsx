import { useMemo, useRef, useEffect, useState } from 'react';
import type { SneezeRecord, SneezeDatabase } from 'paranext-extension-sneeze-board';
import { normalizeColor } from '../../util/color';

const CELL_PADDING_X = 10;

export function SneezeGrid({
  database,
  fontSize,
  backgroundColor,
  onSneezeAction,
}: {
  database: SneezeDatabase;
  fontSize: number;
  backgroundColor: string;
  onSneezeAction: (sneeze: SneezeRecord, sneezeIndex: number) => void;
}) {
  const userColor = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of database.users) m.set(u.userId, normalizeColor(u.color));
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
                onSneezeAction(s, i);
              }}
              title={`Sneeze ${sneezeNum}\n${s.date}${s.comment ? `\n\n${s.comment}` : ''}`}
            >
              {sneezeNum}
            </span>
          );
        })}
      </div>
    </div>
  );
}
