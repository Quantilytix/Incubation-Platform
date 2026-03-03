// routes/shared/AllocatedInterventions.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
    Card,
    Table,
    Tag,
    Space,
    Button,
    Typography,
    Segmented,
    Grid,
    Progress,
    Modal,
    Descriptions,
    Divider,
    message,
    Spin,
    Input,
    Select,
    Row,
    Col,
    Tooltip
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    EyeOutlined,
    ReloadOutlined,
    MailOutlined,
    PhoneOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    RightCircleOutlined,
    CheckOutlined,
    CloseOutlined,
    SearchOutlined,
    FilterOutlined,
    TeamOutlined,
    UserOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { Helmet } from 'react-helmet'
import { useNavigate } from 'react-router-dom'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { useAssignedInterventions, type AssignedIntervention } from '@/contexts/AssignedInterventionsContext'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'
import { db } from '@/firebase'
import { doc, getDoc, writeBatch, Timestamp } from 'firebase/firestore'

const { Text } = Typography
const { Option } = Select

const norm = (v: any) => String(v ?? '').trim().toLowerCase()

const toDate = (v: any): Date | null => {
    if (!v) return null
    if (v?.toDate) return v.toDate()
    if (typeof v === 'object' && v?.seconds) return new Date(v.seconds * 1000)
    const d = new Date(v)
    return Number.isNaN(+d) ? null : d
}

type ParticipantRow = {
    id: string
    beneficiaryName?: string
    email?: string
    phone?: string
    phoneNumber?: string
    mobile?: string
    contactNumber?: string
    sector?: string
}

const pickPhone = (p?: ParticipantRow | null) =>
    p?.phone || p?.phoneNumber || p?.mobile || p?.contactNumber || '—'

type ViewTab = 'ongoing' | 'history'

type RowKind = 'group' | 'single'

type GroupRow = {
    kind: 'group'
    id: string // groupId
    groupId: string
    interventionTitle: string
    subtitle?: string | null
    beneficiaryLabel: string // "Grouped: n SMEs"
    total: number
    // rolled status for table (restricted to 4)
    status: 'assigned' | 'in-progress' | 'completed' | 'rejected'
    // rollups used in modal "hold up"
    assigneeStatus: 'pending' | 'accepted' | 'declined'
    incubateeStatus: 'pending' | 'accepted' | 'declined'
    dueDate?: any
    createdAt?: any
    members: AssignedIntervention[]
    declineReason?: string
}

type SingleRow = {
    kind: 'single'
    id: string // doc id
    interventionTitle: string
    subtitle?: string | null
    beneficiaryName: string
    status: 'assigned' | 'in-progress' | 'completed' | 'rejected'
    assigneeStatus: 'pending' | 'accepted' | 'declined'
    incubateeStatus: 'pending' | 'accepted' | 'declined'
    dueDate?: any
    createdAt?: any
    participantId?: string
    declineReason?: string
    raw: AssignedIntervention
}

type TableRow = GroupRow | SingleRow

const rollStatus = (items: AssignedIntervention[]): GroupRow['status'] => {
    const ss = items.map(i => norm(i.status))
    const anyRejected =
        ss.includes('rejected') || ss.includes('declined') || items.some(i => norm((i as any).assigneeStatus) === 'declined')
    if (anyRejected) return 'rejected'

    const anyInProgress = ss.includes('in-progress') || ss.includes('in_progress')
    if (anyInProgress) return 'in-progress'

    const allCompleted = items.length > 0 && ss.every(s => s === 'completed')
    if (allCompleted) return 'completed'

    return 'assigned'
}

const rollAssigneeStatus = (items: AssignedIntervention[]): GroupRow['assigneeStatus'] => {
    const vals = items.map(i => norm((i as any).assigneeStatus || 'pending'))
    if (vals.some(v => v === 'declined')) return 'declined'
    if (vals.every(v => v === 'accepted')) return 'accepted'
    return 'pending'
}

