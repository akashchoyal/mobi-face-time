import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScanFace, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Role = "teacher" | "student";

export const Route = createFileRoute("/auth")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { mode?: "signin" | "signup" | undefined; role?: Role | undefined } => ({
    mode: s["mode"] === "signup" ? "signup" : s["mode"] === "signin" ? "signin" : undefined,
    role: s["role"] === "teacher" ? "teacher" : s["role"] === "student" ? "student" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — FaceMark Attendance" },
      {
        name: "description",
        content:
          "Sign in or create your FaceMark account to mark attendance with a quick face scan.",
      },
      { property: "og:title", content: "Sign in — FaceMark Attendance" },
      {
        property: "og:description",
        content: "Face-verified check in and check out for teachers and students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<Role>(search.role ?? "student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const roleLabel = role === "teacher" ? "Teacher" : "Student";

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/today", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void navigate({ to: "/today", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name, role },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Check your email to confirm your account, then sign in.");
      return;
    }
    void navigate({ to: "/today", replace: true });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Try again.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/today", replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <Link to="/" className="mb-8 flex items-center justify-center gap-2">
        <ScanFace className="h-7 w-7 text-primary" />
        <span className="text-xl font-semibold tracking-tight">FaceMark</span>
      </Link>

      <div className="rounded-3xl border border-border p-6 surface-scan">
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
          {(["student", "teacher"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-full py-2 text-sm font-medium transition-colors ${
                role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {r === "teacher" ? "Teacher" : "Student"}
            </button>
          ))}
        </div>
        <p className="mb-4 text-center text-sm text-muted-foreground">{roleLabel} account</p>
        <Tabs defaultValue={search.mode ?? "signin"}>
          <TabsList className="grid w-full grid-cols-2 rounded-full bg-secondary">
            <TabsTrigger value="signin" className="rounded-full">
              {roleLabel} login
            </TabsTrigger>
            <TabsTrigger value="signup" className="rounded-full">
              New registration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-6">
            <form onSubmit={signIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="si-email">Email</Label>
                <Input
                  id="si-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@work.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="si-pass">Password</Label>
                <Input
                  id="si-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full rounded-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-6">
            <form onSubmit={signUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="su-name">Full name</Label>
                <Input
                  id="su-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Akash Choyal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-email">Email</Label>
                <Input
                  id="su-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@work.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-pass">Password</Label>
                <Input
                  id="su-pass"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full rounded-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create account
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="secondary"
          className="w-full rounded-full"
          onClick={() => void google()}
        >
          Continue with Google
        </Button>
      </div>
    </main>
  );
}
