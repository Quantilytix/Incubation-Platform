// src/pages/operations/POEValidationPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
    Avatar,
    Button,
    Card,
    Col,
    Descriptions,
    Divider,
    Form,
    Input,
    List,
    Modal,
    Row,
    Segmented,
    Select,
    Space,
    Table,
    Tag,
    Tooltip,
    Typography,
    message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    EyeOutlined,
    LinkOutlined,
    QuestionCircleOutlined,
    SearchOutlined,
    TeamOutlined,
    UserOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
    collection,
    doc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
    type Unsubscribe
} from 'firebase/firestore'
import { Helmet } from 'react-helmet'
import { db } from '@/firebase'
import { MotionCard } from '@/components/shared/Header'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { useActiveProgramId } from '@/lib/useActiveProgramId'

const { Text, Title } = Typography
const { Option } = Select

type ResourceLink = { type?: string; label?: string; link?: string }

type InterventionDbDoc = {
    id: string
    programId: string
    companyCode: string

    participantId: string
    beneficiaryName?: string
    province?: string
    hub?: string
    quarter?: string

    interventionId?: string
    interventionTitle?: string
    interventionKey?: string
    areaOfSupport?: string
    interventionType?: string
    consultantIds?: string[]

    confirmedAt?: any
    createdAt?: any
    updatedAt?: any

    resources?: ResourceLink[]

    poeStatus?: 'pending' | 'validated' | 'queried'
    poeValidatedAt?: any
    poeValidatedBy?: { uid?: string; email?: string; name?: string } | null
    poeQueryReason?: string | null
    poeQueriedAt?: any
    poeQueriedBy?: { uid?: string; email?: string; name?: string } | null
}

type ParticipantMeta = {
    id: string
    beneficiaryName?: string
    name?: string
    sector?: string
    email?: string
}

type ConsultantMeta = {
    id: string
    name?: string
    email?: string
    photoURL?: string
}

type ViewMode = 'all' | 'assignee' | 'incubatee'
type StatusMode = 'all' | 'missing' | 'pending' | 'validated' | 'queried'

const toDisplayDate = (v: any) => {
    if (!v) return 'Unknown'
    const d = typeof v?.toDate === 'function' ? dayjs(v.toDate()) : dayjs(v)
    return d.isValid() ? d.format('YYYY-MM-DD') : 'Unknown'
}

const getPoeStatus = (i: InterventionDbDoc): StatusMode => {
    const hasLinks = Array.isArray(i.resources) && i.resources.some(r => !!r?.link)
    if (!hasLinks) return 'missing'

    if (i.poeStatus === 'validated') return 'validated'
    if (i.poeStatus === 'queried') return 'queried'

    return 'pending'
}

const unique = <T,>(arr: T[]) => Array.from(new Set(arr))

