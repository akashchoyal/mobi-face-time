import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DataUrl = z
  .string()
  .min(100)
  .refine((v) => v.startsWith("data:image/"), "Expected an image");

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data");
  const contentType = match[1]!;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType };
}

function bytesToDataUrl(buffer: ArrayBuffer, contentType: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

/** Get the signed-in person's profile plus their recent attendance. */
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: records }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("attendance")
        .select("id, kind, confidence, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    let facePreview: string | null = null;
    if (profile?.face_path) {
      const { data: signed } = await supabase.storage
        .from("faces")
        .createSignedUrl(profile.face_path, 60 * 10);
      facePreview = signed?.signedUrl ?? null;
    }

    return {
      profile: profile
        ? {
            fullName: profile.full_name,
            email: profile.email,
            enrolled: Boolean(profile.face_path),
          }
        : null,
      facePreview,
      records: records ?? [],
    };
  });

/** Save (or replace) the reference face photo used for matching. */
export const enrollFace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ image: DataUrl }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { bytes, contentType } = dataUrlToBytes(data.image);
    const path = `${userId}/reference.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("faces")
      .upload(path, bytes, { contentType, upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { error } = await supabase
      .from("profiles")
      .update({ face_path: path })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });

type MatchResult = { same_person: boolean; confidence: number; reason: string };

async function compareFaces(reference: string, selfie: string): Promise<MatchResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Face matching is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      messages: [
        {
          role: "system",
          content:
            "You verify identity for an attendance system. Compare two photos and decide if they show the same person. Be strict: different people must be rejected. Also reject if the second photo has no clearly visible live human face. Reply with JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Image 1 is the enrolled reference face. Image 2 is the selfie taken now. Respond with JSON: {"same_person": boolean, "confidence": number between 0 and 1, "reason": short string}.',
            },
            { type: "image_url", image_url: { url: reference } },
            { type: "image_url", image_url: { url: selfie } },
          ],
        },
      ],
    }),
  });

  if (response.status === 429) throw new Error("Too many checks right now — try again in a moment.");
  if (response.status === 402)
    throw new Error("The face-check service is out of credits. Please add credits to continue.");
  if (!response.ok) throw new Error(`Face check failed (${response.status})`);

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content ?? "";
  const json = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!json) throw new Error("Could not read the face check result");

  const parsed = JSON.parse(json) as Partial<MatchResult>;
  return {
    same_person: Boolean(parsed.same_person),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0))),
    reason: String(parsed.reason ?? ""),
  };
}

/** Verify the selfie against the enrolled face and record a check in / out. */
export const markAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ image: DataUrl, kind: z.enum(["in", "out"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("face_path")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.face_path) {
      return { ok: false as const, reason: "No face saved yet. Set up your face first." };
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from("faces")
      .download(profile.face_path);
    if (downloadError || !file) {
      return { ok: false as const, reason: "Saved face photo could not be loaded." };
    }

    const reference = bytesToDataUrl(await file.arrayBuffer(), file.type || "image/jpeg");
    const match = await compareFaces(reference, data.image);

    if (!match.same_person || match.confidence < 0.6) {
      return {
        ok: false as const,
        reason: match.reason || "Face did not match the saved photo.",
        confidence: match.confidence,
      };
    }

    const { bytes, contentType } = dataUrlToBytes(data.image);
    const photoPath = `${userId}/logs/${Date.now()}.jpg`;
    await supabase.storage.from("faces").upload(photoPath, bytes, { contentType, upsert: true });

    const { error } = await supabase.from("attendance").insert({
      user_id: userId,
      kind: data.kind,
      confidence: match.confidence,
      photo_path: photoPath,
    });
    if (error) throw new Error(error.message);

    return { ok: true as const, confidence: match.confidence, kind: data.kind };
  });
