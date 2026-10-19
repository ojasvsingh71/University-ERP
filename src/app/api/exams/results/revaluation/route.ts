import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  revaluationRequests,
  results,
  enrollments,
  students,
  courses,
  courseOfferings,
  sections,
  users,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";

const studentRequestSchema = z.object({
  resultId: z.string().uuid(),
  reason: z.string().min(5).max(1000),
});

const decisionSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["approved", "rejected"]),
  decisionNote: z.string().max(1000).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const isStudent = role === "student";

  try {
    const query = db
      .select({
        id: revaluationRequests.id,
        resultId: revaluationRequests.resultId,
        reason: revaluationRequests.reason,
        status: revaluationRequests.status,
        decisionNote: revaluationRequests.decisionNote,
        createdAt: revaluationRequests.createdAt,
        finalScorePct: results.finalScorePct,
        resultStatus: results.status,
        courseCode: courses.code,
        courseTitle: courses.title,
        studentRollNumber: students.rollNumber,
        studentName: users.fullName,
        studentEmail: users.email,
      })
      .from(revaluationRequests)
      .innerJoin(results, eq(revaluationRequests.resultId, results.id))
      .innerJoin(enrollments, eq(results.enrollmentId, enrollments.id))
      .innerJoin(sections, eq(enrollments.sectionId, sections.id))
      .innerJoin(courseOfferings, eq(sections.courseOfferingId, courseOfferings.id))
      .innerJoin(courses, eq(courseOfferings.courseId, courses.id))
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .orderBy(desc(revaluationRequests.createdAt));

    const rows = isStudent
      ? await query.where(eq(revaluationRequests.requestedByUserId, session.user.id))
      : await query;

    return NextResponse.json({ requests: rows });
  } catch (error) {
    console.error("Error fetching revaluation requests:", error);
    return NextResponse.json({ error: "Failed to fetch revaluation requests" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const body = await req.json();

  if (role === "student") {
    const parsed = studentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { resultId, reason } = parsed.data;

    // Verify result is published and belongs to this student
    const [targetResult] = await db
      .select({
        id: results.id,
        status: results.status,
        studentUserId: students.userId,
      })
      .from(results)
      .innerJoin(enrollments, eq(results.enrollmentId, enrollments.id))
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(eq(results.id, resultId))
      .limit(1);

    if (!targetResult) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    let isOwner = targetResult.studentUserId === session.user.id;
    if (!isOwner && session.user.email) {
      const [matchedUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, session.user.email.toLowerCase().trim()))
        .limit(1);
      if (matchedUser && matchedUser.id === targetResult.studentUserId) {
        isOwner = true;
      }
    }

    if (!isOwner) {
      return NextResponse.json({ error: "You can only request revaluation for your own results" }, { status: 403 });
    }

    if (targetResult.status !== "published") {
      return NextResponse.json({ error: "Revaluation can only be requested on published results" }, { status: 400 });
    }

    const [created] = await db
      .insert(revaluationRequests)
      .values({
        resultId,
        requestedByUserId: session.user.id,
        reason,
        status: "requested",
      })
      .returning();

    await recordAudit({
      actorUserId: session.user.id,
      action: "RevaluationRequested",
      resourceType: "RevaluationRequest",
      resourceId: created.id,
      newValue: { resultId, reason },
    });

    return NextResponse.json({ request: created }, { status: 201 });
  } else if (["examination_controller", "hod", "super_admin", "university_admin"].includes(role)) {
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { requestId, action, decisionNote } = parsed.data;

    const [updated] = await db
      .update(revaluationRequests)
      .set({
        status: action,
        decidedByUserId: session.user.id,
        decisionNote: decisionNote ?? null,
      })
      .where(eq(revaluationRequests.id, requestId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Revaluation request not found" }, { status: 404 });
    }

    await recordAudit({
      actorUserId: session.user.id,
      action: action === "approved" ? "RevaluationApproved" : "RevaluationRejected",
      resourceType: "RevaluationRequest",
      resourceId: updated.id,
      newValue: { status: action, decisionNote },
    });

    return NextResponse.json({ request: updated });
  } else {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }
}
