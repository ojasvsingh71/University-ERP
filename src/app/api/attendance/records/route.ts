/**
 * MODULE: Attendance Management
 * GET /api/attendance/records?sectionId=UUID&date=YYYY-MM-DD
 *   -> fetch the attendance sheet for a given section + date (Faculty, own-section only) — FR-ATT-02
 * Ownership scoping: the faculty member must hold an active FacultyAssignment on the target
 * section (Master Plan §6.2 — RBAC alone cannot express this, so it's checked explicitly here).
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  attendanceRecords,
  enrollments,
  faculty,
  facultyAssignments,
  students,
  users,
} from "@/db/schema";
import { requirePermission, ForbiddenError } from "@/lib/rbac";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "record_attendance");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const { searchParams } = req.nextUrl;
  const sectionId = searchParams.get("sectionId");
  const date = searchParams.get("date");

  if (!sectionId || !date) {
    return NextResponse.json(
      { error: "Missing required query params: sectionId and date" },
      { status: 400 }
    );
  }
  if (!DATE_REGEX.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format — expected YYYY-MM-DD" },
      { status: 400 }
    );
  }
  // Basic UUID format guard (full UUID regex would be overkill here)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(sectionId)) {
    return NextResponse.json({ error: "Invalid sectionId — must be a UUID" }, { status: 400 });
  }

  // Ownership check: does this faculty user hold an assignment on this section?
  const [facultyProfile] = await db
    .select({ id: faculty.id })
    .from(faculty)
    .where(eq(faculty.userId, session!.user.id))
    .limit(1);

  if (!facultyProfile) {
    return NextResponse.json(
      { error: "No faculty profile linked to this account" },
      { status: 403 }
    );
  }

  const [assignment] = await db
    .select({ id: facultyAssignments.id })
    .from(facultyAssignments)
    .where(
      and(
        eq(facultyAssignments.facultyId, facultyProfile.id),
        eq(facultyAssignments.sectionId, sectionId)
      )
    )
    .limit(1);

  if (!assignment) {
    return NextResponse.json(
      { error: "You are not assigned to this section" },
      { status: 403 }
    );
  }

  // Fetch enrolled students (status = 'registered') with any existing attendance record for
  // this date via a LEFT JOIN so absent-but-not-yet-recorded students still appear.
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      rollNumber: students.rollNumber,
      studentName: users.fullName,
      attendanceStatus: attendanceRecords.status,
      attendanceRecordId: attendanceRecords.id,
    })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(
      attendanceRecords,
      and(
        eq(attendanceRecords.enrollmentId, enrollments.id),
        eq(attendanceRecords.sessionDate, date)
      )
    )
    .where(
      and(eq(enrollments.sectionId, sectionId), eq(enrollments.status, "registered"))
    )
    .orderBy(students.rollNumber);

  return NextResponse.json({
    date,
    sectionId,
    students: rows.map((r) => ({
      enrollmentId: r.enrollmentId,
      rollNumber: r.rollNumber,
      studentName: r.studentName,
      attendanceStatus: r.attendanceStatus ?? null,
      attendanceRecordId: r.attendanceRecordId ?? null,
    })),
  });
}
