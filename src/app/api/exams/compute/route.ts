import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  results,
  gradeBands,
  gradingPolicies,
  assessmentTemplates,
  assessmentComponents,
  assessmentMarks,
  courseOfferings,
  courses,
  sections,
  enrollments,
  students,
  users,
} from "@/db/schema";
import { requirePermission, ForbiddenError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const computeSchema = z.object({
  courseOfferingId: z.string().uuid(),
  applyGraceMarks: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseOfferingId = searchParams.get("courseOfferingId");

  if (!courseOfferingId) {
    return NextResponse.json({ error: "courseOfferingId is required" }, { status: 400 });
  }

  try {
    // Fetch current results for this course offering

    // Also get pending or latest results
    const allResults = await db
      .select({
        resultId: results.id,
        enrollmentId: results.enrollmentId,
        finalScorePct: results.finalScorePct,
        status: results.status,
        version: results.version,
        supersedesResultId: results.supersedesResultId,
        publishedAt: results.publishedAt,
        correctionReason: results.correctionReason,
        gradeLetter: gradeBands.letter,
        gradePoint: gradeBands.gradePoint,
        studentRollNumber: students.rollNumber,
        studentName: users.fullName,
        studentEmail: users.email,
        sectionLabel: sections.label,
        courseCode: courses.code,
        courseTitle: courses.title,
        credits: courses.credits,
      })
      .from(results)
      .innerJoin(gradeBands, eq(results.gradeBandId, gradeBands.id))
      .innerJoin(enrollments, eq(results.enrollmentId, enrollments.id))
      .innerJoin(sections, eq(enrollments.sectionId, sections.id))
      .innerJoin(courseOfferings, eq(sections.courseOfferingId, courseOfferings.id))
      .innerJoin(courses, eq(courseOfferings.courseId, courses.id))
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .where(eq(courseOfferings.id, courseOfferingId))
      .orderBy(desc(results.version));

    // Deduplicate to current active version per enrollment
    const activeMap = new Map<string, (typeof allResults)[0]>();
    for (const r of allResults) {
      if (!activeMap.has(r.enrollmentId)) {
        activeMap.set(r.enrollmentId, r);
      }
    }

    return NextResponse.json({
      results: Array.from(activeMap.values()),
      total: activeMap.size,
    });
  } catch (error) {
    console.error("Error fetching computed results:", error);
    return NextResponse.json({ error: "Failed to fetch computed results" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requirePermission(session, "compute_results");
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

    const parsed = computeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

  const { courseOfferingId, applyGraceMarks } = parsed.data;

  // 1. Get assessment template for this offering
  const [template] = await db
    .select({
      id: assessmentTemplates.id,
      gradingPolicyId: assessmentTemplates.gradingPolicyId,
    })
    .from(assessmentTemplates)
    .where(eq(assessmentTemplates.courseOfferingId, courseOfferingId))
    .limit(1);

  if (!template) {
    return NextResponse.json(
      { error: "No assessment template configured for this course offering" },
      { status: 404 }
    );
  }

  // 2. Get grading policy & grade bands
  const [policy] = await db
    .select({
      id: gradingPolicies.id,
      name: gradingPolicies.name,
      passingPct: gradingPolicies.passingPct,
      graceMarksMax: gradingPolicies.graceMarksMax,
      strategyType: gradingPolicies.strategyType,
    })
    .from(gradingPolicies)
    .where(eq(gradingPolicies.id, template.gradingPolicyId))
    .limit(1);

  if (!policy) {
    return NextResponse.json({ error: "Grading policy not found" }, { status: 404 });
  }

  const bands = await db
    .select()
    .from(gradeBands)
    .where(eq(gradeBands.gradingPolicyId, policy.id))
    .orderBy(desc(gradeBands.gradePoint));

  if (bands.length === 0) {
    return NextResponse.json({ error: "No grade bands configured for grading policy" }, { status: 400 });
  }

  // 3. Get all assessment components for template
  const components = await db
    .select()
    .from(assessmentComponents)
    .where(eq(assessmentComponents.assessmentTemplateId, template.id));

  if (components.length === 0) {
    return NextResponse.json({ error: "No assessment components defined for this template" }, { status: 400 });
  }

  // 4. Get all enrolled students for this course offering across its sections
  const offeringEnrollments = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      rollNumber: students.rollNumber,
      fullName: users.fullName,
      email: users.email,
      sectionId: sections.id,
      sectionLabel: sections.label,
    })
    .from(enrollments)
    .innerJoin(sections, eq(enrollments.sectionId, sections.id))
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(users, eq(students.userId, users.id))
    .where(and(eq(sections.courseOfferingId, courseOfferingId), eq(enrollments.status, "registered")));

  if (offeringEnrollments.length === 0) {
    return NextResponse.json({ error: "No students enrolled in this course offering" }, { status: 400 });
  }

  // 5. Fetch all latest marks for all components of this template
  const componentIds = components.map((c) => c.id);
  const enrollmentIds = offeringEnrollments.map((e) => e.enrollmentId);

  const allMarks = await db
    .select()
    .from(assessmentMarks)
    .where(
      and(
        inArray(assessmentMarks.assessmentComponentId, componentIds),
        inArray(assessmentMarks.enrollmentId, enrollmentIds)
      )
    )
    .orderBy(desc(assessmentMarks.version));

  // Build map: enrollmentId -> componentId -> latest mark
  const marksMap = new Map<string, Map<string, (typeof allMarks)[0]>>();
  for (const m of allMarks) {
    if (!marksMap.has(m.enrollmentId)) {
      marksMap.set(m.enrollmentId, new Map());
    }
    const compMap = marksMap.get(m.enrollmentId)!;
    if (!compMap.has(m.assessmentComponentId)) {
      compMap.set(m.assessmentComponentId, m);
    }
  }

  // 6. Compute scores and assign grade bands
  const passingPct = Number(policy.passingPct);
  const graceMax = applyGraceMarks ? Number(policy.graceMarksMax) : 0;

  interface ComponentBreakdownItem {
    componentName: string;
    marksObtained: number;
    maxMarks: number;
    weightage: number;
    scorePct: number;
    markStatus: string;
  }

  interface ComputationResultItem {
    enrollmentId: string;
    studentId: string;
    rollNumber: string;
    fullName: string;
    finalScorePct: number;
    gradeBandId: string;
    gradeLetter: string;
    gradePoint: number;
    appliedGrace: number;
    components: ComponentBreakdownItem[];
  }

  const computationResults: ComputationResultItem[] = [];
  const gradeDistribution: Record<string, number> = {};
  for (const b of bands) {
    gradeDistribution[b.letter] = 0;
  }

  for (const enrollment of offeringEnrollments) {
    const studentCompMap = marksMap.get(enrollment.enrollmentId);
    let weightedScorePct = 0;
    const componentBreakdown: ComponentBreakdownItem[] = [];

    for (const comp of components) {
      const mark = studentCompMap?.get(comp.id);
      const marksObtained = mark ? Number(mark.marksObtained) : 0;
      const maxMarks = Number(comp.maxMarks);
      const weightage = Number(comp.weightagePct);

      const componentScore = maxMarks > 0 ? (marksObtained / maxMarks) * weightage : 0;
      weightedScorePct += componentScore;

      componentBreakdown.push({
        componentName: comp.name,
        marksObtained,
        maxMarks,
        weightage,
        scorePct: componentScore,
        markStatus: mark?.status ?? "not_entered",
      });
    }

    // Grace marks application if eligible
    let appliedGrace = 0;
    if (weightedScorePct < passingPct && weightedScorePct + graceMax >= passingPct) {
      appliedGrace = passingPct - weightedScorePct;
      weightedScorePct = passingPct;
    }

    // Round to 2 decimals
    const finalScorePct = Math.min(100, Math.max(0, Number(weightedScorePct.toFixed(2))));

    // Match grade band
    let assignedBand = bands.find(
      (b) => finalScorePct >= Number(b.minPct) && finalScorePct <= Number(b.maxPct)
    );

    if (!assignedBand) {
      // Fallback: choose lowest band (F or bottom)
      assignedBand = bands[bands.length - 1];
    }

    gradeDistribution[assignedBand.letter] = (gradeDistribution[assignedBand.letter] || 0) + 1;

    computationResults.push({
      enrollmentId: enrollment.enrollmentId,
      studentId: enrollment.studentId,
      rollNumber: enrollment.rollNumber,
      fullName: enrollment.fullName,
      finalScorePct,
      gradeBandId: assignedBand.id,
      gradeLetter: assignedBand.letter,
      gradePoint: Number(assignedBand.gradePoint),
      appliedGrace,
      components: componentBreakdown,
    });
  }

  // 7. Store / Version in DB following Append/Version pattern
  const savedResults = await db.transaction(async (tx) => {
    const saved = [];

    for (const item of computationResults) {
      // Check existing results for this enrollment
      const existingResults = await tx
        .select()
        .from(results)
        .where(eq(results.enrollmentId, item.enrollmentId))
        .orderBy(desc(results.version));

      const activeResult = existingResults[0];

      if (!activeResult) {
        // First version row
        const [inserted] = await tx
          .insert(results)
          .values({
            enrollmentId: item.enrollmentId,
            finalScorePct: item.finalScorePct.toFixed(2),
            gradeBandId: item.gradeBandId,
            status: "pending_approval",
            version: "1",
            supersedesResultId: null,
          })
          .returning();
        saved.push(inserted);
      } else if (activeResult.status === "pending_approval") {
        // Can update pending approval in place before publishing
        const [updated] = await tx
          .update(results)
          .set({
            finalScorePct: item.finalScorePct.toFixed(2),
            gradeBandId: item.gradeBandId,
          })
          .where(eq(results.id, activeResult.id))
          .returning();
        saved.push(updated);
      } else {
        // APPEND/VERSION PATTERN:
        // Prior row was 'approved' or 'published'. NEVER update directly in place!
        // Mark prior row as 'superseded' and insert new row with version + 1
        await tx
          .update(results)
          .set({ status: "superseded" })
          .where(eq(results.id, activeResult.id));

        const nextVersion = String(Number(activeResult.version) + 1);
        const [inserted] = await tx
          .insert(results)
          .values({
            enrollmentId: item.enrollmentId,
            finalScorePct: item.finalScorePct.toFixed(2),
            gradeBandId: item.gradeBandId,
            status: "pending_approval",
            version: nextVersion,
            supersedesResultId: activeResult.id,
            correctionReason: "Recomputed based on updated marks",
          })
          .returning();
        saved.push(inserted);
      }
    }

    return saved;
  });

  await recordAudit({
    actorUserId: session.user.id,
    action: "ResultsComputed",
    resourceType: "CourseOffering",
    resourceId: courseOfferingId,
    newValue: {
      studentCount: computationResults.length,
      gradeDistribution,
      policyId: policy.id,
    },
  });

  return NextResponse.json({
    message: "Results computed successfully",
    computedCount: savedResults.length,
    gradeDistribution,
    results: computationResults,
  });
  } catch (error) {
    console.error("Error in POST /api/exams/compute:", error);
    const message = error instanceof Error ? error.message : "Failed to compute results";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
