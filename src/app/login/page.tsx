"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  UserCheck
} from "lucide-react";

const DEMO_USERS = [
  { role: "Faculty", email: "faculty@erp.test", label: "Fay Faculty (CS Dept)", icon: "👨‍🏫" },
  { role: "Student", email: "student@erp.test", label: "Stu Dent (B.Tech CS)", icon: "🎓" },
  { role: "Super Admin", email: "superadmin@erp.test", label: "Sam Super (IT Ops)", icon: "🛡️" },
  { role: "Registrar", email: "registrar@erp.test", label: "Remy Registrar (Academic)", icon: "🏛️" },
  { role: "Exam Controller", email: "examctrl@erp.test", label: "Eli ExamCtrl (Exams)", icon: "📝" },
  { role: "Parent", email: "parent@erp.test", label: "Pat Parent (Guardian)", icon: "👨‍👩‍👦" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(targetEmail = email, targetPassword = password) {
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email: targetEmail,
      password: targetPassword,
      redirect: false
    });

    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password. Please try again or use a demo account.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleLogin();
  }

  function handleQuickLogin(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("Password123!");
    handleLogin(demoEmail, "Password123!");
  }

  return (
    <main className="min-h-screen flex flex-col justify-center items-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-indigo-100/60 via-purple-50/30 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-10 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-4xl grid md:grid-cols-5 gap-8 items-center">
        {/* Left column / Intro & Quick logins (3 cols on desktop) */}
        <div className="md:col-span-3 space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure Enterprise Portal
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Welcome to <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">University ERP</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-md">
              A comprehensive academic management system powering attendance, grades, examinations, and university administration.
            </p>
          </div>

          {/* Quick Demo Switcher */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-500" /> Quick Demo Sign In
              </span>
              <span className="text-[11px] text-slate-400 font-medium">1-Click Login</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_USERS.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin(demo.email)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-indigo-50/60 hover:border-indigo-300 text-left transition-all group disabled:opacity-50"
                >
                  <span className="text-lg p-1 rounded-lg bg-white shadow-2xs border border-slate-100">{demo.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 truncate transition-colors">
                      {demo.role}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{demo.label}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column / Sign in form (2 cols on desktop) */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/90 p-7 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Sign in</h2>
                <p className="text-xs text-slate-500">Enter your university credentials</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-semibold text-slate-700">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300/90 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-2xs transition focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-3 focus:ring-indigo-500/15 disabled:opacity-50"
                    placeholder="name@erp.test"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300/90 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-2xs transition focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-3 focus:ring-indigo-500/15 disabled:opacity-50"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-red-700 text-xs">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 focus:outline-none focus:ring-3 focus:ring-indigo-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in to Dashboard</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Password for all demo accounts: <code className="font-mono text-slate-600 font-medium">Password123!</code></span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
