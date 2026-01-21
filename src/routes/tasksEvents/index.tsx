// src/pages/TasksEventsPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
    Card,
    Table,
    Button,
    Space,
    Tag,
    Modal,
    Form,
    message,
    Popconfirm,
    Badge,
    Upload,
    Input,
    Row,
    Col,
    Statistic,
    Typography,
    Tooltip,
    Select,
    Segmented,
    Empty,
    Divider
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    EditOutlined,
    DeleteOutlined,
    CheckOutlined,
    CloseOutlined,
    UploadOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    LinkOutlined,
    SearchOutlined,
    PlusOutlined
} from '@ant-design/icons'
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot
} from 'firebase/firestore'
import { db } from '@/firebase'
import dayjs from 'dayjs'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { EventModal } from '@/components/op-dashboard/EventModal'
import { TaskModal } from '@/components/op-dashboard/TaskModal'
import { MotionCard } from '@/components/shared/Header'

const { Title, Text, Link } = Typography
const { Option } = Select

/** ---------- helpers ---------- */
const toJsDate = (v: any): Date | null => {
    if (!v) return null
    if (typeof v?.toDate === 'function') return v.toDate()
    if (typeof v === 'string') {
        const d = new Date(v)
        if (!Number.isNaN(d.getTime())) return d
        const dj = dayjs(v)
        return dj.isValid() ? dj.toDate() : null
    }
    if (typeof v === 'number') return new Date(v)
    if (v?.seconds != null) return new Date(v.seconds * 1000)
    return null
}

const startOfToday = () => dayjs().startOf('day')

type ViewMode = 'events' | 'tasks'
type RangeFilter = 'all' | 'today' | 'week' | 'month'
type TimeFilter = 'upcoming' | 'past' | 'all'
type TaskStatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'overdue'

