import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  courses,
  courseOfferings,
  sections,
  faculty,
  facultyAssignments,
  enrollments,
  students,
  assessmentTemplates,
  assessmentComponents,
  gradingPolicies,
  academicYears,
  semesters,
  departments,
  programs,
  users,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";

const createComponentSchema = z.object({
  courseOfferingId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  maxMarks: z.number().positive().max(1000),
  weightagePct: z.number().positive().max(100),
  isNewSubject: z.boolean().optional().default(false),
  subjectCode: z.string().max(20).optional(),
  subjectTitle: z.string().max(200).optional(),
  credits: z.number().int().min(1).max(10).optional().default(3),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    const isAllowed = [
      "faculty",
      "hod",
      "department_admin",
      "examination_controller",
      "super_admin",
      "university_admin",
    ].includes(role);

    if (!isAllowed) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parsed = createComponentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const {
      courseOfferingId,
      name,
      maxMarks,
      weightagePct,
      isNewSubject,
      subjectCode,
      subjectTitle,
      credits,
    } = parsed.data;

    // Resolve faculty profile for assignments
    let facultyProfileId: string | null = null;
    if (session.user.id) {
      const [fac] = await db
        .select({ id: faculty.id })
        .from(faculty)
        .where(eq(faculty.userId, session.user.id))
        .limit(1);
      facultyProfileId = fac?.id ?? null;
    }
    if (!facultyProfileId && session.user.email) {
      const [u] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, session.user.email.toLowerCase().trim()))
        .limit(1);
      if (u) {
        const [fac] = await db
          .select({ id: faculty.id })
          .from(faculty)
          .where(eq(faculty.userId, u.id))
          .limit(1);
        facultyProfileId = fac?.id ?? null;
      }
    }
    if (!facultyProfileId) {
      const [firstFac] = await db.select({ id: faculty.id }).from(faculty).limit(1);
      facultyProfileId = firstFac?.id ?? null;
    }

    // Branch 1: Add entirely new Subject / Course Offering
    if (isNewSubject) {
      if (!subjectCode || !subjectTitle) {
        return NextResponse.json(
          { error: "Subject Code and Subject Title are required to create a new subject." },
          { status: 400 }
        );
      }

      // Default or self-heal foundation academic records
      let [csDept] = await db.select().from(departments).limit(1);
      if (!csDept) {
        const [newDept] = await db
          .insert(departments)
          .values({
            name: "Computer Science & Engineering",
            code: "CSE",
          })
          .returning();
        csDept = newDept;
      }

      let [csProgram] = await db.select().from(programs).limit(1);
      if (!csProgram) {
        const [newProg] = await db
          .insert(programs)
          .values({
            departmentId: csDept.id,
            name: "Bachelor of Science in Computer Science",
            code: "BS-CS",
            durationYears: 4,
          })
          .returning();
        csProgram = newProg;
      }

      let [fallSem] = await db.select().from(semesters).limit(1);
      if (!fallSem) {
        let [acadYear] = await db.select().from(academicYears).limit(1);
        if (!acadYear) {
          const [newYear] = await db
            .insert(academicYears)
            .values({
              label: "2026-2027",
              startDate: "2026-08-01",
              endDate: "2027-06-30",
            })
            .returning();
          acadYear = newYear;
        }
        const [newSem] = await db
          .insert(semesters)
          .values({
            academicYearId: acadYear.id,
            label: "Fall 2026",
            startDate: "2026-08-15",
            endDate: "2026-12-20",
          })
          .returning();
        fallSem = newSem;
      }

      let [policy] = await db.select().from(gradingPolicies).limit(1);
      if (!policy) {
        const [newPolicy] = await db
          .insert(gradingPolicies)
          .values({
            name: "Standard Grading Policy",
            passingPct: "50",
            strategyType: "absolute",
            graceMarksMax: "0",
          })
          .returning();
        policy = newPolicy;
      }

      const createdData = await db.transaction(async (tx) => {
        // 1. Create or find Course
        let courseId: string;
        const [existingCourse] = await tx
          .select({ id: courses.id })
          .from(courses)
          .where(eq(courses.code, subjectCode.toUpperCase().trim()))
          .limit(1);

        if (existingCourse) {
          courseId = existingCourse.id;
        } else {
          const [newCourse] = await tx
            .insert(courses)
            .values({
              code: subjectCode.toUpperCase().trim(),
              title: subjectTitle.trim(),
              credits,
              departmentId: csDept.id,
            })
            .returning();
          courseId = newCourse.id;
        }

        // 2. Create or find Course Offering (prevent unique constraint collision)
        let offeringRecord;
        const [existingOffering] = await tx
          .select()
          .from(courseOfferings)
          .where(
            and(
              eq(courseOfferings.courseId, courseId),
              eq(courseOfferings.programId, csProgram.id),
              eq(courseOfferings.semesterId, fallSem.id)
            )
          )
          .limit(1);

        if (existingOffering) {
          offeringRecord = existingOffering;
        } else {
          const [newOffering] = await tx
            .insert(courseOfferings)
            .values({
              courseId,
              programId: csProgram.id,
              semesterId: fallSem.id,
            })
            .returning();
          offeringRecord = newOffering;
        }

        // 3. Create or find Section A
        let sectionRecord;
        const [existingSection] = await tx
          .select()
          .from(sections)
          .where(
            and(
              eq(sections.courseOfferingId, offeringRecord.id),
              eq(sections.label, "A")
            )
          )
          .limit(1);

        if (existingSection) {
          sectionRecord = existingSection;
        } else {
          const [newSection] = await tx
            .insert(sections)
            .values({
              courseOfferingId: offeringRecord.id,
              label: "A",
              capacity: 60,
            })
            .returning();
          sectionRecord = newSection;
        }

        // 4. Assign faculty (prevent unique constraint collision)
        if (facultyProfileId) {
          const [existingAssgn] = await tx
            .select({ id: facultyAssignments.id })
            .from(facultyAssignments)
            .where(
              and(
                eq(facultyAssignments.facultyId, facultyProfileId),
                eq(facultyAssignments.sectionId, sectionRecord.id)
              )
            )
            .limit(1);

          if (!existingAssgn) {
            await tx.insert(facultyAssignments).values({
              facultyId: facultyProfileId,
              sectionId: sectionRecord.id,
              assignmentRole: "primary",
            });
          }
        }

        // 5. Enroll students into this section
        let studentList = await tx
          .select({ id: students.id })
          .from(students)
          .where(eq(students.status, "active"));

        if (studentList.length === 0) {
          studentList = await tx.select({ id: students.id }).from(students).limit(50);
        }

        for (const st of studentList) {
          const [existingEnrollment] = await tx
            .select({ id: enrollments.id })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.studentId, st.id),
                eq(enrollments.sectionId, sectionRecord.id)
              )
            )
            .limit(1);

          if (!existingEnrollment) {
            await tx.insert(enrollments).values({
              studentId: st.id,
              sectionId: sectionRecord.id,
              status: "registered",
            });
          }
        }

        // 6. Create or find assessment template
        let templateRecord;
        const [existingTemplate] = await tx
          .select()
          .from(assessmentTemplates)
          .where(eq(assessmentTemplates.courseOfferingId, offeringRecord.id))
          .limit(1);

        if (existingTemplate) {
          templateRecord = existingTemplate;
        } else {
          const [newTemplate] = await tx
            .insert(assessmentTemplates)
            .values({
              courseOfferingId: offeringRecord.id,
              gradingPolicyId: policy.id,
            })
            .returning();
          templateRecord = newTemplate;
        }

        // 7. Create assessment component
        const [newComp] = await tx
          .insert(assessmentComponents)
          .values({
            assessmentTemplateId: templateRecord.id,
            name: name.trim(),
            maxMarks: String(maxMarks),
            weightagePct: String(weightagePct),
          })
          .returning();

        return {
          offering: offeringRecord,
          section: sectionRecord,
          template: templateRecord,
          component: newComp,
        };
      });

      try {
        await recordAudit({
          actorUserId: session.user.id || null,
          action: "SubjectAndComponentCreated",
          resourceType: "CourseOffering",
          resourceId: createdData.offering.id,
          newValue: { subjectCode, subjectTitle, name, maxMarks, weightagePct },
        });
      } catch (auditErr) {
        console.warn("Audit logging notice (ignored):", auditErr);
      }

      return NextResponse.json(
        {
          message: "New Subject and Assessment Component created successfully!",
          data: createdData,
          component: createdData.component,
          courseOfferingId: createdData.offering.id,
          sectionId: createdData.section.id,
        },
        { status: 201 }
      );
    }

    // Branch 2: Add Assessment Component to Existing Course Offering
    if (!courseOfferingId) {
      return NextResponse.json({ error: "courseOfferingId is required" }, { status: 400 });
    }

    // Find or create template for this offering
    let [template] = await db
      .select({
        id: assessmentTemplates.id,
        gradingPolicyId: assessmentTemplates.gradingPolicyId,
      })
      .from(assessmentTemplates)
      .where(eq(assessmentTemplates.courseOfferingId, courseOfferingId))
      .limit(1);

    if (!template) {
      let [policy] = await db.select({ id: gradingPolicies.id }).from(gradingPolicies).limit(1);
      if (!policy) {
        const [newPolicy] = await db
          .insert(gradingPolicies)
          .values({
            name: "Standard Grading Policy",
            passingPct: "50",
            strategyType: "absolute",
            graceMarksMax: "0",
          })
          .returning({ id: gradingPolicies.id });
        policy = newPolicy;
      }
      const [newTemplate] = await db
        .insert(assessmentTemplates)
        .values({
          courseOfferingId,
          gradingPolicyId: policy.id,
        })
        .returning();
      template = newTemplate;
    }

    const [createdComp] = await db
      .insert(assessmentComponents)
      .values({
        assessmentTemplateId: template.id,
        name: name.trim(),
        maxMarks: String(maxMarks),
        weightagePct: String(weightagePct),
      })
      .returning();

    // Ensure faculty is assigned to the sections of this course offering
    if (facultyProfileId) {
      const offeringSections = await db
        .select({ id: sections.id })
        .from(sections)
        .where(eq(sections.courseOfferingId, courseOfferingId));

      for (const sec of offeringSections) {
        const [existingAssgn] = await db
          .select({ id: facultyAssignments.id })
          .from(facultyAssignments)
          .where(
            and(
              eq(facultyAssignments.facultyId, facultyProfileId),
              eq(facultyAssignments.sectionId, sec.id)
            )
          )
          .limit(1);
        if (!existingAssgn) {
          try {
            await db.insert(facultyAssignments).values({
              facultyId: facultyProfileId,
              sectionId: sec.id,
              assignmentRole: "primary",
            });
          } catch {
            // Ignore potential race-condition duplicate
          }
        }
      }
    }

    try {
      await recordAudit({
        actorUserId: session.user.id || null,
        action: "AssessmentComponentAdded",
        resourceType: "AssessmentComponent",
        resourceId: createdComp.id,
        newValue: { name, maxMarks, weightagePct, courseOfferingId },
      });
    } catch (auditErr) {
      console.warn("Audit logging notice (ignored):", auditErr);
    }

    return NextResponse.json(
      {
        message: "Assessment component added successfully!",
        component: createdComp,
        courseOfferingId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/exams/components:", error);
    const message = error instanceof Error ? error.message : "Failed to create assessment component";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