const POEValidationPage: React.FC = () => {
    const { user } = useFullIdentity()
    const activeProgramId = useActiveProgramId()

    const [loading, setLoading] = useState(true)
    const [records, setRecords] = useState<InterventionDbDoc[]>([])

    const [participantMap, setParticipantMap] = useState<Record<string, ParticipantMeta>>({})
    const [consultantMap, setConsultantMap] = useState<Record<string, ConsultantMeta>>({})

    const [viewMode, setViewMode] = useState<ViewMode>('all')
    const [statusMode, setStatusMode] = useState<StatusMode>('all')

    const [selectedConsultantId, setSelectedConsultantId] = useState<string>('all')
    const [selectedParticipantId, setSelectedParticipantId] = useState<string>('all')
    const [keyword, setKeyword] = useState<string>('')

    const [selectedRow, setSelectedRow] = useState<InterventionDbDoc | null>(null)

    const [queryOpen, setQueryOpen] = useState(false)
    const [querySubmitting, setQuerySubmitting] = useState(false)
    const [validateSubmitting, setValidateSubmitting] = useState(false)
    const [queryForm] = Form.useForm<{ reason: string }>()

    const companyCode = (user as any)?.companyCode as string | undefined
    const validator = useMemo(
        () => ({
            uid: (user as any)?.id || (user as any)?.uid,
            email: (user as any)?.email,
            name: (user as any)?.name
        }),
        [user]
    )

    useEffect(() => {
        if (!companyCode) return

        let unsub: Unsubscribe | null = null

        const boot = async () => {
            setLoading(true)
            try {
                const [participantsSnap, consultantsSnap] = await Promise.all([
                    getDocs(query(collection(db, 'participants'), where('companyCode', '==', companyCode))),
                    getDocs(collection(db, 'consultants'))
                ])

                const pMap: Record<string, ParticipantMeta> = {}
                participantsSnap.forEach(d => {
                    const data = d.data() as any
                    pMap[d.id] = {
                        id: d.id,
                        beneficiaryName: data.beneficiaryName,
                        name: data.name,
                        sector: data.sector,
                        email: data.email
                    }
                })
                setParticipantMap(pMap)

                const cMap: Record<string, ConsultantMeta> = {}
                consultantsSnap.forEach(d => {
                    const data = d.data() as any
                    cMap[d.id] = {
                        id: d.id,
                        name: data.name,
                        email: data.email,
                        photoURL: data.photoURL
                    }
                })
                setConsultantMap(cMap)

                const base = [
                    where('companyCode', '==', companyCode),
                    ...(activeProgramId ? [where('programId', '==', activeProgramId)] : [])
                ]

                const qy = query(collection(db, 'interventionsDatabase'), ...base)

                unsub = onSnapshot(
                    qy,
                    snap => {
                        const next: InterventionDbDoc[] = snap.docs.map(d => {
                            const data = d.data() as any
                            return { id: d.id, ...(data as any) }
                        })

                        // newest first (confirmedAt fallback to createdAt)
                        next.sort((a, b) => {
                            const am =
                                a.confirmedAt && typeof (a.confirmedAt as any)?.toMillis === 'function'
                                    ? (a.confirmedAt as any).toMillis()
                                    : a.createdAt && typeof (a.createdAt as any)?.toMillis === 'function'
                                        ? (a.createdAt as any).toMillis()
                                        : 0
                            const bm =
                                b.confirmedAt && typeof (b.confirmedAt as any)?.toMillis === 'function'
                                    ? (b.confirmedAt as any).toMillis()
                                    : b.createdAt && typeof (b.createdAt as any)?.toMillis === 'function'
                                        ? (b.createdAt as any).toMillis()
                                        : 0
                            return bm - am
                        })

                        setRecords(next)
                        setLoading(false)
                    },
                    err => {
                        // eslint-disable-next-line no-console
                        console.error(err)
                        message.error('Failed to load interventions')
                        setLoading(false)
                    }
                )
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error(e)
                message.error('Failed to load POE data')
                setLoading(false)
            }
        }

        boot()
        return () => {
            if (unsub) unsub()
        }
    }, [companyCode, activeProgramId])

    const consultantOptions = useMemo(() => {
        const ids = unique(
            records
                .flatMap(r => (Array.isArray(r.consultantIds) ? r.consultantIds : []))
                .filter(Boolean) as string[]
        )
        return ids
            .map(id => ({
                id,
                name: consultantMap[id]?.name || id
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [records, consultantMap])

    const participantOptions = useMemo(() => {
        const ids = unique(records.map(r => r.participantId).filter(Boolean))
        return ids
            .map(id => ({
                id,
                name:
                    participantMap[id]?.beneficiaryName ||
                    participantMap[id]?.name ||
                    records.find(r => r.participantId === id)?.beneficiaryName ||
                    id
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [records, participantMap])

    const filtered = useMemo(() => {
        const kw = keyword.trim().toLowerCase()

        return records.filter(r => {
            const status = getPoeStatus(r)
            const passStatus = statusMode === 'all' ? true : status === statusMode

            const passMode =
                viewMode === 'all'
                    ? true
                    : viewMode === 'assignee'
                        ? selectedConsultantId === 'all'
                            ? true
                            : (r.consultantIds || []).includes(selectedConsultantId)
                        : selectedParticipantId === 'all'
                            ? true
                            : r.participantId === selectedParticipantId

            const passKw = !kw
                ? true
                : [
                    r.interventionTitle,
                    r.areaOfSupport,
                    r.interventionType,
                    r.beneficiaryName,
                    participantMap[r.participantId]?.beneficiaryName,
                    participantMap[r.participantId]?.name,
                    participantMap[r.participantId]?.email,
                    (r.consultantIds || []).map(id => consultantMap[id]?.name || id).join(' ')
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()
                    .includes(kw)

            return passStatus && passMode && passKw
        })
    }, [
        records,
        statusMode,
        viewMode,
        selectedConsultantId,
        selectedParticipantId,
        keyword,
        participantMap,
        consultantMap
    ])

    const kpis = useMemo(() => {
        const total = records.length
        const missing = records.filter(r => getPoeStatus(r) === 'missing').length
        const pending = records.filter(r => getPoeStatus(r) === 'pending').length
        const validated = records.filter(r => getPoeStatus(r) === 'validated').length
        const queried = records.filter(r => getPoeStatus(r) === 'queried').length
        return { total, missing, pending, validated, queried }
    }, [records])

    const openPoe = (link?: string) => {
        if (!link) return
        window.open(link, '_blank', 'noopener,noreferrer')
    }

    const onValidate = async (row: InterventionDbDoc) => {
        if (!companyCode) return
        const hasLinks = Array.isArray(row.resources) && row.resources.some(r => !!r?.link)
        if (!hasLinks) {
            message.warning('No POE uploaded for this intervention')
            return
        }

        Modal.confirm({
            title: 'Validate POE',
            icon: <QuestionCircleOutlined />,
            content: 'Mark this POE as validated?',
            okText: 'Validate',
            okButtonProps: { shape: 'round', variant: 'filled', color: 'green' as any },
            cancelButtonProps: { shape: 'round' },
            async onOk() {
                setValidateSubmitting(true)
                try {
                    await updateDoc(doc(db, 'interventionsDatabase', row.id), {
                        poeStatus: 'validated',
                        poeValidatedAt: serverTimestamp(),
                        poeValidatedBy: validator,
                        poeQueryReason: null,
                        poeQueriedAt: null,
                        poeQueriedBy: null,
                        updatedAt: serverTimestamp()
                    })
                    message.success('POE validated')
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error(e)
                    message.error('Failed to validate POE')
                } finally {
                    setValidateSubmitting(false)
                }
            }
        })
    }

    const onOpenQuery = (row: InterventionDbDoc) => {
        const hasLinks = Array.isArray(row.resources) && row.resources.some(r => !!r?.link)
        if (!hasLinks) {
            message.warning('No POE uploaded for this intervention')
            return
        }
        setSelectedRow(row)
        queryForm.setFieldsValue({ reason: row.poeQueryReason || '' })
        setQueryOpen(true)
    }

    const submitQuery = async () => {
        const row = selectedRow
        if (!row) return
        try {
            const values = await queryForm.validateFields()
            const reason = String(values.reason || '').trim()
            if (!reason) {
                message.warning('Add a query reason')
                return
            }

            setQuerySubmitting(true)
            await updateDoc(doc(db, 'interventionsDatabase', row.id), {
                poeStatus: 'queried',
                poeQueryReason: reason,
                poeQueriedAt: serverTimestamp(),
                poeQueriedBy: validator,
                updatedAt: serverTimestamp()
            })
            message.success('POE queried')
            setQueryOpen(false)
            setSelectedRow(null)
            queryForm.resetFields()
        } catch (e) {
            if ((e as any)?.errorFields) return
            // eslint-disable-next-line no-console
            console.error(e)
            message.error('Failed to query POE')
        } finally {
            setQuerySubmitting(false)
        }
    }

    const columns: ColumnsType<InterventionDbDoc> = [
        {
            title: 'Beneficiary',
            key: 'beneficiary',
            render: (_, r) => {
                const name =
                    r.beneficiaryName ||
                    participantMap[r.participantId]?.beneficiaryName ||
                    participantMap[r.participantId]?.name ||
                    'Unknown'
                const email = participantMap[r.participantId]?.email
                return (
                    <Space direction="vertical" size={0}>
                        <Text strong>{name}</Text>
                        {email ? <Text type="secondary">{email}</Text> : <Text type="secondary">—</Text>}
                    </Space>
                )
            }
        },
        {
            title: 'Assignee',
            key: 'assignee',
            render: (_, r) => {
                const ids = Array.isArray(r.consultantIds) ? r.consultantIds : []
                if (!ids.length) return <Text type="secondary">Unassigned</Text>

                return (
                    <Space wrap size={6}>
                        {ids.slice(0, 2).map(id => (
                            <Tag key={id} icon={<TeamOutlined />}>
                                {consultantMap[id]?.name || id}
                            </Tag>
                        ))}
                        {ids.length > 2 ? <Tag>+{ids.length - 2}</Tag> : null}
                    </Space>
                )
            }
        },
        {
            title: 'Intervention',
            key: 'intervention',
            render: (_, r) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{r.interventionTitle || 'Intervention'}</Text>
                    <Space wrap size={6}>
                        {r.areaOfSupport ? <Tag>{r.areaOfSupport}</Tag> : null}
                        {r.interventionType ? <Tag>{r.interventionType}</Tag> : null}
                    </Space>
                </Space>
            )
        },
        {
            title: 'Confirmed',
            dataIndex: 'confirmedAt',
            render: v => <Text>{toDisplayDate(v)}</Text>
        },
        {
            title: 'POE',
            key: 'poe',
            render: (_, r) => {
                const links = (r.resources || []).filter(x => !!x?.link)
                if (!links.length) return <Text type="secondary">No upload</Text>

                return (
                    <Space direction="vertical" size={6}>
                        {links.slice(0, 1).map((x, idx) => (
                            <Tooltip key={idx} title={x.label || 'Open POE'}>
                                <Button
                                    shape="round"
                                    variant="filled"
                                    color="geekblue"
                                    icon={<LinkOutlined />}
                                    style={{ border: '1px solid dodgerblue' }}
                                    onClick={() => openPoe(x.link)}
                                >
                                    Open
                                </Button>
                            </Tooltip>
                        ))}
                        {links.length > 1 ? <Text type="secondary">+{links.length - 1} more</Text> : null}
                    </Space>
                )
            }
        },
        {
            title: 'Status',
            key: 'status',
            render: (_, r) => {
                const s = getPoeStatus(r)
                if (s === 'missing') return <Tag color="default">Missing</Tag>
                if (s === 'pending') return <Tag color="gold">Pending</Tag>
                if (s === 'validated') return <Tag color="green">Validated</Tag>
                if (s === 'queried') return <Tag color="red">Queried</Tag>
                return <Tag>Unknown</Tag>
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, r) => (
                <Space wrap>
                    <Button
                        shape="round"
                        variant="filled"
                        color="blue"
                        icon={<EyeOutlined />}
                        style={{ border: '1px solid #1677ff' }}
                        onClick={() => setSelectedRow(r)}
                    >
                        View
                    </Button>

                    <Button
                        shape="round"
                        variant="filled"
                        color="green"
                        icon={<CheckCircleOutlined />}
                        style={{ border: '1px solid limegreen' }}
                        loading={validateSubmitting}
                        onClick={() => onValidate(r)}
                    >
                        Validate
                    </Button>

                    <Button
                        shape="round"
                        variant="filled"
                        color="volcano"
                        icon={<CloseCircleOutlined />}
                        style={{ border: '1px solid #ff4d4f' }}
                        onClick={() => onOpenQuery(r)}
                    >
                        Query
                    </Button>
                </Space>
            )
        }
    ]

    const modalBeneficiary = useMemo(() => {
        if (!selectedRow) return 'Beneficiary'
        return (
            selectedRow.beneficiaryName ||
            participantMap[selectedRow.participantId]?.beneficiaryName ||
            participantMap[selectedRow.participantId]?.name ||
            'Beneficiary'
        )
    }, [selectedRow, participantMap])

    const modalAssignees = useMemo(() => {
        if (!selectedRow) return []
        const ids = Array.isArray(selectedRow.consultantIds) ? selectedRow.consultantIds : []
        return ids.map(id => consultantMap[id]?.name || id)
    }, [selectedRow, consultantMap])

    const modalPoes = useMemo(() => {
        if (!selectedRow) return []
        return (selectedRow.resources || []).filter(r => !!r?.link)
    }, [selectedRow])

    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            <Helmet>
                <title>POE Validation | Smart Incubation</title>
            </Helmet>

            <Row gutter={16} style={{ marginBottom: 14 }}>
                <Col xs={24} md={6}>
                    <MotionCard>
                        <MotionCard.Metric
                            title="Total Interventions"
                            value={kpis.total}
                            icon={<TeamOutlined style={{ color: '#1677ff', fontSize: 18 }} />}
                            iconBg="rgba(22,119,255,.12)"
                            subtitle="All interventions in scope"
                        />
                    </MotionCard>
                </Col>

                <Col xs={24} md={6}>
                    <MotionCard>
                        <MotionCard.Metric
                            title="POE Missing"
                            value={kpis.missing}
                            icon={<UserOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />}
                            iconBg="rgba(140,140,140,.12)"
                            subtitle="No proof uploaded"
                        />
                    </MotionCard>
                </Col>

                <Col xs={24} md={6}>
                    <MotionCard>
                        <MotionCard.Metric
                            title="Pending Review"
                            value={kpis.pending}
                            icon={<QuestionCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />}
                            iconBg="rgba(250,173,20,.12)"
                            subtitle="Uploaded, not validated"
                        />
                    </MotionCard>
                </Col>

                <Col xs={24} md={6}>
                    <MotionCard>
                        <MotionCard.Metric
                            title="Validated"
                            value={kpis.validated}
                            icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />}
                            iconBg="rgba(82,196,26,.12)"
                            subtitle="Approved POEs"
                        />
                    </MotionCard>
                </Col>
            </Row>

            <Card
                style={{
                    boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
                    transition: 'all 0.3s ease',
                    borderRadius: 14,
                    border: '1px solid #e6efff',
                    marginBottom: 10
                }}
            >
                <Row gutter={12} align="middle">
                    <Col xs={24} md={7}>
                        <Input
                            allowClear
                            prefix={<SearchOutlined />}
                            placeholder="Search beneficiary / intervention / consultant..."
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                        />
                    </Col>

                    <Col xs={24} md={6}>
                        <Segmented
                            block
                            value={viewMode}
                            onChange={v => {
                                const next = v as ViewMode
                                setViewMode(next)
                                if (next !== 'assignee') setSelectedConsultantId('all')
                                if (next !== 'incubatee') setSelectedParticipantId('all')
                            }}
                            options={[
                                { label: 'Facilitator', value: 'assignee' },
                                { label: 'Incubatee', value: 'incubatee' }
                            ]}
                        />
                    </Col>

                    <Col xs={24} md={5}>
                        <Select
                            style={{ width: '100%' }}
                            value={statusMode}
                            onChange={v => setStatusMode(v)}
                        >
                            <Option value="all">All Statuses</Option>
                            <Option value="missing">Missing</Option>
                            <Option value="pending">Pending</Option>
                            <Option value="validated">Validated</Option>
                            <Option value="queried">Queried</Option>
                        </Select>
                    </Col>

                    <Col xs={24} md={6}>
                        {viewMode === 'assignee' ? (
                            <Select
                                style={{ width: '100%' }}
                                value={selectedConsultantId}
                                onChange={v => setSelectedConsultantId(v)}
                                placeholder="Select assignee"
                                showSearch
                                optionFilterProp="children"
                            >
                                <Option value="all">All Assignees</Option>
                                {consultantOptions.map(c => (
                                    <Option key={c.id} value={c.id}>
                                        {c.name}
                                    </Option>
                                ))}
                            </Select>
                        ) : viewMode === 'incubatee' ? (
                            <Select
                                style={{ width: '100%' }}
                                value={selectedParticipantId}
                                onChange={v => setSelectedParticipantId(v)}
                                placeholder="Select incubatee"
                                showSearch
                                optionFilterProp="children"
                            >
                                <Option value="all">All Incubatees</Option>
                                {participantOptions.map(p => (
                                    <Option key={p.id} value={p.id}>
                                        {p.name}
                                    </Option>
                                ))}
                            </Select>
                        ) : (
                            <Select style={{ width: '100%' }} disabled value="all">
                                <Option value="all">No extra filter</Option>
                            </Select>
                        )}
                    </Col>
                </Row>
            </Card>

            <Card
                hoverable
                style={{
                    boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
                    transition: 'all 0.3s ease',
                    borderRadius: 14,
                    border: '1px solid #e6efff'
                }}
            >
                <Table<InterventionDbDoc>
                    columns={columns}
                    dataSource={filtered}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                />
            </Card>

            {/* Details Modal */}
            <Modal
                title={null}
                open={!!selectedRow && !queryOpen}
                onCancel={() => setSelectedRow(null)}
                footer={[
                    <Button
                        key="close"
                        danger
                        shape="round"
                        variant="filled"
                        icon={<CloseCircleOutlined />}
                        onClick={() => setSelectedRow(null)}
                    >
                        Close
                    </Button>
                ]}
                width={980}
                destroyOnClose
                styles={{ body: { paddingTop: 18, paddingBottom: 16 } }}
            >
                {!selectedRow ? null : (
                    <>
                        <MotionCard style={{ marginBottom: 10 }}>
                            <Row gutter={16} align="middle">
                                <Col flex="56px">
                                    <Avatar size={56} style={{ background: '#f5f5f5' }}>
                                        {String(modalBeneficiary || 'B').slice(0, 1).toUpperCase()}
                                    </Avatar>
                                </Col>

                                <Col flex="auto">
                                    <Title level={5} style={{ margin: 0 }}>
                                        {modalBeneficiary}
                                    </Title>

                                    <Space size={10} style={{ marginTop: 6 }} wrap>
                                        {selectedRow.areaOfSupport ? <Tag>{selectedRow.areaOfSupport}</Tag> : null}
                                        {selectedRow.interventionType ? <Tag>{selectedRow.interventionType}</Tag> : null}
                                        <Text type="secondary">
                                            {selectedRow.province || 'Unknown'}
                                            {selectedRow.hub ? `, ${selectedRow.hub}` : ''}
                                        </Text>
                                    </Space>
                                </Col>

                                <Col>
                                    <Space wrap>
                                        <Button
                                            shape="round"
                                            variant="filled"
                                            color="green"
                                            icon={<CheckCircleOutlined />}
                                            style={{ border: '1px solid limegreen' }}
                                            loading={validateSubmitting}
                                            onClick={() => onValidate(selectedRow)}
                                        >
                                            Validate
                                        </Button>

                                        <Button
                                            shape="round"
                                            variant="filled"
                                            color="volcano"
                                            icon={<CloseCircleOutlined />}
                                            style={{ border: '1px solid #ff4d4f' }}
                                            onClick={() => onOpenQuery(selectedRow)}
                                        >
                                            Query
                                        </Button>
                                    </Space>
                                </Col>
                            </Row>

                            <Divider style={{ margin: '14px 0' }} />

                            <Descriptions
                                size="small"
                                column={{ xs: 1, sm: 2, md: 4 }}
                                bordered
                                style={{ borderRadius: 12, overflow: 'hidden' }}
                            >
                                <Descriptions.Item label="Intervention">
                                    {selectedRow.interventionTitle || 'Intervention'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Confirmed">{toDisplayDate(selectedRow.confirmedAt)}</Descriptions.Item>
                                <Descriptions.Item label="Assignees">
                                    {modalAssignees.length ? modalAssignees.join(', ') : 'Unassigned'}
                                </Descriptions.Item>
                                <Descriptions.Item label="POE Status">
                                    <Tag
                                        color={
                                            getPoeStatus(selectedRow) === 'validated'
                                                ? 'green'
                                                : getPoeStatus(selectedRow) === 'queried'
                                                    ? 'red'
                                                    : getPoeStatus(selectedRow) === 'pending'
                                                        ? 'gold'
                                                        : 'default'
                                        }
                                    >
                                        {getPoeStatus(selectedRow).toUpperCase()}
                                    </Tag>
                                </Descriptions.Item>

                                <Descriptions.Item label="Validated By">
                                    {(selectedRow.poeValidatedBy as any)?.name || (selectedRow.poeValidatedBy as any)?.email || '—'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Validated At">{toDisplayDate(selectedRow.poeValidatedAt)}</Descriptions.Item>
                                <Descriptions.Item label="Queried By">
                                    {(selectedRow.poeQueriedBy as any)?.name || (selectedRow.poeQueriedBy as any)?.email || '—'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Queried At">{toDisplayDate(selectedRow.poeQueriedAt)}</Descriptions.Item>

                                <Descriptions.Item label="Query Reason" span={4}>
                                    {selectedRow.poeQueryReason ? <Text>{selectedRow.poeQueryReason}</Text> : <Text type="secondary">—</Text>}
                                </Descriptions.Item>
                            </Descriptions>
                        </MotionCard>

                        <MotionCard>
                            <Title level={5} style={{ marginTop: 0 }}>
                                Proof of Execution
                            </Title>

                            <List
                                dataSource={modalPoes}
                                locale={{ emptyText: 'No POE uploaded' }}
                                renderItem={(r, idx) => (
                                    <List.Item style={{ padding: '10px 6px' }}>
                                        <Card
                                            style={{
                                                width: '100%',
                                                borderRadius: 14,
                                                border: '1px solid #e6efff',
                                                background: '#fbfdff'
                                            }}
                                            bodyStyle={{ padding: 14 }}
                                        >
                                            <Row gutter={12} align="middle">
                                                <Col flex="auto">
                                                    <Space direction="vertical" size={2}>
                                                        <Text strong>{r.label || `POE ${idx + 1}`}</Text>
                                                        <Text type="secondary">{r.type || 'File/Link'}</Text>
                                                    </Space>
                                                </Col>

                                                <Col>
                                                    <Button
                                                        shape="round"
                                                        variant="filled"
                                                        color="geekblue"
                                                        icon={<LinkOutlined />}
                                                        style={{ border: '1px solid dodgerblue' }}
                                                        onClick={() => openPoe(r.link)}
                                                    >
                                                        Open
                                                    </Button>
                                                </Col>
                                            </Row>
                                        </Card>
                                    </List.Item>
                                )}
                            />
                        </MotionCard>
                    </>
                )}
            </Modal>

            {/* Query Modal */}
            <Modal
                title="Query POE"
                open={queryOpen}
                onCancel={() => {
                    setQueryOpen(false)
                    queryForm.resetFields()
                    setSelectedRow(null)
                }}
                okText="Submit Query"
                okButtonProps={{
                    shape: 'round',
                    variant: 'filled',
                    color: 'volcano' as any,
                    loading: querySubmitting
                }}
                cancelButtonProps={{ shape: 'round' }}
                onOk={submitQuery}
                destroyOnClose
            >
                <Form form={queryForm} layout="vertical">
                    <Form.Item
                        name="reason"
                        label="Reason"
                        rules={[{ required: true, message: 'Add a query reason' }]}
                    >
                        <Input.TextArea rows={4} placeholder="Explain what is missing / incorrect in this POE..." />
                    </Form.Item>
                    <Text type="secondary">
                        This will mark the intervention as <b>queried</b> and store the reason on the intervention record.
                    </Text>
                </Form>
            </Modal>
        </div>
    )
}

export default POEValidationPage