export const TasksEventsPage: React.FC = () => {
    const { user } = useFullIdentity()
    const isOperations = user?.role === 'operations'

    const [loading, setLoading] = useState(false)

    const [consultantId, setConsultantId] = useState<string | null>(null)
    const [events, setEvents] = useState<any[]>([])
    const [tasks, setTasks] = useState<any[]>([])
    const [users, setUsers] = useState<any[]>([])

    const [editingEvent, setEditingEvent] = useState<any>(null)
    const [editingTask, setEditingTask] = useState<any>(null)

    const [eventModalOpen, setEventModalOpen] = useState(false)
    const [taskModalOpen, setTaskModalOpen] = useState(false)

    const [proofModalOpen, setProofModalOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<any>(null)

    // UI controls
    const [viewMode, setViewMode] = useState<ViewMode>('events')
    const [filterRange, setFilterRange] = useState<RangeFilter>('week')
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('upcoming') // IMPORTANT: default fixes “past showing as upcoming”
    const [taskStatusFilter, setTaskStatusFilter] =
        useState<TaskStatusFilter>('all')
    const [search, setSearch] = useState('')

    const [eventForm] = Form.useForm()
    const [taskForm] = Form.useForm()
    const [proofForm] = Form.useForm()

    /** ---------- identify consultant + subscribe ---------- */
    useEffect(() => {
        if (!user?.email) return

        const unsubscribers: Array<() => void> = []
        let cancelled = false

        const run = async () => {
            setLoading(true)
            try {
                // consultant id (for consultant view + participant status)
                const consultantSnap = await getDocs(
                    query(collection(db, 'consultants'), where('email', '==', user.email))
                )
                if (consultantSnap.empty) {
                    message.warning('No consultant profile found for your email')
                    return
                }
                const cid = consultantSnap.docs[0].id
                if (cancelled) return
                setConsultantId(cid)

                // (optional) fetch users list for modals (ops mainly)
                const unsubConsultants = onSnapshot(
                    query(collection(db, 'consultants')),
                    snap => {
                        const list = snap.docs.map(d => ({
                            id: d.id,
                            ...d.data()
                        }))
                        setUsers(list)
                    }
                )
                unsubscribers.push(unsubConsultants)

                // tasks for consultant
                const tasksQ = query(collection(db, 'tasks'), where('assignedTo', '==', cid))
                const unsubTasks = onSnapshot(tasksQ, snap => {
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data(), consultantId: cid }))
                    setTasks(list)
                })
                unsubscribers.push(unsubTasks)

                // events where consultant is a participant
                const eventsQ = query(
                    collection(db, 'events'),
                    where('participants', 'array-contains', cid)
                )
                const unsubEvents = onSnapshot(eventsQ, snap => {
                    const list = snap.docs.map(d => {
                        const data: any = d.data()
                        const statusMap = data.participantStatus || {}
                        const userStatus =
                            statusMap?.[cid] || 'pending' // pending until confirmed/declined

                        return {
                            id: d.id,
                            ...data,
                            userStatus
                        }
                    })
                    setEvents(list)
                })
                unsubscribers.push(unsubEvents)
            } catch (e) {
                console.error(e)
                message.error('Failed to load tasks and events')
            } finally {
                setLoading(false)
            }
        }

        run()

        return () => {
            cancelled = true
            unsubscribers.forEach(u => u())
        }
    }, [user?.email])

    /** ---------- date helpers for filtering ---------- */
    const inRange = (dt: Date | null, range: RangeFilter) => {
        if (!dt) return false
        const now = dayjs()
        const t = dayjs(dt)
        if (range === 'all') return true
        if (range === 'today') return t.isSame(now, 'day')
        if (range === 'week')
            return t.isBetween(now.startOf('week'), now.endOf('week'), null, '[]')
        return t.isBetween(now.startOf('month'), now.endOf('month'), null, '[]')
    }

    const byTimeFilter = (dt: Date | null, tf: TimeFilter) => {
        if (!dt) return false
        const t = dayjs(dt)
        if (tf === 'all') return true
        if (tf === 'upcoming') return t.isSameOrAfter(startOfToday(), 'minute')
        return t.isBefore(startOfToday(), 'minute')
    }

    /** ---------- normalize event/task dates ---------- */
    const normalizedEvents = useMemo(() => {
        return events.map(e => {
            const start =
                toJsDate(e.startTime) ||
                toJsDate(e.time) ||
                (e.date ? toJsDate(e.date) : null) ||
                (dayjs(e.date).isValid() ? dayjs(e.date).toDate() : null)

            const end = toJsDate(e.endTime)
            return {
                ...e,
                __start: start,
                __end: end
            }
        })
    }, [events])

    const normalizedTasks = useMemo(() => {
        return tasks.map(t => {
            const due = toJsDate(t.dueDate) || (t.dueDate ? new Date(t.dueDate) : null)
            const isOverdue =
                t.status !== 'Completed' && due ? dayjs(due).isBefore(dayjs(), 'day') : false
            return {
                ...t,
                __due: due,
                __isOverdue: isOverdue
            }
        })
    }, [tasks])

    /** ---------- filter + search ---------- */
    const filteredEvents = useMemo(() => {
        const q = search.trim().toLowerCase()
        return normalizedEvents
            .filter(e => inRange(e.__start, filterRange))
            .filter(e => byTimeFilter(e.__start, timeFilter))
            .filter(e => {
                if (!q) return true
                const title = String(e.title || '').toLowerCase()
                const type = String(e?.type?.name || e.type || '').toLowerCase()
                const location = String(e.location || '').toLowerCase()
                return title.includes(q) || type.includes(q) || location.includes(q)
            })
            .sort((a, b) => dayjs(a.__start || 0).valueOf() - dayjs(b.__start || 0).valueOf())
    }, [normalizedEvents, filterRange, timeFilter, search])

    const filteredTasks = useMemo(() => {
        const q = search.trim().toLowerCase()
        return normalizedTasks
            .filter(t => inRange(t.__due, filterRange))
            .filter(t => {
                if (taskStatusFilter === 'all') return true
                if (taskStatusFilter === 'completed') return t.status === 'Completed'
                if (taskStatusFilter === 'overdue') return t.__isOverdue
                if (taskStatusFilter === 'in_progress') return t.status === 'In Progress'
                return t.status !== 'Completed' // pending bucket
            })
            .filter(t => {
                if (!q) return true
                const title = String(t.title || '').toLowerCase()
                const type = String(t?.taskType?.name || '').toLowerCase()
                const priority = String(t.priority || '').toLowerCase()
                return title.includes(q) || type.includes(q) || priority.includes(q)
            })
            .sort((a, b) => dayjs(a.__due || 0).valueOf() - dayjs(b.__due || 0).valueOf())
    }, [normalizedTasks, filterRange, taskStatusFilter, search])

    /** ---------- metrics (based on filtered sets) ---------- */
    const eventMetrics = useMemo(() => {
        const total = filteredEvents.length
        const confirmed = filteredEvents.filter(e => e.userStatus === 'confirmed').length
        const pending = filteredEvents.filter(e => e.userStatus === 'pending').length
        return { total, confirmed, pending }
    }, [filteredEvents])

    const taskMetrics = useMemo(() => {
        const total = filteredTasks.length
        const completed = filteredTasks.filter(t => t.status === 'Completed').length
        const overdue = filteredTasks.filter(t => t.__isOverdue).length
        return { total, completed, overdue }
    }, [filteredTasks])

    /** ---------- event handlers ---------- */
    const handleConfirmAttendance = async (
        eventId: string,
        status: 'confirmed' | 'declined'
    ) => {
        if (!consultantId) return
        try {
            setLoading(true)
            await updateDoc(doc(db, 'events', eventId), {
                [`participantStatus.${consultantId}`]: status
            })
            message.success(`Attendance ${status}`)
        } catch (e) {
            console.error(e)
            message.error('Failed to confirm attendance')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteEvent = async (eventId: string) => {
        try {
            setLoading(true)
            await deleteDoc(doc(db, 'events', eventId))
            message.success('Event deleted')
        } catch (e) {
            console.error(e)
            message.error('Failed to delete event')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteTask = async (taskId: string) => {
        try {
            setLoading(true)
            await deleteDoc(doc(db, 'tasks', taskId))
            message.success('Task deleted')
        } catch (e) {
            console.error(e)
            message.error('Failed to delete task')
        } finally {
            setLoading(false)
        }
    }

    const handleCompleteTask = async (taskId: string) => {
        if (!consultantId) return
        try {
            const task = normalizedTasks.find(t => t.id === taskId)
            if (!task) return message.error('Task not found')

            if (task.assignedTo !== consultantId) {
                return message.error('You are not assigned to this task')
            }

            if (task?.taskType?.proofRequired) {
                setSelectedTask(task)
                setProofModalOpen(true)
                return
            }

            setLoading(true)
            await updateDoc(doc(db, 'tasks', taskId), {
                status: 'Completed',
                completedAt: new Date().toISOString(),
                completedBy: consultantId
            })
            message.success('Task completed')
        } catch (e) {
            console.error(e)
            message.error('Failed to complete task')
        } finally {
            setLoading(false)
        }
    }

    const handleProofSubmission = async (values: any) => {
        if (!selectedTask) return
        try {
            setLoading(true)
            const proofData = {
                description: values.description,
                submittedAt: new Date().toISOString(),
                submittedBy: user?.id,
                file: values.file?.[0]?.originFileObj
                    ? {
                        name: values.file[0].name,
                        type: values.file[0].type,
                        size: values.file[0].size
                    }
                    : null
            }

            await updateDoc(doc(db, 'tasks', selectedTask.id), {
                status: 'Completed',
                completedAt: new Date().toISOString(),
                proof: proofData
            })

            message.success('Task completed (proof submitted)')
            setProofModalOpen(false)
            setSelectedTask(null)
            proofForm.resetFields()
        } catch (e) {
            console.error(e)
            message.error('Failed to submit proof')
        } finally {
            setLoading(false)
        }
    }

    /** ---------- columns ---------- */
    const eventColumns: ColumnsType<any> = [
        {
            title: 'Event',
            key: 'title',
            render: (_, record) => {
                const joinUrl =
                    record?.joinUrl ||
                    record?.link ||
                    record?.meetLink ||
                    record?.zoomLink ||
                    record?.teamsLink ||
                    record?.googleMeetLink ||
                    null

                const isVirtual =
                    (typeof record?.format === 'string' &&
                        record.format.toLowerCase() === 'virtual') ||
                    record?.isVirtual === true ||
                    !!joinUrl

                return (
                    <Space direction="vertical" size={2}>
                        <Text strong>{record.title || 'Untitled'}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {record?.type?.name || record.type || (isVirtual ? 'Virtual' : 'Event')}
                            {record.location ? ` • ${record.location}` : ''}
                        </Text>

                        {joinUrl ? (
                            <Link href={joinUrl} target="_blank" rel="noopener noreferrer">
                                <LinkOutlined style={{ marginRight: 6 }} />
                                {isVirtual ? 'Join meeting' : 'Open link'}
                            </Link>
                        ) : null}
                    </Space>
                )
            }
        },
        {
            title: 'Format',
            dataIndex: 'format',
            key: 'format',
            width: 120,
            render: (format: string) => (
                <Tag
                    color={
                        format === 'virtual'
                            ? 'blue'
                            : format === 'in-person'
                                ? 'green'
                                : 'orange'
                    }
                >
                    {String(format || '—')}
                </Tag>
            )
        },
        {
            title: 'When',
            key: 'when',
            width: 170,
            render: (_, record) => {
                const start = record.__start
                const end = record.__end
                return (
                    <Space direction="vertical" size={0}>
                        <Text>{start ? dayjs(start).format('DD MMM YYYY') : '—'}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {start ? dayjs(start).format('HH:mm') : '—'}
                            {end ? ` – ${dayjs(end).format('HH:mm')}` : ''}
                        </Text>
                    </Space>
                )
            }
        },
        {
            title: 'Participants',
            dataIndex: 'participants',
            key: 'participants',
            width: 130,
            render: (participants: string[]) => (
                <Tooltip title={`${participants?.length || 0} participants`}>
                    <Badge count={participants?.length || 0} showZero />
                </Tooltip>
            )
        },
        ...(isOperations
            ? [
                {
                    title: 'Actions',
                    key: 'actions',
                    width: 150,
                    render: (record: any) => (
                        <Space>
                            <Button
                                icon={<EditOutlined />}
                                size="small"
                                onClick={() => {
                                    setEditingEvent(record)
                                    setEventModalOpen(true)
                                }}
                            />
                            <Popconfirm
                                title="Delete this event?"
                                onConfirm={() => handleDeleteEvent(record.id)}
                            >
                                <Button icon={<DeleteOutlined />} size="small" danger />
                            </Popconfirm>
                        </Space>
                    )
                }
            ]
            : [
                {
                    title: 'Your Status',
                    key: 'status',
                    width: 220,
                    render: (record: any) => (
                        <Space>
                            {record.userStatus === 'pending' ? (
                                <>
                                    <Button
                                        icon={<CheckOutlined />}
                                        size="small"
                                        type="primary"
                                        onClick={() => handleConfirmAttendance(record.id, 'confirmed')}
                                    >
                                        Confirm
                                    </Button>
                                    <Button
                                        icon={<CloseOutlined />}
                                        size="small"
                                        danger
                                        onClick={() => handleConfirmAttendance(record.id, 'declined')}
                                    >
                                        Decline
                                    </Button>
                                </>
                            ) : (
                                <Tag color={record.userStatus === 'confirmed' ? 'green' : 'red'}>
                                    {record.userStatus}
                                </Tag>
                            )}
                        </Space>
                    )
                }
            ])
    ]

    const taskColumns: ColumnsType<any> = [
        {
            title: 'Task',
            key: 'task',
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    <Text strong>{record.title || 'Untitled'}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {record?.taskType?.name || 'Task'}
                    </Text>
                </Space>
            )
        },
        {
            title: 'Priority',
            dataIndex: 'priority',
            key: 'priority',
            width: 140,
            render: (priority: string) => (
                <Tag
                    color={priority === 'High' ? 'red' : priority === 'Medium' ? 'orange' : 'green'}
                    icon={priority === 'High' ? <ExclamationCircleOutlined /> : undefined}
                >
                    {priority || '—'}
                </Tag>
            )
        },
        {
            title: 'Due',
            key: 'due',
            width: 160,
            render: (_, record) => {
                const due: Date | null = record.__due
                const isOverdue = record.__isOverdue
                return (
                    <Space direction="vertical" size={0}>
                        <Text style={{ color: isOverdue ? '#ff4d4f' : undefined }}>
                            {due ? dayjs(due).format('DD MMM YYYY') : '—'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, color: isOverdue ? '#ff4d4f' : undefined }}>
                            {isOverdue ? 'Overdue' : record.status || '—'}
                        </Text>
                    </Space>
                )
            }
        },
        ...(isOperations
            ? [
                {
                    title: 'Actions',
                    key: 'actions',
                    width: 150,
                    render: (record: any) => (
                        <Space>
                            <Button
                                icon={<EditOutlined />}
                                size="small"
                                onClick={() => {
                                    setEditingTask(record)
                                    setTaskModalOpen(true)
                                }}
                            />
                            <Popconfirm
                                title="Delete this task?"
                                onConfirm={() => handleDeleteTask(record.id)}
                            >
                                <Button icon={<DeleteOutlined />} size="small" danger />
                            </Popconfirm>
                        </Space>
                    )
                }
            ]
            : [
                {
                    title: 'Action',
                    key: 'actions',
                    width: 140,
                    render: (record: any) =>
                        record.status !== 'Completed' ? (
                            <Button
                                type="primary"
                                size="small"
                                icon={<CheckCircleOutlined />}
                                onClick={() => handleCompleteTask(record.id)}
                            >
                                Complete
                            </Button>
                        ) : (
                            <Tag color="green">Completed</Tag>
                        )
                }
            ])
    ]

    /** ---------- topbar UI ---------- */
    const TopBar = (
        <MotionCard style={{ borderRadius: 12, marginBottom: 16, background: 'linear-gradient(90deg,#eef4ff, #f9fbff)', }}>
            <Row gutter={[12, 12]} align="middle" justify="space-between">
                <Col xs={24} lg={10}>
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <Title level={4} style={{ margin: 0 }}>
                            Tasks & Events
                        </Title>
                        <Text type="secondary">
                            Filter and act fast • {viewMode === 'events' ? 'Events' : 'Tasks'}
                        </Text>
                    </Space>
                </Col>

                <Col xs={24} lg={14}>
                    <Row gutter={[12, 12]} align="middle" justify="end">
                        <Col xs={24} md={10}>
                            <Input
                                prefix={<SearchOutlined />}
                                placeholder="Search title, type, location..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                allowClear
                            />
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                            <Select style={{ width: '100%' }} value={filterRange} onChange={v => setFilterRange(v)}>
                                <Option value="all">All</Option>
                                <Option value="today">Today</Option>
                                <Option value="week">This Week</Option>
                                <Option value="month">This Month</Option>
                            </Select>
                        </Col>

                        {viewMode === 'events' ? (
                            <Col xs={24} sm={12} md={6}>
                                <Select style={{ width: '100%' }} value={timeFilter} onChange={v => setTimeFilter(v)}>
                                    <Option value="upcoming">Upcoming</Option>
                                    <Option value="past">Past</Option>
                                    <Option value="all">All</Option>
                                </Select>
                            </Col>
                        ) : (
                            <Col xs={24} sm={12} md={6}>
                                <Select
                                    style={{ width: '100%' }}
                                    value={taskStatusFilter}
                                    onChange={v => setTaskStatusFilter(v)}
                                >
                                    <Option value="all">All</Option>
                                    <Option value="pending">Pending</Option>
                                    <Option value="in_progress">In Progress</Option>
                                    <Option value="completed">Completed</Option>
                                    <Option value="overdue">Overdue</Option>
                                </Select>
                            </Col>
                        )}

                        <Col xs={24} md={6}>
                            <Segmented
                                block
                                value={viewMode}
                                onChange={v => setViewMode(v as ViewMode)}
                                options={[
                                    { label: 'Events', value: 'events' },
                                    { label: 'Tasks', value: 'tasks' }
                                ]}
                            />
                        </Col>
                    </Row>
                </Col>
            </Row>

            {isOperations ? (
                <>
                    <Divider style={{ margin: '12px 0' }} />
                    <Space wrap>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                setEditingEvent(null)
                                setEventModalOpen(true)
                            }}
                        >
                            Create Event
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                setEditingTask(null)
                                setTaskModalOpen(true)
                            }}
                        >
                            Create Task
                        </Button>
                    </Space>
                </>
            ) : null}
        </MotionCard>
    )

    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            {TopBar}

            {/* KPI strip */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8}>
                    <MotionCard style={{ height: '100%' }}>
                        <Statistic
                            title="Events (Confirmed | Pending)"
                            value={`${eventMetrics.confirmed} | ${eventMetrics.pending}`}
                            prefix={<CalendarOutlined />}
                            valueStyle={{ color: '#1677ff' }}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            From current filters
                        </Text>
                    </MotionCard>
                </Col>

                <Col xs={24} sm={12} md={8}>
                    <MotionCard style={{ height: '100%' }}>
                        <Statistic
                            title="Completed Tasks"
                            value={taskMetrics.completed}
                            suffix={`/ ${taskMetrics.total}`}
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            From current filters
                        </Text>
                    </MotionCard>
                </Col>

                <Col xs={24} sm={12} md={8}>
                    <MotionCard style={{ height: '100%' }}>
                        <Statistic
                            title="Overdue Tasks"
                            value={taskMetrics.overdue}
                            prefix={<ClockCircleOutlined />}
                            valueStyle={{
                                color: taskMetrics.overdue > 0 ? '#ff4d4f' : '#52c41a'
                            }}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Needs attention
                        </Text>
                    </MotionCard>
                </Col>
            </Row>

            {/* Content (Segmented replaces Tabs) */}
            <MotionCard style={{ borderRadius: 12 }}>
                {viewMode === 'events' ? (
                    filteredEvents.length ? (
                        <Table
                            dataSource={filteredEvents}
                            columns={eventColumns}
                            rowKey="id"
                            pagination={{ pageSize: 6, showSizeChanger: true }}
                            loading={loading}
                        />
                    ) : (
                        <Empty description="No events match your filters." />
                    )
                ) : filteredTasks.length ? (
                    <Table
                        dataSource={filteredTasks}
                        columns={taskColumns}
                        rowKey="id"
                        pagination={{ pageSize: 6, showSizeChanger: true }}
                        loading={loading}
                    />
                ) : (
                    <Empty description="No tasks match your filters." />
                )}
            </MotionCard>

            {/* Existing modals */}
            <EventModal
                open={eventModalOpen}
                onCancel={() => {
                    setEventModalOpen(false)
                    setEditingEvent(null)
                    eventForm.resetFields()
                }}
                onSubmit={() => {
                    setEventModalOpen(false)
                    message.success(editingEvent ? 'Event updated' : 'Event created')
                }}
                form={eventForm}
                initialValues={editingEvent}
                consultants={users}
                projectAdmins={users}
                operationsUsers={users}
                participants={users}
            />

            <TaskModal
                open={taskModalOpen}
                onCancel={() => {
                    setTaskModalOpen(false)
                    setEditingTask(null)
                    taskForm.resetFields()
                }}
                onSubmit={() => {
                    setTaskModalOpen(false)
                    message.success(editingTask ? 'Task updated' : 'Task created')
                }}
                form={taskForm}
                initialValues={editingTask}
                consultants={users}
                projectAdmins={users}
                operationsUsers={users}
                departments={[]}
                userDepartment={null}
            />

            {/* Proof modal */}
            <Modal
                title="Submit Proof of Completion"
                open={proofModalOpen}
                onCancel={() => {
                    setProofModalOpen(false)
                    setSelectedTask(null)
                    proofForm.resetFields()
                }}
                footer={[
                    <Button
                        key="cancel"
                        onClick={() => {
                            setProofModalOpen(false)
                            setSelectedTask(null)
                            proofForm.resetFields()
                        }}
                    >
                        Cancel
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        loading={loading}
                        onClick={() => proofForm.submit()}
                    >
                        Submit Proof
                    </Button>
                ]}
            >
                <Form
                    form={proofForm}
                    layout="vertical"
                    onFinish={handleProofSubmission}
                    initialValues={{ description: '', file: null }}
                >
                    {selectedTask ? (
                        <div
                            style={{
                                marginBottom: 12,
                                padding: 12,
                                background: '#fafafa',
                                border: '1px solid #f0f0f0',
                                borderRadius: 10
                            }}
                        >
                            <Space direction="vertical" size={0}>
                                <Text strong>Task:</Text>
                                <Text>{selectedTask.title}</Text>
                                <Text type="secondary">
                                    Type: {selectedTask.taskType?.name || 'Task'}
                                </Text>
                            </Space>
                        </div>
                    ) : null}

                    <Form.Item
                        name="description"
                        label="Proof description"
                        rules={[{ required: true, message: 'Please describe your proof of completion' }]}
                    >
                        <Input.TextArea rows={4} placeholder="Describe how you completed this task..." />
                    </Form.Item>

                    <Form.Item
                        name="file"
                        label="Supporting document"
                        valuePropName="fileList"
                        getValueFromEvent={e => (Array.isArray(e) ? e : e?.fileList)}
                    >
                        <Upload beforeUpload={() => false} maxCount={1} listType="text">
                            <Button icon={<UploadOutlined />}>Upload</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}

export default TasksEventsPage
