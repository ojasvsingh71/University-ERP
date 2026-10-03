/**
 * MODULE: Attendance Management
 * GET /api/attendance/my
 *   -> fetch the authenticated student's own attendance summary across all active enrollments
 *      — FR-ATT-03
 * Auth: student role with `view_own_attendance` permission.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  attendanceRecords,
  courseOfferings,
  courses,
  enrollments,
  sections,
  semesters,
  students,
} from "@/db/schema";
import { requirePermission, ForbiddenError } from "@/lib/rbac";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "view_own_attendance");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  // Resolve student profile from the authenticated user
  const [studentProfile] = await db
    .select({ id: students.id, rollNumber: students.rollNumber })
    .from(students)
    .where(eq(students.userId, session!.user.id))
    .limit(1);

  if (!studentProfile) {
    return NextResponse.json(
      { error: "No student profile linked to this account" },
      { status: 403 }
    );
  }

  // Fetch all enrollments with joined course + semester metadata
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
    .where(eq(enrollments.studentId, studentProfile.id));

  // For each enrollment, compute attendance statistics from attendanceRecords
  const enrollmentsWithStats = await Promise.all(
    myEnrollments.map(async (e) => {
      const records = await db
        .select({ status: attendanceRecords.status })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.enrollmentId, e.enrollmentId));

      const totalSessions = records.length;
      const present = records.filter((r) => r.status === "present").length;
      const absent = records.filter((r) => r.status === "absent").length;
      const excused = records.filter((r) => r.status === "excused").length;
      const attendancePercentage =
        totalSessions > 0 ? Math.round((present / totalSessions) * 100) : null;

      return {
        enrollmentId: e.enrollmentId,
        enrollmentStatus: e.enrollmentStatus,
        sectionLabel: e.sectionLabel,
        courseCode: e.courseCode,
        courseTitle: e.courseTitle,
        credits: e.credits,
        semesterLabel: e.semesterLabel,
        stats: {
          totalSessions,
          present,
          absent,
          excused,
          attendancePercentage,
        },
      };
    })
  );

  return NextResponse.json({
    studentId: studentProfile.id,
    rollNumber: studentProfile.rollNumber,
    enrollments: enrollmentsWithStats,
  });
}
