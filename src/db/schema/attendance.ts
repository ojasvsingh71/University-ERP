import { pgTable, uuid, date, uniqueIndex, index, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { idColumn, timestamps } from "./_helpers";
import { attendanceStatusEnum } from "./enums";
import { enrollments } from "./enrollment";
import { users } from "./identity";

/**
 * MODULE: Attendance Management
 * One row per enrolled student per class session. Recorded only by the Faculty holding an
 * active FacultyAssignment on the Section (enforced at the service/API layer, not here).
 */
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: idColumn(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    sessionDate: date("session_date").notNull(),
    status: attendanceStatusEnum("status").notNull(),
    recordedByUserId: uuid("recorded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    correctionReason: varchar("correction_reason", { length: 500 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("attendance_enrollment_session_unique").on(table.enrollmentId, table.sessionDate),
    index("attendance_enrollment_idx").on(table.enrollmentId),
  ]
);

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  enrollment: one(enrollments, { fields: [attendanceRecords.enrollmentId], references: [enrollments.id] }),
  recordedBy: one(users, { fields: [attendanceRecords.recordedByUserId], references: [users.id] }),
}));
