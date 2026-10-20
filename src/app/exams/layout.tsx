import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { ChevronRight, Award, Home, FileText, CheckCircle2, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Examination & Result Management | University ERP",
  description: "Schedule exams, submit and verify assessment marks, compute GPAs, and publish transcripts.",
};

export default async function ExamsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session?.user?.role;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Global Navbar */}
      <Navbar
        user={session?.user ? { name: session.user.name, email: session.user.email, role: session.user.role } : undefined}
        onSignOutAction={async () => {
          "use server";
          await signOut();
        }}
      />

      {/* Sub-nav breadcrumbs & quick tabs bar */}
      <div className="border-b border-slate-200/80 bg-white/70 backdrop-blur-xs">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 text-xs">
          <nav className="flex items-center gap-2 text-slate-500 font-medium">
            <Link
              href="/"
              className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <Link
              href="/exams"
              className="flex items-center gap-1 hover:text-indigo-600 text-slate-700 font-semibold"
            >
              <Award className="w-3.5 h-3.5 text-indigo-600" />
              <span>Examinations & Results</span>
            </Link>
          </nav>

          {/* Quick links to role views */}
          <div className="hidden md:flex items-center gap-1">
            {["examination_controller", "super_admin", "university_admin", "hod", "department_admin"].includes(
              role ?? ""
            ) && (
              <Link
                href="/exams/controller"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 font-medium transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span>Controller Portal</span>
              </Link>
            )}

            {["faculty", "super_admin", "department_admin", "hod"].includes(role ?? "") && (
              <Link
                href="/exams/faculty"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 font-medium transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Faculty Marks Entry</span>
              </Link>
            )}

            <Link
              href="/exams/results"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 font-medium transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              <span>Transcripts & Results</span>
            </Link>

            <span className="ml-2 inline-flex items-center gap-1.5 text-slate-400 text-[11px] pl-3 border-l border-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Append/Version Sync Active
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-400">
        Examination & Result Management System &bull; University ERP &bull; Immutable Versioning Engine
      </footer>
    </div>
  );
}
