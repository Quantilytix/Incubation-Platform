import React, { useEffect, useMemo, useState } from 'react'
import {
    Form,
    Select,
    DatePicker,
    Input,
    Button,
    message,
    Spin,
    Table,
    Tag,
    Space,
    Modal,
    Row,
    Col,
    Card,
    Typography,
    Tooltip,
    Divider,
    QRCode,
    Badge,
} from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import {
    Timestamp,
    addDoc,
    collection,
    getDocs,
    query,
    where,
    updateDoc,
    doc,
    serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from '@/firebase'
import {
    CalendarOutlined,
    ClockCircleOutlined,
    CheckOutlined,
    CloseOutlined,
    StopOutlined,
    QrcodeOutlined,
    TeamOutlined,
    EditOutlined,
    CheckCircleOutlined,
    WarningOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { MotionCard } from '@/components/shared/Header'

const { Option } = Select
const { Title, Text } = Typography
const { RangePicker } = DatePicker

type AssignedIntervention = {
    id: string // assignedInterventions doc id
    interventionId?: string
    interventionTitle?: string
    title?: string
    areaOfSupport?: string
    area?: string

    // single participant shape
    participantId?: string
    beneficiaryId?: string
    beneficiaryName?: string
    beneficiaryEmail?: string
    email?: string

    // grouped shape (best-effort)
    participantIds?: string[]
    participantEmails?: string[]
    participantNames?: string[]
    beneficiaries?: Array<{ participantId?: string; email?: string; name?: string }>

    consultantId?: string
    assigneeId?: string
    status?: string
    [k: string]: any
}

type AppointmentDoc = {
    id: string
    assignedInterventionId?: string
    interventionId?: string
    interventionTitle?: string

    consultantId?: string | null
    assigneeId?: string | null

    meetingType: string
    meetingLink?: string | null

    participantIds: string[]
    participantNames: string[]
    participantEmails: string[]

    startTime: any
    endTime: any
    status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'

    attendance?: Record<
        string,
        {
            status: 'present' | 'absent'
            method: 'manual' | 'qr'
            markedAt: any
            markedByUid?: string | null
            markedByEmail?: string | null
        }
    >

    createdByUid?: string
    createdByEmail?: string
    createdByRole?: 'consultant' | 'operations' | 'unknown'

    createdAt?: any
    updatedAt?: any
    declinedReason?: string
    [k: string]: any
}

/** ---------- unified card style + motion wrapper ---------- */
const cardStyle: React.CSSProperties = {
    boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
    transition: 'all 0.3s ease',
    borderRadius: 14,
    border: '1px solid #e6efff',
    backdropFilter: 'blur(3px)',
}

const safeArr = (v: any): any[] => (Array.isArray(v) ? v : [])

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr))

const asString = (v: any) => (typeof v === 'string' ? v : '')

const pickInterventionTitle = (i: AssignedIntervention) =>
    asString(i.interventionTitle || i.title || i?.intervention?.title || '')

const extractParticipants = (i: AssignedIntervention) => {
    const ids: string[] = []
    const emails: string[] = []
    const names: string[] = []

    // single
    const singleId = asString(i.participantId || i.beneficiaryId)
    const singleEmail = asString(i.beneficiaryEmail || i.email)
    const singleName = asString(i.beneficiaryName)

    if (singleId) ids.push(singleId)
    if (singleEmail) emails.push(singleEmail)
    if (singleName) names.push(singleName)

    // direct arrays
    safeArr(i.participantIds).forEach((x) => {
        if (typeof x === 'string' && x) ids.push(x)
    })
    safeArr(i.participantEmails).forEach((x) => {
        if (typeof x === 'string' && x) emails.push(x)
    })
    safeArr(i.participantNames).forEach((x) => {
        if (typeof x === 'string' && x) names.push(x)
    })

    // nested beneficiaries
    safeArr(i.beneficiaries).forEach((b) => {
        const bid = asString(b?.participantId)
        const bemail = asString(b?.email)
        const bname = asString(b?.name)
        if (bid) ids.push(bid)
        if (bemail) emails.push(bemail)
        if (bname) names.push(bname)
    })

    return {
        participantIds: uniq(ids).filter(Boolean),
        participantEmails: uniq(emails).filter(Boolean),
        participantNames: uniq(names).filter(Boolean),
    }
}

