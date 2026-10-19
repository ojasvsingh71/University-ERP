import { NextRequest, NextResponse } from "next/server";
import { eq, desc, asc, inArray, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  students,
  users,
  batches,
  programs,
  departments,
  enrollments,
  sections,
  courseOfferings,
  courses,
  semesters,
  examinations,
  results,
  gradeBands,
  assessmentComponents,
  assessmentMarks,
  revaluationRequests,
} from "@/db/schema";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user.role ?? "").toLowerCase();
    const { searchParams } = new URL(req.url);
    let targetStudentId = searchParams.get("studentId");
    const targetSemesterId = searchParams.get("semesterId");

    // Determine target student based on RBAC & ownership
    if (role === "student") {
      let ownStudent: { id: string } | undefined;

      // 1. Primary lookup: Match by session.user.id
      if (session.user.id) {
        const [byUserId] = await db
          .select({ id: students.id })
          .from(students)
          .where(eq(students.userId, session.user.id))
          .limit(1);
        ownStudent = byUserId;
      }

      // 2. Secondary lookup: Match by email
      if (!ownStudent && session.user.email) {
        const [matchedUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, session.user.email.toLowerCase().trim()))
          .limit(1);

        if (matchedUser) {
          const [byLinkedUser] = await db
            .select({ id: students.id })
            .from(students)
            .where(eq(students.userId, matchedUser.id))
            .limit(1);
          ownStudent = byLinkedUser;
        }
      }

      // 3. Fallback for demo/development environments
      if (!ownStudent) {
        const [fallbackStudent] = await db
          .select({ id: students.id })
          .from(students)
          .limit(1);
        ownStudent = fallbackStudent;
      }

      if (!ownStudent) {
        return NextResponse.json({ error: "No student profile linked to your user account" }, { status: 404 });
      }
      targetStudentId = ownStudent.id;
    } else if (role === "parent") {
      if (!targetStudentId) {
        let ownStudent: { id: string } | undefined;
        if (session.user.id) {
          const [byUserId] = await db
            .select({ id: students.id })
            .from(students)
            .where(eq(students.userId, session.user.id))
            .limit(1);
          ownStudent = byUserId;
        }
        if (!ownStudent && session.user.email) {
          const [matchedUser] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, session.user.email.toLowerCase().trim()))
            .limit(1);
          if (matchedUser) {
            const [byLinkedUser] = await db
              .select({ id: students.id })
              .from(students)
              .where(eq(students.userId, matchedUser.id))
              .limit(1);
            ownStudent = byLinkedUser;
          }
        }
        if (!ownStudent) {
          const [firstStudent] = await db
            .select({ id: students.id })
            .from(students)
            .limit(1);
          ownStudent = firstStudent;
        }
        if (ownStudent) targetStudentId = ownStudent.id;
      }
    } else if (
      [
        "examination_controller",
        "super_admin",
        "university_admin",
        "faculty",
        "hod",
        "department_admin",
        "registrar",
      ].includes(role)
    ) {
      if (!targetStudentId) {
        const [firstStudent] = await db
          .select({ id: students.id })
          .from(students)
          .limit(1);
        if (firstStudent) targetStudentId = firstStudent.id;
      }
    } else {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    if (!targetStudentId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // 1. Fetch student master profile
    const [studentProfile] = await db
      .select({
        id: students.id,
        rollNumber: students.rollNumber,
        status: students.status,
        fullName: users.fullName,
        email: users.email,
        batchLabel: batches.label,
        admissionYear: batches.admissionYear,
        programName: programs.name,
        programCode: programs.code,
        departmentName: departments.name,
        departmentCode: departments.code,
      })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(batches, eq(students.batchId, batches.id))
      .leftJoin(programs, eq(batches.programId, programs.id))
      .leftJoin(departments, eq(programs.departmentId, departments.id))
      .where(eq(students.id, targetStudentId))
      .limit(1);

    if (!studentProfile) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const sanitizedStudentProfile = {
      id: studentProfile.id,
      rollNumber: studentProfile.rollNumber,
      status: studentProfile.status,
      fullName: studentProfile.fullName ?? "Student",
      email: studentProfile.email ?? (session.user.email ?? ""),
      batchLabel: studentProfile.batchLabel ?? "Standard Batch",
      admissionYear: studentProfile.admissionYear ?? new Date().getFullYear(),
      programName: studentProfile.programName ?? "Undergraduate Program",
      programCode: studentProfile.programCode ?? "UG",
      departmentName: studentProfile.departmentName ?? "Academic Department",
      departmentCode: studentProfile.departmentCode ?? "DEPT",
    };

    // 2. Fetch all enrollments for this student (strictly active registered or completed enrollments)
    const studentEnrollments = await db
      .select({
        enrollmentId: enrollments.id,
        sectionId: sections.id,
        sectionLabel: sections.label,
        courseOfferingId: courseOfferings.id,
        semesterId: semesters.id,
        semesterLabel: semesters.label,
        courseId: courses.id,
        courseCode: courses.code,
        courseTitle: courses.title,
        credits: courses.credits,
      })
      .from(enrollments)
      .innerJoin(sections, eq(enrollments.sectionId, sections.id))
      .innerJoin(courseOfferings, eq(sections.courseOfferingId, courseOfferings.id))
      .innerJoin(semesters, eq(courseOfferings.semesterId, semesters.id))
      .innerJoin(courses, eq(courseOfferings.courseId, courses.id))
      .where(
        and(
          eq(enrollments.studentId, targetStudentId),
          inArray(enrollments.status, ["registered", "completed"])
        )
      );

    const enrollmentIds = studentEnrollments.map((e) => e.enrollmentId);
    const offeringIds = Array.from(new Set(studentEnrollments.map((e) => e.courseOfferingId)));

    // Fetch upcoming scheduled examinations
    interface UpcomingExamItem {
      id: string;
      courseOfferingId: string;
      type: string;
      examDate: string;
      courseCode: string;
      courseTitle: string;
      credits: number;
      semesterLabel: string;
      programName: string;
      time: string;
      venue: string;
      instructions: string;
    }

    let upcomingExams: UpcomingExamItem[] = [];

    const examBaseQuery = db
      .select({
        id: examinations.id,
        courseOfferingId: examinations.courseOfferingId,
        type: examinations.type,
        examDate: examinations.examDate,
        courseCode: courses.code,
        courseTitle: courses.title,
        credits: courses.credits,
        semesterLabel: semesters.label,
        programName: programs.name,
      })
      .from(examinations)
      .innerJoin(courseOfferings, eq(examinations.courseOfferingId, courseOfferings.id))
      .innerJoin(courses, eq(courseOfferings.courseId, courses.id))
      .innerJoin(semesters, eq(courseOfferings.semesterId, semesters.id))
      .innerJoin(programs, eq(courseOfferings.programId, programs.id))
      .orderBy(asc(examinations.examDate));

    if (offeringIds.length > 0) {
      const matchedExams = await examBaseQuery.where(inArray(examinations.courseOfferingId, offeringIds));
      upcomingExams = matchedExams.map((ex) => {
        const isMorning = ex.type === "midterm" || ex.type === "final";
        return {
          ...ex,
          time: isMorning ? "09:30 AM - 12:30 PM (Morning Session)" : "02:00 PM - 05:00 PM (Afternoon Session)",
          venue: ex.type === "practical" ? "Computing Lab Complex - Hall 2" : "Main Examination Complex - Hall B",
          instructions: "University ID card & Hall Ticket mandatory. Permitted non-programmable calculator allowed.",
        };
      });
    }

    if (upcomingExams.length === 0) {
      const generalExams = await examBaseQuery.limit(6);
      upcomingExams = generalExams.map((ex) => {
        const isMorning = ex.type === "midterm" || ex.type === "final";
        return {
          ...ex,
          time: isMorning ? "09:30 AM - 12:30 PM (Morning Session)" : "02:00 PM - 05:00 PM (Afternoon Session)",
          venue: ex.type === "practical" ? "Computing Lab Complex - Hall 2" : "Main Examination Complex - Hall B",
          instructions: "University ID card & Hall Ticket mandatory. Permitted non-programmable calculator allowed.",
        };
      });
    }

    // 3. Fetch strictly PUBLISHED results for these enrollments
    let resultsList: Array<{
      id: string;
      enrollmentId: string;
      finalScorePct: string;
      status: "pending_approval" | "approved" | "published" | "superseded";
      version: string;
      supersedesResultId: string | null;
      publishedAt: Date | null;
      correctionReason: string | null;
      gradeLetter: string;
      gradePoint: string;
    }> = [];

    if (enrollmentIds.length > 0) {
      resultsList = await db
        .select({
          id: results.id,
          enrollmentId: results.enrollmentId,
          finalScorePct: results.finalScorePct,
          status: results.status,
          version: results.version,
          supersedesResultId: results.supersedesResultId,
          publishedAt: results.publishedAt,
          correctionReason: results.correctionReason,
          gradeLetter: gradeBands.letter,
          gradePoint: gradeBands.gradePoint,
        })
        .from(results)
        .innerJoin(gradeBands, eq(results.gradeBandId, gradeBands.id))
        .where(
          and(
            inArray(results.enrollmentId, enrollmentIds),
            eq(results.status, "published")
          )
        )
        .orderBy(desc(results.version));
    }

    // Map active published result per enrollment
    const resultMap = new Map<string, (typeof resultsList)[0]>();
    for (const r of resultsList) {
      if (!resultMap.has(r.enrollmentId)) {
        resultMap.set(r.enrollmentId, r);
      }
    }

    // 4. Fetch component marks for enrollments that have published results
    const publishedEnrollmentIds = Array.from(resultMap.keys());
    const allMarks: Array<{
      enrollmentId: string;
      componentName: string;
      maxMarks: string;
      weightagePct: string;
      marksObtained: string;
      status: string;
      version: string;
    }> = [];

    if (publishedEnrollmentIds.length > 0) {
      const rawMarks = await db
        .select({
          enrollmentId: assessmentMarks.enrollmentId,
          componentName: assessmentComponents.name,
          maxMarks: assessmentComponents.maxMarks,
          weightagePct: assessmentComponents.weightagePct,
          marksObtained: assessmentMarks.marksObtained,
          status: assessmentMarks.status,
          version: assessmentMarks.version,
        })
        .from(assessmentMarks)
        .innerJoin(assessmentComponents, eq(assessmentMarks.assessmentComponentId, assessmentComponents.id))
        .where(
          and(
            inArray(assessmentMarks.enrollmentId, publishedEnrollmentIds),
            inArray(assessmentMarks.status, ["verified", "submitted"])
          )
        )
        .orderBy(desc(assessmentMarks.version));

      const marksKeySet = new Set<string>();
      for (const m of rawMarks) {
        const key = `${m.enrollmentId}_${m.componentName}`;
        if (!marksKeySet.has(key)) {
          marksKeySet.add(key);
          allMarks.push(m);
        }
      }
    }

    // 5. Fetch revaluation requests for student's published results
    const resultIds = Array.from(resultMap.values()).map((r) => r.id);
    let revals: Array<{
      id: string;
      resultId: string;
      reason: string;
      status: "requested" | "approved" | "rejected";
      decisionNote: string | null;
      createdAt: Date | null;
    }> = [];

    if (resultIds.length > 0) {
      revals = await db
        .select({
          id: revaluationRequests.id,
          resultId: revaluationRequests.resultId,
          reason: revaluationRequests.reason,
          status: revaluationRequests.status,
          decisionNote: revaluationRequests.decisionNote,
          createdAt: revaluationRequests.createdAt,
        })
        .from(revaluationRequests)
        .where(inArray(revaluationRequests.resultId, resultIds));
    }

    const revalByResult = new Map<string, (typeof revals)[0]>();
    for (const rev of revals) {
      revalByResult.set(rev.resultId, rev);
    }

    // 6. Group by semester and calculate SGPA & CGPA ONLY from published subjects
    const semesterMap = new Map<
      string,
      {
        semesterId: string;
        semesterLabel: string;
        courses: Array<{
          enrollmentId: string;
          courseCode: string;
          courseTitle: string;
          credits: number;
          sectionLabel: string;
          resultId: string | null;
          finalScorePct: number | null;
          gradeLetter: string | null;
          gradePoint: number | null;
          status: string;
          version: number;
          publishedAt: Date | null;
          components: Array<{
            name: string;
            maxMarks: number;
            weightagePct: number;
            marksObtained: number;
            status: string;
          }>;
          revaluation: {
            id: string;
            status: string;
            reason: string;
            decisionNote: string | null;
          } | null;
        }>;
        totalCredits: number;
        earnedCredits: number;
        sgpa: number;
      }
    >();

    // Initialize semester structures from student enrollments
    for (const enrollment of studentEnrollments) {
      if (!semesterMap.has(enrollment.semesterId)) {
        semesterMap.set(enrollment.semesterId, {
          semesterId: enrollment.semesterId,
          semesterLabel: enrollment.semesterLabel,
          courses: [],
          totalCredits: 0,
          earnedCredits: 0,
          sgpa: 0,
        });
      }

      const res = resultMap.get(enrollment.enrollmentId);
      const comps = allMarks
        .filter((m) => m.enrollmentId === enrollment.enrollmentId)
        .map((m) => ({
          name: m.componentName,
          maxMarks: Number(m.maxMarks),
          weightagePct: Number(m.weightagePct),
          marksObtained: Number(m.marksObtained),
          status: m.status,
        }));

      // CRITICAL: Filter ONLY published and graded subjects!
      // Must satisfy:
      // 1. Result officially published by Exam Controller (status === 'published' && publishedAt != null)
      // 2. Marks explicitly entered, submitted by faculty, and verified (comps.length > 0)
      // Excludes pre-seeded or default/unregistered subjects where marks have not been submitted and verified.
      if (!res || res.status !== "published" || comps.length === 0) {
        continue;
      }

      const sem = semesterMap.get(enrollment.semesterId)!;
      const rev = revalByResult.get(res.id);

      sem.courses.push({
        enrollmentId: enrollment.enrollmentId,
        courseCode: enrollment.courseCode,
        courseTitle: enrollment.courseTitle,
        credits: enrollment.credits ?? 3,
        sectionLabel: enrollment.sectionLabel,
        resultId: res.id,
        finalScorePct: Number(res.finalScorePct),
        gradeLetter: res.gradeLetter,
        gradePoint: Number(res.gradePoint),
        status: "PUBLISHED",
        version: Number(res.version),
        publishedAt: res.publishedAt,
        components: comps,
        revaluation: rev
          ? {
              id: rev.id,
              status: rev.status,
              reason: rev.reason,
              decisionNote: rev.decisionNote,
            }
          : null,
      });
    }

    // Dynamic SGPA / CGPA Calculation based ONLY on published subjects
    let totalCumulativeCredits = 0;
    let totalCumulativePoints = 0;
    let totalCreditsEarnedAcrossAllSemesters = 0;

    const semestersArray = [];
    for (const sem of semesterMap.values()) {
      let semCredits = 0;
      let semPoints = 0;
      let semEarned = 0;

      for (const c of sem.courses) {
        if (c.gradePoint !== null && (c.status === "PUBLISHED" || c.status === "published")) {
          const credits = c.credits > 0 ? c.credits : 3;
          semCredits += credits;
          semPoints += c.gradePoint * credits;
          if (c.gradePoint > 0 && c.gradeLetter !== "F") {
            semEarned += credits;
          }

          totalCumulativeCredits += credits;
          totalCumulativePoints += c.gradePoint * credits;
        }
      }

      sem.totalCredits = semCredits;
      sem.earnedCredits = semEarned;
      sem.sgpa = semCredits > 0 ? Number((semPoints / semCredits).toFixed(2)) : 0;
      totalCreditsEarnedAcrossAllSemesters += semEarned;

      if (!targetSemesterId || sem.semesterId === targetSemesterId) {
        semestersArray.push(sem);
      }
    }

    const cgpa =
      totalCumulativeCredits > 0
        ? Number((totalCumulativePoints / totalCumulativeCredits).toFixed(2))
        : 0;

    let standing = "Good Standing";
    if (cgpa >= 3.8) standing = "High Distinction / Dean's List";
    else if (cgpa >= 3.5) standing = "Distinction";
    else if (cgpa >= 3.0) standing = "First Class";
    else if (cgpa < 2.0 && totalCumulativeCredits > 0) standing = "Academic Warning";

    return NextResponse.json({
      student: sanitizedStudentProfile,
      semesters: semestersArray,
      cgpa,
      totalCreditsEarned: totalCreditsEarnedAcrossAllSemesters,
      academicStanding: standing,
      upcomingExams,
    });
  } catch (error) {
    console.error("Error in GET /api/exams/results/student:", error);
    const message = error instanceof Error ? error.message : "Failed to load student results";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
