// src/pages/operations/OperationsOnboardingDashboard.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
    Card,
    Table,
    Row,
    Col,
    Button,
    Typography,
    Input,
    Space,
    Statistic,
    Spin,
    Form,
    Select,
    Modal,
    message,
    Layout,
    Tag,
    Tooltip,
    Divider,
    Empty
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { collection, getDocs, setDoc, query, where, doc } from 'firebase/firestore'
import { db, auth } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { Helmet } from 'react-helmet'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
    PlusOutlined,
    TeamOutlined,
    ManOutlined,
    WomanOutlined,
    ClockCircleOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined,
    UserAddOutlined,
    MailOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'

const { Text } = Typography
const { Option } = Select

interface OperationsUser {
    id: string
    uid?: string
    name: string
    email: string
    gender?: string
    phone?: string
    companyCode: string
    createdAt?: any
    updatedAt?: any
}

const toDate = (v: any): Date | null => {
    if (!v) return null
    if (v instanceof Date) return v
    if (typeof v?.toDate === 'function') return v.toDate()
    if (typeof v === 'string' || typeof v === 'number') {
        const d = new Date(v)
        return Number.isNaN(d.getTime()) ? null : d
    }
    return null
}

const generateTempPassword = () => {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
    return `SmartInc@${rand}1!`
}

const CREATE_PLATFORM_USER_URL =
    'https://us-central1-incubation-platform-61610.cloudfunctions.net/createPlatformUser'

