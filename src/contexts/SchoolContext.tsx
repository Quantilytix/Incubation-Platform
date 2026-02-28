import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    ReactNode,
} from "react"
import {
    GradeScale,
    AssessmentWeighting,
    getDefaultGradingScale,
    getDefaultWeighting,
} from "@/lib/examBoards"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"

// ==================== TYPES ====================

export type SchoolType = "primary" | "secondary"

export interface AdminPermission {
    id: string
    name: string
    description: string
    category: "finance" | "hr" | "operations" | "academic"
}

export interface AdminRole {
    id: string
    name: string
    permissions: string[]
    assignedTo?: string
}

export interface SubjectTeacher {
    subject: string
    teacherId: string
    teacherName: string
}

export interface SubjectSetting {
    subjectId: string
    subjectName: string
    isSpecialist: boolean
    teacherId?: string
    teacherName?: string
}

export interface ClassConfig {
    id: string
    name: string
    gradeId: string
    classTeacherId?: string
    classTeacherName?: string
    subjectTeachers?: SubjectTeacher[]
}

export interface SchoolConfiguration {
    id: string
    name: string
    type: SchoolType
    hasNurseRole: boolean
    headmasterName: string
    setupComplete: boolean
    roles: AdminRole[]
    grades: string[]
    subjects: string[]
    country: string
    examBoard: string
    gradingScale: GradeScale[]
    assessmentWeighting: AssessmentWeighting
    subjectSettings: SubjectSetting[]
    baseCurrency?: string
    displayCurrency?: string
    exchangeRate?: number
    logoUrl?: string
}

// ==================== DEFAULTS ====================

export const defaultPermissions: AdminPermission[] = [
    { id: "fee-collection", name: "Fee Collection", description: "Collect and record student fees", category: "finance" },
    { id: "fee-reports", name: "Financial Reports", description: "View and generate financial reports", category: "finance" },
    { id: "payment-tracking", name: "Payment Tracking", description: "Track payment history and outstanding balances", category: "finance" },
    { id: "leave-approval", name: "Leave Approval", description: "Review and approve staff leave requests", category: "hr" },
    { id: "staff-records", name: "Staff Records", description: "Manage teacher and staff information", category: "hr" },
    { id: "attendance-reports", name: "Attendance Reports", description: "View attendance analytics", category: "hr" },
    { id: "scheduling", name: "Scheduling", description: "Manage class schedules and timetables", category: "operations" },
    { id: "facilities", name: "Facilities", description: "Room allocation and resource management", category: "operations" },
    { id: "communications", name: "Communications", description: "Send school-wide announcements", category: "operations" },
    { id: "scheme-approval", name: "Scheme Approval", description: "Review and approve curriculum schemes", category: "academic" },
    { id: "exam-scheduling", name: "Exam Scheduling", description: "Plan and schedule examinations", category: "academic" },
    { id: "grading-policy", name: "Grading Policy", description: "Set and modify grading standards", category: "academic" },
]

export const defaultRoleTemplates: Omit<AdminRole, "assignedTo">[] = [
    { id: "finance-manager", name: "Finance Manager", permissions: ["fee-collection", "fee-reports", "payment-tracking"] },
    { id: "hr-manager", name: "HR Manager", permissions: ["leave-approval", "staff-records", "attendance-reports"] },
    { id: "operations-manager", name: "Operations Manager", permissions: ["scheduling", "facilities", "communications"] },
    { id: "academic-coordinator", name: "Academic Coordinator", permissions: ["scheme-approval", "exam-scheduling", "grading-policy"] },
    { id: "administrator", name: "Administrator (All)", permissions: defaultPermissions.map((p) => p.id) },
]

const defaultConfig: SchoolConfiguration = {
    id: "school-1",
    name: "Sunrise Academy",
    type: "primary",
    hasNurseRole: true,
    headmasterName: "Dr. Benjamin Moyo",
    setupComplete: false,
    roles: [],
    grades: ["Grade 5", "Grade 6"],
    subjects: ["Mathematics", "English", "Science", "Social Studies"],
    country: "ZW",
    examBoard: "zimsec",
    gradingScale: getDefaultGradingScale(),
    assessmentWeighting: getDefaultWeighting(),
    subjectSettings: [],
}

// ==================== CONTEXT ====================

