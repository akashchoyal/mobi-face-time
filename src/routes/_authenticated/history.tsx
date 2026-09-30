import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getDashboard } from "@/lib/attendance.functions";
import { useIsTeacher } from "@/hooks/use-is-teacher";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Attendance history — FaceMark" },
      {
        name: "description",
        content: "Your daily attendance table: every date with check-in, check-out and status.",
      },
      { property: "og:title", content: "Attendance history — FaceMark" },
      { property: "og:description", content: "Your full attendance log, day by day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

type Record = { id: string; kind: string; confidence: number; created_at: string };

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function HistoryPage() {
  const { data: isTeacher } = useIsTeacher();
  const fetchDashboard = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
  });

  if (isTeacher) return <Navigate to="/students" replace />;

  const records: Record[] = data?.records ?? [];

  // Group records by calendar day, newest first.
  const groups = new Map<string, Record[]>();
  for (const r of records) {
    const key = dayKey(new Date(r.created_at));
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const days = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const presentDays = days.filter(([, items]) => items.some((r) => r.kind === "in")).length;

  return (
    <main className="flex-1 px-5 pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">My Attendance</h1>
      {!isLoading && records.length > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          {presentDays} day{presentDays === 1 ? "" : "s"} marked present
        </p>
      )}

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && records.length === 0 && (
        <p className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Nothing recorded yet.
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">In</th>
              <th className="px-4 py-3 font-medium">Out</th>
              <th className="px-4 py-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {days.map(([key, items]) => {
              const ins = items.filter((r) => r.kind === "in");
              const outs = items.filter((r) => r.kind === "out");
              const firstIn = ins.length ? ins[ins.length - 1] : null;
              const lastOut = outs.length ? outs[0] : null;

              let status = (
                <span className="inline-flex rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                  Incomplete
                </span>
              );
              if (firstIn && lastOut) {
                status = (
                  <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                    Complete
                  </span>
                );
              } else if (firstIn) {
                status = (
                  <span className="inline-flex rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                    Checked in
                  </span>
                );
              }

              return (
                <tr key={key} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {new Date(firstIn?.created_at ?? items[0]!.created_at).toLocaleDateString(
                      [],
                      { day: "numeric", month: "short", year: "numeric" },
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {firstIn ? timeLabel(firstIn.created_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lastOut ? timeLabel(lastOut.created_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
