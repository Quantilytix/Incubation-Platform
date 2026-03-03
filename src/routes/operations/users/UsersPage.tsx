// src/pages/operations/UsersPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Avatar,
    Button,
    Checkbox,
    Col,
    Empty,
    Form,
    Grid,
    Input,
    List,
    Modal,
    Row,
    Segmented,
    Select,
    Skeleton,
    Space,
    Switch,
    Table,
    Tag,
    Typography,
    message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    CheckCircleOutlined,
    DeleteOutlined,
    DownloadOutlined,
    EditOutlined,
    PlusOutlined,
    StarOutlined,
    UserOutlined,
    CrownOutlined,
    TeamOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { motion } from 'framer-motion'
import { CSVLink } from 'react-csv'
import { useNavigate } from 'react-router-dom'
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    updateDoc,
    where
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, auth, functions } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'

const { Text } = Typography

type SegmentKey = 'consultants' | 'projectAdmins'

interface Consultant {
    id: string
    name: string
    email: string
    expertise: string[]
    assignmentsCount: number
    rate: number
    rating?: number
    active?: boolean
    type?: 'Internal' | 'External'
}

interface ProjectAdmin {
    id: string
    name: string
    email: string
    role: 'projectAdmin'
    companyCode: string
    active?: boolean
    permissions: string[]
    createdAt?: string
}

const defaultExpertise = [
    'Strategy',
    'Marketing',
    'Finance',
    'Technology',
    'Operations',
    'HR',
    'Compliance'
]

const PROJECT_ADMIN_PERMISSIONS = [
    { key: 'applications', label: 'Applications' },
    { key: 'assign_interventions', label: 'Assign interventions' },
    { key: 'add_users', label: 'Add users' },
    { key: 'manage_programs', label: 'Manage programs' },
    { key: 'reports', label: 'Reports' },
    { key: 'system_settings', label: 'System settings' }
] as const

const toBool = (v: any, fallback = true) => (v == null ? fallback : Boolean(v))

