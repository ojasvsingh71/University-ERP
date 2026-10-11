"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Users,
  Search,
  Save,
  Check,
  AlertCircle,
  Clock,
  Layers,
  ChevronRight,
  Filter,
  RefreshCw,
  Sparkles,
  BookOpen
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = "present" | "absent" | "excused";

interface Section {
  sectionId: string;
  sectionLabel: string;
  sectionStatus: string;
  sectionCapacity: number;
  assignmentRole: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  semesterLabel: string;
  semesterStart: string | null;
  semesterEnd: string | null;
  programName: string;
  programCode: string;
  enrolledCount: number;
}

interface StudentRecord {
  enrollmentId: string;
  rollNumber: string;
  studentName: string;
  attendanceStatus: AttendanceStatus | null;
  attendanceRecordId: string | null;
}

type LoadState = "idle" | "loading" | "ready" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  sections: Section[];
}

export default function AttendanceRecorder({ sections }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    sections.length > 0 ? sections[0].sectionId : null
  );
  const [date, setDate] = useState<string>(todayLocal);

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent" | "excused" | "unmarked">("all");

  // ── Load students for selected section + date ────────────────────────────────
  const loadStudents = useCallback(async (sectionId: string, d: string) => {
    setLoadState("loading");
    setLoadError(null);
    setSaveState("idle");
    setSaveError(null);

    try {
      const res = await fetch(
        `/api/attendance/records?sectionId=${encodeURIComponent(sectionId)}&date=${encodeURIComponent(d)}`
      );
      const data: { students?: StudentRecord[]; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load students");

      const rows = data.students ?? [];
      setStudents(rows);

      // Pre-fill existing attendance records for this date
      const existing: Record<string, AttendanceStatus> = {};
      for (const s of rows) {
        if (s.attendanceStatus) existing[s.enrollmentId] = s.attendanceStatus;
      }
      setAttendance(existing);
      setLoadState("ready");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (!selectedId || !date) return;
    loadStudents(selectedId, date);
  }, [selectedId, date, loadStudents]);

  // ── Mark all quick action ────────────────────────────────────────────────────
  function markAll(status: AttendanceStatus) {
    const all: Record<string, AttendanceStatus> = {};
    for (const s of students) all[s.enrollmentId] = status;
    setAttendance(all);
    setSaveState("idle");
  }

  // ── Toggle single student status ─────────────────────────────────────────────
  function setStatus(enrollmentId: string, status: AttendanceStatus) {
    setAttendance((prev) => ({ ...prev, [enrollmentId]: status }));
    setSaveState("idle");
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedId) return;
    const records = Object.entries(attendance).map(([enrollmentId, status]) => ({
      enrollmentId,
      status,
    }));
    if (records.length === 0) {
      setSaveError("Please mark at least one student before saving.");
      return;
    }

    setSaveState("saving");
    setSaveError(null);

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: selectedId, sessionDate: date, records }),
      });
      const data: { saved?: number; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save attendance");
      setSaveState("saved");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      setSaveState("error");
    }
  }

  const selectedSection = sections.find((s) => s.sectionId === selectedId);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase());

      const currentStatus = attendance[s.enrollmentId];
      if (statusFilter === "all") return matchesSearch;
      if (statusFilter === "unmarked") return matchesSearch && !currentStatus;
      return matchesSearch && currentStatus === statusFilter;
    });
  }, [students, searchQuery, statusFilter, attendance]);

  // Tally stats
  const stats = useMemo(() => {
    const counts = { present: 0, absent: 0, excused: 0, unmarked: 0 };
    for (const s of students) {
      const st = attendance[s.enrollmentId];
      if (st === "present") counts.present++;
      else if (st === "absent") counts.absent++;
      else if (st === "excused") counts.excused++;
      else counts.unmarked++;
    }
    const marked = counts.present + counts.absent + counts.excused;
    const rate = marked > 0 ? Math.round((counts.present / marked) * 100) : 0;
    return { ...counts, marked, rate };
  }, [students, attendance]);

  const isComplete = students.length > 0 && stats.unmarked === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr] items-start">
      {/* ── Left Sidebar / Section Selection ── */}
      <aside className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" /> Assigned Sections
          </span>
          <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            {sections.length}
          </span>
        </div>

        {sections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-xs">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No sections assigned</p>
            <p className="mt-1 text-xs text-slate-400">
              Department administration has not assigned sections to your profile yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sections.map((sec) => {
              const isActive = sec.sectionId === selectedId;
              return (
                <button
                  key={sec.sectionId}
                  type="button"
                  onClick={() => setSelectedId(sec.sectionId)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 relative group overflow-hidden ${
                    isActive
                      ? "border-indigo-500 bg-white shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/20"
                      : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs"
                  }`}
                >
                  {/* Left accent bar for active */}
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600" />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm font-bold tracking-tight ${isActive ? "text-indigo-600" : "text-slate-800"}`}>
                      {sec.courseCode}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      Sec {sec.sectionLabel}
                    </span>
                  </div>

                  <p className="mt-1 text-xs font-medium text-slate-600 line-clamp-2 leading-relaxed">
                    {sec.courseTitle}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2.5">
                    <span className="font-medium text-slate-500">{sec.semesterLabel}</span>
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Users className="w-3 h-3 text-indigo-500" />
                      {sec.enrolledCount} Students
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* ── Main Panel / Attendance Sheet ── */}
      <div className="space-y-4">
        {!selectedSection ? (
          <div className="flex flex-col items-center justify-center min-h-[350px] rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-xs">
            <Calendar className="w-12 h-12 text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-700">Select a Class Section</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              Choose an assigned course section from the left navigation panel to load its roster.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
            {/* Header: Course Details & Date Picker */}
            <div className="border-b border-slate-200/80 p-5 sm:p-6 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      {selectedSection.courseCode} — {selectedSection.courseTitle}
                    </h2>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200/60">
                      {selectedSection.credits} Credits
                    </span>
                    <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      Section {selectedSection.sectionLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedSection.programName} ({selectedSection.programCode}) &bull; {selectedSection.semesterLabel}
                  </p>
                </div>

                {/* Date Picker Component */}
                <div className="flex items-center gap-2 self-start sm:self-center bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 pl-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Date:
                  </span>
                  <input
                    type="date"
                    value={date}
                    max={todayLocal()}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setDate(todayLocal())}
                    className="text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded-lg transition-colors"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* KPI Stat Ribbons */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-200/70">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="flex items-center justify-between text-emerald-800">
                    <span className="text-xs font-medium">Present</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-xl font-extrabold text-emerald-700 mt-0.5">{stats.present}</p>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3">
                  <div className="flex items-center justify-between text-rose-800">
                    <span className="text-xs font-medium">Absent</span>
                    <XCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <p className="text-xl font-extrabold text-rose-700 mt-0.5">{stats.absent}</p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex items-center justify-between text-amber-800">
                    <span className="text-xs font-medium">Excused</span>
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-xl font-extrabold text-amber-700 mt-0.5">{stats.excused}</p>
                </div>

                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3">
                  <div className="flex items-center justify-between text-indigo-800">
                    <span className="text-xs font-medium">Present Rate</span>
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                  </div>
                  <p className="text-xl font-extrabold text-indigo-700 mt-0.5">{stats.rate}%</p>
                </div>
              </div>
            </div>

            {/* Controls Bar: Batch Actions + Search + Status Filter */}
            <div className="p-4 sm:px-6 border-b border-slate-200/80 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Batch buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Batch:</span>
                <button
                  type="button"
                  onClick={() => markAll("present")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100/80 transition-colors shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All Present
                </button>
                <button
                  type="button"
                  onClick={() => markAll("absent")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100/80 transition-colors shadow-2xs"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  All Absent
                </button>
                <button
                  type="button"
                  onClick={() => markAll("excused")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100/80 transition-colors shadow-2xs"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  All Excused
                </button>
              </div>

              {/* Search input and status tabs */}
              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or roll no..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>

                <div className="flex items-center rounded-xl bg-slate-100 p-1">
                  {(["all", "present", "absent", "unmarked"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusFilter(tab)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                        statusFilter === tab
                          ? "bg-white text-indigo-600 shadow-2xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Students Table Area */}
            <div className="min-h-[280px]">
              {loadState === "loading" && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="text-xs font-medium">Fetching registered student roster...</p>
                </div>
              )}

              {loadState === "error" && (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
                  <p className="text-sm font-semibold text-rose-700">{loadError}</p>
                  <button
                    onClick={() => loadStudents(selectedId!, date)}
                    className="mt-3 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {loadState === "ready" && students.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No Registered Students</p>
                  <p className="text-xs text-slate-400 mt-0.5">There are no students registered for this section yet.</p>
                </div>
              )}

              {loadState === "ready" && students.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Roll Number</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4 text-center">Current Status</th>
                        <th className="py-3 px-4 text-right pr-6">Mark Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-xs text-slate-400 font-medium">
                            No students match your filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student, idx) => {
                          const current = attendance[student.enrollmentId] ?? null;
                          return (
                            <tr
                              key={student.enrollmentId}
                              className={`transition-colors ${
                                current === "present"
                                  ? "bg-emerald-50/20 hover:bg-emerald-50/40"
                                  : current === "absent"
                                  ? "bg-rose-50/20 hover:bg-rose-50/40"
                                  : current === "excused"
                                  ? "bg-amber-50/20 hover:bg-amber-50/40"
                                  : "hover:bg-slate-50/70"
                              }`}
                            >
                              <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-medium">
                                {idx + 1}
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                                  {student.rollNumber}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 font-semibold text-slate-900">
                                {student.studentName}
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                {current ? (
                                  <span
                                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                                      current === "present"
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                        : current === "absent"
                                        ? "bg-rose-100 text-rose-800 border border-rose-200"
                                        : "bg-amber-100 text-amber-800 border border-amber-200"
                                    }`}
                                  >
                                    {current === "present" && <CheckCircle2 className="w-3 h-3" />}
                                    {current === "absent" && <XCircle className="w-3 h-3" />}
                                    {current === "excused" && <HelpCircle className="w-3 h-3" />}
                                    {current}
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-slate-400 italic">
                                    Unmarked
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-right pr-6">
                                <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 border border-slate-200">
                                  <button
                                    type="button"
                                    onClick={() => setStatus(student.enrollmentId, "present")}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                      current === "present"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    }`}
                                  >
                                    P
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setStatus(student.enrollmentId, "absent")}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                      current === "absent"
                                        ? "bg-rose-600 text-white shadow-xs"
                                        : "text-slate-600 hover:text-rose-700 hover:bg-rose-50"
                                    }`}
                                  >
                                    A
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setStatus(student.enrollmentId, "excused")}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                      current === "excused"
                                        ? "bg-amber-600 text-white shadow-xs"
                                        : "text-slate-600 hover:text-amber-700 hover:bg-amber-50"
                                    }`}
                                  >
                                    E
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bottom Sticky Action Bar */}
            {loadState === "ready" && students.length > 0 && (
              <div className="border-t border-slate-200/90 bg-slate-50/90 p-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700">
                      {stats.marked} of {students.length} students marked
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {stats.unmarked === 0 ? "All students marked! Ready to save." : `${stats.unmarked} students remaining.`}
                    </span>
                  </div>

                  {saveState === "saved" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                      <Check className="w-3.5 h-3.5" /> Saved Successfully!
                    </span>
                  )}

                  {saveState === "error" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 border border-rose-200">
                      <AlertCircle className="w-3.5 h-3.5" /> {saveError}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveState === "saving" || stats.marked === 0}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    {saveState === "saving" ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving Records...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Attendance Sheet</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
