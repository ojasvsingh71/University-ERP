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
import { and, count, eq } from "drizzle-orm";
import AttendanceRecorder from "./AttendanceRecorder";

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
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-sm font-medium text-slate-600">No faculty profile is linked to your account.</p>
        <p className="mt-1 text-xs text-slate-400">Contact the system administrator to create your faculty record.</p>
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
    .where(
      and(
        eq(enrollments.status, "registered"),
        // Only sections this faculty teaches
        // We'll filter in JS since Drizzle subquery syntax is verbose
      )
    )
    .groupBy(enrollments.sectionId);

  const countBySectionId = new Map(enrollmentCounts.map((r) => [r.sectionId, r.count]));

  // Merge enrollment counts into sections
  const sectionsWithCount = assignedSections.map((s) => ({
    ...s,
    enrolledCount: countBySectionId.get(s.sectionId) ?? 0,
  }));

  return (
    <>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Attendance Recording</h1>
        <p className="mt-1 text-sm text-slate-500">
          Employee Code:{" "}
          <span className="font-mono text-slate-700">{facultyProfile.employeeCode}</span>
          {" · "}
          {sectionsWithCount.length} section{sectionsWithCount.length !== 1 ? "s" : ""} assigned
        </p>
      </div>

      {/* Main recorder component (client-side interactive) */}
      <AttendanceRecorder sections={sectionsWithCount} />
    </>
  );
}
