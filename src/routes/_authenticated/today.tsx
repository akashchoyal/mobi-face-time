import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { LogIn, LogOut, ShieldCheck, ShieldAlert } from "lucide-react";

import { getDashboard, markAttendance } from "@/lib/attendance.functions";
import { FaceCamera } from "@/components/FaceCamera";
import { Button } from "@/components/ui/button";
import { useIsTeacher } from "@/hooks/use-is-teacher";
import { SUBJECTS_10TH } from "@/lib/subjects";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Check in — FaceMark Attendance" },
      {
        name: "description",
        content: "Scan your face to check in or check out and log today's attendance.",
      },
      { property: "og:title", content: "Check in — FaceMark Attendance" },
      { property: "og:description", content: "Face-verified check in and check out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TodayPage,
});

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TodayPage() {
  const { data: isTeacher } = useIsTeacher();
  const fetchDashboard = useServerFn(getDashboard);
  const mark = useServerFn(markAttendance);
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"in" | "out">("in");
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");

  if (isTeacher) return <Navigate to="/students" replace />;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const is10th = data?.profile?.className === "10th";

  const today = new Date().toDateString();
  const todays = (data?.records ?? []).filter(
    (r) => new Date(r.created_at).toDateString() === today,
  );

  async function handleCapture(image: string) {
    if (is10th && !subject) {
      toast.error("Pehle subject choose karein");
      return;
    }
    setBusy(true);
    try {
      const result = await mark({ data: { image, kind, subject: is10th ? subject : undefined } });
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      toast.success(
        `${kind === "in" ? "Checked in" : "Checked out"} — face matched (${Math.round(
          (result.confidence ?? 0) * 100,
        )}%)`,
      );
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 px-5 pt-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString([], {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi {data?.profile?.fullName?.split(" ")[0] || "there"}
        </h1>
      </header>

      {!isLoading && !data?.profile?.enrolled ? (
        <div className="rounded-3xl border border-border p-6 text-center surface-scan">
          <ShieldAlert className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">Set up your face first</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Save one clear photo of your face. We compare every check in against it.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/profile">Save my face</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
            <button
              onClick={() => setKind("in")}
              className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium transition-colors ${
                kind === "in" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <LogIn className="h-4 w-4" /> Check in
            </button>
            <button
              onClick={() => setKind("out")}
              className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium transition-colors ${
                kind === "out" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <LogOut className="h-4 w-4" /> Check out
            </button>
          </div>

          {is10th && (
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Subject
              </p>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS_10TH.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      subject === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <FaceCamera
            busy={busy}
            onCapture={(img) => void handleCapture(img)}
            captureLabel={kind === "in" ? "Scan & check in" : "Scan & check out"}
          />
        </>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Today
        </h2>
        {todays.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No entries yet today.
          </p>
        ) : (
          <ul className="space-y-2">
            {todays.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  {r.kind === "in" ? "Checked in" : "Checked out"}
                  {r.subject ? ` · ${r.subject}` : ""}
                </span>
                <span className="text-sm text-muted-foreground">{timeOf(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
