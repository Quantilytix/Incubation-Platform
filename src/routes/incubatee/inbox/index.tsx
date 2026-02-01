import React, { useEffect, useMemo, useState } from 'react'
import { Card, Col, Row, Statistic, Table, Tag, Button, Space, Input, Segmented, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileTextOutlined, FormOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { auth, db } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    Timestamp
} from 'firebase/firestore'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { MotionCard } from '@/components/shared/Header'

// ---------- utils ----------
const toDateSafe = (v: any): Date | null => {
    if (!v) return null
    if (v?.toDate) return v.toDate()
    if (v?.seconds) return new Date(v.seconds * 1000)
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
}
const millis = (v: any) => toDateSafe(v)?.getTime() ?? 0

type InboxItemType = 'survey' | 'assessment'
type InboxStatus = 'pending' | 'in_progress' | 'sent' | 'submitted' | 'completed'

type InboxItem = {
    id: string // assignmentId or requestId
    type: InboxItemType
    title: string
    status: InboxStatus
    deliveryMethod?: 'in_app' | 'email'
    linkToken?: string

    templateId?: string
    participantId: string
    participantEmail?: string

    createdAt?: any
    updatedAt?: any
    sentAt?: any
    dueAt?: any

    // assessments time window fields (optional)
    timeWindowEnabled?: boolean
    startAt?: any
    endAt?: any

    source: 'formAssignments' | 'formRequests'
}

const statusTag = (s: InboxStatus) => {
    const color =
        s === 'submitted' || s === 'completed'
            ? 'green'
            : s === 'in_progress'
                ? 'blue'
                : s === 'sent'
                    ? 'geekblue'
                    : 'orange'
    const label = s.replace('_', ' ')
    return <Tag color={color}>{label.charAt(0).toUpperCase() + label.slice(1)}</Tag>
}

