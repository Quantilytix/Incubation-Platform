import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

type Role = "admin" | "headmaster" | "administrator" | "teacher" | "student" | "parent" | "system-admin" | string;

export type MarkRow = {
    id: string;
    schoolId: string;
    studentId: string;
    assessmentId: string;
    score?: number;
    percentage?: number;
    grade?: string;
    // optional fields you may have:
    classId?: string;
    enteredAt?: any;
    updatedAt?: any;
};

export type AssessmentRow = {
    id: string;
    schoolId: string;
    classId?: string;
    subjectId?: string;
    subjectName?: string;
    name?: string;
    type?: string;
    maxMarks?: number;
    date?: any; // Firestore Timestamp
};

export type SubjectKey = string; // normalized subjectName or subjectId

export type StudentAgg = {
    studentId: string;
    avgPct: number;
    avgScore?: number;
    count: number;
    bySubject: Record<SubjectKey, { avgPct: number; count: number }>;
};

export type GradeAgg = {
    gradeId: string;
    avgPct: number;
    count: number; // number of marks used
    bySubject: Record<SubjectKey, { avgPct: number; count: number }>;
};

export type PerfBucket = "excellent" | "good" | "needs-attention";

function clampPct(n: number) {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}

function normSubject(s?: string) {
    const v = String(s || "").trim();
    if (!v) return "unknown";
    return v.toLowerCase();
}

function perfBucket(avgPct: number): PerfBucket {
    const p = clampPct(avgPct);
    if (p >= 80) return "excellent";
    if (p >= 60) return "good";
    return "needs-attention";
}

type MarksAnalyticsContextValue = {
    loading: boolean;
    error: string | null;

    marks: MarkRow[];
    assessments: AssessmentRow[];

    // fast maps
    assessmentById: Map<string, AssessmentRow>;
    marksByStudent: Map<string, MarkRow[]>;

    // core aggregations
    studentAgg: Map<string, StudentAgg>;

    // helpers to compute aggregates using your own student lists
    computeGradeAgg: (students: { id: string; gradeId?: string }[]) => Map<string, GradeAgg>;
    computeSubjectAggForSchool: () => Record<SubjectKey, { avgPct: number; count: number }>;

    // convenience helpers
    getStudentOverall: (studentId: string) => { avgPct: number; count: number; bucket: PerfBucket };
    getStudentBySubject: (studentId: string) => Record<SubjectKey, { avgPct: number; count: number }>;

    // filtering utilities (re-usable in report cards)
    filterMarks: (opts: {
        studentId?: string;
        gradeId?: string;
        classId?: string;
        subject?: string;
        from?: Date;
        to?: Date;
        students?: { id: string; gradeId?: string; classId?: string }[]; // for grade/class filters
    }) => MarkRow[];

    // refresh
    refresh: () => Promise<void>;
};

const MarksAnalyticsContext = createContext<MarksAnalyticsContextValue | null>(null);

export function useMarksAnalytics() {
    const ctx = useContext(MarksAnalyticsContext);
    if (!ctx) throw new Error("useMarksAnalytics must be used inside <MarksAnalyticsProvider />");
    return ctx;
}

type ProviderProps = {
    children: React.ReactNode;
    /**
     * If true, provider will attempt to load ALL marks for the school.
     * Use for admin/headmaster dashboards.
     */
    scope?: "school" | "student";
    /**
     * Only used when scope="student" (e.g. student dashboard).
     * If not provided, it will try to infer from user.studentId (if you store it in auth profile).
     */
    studentId?: string;
};

