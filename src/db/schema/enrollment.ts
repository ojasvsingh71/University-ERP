import { pgTable, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { idColumn, timestamps } from "./_helpers";
import { enrollmentStatusEnum } from "./enums";
import { students } from "./people";
import { sections } from "./academic";

/**
 * A Student's registration into a Section for a term — the aggregate root anchoring
 * attendance (attendance.ts) and assessment (assessment.ts) for that student in that course.
 */
export const enrollments = pgTable(
  "enrollments",
  {
    id: idColumn(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "restrict" }),
    status: enrollmentStatusEnum("status").notNull().default("registered"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("enrollments_student_section_unique").on(table.studentId, table.sectionId),
    index("enrollments_section_idx").on(table.sectionId),
    index("enrollments_student_idx").on(table.studentId),
  ]
);

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(students, { fields: [enrollments.studentId], references: [students.id] }),
  section: one(sections, { fields: [enrollments.sectionId], references: [sections.id] }),
}));
