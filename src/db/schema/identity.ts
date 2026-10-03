import { pgTable, varchar, integer, boolean, uuid, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { idColumn, timestamps } from "./_helpers";
import { roleNameEnum, userStatusEnum } from "./enums";

/**
 * MODULE: User Management (Identity & Access)
 * Every authenticated person in the system — admin, faculty, student, parent, auditor — has one `users` row.
 * Role determines coarse-grained RBAC permissions; fine-grained ownership/department scoping is enforced
 * in the application/service layer (see src/lib/rbac.ts), not in this table.
 */
export const users = pgTable(
  "users",
  {
    id: idColumn(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    role: roleNameEnum("role").notNull(),
    status: userStatusEnum("status").notNull().default("active"),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)]
);

/**
 * Links a Parent/Guardian user to one or more Student profiles they may view (summary-level only).
 * See src/db/schema/people.ts for the `students` table this references.
 */
export const parentLinks = pgTable(
  "parent_links",
  {
    id: idColumn(),
    parentUserId: uuid("parent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull(), // FK added in people.ts to avoid circular import; enforced at app layer + migration
    ...timestamps,
  },
  (table) => [
    uniqueIndex("parent_links_unique").on(table.parentUserId, table.studentId),
    index("parent_links_student_idx").on(table.studentId),
  ]
);

/** Append-only password-reset tokens (single-use, time-limited). */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: idColumn(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  ...timestamps,
});

export const usersRelations = relations(users, ({ many }) => ({
  parentLinks: many(parentLinks),
}));
