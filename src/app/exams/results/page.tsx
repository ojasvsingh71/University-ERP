import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import StudentTranscriptView from "./StudentTranscriptView";

export default async function ResultsPortalPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <StudentTranscriptView />;
}
