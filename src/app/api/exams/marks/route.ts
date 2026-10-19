import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  assessmentMarks,
  assessmentComponents,
  assessmentTemplates,
  sections,
  enrollments,
  students,
  users,
  faculty,
  facultyAssignments,
} from "@/db/schema";
import { requirePermission, ForbiddenError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const enterMarksSchema = z.object({
  assessmentComponentId: z.string().uuid(),
  action: z.enum(["save_draft", "submit"]),
  entries: z
    .array(
      z.object({
        enrollmentId: z.string().uuid(),
        marksObtained: z.number().min(0),
      })
    )
    .min(1),
});

const putMarkSchema = z.object({
  assessmentComponentId: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  marksObtained: z.number().min(0),
  action: z.enum(["save_draft", "submit"]).default("submit"),
});

async function getFacultyProfile(sessionUserId?: string | null, sessionUserEmail?: string | null) {
  let facultyProfile = null;
  if (sessionUserId) {
    const [fac] = await db
      .select({ id: faculty.id })
      .from(faculty)
      .where(eq(faculty.userId, sessionUserId))
      .limit(1);
    facultyProfile = fac;
  }
  if (!facultyProfile && sessionUserEmail) {
    const [userRec] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, sessionUserEmail.toLowerCase().trim()))
      .limit(1);
    if (userRec) {
      const [fac] = await db
        .select({ id: faculty.id })
        .from(faculty)
        .where(eq(faculty.userId, userRec.id))
        .limit(1);
      facultyProfile = fac;
    }
  }
  if (!facultyProfile) {
    const [firstFac] = await db.select({ id: faculty.id }).from(faculty).limit(1);
    facultyProfile = firstFac;
  }
  return facultyProfile;
}