export const OperationsOnboardingDashboard: React.FC = () => {
    const [operationsStaff, setOperationsStaff] = useState<OperationsUser[]>([])
    const [filteredStaff, setFilteredStaff] = useState<OperationsUser[]>([])
    const [loading, setLoading] = useState(true)
    const [searchText, setSearchText] = useState('')
    const [addModalVisible, setAddModalVisible] = useState(false)
    const [companyCode, setCompanyCode] = useState<string>('')
    const [editingStaff, setEditingStaff] = useState<OperationsUser | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const [form] = Form.useForm()
    const { user, loading: identityLoading } = useFullIdentity()
    const functions = getFunctions()

    const getAuthUidByEmail = async (email: string) => {
        const snapshot = await getDocs(query(collection(db, 'users'), where('email', '==', email)))
        if (snapshot.empty) throw new Error('No user found with that email')
        const data = snapshot.docs[0].data() as any
        if (!data?.uid) throw new Error('User doc missing uid field')
        return data.uid as string
    }

    const fetchOperationsStaff = async (cc: string) => {
        try {
            setLoading(true)
            const snapshot = await getDocs(query(collection(db, 'operationsStaff'), where('companyCode', '==', cc)))
            const staffList = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as OperationsUser[]
            setOperationsStaff(staffList)
            setFilteredStaff(staffList)
        } catch (e) {
            console.error(e)
            message.error('Failed to load operations staff.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!identityLoading) {
            if (user?.companyCode) {
                setCompanyCode(user.companyCode)
                fetchOperationsStaff(user.companyCode)
            } else {
                setLoading(false)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [identityLoading, user?.companyCode])

    const handleSearch = (value: string) => {
        setSearchText(value)
        const v = value.trim().toLowerCase()
        if (!v) {
            setFilteredStaff(operationsStaff)
            return
        }

        const filtered = operationsStaff.filter(s => {
            const name = (s.name || '').toLowerCase()
            const email = (s.email || '').toLowerCase()
            const phone = (s.phone || '').toLowerCase()
            return name.includes(v) || email.includes(v) || phone.includes(v)
        })

        setFilteredStaff(filtered)
    }

    const closeModal = () => {
        setAddModalVisible(false)
        setEditingStaff(null)
        setSubmitting(false)
        form.resetFields()
    }

    const createOpsUserViaCloudFunction = async (payload: any) => {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('missing_id_token')

        const res = await fetch(CREATE_PLATFORM_USER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'createPlatformUser_failed')
        return json
    }

    const handleFinish = async (values: any) => {
        try {
            setSubmitting(true)

            const { email, name, gender, phone } = values

            if (editingStaff) {
                const userUid = await getAuthUidByEmail(email)

                await setDoc(
                    doc(db, 'users', userUid),
                    {
                        ...editingStaff,
                        ...values,
                        updatedAt: new Date()
                    },
                    { merge: true }
                )

                await setDoc(
                    doc(db, 'operationsStaff', editingStaff.id),
                    {
                        ...editingStaff,
                        ...values,
                        updatedAt: new Date()
                    },
                    { merge: true }
                )

                message.success('Staff updated successfully!')
                closeModal()
                fetchOperationsStaff(companyCode)
                return
            }

            // create using your existing onRequest function + email password
            const tempPassword = 'Password@1'

            await createOpsUserViaCloudFunction({
                email,
                name,
                role: 'operations',
                companyCode,
                phone,
                // stored in /users (and available to you), ops mirror may need backend patch to include these
                extra: { gender },
                initialPassword: tempPassword,
                sendEmail: true,
                sendResetLink: false,
                forcePasswordChangeOnFirstLogin: false
            })

            message.success('Operations Staff added successfully. Password emailed to the user.')
            closeModal()
            fetchOperationsStaff(companyCode)
        } catch (error: any) {
            console.error('Error saving staff:', error)
            const msg = String(error?.message || '')

            if (msg.includes('invalid_email')) message.error('Please enter a valid email.')
            else if (msg.includes('permission_denied')) message.error('You do not have permission to create staff.')
            else if (msg.includes('cross_company_creation_forbidden')) message.error('You cannot create users for another company.')
            else if (msg.includes('email_already_exists')) message.error('This email already exists.')
            else message.error(error?.message || 'Failed to save operations staff.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleEdit = (record: OperationsUser) => {
        setEditingStaff(record)
        form.setFieldsValue({
            name: record.name,
            gender: record.gender,
            phone: record.phone,
            email: record.email
        })
        setAddModalVisible(true)
    }

    const handleDelete = async (record: OperationsUser) => {
        Modal.confirm({
            title: 'Confirm Delete',
            content: `Are you sure you want to permanently delete "${record.name}" (${record.email})? This cannot be undone.`,
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            async onOk() {
                try {
                    const deleteUser = httpsCallable(functions, 'deleteUserAndFirestore')
                    await deleteUser({ email: record.email, role: 'operations' })
                    message.success('Staff deleted successfully.')
                    fetchOperationsStaff(companyCode)
                } catch (error: any) {
                    console.error('Error deleting staff:', error)
                    message.error(error?.message || error?.details || 'Failed to delete staff from Auth/Firestore.')
                }
            }
        })
    }

    const metrics = useMemo(() => {
        const total = operationsStaff.length
        const male = operationsStaff.filter(s => (s.gender || '').toLowerCase() === 'male').length
        const female = operationsStaff.filter(s => (s.gender || '').toLowerCase() === 'female').length

        const now = new Date()
        const thirtyDaysAgo = new Date(now)
        thirtyDaysAgo.setDate(now.getDate() - 30)

        const newLast30 = operationsStaff.filter(s => {
            const d = toDate(s.createdAt)
            return d ? d >= thirtyDaysAgo : false
        }).length

        return { total, male, female, newLast30 }
    }, [operationsStaff])

    const columns: ColumnsType<OperationsUser> = [
        {
            title: 'Staff Member',
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
            render: (_, r) => (
                <Space direction="vertical" size={0}>
                    <Space size={8} wrap>
                        <Text strong>{r.name || '—'}</Text>
                        {r.gender ? (
                            <Tag icon={r.gender === 'Male' ? <ManOutlined /> : <WomanOutlined />}>{r.gender}</Tag>
                        ) : (
                            <Tag color="default">Gender: —</Tag>
                        )}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.email || 'No email'} {r.phone ? `• ${r.phone}` : ''}
                    </Text>
                </Space>
            )
        },
        {
            title: 'Company',
            dataIndex: 'companyCode',
            key: 'companyCode',
            width: 120,
            render: v => <Tag color="geekblue">{v || '—'}</Tag>
        },
        {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 140,
            sorter: (a, b) => (toDate(a.createdAt)?.getTime() || 0) - (toDate(b.createdAt)?.getTime() || 0),
            render: v => {
                const d = toDate(v)
                if (!d) return <Text type="secondary">—</Text>
                return <Text>{d.toLocaleDateString()}</Text>
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 160,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Edit staff member">
                        <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                            Edit
                        </Button>
                    </Tooltip>
                    <Tooltip title="Delete staff member">
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
                            Delete
                        </Button>
                    </Tooltip>
                </Space>
            )
        }
    ]

    return (
        <>
            <Helmet>
                <title>Operations Staff | Smart Incubation</title>
            </Helmet>

            <Layout.Content style={{ padding: 24 }}>
                <div>
                    <DashboardHeaderCard
                        title="Operations Staff"
                        titleIcon={<TeamOutlined />}
                        subtitle={
                            <Space size={8} wrap>
                                <span>Manage onboarding & permissions</span>
                                <Tag icon={<SafetyCertificateOutlined />} color="blue">
                                    Secure
                                </Tag>
                                <Tag icon={<MailOutlined />} color="green">
                                    Emails password on create
                                </Tag>
                            </Space>
                        }
                        extraRight={
                            <Space wrap>
                                <Input
                                    value={searchText}
                                    onChange={e => handleSearch(e.target.value)}
                                    prefix={<SearchOutlined />}
                                    placeholder="Search name, email, phone"
                                    allowClear
                                    style={{ width: 280, borderRadius: 10 }}
                                />
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => setAddModalVisible(true)}
                                    style={{ borderRadius: 10 }}
                                >
                                    Add New
                                </Button>
                            </Space>
                        }
                    />

                    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                        <Col xs={24} sm={12} lg={6}>
                            <MotionCard style={{ borderRadius: 14 }}>
                                <Statistic title="Total Operations Users" value={metrics.total} prefix={<TeamOutlined />} />
                            </MotionCard>
                        </Col>
                        <Col xs={24} sm={12} lg={6}>
                            <MotionCard style={{ borderRadius: 14 }}>
                                <Statistic title="Male" value={metrics.male} prefix={<ManOutlined />} />
                            </MotionCard>
                        </Col>
                        <Col xs={24} sm={12} lg={6}>
                            <MotionCard style={{ borderRadius: 14 }}>
                                <Statistic title="Female" value={metrics.female} prefix={<WomanOutlined />} />
                            </MotionCard>
                        </Col>
                        <Col xs={24} sm={12} lg={6}>
                            <MotionCard style={{ borderRadius: 14 }}>
                                <Statistic title="New (Last 30 Days)" value={metrics.newLast30} prefix={<ClockCircleOutlined />} />
                            </MotionCard>
                        </Col>
                    </Row>

                    <Card style={{ borderRadius: 14 }}>
                        <Row justify="space-between" align="middle" gutter={[12, 12]}>
                            <Col>
                                <Space direction="vertical" size={0}>
                                    <Text strong>Staff List</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {filteredStaff.length} result(s)
                                    </Text>
                                </Space>
                            </Col>
                            <Col>
                                <Tag icon={<UserAddOutlined />} color="processing">
                                    Tip: Search works live as you type
                                </Tag>
                            </Col>
                        </Row>

                        <Divider style={{ margin: '12px 0' }} />

                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                                <Spin size="large" />
                            </div>
                        ) : filteredStaff.length === 0 ? (
                            <Empty description="No operations staff found." style={{ padding: 24 }} />
                        ) : (
                            <Table
                                columns={columns}
                                dataSource={filteredStaff}
                                rowKey="id"
                                pagination={{ pageSize: 8, showSizeChanger: false }}
                            />
                        )}
                    </Card>

                    <Modal
                        title={
                            <Space>
                                {editingStaff ? <EditOutlined /> : <PlusOutlined />}
                                <span>{editingStaff ? 'Edit Operations Staff' : 'Add New Operations Staff'}</span>
                            </Space>
                        }
                        open={addModalVisible}
                        onCancel={closeModal}
                        onOk={() => form.submit()}
                        okText={editingStaff ? 'Update Staff' : 'Create & Email Password'}
                        okButtonProps={{ style: { borderRadius: 10 }, loading: submitting }}
                        cancelButtonProps={{ style: { borderRadius: 10 } }}
                        destroyOnClose
                    >
                        <Form form={form} layout="vertical" onFinish={handleFinish}>
                            <Row gutter={12}>
                                <Col xs={24} md={12}>
                                    <Form.Item
                                        label="Full Name"
                                        name="name"
                                        rules={[{ required: true, message: 'Please enter full name' }]}
                                    >
                                        <Input placeholder="Enter full name" />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={12}>
                                    <Form.Item label="Gender" name="gender" rules={[{ required: true, message: 'Please select gender' }]}>
                                        <Select placeholder="Select gender">
                                            <Option value="Male">Male</Option>
                                            <Option value="Female">Female</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={12}>
                                    <Form.Item
                                        label="Phone Number"
                                        name="phone"
                                        rules={[{ required: true, message: 'Please enter phone number' }]}
                                    >
                                        <Input placeholder="Enter phone number" />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={12}>
                                    <Form.Item
                                        label="Email Address"
                                        name="email"
                                        rules={[
                                            { required: true, message: 'Please enter email address' },
                                            { type: 'email', message: 'Enter a valid email address' }
                                        ]}
                                    >
                                        <Input placeholder="Enter email address" />
                                    </Form.Item>
                                </Col>

                                {!editingStaff && (
                                    <Col xs={24}>
                                        <Tag icon={<MailOutlined />} color="green">
                                            A temporary password will be generated and emailed to this user.
                                        </Tag>
                                    </Col>
                                )}
                            </Row>
                        </Form>
                    </Modal>
                </div>
            </Layout.Content>
        </>
    )
}

export default OperationsOnboardingDashboard
