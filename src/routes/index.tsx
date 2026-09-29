import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ScanFace, Clock, ShieldCheck, Smartphone } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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

const features = [
  { icon: ScanFace, title: "Face verified", text: "Every entry is matched to your saved photo." },
  { icon: Clock, title: "Two taps", text: "Check in or out in under five seconds." },
  { icon: ShieldCheck, title: "Private", text: "Only you can see your photos and records." },
  { icon: Smartphone, title: "Made for phones", text: "Works right in your mobile browser." },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/today", replace: true });
    });
  }, [navigate]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-10">
      <div className="flex items-center gap-2">
        <ScanFace className="h-7 w-7 text-primary" />
        <span className="text-xl font-semibold tracking-tight">FaceMark</span>
      </div>

      <section className="mt-10">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight">
          Attendance with a <span className="text-gradient-accent">face scan</span>.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Save your face once, then check in and out from your phone. No cards, no sheets, no
          arguments about who was here.
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <Button asChild size="lg" className="rounded-full glow-ring">
            <Link to="/auth/student" search={{ mode: "signup" }}>
              New registration
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="rounded-full">
            <Link to="/auth/teacher" search={{ mode: "signin" }}>
              Teacher login
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="rounded-full">
            <Link to="/auth/student" search={{ mode: "signin" }}>
              Student login
            </Link>
          </Button>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-2 gap-3">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-3xl border border-border p-4 surface-scan">
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
