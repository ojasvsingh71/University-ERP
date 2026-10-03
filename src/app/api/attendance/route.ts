/**
 * MODULE: Attendance Management
 * POST /api/attendance -> record attendance for a session (Faculty, own-section only) — FR-ATT-01
 * Ownership scoping: the faculty member must hold an active FacultyAssignment on the target
 * section (Master Plan §6.2 — RBAC alone cannot express this, so it's checked explicitly here).
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { attendanceRecords, enrollments, facultyAssignments, faculty } from "@/db/schema";
import { requirePermission, ForbiddenError } from "@/lib/rbac";

const submitAttendanceSchema = z.object({
  sectionId: z.string().uuid(),
  sessionDate: z.string().date(), // "YYYY-MM-DD"
  records: z.array(
    z.object({
      enrollmentId: z.string().uuid(),
      status: z.enum(["present", "absent", "excused"]),
    })
  ).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "record_attendance");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const body = await req.json();
  const parsed = submitAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { sectionId, sessionDate, records } = parsed.data;

  // Ownership check: does this faculty user hold an active assignment on this section?
  const [facultyProfile] = await db
    .select({ id: faculty.id })
    .from(faculty)
    .where(eq(faculty.userId, session!.user.id))
    .limit(1);

  if (!facultyProfile) {
    return NextResponse.json({ error: "No faculty profile linked to this account" }, { status: 403 });
  }

  const [assignment] = await db
    .select({ id: facultyAssignments.id })
    .from(facultyAssignments)
    .where(
      and(eq(facultyAssignments.facultyId, facultyProfile.id), eq(facultyAssignments.sectionId, sectionId))
    )
    .limit(1);

  if (!assignment) {
    return NextResponse.json(
      { error: "You are not assigned to this section" },
      { status: 403 }
    );
  }

  // Validate every enrollmentId actually belongs to this section before writing anything.
  const enrollmentIds = records.map((r) => r.enrollmentId);
  const validEnrollments = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.sectionId, sectionId), inArray(enrollments.id, enrollmentIds)));

  const validIds = new Set(validEnrollments.map((e) => e.id));
  const invalid = enrollmentIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "Some enrollmentIds do not belong to this section", invalid },
      { status: 422 }
    );
  }

  // Upsert per row (not a single bulk statement) because each row's conflict-update `status`
  // value differs — Drizzle's bulk onConflictDoUpdate applies one `set` clause to every row.
  // Wrapped in a transaction so a partial failure doesn't leave the session half-recorded.
  const saved = await db.transaction(async (tx) => {
    const results = [];
    for (const r of records) {
      const [row] = await tx
        .insert(attendanceRecords)
        .values({
          enrollmentId: r.enrollmentId,
          sessionDate,
          status: r.status,
          recordedByUserId: session!.user.id,
        })
        .onConflictDoUpdate({
          target: [attendanceRecords.enrollmentId, attendanceRecords.sessionDate],
          set: { status: r.status, recordedByUserId: session!.user.id },
        })
        .returning({ id: attendanceRecords.id });
      results.push(row);
    }
    return results;
  });

  return NextResponse.json({ saved: saved.length }, { status: 201 });
}
