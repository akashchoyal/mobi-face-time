import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/auth/teacher")({
  validateSearch: (s: Record<string, unknown>): { mode: "signin" | "signup" } => ({
    mode: s["mode"] === "signup" ? "signup" : "signin",
  }),
  head: () => ({
    meta: [
      { title: "Teacher login — FaceMark Attendance" },
      {
        name: "description",
        content: "Teacher login and registration for FaceMark face-scan attendance.",
      },
      { property: "og:title", content: "Teacher login — FaceMark Attendance" },
      {
        property: "og:description",
        content: "Teachers sign in to see every student's daily attendance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherAuthPage,
});

function TeacherAuthPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/students", replace: true });
    });
  }, [navigate]);

  return <AuthCard role="teacher" mode={mode} />;
}
