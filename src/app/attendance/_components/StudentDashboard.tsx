import { db } from "@/db";
import {
  students,
  enrollments,
  sections,
  courseOfferings,
  courses,
  semesters,
  attendanceRecords,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  CalendarCheck2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  BookOpen,
  TrendingUp,
  Award,
  Layers
} from "lucide-react";

interface Props {
  userId: string;
}

function pctStyle(pct: number | null) {
  if (pct === null) {
    return {
      bar: "bg-slate-300",
      text: "text-slate-500",
      bgBadge: "bg-slate-100 text-slate-700 border-slate-200",
      status: "No Sessions",
    };
  }
  if (pct >= 85) {
    return {
      bar: "bg-emerald-500",
      text: "text-emerald-600",
      bgBadge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      status: "Excellent",
    };
  }
  if (pct >= 75) {
    return {
      bar: "bg-teal-500",
      text: "text-teal-600",
      bgBadge: "bg-teal-50 text-teal-700 border-teal-200",
      status: "Good Standing",
    };
  }
  if (pct >= 60) {
    return {
      bar: "bg-amber-500",
      text: "text-amber-600",
      bgBadge: "bg-amber-50 text-amber-700 border-amber-200",
      status: "Attendance Warning",
    };
  }
  return {
    bar: "bg-rose-500",
    text: "text-rose-600",
    bgBadge: "bg-rose-50 text-rose-700 border-rose-200",
    status: "Critically Low",
  };
}

