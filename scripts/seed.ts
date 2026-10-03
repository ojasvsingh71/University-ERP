/**
 * Seeds minimal reference + demo data so the four modules can be exercised immediately
 * after `npm run db:migrate`. Safe to re-run against a fresh database only (uses plain
 * inserts, not upserts) — wipe the DB first if re-seeding.
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
  feeStructures,
  feeComponents,
  invoices,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/password";

async function main() {
  console.log("Seeding University ERP foundation data...");

  // ---- Identity: one account per role so every module can be smoke-tested immediately ----
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

  // ---- Academic Structure ----
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

  const [dbCourse] = await db
    .insert(courses)
    .values({ code: "CS301", title: "Database Systems", credits: 4, departmentId: csDept.id })
    .returning();

  const [dbOffering] = await db
    .insert(courseOfferings)
    .values({ courseId: dbCourse.id, programId: csProgram.id, semesterId: fall2026.id })
    .returning();

  const [sectionA] = await db
    .insert(sections)
    .values({ courseOfferingId: dbOffering.id, label: "A", capacity: 60 })
    .returning();

  // ---- People ----
  const [facultyProfile] = await db
    .insert(faculty)
    .values({ userId: facultyUser.id, employeeCode: "EMP-001", departmentId: csDept.id })
    .returning();

  await db.insert(facultyAssignments).values({
    facultyId: facultyProfile.id,
    sectionId: sectionA.id,
    assignmentRole: "primary",
  });

  const [studentProfile] = await db
    .insert(students)
    .values({ userId: studentUser.id, rollNumber: "CS26-0001", batchId: batch2026.id })
    .returning();

  // ---- Enrollment ----
  await db
    .insert(enrollments)
    .values({ studentId: studentProfile.id, sectionId: sectionA.id, status: "registered" });

  // ---- Assessment & Grading configuration (configurable, not hard-coded — Master Plan §18) ----
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

  await db.insert(gradeBands).values([
    { gradingPolicyId: policy.id, letter: "A+", gradePoint: "4.00", minPct: "90.00", maxPct: "100.00" },
    { gradingPolicyId: policy.id, letter: "A", gradePoint: "3.70", minPct: "80.00", maxPct: "89.99" },
    { gradingPolicyId: policy.id, letter: "B", gradePoint: "3.30", minPct: "70.00", maxPct: "79.99" },
    { gradingPolicyId: policy.id, letter: "C", gradePoint: "3.00", minPct: "60.00", maxPct: "69.99" },
    { gradingPolicyId: policy.id, letter: "D", gradePoint: "2.00", minPct: "40.00", maxPct: "59.99" },
    { gradingPolicyId: policy.id, letter: "F", gradePoint: "0.00", minPct: "0.00", maxPct: "39.99" },
  ]);

  const [template] = await db
    .insert(assessmentTemplates)
    .values({ courseOfferingId: dbOffering.id, gradingPolicyId: policy.id })
    .returning();

  await db.insert(assessmentComponents).values([
    { assessmentTemplateId: template.id, name: "Assignment 1", maxMarks: "10", weightagePct: "10.00" },
    { assessmentTemplateId: template.id, name: "Midterm", maxMarks: "30", weightagePct: "20.00" },
    { assessmentTemplateId: template.id, name: "Attendance", maxMarks: "5", weightagePct: "5.00" },
    { assessmentTemplateId: template.id, name: "Final Exam", maxMarks: "100", weightagePct: "65.00" },
  ]); // sums to 100% — enforced at the application layer on save, see BR-01

  // ---- Fee & Payment Management ----
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

  console.log("Seed complete. Demo accounts (password: Password123!):");
  console.log(
    [superAdmin, admin, registrar, hod, examCtrl, facultyUser, studentUser, parentUser]
      .map((u) => `  ${u.role.padEnd(22)} ${u.email}`)
      .join("\n")
  );
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
