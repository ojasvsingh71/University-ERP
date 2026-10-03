import { pgEnum } from "drizzle-orm/pg-core";

// ---- Identity & Access ----
export const roleNameEnum = pgEnum("role_name", [
  "super_admin",
  "university_admin",
  "registrar",
  "department_admin",
  "hod",
  "examination_controller",
  "faculty",
  "student",
  "parent",
  "auditor",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "inactive",
  "locked",
]);

// ---- Academic Structure ----
export const sectionStatusEnum = pgEnum("section_status", [
  "open",
  "closed",
  "archived",
]);

// ---- Enrollment & Attendance ----
export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "registered",
  "waitlisted",
  "withdrawn",
  "completed",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "excused",
]);

// ---- Assessment ----
export const markStatusEnum = pgEnum("mark_status", [
  "draft",
  "submitted",
  "verified",
  "rejected",
]);

export const gradingStrategyEnum = pgEnum("grading_strategy", [
  "absolute",
  "relative",
]);

// ---- Examination & Result ----
export const examinationTypeEnum = pgEnum("examination_type", [
  "midterm",
  "final",
  "practical",
  "viva",
  "supplementary",
]);

export const resultStatusEnum = pgEnum("result_status", [
  "pending_approval",
  "approved",
  "published",
  "superseded",
]);

export const revaluationStatusEnum = pgEnum("revaluation_status", [
  "requested",
  "approved",
  "rejected",
]);

// ---- Fees & Payments ----
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "waived",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "bank_transfer",
  "online_gateway",
  "scholarship_adjustment",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "successful",
  "failed",
  "refunded",
]);

// ---- Cross-cutting ----
export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
  "email",
  "sms",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
]);
