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
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

/** Tailwind theme chart color tokens, cycled across users in chart visualizations. */
const CHART_PALETTE = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
];

function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

export function StatsDialog({
  open,
  onOpenChange,
  database,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: SneezeDatabase;
}) {
  // Map userId → display name for table/chart labels.
  const userName = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of database.users) m.set(u.userId, u.name);
    return m;
  }, [database.users]);

  // Stable assignment of palette color per user (sorted by name for determinism).
  const userPaletteColor = useMemo(() => {
    const m = new Map<string, string>();
    const sortedUsers = [...database.users]
      .filter((u) => u.userId.toLowerCase() !== UNKNOWN_USER_ID)
      .sort((a, b) => a.name.localeCompare(b.name));
    sortedUsers.forEach((u, i) => m.set(u.userId, paletteColor(i)));
    return m;
  }, [database.users]);

  // ─── Longest streaks (per user) ──────────────────────────────────────────
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

  // ─── Streak Hall of Fame (top N streaks across all users) ────────────────
  const hallOfFame = useMemo(() => {
    const all = findAllStreaks(database).slice(0, 15);
    return all.map((s, i) => ({
      name: `#${i + 1} ${userName.get(s.userId) ?? s.userId}`,
      length: s.length,
      userId: s.userId,
    }));
  }, [database, userName]);

  // ─── Random Stats table ──────────────────────────────────────────────────
  const randomStats = useMemo(() => {
    const stats = findExtendedUserStats(database);
    return [...stats.entries()]
      .filter(([userId]) => userId.toLowerCase() !== UNKNOWN_USER_ID)
      .map(([userId, s]) => ({ userId, name: userName.get(userId) ?? userId, ...s }))
      .sort((a, b) => b.totalSneezes - a.totalSneezes);
  }, [database, userName]);

  // ─── Contributions pie chart ─────────────────────────────────────────────
  const contributions = useMemo(() => {
    return randomStats
      .filter((r) => r.totalSneezes > 0)
      .map((r) => ({ name: r.name, userId: r.userId, value: r.totalSneezes }));
  }, [randomStats]);

  const hasData = database.sneezes.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tw:flex tw:flex-col tw:max-w-5xl tw:h-[min(90vh,800px)] tw:w-[min(95vw,1100px)] tw:p-0">
        <DialogHeader className="tw:px-6 tw:pt-6">
          <DialogTitle>Sneeze Board Stats</DialogTitle>
        </DialogHeader>

        <div className="tw:flex-1 tw:overflow-auto tw:px-4 tw:sm:px-6 tw:pb-6 tw:pt-2">
          {!hasData ? (
            <p className="tw:text-muted-foreground">No sneezes recorded yet.</p>
          ) : (
            <div className="tw:grid tw:grid-cols-1 tw:lg:grid-cols-2 tw:gap-4">
              <Card>
                <CardHeader className="tw:pb-2">
                  <CardTitle>Longest Streaks</CardTitle>
                </CardHeader>
                <CardContent className="tw:overflow-x-auto">
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
                              style={{ background: userPaletteColor.get(s.userId) ?? '#888' }}
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
                <CardHeader className="tw:pb-2">
                  <CardTitle>Streak Hall of Fame</CardTitle>
                </CardHeader>
                <CardContent className="tw:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={hallOfFame}
                      layout="vertical"
                      margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
                    >
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
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
                            fill={userPaletteColor.get(entry.userId) ?? paletteColor(0)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="tw:lg:col-span-2">
                <CardHeader className="tw:pb-2">
                  <CardTitle>Random Stats</CardTitle>
                </CardHeader>
                <CardContent className="tw:overflow-x-auto">
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
                              style={{ background: userPaletteColor.get(r.userId) ?? '#888' }}
                            />
                            {r.name}
                          </TableCell>
                          <TableCell className="tw:text-right tw:font-mono">
                            {r.totalSneezes}
                          </TableCell>
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
                <CardHeader className="tw:pb-2">
                  <CardTitle>Sneeze Contributions</CardTitle>
                </CardHeader>
                <CardContent className="tw:h-80">
                  <ResponsiveContainer width="100%" height="100%">
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
                            fill={userPaletteColor.get(entry.userId) ?? paletteColor(0)}
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
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="tw:px-6 tw:py-3 tw:border-t">
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
