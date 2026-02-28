import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    Card,
    Typography,
    Table,
    Space,
    Tag,
    Button,
    Modal,
    Form,
    Input,
    message,
    DatePicker,
    Select,
    Row,
    Col,
    Statistic,
    Progress,
    Drawer,
    Switch,
    Grid,
    Descriptions,
    Divider
} from 'antd'
import {
    CheckCircleOutlined,
    CalendarOutlined,
    CommentOutlined,
    EyeOutlined,
    ReloadOutlined,
    DatabaseOutlined,
    CloseCircleOutlined,
    CiCircleOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import {
    collection,
    getDoc,
    setDoc,
    doc,
    Timestamp,
    arrayUnion,
    getDocs,
    query,
    where,
    writeBatch,
    updateDoc
} from 'firebase/firestore'
import dayjs, { Dayjs } from 'dayjs'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { MotionCard } from '@/components/shared/Header'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'
import { useAssignedInterventions, type AssignedIntervention, type AssigneeType } from '@/contexts/AssignedInterventionsContext'

const { Text, Paragraph } = Typography

type InterventionType = 'singular' | 'grouped'

type AssigneeUser = { id: string; name: string; email?: string }

type ReassignForm = {
    assigneeId: string
    reason?: string
    keepStatus?: boolean
}

interface Participant {
    id: string
    beneficiaryName: string
    requiredInterventions: { id: string; title: string; area?: string }[]
    completedInterventions: { id: string; title: string }[]
    sector?: string
    stage?: string
    province?: string
    city?: string
    location?: string
    programName?: string
    email?: string
    gender?: string | null
}

type ManageRow =
    | (AssignedIntervention & { isUnassigned?: false })
    | {
        id: string
        interventionId: string
        interventionTitle: string
        assigneeName: string
        status: 'Unassigned'
        dueDate: null
        isUnassigned: true
        beneficiaryName: string
        sector?: string
        programName?: string
        areaOfSupport?: string
        participantId: string
    }

type NumberTargetMetric =
    | 'hours'
    | 'sessions'
    | 'workshops'
    | 'documents'
    | 'deliverables'
    | 'reports'
    | 'meetings'
    | 'calls'
    | 'site_visits'
    | 'training_modules'
    | 'templates'

const NUMBER_TARGET_METRICS: Array<{ value: NumberTargetMetric; label: string; allowExtend: boolean }> = [
    { value: 'hours', label: 'Hours', allowExtend: true },
    { value: 'sessions', label: 'Session(s)', allowExtend: false }, // do NOT extend sessions
    { value: 'workshops', label: 'Workshop(s)', allowExtend: false }, // treat like sessions (planned events)
    { value: 'documents', label: 'Document(s)', allowExtend: true },
    { value: 'deliverables', label: 'Deliverable(s)', allowExtend: true },
    { value: 'reports', label: 'Report(s)', allowExtend: true },
    { value: 'meetings', label: 'Meeting(s)', allowExtend: false },
    { value: 'calls', label: 'Call(s)', allowExtend: false },
    { value: 'site_visits', label: 'Site Visit(s)', allowExtend: false },
    { value: 'training_modules', label: 'Training Module(s)', allowExtend: true },
    { value: 'templates', label: 'Template(s)', allowExtend: true }
]

export const InterventionsAssignemnts: React.FC = () => {
    const { user } = useFullIdentity()
    const screens = Grid.useBreakpoint()
    const isMobile = !screens.md

    const { assignments: rawAssignments, loading: assignmentsLoading, refresh } = useAssignedInterventions()

    const [isRecurringSelected, setIsRecurringSelected] = useState(false)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [assignees, setAssignees] = useState<AssigneeUser[]>([])
    const [participantInterventionMap, setParticipantInterventionMap] = useState<Record<string, string[]>>({})

    const [assignmentModalVisible, setAssignmentModalVisible] = useState(false)
    const [assignmentForm] = Form.useForm()
    const [selectedType, setSelectedType] = useState<InterventionType>('singular')
    const [sharedInterventions, setSharedInterventions] = useState<any[]>([])
    const [lockedIntervention, setLockedIntervention] = useState<any>(null)
    const [assignmentParticipant, setAssignmentParticipant] = useState<Participant | null>(null)

    const [reassignOpen, setReassignOpen] = useState(false)
    const [reassignTarget, setReassignTarget] = useState<AssignedIntervention | null>(null)
    const [reassigning, setReassigning] = useState(false)
    const [reassignForm] = Form.useForm()

    const [manageModalVisible, setManageModalVisible] = useState(false)
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null)
    const [interventionFilter, setInterventionFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')

    const [viewOpen, setViewOpen] = useState(false)
    const [viewRecord, setViewRecord] = useState<AssignedIntervention | null>(null)

    const [searchText, setSearchText] = useState('')
    const [selectedGender, setSelectedGender] = useState<string>('all')
    const [selectedProgram, setSelectedProgram] = useState<string | undefined>()

    const loading = assignmentsLoading

    // ---------- helpers ----------
    const pretty = (v?: string | null) => {
        if (!v) return '—'
        return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }

    const norm = (s: any) =>
        String(s ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')

    const normMetricKey = (v: any): NumberTargetMetric | null => {
        const s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, '_')
        const hit = NUMBER_TARGET_METRICS.find(x => x.value === s)
        return hit ? hit.value : null
    }

    const prettyTargetMetric = (v?: string | null) => {
        if (!v) return '—'
        const key = normMetricKey(v)
        if (!key) {
            // fallback for legacy data
            return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        }
        return NUMBER_TARGET_METRICS.find(x => x.value === key)!.label
    }

    const reqId = (iv: any) => String(iv?.id ?? iv?.interventionId ?? '')
    const reqTitle = (iv: any) => String(iv?.title ?? iv?.interventionTitle ?? 'Untitled')
    const reqArea = (iv: any) => String(iv?.area ?? iv?.areaOfSupport ?? '')

    const resolveAssignee = (a: AssignedIntervention) => {
        const assigneeType = (a.assigneeType ?? 'assignee') as AssigneeType
        const id = (a as any).assigneeId || ''
        const name = (a as any).assigneeName || '—'
        const email = (a as any).assigneeEmail || ''
        return { assigneeType, id, name, email }
    }

    const getCompositeStatus = (a: AssignedIntervention) => {
        const { status, assigneeStatus, incubateeStatus, assigneeCompletionStatus, incubateeCompletionStatus } = a as any

        if (status === 'cancelled') return { label: 'Cancelled', color: 'red' }

        const done = status === 'completed' || (assigneeCompletionStatus === 'done' && incubateeCompletionStatus === 'confirmed')
        if (done) return { label: 'Completed', color: 'green' }

        if (assigneeStatus === 'declined' || incubateeStatus === 'declined') return { label: 'Declined', color: 'red' }
        if (incubateeCompletionStatus === 'rejected') return { label: 'Rejected', color: 'volcano' }

        if (assigneeCompletionStatus === 'done' && incubateeCompletionStatus === 'pending')
            return { label: 'Awaiting Confirmation', color: 'purple' }

        if (assigneeStatus === 'accepted' && incubateeStatus === 'accepted' && assigneeCompletionStatus !== 'done')
            return { label: 'In Progress', color: 'blue' }

        if (assigneeStatus === 'pending' || incubateeStatus === 'pending') return { label: 'Awaiting Acceptance', color: 'orange' }

        return { label: 'Assigned', color: 'gold' }
    }

    const calcProgress = (a: AssignedIntervention) => {
        const st = getCompositeStatus(a).label

        // always trust stored progress if present
        if (typeof (a as any).progress === 'number' && Number.isFinite((a as any).progress)) {
            return Math.max(0, Math.min(100, Math.round((a as any).progress)))
        }

        if (st === 'Completed') return 100
        if (st === 'Cancelled' || st === 'Declined' || st === 'Rejected') return 0

        if (st === 'In Progress') return 50
        if (st === 'Awaiting Confirmation') return 85
        if (st === 'Awaiting Acceptance') return 15
        return 0
    }

    const startReassign = (a: AssignedIntervention) => {
        setReassignTarget(a)
        setReassignOpen(true)
        reassignForm.resetFields()
    }

    const openAssignmentView = (a: AssignedIntervention) => {
        setViewRecord(a)
        setViewOpen(true)
    }

    // ---------- participants ----------
    useEffect(() => {
        const fetchAll = async () => {
            try {
                if (!user?.companyCode) return

                const [appsSnap, partsSnap] = await Promise.all([
                    getDocs(query(collection(db, 'applications'), where('companyCode', '==', user.companyCode))),
                    getDocs(query(collection(db, 'participants')))
                ])

                const partsMap = new Map(partsSnap.docs.map(d => [d.id, d.data()]))
                const apps = appsSnap.docs
                    .map(d => ({ id: d.id, ...(d.data() as any) }))
                    .filter(a => a.companyCode === user.companyCode && String(a.applicationStatus || '').toLowerCase() === 'accepted')

                const fetchedParticipants: Participant[] = apps.map(app => {
                    const pdata = (partsMap.get(app.participantId) as any) || {}
                    return {
                        id: app.participantId,
                        beneficiaryName: app.beneficiaryName || 'Unknown',
                        sector: pdata.sector || '—',
                        stage: app.stage || '—',
                        province: pdata.province || '—',
                        city: pdata.city || '—',
                        location: pdata.location || '—',
                        programName: app.programName,
                        requiredInterventions: app.interventions?.required || [],
                        completedInterventions: app.interventions?.completed || [],
                        email: pdata.email || app.email || '—',
                        gender: (app.gender ?? pdata.gender ?? null) ? String(app.gender ?? pdata.gender) : null
                    }
                })

                const pim: Record<string, string[]> = {}
                fetchedParticipants.forEach(p => {
                    pim[p.id] = (p.requiredInterventions || []).map(i => reqId(i)).filter(Boolean)
                })

                setParticipants(fetchedParticipants)
                setParticipantInterventionMap(pim)
            } catch (e) {
                console.error(e)
                message.error('Failed to load participants')
            }
        }

        fetchAll()
    }, [user?.companyCode])

    // ---------- assignees (single unified list) ----------
    useEffect(() => {
        if (!user?.companyCode) return

            ; (async () => {
                try {
                    const snap = await getDocs(query(collection(db, 'assignees'), where('companyCode', '==', user.companyCode)))

                    const fetched = snap.docs.map(d => {
                        const data = d.data() as any
                        return {
                            id: d.id,
                            name: data?.name || data?.fullName || data?.displayName || 'Assignee',
                            email: data?.email || undefined
                        } as AssigneeUser
                    })

                    const meId = `self:${user?.email || user?.name || 'me'}`
                    const me: AssigneeUser = { id: meId, name: user?.name || 'Me', email: user?.email }
                    const exists = !!me.email && fetched.some(a => a.email && a.email.toLowerCase() === me.email!.toLowerCase())

                    setAssignees(exists ? fetched : [me, ...fetched])
                } catch (e) {
                    console.error('Failed to load assignees', e)
                    setAssignees(user?.email ? [{ id: `self:${user.email}`, name: user.name || 'Me', email: user.email }] : [])
                }
            })()
    }, [user?.companyCode])

    const allAssignees = useMemo(() => assignees, [assignees])

    // ---------- enrich assignments (assignee + titles/areas) ----------
    const assignments = useMemo(() => {
        const pMap = new Map(participants.map(p => [p.id, p.beneficiaryName]))
        const byParticipant = new Map(participants.map(p => [p.id, p]))

        return rawAssignments.map(a => {
            const foundP = byParticipant.get(a.participantId)
            const fromP = foundP?.requiredInterventions.find(i => reqId(i) === a.interventionId)
            const ass = resolveAssignee(a)

            return {
                ...a,
                beneficiaryName: pMap.get(a.participantId) || (a as any).beneficiaryName || '—',
                interventionTitle: fromP?.title || (a as any).interventionTitle || 'Untitled',
                areaOfSupport: (a as any).areaOfSupport || fromP?.area || (a as any).areaOfSupport,
                assigneeType: ass.assigneeType,
                assigneeId: ass.id,
                assigneeName: ass.name,
                assigneeEmail: ass.email
            }
        })
    }, [rawAssignments, participants])

    // ---------- shared interventions (grouped) ----------
    const computeSharedInterventions = (ids: string[]) => {
        const selectedList = participants.filter(p => ids.includes(p.id))
        if (!selectedList.length) {
            setSharedInterventions([])
            return
        }
        const sets = selectedList.map(p => new Set((p.requiredInterventions || []).map(i => reqId(i))))
        const sharedIds = sets.reduce((acc, set) => new Set([...acc].filter(id => set.has(id))), sets[0])
        const intersection = [...sharedIds]
            .map(id => {
                const ex = selectedList.find(p => (p.requiredInterventions || []).some(i => reqId(i) === id))
                return ex?.requiredInterventions.find(i => reqId(i) === id)
            })
            .filter(Boolean) as any[]
        setSharedInterventions(intersection)
    }

    const interventionMetaCacheRef = useRef<Map<string, { isRecurring?: boolean; frequency?: string }>>(new Map())

    async function getInterventionMeta(interventionId: string) {
        if (!interventionId) return { isRecurring: false }
        const cache = interventionMetaCacheRef.current
        if (cache.has(interventionId)) return cache.get(interventionId)!
        try {
            const ref = doc(collection(db, 'interventions'), interventionId)
            const snap = await getDoc(ref)
            const data = (snap.exists() ? snap.data() : {}) as any
            const meta = { isRecurring: !!data?.isRecurring, frequency: data?.frequency || undefined }
            cache.set(interventionId, meta)
            return meta
        } catch {
            return { isRecurring: false }
        }
    }

    // ---------- filtering & metrics ----------
    const filteredParticipants = useMemo(() => {
        return participants.filter(p => {
            const okName = (p.beneficiaryName || '').toLowerCase().includes(searchText.toLowerCase())
            const okProgram = !selectedProgram || p.programName === selectedProgram
            const okGender = selectedGender === 'all' ? true : (p.gender || '').toLowerCase() === selectedGender.toLowerCase()
            return okName && okProgram && okGender
        })
    }, [participants, searchText, selectedProgram, selectedGender])

    const genderOptions = useMemo(() => {
        const vals = participants.map(p => (p.gender || '').trim()).filter(Boolean)
        return Array.from(new Set(vals)).sort()
    }, [participants])

    const participantIds = new Set(filteredParticipants.map(p => p.id))
    const visibleAssignments = assignments.filter(a => participantIds.has(a.participantId))

    const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)))

    const requiredIdsForVisible = useMemo(() => {
        const ids: string[] = []
        filteredParticipants.forEach(p => {
            const req = (participantInterventionMap[p.id] || []).map(x => String(x))
            ids.push(...req)
        })
        return uniq(ids)
    }, [filteredParticipants, participantInterventionMap])

    const assignedIdsForVisible = useMemo(() => {
        const requiredSet = new Set(requiredIdsForVisible.map(String))
        const ids = visibleAssignments.map(a => String(a.interventionId || '')).filter(id => requiredSet.has(id))
        return uniq(ids)
    }, [visibleAssignments, requiredIdsForVisible])

    const totalRequired = requiredIdsForVisible.length
    const totalAssigned = assignedIdsForVisible.length

    const totalCompleted = useMemo(() => {
        const requiredSet = new Set(requiredIdsForVisible.map(String))
        return visibleAssignments.filter(a => {
            const id = String(a.interventionId || '')
            if (!requiredSet.has(id)) return false
            return getCompositeStatus(a).label === 'Completed'
        }).length
    }, [visibleAssignments, requiredIdsForVisible])

    const completionRate = totalRequired ? Math.round((totalCompleted / totalRequired) * 100) : 0

    const progressMetrics = [
        {
            title: 'Assigned / Required',
            value: `${totalAssigned} / ${totalRequired}`,
            color: '#1890ff',
            icon: <CheckCircleOutlined />,
            bgColor: '#e6f7ff'
        },
        {
            title: 'Completed / Assigned',
            value: `${totalCompleted} / ${totalAssigned}`,
            color: '#52c41a',
            icon: <CalendarOutlined />,
            bgColor: '#f6ffed'
        },
        {
            title: 'Completion Rate',
            customRender: (
                <Progress percent={completionRate} strokeColor={completionRate > 75 ? '#52c41a' : completionRate > 40 ? '#faad14' : '#f5222d'} />
            ),
            color: '#faad14',
            icon: <CommentOutlined />,
            bgColor: '#fffbe6'
        }
    ]

    // ---------- Assignments page table ----------
    const getRateTag = (rate: number) => {
        if (rate <= 25) return <Tag color='red'>Critical</Tag>
        if (rate <= 60) return <Tag color='orange'>Low</Tag>
        if (rate <= 85) return <Tag color='gold'>Moderate</Tag>
        return <Tag color='green'>Good</Tag>
    }

    const columns = [
        { title: 'Beneficiary', dataIndex: 'beneficiaryName', key: 'beneficiaryName' },
        { title: 'Sector', dataIndex: 'sector', key: 'sector' },
        {
            title: 'Assignment Rate',
            key: 'assignmentRate',
            render: (_: any, r: Participant) => {
                const requiredIds = new Set((r.requiredInterventions || []).map(iv => String(iv?.id || iv?.interventionId || '').trim()).filter(Boolean))
                const required = requiredIds.size

                const assignedIds = new Set(
                    assignments
                        .filter(a => a.participantId === r.id && (a as any).status !== 'cancelled')
                        .map(a => String(a.interventionId || '').trim())
                        .filter(id => id && requiredIds.has(id))
                )
                const assigned = assignedIds.size
                const pct = required ? (assigned / required) * 100 : 0

                return (
                    <Space>
                        <Text>
                            {assigned} / {required}
                        </Text>
                        {getRateTag(pct)}
                    </Space>
                )
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, r: Participant) => (
                <Button
                    variant='filled'
                    shape='round'
                    color='geekblue'
                    icon={<DatabaseOutlined />}
                    onClick={() => {
                        setSelectedParticipant(r)
                        setManageModalVisible(true)
                        setInterventionFilter('all')
                    }}
                >
                    Manage
                </Button>
            )
        }
    ]

    const getFilteredInterventions = (): ManageRow[] => {
        if (!selectedParticipant) return []
        const requiredIds = participantInterventionMap[selectedParticipant.id] || []
        const assignedForP = assignments.filter(a => a.participantId === selectedParticipant.id)
        const assignedIds = new Set(assignedForP.map(a => a.interventionId))

        if (interventionFilter === 'assigned') return assignedForP

        if (interventionFilter === 'unassigned') {
            return requiredIds
                .filter(id => id && !assignedIds.has(id))
                .map(id => {
                    const intervention = selectedParticipant.requiredInterventions.find(i => reqId(i) === id)
                    return {
                        id,
                        interventionId: id,
                        interventionTitle: intervention?.title || 'Unknown',
                        assigneeName: 'Not Assigned',
                        status: 'Unassigned',
                        dueDate: null,
                        isUnassigned: true as const,
                        beneficiaryName: selectedParticipant.beneficiaryName,
                        sector: selectedParticipant.sector,
                        programName: selectedParticipant.programName,
                        areaOfSupport: intervention?.area || '—',
                        participantId: selectedParticipant.id
                    }
                })
        }

        const assignedMap = new Map(assignedForP.map(a => [a.interventionId, a]))
        return requiredIds
            .filter(Boolean)
            .map(id => {
                const a = assignedMap.get(id)
                if (a) return a
                const intervention = selectedParticipant.requiredInterventions.find(i => reqId(i) === id)
                return {
                    id,
                    interventionId: id,
                    interventionTitle: intervention?.title || 'Unknown',
                    assigneeName: 'Not Assigned',
                    status: 'Unassigned',
                    dueDate: null,
                    isUnassigned: true as const,
                    beneficiaryName: selectedParticipant.beneficiaryName,
                    sector: selectedParticipant.sector,
                    programName: selectedParticipant.programName,
                    areaOfSupport: intervention?.area || '—',
                    participantId: selectedParticipant.id
                }
            })
    }

    const handleQuickAssign = (row: ManageRow) => {
        if (!selectedParticipant) return
        if (!('isUnassigned' in row) || !row.isUnassigned) return

        setAssignmentParticipant(selectedParticipant)
        setLockedIntervention({ id: row.interventionId, title: row.interventionTitle })
        assignmentForm.setFieldsValue({
            type: 'singular',
            participant: selectedParticipant.id,
            intervention: row.interventionId
        })
        setSelectedType('singular')
        setAssignmentModalVisible(true)
    }

    // ---------- Reassign submit ----------
    const handleReassignSubmit = async (values: ReassignForm) => {
        if (!reassignTarget) return
        setReassigning(true)

        try {
            const now = Timestamp.now()

            const chosen = (() => {
                const a = allAssignees.find(x => x.id === values.assigneeId)
                return a ? { id: a.id, name: a.name, email: a.email || '' } : null
            })()

            if (!chosen) return message.error('Select an assignee')

            const isSelf = (chosen.email && user?.email && chosen.email.toLowerCase() === user.email.toLowerCase()) || chosen.id.startsWith('self:')
            const nextAssigneeStatus = isSelf ? 'accepted' : 'pending'
            const nextStatus = values.keepStatus ? (reassignTarget as any).status : (reassignTarget as any).status === 'completed' ? 'in-progress' : 'assigned'

            await updateDoc(doc(db, 'assignedInterventions', reassignTarget.id), {
                assigneeType: ((reassignTarget as any).assigneeType || 'assignee') as AssigneeType,
                assigneeId: chosen.id,
                assigneeName: chosen.name,
                assigneeEmail: chosen.email,

                assigneeStatus: nextAssigneeStatus,
                status: nextStatus,
                updatedAt: now,

                reassignmentHistory: arrayUnion({
                    at: now,
                    by: user?.email || user?.name || 'system',
                    reason: values.reason || null,
                    from: {
                        assigneeType: (reassignTarget as any).assigneeType || null,
                        assigneeId: (reassignTarget as any).assigneeId || null,
                        assigneeName: (reassignTarget as any).assigneeName || null
                    },
                    to: {
                        assigneeType: (reassignTarget as any).assigneeType || null,
                        assigneeId: chosen.id,
                        assigneeName: chosen.name
                    }
                })
            })

            message.success('Assignment reassigned')
            setReassignOpen(false)
            setReassignTarget(null)
            reassignForm.resetFields()
            await refresh()
        } catch (e) {
            console.error('Reassign failed:', e)
            message.error('Failed to reassign')
        } finally {
            setReassigning(false)
        }
    }

    const allParticipantIds = useMemo(() => participants.map(p => p.id), [participants])

    // ---------- UI ----------
    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            <Helmet>
                <title>Assignments | Incubation Platform</title>
            </Helmet>

            {loading && <LoadingOverlay tip='Loading assignments and participants…' />}

            <Row gutter={[16, 16]} style={{ marginBottom: 15 }}>
                {progressMetrics.map(({ title, value, icon, customRender, color, bgColor }) => (
                    <Col xs={24} sm={12} md={8} key={title}>
                        <MotionCard>
                            <Statistic
                                title={
                                    <Space>
                                        <div
                                            style={{
                                                background: bgColor,
                                                padding: 8,
                                                borderRadius: '50%',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {React.cloneElement(icon, { style: { fontSize: 18, color } })}
                                        </div>
                                        <span>{title}</span>
                                    </Space>
                                }
                                valueRender={() => customRender ?? <span>{value}</span>}
                            />
                        </MotionCard>
                    </Col>
                ))}
            </Row>

            <MotionCard style={{ marginBottom: 10 }}>
                <Row gutter={[12, 12]}>
                    <Col xs={24} md={10} order={1}>
                        <Input.Search
                            placeholder='Search beneficiary...'
                            allowClear
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </Col>

                    <Col xs={24} md={6} order={2}>
                        <Select
                            value={selectedGender}
                            onChange={setSelectedGender}
                            style={{ width: '100%' }}
                            options={[{ label: 'All Genders', value: 'all' }, ...genderOptions.map(g => ({ label: g, value: g }))]}
                            placeholder='Filter by gender'
                        />
                    </Col>

                    <Col xs={24} md={8} order={3}>
                        <Button type='primary' icon={<CheckCircleOutlined />} shape='round' onClick={() => setAssignmentModalVisible(true)} block>
                            Assign New Intervention
                        </Button>
                    </Col>
                </Row>
            </MotionCard>

            <MotionCard>
                <div style={{ width: '100%', overflowX: 'auto' }}>
                    <Table
                        columns={columns as any}
                        dataSource={filteredParticipants}
                        rowKey='id'
                        size={isMobile ? 'small' : 'middle'}
                        pagination={{
                            pageSize: isMobile ? 6 : 10,
                            simple: isMobile,
                            showSizeChanger: !isMobile,
                            responsive: true
                        }}
                        scroll={{ x: 'max-content' }}
                        sticky
                    />
                </div>
            </MotionCard>

            {/* ASSIGN MODAL */}
            <Modal
                title='Assign New Intervention'
                open={assignmentModalVisible}
                onCancel={() => {
                    setAssignmentModalVisible(false)
                    setLockedIntervention(null)
                    setAssignmentParticipant(null)
                    assignmentForm.resetFields()
                }}
                footer={null}
                destroyOnClose
            >
                <Form
                    form={assignmentForm}
                    layout='vertical'
                    onFinish={async values => {
                        try {
                            const isGrouped = values.type === 'grouped'
                            const selectedIds: string[] = isGrouped ? values.participants : [values.participant]

                            const chosenAssignee = allAssignees.find(a => a.id === values.assigneeId)
                            if (!chosenAssignee) return message.error('Assignee not found')

                            const assigneeType: AssigneeType = 'assignee' as any
                            const assigneeId = chosenAssignee.id
                            const assigneeName = chosenAssignee.name
                            const assigneeEmail = chosenAssignee.email || ''

                            const isSelf =
                                (!!assigneeEmail && !!user?.email && assigneeEmail.toLowerCase() === user.email.toLowerCase()) || assigneeId.startsWith('self:')

                            const interventionId: string = values.intervention
                            const meta = await getInterventionMeta(interventionId)

                            const selectedParticipants = selectedIds.map((pid: string) => participants.find(p => p.id === pid)).filter(Boolean) as Participant[]
                            if (!selectedParticipants.length) return message.error('No valid participant(s) selected')

                            if (isGrouped && !interventionId) return message.error('Select a shared intervention')
                            if (!isGrouped) {
                                const p0 = selectedParticipants[0]
                                const found = (p0.requiredInterventions || []).find(i => reqId(i) === interventionId)
                                if (!found) return message.error('Intervention not found for selected participant')
                            }

                            const batch = writeBatch(db)
                            const now = Timestamp.now()
                            const dueTs = values.dueDate ? Timestamp.fromDate(values.dueDate.toDate()) : null
                            const implTs = values.implementationDate ? Timestamp.fromDate(values.implementationDate.toDate()) : null

                            let groupId: string | null = null
                            if (isGrouped) {
                                const groupRef = doc(collection(db, 'groupAssignments'))
                                groupId = groupRef.id
                                batch.set(groupRef, {
                                    id: groupRef.id,
                                    groupId,
                                    type: 'grouped',
                                    assigneeType,
                                    assigneeId,
                                    assigneeName,
                                    assigneeEmail: assigneeEmail || '',
                                    interventionId,
                                    participantIds: selectedParticipants.map(p => p.id),
                                    dueDate: dueTs,
                                    implementationDate: implTs,
                                    isRecurring: !!meta.isRecurring,
                                    createdAt: now,
                                    updatedAt: now,
                                    companyCode: user?.companyCode
                                })
                            }

                            for (const p of selectedParticipants) {
                                const intv =
                                    (p.requiredInterventions || []).find(i => reqId(i) === String(interventionId)) ||
                                    (p.requiredInterventions || []).find(i => norm(reqTitle(i)) === norm(values.interventionTitle)) ||
                                    null

                                const fixedInterventionId = intv ? reqId(intv) : String(interventionId ?? '')
                                const fixedTitle = intv ? reqTitle(intv) : 'Unknown'
                                const fixedArea = intv ? reqArea(intv) : undefined

                                if (!fixedInterventionId) {
                                    message.error(`Missing interventionId for ${p.beneficiaryName}. Assignment not created.`)
                                    continue
                                }

                                const aRef = doc(collection(db, 'assignedInterventions'))
                                const nextAssigneeStatus = isSelf ? 'accepted' : 'pending'
                                const nextIncubateeStatus = 'pending'

                                batch.set(aRef, {
                                    id: aRef.id,
                                    groupId,
                                    companyCode: user?.companyCode,
                                    type: values.type,

                                    assigneeType,
                                    assigneeId,
                                    assigneeName,
                                    assigneeEmail: assigneeEmail || '',

                                    participantId: p.id,
                                    beneficiaryName: p.beneficiaryName,
                                    interventionId: fixedInterventionId,
                                    interventionTitle: fixedTitle,
                                    subtitle: meta.isRecurring ? values.subtitle || null : null,
                                    isRecurring: !!meta.isRecurring,
                                    targetType: values.targetType,
                                    targetValue: values.targetValue ?? null,
                                    targetMetric: values.targetType === 'number' ? normMetricKey(values.targetMetric) : 'Completion',
                                    implementationDate: implTs,
                                    dueDate: dueTs,

                                    status: 'assigned',
                                    assigneeStatus: nextAssigneeStatus,
                                    incubateeStatus: nextIncubateeStatus,
                                    assigneeCompletionStatus: 'pending',
                                    incubateeCompletionStatus: 'pending',

                                    createdAt: now,
                                    updatedAt: now,
                                    areaOfSupport: fixedArea || values.areaOfSupport || null
                                })
                            }

                            await batch.commit()

                            message.success(
                                isGrouped
                                    ? `Assigned${meta.isRecurring ? ' (recurring)' : ''} intervention to ${selectedParticipants.length} participant(s)`
                                    : `Intervention assigned${meta.isRecurring ? ' (recurring)' : ''}`
                            )

                            setAssignmentModalVisible(false)
                            setLockedIntervention(null)
                            setAssignmentParticipant(null)
                            assignmentForm.resetFields()
                            await refresh()
                        } catch (err) {
                            console.error('Assign failed:', err)
                            message.error('Failed to create assignment(s)')
                        }
                    }}
                    onValuesChange={async changed => {
                        if (changed.type) setSelectedType(changed.type)

                        if (Array.isArray(changed.participants) && selectedType === 'grouped') {
                            computeSharedInterventions(changed.participants)
                        }

                        if (changed.intervention) {
                            const meta = await getInterventionMeta(changed.intervention)
                            setIsRecurringSelected(!!meta.isRecurring)
                            if (meta.isRecurring) {
                                const impl = assignmentForm.getFieldValue('implementationDate') as Dayjs | undefined
                                assignmentForm.setFieldsValue({
                                    subtitle: assignmentForm.getFieldValue('subtitle') || (impl ? `Session - ${impl.format('YYYY-MM-DD')}` : 'Session')
                                })
                            } else {
                                assignmentForm.setFieldsValue({ subtitle: undefined })
                            }
                        }

                        if (changed.targetType === 'percentage') {
                            assignmentForm.setFieldsValue({ targetMetric: 'Completion', targetValue: undefined })
                        } else if (changed.targetType === 'number') {
                            assignmentForm.setFieldsValue({ targetMetric: undefined, targetValue: undefined })
                        }
                    }}
                >
                    <Form.Item name='type' label='Assignment Type' rules={[{ required: true, message: 'Please select assignment type' }]} initialValue='singular'>
                        <Select placeholder='Select type'>
                            <Select.Option value='singular'>Singular (1 SME)</Select.Option>
                            <Select.Option value='grouped'>Grouped (Multiple SMEs)</Select.Option>
                        </Select>
                    </Form.Item>

                    {selectedType === 'grouped' ? (
                        <Form.Item label='Select Multiple Beneficiaries'>
                            <Space style={{ marginBottom: 8 }}>
                                <Button
                                    size='small'
                                    onClick={() => {
                                        assignmentForm.setFieldsValue({ participants: allParticipantIds })
                                        computeSharedInterventions(allParticipantIds)
                                    }}
                                >
                                    Select all ({participants.length})
                                </Button>
                                <Button
                                    size='small'
                                    onClick={() => {
                                        assignmentForm.setFieldsValue({ participants: [] })
                                        computeSharedInterventions([])
                                    }}
                                >
                                    Clear
                                </Button>
                            </Space>

                            <Form.Item name='participants' noStyle rules={[{ required: true, message: 'Please select participants' }]}>
                                <Select mode='multiple' placeholder='Choose beneficiaries' onChange={(ids: string[]) => computeSharedInterventions(ids)}>
                                    {participants.map(p => (
                                        <Select.Option key={p.id} value={p.id}>
                                            {p.beneficiaryName}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Form.Item>
                    ) : (
                        <Form.Item name='participant' label='Select Beneficiary' rules={[{ required: true, message: 'Please select a participant' }]}>
                            <Select placeholder='Choose a beneficiary'>
                                {participants.map(p => (
                                    <Select.Option key={p.id} value={p.id}>
                                        {p.beneficiaryName}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    )}

                    <Form.Item shouldUpdate={(prev, curr) => prev.participant !== curr.participant || prev.participants !== curr.participants || prev.type !== curr.type} noStyle>
                        {({ getFieldValue }) => {
                            const isGrouped = getFieldValue('type') === 'grouped'
                            if (isGrouped) {
                                return (
                                    <Form.Item name='intervention' label='Select Shared Intervention' rules={[{ required: true, message: 'Select an intervention' }]}>
                                        <Select placeholder='Select intervention (shared)'>
                                            {sharedInterventions.map(iv => (
                                                <Select.Option key={iv.id} value={iv.id}>
                                                    {iv.title}
                                                </Select.Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                )
                            }
                            const pid = getFieldValue('participant')
                            const selected = participants.find(p => p.id === pid)
                            const options = selected?.requiredInterventions || []
                            return (
                                <Form.Item name='intervention' label='Select Intervention' rules={[{ required: true, message: 'Select an intervention' }]}>
                                    <Select placeholder='Choose an intervention' disabled={!pid || !!lockedIntervention}>
                                        {options.map(iv => (
                                            <Select.Option key={reqId(iv)} value={reqId(iv)}>
                                                {reqTitle(iv)}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            )
                        }}
                    </Form.Item>

                    {isRecurringSelected && (
                        <Form.Item
                            name='subtitle'
                            label='Subtitle (for recurring sessions)'
                            rules={[{ required: true, message: 'Please add a subtitle to distinguish this session' }]}
                        >
                            <Input placeholder='e.g., Week 1 — Intro to Bookkeeping' />
                        </Form.Item>
                    )}

                    <Form.Item name='assigneeId' label='Assign To' rules={[{ required: true, message: 'Choose an assignee' }]}>
                        <Select
                            placeholder='Choose assignee'
                            showSearch
                            optionFilterProp='label'
                            options={allAssignees.map(a => ({ label: `${a.name}${a.email ? ` — ${a.email}` : ''}`, value: a.id }))}
                        />
                    </Form.Item>

                    <Form.Item name='targetType' label='Target Type' rules={[{ required: true, message: 'Please select target type' }]}>
                        <Select placeholder='Select target type'>
                            <Select.Option value='percentage'>Percentage (%)</Select.Option>
                            <Select.Option value='number'>Number (Hours/Sessions)</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item shouldUpdate={(p, c) => p.targetType !== c.targetType} noStyle>
                        {({ getFieldValue }) =>
                            getFieldValue('targetType') === 'percentage' ? (
                                <>
                                    <Form.Item name='targetMetric' label='Label'>
                                        <Input disabled value='Completion' />
                                    </Form.Item>
                                    <Form.Item name='targetValue' label='Target Completion (%)' rules={[{ required: true, message: 'Enter % target' }]}>
                                        <Input type='number' max={100} min={1} />
                                    </Form.Item>
                                </>
                            ) : getFieldValue('targetType') === 'number' ? (
                                <>
                                    <Form.Item
                                        name="targetMetric"
                                        label="Target Metric"
                                        rules={[{ required: true, message: 'Choose a metric' }]}
                                    >
                                        <Select
                                            placeholder="Choose a metric"
                                            options={NUMBER_TARGET_METRICS.map(m => ({ value: m.value, label: m.label }))}
                                            showSearch
                                            optionFilterProp="label"
                                        />
                                    </Form.Item>
                                    <Form.Item shouldUpdate={(p, c) => p.targetMetric !== c.targetMetric} noStyle>
                                        {({ getFieldValue }) => {
                                            const metricKey = normMetricKey(getFieldValue('targetMetric'))
                                            const isPlannedEvent = metricKey === 'sessions' || metricKey === 'workshops' || metricKey === 'meetings' || metricKey === 'calls' || metricKey === 'site_visits'

                                            return (
                                                <Form.Item
                                                    name="targetValue"
                                                    label="Target Value"
                                                    rules={[
                                                        { required: true, message: 'Enter numeric goal' },
                                                        {
                                                            validator: async (_, value) => {
                                                                const n = Number(value)
                                                                if (!Number.isFinite(n) || n <= 0) throw new Error('Enter a number greater than 0')
                                                                if (isPlannedEvent && !Number.isInteger(n)) throw new Error('This metric must be a whole number')
                                                            }
                                                        }
                                                    ]}
                                                >
                                                    <Input type="number" placeholder={isPlannedEvent ? 'e.g. 6' : 'e.g. 5 or 10'} />
                                                </Form.Item>
                                            )
                                        }}
                                    </Form.Item>
                                </>
                            ) : null
                        }
                    </Form.Item>

                    <Form.Item name='implementationDate' label='Date Of Implementation' rules={[{ required: true, message: 'Please select a implementation date' }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item name='dueDate' label='Due Date' rules={[{ required: true, message: 'Please select a due date' }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item>
                        <Button variant='solid' color='primary' shape='round' icon={<CheckCircleOutlined />} htmlType='submit' block>
                            Create Assignment
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            {/* REASSIGN MODAL */}
            <Modal
                title={reassignTarget ? `Reassign: ${(reassignTarget as any).interventionTitle}` : 'Reassign'}
                open={reassignOpen}
                onCancel={() => {
                    setReassignOpen(false)
                    setReassignTarget(null)
                    reassignForm.resetFields()
                }}
                footer={null}
                destroyOnClose
            >
                {reassigning && <LoadingOverlay tip='Reassigning…' />}

                <Form form={reassignForm} layout='vertical' onFinish={handleReassignSubmit}>
                    <Form.Item
                        name='assigneeId'
                        label='Select Assignee'
                        rules={[{ required: true, message: 'Please select an assignee' }]}
                        initialValue={(reassignTarget as any)?.assigneeId || undefined}
                    >
                        <Select
                            placeholder='Choose assignee'
                            options={allAssignees.map(a => ({ label: `${a.name}${a.email ? ` — ${a.email}` : ''}`, value: a.id }))}
                            showSearch
                            optionFilterProp='label'
                        />
                    </Form.Item>

                    <Form.Item name='reason' label='Reason (optional)'>
                        <Input.TextArea placeholder='Why are you reassigning this?' rows={3} />
                    </Form.Item>

                    <Form.Item name='keepStatus' valuePropName='checked'>
                        <Switch /> <span style={{ marginLeft: 8 }}>Keep current overall status</span>
                    </Form.Item>

                    <Form.Item>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => setReassignOpen(false)} shape='round' danger icon={<CloseCircleOutlined />}>
                                Cancel
                            </Button>
                            <Button type='primary' htmlType='submit' shape='round' loading={reassigning} icon={<CheckCircleOutlined />}>
                                Confirm Reassignment
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* MANAGE PARTICIPANT MODAL */}
            <Modal
                title={`Interventions for ${selectedParticipant?.beneficiaryName || ''}`}
                open={manageModalVisible}
                onCancel={() => setManageModalVisible(false)}
                footer={null}
                width={isMobile ? '100%' : 900}
                style={{ top: isMobile ? 8 : 24, paddingInline: isMobile ? 8 : 0 }}
                bodyStyle={{ padding: isMobile ? 12 : 24 }}
                destroyOnClose
            >
                <Form layout='vertical' style={{ marginBottom: 12 }}>
                    <Row gutter={[8, 8]} align='middle'>
                        <Col xs={24} sm={16} md={10}>
                            <Form.Item label='Filter' style={{ marginBottom: 0 }}>
                                <Select value={interventionFilter} onChange={setInterventionFilter} style={{ width: '100%' }}>
                                    <Select.Option value='all'>All Interventions</Select.Option>
                                    <Select.Option value='assigned'>Assigned</Select.Option>
                                    <Select.Option value='unassigned'>Unassigned</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8} md={14} style={{ display: 'flex', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                            <Button icon={<ReloadOutlined />} onClick={() => refresh()}>
                                Refresh
                            </Button>
                        </Col>
                    </Row>
                </Form>

                <div style={{ width: '100%', overflowX: 'auto' }}>
                    <Table
                        rowKey={(r: any) => String(r?.id || r?.interventionId || '')}
                        size={isMobile ? 'small' : 'middle'}
                        pagination={{
                            pageSize: isMobile ? 6 : 10,
                            simple: isMobile,
                            showSizeChanger: !isMobile,
                            responsive: true
                        }}
                        scroll={{ x: 'max-content' }}
                        sticky
                        columns={
                            [
                                { title: 'Intervention Title', dataIndex: 'interventionTitle', key: 'interventionTitle' },
                                {
                                    title: 'Assignee',
                                    key: 'assigneeName',
                                    render: (_: any, record: any) => {
                                        if (record.isUnassigned) return 'Not Assigned'
                                        const a = resolveAssignee(record as AssignedIntervention)
                                        return (
                                            <Space>
                                                <Tag>{pretty(a.assigneeType)}</Tag>
                                                <span>{a.name}</span>
                                            </Space>
                                        )
                                    }
                                },
                                {
                                    title: 'Status',
                                    key: 'status',
                                    render: (_: any, record: any) =>
                                        record.isUnassigned ? (
                                            <Tag>Unassigned</Tag>
                                        ) : (
                                            <Tag color={getCompositeStatus(record as AssignedIntervention).color}>{getCompositeStatus(record as AssignedIntervention).label}</Tag>
                                        )
                                },
                                {
                                    title: 'Due',
                                    key: 'dueDate',
                                    responsive: ['md'],
                                    render: (_: any, record: any) => {
                                        if (!record.dueDate) return '—'
                                        const d = typeof record.dueDate === 'string' ? new Date(record.dueDate) : record.dueDate?.toDate?.() ?? new Date()
                                        return d.toLocaleDateString()
                                    }
                                },
                                {
                                    title: 'Action',
                                    key: 'action',
                                    fixed: isMobile ? undefined : 'right',
                                    render: (_: any, record: any) =>
                                        record.isUnassigned ? (
                                            <Button shape='round' variant='filled' color='primary' icon={<CiCircleOutlined />} onClick={() => handleQuickAssign(record)}>
                                                Assign
                                            </Button>
                                        ) : (
                                            <Space>
                                                <Button variant='filled' color='primary' icon={<EyeOutlined />} shape='round' onClick={() => openAssignmentView(record as AssignedIntervention)}>
                                                    View
                                                </Button>
                                                <Button variant='filled' color='geekblue' icon={<ReloadOutlined />} shape='round' onClick={() => startReassign(record as AssignedIntervention)}>
                                                    Reassign
                                                </Button>
                                            </Space>
                                        )
                                }
                            ] as any[]
                        }
                        dataSource={getFilteredInterventions()}
                    />
                </div>
            </Modal>

            {/* VIEW ASSIGNMENT DRAWER */}
            <Drawer
                title={viewRecord ? `Intervention Details — ${(viewRecord as any).interventionTitle}` : 'Intervention Details'}
                open={viewOpen}
                onClose={() => {
                    setViewOpen(false)
                    setViewRecord(null)
                }}
                width={isMobile ? '100%' : 520}
                destroyOnClose
            >
                {!viewRecord ? (
                    <Text type='secondary'>No assignment selected.</Text>
                ) : (
                    <>
                        <Row gutter={[12, 12]} align='middle'>
                            <Col flex='auto'>
                                <Space direction='vertical' size={2}>
                                    <Text type='secondary'>Beneficiary</Text>
                                    <Text strong>{(viewRecord as any).beneficiaryName || '—'}</Text>
                                    {(viewRecord as any).subtitle ? <Tag color='geekblue'>{(viewRecord as any).subtitle}</Tag> : null}
                                </Space>
                            </Col>
                            <Col>
                                <Progress type='circle' percent={calcProgress(viewRecord)} />
                            </Col>
                        </Row>

                        <Divider />

                        {(() => {
                            const a = resolveAssignee(viewRecord)
                            const v: any = viewRecord
                            return (
                                <Descriptions size='small' column={1} bordered>
                                    <Descriptions.Item label='Assignee'>
                                        <Space>
                                            <Tag>{pretty(a.assigneeType)}</Tag>
                                            <span>{a.name}</span>
                                            {a.email ? <Tag color='blue'>{a.email}</Tag> : null}
                                        </Space>
                                    </Descriptions.Item>

                                    <Descriptions.Item label='Area'>{v.areaOfSupport ? <Tag>{v.areaOfSupport}</Tag> : '—'}</Descriptions.Item>

                                    <Descriptions.Item label='Overall Status'>
                                        <Tag color={getCompositeStatus(viewRecord).color}>{getCompositeStatus(viewRecord).label}</Tag>
                                    </Descriptions.Item>

                                    <Descriptions.Item label='Status Breakdown'>
                                        <Space size={[6, 6]} wrap>
                                            <Tag color='blue'>Overall: {pretty(v.status)}</Tag>
                                            <Tag color='purple'>Assignee: {pretty(v.assigneeStatus)}</Tag>
                                            <Tag color='gold'>Incubatee: {pretty(v.incubateeStatus)}</Tag>
                                            <Tag color='cyan'>Assignee Completion: {pretty(v.assigneeCompletionStatus)}</Tag>
                                            <Tag color='lime'>Incubatee Confirmation: {pretty(v.incubateeCompletionStatus)}</Tag>
                                        </Space>
                                    </Descriptions.Item>

                                    <Descriptions.Item label='Target'>
                                        <Space wrap>
                                            <Tag>{pretty(v.targetType || '—')}</Tag>
                                            <Text>
                                                {v.targetValue ?? '—'} {v.targetMetric ? `(${prettyTargetMetric(v.targetMetric)})` : ''}
                                            </Text>
                                        </Space>
                                    </Descriptions.Item>

                                    <Descriptions.Item label='Implementation Date'>
                                        {v.implementationDate?.toDate ? v.implementationDate.toDate().toLocaleDateString() : '—'}
                                    </Descriptions.Item>

                                    <Descriptions.Item label='Due Date'>{v.dueDate?.toDate ? v.dueDate.toDate().toLocaleDateString() : '—'}</Descriptions.Item>

                                    <Descriptions.Item label='Assigned On'>{v.createdAt?.toDate ? v.createdAt.toDate().toLocaleDateString() : '—'}</Descriptions.Item>

                                    <Descriptions.Item label='Time Spent (hrs)'>{typeof v.timeSpentHours === 'number' ? v.timeSpentHours : '—'}</Descriptions.Item>
                                </Descriptions>
                            )
                        })()}

                        {(viewRecord as any).feedback ? (
                            <>
                                <Divider />
                                <Card size='small' title='Feedback'>
                                    <Paragraph style={{ marginBottom: 8 }}>
                                        <Text italic>"{(viewRecord as any).feedback.comments}"</Text>
                                    </Paragraph>
                                    <Tag color='green'>Rating: {(viewRecord as any).feedback.rating} / 5</Tag>
                                </Card>
                            </>
                        ) : null}

                        <Divider />

                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button danger icon={<CloseCircleOutlined />} shape='round' onClick={() => (setViewOpen(false), setViewRecord(null))}>
                                Close
                            </Button>
                            <Button
                                icon={<CheckCircleOutlined />}
                                shape='round'
                                variant='solid'
                                color='primary'
                                onClick={() => {
                                    if (!viewRecord) return
                                    setViewOpen(false)
                                    setViewRecord(null)
                                    startReassign(viewRecord)
                                }}
                            >
                                Reassign
                            </Button>
                        </Space>
                    </>
                )}
            </Drawer>
        </div>
    )
}
