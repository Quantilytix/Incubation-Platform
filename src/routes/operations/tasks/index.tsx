import React, { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Button,
    Card,
    Form,
    Input,
    Modal,
    Select,
    Space,
    Table,
    Tag,
    Typography,
    Upload,
    DatePicker,
    Row,
    Col,
    Collapse,
    message
} from 'antd'
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    UploadOutlined,
    FileSearchOutlined,
    DownOutlined
} from '@ant-design/icons'
import { db } from '@/firebase'
import {
    collection,
    getDocs,
    doc,
    setDoc,
    Timestamp,
    query,
    where
} from 'firebase/firestore'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'

const { Text } = Typography
const { Panel } = Collapse

/**
 * ✅ IMPORTANT:
 * This page must NEVER show incubatees in ANY dropdown/list.
 * We enforce that by filtering fetched users and by filtering options again at render time.
 */

const ALLOWED_INTERNAL_ROLES = ['consultant', 'operations'] as const
type InternalRole = (typeof ALLOWED_INTERNAL_ROLES)[number]

const ENHANCED_TASK_TYPES = [
    {
        id: 'document-review',
        name: 'Document Review',
        proofRequired: true,
        specificFields: [
            {
                name: 'document',
                label: 'Document to Review',
                required: true,
                type: 'select',
                options: ['Contract', 'Proposal', 'Report', 'Policy', 'Other']
            },
            {
                name: 'consultant',
                label: 'Consultant to Review',
                required: true,
                type: 'user-select',
                role: 'consultant'
            }
        ]
    },
    {
        id: 'compliance-check',
        name: 'Compliance Check',
        proofRequired: true,
        specificFields: [
            {
                name: 'regulation',
                label: 'Regulation/Standard',
                required: true,
                type: 'select',
                options: ['ISO 27001', 'GDPR', 'HIPAA', 'SOC 2', 'Other']
            },
            {
                name: 'consultant',
                label: 'Consultant to Perform Check',
                required: true,
                type: 'user-select',
                role: 'consultant'
            }
        ]
    },
    {
        id: 'client-outreach',
        name: 'Client Outreach',
        proofRequired: true,
        specificFields: [
            {
                name: 'purpose',
                label: 'Purpose of Outreach',
                required: true,
                type: 'select',
                options: ['Follow-up', 'Requirements Gathering', 'Feedback', 'Other']
            },
            {
                name: 'consultant',
                label: 'Consultant for Outreach',
                required: true,
                type: 'user-select',
                role: 'consultant'
            }
        ]
    },
    {
        id: 'training-delivery',
        name: 'Training Delivery',
        proofRequired: true,
        specificFields: [
            {
                name: 'trainingTitle',
                label: 'Training Title',
                required: true,
                type: 'input'
            },
            // NOTE: previously this showed "participants" from users (which could include incubatees).
            // Since you said incubatees must never show here, we DO NOT select participants from `users`.
            // If you later want "participants", wire it to the `participants` collection instead.
            {
                name: 'consultant',
                label: 'Lead Trainer',
                required: true,
                type: 'user-select',
                role: 'consultant'
            }
        ]
    },
    {
        id: 'other',
        name: 'Other Task',
        proofRequired: false,
        specificFields: []
    }
]

type UserRow = {
    id: string
    name?: string
    email?: string
    role?: string
    department?: string
    companyCode?: string
}

type TaskRow = {
    id: string
    title: string
    description?: string
    taskType?: any
    dueDate?: any
    priority?: 'low' | 'medium' | 'high'
    assignedRole?: InternalRole
    assignedTo?: string
    status?: 'To Do' | 'Completed' | 'Awaiting Proof'
    companyCode?: string
    createdAt?: any
    [k: string]: any
}

