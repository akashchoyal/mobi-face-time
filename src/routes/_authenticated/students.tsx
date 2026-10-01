import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useIsTeacher } from "@/hooks/use-is-teacher";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Student attendance — FaceMark" },
      { name: "description", content: "Teachers can see every student's check ins and check outs." },
      { property: "og:title", content: "Student attendance — FaceMark" },
      { property: "og:description", content: "All student attendance in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentsPage,
});

function toDateInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

const CLASS_OPTIONS: { label: string; className: string; section: string }[] = [
  { label: "All", className: "", section: "" },
  { label: "10th – A", className: "10th", section: "A" },
  { label: "10th – B", className: "10th", section: "B" },
  { label: "11th – Maths", className: "11th", section: "Maths" },
  { label: "11th – Bio", className: "11th", section: "Bio" },
  { label: "11th – Arts", className: "11th", section: "Arts" },
  { label: "11th – Agri", className: "11th", section: "Agriculture" },
];

function StudentsPage() {
  const { data: isTeacher, isLoading: roleLoading } = useIsTeacher();
  const [day, setDay] = useState(toDateInput(new Date()));
  const [classFilter, setClassFilter] = useState(CLASS_OPTIONS[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-attendance", day],
    enabled: isTeacher === true,
    queryFn: async () => {
      const start = new Date(`${day}T00:00:00`);
      const end = new Date(start.getTime() + 86400000);
      const [{ data: profiles }, { data: records }, { data: teachers }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, school_name, class_name, section").order("full_name"),
        supabase
          .from("attendance")
          .select("id, user_id, kind, confidence, created_at")
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .order("created_at"),
        supabase.from("user_roles").select("user_id").eq("role", "teacher"),
      ]);
      const teacherIds = new Set((teachers ?? []).map((t) => t.user_id));
      return (profiles ?? [])
        .filter((p) => !teacherIds.has(p.id))
        .map((p) => ({ ...p, records: (records ?? []).filter((r) => r.user_id === p.id) }));
    },
  });

  if (roleLoading) return <Spinner />;
  if (!isTeacher)
    return <p className="p-6 text-center text-muted-foreground">Only teachers can see this page.</p>;

  const present = data?.filter((s) => s.records.some((r) => r.kind === "in")).length ?? 0;

  return (
    <main className="px-5 pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Student attendance</h1>
      <div className="mt-4 flex items-center gap-3">
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-auto" />
        {data && (
          <span className="text-sm text-muted-foreground">
            {present} / {data.length} present
          </span>
        )}
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <p className="mt-8 text-center text-muted-foreground">No students registered yet.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {data.map((s) => {
            const firstIn = s.records.find((r) => r.kind === "in");
            const lastOut = [...s.records].reverse().find((r) => r.kind === "out");
            return (
              <li key={s.id} className="rounded-3xl border border-border p-4 surface-scan">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.full_name || "Unnamed"}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.class_name ? `${s.class_name} – ${s.section} · ` : ""}{s.school_name || s.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      firstIn ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {firstIn ? "Present" : "Absent"}
                  </span>
                </div>
                {s.records.length > 0 && (
                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span>In: {firstIn ? time(firstIn.created_at) : "—"}</span>
                    <span>Out: {lastOut ? time(lastOut.created_at) : "—"}</span>
                    <span>{s.records.length} scans</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Spinner() {
  return (
    <div className="flex justify-center p-10">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
