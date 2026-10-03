/**
 * MODULE: Examination & Result Management — result publication
 * POST /api/exams/results/:resultId/publish
 * Examination Controller only — FR-RES-02/03. Once Published, a Result row is NEVER updated
 * again by any code path in this codebase; see /api/exams/results/[resultId]/correct for the
 * only legitimate way to change a published outcome (new versioned row, old row -> superseded).
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { results } from "@/db/schema";
import { requirePermission, ForbiddenError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ resultId: string }> }
) {
  const session = await auth();
  try {
    requirePermission(session, "publish_results");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const { resultId } = await params;

  const [existing] = await db.select().from(results).where(eq(results.id, resultId)).limit(1);
  if (!existing) return NextResponse.json({ error: "Result not found" }, { status: 404 });

  if (existing.status === "published" || existing.status === "superseded") {
    // BR-06 / FR-RES-03: immutability is enforced here, not just assumed by the UI.
    return NextResponse.json(
      { error: `Result is already '${existing.status}' and cannot be re-published directly` },
      { status: 409 }
    );
  }

  const [updated] = await db
    .update(results)
    .set({ status: "published", publishedAt: new Date(), approvedByUserId: session!.user.id })
    .where(eq(results.id, resultId))
    .returning();

  await recordAudit({
    actorUserId: session!.user.id,
    action: "ResultPublished",
    resourceType: "Result",
    resourceId: resultId,
    previousValue: { status: existing.status },
    newValue: { status: updated.status, publishedAt: updated.publishedAt },
  });

  // In a full build: emit a ResultPublished domain event here, consumed by the
  // Notifications module to notify the student in-app (FR-NOTIF-01).

  return NextResponse.json({ result: updated });
}
