import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useIsTeacher } from "@/hooks/use-is-teacher";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Attendance overview — FaceMark" },
      { name: "description", content: "View your attendance records in FaceMark." },
      { property: "og:title", content: "Attendance overview — FaceMark" },
      { property: "og:description", content: "Daily student attendance records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AttendanceEntry,
});

function AttendanceEntry() {
  const { data: isTeacher, isLoading } = useIsTeacher();
  if (isLoading) return null;
  return <Navigate to={isTeacher ? "/students" : "/history"} replace />;
}
