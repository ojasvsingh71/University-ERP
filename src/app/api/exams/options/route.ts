import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  courses,
  courseOfferings,
  semesters,
  programs,
  sections,
  faculty,
  facultyAssignments,
  assessmentTemplates,
  assessmentComponents,
  gradingPolicies,
  users,
} from "@/db/schema";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;

    // 1. Fetch semesters
    const allSemesters = await db
      .select({
        id: semesters.id,
        label: semesters.label,
        startDate: semesters.startDate,
        endDate: semesters.endDate,
      })
      .from(semesters);

    // 2. Fetch course offerings with joined course, semester, program, and assessment template
    const rawOfferings = await db
      .select({
        id: courseOfferings.id,
        courseId: courses.id,
        courseCode: courses.code,
        courseTitle: courses.title,
        credits: courses.credits,
        semesterId: semesters.id,
        semesterLabel: semesters.label,
        programId: programs.id,
        programName: programs.name,
        templateId: assessmentTemplates.id,
        gradingPolicyId: assessmentTemplates.gradingPolicyId,
        policyName: gradingPolicies.name,
        passingPct: gradingPolicies.passingPct,
        graceMarksMax: gradingPolicies.graceMarksMax,
      })
      .from(courseOfferings)
      .innerJoin(courses, eq(courseOfferings.courseId, courses.id))
      .leftJoin(semesters, eq(courseOfferings.semesterId, semesters.id))
      .leftJoin(programs, eq(courseOfferings.programId, programs.id))
      .leftJoin(assessmentTemplates, eq(assessmentTemplates.courseOfferingId, courseOfferings.id))
      .leftJoin(gradingPolicies, eq(assessmentTemplates.gradingPolicyId, gradingPolicies.id));

    const offerings = rawOfferings.map((o) => ({
      ...o,
      semesterLabel: o.semesterLabel || "Current Term",
      programName: o.programName || "General",
    }));

    // 3. Fetch sections with faculty assignment status
    let facultyProfileId: string | null = null;
    if (role === "faculty") {
      let facRec: { id: string } | undefined;
      if (session.user.id) {
        const [fac] = await db
          .select({ id: faculty.id })
          .from(faculty)
          .where(eq(faculty.userId, session.user.id))
          .limit(1);
        facRec = fac;
      }
      if (!facRec && session.user.email) {
        const [userRec] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, session.user.email.toLowerCase().trim()))
          .limit(1);
        if (userRec) {
          const [fac] = await db
            .select({ id: faculty.id })
            .from(faculty)
            .where(eq(faculty.userId, userRec.id))
            .limit(1);
          facRec = fac;
        }
      }
      if (!facRec) {
        const [firstFac] = await db.select({ id: faculty.id }).from(faculty).limit(1);
        facRec = firstFac;
      }
      facultyProfileId = facRec?.id ?? null;
    }

    const allSections = await db
      .select({
        id: sections.id,
        courseOfferingId: sections.courseOfferingId,
        label: sections.label,
        capacity: sections.capacity,
        status: sections.status,
      })
      .from(sections);

    // Fetch faculty assignments if applicable
    const assignedSectionIds = new Set<string>();
    if (facultyProfileId) {
      const assignments = await db
        .select({ sectionId: facultyAssignments.sectionId })
        .from(facultyAssignments)
        .where(eq(facultyAssignments.facultyId, facultyProfileId));
      assignments.forEach((a) => assignedSectionIds.add(a.sectionId));
    }

    const sectionsWithAssignment = allSections.map((s) => ({
      ...s,
      isAssignedToCurrentUser: role === "faculty" ? (assignedSectionIds.size === 0 || assignedSectionIds.has(s.id)) : true,
    }));

    // 4. Fetch assessment components joined with templates to obtain courseOfferingId
    const components = await db
      .select({
        id: assessmentComponents.id,
        assessmentTemplateId: assessmentComponents.assessmentTemplateId,
        courseOfferingId: assessmentTemplates.courseOfferingId,
        name: assessmentComponents.name,
        maxMarks: assessmentComponents.maxMarks,
        weightagePct: assessmentComponents.weightagePct,
      })
      .from(assessmentComponents)
      .leftJoin(assessmentTemplates, eq(assessmentComponents.assessmentTemplateId, assessmentTemplates.id));

    return NextResponse.json({
      semesters: allSemesters,
      offerings,
      sections: sectionsWithAssignment,
      components,
      currentUserRole: role,
    });
  } catch (error) {
    console.error("Error in GET /api/exams/options:", error);
    const message = error instanceof Error ? error.message : "Failed to load options";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
