import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ControllerDashboard from "./ControllerDashboard";

export default async function ControllerPortalPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  const allowedRoles = [
    "examination_controller",
    "super_admin",
    "university_admin",
    "hod",
    "department_admin",
  ];

  if (!allowedRoles.includes(role)) {
    redirect("/exams");
  }

  return <ControllerDashboard />;
}
