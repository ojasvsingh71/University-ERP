import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { RoleName } from "@/lib/rbac";
import FacultyDashboard from "./_components/FacultyDashboard";
import StudentDashboard from "./_components/StudentDashboard";

export default async function AttendancePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as RoleName;

  if (role === "faculty" || role === "super_admin" || role === "department_admin" || role === "hod") {
    return <FacultyDashboard userId={session.user.id} />;
  }

  if (role === "student") {
    return <StudentDashboard userId={session.user.id} />;
  }

  // Parent or any other role with view_own_attendance — redirect home for now
  redirect("/");
}
