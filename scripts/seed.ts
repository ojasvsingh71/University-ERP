/**
 * Seeds comprehensive reference + demo data for University ERP.
 * Includes all standard academic courses, offerings, enrollments, assessment templates,
 * examinations, verified marks, and published results for GPA/CGPA computation.
 *
 * Usage: npm run db:seed
 */
import "dotenv/config";
import { db } from "../src/db";
import {
  users,
  departments,
  programs,
  batches,
  academicYears,
  semesters,
  courses,
  courseOfferings,
  sections,
  students,
  faculty,
  facultyAssignments,
  enrollments,
  gradingPolicies,
  gradeBands,
  assessmentTemplates,
  assessmentComponents,
  assessmentMarks,
  examinations,
  results,
  revaluationRequests,
  feeStructures,
  feeComponents,
  invoices,
  payments,
  scholarships,
  attendanceRecords,
  notifications,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/password";

export async function runSeed() {
  console.log("Starting University ERP database seed...");

  // ---- Clean existing records in reverse dependency order for safe re-runs ----
  console.log("Cleaning previous records if any...");
  await db.delete(notifications).catch(() => {});
  await db.delete(attendanceRecords).catch(() => {});
  await db.delete(revaluationRequests).catch(() => {});
  await db.delete(results).catch(() => {});
  await db.delete(assessmentMarks).catch(() => {});
  await db.delete(examinations).catch(() => {});
  await db.delete(assessmentComponents).catch(() => {});
  await db.delete(assessmentTemplates).catch(() => {});
  await db.delete(gradeBands).catch(() => {});
  await db.delete(gradingPolicies).catch(() => {});
  await db.delete(payments).catch(() => {});
  await db.delete(scholarships).catch(() => {});
  await db.delete(invoices).catch(() => {});
  await db.delete(feeComponents).catch(() => {});
  await db.delete(feeStructures).catch(() => {});
  await db.delete(enrollments).catch(() => {});
  await db.delete(facultyAssignments).catch(() => {});
  await db.delete(sections).catch(() => {});
  await db.delete(courseOfferings).catch(() => {});
  await db.delete(courses).catch(() => {});
  await db.delete(students).catch(() => {});
  await db.delete(faculty).catch(() => {});
  await db.delete(batches).catch(() => {});
  await db.delete(semesters).catch(() => {});
  await db.delete(academicYears).catch(() => {});
  await db.delete(programs).catch(() => {});
  await db.delete(departments).catch(() => {});
  await db.delete(users).catch(() => {});

  // ---- 1. Identity: Demo accounts for every role ----
  const demoPassword = await hashPassword("Password123!");
  const [superAdmin, admin, registrar, hod, examCtrl, facultyUser, studentUser, parentUser] =
    await db
      .insert(users)
      .values([
        { email: "superadmin@erp.test", passwordHash: demoPassword, fullName: "Sam Super", role: "super_admin" },
        { email: "admin@erp.test", passwordHash: demoPassword, fullName: "Ava Admin", role: "university_admin" },
        { email: "registrar@erp.test", passwordHash: demoPassword, fullName: "Remy Registrar", role: "registrar" },
        { email: "hod@erp.test", passwordHash: demoPassword, fullName: "Hana HOD", role: "hod" },
        { email: "examctrl@erp.test", passwordHash: demoPassword, fullName: "Eli ExamCtrl", role: "examination_controller" },
        { email: "faculty@erp.test", passwordHash: demoPassword, fullName: "Fay Faculty", role: "faculty" },
        { email: "student@erp.test", passwordHash: demoPassword, fullName: "Stu Dent", role: "student" },
        { email: "parent@erp.test", passwordHash: demoPassword, fullName: "Pat Parent", role: "parent" },
      ])
      .returning();

  // ---- 2. Academic Structure ----
  const [csDept] = await db
    .insert(departments)
    .values({ name: "Computer Science", code: "CS" })
    .returning();

  const [csProgram] = await db
    .insert(programs)
    .values({ departmentId: csDept.id, name: "B.Tech Computer Science", code: "BTCS", durationYears: 4 })
    .returning();

  const [batch2026] = await db
    .insert(batches)
    .values({ programId: csProgram.id, admissionYear: 2026, label: "CS-2026" })
    .returning();

  const [ay2026] = await db
    .insert(academicYears)
    .values({ label: "2026-2027", startDate: "2026-08-01", endDate: "2027-05-31" })
    .returning();

  const [fall2026] = await db
    .insert(semesters)
    .values({ academicYearId: ay2026.id, label: "Fall 2026", startDate: "2026-08-01", endDate: "2026-12-20" })
    .returning();

  // ---- 3. People Profiles ----
  const [facultyProfile] = await db
    .insert(faculty)
    .values({ userId: facultyUser.id, employeeCode: "EMP-001", departmentId: csDept.id })
    .returning();

  const [studentProfile] = await db
    .insert(students)
    .values({ userId: studentUser.id, rollNumber: "CS26-0001", batchId: batch2026.id })
    .returning();

  // ---- 4. Grading Policy & Grade Bands ----
  const [policy] = await db
    .insert(gradingPolicies)
    .values({
      name: "CS Standard Absolute Grading",
      programId: csProgram.id,
      strategyType: "absolute",
      passingPct: "40.00",
      graceMarksMax: "2.00",
    })
    .returning();

  const createdGradeBands = await db
    .insert(gradeBands)
    .values([
      { gradingPolicyId: policy.id, letter: "A+", gradePoint: "4.00", minPct: "90.00", maxPct: "100.00" },
      { gradingPolicyId: policy.id, letter: "A", gradePoint: "3.70", minPct: "80.00", maxPct: "89.99" },
      { gradingPolicyId: policy.id, letter: "B", gradePoint: "3.30", minPct: "70.00", maxPct: "79.99" },
      { gradingPolicyId: policy.id, letter: "C", gradePoint: "3.00", minPct: "60.00", maxPct: "69.99" },
      { gradingPolicyId: policy.id, letter: "D", gradePoint: "2.00", minPct: "40.00", maxPct: "59.99" },
      { gradingPolicyId: policy.id, letter: "F", gradePoint: "0.00", minPct: "0.00", maxPct: "39.99" },
    ])
    .returning();

  const gradeBandMap = new Map<string, typeof createdGradeBands[0]>();
  for (const gb of createdGradeBands) {
    gradeBandMap.set(gb.letter, gb);
  }

  // ---- 5. Comprehensive Courses & Offerings ----
  // Specifically including requested subjects with proper codes and credits:
  // 1. Computer Networks (CS302, Credits: 4)
  // 2. Advanced Databases (CS303, Credits: 4)
  // 3. Deep Learning (CS401, Credits: 3)
  // 4. Problem Solving (CS101, Credits: 3)
  // plus Database Systems (CS301, Credits: 4)
  const courseConfigs = [
    {
      code: "CS101",
      title: "Problem Solving",
      credits: 3,
      components: [
        { name: "Programming Contests & Labs", maxMarks: "50", weightagePct: "20.00", studentMark: "48.00" },
        { name: "Midterm Examination", maxMarks: "30", weightagePct: "20.00", studentMark: "29.00" },
        { name: "Code Review & Efficiency", maxMarks: "20", weightagePct: "10.00", studentMark: "19.00" },
        { name: "End-Semester Examination", maxMarks: "100", weightagePct: "50.00", studentMark: "95.00" },
      ],
      midtermDate: "2026-10-24",
      finalDate: "2026-12-10",
      finalScorePct: "95.00",
      gradeLetter: "A+",
    },
    {
      code: "CS301",
      title: "Database Systems",
      credits: 4,
      components: [
        { name: "Assignment 1 (SQL Schemas)", maxMarks: "10", weightagePct: "10.00", studentMark: "9.00" },
        { name: "Midterm Examination", maxMarks: "30", weightagePct: "20.00", studentMark: "25.00" },
        { name: "Continuous Assessment / Attendance", maxMarks: "5", weightagePct: "5.00", studentMark: "4.50" },
        { name: "Final Examination", maxMarks: "100", weightagePct: "65.00", studentMark: "84.00" },
      ],
      midtermDate: "2026-10-28",
      finalDate: "2026-12-15",
      finalScorePct: "85.00",
      gradeLetter: "A",
    },
    {
      code: "CS302",
      title: "Computer Networks",
      credits: 4,
      components: [
        { name: "Lab Work & Packet Traces", maxMarks: "25", weightagePct: "15.00", studentMark: "23.50" },
        { name: "Midterm Examination", maxMarks: "30", weightagePct: "20.00", studentMark: "28.00" },
        { name: "Quizzes & Protocols", maxMarks: "10", weightagePct: "5.00", studentMark: "9.50" },
        { name: "End-Semester Final Exam", maxMarks: "100", weightagePct: "60.00", studentMark: "92.00" },
      ],
      midtermDate: "2026-11-02",
      finalDate: "2026-12-18",
      finalScorePct: "92.00",
      gradeLetter: "A+",
    },
    {
      code: "CS303",
      title: "Advanced Databases",
      credits: 4,
      components: [
        { name: "Project & Query Optimization", maxMarks: "30", weightagePct: "15.00", studentMark: "23.00" },
        { name: "Midterm Examination", maxMarks: "40", weightagePct: "20.00", studentMark: "31.00" },
        { name: "Seminar & Research Papers", maxMarks: "10", weightagePct: "5.00", studentMark: "8.00" },
        { name: "End-Semester Final Exam", maxMarks: "100", weightagePct: "60.00", studentMark: "78.00" },
      ],
      midtermDate: "2026-11-08",
      finalDate: "2026-12-22",
      finalScorePct: "78.00",
      gradeLetter: "B",
    },
    {
      code: "CS401",
      title: "Deep Learning",
      credits: 3,
      components: [
        { name: "Neural Model Implementation", maxMarks: "40", weightagePct: "20.00", studentMark: "35.50" },
        { name: "Midterm Examination", maxMarks: "30", weightagePct: "20.00", studentMark: "26.50" },
        { name: "Research Review & Presentation", maxMarks: "20", weightagePct: "10.00", studentMark: "18.00" },
        { name: "End-Semester Final Exam", maxMarks: "100", weightagePct: "50.00", studentMark: "88.00" },
      ],
      midtermDate: "2026-11-14",
      finalDate: "2026-12-24",
      finalScorePct: "88.00",
      gradeLetter: "A",
    },
  ];

  for (const c of courseConfigs) {
    // 5a. Insert Course
    const [insertedCourse] = await db
      .insert(courses)
      .values({
        code: c.code,
        title: c.title,
        credits: c.credits,
        departmentId: csDept.id,
      })
      .returning();

    // 5b. Insert Course Offering
    const [offering] = await db
      .insert(courseOfferings)
      .values({
        courseId: insertedCourse.id,
        programId: csProgram.id,
        semesterId: fall2026.id,
      })
      .returning();

    // 5c. Insert Section A
    const [section] = await db
      .insert(sections)
      .values({
        courseOfferingId: offering.id,
        label: "A",
        capacity: 60,
      })
      .returning();

    // 5d. Assign Faculty Fay Faculty to this section
    await db.insert(facultyAssignments).values({
      facultyId: facultyProfile.id,
      sectionId: section.id,
      assignmentRole: "primary",
    });

    // 5e. Enroll Student Stu Dent in this section
    const [enrollment] = await db
      .insert(enrollments)
      .values({
        studentId: studentProfile.id,
        sectionId: section.id,
        status: "registered",
      })
      .returning();

    // 5f. Assessment Template & Components
    const [template] = await db
      .insert(assessmentTemplates)
      .values({
        courseOfferingId: offering.id,
        gradingPolicyId: policy.id,
      })
      .returning();

    for (const comp of c.components) {
      const [insertedComp] = await db
        .insert(assessmentComponents)
        .values({
          assessmentTemplateId: template.id,
          name: comp.name,
          maxMarks: comp.maxMarks,
          weightagePct: comp.weightagePct,
        })
        .returning();

    }

    // 5g. Examinations: Left empty so the Exam Controller explicitly schedules them via the portal.

    // 5h. Published Result for this enrollment
    const matchedBand = gradeBandMap.get(c.gradeLetter) || createdGradeBands[0];
    await db.insert(results).values({
      enrollmentId: enrollment.id,
      finalScorePct: c.finalScorePct,
      gradeBandId: matchedBand.id,
      status: "published",
      version: "1",
      approvedByUserId: examCtrl.id,
      publishedAt: new Date(),
    });
  }

  // ---- 6. Fee & Payment Structure ----
  const [feeStructure] = await db
    .insert(feeStructures)
    .values({ programId: csProgram.id, semesterId: fall2026.id, name: "BTCS - Fall 2026 Fees" })
    .returning();

  await db.insert(feeComponents).values([
    { feeStructureId: feeStructure.id, name: "Tuition", amount: "2500.00" },
    { feeStructureId: feeStructure.id, name: "Lab Fee", amount: "150.00" },
    { feeStructureId: feeStructure.id, name: "Library Fee", amount: "50.00" },
  ]);

  await db.insert(invoices).values({
    studentId: studentProfile.id,
    semesterId: fall2026.id,
    feeStructureId: feeStructure.id,
    totalAmount: "2700.00",
    payableAmount: "2700.00",
    status: "issued",
    dueDate: "2026-09-15",
  });

  console.log("Seeding completed successfully!");
  console.log("\n--- Seeded Course Offerings ---");
  for (const c of courseConfigs) {
    console.log(`• ${c.code.padEnd(8)}: ${c.title.padEnd(25)} (${c.credits} Credits)`);
  }

  console.log("\n--- Demo Accounts (Password: Password123!) ---");
  console.log(
    [superAdmin, admin, registrar, hod, examCtrl, facultyUser, studentUser, parentUser]
      .map((u) => `  ${u.role.padEnd(24)} ${u.email}`)
      .join("\n")
  );
}

// Direct CLI invocation
if (require.main === module || process.argv[1]?.includes("seed")) {
  runSeed()
    .then(() => {
      console.log("Done.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
