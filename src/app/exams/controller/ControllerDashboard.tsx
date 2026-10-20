"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  FileCheck2,
  Calculator,
  Lock,
  RefreshCw,
  AlertCircle,
  Check,
  ShieldCheck,
  Award,
  Sparkles,
} from "lucide-react";

interface Offering {
  id: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  semesterId: string;
  semesterLabel: string;
  programName: string;
  policyName: string | null;
  passingPct: string | null;
  graceMarksMax: string | null;
}

interface ExaminationItem {
  id: string;
  type: string;
  examDate: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  semesterLabel: string;
  programName: string;
}

interface MarkVerificationItem {
  markId: string;
  marksObtained: string;
  status: "draft" | "submitted" | "verified" | "rejected";
  version: string;
  rejectionReason: string | null;
  componentName: string;
  maxMarks: string;
  weightagePct: string;
  courseCode: string;
  courseTitle: string;
  sectionLabel: string;
  studentRollNumber: string;
  studentName: string;
  studentEmail: string;
  createdAt: string;
}

interface ComputedResultPreview {
  enrollmentId: string;
  rollNumber: string;
  fullName: string;
  finalScorePct: number;
  gradeLetter: string;
  gradePoint: number;
  appliedGrace: number;
}

interface PublishedResultItem {
  resultId: string;
  studentRollNumber: string;
  studentName: string;
  courseCode: string;
  courseTitle: string;
  finalScorePct: string;
  gradeLetter: string;
  gradePoint: string;
  status: string;
  version: string;
  publishedAt: string | null;
}

interface RevalItem {
  id: string;
  studentRollNumber: string;
  studentName: string;
  courseCode: string;
  courseTitle: string;
  reason: string;
  status: "requested" | "approved" | "rejected";
  decisionNote: string | null;
  createdAt: string;
}

