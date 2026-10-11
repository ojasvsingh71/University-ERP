import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { RoleName } from "@/lib/rbac";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import {
  Users,
  ShieldCheck,
  Building2,
  GraduationCap,
  ClipboardList,
  CheckCircle,
  FileCheck2,
  CalendarCheck2,
  PenTool,
  Trophy,
  CreditCard,
  Search,
  ArrowRight,
  BookOpen,
  Sparkles,
  Layers,
  Clock
} from "lucide-react";

// ─── Module card definitions per role ────────────────────────────────────────

interface ModuleItem {
  label: string;
  description: string;
  iconName: string;
  badge?: string;
  color: string;
  href: string;
  highlight?: boolean;
}

const MODULE_CARDS: Record<string, ModuleItem[]> = {
  super_admin: [
    {
      label: "User Management",
      description: "Manage system accounts, assign RBAC roles, and control access permissions.",
      iconName: "users",
      color: "from-violet-500 to-purple-600",
      href: "/api/users",
    },
    {
      label: "Audit Logs",
      description: "Inspect immutable security audit trails, sensitive actions, and access history.",
      iconName: "shieldCheck",
      color: "from-slate-600 to-slate-800",
      href: "/api/audit",
    },
    {
      label: "Attendance Overview",
      description: "Cross-department attendance tracking and lecture session monitoring.",
      iconName: "calendarCheck",
      badge: "Active Module",
      color: "from-sky-500 to-blue-600",
      href: "/attendance",
      highlight: true,
    },
  ],
  university_admin: [
    {
      label: "Academic Structure",
      description: "Configure faculties, academic years, semesters, programs, and course catalogs.",
      iconName: "building",
      color: "from-blue-500 to-indigo-600",
      href: "/api/academic",
    },
    {
      label: "Attendance Supervision",
      description: "Monitor university-wide attendance compliance across departments.",
      iconName: "calendarCheck",
      badge: "Active Module",
      color: "from-sky-500 to-blue-600",
      href: "/attendance",
      highlight: true,
    },
  ],
  registrar: [
    {
      label: "Student Enrollments",
      description: "Manage student admission profiles, batch allocations, and class registrations.",
      iconName: "graduationCap",
      color: "from-emerald-500 to-teal-600",
      href: "/api/students",
    },
    {
      label: "Fee Records",
      description: "Review billing schedules, scholarship waivers, and outstanding tuition balances.",
      iconName: "creditCard",
      color: "from-amber-500 to-orange-600",
      href: "/api/fees/payments",
    },
  ],
  department_admin: [
    {
      label: "Attendance Operations",
      description: "View and record attendance sheets for departmental course sections.",
      iconName: "calendarCheck",
      badge: "Active Module",
      color: "from-sky-500 to-blue-600",
      href: "/attendance",
      highlight: true,
    },
    {
      label: "Assessment Templates",
      description: "Configure course evaluation weightages, quizzes, assignments, and exams.",
      iconName: "clipboardList",
      color: "from-orange-500 to-amber-600",
      href: "/api/exams/templates",
    },
    {
      label: "Verify Marks",
      description: "Review and approve faculty-entered marks before grade computations.",
      iconName: "checkCircle",
      color: "from-teal-500 to-emerald-600",
      href: "/api/exams/marks",
    },
  ],
  hod: [
    {
      label: "Attendance Review",
      description: "Oversee section attendance records and identify low-attendance alerts.",
      iconName: "calendarCheck",
      badge: "Active Module",
      color: "from-sky-500 to-blue-600",
      href: "/attendance",
      highlight: true,
    },
    {
      label: "Verify Department Marks",
      description: "Authorize and approve submitted student examination marks.",
      iconName: "checkCircle",
      color: "from-teal-500 to-emerald-600",
      href: "/api/exams/marks",
    },
  ],
  examination_controller: [
    {
      label: "Publish Results",
      description: "Calculate GPA/CGPA, verify grade bands, and publish tamper-proof transcripts.",
      iconName: "fileCheck",
      color: "from-indigo-500 to-violet-600",
      href: "/api/exams/results",
    },
    {
      label: "Examination Schedules",
      description: "Manage mid-term, final, and practical examination timetables.",
      iconName: "clipboardList",
      color: "from-blue-500 to-indigo-600",
      href: "/api/exams/marks",
    },
  ],
  faculty: [
    {
      label: "Record Attendance",
      description: "Interactive session roster with instant batch marking & real-time analytics.",
      iconName: "calendarCheck",
      badge: "Live Interactive",
      color: "from-sky-500 to-indigo-600",
      href: "/attendance",
      highlight: true,
    },
    {
      label: "Enter Marks",
      description: "Draft and submit marks for assignments, practicals, and examinations.",
      iconName: "penTool",
      color: "from-amber-500 to-orange-600",
      href: "/api/exams/marks",
    },
  ],
  student: [
    {
      label: "My Attendance",
      description: "Track course-wise attendance stats, percentages, and attendance warnings.",
      iconName: "calendarCheck",
      badge: "Live Dashboard",
      color: "from-sky-500 to-blue-600",
      href: "/attendance",
      highlight: true,
    },
    {
      label: "My Results & Grades",
      description: "View published semester examination outcomes, GPA, and transcripts.",
      iconName: "trophy",
      color: "from-emerald-500 to-teal-600",
      href: "/api/exams/results",
    },
    {
      label: "Tuition & Fees",
      description: "Review fee invoices, scholarship deductions, and make online payments.",
      iconName: "creditCard",
      color: "from-pink-500 to-rose-600",
      href: "/api/fees/payments",
    },
  ],
  parent: [
    {
      label: "Ward's Attendance",
      description: "Monitor daily attendance rates, excused absences, and minimum criteria.",
      iconName: "calendarCheck",
      badge: "Live Dashboard",
      color: "from-sky-500 to-blue-600",
      href: "/attendance",
      highlight: true,
    },
    {
      label: "Ward's Report Cards",
      description: "View verified academic results, grade reports, and GPA progress.",
      iconName: "trophy",
      color: "from-emerald-500 to-teal-600",
      href: "/api/exams/results",
    },
    {
      label: "Fee Balances",
      description: "Inspect invoice dues, paid receipts, and payment deadlines.",
      iconName: "creditCard",
      color: "from-pink-500 to-rose-600",
      href: "/api/fees/payments",
    },
  ],
  auditor: [
    {
      label: "Audit Ledger",
      description: "Inspect immutable chronological system audit entries and event parameters.",
      iconName: "search",
      color: "from-slate-600 to-slate-800",
      href: "/api/audit",
    },
  ],
};

