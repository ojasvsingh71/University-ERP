import { pgTable, uuid, varchar, numeric, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { idColumn, timestamps } from "./_helpers";
import { invoiceStatusEnum, paymentMethodEnum, paymentStatusEnum } from "./enums";
import { programs, semesters } from "./academic";
import { students } from "./people";
import { users } from "./identity";

/**
 * MODULE: Fee & Payment Management
 * FeeStructure defines what a Program/Semester combination costs (configurable, not hard-coded);
 * Invoice is generated per Student per Semester from the applicable structure; Payments are
 * recorded against an Invoice (partial payments supported); Scholarships reduce the payable amount.
 */

export const feeStructures = pgTable(
  "fee_structures",
  {
    id: idColumn(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    semesterId: uuid("semester_id")
      .notNull()
      .references(() => semesters.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(), // e.g. "CS Program - Fall 2026 Tuition"
    ...timestamps,
  },
  (table) => [uniqueIndex("fee_structures_program_semester_unique").on(table.programId, table.semesterId)]
);

/** Line-item components of a fee structure (Tuition, Lab Fee, Library Fee, ...). */
export const feeComponents = pgTable(
  "fee_components",
  {
    id: idColumn(),
    feeStructureId: uuid("fee_structure_id")
      .notNull()
      .references(() => feeStructures.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    ...timestamps,
  },
  (table) => [index("fee_components_structure_idx").on(table.feeStructureId)]
);

/** A scholarship/waiver award that reduces a student's payable amount on an invoice. */
export const scholarships = pgTable(
  "scholarships",
  {
    id: idColumn(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(), // e.g. "Merit Scholarship 50%"
    discountType: varchar("discount_type", { length: 20 }).notNull().default("percentage"), // percentage | fixed_amount
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
    approvedByUserId: uuid("approved_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [index("scholarships_student_idx").on(table.studentId)]
);

/** A billed amount owed by a Student for a Semester, generated from the applicable FeeStructure. */
export const invoices = pgTable(
  "invoices",
  {
    id: idColumn(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    semesterId: uuid("semester_id")
      .notNull()
      .references(() => semesters.id, { onDelete: "restrict" }),
    feeStructureId: uuid("fee_structure_id")
      .notNull()
      .references(() => feeStructures.id, { onDelete: "restrict" }),
    scholarshipId: uuid("scholarship_id").references(() => scholarships.id, { onDelete: "set null" }),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    payableAmount: numeric("payable_amount", { precision: 10, scale: 2 }).notNull(),
    amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),
    status: invoiceStatusEnum("status").notNull().default("issued"),
    dueDate: date("due_date").notNull(),
    ...timestamps,
  },
  (table) => [
    index("invoices_student_idx").on(table.studentId),
    index("invoices_semester_idx").on(table.semesterId),
    uniqueIndex("invoices_student_semester_unique").on(table.studentId, table.semesterId),
  ]
);

/** A single payment transaction recorded against an Invoice (supports partial payments). */
export const payments = pgTable(
  "payments",
  {
    id: idColumn(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    method: paymentMethodEnum("method").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    transactionReference: varchar("transaction_reference", { length: 255 }),
    recordedByUserId: uuid("recorded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [index("payments_invoice_idx").on(table.invoiceId)]
);

export const feeStructuresRelations = relations(feeStructures, ({ many }) => ({
  components: many(feeComponents),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  student: one(students, { fields: [invoices.studentId], references: [students.id] }),
  semester: one(semesters, { fields: [invoices.semesterId], references: [semesters.id] }),
  feeStructure: one(feeStructures, { fields: [invoices.feeStructureId], references: [feeStructures.id] }),
  scholarship: one(scholarships, { fields: [invoices.scholarshipId], references: [scholarships.id] }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));
