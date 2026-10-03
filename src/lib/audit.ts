/**
 * Writes an append-only audit log entry. Called from every sensitive mutation (marks, results,
 * fees, role changes) per SRS FR-AUD-01/02. There is deliberately no `updateAuditLog` or
 * `deleteAuditLog` function anywhere in this codebase (FR-AUD-03).
 */
import { db } from "@/db";
import { auditLogEntries } from "@/db/schema";

export async function recordAudit(params: {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}) {
  await db.insert(auditLogEntries).values({
    actorUserId: params.actorUserId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    previousValue: params.previousValue ?? null,
    newValue: params.newValue ?? null,
    ipAddress: params.ipAddress ?? null,
  });
}
