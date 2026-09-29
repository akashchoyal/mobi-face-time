import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/auth/student")({
  validateSearch: (s: Record<string, unknown>): { mode: "signin" | "signup" } => ({
    mode: s["mode"] === "signup" ? "signup" : "signin",
  }),
  head: () => ({
    meta: [
      { title: "Student login — FaceMark Attendance" },
      {
        name: "description",
        content: "Student login and registration for FaceMark face-scan attendance.",
      },
      { property: "og:title", content: "Student login — FaceMark Attendance" },
      {
        property: "og:description",
        content: "Students sign in and mark attendance with a quick face scan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentAuthPage,
});

function StudentAuthPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/today", replace: true });
    });
  }, [navigate]);

  return <AuthCard role="student" mode={mode} />;
}
