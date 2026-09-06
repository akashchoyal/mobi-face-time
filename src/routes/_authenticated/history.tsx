import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogIn, LogOut } from "lucide-react";

import { getDashboard } from "@/lib/attendance.functions";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Attendance history — FaceMark" },
      {
        name: "description",
        content: "Review every face-verified check in and check out you have recorded.",
      },
      { property: "og:title", content: "Attendance history — FaceMark" },
      { property: "og:description", content: "Your full attendance log, day by day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const fetchDashboard = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const groups = new Map<string, typeof records>();
  const records = data?.records ?? [];
  for (const r of records) {
    const day = new Date(r.created_at).toLocaleDateString([], {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    groups.set(day, [...(groups.get(day) ?? []), r]);
  }

  return (
    <main className="flex-1 px-5 pt-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">History</h1>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && records.length === 0 && (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Nothing recorded yet.
        </p>
      )}

      <div className="space-y-6">
        {[...groups.entries()].map(([day, items]) => (
          <section key={day}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {day}
            </h2>
            <ul className="space-y-2">
              {items.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {r.kind === "in" ? (
                      <LogIn className="h-4 w-4 text-success" />
                    ) : (
                      <LogOut className="h-4 w-4 text-accent" />
                    )}
                    {r.kind === "in" ? "Checked in" : "Checked out"}
                  </span>
                  <span className="text-right text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    <span className="ml-2 text-xs">
                      {Math.round(Number(r.confidence) * 100)}% match
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
