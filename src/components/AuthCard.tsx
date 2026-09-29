import { useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ScanFace, Loader2, GraduationCap, BookOpen } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Role = "teacher" | "student";

export function AuthCard({ role, mode }: { role: Role; mode: "signin" | "signup" }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const roleLabel = role === "teacher" ? "Teacher" : "Student";
  const RoleIcon = role === "teacher" ? BookOpen : GraduationCap;
  const home = role === "teacher" ? "/students" : "/today";

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void navigate({ to: home, replace: true });
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
    void navigate({ to: home, replace: true });
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
    void navigate({ to: home, replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <Link to="/" className="mb-8 flex items-center justify-center gap-2">
        <ScanFace className="h-7 w-7 text-primary" />
        <span className="text-xl font-semibold tracking-tight">FaceMark</span>
      </Link>

      <div className="rounded-3xl border border-border p-6 surface-scan">
        <div className="mb-5 flex items-center justify-center gap-2 rounded-full bg-secondary py-2.5">
          <RoleIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{roleLabel} account</span>
        </div>

        <Tabs defaultValue={mode}>
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
                Sign in as {roleLabel}
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
                Create {roleLabel} account
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

        <p className="mt-5 text-center text-xs text-muted-foreground">
          {role === "teacher" ? (
            <>
              Student ho?{" "}
              <Link to="/auth/student" search={{ mode }} className="text-primary underline">
                Student login
              </Link>
            </>
          ) : (
            <>
              Teacher ho?{" "}
              <Link to="/auth/teacher" search={{ mode }} className="text-primary underline">
                Teacher login
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