export function MarksAnalyticsProvider({ children, scope = "school", studentId }: ProviderProps) {
    const { user } = useAuth() as any;

    const schoolId = user?.schoolId as string | undefined;
    const role = (user?.role as Role) || "";
    const effectiveStudentId = studentId || user?.studentId;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [marks, setMarks] = useState<MarkRow[]>([]);
    const [assessments, setAssessments] = useState<AssessmentRow[]>([]);

    const canLoadSchoolScope = scope === "school";
    const canLoadStudentScope = scope === "student" && !!effectiveStudentId;

    async function load() {
        if (!schoolId) return;

        setLoading(true);
        setError(null);

        try {
            // 1) assessments (needed for subjectName + dates)
            const assessQ = query(collection(db, "assessments"), where("schoolId", "==", schoolId));
            const assessSnap = await getDocs(assessQ);
            const assessRows: AssessmentRow[] = assessSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
            setAssessments(assessRows);

            // 2) marks
            let marksQ;
            if (canLoadSchoolScope) {
                marksQ = query(collection(db, "marks"), where("schoolId", "==", schoolId));
            } else if (canLoadStudentScope) {
                marksQ = query(
                    collection(db, "marks"),
                    where("schoolId", "==", schoolId),
                    where("studentId", "==", effectiveStudentId)
                );
            } else {
                setMarks([]);
                return;
            }

            const marksSnap = await getDocs(marksQ);
            const markRows: MarkRow[] = marksSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
            setMarks(markRows);
        } catch (e: any) {
            setError(e?.message || "Failed to load marks/assessments");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        // don’t spam requests
        if (!schoolId) return;
        if (scope === "student" && !effectiveStudentId) return;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId, scope, effectiveStudentId]);

    const assessmentById = useMemo(() => {
        const m = new Map<string, AssessmentRow>();
        for (const a of assessments) m.set(a.id, a);
        return m;
    }, [assessments]);

    const marksByStudent = useMemo(() => {
        const m = new Map<string, MarkRow[]>();
        for (const r of marks) {
            if (!r.studentId) continue;
            const arr = m.get(r.studentId) || [];
            arr.push(r);
            m.set(r.studentId, arr);
        }
        return m;
    }, [marks]);

    const studentAgg = useMemo(() => {
        const out = new Map<string, StudentAgg>();

        for (const [studentId, rows] of marksByStudent.entries()) {
            let sum = 0;
            let count = 0;

            const subjSum = new Map<SubjectKey, number>();
            const subjCount = new Map<SubjectKey, number>();

            for (const r of rows) {
                const pct = typeof r.percentage === "number" ? r.percentage : undefined;
                if (pct == null) continue;
                sum += pct;
                count++;

                const a = assessmentById.get(r.assessmentId);
                const subj = normSubject(a?.subjectName || a?.subjectId || "unknown");

                subjSum.set(subj, (subjSum.get(subj) || 0) + pct);
                subjCount.set(subj, (subjCount.get(subj) || 0) + 1);
            }

            const bySubject: StudentAgg["bySubject"] = {};
            for (const [k, s] of subjSum.entries()) {
                const c = subjCount.get(k) || 0;
                bySubject[k] = { avgPct: c ? s / c : 0, count: c };
            }

            out.set(studentId, {
                studentId,
                avgPct: count ? sum / count : 0,
                count,
                bySubject,
            });
        }

        return out;
    }, [marksByStudent, assessmentById]);

    const getStudentOverall = (studentId: string) => {
        const agg = studentAgg.get(studentId);
        const avg = agg?.avgPct ?? 0;
        const c = agg?.count ?? 0;
        return { avgPct: clampPct(avg), count: c, bucket: perfBucket(avg) };
    };

    const getStudentBySubject = (studentId: string) => {
        const agg = studentAgg.get(studentId);
        const out: Record<string, { avgPct: number; count: number }> = {};
        const by = agg?.bySubject || {};
        Object.keys(by).forEach((k) => {
            out[k] = { avgPct: clampPct(by[k].avgPct), count: by[k].count };
        });
        return out;
    };

    const computeGradeAgg = (students: { id: string; gradeId?: string }[]) => {
        const gradeStudents = new Map<string, string[]>();
        for (const s of students) {
            const gid = s.gradeId || "unknown";
            const arr = gradeStudents.get(gid) || [];
            arr.push(s.id);
            gradeStudents.set(gid, arr);
        }

        const out = new Map<string, GradeAgg>();

        for (const [gradeId, studentIds] of gradeStudents.entries()) {
            let sum = 0;
            let count = 0;

            const subjSum = new Map<SubjectKey, number>();
            const subjCount = new Map<SubjectKey, number>();

            for (const sid of studentIds) {
                const rows = marksByStudent.get(sid) || [];
                for (const r of rows) {
                    const pct = typeof r.percentage === "number" ? r.percentage : undefined;
                    if (pct == null) continue;
                    sum += pct;
                    count++;

                    const a = assessmentById.get(r.assessmentId);
                    const subj = normSubject(a?.subjectName || a?.subjectId || "unknown");

                    subjSum.set(subj, (subjSum.get(subj) || 0) + pct);
                    subjCount.set(subj, (subjCount.get(subj) || 0) + 1);
                }
            }

            const bySubject: GradeAgg["bySubject"] = {};
            for (const [k, s] of subjSum.entries()) {
                const c = subjCount.get(k) || 0;
                bySubject[k] = { avgPct: c ? s / c : 0, count: c };
            }

            out.set(gradeId, {
                gradeId,
                avgPct: count ? sum / count : 0,
                count,
                bySubject,
            });
        }

        return out;
    };

    const computeSubjectAggForSchool = () => {
        const subjSum = new Map<SubjectKey, number>();
        const subjCount = new Map<SubjectKey, number>();

        for (const r of marks) {
            const pct = typeof r.percentage === "number" ? r.percentage : undefined;
            if (pct == null) continue;

            const a = assessmentById.get(r.assessmentId);
            const subj = normSubject(a?.subjectName || a?.subjectId || "unknown");

            subjSum.set(subj, (subjSum.get(subj) || 0) + pct);
            subjCount.set(subj, (subjCount.get(subj) || 0) + 1);
        }

        const out: Record<string, { avgPct: number; count: number }> = {};
        for (const [k, s] of subjSum.entries()) {
            const c = subjCount.get(k) || 0;
            out[k] = { avgPct: clampPct(c ? s / c : 0), count: c };
        }
        return out;
    };

    const filterMarks = (opts: {
        studentId?: string;
        gradeId?: string;
        classId?: string;
        subject?: string;
        from?: Date;
        to?: Date;
        students?: { id: string; gradeId?: string; classId?: string }[];
    }) => {
        const subjectNorm = opts.subject ? normSubject(opts.subject) : null;

        // map studentId -> grade/class for filtering
        const studentMeta = new Map<string, { gradeId?: string; classId?: string }>();
        (opts.students || []).forEach((s) => studentMeta.set(s.id, { gradeId: s.gradeId, classId: (s as any).classId }));

        return marks.filter((m) => {
            if (opts.studentId && m.studentId !== opts.studentId) return false;

            if (opts.gradeId || opts.classId) {
                const meta = studentMeta.get(m.studentId) || {};
                if (opts.gradeId && meta.gradeId !== opts.gradeId) return false;
                if (opts.classId && (meta as any).classId !== opts.classId) return false;
            }

            const a = assessmentById.get(m.assessmentId);
            if (!a) return false;

            if (subjectNorm) {
                const s = normSubject(a.subjectName || a.subjectId || "unknown");
                if (s !== subjectNorm) return false;
            }

            if (opts.from || opts.to) {
                const dt = a.date?.toDate?.() ? a.date.toDate() : null;
                if (!dt) return false;
                if (opts.from && dt < opts.from) return false;
                if (opts.to && dt > opts.to) return false;
            }

            return true;
        });
    };

    const value: MarksAnalyticsContextValue = {
        loading,
        error,

        marks,
        assessments,

        assessmentById,
        marksByStudent,

        studentAgg,

        computeGradeAgg,
        computeSubjectAggForSchool,

        getStudentOverall,
        getStudentBySubject,

        filterMarks,

        refresh: load,
    };

    return <MarksAnalyticsContext.Provider value={value}>{children}</MarksAnalyticsContext.Provider>;
}
