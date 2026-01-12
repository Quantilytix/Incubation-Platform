import React, { useEffect, useMemo, useState } from 'react'
import {
    Table,
    Button,
    Modal,
    Typography,
    Tag,
    List,
    Card,
    Space,
    message,
    Progress,
    Row,
    Col,
    Statistic,
    Form,
    Input,
    Upload,
    Segmented,
    Tooltip
} from 'antd'
import {
    CheckOutlined,
    FileTextOutlined,
    LinkOutlined,
    PictureOutlined,
    UploadOutlined,
    CheckCircleOutlined,
    PaperClipOutlined,
    AppstoreAddOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons'
import { auth, db, storage } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
    writeBatch,
    onSnapshot,
    increment,
    Timestamp,
    doc,
    query,
    where,
    collection,
    getDocs,
    getDoc,
    addDoc,
    updateDoc
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'

const { Title, Paragraph, Text } = Typography

/** ───────────────────────── Types ───────────────────────── */
type Resource = {
    type: 'document' | 'link' | 'image' | string
    label: string
    link: string
}

interface AssignedIntervention {
    id: string
    participantId: string
    consultantId: string
    beneficiaryName: string
    interventionTitle: string
    description?: string
    timeSpent?: number
    progress?: number
    status: string
    dueDate?: string
    userStatus?: string
    consultantStatus?: 'pending' | 'accepted' | 'declined'
    consultantAcceptanceStatus?: 'pending' | 'accepted' | 'declined'
    countedForConsultant?: boolean
    resources?: Resource[]
    groupId?: string
    groupTitle?: string

    companyCode?: string
    operationsAssigneeId?: string
    operationsReviewerIds?: string[]
    operationsAssigneeEmail?: string
    consultantCompletionStatus?: 'done' | 'pending'
    operationsStatus?: 'pending' | 'in-review' | 'approved' | 'queried'
    operationsNotes?: string
    operationsQueryReason?: string

    overdueReason?: string
    overdueReasonBy?: string
    overdueReasonAt?: any

}

type GroupRow = {
    groupKey: string
    groupTitle: string
    beneficiaryName: string
    items: AssignedIntervention[]
    totalTime: number
    avgProgress: number
    rolledStatus: 'assigned' | 'in-progress' | 'completed' | 'declined' | 'mixed'
    dueLabel: string
    isOverdue: boolean
    overdueCount: number
    hasOverdueReason: boolean

}

type HistoryRow = {
    dbDocId: string // interventionsDatabase doc id (important!)
    interventionId?: string // your interventionId field stored in interventionsDatabase
    consultantId?: string
    participantId?: string
    beneficiaryName?: string
    interventionTitle?: string
    areaOfSupport?: string
    consultantNotes?: string
    resources?: Resource[]
    updatedAt?: any
}

/** ───────────────────────── Utils ───────────────────────── */
const chunkIds = (arr: string[], size: number): string[][] => {
    if (size <= 0) return [arr]
    const out: string[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

const toDate = (v: any): Date | null => {
    if (!v) return null
    if (typeof v === 'object' && v?.seconds && typeof v.seconds === 'number') {
        return new Date(v.seconds * 1000)
    }
    if (v instanceof Date) return v
    const d = new Date(v)
    return isNaN(+d) ? null : d
}

const fmt = (d: Date | null, f = 'DD MMM YYYY'): string => (d ? dayjs(d).format(f) : '—')

/** ───────────────────────── Component ───────────────────────── */
const AssignedInterventions: React.FC = () => {
    const navigate = useNavigate()
    const { user } = useFullIdentity()
    const currentRole = (user?.role || '').toLowerCase()
    const isOperations = currentRole === 'operations'

    const [view, setView] = useState<'ongoing' | 'history'>('ongoing')

    /** shared identity */
    const [consultantId, setConsultantId] = useState<string | null>(null)

    /** ongoing */
    const [loading, setLoading] = useState(true)
    const [working, setWorking] = useState(false)
    const [workingText, setWorkingText] = useState('Working...')
    const [selected, setSelected] = useState<AssignedIntervention | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)

    const [assignedInterventions, setAssignedInterventions] = useState<AssignedIntervention[]>([])
    const [completedInterventions, setCompletedInterventions] = useState<AssignedIntervention[]>([])
    const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([])

    /** decline */
    const [declineModalOpen, setDeclineModalOpen] = useState(false)
    const [declineReason, setDeclineReason] = useState('')
    const [declineTargetId, setDeclineTargetId] = useState<string | null>(null)

    /** ops query */
    const [opsQueryOpen, setOpsQueryOpen] = useState(false)
    const [opsQueryReason, setOpsQueryReason] = useState('')
    const [opsTargetId, setOpsTargetId] = useState<string | null>(null)

    /** history */
    const [historyLoading, setHistoryLoading] = useState(true)
    const [historyRows, setHistoryRows] = useState<HistoryRow[]>([])
    const [historySelected, setHistorySelected] = useState<HistoryRow | null>(null)
    const [historyModalOpen, setHistoryModalOpen] = useState(false)
    const [historyUploading, setHistoryUploading] = useState(false)
    const [historyForm] = Form.useForm()

    // Overdue Reason
    const [overdueOpen, setOverdueOpen] = useState(false)
    const [overdueReason, setOverdueReason] = useState('')
    const [overdueTargetGroupId, setOverdueTargetGroupId] = useState<string | null>(null)
    const openOverdueReason = (row: GroupRow) => {
        setOverdueTargetGroupId(row.groupKey)
        const existing = row.items.find(i => (i.overdueReason || '').trim())?.overdueReason || ''
        setOverdueReason(existing)
        setOverdueOpen(true)
    }





    /** ───────────────── Resolve consultantId (once) ───────────────── */
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async u => {
            try {
                if (!u?.email) {
                    setConsultantId(null)
                    return
                }
                const snap = await getDocs(query(collection(db, 'consultants'), where('email', '==', u.email)))
                if (snap.empty) {
                    setConsultantId(null)
                    return
                }
                setConsultantId(snap.docs[0].id)
            } catch (e) {
                console.error(e)
                setConsultantId(null)
            }
        })
        return () => unsub()
    }, [])

    /** ───────────────── Count accepted (consultant flow only) ───────────────── */
    useEffect(() => {
        if (!consultantId || isOperations) return

        const qy = query(
            collection(db, 'assignedInterventions'),
            where('consultantId', '==', consultantId),
            where('userStatus', '==', 'accepted')
        )

        const unsub = onSnapshot(qy, async snap => {
            const newlyAccepted = snap.docs.filter(d => !(d.data() as any).countedForConsultant)
            if (newlyAccepted.length === 0) return

            try {
                const batch = writeBatch(db)
                newlyAccepted.forEach(d => {
                    batch.update(doc(db, 'assignedInterventions', d.id), {
                        countedForConsultant: true,
                        countedAt: Timestamp.now()
                    })
                })
                batch.update(doc(db, 'consultants', consultantId), {
                    assignmentCount: increment(newlyAccepted.length)
                })
                await batch.commit()
            } catch (e) {
                console.error('Failed to increment assignmentCount:', e)
            }
        })

        return () => unsub()
    }, [consultantId, isOperations])

    /** ───────────────── Load Assigned (role-aware, strictly mine) ───────────────── */
    useEffect(() => {
        const run = async () => {
            setLoading(true)
            try {
                const col = collection(db, 'assignedInterventions')

                const consultantFilters = [where('status', 'in', ['assigned', 'in-progress'])] as const
                const opsFilters = [where('status', 'in', ['pending', 'in-review'])] as const

                let results: AssignedIntervention[] = []

                if (isOperations) {
                    const uid = user?.uid || ''
                    const email = (user?.email || '').toLowerCase()

                    const queries: any[] = []
                    if (uid) {
                        queries.push(query(col, where('operationsAssigneeId', '==', uid), ...opsFilters))
                        queries.push(query(col, where('operationsReviewerIds', 'array-contains', uid), ...opsFilters))
                    }
                    if (email) {
                        queries.push(query(col, where('operationsAssigneeEmail', '==', email), ...opsFilters))
                    }

                    if (!queries.length) {
                        setAssignedInterventions([])
                        return
                    }

                    const snaps = await Promise.all(queries.map(qy => getDocs(qy)))
                    const seen = new Set<string>()
                    snaps.forEach(s => {
                        s.docs.forEach(d => {
                            if (!seen.has(d.id)) {
                                seen.add(d.id)
                                results.push({ id: d.id, ...(d.data() as any) } as AssignedIntervention)
                            }
                        })
                    })
                } else {
                    if (!consultantId) {
                        setAssignedInterventions([])
                        return
                    }
                    const qy = query(col, where('consultantId', '==', consultantId), ...consultantFilters)
                    const s = await getDocs(qy)
                    results = s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as AssignedIntervention[]
                }

                setAssignedInterventions(results)
            } catch (e) {
                console.error(e)
                message.error('Failed to load interventions.')
            } finally {
                setLoading(false)
            }
        }

        run()
    }, [consultantId, isOperations, user?.uid, user?.email])

    /** ───────────────── Group builder ───────────────── */
    const groups: GroupRow[] = useMemo(() => {
        if (!assignedInterventions.length) return []

        const byKey = new Map<string, AssignedIntervention[]>()
        for (const it of assignedInterventions) {
            const key = it.groupId || it.id
            const arr = byKey.get(key) || []
            arr.push(it)
            byKey.set(key, arr)
        }

        const rows: GroupRow[] = []
        for (const [groupKey, items] of byKey) {
            const totalTime = items.reduce((s, i) => s + (i.timeSpent || 0), 0)
            const avgProgress = items.reduce((s, i) => s + (i.progress ?? 0), 0) / items.length

            const beneSet = new Set(items.map(i => i.beneficiaryName).filter(Boolean))
            const beneficiaryName = beneSet.size === 1 ? items[0].beneficiaryName : 'Multiple'

            let groupTitle = items[0].groupTitle || ''
            const titleSet = new Set(items.map(i => i.interventionTitle).filter(Boolean))

            if (!groupTitle) {
                if (titleSet.size === 1) groupTitle = Array.from(titleSet)[0] as string
                else groupTitle = `Shared: ${Array.from(titleSet).slice(0, 2).join(', ')}${titleSet.size > 2 ? '…' : ''}`
            }

            const statuses = new Set(items.map(i => i.status))
            const rolledStatus =
                statuses.size === 1 ? (Array.from(statuses)[0] as GroupRow['rolledStatus']) : 'mixed'

            const dueDates = items.map(i => toDate(i.dueDate)).filter(Boolean) as Date[]
            dueDates.sort((a, b) => +a - +b)

            let dueLabel = '—'
            let isOverdue = false
            let overdueCount = 0

            if (dueDates.length) {
                const start = dayjs(dueDates[0])
                const end = dayjs(dueDates[dueDates.length - 1])

                dueLabel = start.isSame(end, 'day')
                    ? start.format('DD MMM YYYY')
                    : `${start.format('DD MMM YYYY')} – ${end.format('DD MMM YYYY')}`

                // overdue logic: any item past due AND not completed/declined
                const now = dayjs()
                const overdueItems = items.filter(i => {
                    const d = toDate(i.dueDate)
                    if (!d) return false
                    const s = (i.status || '').toLowerCase()
                    const terminal = s === 'completed' || s === 'declined'
                    return !terminal && dayjs(d).isBefore(now, 'day')
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
                avgProgress: Number.isFinite(avgProgress) ? Math.round(avgProgress) : 0,
                rolledStatus,
                dueLabel,
                isOverdue,
                overdueCount,
                hasOverdueReason
            })

        }

        const order: Record<string, number> = { 'in-progress': 0, assigned: 1, mixed: 2, completed: 3, declined: 4 }
        return rows.sort(
            (a, b) =>
                (order[a.rolledStatus] ?? 9) - (order[b.rolledStatus] ?? 9) ||
                a.beneficiaryName.localeCompare(b.beneficiaryName)
        )
    }, [assignedInterventions])

    /** auto-select first group participants (so completed table works immediately) */
    useEffect(() => {
        if (groups.length && selectedParticipantIds.length === 0) {
            const ids = Array.from(new Set(groups[0].items.map(i => i.participantId).filter(Boolean)))
            setSelectedParticipantIds(ids)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups.length])

    /** ───────────────── Fetch "Completed" for current selection ───────────────── */
    useEffect(() => {
        const fetchCompleted = async () => {
            if (!selectedParticipantIds.length) {
                setCompletedInterventions([])
                return
            }
            try {
                const ids = Array.from(new Set(selectedParticipantIds))
                const idChunks = chunkIds(ids, 10)

                const snapshots = await Promise.all(
                    idChunks.map(ids =>
                        getDocs(
                            query(
                                collection(db, 'assignedInterventions'),
                                where('participantId', 'in', ids),
                                where('status', '==', 'completed')
                            )
                        )
                    )
                )

                const allDocs = snapshots.flatMap(s => s.docs)
                const data = await Promise.all(
                    allDocs.map(async docSnap => {
                        const intervention = docSnap.data() as AssignedIntervention

                        let consultantName = 'Unknown Consultant'
                        try {
                            if (intervention.consultantId) {
                                const cSnap = await getDoc(doc(db, 'consultants', intervention.consultantId))
                                if (cSnap.exists()) consultantName = (cSnap.data() as any)?.name || consultantName
                            }
                        } catch { }

                        return { id: docSnap.id, ...intervention, consultantName } as any
                    })
                )

                setCompletedInterventions(data as any)
            } catch (e) {
                console.error(e)
            }
        }

        fetchCompleted()
    }, [selectedParticipantIds])

    /** ───────────────── Role-aware navigate ───────────────── */
    const openUpdateGroup = (row: GroupRow) => {
        const firstId = row.items[0]?.id
        if (!firstId) return message.error('Could not resolve group entry.')
        navigate(isOperations ? `/operations/intervention/${firstId}` : `/consultant/allocated/intervention/${firstId}`)
    }

    /** ───────────────── Helpers ───────────────── */
    const getIcon = (type: string) => {
        switch (type) {
            case 'document':
                return <FileTextOutlined />
            case 'link':
                return <LinkOutlined />
            case 'image':
                return <PictureOutlined />
            default:
                return null
        }
    }

    const getConsultantStatus = (i: any): 'pending' | 'accepted' | 'declined' | undefined =>
        i.consultantAcceptanceStatus ?? i.consultantStatus

    /** ───────────────── Consultant actions ───────────────── */
    const acceptBatch = async (anyIdInGroup: string) => {
        setWorking(true)
        setWorkingText('Accepting intervention(s)...')
        try {
            const clickedRef = doc(db, 'assignedInterventions', anyIdInGroup)
            const clickedSnap = await getDoc(clickedRef)
            if (!clickedSnap.exists()) return message.error('Intervention not found.')

            const base = clickedSnap.data() as AssignedIntervention
            const now = Timestamp.now()

            let targets: Array<{ id: string; data: AssignedIntervention }> = [{ id: anyIdInGroup, data: base }]

            if (base.groupId) {
                const grpSnap = await getDocs(
                    query(
                        collection(db, 'assignedInterventions'),
                        where('groupId', '==', base.groupId),
                        where('consultantId', '==', base.consultantId)
                    )
                )
                targets = grpSnap.docs
                    .map(d => ({ id: d.id, data: d.data() as AssignedIntervention }))
                    .filter(t => (getConsultantStatus(t.data) ?? 'pending') === 'pending')
            }

            targets = targets.filter(t => (getConsultantStatus(t.data) ?? 'pending') === 'pending')
            if (!targets.length) return message.info('Nothing pending in this group to accept.')

            const batch = writeBatch(db)
            for (const t of targets) {
                const ref = doc(db, 'assignedInterventions', t.id)
                const next: Partial<AssignedIntervention> = { consultantStatus: 'accepted' }
                if (t.data.userStatus === 'accepted') next.status = 'in-progress'
                batch.update(ref, { ...next, updatedAt: now } as any)
            }
            await batch.commit()

            await Promise.all(
                targets.map(t =>
                    addDoc(collection(db, 'notifications'), {
                        participantId: t.data.participantId,
                        participantName: t.data.beneficiaryName,
                        interventionId: t.id,
                        interventionTitle: t.data.interventionTitle,
                        type: 'consultant-accepted',
                        recipientRoles: ['admin', 'participant'],
                        createdAt: new Date(),
                        readBy: {},
                        message: {
                            admin: `Consultant accepted: ${t.data.interventionTitle}`,
                            participant: `Your intervention "${t.data.interventionTitle}" was accepted.`
                        }
                    })
                )
            )

            message.success(base.groupId ? `Accepted ${targets.length} intervention(s) in this group` : 'Intervention accepted!')
            setAssignedInterventions(prev => prev.filter(item => !targets.some(t => t.id === item.id)))
        } catch (e) {
            console.error(e)
            message.error('Failed to accept intervention(s).')
        } finally {
            setWorking(false)
            setWorkingText('Working...')
        }
    }

    const openDeclineForGroup = (anyIdInGroup: string) => {
        setDeclineTargetId(anyIdInGroup)
        setDeclineModalOpen(true)
    }

    const confirmDeclineGroup = async () => {
        if (!declineTargetId) return
        if (!declineReason.trim()) return message.warning('Please provide a reason.')

        setWorking(true)
        setWorkingText('Declining intervention(s)...')
        try {
            const ref0 = doc(db, 'assignedInterventions', declineTargetId)
            const snap0 = await getDoc(ref0)
            if (!snap0.exists()) return message.error('Intervention not found.')

            const base = snap0.data() as AssignedIntervention

            let targets: Array<{ id: string; data: AssignedIntervention }> = [{ id: declineTargetId, data: base }]
            if (base.groupId) {
                const grpSnap = await getDocs(
                    query(
                        collection(db, 'assignedInterventions'),
                        where('groupId', '==', base.groupId),
                        where('consultantId', '==', base.consultantId)
                    )
                )
                targets = grpSnap.docs.map(d => ({ id: d.id, data: d.data() as AssignedIntervention }))
            }

            await Promise.all(
                targets.map(async t => {
                    await updateDoc(doc(db, 'assignedInterventions', t.id), {
                        consultantStatus: 'declined',
                        status: 'declined',
                        declineReason: declineReason.trim(),
                        updatedAt: Timestamp.now()
                    })
                    await addDoc(collection(db, 'notifications'), {
                        participantId: t.data.participantId,
                        participantName: t.data.beneficiaryName,
                        interventionId: t.id,
                        interventionTitle: t.data.interventionTitle,
                        type: 'consultant-declined',
                        recipientRoles: ['admin', 'participant'],
                        createdAt: new Date(),
                        readBy: {},
                        message: {
                            admin: `Consultant declined: ${t.data.interventionTitle}`,
                            participant: `Your intervention "${t.data.interventionTitle}" was declined.`
                        }
                    })
                })
            )

            message.success(base.groupId ? `Declined ${targets.length} intervention(s) in this group` : 'Intervention declined.')
            setAssignedInterventions(prev => prev.filter(item => !targets.some(t => t.id === item.id)))
            setDeclineReason('')
            setDeclineTargetId(null)
            setDeclineModalOpen(false)
        } catch (e) {
            console.error(e)
            message.error('Failed to decline intervention(s).')
        } finally {
            setWorking(false)
            setWorkingText('Working...')
        }
    }

    const saveOverdueReason = async (row: GroupRow) => {
        const reason = overdueReason.trim()
        if (!reason) return message.warning('Please enter a reason.')

        setWorking(true)
        setWorkingText('Saving overdue reason...')
        try {
            const now = Timestamp.now()
            const uid = user?.uid || ''
            const email = user?.email || ''

            const targets = row.items.map(i => i.id)

            const batch = writeBatch(db)
            targets.forEach(id => {
                batch.update(doc(db, 'assignedInterventions', id), {
                    overdueReason: reason,
                    overdueReasonBy: uid || email,
                    overdueReasonAt: now,
                    updatedAt: now
                } as any)
            })
            await batch.commit()

            message.success('Overdue reason saved.')
            setOverdueOpen(false)

            // update local state so UI updates instantly
            setAssignedInterventions(prev =>
                prev.map(it => (targets.includes(it.id) ? { ...it, overdueReason: reason, overdueReasonAt: now } : it))
            )
        } catch (e) {
            console.error(e)
            message.error('Failed to save overdue reason.')
        } finally {
            setWorking(false)
            setWorkingText('Working...')
        }
    }


    /** ───────────────── Operations actions ───────────────── */
    const approveOpsGroup = async (anyIdInGroup: string) => {
        setWorking(true)
        setWorkingText('Approving intervention(s)...')
        try {
            const baseRef = doc(db, 'assignedInterventions', anyIdInGroup)
            const baseSnap = await getDoc(baseRef)
            if (!baseSnap.exists()) return message.error('Intervention not found.')
            const base = baseSnap.data() as AssignedIntervention

            let targets: Array<{ id: string; data: AssignedIntervention }> = [{ id: anyIdInGroup, data: base }]
            if (base.groupId) {
                const grpSnap = await getDocs(query(collection(db, 'assignedInterventions'), where('groupId', '==', base.groupId)))
                targets = grpSnap.docs.map(d => ({ id: d.id, data: d.data() as AssignedIntervention }))
            }

            const now = Timestamp.now()
            await Promise.all(
                targets.map(async t => {
                    await updateDoc(doc(db, 'assignedInterventions', t.id), {
                        operationsStatus: 'approved',
                        status: 'completed',
                        updatedAt: now
                    })
                    await addDoc(collection(db, 'notifications'), {
                        type: 'ops-approved',
                        interventionId: t.id,
                        participantId: t.data.participantId,
                        consultantId: t.data.consultantId,
                        interventionTitle: t.data.interventionTitle,
                        createdAt: new Date(),
                        readBy: {},
                        recipientRoles: ['consultant', 'incubatee', 'projectadmin'],
                        message: {
                            consultant: `Operations approved "${t.data.interventionTitle}".`,
                            incubatee: `Your intervention "${t.data.interventionTitle}" is approved.`,
                            projectadmin: `Ops approved: ${t.data.interventionTitle}.`
                        }
                    })
                })
            )

            message.success(base.groupId ? `Approved ${targets.length} intervention(s)` : 'Intervention approved')
            setAssignedInterventions(prev => prev.filter(item => !targets.some(t => t.id === item.id)))
        } catch (e) {
            console.error(e)
            message.error('Failed to approve intervention(s).')
        } finally {
            setWorking(false)
            setWorkingText('Working...')
        }
    }

    const openOpsQuery = (anyIdInGroup: string) => {
        setOpsTargetId(anyIdInGroup)
        setOpsQueryOpen(true)
    }

    const confirmOpsQuery = async () => {
        if (!opsTargetId) return
        if (!opsQueryReason.trim()) return message.warning('Please describe what needs fixing.')

        setWorking(true)
        setWorkingText('Sending query...')
        try {
            const baseRef = doc(db, 'assignedInterventions', opsTargetId)
            const baseSnap = await getDoc(baseRef)
            if (!baseSnap.exists()) return message.error('Intervention not found.')
            const base = baseSnap.data() as AssignedIntervention

            let targets: Array<{ id: string; data: AssignedIntervention }> = [{ id: opsTargetId, data: base }]
            if (base.groupId) {
                const grpSnap = await getDocs(query(collection(db, 'assignedInterventions'), where('groupId', '==', base.groupId)))
                targets = grpSnap.docs.map(d => ({ id: d.id, data: d.data() as AssignedIntervention }))
            }

            const now = Timestamp.now()
            await Promise.all(
                targets.map(async t => {
                    await updateDoc(doc(db, 'assignedInterventions', t.id), {
                        operationsStatus: 'queried',
                        operationsQueryReason: opsQueryReason.trim(),
                        status: 'in-progress',
                        updatedAt: now
                    })
                    await addDoc(collection(db, 'notifications'), {
                        type: 'ops-queried',
                        interventionId: t.id,
                        participantId: t.data.participantId,
                        consultantId: t.data.consultantId,
                        interventionTitle: t.data.interventionTitle,
                        createdAt: new Date(),
                        readBy: {},
                        recipientRoles: ['consultant', 'projectadmin'],
                        message: {
                            consultant: `Ops queried "${t.data.interventionTitle}": ${opsQueryReason.trim()}`,
                            projectadmin: `Ops queried: ${t.data.interventionTitle}.`
                        }
                    })
                })
            )

            message.success(base.groupId ? `Queried ${targets.length} intervention(s)` : 'Query sent to consultant')
            setOpsQueryOpen(false)
            setOpsQueryReason('')
            setOpsTargetId(null)
        } catch (e) {
            console.error(e)
            message.error('Failed to send query.')
        } finally {
            setWorking(false)
            setWorkingText('Working...')
        }
    }

    /** ───────────────── Details modal ───────────────── */
    const openDetails = (record: AssignedIntervention) => {
        setSelected(record)
        setSelectedParticipantIds(record.participantId ? [record.participantId] : [])
        setDetailsOpen(true)
    }

    /** ───────────────── Ongoing Columns ───────────────── */
    const columns = [
        {
            title: isOperations ? 'Beneficiary / Queue' : 'Beneficiary',
            dataIndex: 'beneficiaryName'
        },
        {
            title: 'Intervention Title',
            dataIndex: 'groupTitle',
            render: (t: string, r: GroupRow) => (
                <span>
                    {t}{' '}
                    {r.items.length > 1 && (
                        <Tag color='purple' style={{ marginLeft: 8 }}>
                            {r.items.length} incubatees
                        </Tag>
                    )}
                    {isOperations && r.items.some(i => i.consultantCompletionStatus === 'done') && (
                        <Tag color='geekblue' style={{ marginLeft: 8 }}>
                            Submitted
                        </Tag>
                    )}
                </span>
            )
        },
        { title: 'Total Time (hrs)', dataIndex: 'totalTime' },
        {
            title: 'Avg Progress',
            dataIndex: 'avgProgress',
            render: (v: number) => <Progress percent={v || 0} size='small' />
        },
        {
            title: 'Status',
            dataIndex: 'rolledStatus',
            render: (status: GroupRow['rolledStatus']) => {
                const map: Record<string, string> = {
                    assigned: 'gold',
                    'in-progress': 'blue',
                    completed: 'green',
                    declined: 'red',
                    mixed: 'geekblue'
                }
                return <Tag color={map[status] || 'default'}>{status}</Tag>
            }
        },
        {
            title: 'Due',
            dataIndex: 'dueLabel',
            render: (_: any, row: GroupRow) => {
                if (!row.isOverdue) return row.dueLabel

                return (
                    <Space size={6}>
                        <Tag color="red">
                            {row.dueLabel} • Overdue{row.overdueCount > 1 ? ` (${row.overdueCount})` : ''}
                        </Tag>
                        {row.hasOverdueReason && <Tag color="volcano">Reason added</Tag>}
                    </Space>
                )
            }
        }
        ,
        {
            title: 'Action',
            render: (_: any, row: GroupRow) => {
                const hasPending =
                    !isOperations && row.items.some(i => (getConsultantStatus(i) ?? 'pending') === 'pending')

                return (
                    <Space>
                        {!isOperations && hasPending && (
                            <>
                                <Button type='link' onClick={() => acceptBatch(row.items[0]?.id)} style={{ color: 'green' }}>
                                    Accept {row.items.length > 1 ? 'Group' : ''}
                                </Button>
                                <Button type='link' onClick={() => openDeclineForGroup(row.items[0]?.id)} style={{ color: 'red' }}>
                                    Decline {row.items.length > 1 ? 'Group' : ''}
                                </Button>
                            </>
                        )}

                        {isOperations && (
                            <>
                                <Button type='link' onClick={() => approveOpsGroup(row.items[0]?.id)}>
                                    Approve {row.items.length > 1 ? 'Group' : ''}
                                </Button>
                                <Button type='link' danger onClick={() => openOpsQuery(row.items[0]?.id)}>
                                    Query {row.items.length > 1 ? 'Group' : ''}
                                </Button>
                            </>
                        )}

                        {row.isOverdue && (
                            <Button type="link" danger onClick={() => openOverdueReason(row)}>
                                {row.hasOverdueReason ? 'View / Edit Overdue Reason' : 'Add Overdue Reason'}
                            </Button>
                        )}

                        <Button type='link' onClick={() => openUpdateGroup(row)}>
                            Update
                        </Button>
                    </Space>
                )
            }
        }
    ]

    const completedColumns = [
        { title: 'Intervention', dataIndex: 'interventionTitle' },
        {
            title: 'Consultant',
            dataIndex: 'consultantName',
            render: (name: string, record: any) => (
                <span>
                    {name}
                    {record.consultantId !== consultantId && !isOperations && (
                        <Tag color='red' style={{ marginLeft: 8 }}>
                            Other Consultant
                        </Tag>
                    )}
                </span>
            )
        },
        {
            title: 'Resources',
            key: 'resources',
            render: (_: any, record: AssignedIntervention) => (
                <div>
                    {(record.resources || []).map(res => (
                        <span key={res.link} style={{ marginRight: 10 }}>
                            {getIcon(res.type)}{' '}
                            <a href={res.link} target='_blank' rel='noopener noreferrer'>
                                {res.label}
                            </a>
                        </span>
                    ))}
                </div>
            )
        },
        {
            title: 'Action',
            key: 'action',
            render: (_: any, record: AssignedIntervention) => (
                <Space>
                    <Button type='link' onClick={() => openDetails(record)}>
                        View
                    </Button>
                    <Button
                        type='link'
                        onClick={() => {
                            const resources = record.resources || []
                            if (!resources.length) return message.warning('No resources')
                            resources.forEach(resource => {
                                const link = document.createElement('a')
                                link.href = resource.link
                                link.download = resource.label || 'resource'
                                document.body.appendChild(link)
                                link.click()
                                document.body.removeChild(link)
                            })
                        }}
                    >
                        Download All
                    </Button>
                </Space>
            )
        }
    ]

    /** ───────────────── History fetch (consultant only) ───────────────── */
    useEffect(() => {
        const run = async () => {
            // history tab is for consultants; if ops opens it, we just show empty
            if (!consultantId || isOperations) {
                setHistoryRows([])
                setHistoryLoading(false)
                return
            }

            setHistoryLoading(true)
            try {
                const snap = await getDocs(
                    query(collection(db, 'interventionsDatabase'), where('consultantId', '==', consultantId))
                )

                const interventionsData: HistoryRow[] = await Promise.all(
                    snap.docs.map(async d => {
                        const data = d.data() as any
                        const interventionId = data.interventionId
                        let area = data.areaOfSupport || 'Unknown'

                        // OPTIONAL: only if you actually have an `interventions` collection keyed by `id`
                        // if not, remove this block.
                        if (interventionId) {
                            try {
                                const intSnap = await getDocs(
                                    query(collection(db, 'interventions'), where('id', '==', interventionId))
                                )
                                if (!intSnap.empty) {
                                    const intDoc = intSnap.docs[0].data() as any
                                    area = intDoc.areaOfSupport || area
                                }
                            } catch (e) {
                                console.warn('Area lookup failed:', interventionId, e)
                            }
                        }

                        return {
                            dbDocId: d.id,
                            interventionId,
                            ...data,
                            areaOfSupport: area
                        } as HistoryRow
                    })
                )

                setHistoryRows(interventionsData)
            } catch (e) {
                console.error(e)
                message.error('Failed to load history.')
            } finally {
                setHistoryLoading(false)
            }
        }

        run()
    }, [consultantId, isOperations])

    /** ───────────────── History metrics ───────────────── */
    const totalCompleted = historyRows.length
    const withPOE = historyRows.filter(i => i.resources?.some(r => !!r.link)).length
    const topArea = useMemo(() => {
        const areaCount: Record<string, number> = {}
        historyRows.forEach(i => {
            const a = i.areaOfSupport || 'Unspecified'
            areaCount[a] = (areaCount[a] || 0) + 1
        })
        return Object.entries(areaCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'
    }, [historyRows])

    /** ───────────────── History actions ───────────────── */
    const openHistoryEdit = (row: HistoryRow) => {
        setHistorySelected(row)
        historyForm.setFieldsValue({
            notes: row.consultantNotes || '',
            poe: null
        })
        setHistoryModalOpen(true)
    }

    const removeHistoryResource = async (index: number) => {
        if (!historySelected) return
        const next = {
            ...historySelected,
            resources: (historySelected.resources || []).filter((_, i) => i !== index)
        }
        setHistorySelected(next)

        // persist immediately
        try {
            await updateDoc(doc(db, 'interventionsDatabase', historySelected.dbDocId), {
                resources: next.resources || [],
                updatedAt: new Date()
            })
            // update list cache
            setHistoryRows(prev => prev.map(r => (r.dbDocId === historySelected.dbDocId ? next : r)))
        } catch (e) {
            console.error(e)
            message.error('Failed to remove POE.')
        }
    }

    const handleHistorySubmit = async (values: any) => {
        if (!historySelected) return
        try {
            setHistoryUploading(true)

            let newResource: Resource | null = null

            if (values.poe?.file) {
                const file = values.poe.file.originFileObj as File
                const path = `poes/${Date.now()}_${file.name}`
                const fileRef = ref(storage, path)
                await uploadBytes(fileRef, file)
                const poeUrl = await getDownloadURL(fileRef)
                newResource = { type: 'document', label: file.name, link: poeUrl }
            }

            const nextResources = [
                ...(historySelected.resources || []),
                ...(newResource ? [newResource] : [])
            ]

            await updateDoc(doc(db, 'interventionsDatabase', historySelected.dbDocId), {
                consultantNotes: values.notes,
                updatedAt: new Date(),
                resources: nextResources
            })

            const nextRow = { ...historySelected, consultantNotes: values.notes, resources: nextResources }
            setHistoryRows(prev => prev.map(r => (r.dbDocId === historySelected.dbDocId ? nextRow : r)))

            message.success('Notes / POE updated!')
            setHistoryModalOpen(false)
        } catch (e) {
            console.error(e)
            message.error('Failed to update intervention.')
        } finally {
            setHistoryUploading(false)
        }
    }

    const historyColumns = [
        { title: 'Participant', dataIndex: 'beneficiaryName' },
        { title: 'Intervention', dataIndex: 'interventionTitle' },
        { title: 'Area', dataIndex: 'areaOfSupport' },
        {
            title: 'POE',
            render: (_: any, row: HistoryRow) =>
                row.resources?.some(r => r.link) ? (
                    <a href={(row.resources || [])[0]?.link} target='_blank' rel='noreferrer'>
                        View POE
                    </a>
                ) : (
                    <Tag color='orange'>Missing</Tag>
                )
        },
        {
            title: 'Actions',
            render: (_: any, row: HistoryRow) => (
                <Button type='link' onClick={() => openHistoryEdit(row)}>
                    Edit / Upload POE
                </Button>
            )
        }
    ]

    /** ───────────────── UI ───────────────── */
    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            <Helmet>
                <title>
                    {isOperations
                        ? 'Operations Review | Smart Incubation'
                        : view === 'ongoing'
                            ? 'Ongoing Interventions | Consultant Workspace'
                            : 'Allocated History | Consultant Workspace'}
                </title>
            </Helmet>


            <DashboardHeaderCard title={isOperations ? 'Operations Workbench' : 'Consultant Workbench'} subtitle={view === 'ongoing'
                ? isOperations
                    ? 'Review submissions, approve or query.'
                    : 'Accept / update your active interventions.'
                : 'Completed interventions + POE management.'}
                extraRight={<Segmented
                    value={view}
                    onChange={(v: any) => setView(v)}
                    options={[
                        { label: 'Ongoing', value: 'ongoing' },
                        { label: 'History', value: 'history', disabled: isOperations }
                    ]}
                />}
            />



            {working && (
                <Card style={{ marginBottom: 12, border: '1px solid #ffe58f', background: '#fffbe6' }}>
                    <Space>
                        <ExclamationCircleOutlined />
                        <Text>{workingText}</Text>
                    </Space>
                </Card>
            )}

            {view === 'ongoing' && (
                <>
                    <MotionCard title={isOperations ? 'Review Queue' : 'Ongoing Interventions'}>
                        <Table
                            loading={loading}
                            dataSource={groups}
                            columns={columns as any}
                            rowKey='groupKey'
                            onRow={row => ({
                                onClick: () => {
                                    const ids = Array.from(new Set(row.items.map(i => i.participantId).filter(Boolean)))
                                    setSelectedParticipantIds(ids)
                                }
                            })}
                            pagination={{ pageSize: 5 }}
                        />
                    </MotionCard>

                    <MotionCard
                        title={
                            selectedParticipantIds.length > 1
                                ? 'Completed Interventions for All'
                                : `Completed Interventions for ${assignedInterventions.find(i => i.participantId === selectedParticipantIds[0])?.beneficiaryName ||
                                'this SME'
                                }`
                        }
                        style={{ marginTop: 15 }}
                    >
                        <Table
                            dataSource={completedInterventions}
                            columns={completedColumns as any}
                            rowKey='id'
                            pagination={{ pageSize: 5 }}
                        />
                    </MotionCard>
                </>
            )}

            {view === 'history' && (
                <>
                    {!isOperations && (
                        <>
                            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                                <Col xs={24} sm={8}>
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                                        <Card hoverable>
                                            <Statistic title='Total Completed' value={totalCompleted} prefix={<CheckCircleOutlined />} />
                                        </Card>
                                    </motion.div>
                                </Col>
                                <Col xs={24} sm={8}>
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                                        <Card hoverable>
                                            <Statistic title='With POE' value={withPOE} prefix={<PaperClipOutlined />} />
                                        </Card>
                                    </motion.div>
                                </Col>
                                <Col xs={24} sm={8}>
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                                        <Card hoverable>
                                            <Statistic title='Most Common Area' value={topArea} prefix={<AppstoreAddOutlined />} />
                                        </Card>
                                    </motion.div>
                                </Col>
                            </Row>

                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                                <Card hoverable>
                                    <Table
                                        rowKey='dbDocId'
                                        columns={historyColumns as any}
                                        dataSource={historyRows}
                                        loading={historyLoading}
                                        pagination={{ pageSize: 10 }}
                                    />
                                </Card>
                            </motion.div>
                        </>
                    )}

                    {isOperations && (
                        <Card>
                            <Text type='secondary'>History is consultant-only.</Text>
                        </Card>
                    )}
                </>
            )}

            {/* Ongoing details modal */}
            <Modal open={detailsOpen} title='Intervention Details & Resources' onCancel={() => setDetailsOpen(false)} footer={null}>
                {selected && (
                    <>
                        <Title level={5}>{selected.interventionTitle}</Title>
                        <Paragraph>
                            <b>SME:</b> {selected.beneficiaryName}
                            <br />
                            <b>Time Spent:</b> {selected.timeSpent || 0} hours
                            <br />
                            <b>Status:</b> {selected.status}
                            {isOperations && selected.operationsStatus && (
                                <>
                                    <br />
                                    <b>Ops Status:</b> {selected.operationsStatus}
                                </>
                            )}
                        </Paragraph>

                        <Paragraph>
                            <b>Description:</b>
                            <br />
                            {selected.description || 'No description available'}
                        </Paragraph>

                        <Paragraph>
                            <b>Reference Material:</b>
                        </Paragraph>

                        <List
                            dataSource={selected.resources || []}
                            renderItem={item => (
                                <List.Item>
                                    {getIcon(item.type)}{' '}
                                    <a href={item.link} target='_blank' rel='noopener noreferrer'>
                                        {item.label}
                                    </a>
                                </List.Item>
                            )}
                        />
                    </>
                )}
            </Modal>

            {/* Consultant Decline modal */}
            <Modal
                title='Reason for Declining'
                open={declineModalOpen}
                onOk={confirmDeclineGroup}
                onCancel={() => setDeclineModalOpen(false)}
                okText='Confirm'
            >
                <Input.TextArea
                    rows={4}
                    value={declineReason}
                    onChange={e => setDeclineReason(e.target.value)}
                    placeholder='Please enter a reason...'
                />
            </Modal>

            {/* Operations Query modal */}
            <Modal
                title='Query the submission'
                open={opsQueryOpen}
                onOk={confirmOpsQuery}
                onCancel={() => setOpsQueryOpen(false)}
                okText='Send Query'
                okButtonProps={{ danger: true }}
            >
                <Input.TextArea
                    rows={4}
                    value={opsQueryReason}
                    onChange={e => setOpsQueryReason(e.target.value)}
                    placeholder='Explain what needs fixing or what evidence is missing...'
                />
            </Modal>

            {/* History Modal */}
            <Modal
                open={historyModalOpen}
                title='Update Notes & Manage POEs'
                onCancel={() => setHistoryModalOpen(false)}
                onOk={historyForm.submit}
                confirmLoading={historyUploading}
                okText='Save'
            >
                {historySelected && (
                    <>
                        <div style={{ marginBottom: 12 }}>
                            <Text strong>{historySelected.interventionTitle || 'Intervention'}</Text>
                            <br />
                            <Text type='secondary'>{historySelected.beneficiaryName || 'Participant'}</Text>
                        </div>

                        <Form form={historyForm} layout='vertical' onFinish={handleHistorySubmit}>
                            <Form.Item
                                name='notes'
                                label='Consultant Notes'
                                rules={[{ required: true, message: 'Please input notes' }]}
                            >
                                <Input.TextArea rows={4} />
                            </Form.Item>

                            {historySelected.resources?.length ? (
                                <div style={{ marginBottom: 16 }}>
                                    <Text strong>Current POEs:</Text>
                                    <ul style={{ paddingLeft: 16, marginTop: 8 }}>
                                        {historySelected.resources.map((res, idx) => (
                                            <li key={`${res.link}-${idx}`} style={{ marginBottom: 8 }}>
                                                <a href={res.link} target='_blank' rel='noreferrer'>
                                                    📎 {res.label}
                                                </a>
                                                <Tooltip title='Remove this POE'>
                                                    <Button
                                                        size='small'
                                                        danger
                                                        type='text'
                                                        onClick={() => removeHistoryResource(idx)}
                                                        style={{ marginLeft: 8 }}
                                                    >
                                                        Remove
                                                    </Button>
                                                </Tooltip>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <Tag color='orange' style={{ marginBottom: 12 }}>
                                    No POEs uploaded
                                </Tag>
                            )}

                            <Form.Item name='poe' label='Upload New POE (PDF or Image)'>
                                <Upload beforeUpload={() => false} maxCount={1}>
                                    <Button icon={<UploadOutlined />}>Select File</Button>
                                </Upload>
                            </Form.Item>
                        </Form>
                    </>
                )}
            </Modal>

            {/* Overdue Reason Modal */}
            <Modal
                title="Overdue reason"
                open={overdueOpen}
                onOk={() => {
                    const row = groups.find(g => g.groupKey === overdueTargetGroupId)
                    if (!row) return message.error('Could not resolve group.')
                    saveOverdueReason(row)
                }}
                onCancel={() => setOverdueOpen(false)}
                okText="Save"
            >
                <Input.TextArea
                    rows={4}
                    value={overdueReason}
                    onChange={e => setOverdueReason(e.target.value)}
                    placeholder="Explain why this is overdue (e.g., client unavailable, awaiting documents, rescheduled, etc.)"
                />
            </Modal>

        </div>
    )
}

export default AssignedInterventions
