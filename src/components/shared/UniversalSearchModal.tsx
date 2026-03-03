// components/shared/UniversalSearchModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Button, Card, Empty, Input, Modal, Space, Spin, Tag, Typography } from 'antd'
import { EyeOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import {
    collection,
    getDocs,
    limit,
    query,
    where,
    type DocumentData
} from 'firebase/firestore'
import dayjs from 'dayjs'
import { db } from '@/firebase'
import { useNavigate } from 'react-router-dom'

const { Text, Title } = Typography

type UserRole =
    | 'admin'
    | 'funder'
    | 'consultant'
    | 'incubatee'
    | 'operations'
    | 'director'
    | 'projectadmin'
    | 'investor'
    | 'government'

type AnyDoc = Record<string, any>

type UserHit = {
    id: string
    role?: UserRole | string
    name?: string
    displayName?: string
    fullName?: string
    email?: string
    phone?: string
    userImage?: string
    photoURL?: string
    companyCode?: string
    [k: string]: any
}

type ParticipantHit = {
    id: string
    email?: string
    phone?: string
    name?: string
    companyName?: string
    userImage?: string
    [k: string]: any
}

type AssignedInterventionHit = {
    id: string
    participantId?: string
    beneficiaryName?: string
    interventionTitle?: string
    interventionId?: string
    status?: string
    assigneeType?: string
    assigneeName?: string
    assigneeEmail?: string
    assigneeId?: string
    dueDate?: any
    implementationDate?: any
    createdAt?: any
    programId?: string
    [k: string]: any
}

const norm = (v: any) => String(v ?? '').trim().toLowerCase()

const toDate = (v: any): Date | null => {
    if (!v) return null
    if (v?.toDate) return v.toDate()
    if (typeof v === 'object' && v?.seconds && typeof v.seconds === 'number') return new Date(v.seconds * 1000)
    const d = new Date(v)
    return isNaN(+d) ? null : d
}

const statusTag = (s?: string) => {
    const v = norm(s)
    if (!v) return <Tag>unknown</Tag>
    if (v === 'completed') return <Tag color='green'>completed</Tag>
    if (v === 'in-progress' || v === 'inprogress') return <Tag color='blue'>in-progress</Tag>
    if (v === 'assigned') return <Tag color='gold'>assigned</Tag>
    if (v === 'cancelled' || v === 'canceled') return <Tag color='default'>cancelled</Tag>
    return <Tag>{v}</Tag>
}

const roleColor = (r?: string) => {
    const v = norm(r)
    if (v === 'admin') return 'red'
    if (v === 'director') return 'purple'
    if (v === 'projectadmin') return 'volcano'
    if (v === 'operations') return 'geekblue'
    if (v === 'consultant') return 'cyan'
    if (v === 'incubatee') return 'green'
    if (v === 'funder') return 'gold'
    if (v === 'investor') return 'magenta'
    if (v === 'government') return 'blue'
    return 'default'
}

const resolveName = (u: AnyDoc) =>
    String(u?.name || u?.displayName || u?.fullName || u?.firstName || u?.surname || 'Unknown User').trim()

const resolveEmail = (u: AnyDoc) => String(u?.email || u?.userEmail || '').trim()

const resolvePhone = (u: AnyDoc) => String(u?.phone || u?.phoneNumber || u?.mobile || '').trim()

const resolvePhoto = (u: AnyDoc) => String(u?.userImage || u?.photoURL || u?.avatar || '').trim()

const viewRouteForRole = (role?: string, uid?: string) => {
    const r = norm(role)
    const id = encodeURIComponent(String(uid || ''))
    if (r === 'incubatee') return `/operations/participants?uid=${id}`
    if (r === 'consultant') return `/operations/consultants?uid=${id}`
    if (r === 'operations') return `/director/operators?uid=${id}`
    if (r === 'director') return `/director`
    if (r === 'admin') return `/admin/users?uid=${id}`
    if (r === 'projectadmin') return `/applications?uid=${id}`
    if (r === 'funder') return `/funder`
    if (r === 'investor') return `/investor`
    if (r === 'government') return `/government`
    return `/admin/users?uid=${id}`
}

export const UniversalSearchModal: React.FC<{
    open: boolean
    onClose: () => void
    companyCode?: string
    activeProgramId?: string
    initialQuery?: string
}> = ({ open, onClose, companyCode, activeProgramId, initialQuery }) => {
    const navigate = useNavigate()

    const [qText, setQText] = useState('')
    const [loading, setLoading] = useState(false)

    const [users, setUsers] = useState<UserHit[]>([])
    const [participantsByEmail, setParticipantsByEmail] = useState<Record<string, ParticipantHit | null>>({})
    const [activeAssignmentsByUserId, setActiveAssignmentsByUserId] = useState<Record<string, AssignedInterventionHit[]>>(
        {}
    )

    const debounceRef = useRef<number | null>(null)

    useEffect(() => {
        if (!open) return
        const v = String(initialQuery || '').trim()
        setQText(v)
        setUsers([])
        setParticipantsByEmail({})
        setActiveAssignmentsByUserId({})
        setLoading(false)
    }, [open, initialQuery])

    const effectiveQuery = useMemo(() => String(qText || '').trim(), [qText])

    const runSearch = async (raw: string) => {
        const qv = String(raw || '').trim()
        if (!companyCode || qv.length < 2) {
            setUsers([])
            setParticipantsByEmail({})
            setActiveAssignmentsByUserId({})
            return
        }

        setLoading(true)
        try {
            const qLower = norm(qv)
            const isEmail = qLower.includes('@')

            // Users: best-effort (exact email match if email; otherwise companyCode-limited fetch + local filter)
            let found: UserHit[] = []

            if (isEmail) {
                const uq = query(
                    collection(db, 'users'),
                    where('companyCode', '==', companyCode),
                    where('email', '==', qv),
                    limit(10)
                )
                const snap = await getDocs(uq)
                found = snap.docs.map(d => ({ id: d.id, ...(d.data() as AnyDoc) } as UserHit))

                // fallback: emailLower if present
                if (!found.length) {
                    const uq2 = query(
                        collection(db, 'users'),
                        where('companyCode', '==', companyCode),
                        where('emailLower', '==', qLower),
                        limit(10)
                    )
                    const snap2 = await getDocs(uq2)
                    found = snap2.docs.map(d => ({ id: d.id, ...(d.data() as AnyDoc) } as UserHit))
                }
            }

            if (!found.length) {
                // Local filter (bounded) to avoid needing special indexes everywhere
                const uq = query(collection(db, 'users'), where('companyCode', '==', companyCode), limit(120))
                const snap = await getDocs(uq)
                const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as AnyDoc) } as UserHit))

                const filtered = all.filter(u => {
                    const name = norm(resolveName(u))
                    const email = norm(resolveEmail(u))
                    return name.includes(qLower) || email.includes(qLower)
                })

                found = filtered.slice(0, 15)
            }

            // Participants lookup (only if we have an email; helps incubatee details + participantId mapping)
            const pByEmail: Record<string, ParticipantHit | null> = {}
            for (const u of found) {
                const email = resolveEmail(u)
                if (!email) continue

                if (pByEmail[email] !== undefined) continue
                try {
                    const pq = query(
                        collection(db, 'participants'),
                        where('companyCode', '==', companyCode),
                        where('email', '==', email),
                        limit(1)
                    )
                    const ps = await getDocs(pq)
                    pByEmail[email] = ps.empty ? null : ({ id: ps.docs[0].id, ...(ps.docs[0].data() as AnyDoc) } as any)
                } catch {
                    pByEmail[email] = null
                }
            }

            // Assigned interventions (active delivery): for incubatees => by participantId; for consultants/ops => by assigneeId
            const assignmentsByUid: Record<string, AssignedInterventionHit[]> = {}

            for (const u of found) {
                const uid = String(u.id || '')
                const role = norm(u.role)
                const email = resolveEmail(u)
                const participant = email ? pByEmail[email] : null

                try {
                    let rows: AssignedInterventionHit[] = []

                    if (role === 'incubatee' && participant?.id) {
                        const aq = query(
                            collection(db, 'assignedInterventions'),
                            where('companyCode', '==', companyCode),
                            where('participantId', '==', participant.id),
                            where('status', 'in', ['assigned', 'in-progress']),
                            limit(25)
                        )
                        const as = await getDocs(aq)
                        rows = as.docs.map(d => ({ id: d.id, ...(d.data() as AnyDoc) } as AssignedInterventionHit))
                    } else if ((role === 'consultant' || role === 'operations') && uid) {
                        const aq = query(
                            collection(db, 'assignedInterventions'),
                            where('companyCode', '==', companyCode),
                            where('assigneeId', '==', uid),
                            where('status', 'in', ['assigned', 'in-progress']),
                            limit(25)
                        )
                        const as = await getDocs(aq)
                        rows = as.docs.map(d => ({ id: d.id, ...(d.data() as AnyDoc) } as AssignedInterventionHit))
                    } else {
                        rows = []
                    }

                    if (activeProgramId) {
                        rows = rows.filter(r => !r.programId || String(r.programId) === String(activeProgramId))
                    }

                    assignmentsByUid[uid] = rows
                } catch {
                    assignmentsByUid[uid] = []
                }
            }

            setUsers(found)
            setParticipantsByEmail(pByEmail)
            setActiveAssignmentsByUserId(assignmentsByUid)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!open) return
        if (debounceRef.current) window.clearTimeout(debounceRef.current)
        debounceRef.current = window.setTimeout(() => runSearch(effectiveQuery), 350)
        return () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, effectiveQuery, companyCode, activeProgramId])

    return (
        <Modal
            title={null}
            open={open}
            onCancel={onClose}
            footer={null}
            width={980}
            destroyOnClose
            styles={{ body: { padding: 14 } as any }}
        >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Input
                        autoFocus
                        allowClear
                        value={qText}
                        onChange={e => setQText(e.target.value)}
                        prefix={<SearchOutlined />}
                        placeholder='Search user by name or email...'
                        onPressEnter={() => runSearch(qText)}
                        style={{ height: 40, borderRadius: 9999 }}
                    />
                </div>
                <Button
                    type='primary'
                    onClick={() => runSearch(qText)}
                    style={{ height: 40, borderRadius: 9999, paddingInline: 18 }}
                >
                    Search
                </Button>
            </div>

            <div style={{ minHeight: 380 }}>
                {loading ? (
                    <div style={{ display: 'grid', placeItems: 'center', height: 360 }}>
                        <Spin />
                    </div>
                ) : !users.length ? (
                    <div style={{ padding: 24 }}>
                        <Empty description='No matches' />
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                        {users.map(u => {
                            const name = resolveName(u)
                            const email = resolveEmail(u)
                            const phone = resolvePhone(u)
                            const photo = resolvePhoto(u)
                            const role = String(u.role || '').trim()
                            const participant = email ? participantsByEmail[email] : null
                            const participantPhone = participant ? resolvePhone(participant) : ''
                            const deliveries = activeAssignmentsByUserId[String(u.id || '')] || []

                            const dueSoon = deliveries
                                .map(d => toDate(d.dueDate))
                                .filter(Boolean)
                                .sort((a, b) => +a! - +b!)[0]

                            return (
                                <Card
                                    key={u.id}
                                    size='small'
                                    style={{
                                        borderRadius: 16,
                                        border: '1px solid rgba(0,0,0,0.06)',
                                        boxShadow: '0 10px 22px rgba(0,0,0,0.06)'
                                    }}
                                    bodyStyle={{ padding: 14 }}
                                >
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        <Avatar
                                            size={52}
                                            src={photo || undefined}
                                            icon={!photo ? <UserOutlined /> : undefined}
                                            style={{ background: '#f5f5f5', flex: '0 0 auto' }}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <Title level={5} style={{ margin: 0, lineHeight: 1.2 }}>
                                                        {name}
                                                    </Title>
                                                    <div style={{ marginTop: 2 }}>
                                                        <Text type='secondary' style={{ wordBreak: 'break-word' }}>
                                                            {email || 'No email'}
                                                        </Text>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    {!!role && <Tag color={roleColor(role)}>{role}</Tag>}
                                                    <Button
                                                        icon={<EyeOutlined />}
                                                        shape='round'
                                                        onClick={() => {
                                                            onClose()
                                                            navigate(viewRouteForRole(role, u.id))
                                                        }}
                                                    >
                                                        View
                                                    </Button>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                {!!phone && <Tag>{phone}</Tag>}
                                                {!phone && !!participantPhone && <Tag>{participantPhone}</Tag>}
                                                {participant?.companyName ? <Tag color='blue'>{String(participant.companyName)}</Tag> : null}
                                            </div>

                                            <div style={{ marginTop: 10 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Text strong>Active deliveries</Text>
                                                    <Tag color={deliveries.length ? 'geekblue' : 'default'}>
                                                        {deliveries.length}
                                                    </Tag>
                                                </div>

                                                {deliveries.length ? (
                                                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        {deliveries.slice(0, 3).map(d => {
                                                            const due = toDate(d.dueDate)
                                                            const dueLabel = due ? dayjs(due).format('DD MMM YYYY') : ''
                                                            return (
                                                                <div
                                                                    key={d.id}
                                                                    style={{
                                                                        padding: 10,
                                                                        borderRadius: 12,
                                                                        border: '1px solid rgba(0,0,0,0.06)',
                                                                        background: 'rgba(255,255,255,0.7)',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        gap: 10
                                                                    }}
                                                                >
                                                                    <div style={{ minWidth: 0 }}>
                                                                        <Text strong style={{ display: 'block' }}>
                                                                            {String(d.interventionTitle || 'Untitled Intervention')}
                                                                        </Text>
                                                                        <Text type='secondary' style={{ fontSize: 12 }}>
                                                                            {d.assigneeName ? `Assignee: ${d.assigneeName}` : d.assigneeEmail ? `Assignee: ${d.assigneeEmail}` : ''}
                                                                            {dueLabel ? ` • Due: ${dueLabel}` : ''}
                                                                        </Text>
                                                                    </div>
                                                                    <div style={{ flex: '0 0 auto' }}>{statusTag(d.status)}</div>
                                                                </div>
                                                            )
                                                        })}
                                                        {deliveries.length > 3 ? (
                                                            <Text type='secondary' style={{ fontSize: 12 }}>
                                                                +{deliveries.length - 3} more
                                                            </Text>
                                                        ) : null}
                                                        {dueSoon ? (
                                                            <Text type='secondary' style={{ fontSize: 12 }}>
                                                                Next due: {dayjs(dueSoon).format('DD MMM YYYY')}
                                                            </Text>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <div style={{ marginTop: 8 }}>
                                                        <Text type='secondary'>No active assigned/in-progress interventions found.</Text>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>
        </Modal>
    )
}

export default UniversalSearchModal
