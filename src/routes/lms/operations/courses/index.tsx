// src/pages/lms/operations/CoursesManager.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Card,
    Col,
    Row,
    Typography,
    Input,
    Button,
    Tag,
    Space,
    Statistic,
    Skeleton,
    Empty,
    Tooltip,
    Divider
} from 'antd'
import {
    SearchOutlined,
    PlusOutlined,
    TeamOutlined,
    BarChartOutlined,
    EditOutlined,
    EyeOutlined,
    ReadOutlined,
    StarFilled,
    BookOutlined,
    RiseOutlined
} from '@ant-design/icons'
import { db, auth } from '@/firebase'
import {
    collection,
    getDocs,
    query,
    where,
    getCountFromServer,
    Timestamp,
    DocumentData
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { MotionCard } from '@/components/shared/Header'

const { Title, Text } = Typography

type CourseRow = {
    id: string
    title: string
    category: string
    status: 'draft' | 'active'
    providerId: string

    enrolledStudents: number
    completedStudents: number
    avgRating: number
    pendingAssignments: number

    updatedAtLabel: string
    canManage: boolean
}

const formatWhen = (v: any): string => {
    try {
        if (v instanceof Timestamp) return v.toDate().toLocaleString()
        if (v && typeof v === 'object' && typeof v.seconds === 'number') {
            return new Date(v.seconds * 1000).toLocaleString()
        }
        if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) {
            return new Date(v).toLocaleString()
        }
    } catch { }
    return '—'
}

