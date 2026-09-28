import { Link } from "@tanstack/react-router";
import { ScanFace, History, User, Users } from "lucide-react";
import { useIsTeacher } from "@/hooks/use-is-teacher";

export function BottomNav() {
  const { data: isTeacher } = useIsTeacher();
  const items = [
    { to: "/today", label: "Today", icon: ScanFace },
    { to: "/history", label: "History", icon: History },
    ...(isTeacher ? [{ to: "/students", label: "Students", icon: Users }] : []),
    { to: "/profile", label: "Profile", icon: User },
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-border bg-card/95 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="flex items-stretch justify-around py-2">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
