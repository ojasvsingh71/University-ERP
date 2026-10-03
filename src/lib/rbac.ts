/**
 * Coarse-grained RBAC: role -> permitted actions. Fine-grained ownership/department scoping
 * (e.g. "faculty may only mark attendance for their own section") is enforced per-route using
 * the scoping helpers below, consumed by API route handlers — not by this permission table alone.
 * Mirrors the RBAC model in Master Plan §6 and SRS §2.3.
 */
import type { Session } from "next-auth";

export type RoleName =
  | "super_admin"
  | "university_admin"
  | "registrar"
  | "department_admin"
  | "hod"
  | "examination_controller"
  | "faculty"
  | "student"
  | "parent"
  | "auditor";

export type Permission =
  | "manage_users"
  | "manage_academic_structure"
  | "manage_students"
  | "manage_faculty"
  | "manage_enrollment"
  | "record_attendance"
  | "view_own_attendance"
  | "manage_assessment_templates"
  | "enter_marks"
  | "verify_marks"
  | "compute_results"
  | "publish_results"
  | "view_own_results"
  | "manage_fees"
  | "make_payment"
  | "view_own_fees"
  | "view_audit_log";

const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  super_admin: [
    "manage_users",
    "manage_academic_structure",
    "manage_students",
    "manage_faculty",
    "manage_fees",
    "view_audit_log",
  ],
  university_admin: ["manage_academic_structure", "manage_students", "manage_faculty"],
  registrar: ["manage_students", "manage_enrollment"],
  department_admin: ["manage_academic_structure", "manage_assessment_templates", "verify_marks"],
  hod: ["verify_marks", "manage_assessment_templates"],
  examination_controller: ["compute_results", "publish_results"],
  faculty: ["record_attendance", "enter_marks"],
  student: ["view_own_attendance", "view_own_results", "view_own_fees", "make_payment"],
  parent: ["view_own_attendance", "view_own_results", "view_own_fees"],
  auditor: ["view_audit_log"],
};

export function hasPermission(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Throws a typed error an API route can catch and turn into a 403 response. */
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function requirePermission(session: Session | null, permission: Permission) {
  const role = session?.user?.role as RoleName | undefined;
  if (!role || !hasPermission(role, permission)) {
    throw new ForbiddenError(`Role '${role ?? "anonymous"}' lacks permission '${permission}'`);
  }
}

export function requireAnyRole(session: Session | null, roles: RoleName[]) {
  const role = session?.user?.role as RoleName | undefined;
  if (!role || !roles.includes(role)) {
    throw new ForbiddenError(`Role '${role ?? "anonymous"}' is not one of [${roles.join(", ")}]`);
  }
}