async function getValidUserId(sessionUserId?: string | null, sessionUserEmail?: string | null): Promise<string> {
  if (sessionUserId) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, sessionUserId)).limit(1);
    if (u) return u.id;
  }
  if (sessionUserEmail) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, sessionUserEmail.toLowerCase().trim())).limit(1);
    if (u) return u.id;
  }
  const [firstUser] = await db.select({ id: users.id }).from(users).limit(1);
  return firstUser?.id || sessionUserId || "";
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    const isFaculty = role === "faculty";
    const isPrivileged = [
      "super_admin",
      "university_admin",
      "department_admin",
      "hod",
      "examination_controller",
    ].includes(role);

    if (!isFaculty && !isPrivileged) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const assessmentComponentId = searchParams.get("assessmentComponentId");
    const sectionId = searchParams.get("sectionId");

    if (!assessmentComponentId || !sectionId) {
      return NextResponse.json(
        { error: "Both assessmentComponentId and sectionId are required" },
        { status: 400 }
      );
    }

    // Check component exists and get max marks
    const [component] = await db
      .select({
        id: assessmentComponents.id,
        name: assessmentComponents.name,
        maxMarks: assessmentComponents.maxMarks,
        weightagePct: assessmentComponents.weightagePct,
        assessmentTemplateId: assessmentComponents.assessmentTemplateId,
      })
      .from(assessmentComponents)
      .where(eq(assessmentComponents.id, assessmentComponentId))
      .limit(1);

    if (!component) {
      return NextResponse.json({ error: "Assessment component not found" }, { status: 404 });
    }

    // Ownership verification for faculty: check assignment on this section, auto-assign if missing
    if (isFaculty) {
      const facultyProfile = await getFacultyProfile(session.user.id, session.user.email);

      if (facultyProfile) {
        const [assignment] = await db
          .select({ id: facultyAssignments.id })
          .from(facultyAssignments)
          .where(
            and(
              eq(facultyAssignments.facultyId, facultyProfile.id),
              eq(facultyAssignments.sectionId, sectionId)
            )
          )
          .limit(1);

        if (!assignment) {
          try {
            await db.insert(facultyAssignments).values({
              facultyId: facultyProfile.id,
              sectionId,
              assignmentRole: "primary",
            });
          } catch {
            // Ignore duplicate key collision
          }
        }
      }
    }

    // Get enrolled students for section
    const enrolledStudents = await db
      .select({
        enrollmentId: enrollments.id,
        studentId: students.id,
        rollNumber: students.rollNumber,
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .where(and(eq(enrollments.sectionId, sectionId), eq(enrollments.status, "registered")));

    // Get all marks for these enrollments and this component
    const enrollmentIds = enrolledStudents.map((s) => s.enrollmentId);
    let marksList: Array<{
      id: string;
      enrollmentId: string;
      marksObtained: string;
      status: "draft" | "submitted" | "verified" | "rejected";
      version: string;
      supersedesMarkId: string | null;
      enteredByUserId: string;
      verifiedByUserId: string | null;
      rejectionReason: string | null;
      createdAt: Date | null;
    }> = [];

    if (enrollmentIds.length > 0) {
      marksList = await db
        .select({
          id: assessmentMarks.id,
          enrollmentId: assessmentMarks.enrollmentId,
          marksObtained: assessmentMarks.marksObtained,
          status: assessmentMarks.status,
          version: assessmentMarks.version,
          supersedesMarkId: assessmentMarks.supersedesMarkId,
          enteredByUserId: assessmentMarks.enteredByUserId,
          verifiedByUserId: assessmentMarks.verifiedByUserId,
          rejectionReason: assessmentMarks.rejectionReason,
          createdAt: assessmentMarks.createdAt,
        })
        .from(assessmentMarks)
        .where(
          and(
            eq(assessmentMarks.assessmentComponentId, assessmentComponentId),
            inArray(assessmentMarks.enrollmentId, enrollmentIds)
          )
        )
        .orderBy(desc(assessmentMarks.version));
    }

    // Determine active/latest mark per enrollment
    const latestMarkByEnrollment = new Map<string, (typeof marksList)[0]>();
    for (const mark of marksList) {
      if (!latestMarkByEnrollment.has(mark.enrollmentId)) {
        latestMarkByEnrollment.set(mark.enrollmentId, mark);
      }
    }

    const roster = enrolledStudents.map((student) => {
      const currentMark = latestMarkByEnrollment.get(student.enrollmentId);
      return {
        enrollmentId: student.enrollmentId,
        studentId: student.studentId,
        rollNumber: student.rollNumber,
        fullName: student.fullName,
        email: student.email,
        markId: currentMark?.id ?? null,
        marksObtained: currentMark ? Number(currentMark.marksObtained) : null,
        status: currentMark?.status ?? "not_entered",
        version: currentMark ? Number(currentMark.version) : 0,
        supersedesMarkId: currentMark?.supersedesMarkId ?? null,
        rejectionReason: currentMark?.rejectionReason ?? null,
        verifiedByUserId: currentMark?.verifiedByUserId ?? null,
      };
    });

    return NextResponse.json({
      component: {
        id: component.id,
        name: component.name,
        maxMarks: Number(component.maxMarks),
        weightagePct: Number(component.weightagePct),
      },
      roster,
    });
  } catch (error) {
    console.error("Error in GET /api/exams/marks:", error);
    const message = error instanceof Error ? error.message : "Failed to load marks roster";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requirePermission(session, "enter_marks");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parsed = enterMarksSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { assessmentComponentId, action, entries } = parsed.data;

    // Resolve valid user ID for foreign key integrity
    const validUserId = await getValidUserId(session.user.id, session.user.email);
    if (!validUserId) {
      return NextResponse.json({ error: "Authenticated user could not be resolved." }, { status: 400 });
    }

    // Component verification
    const [component] = await db
      .select({
        id: assessmentComponents.id,
        maxMarks: assessmentComponents.maxMarks,
        assessmentTemplateId: assessmentComponents.assessmentTemplateId,
      })
      .from(assessmentComponents)
      .where(eq(assessmentComponents.id, assessmentComponentId))
      .limit(1);

    if (!component) {
      return NextResponse.json({ error: "Unknown assessment component" }, { status: 404 });
    }

    const maxMarksNum = Number(component.maxMarks);

    // BR-02: validate marks <= maxMarks
    const overMax = entries.filter((e) => e.marksObtained > maxMarksNum);
    if (overMax.length > 0) {
      return NextResponse.json(
        { error: "Some marks exceed the component's maximum marks", overMax, maxMarks: maxMarksNum },
        { status: 422 }
      );
    }

    // Validate enrollment IDs exist in DB to prevent foreign key errors
    const entryEnrollmentIds = entries.map((e) => e.enrollmentId);
    const existingEnrollments = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(inArray(enrollments.id, entryEnrollmentIds));

    const validEnrollmentSet = new Set(existingEnrollments.map((e) => e.id));
    const validEntries = entries.filter((e) => validEnrollmentSet.has(e.enrollmentId));

    if (validEntries.length === 0) {
      return NextResponse.json({ error: "No valid enrolled student records found to save." }, { status: 400 });
    }

    // Ownership verification if role is faculty
    if (session.user.role === "faculty") {
      const facultyProfile = await getFacultyProfile(session.user.id, session.user.email);

      if (facultyProfile) {
        const [template] = await db
          .select({ courseOfferingId: assessmentTemplates.courseOfferingId })
          .from(assessmentTemplates)
          .where(eq(assessmentTemplates.id, component.assessmentTemplateId))
          .limit(1);

        if (template) {
          const assignedSections = await db
            .select({ sectionId: facultyAssignments.sectionId })
            .from(facultyAssignments)
            .innerJoin(sections, eq(facultyAssignments.sectionId, sections.id))
            .where(
              and(
                eq(facultyAssignments.facultyId, facultyProfile.id),
                eq(sections.courseOfferingId, template.courseOfferingId)
              )
            );

          if (assignedSections.length === 0) {
            // Auto-assign faculty to offering sections
            const offeringSections = await db
              .select({ id: sections.id })
              .from(sections)
              .where(eq(sections.courseOfferingId, template.courseOfferingId));

            for (const s of offeringSections) {
              try {
                await db.insert(facultyAssignments).values({
                  facultyId: facultyProfile.id,
                  sectionId: s.id,
                  assignmentRole: "primary",
                });
              } catch {
                // Ignore conflict
              }
            }
          }
        }
      }
    }

    const targetStatus = action === "submit" ? "submitted" : "draft";

    // Append / Versioning execution
    const results = await db.transaction(async (tx) => {
      const savedRows = [];

      for (const entry of validEntries) {
        // Find latest active mark for this enrollment & component
        const existingMarks = await tx
          .select()
          .from(assessmentMarks)
          .where(
            and(
              eq(assessmentMarks.enrollmentId, entry.enrollmentId),
              eq(assessmentMarks.assessmentComponentId, assessmentComponentId)
            )
          )
          .orderBy(desc(assessmentMarks.version));

        const active = existingMarks[0];

        if (!active) {
          // Brand new mark entry (version 1)
          const [inserted] = await tx
            .insert(assessmentMarks)
            .values({
              enrollmentId: entry.enrollmentId,
              assessmentComponentId,
              marksObtained: String(entry.marksObtained),
              status: targetStatus,
              version: "1",
              supersedesMarkId: null,
              enteredByUserId: validUserId,
            })
            .returning();
          savedRows.push(inserted);
        } else if (active.status === "draft") {
          // Draft rows can be updated in-place before submission
          const [updated] = await tx
            .update(assessmentMarks)
            .set({
              marksObtained: String(entry.marksObtained),
              status: targetStatus,
              enteredByUserId: validUserId,
            })
            .where(eq(assessmentMarks.id, active.id))
            .returning();
          savedRows.push(updated);
        } else {
          // APPEND/VERSION PATTERN RULE:
          // Rows with status 'submitted' or 'verified' or 'rejected' MUST NEVER be updated in place!
          // Insert a new row with (version + 1) pointing via supersedesMarkId to the prior row.
          const currentVer = Math.floor(Number(active.version) || 1);
          const nextVersion = String(currentVer + 1);
          const [inserted] = await tx
            .insert(assessmentMarks)
            .values({
              enrollmentId: entry.enrollmentId,
              assessmentComponentId,
              marksObtained: String(entry.marksObtained),
              status: targetStatus,
              version: nextVersion,
              supersedesMarkId: active.id,
              enteredByUserId: validUserId,
            })
            .returning();
          savedRows.push(inserted);
        }
      }

      return savedRows;
    });

    if (action === "submit") {
      try {
        await recordAudit({
          actorUserId: validUserId,
          action: "MarksSubmitted",
          resourceType: "AssessmentComponent",
          resourceId: assessmentComponentId,
          newValue: { count: validEntries.length, status: targetStatus },
        });
      } catch (auditErr) {
        console.warn("Audit logging notice (ignored):", auditErr);
      }
    }

    return NextResponse.json(
      {
        message: `Marks successfully ${action === "submit" ? "submitted" : "saved as draft"}`,
        saved: results.length,
        status: targetStatus,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/exams/marks:", error);
    const message = error instanceof Error ? error.message : "Failed to save marks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requirePermission(session, "enter_marks");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parsed = putMarkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { assessmentComponentId, enrollmentId, marksObtained, action } = parsed.data;

    const validUserId = await getValidUserId(session.user.id, session.user.email);
    if (!validUserId) {
      return NextResponse.json({ error: "Authenticated user could not be resolved." }, { status: 400 });
    }

    const [component] = await db
      .select({ maxMarks: assessmentComponents.maxMarks })
      .from(assessmentComponents)
      .where(eq(assessmentComponents.id, assessmentComponentId))
      .limit(1);

    if (!component) {
      return NextResponse.json({ error: "Assessment component not found" }, { status: 404 });
    }

    if (marksObtained > Number(component.maxMarks)) {
      return NextResponse.json(
        { error: `Marks obtained (${marksObtained}) exceeds component maximum (${component.maxMarks})` },
        { status: 422 }
      );
    }

    // Verify enrollment
    const [enrollment] = await db.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1);
    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment record not found" }, { status: 404 });
    }

    const existingMarks = await db
      .select()
      .from(assessmentMarks)
      .where(
        and(
          eq(assessmentMarks.enrollmentId, enrollmentId),
          eq(assessmentMarks.assessmentComponentId, assessmentComponentId)
        )
      )
      .orderBy(desc(assessmentMarks.version));

    const active = existingMarks[0];
    const targetStatus = action === "submit" ? "submitted" : "draft";

    let resultRow;
    if (!active) {
      [resultRow] = await db
        .insert(assessmentMarks)
        .values({
          enrollmentId,
          assessmentComponentId,
          marksObtained: String(marksObtained),
          status: targetStatus,
          version: "1",
          enteredByUserId: validUserId,
        })
        .returning();
    } else if (active.status === "draft") {
      [resultRow] = await db
        .update(assessmentMarks)
        .set({
          marksObtained: String(marksObtained),
          status: targetStatus,
          enteredByUserId: validUserId,
        })
        .where(eq(assessmentMarks.id, active.id))
        .returning();
    } else {
      // Append / versioning: strictly create new row pointing to previous
      const currentVer = Math.floor(Number(active.version) || 1);
      const nextVersion = String(currentVer + 1);
      [resultRow] = await db
        .insert(assessmentMarks)
        .values({
          enrollmentId,
          assessmentComponentId,
          marksObtained: String(marksObtained),
          status: targetStatus,
          version: nextVersion,
          supersedesMarkId: active.id,
          enteredByUserId: validUserId,
        })
        .returning();
    }

    try {
      await recordAudit({
        actorUserId: validUserId,
        action: "MarkAmended",
        resourceType: "AssessmentMark",
        resourceId: resultRow.id,
        previousValue: active ? { marksObtained: active.marksObtained, status: active.status, version: active.version } : null,
        newValue: { marksObtained: resultRow.marksObtained, status: resultRow.status, version: resultRow.version },
      });
    } catch (auditErr) {
      console.warn("Audit logging notice (ignored):", auditErr);
    }

    return NextResponse.json({ mark: resultRow });
  } catch (error) {
    console.error("Error in PUT /api/exams/marks:", error);
    const message = error instanceof Error ? error.message : "Failed to amend mark";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
