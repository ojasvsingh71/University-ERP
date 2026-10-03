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

interface Props {
  userId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pctColor(pct: number | null) {
  if (pct === null) return { bar: "bg-slate-200", text: "text-slate-400", label: "No classes yet" };
  if (pct >= 75) return { bar: "bg-emerald-500", text: "text-emerald-600", label: "Good" };
  if (pct >= 60) return { bar: "bg-amber-500", text: "text-amber-600", label: "Warning" };
  return { bar: "bg-red-500", text: "text-red-600", label: "Critical" };
}

// ── Overall summary card ──────────────────────────────────────────────────────

function OverallCard({
  totalSessions,
  totalPresent,
  totalCourses,
}: {
  totalSessions: number;
  totalPresent: number;
  totalCourses: number;
}) {
  const pct = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : null;
  const c = pctColor(pct);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Overall Attendance</p>
          <p className={`mt-1 text-4xl font-extrabold tabular-nums ${c.text}`}>
            {pct !== null ? `${pct}%` : "–"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {totalPresent} present out of {totalSessions} classes across {totalCourses} course
            {totalCourses !== 1 ? "s" : ""}
          </p>
        </div>
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-xl text-2xl ${
            pct === null
              ? "bg-slate-50"
              : pct >= 75
                ? "bg-emerald-50"
                : pct >= 60
                  ? "bg-amber-50"
                  : "bg-red-50"
          }`}
        >
          {pct === null ? "📅" : pct >= 75 ? "✅" : pct >= 60 ? "⚠️" : "🚨"}
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="mt-4 h-2 w-full rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full transition-all ${c.bar}`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> ≥75% — Good
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> 60–74% — Warning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> &lt;60% — Critical
        </span>
      </div>
    </div>
  );
}

// ── Per-course card ───────────────────────────────────────────────────────────

function CourseCard({
  courseCode,
  courseTitle,
  credits,
  sectionLabel,
  semesterLabel,
  totalSessions,
  present,
  absent,
  excused,
  percentage,
}: {
  courseCode: string;
  courseTitle: string;
  credits: number;
  sectionLabel: string;
  semesterLabel: string;
  totalSessions: number;
  present: number;
  absent: number;
  excused: number;
  percentage: number | null;
}) {
  const c = pctColor(percentage);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">{courseCode}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
              {credits} cr
            </span>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-600">
              Sec {sectionLabel}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-600 leading-snug">{courseTitle}</p>
          <p className="mt-0.5 text-xs text-slate-400">{semesterLabel}</p>
        </div>

        {/* Percentage badge */}
        <div className="flex flex-col items-end shrink-0">
          <span className={`text-2xl font-extrabold tabular-nums ${c.text}`}>
            {percentage !== null ? `${percentage}%` : "–"}
          </span>
          <span className={`text-xs font-medium ${c.text}`}>{c.label}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
        <div
          className={`h-1.5 rounded-full ${c.bar}`}
          style={{ width: `${percentage ?? 0}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="mt-3 grid grid-cols-3 divide-x divide-slate-100 text-center text-xs">
        <div className="pr-2">
          <p className="font-semibold text-emerald-600">{present}</p>
          <p className="text-slate-400">Present</p>
        </div>
        <div className="px-2">
          <p className="font-semibold text-red-600">{absent}</p>
          <p className="text-slate-400">Absent</p>
        </div>
        <div className="pl-2">
          <p className="font-semibold text-amber-600">{excused}</p>
          <p className="text-slate-400">Excused</p>
        </div>
      </div>

      {totalSessions === 0 && (
        <p className="mt-2 text-center text-xs text-slate-400 italic">No sessions recorded yet</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default async function StudentDashboard({ userId }: Props) {
  // ── 1. Student profile ────────────────────────────────────────────────────
  const [studentProfile] = await db
    .select({ id: students.id, rollNumber: students.rollNumber })
    .from(students)
    .where(eq(students.userId, userId))
    .limit(1);

  if (!studentProfile) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-sm font-medium text-slate-600">No student profile is linked to your account.</p>
        <p className="mt-1 text-xs text-slate-400">Contact the registrar to create your student record.</p>
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

  // ── 4. Aggregate totals for the overall card ──────────────────────────────
  const totalSessions = enrollmentData.reduce((s, e) => s + e.total, 0);
  const totalPresent = enrollmentData.reduce((s, e) => s + e.present, 0);

  // ── 5. Group by semester for display ──────────────────────────────────────
  const bySemester = enrollmentData.reduce<Record<string, typeof enrollmentData>>(
    (acc, e) => {
      if (!acc[e.semesterLabel]) acc[e.semesterLabel] = [];
      acc[e.semesterLabel].push(e);
      return acc;
    },
    {}
  );

  return (
    <>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My Attendance</h1>
        <p className="mt-1 text-sm text-slate-500">
          Roll No:{" "}
          <span className="font-mono font-semibold text-slate-700">{studentProfile.rollNumber}</span>
          {" · "}
          {myEnrollments.length} enrolled course{myEnrollments.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Overall summary */}
      <OverallCard
        totalSessions={totalSessions}
        totalPresent={totalPresent}
        totalCourses={myEnrollments.length}
      />

      {/* No enrollments */}
      {myEnrollments.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <div className="text-3xl mb-3">📚</div>
          <p className="text-sm text-slate-500">You are not enrolled in any courses yet.</p>
        </div>
      )}

      {/* Per semester sections */}
      {Object.entries(bySemester).map(([semLabel, courses]) => {
        const semPresentCount = courses.reduce((s, c) => s + c.present, 0);
        const semTotalCount = courses.reduce((s, c) => s + c.total, 0);
        const semPct = semTotalCount > 0 ? Math.round((semPresentCount / semTotalCount) * 100) : null;

        return (
          <section key={semLabel} className="mt-8">
            {/* Semester heading */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">{semLabel}</h2>
              {semPct !== null && (
                <span
                  className={`text-xs font-semibold ${
                    semPct >= 75
                      ? "text-emerald-600"
                      : semPct >= 60
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                >
                  Semester avg: {semPct}%
                </span>
              )}
            </div>

            {/* Grid of course cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((e) => (
                <CourseCard
                  key={e.enrollmentId}
                  courseCode={e.courseCode}
                  courseTitle={e.courseTitle}
                  credits={e.credits}
                  sectionLabel={e.sectionLabel}
                  semesterLabel={e.semesterLabel}
                  totalSessions={e.total}
                  present={e.present}
                  absent={e.absent}
                  excused={e.excused}
                  percentage={e.percentage}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Bottom note */}
      <p className="mt-8 text-xs text-slate-400 text-center">
        Attendance is updated by your faculty after each session. Contact your faculty for discrepancies.
      </p>
    </>
  );
}
