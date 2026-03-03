import { useEffect, useMemo, useState } from 'react'
import {
    Table,
    Tag,
    Space,
    Typography,
    Divider,
    Select,
    Row,
    Col,
    notification,
    Button,
    Modal,
    Avatar,
    Descriptions,
    List,
    Tooltip,
    Rate,
    Card
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    TeamOutlined,
    AppstoreOutlined,
    FileDoneOutlined,
    EyeOutlined,
    LinkOutlined,
    CalendarOutlined,
    ClockCircleOutlined,
    StarOutlined,
    CloseCircleOutlined
} from '@ant-design/icons'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/firebase'
import dayjs from 'dayjs'
import { Helmet } from 'react-helmet'
import { MotionCard } from '@/components/shared/Header'
import { useSMEDetails } from '@/contexts/SMEDetailsContext'

const { Text, Title } = Typography
const { Option } = Select

type InterventionDbDoc = {
    id: string
    programId: string
    interventionId?: string
    interventionTitle?: string
    areaOfSupport?: string
    participantId: string
    beneficiaryName?: string
    hub?: string
    province?: string
    quarter?: string
    consultantIds?: string[]
    timeSpent?: any[]
    interventionType?: string
    targetMetric?: string
    targetType?: string
    targetValue?: number
    feedback?: any
    confirmedAt?: any
    createdAt?: any
    updatedAt?: any
    interventionKey?: string
    resources?: { type?: string; label?: string; link?: string }[]
    companyCode: string
    rating?: number
}

type GroupedRow = {
    id: string
    programId: string
    participantId: string
    beneficiaryName?: string
    province?: string
    quarter?: string
    hub?: string
    interventions: InterventionDbDoc[]
}

type ParticipantMeta = {
    id: string
    beneficiaryName?: string
    name?: string
    sector?: string
    email?: string
    companyCode?: string
}

type UserMini = {
    photoURL?: string
    email?: string
}

const toDisplayDate = (v: any) => {
    if (!v) return 'Unknown'
    const d = typeof v?.toDate === 'function' ? dayjs(v.toDate()) : dayjs(v)
    return d.isValid() ? d.format('YYYY-MM-DD') : 'Unknown'
}

const getInterventionRating = (i: InterventionDbDoc): number | null => {
    const direct =
        typeof (i as any)?.rating === 'number'
            ? (i as any).rating
            : typeof (i as any)?.feedback?.rating === 'number'
                ? (i as any).feedback.rating
                : typeof (i as any)?.feedback?.score === 'number'
                    ? (i as any).feedback.score
                    : null

    if (direct === null) return null
    if (direct > 5) return Math.max(0, Math.min(5, direct / 20))
    return Math.max(0, Math.min(5, direct))
}

