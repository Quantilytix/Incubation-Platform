// src/pages/tasks/TasksManager.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Button,
    Col,
    DatePicker,
    Divider,
    Drawer,
    Form,
    Grid,
    Input,
    Modal,
    Row,
    Select,
    Segmented,
    Space,
    Statistic,
    Switch,
    Table,
    Tag,
    Tooltip,
    Typography,
    Progress,
    message,
    Collapse
} from 'antd'
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    FileSearchOutlined,
    PlusOutlined,
    SettingOutlined,
    InboxOutlined,
    BellOutlined,
    RobotOutlined,
    CloseOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import {
    collection,
    doc,
    onSnapshot,
    query,
    setDoc,
    updateDoc,
    where,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore'

// Highcharts (pie only)
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

// Your MotionCard
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'

const { Text } = Typography
const { useBreakpoint } = Grid
const { Panel } = Collapse

/**
 * HARD RULE:
 * NEVER show incubatees in selectors.
 * We enforce by filtering fetched users (internal roles only).
 */
const ALLOWED_INTERNAL_ROLES = ['consultant', 'operations'] as const
type InternalRole = (typeof ALLOWED_INTERNAL_ROLES)[number]

type UserRow = {
    id: string
    name?: string
    email?: string
    role?: string
    companyCode?: string
}

type ProgramRow = {
    id: string
    name?: string
    companyCode?: string
}

type TaskStatus = 'To Do' | 'In Progress' | 'Awaiting Proof' | 'Completed' | 'Overdue' | 'Archived'

type Assignee = {
    userId: string
    role: InternalRole
}

type TaskRow = {
    id: string
    companyCode?: string
    company_code?: string // legacy
    scope?: 'company' | 'program'
    programId?: string | null

    title: string
    description?: string
    taskType?: { id: string; name: string; proofRequired: boolean } | any

    priority?: 'low' | 'medium' | 'high'
    status?: TaskStatus

    // legacy (single)
    assignedRole?: InternalRole
    assignedTo?: string

    // new (multi)
    assignees?: Assignee[]

    dueDate?: any
    createdAt?: any
    createdBy?: string
    completedAt?: any

    archived?: boolean
    archivedAt?: any
    archivedBy?: string

    recurrence?: {
        enabled: boolean
        pattern: 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom_days'
        interval?: number
        nextDueDate?: any
        lastRunAt?: any
    }

    proof?: {
        items?: Array<{
            id: string
            label: string
            link: string
            note?: string
            uploadedAt: any
            uploadedBy: string
        }>
    }

    lastManualReminderAt?: any

    [k: string]: any
}

type ReminderRule = {
    id: string
    companyCode: string
    enabled: boolean
    dueSoonHours: number
    overdueHours: number
    cooldownHours: number
    statuses: string[]
    updatedAt?: any
    updatedBy?: string
}

const ENHANCED_TASK_TYPES = [
    { id: 'document-review', name: 'Document Review', proofRequired: true },
    { id: 'compliance-check', name: 'Compliance Check', proofRequired: true },
    { id: 'client-outreach', name: 'Client Outreach', proofRequired: true },
    { id: 'training-delivery', name: 'Training Delivery', proofRequired: true },
    { id: 'other', name: 'Other Task', proofRequired: false }
] as const

const statusOrder: TaskStatus[] = ['To Do', 'In Progress', 'Awaiting Proof', 'Overdue', 'Completed', 'Archived']

function safeLower(x: any) {
    return String(x || '').toLowerCase().trim()
}

function normalizeDate(d: any) {
    return d?.toDate ? d.toDate() : d ? new Date(d) : null
}

function statusColor(s: TaskStatus) {
    if (s === 'Completed') return 'green'
    if (s === 'Overdue') return 'red'
    if (s === 'Awaiting Proof') return 'orange'
    if (s === 'In Progress') return 'geekblue'
    if (s === 'Archived') return 'default'
    return 'blue'
}

function computeNextDue(from: Date, pattern: TaskRow['recurrence']['pattern'], interval: number) {
    const base = dayjs(from)
    const n = Math.max(1, Number(interval || 1))
    switch (pattern) {
        case 'daily':
            return base.add(n, 'day').toDate()
        case 'weekly':
            return base.add(n, 'week').toDate()
        case 'monthly':
            return base.add(n, 'month').toDate()
        case 'quarterly':
            return base.add(n * 3, 'month').toDate()
        case 'custom_days':
            return base.add(n, 'day').toDate()
        default:
            return null
    }
}

export const TasksManager: React.FC = () => {
    const { user } = useFullIdentity()
    const screens = useBreakpoint()

    const [segment, setSegment] = useState<'tasks' | 'signals' | 'reminders'>('tasks')

    const [users, setUsers] = useState<UserRow[]>([])
    const [programs, setPrograms] = useState<ProgramRow[]>([])
    const [tasks, setTasks] = useState<TaskRow[]>([])
    const [rule, setRule] = useState<ReminderRule | null>(null)

    const [taskModalOpen, setTaskModalOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)

    const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null)
    const [proofDrawerOpen, setProofDrawerOpen] = useState(false)

    const [viewTasksDrawerOpen, setViewTasksDrawerOpen] = useState(false)
    const [viewTasksDrawerTitle, setViewTasksDrawerTitle] = useState<string>('Tasks')
    const [viewTasksRows, setViewTasksRows] = useState<TaskRow[]>([])

    const [taskForm] = Form.useForm()
    const [settingsForm] = Form.useForm()
    const [proofForm] = Form.useForm()

    const [filters, setFilters] = useState<{
        status?: TaskStatus
        priority?: 'low' | 'medium' | 'high'
        assignedTo?: string // supports quick filter on a userId
        scope?: 'company' | 'program'
        q?: string
        includeArchived?: boolean
    }>({ includeArchived: false })

    // States tasks being reviewed
    const [pendingTasks, setPendingTasks] = useState<any[]>([]);
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);

    // Wizard state for extracted tasks
    const [wizardOpen, setWizardOpen] = useState(false)
    const [wizardIndex, setWizardIndex] = useState(0)
    const [wizardSaved, setWizardSaved] = useState<any[]>([]) // read-only review of saved tasks
    const [wizardForm] = Form.useForm()

    const totalSteps = pendingTasks.length + 1 // +1 for final review step
    const isReviewStep = wizardIndex >= pendingTasks.length

    const currentDraft = useMemo(() => {
        if (isReviewStep) return null
        return pendingTasks[wizardIndex] || null
    }, [pendingTasks, wizardIndex, isReviewStep])

    const openWizardFromExtraction = (drafts: any[]) => {
        setPendingTasks(drafts)
        setWizardSaved([])
        setWizardIndex(0)
        setWizardOpen(true)
        // seed first task into the form
        setTimeout(() => {
            const t = drafts[0]
            if (!t) return
            wizardForm.setFieldsValue({
                title: t.title,
                description: t.description || '',
                priority: t.priority || 'medium',
                scope: t.scope || 'company',
                programId: t.programId || null,
                taskType: t.taskType || 'other',
                dueDate: t.dueDate || dayjs().add(3, 'day'),
                assignees: (t.assignees || []).map((a: any) => a.userId),
                recurrenceEnabled: !!t?.recurrence?.enabled,
                recurrencePattern: t?.recurrence?.pattern || 'none',
                recurrenceInterval: t?.recurrence?.interval || 1
            })
        }, 0)
    }

    const loadDraftIntoForm = (draft: any) => {
        wizardForm.setFieldsValue({
            title: draft.title,
            description: draft.description || '',
            priority: draft.priority || 'medium',
            scope: draft.scope || 'company',
            programId: draft.programId || null,
            taskType: draft.taskType || 'other',
            dueDate: draft.dueDate || dayjs().add(3, 'day'),
            assignees: (draft.assignees || []).map((a: any) => a.userId),
            recurrenceEnabled: !!draft?.recurrence?.enabled,
            recurrencePattern: draft?.recurrence?.pattern || 'none',
            recurrenceInterval: draft?.recurrence?.interval || 1
        })
    }

    // Convert wizard form values -> your TaskRow payload shape
    const buildFinalTaskPayloadFromWizard = (values: any) => {
        const assigneeIds: string[] = Array.isArray(values.assignees) ? values.assignees : []
        const allowedSet = new Set(safeInternalUsers.map(u => u.id))
        for (const id of assigneeIds) {
            if (!allowedSet.has(id)) throw new Error('One or more selected users are not allowed.')
        }

        const assignees: Assignee[] = assigneeIds.map(uid => ({
            userId: uid,
            role: resolveRole(uid)
        }))

        const selectedType = ENHANCED_TASK_TYPES.find(t => t.id === values.taskType)
        const taskType = selectedType || { id: 'custom', name: values.taskType || 'Custom Task', proofRequired: false }

        const dueDate = values.dueDate?.toDate ? values.dueDate.toDate() : values.dueDate
        const scope = values.scope || 'company'
        const programId = scope === 'program' ? (values.programId || null) : null

        const recurrenceEnabled = !!values.recurrenceEnabled
        const recurrencePattern = values.recurrencePattern || 'none'
        const recurrenceInterval = Math.max(1, Number(values.recurrenceInterval || 1))
        const nextDue =
            recurrenceEnabled && recurrencePattern !== 'none'
                ? computeNextDue(dueDate, recurrencePattern, recurrenceInterval)
                : null

        const recurrence =
            recurrenceEnabled && recurrencePattern !== 'none'
                ? {
                    enabled: true,
                    pattern: recurrencePattern,
                    interval: recurrenceInterval,
                    nextDueDate: nextDue ? Timestamp.fromDate(nextDue) : null,
                    lastRunAt: null
                }
                : { enabled: false, pattern: 'none' }

        return {
            title: values.title,
            description: values.description || '',
            priority: values.priority || 'medium',
            scope,
            programId,
            taskType,
            assignees,
            // legacy (first assignee)
            assignedRole: assignees[0]?.role,
            assignedTo: assignees[0]?.userId,
            dueDate: Timestamp.fromDate(dueDate),
            recurrence,
            proof: { items: [] }
        }
    }


    // --------------------------------------------
    // Users (internal only, company scoped)
    // --------------------------------------------
    useEffect(() => {
        if (!user?.companyCode) return
        const unsub = onSnapshot(
            query(collection(db, 'users'), where('companyCode', '==', user.companyCode)),
            snap => {
                const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as UserRow[]
                const internal = all.filter(u => ALLOWED_INTERNAL_ROLES.includes(safeLower(u.role) as InternalRole))
                setUsers(internal)
            },
            err => {
                console.error(err)
                message.error('Failed to load users.')
            }
        )
        return () => unsub()
    }, [user?.companyCode])

    const safeInternalUsers = useMemo(() => {
        return (users || []).filter(u => ALLOWED_INTERNAL_ROLES.includes(safeLower(u.role) as InternalRole))
    }, [users])

    const resolveUser = (id?: string) => {
        if (!id) return 'Unknown'
        const u = safeInternalUsers.find(x => x.id === id)
        return u?.name || u?.email || 'Unknown'
    }

    const resolveRole = (userId: string): InternalRole => {
        const u = safeInternalUsers.find(x => x.id === userId)
        const r = safeLower(u?.role)
        return (r === 'consultant' ? 'consultant' : 'operations') as InternalRole
    }

    // --------------------------------------------
    // Programs (company scoped)
    // --------------------------------------------
    useEffect(() => {
        if (!user?.companyCode) return
        const unsub = onSnapshot(
            query(collection(db, 'programs'), where('companyCode', '==', user.companyCode)),
            snap => {
                const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as ProgramRow[]
                setPrograms(rows)
            },
            err => {
                console.error(err)
                message.error('Failed to load programs.')
            }
        )
        return () => unsub()
    }, [user?.companyCode])

    const programName = (programId?: string | null) => {
        if (!programId) return '—'
        const p = (programs || []).find(x => x.id === programId)
        return p?.name || programId
    }

    // --------------------------------------------
    // Tasks (FIXED streaming + legacy support)
    // --------------------------------------------
    useEffect(() => {
        if (!user?.companyCode) return
        const colRef = collection(db, 'tasks')

        const merge = (rows: TaskRow[]) => {
            setTasks(prev => {
                const map = new Map<string, TaskRow>()
                for (const t of prev || []) map.set(t.id, t)
                for (const t of rows || []) map.set(t.id, t)
                return Array.from(map.values())
            })
        }

        const unsubA = onSnapshot(
            query(colRef, where('companyCode', '==', user.companyCode)),
            snap => merge(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TaskRow[]),
            err => {
                console.error(err)
                message.error('Failed to stream tasks.')
            }
        )

        const unsubB = onSnapshot(
            query(colRef, where('company_code', '==', user.companyCode)),
            snap => merge(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TaskRow[]),
            () => {
                // legacy field may not exist for all tenants; ignore
            }
        )

        return () => {
            unsubA()
            unsubB()
        }
    }, [user?.companyCode])

    // --------------------------------------------
    // Reminder rules (single per company)
    // --------------------------------------------
    useEffect(() => {
        if (!user?.companyCode) return
        const unsub = onSnapshot(
            query(collection(db, 'reminderRules'), where('companyCode', '==', user.companyCode)),
            snap => {
                const first = snap.docs[0]
                setRule(first ? ({ id: first.id, ...(first.data() as any) } as ReminderRule) : null)
            },
            err => {
                console.error(err)
                message.error('Failed to load reminder settings.')
            }
        )
        return () => unsub()
    }, [user?.companyCode])

    // --------------------------------------------
    // Normalize tasks + overdue + archived
    // --------------------------------------------
    const tasksNormalized = useMemo(() => {
        const now = dayjs()
        const rows = (tasks || []).map(t => {
            const archived = !!t.archived || t.status === 'Archived'
            const baseStatus = (t.status || 'To Do') as TaskStatus
            const due = normalizeDate(t.dueDate)

            if (archived) {
                return {
                    ...t,
                    status: 'Archived',
                    priority: (t.priority || 'medium') as any,
                    scope: (t.scope || 'company') as any,
                    archived: true
                } as TaskRow
            }

            const isDone = baseStatus === 'Completed'
            const isOverdue = !!due && !isDone && dayjs(due).isBefore(now, 'minute')
            const fixedStatus: TaskStatus = isOverdue ? 'Overdue' : baseStatus

            return {
                ...t,
                status: fixedStatus,
                priority: (t.priority || 'medium') as any,
                scope: (t.scope || 'company') as any
            } as TaskRow
        })

        // client-side sort (no indexes)
        rows.sort((a, b) => {
            const ac = normalizeDate(a.createdAt)?.getTime() || 0
            const bc = normalizeDate(b.createdAt)?.getTime() || 0
            if (bc !== ac) return bc - ac
            const ad = normalizeDate(a.dueDate)?.getTime() || 0
            const bd = normalizeDate(b.dueDate)?.getTime() || 0
            if (bd !== ad) return bd - ad
            return String(b.id).localeCompare(String(a.id))
        })

        return rows
    }, [tasks])

    const filteredTasks = useMemo(() => {
        const q = safeLower(filters.q)
        const includeArchived = !!filters.includeArchived
        return (tasksNormalized || []).filter(t => {
            if (!includeArchived && t.status === 'Archived') return false
            if (filters.scope && t.scope !== filters.scope) return false
            if (filters.status && t.status !== filters.status) return false
            if (filters.priority && t.priority !== filters.priority) return false

            if (filters.assignedTo) {
                const uid = filters.assignedTo
                const list = (t.assignees && t.assignees.length)
                    ? t.assignees.map(a => a.userId)
                    : (t.assignedTo ? [t.assignedTo] : [])
                if (!list.includes(uid)) return false
            }

            if (q) {
                const hay = `${t.title || ''} ${t.description || ''} ${t.taskType?.name || ''}`.toLowerCase()
                if (!hay.includes(q)) return false
            }
            return true
        })
    }, [tasksNormalized, filters])

    const statusCounts = useMemo(() => {
        const map: Record<TaskStatus, number> = {
            'To Do': 0,
            'In Progress': 0,
            'Awaiting Proof': 0,
            'Overdue': 0,
            'Completed': 0,
            'Archived': 0
        }
        for (const t of tasksNormalized || []) {
            const s = (t.status || 'To Do') as TaskStatus
            map[s] = (map[s] || 0) + 1
        }
        return map
    }, [tasksNormalized])

    const hasPieData = useMemo(() => {
        // show chart only if any non-zero among non-archived statuses
        return (['To Do', 'In Progress', 'Awaiting Proof', 'Overdue', 'Completed'] as TaskStatus[]).some(
            s => (statusCounts[s] || 0) > 0
        )
    }, [statusCounts])

    const metrics = useMemo(() => {
        const total = (tasksNormalized || []).filter(t => t.status !== 'Archived').length
        return {
            total,
            overdue: statusCounts['Overdue'] || 0,
            awaitingProof: statusCounts['Awaiting Proof'] || 0
        }
    }, [tasksNormalized, statusCounts])

    // --------------------------------------------
    // Auto signals / bottlenecks
    // --------------------------------------------
    const bottlenecks = useMemo(() => {
        const map: Record<
            string,
            { userId: string; name: string; open: number; overdue: number; awaitingProof: number }
        > = {}

        for (const t of tasksNormalized || []) {
            if (t.status === 'Completed' || t.status === 'Archived') continue

            const assignees: Assignee[] =
                t.assignees && t.assignees.length
                    ? t.assignees
                    : t.assignedTo
                        ? [{ userId: t.assignedTo, role: (t.assignedRole || 'operations') as InternalRole }]
                        : []

            for (const a of assignees) {
                const key = a.userId || 'unknown'
                if (!map[key]) {
                    map[key] = { userId: key, name: resolveUser(key), open: 0, overdue: 0, awaitingProof: 0 }
                }
                map[key].open += 1
                if (t.status === 'Overdue') map[key].overdue += 1
                if (t.status === 'Awaiting Proof') map[key].awaitingProof += 1
            }
        }

        const rows = Object.values(map)
        rows.sort(
            (a, b) => b.overdue * 10 + b.awaitingProof * 4 + b.open - (a.overdue * 10 + a.awaitingProof * 4 + a.open)
        )
        return rows.slice(0, 10)
    }, [tasksNormalized, safeInternalUsers])

    // --------------------------------------------
    // System-tracked risks (no manual logging)
    // --------------------------------------------
    const systemRisks = useMemo(() => {
        const active = (tasksNormalized || []).filter(t => t.status !== 'Completed' && t.status !== 'Archived')
        const totalActive = active.length || 0

        const overdue = active.filter(t => t.status === 'Overdue')
        const awaitingProof = active.filter(t => t.status === 'Awaiting Proof')
        const unassigned = active.filter(t => {
            const list = (t.assignees && t.assignees.length)
                ? t.assignees
                : (t.assignedTo ? [{ userId: t.assignedTo, role: (t.assignedRole || 'operations') as InternalRole }] : [])
            return !list.length
        })
        const highOverdue = active.filter(t => t.priority === 'high' && t.status === 'Overdue')
        const recurrenceStuck = active.filter(t => !!t.recurrence?.enabled && !t.recurrence?.nextDueDate)

        const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

        return [
            {
                key: 'risk_overdue_backlog',
                title: 'Overdue backlog',
                hint: 'Tasks past due date and not completed.',
                count: overdue.length,
                total: totalActive,
                percent: pct(overdue.length, totalActive),
                color: overdue.length ? 'red' : undefined,
                tasks: overdue
            },
            {
                key: 'risk_proof_backlog',
                title: 'Proof backlog',
                hint: 'Tasks waiting for proof review/approval.',
                count: awaitingProof.length,
                total: totalActive,
                percent: pct(awaitingProof.length, totalActive),
                color: awaitingProof.length ? 'orange' : undefined,
                tasks: awaitingProof
            },
            {
                key: 'risk_unassigned',
                title: 'Unassigned tasks',
                hint: 'Tasks with no assignees.',
                count: unassigned.length,
                total: totalActive,
                percent: pct(unassigned.length, totalActive),
                color: unassigned.length ? 'gold' : undefined,
                tasks: unassigned
            },
            {
                key: 'risk_high_priority_overdue',
                title: 'High-priority overdue',
                hint: 'Overdue tasks marked as high priority.',
                count: highOverdue.length,
                total: Math.max(1, active.filter(t => t.priority === 'high').length),
                percent: pct(highOverdue.length, Math.max(1, active.filter(t => t.priority === 'high').length)),
                color: highOverdue.length ? 'red' : undefined,
                tasks: highOverdue
            },
            {
                key: 'risk_recurrence_stuck',
                title: 'Recurring misconfigured',
                hint: 'Recurring tasks missing next due date (needs cleanup).',
                count: recurrenceStuck.length,
                total: Math.max(1, active.filter(t => !!t.recurrence?.enabled).length),
                percent: pct(
                    recurrenceStuck.length,
                    Math.max(1, active.filter(t => !!t.recurrence?.enabled).length)
                ),
                color: recurrenceStuck.length ? 'gold' : undefined,
                tasks: recurrenceStuck
            }
        ]
    }, [tasksNormalized])

    // --------------------------------------------
    // Highcharts pie (hide labels for 0)
    // --------------------------------------------
    const pieOptions = useMemo(() => {
        const data = (['To Do', 'In Progress', 'Awaiting Proof', 'Overdue', 'Completed'] as TaskStatus[]).map(s => ({
            name: s,
            y: statusCounts[s] || 0
        }))

        return {
            chart: { type: 'pie', height: 240 },
            title: { text: undefined },
            credits: { enabled: false },
            tooltip: { pointFormat: '<b>{point.y}</b>' },
            plotOptions: {
                pie: {
                    innerSize: '58%',
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            // @ts-ignore
                            const y = Number(this.y || 0)
                            // @ts-ignore
                            const name = String(this.point?.name || '')
                            if (!y) return null
                            return `${name}: ${y}`
                        }
                    }
                }
            },
            series: [{ name: 'Tasks', type: 'pie', data }]
        } as Highcharts.Options
    }, [statusCounts])

    // --------------------------------------------
    // Mutations
    // --------------------------------------------
    const upsertTask = async (taskId: string, patch: Partial<TaskRow>) => {
        await updateDoc(doc(db, 'tasks', taskId), patch as any)
    }

    const archiveTask = async (t: TaskRow) => {
        if (!user?.companyCode) return
        await upsertTask(t.id, {
            archived: true,
            status: 'Archived',
            archivedAt: serverTimestamp(),
            archivedBy: user.email || user.uid || 'unknown'
        })
        message.success('Task archived.')
    }

    const unarchiveTask = async (t: TaskRow) => {
        await upsertTask(t.id, {
            archived: false,
            status: 'To Do',
            archivedAt: null,
            archivedBy: null
        })
        message.success('Task restored.')
    }

    /**
     * Manual reminder:
     * - respects cooldownHours if set
     * - creates a taskReminders record (simple trigger payload)
     * - stores lastManualReminderAt on the task
     */
    const sendManualReminder = async (t: TaskRow) => {
        if (!user?.companyCode) return

        const cooldownHours = Number(rule?.cooldownHours ?? 24)
        const last = normalizeDate(t.lastManualReminderAt)
        const now = new Date()
        if (last && dayjs(now).diff(dayjs(last), 'hour') < cooldownHours) {
            const left = cooldownHours - dayjs(now).diff(dayjs(last), 'hour')
            message.warning(`Reminder blocked by cooldown. Try again in ~${Math.max(1, left)}h.`)
            return
        }

        const reminderId = `rem-${t.id}-${Date.now()}`
        await setDoc(doc(db, 'taskReminders', reminderId), {
            companyCode: user.companyCode,
            taskId: t.id,
            programId: t.scope === 'program' ? (t.programId || null) : null,
            scope: t.scope || 'company',
            type: 'manual',
            createdAt: serverTimestamp(),
            createdBy: user.email || user.uid || 'unknown'
        } as any)

        await upsertTask(t.id, { lastManualReminderAt: serverTimestamp() } as any)
        message.success('Reminder queued.')
    }

    /**
     * Complete + spawn next recurring instance ONLY when completed.
     */
    const completeTaskAndSpawnIfRecurring = async (t: TaskRow) => {
        try {
            const nowTs = Timestamp.now()
            await upsertTask(t.id, {
                status: 'Completed',
                completedAt: nowTs,
                ...(t.recurrence?.enabled ? { 'recurrence.lastRunAt': nowTs } : {})
            })

            const rec = t.recurrence
            if (!rec?.enabled || !rec?.pattern || rec.pattern === 'none') {
                message.success('Task completed.')
                return
            }

            const baseFrom = normalizeDate(rec.nextDueDate) || normalizeDate(t.dueDate) || new Date()
            const baseDue = computeNextDue(baseFrom, rec.pattern, Number(rec.interval || 1))
            if (!baseDue) {
                message.success('Task completed.')
                return
            }

            const nextNext = computeNextDue(baseDue, rec.pattern, Number(rec.interval || 1))
            const newId = `task-${Date.now()}`

            const assignees: Assignee[] =
                t.assignees && t.assignees.length
                    ? t.assignees
                    : t.assignedTo
                        ? [{ userId: t.assignedTo, role: (t.assignedRole || 'operations') as InternalRole }]
                        : []

            const newTask: Omit<TaskRow, 'id'> = {
                companyCode: user?.companyCode,
                company_code: user?.companyCode,

                scope: (t.scope || 'company') as any,
                programId: t.scope === 'program' ? (t.programId || null) : null,

                title: t.title,
                description: t.description,
                taskType: t.taskType,

                priority: t.priority || 'medium',
                status: 'To Do',

                // keep legacy fields (first assignee)
                assignedRole: assignees[0]?.role,
                assignedTo: assignees[0]?.userId,

                // new multi-assignees
                assignees,

                dueDate: Timestamp.fromDate(baseDue),
                createdAt: Timestamp.now(),
                createdBy: user?.id || user?.uid || user?.email || 'unknown',

                recurrence: {
                    enabled: true,
                    pattern: rec.pattern,
                    interval: Number(rec.interval || 1),
                    nextDueDate: nextNext ? Timestamp.fromDate(nextNext) : Timestamp.fromDate(baseDue),
                    lastRunAt: null
                },

                proof: { items: [] }
            }

            await setDoc(doc(db, 'tasks', newId), newTask as any)
            message.success('Task completed and next recurring instance created.')
        } catch (e) {
            console.error(e)
            message.error('Failed to complete task.')
        }
    }

    // --------------------------------------------
    // AI Extraction Task Logic
    // --------------------------------------------

    const handleAIExtract = async () => {
        if (!aiInput.trim()) return
        setIsExtracting(true)

        try {
            const response = await fetch('https://yoursdvniel-smart-incubation.hf.space/extract-tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: aiInput })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.detail || 'Server Error')

            const tasksWithDefaults = (data.action_items || []).map((item: any) => ({
                tempId: Math.random().toString(36).slice(2, 11),
                title: item.title,
                description: item.description || '',
                priority:
                    ['high', 'medium', 'low'].includes(String(item.priority || '').toLowerCase())
                        ? String(item.priority).toLowerCase()
                        : 'medium',
                scope: 'company',
                programId: null,
                taskType: 'other',
                dueDate: dayjs().add(3, 'day'),
                assignees: [{ userId: user?.id || user?.uid || '', role: 'operations' }],
                recurrence: { enabled: false, pattern: 'none', interval: 1 }
            }))

            if (!tasksWithDefaults.length) {
                message.warning('No action items found.')
                return
            }

            //  Close AI modal, reset input
            setAiModalOpen(false)
            setAiInput('')

            // ✅ Open the wizard (the modal you actually render)
            openWizardFromExtraction(tasksWithDefaults)
        } catch (e: any) {
            message.error(`Extraction failed: ${e.message}`)
        } finally {
            setIsExtracting(false)
        }
    }


    // --------------------------------------------
    // Create Task
    // --------------------------------------------
    const handleCreateTask = async (values: any) => {
        if (!user?.companyCode) return

        // assignees (multi)
        const assigneeIds: string[] = Array.isArray(values.assignees) ? values.assignees : []
        if (!assigneeIds.length) {
            message.error('Select at least one assignee.')
            return
        }

        // enforce internal users only
        const allowedSet = new Set(safeInternalUsers.map(u => u.id))
        for (const id of assigneeIds) {
            if (!allowedSet.has(id)) {
                message.error('One or more selected users are not allowed.')
                return
            }
        }

        const assignees: Assignee[] = assigneeIds.map(uid => ({
            userId: uid,
            role: resolveRole(uid)
        }))

        const selectedType = ENHANCED_TASK_TYPES.find(t => t.id === values.taskType)
        const taskType = selectedType || { id: 'custom', name: values.taskType || 'Custom Task', proofRequired: false }

        const dueDate = values.dueDate?.toDate ? values.dueDate.toDate() : values.dueDate
        const scope = values.scope || 'company'
        const programId = scope === 'program' ? (values.programId || null) : null

        const recurrenceEnabled = !!values.recurrenceEnabled
        const recurrencePattern = values.recurrencePattern || 'none'
        const recurrenceInterval = Math.max(1, Number(values.recurrenceInterval || 1))

        const nextDue =
            recurrenceEnabled && recurrencePattern !== 'none' ? computeNextDue(dueDate, recurrencePattern, recurrenceInterval) : null

        const recurrence =
            recurrenceEnabled && recurrencePattern !== 'none'
                ? {
                    enabled: true,
                    pattern: recurrencePattern,
                    interval: recurrenceInterval,
                    nextDueDate: nextDue ? Timestamp.fromDate(nextDue) : null,
                    lastRunAt: null
                }
                : { enabled: false, pattern: 'none' }

        const id = `task-${Date.now()}`
        const payload: Omit<TaskRow, 'id'> = {
            companyCode: user.companyCode,
            company_code: user.companyCode,

            scope,
            programId,

            title: values.title,
            description: values.description,
            taskType,

            priority: values.priority || 'medium',
            status: 'To Do',

            // legacy (first assignee)
            assignedRole: assignees[0]?.role,
            assignedTo: assignees[0]?.userId,

            // new (multi)
            assignees,

            dueDate: Timestamp.fromDate(dueDate),
            createdAt: Timestamp.now(),
            createdBy: user.id || user.uid || user.email || 'unknown',

            recurrence: recurrence as any,
            proof: { items: [] },

            archived: false
        }

        await setDoc(doc(db, 'tasks', id), payload as any)
        message.success('Task created.')
        setTaskModalOpen(false)
        taskForm.resetFields()
    }

    // --------------------------------------------
    // Save Reminder Settings (with tips)
    // --------------------------------------------
    const saveReminderSettings = async (values: any) => {
        if (!user?.companyCode) return
        const id = rule?.id || `reminder-${user.companyCode}`
        await setDoc(
            doc(db, 'reminderRules', id),
            {
                companyCode: user.companyCode,
                enabled: !!values.enabled,
                dueSoonHours: Number(values.dueSoonHours || 24),
                overdueHours: Number(values.overdueHours || 24),
                cooldownHours: Number(values.cooldownHours || 24),
                statuses: values.statuses || ['To Do', 'In Progress', 'Awaiting Proof', 'Overdue'],
                updatedAt: serverTimestamp(),
                updatedBy: user.email || 'unknown'
            } as any,
            { merge: true } as any
        )
        message.success('Reminder settings saved.')
        setSettingsOpen(false)
    }

    // --------------------------------------------
    // Tables
    // --------------------------------------------
    const taskColumns = [
        {
            title: 'Title',
            key: 'title',
            render: (_: any, t: TaskRow) => {
                const proofRequired = !!t?.taskType?.proofRequired
                const isRecurring = !!t.recurrence?.enabled

                return (
                    <Space direction="vertical" size={0}>
                        <Text strong>{t.title}</Text>
                        {t.description ? <Text type="secondary">{t.description}</Text> : null}

                        <Space size={6} wrap>
                            <Tag color={t.scope === 'program' ? 'purple' : 'blue'}>
                                {(t.scope || 'company') === 'program' ? `Program: ${programName(t.programId)}` : 'Company'}
                            </Tag>

                            <Tag color={t.priority === 'high' ? 'red' : t.priority === 'low' ? 'default' : 'gold'}>
                                {(t.priority || 'medium').toUpperCase()}
                            </Tag>

                            {isRecurring ? <Tag icon={<ClockCircleOutlined />}>Recurring</Tag> : null}
                            {proofRequired ? <Tag icon={<FileSearchOutlined />}>Proof required</Tag> : null}
                            {t.status === 'Archived' ? <Tag icon={<InboxOutlined />}>Archived</Tag> : null}
                        </Space>
                    </Space>
                )
            }
        },
        {
            title: 'Assigned',
            width: 260,
            key: 'assigned',
            render: (_: any, t: TaskRow) => {
                const list: Assignee[] =
                    t.assignees && t.assignees.length
                        ? t.assignees
                        : t.assignedTo
                            ? [{ userId: t.assignedTo, role: (t.assignedRole || 'operations') as InternalRole }]
                            : []

                return (
                    <Space direction="vertical" size={0}>
                        {list.length ? (
                            list.map(a => (
                                <Text key={`${t.id}-${a.userId}`}>
                                    {resolveUser(a.userId)} <Text type="secondary">({a.role})</Text>
                                </Text>
                            ))
                        ) : (
                            <Text type="secondary">—</Text>
                        )}
                    </Space>
                )
            }
        },
        {
            title: 'Due',
            width: 120,
            dataIndex: 'dueDate',
            key: 'dueDate',
            render: (d: any) => {
                const dt = normalizeDate(d)
                return dt ? dayjs(dt).format('YYYY-MM-DD') : '—'
            }
        },
        {
            title: 'Status',
            width: 160,
            dataIndex: 'status',
            key: 'status',
            render: (s: TaskStatus) => (
                <Tag
                    icon={
                        s === 'Completed' ? (
                            <CheckCircleOutlined />
                        ) : s === 'Awaiting Proof' ? (
                            <FileSearchOutlined />
                        ) : s === 'Overdue' ? (
                            <ExclamationCircleOutlined />
                        ) : s === 'Archived' ? (
                            <InboxOutlined />
                        ) : (
                            <ClockCircleOutlined />
                        )
                    }
                    color={statusColor(s)}
                >
                    {s}
                </Tag>
            )
        },
        {
            title: 'Actions',
            width: 340,
            key: 'actions',
            render: (_: any, t: TaskRow) => {
                const proofRequired = !!t?.taskType?.proofRequired
                const canEdit = t.status !== 'Completed' && t.status !== 'Archived'

                return (
                    <Space wrap>
                        {t.status === 'To Do' ? (
                            <Button size="small" onClick={() => upsertTask(t.id, { status: 'In Progress' })}>
                                Start
                            </Button>
                        ) : null}

                        {proofRequired && t.status !== 'Archived' ? (
                            <Button
                                size="small"
                                onClick={() => {
                                    setSelectedTask(t)
                                    setProofDrawerOpen(true)
                                }}
                            >
                                Proof
                            </Button>
                        ) : null}

                        {canEdit ? (
                            <Tooltip
                                title={
                                    proofRequired
                                        ? 'Moves the task to “Awaiting Proof” and queues a reminder.'
                                        : t.recurrence?.enabled
                                            ? 'Completing creates the next recurring instance.'
                                            : 'Marks the task as completed.'
                                }
                            >
                                <Button
                                    size="small"
                                    type="primary"
                                    onClick={async () => {
                                        if (proofRequired) {
                                            await upsertTask(t.id, { status: 'Awaiting Proof' })
                                            await sendManualReminder(t)
                                            return
                                        }
                                        await completeTaskAndSpawnIfRecurring(t)
                                    }}
                                >
                                    {proofRequired ? 'Request Proof' : 'Complete'}
                                </Button>
                            </Tooltip>
                        ) : null}

                        {t.status !== 'Archived' ? (
                            <Button size="small" icon={<BellOutlined />} onClick={() => sendManualReminder(t)}>
                                Remind
                            </Button>
                        ) : null}

                        {t.status === 'Archived' ? (
                            <Button size="small" onClick={() => unarchiveTask(t)}>
                                Restore
                            </Button>
                        ) : (
                            <Button size="small" danger onClick={() => archiveTask(t)}>
                                Archive
                            </Button>
                        )}
                    </Space>
                )
            }
        }
    ] as any[]

    const bottleneckColumns = [
        { title: 'User', dataIndex: 'name', key: 'name' },
        { title: 'Open', dataIndex: 'open', key: 'open', width: 90 },
        {
            title: 'Overdue',
            dataIndex: 'overdue',
            key: 'overdue',
            width: 110,
            render: (v: number) => <Tag color={v ? 'red' : 'green'}>{v}</Tag>
        },
        {
            title: 'Awaiting Proof',
            dataIndex: 'awaitingProof',
            key: 'awaitingProof',
            width: 140,
            render: (v: number) => <Tag color={v ? 'orange' : 'green'}>{v}</Tag>
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 130,
            render: (_: any, row: any) => (
                <Button
                    size="small"
                    onClick={() => {
                        const uid = row.userId as string
                        const rows = (tasksNormalized || []).filter(t => {
                            if (t.status === 'Completed' || t.status === 'Archived') return false
                            const list = (t.assignees && t.assignees.length)
                                ? t.assignees.map(a => a.userId)
                                : (t.assignedTo ? [t.assignedTo] : [])
                            return list.includes(uid)
                        })
                        setViewTasksDrawerTitle(`Tasks for: ${row.name}`)
                        setViewTasksRows(rows)
                        setViewTasksDrawerOpen(true)
                    }}
                >
                    View tasks
                </Button>
            )
        }
    ] as any[]

    // Layout helpers
    const isWide = !!screens.lg

    // --------------------------------------------
    // Proof drawer: view + add proof item (link-based)
    // --------------------------------------------
    const addProofItem = async (values: any) => {
        if (!selectedTask || !user?.companyCode) return

        const existing = Array.isArray(selectedTask.proof?.items) ? selectedTask.proof?.items : []
        const newItem = {
            id: `proof-${Date.now()}`,
            label: values.label,
            link: values.link,
            note: values.note || '',
            uploadedAt: Timestamp.now(),
            uploadedBy: user.email || user.uid || 'unknown'
        }

        const next = [...existing, newItem]
        await upsertTask(selectedTask.id, { proof: { items: next } } as any)

        message.success('Proof item added.')
        proofForm.resetFields()
    }

    // --------------------------------------------
    // UI
    // --------------------------------------------
    return (
        <div style={{ minHeight: '100vh', padding: 24 }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <DashboardHeaderCard
                    title='Tasks Management'
                    subtitle='Ops Task Control (internal only). Incubatees are excluded from all selectors on this page.'
                    extraRight={
                        <Space>

                            <Segmented
                                value={segment}
                                onChange={v => setSegment(v as any)}
                                options={[
                                    { label: 'Tasks', value: 'tasks' },
                                    { label: 'Signals & Bottlenecks', value: 'signals' },

                                ]}
                            />
                            <Button
                                icon={<SettingOutlined />}
                                onClick={() => {
                                    setSettingsOpen(true)
                                    settingsForm.setFieldsValue({
                                        enabled: rule?.enabled ?? true,
                                        dueSoonHours: rule?.dueSoonHours ?? 24,
                                        overdueHours: rule?.overdueHours ?? 24,
                                        cooldownHours: rule?.cooldownHours ?? 24,
                                        statuses: rule?.statuses ?? ['To Do', 'In Progress', 'Awaiting Proof', 'Overdue']
                                    })
                                }}
                            >
                                Reminders
                            </Button>

                            <Button type="primary" icon={<PlusOutlined />} onClick={() => setTaskModalOpen(true)}>
                                Add Task
                            </Button>

                            <Button
                                type="default"
                                icon={<FileSearchOutlined />}
                                onClick={() => setAiModalOpen(true)}
                                style={{ background: '#f0f5ff', border: '1px solid #adc6ff' }}
                            >
                                Magic Extract (AI)
                            </Button>

                        </Space>} />

                {/* Minimal metrics - MotionCard + colored icons */}
                <Row gutter={[12, 12]}>
                    {[
                        {
                            label: 'Active tasks',
                            value: metrics.total,
                            icon: <ClockCircleOutlined />,
                            iconColor: '#1677ff'
                        },
                        {
                            label: 'Overdue',
                            value: metrics.overdue,
                            icon: <ExclamationCircleOutlined />,
                            iconColor: '#ff4d4f'
                        },
                        {
                            label: 'Awaiting proof',
                            value: metrics.awaitingProof,
                            icon: <FileSearchOutlined />,
                            iconColor: '#faad14'
                        }
                    ].map((m, idx) => (
                        <Col key={idx} xs={24} sm={8}>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, delay: idx * 0.05 }}
                            >
                                <MotionCard style={{ borderRadius: 10, border: '1px solid #e6f4ff' }}>
                                    <Space>
                                        <span style={{ fontSize: 18, color: m.iconColor }}>{m.icon}</span>
                                        <Statistic title={m.label} value={m.value} />
                                    </Space>
                                </MotionCard>
                            </motion.div>
                        </Col>
                    ))}
                </Row>

                {/* TASKS */}
                {segment === 'tasks' ? (
                    <Row gutter={[16, 16]}>
                        {/* Table + filters */}
                        <Col xs={24} lg={hasPieData && isWide ? 16 : 24}>
                            <MotionCard style={{ borderRadius: 10, border: '1px solid #e6f4ff' }}>
                                <Row gutter={[12, 12]}>
                                    <Col xs={24} md={8}>
                                        <Input
                                            placeholder="Search title/description/type..."
                                            allowClear
                                            onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
                                        />
                                    </Col>

                                    <Col xs={24} md={4}>
                                        <Select
                                            placeholder="Scope"
                                            allowClear
                                            style={{ width: '100%' }}
                                            onChange={v => setFilters(f => ({ ...f, scope: v }))}
                                            options={[
                                                { value: 'company', label: 'Company' },
                                                { value: 'program', label: 'Program' }
                                            ]}
                                        />
                                    </Col>

                                    <Col xs={24} md={4}>
                                        <Select
                                            placeholder="Status"
                                            allowClear
                                            style={{ width: '100%' }}
                                            onChange={v => setFilters(f => ({ ...f, status: v }))}
                                            options={statusOrder
                                                .filter(s => s !== 'Archived')
                                                .map(s => ({ value: s, label: s }))}
                                        />
                                    </Col>

                                    <Col xs={24} md={4}>
                                        <Select
                                            placeholder="Priority"
                                            allowClear
                                            style={{ width: '100%' }}
                                            onChange={v => setFilters(f => ({ ...f, priority: v }))}
                                            options={[
                                                { value: 'low', label: 'Low' },
                                                { value: 'medium', label: 'Medium' },
                                                { value: 'high', label: 'High' }
                                            ]}
                                        />
                                    </Col>

                                    <Col xs={24} md={4}>
                                        <Select
                                            placeholder="Assignee"
                                            allowClear
                                            showSearch
                                            optionFilterProp="label"
                                            style={{ width: '100%' }}
                                            onChange={v => setFilters(f => ({ ...f, assignedTo: v }))}
                                            options={(safeInternalUsers || []).map(u => ({
                                                value: u.id,
                                                label: `${u.name || u.email || u.id} (${safeLower(u.role)})`
                                            }))}
                                        />
                                    </Col>

                                    <Col xs={24}>
                                        <Space>
                                            <Switch
                                                checked={!!filters.includeArchived}
                                                onChange={v => setFilters(f => ({ ...f, includeArchived: v }))}
                                            />
                                            <Text type="secondary">Include archived tasks</Text>
                                        </Space>
                                    </Col>
                                </Row>

                                <Divider style={{ margin: '12px 0' }} />

                                <Table
                                    rowKey="id"
                                    dataSource={filteredTasks}
                                    columns={taskColumns}
                                    pagination={{ pageSize: 10 }}
                                />
                            </MotionCard>
                        </Col>

                        {/* Side pie chart (hide if empty) */}
                        {hasPieData && isWide ? (
                            <Col xs={24} lg={8}>
                                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                    <MotionCard style={{ borderRadius: 10, border: '1px solid #e6f4ff' }}>
                                        <Text strong>Status distribution</Text>
                                        <Divider style={{ margin: '10px 0' }} />
                                        <HighchartsReact highcharts={Highcharts} options={pieOptions} />
                                        <Text type="secondary">
                                            Labels are hidden automatically when a slice is 0.
                                        </Text>
                                    </MotionCard>
                                </Space>
                            </Col>
                        ) : null}
                    </Row>
                ) : null}

                {/* SIGNALS */}
                {segment === 'signals' ? (
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={14}>
                            <MotionCard style={{ borderRadius: 10, border: '1px solid #e6f4ff' }}>
                                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                    <Text strong>Bottlenecks (auto detected)</Text>
                                    <Table
                                        rowKey="userId"
                                        dataSource={bottlenecks}
                                        columns={bottleneckColumns}
                                        pagination={false}
                                        size="small"
                                    />
                                    <Text type="secondary">
                                        Based on open workload: overdue + awaiting proof + total open tasks.
                                    </Text>
                                </Space>
                            </MotionCard>
                        </Col>

                        <Col xs={24} lg={10}>
                            <MotionCard style={{ borderRadius: 10, border: '1px solid #e6f4ff' }}>
                                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                    <Text strong>System risks</Text>

                                    {/* stacked risk cards */}
                                    {(systemRisks || []).map(r => (
                                        <MotionCard
                                            key={r.key}
                                            style={{
                                                borderRadius: 10,
                                                border: '1px solid #f0f0f0',
                                                background: '#fff'
                                            }}
                                        >
                                            <Space direction="vertical" style={{ width: '100%' }} size={6}>
                                                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                                                    <Space direction="vertical" size={0}>
                                                        <Text strong>{r.title}</Text>
                                                        <Text type="secondary">{r.hint}</Text>
                                                    </Space>

                                                    <Tag color={r.count ? (r.color || 'gold') : 'green'}>
                                                        {r.count}/{r.total || 0}
                                                    </Tag>
                                                </Space>

                                                <Progress percent={r.percent} status={r.count ? 'active' : 'success'} />

                                                <Button
                                                    size="small"
                                                    onClick={() => {
                                                        setViewTasksDrawerTitle(r.title)
                                                        setViewTasksRows(r.tasks || [])
                                                        setViewTasksDrawerOpen(true)
                                                    }}
                                                >
                                                    View affected tasks
                                                </Button>
                                            </Space>
                                        </MotionCard>
                                    ))}
                                </Space>
                            </MotionCard>
                        </Col>
                    </Row>
                ) : null}

                {/* VIEW TASKS DRAWER (used by signals/risks) */}
                <Drawer
                    title={viewTasksDrawerTitle}
                    open={viewTasksDrawerOpen}
                    onClose={() => setViewTasksDrawerOpen(false)}
                    width={720}
                >
                    <Table
                        rowKey="id"
                        dataSource={viewTasksRows || []}
                        size="small"
                        pagination={{ pageSize: 8 }}
                        columns={[
                            {
                                title: 'Task',
                                key: 'task',
                                render: (_: any, t: TaskRow) => (
                                    <Space direction="vertical" size={0}>
                                        <Text strong>{t.title}</Text>
                                        <Space size={6} wrap>
                                            <Tag color={statusColor((t.status || 'To Do') as any)}>{t.status || 'To Do'}</Tag>
                                            <Tag>{(t.priority || 'medium').toUpperCase()}</Tag>
                                            {t.scope === 'program' ? <Tag color="purple">{programName(t.programId)}</Tag> : <Tag>Company</Tag>}
                                        </Space>
                                    </Space>
                                )
                            },
                            {
                                title: 'Assigned',
                                key: 'assigned',
                                width: 240,
                                render: (_: any, t: TaskRow) => {
                                    const list: Assignee[] =
                                        t.assignees && t.assignees.length
                                            ? t.assignees
                                            : t.assignedTo
                                                ? [{ userId: t.assignedTo, role: (t.assignedRole || 'operations') as InternalRole }]
                                                : []
                                    return (
                                        <Space direction="vertical" size={0}>
                                            {list.length ? (
                                                list.map(a => (
                                                    <Text key={`${t.id}-${a.userId}`}>
                                                        {resolveUser(a.userId)} <Text type="secondary">({a.role})</Text>
                                                    </Text>
                                                ))
                                            ) : (
                                                <Text type="secondary">—</Text>
                                            )}
                                        </Space>
                                    )
                                }
                            },
                            {
                                title: 'Due',
                                key: 'due',
                                width: 120,
                                render: (_: any, t: TaskRow) => {
                                    const dt = normalizeDate(t.dueDate)
                                    return dt ? dayjs(dt).format('YYYY-MM-DD') : '—'
                                }
                            },
                            {
                                title: 'Actions',
                                key: 'actions',
                                width: 140,
                                render: (_: any, t: TaskRow) => (
                                    <Space>
                                        <Button size="small" icon={<BellOutlined />} onClick={() => sendManualReminder(t)}>
                                            Remind
                                        </Button>
                                    </Space>
                                )
                            }
                        ]}
                    />
                </Drawer>

                {/* PROOF DRAWER */}
                <Drawer
                    title={selectedTask ? `Proof: ${selectedTask.title}` : 'Proof'}
                    open={proofDrawerOpen}
                    onClose={() => {
                        setSelectedTask(null)
                        setProofDrawerOpen(false)
                    }}
                    width={560}
                >
                    {!selectedTask ? (
                        <Text type="secondary">No task selected.</Text>
                    ) : (
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                            <MotionCard style={{ borderRadius: 10, border: '1px solid #f0f0f0' }}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Space>
                                        <Text strong>Status:</Text>{' '}
                                        <Tag color={statusColor((selectedTask.status || 'To Do') as any)}>
                                            {selectedTask.status || 'To Do'}
                                        </Tag>
                                    </Space>

                                    <Divider />

                                    <Text strong>Proof items</Text>
                                    {(selectedTask.proof?.items || []).length ? (
                                        (selectedTask.proof?.items || []).map(p => (
                                            <div key={p.id} style={{ marginBottom: 10 }}>
                                                <Tag>{p.label}</Tag>
                                                <div>
                                                    <a href={p.link} target="_blank" rel="noreferrer">
                                                        Open
                                                    </a>
                                                </div>
                                                {p.note ? <Text type="secondary">{p.note}</Text> : null}
                                            </div>
                                        ))
                                    ) : (
                                        <Text type="secondary">No proof uploaded yet.</Text>
                                    )}
                                </Space>
                            </MotionCard>

                            <MotionCard style={{ borderRadius: 10, border: '1px solid #f0f0f0' }}>
                                <Text strong>Add proof item</Text>
                                <Divider style={{ margin: '10px 0' }} />
                                <Form layout="vertical" form={proofForm} onFinish={addProofItem}>
                                    <Form.Item name="label" label="Label" rules={[{ required: true }]}>
                                        <Input placeholder="e.g. Signed document, Screenshot, Report link" />
                                    </Form.Item>
                                    <Form.Item name="link" label="Link" rules={[{ required: true }]}>
                                        <Input placeholder="Paste file link" />
                                    </Form.Item>
                                    <Form.Item name="note" label="Note (optional)">
                                        <Input.TextArea rows={2} placeholder="Optional note" />
                                    </Form.Item>
                                    <Button type="primary" htmlType="submit" block>
                                        Add proof
                                    </Button>
                                </Form>
                            </MotionCard>

                            <Button
                                type="primary"
                                disabled={(selectedTask.status || '') !== 'Awaiting Proof'}
                                onClick={async () => {
                                    await completeTaskAndSpawnIfRecurring(selectedTask)
                                    setSelectedTask(null)
                                    setProofDrawerOpen(false)
                                }}
                                block
                            >
                                Approve & Complete
                            </Button>
                        </Space>
                    )}
                </Drawer>

                {/* CREATE TASK MODAL */}
                <Modal
                    title="Create Task"
                    open={taskModalOpen}
                    onCancel={() => {
                        setTaskModalOpen(false)
                        taskForm.resetFields()
                    }}
                    onOk={() => taskForm.submit()}
                    width={920}
                >
                    <Form layout="vertical" form={taskForm} onFinish={handleCreateTask}>
                        <Row gutter={[12, 12]}>
                            <Col xs={24} md={16}>
                                <Form.Item name="title" label="Title" rules={[{ required: true }]}>
                                    <Input placeholder="Task title" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item name="priority" label="Priority" initialValue="medium">
                                    <Select
                                        options={[
                                            { value: 'low', label: 'Low' },
                                            { value: 'medium', label: 'Medium' },
                                            { value: 'high', label: 'High' }
                                        ]}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item name="description" label="Description">
                            <Input.TextArea rows={3} placeholder="What exactly needs to be done?" />
                        </Form.Item>

                        <Row gutter={[12, 12]}>
                            <Col xs={24} md={8}>
                                <Form.Item name="scope" label="Scope" initialValue="company" rules={[{ required: true }]}>
                                    <Select
                                        options={[
                                            { value: 'company', label: 'Company (general)' },
                                            { value: 'program', label: 'Program-specific' }
                                        ]}
                                    />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={16}>
                                <Form.Item shouldUpdate={(p, c) => p.scope !== c.scope} noStyle>
                                    {({ getFieldValue, setFieldsValue }) => {
                                        const scope = getFieldValue('scope')
                                        if (scope !== 'program') return null

                                        const onlyOne = (programs || []).length === 1
                                        if (onlyOne && !getFieldValue('programId')) {
                                            setTimeout(() => setFieldsValue({ programId: programs[0].id }), 0)
                                        }

                                        return (
                                            <Form.Item
                                                name="programId"
                                                label="Program"
                                                rules={[{ required: true, message: 'Program required for program scope' }]}
                                            >
                                                <Select
                                                    disabled={onlyOne}
                                                    placeholder={onlyOne ? 'Program auto-selected' : 'Select program'}
                                                    showSearch
                                                    optionFilterProp="label"
                                                    options={(programs || []).map(p => ({
                                                        value: p.id,
                                                        label: p.name || p.id
                                                    }))}
                                                />
                                            </Form.Item>
                                        )
                                    }}
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[12, 12]}>
                            <Col xs={24} md={8}>
                                <Form.Item name="taskType" label="Task Type" rules={[{ required: true }]}>
                                    <Select options={ENHANCED_TASK_TYPES.map(t => ({ value: t.id, label: t.name }))} />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item name="dueDate" label="Due Date" rules={[{ required: true }]}>
                                    <DatePicker style={{ width: '100%' }} disabledDate={d => !!d && d < dayjs().startOf('day')} />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item name="assignees" label="Assign To (multiple)" rules={[{ required: true }]}>
                                    <Select
                                        mode="multiple"
                                        showSearch
                                        optionFilterProp="label"
                                        placeholder="Select one or more users"
                                        options={(safeInternalUsers || []).map(u => ({
                                            value: u.id,
                                            label: `${u.name || u.email || u.id} (${safeLower(u.role)})`
                                        }))}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[12, 12]}>
                            <Col xs={24}>
                                <MotionCard style={{ borderRadius: 10, border: '1px solid #f0f0f0' }}>
                                    <Text strong>Recurring task (optional)</Text>
                                    <Divider style={{ margin: '10px 0' }} />
                                    <Row gutter={[12, 12]}>
                                        <Col xs={24} md={6}>
                                            <Form.Item name="recurrenceEnabled" valuePropName="checked" label="Enable" initialValue={false}>
                                                <Switch />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={10}>
                                            <Form.Item name="recurrencePattern" label="Pattern" initialValue="none">
                                                <Select
                                                    options={[
                                                        { value: 'none', label: 'None' },
                                                        { value: 'daily', label: 'Daily' },
                                                        { value: 'weekly', label: 'Weekly' },
                                                        { value: 'monthly', label: 'Monthly' },
                                                        { value: 'quarterly', label: 'Quarterly' },
                                                        { value: 'custom_days', label: 'Custom days' }
                                                    ]}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name="recurrenceInterval" label="Interval" initialValue={1}>
                                                <Input type="number" min={1} />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Text type="secondary">
                                        The next task is created only after the previous one is completed.
                                    </Text>
                                </MotionCard>
                            </Col>
                        </Row>
                    </Form>
                </Modal>

                {/* REMINDER SETTINGS MODAL */}
                <Modal
                    title="Reminder settings"
                    open={settingsOpen}
                    onCancel={() => setSettingsOpen(false)}
                    onOk={() => settingsForm.submit()}
                    width={760}
                >
                    <Form layout="vertical" form={settingsForm} onFinish={saveReminderSettings}>
                        <Row gutter={[12, 12]}>
                            <Col xs={24} md={8}>
                                <Form.Item name="enabled" label="Enable reminders" valuePropName="checked" initialValue={true}>
                                    <Switch />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item
                                    name="dueSoonHours"
                                    label={
                                        <Space size={6}>
                                            <span>Due soon (hours)</span>
                                            <Tooltip title="How many hours before a due date counts as 'due soon'.">
                                                <Text type="secondary">ⓘ</Text>
                                            </Tooltip>
                                        </Space>
                                    }
                                    initialValue={24}
                                    rules={[{ required: true }]}
                                >
                                    <Input type="number" min={1} />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item
                                    name="overdueHours"
                                    label={
                                        <Space size={6}>
                                            <span>Overdue threshold (hours)</span>
                                            <Tooltip title="How long past the due date before a task is treated as overdue for reminders.">
                                                <Text type="secondary">ⓘ</Text>
                                            </Tooltip>
                                        </Space>
                                    }
                                    initialValue={24}
                                    rules={[{ required: true }]}
                                >
                                    <Input type="number" min={1} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[12, 12]}>
                            <Col xs={24} md={8}>
                                <Form.Item
                                    name="cooldownHours"
                                    label={
                                        <Space size={6}>
                                            <span>Cooldown (hours)</span>
                                            <Tooltip title="Minimum time between reminders for the same task (prevents spam).">
                                                <Text type="secondary">ⓘ</Text>
                                            </Tooltip>
                                        </Space>
                                    }
                                    initialValue={24}
                                    rules={[{ required: true }]}
                                >
                                    <Input type="number" min={1} />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={16}>
                                <Form.Item
                                    name="statuses"
                                    label={
                                        <Space size={6}>
                                            <span>Statuses to remind</span>
                                            <Tooltip title="Reminders can be sent only when a task is in one of these statuses.">
                                                <Text type="secondary">ⓘ</Text>
                                            </Tooltip>
                                        </Space>
                                    }
                                    rules={[{ required: true }]}
                                >
                                    <Select
                                        mode="multiple"
                                        options={['To Do', 'In Progress', 'Awaiting Proof', 'Overdue'].map(s => ({ value: s, label: s }))}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Alert
                            type="info"
                            showIcon
                            message="Manual reminders"
                            description="Use the “Remind” button on any task to queue a reminder, respecting cooldown."
                        />
                    </Form>
                </Modal>


                {/* AI INPUT MODAL */}
                <Modal
                    title={<Space><RobotOutlined /> Magic Task Extractor</Space>}
                    open={aiModalOpen}
                    onCancel={() => setAiModalOpen(false)}
                    onOk={handleAIExtract}
                    okText="Extract Tasks"
                    confirmLoading={isExtracting}
                >
                    <Text type="secondary">Paste meeting notes, emails, or chat logs. I'll identify action items for you.</Text>
                    <Input.TextArea
                        rows={6}
                        value={aiInput}
                        onChange={e => setAiInput(e.target.value)}
                        placeholder="e.g. Sarah needs to finish the audit by Friday. Also, Mark should review the landing page copy..."
                        style={{ marginTop: 12 }}
                    />
                </Modal>


                {/* AI EXTRACT CONFIRMATION MODAL */}
                <Modal
                    title={
                        <Space>
                            <RobotOutlined />
                            <span>Review Extracted Tasks</span>
                            <Tag color="blue">
                                {isReviewStep ? 'Review' : `Task ${wizardIndex + 1} of ${pendingTasks.length}`}
                            </Tag>
                        </Space>
                    }
                    open={wizardOpen}
                    onCancel={() => {
                        setWizardOpen(false)
                        wizardForm.resetFields()
                    }}
                    footer={null}
                    width={920}
                    bodyStyle={{ padding: 16 }}
                >
                    {/* Steps */}
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <Progress
                                    percent={Math.round(((wizardIndex + (isReviewStep ? 1 : 0)) / Math.max(1, totalSteps - 1)) * 100)}
                                    showInfo={false}
                                />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {isReviewStep
                                        ? 'Read-only summary of what you saved.'
                                        : 'Edit the fields to match your task setup requirements, then confirm to continue.'}
                                </Text>
                            </div>

                            {!isReviewStep ? (
                                <Button
                                    danger
                                    icon={<CloseOutlined />}
                                    onClick={() => {
                                        // discard current draft
                                        const cur = currentDraft
                                        if (!cur) return
                                        const remaining = pendingTasks.filter(t => t.tempId !== cur.tempId)
                                        setPendingTasks(remaining)

                                        // if nothing left, jump to review
                                        if (!remaining.length) {
                                            setWizardIndex(0)
                                            wizardForm.resetFields()
                                            return
                                        }

                                        // keep index in range
                                        const nextIndex = Math.min(wizardIndex, remaining.length - 1)
                                        setWizardIndex(nextIndex)
                                        setTimeout(() => loadDraftIntoForm(remaining[nextIndex]), 0)
                                    }}
                                >
                                    Discard
                                </Button>
                            ) : null}
                        </div>

                        <Divider style={{ margin: '12px 0' }} />
                    </div>

                    {/* Edit step */}
                    {!isReviewStep && currentDraft ? (
                        <Form
                            form={wizardForm}
                            layout="vertical"
                            onFinish={async values => {
                                try {
                                    if (!user?.companyCode) return

                                    // build validated payload (mirrors Add Task modal fields)
                                    const core = buildFinalTaskPayloadFromWizard(values)

                                    const id = `task-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
                                    await setDoc(doc(db, 'tasks', id), {
                                        ...core,
                                        companyCode: user.companyCode,
                                        company_code: user.companyCode,
                                        status: 'To Do',
                                        archived: false,
                                        createdAt: Timestamp.now(),
                                        createdBy: user.id || user.uid || user.email || 'unknown'
                                    } as any)

                                    // store read-only review copy (human readable)
                                    const reviewItem = {
                                        id,
                                        title: core.title,
                                        description: core.description,
                                        scope: core.scope,
                                        programId: core.programId || null,
                                        dueDate: values.dueDate,
                                        priority: core.priority,
                                        taskTypeName: core.taskType?.name || core.taskType?.id || 'Task',
                                        proofRequired: !!core.taskType?.proofRequired,
                                        assignees: (core.assignees || []).map(a => ({
                                            userId: a.userId,
                                            name: resolveUser(a.userId),
                                            role: a.role
                                        })),
                                        recurrence: values.recurrenceEnabled
                                            ? { enabled: true, pattern: values.recurrencePattern, interval: values.recurrenceInterval }
                                            : { enabled: false }
                                    }
                                    setWizardSaved(prev => [...prev, reviewItem])

                                    // remove draft from queue + move forward
                                    const remaining = pendingTasks.filter(t => t.tempId !== currentDraft.tempId)
                                    setPendingTasks(remaining)

                                    if (!remaining.length) {
                                        // go to review step
                                        setWizardIndex(0)
                                        wizardForm.resetFields()
                                        message.success('All extracted tasks saved.')
                                        return
                                    }

                                    const nextIndex = Math.min(wizardIndex, remaining.length - 1)
                                    setWizardIndex(nextIndex)
                                    setTimeout(() => loadDraftIntoForm(remaining[nextIndex]), 0)

                                    message.success('Task saved.')
                                } catch (e: any) {
                                    message.error(e?.message || 'Failed to save task.')
                                }
                            }}
                        >
                            <Row gutter={[12, 12]}>
                                <Col xs={24} md={16}>
                                    <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
                                        <Input placeholder="Task title" />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={8}>
                                    <Form.Item name="priority" label="Priority" initialValue="medium" rules={[{ required: true }]}>
                                        <Select
                                            options={[
                                                { value: 'low', label: 'Low' },
                                                { value: 'medium', label: 'Medium' },
                                                { value: 'high', label: 'High' }
                                            ]}
                                        />
                                    </Form.Item>
                                </Col>

                                <Col xs={24}>
                                    <Form.Item name="description" label="Description">
                                        <Input.TextArea rows={3} placeholder="What exactly needs to be done?" />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={8}>
                                    <Form.Item name="scope" label="Scope" initialValue="company" rules={[{ required: true }]}>
                                        <Select
                                            options={[
                                                { value: 'company', label: 'Company (general)' },
                                                { value: 'program', label: 'Program-specific' }
                                            ]}
                                        />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={16}>
                                    <Form.Item shouldUpdate={(p, c) => p.scope !== c.scope} noStyle>
                                        {({ getFieldValue, setFieldsValue }) => {
                                            const scope = getFieldValue('scope')
                                            if (scope !== 'program') return null

                                            const onlyOne = (programs || []).length === 1
                                            if (onlyOne && !getFieldValue('programId')) {
                                                setTimeout(() => setFieldsValue({ programId: programs[0].id }), 0)
                                            }

                                            return (
                                                <Form.Item
                                                    name="programId"
                                                    label="Program"
                                                    rules={[{ required: true, message: 'Program required for program scope' }]}
                                                >
                                                    <Select
                                                        disabled={onlyOne}
                                                        placeholder={onlyOne ? 'Program auto-selected' : 'Select program'}
                                                        showSearch
                                                        optionFilterProp="label"
                                                        options={(programs || []).map(p => ({ value: p.id, label: p.name || p.id }))}
                                                    />
                                                </Form.Item>
                                            )
                                        }}
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={8}>
                                    <Form.Item name="taskType" label="Task Type" rules={[{ required: true }]}>
                                        <Select options={ENHANCED_TASK_TYPES.map(t => ({ value: t.id, label: t.name }))} />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={8}>
                                    <Form.Item name="dueDate" label="Due Date" rules={[{ required: true, message: 'Due date required' }]}>
                                        <DatePicker style={{ width: '100%' }} disabledDate={d => !!d && d < dayjs().startOf('day')} />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={8}>
                                    <Form.Item
                                        name="assignees"
                                        label={
                                            <Space size={6}>
                                                <span>Assign To</span>
                                                <Tooltip title="Internal roles only. Choose one or more users responsible for this task.">
                                                    <Text type="secondary">ⓘ</Text>
                                                </Tooltip>
                                            </Space>
                                        }
                                        rules={[{ required: true, message: 'Select at least one assignee' }]}
                                    >
                                        <Select
                                            mode="multiple"
                                            showSearch
                                            optionFilterProp="label"
                                            placeholder="Select one or more users"
                                            options={(safeInternalUsers || []).map(u => ({
                                                value: u.id,
                                                label: `${u.name || u.email || u.id} (${safeLower(u.role)})`
                                            }))}
                                        />
                                    </Form.Item>
                                </Col>

                                <Col xs={24}>
                                    <MotionCard style={{ borderRadius: 10, border: '1px solid #f0f0f0' }}>
                                        <Space direction="vertical" style={{ width: '100%' }} size={10}>
                                            <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                                                <Text strong>Recurring task (optional)</Text>
                                                <Form.Item name="recurrenceEnabled" valuePropName="checked" initialValue={false} style={{ margin: 0 }}>
                                                    <Switch />
                                                </Form.Item>
                                            </Space>

                                            <Form.Item shouldUpdate={(p, c) => p.recurrenceEnabled !== c.recurrenceEnabled} noStyle>
                                                {({ getFieldValue }) => {
                                                    const on = !!getFieldValue('recurrenceEnabled')
                                                    if (!on) return <Text type="secondary">Disabled.</Text>

                                                    return (
                                                        <Row gutter={[12, 12]}>
                                                            <Col xs={24} md={12}>
                                                                <Form.Item name="recurrencePattern" label="Pattern" initialValue="weekly" rules={[{ required: true }]}>
                                                                    <Select
                                                                        options={[
                                                                            { value: 'daily', label: 'Daily' },
                                                                            { value: 'weekly', label: 'Weekly' },
                                                                            { value: 'monthly', label: 'Monthly' },
                                                                            { value: 'quarterly', label: 'Quarterly' },
                                                                            { value: 'custom_days', label: 'Custom days' }
                                                                        ]}
                                                                    />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col xs={24} md={12}>
                                                                <Form.Item name="recurrenceInterval" label="Interval" initialValue={1} rules={[{ required: true }]}>
                                                                    <Input type="number" min={1} />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col xs={24}>
                                                                <Text type="secondary">A new instance is created only after completion.</Text>
                                                            </Col>
                                                        </Row>
                                                    )
                                                }}
                                            </Form.Item>
                                        </Space>
                                    </MotionCard>
                                </Col>
                            </Row>

                            <Divider style={{ margin: '12px 0' }} />

                            <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                                <Button
                                    disabled={wizardIndex === 0}
                                    onClick={() => {
                                        const prevIndex = Math.max(0, wizardIndex - 1)
                                        setWizardIndex(prevIndex)
                                        const prevDraft = pendingTasks[prevIndex]
                                        if (prevDraft) setTimeout(() => loadDraftIntoForm(prevDraft), 0)
                                    }}
                                >
                                    Back
                                </Button>

                                <Space>
                                    <Button
                                        onClick={() => {
                                            // Skip without saving (keeps draft in list, just cycles)
                                            const nextIndex = Math.min(wizardIndex + 1, pendingTasks.length - 1)
                                            setWizardIndex(nextIndex)
                                            const nextDraft = pendingTasks[nextIndex]
                                            if (nextDraft) setTimeout(() => loadDraftIntoForm(nextDraft), 0)
                                        }}
                                    >
                                        Skip
                                    </Button>

                                    <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => wizardForm.submit()}>
                                        Confirm & Save
                                    </Button>
                                </Space>
                            </Space>
                        </Form>
                    ) : null}

                    {/* Final review step (read-only) */}
                    {isReviewStep ? (
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                            <Alert
                                type="success"
                                showIcon
                                message="Done"
                                description="Here’s a summary of what you saved. This is read-only."
                            />

                            <Table
                                rowKey="id"
                                dataSource={wizardSaved}
                                pagination={{ pageSize: 6 }}
                                columns={[
                                    {
                                        title: 'Task',
                                        key: 'task',
                                        render: (_: any, r: any) => (
                                            <Space direction="vertical" size={0}>
                                                <Text strong>{r.title}</Text>
                                                {r.description ? <Text type="secondary">{r.description}</Text> : null}
                                                <Space size={6} wrap>
                                                    <Tag color={r.scope === 'program' ? 'purple' : 'blue'}>
                                                        {r.scope === 'program' ? `Program: ${programName(r.programId)}` : 'Company'}
                                                    </Tag>
                                                    <Tag color={r.priority === 'high' ? 'red' : r.priority === 'low' ? 'default' : 'gold'}>
                                                        {(r.priority || 'medium').toUpperCase()}
                                                    </Tag>
                                                    <Tag>{r.taskTypeName}</Tag>
                                                    {r.proofRequired ? <Tag icon={<FileSearchOutlined />}>Proof required</Tag> : null}
                                                    {r.recurrence?.enabled ? <Tag icon={<ClockCircleOutlined />}>Recurring</Tag> : null}
                                                </Space>
                                            </Space>
                                        )
                                    },
                                    {
                                        title: 'Assigned',
                                        key: 'assigned',
                                        width: 280,
                                        render: (_: any, r: any) => (
                                            <Space direction="vertical" size={0}>
                                                {(r.assignees || []).length ? (
                                                    r.assignees.map((a: any) => (
                                                        <Text key={`${r.id}-${a.userId}`}>
                                                            {a.name} <Text type="secondary">({a.role})</Text>
                                                        </Text>
                                                    ))
                                                ) : (
                                                    <Text type="secondary">—</Text>
                                                )}
                                            </Space>
                                        )
                                    },
                                    {
                                        title: 'Due',
                                        key: 'due',
                                        width: 130,
                                        render: (_: any, r: any) => (r.dueDate ? dayjs(r.dueDate).format('YYYY-MM-DD') : '—')
                                    }
                                ]}
                            />

                            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        setWizardOpen(false)
                                        setPendingTasks([])
                                        setWizardSaved([])
                                        setWizardIndex(0)
                                        wizardForm.resetFields()
                                    }}
                                >
                                    Close
                                </Button>
                            </Space>
                        </Space>
                    ) : null}

                    {/* If no pending drafts left but we have saved items, show review automatically */}
                    {!pendingTasks.length && !isReviewStep && wizardSaved.length ? (
                        <div style={{ display: 'none' }}>
                            {setTimeout(() => {
                                setWizardIndex(0)
                            }, 0) as any}
                        </div>
                    ) : null}
                </Modal>



            </Space>
        </div>
    )
}