const capFirstLetter = (s: string) =>
    String(s || '')
        .trim()
        .replace(/_/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')

const statusTag = (status: 'draft' | 'active') => {
    return status === 'active' ? (
        <Tag color='green'>{capFirstLetter(status)}</Tag>
    ) : (
        <Tag>{capFirstLetter(status)}</Tag>
    )
}

const CoursesManager: React.FC = () => {
    const navigate = useNavigate()
    const { user } = useFullIdentity()
    const [uid, setUid] = useState<string | null>(null)

    const [loading, setLoading] = useState(true)
    const [rows, setRows] = useState<CourseRow[]>([])
    const [search, setSearch] = useState('')

    // Role parsing (more tolerant)
    const rawRole = String(user?.role || '').toLowerCase()
    const isOperations = rawRole.includes('operation') || rawRole === 'ops'
    const isConsultant = rawRole.includes('consultant')

    // Base routes (match your router tree)
    const base = useMemo(() => {
        if (isOperations) return '/lms/operations'
        if (isConsultant) return '/lms/consultant'
        return '/lms/operations'
    }, [isOperations, isConsultant])

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, user => setUid(user?.uid ?? null))
        return () => unsub()
    }, [])

    useEffect(() => {
        const run = async () => {
            if (!uid) return
            setLoading(true)

            try {
                const coursesRef = collection(db, 'courses')
                console.log(user)

                // Consultant: only own courses
                // Operations: all courses
                let coursesQ
                if (isConsultant) {
                    coursesQ = query(coursesRef, where('providerId', '==', uid))
                } else if (isOperations) {
                    coursesQ = query(coursesRef)
                } else {
                    coursesQ = query(coursesRef, where('providerId', '==', uid))
                }

                const snap = await getDocs(coursesQ)

                const list: CourseRow[] = await Promise.all(
                    snap.docs.map(async d => {
                        const data = d.data() as DocumentData
                        const providerId = String(data?.providerId || '')

                        // Ops can only manage courses they created.
                        // Consultant only sees their own anyway.
                        const canManage = providerId === uid

                        // Enrolled count (accepted)
                        let enrolledStudents = 0
                        try {
                            const enrollRef = collection(db, 'enrollments')
                            const enrollQ = query(
                                enrollRef,
                                where('courseId', '==', d.id),
                                where('status', '==', 'accepted')
                            )
                            const countSnap = await getCountFromServer(enrollQ)
                            enrolledStudents = countSnap.data().count || 0
                        } catch {
                            enrolledStudents = 0
                        }

                        // Avg rating from subcollection
                        let avgRating = 0
                        try {
                            const ratingsRef = collection(db, 'courses', d.id, 'ratings')
                            const ratingsSnap = await getDocs(ratingsRef)
                            let sum = 0
                            let n = 0
                            ratingsSnap.forEach(r => {
                                const rr = Number((r.data() as any)?.rating) || 0
                                if (rr >= 0 && rr <= 5) {
                                    sum += rr
                                    n += 1
                                }
                            })
                            avgRating = n ? Math.round((sum / n) * 10) / 10 : 0
                        } catch {
                            avgRating = 0
                        }

                        const updatedAtLabel = formatWhen(data?.updatedAt ?? data?.updatedAtISO)

                        return {
                            id: d.id,
                            title: String(data?.title || 'Untitled Course'),
                            category: String(data?.category || 'Uncategorized'),
                            status: (data?.status as 'draft' | 'active') || 'draft',
                            providerId,

                            enrolledStudents,
                            completedStudents: Number(data?.completedStudents || 0),
                            avgRating,
                            pendingAssignments: Number(data?.pendingAssignments || 0),

                            updatedAtLabel,
                            // IMPORTANT: ops can view all, but manage only own
                            canManage: isOperations ? providerId === uid : canManage
                        }
                    })
                )

                setRows(list)
            } catch (e: any) {
                // ant message keeps it consistent with the rest of your app
                // eslint-disable-next-line no-console
                console.error(e)
            } finally {
                setLoading(false)
            }
        }

        run()
    }, [uid, isOperations, isConsultant])

    const filtered = useMemo(() => {
        const s = search.trim().toLowerCase()
        if (!s) return rows
        return rows.filter(
            r =>
                r.title.toLowerCase().includes(s) ||
                r.category.toLowerCase().includes(s) ||
                r.status.toLowerCase().includes(s)
        )
    }, [rows, search])

    const stats = useMemo(() => {
        const totalCourses = rows.length
        const totalStudents = rows.reduce((a, c) => a + (c.enrolledStudents || 0), 0)
        const avgRating = rows.length
            ? rows.reduce((a, c) => a + (c.avgRating || 0), 0) / rows.length
            : 0
        return {
            totalCourses,
            totalStudents,
            avgRating: Number.isFinite(avgRating) ? avgRating : 0
        }
    }, [rows])

    const goCreate = () => navigate(`${base}/courses/new`)
    const goView = (id: string) => navigate(`${base}/courses/${id}`)

    //Operations can manage enrollments/grades/analytics only on OWN courses
    const goEnrollments = (id: string) => navigate(`${base}/enrollments?courseId=${id}`)
    const goGrades = (id: string) => navigate(`${base}/grades?courseId=${id}`)
    const goAnalytics = (id: string) => navigate(`${base}/analytics/${id}`)
    const goEdit = (id: string) => navigate(`${base}/courses/${id}?mode=edit`)

    return (
        <div style={{ padding: 16 }}>
            {/* Header */}
            <Card style={{ marginBottom: 16 }}>
                <Row gutter={[12, 12]} align='middle'>
                    <Col xs={24} md={12}>
                        <Title level={3} style={{ margin: 0 }}>
                            {isConsultant ? 'My Courses' : 'Courses'}
                        </Title>
                        <Text type='secondary'>
                            {isOperations
                                ? 'Operations: view all courses, manage only those you created.'
                                : isConsultant
                                    ? 'Consultant: only courses you created.'
                                    : 'Courses'}
                        </Text>
                    </Col>

                    <Col xs={24} md={12}>
                        <Row gutter={[8, 8]} justify='end'>
                            <Col flex='auto'>
                                <Input
                                    prefix={<SearchOutlined />}
                                    placeholder='Search courses...'
                                    allowClear
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </Col>
                            <Col>
                                {(isOperations || isConsultant) && (
                                    <Button type='primary' icon={<PlusOutlined />} onClick={goCreate}>
                                        Add New Course
                                    </Button>
                                )}
                            </Col>
                        </Row>
                    </Col>
                </Row>
            </Card>

            {/* Stats */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} md={6}>
                    <MotionCard>
                        <Statistic title='Total Courses' value={stats.totalCourses} prefix={<BookOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} md={6}>
                    <MotionCard>
                        <Statistic title='Total Students' value={stats.totalStudents} prefix={<TeamOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} md={6}>
                    <MotionCard>
                        <Statistic
                            title='Avg Rating'
                            value={stats.avgRating}
                            precision={1}
                            prefix={<StarFilled />}
                        />
                    </MotionCard>
                </Col>
                <Col xs={24} md={6}>
                    <MotionCard>
                        <Statistic title='Completion Rate' value='—' prefix={<RiseOutlined />} />
                    </MotionCard>
                </Col>
            </Row>

            {/* Course Cards */}
            <MotionCard title='Course Overview'>
                {loading ? (
                    <Skeleton active />
                ) : filtered.length === 0 ? (
                    <Empty description='No courses found.' />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {filtered.map(course => {
                            const viewOnly = isOperations && !course.canManage

                            return (
                                <Card
                                    key={course.id}
                                    style={{ borderRadius: 12 }}
                                    bodyStyle={{ padding: 16 }}
                                >
                                    <Row gutter={[12, 12]} align='top'>
                                        <Col xs={24} md={16}>
                                            <Space direction='vertical' size={2} style={{ width: '100%' }}>
                                                <Space wrap size={8}>
                                                    <Text strong style={{ fontSize: 16 }}>
                                                        {course.title}
                                                    </Text>
                                                    {statusTag(course.status)}
                                                    {viewOnly && <Tag color='blue'>View Only</Tag>}
                                                </Space>

                                                <Text type='secondary'>{capFirstLetter(course.category)}</Text>
                                                <Text type='secondary' style={{ fontSize: 12 }}>
                                                    Last updated: {course.updatedAtLabel}
                                                </Text>
                                            </Space>

                                            <Divider style={{ margin: '12px 0' }} />

                                            <Row gutter={[12, 12]}>
                                                <Col xs={12} md={6}>
                                                    <Card size='small'>
                                                        <Statistic title='Enrolled' value={course.enrolledStudents || 0} />
                                                    </Card>
                                                </Col>
                                                <Col xs={12} md={6}>
                                                    <Card size='small'>
                                                        <Statistic title='Completed' value={course.completedStudents || 0} />
                                                    </Card>
                                                </Col>
                                                <Col xs={12} md={6}>
                                                    <Card size='small'>
                                                        <Statistic
                                                            title='Rating'
                                                            value={course.avgRating || 0}
                                                            precision={1}
                                                            prefix={<StarFilled />}
                                                        />
                                                    </Card>
                                                </Col>
                                                <Col xs={12} md={6}>
                                                    <Card size='small'>
                                                        <Statistic title='Pending' value={course.pendingAssignments || 0} />
                                                    </Card>
                                                </Col>
                                            </Row>
                                        </Col>

                                        <Col xs={24} md={8}>
                                            <Space direction='vertical' style={{ width: '100%' }} size={8}>
                                                <Button icon={<EyeOutlined />} block onClick={() => goView(course.id)}>
                                                    View Course
                                                </Button>

                                                <Tooltip
                                                    title={
                                                        viewOnly
                                                            ? 'You can only manage courses you created.'
                                                            : undefined
                                                    }
                                                >
                                                    <Button
                                                        icon={<TeamOutlined />}
                                                        block
                                                        disabled={viewOnly}
                                                        onClick={() => goEnrollments(course.id)}
                                                    >
                                                        View Enrollments
                                                    </Button>
                                                </Tooltip>

                                                <Tooltip
                                                    title={viewOnly ? 'You can only manage courses you created.' : undefined}
                                                >
                                                    <Button
                                                        icon={<ReadOutlined />}
                                                        block
                                                        disabled={viewOnly}
                                                        onClick={() => goGrades(course.id)}
                                                    >
                                                        Grades
                                                    </Button>
                                                </Tooltip>

                                                <Tooltip
                                                    title={viewOnly ? 'You can only manage courses you created.' : undefined}
                                                >
                                                    <Button
                                                        icon={<BarChartOutlined />}
                                                        block
                                                        disabled={viewOnly}
                                                        onClick={() => goAnalytics(course.id)}
                                                    >
                                                        Analytics
                                                    </Button>
                                                </Tooltip>

                                                <Tooltip
                                                    title={viewOnly ? 'You can only edit courses you created.' : undefined}
                                                >
                                                    <Button
                                                        type='primary'
                                                        icon={<EditOutlined />}
                                                        block
                                                        disabled={viewOnly}
                                                        onClick={() => goEdit(course.id)}
                                                    >
                                                        Edit
                                                    </Button>
                                                </Tooltip>
                                            </Space>
                                        </Col>
                                    </Row>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </MotionCard>
        </div>
    )
}

export default CoursesManager
