import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SUBJECTS_10TH, PERIODS } from "./subjects";

const selection = z.object({
  className: z.enum(["10th", "11th"]),
  section: z.string().min(1).max(40),
  school: z.string().min(1).max(200),
});
const image = z
  .string()
  .min(100)
  .max(11_184_900)
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/);

export const getGroupScanSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: teacher } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "teacher",
    });
    if (!teacher) throw new Error("Sirf teacher class scan kar sakte hain.");
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "teacher");
    if (roleError) throw new Error("Teacher list load nahi hui.");
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, school_name, class_name, section, face_path")
      .order("full_name");
    if (error) throw new Error("Student list load nahi hui.");
    const teachers = new Set(roles?.map((r) => r.user_id));
    return {
      configured: Boolean(process.env["PY_BACKEND_URL"] && process.env["PY_BACKEND_API_KEY"]),
      students: (profiles ?? [])
        .filter((p) => !teachers.has(p.id))
        .map((p) => ({
          id: p.id,
          name: p.full_name,
          school: p.school_name,
          className: p.class_name,
          section: p.section,
          enrolled: Boolean(p.face_path),
        })),
    };
  });

export const scanGroupAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    selection
      .extend({ image, subject: z.string().max(40), period: z.string().max(40) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: teacher } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "teacher",
    });
    if (!teacher) throw new Error("Sirf teacher class scan kar sakte hain.");
    const url = process.env["PY_BACKEND_URL"];
    const key = process.env["PY_BACKEND_API_KEY"];
    if (!url || !key)
      throw new Error(
        "Group pehchaan ke liye Python server ka address aur key abhi nahi jude hain.",
      );
    if (
      !PERIODS.some((p) => p.label === data.period) ||
      (data.className === "10th" && !SUBJECTS_10TH.some((s) => s === data.subject))
    )
      throw new Error("Subject aur period chunein.");
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "teacher");
    if (roleError) throw new Error("Teacher list load nahi hui.");
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, face_path")
      .eq("class_name", data.className)
      .eq("section", data.section)
      .eq("school_name", data.school);
    if (error) throw new Error("Student list load nahi hui.");
    const teacherIds = new Set(roles?.map((r) => r.user_id));
    const students = (profiles ?? []).filter((p) => !teacherIds.has(p.id));
    if (students.length > 70) throw new Error("Ek scan mein maximum 70 students ho sakte hain.");
    // Privileged storage access is needed only after teacher authorization;
    // reference images never reach the teacher's browser.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const references: { student_id: string; reference_image: string }[] = [];
    for (const student of students) {
      if (!student.face_path || !student.face_path.startsWith(`${student.id}/`)) continue;
      const { data: photo, error: downloadError } = await supabaseAdmin.storage
        .from("faces")
        .download(student.face_path);
      if (downloadError || !photo)
        throw new Error("Saved face photo load nahi hui; dobara try karein.");
      const bytes = new Uint8Array(await photo.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      references.push({
        student_id: student.id,
        reference_image: `data:${photo.type || "image/jpeg"};base64,${btoa(binary)}`,
      });
    }
    if (!references.length) throw new Error("Is class mein kisi student ka face saved nahi hai.");
    const response = await fetch(`${url.replace(/\/+$/, "")}/v1/group-face-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ group_image: data.image, students: references }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 422
          ? "Saaf photo lein; maximum 70 faces hone chahiye."
          : "Group face check nahi hua. Server connection check karein.",
      );
    const result = z
      .object({
        detected_faces: z.number().int().min(0).max(70),
        matches: z
          .array(
            z.object({
              student_id: z.string().uuid(),
              confidence: z.number().finite().min(0).max(1),
            }),
          )
          .max(70),
      })
      .parse(await response.json());
    const allowed = new Set(references.map((r) => r.student_id));
    const seen = new Set<string>();
    const matches = result.matches.filter((m) => {
      if (!allowed.has(m.student_id) || seen.has(m.student_id) || m.confidence < 0.6) return false;
      seen.add(m.student_id);
      return true;
    });
    const { data: scan, error: scanError } = await supabaseAdmin
      .from("group_attendance_scans")
      .insert({
        teacher_id: context.userId,
        class_name: data.className,
        section: data.section,
        school_name: data.school,
        subject: data.subject,
        period: data.period,
        detected_faces: result.detected_faces,
        matches,
      })
      .select("id")
      .single();
    if (scanError || !scan) throw new Error("Scan result save nahi hua.");
    return {
      scanId: scan.id,
      detectedFaces: result.detected_faces,
      matches: matches.map((m) => ({
        id: m.student_id,
        name: students.find((s) => s.id === m.student_id)?.full_name || "Student",
        confidence: m.confidence,
      })),
    };
  });

export const confirmGroupAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ scanId: z.string().uuid(), studentIds: z.array(z.string().uuid()).min(1).max(70) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: count, error } = await context.supabase.rpc("confirm_group_attendance", {
      _scan_id: data.scanId,
      _student_ids: [...new Set(data.studentIds)],
    });
    if (error)
      throw new Error("Attendance save nahi hui. Scan expired ho sakta hai; nayi photo lein.");
    return { saved: count };
  });
