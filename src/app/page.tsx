import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { RoleName } from "@/lib/rbac";

// ─── Module card definitions per role ────────────────────────────────────────

type ModuleCard = {
  label: string;
  description: string;
  icon: string;
  color: string;
  href: string;
};

const MODULE_CARDS: Record<string, ModuleCard[]> = {
  super_admin: [
    {
      label: "User Management",
      description: "Create, view, and manage all user accounts and roles.",
      icon: "👥",
      color: "bg-violet-50 border-violet-200 text-violet-700",
      href: "/api/users",
    },
    {
      label: "Audit Log",
      description: "View the immutable audit trail of all system actions.",
      icon: "🔍",
      color: "bg-slate-50 border-slate-200 text-slate-700",
      href: "/api/audit",
    },
  ],
  university_admin: [
    {
      label: "Academic Structure",
      description: "Manage departments, programs, courses, and semesters.",
      icon: "🏛️",
      color: "bg-blue-50 border-blue-200 text-blue-700",
      href: "/api/academic",
    },
  ],
  registrar: [
    {
      label: "Student Management",
      description: "Manage student profiles and enrolment records.",
      icon: "🎓",
      color: "bg-emerald-50 border-emerald-200 text-emerald-700",
      href: "/api/students",
    },
  ],
  department_admin: [
    {
      label: "Assessment Templates",
      description: "Configure graded components and weightages for course offerings.",
      icon: "📋",
      color: "bg-orange-50 border-orange-200 text-orange-700",
      href: "/api/exams/templates",
    },
    {
      label: "Verify Marks",
      description: "Review and verify submitted marks from faculty.",
      icon: "✅",
      color: "bg-teal-50 border-teal-200 text-teal-700",
      href: "/api/exams/marks",
    },
  ],
  hod: [
    {
      label: "Verify Marks",
      description: "Review and approve submitted marks for your department.",
      icon: "✅",
      color: "bg-teal-50 border-teal-200 text-teal-700",
      href: "/api/exams/marks",
    },
  ],
  examination_controller: [
    {
      label: "Publish Results",
      description: "Review computed results and publish them for students.",
      icon: "📢",
      color: "bg-indigo-50 border-indigo-200 text-indigo-700",
      href: "/api/exams/results",
    },
  ],
  faculty: [
    {
      label: "Record Attendance",
      description: "Mark attendance for your assigned class sections.",
      icon: "📅",
      color: "bg-sky-50 border-sky-200 text-sky-700",
      href: "/api/attendance",
    },
    {
      label: "Enter Marks",
      description: "Save or submit marks for assessment components.",
      icon: "✏️",
      color: "bg-amber-50 border-amber-200 text-amber-700",
      href: "/api/exams/marks",
    },
  ],
  student: [
    {
      label: "My Results",
      description: "View your published examination results and grades.",
      icon: "🏆",
      color: "bg-emerald-50 border-emerald-200 text-emerald-700",
      href: "/api/exams/results",
    },
    {
      label: "Fee & Payments",
      description: "Check your invoices, outstanding dues, and payment history.",
      icon: "💳",
      color: "bg-pink-50 border-pink-200 text-pink-700",
      href: "/api/fees/payments",
    },
  ],
  parent: [
    {
      label: "Ward's Results",
      description: "View your ward's published results and attendance.",
      icon: "🏆",
      color: "bg-emerald-50 border-emerald-200 text-emerald-700",
      href: "/api/exams/results",
    },
    {
      label: "Fee Status",
      description: "Check outstanding dues and payment status.",
      icon: "💳",
      color: "bg-pink-50 border-pink-200 text-pink-700",
      href: "/api/fees/payments",
    },
  ],
  auditor: [
    {
      label: "Audit Log",
      description: "Browse the system-wide immutable audit trail.",
      icon: "🔍",
      color: "bg-slate-50 border-slate-200 text-slate-700",
      href: "/api/audit",
    },
  ],
};

// ─── Role display metadata ────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; badge: string }> = {
  super_admin: { label: "Super Administrator", badge: "bg-violet-100 text-violet-800" },
  university_admin: { label: "University Administrator", badge: "bg-blue-100 text-blue-800" },
  registrar: { label: "Registrar", badge: "bg-cyan-100 text-cyan-800" },
  department_admin: { label: "Department Administrator", badge: "bg-orange-100 text-orange-800" },
  hod: { label: "Head of Department", badge: "bg-teal-100 text-teal-800" },
  examination_controller: { label: "Examination Controller", badge: "bg-indigo-100 text-indigo-800" },
  faculty: { label: "Faculty", badge: "bg-sky-100 text-sky-800" },
  student: { label: "Student", badge: "bg-emerald-100 text-emerald-800" },
  parent: { label: "Parent / Guardian", badge: "bg-pink-100 text-pink-800" },
  auditor: { label: "Auditor", badge: "bg-slate-100 text-slate-700" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as RoleName;
  const cards = MODULE_CARDS[role] ?? [];
  const meta = ROLE_META[role] ?? { label: role, badge: "bg-slate-100 text-slate-700" };
  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                />
              </svg>
            </div>
            <span className="text-base font-semibold text-slate-900">University ERP</span>
          </div>

          {/* User + sign out */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {initials}
              </div>
              <span className="text-sm font-medium text-slate-700">{session.user.name}</span>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        {/* Welcome banner */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Welcome back, {session.user.name?.split(" ")[0] ?? "User"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Here&apos;s your dashboard for the modules available to your role.
              </p>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${meta.badge}`}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* Module cards grid */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <div className="text-4xl mb-4">🚧</div>
            <p className="text-sm font-medium text-slate-600">No modules configured for this role yet.</p>
            <p className="mt-1 text-xs text-slate-400">Contact your system administrator.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <a
                key={card.href}
                href={card.href}
                className="group flex flex-col gap-3 rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <div
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border text-xl ${card.color}`}
                >
                  {card.icon}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    {card.label}
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{card.description}</p>
                </div>
                <div className="mt-auto flex items-center gap-1 text-xs font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100">
                  Open
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Quick info strip */}
        <div className="mt-10 rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs text-slate-400">
            <span className="font-medium text-slate-500">Foundation scaffold</span> — role-specific full dashboards
            (SRS FR-DASH-01–03) are the next milestone. API endpoints for all four modules are live and documented in
            the{" "}
            <code className="rounded bg-slate-100 px-1 font-mono text-slate-600">README.md</code>.
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center">
        <p className="text-xs text-slate-400">
          University ERP &copy; {new Date().getFullYear()} &mdash; Built with Next.js 16 &amp; Drizzle ORM
        </p>
      </footer>
    </div>
  );
}
