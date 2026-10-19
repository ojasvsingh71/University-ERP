import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Layers,
  History,
  Lock,
} from "lucide-react";

export default async function ExamsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;

  // Direct role redirects if user has specific primary role
  if (role === "faculty") {
    redirect("/exams/faculty");
  } else if (role === "student" || role === "parent") {
    redirect("/exams/results");
  } else if (role === "examination_controller") {
    redirect("/exams/controller");
  }

  // For Admin, Registrar, HOD, Auditor: show module navigation portal
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-8 text-white shadow-xl shadow-indigo-950/20">
        <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200 backdrop-blur-md mb-4 border border-indigo-400/20">
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            <span>Master Plan &sect;18 &sect;19 &bull; FR-RES Architecture</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Examination & Result Management
          </h1>
          <p className="mt-3 text-sm text-indigo-200 leading-relaxed">
            Enterprise assessment engine supporting examination scheduling, faculty marks drafting,
            multi-tier verification, automated grade &amp; GPA computation, and tamper-proof immutable results.
          </p>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Append/Version Pattern</h3>
            <p className="text-xs text-slate-500 mt-1">
              Strict auditability: submitted marks and results are never overwritten in-place. Amendments insert a new version.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Immutable Publication</h3>
            <p className="text-xs text-slate-500 mt-1">
              Once published, transcripts are locked forever. Historical outcomes are permanently preserved for audit.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Dynamic Policy Engine</h3>
            <p className="text-xs text-slate-500 mt-1">
              Configurable grade bands (A+, A, B...), component weightages summing to 100%, and automated grace marks.
            </p>
          </div>
        </div>
      </div>

      {/* Portal Cards */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Module Portals</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Exam Controller Portal */}
          <Link
            href="/exams/controller"
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20 mb-4 group-hover:scale-105 transition-transform">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                Exam Controller Portal
              </h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Schedule exams, monitor submission status across departments, review and verify faculty marks, trigger GPA computation, and publish results.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-indigo-600 group-hover:gap-2 gap-1.5 transition-all">
              <span>Open Controller View</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>

          {/* Faculty Portal */}
          <Link
            href="/exams/faculty"
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md hover:border-amber-300 transition-all"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20 mb-4 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                Faculty Marks Entry
              </h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Select assigned courses &amp; sections, access student rosters, enter marks with live validation, draft entries, and submit batches for verification.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-amber-600 group-hover:gap-2 gap-1.5 transition-all">
              <span>Open Faculty View</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>

          {/* Student/Parent Results Portal */}
          <Link
            href="/exams/results"
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 mb-4 group-hover:scale-105 transition-transform">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                Student Transcripts &amp; Results
              </h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Official semester grade cards, subject-wise marks breakdown, letter grades, SGPA &amp; CGPA calculation, print preview, and revaluation requests.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-emerald-600 group-hover:gap-2 gap-1.5 transition-all">
              <span>Open Results View</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
