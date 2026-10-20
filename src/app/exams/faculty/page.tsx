import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import FacultyMarksRoster from "./FacultyMarksRoster";

export default async function FacultyPortalPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  const allowedRoles = ["faculty", "super_admin", "department_admin", "hod", "university_admin"];

  if (!allowedRoles.includes(role)) {
    redirect("/exams");
  }

  return <FacultyMarksRoster />;
}
