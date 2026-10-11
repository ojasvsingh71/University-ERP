import { db } from "@/db";
import {
  faculty,
  facultyAssignments,
  sections,
  courseOfferings,
  courses,
  semesters,
  programs,
  enrollments,
} from "@/db/schema";
import { count, eq } from "drizzle-orm";
import AttendanceRecorder from "./AttendanceRecorder";
import { Users, BookOpen, AlertTriangle, Layers, CalendarCheck2 } from "lucide-react";

interface Props {
  userId: string;
}

export default async function FacultyDashboard({ userId }: Props) {
  // ── 1. Resolve faculty profile ──────────────────────────────────────────────
  const [facultyProfile] = await db
    .select({ id: faculty.id, employeeCode: faculty.employeeCode })
    .from(faculty)
    .where(eq(faculty.userId, userId))
    .limit(1);

  if (!facultyProfile) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-20 px-6 text-center max-w-lg mx-auto shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 border border-amber-200">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">No Faculty Profile Found</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-sm">
          Your user account does not have an attached academic faculty record. Please contact the university administrator.
        </p>
      </div>
    );
  }

  // ── 2. Fetch all assigned sections with course & semester context ────────────
  const assignedSections = await db
    .select({
      sectionId: sections.id,
      sectionLabel: sections.label,
      sectionStatus: sections.status,
      sectionCapacity: sections.capacity,
      assignmentRole: facultyAssignments.assignmentRole,
      courseCode: courses.code,
      courseTitle: courses.title,
      credits: courses.credits,
      semesterLabel: semesters.label,
      semesterStart: semesters.startDate,
      semesterEnd: semesters.endDate,
      programName: programs.name,
      programCode: programs.code,
    })
    .from(facultyAssignments)
    .innerJoin(sections, eq(sections.id, facultyAssignments.sectionId))
    .innerJoin(courseOfferings, eq(courseOfferings.id, sections.courseOfferingId))
    .innerJoin(courses, eq(courses.id, courseOfferings.courseId))
    .innerJoin(semesters, eq(semesters.id, courseOfferings.semesterId))
    .innerJoin(programs, eq(programs.id, courseOfferings.programId))
    .where(eq(facultyAssignments.facultyId, facultyProfile.id))
    .orderBy(semesters.startDate, courses.code);

  // ── 3. Fetch enrollment counts per section ───────────────────────────────────
  const enrollmentCounts = await db
    .select({
      sectionId: enrollments.sectionId,
      count: count(),
    })
    .from(enrollments)
    .where(eq(enrollments.status, "registered"))
    .groupBy(enrollments.sectionId);

  const countBySectionId = new Map(enrollmentCounts.map((r) => [r.sectionId, r.count]));

  const sectionsWithCount = assignedSections.map((s) => ({
    ...s,
    enrolledCount: countBySectionId.get(s.sectionId) ?? 0,
  }));

  const totalStudents = sectionsWithCount.reduce((acc, s) => acc + s.enrolledCount, 0);

  return (
    <div className="space-y-6">
      {/* Faculty Header Card */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300 border border-indigo-400/20">
              <CalendarCheck2 className="w-3.5 h-3.5" />
              Faculty Attendance Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Record Section Attendance
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Select a class section, choose the lecture session date, and mark student attendance with batch actions.
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md px-4 py-3 border border-white/10 text-center min-w-[100px]">
            <p className="text-xs text-indigo-200">Employee ID</p>
            <p className="text-sm font-bold font-mono text-white mt-0.5">{facultyProfile.employeeCode}</p>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md px-4 py-3 border border-white/10 text-center min-w-[90px]">
            <p className="text-xs text-indigo-200">Sections</p>
            <p className="text-lg font-bold text-white mt-0.5">{sectionsWithCount.length}</p>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md px-4 py-3 border border-white/10 text-center min-w-[90px]">
            <p className="text-xs text-indigo-200">Students</p>
            <p className="text-lg font-bold text-emerald-400 mt-0.5">{totalStudents}</p>
          </div>
        </div>
      </div>

      {/* Main interactive recorder component */}
      <AttendanceRecorder sections={sectionsWithCount} />
    </div>
  );
}