const InterventionAppointments: React.FC = () => {
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(false)

    const [interventions, setInterventions] = useState<AssignedIntervention[]>([])
    const [appointments, setAppointments] = useState<AppointmentDoc[]>([])

    const [consultantId, setConsultantId] = useState<string>('')
    const [userUid, setUserUid] = useState<string>('')
    const [userEmail, setUserEmail] = useState<string>('')

    const [editingId, setEditingId] = useState<string | null>(null)
    const [showFormModal, setShowFormModal] = useState(false)

    const [viewReason, setViewReason] = useState<{ reason: string; record: AppointmentDoc } | null>(
        null
    )

    const [attendanceModal, setAttendanceModal] = useState<{
        open: boolean
        record: AppointmentDoc | null
    }>({ open: false, record: null })

    const [qrModal, setQrModal] = useState<{
        open: boolean
        record: AppointmentDoc | null
    }>({ open: false, record: null })

    const [filters, setFilters] = useState<{
        status: 'all' | AppointmentDoc['status']
        period: 'all' | 'today' | 'week' | 'month'
        range: Dayjs[] | []
    }>({
        status: 'all',
        period: 'all',
        range: [],
    })

    const createdByRole = useMemo<'consultant' | 'operations' | 'unknown'>(() => {
        if (consultantId) return 'consultant'
        if (userUid) return 'operations'
        return 'unknown'
    }, [consultantId, userUid])

    useEffect(() => {
        const run = async () => {
            const user = auth.currentUser
            if (!user?.email || !user?.uid) return

            setUserUid(user.uid)
            setUserEmail(user.email)

            setLoading(true)
            try {
                // 1) Resolve consultantId if this user has a consultant profile
                let resolvedConsultantId = ''
                const consultantsQuery = query(collection(db, 'consultants'), where('email', '==', user.email))
                const consultantSnapshot = await getDocs(consultantsQuery)
                if (!consultantSnapshot.empty) {
                    resolvedConsultantId = consultantSnapshot.docs[0].id
                    setConsultantId(resolvedConsultantId)
                }

                // 2) Fetch assigned interventions for consultantId OR assigneeId (merge)
                const assigned: AssignedIntervention[] = []

                if (resolvedConsultantId) {
                    const q1 = query(
                        collection(db, 'assignedInterventions'),
                        where('consultantId', '==', resolvedConsultantId),
                        where('status', '==', 'assigned')
                    )
                    const s1 = await getDocs(q1)
                    s1.docs.forEach((d) => assigned.push({ id: d.id, ...(d.data() as any) }))
                }

                // operations / assignee path
                const q2 = query(
                    collection(db, 'assignedInterventions'),
                    where('assigneeId', '==', user.uid),
                    where('status', '==', 'assigned')
                )
                const s2 = await getDocs(q2)
                s2.docs.forEach((d) => assigned.push({ id: d.id, ...(d.data() as any) }))

                // dedupe by doc id
                const byId = new Map<string, AssignedIntervention>()
                assigned.forEach((a) => byId.set(a.id, a))
                const mergedAssigned = Array.from(byId.values())

                // sort: grouped first, then title
                mergedAssigned.sort((a, b) =>
                    pickInterventionTitle(a).localeCompare(pickInterventionTitle(b))
                )
                setInterventions(mergedAssigned)

                // 3) Fetch appointments for consultantId OR assigneeId (merge)
                const appts: AppointmentDoc[] = []

                if (resolvedConsultantId) {
                    const a1 = query(collection(db, 'appointments'), where('consultantId', '==', resolvedConsultantId))
                    const sA1 = await getDocs(a1)
                    sA1.docs.forEach((d) => appts.push({ id: d.id, ...(d.data() as any) }))
                }

                const a2 = query(collection(db, 'appointments'), where('assigneeId', '==', user.uid))
                const sA2 = await getDocs(a2)
                sA2.docs.forEach((d) => appts.push({ id: d.id, ...(d.data() as any) }))

                const apptById = new Map<string, AppointmentDoc>()
                appts.forEach((a) => apptById.set(a.id, a))
                const mergedAppts = Array.from(apptById.values())

                // newest first
                mergedAppts.sort((a, b) => {
                    const ta = a?.startTime?.toDate ? a.startTime.toDate().getTime() : 0
                    const tb = b?.startTime?.toDate ? b.startTime.toDate().getTime() : 0
                    return tb - ta
                })

                setAppointments(mergedAppts)
            } catch (e) {
                console.error(e)
                message.error('Failed to load data')
            } finally {
                setLoading(false)
            }
        }

        run()
    }, [])

    const sendNotification = async (type: string, appointment: AppointmentDoc) => {
        const intervention = interventions.find((i) => i.id === appointment.assignedInterventionId)

        const interventionTitle =
            appointment.interventionTitle ||
            intervention?.interventionTitle ||
            intervention?.title ||
            'an intervention'

        const participantLabel =
            appointment.participantNames?.length > 0
                ? appointment.participantNames.join(', ')
                : intervention?.beneficiaryName || 'Participant'

        await addDoc(collection(db, 'notifications'), {
            type: `appointment/${type.replace('appointment-', '')}`,
            appointmentId: appointment.id,
            recipientRoles: ['admin', 'participant'],
            message: {
                participant: `Your appointment regarding "${interventionTitle}" has been ${type === 'appointment-cancelled' ? 'cancelled' : 'updated'
                    }.`,
                admin: `A ${createdByRole} ${type === 'appointment-cancelled' ? 'cancelled' : 'updated'} an appointment for ${participantLabel}.`,
            },
            metadata: {
                participantIds: appointment.participantIds || [],
                participantEmails: appointment.participantEmails || [],
                consultantId: appointment.consultantId || null,
                assigneeId: appointment.assigneeId || null,
                startTime: appointment.startTime,
                endTime: appointment.endTime,
            },
            readBy: {},
            createdAt: Timestamp.now(),
        })
    }

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields()
            setLoading(true)

            const assigned = interventions.find((x) => x.id === values.assignedInterventionId)
            if (!assigned) {
                message.error('Selected intervention not found')
                return
            }

            const { participantIds, participantEmails, participantNames } = extractParticipants(assigned)

            if (participantIds.length === 0 && participantEmails.length === 0) {
                message.warning('This intervention has no participant mapping. Please fix the assigned intervention record.')
                return
            }

            const interventionTitle = pickInterventionTitle(assigned)

            const payload: Omit<AppointmentDoc, 'id'> = {
                assignedInterventionId: assigned.id,
                interventionId: asString(assigned.interventionId),
                interventionTitle,

                consultantId: consultantId || null,
                assigneeId: userUid || null,

                meetingType: values.meetingType,
                meetingLink: values.meetingLink || null,

                participantIds,
                participantNames,
                participantEmails,

                startTime: Timestamp.fromDate(values.timeRange[0].toDate()),
                endTime: Timestamp.fromDate(values.timeRange[1].toDate()),
                status: 'pending',

                attendance: {},

                createdByUid: userUid,
                createdByEmail: userEmail,
                createdByRole,

                updatedAt: Timestamp.now(),
            }

            if (editingId) {
                await updateDoc(doc(db, 'appointments', editingId), payload as any)
                await sendNotification('appointment-edited', { ...(payload as any), id: editingId })
                message.success('Appointment updated')
            } else {
                await addDoc(collection(db, 'appointments'), {
                    ...payload,
                    createdAt: Timestamp.now(),
                })
                message.success('Appointment scheduled')
            }

            form.resetFields()
            setEditingId(null)
            setShowFormModal(false)

            // refresh appointments quickly (local)
            // (you can swap this for onSnapshot later)
            const user = auth.currentUser
            if (user?.uid) {
                const appts: AppointmentDoc[] = []
                if (consultantId) {
                    const a1 = query(collection(db, 'appointments'), where('consultantId', '==', consultantId))
                    const sA1 = await getDocs(a1)
                    sA1.docs.forEach((d) => appts.push({ id: d.id, ...(d.data() as any) }))
                }
                const a2 = query(collection(db, 'appointments'), where('assigneeId', '==', user.uid))
                const sA2 = await getDocs(a2)
                sA2.docs.forEach((d) => appts.push({ id: d.id, ...(d.data() as any) }))
                const apptById = new Map<string, AppointmentDoc>()
                appts.forEach((a) => apptById.set(a.id, a))
                const mergedAppts = Array.from(apptById.values())
                mergedAppts.sort((a, b) => {
                    const ta = a?.startTime?.toDate ? a.startTime.toDate().getTime() : 0
                    const tb = b?.startTime?.toDate ? b.startTime.toDate().getTime() : 0
                    return tb - ta
                })
                setAppointments(mergedAppts)
            }
        } catch (e) {
            console.error(e)
            message.error('Failed to save appointment')
        } finally {
            setLoading(false)
        }
    }

    const handleEdit = (record: AppointmentDoc) => {
        form.setFieldsValue({
            assignedInterventionId: record.assignedInterventionId,
            meetingType: record.meetingType,
            meetingLink: record.meetingLink,
            timeRange: [dayjs(record.startTime.toDate()), dayjs(record.endTime.toDate())],
        })
        setEditingId(record.id)
        setShowFormModal(true)
    }

    const handleCancelAppointment = async (record: AppointmentDoc) => {
        try {
            await updateDoc(doc(db, 'appointments', record.id), {
                status: 'cancelled',
                updatedAt: Timestamp.now(),
            })
            await sendNotification('appointment-cancelled', record)
            message.success('Appointment cancelled')
            setViewReason(null)

            setAppointments((prev) =>
                prev.map((a) => (a.id === record.id ? { ...a, status: 'cancelled' } : a))
            )
        } catch (e) {
            console.error(e)
            message.error('Failed to cancel appointment')
        }
    }

    const markAttendance = async (record: AppointmentDoc, email: string, status: 'present' | 'absent') => {
        const uid = auth.currentUser?.uid || null
        const uEmail = auth.currentUser?.email || null

        const nextAttendance = {
            ...(record.attendance || {}),
            [email]: {
                status,
                method: 'manual',
                markedAt: Timestamp.now(),
                markedByUid: uid,
                markedByEmail: uEmail,
            },
        }

        await updateDoc(doc(db, 'appointments', record.id), {
            attendance: nextAttendance,
            updatedAt: Timestamp.now(),
        })

        setAppointments((prev) =>
            prev.map((a) => (a.id === record.id ? { ...a, attendance: nextAttendance } : a))
        )

        message.success(`Marked ${email} as ${status}`)
    }

    const doQrCheckIn = async (record: AppointmentDoc) => {
        const email = auth.currentUser?.email
        const uid = auth.currentUser?.uid || null
        if (!email) {
            message.error('You must be logged in to check in')
            return
        }

        const allowed = (record.participantEmails || []).map((e) => e.toLowerCase())
        if (!allowed.includes(email.toLowerCase())) {
            message.error('You are not on the attendee list for this appointment')
            return
        }

        const nextAttendance = {
            ...(record.attendance || {}),
            [email]: {
                status: 'present',
                method: 'qr',
                markedAt: Timestamp.now(),
                markedByUid: uid,
                markedByEmail: email,
            },
        }

        await updateDoc(doc(db, 'appointments', record.id), {
            attendance: nextAttendance,
            updatedAt: Timestamp.now(),
        })

        setAppointments((prev) =>
            prev.map((a) => (a.id === record.id ? { ...a, attendance: nextAttendance } : a))
        )

        message.success('Checked in successfully')
    }

    const handleFilterChange = (key: string, value: any) => {
        setFilters((prev) => ({ ...prev, [key]: value }))
    }

    const filteredAppointments = useMemo(() => {
        return appointments.filter((a) => {
            const matchesStatus = filters.status === 'all' || a.status === filters.status

            const now = dayjs()
            let matchesPeriod = true
            if (filters.period === 'today') {
                matchesPeriod = dayjs(a.startTime.toDate()).isSame(now, 'day')
            } else if (filters.period === 'week') {
                matchesPeriod = dayjs(a.startTime.toDate()).isSame(now, 'week')
            } else if (filters.period === 'month') {
                matchesPeriod = dayjs(a.startTime.toDate()).isSame(now, 'month')
            }

            let matchesRange = true
            if (filters.range.length === 2) {
                const [start, end] = filters.range
                matchesRange = dayjs(a.startTime.toDate()).isBetween(start, end, null, '[]')
            }

            return matchesStatus && matchesPeriod && matchesRange
        })
    }, [appointments, filters])

    const stats = useMemo(() => {
        const total = appointments.length
        const pending = appointments.filter((a) => a.status === 'pending').length
        const accepted = appointments.filter((a) => a.status === 'accepted').length
        const declined = appointments.filter((a) => a.status === 'declined').length
        const cancelled = appointments.filter((a) => a.status === 'cancelled').length
        return { total, pending, accepted, declined, cancelled }
    }, [appointments])

    const columns = [
        {
            title: 'Participants',
            dataIndex: 'participantNames',
            key: 'participants',
            render: (_: any, record: AppointmentDoc) => {
                const names = safeArr(record.participantNames)
                const emails = safeArr(record.participantEmails)

                if (names.length === 0 && emails.length === 0) return '-'

                return (
                    <Space direction="vertical" size={4}>
                        <Space wrap size={6}>
                            {names.slice(0, 4).map((n: string) => (
                                <Tag key={n} color="blue">
                                    {n}
                                </Tag>
                            ))}
                            {names.length > 4 ? <Tag>+{names.length - 4}</Tag> : null}
                        </Space>
                        <Space wrap size={6}>
                            {emails.slice(0, 3).map((e: string) => (
                                <Tag key={e}>{e}</Tag>
                            ))}
                            {emails.length > 3 ? <Tag>+{emails.length - 3}</Tag> : null}
                        </Space>
                    </Space>
                )
            },
        },
        {
            title: 'Intervention',
            dataIndex: 'interventionTitle',
            key: 'interventionTitle',
            render: (v: any) => asString(v) || '-',
        },
        {
            title: 'Meeting Type',
            dataIndex: 'meetingType',
            key: 'meetingType',
            render: (v: any) => asString(v) || '-',
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (text: AppointmentDoc['status']) => {
                const color =
                    text === 'declined'
                        ? 'red'
                        : text === 'accepted'
                            ? 'green'
                            : text === 'cancelled'
                                ? 'volcano'
                                : text === 'completed'
                                    ? 'geekblue'
                                    : 'blue'
                return <Tag color={color}>{text}</Tag>
            },
        },
        {
            title: 'Time',
            key: 'time',
            render: (_: any, record: AppointmentDoc) => (
                <span>
                    {dayjs(record.startTime.toDate()).format('DD MMM YYYY HH:mm')} -{' '}
                    {dayjs(record.endTime.toDate()).format('HH:mm')}
                </span>
            ),
        },
        {
            title: 'Attendance',
            key: 'attendance',
            render: (_: any, record: AppointmentDoc) => {
                const emails = safeArr(record.participantEmails)
                const attendance = record.attendance || {}
                const present = emails.filter((e: string) => attendance?.[e]?.status === 'present').length
                const absent = emails.filter((e: string) => attendance?.[e]?.status === 'absent').length
                const total = emails.length || 0
                return (
                    <Space>
                        <Badge count={present} color="green" />
                        <Text type="secondary">
                            {present}/{total} present{absent ? `, ${absent} absent` : ''}
                        </Text>
                    </Space>
                )
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: AppointmentDoc) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                        Edit
                    </Button>

                    {record.status === 'declined' ? (
                        <Button
                            size="small"
                            onClick={() =>
                                setViewReason({
                                    reason: record.declinedReason || 'No reason provided',
                                    record,
                                })
                            }
                        >
                            View Reason
                        </Button>
                    ) : null}

                    {record.meetingType !== 'in_person' && record.meetingLink ? (
                        <Button size="small" type="link" href={record.meetingLink} target="_blank">
                            Join
                        </Button>
                    ) : null}

                    <Tooltip title="Attendance (manual + QR check-in)">
                        <Button
                            size="small"
                            icon={<CheckCircleOutlined />}
                            onClick={() => setAttendanceModal({ open: true, record })}
                        >
                            Attendance
                        </Button>
                    </Tooltip>

                    <Tooltip title="Show QR for attendee check-in">
                        <Button
                            size="small"
                            icon={<QrcodeOutlined />}
                            onClick={() => setQrModal({ open: true, record })}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ]

    const meetingType = Form.useWatch('meetingType', form)

    const metrics = useMemo(() => {
        const total = appointments.length
        const pending = appointments.filter(a => a.status === 'pending').length
        const accepted = appointments.filter(a => a.status === 'accepted').length
        const declined = appointments.filter(a => a.status === 'declined').length
        const cancelled = appointments.filter(a => a.status === 'cancelled').length
        return { total, pending, accepted, declined, cancelled }
    }, [appointments])

    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            <Spin spinning={loading}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>

                    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                        <Col xs={24} sm={12} md={6}>
                            <MotionCard>
                                <MotionCard.Metric
                                    icon={<CalendarOutlined style={{ fontSize: 20, color: '#1677ff' }} />}
                                    iconBg="rgba(22,119,255,.12)"
                                    title="Total Appointments"
                                    value={metrics.total}
                                />
                            </MotionCard>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                            <MotionCard>
                                <MotionCard.Metric
                                    icon={<ClockCircleOutlined style={{ fontSize: 20, color: '#faad14' }} />}
                                    iconBg="rgba(250,173,20,.14)"
                                    title="Pending"
                                    value={metrics.pending}
                                />
                            </MotionCard>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                            <MotionCard>
                                <MotionCard.Metric
                                    icon={<CheckOutlined style={{ fontSize: 20, color: '#52c41a' }} />}
                                    iconBg="rgba(82,196,26,.14)"
                                    title="Accepted"
                                    value={metrics.accepted}
                                />
                            </MotionCard>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                            <MotionCard>
                                <MotionCard.Metric
                                    icon={<CloseOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />}
                                    iconBg="rgba(255,77,79,.14)"
                                    title="Declined"
                                    value={metrics.declined}
                                />
                            </MotionCard>
                        </Col>
                    </Row>


                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                        <Card hoverable style={{ ...cardStyle }}>
                            <Row gutter={12} align="middle" justify="space-between">
                                <Col flex="auto">
                                    <Space wrap>
                                        <Select
                                            value={filters.status}
                                            onChange={(val) => handleFilterChange('status', val)}
                                            style={{ width: 160 }}
                                        >
                                            <Option value="all">All Status</Option>
                                            <Option value="pending">Pending</Option>
                                            <Option value="declined">Declined</Option>
                                            <Option value="cancelled">Cancelled</Option>
                                            <Option value="accepted">Accepted</Option>
                                            <Option value="completed">Completed</Option>
                                        </Select>

                                        <Select
                                            value={filters.period}
                                            onChange={(val) => handleFilterChange('period', val)}
                                            style={{ width: 160 }}
                                        >
                                            <Option value="all">All Periods</Option>
                                            <Option value="today">Today</Option>
                                            <Option value="week">This Week</Option>
                                            <Option value="month">This Month</Option>
                                        </Select>

                                        <RangePicker onChange={(val) => handleFilterChange('range', val || [])} />
                                    </Space>
                                </Col>
                                <Col>
                                    <Button type="primary" onClick={() => setShowFormModal(true)}>
                                        Make New Appointment
                                    </Button>
                                </Col>
                            </Row>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                        <Card hoverable style={{ ...cardStyle }}>
                            <Table
                                columns={columns as any}
                                dataSource={filteredAppointments}
                                rowKey="id"
                                pagination={false}
                            />
                        </Card>
                    </motion.div>
                </Space>
            </Spin>

            {/* Create/Edit Appointment */}
            <Modal
                title={editingId ? 'Edit Appointment' : 'Make Appointment'}
                open={showFormModal}
                onCancel={() => {
                    form.resetFields()
                    setEditingId(null)
                    setShowFormModal(false)
                }}
                onOk={handleSubmit}
                okText={editingId ? 'Update' : 'Save'}
                destroyOnClose
            >
                <Form layout="vertical" form={form}>
                    <Form.Item
                        name="assignedInterventionId"
                        label="Assigned Intervention"
                        rules={[{ required: true, message: 'Select an intervention' }]}
                    >
                        <Select placeholder="Select intervention" showSearch optionFilterProp="children">
                            {interventions.map((item) => {
                                const title = pickInterventionTitle(item)
                                const { participantNames } = extractParticipants(item)
                                const isGrouped =
                                    safeArr(item.participantIds).length > 1 ||
                                    safeArr(item.participantEmails).length > 1 ||
                                    safeArr(item.beneficiaries).length > 1

                                return (
                                    <Option key={item.id} value={item.id}>
                                        <Space>
                                            <span>{title || item.id}</span>
                                            {participantNames?.[0] ? (
                                                <Text type="secondary">— {participantNames.slice(0, 2).join(', ')}</Text>
                                            ) : null}
                                            {isGrouped ? <Tag color="geekblue">Grouped</Tag> : <Tag>Single</Tag>}
                                        </Space>
                                    </Option>
                                )
                            })}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="meetingType"
                        label="Meeting Type"
                        rules={[{ required: true, message: 'Select meeting type' }]}
                    >
                        <Select placeholder="Select meeting type">
                            <Option value="telephonic">Telephonic</Option>
                            <Option value="zoom">Zoom</Option>
                            <Option value="google_meet">Google Meet</Option>
                            <Option value="teams">Microsoft Teams</Option>
                            <Option value="in_person">In Person</Option>
                        </Select>
                    </Form.Item>

                    {['zoom', 'google_meet', 'teams'].includes(meetingType) ? (
                        <Form.Item
                            name="meetingLink"
                            label="Meeting Link"
                            rules={[{ required: true, message: 'Meeting link required for online meeting' }]}
                        >
                            <Input placeholder="Paste meeting link here" />
                        </Form.Item>
                    ) : null}

                    <Form.Item
                        name="timeRange"
                        label="Start and End Time"
                        rules={[{ required: true, message: 'Select date and time range' }]}
                    >
                        <RangePicker showTime style={{ width: '100%' }} />
                    </Form.Item>

                    <Divider />

                    <Card size="small" style={{ borderRadius: 12 }}>
                        <Space align="start">
                            <WarningOutlined style={{ color: '#faad14', marginTop: 2 }} />
                            <div>
                                <Text strong>Grouped interventions</Text>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        If the selected assigned intervention contains multiple participants/emails, they’ll
                                        all be attached to the appointment, and QR check-in will validate against that list.
                                    </Text>
                                </div>
                            </div>
                        </Space>
                    </Card>
                </Form>
            </Modal>

            {/* Decline reason modal (and cancel) */}
            <Modal title="Rejection Reason" open={!!viewReason} onCancel={() => setViewReason(null)} footer={null} destroyOnClose>
                <p>{viewReason?.reason}</p>
                <Space style={{ marginTop: 16 }}>
                    <Button type="primary" onClick={() => handleEdit(viewReason!.record)}>
                        Reschedule
                    </Button>
                    <Button danger onClick={() => handleCancelAppointment(viewReason!.record)}>
                        Cancel Appointment
                    </Button>
                </Space>
            </Modal>

            {/* Attendance modal */}
            <Modal
                title="Attendance"
                open={attendanceModal.open}
                onCancel={() => setAttendanceModal({ open: false, record: null })}
                footer={null}
                destroyOnClose
            >
                {attendanceModal.record ? (
                    <>
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                            <Card size="small" style={{ borderRadius: 12 }}>
                                <Space direction="vertical" size={2}>
                                    <Text strong>{attendanceModal.record.interventionTitle || 'Appointment'}</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {dayjs(attendanceModal.record.startTime.toDate()).format('DD MMM YYYY HH:mm')} -{' '}
                                        {dayjs(attendanceModal.record.endTime.toDate()).format('HH:mm')}
                                    </Text>
                                </Space>
                            </Card>

                            <Card size="small" style={{ borderRadius: 12 }}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Text strong>Manual marking</Text>

                                    {attendanceModal.record.participantEmails.length === 0 ? (
                                        <Text type="secondary">No attendee emails found on this appointment.</Text>
                                    ) : (
                                        attendanceModal.record.participantEmails.map((email) => {
                                            const entry = attendanceModal.record?.attendance?.[email]
                                            const status = entry?.status
                                            const method = entry?.method
                                            return (
                                                <Row key={email} gutter={8} align="middle" style={{ padding: '8px 0' }}>
                                                    <Col flex="auto">
                                                        <Space direction="vertical" size={0}>
                                                            <Text>{email}</Text>
                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                {status ? `Status: ${status}` : 'Status: not marked'}
                                                                {method ? ` • via ${method}` : ''}
                                                            </Text>
                                                        </Space>
                                                    </Col>
                                                    <Col>
                                                        <Space>
                                                            <Button
                                                                size="small"
                                                                icon={<CheckOutlined />}
                                                                onClick={() => markAttendance(attendanceModal.record!, email, 'present')}
                                                            >
                                                                Present
                                                            </Button>
                                                            <Button
                                                                size="small"
                                                                danger
                                                                icon={<CloseOutlined />}
                                                                onClick={() => markAttendance(attendanceModal.record!, email, 'absent')}
                                                            >
                                                                Absent
                                                            </Button>
                                                        </Space>
                                                    </Col>
                                                </Row>
                                            )
                                        })
                                    )}

                                    <Divider style={{ margin: '12px 0' }} />

                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        <Text strong>QR check-in (self)</Text>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            If you are an attendee and your email is on the appointment’s attendee list, this
                                            will mark you present (method: qr).
                                        </Text>
                                        <Button
                                            icon={<QrcodeOutlined />}
                                            onClick={() => doQrCheckIn(attendanceModal.record!)}
                                        >
                                            Check in as current user
                                        </Button>
                                    </Space>
                                </Space>
                            </Card>
                        </Space>
                    </>
                ) : null}
            </Modal>

            {/* QR modal */}
            <Modal
                title="Appointment QR"
                open={qrModal.open}
                onCancel={() => setQrModal({ open: false, record: null })}
                footer={null}
                destroyOnClose
            >
                {qrModal.record ? (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Card size="small" style={{ borderRadius: 12 }}>
                            <Space direction="vertical" size={2}>
                                <Text strong>{qrModal.record.interventionTitle || 'Appointment'}</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {dayjs(qrModal.record.startTime.toDate()).format('DD MMM YYYY HH:mm')} -{' '}
                                    {dayjs(qrModal.record.endTime.toDate()).format('HH:mm')}
                                </Text>
                            </Space>
                        </Card>

                        {/* QR payload: appointmentId only (simple + stable).
                            If you want tamper resistance later, add a short token stored in doc. */}
                        <div style={{ display: 'grid', placeItems: 'center', padding: 12 }}>
                            <QRCode
                                value={qrModal.record.id}
                                icon={undefined}
                                size={220}
                                status="active"
                            />
                        </div>

                        <Card size="small" style={{ borderRadius: 12 }}>
                            <Space direction="vertical" size={6}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    Scan flow idea:
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    1) attendee scans QR → app reads appointmentId
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    2) attendee must be logged in → we check their auth email is in participantEmails
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    3) we write attendance[email] = present (method: qr)
                                </Text>

                                <Divider style={{ margin: '10px 0' }} />

                                <Button icon={<CheckCircleOutlined />} onClick={() => doQrCheckIn(qrModal.record!)}>
                                    Test check-in as current user
                                </Button>
                            </Space>
                        </Card>
                    </Space>
                ) : null}
            </Modal>
        </div>
    )
}

export default InterventionAppointments