const rollIncubateeStatus = (items: AssignedIntervention[]): GroupRow['incubateeStatus'] => {
    const vals = items.map(i => norm((i as any).incubateeStatus || 'pending'))
    if (vals.some(v => v === 'declined')) return 'declined'
    if (vals.every(v => v === 'accepted')) return 'accepted'
    return 'pending'
}

const statusTag = (s: TableRow['status']) => {
    if (s === 'completed') return <Tag color="green">Completed</Tag>
    if (s === 'rejected') return <Tag color="red">Rejected</Tag>
    if (s === 'in-progress') return <Tag color="blue">In Progress</Tag>
    return <Tag color="gold">Assigned</Tag>
}

const assigneeStatusTag = (s: 'pending' | 'accepted' | 'declined') => {
    if (s === 'accepted') return <Tag color="green">Accepted</Tag>
    if (s === 'declined') return <Tag color="red">Declined</Tag>
    return <Tag color="gold">Pending</Tag>
}

const incubateeStatusTag = (s: 'pending' | 'accepted' | 'declined') => {
    if (s === 'accepted') return <Tag color="green">Accepted</Tag>
    if (s === 'declined') return <Tag color="red">Declined</Tag>
    return <Tag color="gold">Pending</Tag>
}

const progressPct = (row: TableRow) => {
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

    if (row.kind === 'single') {
        const p = Number((row.raw as any).progress)
        return Number.isFinite(p) ? clamp(p) : 0
    }

    // group
    const vals = row.members
        .map(m => Number((m as any).progress))
        .filter(n => Number.isFinite(n))

    if (!vals.length) return 0

    return clamp(vals.reduce((a, b) => a + b, 0) / vals.length)
}

const daysRemaining = (due: any) => {
    const d = toDate(due)
    if (!d) return null
    const today = dayjs().startOf('day')
    const dd = dayjs(d).startOf('day')
    return dd.diff(today, 'day')
}


const holdUpText = (row: TableRow) => {
    // only meaningful when "assigned"
    if (row.status !== 'assigned') return '—'
    if (row.incubateeStatus === 'pending') return 'Waiting for incubatee acceptance'
    if (row.assigneeStatus === 'pending') return 'Waiting for assignee acceptance'
    if (row.assigneeStatus === 'declined' || row.incubateeStatus === 'declined') return 'Rejected'
    return 'Assigned'
}

