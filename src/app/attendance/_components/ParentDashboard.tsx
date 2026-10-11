import { db } from "@/db";
import {
  parentLinks,
  students,
  users,
  enrollments,
  sections,
  courseOfferings,
  courses,
  semesters,
  attendanceRecords,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { AlertTriangle, Users, BookOpen, CheckCircle2, XCircle, HelpCircle, HeartHandshake } from "lucide-react";

interface Props {
  parentUserId: string;
}

export default async function ParentDashboard({ parentUserId }: Props) {
  // ── 1. Find linked students ─────────────────────────────────────────────────
  const links = await db
    .select({
      studentId: parentLinks.studentId,
    })
    .from(parentLinks)
    .where(eq(parentLinks.parentUserId, parentUserId));

  const studentIds = links.map((l) => l.studentId);

  if (studentIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-20 px-6 text-center max-w-lg mx-auto shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 border border-amber-200">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">No Student Wards Linked</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-sm">
          Your parent portal account is not currently connected to any registered student profile. Please contact the registrar office.
        </p>
      </div>
    );
  }

  // ── 2. Fetch linked student profiles ────────────────────────────────────────
  const wards = await db
    .select({
      id: students.id,
      rollNumber: students.rollNumber,
      userId: students.userId,
      fullName: users.fullName,
    })
    .from(students)
    .innerJoin(users, eq(users.id, students.userId))
    .where(inArray(students.id, studentIds));

  // ── 3. Fetch courses and attendance for each ward ────────────────────────────
  const wardsData = await Promise.all(
    wards.map(async (ward) => {
      const myEnrollments = await db
        .select({
          enrollmentId: enrollments.id,
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
        .where(eq(enrollments.studentId, ward.id));

      const coursesWithStats = await Promise.all(
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

      const totalClasses = coursesWithStats.reduce((s, c) => s + c.total, 0);
      const totalPresent = coursesWithStats.reduce((s, c) => s + c.present, 0);
      const overallPct = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : null;

      return {
        ...ward,
        courses: coursesWithStats,
        totalClasses,
        totalPresent,
        overallPct,
      };
    })
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/20 px-2.5 py-0.5 text-xs font-semibold text-pink-300 border border-pink-400/20">
            <HeartHandshake className="w-3.5 h-3.5" />
            Parent &amp; Guardian Portal
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Ward Attendance Monitoring
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1">
          Review daily attendance, presence rates, and subject-wise logs for your registered wards.
        </p>
      </div>

      {/* Ward Cards */}
      <div className="space-y-8">
        {wardsData.map((ward) => (
          <div key={ward.id} className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{ward.fullName}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Roll Number: <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{ward.rollNumber}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-indigo-50 px-4 py-2 text-center border border-indigo-100">
                  <p className="text-[11px] font-semibold text-indigo-600">Overall Rate</p>
                  <p className="text-2xl font-black text-indigo-950">
                    {ward.overallPct !== null ? `${ward.overallPct}%` : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Courses grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ward.courses.map((course) => (
                <div key={course.enrollmentId} className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-sm text-slate-900">{course.courseCode}</span>
                      <p className="text-xs text-slate-600 line-clamp-1">{course.courseTitle}</p>
                    </div>
                    <span className="text-base font-extrabold text-slate-800">
                      {course.percentage !== null ? `${course.percentage}%` : "—"}
                    </span>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        (course.percentage ?? 0) >= 75 ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${course.percentage ?? 0}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200/50">
                    <span>{course.present} Present</span>
                    <span>{course.absent} Absent</span>
                    <span>{course.excused} Excused</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
