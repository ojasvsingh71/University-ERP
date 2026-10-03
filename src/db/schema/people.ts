import { pgTable, varchar, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { idColumn, timestamps, softDelete } from "./_helpers";
import { users } from "./identity";
import { departments, batches, sections } from "./academic";

/**
 * MODULE: User Management (academic-person profiles)
 * Student/Faculty are distinct from `users` (login identity) by design — see Class Diagram §4.3.
 * A `users` row with role=student/faculty is linked 0..1 here via userId.
 */

export const students = pgTable(
  "students",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    rollNumber: varchar("roll_number", { length: 50 }).notNull(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 30 }).notNull().default("active"), // active | graduated | suspended | withdrawn
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex("students_roll_number_unique").on(table.rollNumber),
    uniqueIndex("students_user_unique").on(table.userId),
    index("students_batch_idx").on(table.batchId),
  ]
);

export const faculty = pgTable(
  "faculty",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    employeeCode: varchar("employee_code", { length: 50 }).notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex("faculty_employee_code_unique").on(table.employeeCode),
    uniqueIndex("faculty_user_unique").on(table.userId),
    index("faculty_department_idx").on(table.departmentId),
  ]
);

/** Association class: links a Faculty member to a Section with a teaching role. */
export const facultyAssignments = pgTable(
  "faculty_assignments",
  {
    id: idColumn(),
    facultyId: uuid("faculty_id")
      .notNull()
      .references(() => faculty.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    assignmentRole: varchar("assignment_role", { length: 20 }).notNull().default("primary"), // primary | co_faculty | ta
    ...timestamps,
  },
  (table) => [
    uniqueIndex("faculty_assignments_unique").on(table.facultyId, table.sectionId, table.assignmentRole),
    index("faculty_assignments_section_idx").on(table.sectionId),
  ]
);

export const studentsRelations = relations(students, ({ one }) => ({
  user: one(users, { fields: [students.userId], references: [users.id] }),
  batch: one(batches, { fields: [students.batchId], references: [batches.id] }),
}));

export const facultyRelations = relations(faculty, ({ one, many }) => ({
  user: one(users, { fields: [faculty.userId], references: [users.id] }),
  department: one(departments, { fields: [faculty.departmentId], references: [departments.id] }),
  assignments: many(facultyAssignments),
}));

export const facultyAssignmentsRelations = relations(facultyAssignments, ({ one }) => ({
  faculty: one(faculty, { fields: [facultyAssignments.facultyId], references: [faculty.id] }),
  section: one(sections, { fields: [facultyAssignments.sectionId], references: [sections.id] }),
}));
