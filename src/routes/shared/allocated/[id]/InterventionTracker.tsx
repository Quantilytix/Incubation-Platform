import React, { useEffect, useMemo, useState } from 'react'
import {
    Card,
    Typography,
    Input,
    Button,
    message,
    Form,
    Tag,
    Space,
    Grid,
    Col,
    Row,
    Switch,
    Divider,
    InputNumber,
    Alert
} from 'antd'
import {
    ArrowLeftOutlined,
    SaveOutlined,
    ClockCircleOutlined,
    RiseOutlined,
    ReloadOutlined,
    HistoryOutlined,
    AimOutlined,
    CalendarOutlined,
    PlusOutlined,
    EditOutlined
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import dayjs from 'dayjs'
import { db } from '@/firebase'
import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    where,
    writeBatch,
    Timestamp,
    addDoc,
    arrayUnion,
    increment
} from 'firebase/firestore'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { InterventionHistoryModal } from '../history/InterventionHistoryModal'
import { MotionCard } from '@/components/shared/Header'
import { ProgressMotivationCard } from '@/components/interventions/ProgressMotivaationCard'

const { Text } = Typography
const { TextArea } = Input

type InterventionType = 'singular' | 'grouped'
type AssigneeType = 'consultant' | 'operations'
type OverallStatus = 'assigned' | 'in-progress' | 'completed'
type AssigneeStatus = string
type IncubateeStatus = string
type AssigneeCompletionStatus = string
type IncubateeCompletionStatus = string

type TargetType = 'percentage' | 'number'
type TargetMode = 'none' | 'percentage' | 'number'

type LastUpdateMode = 'units' | 'override' | 'percentage'

type ProgressStep = {
    createdAt: any
    actorUid?: string
    actorRole?: string
    scope?: 'single' | 'group'

    hoursAdded?: number
    unitsAdded?: number

    progressBefore?: number
    progressAfter?: number

    timeSpentBefore?: number
    timeSpentAfter?: number

    targetActualBefore?: number
    targetActualAfter?: number

    targetValue?: number
    targetType?: TargetType
    targetMetric?: string

    notes?: string
    overTargetBy?: number

    updateMode?: LastUpdateMode
    overrideProgress?: number
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

    targetType?: TargetType
    targetValue?: number
    targetMetric?: string
    areaOfSupport?: string

    overdueReason?: string
    overdueReasonBy?: string
    overdueReasonAt?: any

    resources?: any[]
    reassignmentHistory?: any[]

    targetActual?: number
    progressSteps?: ProgressStep[]

    lastUpdateMode?: LastUpdateMode
    lastOverrideProgress?: number
}

type TargetMetricKey =
    | 'hours'
    | 'sessions'
    | 'documents'
    | 'deliverables'
    | 'reports'
    | 'submissions'

type TargetMetricConfig = {
    key: TargetMetricKey
    label: string
    integerOnly: boolean
    extendAllowed: boolean
}

const TARGET_METRICS: TargetMetricConfig[] = [
    { key: 'hours', label: 'Hours', integerOnly: false, extendAllowed: true },
    { key: 'sessions', label: 'Session(s)', integerOnly: true, extendAllowed: false },
    { key: 'documents', label: 'Document(s)', integerOnly: true, extendAllowed: true },
    { key: 'deliverables', label: 'Deliverable(s)', integerOnly: true, extendAllowed: true },
    { key: 'reports', label: 'Report(s)', integerOnly: true, extendAllowed: true },
    { key: 'submissions', label: 'Submission(s)', integerOnly: true, extendAllowed: true }
]

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

const toDate = (v: any): Date | null => {
    if (!v) return null
    if (v?.toDate) return v.toDate()
    if (typeof v === 'object' && v?.seconds) return new Date(v.seconds * 1000)
    const d = new Date(v)
    return Number.isNaN(+d) ? null : d
}

const norm = (v: any) => String(v || '').trim().toLowerCase()

const toSafeNumber = (v: any): number | null => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

const normalizeTargetMetricKey = (metric?: string): TargetMetricKey | null => {
    const m = norm(metric)
    if (!m) return null

    if (m === 'hour' || m === 'hours' || m.includes('hour')) return 'hours'
    if (m === 'session' || m === 'sessions' || m.includes('session')) return 'sessions'
    if (m === 'document' || m === 'documents' || m.includes('document')) return 'documents'
    if (m === 'deliverable' || m === 'deliverables' || m.includes('deliverable')) return 'deliverables'
    if (m === 'report' || m === 'reports' || m.includes('report')) return 'reports'
    if (m === 'submission' || m === 'submissions' || m.includes('submission')) return 'submissions'

    return null
}