export const UsersPage: React.FC = () => {
    const [segment, setSegment] = useState<SegmentKey>('consultants')

    const [consultants, setConsultants] = useState<Consultant[]>([])
    const [projectAdmins, setProjectAdmins] = useState<ProjectAdmin[]>([])

    const [loadingConsultants, setLoadingConsultants] = useState(true)
    const [loadingAdmins, setLoadingAdmins] = useState(true)

    const [searchText, setSearchText] = useState('')

    const [companyCode, setCompanyCode] = useState<string>('')
    const { user } = useFullIdentity()

    const [consultantLabel, setConsultantLabel] = useState('Consultant')
    const [consultantLabelPlural, setConsultantLabelPlural] = useState('Consultants')

    const [addModalOpen, setAddModalOpen] = useState(false)
    const [editModalOpen, setEditModalOpen] = useState(false)

    const [adding, setAdding] = useState(false)
    const [saving, setSaving] = useState(false)

    const [activeEditType, setActiveEditType] = useState<SegmentKey>('consultants')
    const [editingConsultant, setEditingConsultant] = useState<Consultant | null>(null)
    const [editingAdmin, setEditingAdmin] = useState<ProjectAdmin | null>(null)

    const [consultantForm] = Form.useForm()
    const [projectAdminForm] = Form.useForm()
    const [editConsultantForm] = Form.useForm()
    const [editProjectAdminForm] = Form.useForm()

    const screens = Grid.useBreakpoint()
    const isMobile = !screens.md
    const navigate = useNavigate()

    useEffect(() => {
        if (user?.companyCode) setCompanyCode(user.companyCode)
    }, [user])

    useEffect(() => {
        const run = async () => {
            if (!companyCode) return
            try {
                const snap = await getDoc(doc(db, 'systemSettings', companyCode))
                const label = String(snap.data()?.consultantLabel || 'Consultant').trim()
                setConsultantLabel(label)
                setConsultantLabelPlural(label.endsWith('s') ? label : `${label}s`)
            } catch {
                setConsultantLabel('Consultant')
                setConsultantLabelPlural('Consultants')
            }
        }
        run()
    }, [companyCode])

    const fetchConsultants = async (cc: string) => {
        setLoadingConsultants(true)
        try {
            const q = query(collection(db, 'consultants'), where('companyCode', '==', cc))
            const snapshot = await getDocs(q)

            const list: Consultant[] = await Promise.all(
                snapshot.docs.map(async d => {
                    const data = d.data() as any
                    const c: Consultant = {
                        id: d.id,
                        name: String(data?.name ?? ''),
                        email: String(data?.email ?? ''),
                        rate: Number(data?.rate ?? 0),
                        expertise: Array.isArray(data?.expertise) ? data.expertise : [],
                        assignmentsCount: 0,
                        rating: data?.rating != null ? Number(data.rating) : undefined,
                        active: toBool(data?.active, true),
                        type: data?.type === 'Internal' ? 'Internal' : 'External'
                    }

                    const assignmentsSnap = await getDocs(
                        query(collection(db, 'assignedInterventions'), where('consultantId', '==', c.id))
                    )
                    c.assignmentsCount = assignmentsSnap.size
                    return c
                })
            )

            setConsultants(list)
        } catch (e) {
            console.error(e)
            message.error(`Failed to load ${consultantLabelPlural.toLowerCase()}.`)
        } finally {
            setLoadingConsultants(false)
        }
    }

    const fetchProjectAdmins = async (cc: string) => {
        setLoadingAdmins(true)
        try {
            const q = query(
                collection(db, 'users'),
                where('companyCode', '==', cc),
                where('role', '==', 'projectAdmin')
            )
            const snapshot = await getDocs(q)

            const list: ProjectAdmin[] = snapshot.docs.map(d => {
                const data = d.data() as any
                return {
                    id: d.id,
                    name: String(data?.name ?? ''),
                    email: String(data?.email ?? ''),
                    role: 'projectAdmin',
                    companyCode: String(data?.companyCode ?? cc),
                    active: toBool(data?.active, true),
                    permissions: Array.isArray(data?.permissions) ? data.permissions : [],
                    createdAt: typeof data?.createdAt === 'string' ? data.createdAt : undefined
                }
            })

            setProjectAdmins(list)
        } catch (e) {
            console.error(e)
            message.error('Failed to load project admins.')
        } finally {
            setLoadingAdmins(false)
        }
    }

    useEffect(() => {
        if (!companyCode) return
        fetchConsultants(companyCode)
        fetchProjectAdmins(companyCode)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyCode])

    const filteredConsultants = useMemo(() => {
        const q = searchText.trim().toLowerCase()
        if (!q) return consultants
        return consultants.filter(c => {
            const name = (c.name ?? '').toLowerCase()
            const email = (c.email ?? '').toLowerCase()
            return name.includes(q) || email.includes(q)
        })
    }, [consultants, searchText])

    const filteredAdmins = useMemo(() => {
        const q = searchText.trim().toLowerCase()
        if (!q) return projectAdmins
        return projectAdmins.filter(a => {
            const name = (a.name ?? '').toLowerCase()
            const email = (a.email ?? '').toLowerCase()
            return name.includes(q) || email.includes(q)
        })
    }, [projectAdmins, searchText])

    const metrics = useMemo(() => {
        const consultantTotal = consultants.length
        const consultantActive = consultants.filter(c => c.active).length
        const avgRating = consultantTotal
            ? consultants.reduce((sum, c) => sum + (c.rating ?? 0), 0) / consultantTotal
            : 0

        const adminTotal = projectAdmins.length
        const adminActive = projectAdmins.filter(a => a.active).length

        return {
            consultantTotal,
            consultantActive,
            avgRating,
            adminTotal,
            adminActive
        }
    }, [consultants, projectAdmins])

    const openAddModal = () => {
        setAddModalOpen(true)
        consultantForm.resetFields()
        projectAdminForm.resetFields()
        consultantForm.setFieldsValue({ type: 'External' })
        projectAdminForm.setFieldsValue({ permissions: [] })
    }

    const openEdit = (type: SegmentKey, record: Consultant | ProjectAdmin) => {
        setActiveEditType(type)

        if (type === 'consultants') {
            const c = record as Consultant
            setEditingConsultant(c)
            setEditingAdmin(null)
            editConsultantForm.setFieldsValue({
                name: c.name,
                email: c.email,
                expertise: c.expertise,
                rate: c.rate,
                type: c.type || 'External',
                active: toBool(c.active, true)
            })
        } else {
            const a = record as ProjectAdmin
            setEditingAdmin(a)
            setEditingConsultant(null)
            editProjectAdminForm.setFieldsValue({
                name: a.name,
                email: a.email,
                permissions: a.permissions || [],
                active: toBool(a.active, true)
            })
        }

        setEditModalOpen(true)
    }

    const createPlatformUser = async (payload: any) => {
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('Not authenticated')

        const resp = await fetch('https://createplatformuser-zv4wtb2ujq-uc.a.run.app', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`
            },
            body: JSON.stringify(payload)
        })

        const data = await resp.json()
        if (!resp.ok || !data?.ok) throw new Error(data?.error || 'create_failed')
        return data
    }

    const handleAddConsultant = async (values: any) => {
        setAdding(true)
        try {
            const payload = {
                email: values.email,
                name: values.name,
                role: 'consultant',
                companyCode,
                expertise: values.expertise || [],
                rate: Number(values.rate),
                initialPassword: 'Password@1',
                sendResetLink: false,
                forcePasswordChangeOnFirstLogin: true,
                allowExisting: false,
                type: values.type || 'External'
            }

            await createPlatformUser(payload)

            message.success(`${consultantLabel} created with default password: Password@1`)
            consultantForm.resetFields()
            setAddModalOpen(false)
            fetchConsultants(companyCode)
        } catch (e: any) {
            console.error(e)
            message.error(e?.message || `Failed to create ${consultantLabel.toLowerCase()}.`)
        } finally {
            setAdding(false)
        }
    }

    const handleAddProjectAdmin = async (values: any) => {
        setAdding(true)
        try {
            const payload = {
                email: values.email,
                name: values.name,
                role: 'projectAdmin',
                companyCode,
                permissions: Array.isArray(values.permissions) ? values.permissions : [],
                initialPassword: 'Password@1',
                sendResetLink: false,
                forcePasswordChangeOnFirstLogin: true,
                allowExisting: false
            }

            await createPlatformUser(payload)

            message.success('Project admin created with default password: Password@1')
            projectAdminForm.resetFields()
            setAddModalOpen(false)
            fetchProjectAdmins(companyCode)
        } catch (e: any) {
            console.error(e)
            message.error(e?.message || 'Failed to create project admin.')
        } finally {
            setAdding(false)
        }
    }

    const handleSaveEdit = async (values: any) => {
        setSaving(true)
        try {
            if (activeEditType === 'consultants') {
                if (!editingConsultant) return
                await updateDoc(doc(db, 'consultants', editingConsultant.id), {
                    name: values.name,
                    expertise: Array.isArray(values.expertise) ? values.expertise : [],
                    rate: Number(values.rate),
                    type: values.type || 'External',
                    active: Boolean(values.active)
                })
                message.success(`${consultantLabel} updated.`)
                setEditModalOpen(false)
                setEditingConsultant(null)
                fetchConsultants(companyCode)
                return
            }

            if (!editingAdmin) return
            await updateDoc(doc(db, 'users', editingAdmin.id), {
                name: values.name,
                permissions: Array.isArray(values.permissions) ? values.permissions : [],
                active: Boolean(values.active),
                updatedAt: new Date().toISOString()
            })
            message.success('Project admin updated.')
            setEditModalOpen(false)
            setEditingAdmin(null)
            fetchProjectAdmins(companyCode)
        } catch (e: any) {
            console.error(e)
            message.error(e?.message || 'Failed to save changes.')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (record: Consultant | ProjectAdmin) => {
        const email = (record as any)?.email
        if (!email) {
            message.error('Email not found.')
            return
        }

        const isConsultant = (record as any)?.expertise != null
        const title = isConsultant ? consultantLabel : 'Project admin'

        Modal.confirm({
            title: `Delete ${title}`,
            content: `Are you sure you want to permanently delete "${(record as any)?.name}" (${email})? This will remove their authentication and profile. This cannot be undone.`,
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            async onOk() {
                try {
                    const fn = httpsCallable(functions, 'deleteUserAndFirestore')
                    await fn({
                        email,
                        role: isConsultant ? 'consultant' : 'projectAdmin'
                    })
                    message.success(`${title} deleted.`)
                    if (isConsultant) fetchConsultants(companyCode)
                    else fetchProjectAdmins(companyCode)
                } catch (e: any) {
                    console.error(e)
                    message.error(e?.message || e?.details || 'Delete failed.')
                }
            }
        })
    }

    const handleToggleActive = async (record: Consultant | ProjectAdmin) => {
        try {
            const isConsultant = (record as any)?.expertise != null
            const id = (record as any)?.id
            const nextActive = !toBool((record as any)?.active, true)

            if (isConsultant) {
                await updateDoc(doc(db, 'consultants', id), { active: nextActive })
                message.success(`${consultantLabel} status updated.`)
                fetchConsultants(companyCode)
            } else {
                await updateDoc(doc(db, 'users', id), {
                    active: nextActive,
                    updatedAt: new Date().toISOString()
                })
                message.success('Project admin status updated.')
                fetchProjectAdmins(companyCode)
            }
        } catch (e) {
            console.error(e)
            message.error('Failed to update status.')
        }
    }

    const consultantColumns: ColumnsType<Consultant> = [
        { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name), fixed: 'left', width: 220 },
        { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true, width: 260 },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            width: 120,
            render: v => <Tag color={v === 'Internal' ? 'blue' : 'purple'}>{v || 'External'}</Tag>
        },
        { title: 'Rate/hr', dataIndex: 'rate', key: 'rate', render: v => `R ${Number(v ?? 0)}`, width: 120 },
        { title: 'Assignments', dataIndex: 'assignmentsCount', key: 'assignmentsCount', sorter: (a, b) => (a.assignmentsCount ?? 0) - (b.assignmentsCount ?? 0), width: 140 },
        { title: 'Rating', dataIndex: 'rating', key: 'rating', sorter: (a, b) => (a.rating ?? 0) - (b.rating ?? 0), width: 120, render: v => <Text>{Number(v ?? 0)}</Text> },
        {
            title: 'Status',
            dataIndex: 'active',
            key: 'active',
            width: 120,
            render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag>
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 360,
            render: (_: any, record: Consultant) => (
                <Space wrap>
                    <Button
                        size="small"
                        onClick={() => navigate(`/operations/consultants/${record.id}/performance`, { state: { consultantName: record.name } })}
                    >
                        View Performance
                    </Button>
                    <Button shape='circle' size="small" icon={<EditOutlined />} onClick={() => openEdit('consultants', record)} />
                    <Button shape='circle' size="small" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record)} />
                    <Button size="small" onClick={() => handleToggleActive(record)}>
                        {record.active ? 'Deactivate' : 'Activate'}
                    </Button>
                </Space>
            )
        }
    ]

    const adminColumns: ColumnsType<ProjectAdmin> = [
        { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name), fixed: 'left', width: 240 },
        { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true, width: 280 },
        {
            title: 'Permissions',
            dataIndex: 'permissions',
            key: 'permissions',
            width: 420,
            render: (perms: string[]) => {
                const list = Array.isArray(perms) ? perms : []
                if (!list.length) return <Text type="secondary">None</Text>
                return (
                    <Space wrap size={[6, 6]}>
                        {list.slice(0, 8).map(p => {
                            const label = PROJECT_ADMIN_PERMISSIONS.find(x => x.key === p)?.label || p
                            return (
                                <Tag key={p} color="blue">
                                    {label}
                                </Tag>
                            )
                        })}
                        {list.length > 8 ? <Tag>+{list.length - 8}</Tag> : null}
                    </Space>
                )
            }
        },
        {
            title: 'Status',
            dataIndex: 'active',
            key: 'active',
            width: 130,
            render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag>
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 300,
            render: (_: any, record: ProjectAdmin) => (
                <Space wrap>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit('projectAdmins', record)} />
                    <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record)} />
                    <Button size="small" onClick={() => handleToggleActive(record)}>
                        {record.active ? 'Deactivate' : 'Activate'}
                    </Button>
                </Space>
            )
        }
    ]

    const exportingData = useMemo(() => {
        return segment === 'consultants' ? consultants : projectAdmins
    }, [segment, consultants, projectAdmins])

    const headerRight = (
        <Space wrap>
            <Segmented
                value={segment}
                onChange={v => setSegment(v as SegmentKey)}
                options={[
                    { label: consultantLabelPlural, value: 'consultants' },
                    { label: 'Project Admins', value: 'projectAdmins' }
                ]}
            />
            <Input.Search
                placeholder="Search by name or email"
                onSearch={v => setSearchText(v)}
                allowClear
                style={{ width: 260 }}
            />
            <Button
                shape='round'
                color="geekblue"
                variant='filled'
                style={{ border: '1px solid dodgerblue' }}
                icon={<PlusOutlined />}
                onClick={openAddModal}>
                Add {segment === 'consultants' ? consultantLabel : 'Project Admin'}
            </Button>
            <Button shape='round'
                color="green"
                variant='filled'
                style={{ border: '1px solid limegreen' }}
                icon={<DownloadOutlined />} type="default">
                <CSVLink
                    filename={segment === 'consultants' ? 'consultants.csv' : 'project-admins.csv'}
                    data={exportingData as any}
                    style={{ color: 'inherit' }}
                >
                    Export
                </CSVLink>
            </Button>
        </Space>
    )

    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            <Helmet>
                <title>Users | Smart Incubation</title>
            </Helmet>

            <DashboardHeaderCard
                title="Users"
                titleIcon={<TeamOutlined />}
                subtitle="Manage consultants and project admins."
                titleTag={{
                    label: segment === 'consultants' ? consultantLabelPlural : 'Project Admins',
                    color: segment === 'consultants' ? 'blue' : 'purple',
                    icon: segment === 'consultants' ? <UserOutlined /> : <CrownOutlined />
                }}
                extraRight={headerRight}
            />

            {/* Metrics (conditional by segment) */}
            <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
                {segment === 'consultants' ? (
                    <>
                        <Col xs={24} sm={8}>
                            <MotionCard>
                                <MotionCard.Metric
                                    icon={<UserOutlined style={{ fontSize: 20, color: '#1677ff' }} />}
                                    iconBg="rgba(22,119,255,.12)"
                                    title={`Total ${consultantLabelPlural}`}
                                    value={metrics.consultantTotal}
                                    subtitle="All registered"
                                />
                            </MotionCard>
                        </Col>

                        <Col xs={24} sm={8}>
                            <MotionCard>
                                <MotionCard.Metric
                                    icon={<CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />}
                                    iconBg="rgba(82,196,26,.14)"
                                    title={`Active ${consultantLabelPlural}`}
                                    value={metrics.consultantActive}
                                    subtitle="Currently active"
                                />
                            </MotionCard>
                        </Col>

                        <Col xs={24} sm={8}>
                            <MotionCard>
                                <MotionCard.Metric
                                    icon={<StarOutlined style={{ fontSize: 20, color: '#faad14' }} />}
                                    iconBg="rgba(250,173,20,.14)"
                                    title="Average Rating"
                                    value={Number(metrics.avgRating || 0).toFixed(1)}
                                    subtitle="Based on reviews"
                                />
                            </MotionCard>
                        </Col>
                    </>
                ) : (
                    <>
                        <Col xs={24} sm={12}>
                            <MotionCard>
                                <MotionCard.Metric
                                    icon={<CrownOutlined style={{ fontSize: 20, color: '#722ed1' }} />}
                                    iconBg="rgba(114,46,209,.12)"
                                    title="Total Project Admins"
                                    value={metrics.adminTotal}
                                    subtitle="All registered"
                                />
                            </MotionCard>
                        </Col>

                        <Col xs={24} sm={12}>
                            <MotionCard>
                                <MotionCard.Metric
                                    icon={<CheckCircleOutlined style={{ fontSize: 20, color: '#13c2c2' }} />}
                                    iconBg="rgba(19,194,194,.12)"
                                    title="Active Project Admins"
                                    value={metrics.adminActive}
                                    subtitle="Currently active"
                                />
                            </MotionCard>
                        </Col>
                    </>
                )}
            </Row>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <MotionCard>
                    {segment === 'consultants' ? (
                        <>
                            {!loadingConsultants && filteredConsultants.length === 0 ? (
                                <Empty description={`No ${consultantLabelPlural.toLowerCase()} found`} />
                            ) : (
                                <Skeleton active loading={loadingConsultants}>
                                    {isMobile ? (
                                        <List
                                            dataSource={filteredConsultants}
                                            rowKey="id"
                                            pagination={{ pageSize: 8 }}
                                            renderItem={(c: Consultant) => (
                                                <List.Item
                                                    key={c.id}
                                                    actions={[
                                                        <Button
                                                            key="perf"
                                                            size="small"
                                                            onClick={() =>
                                                                navigate(`/operations/consultants/${c.id}/performance`, {
                                                                    state: { consultantName: c.name }
                                                                })
                                                            }
                                                        >
                                                            View Performance
                                                        </Button>,
                                                        <Button key="edit" size="small" icon={<EditOutlined />} onClick={() => openEdit('consultants', c)} />,
                                                        <Button key="del" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(c)} />,
                                                        <Button key="toggle" size="small" onClick={() => handleToggleActive(c)}>
                                                            {c.active ? 'Deactivate' : 'Activate'}
                                                        </Button>
                                                    ]}
                                                >
                                                    <List.Item.Meta
                                                        avatar={
                                                            <Avatar style={{ backgroundColor: '#1677ff' }}>
                                                                {(c.name || 'C').charAt(0).toUpperCase()}
                                                            </Avatar>
                                                        }
                                                        title={
                                                            <Space size={8} wrap>
                                                                <Text strong style={{ fontSize: 16 }}>
                                                                    {c.name}
                                                                </Text>
                                                                <Tag color={c.active ? 'green' : 'red'}>
                                                                    {c.active ? 'Active' : 'Inactive'}
                                                                </Tag>
                                                                <Tag color={c.type === 'Internal' ? 'blue' : 'purple'}>{c.type || 'External'}</Tag>
                                                            </Space>
                                                        }
                                                        description={
                                                            <div style={{ marginTop: 4 }}>
                                                                <div style={{ marginBottom: 6 }}>
                                                                    <Text type="secondary">{c.email}</Text>
                                                                </div>
                                                                <Space wrap size={[6, 6]} style={{ marginBottom: 6 }}>
                                                                    {(c.expertise || []).map((e, i) => (
                                                                        <Tag key={i} color="blue">
                                                                            {e}
                                                                        </Tag>
                                                                    ))}
                                                                </Space>
                                                                <Space size="middle" wrap>
                                                                    <Text>
                                                                        Rate/hr: <Text strong>R {Number(c.rate ?? 0)}</Text>
                                                                    </Text>
                                                                    <Text>
                                                                        Assignments: <Text strong>{c.assignmentsCount ?? 0}</Text>
                                                                    </Text>
                                                                    <Space>
                                                                        Rating: <Text>{Number(c.rating ?? 0)}</Text>
                                                                    </Space>
                                                                </Space>
                                                            </div>
                                                        }
                                                    />
                                                </List.Item>
                                            )}
                                        />
                                    ) : (
                                        <Table
                                            columns={consultantColumns}
                                            dataSource={filteredConsultants}
                                            rowKey="id"
                                            pagination={{ pageSize: 8, showSizeChanger: false }}
                                            scroll={{ x: 1200 }}
                                            tableLayout="fixed"
                                        />
                                    )}
                                </Skeleton>
                            )}
                        </>
                    ) : (
                        <>
                            {!loadingAdmins && filteredAdmins.length === 0 ? (
                                <Empty description="No project admins found" />
                            ) : (
                                <Skeleton active loading={loadingAdmins}>
                                    {isMobile ? (
                                        <List
                                            dataSource={filteredAdmins}
                                            rowKey="id"
                                            pagination={{ pageSize: 8 }}
                                            renderItem={(a: ProjectAdmin) => (
                                                <List.Item
                                                    key={a.id}
                                                    actions={[
                                                        <Button key="edit" size="small" icon={<EditOutlined />} onClick={() => openEdit('projectAdmins', a)} />,
                                                        <Button key="del" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(a)} />,
                                                        <Button key="toggle" size="small" onClick={() => handleToggleActive(a)}>
                                                            {a.active ? 'Deactivate' : 'Activate'}
                                                        </Button>
                                                    ]}
                                                >
                                                    <List.Item.Meta
                                                        avatar={
                                                            <Avatar style={{ backgroundColor: '#722ed1' }}>
                                                                {(a.name || 'P').charAt(0).toUpperCase()}
                                                            </Avatar>
                                                        }
                                                        title={
                                                            <Space size={8} wrap>
                                                                <Text strong style={{ fontSize: 16 }}>
                                                                    {a.name}
                                                                </Text>
                                                                <Tag color={a.active ? 'green' : 'red'}>{a.active ? 'Active' : 'Inactive'}</Tag>
                                                            </Space>
                                                        }
                                                        description={
                                                            <div style={{ marginTop: 4 }}>
                                                                <div style={{ marginBottom: 6 }}>
                                                                    <Text type="secondary">{a.email}</Text>
                                                                </div>
                                                                <Space wrap size={[6, 6]}>
                                                                    {(a.permissions || []).slice(0, 8).map(p => {
                                                                        const label = PROJECT_ADMIN_PERMISSIONS.find(x => x.key === p)?.label || p
                                                                        return (
                                                                            <Tag key={p} color="blue">
                                                                                {label}
                                                                            </Tag>
                                                                        )
                                                                    })}
                                                                    {(a.permissions || []).length > 8 ? <Tag>+{(a.permissions || []).length - 8}</Tag> : null}
                                                                </Space>
                                                            </div>
                                                        }
                                                    />
                                                </List.Item>
                                            )}
                                        />
                                    ) : (
                                        <Table
                                            columns={adminColumns}
                                            dataSource={filteredAdmins}
                                            rowKey="id"
                                            pagination={{ pageSize: 8, showSizeChanger: false }}
                                            scroll={{ x: 1200 }}
                                            tableLayout="fixed"
                                        />
                                    )}
                                </Skeleton>
                            )}
                        </>
                    )}
                </MotionCard>
            </motion.div>

            {/* Add Modal */}
            <Modal
                title={segment === 'consultants' ? `Add New ${consultantLabel}` : 'Add New Project Admin'}
                open={addModalOpen}
                onCancel={() => setAddModalOpen(false)}
                onOk={() => (segment === 'consultants' ? consultantForm.submit() : projectAdminForm.submit())}
                okText={segment === 'consultants' ? `Add ${consultantLabel}` : 'Add Project Admin'}
                centered
                confirmLoading={adding}
                width={680}
                bodyStyle={{ maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' }}
            >
                <Alert
                    type="info"
                    showIcon
                    message="Default password"
                    description={
                        <span>
                            New users are created with the default password <b>Password@1</b>. They should change it on first login.
                        </span>
                    }
                    style={{ marginBottom: 16 }}
                />

                {segment === 'consultants' ? (
                    <Form form={consultantForm} layout="vertical" onFinish={handleAddConsultant}>
                        <Form.Item name="name" label="Name" rules={[{ required: true, message: `Please enter ${consultantLabel.toLowerCase()} name` }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item
                            name="email"
                            label="Email"
                            rules={[
                                { required: true, message: `Please enter ${consultantLabel.toLowerCase()} email` },
                                { type: 'email' as any, message: 'Enter a valid email' }
                            ]}
                        >
                            <Input />
                        </Form.Item>

                        <Form.Item name="expertise" label="Expertise Areas" rules={[{ required: true, message: 'Please select expertise' }]}>
                            <Select
                                mode="tags"
                                placeholder="Add expertise areas"
                                options={defaultExpertise.map(area => ({ value: area, label: area }))}
                            />
                        </Form.Item>

                        <Form.Item name="rate" label="Rate per Hour (ZAR)" rules={[{ required: true, message: 'Please enter a rate' }]}>
                            <Input type="number" min={0} />
                        </Form.Item>

                        <Form.Item name="type" label="Consultant Type" rules={[{ required: true, message: 'Please select consultant type' }]}>
                            <Select placeholder="Select type">
                                <Select.Option value="Internal">Internal</Select.Option>
                                <Select.Option value="External">External</Select.Option>
                            </Select>
                        </Form.Item>
                    </Form>
                ) : (
                    <Form form={projectAdminForm} layout="vertical" onFinish={handleAddProjectAdmin}>
                        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter project admin name' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item
                            name="email"
                            label="Email"
                            rules={[
                                { required: true, message: 'Please enter project admin email' },
                                { type: 'email' as any, message: 'Enter a valid email' }
                            ]}
                        >
                            <Input />
                        </Form.Item>

                        <Form.Item name="permissions" label="Access Rights" rules={[{ required: true, message: 'Select at least one permission' }]}>
                            <Checkbox.Group style={{ width: '100%' }}>
                                <Row gutter={[8, 8]}>
                                    {PROJECT_ADMIN_PERMISSIONS.map(p => (
                                        <Col xs={24} sm={12} md={12} key={p.key}>
                                            <Checkbox value={p.key}>{p.label}</Checkbox>
                                        </Col>
                                    ))}
                                </Row>
                            </Checkbox.Group>
                        </Form.Item>
                    </Form>
                )}

                <style>{`
                    .ant-modal-body { overflow-x: hidden !important; }
                    .ant-checkbox-wrapper { white-space: normal; }
                `}</style>
            </Modal>

            {/* Edit Modal */}
            <Modal
                title={activeEditType === 'consultants' ? `Edit ${consultantLabel}` : 'Edit Project Admin'}
                open={editModalOpen}
                onCancel={() => setEditModalOpen(false)}
                onOk={() => (activeEditType === 'consultants' ? editConsultantForm.submit() : editProjectAdminForm.submit())}
                okText="Save"
                confirmLoading={saving}
                centered
                width={680}
                bodyStyle={{ maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' }}
            >
                {activeEditType === 'consultants' ? (
                    <Form form={editConsultantForm} layout="vertical" onFinish={handleSaveEdit}>
                        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter name' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="email" label="Email">
                            <Input disabled />
                        </Form.Item>

                        <Form.Item name="expertise" label="Expertise Areas" rules={[{ required: true, message: 'Please select expertise' }]}>
                            <Select
                                mode="tags"
                                placeholder="Add expertise areas"
                                options={defaultExpertise.map(area => ({ value: area, label: area }))}
                            />
                        </Form.Item>

                        <Form.Item name="rate" label="Rate per Hour (ZAR)" rules={[{ required: true, message: 'Please enter a rate' }]}>
                            <Input type="number" min={0} />
                        </Form.Item>

                        <Form.Item name="type" label="Consultant Type" rules={[{ required: true, message: 'Please select consultant type' }]}>
                            <Select placeholder="Select type">
                                <Select.Option value="Internal">Internal</Select.Option>
                                <Select.Option value="External">External</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name="active" label="Active" valuePropName="checked">
                            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                        </Form.Item>
                    </Form>
                ) : (
                    <Form form={editProjectAdminForm} layout="vertical" onFinish={handleSaveEdit}>
                        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter name' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="email" label="Email">
                            <Input disabled />
                        </Form.Item>

                        <Form.Item name="permissions" label="Access Rights" rules={[{ required: true, message: 'Select at least one permission' }]}>
                            <Checkbox.Group style={{ width: '100%' }}>
                                <Row gutter={[8, 8]}>
                                    {PROJECT_ADMIN_PERMISSIONS.map(p => (
                                        <Col xs={24} sm={12} md={12} key={p.key}>
                                            <Checkbox value={p.key}>{p.label}</Checkbox>
                                        </Col>
                                    ))}
                                </Row>
                            </Checkbox.Group>
                        </Form.Item>

                        <Form.Item name="active" label="Active" valuePropName="checked">
                            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                        </Form.Item>

                        <Alert
                            type="warning"
                            showIcon
                            message="Email changes are not supported here"
                            description="To change an email, do it through your backend flow so Auth + Firestore stay consistent."
                        />

                        <style>{`
                            .ant-modal-body { overflow-x: hidden !important; }
                            .ant-checkbox-wrapper { white-space: normal; }
                        `}</style>
                    </Form>
                )}
            </Modal>

            <style>{`
                .ant-table-cell { vertical-align: top; }
            `}</style>
        </div>
    )
}

export default UsersPage