export const AllocatedInterventions: React.FC = () => {
    const { user } = useFullIdentity()
    const navigate = useNavigate()

    const screens = Grid.useBreakpoint()
    const isMobile = !screens.md

    const { assignments: allCompanyAssignments, loading, refresh, isMine } = useAssignedInterventions()

    const [view, setView] = useState<ViewTab>('ongoing')

    // filters
    const [q, setQ] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | TableRow['status']>('all')

    // modal state
    const [viewOpen, setViewOpen] = useState(false)
    const [selected, setSelected] = useState<TableRow | null>(null)

    const [participantLoading, setParticipantLoading] = useState(false)
    const [participant, setParticipant] = useState<ParticipantRow | null>(null)
    const [participantCache, setParticipantCache] = useState<Record<string, ParticipantRow>>({})

    const mineDocs = useMemo(() => allCompanyAssignments.filter(isMine), [allCompanyAssignments, isMine])

    const tableRowsAll = useMemo<TableRow[]>(() => {
        if (!mineDocs.length) return []

        const groups = new Map<string, AssignedIntervention[]>()
        const singles: AssignedIntervention[] = []

        for (const a of mineDocs) {
            const isGrouped = norm(a.type) === 'grouped' && !!a.groupId
            if (isGrouped) {
                const gid = String(a.groupId)
                const arr = groups.get(gid) || []
                arr.push(a)
                groups.set(gid, arr)
            } else {
                singles.push(a)
            }
        }

        const out: TableRow[] = []

        // --- grouped rows ---
        for (const [gid, members] of groups.entries()) {
            members.sort((a, b) => {
                const da = toDate((a as any).dueDate)
                const dbb = toDate((b as any).dueDate)
                return (da ? +da : 0) - (dbb ? +dbb : 0)
            })

            const first = members[0]
            const title = first?.interventionTitle || 'Intervention'
            const subtitles = Array.from(
                new Set(
                    members
                        .map(m => String((m as any).subtitle || '').trim())
                        .filter(Boolean)
                )
            )
            const subtitle = subtitles.length === 1 ? subtitles[0] : subtitles.length > 1 ? 'Multiple' : null

            const total = members.length
            const dueDates = members.map(m => (m as any).dueDate).filter(Boolean)
            const due = dueDates.length ? dueDates[0] : (first as any).dueDate

            const declineReason =
                members.map(m => String((m as any).declineReason || '').trim()).find(x => !!x) || undefined

            out.push({
                kind: 'group',
                id: gid,
                groupId: gid,
                interventionTitle: title,
                subtitle, // stored
                beneficiaryLabel: `Grouped: ${total} SMEs`,
                total,
                status: rollStatus(members),
                assigneeStatus: rollAssigneeStatus(members),
                incubateeStatus: rollIncubateeStatus(members),
                dueDate: due,
                createdAt: (first as any).createdAt,
                members,
                declineReason
            })
        }

        // --- single rows ---
        for (const a of singles) {
            const dr = String((a as any).declineReason || '').trim()
            const s0 = norm(a.status)
            const mappedStatus: SingleRow['status'] =
                s0 === 'completed'
                    ? 'completed'
                    : s0 === 'in-progress' || s0 === 'in_progress'
                        ? 'in-progress'
                        : s0 === 'rejected' || s0 === 'declined'
                            ? 'rejected'
                            : 'assigned'

            out.push({
                kind: 'single',
                id: a.id,
                interventionTitle: a.interventionTitle || 'Intervention',
                subtitle: String((a as any).subtitle || '').trim() || null,
                beneficiaryName: (a as any).beneficiaryName || '—',
                status: mappedStatus,
                assigneeStatus: (norm((a as any).assigneeStatus) as any) || 'pending',
                incubateeStatus: (norm((a as any).incubateeStatus) as any) || 'pending',
                dueDate: (a as any).dueDate,
                createdAt: (a as any).createdAt,
                participantId: (a as any).participantId,
                declineReason: dr || undefined,
                raw: a
            })
        }

        // consistent ordering: assigned -> in-progress -> completed -> rejected
        const order: Record<TableRow['status'], number> = {
            assigned: 0,
            'in-progress': 1,
            completed: 2,
            rejected: 3
        }

        return out.sort((a, b) => {
            const oa = order[a.status] ?? 9
            const ob = order[b.status] ?? 9
            if (oa !== ob) return oa - ob

            const ba =
                a.kind === 'group'
                    ? a.beneficiaryLabel
                    : a.beneficiaryName
            const bb =
                b.kind === 'group'
                    ? b.beneficiaryLabel
                    : b.beneficiaryName
            return String(ba || '').localeCompare(String(bb || ''))
        })
    }, [mineDocs])

    const ongoing = useMemo(() => {
        return tableRowsAll.filter(r => r.status !== 'completed' && r.status !== 'rejected')
    }, [tableRowsAll])

    const history = useMemo(() => {
        return tableRowsAll.filter(r => r.status === 'completed' || r.status === 'rejected')
    }, [tableRowsAll])

    const baseRows = view === 'ongoing' ? ongoing : history

    const filteredRows = useMemo(() => {
        const qq = norm(q)
        return baseRows
            .filter(r => {
                if (statusFilter === 'all') return true
                return r.status === statusFilter
            })
            .filter(r => {
                if (!qq) return true
                const title = norm((r as any).interventionTitle)
                const bene =
                    r.kind === 'group'
                        ? norm(r.beneficiaryLabel)
                        : norm(r.beneficiaryName)
                return title.includes(qq) || bene.includes(qq)
            })
    }, [baseRows, q, statusFilter])

    const openView = async (row: TableRow) => {
        setSelected(row)
        setViewOpen(true)

        // participant details only for single (group shows SMEs list table)
        if (row.kind === 'group') {
            setParticipant(null)
            return
        }

        const pid = String(row.participantId || '')
        if (!pid) {
            setParticipant(null)
            return
        }

        if (participantCache[pid]) {
            setParticipant(participantCache[pid])
            return
        }

        try {
            setParticipantLoading(true)
            const snap = await getDoc(doc(db, 'participants', pid))
            if (!snap.exists()) {
                setParticipant(null)
                return
            }
            const p = { id: snap.id, ...(snap.data() as any) } as ParticipantRow
            setParticipant(p)
            setParticipantCache(prev => ({ ...prev, [pid]: p }))
        } catch (e) {
            console.error(e)
            setParticipant(null)
        } finally {
            setParticipantLoading(false)
        }
    }

    useEffect(() => {
        if (!viewOpen) {
            setSelected(null)
            setParticipant(null)
            setParticipantLoading(false)
        }
    }, [viewOpen])

    const acceptDeclineAllowed = (row: TableRow) => {
        // Accept/Decline only when I'm pending and still "assigned"
        if (row.status !== 'assigned') return false
        if (row.assigneeStatus !== 'pending') return false
        return true
    }

    const commitAcceptDecline = async (row: TableRow, action: 'accept' | 'decline') => {
        const now = Timestamp.now()

        const doWrite = async () => {
            const batch = writeBatch(db)

            const targets: AssignedIntervention[] =
                row.kind === 'group' ? row.members : [row.raw]

            for (const t of targets) {
                const ref = doc(db, 'assignedInterventions', t.id)

                if (action === 'accept') {
                    // when incubatee already accepted, move to in-progress
                    const inc = norm((t as any).incubateeStatus)
                    const nextStatus = inc === 'accepted' ? 'in-progress' : 'assigned'

                    batch.update(ref, {
                        assigneeStatus: 'accepted',
                        status: nextStatus,
                        updatedAt: now
                    } as any)
                } else {
                    batch.update(ref, {
                        assigneeStatus: 'declined',
                        status: 'rejected',
                        declineReason: String((t as any).declineReason || '').trim(), // keep if already exists
                        updatedAt: now
                    } as any)
                }
            }

            await batch.commit()
        }

        return new Promise<void>(resolve => {
            Modal.confirm({
                title:
                    action === 'accept'
                        ? row.kind === 'group'
                            ? `Accept group (${row.total} SMEs)?`
                            : 'Accept this intervention?'
                        : row.kind === 'group'
                            ? `Decline group (${row.total} SMEs)?`
                            : 'Decline this intervention?',
                content:
                    action === 'accept'
                        ? 'This confirms you will take this work on.'
                        : 'This will reject the assignment.',
                okText: action === 'accept' ? 'Accept' : 'Decline',
                okButtonProps: { danger: action === 'decline' },
                cancelText: 'Cancel',
                onOk: async () => {
                    try {
                        await doWrite()
                        message.success(action === 'accept' ? 'Accepted.' : 'Declined.')
                        resolve()
                    } catch (e) {
                        console.error(e)
                        message.error('Update failed.')
                        resolve()
                    }
                },
                onCancel: () => resolve()
            })
        })
    }

    const sendReminderPlaceholder = () => {
        message.info('Reminder will be wired up next.')
    }

    const goToUpdate = (row: TableRow) => {
        if (row.kind === 'single') {
            navigate(`/shared/allocated/${row.id}`)
            return
        }
        // grouped: take them to the first item (keeps routing simple for now)
        const first = row.members[0]
        if (first?.id) navigate(`/shared/allocated/${first.id}`)
    }

    const columns: ColumnsType<TableRow> = [
        {
            title: 'Beneficiary',
            key: 'beneficiary',
            render: (_: any, r: TableRow) =>
                r.kind === 'group' ? (
                    <Space size={8}>
                        <Tag color="purple" icon={<TeamOutlined />}>
                            Grouped
                        </Tag>
                        <Text>{r.beneficiaryLabel}</Text>
                    </Space>
                ) : (
                    <Space size={8}>
                        <Tag icon={<UserOutlined />}>Single</Tag>
                        <Text>{r.beneficiaryName}</Text>
                    </Space>
                )
        },
        { title: 'Intervention', dataIndex: 'interventionTitle', key: 'interventionTitle' },
        {
            title: 'Status',
            key: 'status',
            render: (_: any, r: TableRow) => statusTag(r.status)
        },
        {
            title: 'Due',
            key: 'dueDate',
            render: (_: any, r: TableRow) => {
                const d = toDate((r as any).dueDate)
                return d ? dayjs(d).format('DD MMM YYYY') : '—'
            }
        },
        {
            title: 'Progress',
            key: 'progress',
            responsive: ['md'],
            render: (_: any, r: TableRow) => <Progress percent={progressPct(r)} size="small" />
        },
        {
            title: 'Action',
            key: 'action',
            fixed: isMobile ? undefined : 'right',
            render: (_: any, r: TableRow) => (
                <Button
                    icon={<EyeOutlined />}
                    shape="round"
                    variant="filled"
                    color="primary"
                    style={{ border: '1px solid dodgerblue' }}
                    onClick={e => {
                        e.stopPropagation()
                        openView(r)
                    }}
                >
                    View
                </Button>
            )
        }
    ]

    // inside component

    const selectedAssignedAt = selected ? toDate((selected as any).createdAt) : null
    const selectedDue = selected ? toDate((selected as any).dueDate) : null
    const selectedDaysLeft = selected ? daysRemaining((selected as any).dueDate) : null

    let descriptionItems: React.ReactNode[] = []

    if (selected) {
        const holdUp = holdUpText(selected)
        const showHoldUp = holdUp && holdUp !== '—'
        const showDeclineReason = selected.status === 'rejected' && !!selected.declineReason
        const sub = String((selected as any).subtitle || '').trim()

        descriptionItems = [
            <Descriptions.Item key="title" label="Title">
                {selected.interventionTitle || '—'}
            </Descriptions.Item>,
        ]

        if (sub) {
            descriptionItems.push(
                <Descriptions.Item key="subtitle" label="Subtitle">
                    <Text>{sub}</Text>
                </Descriptions.Item>
            )
        }

        descriptionItems.push(
            <Descriptions.Item key="beneficiary" label="Beneficiary">
                {selected.kind === 'group' ? selected.beneficiaryLabel : selected.beneficiaryName}
            </Descriptions.Item>,
            <Descriptions.Item key="status" label="Overall Status">
                {statusTag(selected.status)}
            </Descriptions.Item>
        )

        if (selected.status === 'assigned' && showHoldUp) {
            descriptionItems.push(
                <Descriptions.Item key="holdUp" label="Hold Up">
                    <Text>{holdUp}</Text>
                </Descriptions.Item>
            )
        }

        descriptionItems.push(
            <Descriptions.Item key="assigneeStatus" label="Assignee Status">
                {assigneeStatusTag(selected.assigneeStatus)}
            </Descriptions.Item>
        )

        descriptionItems.push(
            <Descriptions.Item key="incubateeStatus" label="Incubatee Status">
                {incubateeStatusTag(selected.incubateeStatus)}
            </Descriptions.Item>
        )

        if (selectedAssignedAt) {
            descriptionItems.push(
                <Descriptions.Item key="assignedOn" label="Assigned On">
                    {dayjs(selectedAssignedAt).format('DD MMM YYYY, HH:mm')}
                </Descriptions.Item>
            )
        }

        if (selectedDue) {
            descriptionItems.push(
                <Descriptions.Item key="dueDate" label="Due Date">
                    {dayjs(selectedDue).format('DD MMM YYYY')}
                </Descriptions.Item>
            )
        }

        if (selectedDaysLeft != null) {
            descriptionItems.push(
                <Descriptions.Item key="daysRemaining" label="Days Remaining">
                    {selectedDaysLeft < 0
                        ? `${Math.abs(selectedDaysLeft)} overdue`
                        : `${selectedDaysLeft}`}
                </Descriptions.Item>
            )
        }

        descriptionItems.push(
            <Descriptions.Item key="progress" label="Progress">
                <Progress percent={progressPct(selected)} size="small" />
            </Descriptions.Item>
        )

        if (showDeclineReason) {
            descriptionItems.push(
                <Descriptions.Item
                    key="declineReason"
                    label="Decline Reason"
                    span={isMobile ? 1 : 2}
                >
                    {selected.declineReason}
                </Descriptions.Item>
            )
        }
    }

    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            <Helmet>
                <title>Track Interventions | Smart Incubation</title>
            </Helmet>

            {loading && <LoadingOverlay tip="Loading your assignments..." />}

            <DashboardHeaderCard
                title="Assigned Interventions"
                subtitle="Manage and track your assigned interventions"
                extraRight={
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={() => refresh()} />
                        <Segmented
                            value={view}
                            onChange={(v: any) => setView(v)}
                            options={[
                                { label: `Ongoing (${ongoing.length})`, value: 'ongoing' },
                                { label: `History (${history.length})`, value: 'history' }
                            ]}
                        />
                    </Space>
                }
            />

            {/* Filters (applies to whichever segment is active) */}
            <MotionCard style={{ marginTop: 12 }}>
                <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} md={14}>
                        <Input
                            allowClear
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            prefix={<SearchOutlined />}
                            placeholder="Search by beneficiary or intervention title"
                        />
                    </Col>
                    <Col xs={24} md={10}>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }} wrap>
                            <Space size={8}>
                                <FilterOutlined />
                                <Text type="secondary">Status</Text>
                            </Space>
                            <Select
                                value={statusFilter}
                                onChange={v => setStatusFilter(v as any)}
                                style={{ width: isMobile ? '100%' : 220 }}
                            >
                                <Option value="all">All</Option>
                                <Option value="assigned">Assigned</Option>
                                <Option value="in-progress">In Progress</Option>
                                <Option value="completed">Completed</Option>
                                <Option value="rejected">Rejected</Option>
                            </Select>
                        </Space>
                    </Col>
                </Row>
            </MotionCard>

            <MotionCard style={{ marginTop: 12 }}>
                <div style={{ width: '100%', overflowX: 'auto', marginTop: 12 }}>
                    <Table<TableRow>
                        rowKey="id"
                        columns={columns}
                        dataSource={filteredRows}
                        size={isMobile ? 'small' : 'middle'}
                        pagination={{ pageSize: isMobile ? 6 : 10, simple: isMobile }}
                        scroll={{ x: 'max-content' }}
                        sticky
                        onRow={r => ({
                            onClick: () => openView(r)
                        })}
                    />
                </div>
            </MotionCard>

            {/* VIEW MODAL */}
            <Modal
                open={viewOpen}
                onCancel={() => setViewOpen(false)}
                title="Assigned Intervention Details"
                width={isMobile ? '100%' : 920}
                footer={
                    !selected ? null : (
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text type="secondary">
                                <ClockCircleOutlined />{' '}
                                {selectedDaysLeft == null
                                    ? 'No due date set'
                                    : selectedDaysLeft < 0
                                        ? `${Math.abs(selectedDaysLeft)} day(s) overdue`
                                        : `${selectedDaysLeft} day(s) remaining`}
                            </Text>

                            <Space>
                                <Button
                                    danger
                                    variant="filled"
                                    icon={<CloseCircleOutlined />}
                                    style={{ borderRadius: 10 }}
                                    onClick={() => setViewOpen(false)}
                                >
                                    Close
                                </Button>

                                {/* Accept / Decline only inside modal (and group accept/decline is batch) */}
                                {acceptDeclineAllowed(selected) ? (
                                    <>
                                        <Button
                                            shape="round"
                                            variant="filled"
                                            color="geekblue"
                                            icon={<CheckOutlined />}
                                            style={{ border: '1px solid dodgerblue' }}
                                            onClick={() => commitAcceptDecline(selected, 'accept')}
                                        >
                                            Accept
                                        </Button>
                                        <Button
                                            danger
                                            shape="round"
                                            icon={<CloseOutlined />}
                                            style={{ color: 'red' }}
                                            onClick={() => commitAcceptDecline(selected, 'decline')}
                                        >
                                            Decline
                                        </Button>
                                    </>
                                ) : null}

                                {/* When in progress, show Update (navigate) + Reminder */}
                                {selected.status === 'in-progress' ? (
                                    <>
                                        <Button
                                            icon={<RightCircleOutlined />}
                                            shape="round"
                                            variant="filled"
                                            color="primary"
                                            style={{ border: '1px solid dodgerblue' }}
                                            onClick={() => goToUpdate(selected)}
                                        >
                                            Update
                                        </Button>
                                        <Button
                                            style={{ borderRadius: 10, border: '1px solid dodgerblue' }}
                                            variant="filled"
                                            color="geekblue"
                                            icon={<MailOutlined />}
                                            type="primary"
                                            onClick={sendReminderPlaceholder}
                                        >
                                            Send Reminder
                                        </Button>
                                    </>
                                ) : null}
                            </Space>
                        </Space>
                    )
                }
            >
                {!selected ? null : (
                    <>
                        <Descriptions bordered size="small" column={isMobile ? 1 : 2}>
                            {descriptionItems}
                        </Descriptions>

                        <Divider />

                        {/* GROUP: show SMEs list (4-row table) */}
                        {selected.kind === 'group' ? (
                            <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
                                <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                                    <Text strong>Group Members</Text>
                                    <Text type="secondary">{selected.total} SMEs</Text>
                                </Space>

                                <div style={{ marginTop: 10 }}>
                                    <Table
                                        rowKey="id"
                                        size="small"
                                        pagination={{ pageSize: 4, simple: true }}
                                        dataSource={selected.members.map(m => ({
                                            id: m.id,
                                            beneficiaryName: (m as any).beneficiaryName || '—',
                                            incubateeStatus: norm((m as any).incubateeStatus || 'pending'),
                                            assigneeStatus: norm((m as any).assigneeStatus || 'pending'),
                                            dueDate: (m as any).dueDate
                                        }))}
                                        columns={[
                                            { title: 'SME', dataIndex: 'beneficiaryName', key: 'beneficiaryName' },
                                            {
                                                title: 'Incubatee',
                                                key: 'incubateeStatus',
                                                render: (_: any, r: any) => incubateeStatusTag(r.incubateeStatus)
                                            },
                                            {
                                                title: 'Assignee',
                                                key: 'assigneeStatus',
                                                render: (_: any, r: any) => assigneeStatusTag(r.assigneeStatus)
                                            },
                                            {
                                                title: 'Due',
                                                key: 'dueDate',
                                                render: (_: any, r: any) => {
                                                    const d = toDate(r.dueDate)
                                                    return d ? dayjs(d).format('DD MMM YYYY') : '—'
                                                }
                                            }
                                        ]}
                                    />
                                </div>
                            </Card>
                        ) : (
                            // SINGLE: show participant details
                            <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
                                <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                                    <Text strong>Incubatee Details</Text>
                                    {participantLoading && (
                                        <Space size={8}>
                                            <Spin size="small" /> <Text type="secondary">Loading participant…</Text>
                                        </Space>
                                    )}
                                </Space>

                                <div style={{ marginTop: 10 }}>
                                    <Descriptions bordered size="small" column={isMobile ? 1 : 2}>
                                        {descriptionItems}
                                    </Descriptions>
                                </div>
                            </Card>
                        )}
                    </>
                )}
            </Modal>
        </div>
    )
}

export default AllocatedInterventions