const ROLE_META: Record<string, { label: string; badge: string }> = {
  super_admin: { label: "Super Administrator", badge: "bg-violet-100 text-violet-800 border-violet-200" },
  university_admin: { label: "University Administrator", badge: "bg-blue-100 text-blue-800 border-blue-200" },
  registrar: { label: "Registrar", badge: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  department_admin: { label: "Department Administrator", badge: "bg-orange-100 text-orange-800 border-orange-200" },
  hod: { label: "Head of Department", badge: "bg-teal-100 text-teal-800 border-teal-200" },
  examination_controller: { label: "Examination Controller", badge: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  faculty: { label: "Faculty Member", badge: "bg-sky-100 text-sky-800 border-sky-200" },
  student: { label: "Enrolled Student", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  parent: { label: "Parent / Guardian", badge: "bg-pink-100 text-pink-800 border-pink-200" },
  auditor: { label: "Compliance Auditor", badge: "bg-slate-100 text-slate-700 border-slate-200" },
};

function renderIcon(iconName: string) {
  const props = { className: "w-6 h-6 text-white" };
  switch (iconName) {
    case "users": return <Users {...props} />;
    case "shieldCheck": return <ShieldCheck {...props} />;
    case "building": return <Building2 {...props} />;
    case "graduationCap": return <GraduationCap {...props} />;
    case "clipboardList": return <ClipboardList {...props} />;
    case "checkCircle": return <CheckCircle {...props} />;
    case "fileCheck": return <FileCheck2 {...props} />;
    case "calendarCheck": return <CalendarCheck2 {...props} />;
    case "penTool": return <PenTool {...props} />;
    case "trophy": return <Trophy {...props} />;
    case "creditCard": return <CreditCard {...props} />;
    case "search": return <Search {...props} />;
    default: return <BookOpen {...props} />;
  }
}

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as RoleName;
  const cards = MODULE_CARDS[role] ?? [];
  const meta = ROLE_META[role] ?? { label: role, badge: "bg-slate-100 text-slate-700 border-slate-200" };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* ── Top Navigation Bar ── */}
      <Navbar
        user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
        onSignOutAction={async () => {
          "use server";
          await signOut();
        }}
      />

      {/* ── Main Content ── */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-8 sm:p-10 text-white shadow-xl shadow-indigo-950/10">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-10 h-48 w-48 rounded-full bg-violet-500/20 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>Academic Portal Session Active</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Welcome back, {session.user.name?.split(" ")[0] ?? "User"}!
              </h1>
              <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed">
                Access your personalized academic modules, review real-time course analytics, and manage university operations.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold border shadow-xs ${meta.badge}`}>
                <span className="w-2 h-2 rounded-full bg-current opacity-70 animate-pulse" />
                {meta.label}
              </span>
              <span className="text-xs text-indigo-200/80 font-mono">
                {session.user.email}
              </span>
            </div>
          </div>
        </div>

        {/* Attendance Highlight Banner if available */}
        <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-r from-sky-50/80 via-indigo-50/50 to-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-md shadow-sky-500/20 shrink-0">
              <CalendarCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Attendance Management Module</h3>
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-200">
                  Fully Operational
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {role === "faculty"
                  ? "Mark attendance for assigned sections with quick batch actions and instant verification."
                  : role === "student"
                  ? "Check current attendance rates, present/absent stats, and semester breakdown."
                  : "Explore the live interactive attendance system with automated percentage calculation."}
              </p>
            </div>
          </div>

          <Link
            href="/attendance"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 transition-colors shadow-xs shrink-0 self-end sm:self-center"
          >
            <span>Open Attendance</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Modules Section Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Role Modules &amp; Applications
            </h2>
            <p className="text-xs text-slate-500">Authorized services accessible for your security profile</p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {cards.length} {cards.length === 1 ? "Module" : "Modules"}
          </span>
        </div>

        {/* Module cards grid */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-xs">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <BookOpen className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No applications assigned yet</p>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              Your account currently has no active module shortcuts. Please contact the system administrator.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const isDirectUi = card.href.startsWith("/attendance");
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className={`group relative flex flex-col justify-between rounded-3xl border bg-white p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-200 overflow-hidden ${
                    card.highlight
                      ? "border-indigo-300/80 ring-2 ring-indigo-500/10"
                      : "border-slate-200/90 hover:border-indigo-200"
                  }`}
                >
                  {/* Subtle hover gradient header */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr ${card.color} shadow-md group-hover:scale-105 transition-transform duration-200`}>
                        {renderIcon(card.iconName)}
                      </div>

                      {card.badge && (
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 border border-indigo-100">
                          {card.badge}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                        {card.label}
                      </h3>
                      <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-medium text-slate-400 font-mono">
                      {isDirectUi ? "Interactive UI" : "Backend Route"}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                      <span>Launch</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Quick System Architecture Note */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-slate-400 shrink-0" />
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">University ERP Foundation:</span> Role-based access control, attendance recording engine, and audit log tracking are live.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            Next.js 16 • Turbopack • PostgreSQL
          </span>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-12 text-center">
        <p className="text-xs text-slate-400">
          University ERP &copy; {new Date().getFullYear()} &mdash; Developed with Next.js 16, Drizzle ORM &amp; Tailwind CSS
        </p>
      </footer>
    </div>
  );
}
