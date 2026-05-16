import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'platform-bible-react';
import type { SneezeDatabase } from 'paranext-extension-sneeze-board';
import {
  findAllStreaks,
  findExtendedUserStats,
  findLongestStreaks,
  UNKNOWN_USER_ID,
} from '../../util/stats';
import { normalizeColor } from '../../util/color';

/** Fallback color when a user has no color or an unparseable value. */
const FALLBACK_USER_COLOR = '#888';

/** ── Stats body content, also usable standalone (e.g. inline on tiny viewports). */
export function StatsView({ database }: { database: SneezeDatabase }) {
  // Map userId → display name for table/chart labels.
  const userName = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of database.users) m.set(u.userId, u.name);
    return m;
  }, [database.users]);

  // Map userId → display color (normalized to #RRGGBB where possible).
  const userColor = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of database.users) m.set(u.userId, normalizeColor(u.color) || FALLBACK_USER_COLOR);
    return m;
  }, [database.users]);

  // Per-user stats (Random Stats table).
  const randomStats = useMemo(() => {
    const stats = findExtendedUserStats(database);
    return [...stats.entries()]
      .filter(([userId]) => userId.toLowerCase() !== UNKNOWN_USER_ID)
      .map(([userId, s]) => ({ userId, name: userName.get(userId) ?? userId, ...s }))
      .sort((a, b) => b.totalSneezes - a.totalSneezes);
  }, [database, userName]);

  // Longest streaks per user, descending.
  const longestStreaks = useMemo(() => {
    const map = findLongestStreaks(database);
    return [...map.entries()]
      .map(([userId, length]) => ({
        userId,
        name: userName.get(userId) ?? userId,
        length,
      }))
      .sort((a, b) => b.length - a.length);
  }, [database, userName]);

  // Streak Hall of Fame — top N streaks across all users.
  const hallOfFame = useMemo(() => {
    const all = findAllStreaks(database).slice(0, 15);
    return all.map((s, i) => ({
      // Recharts uses `name` as the axis label; we prepend rank so duplicate
      // users at the same length still have unique YAxis keys.
      name: `#${i + 1} ${userName.get(s.userId) ?? s.userId}`,
      length: s.length,
      userId: s.userId,
    }));
  }, [database, userName]);

  // Contributions slice data (Unknown user excluded by randomStats filter).
  const contributions = useMemo(
    () => randomStats.filter((r) => r.totalSneezes > 0).map((r) => ({
      name: r.name,
      userId: r.userId,
      value: r.totalSneezes,
    })),
    [randomStats],
  );

  if (database.sneezes.length === 0) {
    return <p className="tw:text-muted-foreground tw:p-4">No sneezes recorded yet.</p>;
  }

  return (
    <div className="tw:grid tw:grid-cols-1 tw:lg:grid-cols-2 tw:gap-3 tw:p-2">
      <Card>
        <CardHeader className="tw:p-3 tw:pb-1">
          <CardTitle>Longest Streaks</CardTitle>
        </CardHeader>
        <CardContent className="tw:p-3 tw:pt-0 tw:overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="tw:text-right">Streak</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {longestStreaks.map((s) => (
                <TableRow key={s.userId}>
                  <TableCell>
                    <span
                      className="tw:inline-block tw:w-3 tw:h-3 tw:mr-2 tw:rounded-sm tw:align-middle"
                      style={{ background: userColor.get(s.userId) ?? FALLBACK_USER_COLOR }}
                    />
                    {s.name}
                  </TableCell>
                  <TableCell className="tw:text-right tw:font-mono">{s.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="tw:p-3 tw:pb-1">
          <CardTitle>Streak Hall of Fame</CardTitle>
        </CardHeader>
        <CardContent className="tw:p-3 tw:pt-0">
          <div style={{ width: '100%', minHeight: 200, height: Math.max(200, hallOfFame.length * 22) }}>
            <ResponsiveContainer>
              <BarChart
                data={hallOfFame}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
              >
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  formatter={(value: number) => [value, 'Sneezes in a row']}
                />
                <Bar dataKey="length" radius={[0, 4, 4, 0]}>
                  {hallOfFame.map((entry) => (
                    <Cell
                      key={`${entry.userId}-${entry.name}`}
                      fill={userColor.get(entry.userId) ?? FALLBACK_USER_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="tw:lg:col-span-2">
        <CardHeader className="tw:p-3 tw:pb-1">
          <CardTitle>Random Stats</CardTitle>
        </CardHeader>
        <CardContent className="tw:p-3 tw:pt-0 tw:overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="tw:text-right">Total</TableHead>
                <TableHead className="tw:text-right">%</TableHead>
                <TableHead className="tw:text-right">Participation (days)</TableHead>
                <TableHead className="tw:text-right">Avg days / sneeze</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {randomStats.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell>
                    <span
                      className="tw:inline-block tw:w-3 tw:h-3 tw:mr-2 tw:rounded-sm tw:align-middle"
                      style={{ background: userColor.get(r.userId) ?? FALLBACK_USER_COLOR }}
                    />
                    {r.name}
                  </TableCell>
                  <TableCell className="tw:text-right tw:font-mono">{r.totalSneezes}</TableCell>
                  <TableCell className="tw:text-right tw:font-mono">
                    {r.sneezePercentage.toFixed(2)}%
                  </TableCell>
                  <TableCell className="tw:text-right tw:font-mono">
                    {r.participationDays.toFixed(0)}
                  </TableCell>
                  <TableCell className="tw:text-right tw:font-mono">
                    {r.avgDaysPerSneeze.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="tw:lg:col-span-2">
        <CardHeader className="tw:p-3 tw:pb-1">
          <CardTitle>Sneeze Contributions</CardTitle>
        </CardHeader>
        <CardContent className="tw:p-3 tw:pt-0">
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={contributions}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="40%"
                  outerRadius="80%"
                  paddingAngle={1}
                >
                  {contributions.map((entry) => (
                    <Cell
                      key={entry.userId}
                      fill={userColor.get(entry.userId) ?? FALLBACK_USER_COLOR}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => {
                    const payloadName =
                      (item?.payload as { name?: string } | undefined)?.name ?? '';
                    return [`${value} sneezes`, payloadName];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(name: string) => name}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Stats panel used at normal (>=compact) WebView sizes. Drawer slides up from
 * the bottom and handles vertical scroll natively, which is what the Dialog
 * version was failing to do at typical WebView sizes.
 */
export function StatsDialog({
  open,
  onOpenChange,
  database,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: SneezeDatabase;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="tw:flex tw:flex-col"
        style={{ maxHeight: '92vh' }}
      >
        <DrawerHeader className="tw:px-4 tw:py-2">
          <DrawerTitle>Sneeze Board Stats</DrawerTitle>
        </DrawerHeader>
        <div className="tw:flex-1 tw:overflow-auto tw:px-2 tw:pb-2">
          <StatsView database={database} />
        </div>
        <DrawerFooter className="tw:px-4 tw:py-2 tw:border-t">
          <DrawerClose asChild>
            <Button>Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
