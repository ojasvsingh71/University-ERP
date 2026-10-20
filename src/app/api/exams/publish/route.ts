import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { results, enrollments, sections } from "@/db/schema";
import { requirePermission, ForbiddenError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const publishSchema = z.object({
  courseOfferingId: z.string().uuid().optional(),
  resultIds: z.array(z.string().uuid()).optional(),
  sectionId: z.string().uuid().optional(),
}).refine(
  (data) => Boolean(data.courseOfferingId || data.resultIds?.length || data.sectionId),
  { message: "At least one of courseOfferingId, resultIds, or sectionId must be provided" }
);

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requirePermission(session, "publish_results");
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

    const parsed = publishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

  const { courseOfferingId, resultIds, sectionId } = parsed.data;

  // Find all results to publish
  let targetResultIds: string[] = [];

  if (resultIds && resultIds.length > 0) {
    targetResultIds = resultIds;
  } else if (courseOfferingId) {
    const offeringResults = await db
      .select({ id: results.id })
      .from(results)
      .innerJoin(enrollments, eq(results.enrollmentId, enrollments.id))
      .innerJoin(sections, eq(enrollments.sectionId, sections.id))
      .where(
        and(
          eq(sections.courseOfferingId, courseOfferingId),
          inArray(results.status, ["pending_approval", "approved"])
        )
      );
    targetResultIds = offeringResults.map((r) => r.id);
  } else if (sectionId) {
    const sectionResults = await db
      .select({ id: results.id })
      .from(results)
      .innerJoin(enrollments, eq(results.enrollmentId, enrollments.id))
      .where(
        and(
          eq(enrollments.sectionId, sectionId),
          inArray(results.status, ["pending_approval", "approved"])
        )
      );
    targetResultIds = sectionResults.map((r) => r.id);
  }

  if (targetResultIds.length === 0) {
    return NextResponse.json(
      { error: "No pending results found to publish for the given criteria" },
      { status: 404 }
    );
  }

  // Fetch target rows to verify immutability
  const targetRows = await db
    .select()
    .from(results)
    .where(inArray(results.id, targetResultIds));

  // Check for any rows that are already published or superseded
  const alreadyLocked = targetRows.filter(
    (r) => r.status === "published" || r.status === "superseded"
  );

  // If specific resultIds were provided and any is already published/superseded, reject (BR-06 immutability)
  if (resultIds && alreadyLocked.length > 0) {
    return NextResponse.json(
      {
        error: "Some results are already published or superseded and cannot be republished directly",
        alreadyLockedIds: alreadyLocked.map((r) => r.id),
      },
      { status: 409 }
    );
  }

  const publishableIds = targetRows
    .filter((r) => r.status === "pending_approval" || r.status === "approved")
    .map((r) => r.id);

  if (publishableIds.length === 0) {
    return NextResponse.json(
      { message: "All matching results are already published", count: 0 },
      { status: 200 }
    );
  }

  const publishedAtDate = new Date();
  const updatedRows = await db
    .update(results)
    .set({
      status: "published",
      publishedAt: publishedAtDate,
      approvedByUserId: session.user.id,
    })
    .where(inArray(results.id, publishableIds))
    .returning();

  for (const row of updatedRows) {
    await recordAudit({
      actorUserId: session.user.id,
      action: "ResultPublished",
      resourceType: "Result",
      resourceId: row.id,
      previousValue: { status: "pending_approval" },
      newValue: { status: "published", publishedAt: publishedAtDate },
    });
  }

  return NextResponse.json({
    message: `Successfully published and locked ${updatedRows.length} result(s)`,
    publishedCount: updatedRows.length,
    results: updatedRows,
  });
  } catch (error) {
    console.error("Error in POST /api/exams/publish:", error);
    const message = error instanceof Error ? error.message : "Failed to publish results";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
