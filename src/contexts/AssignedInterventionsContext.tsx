// contexts/AssignedInterventionsContext.tsx
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState
} from 'react'
import {
    collection,
    doc,
    getDocs,
    onSnapshot,
    query,
    where,
    writeBatch,
    Timestamp,
    type Unsubscribe
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'

export type InterventionType = 'singular' | 'grouped'
export type AssigneeType = 'consultant' | 'operations'

export type OverallStatus = 'assigned' | 'in-progress' | 'completed' | 'cancelled'
export type AssigneeStatus = 'pending' | 'accepted' | 'declined'
export type IncubateeStatus = 'pending' | 'accepted' | 'declined'
export type AssigneeCompletionStatus = 'pending' | 'done'
export type IncubateeCompletionStatus = 'pending' | 'confirmed' | 'rejected'

export type Resource = {
    type: 'document' | 'link' | 'image' | string
    label: string
    link: string
    uploadedByRole?: string
    uploadedBy?: string
    uploadedAt?: any
}

export interface AssignedIntervention {
    id: string
    companyCode?: string

    groupId?: string | null
    participantId: string
    beneficiaryName: string

    interventionId: string
    interventionTitle: string
    subtitle?: string | null
    type: InterventionType

    implementationDate?: any
    dueDate?: any
    isRecurring?: boolean

    assigneeType?: AssigneeType
    assigneeId?: string
    assigneeName?: string
    assigneeEmail?: string

    status: OverallStatus
    assigneeStatus: AssigneeStatus
    incubateeStatus: IncubateeStatus
    assigneeCompletionStatus: AssigneeCompletionStatus
    incubateeCompletionStatus: IncubateeCompletionStatus

    createdAt: any
    updatedAt?: any

    timeSpent?: number
    progress?: number
    notes?: string

    timeSpentHours?: number

    feedback?: { rating: number; comments: string }

    targetType?: 'percentage' | 'number'
    targetValue?: number
    targetMetric?: string
    areaOfSupport?: string

    overdueReason?: string
    overdueReasonBy?: string
    overdueReasonAt?: any

    resources?: Resource[]

    reassignmentHistory?: any[]
}

export type GroupRow = {
    groupKey: string
    groupTitle: string
    beneficiaryName: string
    items: AssignedIntervention[]
    totalTime: number
    avgProgress: number
    rolledStatus: 'assigned' | 'in-progress' | 'completed' | 'declined' | 'mixed' | 'cancelled'
    dueLabel: string
    isOverdue: boolean
    overdueCount: number
    hasOverdueReason: boolean
}

type Ctx = {
    assignments: AssignedIntervention[]
    groups: GroupRow[]
    loading: boolean
    refresh: () => Promise<void>
    companyCode?: string

    isMine: (a: AssignedIntervention) => boolean

    addProgressUpdate: (args: {
        scope: { id: string; groupId?: string | null; consultantId?: string }
        hoursDelta: number
        progressDelta: number
        notes?: string
    }) => Promise<void>

    saveOverdueReason: (args: {
        groupKey: string
        reason: string
    }) => Promise<void>
}

const AssignedInterventionsContext = createContext<Ctx | null>(null)

const norm = (v: any) => String(v ?? '').trim().toLowerCase()

const toDate = (v: any): Date | null => {
    if (!v) return null
    if (v?.toDate) return v.toDate()
    if (typeof v === 'object' && v?.seconds && typeof v.seconds === 'number') {
        return new Date(v.seconds * 1000)
    }
    const d = new Date(v)
    return isNaN(+d) ? null : d
}

export const AssignedInterventionsProvider: React.FC<{
    children: React.ReactNode
    debug?: boolean
}> = ({ children, debug = false }) => {
    const { user } = useFullIdentity()
    const companyCode = user?.companyCode

    const [assignments, setAssignments] = useState<AssignedIntervention[]>([])
    const [loading, setLoading] = useState<boolean>(true)

    // Map anything -> auth uid (authUid)
    // keys: docId, authUid, email, self:email (all normalized)
    const [assigneeUidMap, setAssigneeUidMap] = useState<Record<string, string>>({})

    const log = useCallback(
        (...args: any[]) => {
            if (debug) console.log('[AssignedInterventionsProvider]', ...args)
        },
        [debug]
    )

    const logRows = useCallback(
        (label: string, rows: AssignedIntervention[]) => {
            if (!debug) return
            console.log(`[AssignedInterventionsProvider] ${label} count=`, rows.length)
            const sample = rows.slice(0, 8).map(r => ({
                id: r.id,
                beneficiaryName: r.beneficiaryName,
                participantId: r.participantId,
                interventionTitle: r.interventionTitle,
                interventionId: r.interventionId,
                type: r.type,
                status: r.status,
                groupId: r.groupId ?? null,
                dueDate: r.dueDate ?? null,
                assigneeType: r.assigneeType ?? null,
                assigneeId: r.assigneeId ?? null,
                assigneeEmail: r.assigneeEmail ?? null,
                companyCode: r.companyCode ?? null
            }))
            console.table(sample)
        },
        [debug]
    )

    const baseQuery = useMemo(() => {
        if (!companyCode) return null
        return query(
            collection(db, 'assignedInterventions'),
            where('companyCode', '==', companyCode)
        )
    }, [companyCode])

    const normalizeRow = useCallback((raw: any, id: string): AssignedIntervention => {
        const row = { id, ...(raw || {}) } as AssignedIntervention

        const timeSpent =
            typeof (raw?.timeSpent ?? row.timeSpent) === 'number'
                ? (raw?.timeSpent ?? row.timeSpent)
                : typeof row.timeSpentHours === 'number'
                    ? row.timeSpentHours
                    : 0

        const progress =
            typeof (raw?.progress ?? row.progress) === 'number'
                ? (raw?.progress ?? row.progress)
                : 0

        row.timeSpent = timeSpent
        row.progress = Math.max(0, Math.min(100, progress))

        if (typeof row.timeSpentHours !== 'number') row.timeSpentHours = row.timeSpent

        row.status = (row.status || 'assigned') as any
        row.assigneeStatus = (row.assigneeStatus || 'pending') as any
        row.incubateeStatus = (row.incubateeStatus || 'pending') as any
        row.assigneeCompletionStatus = (row.assigneeCompletionStatus || 'pending') as any
        row.incubateeCompletionStatus = (row.incubateeCompletionStatus || 'pending') as any

        return row
    }, [])

    // Build assigneeId -> authUid resolver map from consultants + operationsStaff (both use authUid)
    useEffect(() => {
        if (!companyCode) {
            setAssigneeUidMap({})
            return
        }

        const unsubs: Unsubscribe[] = []

        const mergeSnapshot = (label: 'consultants' | 'operationsStaff', snap: any) => {
            const adds: Record<string, string> = {}

            snap.docs.forEach((d: any) => {
                const data = d.data() || {}
                const authUid = String(data.authUid || '').trim()
                if (!authUid) return

                const docId = String(d.id || '').trim()
                const email = norm(data.email)

                if (docId) adds[norm(docId)] = authUid
                adds[norm(authUid)] = authUid

                if (email) {
                    adds[email] = authUid
                    adds[`self:${email}`] = authUid
                }
            })

            setAssigneeUidMap(prev => {
                const merged = { ...prev, ...adds }
                log('assigneeUidMap merge', label, 'adds=', Object.keys(adds).length, 'total=', Object.keys(merged).length)
                return merged
            })
        }

        const consultantsQ = query(
            collection(db, 'consultants'),
            where('companyCode', '==', companyCode)
        )
        unsubs.push(
            onSnapshot(
                consultantsQ,
                snap => mergeSnapshot('consultants', snap),
                err => console.error('[AssignedInterventionsProvider] consultants snapshot error', err)
            )
        )

        const opsQ = query(
            collection(db, 'operationsStaff'),
            where('companyCode', '==', companyCode)
        )
        unsubs.push(
            onSnapshot(
                opsQ,
                snap => mergeSnapshot('operationsStaff', snap),
                err => console.error('[AssignedInterventionsProvider] operationsStaff snapshot error', err)
            )
        )

        return () => {
            unsubs.forEach(u => u())
        }
    }, [companyCode, log])

    const refresh = useCallback(async () => {
        if (!baseQuery) {
            log('refresh skipped (no companyCode yet)')
            return
        }

        setLoading(true)
        try {
            const snap = await getDocs(baseQuery)
            const rows = snap.docs.map(d => normalizeRow(d.data(), d.id))
            setAssignments(rows)

            log('refresh rows=', rows.length)
            logRows('refresh fetched', rows)

            if (debug) {
                const missing = rows.filter(r => !r.assigneeId || !r.assigneeName || !r.assigneeType)
                log('missingCanonical=', missing.length, missing.slice(0, 5))
            }
        } catch (err) {
            console.error('[AssignedInterventionsProvider] refresh error', err)
        } finally {
            setLoading(false)
        }
    }, [baseQuery, debug, log, logRows, normalizeRow])

    useEffect(() => {
        let unsub: Unsubscribe | null = null

        if (!baseQuery) {
            setAssignments([])
            setLoading(!!user)
            log('no baseQuery yet; user=', user?.email, 'companyCode=', companyCode)
            return
        }

        setLoading(true)
        log('subscribing companyCode=', companyCode)

        unsub = onSnapshot(
            baseQuery,
            snap => {
                const rows = snap.docs.map(d => normalizeRow(d.data(), d.id))

                setAssignments(rows)
                setLoading(false)

                log('snapshot rows=', rows.length)
                logRows('snapshot fetched', rows)

                if (debug) {
                    const missing = rows.filter(r => !r.assigneeId || !r.assigneeName || !r.assigneeType)
                    log('missingCanonical=', missing.length)
                }
            },
            err => {
                console.error('[AssignedInterventionsProvider] snapshot error', err)
                setLoading(false)
            }
        )

        return () => {
            if (unsub) unsub()
        }
    }, [baseQuery, companyCode, debug, log, logRows, normalizeRow, user])

    // “mine” matcher:
    // - role strict
    // - resolves assigneeId via consultants/operationsStaff docId -> authUid
    // - supports assigneeId being authUid already, or raw email/self:email
    const myRole = norm(user?.role)
    const myAuthId = String(user?.uid || '')
    const myEmail = norm(user?.email)
    const mySelfId = myEmail ? `self:${myEmail}` : ''

    const resolveAssigneeAuthId = useCallback(
        (assigneeId: any, assigneeEmail: any) => {
            const idKey = norm(assigneeId)
            const emailKey = norm(assigneeEmail)

            if (idKey && assigneeUidMap[idKey]) return assigneeUidMap[idKey]
            if (emailKey && assigneeUidMap[emailKey]) return assigneeUidMap[emailKey]

            // if map not ready yet, keep safe fallbacks
            if (idKey && myAuthId && idKey === norm(myAuthId)) return myAuthId

            return ''
        },
        [assigneeUidMap, myAuthId]
    )

    const isMine = useCallback(
        (a: AssignedIntervention) => {
            const aType = norm((a as any).assigneeType)
            const aId = String((a as any).assigneeId ?? '')
            const aEmail = norm((a as any).assigneeEmail)

            if (myRole === 'operations' && aType && aType !== 'operations') return false
            if (myRole === 'consultant' && aType && aType !== 'consultant') return false

            const resolvedAuthId = resolveAssigneeAuthId(aId, aEmail)

            if (myAuthId && resolvedAuthId && resolvedAuthId === myAuthId) return true

            // extra safety fallbacks
            if (myAuthId && aId === myAuthId) return true
            if (mySelfId && norm(aId) === mySelfId) return true
            if (myEmail && aEmail === myEmail) return true
            if (myEmail && norm(aId) === myEmail) return true

            return false
        },
        [myAuthId, myEmail, myRole, mySelfId, resolveAssigneeAuthId]
    )

    const groups = useMemo<GroupRow[]>(() => {
        if (!assignments.length) return []

        const byKey = new Map<string, AssignedIntervention[]>()
        for (const it of assignments) {
            const key = it.type === 'grouped' && it.groupId ? it.groupId : it.id
            const arr = byKey.get(key) || []
            arr.push(it)
            byKey.set(key, arr)
        }

        const now = new Date()
        const rows: GroupRow[] = []

        for (const [groupKey, items] of byKey) {
            const totalTime = items.reduce((s, i) => s + (i.timeSpent || 0), 0)
            const avgProgress = items.length
                ? Math.round(items.reduce((s, i) => s + (i.progress ?? 0), 0) / items.length)
                : 0

            const beneSet = new Set(items.map(i => i.beneficiaryName).filter(Boolean))
            const beneficiaryName = beneSet.size === 1 ? (items[0].beneficiaryName || '—') : 'Multiple'

            const titleSet = new Set(items.map(i => i.interventionTitle).filter(Boolean))
            const groupTitle =
                items[0].subtitle ||
                (titleSet.size === 1
                    ? (Array.from(titleSet)[0] as string)
                    : `Shared: ${Array.from(titleSet).slice(0, 2).join(', ')}${titleSet.size > 2 ? '…' : ''}`)

            const statuses = new Set(items.map(i => norm(i.status)))
            let rolledStatus: GroupRow['rolledStatus'] =
                statuses.size === 1 ? ((Array.from(statuses)[0] as any) || 'assigned') : 'mixed'
            if (rolledStatus === 'in_progress') rolledStatus = 'in-progress'
            if (rolledStatus === 'canceled') rolledStatus = 'cancelled'

            const dueDates = items.map(i => toDate(i.dueDate)).filter(Boolean) as Date[]
            dueDates.sort((a, b) => +a - +b)

            let dueLabel = '—'
            let isOverdue = false
            let overdueCount = 0

            if (dueDates.length) {
                const start = dueDates[0]
                const end = dueDates[dueDates.length - 1]
                const fmt = (d: Date) =>
                    d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })

                dueLabel =
                    start.toDateString() === end.toDateString() ? fmt(start) : `${fmt(start)} – ${fmt(end)}`

                const overdueItems = items.filter(i => {
                    const d = toDate(i.dueDate)
                    if (!d) return false
                    const s = norm(i.status)
                    const terminal = s === 'completed' || s === 'declined' || s === 'cancelled'
                    return !terminal && d.setHours(0, 0, 0, 0) < new Date(now).setHours(0, 0, 0, 0)
                })

                overdueCount = overdueItems.length
                isOverdue = overdueCount > 0
            }

            const hasOverdueReason = items.some(i => !!(i.overdueReason || '').trim())

            rows.push({
                groupKey,
                groupTitle,
                beneficiaryName,
                items,
                totalTime,
                avgProgress,
                rolledStatus,
                dueLabel,
                isOverdue,
                overdueCount,
                hasOverdueReason
            })
        }

        const order: Record<string, number> = {
            'in-progress': 0,
            assigned: 1,
            mixed: 2,
            completed: 3,
            cancelled: 4,
            declined: 5
        }

        return rows.sort(
            (a, b) =>
                (order[a.rolledStatus] ?? 9) - (order[b.rolledStatus] ?? 9) ||
                a.beneficiaryName.localeCompare(b.beneficiaryName)
        )
    }, [assignments])

    const addProgressUpdate: Ctx['addProgressUpdate'] = useCallback(
        async ({ scope, hoursDelta, progressDelta, notes }) => {
            const baseId = scope.id
            if (!baseId) return

            const base = assignments.find(a => a.id === baseId)
            const groupId = scope.groupId ?? base?.groupId ?? null

            const targets = groupId
                ? assignments.filter(
                    a =>
                        a.groupId === groupId &&
                        (!scope.consultantId || a.assigneeId === scope.consultantId)
                )
                : base
                    ? [base]
                    : []

            if (!targets.length) return

            const now = Timestamp.now()
            const batch = writeBatch(db)

            targets.forEach(t => {
                const newTime = (t.timeSpent || 0) + Math.max(0, hoursDelta || 0)
                const newProgress = Math.min(Math.max((t.progress || 0) + (progressDelta || 0), 0), 100)

                batch.update(doc(db, 'assignedInterventions', t.id), {
                    timeSpent: newTime,
                    progress: newProgress,
                    ...(typeof notes === 'string' ? { notes } : {}),
                    updatedAt: now
                } as any)
            })

            try {
                await batch.commit()

                setAssignments(prev =>
                    prev.map(a => {
                        const hit = targets.some(t => t.id === a.id)
                        if (!hit) return a
                        return {
                            ...a,
                            timeSpent: (a.timeSpent || 0) + Math.max(0, hoursDelta || 0),
                            progress: Math.min(Math.max((a.progress || 0) + (progressDelta || 0), 0), 100),
                            ...(typeof notes === 'string' ? { notes } : {}),
                            updatedAt: now
                        }
                    })
                )
            } catch (err) {
                console.error('[AssignedInterventionsProvider] addProgressUpdate error', {
                    scope,
                    hoursDelta,
                    progressDelta,
                    error: err
                })
                throw err
            }
        },
        [assignments]
    )

    const saveOverdueReason: Ctx['saveOverdueReason'] = useCallback(
        async ({ groupKey, reason }) => {
            const r = String(reason || '').trim()
            if (!r) return

            const group = groups.find(g => g.groupKey === groupKey)
            if (!group) return

            const now = Timestamp.now()
            const by = user?.uid || user?.email || 'unknown'

            const batch = writeBatch(db)
            group.items.forEach(it => {
                batch.update(doc(db, 'assignedInterventions', it.id), {
                    overdueReason: r,
                    overdueReasonBy: by,
                    overdueReasonAt: now,
                    updatedAt: now
                } as any)
            })

            try {
                await batch.commit()

                setAssignments(prev =>
                    prev.map(a => {
                        const hit = group.items.some(i => i.id === a.id)
                        if (!hit) return a
                        return {
                            ...a,
                            overdueReason: r,
                            overdueReasonBy: by,
                            overdueReasonAt: now,
                            updatedAt: now
                        }
                    })
                )
            } catch (err) {
                console.error('[AssignedInterventionsProvider] saveOverdueReason error', {
                    groupKey,
                    reason,
                    error: err
                })
                throw err
            }
        },
        [groups, user?.uid, user?.email]
    )

    const value = useMemo<Ctx>(
        () => ({
            assignments,
            groups,
            loading,
            refresh,
            companyCode,
            isMine,
            addProgressUpdate,
            saveOverdueReason
        }),
        [assignments, groups, loading, refresh, companyCode, isMine, addProgressUpdate, saveOverdueReason]
    )

    return (
        <AssignedInterventionsContext.Provider value={value}>
            {children}
        </AssignedInterventionsContext.Provider>
    )
}

export function useAssignedInterventions() {
    const ctx = useContext(AssignedInterventionsContext)
    if (!ctx) throw new Error('useAssignedInterventions must be used inside AssignedInterventionsProvider')
    return ctx
}
