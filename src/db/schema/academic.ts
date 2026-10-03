import { pgTable, varchar, integer, uuid, date, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { idColumn, timestamps, softDelete } from "./_helpers";
import { sectionStatusEnum } from "./enums";

/**
 * MODULE: Shared Academic Structure
 * Reference/master data underpinning all four modules. Department -> Program -> Batch,
 * AcademicYear -> Semester, Course -> CourseOffering -> Section.
 */

export const departments = pgTable(
  "departments",
  {
    id: idColumn(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 20 }).notNull(),
    ...timestamps,
    ...softDelete,
  },
  (table) => [uniqueIndex("departments_code_unique").on(table.code)]
);

export const programs = pgTable(
  "programs",
  {
    id: idColumn(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 20 }).notNull(),
    durationYears: integer("duration_years").notNull(),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex("programs_code_unique").on(table.code),
    index("programs_department_idx").on(table.departmentId),
  ]
);

export const batches = pgTable(
  "batches",
  {
    id: idColumn(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "restrict" }),
    admissionYear: integer("admission_year").notNull(),
    label: varchar("label", { length: 50 }).notNull(), // e.g. "CS-2026"
    ...timestamps,
  },
  (table) => [index("batches_program_idx").on(table.programId)]
);

export const academicYears = pgTable(
  "academic_years",
  {
    id: idColumn(),
    label: varchar("label", { length: 20 }).notNull(), // e.g. "2026-2027"
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("academic_years_label_unique").on(table.label)]
);

export const semesters = pgTable(
  "semesters",
  {
    id: idColumn(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    label: varchar("label", { length: 50 }).notNull(), // e.g. "Fall 2026"
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    ...timestamps,
  },
  (table) => [index("semesters_year_idx").on(table.academicYearId)]
);

export const courses = pgTable(
  "courses",
  {
    id: idColumn(),
    code: varchar("code", { length: 20 }).notNull(), // e.g. "CS301"
    title: varchar("title", { length: 255 }).notNull(),
    credits: integer("credits").notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [uniqueIndex("courses_code_unique").on(table.code)]
);

/** A course's prerequisites — self-referencing many-to-many. */
export const coursePrerequisites = pgTable(
  "course_prerequisites",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    prerequisiteCourseId: uuid("prerequisite_course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("course_prereq_unique").on(table.courseId, table.prerequisiteCourseId)]
);

/** A specific instance of a Course taught in a given Program + Semester. */
export const courseOfferings = pgTable(
  "course_offerings",
  {
    id: idColumn(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "restrict" }),
    semesterId: uuid("semester_id")
      .notNull()
      .references(() => semesters.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("course_offerings_unique").on(table.courseId, table.programId, table.semesterId),
    index("course_offerings_semester_idx").on(table.semesterId),
  ]
);

/** A specific class group within a Course Offering. */
export const sections = pgTable(
  "sections",
  {
    id: idColumn(),
    courseOfferingId: uuid("course_offering_id")
      .notNull()
      .references(() => courseOfferings.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 20 }).notNull(), // e.g. "A", "B"
    capacity: integer("capacity").notNull(),
    status: sectionStatusEnum("status").notNull().default("open"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sections_offering_label_unique").on(table.courseOfferingId, table.label),
  ]
);

export const departmentsRelations = relations(departments, ({ many }) => ({
  programs: many(programs),
  courses: many(courses),
}));

export const programsRelations = relations(programs, ({ one, many }) => ({
  department: one(departments, { fields: [programs.departmentId], references: [departments.id] }),
  batches: many(batches),
  courseOfferings: many(courseOfferings),
}));

export const courseOfferingsRelations = relations(courseOfferings, ({ one, many }) => ({
  course: one(courses, { fields: [courseOfferings.courseId], references: [courses.id] }),
  program: one(programs, { fields: [courseOfferings.programId], references: [programs.id] }),
  semester: one(semesters, { fields: [courseOfferings.semesterId], references: [semesters.id] }),
  sections: many(sections),
}));

export const sectionsRelations = relations(sections, ({ one }) => ({
  courseOffering: one(courseOfferings, {
    fields: [sections.courseOfferingId],
    references: [courseOfferings.id],
  }),
}));
