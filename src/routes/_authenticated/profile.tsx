import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, ScanFace } from "lucide-react";

import { getDashboard, enrollFace } from "@/lib/attendance.functions";
import { FaceCamera } from "@/components/FaceCamera";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — FaceMark" },
      {
        name: "description",
        content: "Save or update the face photo used to verify your attendance, and sign out.",
      },
      { property: "og:title", content: "Your profile — FaceMark" },
      { property: "og:description", content: "Manage your saved face and account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const fetchDashboard = useServerFn(getDashboard);
  const enroll = useServerFn(enrollFace);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });

  async function handleCapture(image: string) {
    setBusy(true);
    try {
      await enroll({ data: { image } });
      toast.success("Face saved. You can check in now.");
      setCapturing(false);
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your face");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="flex-1 px-5 pt-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Profile</h1>

      <div className="rounded-3xl border border-border p-5 surface-scan">
        <div className="flex items-center gap-4">
          {data?.facePreview ? (
            <img
              src={data.facePreview}
              alt="Your saved face photo"
              className="h-16 w-16 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <ScanFace className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold">{data?.profile?.fullName || "Your name"}</p>
            <p className="truncate text-sm text-muted-foreground">{data?.profile?.email}</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {data?.profile?.enrolled
            ? "Your face is saved. Every check in is compared against this photo."
            : "Save a clear, well-lit photo of your face to start marking attendance."}
        </p>

        {capturing ? (
          <div className="mt-5">
            <FaceCamera
              busy={busy}
              onCapture={(img) => void handleCapture(img)}
              captureLabel="Save this photo"
            />
            <Button
              variant="ghost"
              className="mt-3 w-full rounded-full"
              onClick={() => setCapturing(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button className="mt-5 w-full rounded-full" onClick={() => setCapturing(true)}>
            {data?.profile?.enrolled ? "Retake face photo" : "Save my face"}
          </Button>
        )}
      </div>

      <Button
        variant="secondary"
        className="mt-6 w-full rounded-full"
        onClick={() => void signOut()}
      >
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </main>
  );
}