export default async function StudentDashboard({ userId }: Props) {
  // ── 1. Resolve student profile ──────────────────────────────────────────────
  const [studentProfile] = await db
    .select({ id: students.id, rollNumber: students.rollNumber })
    .from(students)
    .where(eq(students.userId, userId))
    .limit(1);

  if (!studentProfile) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-20 px-6 text-center max-w-lg mx-auto shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 border border-amber-200">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">No Student Profile Linked</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-sm">
          Your account is not currently linked to an active student registration profile. Please contact the registrar.
        </p>
      </div>
    );
  }

  // ── 2. Enrollments with course + semester context ─────────────────────────
  const myEnrollments = await db
    .select({
      enrollmentId: enrollments.id,
      enrollmentStatus: enrollments.status,
      sectionLabel: sections.label,
      courseCode: courses.code,
      courseTitle: courses.title,
      credits: courses.credits,
      semesterLabel: semesters.label,
    })
    .from(enrollments)
    .innerJoin(sections, eq(sections.id, enrollments.sectionId))
    .innerJoin(courseOfferings, eq(courseOfferings.id, sections.courseOfferingId))
    .innerJoin(courses, eq(courses.id, courseOfferings.courseId))
    .innerJoin(semesters, eq(semesters.id, courseOfferings.semesterId))
    .where(eq(enrollments.studentId, studentProfile.id))
    .orderBy(semesters.startDate, courses.code);

  // ── 3. Attendance counts per enrollment ───────────────────────────────────
  const enrollmentData = await Promise.all(
    myEnrollments.map(async (e) => {
      const records = await db
        .select({ status: attendanceRecords.status })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.enrollmentId, e.enrollmentId));

      const total = records.length;
      const present = records.filter((r) => r.status === "present").length;
      const absent = records.filter((r) => r.status === "absent").length;
      const excused = records.filter((r) => r.status === "excused").length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : null;

      return { ...e, total, present, absent, excused, percentage };
    })
  );

  const totalSessions = enrollmentData.reduce((s, e) => s + e.total, 0);
  const totalPresent = enrollmentData.reduce((s, e) => s + e.present, 0);
  const totalAbsent = enrollmentData.reduce((s, e) => s + e.absent, 0);
  const totalExcused = enrollmentData.reduce((s, e) => s + e.excused, 0);
  const overallPct = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : null;
  const overallStyle = pctStyle(overallPct);

  // Group by semester
  const bySemester = enrollmentData.reduce<Record<string, typeof enrollmentData>>(
    (acc, e) => {
      if (!acc[e.semesterLabel]) acc[e.semesterLabel] = [];
      acc[e.semesterLabel].push(e);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-8">
      {/* ── Student Header Card ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300 border border-indigo-400/20">
              <Sparkles className="w-3.5 h-3.5" />
              Academic Attendance Records
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              My Attendance Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Roll Number: <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded-md">{studentProfile.rollNumber}</span>
              {" &bull; "}
              {myEnrollments.length} Enrolled Courses
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white/10 backdrop-blur-md p-4 border border-white/10 text-center min-w-[120px]">
              <p className="text-xs text-indigo-200">Overall Rate</p>
              <p className="text-3xl font-black text-white mt-1">
                {overallPct !== null ? `${overallPct}%` : "—"}
              </p>
              <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${overallStyle.bgBadge}`}>
                {overallStyle.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Overall Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Classes</span>
            <BookOpen className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalSessions}</p>
          <span className="text-[11px] text-slate-400">Recorded sessions</span>
        </div>

        <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold">Attended</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{totalPresent}</p>
          <span className="text-[11px] text-emerald-600/80">Present lectures</span>
        </div>

        <div className="rounded-2xl border border-rose-200/90 bg-rose-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-semibold">Missed</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-extrabold text-rose-700 mt-1">{totalAbsent}</p>
          <span className="text-[11px] text-rose-600/80">Absences logged</span>
        </div>

        <div className="rounded-2xl border border-amber-200/90 bg-amber-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold">Excused</span>
            <HelpCircle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-amber-700 mt-1">{totalExcused}</p>
          <span className="text-[11px] text-amber-600/80">Approved leaves</span>
        </div>
      </div>

      {/* ── Empty state if no courses ── */}
      {myEnrollments.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">No Course Enrollments Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            You are not registered in any course sections for the current academic session.
          </p>
        </div>
      )}

      {/* ── Semester Sections & Course Cards ── */}
      {Object.entries(bySemester).map(([semLabel, coursesList]) => {
        const semPresent = coursesList.reduce((s, c) => s + c.present, 0);
        const semTotal = coursesList.reduce((s, c) => s + c.total, 0);
        const semPct = semTotal > 0 ? Math.round((semPresent / semTotal) * 100) : null;
        const semStyle = pctStyle(semPct);

        return (
          <section key={semLabel} className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">{semLabel}</h2>
              </div>
              {semPct !== null && (
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${semStyle.bgBadge}`}>
                  Semester Average: {semPct}%
                </span>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {coursesList.map((course) => {
                const style = pctStyle(course.percentage);
                return (
                  <div
                    key={course.enrollmentId}
                    className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Top labels */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900">
                              {course.courseCode}
                            </span>
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                              {course.credits} Credits
                            </span>
                          </div>
                          <h3 className="text-xs font-semibold text-slate-600 mt-1 line-clamp-2">
                            {course.courseTitle}
                          </h3>
                        </div>

                        <span className={`text-xl font-black tabular-nums ${style.text}`}>
                          {course.percentage !== null ? `${course.percentage}%` : "—"}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-4 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-medium">Attendance Rate</span>
                          <span className={`font-bold ${style.text}`}>{style.status}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
                            style={{ width: `${course.percentage ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Stats pills footer */}
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-3 divide-x divide-slate-100 text-center text-xs">
                      <div>
                        <p className="font-bold text-emerald-600">{course.present}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Present</p>
                      </div>
                      <div>
                        <p className="font-bold text-rose-600">{course.absent}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Absent</p>
                      </div>
                      <div>
                        <p className="font-bold text-amber-600">{course.excused}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Excused</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* University policy note */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs text-indigo-900/80 flex items-center gap-3">
        <Award className="w-5 h-5 text-indigo-600 shrink-0" />
        <p>
          <span className="font-bold">Attendance Policy:</span> A minimum attendance of 75% is mandatory to sit for final semester examinations. Sessions are updated live upon faculty submission.
        </p>
      </div>
    </div>
  );
}