export default function FormsInbox() {
    const { message } = App.useApp()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(true)
    const [participantId, setParticipantId] = useState<string>('')
    const [participantEmail, setParticipantEmail] = useState<string>('')

    const [items, setItems] = useState<InboxItem[]>([])
    const [tab, setTab] = useState<'all' | 'survey' | 'assessment'>('all')
    const [search, setSearch] = useState('')

    // ---------- load participant ----------
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async u => {
            if (!u?.email) return
            setParticipantEmail(u.email.toLowerCase())

            // Find participant by email (your system does this already)
            const pSnap = await getDocs(
                query(collection(db, 'participants'), where('email', '==', u.email))
            )
            if (pSnap.empty) {
                message.error('Participant record not found for this account.')
                setLoading(false)
                return
            }
            setParticipantId(pSnap.docs[0].id)
        })
        return () => unsub()
    }, [message])

    // ---------- load inbox ----------
    useEffect(() => {
        if (!participantId) return

        const run = async () => {
            setLoading(true)
            try {
                const merged: InboxItem[] = []

                // 1) Surveys: formAssignments (participantId OR email fallback)
                //    Note: in your builder you use applicationId in the id and store recipientEmail + applicationId
                //    But the SME side might only know participantId; we cover both participantId and recipientEmail.
                const faQueries: Promise<any>[] = []
                faQueries.push(
                    getDocs(query(collection(db, 'formAssignments'), where('participantId', '==', participantId)))
                )
                if (participantEmail) {
                    faQueries.push(
                        getDocs(query(collection(db, 'formAssignments'), where('recipientEmail', '==', participantEmail)))
                    )
                    faQueries.push(
                        getDocs(query(collection(db, 'formAssignments'), where('email', '==', participantEmail)))
                    )
                }

                const faSnaps = await Promise.all(faQueries)
                const faDocs = faSnaps.flatMap(s => s.docs)

                // de-dup by doc.id
                const faSeen = new Set<string>()
                for (const d of faDocs) {
                    if (faSeen.has(d.id)) continue
                    faSeen.add(d.id)
                    const a = d.data() as any

                    // Resolve title (prefer denormalized)
                    let title = a.templateTitle || a.title
                    if (!title && a.templateId) {
                        try {
                            const tSnap = await getDoc(doc(db, 'formTemplates', a.templateId))
                            title = tSnap.exists() ? (tSnap.data() as any).title : undefined
                        } catch { }
                    }

                    merged.push({
                        id: d.id,
                        type: 'survey',
                        title: title || 'Untitled Survey',
                        status: (a.status || 'pending') as InboxStatus,
                        deliveryMethod: (a.deliveryMethod || 'in_app') as any,
                        linkToken: a.linkToken,
                        templateId: a.templateId,
                        participantId,
                        participantEmail,
                        createdAt: a.createdAt,
                        updatedAt: a.updatedAt,
                        dueAt: a.dueAt,
                        source: 'formAssignments'
                    })
                }

                // 2) Assessments: formRequests (your AssessmentBuilder writes these)
                const frSnap = await getDocs(
                    query(collection(db, 'formRequests'), where('participantId', '==', participantId))
                )

                frSnap.forEach(d => {
                    const r = d.data() as any
                    merged.push({
                        id: d.id,
                        type: 'assessment',
                        title: r.formTitle || r.title || 'Untitled Assessment',
                        status: (r.status || 'sent') as InboxStatus, // you use "sent" there
                        deliveryMethod: 'in_app',
                        templateId: r.templateId,
                        participantId,
                        participantEmail: r.participantEmail || participantEmail,
                        sentAt: r.sentAt,
                        createdAt: r.createdAt,
                        updatedAt: r.updatedAt,
                        dueAt: r.dueAt,
                        timeWindowEnabled: Boolean(r.timeWindowEnabled),
                        startAt: r.startAt,
                        endAt: r.endAt,
                        source: 'formRequests'
                    })
                })

                // Sort newest: updatedAt > sentAt > createdAt
                merged.sort((a, b) => {
                    const ta = Math.max(millis(a.updatedAt), millis(a.sentAt), millis(a.createdAt))
                    const tb = Math.max(millis(b.updatedAt), millis(b.sentAt), millis(b.createdAt))
                    return tb - ta
                })

                setItems(merged)
            } catch (e) {
                console.error(e)
                message.error('Failed to load your inbox.')
                setItems([])
            } finally {
                setLoading(false)
            }
        }

        run()
    }, [participantId, participantEmail, message])

    // ---------- filters ----------
    const filtered = useMemo(() => {
        const s = search.trim().toLowerCase()
        return items.filter(it => {
            if (tab !== 'all' && it.type !== tab) return false
            if (!s) return true
            return (
                (it.title || '').toLowerCase().includes(s) ||
                (it.type || '').toLowerCase().includes(s) ||
                (it.status || '').toLowerCase().includes(s)
            )
        })
    }, [items, tab, search])

    // ---------- metrics ----------
    const metrics = useMemo(() => {
        const total = items.length
        const surveys = items.filter(i => i.type === 'survey').length
        const assessments = items.filter(i => i.type === 'assessment').length
        const completed = items.filter(i => i.status === 'submitted' || i.status === 'completed').length
        const pending = items.filter(i => ['pending', 'sent', 'in_progress'].includes(i.status)).length
        return { total, surveys, assessments, completed, pending }
    }, [items])

    const openItem = (row: InboxItem) => {
        if (row.type === 'survey') {
            const q = row.linkToken ? `?token=${row.linkToken}` : ''
            navigate(`/incubatee/surveys/${row.id}${q}`)
            return
        }
        // assessments route (align this with your submission page)
        navigate(`/incubatee/assessments/${row.id}`)
    }

    const cols: ColumnsType<InboxItem> = [
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (t: InboxItemType) => (
                <Tag color={t === 'survey' ? 'blue' : 'purple'}>
                    {t === 'survey' ? 'Survey' : 'Assessment'}
                </Tag>
            )
        },
        { title: 'Title', dataIndex: 'title', key: 'title' },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (s: InboxStatus) => statusTag(s)
        },
        {
            title: 'Due',
            key: 'dueAt',
            render: (_: any, r: InboxItem) => {
                const d = toDateSafe(r.dueAt)
                return d ? dayjs(d).format('YYYY-MM-DD') : '-'
            }
        },
        {
            title: 'Updated',
            key: 'updatedAt',
            render: (_: any, r: InboxItem) => {
                const d = toDateSafe(r.updatedAt || r.sentAt || r.createdAt)
                return d ? dayjs(d).format('YYYY-MM-DD') : '-'
            }
        },
        {
            title: 'Action',
            key: 'action',
            render: (_: any, r: InboxItem) => (
                <Button type="link" onClick={() => openItem(r)}>
                    Open
                </Button>
            )
        }
    ]

    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            <Row gutter={[16, 16]}>
                <Col xs={24} md={6}>
                    <MotionCard>
                        <Statistic title="Total" value={metrics.total} prefix={<FileTextOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} md={6}>
                    <MotionCard>
                        <Statistic title="Surveys" value={metrics.surveys} prefix={<FormOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} md={6}>
                    <MotionCard>
                        <Statistic title="Assessments" value={metrics.assessments} prefix={<ClockCircleOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} md={6}>
                    <MotionCard>
                        <Statistic title="Completed" value={metrics.completed} prefix={<CheckCircleOutlined />} />
                    </MotionCard>
                </Col>

                <Col xs={24}>
                    <Card
                        title="My Forms Inbox"
                        extra={
                            <Space wrap>
                                <Segmented
                                    value={tab}
                                    onChange={(v: any) => setTab(v)}
                                    options={[
                                        { label: 'All', value: 'all' },
                                        { label: 'Surveys', value: 'survey' },
                                        { label: 'Assessments', value: 'assessment' }
                                    ]}
                                />
                                <Input.Search
                                    placeholder="Search title, status..."
                                    allowClear
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ width: 320 }}
                                />
                            </Space>
                        }
                    >
                        <Table
                            rowKey="id"
                            loading={loading}
                            dataSource={filtered}
                            columns={cols}
                            pagination={{ pageSize: 10 }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    )
}
