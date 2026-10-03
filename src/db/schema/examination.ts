import { pgTable, uuid, date, varchar, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { idColumn, timestamps } from "./_helpers";
import { examinationTypeEnum, resultStatusEnum, revaluationStatusEnum } from "./enums";
import { courseOfferings } from "./academic";
import { enrollments } from "./enrollment";
import { gradeBands } from "./assessment";
import { users } from "./identity";

/**
 * MODULE: Examination & Result Management (part 2: examinations, results, revaluation)
 */

export const examinations = pgTable(
  "examinations",
  {
    id: idColumn(),
    courseOfferingId: uuid("course_offering_id")
      .notNull()
      .references(() => courseOfferings.id, { onDelete: "cascade" }),
    type: examinationTypeEnum("type").notNull(),
    examDate: date("exam_date").notNull(),
    ...timestamps,
  },
  (table) => [index("examinations_offering_idx").on(table.courseOfferingId)]
);

/**
 * The aggregated, computed outcome for an Enrollment. Append/version pattern — NEVER updated
 * in place once status = 'published' (Master Plan §19, SRS FR-RES-03/06, BR-06). A correction
 * creates a new row with version+1, `supersedesResultId` pointing to the prior row, which is
 * then marked 'superseded'. The "current" result per enrollment is the latest non-superseded row.
 */
export const results = pgTable(
  "results",
  {
    id: idColumn(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "restrict" }),
    finalScorePct: numeric("final_score_pct", { precision: 5, scale: 2 }).notNull(),
    gradeBandId: uuid("grade_band_id")
      .notNull()
      .references(() => gradeBands.id, { onDelete: "restrict" }),
    status: resultStatusEnum("status").notNull().default("pending_approval"),
    version: numeric("version", { precision: 4, scale: 0 }).notNull().default("1"),
    supersedesResultId: uuid("supersedes_result_id"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    correctionReason: varchar("correction_reason", { length: 1000 }),
    ...timestamps,
  },
  (table) => [index("results_enrollment_idx").on(table.enrollmentId)]
);

/** A student-initiated request to re-evaluate a Published Result. */
export const revaluationRequests = pgTable(
  "revaluation_requests",
  {
    id: idColumn(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => results.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: varchar("reason", { length: 1000 }).notNull(),
    status: revaluationStatusEnum("status").notNull().default("requested"),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, { onDelete: "set null" }),
    decisionNote: varchar("decision_note", { length: 1000 }),
    ...timestamps,
  },
  (table) => [index("revaluation_result_idx").on(table.resultId)]
);

export const resultsRelations = relations(results, ({ one, many }) => ({
  enrollment: one(enrollments, { fields: [results.enrollmentId], references: [enrollments.id] }),
  gradeBand: one(gradeBands, { fields: [results.gradeBandId], references: [gradeBands.id] }),
  revaluationRequests: many(revaluationRequests),
}));
