import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { examinations, courseOfferings, courses, semesters, programs } from "@/db/schema";
import { requirePermission, ForbiddenError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const createScheduleSchema = z.object({
  courseOfferingId: z.string().uuid(),
  type: z.enum(["midterm", "final", "practical", "viva", "supplementary"]),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const semesterId = searchParams.get("semesterId");
  const courseOfferingId = searchParams.get("courseOfferingId");
  const type = searchParams.get("type");

  try {
    const query = db
      .select({
        id: examinations.id,
        courseOfferingId: examinations.courseOfferingId,
        type: examinations.type,
        examDate: examinations.examDate,
        createdAt: examinations.createdAt,
        courseCode: courses.code,
        courseTitle: courses.title,
        credits: courses.credits,
        semesterLabel: semesters.label,
        programName: programs.name,
        programCode: programs.code,
      })
      .from(examinations)
      .innerJoin(courseOfferings, eq(examinations.courseOfferingId, courseOfferings.id))
      .innerJoin(courses, eq(courseOfferings.courseId, courses.id))
      .innerJoin(semesters, eq(courseOfferings.semesterId, semesters.id))
      .innerJoin(programs, eq(courseOfferings.programId, programs.id))
      .orderBy(desc(examinations.examDate));

    const conditions = [];
    if (semesterId) conditions.push(eq(courseOfferings.semesterId, semesterId));
    if (courseOfferingId) conditions.push(eq(examinations.courseOfferingId, courseOfferingId));
    if (type) conditions.push(eq(examinations.type, type as "midterm" | "final" | "practical" | "viva" | "supplementary"));

    const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

    return NextResponse.json({ examinations: rows });
  } catch (error) {
    console.error("Error fetching examination schedules:", error);
    return NextResponse.json({ error: "Failed to fetch examination schedules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requirePermission(session, "schedule_exams");
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

    const parsed = createScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { courseOfferingId, type, examDate } = parsed.data;

    const [offering] = await db
      .select({ id: courseOfferings.id })
      .from(courseOfferings)
      .where(eq(courseOfferings.id, courseOfferingId))
      .limit(1);

    if (!offering) {
      return NextResponse.json({ error: "Course offering not found" }, { status: 404 });
    }

    const [created] = await db
      .insert(examinations)
      .values({
        courseOfferingId,
        type,
        examDate,
      })
      .returning();

    await recordAudit({
      actorUserId: session.user.id,
      action: "ExaminationScheduled",
      resourceType: "Examination",
      resourceId: created.id,
      newValue: { courseOfferingId, type, examDate },
    });

    return NextResponse.json({ examination: created }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/exams/schedule:", error);
    const message = error instanceof Error ? error.message : "Failed to schedule examination";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
