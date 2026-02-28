import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type GradeLite = { id: string; name: string };
type StudentLite = { id: string; name: string; gradeId?: string; classId?: string; avatar?: string; schoolId?: string };
type ClassLite = { id: string; name: string; gradeId?: string; schoolId?: string };

type AcademicLookupApi = {
    gradesById: Record<string, GradeLite>;
    studentsById: Record<string, StudentLite>;
    classesById: Record<string, ClassLite>;

    getGradeName: (gradeId?: string | null) => string;
    getStudentName: (studentId?: string | null) => string;
    getClassName: (classId?: string | null) => string;

    prefetchGrades: (gradeIds: string[]) => Promise<void>;
    prefetchStudents: (studentIds: string[]) => Promise<void>;
    prefetchClasses: (classIds: string[]) => Promise<void>;
};

const AcademicLookupContext = createContext<AcademicLookupApi | null>(null);

function chunk<T>(arr: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function normIds(ids: string[]) {
    return Array.from(new Set(ids.map(x => String(x || "").trim()).filter(Boolean)));
}

function pickStudentName(s: any) {
    return (
        String(s?.name || "").trim() ||
        String(s?.fullName || "").trim() ||
        String(s?.displayName || "").trim() ||
        [s?.firstName, s?.lastName].filter(Boolean).join(" ").trim() ||
        "—"
    );
}

function pickGradeName(g: any) {
    return String(g?.name || g?.title || g?.gradeName || "").trim() || "—";
}

function pickClassName(c: any) {
    return String(c?.name || c?.title || c?.className || "").trim() || "—";
}

export const AcademicLookupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [gradesById, setGradesById] = useState<Record<string, GradeLite>>({});
    const [studentsById, setStudentsById] = useState<Record<string, StudentLite>>({});
    const [classesById, setClassesById] = useState<Record<string, ClassLite>>({});

    const inflight = useRef<Record<string, Promise<void>>>({});

    const prefetchGrades = useCallback(async (gradeIds: string[]) => {
        const ids = normIds(gradeIds).filter(id => !gradesById[id]);
        if (ids.length === 0) return;

        const key = `grades:${ids.join(",")}`;
        if (inflight.current[key]) return inflight.current[key];

        inflight.current[key] = (async () => {
            for (const part of chunk(ids, 10)) {
                const qy = query(collection(db, "grades"), where("__name__", "in", part));
                const snap = await getDocs(qy);
                const next: Record<string, GradeLite> = {};
                snap.docs.forEach(d => {
                    next[d.id] = { id: d.id, name: pickGradeName(d.data()) };
                });
                setGradesById(prev => ({ ...prev, ...next }));
            }
        })().finally(() => {
            delete inflight.current[key];
        });

        return inflight.current[key];
    }, [gradesById]);

    const prefetchStudents = useCallback(async (studentIds: string[]) => {
        const ids = normIds(studentIds).filter(id => !studentsById[id]);
        if (ids.length === 0) return;

        const key = `students:${ids.join(",")}`;
        if (inflight.current[key]) return inflight.current[key];

        inflight.current[key] = (async () => {
            for (const part of chunk(ids, 10)) {
                const qy = query(collection(db, "students"), where("__name__", "in", part));
                const snap = await getDocs(qy);
                const next: Record<string, StudentLite> = {};
                snap.docs.forEach(d => {
                    const s = d.data() as any;
                    next[d.id] = {
                        id: d.id,
                        name: pickStudentName(s),
                        gradeId: String(s?.gradeId || "").trim() || undefined,
                        classId: String(s?.classId || "").trim() || undefined,
                        avatar: s?.avatar ? String(s.avatar) : undefined,
                        schoolId: s?.schoolId ? String(s.schoolId) : undefined,
                    };
                });
                setStudentsById(prev => ({ ...prev, ...next }));
            }
        })().finally(() => {
            delete inflight.current[key];
        });

        return inflight.current[key];
    }, [studentsById]);

    const prefetchClasses = useCallback(async (classIds: string[]) => {
        const ids = normIds(classIds).filter(id => !classesById[id]);
        if (ids.length === 0) return;

        const key = `classes:${ids.join(",")}`;
        if (inflight.current[key]) return inflight.current[key];

        inflight.current[key] = (async () => {
            for (const part of chunk(ids, 10)) {
                const qy = query(collection(db, "classes"), where("__name__", "in", part));
                const snap = await getDocs(qy);
                const next: Record<string, ClassLite> = {};
                snap.docs.forEach(d => {
                    const c = d.data() as any;
                    next[d.id] = {
                        id: d.id,
                        name: pickClassName(c),
                        gradeId: String(c?.gradeId || "").trim() || undefined,
                        schoolId: c?.schoolId ? String(c.schoolId) : undefined,
                    };
                });
                setClassesById(prev => ({ ...prev, ...next }));
            }
        })().finally(() => {
            delete inflight.current[key];
        });

        return inflight.current[key];
    }, [classesById]);

    const getGradeName = useCallback((gradeId?: string | null) => {
        const id = String(gradeId || "").trim();
        return id ? (gradesById[id]?.name || "—") : "—";
    }, [gradesById]);

    const getStudentName = useCallback((studentId?: string | null) => {
        const id = String(studentId || "").trim();
        return id ? (studentsById[id]?.name || "—") : "—";
    }, [studentsById]);

    const getClassName = useCallback((classId?: string | null) => {
        const id = String(classId || "").trim();
        return id ? (classesById[id]?.name || "—") : "—";
    }, [classesById]);

    const value = useMemo<AcademicLookupApi>(() => ({
        gradesById,
        studentsById,
        classesById,
        getGradeName,
        getStudentName,
        getClassName,
        prefetchGrades,
        prefetchStudents,
        prefetchClasses,
    }), [
        gradesById, studentsById, classesById,
        getGradeName, getStudentName, getClassName,
        prefetchGrades, prefetchStudents, prefetchClasses
    ]);

    return <AcademicLookupContext.Provider value={value}>{children}</AcademicLookupContext.Provider>;
};

export function useAcademicLookup() {
    const ctx = useContext(AcademicLookupContext);
    if (!ctx) throw new Error("useAcademicLookup must be used within AcademicLookupProvider");
    return ctx;
}
