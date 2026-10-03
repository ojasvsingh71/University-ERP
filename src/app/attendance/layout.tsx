import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Attendance" };

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Sub-nav breadcrumb */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-2 px-4 sm:px-6 text-sm">
          <Link href="/" className="text-slate-400 hover:text-slate-600 transition-colors">
            Dashboard
          </Link>
          <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-slate-700">Attendance</span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