const InterventionDatabaseView = () => {
    const [loading, setLoading] = useState(true)

    const [records, setRecords] = useState<GroupedRow[]>([])
    const [filtered, setFiltered] = useState<GroupedRow[]>([])

    const [companyCode, setCompanyCode] = useState<string | null>(null)

    const [programOptions, setProgramOptions] = useState<{ id: string; name: string }[]>([])
    const [filters, setFilters] = useState({
        programId: 'all',
        type: 'all',
        area: 'all',
    })

    const [programMap, setProgramMap] = useState<Record<string, string>>({})
    const [consultantMap, setConsultantMap] = useState<Record<string, string>>({})
    const [participantMetaMap, setParticipantMetaMap] = useState<Record<string, ParticipantMeta>>({})

    const [selectedView, setSelectedView] = useState<GroupedRow | null>(null)

    const { selected, selectSME } = useSMEDetails()
    const [selectedUser, setSelectedUser] = useState<UserMini | null>(null)
    const [selectedUserLoading, setSelectedUserLoading] = useState(false)

    useEffect(() => {
        const auth = getAuth()
        return onAuthStateChanged(auth, async user => {
            if (!user) return

            setLoading(true)
            try {
                const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)))
                if (userSnap.empty) {
                    notification.error({ message: 'User profile not found' })
                    return
                }

                const userData = userSnap.docs[0].data() as any
                const code = userData.companyCode as string
                setCompanyCode(code)

                const [participantsSnap, consultantSnap, programsSnap, interventionsSnap] = await Promise.all([
                    getDocs(query(collection(db, 'participants'), where('companyCode', '==', code))),
                    getDocs(collection(db, 'consultants')),
                    getDocs(collection(db, 'programs')),
                    getDocs(query(collection(db, 'interventionsDatabase'), where('companyCode', '==', code)))
                ])

                const pMeta: Record<string, ParticipantMeta> = {}
                participantsSnap.forEach(d => {
                    const data = d.data() as any
                    pMeta[d.id] = {
                        id: d.id,
                        beneficiaryName: data.beneficiaryName,
                        name: data.name,
                        sector: data.sector,
                        email: data.email,
                        companyCode: data.companyCode
                    }
                })
                setParticipantMetaMap(pMeta)

                const cMap: Record<string, string> = {}
                consultantSnap.forEach(d => {
                    const data = d.data() as any
                    cMap[d.id] = data.name || 'Unknown'
                })
                setConsultantMap(cMap)

                const prMap: Record<string, string> = {}
                programsSnap.forEach(d => {
                    const data = d.data() as any
                    prMap[d.id] = data.name || data.title || d.id
                })
                setProgramMap(prMap)

                const grouped = new Map<string, GroupedRow>()

                interventionsSnap.docs.forEach(d => {
                    const data = d.data() as any
                    const rec: InterventionDbDoc = { id: d.id, ...(data as any) }

                    const key = `${rec.programId}_${rec.participantId}`

                    if (!grouped.has(key)) {
                        grouped.set(key, {
                            id: key,
                            programId: rec.programId,
                            participantId: rec.participantId,
                            beneficiaryName: rec.beneficiaryName || pMeta[rec.participantId]?.beneficiaryName || pMeta[rec.participantId]?.name,
                            province: rec.province,
                            hub: rec.hub,
                            quarter: rec.quarter,
                            interventions: []
                        })
                    }

                    grouped.get(key)!.interventions.push(rec)
                })

                const groupedRecords = Array.from(grouped.values()).map(r => {
                    const q = r.quarter || r.interventions?.[0]?.quarter || 'Unknown'
                    return { ...r, quarter: q }
                })

                setRecords(groupedRecords)
                setFiltered(groupedRecords)

                const uniqueProgramIds = [...new Set(groupedRecords.map(d => d.programId))]
                setProgramOptions(uniqueProgramIds.map(id => ({ id, name: prMap[id] || id })))
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error(err)
                notification.error({ message: 'Failed to load' })
            } finally {
                setLoading(false)
            }
        })
    }, [])

    useEffect(() => {
        const fetchUserImage = async () => {
            if (!selected?.email) {
                setSelectedUser(null)
                return
            }
            setSelectedUserLoading(true)
            try {
                const snap = await getDocs(query(collection(db, 'users'), where('email', '==', selected.email)))
                if (snap.empty) {
                    setSelectedUser(null)
                    return
                }
                setSelectedUser(snap.docs[0].data() as any)
            } catch {
                setSelectedUser(null)
            } finally {
                setSelectedUserLoading(false)
            }
        }

        fetchUserImage()
    }, [selected?.email])

    const handleFilterChange = (key: string, value: string) => {
        const newFilters = { ...filters, [key]: value }
        setFilters(newFilters)

        const result = records.filter(item => {
            const hasType = newFilters.type === 'all' ? true : item.interventions?.some(i => i.interventionType === newFilters.type)
            const hasArea = newFilters.area === 'all' ? true : item.interventions?.some(i => i.areaOfSupport === newFilters.area)
            const hasProgram = newFilters.programId === 'all' ? true : item.programId === newFilters.programId
            return hasProgram && hasType && hasArea
        })

        setFiltered(result)
    }

    const columns: ColumnsType<GroupedRow> = [
        {
            title: 'Beneficiary',
            dataIndex: 'beneficiaryName',
            render: (_, r) => r.beneficiaryName || participantMetaMap[r.participantId]?.beneficiaryName || participantMetaMap[r.participantId]?.name || <Text type="secondary">Unknown</Text>
        },
        {
            title: 'Location',
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{record.province || 'Unknown'}</Text>
                    <Text type="secondary">{record.hub || 'Unknown'}</Text>
                </Space>
            )
        },
        {
            title: 'Program',
            dataIndex: 'programId',
            render: id => programMap[id] || id
        },
        {
            title: 'Total',
            render: (_, r) => <Text>{r.interventions?.length || 0}</Text>
        },
        {
            title: 'Actions',
            render: (_, record) => (
                <Button
                    variant='filled'
                    shape='round'
                    color='green'
                    style={{ border: '1px solid limegreen' }}
                    icon={<EyeOutlined />}
                    onClick={() => {
                        setSelectedView(record)
                        selectSME(record.participantId)
                    }}
                >
                    View
                </Button>
            )
        }
    ]

    const totalBeneficiaries = useMemo(() => records.length, [records])

    const sectorsCovered = useMemo(() => {
        const set = new Set<string>()
        records.forEach(r => {
            const sector = participantMetaMap[r.participantId]?.sector
            if (sector) set.add(String(sector).trim())
        })
        return set.size
    }, [records, participantMetaMap])

    const completedInterventionsCount = useMemo(() => {
        return records.reduce((acc, rec) => acc + (rec.interventions?.length || 0), 0)
    }, [records])

    const modalName = selected?.beneficiaryName || selectedView?.beneficiaryName || 'Beneficiary'
    const modalSector = selected?.sector || participantMetaMap[selectedView?.participantId || '']?.sector || 'Unknown'
    const modalProgramName = selected?.programName || (selectedView?.programId ? programMap[selectedView.programId] : null) || 'Unknown'
    const modalJoined = selected?.acceptedAt ? dayjs(selected.acceptedAt).format('YYYY-MM-DD') : 'Unknown'

    const blackOwned = selected?.blackOwnedPercent
    const femaleOwned = selected?.femaleOwnedPercent

    const blackOwnedLabel =
        typeof blackOwned === 'number' ? `${blackOwned}%` : 'Unknown'

    const femaleOwnedLabel =
        typeof femaleOwned === 'number' ? `${femaleOwned}%` : 'Unknown'

    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            <Helmet>
                <title>Interventions Database</title>
            </Helmet>



            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={24} md={8}>
                    <MotionCard>
                        <MotionCard.Metric
                            title="Total Beneficiaries"
                            value={totalBeneficiaries}
                            icon={<TeamOutlined style={{ color: '#1677ff', fontSize: 18 }} />}
                            iconBg="rgba(22,119,255,.12)"
                            subtitle="Distinct beneficiaries with completed interventions"
                        />
                    </MotionCard>
                </Col>

                <Col xs={24} md={8}>
                    <MotionCard>
                        <MotionCard.Metric
                            title="Sectors Covered"
                            value={sectorsCovered}
                            icon={<AppstoreOutlined style={{ color: '#9254de', fontSize: 18 }} />}
                            iconBg="rgba(146,84,222,.12)"
                            subtitle="Unique sectors across beneficiaries in scope"
                        />
                    </MotionCard>
                </Col>

                <Col xs={24} md={8}>
                    <MotionCard>
                        <MotionCard.Metric
                            title="Completed Interventions"
                            value={completedInterventionsCount}
                            icon={<FileDoneOutlined style={{ color: '#52c41a', fontSize: 18 }} />}
                            iconBg="rgba(82,196,26,.12)"
                            subtitle="Total completed intervention records"
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
                <Row gutter={16}>
                    <Col xs={24} md={8}>
                        <Select style={{ width: '100%' }} value={filters.programId} onChange={val => handleFilterChange('programId', val)}>
                            <Option value="all">All Programs</Option>
                            {programOptions.map(p => (
                                <Option key={p.id} value={p.id}>
                                    {p.name}
                                </Option>
                            ))}
                        </Select>
                    </Col>

                    <Col xs={24} md={8}>
                        <Select style={{ width: '100%' }} value={filters.type} onChange={val => handleFilterChange('type', val)}>
                            <Option value="all">All Types</Option>
                            <Option value="singular">Singular</Option>
                            <Option value="grouped">Grouped</Option>
                        </Select>
                    </Col>

                    <Col xs={24} md={8}>
                        <Select style={{ width: '100%' }} value={filters.area} onChange={val => handleFilterChange('area', val)}>
                            <Option value="all">All Areas</Option>
                            <Option value="Marketing Support">Marketing Support</Option>
                            <Option value="Compliance">Compliance</Option>
                            <Option value="Financial management">Financial Management</Option>
                            <Option value="Planning">Planning</Option>
                        </Select>
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
                <Table<GroupedRow> columns={columns} dataSource={filtered} rowKey="id" loading={loading} />
            </Card>

            <Modal
                title={null}
                open={!!selectedView}
                onCancel={() => {
                    setSelectedView(null)
                    selectSME(null)
                    setSelectedUser(null)
                }}
                footer={[
                    <Button
                        key="close"
                        danger
                        icon={<CloseCircleOutlined />}
                        variant="filled"
                        shape="round"
                        onClick={() => {
                            setSelectedView(null)
                            selectSME(null)
                            setSelectedUser(null)
                        }}
                    >
                        Close
                    </Button>
                ]}
                width={920}
                destroyOnClose
                styles={{
                    body: { paddingTop: 18, paddingBottom: 16 }
                }}
            >
                {!selectedView ? null : (
                    <>
                        <MotionCard style={{ marginBottom: 10 }}>
                            <Row gutter={16} align="middle">
                                <Col flex="56px">
                                    <Avatar
                                        size={56}
                                        src={selectedUser?.photoURL}
                                        style={{ background: '#f5f5f5' }}
                                    >
                                        String(modalName || 'B').slice(0, 1).toUpperCase()
                                    </Avatar>
                                </Col>

                                <Col flex="auto">
                                    <Title level={5} style={{ margin: 0 }}>
                                        {modalName}
                                    </Title>

                                    <Space size={10} style={{ marginTop: 6 }} wrap>
                                        <Tag>{modalProgramName}</Tag>
                                        <Text type="secondary">
                                            {selectedView.province || 'Unknown'}
                                            {selectedView.hub ? `, ${selectedView.hub}` : ''}
                                        </Text>
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
                                <Descriptions.Item label="Sector">{modalSector}</Descriptions.Item>

                                <Descriptions.Item label="Black Owned">{blackOwnedLabel}</Descriptions.Item>
                                <Descriptions.Item label="Female Owned">{femaleOwnedLabel}</Descriptions.Item>

                                <Descriptions.Item label="Date Joined">{modalJoined}</Descriptions.Item>
                                <Descriptions.Item label="Total Interventions">
                                    {selectedView.interventions?.length || 0}
                                </Descriptions.Item>
                            </Descriptions>
                        </MotionCard>

                        <MotionCard>
                            <List
                                dataSource={[...selectedView.interventions].sort((a, b) => {
                                    const am = a.confirmedAt ? (typeof a.confirmedAt?.toMillis === 'function' ? a.confirmedAt.toMillis() : 0) : 0
                                    const bm = b.confirmedAt ? (typeof b.confirmedAt?.toMillis === 'function' ? b.confirmedAt.toMillis() : 0) : 0
                                    return bm - am
                                })}
                                locale={{ emptyText: 'No interventions found' }}
                                renderItem={item => {
                                    const consultants = (item.consultantIds || []).map(id => consultantMap[id] || id)
                                    const timeSpent = Array.isArray(item.timeSpent) ? item.timeSpent.join(', ') : item.timeSpent ?? null
                                    const rating = getInterventionRating(item)

                                    return (
                                        <List.Item style={{ padding: '12px 6px' }}>
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
                                                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                                            <Space wrap>
                                                                <Text strong>{item.interventionTitle || 'Intervention'}</Text>
                                                                {item.areaOfSupport ? <Tag>{item.areaOfSupport}</Tag> : null}
                                                                {item.interventionType ? <Tag>{item.interventionType}</Tag> : null}
                                                            </Space>

                                                            <Space wrap size={14}>
                                                                <Space size={6}>
                                                                    <CalendarOutlined />
                                                                    <Text type="secondary">{toDisplayDate(item.confirmedAt)}</Text>
                                                                </Space>

                                                                <Space size={6}>
                                                                    <ClockCircleOutlined />
                                                                    <Text type="secondary">{timeSpent ? `${timeSpent} hrs` : 'No time captured'}</Text>
                                                                </Space>

                                                                <Space size={6}>
                                                                    <TeamOutlined />
                                                                    <Text type="secondary">{consultants.length ? consultants.join(', ') : 'No consultants'}</Text>
                                                                </Space>

                                                                <Space size={6}>
                                                                    <StarOutlined />
                                                                    {rating === null ? (
                                                                        <Text type="secondary">No rating</Text>
                                                                    ) : (
                                                                        <Rate allowHalf disabled value={rating} />
                                                                    )}
                                                                </Space>
                                                            </Space>
                                                        </Space>
                                                    </Col>

                                                    <Col>
                                                        {item.resources?.length ? (
                                                            <Space direction="vertical" size={8} align="end">
                                                                {item.resources.slice(0, 2).map((r, idx) => (
                                                                    <Tooltip key={idx} title={r.label || 'Resource'}>
                                                                        <Button
                                                                            style={{
                                                                                border: '1px solid dodgerblue'
                                                                            }}
                                                                            shape='round'
                                                                            variant='filled'
                                                                            color='geekblue'
                                                                            icon={<LinkOutlined />}
                                                                            onClick={() => window.open(r.link, '_blank', 'noopener,noreferrer')}
                                                                        >
                                                                            Open POE
                                                                        </Button>
                                                                    </Tooltip>
                                                                ))}
                                                            </Space>
                                                        ) : (
                                                            <Text type="secondary">No proof uploaded</Text>
                                                        )}
                                                    </Col>
                                                </Row>
                                            </Card>
                                        </List.Item>
                                    )
                                }}
                            />
                        </MotionCard>
                    </>
                )}
            </Modal>
        </div>
    )
}

export default InterventionDatabaseView
