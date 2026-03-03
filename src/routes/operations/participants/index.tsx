// src/pages/operations/OperationsParticipantsManagement.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
    Card,
    Row,
    Col,
    Table,
    Tag,
    Button,
    Progress,
    Input,
    message,
    Typography,
    Modal,
    Descriptions,
    Space,
    Alert,
    Spin
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    TeamOutlined,
    PlusOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    EyeOutlined,
    BarChartOutlined,
    InfoCircleOutlined
} from '@ant-design/icons'
import { db } from '@/firebase'
import { Helmet } from 'react-helmet'
import { collection, getDocs, query, where, documentId } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { useActiveProgramId } from '@/lib/useActiveProgramId'
import { usePrograms } from '@/lib/usePrograms'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'
import { MotionCard } from '@/components/shared/Header'

const { Text } = Typography

const calculateProgress = (required: number, completed: number) => {
    if (!required || required === 0) return 0
    return Math.round((completed / required) * 100)
}

type AnyDoc = Record<string, any>

type ParticipantRow = {
    id: string
    beneficiaryName?: string
    sector?: string
    stage?: string
    email?: string

    interventions?: {
        required?: any[]
        completed?: any[]
        assigned?: any[]
        participationRate?: number
    }

    progress?: number

    // view modal fields
    appliedAt?: any
    registeredByLabel?: string
    complianceScore?: number
    riskLevel?: string
    complianceStatus?: string
}

const formatDate = (v: any) => {
    if (!v) return ''
    const d = v?.toDate?.() ? v.toDate() : v
    return dayjs(d).isValid() ? dayjs(d).format('YYYY-MM-DD HH:mm') : ''
}

const scoreColor = (score?: number) => {
    if (typeof score !== 'number') return 'default'
    if (score >= 80) return 'green'
    if (score >= 60) return 'blue'
    if (score >= 40) return 'orange'
    return 'red'
}

const riskColor = (risk?: string) => {
    switch (String(risk || '').toLowerCase()) {
        case 'low':
            return 'green'
        case 'medium':
            return 'orange'
        case 'high':
            return 'red'
        default:
            return 'default'
    }
}

const labelOrHide = (v: any) => {
    if (v === null || v === undefined) return null
    const s = String(v).trim()
    if (!s || s === '-' || s === '—') return null
    return s
}