const getMetricConfig = (metric?: string): TargetMetricConfig | null => {
    const key = normalizeTargetMetricKey(metric)
    if (!key) return null
    return TARGET_METRICS.find(x => x.key === key) || null
}

const canExtendNumericTarget = (a?: AssignedIntervention | null, cfg?: TargetMetricConfig | null) => {
    if (!a) return false
    if (a.targetType !== 'number') return false
    if (!cfg) return false
    return cfg.extendAllowed
}

export const InterventionTracker: React.FC = () => {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const { user } = useFullIdentity()

    const screens = Grid.useBreakpoint()
    const isMobile = !screens.md

    const [primary, setPrimary] = useState<AssignedIntervention | null>(null)
    const [groupItems, setGroupItems] = useState<AssignedIntervention[]>([])
    const inGroup = useMemo(() => !!primary?.groupId, [primary])

    const [notes, setNotes] = useState('')
    const [hoursToAdd, setHoursToAdd] = useState<number | null>(null)

    const [unitsToAdd, setUnitsToAdd] = useState<number | null>(null)
    const [progressAbs, setProgressAbs] = useState<number | null>(null)

    const [overrideAbs, setOverrideAbs] = useState(false)
    const [overrideAbsValue, setOverrideAbsValue] = useState<number | null>(null)

    const [extendOpen, setExtendOpen] = useState(false)
    const [extendBy, setExtendBy] = useState<number | null>(null)

    const [working, setWorking] = useState(false)
    const [workingText, setWorkingText] = useState('Working...')
    const [historyOpen, setHistoryOpen] = useState(false)

    const scopeList = useMemo(() => {
        if (!primary) return []
        return inGroup ? groupItems : [primary]
    }, [primary, inGroup, groupItems])

    const totalTimeSpent = useMemo(() => {
        if (!scopeList.length) return 0
        return scopeList.reduce((sum, i) => sum + (Number(i.timeSpent) || 0), 0)
    }, [scopeList])

    const totalProgress = useMemo(() => {
        if (!scopeList.length) return 0
        const avg =
            scopeList.reduce((sum, i) => sum + (Number(i.progress) || 0), 0) /
            scopeList.length
        return clamp(avg)
    }, [scopeList])

    const dateStarted = useMemo(() => {
        const ds = scopeList.map(i => toDate(i.createdAt)).filter(Boolean) as Date[]
        if (!ds.length) return null
        ds.sort((a, b) => +a - +b)
        return ds[0]
    }, [scopeList])

    const dueDate = useMemo(() => {
        const ds = scopeList.map(i => toDate(i.dueDate)).filter(Boolean) as Date[]
        if (ds.length) {
            ds.sort((a, b) => +a - +b)
            return ds[0]
        }
        return toDate(primary?.dueDate)
    }, [scopeList, primary])

    const titleText = useMemo(() => {
        if (!primary) return '—'
        const baseTitle = primary.interventionTitle || 'Intervention'
        if (!inGroup) return baseTitle

        const titles = groupItems.map(i => i.interventionTitle).filter(Boolean) as string[]
        if (!titles.length) return baseTitle

        const freq = new Map<string, number>()
        for (const t of titles) freq.set(t, (freq.get(t) || 0) + 1)

        let best = titles[0]
        let bestCount = 0
        for (const [t, c] of freq.entries()) {
            if (c > bestCount) {
                best = t
                bestCount = c
            }
        }
        const variants = freq.size - 1
        return variants > 0 ? `${best} (+${variants} variant${variants > 1 ? 's' : ''})` : best
    }, [primary, inGroup, groupItems])

    const subtitleText = useMemo(() => {
        if (!primary) return ''
        if (!inGroup) return String(primary.subtitle || '').trim()

        const subs = groupItems.map(i => String(i.subtitle || '').trim()).filter(Boolean)
        if (!subs.length) return ''
        const allSame = subs.every(s => s === subs[0])
        if (allSame) return subs[0]

        const freq = new Map<string, number>()
        for (const s of subs) freq.set(s, (freq.get(s) || 0) + 1)
        let best = subs[0]
        let bestCount = 0
        for (const [s, c] of freq.entries()) {
            if (c > bestCount) {
                best = s
                bestCount = c
            }
        }
        return best ? `${best} (Multiple)` : 'Multiple'
    }, [primary, inGroup, groupItems])

    const targetMode: TargetMode = useMemo(() => {
        if (!primary?.targetType) return 'none'
        return primary.targetType === 'percentage'
            ? 'percentage'
            : primary.targetType === 'number'
                ? 'number'
                : 'none'
    }, [primary?.targetType])

    const metricCfg = useMemo(() => getMetricConfig(primary?.targetMetric), [primary?.targetMetric])
    const metricLabel = useMemo(() => metricCfg?.label || 'Metric', [metricCfg])
    const metricKey = useMemo(() => metricCfg?.key || null, [metricCfg])

    const isHoursMetric = metricKey === 'hours'

    const targetValue = useMemo(() => {
        const v = toSafeNumber(primary?.targetValue)
        return v != null && v > 0 ? v : null
    }, [primary?.targetValue])

    const targetSummaryTag = useMemo(() => {
        if (!primary || targetMode === 'none') return null

        if (targetMode === 'percentage') {
            return (
                <Tag icon={<AimOutlined />} color="green">
                    Target: Percentage{targetValue != null ? ` • ${targetValue}%` : ''}
                </Tag>
            )
        }

        return (
            <Tag icon={<AimOutlined />} color="gold">
                Target: {metricLabel}
                {targetValue != null ? ` • ${targetValue}` : ''}
            </Tag>
        )
    }, [primary, targetMode, targetValue, metricLabel])

    const showMetricGuard = useMemo(() => {
        if (!primary) return false
        if (targetMode !== 'number') return false
        return !metricCfg
    }, [primary, targetMode, metricCfg])

    const showOverrideWarning = useMemo(() => {
        if (!primary) return false
        if (targetMode !== 'number') return false
        if (metricKey !== 'sessions') return false
        return primary.lastUpdateMode === 'override'
    }, [primary, targetMode, metricKey])

    const nextPreview = useMemo(() => {
        if (!primary || targetMode === 'none') return null

        if (targetMode === 'percentage') {
            if (progressAbs == null || !Number.isFinite(progressAbs)) return null
            return { afterPct: clamp(progressAbs), overBy: 0 }
        }

        if (targetMode !== 'number') return null
        if (!targetValue) return null
        if (!metricCfg) return null

        if (overrideAbs) {
            if (overrideAbsValue == null || !Number.isFinite(overrideAbsValue)) return null
            return { afterPct: clamp(overrideAbsValue), overBy: 0 }
        }

        // For Hours metric: units come from hoursToAdd (no separate unit input)
        let unitsAdded: number | null = null
        if (isHoursMetric) {
            if (hoursToAdd == null || !Number.isFinite(hoursToAdd) || hoursToAdd <= 0) return null
            unitsAdded = hoursToAdd
        } else {
            if (unitsToAdd == null || !Number.isFinite(unitsToAdd) || unitsToAdd <= 0) return null
            unitsAdded = metricCfg.integerOnly ? Math.floor(unitsToAdd) : unitsToAdd
            if (unitsAdded <= 0) return null
        }

        const baseActual = Number(primary.targetActual) || 0
        const actualAfter = baseActual + unitsAdded
        const overBy = actualAfter > targetValue ? actualAfter - targetValue : 0
        const pctAfter = clamp((actualAfter / targetValue) * 100)

        return { afterPct: pctAfter, overBy }
    }, [
        primary,
        targetMode,
        progressAbs,
        overrideAbs,
        overrideAbsValue,
        targetValue,
        metricCfg,
        isHoursMetric,
        hoursToAdd,
        unitsToAdd
    ])

    const canSubmit = useMemo(() => {
        if (!primary || !scopeList.length) return false

        const hOk = hoursToAdd != null && Number.isFinite(hoursToAdd) && hoursToAdd > 0
        if (!hOk) return false

        if (targetMode === 'percentage') {
            const pOk =
                progressAbs != null &&
                Number.isFinite(progressAbs) &&
                progressAbs >= 0 &&
                progressAbs <= 100
            return pOk
        }

        if (targetMode === 'number') {
            if (!metricCfg) return false
            if (!targetValue) return false

            if (overrideAbs) {
                const pOk =
                    overrideAbsValue != null &&
                    Number.isFinite(overrideAbsValue) &&
                    overrideAbsValue >= 0 &&
                    overrideAbsValue <= 100
                return pOk
            }

            // units required (except hours metric where hours acts as units)
            if (isHoursMetric) return !!nextPreview
            const uOk = unitsToAdd != null && Number.isFinite(unitsToAdd) && unitsToAdd > 0
            return uOk && !!nextPreview
        }

        // targetMode none: still require hours, but disallow update because progress logic is undefined
        return false
    }, [
        primary,
        scopeList.length,
        hoursToAdd,
        targetMode,
        progressAbs,
        metricCfg,
        targetValue,
        overrideAbs,
        overrideAbsValue,
        unitsToAdd,
        nextPreview,
        isHoursMetric
    ])

    const btnBorderStyle = (enabled: boolean): React.CSSProperties =>
        enabled ? { border: '1px solid dodgerblue' } : { border: 'none' }

    const resetInputs = () => {
        setNotes('')
        setHoursToAdd(null)
        setUnitsToAdd(null)
        setProgressAbs(null)
        setOverrideAbs(false)
        setOverrideAbsValue(null)
        setExtendOpen(false)
        setExtendBy(null)
    }

    const applyDefaultsFromDoc = (docData: AssignedIntervention) => {
        resetInputs()
        setNotes(docData.notes || '')

        if (
            docData.targetType === 'number' &&
            normalizeTargetMetricKey(docData.targetMetric) === 'sessions' &&
            docData.lastUpdateMode === 'override'
        ) {
            setOverrideAbs(true)
            setOverrideAbsValue(docData.lastOverrideProgress ?? null)
        }
    }

    const load = async () => {
        if (!id) return
        try {
            setWorking(true)
            setWorkingText('Loading intervention...')

            const ref = doc(db, 'assignedInterventions', id)
            const snap = await getDoc(ref)

            if (!snap.exists()) {
                message.error('Assigned Intervention not found')
                return
            }

            const base = { id: snap.id, ...(snap.data() as any) } as AssignedIntervention

            if (base.groupId) {
                const qy = query(collection(db, 'assignedInterventions'), where('groupId', '==', base.groupId))
                const gs = await getDocs(qy)
                const items = gs.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as AssignedIntervention[]
                const scoped = base.assigneeId
                    ? items.filter(i => String(i.assigneeId || '') === String(base.assigneeId || ''))
                    : items
                setGroupItems(scoped.length ? scoped : items)
            } else {
                setGroupItems([base])
            }

            setPrimary(base)
            applyDefaultsFromDoc(base)
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to load intervention/group', err)
            message.error('Could not load intervention details.')
        } finally {
            setWorking(false)
            setWorkingText('Working...')
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    const handleExtendTarget = async () => {
        if (!primary) return
        if (!canExtendNumericTarget(primary, metricCfg)) return

        const by = Number(extendBy || 0)
        if (!Number.isFinite(by) || by <= 0) {
            message.warning('Enter a valid extension amount')
            return
        }

        try {
            setWorking(true)
            setWorkingText('Extending target...')

            const batch = writeBatch(db)
            const now = Timestamp.now()

            scopeList.forEach(i => {
                batch.update(doc(db, 'assignedInterventions', i.id), {
                    targetValue: increment(by),
                    updatedAt: now
                } as any)
            })

            await batch.commit()

            const updater = (i: AssignedIntervention) => ({
                ...i,
                targetValue: (Number(i.targetValue) || 0) + by
            })

            if (inGroup) setGroupItems(prev => prev.map(updater))
            setPrimary(prev => (prev ? updater(prev) : prev))

            setExtendBy(null)
            setExtendOpen(false)
            message.success('Target extended')
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('extend_target_failed', e)
            message.error('Failed to extend target')
        } finally {
            setWorking(false)
            setWorkingText('Working...')
        }
    }

    const handleUpdateProgress = async () => {
        if (!primary) return

        if (!canSubmit) {
            if (hoursToAdd == null || !Number.isFinite(hoursToAdd) || hoursToAdd <= 0) {
                message.warning('Hours worked today is required')
                return
            }
            if (targetMode === 'number' && !metricCfg) {
                message.error('Invalid target metric. Use one of: Hours, Sessions, Documents, Deliverables, Reports, Submissions.')
                return
            }
            message.warning('Complete the required fields')
            return
        }

        const list = scopeList
        if (!list.length) return

        const now = Timestamp.now()
        const actorRole = String((user as any)?.role || 'user')
        const actorUid = String((user as any)?.uid || (user as any)?.authId || '')
        const hours = Number(hoursToAdd || 0)

        let updateMode: LastUpdateMode = 'units'
        if (targetMode === 'percentage') updateMode = 'percentage'
        if (targetMode === 'number' && overrideAbs) updateMode = 'override'

        try {
            setWorking(true)
            setWorkingText(inGroup ? 'Updating group progress...' : 'Updating progress...')

            const batch = writeBatch(db)
            const historyQueue: Array<{ ref: any; payload: any }> = []

            list.forEach(i => {
                const prevTime = Number(i.timeSpent) || 0
                const prevProg = Number(i.progress) || 0
                const nextTime = prevTime + hours

                const cfg = getMetricConfig(i.targetMetric)
                const key = cfg?.key || null
                const tv = toSafeNumber(i.targetValue)
                const tvOk = tv != null && tv > 0

                let nextProg = prevProg
                let unitsAdded: number | undefined = undefined
                const targetActualBefore = Number(i.targetActual) || 0
                let targetActualAfter = targetActualBefore

                if (targetMode === 'percentage') {
                    nextProg = clamp(Number(progressAbs || 0))
                } else if (targetMode === 'number') {
                    // Fail-proof guard per row: if metric/targetValue invalid, keep progress as-is, still log hours + note
                    if (!cfg || !tvOk) {
                        nextProg = prevProg
                    } else if (overrideAbs) {
                        nextProg = clamp(Number(overrideAbsValue || 0))
                    } else {
                        let rawUnits: number | null = null

                        if (key === 'hours') {
                            rawUnits = hours
                        } else {
                            rawUnits = unitsToAdd != null ? Number(unitsToAdd) : null
                        }

                        if (rawUnits == null || !Number.isFinite(rawUnits) || rawUnits <= 0) {
                            nextProg = prevProg
                        } else {
                            const u = cfg.integerOnly ? Math.floor(rawUnits) : rawUnits
                            unitsAdded = u > 0 ? u : 0
                            targetActualAfter = targetActualBefore + (unitsAdded || 0)
                            nextProg = clamp((targetActualAfter / (tv as number)) * 100)
                        }
                    }
                }

                const overTargetBy =
                    targetMode === 'number' &&
                        !overrideAbs &&
                        cfg &&
                        tvOk &&
                        Number.isFinite(targetActualAfter)
                        ? Math.max(0, targetActualAfter - (tv as number))
                        : 0

                const step: ProgressStep = {
                    createdAt: now,
                    actorUid,
                    actorRole,
                    scope: inGroup ? 'group' : 'single',

                    hoursAdded: hours,
                    unitsAdded,

                    progressBefore: prevProg,
                    progressAfter: nextProg,

                    timeSpentBefore: prevTime,
                    timeSpentAfter: nextTime,

                    targetActualBefore: targetMode === 'number' ? targetActualBefore : undefined,
                    targetActualAfter: targetMode === 'number' && !overrideAbs ? targetActualAfter : undefined,

                    targetValue: tvOk ? (tv as number) : undefined,
                    targetType: i.targetType,
                    targetMetric: cfg ? cfg.label : undefined,

                    notes: String(notes || '').trim() || '',
                    overTargetBy: overTargetBy > 0 ? overTargetBy : undefined,

                    updateMode,
                    overrideProgress: updateMode === 'override' ? clamp(Number(overrideAbsValue || 0)) : undefined
                }

                const updatePayload: Partial<AssignedIntervention> = {
                    timeSpent: nextTime,
                    progress: nextProg,
                    notes: notes || '',
                    updatedAt: now,
                    lastUpdateMode: updateMode,
                    lastOverrideProgress: updateMode === 'override' ? clamp(Number(overrideAbsValue || 0)) : undefined,
                    progressSteps: arrayUnion(step) as any
                }

                if (targetMode === 'number' && !overrideAbs && cfg && tvOk && unitsAdded != null) {
                    updatePayload.targetActual = targetActualAfter
                }

                batch.update(doc(db, 'assignedInterventions', i.id), updatePayload as any)

                historyQueue.push({
                    ref: collection(db, 'assignedInterventions', i.id, 'history'),
                    payload: {
                        type: 'progress_update',
                        createdAt: now,
                        actorRole,
                        actorUid,
                        beneficiaryName: String(i.beneficiaryName || '').trim() || undefined,
                        ...step
                    }
                })
            })

            await batch.commit()

            if (historyQueue.length) {
                await Promise.all(
                    historyQueue.map(async x => {
                        try {
                            await addDoc(x.ref, x.payload)
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error('history_write_failed', e)
                        }
                    })
                )
            }

            message.success(inGroup ? `Update applied to ${list.length} SMEs` : 'Progress updated.')
            navigate(-1)
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error updating intervention(s):', error)
            message.error('Failed to update progress.')
        } finally {
            setWorking(false)
            setWorkingText('Working...')
        }
    }

    const historyIds = useMemo(() => scopeList.map(x => x.id).filter(Boolean), [scopeList])

    return (
        <>
            <Helmet>
                <title>Update Progress | Smart Incubation</title>
                <meta name="description" content="Update progress and capture step-wise results for assigned interventions." />
            </Helmet>

            {working && <LoadingOverlay tip={workingText} />}

            <InterventionHistoryModal
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                interventionIds={historyIds}
                title={inGroup ? 'Group History' : 'Intervention History'}
            />

            <div style={{ padding: isMobile ? 12 : 24, minHeight: '100vh' }}>
                <Card
                    title={
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>{titleText}</span>
                            {inGroup ? (
                                <Tag color="purple">Group • {groupItems.length}</Tag>
                            ) : (
                                <Tag color="blue">Single</Tag>
                            )}
                            {subtitleText ? <Tag>{subtitleText}</Tag> : null}
                            {targetSummaryTag}
                        </div>
                    }
                    extra={
                        <Space wrap>
                            <Button icon={<ReloadOutlined />} shape="round" onClick={load}>
                                Refresh
                            </Button>

                            <Button
                                icon={<HistoryOutlined />}
                                shape="round"
                                onClick={() => setHistoryOpen(true)}
                                disabled={!historyIds.length}
                            >
                                View history
                            </Button>

                            <Button
                                icon={<ArrowLeftOutlined />}
                                shape="round"
                                variant="filled"
                                style={{ border: '1px solid dodgerblue', borderRadius: 999 }}
                                onClick={() => navigate(-1)}
                            >
                                Go back to interventions
                            </Button>
                        </Space>
                    }
                >
                    <Form layout="vertical">
                        <Row gutter={[12, 12]} style={{ marginBottom: 15 }}>
                            <Col xs={24} md={6}>
                                <MotionCard bodyStyle={{ padding: 14 }}>
                                    <MotionCard.Metric
                                        icon={<ClockCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />}
                                        iconBg="rgba(250,173,20,.12)"
                                        title="Total Time Spent"
                                        value={
                                            <span>
                                                {totalTimeSpent}{' '}
                                                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,.45)' }}>
                                                    hours
                                                </span>
                                            </span>
                                        }
                                    />
                                </MotionCard>
                            </Col>

                            <Col xs={24} md={6}>
                                <MotionCard bodyStyle={{ padding: 14 }}>
                                    <MotionCard.Metric
                                        icon={<RiseOutlined style={{ color: '#1677ff', fontSize: 18 }} />}
                                        iconBg="rgba(22,119,255,.12)"
                                        title="Progress"
                                        value={<span style={{ fontSize: 22 }}>{totalProgress}%</span>}
                                    />
                                </MotionCard>
                            </Col>

                            <Col xs={24} md={6}>
                                <MotionCard bodyStyle={{ padding: 14 }}>
                                    <MotionCard.Metric
                                        icon={<CalendarOutlined style={{ color: '#52c41a', fontSize: 18 }} />}
                                        iconBg="rgba(82,196,26,.12)"
                                        title="Date Started"
                                        value={dateStarted ? dayjs(dateStarted).format('DD MMM YYYY') : '—'}
                                    />
                                </MotionCard>
                            </Col>

                            <Col xs={24} md={6}>
                                <MotionCard bodyStyle={{ padding: 14 }}>
                                    <MotionCard.Metric
                                        icon={<CalendarOutlined style={{ color: '#1677ff', fontSize: 18 }} />}
                                        iconBg="rgba(22,119,255,.12)"
                                        title="Due Date"
                                        value={dueDate ? dayjs(dueDate).format('DD MMM YYYY') : '—'}
                                    />
                                </MotionCard>
                            </Col>
                        </Row>

                        <Row gutter={[16, 16]} align="top">
                            <Col xs={24} lg={16}>
                                <MotionCard>
                                    {showMetricGuard ? (
                                        <Alert
                                            type="error"
                                            showIcon
                                            style={{ marginBottom: 12 }}
                                            message="Invalid target metric. Allowed: Hours, Session(s), Document(s), Deliverable(s), Report(s), Submission(s)."
                                        />
                                    ) : null}

                                    {showOverrideWarning ? (
                                        <Alert
                                            type="warning"
                                            showIcon
                                            style={{ marginBottom: 12 }}
                                            message="Last update used an override. Session count was not changed. If this update should be based on sessions, turn off override and log sessions completed today."
                                        />
                                    ) : null}

                                    {targetMode === 'number' && metricCfg ? (
                                        <div style={{ marginBottom: 8 }}>
                                            <Tag color="geekblue" icon={<AimOutlined />}>
                                                Metric: {metricCfg.label}
                                            </Tag>
                                        </div>
                                    ) : null}

                                    <Form.Item
                                        label={
                                            <Space size={8}>
                                                <ClockCircleOutlined />
                                                <span>Hours worked today</span>
                                            </Space>
                                        }
                                        help={<Text type="secondary">Required. This is tracked on every update.</Text>}
                                    >
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0.25}
                                            step={0.25}
                                            value={hoursToAdd ?? undefined}
                                            onChange={v => setHoursToAdd(v == null ? null : Number(v))}
                                            placeholder="e.g. 2"
                                        />
                                    </Form.Item>

                                    {targetMode === 'number' ? (
                                        <>
                                            {!metricCfg ? null : (
                                                <>
                                                    {metricKey === 'hours' ? (
                                                        <Alert
                                                            type="info"
                                                            showIcon
                                                            style={{ marginBottom: 12 }}
                                                            message="This intervention target is Hours. Progress is calculated from Hours worked today (no separate unit entry needed)."
                                                        />
                                                    ) : (
                                                        <Form.Item
                                                            label={
                                                                <Space size={8}>
                                                                    <AimOutlined />
                                                                    <span>{metricCfg.label} completed today</span>
                                                                </Space>
                                                            }
                                                            help={
                                                                nextPreview ? (
                                                                    <Text type="secondary">
                                                                        After this update: <Text strong>{nextPreview.afterPct}%</Text>
                                                                        {nextPreview.overBy > 0 ? (
                                                                            <Tag color="warning" style={{ marginLeft: 8 }}>
                                                                                Over target (+{Math.ceil(nextPreview.overBy)})
                                                                            </Tag>
                                                                        ) : null}
                                                                    </Text>
                                                                ) : (
                                                                    <Text type="secondary">
                                                                        Enter what was done today. Progress is   calculated automatically.
                                                                    </Text>
                                                                )
                                                            }
                                                        >
                                                            <InputNumber
                                                                style={{ width: '100%' }}
                                                                min={metricCfg.integerOnly ? 1 : 0.25}
                                                                step={metricCfg.integerOnly ? 1 : 0.25}
                                                                value={unitsToAdd ?? undefined}
                                                                onChange={v => setUnitsToAdd(v == null ? null : Number(v))}
                                                                placeholder={metricCfg.integerOnly ? 'e.g. 1' : 'e.g. 0.5'}
                                                                disabled={overrideAbs}
                                                                precision={metricCfg.integerOnly ? 0 : 2}
                                                            />
                                                        </Form.Item>
                                                    )}

                                                    <Row gutter={[12, 12]}>
                                                        <Col xs={24} md={12}>
                                                            <Form.Item
                                                                label={
                                                                    <Space size={8}>
                                                                        <EditOutlined />
                                                                        <span>Override progress</span>
                                                                    </Space>
                                                                }
                                                            >
                                                                <Space>
                                                                    <Switch
                                                                        checked={overrideAbs}
                                                                        onChange={v => {
                                                                            setOverrideAbs(v)
                                                                            setOverrideAbsValue(v ? (primary?.lastOverrideProgress ?? null) : null)
                                                                        }}
                                                                    />
                                                                    <Text type="secondary">Does not modify unit count</Text>
                                                                </Space>
                                                            </Form.Item>

                                                            {overrideAbs ? (
                                                                <Form.Item label="Progress % (absolute)">
                                                                    <InputNumber
                                                                        style={{ width: '100%' }}
                                                                        min={0}
                                                                        max={100}
                                                                        value={overrideAbsValue ?? undefined}
                                                                        onChange={v => setOverrideAbsValue(v == null ? null : Number(v))}
                                                                        placeholder="e.g. 60"
                                                                    />
                                                                </Form.Item>
                                                            ) : null}
                                                        </Col>

                                                        <Col xs={24} md={12}>
                                                            {canExtendNumericTarget(primary, metricCfg) ? (
                                                                <>
                                                                    <Form.Item label="Extend target">
                                                                        <Space>
                                                                            <Switch checked={extendOpen} onChange={setExtendOpen} />
                                                                            <Text type="secondary">Use for scope growth</Text>
                                                                        </Space>
                                                                    </Form.Item>

                                                                    {extendOpen ? (
                                                                        <Form.Item>
                                                                            <Space wrap>
                                                                                <InputNumber
                                                                                    min={1}
                                                                                    value={extendBy ?? undefined}
                                                                                    onChange={v => setExtendBy(v == null ? null : Number(v))}
                                                                                    placeholder="Extend by"
                                                                                    style={{ width: 160 }}
                                                                                    precision={0}
                                                                                />
                                                                                <Button
                                                                                    icon={<PlusOutlined />}
                                                                                    shape="round"
                                                                                    onClick={handleExtendTarget}
                                                                                    disabled={!extendBy || Number(extendBy) <= 0}
                                                                                >
                                                                                    Apply extension
                                                                                </Button>
                                                                            </Space>
                                                                        </Form.Item>
                                                                    ) : null}
                                                                </>
                                                            ) : (
                                                                <Tag color="default">Target extension disabled for this metric</Tag>
                                                            )}
                                                        </Col>
                                                    </Row>
                                                </>
                                            )}
                                        </>
                                    ) : null}

                                    {targetMode === 'percentage' ? (
                                        <Form.Item
                                            label={
                                                <Space size={8}>
                                                    <RiseOutlined />
                                                    <span>Progress % (absolute)</span>
                                                </Space>
                                            }
                                            help={
                                                progressAbs != null ? (
                                                    <Text type="secondary">
                                                        After this update: <Text strong>{clamp(progressAbs)}%</Text>
                                                    </Text>
                                                ) : null
                                            }
                                        >
                                            <InputNumber
                                                style={{ width: '100%' }}
                                                min={0}
                                                max={100}
                                                value={progressAbs ?? undefined}
                                                onChange={v => setProgressAbs(v == null ? null : Number(v))}
                                                placeholder="e.g. 45"
                                            />
                                        </Form.Item>
                                    ) : null}

                                    <Divider style={{ margin: '10px 0' }} />

                                    <Form.Item label={inGroup ? 'Shared Notes / Results' : 'Progress Notes / Results'}>
                                        <TextArea
                                            rows={4}
                                            placeholder="Add notes or results here..."
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                        />
                                    </Form.Item>

                                    <Form.Item>
                                        <Space wrap>
                                            <Button
                                                type="primary"
                                                icon={<SaveOutlined />}
                                                shape="round"
                                                variant="filled"
                                                style={{ ...btnBorderStyle(canSubmit), borderRadius: 999 }}
                                                onClick={handleUpdateProgress}
                                                disabled={!canSubmit}
                                            >
                                                Update progress
                                            </Button>

                                            {nextPreview ? (
                                                <Tag color={nextPreview.afterPct >= 100 ? 'green' : 'gold'}>
                                                    Next: {nextPreview.afterPct}%
                                                </Tag>
                                            ) : null}
                                        </Space>
                                    </Form.Item>
                                </MotionCard>
                            </Col>

                            <Col xs={24} lg={8}>
                                <ProgressMotivationCard
                                    currentProgress={totalProgress}
                                    nextProgress={nextPreview?.afterPct ?? null}
                                    targetMode={targetMode}
                                    targetMetric={primary?.targetMetric}
                                />
                            </Col>
                        </Row>
                    </Form>
                </Card>
            </div>
        </>
    )
}

export default InterventionTracker
