"use client";

import { useEffect, useState, useCallback } from "react";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pctColor(pct: number | null): string {
  if (pct === null) return "text-slate-400";
  if (pct >= 75) return "text-emerald-600";
  if (pct >= 60) return "text-amber-600";
  return "text-red-600";
}

function statusBadge(status: AttendanceStatus | null) {
  switch (status) {
    case "present":
      return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300";
    case "absent":
      return "bg-red-100 text-red-700 ring-1 ring-red-300";
    case "excused":
      return "bg-amber-100 text-amber-700 ring-1 ring-amber-300";
    default:
      return "bg-slate-100 text-slate-500 hover:bg-slate-200";
  }
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ attendance }: { attendance: Record<string, AttendanceStatus> }) {
  const counts = { present: 0, absent: 0, excused: 0 };
  for (const v of Object.values(attendance)) counts[v]++;
  const total = Object.keys(attendance).length;
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="font-medium text-emerald-600">{counts.present} present</span>
      <span className="font-medium text-red-600">{counts.absent} absent</span>
      <span className="font-medium text-amber-600">{counts.excused} excused</span>
      <span className="text-slate-400 ml-auto">{total} marked</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  sections: Section[];
}

export default function AttendanceRecorder({ sections }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    sections.length === 1 ? sections[0].sectionId : null
  );
  const [date, setDate] = useState<string>(todayLocal);

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

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
      setSaveError("Mark at least one student before saving.");
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
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setSaveState("saved");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      setSaveState("error");
    }
  }

  const selectedSection = sections.find((s) => s.sectionId === selectedId);
  const markedCount = Object.keys(attendance).length;
  const isComplete = students.length > 0 && markedCount === students.length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      {/* ── Section Sidebar ── */}
      <aside className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          My Sections ({sections.length})
        </p>

        {sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center">
            <p className="text-sm text-slate-500">No sections assigned yet.</p>
            <p className="mt-1 text-xs text-slate-400">Ask your department admin to create faculty assignments.</p>
          </div>
        ) : (
          sections.map((sec) => {
            const isActive = sec.sectionId === selectedId;
            return (
              <button
                key={sec.sectionId}
                onClick={() => setSelectedId(sec.sectionId)}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  isActive
                    ? "border-indigo-300 bg-indigo-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                {/* Course code + status badge */}
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-bold ${isActive ? "text-indigo-800" : "text-slate-800"}`}>
                    {sec.courseCode}
                  </p>
                  {sec.sectionStatus !== "open" && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                      {sec.sectionStatus}
                    </span>
                  )}
                </div>

                {/* Course title */}
                <p className="mt-0.5 text-xs text-slate-600 leading-snug line-clamp-2">{sec.courseTitle}</p>

                {/* Meta */}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                    Sec {sec.sectionLabel}
                  </span>
                  <span>{sec.semesterLabel}</span>
                  <span className="ml-auto text-slate-500">
                    {sec.enrolledCount}/{sec.sectionCapacity} enrolled
                  </span>
                </div>

                {/* Role badge */}
                {sec.assignmentRole !== "primary" && (
                  <p className="mt-1.5 text-xs text-indigo-500 capitalize">{sec.assignmentRole.replace("_", " ")}</p>
                )}
              </button>
            );
          })
        )}
      </aside>

      {/* ── Attendance Sheet ── */}
      <div>
        {!selectedSection ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-80 rounded-2xl border border-dashed border-slate-300 bg-white text-center px-6">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-base font-medium text-slate-600">Select a section to start</p>
            <p className="mt-1 text-sm text-slate-400">
              {sections.length > 0
                ? "Click a section from the left panel to load its attendance sheet."
                : "No sections are assigned to your faculty account yet."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="border-b border-slate-200 bg-white px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {selectedSection.courseCode} — {selectedSection.courseTitle}
                    </h2>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      {selectedSection.credits} cr
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Section {selectedSection.sectionLabel}
                    {" · "}
                    {selectedSection.programCode}
                    {" · "}
                    {selectedSection.semesterLabel}
                  </p>
                </div>

                {/* Date picker */}
                <div className="flex items-center gap-2">
                  <label htmlFor="session-date" className="text-xs font-medium text-slate-500">
                    Session date
                  </label>
                  <input
                    id="session-date"
                    type="date"
                    value={date}
                    max={todayLocal()}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                  />
                </div>
              </div>
            </div>

            {/* Quick mark + summary bar */}
            {loadState === "ready" && students.length > 0 && (
              <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-2.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="text-xs font-medium text-slate-500">Mark all:</span>
                  {(["present", "absent", "excused"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => markAll(s)}
                      className={`text-xs font-semibold transition hover:underline ${
                        s === "present"
                          ? "text-emerald-600"
                          : s === "absent"
                            ? "text-red-600"
                            : "text-amber-600"
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                  <div className="ml-auto">
                    <SummaryBar attendance={attendance} />
                  </div>
                </div>
              </div>
            )}

            {/* Student rows */}
            <div className="min-h-[200px]">
              {loadState === "loading" && (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                </div>
              )}

              {loadState === "error" && (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="text-3xl mb-3">⚠️</div>
                  <p className="text-sm font-medium text-red-600">{loadError}</p>
                  <button
                    onClick={() => loadStudents(selectedId!, date)}
                    className="mt-4 text-xs text-indigo-600 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {loadState === "ready" && students.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="text-3xl mb-3">🎓</div>
                  <p className="text-sm text-slate-500">No registered students in this section.</p>
                </div>
              )}

              {loadState === "ready" && students.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/40 text-xs text-slate-400">
                      <th className="w-10 px-4 py-2.5 text-center font-medium">#</th>
                      <th className="px-4 py-2.5 text-left font-medium">Roll No.</th>
                      <th className="px-4 py-2.5 text-left font-medium">Student Name</th>
                      <th className="px-4 py-2.5 text-right font-medium">Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student, idx) => {
                      const current = attendance[student.enrollmentId] ?? null;
                      return (
                        <tr
                          key={student.enrollmentId}
                          className={`transition-colors ${
                            current === "present"
                              ? "bg-emerald-50/30"
                              : current === "absent"
                                ? "bg-red-50/30"
                                : current === "excused"
                                  ? "bg-amber-50/30"
                                  : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-center text-xs text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                              {student.rollNumber}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">{student.studentName}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {(["present", "absent", "excused"] as const).map((s) => (
                                <label
                                  key={s}
                                  className={`cursor-pointer select-none rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                    current === s
                                      ? statusBadge(s)
                                      : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`att-${student.enrollmentId}`}
                                    value={s}
                                    checked={current === s}
                                    onChange={() => setStatus(student.enrollmentId, s)}
                                    className="sr-only"
                                  />
                                  <span className="capitalize">{s}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer / save bar */}
            {loadState === "ready" && students.length > 0 && (
              <div className="border-t border-slate-200 bg-slate-50/60 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Status message */}
                  <div className="text-sm">
                    {saveState === "saved" && (
                      <span className="flex items-center gap-2 text-emerald-600">
                        <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="font-medium">Attendance saved for {date}</span>
                      </span>
                    )}
                    {(saveState === "error" || saveError) && (
                      <span className="text-red-600">{saveError}</span>
                    )}
                    {saveState === "idle" && !isComplete && (
                      <span className="text-slate-400">
                        {markedCount}/{students.length} students marked
                      </span>
                    )}
                    {saveState === "idle" && isComplete && (
                      <span className="text-slate-500">All {students.length} students marked — ready to save</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {!isComplete && saveState !== "saved" && (
                      <p className="text-xs text-amber-600">
                        {students.length - markedCount} student{students.length - markedCount !== 1 ? "s" : ""}{" "}
                        unmarked
                      </p>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saveState === "saving" || markedCount === 0}
                      className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saveState === "saving" ? (
                        <span className="flex items-center gap-2">
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Saving…
                        </span>
                      ) : (
                        "Save Attendance"
                      )}
                    </button>
                  </div>
                </div>

                {/* Completion progress bar */}
                <div className="mt-3 h-1 w-full rounded-full bg-slate-200">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      isComplete ? "bg-emerald-500" : "bg-indigo-500"
                    }`}
                    style={{ width: `${students.length > 0 ? (markedCount / students.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Percentage legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 px-1">
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full bg-emerald-500`} />
            ≥ 75% — Good standing
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full bg-amber-500`} />
            60–74% — Warning
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full bg-red-500`} />
            &lt; 60% — Critical
          </span>
        </div>
      </div>
    </div>
  );
}
