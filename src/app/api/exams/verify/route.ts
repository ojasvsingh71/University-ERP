import { NextRequest, NextResponse } from "next/server";
import { eq, inArray, and, desc } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  assessmentMarks,
  assessmentComponents,
  assessmentTemplates,
  courseOfferings,
  courses,
  sections,
  enrollments,
  students,
  users,
} from "@/db/schema";
import { requirePermission, ForbiddenError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const verifyMarksSchema = z
  .object({
    markIds: z.array(z.string().uuid()).min(1),
    action: z.enum(["verify", "reject"]),
    rejectionReason: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.action === "reject" && (!data.rejectionReason || data.rejectionReason.trim().length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: "A rejection reason is required when rejecting marks",
      path: ["rejectionReason"],
    }
  );

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session, "verify_marks");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") ?? "submitted";
  const courseOfferingId = searchParams.get("courseOfferingId");

  try {
    const conditions = [];
    if (statusParam && statusParam !== "all") {
      conditions.push(eq(assessmentMarks.status, statusParam as "submitted" | "verified" | "rejected" | "draft"));
    }
    if (courseOfferingId) {
      conditions.push(eq(courseOfferings.id, courseOfferingId));
    }

    const query = db
      .select({
        markId: assessmentMarks.id,
        marksObtained: assessmentMarks.marksObtained,
        status: assessmentMarks.status,
        version: assessmentMarks.version,
        supersedesMarkId: assessmentMarks.supersedesMarkId,
        rejectionReason: assessmentMarks.rejectionReason,
        createdAt: assessmentMarks.createdAt,
        componentId: assessmentComponents.id,
        componentName: assessmentComponents.name,
        maxMarks: assessmentComponents.maxMarks,
        weightagePct: assessmentComponents.weightagePct,
        courseCode: courses.code,
        courseTitle: courses.title,
        sectionLabel: sections.label,
        studentRollNumber: students.rollNumber,
        studentName: users.fullName,
        studentEmail: users.email,
        enteredByUserId: assessmentMarks.enteredByUserId,
        verifiedByUserId: assessmentMarks.verifiedByUserId,
      })
      .from(assessmentMarks)
      .innerJoin(assessmentComponents, eq(assessmentMarks.assessmentComponentId, assessmentComponents.id))
      .innerJoin(assessmentTemplates, eq(assessmentComponents.assessmentTemplateId, assessmentTemplates.id))
      .innerJoin(courseOfferings, eq(assessmentTemplates.courseOfferingId, courseOfferings.id))
      .innerJoin(courses, eq(courseOfferings.courseId, courses.id))
      .innerJoin(enrollments, eq(assessmentMarks.enrollmentId, enrollments.id))
      .innerJoin(sections, eq(enrollments.sectionId, sections.id))
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .orderBy(desc(assessmentMarks.createdAt));

    const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

    return NextResponse.json({ marks: rows });
  } catch (error) {
    console.error("Error fetching marks for verification:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch marks for verification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requirePermission(session, "verify_marks");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parsed = verifyMarksSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { markIds, action, rejectionReason } = parsed.data;

    // Retrieve marks to verify
    const targetMarks = await db
      .select()
      .from(assessmentMarks)
      .where(inArray(assessmentMarks.id, markIds));

    if (targetMarks.length === 0) {
      return NextResponse.json({ error: "No marks found matching provided IDs" }, { status: 404 });
    }

    const newStatus = action === "verify" ? "verified" : "rejected";
    const reasonToSet = action === "reject" ? (rejectionReason ?? "Rejected by reviewer") : null;

    const updatedRows = await db
      .update(assessmentMarks)
      .set({
        status: newStatus,
        verifiedByUserId: session.user.id,
        rejectionReason: reasonToSet,
      })
      .where(inArray(assessmentMarks.id, markIds))
      .returning();

    for (const mark of updatedRows) {
      try {
        await recordAudit({
          actorUserId: session.user.id,
          action: action === "verify" ? "MarksVerified" : "MarksRejected",
          resourceType: "AssessmentMark",
          resourceId: mark.id,
          newValue: {
            status: newStatus,
            verifiedByUserId: session.user.id,
            rejectionReason: reasonToSet,
          },
        });
      } catch (auditErr) {
        console.warn("Audit log notice (ignored):", auditErr);
      }
    }

    return NextResponse.json({
      message: `Successfully ${action === "verify" ? "verified" : "rejected"} ${updatedRows.length} mark(s)`,
      count: updatedRows.length,
      status: newStatus,
    });
  } catch (error) {
    console.error("Error in POST /api/exams/verify:", error);
    const message = error instanceof Error ? error.message : "Failed to verify marks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
