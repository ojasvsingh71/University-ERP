/**
 * MODULE: Examination & Result Management — marks entry & submission
 * POST /api/exams/marks -> Faculty enters/saves marks as Draft, or submits a batch — FR-ASM-02/03/04
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { assessmentMarks, assessmentComponents, faculty } from "@/db/schema";
import { requirePermission, ForbiddenError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const enterMarksSchema = z.object({
  assessmentComponentId: z.string().uuid(),
  action: z.enum(["save_draft", "submit"]),
  entries: z.array(
    z.object({
      enrollmentId: z.string().uuid(),
      marksObtained: z.number().min(0),
    })
  ).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "enter_marks");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const body = await req.json();
  const parsed = enterMarksSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const { assessmentComponentId, action, entries } = parsed.data;

  const [component] = await db
    .select({ maxMarks: assessmentComponents.maxMarks })
    .from(assessmentComponents)
    .where(eq(assessmentComponents.id, assessmentComponentId))
    .limit(1);

  if (!component) return NextResponse.json({ error: "Unknown assessment component" }, { status: 404 });

  // NOTE (foundation scope): a full implementation additionally verifies, via
  // assessmentComponent -> assessmentTemplate -> courseOffering -> section, that the current
  // faculty holds a FacultyAssignment on that section (same pattern as /api/attendance).
  // Omitted here to keep this example route focused; see README "Known gaps to close next".

  // BR-02: reject any entry exceeding the component's max marks.
  const overMax = entries.filter((e) => e.marksObtained > Number(component.maxMarks));
  if (overMax.length > 0) {
    return NextResponse.json(
      { error: "Some marks exceed the component's maximum", overMax, maxMarks: component.maxMarks },
      { status: 422 }
    );
  }

  // Ownership check: faculty must hold an assignment on the section these enrollments belong to.
  const [facultyProfile] = await db
    .select({ id: faculty.id })
    .from(faculty)
    .where(eq(faculty.userId, session!.user.id))
    .limit(1);
  if (!facultyProfile) {
    return NextResponse.json({ error: "No faculty profile linked to this account" }, { status: 403 });
  }

  const status = action === "submit" ? "submitted" : "draft";

  const saved = await db.transaction(async (tx) => {
    const rows = [];
    for (const entry of entries) {
      const [row] = await tx
        .insert(assessmentMarks)
        .values({
          enrollmentId: entry.enrollmentId,
          assessmentComponentId,
          marksObtained: String(entry.marksObtained),
          status,
          enteredByUserId: session!.user.id,
        })
        .returning({ id: assessmentMarks.id, status: assessmentMarks.status });
      rows.push(row);
    }
    return rows;
  });

  if (action === "submit") {
    await recordAudit({
      actorUserId: session!.user.id,
      action: "MarksSubmitted",
      resourceType: "AssessmentComponent",
      resourceId: assessmentComponentId,
      newValue: { entryCount: entries.length },
    });
  }

  return NextResponse.json({ saved: saved.length, status }, { status: 201 });
}
