import { pgTable, uuid, varchar, numeric, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { idColumn, timestamps } from "./_helpers";
import { markStatusEnum, gradingStrategyEnum } from "./enums";
import { courseOfferings, programs } from "./academic";
import { enrollments } from "./enrollment";
import { users } from "./identity";

/**
 * MODULE: Examination & Result Management (part 1: configurable assessment engine)
 * GradingPolicy/AssessmentTemplate are configuration, never hard-coded rules (Master Plan §18).
 */

export const gradingPolicies = pgTable(
  "grading_policies",
  {
    id: idColumn(),
    name: varchar("name", { length: 255 }).notNull(),
    programId: uuid("program_id").references(() => programs.id, { onDelete: "set null" }),
    strategyType: gradingStrategyEnum("strategy_type").notNull().default("absolute"),
    passingPct: numeric("passing_pct", { precision: 5, scale: 2 }).notNull(),
    graceMarksMax: numeric("grace_marks_max", { precision: 5, scale: 2 }).notNull().default("0"),
    ...timestamps,
  }
);

/** Value object rows owned by a GradingPolicy — grade letter boundaries. */
export const gradeBands = pgTable(
  "grade_bands",
  {
    id: idColumn(),
    gradingPolicyId: uuid("grading_policy_id")
      .notNull()
      .references(() => gradingPolicies.id, { onDelete: "cascade" }),
    letter: varchar("letter", { length: 5 }).notNull(), // e.g. "A+", "B"
    gradePoint: numeric("grade_point", { precision: 3, scale: 2 }).notNull(), // e.g. 4.00
    minPct: numeric("min_pct", { precision: 5, scale: 2 }).notNull(),
    maxPct: numeric("max_pct", { precision: 5, scale: 2 }).notNull(),
  },
  (table) => [index("grade_bands_policy_idx").on(table.gradingPolicyId)]
);

/** Defines the graded components (weightages) for a specific Course Offering. */
export const assessmentTemplates = pgTable(
  "assessment_templates",
  {
    id: idColumn(),
    courseOfferingId: uuid("course_offering_id")
      .notNull()
      .references(() => courseOfferings.id, { onDelete: "cascade" }),
    gradingPolicyId: uuid("grading_policy_id")
      .notNull()
      .references(() => gradingPolicies.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [uniqueIndex("assessment_templates_offering_unique").on(table.courseOfferingId)]
);

/** Value object rows owned by an AssessmentTemplate — named components (Assignment, Midterm, ...). */
export const assessmentComponents = pgTable(
  "assessment_components",
  {
    id: idColumn(),
    assessmentTemplateId: uuid("assessment_template_id")
      .notNull()
      .references(() => assessmentTemplates.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // "Assignment 1", "Midterm", "Final Exam"
    maxMarks: numeric("max_marks", { precision: 6, scale: 2 }).notNull(),
    weightagePct: numeric("weightage_pct", { precision: 5, scale: 2 }).notNull(),
    ...timestamps,
  },
  (table) => [index("assessment_components_template_idx").on(table.assessmentTemplateId)]
  // BR-01 ("weightages must sum to 100%") is enforced at the application/service layer on
  // template save, not via a DB constraint (requires summing sibling rows).
);

/**
 * A student's mark for one AssessmentComponent. Append/version pattern (Master Plan §13):
 * never overwritten in place once Submitted — corrections create a new row referencing the prior
 * via `supersedesMarkId`. The "current" value is the latest non-superseded row per (enrollment, component).
 */
export const assessmentMarks = pgTable(
  "assessment_marks",
  {
    id: idColumn(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    assessmentComponentId: uuid("assessment_component_id")
      .notNull()
      .references(() => assessmentComponents.id, { onDelete: "cascade" }),
    marksObtained: numeric("marks_obtained", { precision: 6, scale: 2 }).notNull(),
    status: markStatusEnum("status").notNull().default("draft"),
    version: numeric("version", { precision: 4, scale: 0 }).notNull().default("1"),
    supersedesMarkId: uuid("supersedes_mark_id"),
    enteredByUserId: uuid("entered_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id, { onDelete: "set null" }),
    rejectionReason: varchar("rejection_reason", { length: 500 }),
    ...timestamps,
  },
  (table) => [
    index("assessment_marks_enrollment_idx").on(table.enrollmentId),
    index("assessment_marks_component_idx").on(table.assessmentComponentId),
  ]
);

export const gradingPoliciesRelations = relations(gradingPolicies, ({ many }) => ({
  gradeBands: many(gradeBands),
}));

export const assessmentTemplatesRelations = relations(assessmentTemplates, ({ one, many }) => ({
  courseOffering: one(courseOfferings, {
    fields: [assessmentTemplates.courseOfferingId],
    references: [courseOfferings.id],
  }),
  gradingPolicy: one(gradingPolicies, {
    fields: [assessmentTemplates.gradingPolicyId],
    references: [gradingPolicies.id],
  }),
  components: many(assessmentComponents),
}));

export const assessmentMarksRelations = relations(assessmentMarks, ({ one }) => ({
  enrollment: one(enrollments, { fields: [assessmentMarks.enrollmentId], references: [enrollments.id] }),
  component: one(assessmentComponents, {
    fields: [assessmentMarks.assessmentComponentId],
    references: [assessmentComponents.id],
  }),
}));
