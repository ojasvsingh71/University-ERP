import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { ChevronRight, CalendarCheck2, Home } from "lucide-react";

export const metadata: Metadata = {
  title: "Attendance Management",
  description: "Record section attendance, view attendance rates, and analyze lecture sessions.",
};

export default async function AttendanceLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Global Navbar */}
      <Navbar
        user={session?.user ? { name: session.user.name, email: session.user.email, role: session.user.role } : undefined}
        onSignOutAction={async () => {
          "use server";
          await signOut();
        }}
      />

      {/* Sub-nav breadcrumbs bar */}
      <div className="border-b border-slate-200/80 bg-white/60 backdrop-blur-xs">
        <div className="mx-auto flex h-11 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 text-xs">
          <nav className="flex items-center gap-2 text-slate-500 font-medium">
            <Link
              href="/"
              className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="flex items-center gap-1 text-slate-900 font-semibold">
              <CalendarCheck2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Attendance Module</span>
            </span>
          </nav>

          <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-400 text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live Sync Active
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-400">
        Attendance Management System &bull; University ERP
      </footer>
    </div>
  );
}
