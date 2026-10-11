import Link from "next/link";
import { GraduationCap, LogOut, User as UserIcon } from "lucide-react";

interface NavbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
  onSignOutAction?: () => Promise<void>;
}

export function Navbar({ user, onSignOutAction }: NavbarProps) {
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-transform group-hover:scale-105">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
              University ERP
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100/80">
              Portal
            </span>
          </div>
        </Link>

        {/* User profile & Sign out */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-slate-50/80 pl-1.5 pr-3 py-1 shadow-xs">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-xs">
                {initials}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 leading-tight max-w-[130px] sm:max-w-[180px] truncate">
                  {user.name}
                </span>
                <span className="text-[10px] text-slate-500 capitalize leading-none">
                  {user.role?.replace("_", " ")}
                </span>
              </div>
            </div>

            {onSignOutAction && (
              <form action={onSignOutAction}>
                <button
                  type="submit"
                  title="Sign out"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