export default function ControllerDashboard() {
  const [activeTab, setActiveTab] = useState<
    "schedule" | "verify" | "compute" | "publish" | "revaluation"
  >("schedule");

  // Options & Metadata
  const [offerings, setOfferings] = useState<Offering[]>([]);

  // Tab 1: Schedules
  const [examinations, setExaminations] = useState<ExaminationItem[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [selectedExamType, setSelectedExamType] = useState<
    "midterm" | "final" | "practical" | "viva" | "supplementary"
  >("midterm");
  const [examDate, setExamDate] = useState("2026-10-25");
  const [isScheduling, setIsScheduling] = useState(false);

  // Tab 2: Verification
  const [marksToVerify, setMarksToVerify] = useState<MarkVerificationItem[]>([]);
  const [verifyFilter, setVerifyFilter] = useState<string>("submitted");
  const [selectedMarkIds, setSelectedMarkIds] = useState<string[]>([]);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Tab 3: Computation
  const [computeOfferingId, setComputeOfferingId] = useState("");
  const [applyGrace, setApplyGrace] = useState(true);
  const [isComputing, setIsComputing] = useState(false);
  const [computedPreview, setComputedPreview] = useState<{
    count: number;
    distribution: Record<string, number>;
    results: ComputedResultPreview[];
  } | null>(null);

  // Tab 4: Publication
  const [publishOfferingId, setPublishOfferingId] = useState("");
  const [publishedLedger, setPublishedLedger] = useState<PublishedResultItem[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  // Tab 5: Revaluation
  const [revalRequests, setRevalRequests] = useState<RevalItem[]>([]);
  const [revalModalOpen, setRevalModalOpen] = useState(false);
  const [selectedRevalId, setSelectedRevalId] = useState("");
  const [revalAction, setRevalAction] = useState<"approved" | "rejected">("approved");
  const [revalDecisionNote, setRevalDecisionNote] = useState("");
  const [isDecidingReval, setIsDecidingReval] = useState(false);

  // Status banners
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showMsg = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/exams/options");
      if (res.ok) {
        const data = await res.json();
        setOfferings(data.offerings || []);
        if (data.offerings?.length > 0) {
          setSelectedOfferingId(data.offerings[0].id);
          setComputeOfferingId(data.offerings[0].id);
          setPublishOfferingId(data.offerings[0].id);
        }
      }
    } catch {
      showMsg("error", "Failed to load options");
    }
  }, [showMsg]);

  const fetchExaminations = useCallback(async () => {
    try {
      const res = await fetch("/api/exams/schedule");
      if (res.ok) {
        const data = await res.json();
        setExaminations(data.examinations || []);
      }
    } catch {
      console.error("Error fetching exams");
    }
  }, []);

  const fetchMarksForVerification = useCallback(async (status = verifyFilter) => {
    try {
      const res = await fetch(`/api/exams/verify?status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setMarksToVerify(data.marks || []);
        setSelectedMarkIds([]);
      }
    } catch {
      console.error("Error fetching marks for verification");
    }
  }, [verifyFilter]);

  const fetchPublishedResults = useCallback(async (offeringId: string) => {
    if (!offeringId) return;
    try {
      const res = await fetch(`/api/exams/compute?courseOfferingId=${offeringId}`);
      if (res.ok) {
        const data = await res.json();
        setPublishedLedger(data.results || []);
      }
    } catch {
      console.error("Error fetching published ledger");
    }
  }, []);

  const fetchRevalRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/exams/results/revaluation");
      if (res.ok) {
        const data = await res.json();
        setRevalRequests(data.requests || []);
      }
    } catch {
      console.error("Error fetching revaluation requests");
    }
  }, []);

  // Initial load
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOptions();
    void fetchExaminations();
    void fetchMarksForVerification("submitted");
    void fetchRevalRequests();
  }, [fetchOptions, fetchExaminations, fetchMarksForVerification, fetchRevalRequests]);

  // Tab 1 Action: Schedule Exam
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferingId) {
      showMsg("error", "Please select a course offering");
      return;
    }

    try {
      setIsScheduling(true);
      const res = await fetch("/api/exams/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseOfferingId: selectedOfferingId,
          type: selectedExamType,
          examDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule examination");

      showMsg("success", "Examination scheduled successfully!");
      void fetchExaminations();
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : "Failed to schedule examination";
      showMsg("error", errText);
    } finally {
      setIsScheduling(false);
    }
  };

  // Tab 2 Action: Verify Marks
  const handleVerifyBatch = async (action: "verify" | "reject", reason?: string) => {
    if (selectedMarkIds.length === 0) {
      showMsg("error", "Please select at least one mark to verify or reject");
      return;
    }

    try {
      setIsVerifying(true);
      const res = await fetch("/api/exams/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markIds: selectedMarkIds,
          action,
          rejectionReason: reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      showMsg(
        "success",
        `Marks successfully ${action === "verify" ? "verified" : "rejected"} (${data.count} rows)`
      );
      setRejectionModalOpen(false);
      setRejectionReason("");
      void fetchMarksForVerification(verifyFilter);
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : "Failed to process marks";
      showMsg("error", errText);
    } finally {
      setIsVerifying(false);
    }
  };

  // Tab 3 Action: Compute Results
  const handleComputeResults = async () => {
    if (!computeOfferingId) {
      showMsg("error", "Please select a course offering to compute results");
      return;
    }

    try {
      setIsComputing(true);
      const res = await fetch("/api/exams/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseOfferingId: computeOfferingId,
          applyGraceMarks: applyGrace,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Grade computation failed");

      setComputedPreview({
        count: data.computedCount,
        distribution: data.gradeDistribution,
        results: data.results || [],
      });
      showMsg("success", `Computed results for ${data.computedCount} enrolled students!`);
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : "Failed to compute results";
      showMsg("error", errText);
    } finally {
      setIsComputing(false);
    }
  };

  // Tab 4 Action: Publish Results
  const handlePublishResults = async () => {
    if (!publishOfferingId) {
      showMsg("error", "Please select a course offering to publish results");
      return;
    }

    if (!confirm("Are you sure? Once published, these results are immutably locked and can NEVER be changed in place.")) {
      return;
    }

    try {
      setIsPublishing(true);
      const res = await fetch("/api/exams/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseOfferingId: publishOfferingId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publication failed");

      showMsg("success", `Successfully published and locked ${data.publishedCount} results!`);
      void fetchPublishedResults(publishOfferingId);
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : "Failed to publish results";
      showMsg("error", errText);
    } finally {
      setIsPublishing(false);
    }
  };

  // Tab 5 Action: Revaluation Decision
  const handleDecideReval = async () => {
    try {
      setIsDecidingReval(true);
      const res = await fetch("/api/exams/results/revaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selectedRevalId,
          action: revalAction,
          decisionNote: revalDecisionNote,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to decide revaluation");

      showMsg("success", `Revaluation request ${revalAction}!`);
      setRevalModalOpen(false);
      setRevalDecisionNote("");
      void fetchRevalRequests();
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : "Error processing revaluation";
      showMsg("error", errText);
    } finally {
      setIsDecidingReval(false);
    }
  };

  const selectedOfferingObj = offerings.find((o) => o.id === computeOfferingId);

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Exam Controller Portal</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            End-to-end examination management: Scheduling, marks verification, GPA computation, and immutable publication.
          </p>
        </div>

        {/* Global Action Refresh */}
        <button
          onClick={() => {
            void fetchOptions();
            void fetchExaminations();
            void fetchMarksForVerification(verifyFilter);
            void fetchRevalRequests();
            if (publishOfferingId) void fetchPublishedResults(publishOfferingId);
          }}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          <span>Sync Data</span>
        </button>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl text-xs font-medium border animate-in fade-in ${
            message.type === "success"
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

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("schedule")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "schedule"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          <span>1. Exam Schedules</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-600">
            {examinations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("verify")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "verify"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>2. Marks Verification</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-[10px] text-amber-800">
            {marksToVerify.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("compute")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "compute"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calculator className="h-4 w-4" />
          <span>3. Grade Computation</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("publish");
            if (publishOfferingId) void fetchPublishedResults(publishOfferingId);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "publish"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Lock className="h-4 w-4" />
          <span>4. Publication &amp; Locking</span>
        </button>

        <button
          onClick={() => setActiveTab("revaluation")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "revaluation"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileCheck2 className="h-4 w-4" />
          <span>5. Revaluation Requests</span>
          <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-[10px] text-indigo-800">
            {revalRequests.length}
          </span>
        </button>
      </div>

      {/* TAB 1: SCHEDULE EXAMS */}
      {activeTab === "schedule" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Schedule Form */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-indigo-600" />
              <span>Schedule New Examination</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Add upcoming midterm, final, or supplementary exams to the university calendar.
            </p>

            <form onSubmit={handleCreateSchedule} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Course Offering
                </label>
                <select
                  value={selectedOfferingId}
                  onChange={(e) => setSelectedOfferingId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {offerings.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.courseCode} - {off.courseTitle} ({off.semesterLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Examination Type
                </label>
                <select
                  value={selectedExamType}
                  onChange={(e) =>
                    setSelectedExamType(
                      e.target.value as "midterm" | "final" | "practical" | "viva" | "supplementary"
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="midterm">Midterm Examination</option>
                  <option value="final">Final Examination</option>
                  <option value="practical">Practical / Lab Exam</option>
                  <option value="viva">Viva Voce</option>
                  <option value="supplementary">Supplementary Examination</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Examination Date
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isScheduling}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors shadow-xs disabled:opacity-50"
              >
                {isScheduling ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Scheduling...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Schedule Examination</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Scheduled Exams List */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Scheduled Examination Timetable</h3>
                <p className="text-xs text-slate-500">Live examination records loaded from database.</p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {examinations.length} Scheduled
              </span>
            </div>

            {examinations.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <CalendarDays className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                No examinations scheduled yet. Use the form to add one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/60">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Course</th>
                      <th className="py-2.5 px-3">Semester</th>
                      <th className="py-2.5 px-3">Program</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {examinations.map((ex) => (
                      <tr key={ex.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                          {ex.examDate}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              ex.type === "final"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : ex.type === "midterm"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            {ex.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900">{ex.courseCode}</span>
                          <span className="text-slate-500 block truncate max-w-[200px]">
                            {ex.courseTitle}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">{ex.semesterLabel}</td>
                        <td className="py-2.5 px-3 text-slate-500">{ex.programName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MARKS VERIFICATION */}
      {activeTab === "verify" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top Actions & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Filter Status:</span>
              <div className="flex gap-1">
                {(["submitted", "verified", "rejected", "all"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setVerifyFilter(st);
                      void fetchMarksForVerification(st);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      verifyFilter === st
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleVerifyBatch("verify")}
                disabled={selectedMarkIds.length === 0 || isVerifying}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-40 transition-colors shadow-2xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Verify Selected ({selectedMarkIds.length})</span>
              </button>

              <button
                onClick={() => setRejectionModalOpen(true)}
                disabled={selectedMarkIds.length === 0 || isVerifying}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-40 transition-colors shadow-2xs"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Reject with Note</span>
              </button>
            </div>
          </div>

          {/* Marks Table */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
            {marksToVerify.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
                No marks currently pending verification for this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/60">
                      <th className="py-2.5 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={
                            marksToVerify.length > 0 &&
                            selectedMarkIds.length === marksToVerify.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMarkIds(marksToVerify.map((m) => m.markId));
                            } else {
                              setSelectedMarkIds([]);
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Course / Sec</th>
                      <th className="py-2.5 px-3">Component</th>
                      <th className="py-2.5 px-3">Marks</th>
                      <th className="py-2.5 px-3">Status / Version</th>
                      <th className="py-2.5 px-3">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {marksToVerify.map((m) => {
                      const isSelected = selectedMarkIds.includes(m.markId);
                      const pct =
                        Number(m.maxMarks) > 0
                          ? ((Number(m.marksObtained) / Number(m.maxMarks)) * 100).toFixed(0)
                          : "0";

                      return (
                        <tr
                          key={m.markId}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? "bg-indigo-50/30" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMarkIds([...selectedMarkIds, m.markId]);
                                } else {
                                  setSelectedMarkIds(selectedMarkIds.filter((id) => id !== m.markId));
                                }
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 block">
                              {m.studentRollNumber}
                            </span>
                            <span className="text-slate-500 text-[11px]">{m.studentName}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-900">{m.courseCode}</span>
                            <span className="text-slate-400 ml-1 text-[11px]">
                              Sec {m.sectionLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-slate-800">{m.componentName}</span>
                            <span className="text-slate-400 block text-[10px]">
                              Weightage: {m.weightagePct}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 text-sm">
                              {m.marksObtained}
                            </span>
                            <span className="text-slate-400 text-[11px]"> / {m.maxMarks}</span>
                            <span className="ml-2 text-[10px] text-slate-500 font-semibold">
                              ({pct}%)
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  m.status === "verified"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : m.status === "rejected"
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {m.status}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                v{m.version}
                              </span>
                            </div>
                            {m.rejectionReason && (
                              <p className="text-[10px] text-rose-600 mt-0.5 max-w-[180px] truncate">
                                Note: {m.rejectionReason}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Note Modal */}
      {rejectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
              <XCircle className="h-5 w-5 text-rose-600" />
              <span>Reject Marks with Reason</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter an actionable note for faculty explaining why these {selectedMarkIds.length} mark(s)
              are being rejected for revision.
            </p>

            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Score mismatch on question 3; please re-verify student paper..."
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 mb-4"
              required
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectionModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleVerifyBatch("reject", rejectionReason)}
                disabled={!rejectionReason.trim() || isVerifying}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GRADE COMPUTATION */}
      {activeTab === "compute" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Computation Control Box */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-indigo-600" />
              <span>Automated Grade &amp; GPA Computation Engine</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Calculates weighted sums against course assessment templates, applies grace marks thresholds,
              and evaluates letter grades according to the configured grading policy.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Course Offering
                </label>
                <select
                  value={computeOfferingId}
                  onChange={(e) => {
                    setComputeOfferingId(e.target.value);
                    setComputedPreview(null);
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {offerings.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.courseCode} - {off.courseTitle} ({off.semesterLabel})
                    </option>
                  ))}
                </select>
              </div>

              {selectedOfferingObj && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-xs">
                  <span className="font-bold text-indigo-900 block">Grading Policy Rules</span>
                  <span className="text-indigo-700 block mt-0.5">
                    {selectedOfferingObj.policyName || "CS Standard Absolute"}
                  </span>
                  <span className="text-indigo-600 text-[11px] block mt-0.5">
                    Passing: {selectedOfferingObj.passingPct}% &bull; Grace Max: {selectedOfferingObj.graceMarksMax}%
                  </span>
                </div>
              )}

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyGrace}
                    onChange={(e) => setApplyGrace(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Apply Grace Marks if within threshold</span>
                </label>

                <button
                  onClick={() => void handleComputeResults()}
                  disabled={isComputing || !computeOfferingId}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
                >
                  {isComputing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Computing Grades...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Execute Computation Engine</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Computed Preview Table & Stats */}
          {computedPreview && (
            <div className="space-y-4 animate-in fade-in">
              {/* Distribution Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {Object.entries(computedPreview.distribution).map(([letter, count]) => (
                  <div
                    key={letter}
                    className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-xs"
                  >
                    <span className="text-base font-black text-indigo-600">{letter}</span>
                    <span className="block text-xs font-semibold text-slate-600 mt-0.5">
                      {count} {count === 1 ? "student" : "students"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Students Roster */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Computed Course Roster ({computedPreview.results.length} students)
                  </h4>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Status: Pending Controller Publication
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/60">
                        <th className="py-2.5 px-3">Roll Number</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3">Weighted Final Score</th>
                        <th className="py-2.5 px-3">Grade Letter</th>
                        <th className="py-2.5 px-3">Grade Point</th>
                        <th className="py-2.5 px-3">Grace Applied</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {computedPreview.results.map((r) => (
                        <tr key={r.enrollmentId} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{r.rollNumber}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{r.fullName}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                            {r.finalScorePct.toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                                r.gradeLetter === "F"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {r.gradeLetter}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                            {r.gradePoint.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {r.appliedGrace > 0 ? (
                              <span className="text-amber-700 font-semibold">
                                +{r.appliedGrace.toFixed(2)}% grace
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PUBLICATION & LOCKING */}
      {activeTab === "publish" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Publication Action Box */}
          <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-indigo-600" />
                  <span>Publish and Immutably Lock Results</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-xl">
                  Enforces Master Plan BR-06: Once Published, result rows become permanently immutable.
                  Transcripts immediately become viewable to students and parents.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={publishOfferingId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPublishOfferingId(id);
                    void fetchPublishedResults(id);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {offerings.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.courseCode} - {off.courseTitle}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => void handlePublishResults()}
                  disabled={isPublishing || !publishOfferingId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Locking Ledger...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      <span>Publish &amp; Lock Results</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results Ledger */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Course Results Status Ledger
                </h4>
                <p className="text-xs text-slate-500">Live outcomes for selected course offering.</p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {publishedLedger.length} Records
              </span>
            </div>

            {publishedLedger.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <FileCheck2 className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                No results found for this course offering. Compute grades first.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/60">
                      <th className="py-2.5 px-3">Roll Number</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Final Score</th>
                      <th className="py-2.5 px-3">Grade</th>
                      <th className="py-2.5 px-3">Grade Point</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Version</th>
                      <th className="py-2.5 px-3">Published Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {publishedLedger.map((res) => (
                      <tr key={res.resultId} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {res.studentRollNumber}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {res.studentName}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                          {Number(res.finalScorePct).toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              res.gradeLetter === "F"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {res.gradeLetter}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-800">
                          {Number(res.gradePoint).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              res.status === "published"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {res.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">v{res.version}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {res.publishedAt ? new Date(res.publishedAt).toLocaleString() : "Unpublished"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: REVALUATION REQUESTS */}
      {activeTab === "revaluation" && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Student Revaluation Requests</h3>
              <p className="text-xs text-slate-500">
                Review and decide student grade challenge requests.
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
              {revalRequests.length} Total
            </span>
          </div>

          {revalRequests.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <FileCheck2 className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              No revaluation requests currently registered.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/60">
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Course</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Decision Note</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {revalRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 block">{req.studentRollNumber}</span>
                        <span className="text-slate-500 text-[11px]">{req.studentName}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900">{req.courseCode}</span>
                        <span className="text-slate-500 block text-[11px] truncate max-w-[150px]">
                          {req.courseTitle}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px]">
                        <p className="text-slate-800 line-clamp-2">{req.reason}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            req.status === "approved"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : req.status === "rejected"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {req.decisionNote || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        {req.status === "requested" ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedRevalId(req.id);
                                setRevalAction("approved");
                                setRevalModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 text-[11px]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRevalId(req.id);
                                setRevalAction("rejected");
                                setRevalModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-rose-50 text-rose-700 font-semibold hover:bg-rose-100 text-[11px]"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Decided</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Revaluation Decision Modal */}
      {revalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Award className="h-5 w-5 text-indigo-600" />
              <span>Decide Revaluation Request ({revalAction})</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a decision note which will be displayed to the student on their transcript portal.
            </p>

            <textarea
              rows={3}
              value={revalDecisionNote}
              onChange={(e) => setRevalDecisionNote(e.target.value)}
              placeholder="e.g., Script re-evaluated by department committee; marks confirmed or amended..."
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevalModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDecideReval()}
                disabled={isDecidingReval}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white ${
                  revalAction === "approved"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                Confirm Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