interface SchoolContextType {
    config: SchoolConfiguration
    loadingSchool: boolean
    updateConfig: (updates: Partial<SchoolConfiguration>) => void
    setConfig: (config: SchoolConfiguration) => void
    getPermission: (permissionId: string) => AdminPermission | undefined
    hasPermission: (roleId: string, permissionId: string) => boolean
    isPrimarySchool: boolean
    isSecondarySchool: boolean
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined)

function normalizeSchoolConfig(schoolId: string, data: any): SchoolConfiguration {
    return {
        id: schoolId,
        name: data?.name || "School",
        type: (data?.type as SchoolType) || "primary",
        hasNurseRole: !!data?.hasNurseRole,
        headmasterName: data?.headmasterName || "",
        setupComplete: !!data?.setupComplete,
        roles: Array.isArray(data?.roles) ? data.roles : [],
        grades: Array.isArray(data?.grades) ? data.grades : [],
        subjects: Array.isArray(data?.subjects) ? data.subjects : [],
        country: data?.country || "ZW",
        examBoard: data?.examBoard || "zimsec",
        gradingScale: Array.isArray(data?.gradingScale) ? data.gradingScale : getDefaultGradingScale(),
        assessmentWeighting: data?.assessmentWeighting || getDefaultWeighting(),
        subjectSettings: Array.isArray(data?.subjectSettings) ? data.subjectSettings : [],
        baseCurrency: data?.baseCurrency,
        displayCurrency: data?.displayCurrency,
        exchangeRate: data?.exchangeRate,
        logoUrl: data?.logoUrl,
    }
}

function safeLoadLocalConfig(): SchoolConfiguration | null {
    const saved = localStorage.getItem("schoolConfig")
    if (!saved) return null
    try {
        return JSON.parse(saved)
    } catch {
        return null
    }
}

// ==================== PROVIDER ====================

export function SchoolProvider({ children }: { children: ReactNode }) {
    const [config, setConfigState] = useState<SchoolConfiguration>(() => {
        // start with local cache if exists, else default (just for initial paint)
        return safeLoadLocalConfig() || defaultConfig
    })
    const [loadingSchool, setLoadingSchool] = useState(true)

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (fbUser) => {
            setLoadingSchool(true)

            try {
                if (!fbUser) {
                    setConfigState(safeLoadLocalConfig() || defaultConfig)
                    return
                }


                const userSnap = await getDoc(doc(db, "users", fbUser.uid))

                if (!userSnap.exists()) {
                    setConfigState(safeLoadLocalConfig() || defaultConfig)
                    return
                }

                const userData: any = userSnap.data()
                const schoolId = userData?.schoolId


                if (!schoolId) {

                    setConfigState(safeLoadLocalConfig() || defaultConfig)
                    return
                }


                const schoolSnap = await getDoc(doc(db, "schools", schoolId))

                if (!schoolSnap.exists()) {
                    setConfigState(safeLoadLocalConfig() || defaultConfig)
                    return
                }

                const schoolData = schoolSnap.data()
                const cfg = normalizeSchoolConfig(schoolId, schoolData)


                setConfigState(cfg)
                localStorage.setItem("schoolConfig", JSON.stringify(cfg))
            } catch (e) {
                setConfigState(safeLoadLocalConfig() || defaultConfig)
            } finally {
                setLoadingSchool(false)
            }
        })

        return () => unsub()
    }, [])

    const updateConfig = (updates: Partial<SchoolConfiguration>) => {
        setConfigState((prev) => {
            const next = { ...prev, ...updates }
            localStorage.setItem("schoolConfig", JSON.stringify(next))
            return next
        })
    }

    const setConfig = (newConfig: SchoolConfiguration) => {
        localStorage.setItem("schoolConfig", JSON.stringify(newConfig))
        setConfigState(newConfig)
    }

    const getPermission = (permissionId: string) =>
        defaultPermissions.find((p) => p.id === permissionId)

    const hasPermission = (roleId: string, permissionId: string) => {
        const role = config.roles.find((r) => r.id === roleId)
        return role?.permissions?.includes(permissionId) ?? false
    }

    const value = useMemo<SchoolContextType>(
        () => ({
            config,
            loadingSchool,
            updateConfig,
            setConfig,
            getPermission,
            hasPermission,
            isPrimarySchool: config.type === "primary",
            isSecondarySchool: config.type === "secondary",
        }),
        [config, loadingSchool]
    )

    return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>
}

// ==================== HOOK ====================

export function useSchool() {
    const context = useContext(SchoolContext)
    if (!context) throw new Error("useSchool must be used within a SchoolProvider")
    return context
}
