import { pgTable, uuid, varchar, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { idColumn, timestamps } from "./_helpers";
import { notificationChannelEnum, notificationStatusEnum } from "./enums";
import { users } from "./identity";

/** In-app/email/SMS notification instance, generated from domain events. */
export const notifications = pgTable(
  "notifications",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 100 }).notNull(), // e.g. "ResultPublished", "MarksRejected"
    channel: notificationChannelEnum("channel").notNull().default("in_app"),
    status: notificationStatusEnum("status").notNull().default("queued"),
    title: varchar("title", { length: 255 }).notNull(),
    body: varchar("body", { length: 1000 }).notNull(),
    isRead: boolean("is_read").notNull().default(false),
    ...timestamps,
  },
  (table) => [index("notifications_user_idx").on(table.userId)]
);

/**
 * Append-only audit log. No application code path updates or deletes a row here (FR-AUD-03) —
 * enforced additionally at the DB role/grant level in production (see README "Database hardening").
 */
export const auditLogEntries = pgTable(
  "audit_log_entries",
  {
    id: idColumn(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(), // e.g. "MarksSubmitted", "ResultPublished"
    resourceType: varchar("resource_type", { length: 100 }).notNull(), // e.g. "AssessmentMark", "Result"
    resourceId: uuid("resource_id").notNull(),
    previousValue: jsonb("previous_value"),
    newValue: jsonb("new_value"),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index("audit_log_actor_idx").on(table.actorUserId),
    index("audit_log_resource_idx").on(table.resourceType, table.resourceId),
  ]
);
