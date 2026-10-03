import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FaceMark — Face Recognition Attendance App" },
      {
        name: "description",
        content:
          "Mark attendance with a face scan. Sign up, save your face once, then check in and out from your phone in seconds.",
      },
      { property: "og:title", content: "FaceMark — Face Recognition Attendance App" },
      {
        property: "og:description",
        content: "Face-verified check in and check out, built for phones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});


function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/today", replace: true });
    });
  }, [navigate]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-5 py-12">
      <img
        src={logo}
        alt="FaceMark logo"
        width={1024}
        height={1024}
        className="glow-ring h-28 w-28 rounded-3xl bg-card object-cover p-2"
      />

      <h1 className="mt-6 text-4xl font-semibold tracking-tight">
        Face<span className="text-gradient-accent">Mark</span>
      </h1>

      <div className="mt-auto w-full flex-col gap-3 pb-4">
        <Button
          size="lg"
          className="glow-ring w-full rounded-full text-base"
          onClick={() => navigate({ to: "/auth/student", search: { mode: "signup" } })}
        >
          Start
          <ChevronRight className="h-5 w-5" />
        </Button>

        <div className="mt-5 flex items-center justify-center gap-5 text-sm text-muted-foreground">
          <Link to="/auth/student" search={{ mode: "signup" }} className="transition-colors hover:text-foreground">
            New registration
          </Link>
          <Link to="/auth/teacher" search={{ mode: "signin" }} className="transition-colors hover:text-foreground">
            Teacher login
          </Link>
          <Link to="/auth/student" search={{ mode: "signin" }} className="transition-colors hover:text-foreground">
            Student login
          </Link>
        </div>
      </div>
    </main>
  );
}
