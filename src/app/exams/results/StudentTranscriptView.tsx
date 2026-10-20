"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GraduationCap,
  Award,
  BookOpen,
  Printer,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  CalendarDays,
  Clock,
  MapPin,
  FileText,
  Info,
} from "lucide-react";

interface ComponentDetail {
  name: string;
  maxMarks: number;
  weightagePct: number;
  marksObtained: number;
  status: string;
}

interface CourseResult {
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
  publishedAt: string | null;
  components: ComponentDetail[];
  revaluation: {
    id: string;
    status: string;
    reason: string;
    decisionNote: string | null;
  } | null;
}

interface SemesterData {
  semesterId: string;
  semesterLabel: string;
  courses: CourseResult[];
  totalCredits: number;
  earnedCredits: number;
  sgpa: number;
}

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

interface StudentMasterProfile {
  id: string;
  rollNumber: string;
  status: string;
  fullName: string;
  email: string;
  batchLabel: string;
  admissionYear: number;
  programName: string;
  programCode: string;
  departmentName: string;
  departmentCode: string;
}

export default function StudentTranscriptView() {
  const [student, setStudent] = useState<StudentMasterProfile | null>(null);
  const [semesters, setSemesters] = useState<SemesterData[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<UpcomingExamItem[]>([]);
  const [cgpa, setCgpa] = useState<number>(0);
  const [totalCreditsEarned, setTotalCreditsEarned] = useState<number>(0);
  const [academicStanding, setAcademicStanding] = useState<string>("Good Standing");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");

  // Portal view toggle: Results vs Exam Timetable
  const [portalTab, setPortalTab] = useState<"results" | "schedule">("results");

  const [loading, setLoading] = useState(true);
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});

  // Revaluation modal
  const [revalModalOpen, setRevalModalOpen] = useState(false);
  const [revalTargetCourse, setRevalTargetCourse] = useState<CourseResult | null>(null);
  const [revalReason, setRevalReason] = useState("");
  const [isSubmittingReval, setIsSubmittingReval] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showMsg = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  const fetchStudentResults = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/exams/results/student");
      if (res.ok) {
        const data = await res.json();
        setStudent(data.student);
        setSemesters(data.semesters || []);
        setUpcomingExams(data.upcomingExams || []);
        setCgpa(data.cgpa || 0);
        setTotalCreditsEarned(data.totalCreditsEarned || 0);
        setAcademicStanding(data.academicStanding || "Good Standing");

        if (data.semesters?.length > 0) {
          setSelectedSemesterId(data.semesters[0].semesterId);
        }
      } else {
        const err = await res.json();
        showMsg("error", err.error || "Failed to load results");
      }
    } catch {
      showMsg("error", "Error loading transcript data");
    } finally {
      setLoading(false);
    }
  }, [showMsg]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStudentResults();
  }, [fetchStudentResults]);

  const toggleExpand = (courseCode: string) => {
    setExpandedCourses((prev) => ({
      ...prev,
      [courseCode]: !prev[courseCode],
    }));
  };

  const currentSemester = semesters.find((s) => s.semesterId === selectedSemesterId) || semesters[0];

  const handleApplyRevaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revalTargetCourse?.resultId) return;

    try {
      setIsSubmittingReval(true);
      const res = await fetch("/api/exams/results/revaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultId: revalTargetCourse.resultId,
          reason: revalReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit revaluation");

      showMsg("success", "Revaluation application submitted to Exam Controller!");
      setRevalModalOpen(false);
      setRevalReason("");
      void fetchStudentResults();
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : "Failed to submit request";
      showMsg("error", errText);
    } finally {
      setIsSubmittingReval(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <GraduationCap className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Academic Results &amp; Examination Portal</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official semester grade cards, upcoming exam schedules, SGPA/CGPA, and verified transcripts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print / Save PDF</span>
          </button>
          <button
            onClick={() => void fetchStudentResults()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl text-xs font-medium border animate-in fade-in print:hidden ${message.type === "success"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-2" />
          Loading student transcript &amp; records...
        </div>
      ) : !student ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No student profile found for this user account.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Official University Header Card */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/20 shrink-0">
                  <GraduationCap className="h-8 w-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {student.fullName}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active Student
                    </span>
                  </div>
                  <p className="text-xs font-mono font-semibold text-indigo-600 mt-0.5">
                    Roll No: {student.rollNumber}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {student.programName} ({student.programCode}) &bull; {student.batchLabel}
                  </p>
                  <p className="text-xs text-slate-400">
                    Department of {student.departmentName}
                  </p>
                </div>
              </div>

              {/* Cumulative Metrics Box */}
              <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 text-center min-w-[110px]">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                    Cumulative CGPA
                  </span>
                  <span className="text-2xl font-black text-indigo-600 block mt-0.5">
                    {cgpa.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold block">Scale of 4.00</span>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 text-center min-w-[110px]">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                    Credits Earned
                  </span>
                  <span className="text-2xl font-black text-slate-800 block mt-0.5">
                    {totalCreditsEarned}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold block">Total Units</span>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-center min-w-[130px]">
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide block">
                    Academic Standing
                  </span>
                  <span className="text-xs font-extrabold text-emerald-700 block mt-2">
                    {academicStanding}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
                    Good Standing
                  </span>
                </div>
              </div>
            </div>

            {/* Verification Seal Banner */}
            <div className="flex items-center justify-between pt-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                <span>Digitally Verified University Examination Records</span>
              </div>
              <span className="font-mono text-[11px]">System Timestamp: {new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* Main Navigation Tabs: Transcripts vs Exam Timetable */}
          <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-bold print:hidden">
            <button
              onClick={() => setPortalTab("results")}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${portalTab === "results"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              <FileText className="h-4 w-4" />
              <span>Published Results &amp; Transcripts</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-600">
                {semesters.filter((s) => s.courses && s.courses.length > 0).length}{" "}
                {semesters.filter((s) => s.courses && s.courses.length > 0).length === 1 ? "Term" : "Terms"}
              </span>
            </button>

            <button
              onClick={() => setPortalTab("schedule")}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${portalTab === "schedule"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              <CalendarDays className="h-4 w-4" />
              <span>Upcoming Scheduled Examinations</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-[10px] text-indigo-800 font-bold">
                {upcomingExams.length}
              </span>
            </button>
          </div>

          {/* VIEW 1: UPCOMING SCHEDULED EXAMINATIONS TAB */}
          {portalTab === "schedule" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header Box */}
              <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/70 via-white to-slate-50 p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100/80 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800 mb-2 border border-indigo-200">
                      <CalendarDays className="h-3 w-3" />
                      <span>Official Timetable</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Upcoming Scheduled Examinations Timetable
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Check your examination schedule, session reporting times, designated venues, and hall guidelines.
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-500 block">Total Scheduled</span>
                    <span className="text-2xl font-black text-indigo-600">
                      {upcomingExams.length} Papers
                    </span>
                  </div>
                </div>
              </div>

              {/* Scheduled Exams Cards / Grid */}
              {upcomingExams.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400 shadow-xs">
                  <CalendarDays className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-semibold text-sm">No examinations currently scheduled</p>
                  <p className="mt-1 text-slate-400">
                    Timetables will appear here once finalized by the Examination Controller.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingExams.map((exam) => {
                    const examDateObj = new Date(exam.examDate);
                    const formattedDate = !isNaN(examDateObj.getTime())
                      ? examDateObj.toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                      : exam.examDate;

                    return (
                      <div
                        key={exam.id}
                        className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between space-y-4"
                      >
                        {/* Top: Course & Type */}
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {exam.type} Examination
                            </span>
                            <span className="text-xs font-mono font-semibold text-slate-400">
                              {exam.credits} Credits
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-slate-900 leading-snug">
                            {exam.courseCode} &mdash; {exam.courseTitle}
                          </h4>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            {exam.semesterLabel} &bull; {exam.programName}
                          </span>
                        </div>

                        {/* Mid: Date, Time & Venue */}
                        <div className="space-y-2 rounded-xl bg-slate-50/80 p-3 border border-slate-100 text-xs">
                          <div className="flex items-center gap-2 text-slate-700">
                            <CalendarDays className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span className="font-bold text-slate-900">{formattedDate}</span>
                          </div>

                          <div className="flex items-center gap-2 text-slate-600">
                            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                            <span>{exam.time}</span>
                          </div>

                          <div className="flex items-center gap-2 text-slate-600">
                            <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="font-medium text-slate-800">{exam.venue}</span>
                          </div>
                        </div>

                        {/* Bottom: Instructions */}
                        <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
                          <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <p className="line-clamp-2">{exam.instructions}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: PUBLISHED RESULTS & TRANSCRIPTS TAB */}
          {portalTab === "results" && (
            <div className="space-y-6">
              {/* Upcoming Examination Quick-Alert Banner (if exams exist) */}
              {upcomingExams.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/80 shadow-2xs print:hidden">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-xs">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-indigo-950 block">
                        Upcoming Examination Notification ({upcomingExams.length} Papers Scheduled)
                      </span>
                      <span className="text-xs text-indigo-700">
                        Next: {upcomingExams[0].courseCode} ({upcomingExams[0].type.toUpperCase()}) on {upcomingExams[0].examDate} &bull; {upcomingExams[0].venue}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setPortalTab("schedule")}
                    className="self-start sm:self-auto px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors whitespace-nowrap"
                  >
                    View Timetable
                  </button>
                </div>
              )}

              {/* Semester Selector Tabs */}
              {semesters.length > 1 && (
                <div className="flex border-b border-slate-200 gap-2 print:hidden">
                  {semesters.map((s) => (
                    <button
                      key={s.semesterId}
                      onClick={() => setSelectedSemesterId(s.semesterId)}
                      className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                        (selectedSemesterId === s.semesterId || (!selectedSemesterId && s.semesterId === currentSemester?.semesterId))
                          ? "border-indigo-600 text-indigo-600"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <span>{s.semesterLabel}</span>
                      {s.courses.length > 0 ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                          {s.courses.length} {s.courses.length === 1 ? "Subject" : "Subjects"}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-500 font-normal">
                          Pending
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Current Semester Grade Card OR Clean Empty State */}
              {!currentSemester || currentSemester.courses.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
                    <AlertCircle className="h-7 w-7" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-slate-900">
                      No published grade sheets available for this semester yet
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      Subject-wise marks and official grades will appear here as soon as assessment marks have been entered by faculty, verified, and officially published by the Examination Controller.
                    </p>
                  </div>
                  {upcomingExams.length > 0 && (
                    <div className="pt-2">
                      <button
                        onClick={() => setPortalTab("schedule")}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors"
                      >
                        <CalendarDays className="h-4 w-4" />
                        <span>View Upcoming Examination Timetable</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-indigo-600" />
                        <span>{currentSemester.semesterLabel} &mdash; Course Grade Sheet</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Subject-wise examination marks, weighted evaluations, and letter grade awards.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-baseline gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900">
                        <span className="text-xs font-semibold">Semester SGPA:</span>
                        <span className="text-base font-black text-indigo-700">
                          {currentSemester.sgpa.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Courses Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/60">
                          <th className="py-2.5 px-3">Course Code</th>
                          <th className="py-2.5 px-3">Course Title</th>
                          <th className="py-2.5 px-3 text-center">Credits</th>
                          <th className="py-2.5 px-3 text-center">Score %</th>
                          <th className="py-2.5 px-3 text-center">Grade</th>
                          <th className="py-2.5 px-3 text-center">Grade Point</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right print:hidden">Breakdown / Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {currentSemester.courses.map((course) => {
                          const isExpanded = expandedCourses[course.courseCode] ?? false;

                          return (
                            <tr key={course.enrollmentId} className="group hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                                {course.courseCode}
                              </td>
                              <td className="py-3 px-3 font-medium text-slate-800">
                                {course.courseTitle}
                                <span className="text-slate-400 text-[11px] block">
                                  Section {course.sectionLabel}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center font-semibold text-slate-800">
                                {course.credits}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-indigo-600">
                                {course.finalScorePct !== null ? `${course.finalScorePct.toFixed(2)}%` : "—"}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {course.gradeLetter ? (
                                  <span
                                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-black ${course.gradeLetter === "F"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-emerald-100 text-emerald-800"
                                      }`}
                                  >
                                    {course.gradeLetter}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                                {course.gradePoint !== null ? course.gradePoint.toFixed(2) : "—"}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${course.status?.toUpperCase() === "PUBLISHED"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                    }`}
                                >
                                  {course.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right print:hidden">
                                <div className="flex items-center justify-end gap-2">
                                  {course.components.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleExpand(course.courseCode)}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
                                    >
                                      <span>Components</span>
                                      {isExpanded ? (
                                        <ChevronUp className="h-3 w-3" />
                                      ) : (
                                        <ChevronDown className="h-3 w-3" />
                                      )}
                                    </button>
                                  )}

                                  {course.status?.toUpperCase() === "PUBLISHED" && !course.revaluation && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRevalTargetCourse(course);
                                        setRevalModalOpen(true);
                                      }}
                                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline ml-1"
                                    >
                                      Apply Revaluation
                                    </button>
                                  )}

                                  {course.revaluation && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      Reval: {course.revaluation.status}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Expandable Component Breakdowns */}
                  {currentSemester.courses.some((c) => expandedCourses[c.courseCode]) && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                      <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                        Assessment Component Breakdown Details
                      </h4>
                      {currentSemester.courses
                        .filter((c) => expandedCourses[c.courseCode])
                        .map((course) => (
                          <div key={course.courseCode} className="bg-white rounded-lg p-3 border border-indigo-100 text-xs">
                            <span className="font-bold text-slate-900 block mb-2">
                              {course.courseCode} &mdash; {course.courseTitle}
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {course.components.map((comp) => (
                                <div key={comp.name} className="p-2 rounded bg-slate-50 border border-slate-100">
                                  <span className="font-semibold text-slate-700 block text-[11px]">
                                    {comp.name}
                                  </span>
                                  <span className="font-bold text-indigo-600 text-xs mt-0.5 block">
                                    {comp.marksObtained} / {comp.maxMarks}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    Weightage: {comp.weightagePct}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Semester Summary Banner */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <span className="font-bold text-slate-900 block">
                        Semester SGPA Calculation Formula
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        SGPA = &sum; (Published Course Credits &times; Grade Points) / Total Credits of Published Courses
                      </span>
                    </div>

                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Registered Units</span>
                        <span className="text-sm font-bold text-slate-800">
                          {currentSemester.totalCredits} Credits
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Credits Earned</span>
                        <span className="text-sm font-bold text-emerald-700">
                          {currentSemester.earnedCredits} Credits
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">SGPA</span>
                        <span className="text-lg font-black text-indigo-600">
                          {currentSemester.sgpa.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Revaluation Modal */}
      {revalModalOpen && revalTargetCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Award className="h-5 w-5 text-indigo-600" />
              <span>Apply for Result Revaluation</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Request re-evaluation of your final published grade for{" "}
              <strong>{revalTargetCourse.courseCode} &mdash; {revalTargetCourse.courseTitle}</strong>.
            </p>

            <form onSubmit={handleApplyRevaluation} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Revaluation
                </label>
                <textarea
                  rows={3}
                  value={revalReason}
                  onChange={(e) => setRevalReason(e.target.value)}
                  placeholder="Explain your grounds for re-evaluation (e.g. discrepancy in question 4 totaling, missed practical component)..."
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRevalModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReval || revalReason.trim().length < 5}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
