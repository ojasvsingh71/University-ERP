"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PenTool,
  CheckCircle2,
  AlertCircle,
  Save,
  Send,
  RefreshCw,
  History,
  Info,
  PlusCircle,
  BookPlus,
  Plus,
  X,
  BookOpen,
} from "lucide-react";

interface Offering {
  id: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  semesterLabel: string;
  templateId?: string | null;
}

interface Section {
  id: string;
  courseOfferingId: string;
  label: string;
  isAssignedToCurrentUser: boolean;
}

interface ComponentItem {
  id: string;
  assessmentTemplateId: string;
  courseOfferingId?: string | null;
  name: string;
  maxMarks: string;
  weightagePct: string;
}

interface StudentRosterItem {
  enrollmentId: string;
  studentId: string;
  rollNumber: string;
  fullName: string;
  email: string;
  markId: string | null;
  marksObtained: number | null;
  status: "draft" | "submitted" | "verified" | "rejected" | "not_entered";
  version: number;
  supersedesMarkId: string | null;
  rejectionReason: string | null;
  verifiedByUserId: string | null;
}

// Resilient helper to parse JSON responses and guarantee clean error messages
async function safeParseResponseJson<T = Record<string, unknown>>(
  res: Response
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const text = await res.text();
    if (!text || text.trim().length === 0) {
      return {
        ok: res.ok,
        status: res.status,
        data: null,
        error: res.ok ? undefined : `Server error (${res.status}): empty response`,
      };
    }
    const data = JSON.parse(text);
    const errMsg =
      data?.error && typeof data.error === "string"
        ? data.error
        : data?.error
        ? JSON.stringify(data.error)
        : !res.ok
        ? `Request failed with status ${res.status}`
        : undefined;
    return { ok: res.ok, status: res.status, data, error: errMsg };
  } catch {
    return {
      ok: false,
      status: res.status,
      data: null,
      error: `Unexpected server response format (${res.status})`,
    };
  }
}