export const TasksManager: React.FC = () => {
    const { user } = useFullIdentity()

    const [tasks, setTasks] = useState<TaskRow[]>([])
    const [users, setUsers] = useState<UserRow[]>([])
    const [taskModalOpen, setTaskModalOpen] = useState(false)
    const [proofModalOpen, setProofModalOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null)

    const [taskForm] = Form.useForm()
    const [filters, setFilters] = useState<{ status: any; role: any }>({
        status: null,
        role: null
    })
    const [selectedTaskType, setSelectedTaskType] = useState<string | null>(null)

    useEffect(() => {
        const fetchUsersAndTasks = async () => {
            if (!user?.companyCode) return

            // ✅ Fetch users (then HARD FILTER OUT incubatees)
            const userSnap = await getDocs(
                query(collection(db, 'users'), where('companyCode', '==', user.companyCode))
            )

            const allUsers = userSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as UserRow[]

            // NEVER show incubatees: keep only internal roles
            const internalUsers = allUsers.filter(u =>
                ALLOWED_INTERNAL_ROLES.includes((u.role || '').toLowerCase() as InternalRole)
            )

            setUsers(internalUsers)

            // Fetch tasks
            const taskSnap = await getDocs(
                query(collection(db, 'tasks'), where('companyCode', '==', user.companyCode))
            )
            const allTasks = taskSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TaskRow[]
            setTasks(allTasks)
        }

        fetchUsersAndTasks().catch(err => {
            console.error(err)
            message.error('Failed to load tasks/users.')
        })
    }, [user?.companyCode])

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            if (filters.status && t.status !== filters.status) return false
            if (filters.role && (t.assignedRole || '') !== filters.role) return false
            return true
        })
    }, [tasks, filters])

    const resolveUserName = (id?: string) => {
        if (!id) return 'Unknown'
        const u = users.find(x => x.id === id)
        return u?.name || u?.email || 'Unknown'
    }

    const safeInternalUsers = useMemo(() => {
        // extra safety (even if fetch gets polluted)
        return users.filter(u =>
            ALLOWED_INTERNAL_ROLES.includes((u.role || '').toLowerCase() as InternalRole)
        )
    }, [users])

    const handleAddTask = async (values: any) => {
        const selectedType = ENHANCED_TASK_TYPES.find(t => t.id === values.taskType)

        // enforce internal role assignment
        const assignedRole = (values.assignedRole || '').toLowerCase()
        if (!ALLOWED_INTERNAL_ROLES.includes(assignedRole as InternalRole)) {
            message.error('Tasks can only be assigned to Consultants or Operations.')
            return
        }

        const assignedUser = safeInternalUsers.find(u => u.id === values.assignedTo)
        if (!assignedUser) {
            message.error('Selected user is not allowed (incubatees are excluded).')
            return
        }

        const taskType =
            selectedType || ({
                id: 'custom',
                name: values.taskType || 'Custom Task',
                proofRequired: false
            } as any)

        const taskData: Omit<TaskRow, 'id'> = {
            title: values.title,
            description: values.description,
            taskType,
            dueDate: values.dueDate?.toDate ? values.dueDate.toDate() : values.dueDate,
            priority: values.priority,
            assignedRole: assignedRole as InternalRole,
            assignedTo: values.assignedTo,
            status: 'To Do',
            companyCode: user?.companyCode,
            createdAt: Timestamp.now(),
            ...(selectedType?.specificFields?.reduce((acc: any, field: any) => {
                if (values[field.name] !== undefined && values[field.name] !== null) {
                    acc[field.name] = values[field.name]
                }
                return acc
            }, {}) || {})
        }

        const newId = `task-${Date.now()}`
        await setDoc(doc(db, 'tasks', newId), taskData as any)

        setTasks(prev => [...prev, { id: newId, ...(taskData as any) }])
        setTaskModalOpen(false)
        taskForm.resetFields()
        setSelectedTaskType(null)
        message.success('Task created.')
    }

    const columns = [
        { title: 'Title', dataIndex: 'title', key: 'title' },
        {
            title: 'Details',
            key: 'details',
            render: (_: any, record: TaskRow) => {
                if (!record.taskType) return record.description || 'Custom Task'

                const taskType =
                    typeof record.taskType === 'string'
                        ? { id: 'custom', name: record.taskType }
                        : record.taskType

                switch (taskType.id) {
                    case 'document-review':
                        return `Review ${record.document || 'document'} (${resolveUserName(record.consultant)})`
                    case 'compliance-check':
                        return `Check ${record.regulation || 'compliance'} (${resolveUserName(
                            record.consultant
                        )})`
                    case 'client-outreach':
                        return `${record.purpose || 'Client outreach'} (${resolveUserName(record.consultant)})`
                    case 'training-delivery':
                        return `${record.trainingTitle || 'Training'} (${resolveUserName(record.consultant)})`
                    default:
                        return taskType.name || 'Task'
                }
            }
        },
        {
            title: 'Assigned To',
            dataIndex: 'assignedTo',
            key: 'assignedTo',
            render: (id: string) => resolveUserName(id)
        },
        {
            title: 'Role',
            dataIndex: 'assignedRole',
            key: 'assignedRole',
            render: (r: any) => {
                const v = (r || '').toString().toLowerCase()
                return v ? v.charAt(0).toUpperCase() + v.slice(1) : '—'
            }
        },
        {
            title: 'Type',
            key: 'taskType',
            render: (_: any, record: TaskRow) => {
                if (!record.taskType) return 'Custom'
                if (typeof record.taskType === 'string') return record.taskType
                return record.taskType.name || 'Task'
            }
        },
        {
            title: 'Due',
            dataIndex: 'dueDate',
            key: 'dueDate',
            render: (d: any) => {
                const dt = d?.toDate ? d.toDate() : d
                return dt ? dayjs(dt).format('YYYY-MM-DD') : '—'
            }
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (s: any) => (
                <Tag
                    icon={
                        s === 'Completed' ? (
                            <CheckCircleOutlined />
                        ) : s === 'Awaiting Proof' ? (
                            <FileSearchOutlined />
                        ) : (
                            <ClockCircleOutlined />
                        )
                    }
                    color={s === 'Completed' ? 'green' : s === 'To Do' ? 'blue' : 'orange'}
                >
                    {s || 'Unknown'}
                </Tag>
            )
        },
        {
            title: 'Action',
            key: 'action',
            render: (_: any, task: TaskRow) => {
                const requiresProof =
                    task?.taskType?.proofRequired ||
                    (typeof task?.taskType === 'object' && task.taskType?.proofRequired)

                return requiresProof && task.status === 'Awaiting Proof' ? (
                    <Button
                        type='link'
                        onClick={() => {
                            setSelectedTask(task)
                            setProofModalOpen(true)
                        }}
                    >
                        View Proof & Approve
                    </Button>
                ) : null
            }
        }
    ]

    const renderSpecificFields = () => {
        if (!selectedTaskType) return null

        const taskType = ENHANCED_TASK_TYPES.find(t => t.id === selectedTaskType)
        if (!taskType?.specificFields?.length) return null

        return (
            <Collapse
                bordered={false}
                defaultActiveKey={['specific-fields']}
                expandIcon={({ isActive }) => <DownOutlined rotate={isActive ? 180 : 0} />}
            >
                <Panel
                    header='Task Specific Details'
                    key='specific-fields'
                    style={{ background: '#fafafa', borderRadius: 8 }}
                >
                    {taskType.specificFields.map((field: any) => {
                        if (field.type === 'select') {
                            return (
                                <Form.Item
                                    key={field.name}
                                    name={field.name}
                                    label={field.label}
                                    rules={[
                                        { required: field.required, message: `${field.label} is required` }
                                    ]}
                                >
                                    <Select placeholder={`Select ${field.label.toLowerCase()}`}>
                                        {field.options.map((option: string) => (
                                            <Select.Option key={option} value={option}>
                                                {option}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            )
                        }

                        if (field.type === 'user-select') {
                            const filteredUsers = field.role
                                ? safeInternalUsers.filter(u => (u.role || '').toLowerCase() === field.role)
                                : safeInternalUsers

                            return (
                                <Form.Item
                                    key={field.name}
                                    name={field.name}
                                    label={field.label}
                                    rules={[
                                        { required: field.required, message: `${field.label} is required` }
                                    ]}
                                >
                                    <Select
                                        placeholder={`Select ${field.label.toLowerCase()}`}
                                        showSearch
                                        optionFilterProp='children'
                                        filterOption={(input, option) =>
                                            (String(option?.children || '') || '')
                                                .toLowerCase()
                                                .includes(input.toLowerCase())
                                        }
                                    >
                                        {filteredUsers.map(u => (
                                            <Select.Option key={u.id} value={u.id}>
                                                {u.name || u.email || u.id}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            )
                        }

                        return (
                            <Form.Item
                                key={field.name}
                                name={field.name}
                                label={field.label}
                                rules={[
                                    { required: field.required, message: `${field.label} is required` }
                                ]}
                            >
                                <Input placeholder={`Enter ${field.label.toLowerCase()}`} />
                            </Form.Item>
                        )
                    })}
                </Panel>
            </Collapse>
        )
    }

    const tasksCompleted = tasks.filter(t => t.status === 'Completed').length
    const tasksAwaitingProof = tasks.filter(t => t.status === 'Awaiting Proof').length

    const assignedRoleWatch = Form.useWatch('assignedRole', taskForm) as InternalRole | undefined
    const assignableUsers = useMemo(() => {
        const role = (assignedRoleWatch || '').toString().toLowerCase()
        if (role === 'consultant' || role === 'operations') {
            return safeInternalUsers.filter(u => (u.role || '').toLowerCase() === role)
        }
        return safeInternalUsers
    }, [assignedRoleWatch, safeInternalUsers])

    return (
        <div style={{ minHeight: '100vh', padding: 24, background: '#fff' }}>
            <Space direction='vertical' style={{ width: '100%' }} size='large'>
                <Alert
                    message='Tasks are for internal execution only (Consultants/Operations). Incubatees are excluded from all selectors on this page.'
                    type='info'
                    showIcon
                />

                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
                            whileHover={{
                                y: -3,
                                boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
                                transition: { duration: 0.2 },
                                borderRadius: 8,
                                background: 'transparent'
                            }}
                        >
                            <Card
                                hoverable
                                style={{
                                    boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                                    transition: 'all 0.3s ease',
                                    borderRadius: 8,
                                    border: '1px solid #d6e4ff'
                                }}
                            >
                                <Space>
                                    <CheckCircleOutlined style={{ fontSize: 24, color: 'green' }} />
                                    <Text>Total Tasks: {tasks.length}</Text>
                                </Space>
                            </Card>
                        </motion.div>
                    </Col>

                    <Col xs={24} sm={8}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
                            whileHover={{
                                y: -3,
                                boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
                                transition: { duration: 0.2 },
                                borderRadius: 8,
                                background: 'transparent'
                            }}
                        >
                            <Card
                                hoverable
                                style={{
                                    boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                                    transition: 'all 0.3s ease',
                                    borderRadius: 8,
                                    border: '1px solid #d6e4ff'
                                }}
                            >
                                <Space>
                                    <ClockCircleOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                                    <Text>Completed: {tasksCompleted}</Text>
                                </Space>
                            </Card>
                        </motion.div>
                    </Col>

                    <Col xs={24} sm={8}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
                            whileHover={{
                                y: -3,
                                boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
                                transition: { duration: 0.2 },
                                borderRadius: 8,
                                background: 'transparent'
                            }}
                        >
                            <Card
                                hoverable
                                style={{
                                    boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                                    transition: 'all 0.3s ease',
                                    borderRadius: 8,
                                    border: '1px solid #d6e4ff'
                                }}
                            >
                                <Space>
                                    <FileSearchOutlined style={{ fontSize: 24, color: '#faad14' }} />
                                    <Text>Awaiting Proof: {tasksAwaitingProof}</Text>
                                </Space>
                            </Card>
                        </motion.div>
                    </Col>
                </Row>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
                >
                    <Card
                        hoverable
                        style={{
                            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                            transition: 'all 0.3s ease',
                            borderRadius: 8,
                            border: '1px solid #d6e4ff'
                        }}
                    >
                        <Select
                            placeholder='Filter by Status'
                            onChange={v => setFilters(f => ({ ...f, status: v }))}
                            allowClear
                            style={{ width: 160, marginRight: 15 }}
                        >
                            <Select.Option value='To Do'>To Do</Select.Option>
                            <Select.Option value='Completed'>Completed</Select.Option>
                            <Select.Option value='Awaiting Proof'>Awaiting Proof</Select.Option>
                        </Select>

                        <Select
                            placeholder='Filter by Role'
                            onChange={v => setFilters(f => ({ ...f, role: v }))}
                            allowClear
                            style={{ width: 160 }}
                        >
                            <Select.Option value='consultant'>Consultant</Select.Option>
                            <Select.Option value='operations'>Operations</Select.Option>
                        </Select>

                        <Button type='primary' style={{ marginLeft: 15 }} onClick={() => setTaskModalOpen(true)}>
                            Add Task
                        </Button>
                    </Card>
                </motion.div>

                <Card
                    hoverable
                    style={{
                        boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                        transition: 'all 0.3s ease',
                        borderRadius: 8,
                        border: '1px solid #d6e4ff'
                    }}
                >
                    <Table dataSource={filteredTasks} columns={columns as any} rowKey='id' />
                </Card>

                <Modal
                    title='Submit Proof'
                    open={proofModalOpen}
                    onCancel={() => {
                        setSelectedTask(null)
                        setProofModalOpen(false)
                    }}
                    footer={null}
                >
                    {selectedTask && (
                        <Form layout='vertical' onFinish={() => { }}>
                            {(selectedTask as any)?.taskType?.proofTypes?.map((p: any) => (
                                <Card key={p.id} style={{ marginBottom: 12 }}>
                                    <Text strong>{p.name}</Text>
                                    <br />
                                    <Text type='secondary'>{p.description}</Text>
                                    <Form.Item
                                        name={`description-${p.id}`}
                                        label='Description'
                                        rules={[{ required: p.required, message: 'Required' }]}
                                    >
                                        <Input.TextArea />
                                    </Form.Item>
                                    <Upload>
                                        <Button icon={<UploadOutlined />}>Upload</Button>
                                    </Upload>
                                </Card>
                            ))}
                            <Button type='primary' htmlType='submit' block>
                                Approve & Complete
                            </Button>
                        </Form>
                    )}
                </Modal>

                <Modal
                    title='Add Task'
                    open={taskModalOpen}
                    onCancel={() => {
                        setTaskModalOpen(false)
                        setSelectedTaskType(null)
                        taskForm.resetFields()
                    }}
                    onOk={() => taskForm.submit()}
                    width={800}
                >
                    <Form layout='vertical' form={taskForm} onFinish={handleAddTask}>
                        <Form.Item name='title' label='Title' rules={[{ required: true }]}>
                            <Input placeholder='Enter task title' />
                        </Form.Item>

                        <Form.Item name='description' label='Description'>
                            <Input.TextArea placeholder='Enter task description' rows={3} />
                        </Form.Item>

                        <Form.Item name='taskType' label='Task Type' rules={[{ required: true }]}>
                            <Select
                                placeholder='Select task type'
                                onChange={value => {
                                    setSelectedTaskType(value)
                                    const specificFields =
                                        ENHANCED_TASK_TYPES.find(t => t.id === value)?.specificFields || []
                                    specificFields.forEach(field => taskForm.setFieldsValue({ [field.name]: undefined }))
                                }}
                            >
                                {ENHANCED_TASK_TYPES.map(t => (
                                    <Select.Option key={t.id} value={t.id}>
                                        {t.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>

                        {renderSpecificFields()}

                        <Form.Item name='assignedRole' label='Assigned Role' rules={[{ required: true }]}>
                            <Select placeholder='Select role'>
                                <Select.Option value='consultant'>Consultant</Select.Option>
                                <Select.Option value='operations'>Operations</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name='assignedTo' label='Assign To' rules={[{ required: true }]}>
                            <Select
                                placeholder='Select user'
                                showSearch
                                optionFilterProp='children'
                                filterOption={(input, option) =>
                                    (String(option?.children || '') || '')
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                            >
                                {assignableUsers.map(u => (
                                    <Select.Option key={u.id} value={u.id}>
                                        {u.name || u.email || u.id} ({(u.role || '').toLowerCase()})
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item name='dueDate' label='Due Date' rules={[{ required: true }]}>
                            <DatePicker
                                style={{ width: '100%' }}
                                disabledDate={current => current && current < dayjs().startOf('day')}
                            />
                        </Form.Item>

                        <Form.Item name='priority' label='Priority' initialValue='medium'>
                            <Select>
                                <Select.Option value='low'>Low</Select.Option>
                                <Select.Option value='medium'>Medium</Select.Option>
                                <Select.Option value='high'>High</Select.Option>
                            </Select>
                        </Form.Item>
                    </Form>
                </Modal>
            </Space>
        </div>
    )
}