const OperationsParticipantsManagement: React.FC = () => {
    const navigate = useNavigate()
    const { user } = useFullIdentity()

    const activeProgramId = useActiveProgramId()
    const { programs, loadingPrograms } = usePrograms()

    const activeProgramName = useMemo(() => {
        if (!activeProgramId) return ''
        return programs.find(p => p.id === activeProgramId)?.name || ''
    }, [activeProgramId, programs])

    const [participants, setParticipants] = useState<ParticipantRow[]>([])
    const [filteredParticipants, setFilteredParticipants] = useState<ParticipantRow[]>([])
    const [searchText, setSearchText] = useState('')
    const [loading, setLoading] = useState(true)

    const [metrics, setMetrics] = useState({
        totalParticipants: 0,
        totalRequiredInterventions: 0,
        totalCompletedInterventions: 0,
        totalNeedingAssignment: 0
    })

    const [viewOpen, setViewOpen] = useState(false)
    const [viewLoading, setViewLoading] = useState(false)
    const [viewRecord, setViewRecord] = useState<ParticipantRow | null>(null)

    const canLoad = !!user?.companyCode && !!activeProgramId

    useEffect(() => {
        const fetchParticipants = async () => {
            if (!canLoad) {
                setParticipants([])
                setLoading(false)
                return
            }

            setLoading(true)
            try {
                const companyCode = String((user as any).companyCode)
                const role = String((user as any)?.role || '').toLowerCase()
                const myUid = (user as any)?.uid || null
                const myEmail = (user as any)?.email || null

                let appsQuery: any = query(
                    collection(db, 'applications'),
                    where('companyCode', '==', companyCode),
                    where('programId', '==', activeProgramId),
                    where('applicationStatus', '==', 'accepted')
                )

                if (role === 'consultant') {
                    if (myUid) {
                        appsQuery = query(
                            collection(db, 'applications'),
                            where('companyCode', '==', companyCode),
                            where('programId', '==', activeProgramId),
                            where('applicationStatus', '==', 'accepted'),
                            where('registeredBy.uid', '==', myUid)
                        )
                    } else if (myEmail) {
                        appsQuery = query(
                            collection(db, 'applications'),
                            where('companyCode', '==', companyCode),
                            where('programId', '==', activeProgramId),
                            where('applicationStatus', '==', 'accepted'),
                            where('registeredBy.email', '==', myEmail)
                        )
                    }
                }

                const applicationSnap = await getDocs(appsQuery)
                const apps = applicationSnap.docs.map(d => ({
                    id: d.id,
                    ...(d.data() as AnyDoc)
                }))

                const participantIds = Array.from(
                    new Set(apps.map(a => a.participantId || a.id).filter(Boolean))
                )

                if (!participantIds.length) {
                    setParticipants([])
                    return
                }

                const participantDocs: Record<string, AnyDoc> = {}
                const chunkSize = 10

                for (let i = 0; i < participantIds.length; i += chunkSize) {
                    const chunk = participantIds.slice(i, i + chunkSize)
                    const pSnap = await getDocs(
                        query(collection(db, 'participants'), where(documentId(), 'in', chunk))
                    )
                    pSnap.docs.forEach(p => {
                        participantDocs[p.id] = p.data() as AnyDoc
                    })
                }

                const rows: ParticipantRow[] = apps.map(app => {
                    const participantId = app.participantId || app.id
                    const participant = participantDocs[participantId] || {}

                    const interventions = app.interventions || participant.interventions || {}
                    const required = Array.isArray(interventions.required) ? interventions.required : []
                    const completed = Array.isArray(interventions.completed) ? interventions.completed : []
                    const assigned = Array.isArray(interventions.assigned) ? interventions.assigned : []

                    const progress = calculateProgress(required.length, completed.length)

                    const reg = app.registeredBy || null
                    const registeredByLabel = reg?.name || reg?.email || reg?.uid || ''

                    return {
                        id: participantId,

                        beneficiaryName: participant.beneficiaryName || app.beneficiaryName,
                        sector: participant.sector || app.sector,
                        stage: app.stage || participant.stage,
                        email: participant.email || app.email,

                        interventions: {
                            required,
                            completed,
                            assigned,
                            participationRate: interventions.participationRate || 0
                        },

                        progress,

                        appliedAt: app.createdAt || app.appliedAt || app.submittedAt || null,
                        registeredByLabel,

                        complianceScore:
                            typeof app.complianceScore === 'number'
                                ? app.complianceScore
                                : typeof participant.complianceScore === 'number'
                                    ? participant.complianceScore
                                    : undefined,
                        riskLevel: app.riskLevel || participant.riskLevel || participant.risk || undefined,
                        complianceStatus: app.complianceStatus || participant.complianceStatus || undefined
                    }
                })

                setParticipants(rows)
            } catch (e) {
                console.error(e)
                message.error('Failed to load participants')
                setParticipants([])
            } finally {
                setLoading(false)
            }
        }

        fetchParticipants()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.companyCode, (user as any)?.role, (user as any)?.uid, (user as any)?.email, activeProgramId])

    useEffect(() => {
        setMetrics({
            totalParticipants: participants.length,
            totalRequiredInterventions: participants.reduce(
                (a, p) => a + (p.interventions?.required?.length || 0),
                0
            ),
            totalCompletedInterventions: participants.reduce(
                (a, p) => a + (p.interventions?.completed?.length || 0),
                0
            ),
            totalNeedingAssignment: participants.filter(
                p => (p.interventions?.assigned?.length || 0) === 0
            ).length
        })
    }, [participants])

    useEffect(() => {
        let filtered = participants

        if (searchText.trim()) {
            const s = searchText.trim().toLowerCase()
            filtered = filtered.filter(
                p =>
                    String(p.beneficiaryName || '').toLowerCase().includes(s) ||
                    String(p.sector || '').toLowerCase().includes(s) ||
                    String(p.email || '').toLowerCase().includes(s)
            )
        }

        setFilteredParticipants(filtered)
    }, [participants, searchText])

    const openView = async (record: ParticipantRow) => {
        setViewLoading(true)
        setViewRecord(null)
        setViewOpen(true)
        try {
            setViewRecord(record)
        } finally {
            setViewLoading(false)
        }
    }

    const columns: ColumnsType<ParticipantRow> = useMemo(
        () => [
            {
                title: 'Beneficiary Name',
                dataIndex: 'beneficiaryName',
                key: 'beneficiaryName',
                render: (v: any) => <Text strong>{labelOrHide(v) || ''}</Text>
            },
            {
                title: 'Sector',
                dataIndex: 'sector',
                key: 'sector',
                render: (v: any) => labelOrHide(v) || ''
            },
            {
                title: 'Stage',
                dataIndex: 'stage',
                key: 'stage',
                render: (v: any) => labelOrHide(v) || ''
            },
            {
                title: 'Compliance',
                key: 'complianceScore',
                render: (_: any, r: ParticipantRow) =>
                    typeof r.complianceScore === 'number' ? (
                        <Tag color={scoreColor(r.complianceScore)}>{r.complianceScore}%</Tag>
                    ) : (
                        ''
                    )
            },
            {
                title: 'Risk',
                key: 'riskLevel',
                render: (_: any, r: ParticipantRow) =>
                    r.riskLevel ? <Tag color={riskColor(r.riskLevel)}>{String(r.riskLevel)}</Tag> : ''
            },
            {
                title: 'Required',
                key: 'required',
                render: (record: ParticipantRow) => record.interventions?.required?.length ?? 0
            },
            {
                title: 'Completed',
                key: 'completed',
                render: (record: ParticipantRow) => record.interventions?.completed?.length ?? 0
            },
            {
                title: 'Progress',
                key: 'progress',
                render: (record: ParticipantRow) => (
                    <Progress
                        percent={record.progress || 0}
                        size="small"
                        status={(record.progress || 0) === 100 ? 'success' : 'active'}
                    />
                )
            },
            {
                title: 'Participation',
                key: 'participationRate',
                render: (record: ParticipantRow) => `${record.interventions?.participationRate ?? 0}%`
            },
            {
                title: 'Actions',
                key: 'actions',
                render: (_: any, record: ParticipantRow) => (
                    <Space size={8}>
                        <Button
                            shape="round"
                            icon={<EyeOutlined />}
                            style={{ border: '1px solid dodgerblue' }}
                            onClick={() => openView(record)}
                        >
                            View
                        </Button>

                        <Button
                            shape="round"
                            icon={<BarChartOutlined />}
                            style={{ border: '1px solid limegreen' }}
                            onClick={() =>
                                navigate(`/operations/participants/${record.id}/performance`, {
                                    state: {
                                        name: record.beneficiaryName || '',
                                        programId: activeProgramId
                                    }
                                })
                            }
                        >
                            Performance
                        </Button>
                    </Space>
                )
            }
        ],
        [activeProgramId, navigate]
    )

    const topMetrics = useMemo(
        () => [
            {
                title: 'Total Participants',
                value: metrics.totalParticipants,
                icon: <TeamOutlined style={{ color: '#1890ff', fontSize: 18 }} />,
                iconBg: 'rgba(24,144,255,.12)'
            },
            {
                title: 'Required Interventions',
                value: metrics.totalRequiredInterventions,
                icon: <PlusOutlined style={{ color: '#096dd9', fontSize: 18 }} />,
                iconBg: 'rgba(9,109,217,.12)'
            },
            {
                title: 'Completed Interventions',
                value: metrics.totalCompletedInterventions,
                icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />,
                iconBg: 'rgba(82,196,26,.12)'
            },
            {
                title: 'Need Assignment',
                value: metrics.totalNeedingAssignment,
                icon: <WarningOutlined style={{ color: '#faad14', fontSize: 18 }} />,
                iconBg: 'rgba(250,173,20,.12)'
            }
        ],
        [metrics]
    )

    return (
        <div style={{ padding: 8, minHeight: '100vh' }}>
            <Helmet>
                <title>Participant Management | Incubation Platform</title>
            </Helmet>

            {!activeProgramId ? (
                <Alert
                    type="warning"
                    showIcon
                    message="No active program selected"
                    description="Select an active program to view participants."
                    style={{ marginBottom: 12 }}
                />
            ) : null}

            <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
                {topMetrics.map((metric, index) => (
                    <Col xs={24} sm={12} md={6} key={metric.title}>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: index * 0.08 }}
                        >
                            <MotionCard bodyStyle={{ padding: 14 }} style={{ height: '100%' }}>
                                <MotionCard.Metric
                                    icon={metric.icon}
                                    iconBg={metric.iconBg}
                                    title={metric.title}
                                    value={metric.value}
                                />
                            </MotionCard>
                        </motion.div>
                    </Col>
                ))}
            </Row>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <Card
                    hoverable
                    style={{
                        boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                        transition: 'all 0.3s ease',
                        borderRadius: 8,
                        marginBottom: 10,
                        border: '1px solid #d6e4ff'
                    }}
                >
                    <Row gutter={16} align="middle">
                        <Col xs={24} md={12}>
                            <Input
                                placeholder="Search by name, sector, or email"
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                allowClear
                            />
                        </Col>

                        <Col xs={24} md={12} style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            {activeProgramName ? (
                                <Tag color="blue" style={{ borderRadius: 999, padding: '2px 10px' }}>
                                    {loadingPrograms ? 'Loading program...' : activeProgramName}
                                </Tag>
                            ) : null}

                            <Button
                                shape="round"
                                type="primary"
                                icon={<PlusOutlined />}
                                style={{ border: '1px solid dodgerblue' }}
                                disabled={!activeProgramId}
                                onClick={() =>
                                    navigate('/operations/participants/new', {
                                        state: { activeProgramId }
                                    })
                                }
                            >
                                Add Participant
                            </Button>
                        </Col>
                    </Row>
                </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <Card
                    hoverable
                    style={{
                        boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                        transition: 'all 0.3s ease',
                        borderRadius: 8,
                        border: '1px solid #d6e4ff'
                    }}
                >
                    <Table
                        dataSource={filteredParticipants}
                        columns={columns}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 8 }}
                    />
                </Card>
            </motion.div>

            <Modal
                title={
                    <Space>
                        <InfoCircleOutlined />
                        <span>SME Details</span>
                    </Space>
                }
                open={viewOpen}
                onCancel={() => {
                    setViewOpen(false)
                    setViewRecord(null)
                }}
                footer={[
                    <Button
                        key="close"
                        shape="round"
                        onClick={() => {
                            setViewOpen(false)
                            setViewRecord(null)
                        }}
                    >
                        Close
                    </Button>,
                    <Button
                        key="performance"
                        shape="round"
                        type="primary"
                        icon={<BarChartOutlined />}
                        style={{ border: '1px solid limegreen' }}
                        disabled={!viewRecord}
                        onClick={() => {
                            if (!viewRecord) return
                            setViewOpen(false)
                            navigate(`/operations/participants/${viewRecord.id}/performance`, {
                                state: {
                                    name: viewRecord.beneficiaryName || '',
                                    programId: activeProgramId
                                }
                            })
                        }}
                    >
                        View Performance
                    </Button>
                ]}
                width={900}
            >
                {viewLoading ? (
                    <Spin />
                ) : !viewRecord ? (
                    <Alert type="warning" showIcon message="No record selected" />
                ) : (
                    <>
                        <Descriptions bordered size="small" column={2}>
                            {labelOrHide(viewRecord.beneficiaryName) ? (
                                <Descriptions.Item label="Beneficiary">
                                    {viewRecord.beneficiaryName}
                                </Descriptions.Item>
                            ) : null}

                            {labelOrHide(viewRecord.sector) ? (
                                <Descriptions.Item label="Sector">{viewRecord.sector}</Descriptions.Item>
                            ) : null}

                            {labelOrHide(viewRecord.stage) ? (
                                <Descriptions.Item label="Stage">{viewRecord.stage}</Descriptions.Item>
                            ) : null}

                            {labelOrHide(viewRecord.appliedAt) ? (
                                <Descriptions.Item label="Applied At">{formatDate(viewRecord.appliedAt)}</Descriptions.Item>
                            ) : null}

                            {labelOrHide(viewRecord.registeredByLabel) ? (
                                <Descriptions.Item label="Registered By">{viewRecord.registeredByLabel}</Descriptions.Item>
                            ) : null}

                            {typeof viewRecord.complianceScore === 'number' ? (
                                <Descriptions.Item label="Compliance Score">
                                    <Tag color={scoreColor(viewRecord.complianceScore)}>{viewRecord.complianceScore}%</Tag>
                                </Descriptions.Item>
                            ) : null}

                            {labelOrHide(viewRecord.complianceStatus) ? (
                                <Descriptions.Item label="Compliance Status">
                                    <Tag>{String(viewRecord.complianceStatus)}</Tag>
                                </Descriptions.Item>
                            ) : null}

                            {labelOrHide(viewRecord.riskLevel) ? (
                                <Descriptions.Item label="Risk Level">
                                    <Tag color={riskColor(viewRecord.riskLevel)}>{String(viewRecord.riskLevel)}</Tag>
                                </Descriptions.Item>
                            ) : null}

                            <Descriptions.Item label="Participation Rate">
                                {viewRecord.interventions?.participationRate ?? 0}%
                            </Descriptions.Item>

                            <Descriptions.Item label="Required Interventions">
                                {viewRecord.interventions?.required?.length ?? 0}
                            </Descriptions.Item>

                            <Descriptions.Item label="Completed Interventions">
                                {viewRecord.interventions?.completed?.length ?? 0}
                            </Descriptions.Item>

                            <Descriptions.Item label="Assigned Interventions" span={2}>
                                {viewRecord.interventions?.assigned?.length ? (
                                    <Space wrap>
                                        {viewRecord.interventions.assigned.slice(0, 12).map((x: any, idx: number) => (
                                            <Tag key={`${idx}-${String(x?.title || x?.name || x?.interventionTitle || idx)}`}>
                                                {String(x?.title || x?.name || x?.interventionTitle || '').trim()}
                                            </Tag>
                                        ))}
                                        {viewRecord.interventions.assigned.length > 12 ? (
                                            <Tag>+{viewRecord.interventions.assigned.length - 12} more</Tag>
                                        ) : null}
                                    </Space>
                                ) : (
                                    <Tag color="red">None</Tag>
                                )}
                            </Descriptions.Item>
                        </Descriptions>

                        {(!labelOrHide(viewRecord.beneficiaryName) &&
                            !labelOrHide(viewRecord.sector) &&
                            !labelOrHide(viewRecord.stage) &&
                            typeof viewRecord.complianceScore !== 'number' &&
                            !labelOrHide(viewRecord.riskLevel) &&
                            !labelOrHide(viewRecord.complianceStatus) &&
                            !labelOrHide(viewRecord.appliedAt) &&
                            !labelOrHide(viewRecord.registeredByLabel)) ? (
                            <Alert
                                type="info"
                                showIcon
                                message="No additional details available for this SME."
                                style={{ marginTop: 12 }}
                            />
                        ) : null}
                    </>
                )}
            </Modal>
        </div>
    )
}

export default OperationsParticipantsManagement