export default function FacultyMarksRoster() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);

  // Selected state
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedComponentId, setSelectedComponentId] = useState("");

  // Roster state
  const [componentMeta, setComponentMeta] = useState<{
    id: string;
    name: string;
    maxMarks: number;
    weightagePct: number;
  } | null>(null);
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [inputMarks, setInputMarks] = useState<Record<string, string>>({});
  const [isAmendMode, setIsAmendMode] = useState<Record<string, boolean>>({});

  const [loadingRoster, setLoadingRoster] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dynamic Add Subject / Component Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addType, setAddType] = useState<"component" | "subject">("component");
  const [newCompName, setNewCompName] = useState("");
  const [newMaxMarks, setNewMaxMarks] = useState("50");
  const [newWeightage, setNewWeightage] = useState("15");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectTitle, setNewSubjectTitle] = useState("");
  const [newSubjectCredits, setNewSubjectCredits] = useState("3");
  const [isCreatingComponent, setIsCreatingComponent] = useState(false);

  const showMsg = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 6000);
  }, []);

  const fetchRoster = useCallback(
    async (secId = selectedSectionId, compId = selectedComponentId) => {
      if (!secId || !compId) return;
      try {
        setLoadingRoster(true);
        const res = await fetch(
          `/api/exams/marks?sectionId=${secId}&assessmentComponentId=${compId}`
        );
        const parsed = await safeParseResponseJson<{
          component: { id: string; name: string; maxMarks: number; weightagePct: number };
          roster: StudentRosterItem[];
        }>(res);

        if (parsed.ok && parsed.data) {
          setComponentMeta(parsed.data.component);
          setRoster(parsed.data.roster || []);

          // Populate initial input values:
          // Unentered students start blank (""), drafted/submitted marks load their numeric value
          const initialMap: Record<string, string> = {};
          for (const item of parsed.data.roster || []) {
            initialMap[item.enrollmentId] =
              item.status !== "not_entered" && item.marksObtained !== null
                ? String(item.marksObtained)
                : "";
          }
          setInputMarks(initialMap);
          setIsAmendMode({});
        } else {
          showMsg("error", parsed.error || "Failed to load student roster");
        }
      } catch (err: unknown) {
        const errText = err instanceof Error ? err.message : "Error loading roster";
        showMsg("error", errText);
      } finally {
        setLoadingRoster(false);
      }
    },
    [selectedSectionId, selectedComponentId, showMsg]
  );

  const fetchOptions = useCallback(
    async (preferredOfferingId?: string, preferredCompId?: string) => {
      try {
        const res = await fetch("/api/exams/options");
        const parsed = await safeParseResponseJson<{
          offerings: Offering[];
          sections: Section[];
          components: ComponentItem[];
        }>(res);

        if (parsed.ok && parsed.data) {
          const offs: Offering[] = parsed.data.offerings || [];
          const secs: Section[] = parsed.data.sections || [];
          const comps: ComponentItem[] = parsed.data.components || [];

          setOfferings(offs);
          setSections(secs);
          setComponents(comps);

          if (offs.length === 0) {
            setSelectedOfferingId("");
            setSelectedSectionId("");
            setSelectedComponentId("");
            setRoster([]);
            setComponentMeta(null);
            return;
          }

          const targetOff =
            (preferredOfferingId ? offs.find((o) => o.id === preferredOfferingId) : null) ||
            offs.find((o) => o.id === selectedOfferingId) ||
            offs[0];

          if (targetOff) {
            setSelectedOfferingId(targetOff.id);

            const matchingSecs = secs.filter((s) => s.courseOfferingId === targetOff.id);
            const initialSec = matchingSecs.find((s) => s.isAssignedToCurrentUser) || matchingSecs[0];
            const initialSecId = initialSec ? initialSec.id : "";
            setSelectedSectionId(initialSecId);

            const offComps = comps.filter(
              (c) =>
                (c.courseOfferingId && c.courseOfferingId === targetOff.id) ||
                (targetOff.templateId && c.assessmentTemplateId === targetOff.templateId)
            );
            const initialComp =
              (preferredCompId ? offComps.find((c) => c.id === preferredCompId) : null) ||
              offComps[0] ||
              (preferredCompId ? comps.find((c) => c.id === preferredCompId) : null) ||
              comps[0];
            const initialCompId = initialComp ? initialComp.id : "";
            setSelectedComponentId(initialCompId);

            if (initialSecId && initialCompId) {
              void fetchRoster(initialSecId, initialCompId);
            } else {
              setRoster([]);
              setComponentMeta(null);
            }
          }
        } else {
          showMsg("error", parsed.error || "Failed to load course options");
        }
      } catch (err: unknown) {
        const errText = err instanceof Error ? err.message : "Failed to load course options";
        showMsg("error", errText);
      }
    },
    [fetchRoster, showMsg, selectedOfferingId]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOptions();
  }, [fetchOptions]);

  const handleOfferingChange = (offeringId: string) => {
    setSelectedOfferingId(offeringId);
    const matchingSecs = sections.filter((s) => s.courseOfferingId === offeringId);
    const initialSec = matchingSecs.find((s) => s.isAssignedToCurrentUser) || matchingSecs[0];
    const secId = initialSec ? initialSec.id : "";
    setSelectedSectionId(secId);

    const off = offerings.find((o) => o.id === offeringId);
    const offComps = components.filter(
      (c) =>
        (c.courseOfferingId && c.courseOfferingId === offeringId) ||
        (off?.templateId && c.assessmentTemplateId === off.templateId)
    );
    const initialCompId = offComps.length > 0 ? offComps[0].id : components[0]?.id || "";
    setSelectedComponentId(initialCompId);

    if (secId && initialCompId) {
      void fetchRoster(secId, initialCompId);
    } else {
      setRoster([]);
      setComponentMeta(null);
    }
  };

  const handleSectionChange = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    if (sectionId && selectedComponentId) {
      void fetchRoster(sectionId, selectedComponentId);
    }
  };

  const handleComponentChange = (componentId: string) => {
    setSelectedComponentId(componentId);
    if (selectedSectionId && componentId) {
      void fetchRoster(selectedSectionId, componentId);
    }
  };

  const handleMarkChange = (enrollmentId: string, val: string) => {
    setInputMarks((prev) => ({
      ...prev,
      [enrollmentId]: val,
    }));
  };

  const handleStepMark = (enrollmentId: string, delta: number) => {
    setInputMarks((prev) => {
      const current = prev[enrollmentId] ?? "";
      let nextVal: number;
      if (current.trim() === "") {
        nextVal = delta > 0 ? delta : 0;
      } else {
        const parsed = parseFloat(current);
        nextVal = isNaN(parsed) ? 0 : parsed + delta;
      }
      const max = componentMeta?.maxMarks ?? 100;
      if (nextVal < 0) nextVal = 0;
      if (nextVal > max) nextVal = max;
      return {
        ...prev,
        [enrollmentId]: String(Math.round(nextVal * 10) / 10),
      };
    });
  };

  // Submit or Draft marks batch
  const handleSaveBatch = async (action: "save_draft" | "submit") => {
    if (!componentMeta) return;

    const entries: Array<{ enrollmentId: string; marksObtained: number }> = [];

    for (const student of roster) {
      const val = inputMarks[student.enrollmentId];
      if (val !== undefined && val.trim() !== "") {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0) {
          showMsg("error", `Marks for student ${student.rollNumber} cannot be negative.`);
          return;
        }
        if (num > componentMeta.maxMarks) {
          showMsg(
            "error",
            `Marks for ${student.rollNumber} (${num}) exceeds maximum allowed (${componentMeta.maxMarks})`
          );
          return;
        }
        entries.push({
          enrollmentId: student.enrollmentId,
          marksObtained: num,
        });
      }
    }

    if (entries.length === 0) {
      showMsg("error", "Please enter marks for at least one student before saving.");
      return;
    }

    if (
      action === "submit" &&
      !confirm(
        `Submit marks for ${entries.length} student(s) for official verification? Once submitted, amendments will follow the append/versioning audit trail.`
      )
    ) {
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch("/api/exams/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentComponentId: selectedComponentId,
          action,
          entries,
        }),
      });

      const parsed = await safeParseResponseJson<{
        message?: string;
        saved?: number;
      }>(res);

      if (!parsed.ok) throw new Error(parsed.error || "Failed to save marks");

      showMsg(
        "success",
        parsed.data?.message ||
          `Marks successfully ${action === "submit" ? "submitted for verification" : "saved as draft"}!`
      );
      void fetchRoster(selectedSectionId, selectedComponentId);
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : "Failed to save marks";
      showMsg("error", errText);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler to dynamically create a component or new subject
  const handleCreateComponentOrSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim()) {
      showMsg("error", "Please provide a valid component name.");
      return;
    }
    const maxM = parseFloat(newMaxMarks);
    const weight = parseFloat(newWeightage);
    if (isNaN(maxM) || maxM <= 0) {
      showMsg("error", "Max marks must be a positive number.");
      return;
    }
    if (isNaN(weight) || weight <= 0 || weight > 100) {
      showMsg("error", "Weightage must be between 1% and 100%.");
      return;
    }

    try {
      setIsCreatingComponent(true);
      const payload =
        addType === "subject"
          ? {
              isNewSubject: true,
              subjectCode: newSubjectCode.trim(),
              subjectTitle: newSubjectTitle.trim(),
              credits: Number(newSubjectCredits) || 3,
              name: newCompName.trim(),
              maxMarks: maxM,
              weightagePct: weight,
            }
          : {
              courseOfferingId: selectedOfferingId,
              name: newCompName.trim(),
              maxMarks: maxM,
              weightagePct: weight,
            };

      const res = await fetch("/api/exams/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const parsed = await safeParseResponseJson<{
        message?: string;
        component?: { id: string };
        courseOfferingId?: string;
        sectionId?: string;
        data?: {
          offering?: { id: string };
          component?: { id: string };
          section?: { id: string };
        };
      }>(res);

      if (!parsed.ok) throw new Error(parsed.error || "Failed to create component");

      const createdOfferingId = parsed.data?.courseOfferingId || parsed.data?.data?.offering?.id;
      const createdCompId = parsed.data?.component?.id || parsed.data?.data?.component?.id;

      showMsg(
        "success",
        parsed.data?.message ||
          (addType === "subject"
            ? `New subject "${newSubjectCode}" and component created successfully!`
            : `Assessment component "${newCompName}" successfully added!`)
      );
      setIsAddModalOpen(false);
      setNewCompName("");
      setNewMaxMarks("50");
      setNewWeightage("15");
      setNewSubjectCode("");
      setNewSubjectTitle("");

      if (addType === "subject" && createdOfferingId) {
        await fetchOptions(createdOfferingId, createdCompId);
      } else if (createdCompId) {
        await fetchOptions(selectedOfferingId, createdCompId);
      } else {
        await fetchOptions(selectedOfferingId);
      }
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : "Failed to create component";
      showMsg("error", errText);
    } finally {
      setIsCreatingComponent(false);
    }
  };

  const availableSections = sections.filter(
    (s) => s.courseOfferingId === selectedOfferingId
  );
  const currentOffering = offerings.find((o) => o.id === selectedOfferingId);
  const availableComponents = components.filter(
    (c) =>
      (c.courseOfferingId && c.courseOfferingId === selectedOfferingId) ||
      (!currentOffering?.templateId || c.assessmentTemplateId === currentOffering.templateId)
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
              <PenTool className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Faculty Marks Entry</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Student evaluation roster: Enter scores with numeric step controls, append custom assessment components, and submit verified audit records.
          </p>
        </div>

        {/* Action Buttons: Add Subject / Component + Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setAddType("component");
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
          >
            <PlusCircle className="h-3.5 w-3.5 text-indigo-600" />
            <span>Add Assessment Component</span>
          </button>

          <button
            onClick={() => {
              setAddType("subject");
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors shadow-2xs cursor-pointer"
          >
            <BookPlus className="h-3.5 w-3.5 text-purple-600" />
            <span>Add Subject</span>
          </button>

          <button
            onClick={() => void fetchRoster(selectedSectionId, selectedComponentId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            <span>Refresh Roster</span>
          </button>
        </div>
      </div>

      {/* Message Banner */}
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
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Selectors Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        {/* Course Offering */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-700">Course Offering</label>
            <button
              type="button"
              onClick={() => {
                setAddType("subject");
                setIsAddModalOpen(true);
              }}
              className="text-[11px] text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>New Subject</span>
            </button>
          </div>
          <select
            value={selectedOfferingId}
            onChange={(e) => handleOfferingChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {offerings.map((off) => (
              <option key={off.id} value={off.id}>
                {off.courseCode} - {off.courseTitle} ({off.semesterLabel})
              </option>
            ))}
            {offerings.length === 0 && (
              <option value="">No course offerings available</option>
            )}
          </select>
        </div>

        {/* Section */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Class Section</label>
          <select
            value={selectedSectionId}
            onChange={(e) => handleSectionChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={availableSections.length === 0}
          >
            {availableSections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                Section {sec.label} {sec.isAssignedToCurrentUser ? "(Assigned to You)" : ""}
              </option>
            ))}
            {availableSections.length === 0 && (
              <option value="">No sections available</option>
            )}
          </select>
        </div>

        {/* Assessment Component */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-700">Assessment Component</label>
            <button
              type="button"
              onClick={() => {
                setAddType("component");
                setIsAddModalOpen(true);
              }}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>New Component</span>
            </button>
          </div>
          <select
            value={selectedComponentId}
            onChange={(e) => handleComponentChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availableComponents.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.name} &bull; Max: {comp.maxMarks} &bull; Weightage: {comp.weightagePct}%
              </option>
            ))}
            {availableComponents.length === 0 && (
              <option value="">No assessment components configured for this course</option>
            )}
          </select>
        </div>
      </div>

      {/* Component Details & Weightage Bar */}
      {componentMeta && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl p-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500 text-white font-bold text-sm shadow-2xs">
              {componentMeta.name}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded text-xs">
                  {currentOffering?.courseCode || "N/A"}
                </span>
                <span className="font-bold text-amber-950 text-sm">
                  {currentOffering?.courseTitle || "Selected Subject"}
                </span>
              </div>
              <div className="text-amber-800 text-xs mt-0.5">
                Max Marks: <strong>{componentMeta.maxMarks}</strong> &bull; Grade Weightage Contribution:{" "}
                <strong>{componentMeta.weightagePct}%</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-amber-200 text-amber-900 font-semibold shadow-2xs">
              <History className="h-3.5 w-3.5 text-amber-600" />
              <span>Append/Version Pattern Protected</span>
            </span>
          </div>
        </div>
      )}

      {/* Students Evaluation Roster */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Enrolled Students Mark Roster</h3>
            <p className="text-xs text-slate-500">
              Type or use the number controls to assign marks (min: 0, max: {componentMeta?.maxMarks || 100}).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {roster.length} Enrolled
            </span>
          </div>
        </div>

        {loadingRoster ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
            Loading student roster...
          </div>
        ) : roster.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-1">
            <BookOpen className="h-6 w-6 mx-auto text-slate-300" />
            <p>No enrolled students found in this section.</p>
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/60">
                  <th className="py-2.5 px-3">Roll Number</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Course Code</th>
                  <th className="py-2.5 px-3 min-w-[160px]">Subject Name</th>
                  <th className="py-2.5 px-3 min-w-[220px]">
                    Marks Obtained (Max {componentMeta?.maxMarks})
                  </th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Version</th>
                  <th className="py-2.5 px-3">Action / Rejection Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {roster.map((student) => {
                  const val = inputMarks[student.enrollmentId] ?? "";
                  const numVal = parseFloat(val);
                  const isOver =
                    !isNaN(numVal) && componentMeta && numVal > componentMeta.maxMarks;
                  const isUnder = !isNaN(numVal) && numVal < 0;
                  const isLocked =
                    (student.status === "submitted" || student.status === "verified") &&
                    !isAmendMode[student.enrollmentId];

                  return (
                    <tr key={student.enrollmentId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {student.rollNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800 block">{student.fullName}</span>
                        <span className="text-slate-400 text-[11px]">{student.email}</span>
                      </td>
                      {/* Course Code Column */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-block font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded text-[11px]">
                          {currentOffering?.courseCode || "—"}
                        </span>
                      </td>
                      {/* Subject Name Column */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 leading-tight">
                            {currentOffering?.courseTitle || "Selected Subject"}
                          </span>
                          {componentMeta && (
                            <span className="text-[11px] text-amber-700 font-medium">
                              {componentMeta.name} ({componentMeta.weightagePct}%)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {/* Native number input with visible controls & stepper buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isLocked || (val.trim() !== "" && !isNaN(numVal) && numVal <= 0)}
                            onClick={() => handleStepMark(student.enrollmentId, -1)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all select-none shadow-2xs cursor-pointer"
                            title="Decrement mark (-1)"
                          >
                            &minus;
                          </button>

                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={componentMeta?.maxMarks}
                            value={val}
                            disabled={isLocked}
                            onChange={(e) => handleMarkChange(student.enrollmentId, e.target.value)}
                            placeholder="0.0"
                            className={`w-24 text-center rounded-lg border px-2.5 py-1.5 text-xs font-mono font-bold transition-all focus:outline-none [appearance:auto] ${
                              isOver || isUnder
                                ? "border-rose-500 bg-rose-50 text-rose-900 focus:ring-2 focus:ring-rose-400"
                                : isLocked
                                ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                                : "border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                            }`}
                          />

                          <button
                            type="button"
                            disabled={
                              isLocked ||
                              (componentMeta !== null &&
                                val.trim() !== "" &&
                                !isNaN(numVal) &&
                                numVal >= componentMeta.maxMarks)
                            }
                            onClick={() => handleStepMark(student.enrollmentId, 1)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all select-none shadow-2xs cursor-pointer"
                            title="Increment mark (+1)"
                          >
                            +
                          </button>

                          <span className="text-slate-400 font-semibold text-xs ml-1 whitespace-nowrap">
                            / {componentMeta?.maxMarks}
                          </span>
                        </div>

                        {isOver && (
                          <span className="text-[10px] text-rose-600 block mt-1 font-medium">
                            Exceeds max allowed ({componentMeta?.maxMarks})
                          </span>
                        )}
                        {isUnder && (
                          <span className="text-[10px] text-rose-600 block mt-1 font-medium">
                            Marks cannot be negative
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            student.status === "verified"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : student.status === "rejected"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : student.status === "submitted"
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : student.status === "draft"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {student.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {student.version > 0 ? (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                            <span className="font-bold">v{student.version}</span>
                            {student.supersedesMarkId && (
                              <span
                                className="text-[10px] text-indigo-600"
                                title="Supersedes prior version"
                              >
                                (amended)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">&mdash;</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {student.status === "rejected" && student.rejectionReason && (
                          <div className="mb-1 rounded bg-rose-50 p-1.5 text-[11px] text-rose-700 border border-rose-200">
                            <strong>Note:</strong> {student.rejectionReason}
                          </div>
                        )}

                        {(student.status === "submitted" || student.status === "verified") && (
                          <button
                            type="button"
                            onClick={() =>
                              setIsAmendMode((prev) => ({
                                ...prev,
                                [student.enrollmentId]: !prev[student.enrollmentId],
                              }))
                            }
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                          >
                            {isAmendMode[student.enrollmentId]
                              ? "Cancel Amendment"
                              : "Amend Mark (v+1)"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Buttons Bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="h-4 w-4 text-slate-400" />
            <span>
              Drafts can be modified repeatedly. Submitting sends the batch to the Exam Controller &amp; HOD for official verification.
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => void handleSaveBatch("save_draft")}
              disabled={isSaving || roster.length === 0}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-2xs disabled:opacity-40 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save as Draft</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSaveBatch("submit")}
              disabled={isSaving || roster.length === 0}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs disabled:opacity-40 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Submit for Verification</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Add Subject / Component Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  {addType === "subject" ? (
                    <BookPlus className="h-5 w-5" />
                  ) : (
                    <PlusCircle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {addType === "subject"
                      ? "Add New Subject Offering"
                      : "Add Assessment Component"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {addType === "subject"
                      ? "Append a new course offering to the evaluation roster"
                      : `Append assessment component to ${
                          currentOffering?.courseCode || "selected course"
                        }`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAddType("component")}
                className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                  addType === "component"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Assessment Component
              </button>
              <button
                type="button"
                onClick={() => setAddType("subject")}
                className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                  addType === "subject"
                    ? "bg-white text-purple-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                New Subject
              </button>
            </div>

            <form onSubmit={handleCreateComponentOrSubject} className="space-y-3.5 text-xs">
              {addType === "subject" ? (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Course Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newSubjectCode}
                      onChange={(e) => setNewSubjectCode(e.target.value)}
                      placeholder="e.g. CS405"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 uppercase font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Course Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newSubjectTitle}
                      onChange={(e) => setNewSubjectTitle(e.target.value)}
                      placeholder="e.g. Cloud Computing Systems"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Course Credits
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={newSubjectCredits}
                      onChange={(e) => setNewSubjectCredits(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-100 text-[11px] text-indigo-900">
                  Adding component to:{" "}
                  <span className="font-bold">
                    {currentOffering?.courseCode} - {currentOffering?.courseTitle}
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {addType === "subject"
                    ? "Initial Assessment Component Name"
                    : "Assessment Component Name"}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  placeholder="e.g. Practical Lab Exam, Mini Project, Quiz 2"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Max Marks <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="1000"
                    step="1"
                    value={newMaxMarks}
                    onChange={(e) => setNewMaxMarks(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Weightage % <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    step="0.5"
                    value={newWeightage}
                    onChange={(e) => setNewWeightage(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingComponent}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {isCreatingComponent ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Create &amp; Open Roster</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
