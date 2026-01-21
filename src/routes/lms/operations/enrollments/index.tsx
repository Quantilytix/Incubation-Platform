import React, { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
    Row,
    Col,
    Typography,
    Button,
    Input,
    Modal,
    Form,
    Select,
    Table,
    Tag,
    Progress,
    Space,
    message,
    Tooltip,
    Popconfirm,
    Alert
} from 'antd'
import {
    SearchOutlined,
    UserAddOutlined,
    MailOutlined,
    LineChartOutlined,
    BarChartOutlined,
    UserDeleteOutlined,
    ArrowLeftOutlined
} from '@ant-design/icons'
import type { ColumnsType, TableRowSelection } from 'antd/es/table'

import { mockEnrollments, mockCourses } from '@/data/lmsMockData'
import { mockIncubatees } from '@/data/mockData'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'

const { Title, Text } = Typography
const { Option } = Select

type Enrollment = (typeof mockEnrollments)[number]

export const OperationsEnrollments: React.FC = () => {
    const location = useLocation()
    const navigate = useNavigate()

    const [searchQuery, setSearchQuery] = useState('')
    const [isEnrollOpen, setIsEnrollOpen] = useState(false)
    const [isMassEnrollOpen, setIsMassEnrollOpen] = useState(false)
    const [form] = Form.useForm()
    const [massForm] = Form.useForm()

    // For multi-select
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

    // ✅ Read courseId from URL: /lms/operations/enrollments?courseId=XYZ
    const courseId = useMemo(() => {
        const sp = new URLSearchParams(location.search)
        const id = sp.get('courseId')
        return id ? String(id) : null
    }, [location.search])

    const activeCourse = useMemo(() => {
        if (!courseId) return null
        return mockCourses.find(c => String(c.id) === String(courseId)) ?? null
    }, [courseId])

    // If courseId is present, lock the modals to that course by default
    useEffect(() => {
        if (!courseId) return
        form.setFieldsValue({ courseId })
        massForm.setFieldsValue({ courseId })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId])

    // ✅ Filter enrollments to ONLY current course if courseId is provided
    const courseScopedEnrollments = useMemo(() => {
        if (!courseId) return mockEnrollments
        // supports either courseId or courseName-only mocks
        return mockEnrollments.filter(e => {
            const eCourseId = (e as any)?.courseId ? String((e as any).courseId) : null
            if (eCourseId) return eCourseId === String(courseId)
            // fallback if your mocks don't have courseId:
            return activeCourse ? String(e.courseName) === String((activeCourse as any)?.title) : false
        })
    }, [courseId, activeCourse])

    const filteredEnrollments = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        const base = courseScopedEnrollments

        if (!q) return base

        return base.filter(enrollment => {
            return (
                enrollment.incubateeName.toLowerCase().includes(q) ||
                enrollment.courseName.toLowerCase().includes(q) ||
                enrollment.incubateeCompany.toLowerCase().includes(q)
            )
        })
    }, [searchQuery, courseScopedEnrollments])

    const getStatusTagProps = (status: string) => {
        switch (status) {
            case 'active':
                return { color: 'blue', children: 'Active' }
            case 'completed':
                return { color: 'green', children: 'Completed' }
            case 'dropped':
                return { color: 'red', children: 'Dropped' }
            default:
                return { color: 'default', children: status }
        }
    }

    // ✅ Metrics must also respect the current course filter
    const activeCount = useMemo(
        () => courseScopedEnrollments.filter(e => e.status === 'active').length,
        [courseScopedEnrollments]
    )
    const completedCount = useMemo(
        () => courseScopedEnrollments.filter(e => e.status === 'completed').length,
        [courseScopedEnrollments]
    )
    const avgProgress = useMemo(() => {
        if (courseScopedEnrollments.length === 0) return 0
        const sum = courseScopedEnrollments.reduce((acc, e) => acc + (e.progress || 0), 0)
        return Math.round(sum / courseScopedEnrollments.length)
    }, [courseScopedEnrollments])

    const handleEnrollSubmit = async () => {
        try {
            const values = await form.validateFields()
            const final = courseId ? { ...values, courseId } : values
            console.log('Enroll student (mock): ', final)
            message.success('Student enrolled (mock only)')
            form.resetFields()
            if (courseId) form.setFieldsValue({ courseId })
            setIsEnrollOpen(false)
        } catch {
            // validation errors handled by Form
        }
    }

    const handleMassEnrollSubmit = async () => {
        try {
            const values = await massForm.validateFields()
            const finalCourseId = courseId ?? values.courseId

            const course = mockCourses.find(c => String(c.id) === String(finalCourseId))
            const activeStudents = mockIncubatees.filter(i => i.status === 'active')

            console.log('Mass enroll (mock): ', {
                courseId: finalCourseId,
                courseTitle: (course as any)?.title,
                students: activeStudents.map(s => s.id)
            })

            message.success(
                `Enrolled ${activeStudents.length} active students into ${(course as any)?.title} (mock).`
            )
            massForm.resetFields()
            if (courseId) massForm.setFieldsValue({ courseId })
            setIsMassEnrollOpen(false)
        } catch {
            // validation errors handled
        }
    }

    const handleMassUnenroll = () => {
        if (selectedRowKeys.length === 0) {
            message.warning('Select at least one enrollment to unenroll.')
            return
        }

        console.log('Mass unenroll (mock): ', selectedRowKeys)
        message.warning(`Unenrolled ${selectedRowKeys.length} enrollment(s) (mock only).`)
        setSelectedRowKeys([])
    }

    const rowSelection: TableRowSelection<Enrollment> = {
        selectedRowKeys,
        onChange: keys => setSelectedRowKeys(keys)
    }

    const columns: ColumnsType<Enrollment> = [
        {
            title: 'Student',
            dataIndex: 'incubateeName',
            key: 'student',
            render: (_, enrollment) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{enrollment.incubateeName}</div>
                    <Text type='secondary' style={{ fontSize: 12 }}>
                        {enrollment.incubateeCompany}
                    </Text>
                </div>
            )
        },
        // ✅ If you're viewing a single course, this column is redundant. Hide it.
        ...(courseId
            ? []
            : ([
                {
                    title: 'Course',
                    dataIndex: 'courseName',
                    key: 'courseName',
                    render: value => <span style={{ fontWeight: 500 }}>{value}</span>
                }
            ] as ColumnsType<Enrollment>)),
        {
            title: 'Enrolled',
            dataIndex: 'enrolledDate',
            key: 'enrolledDate',
            render: (value: string) => <Text type='secondary'>{new Date(value).toLocaleDateString()}</Text>
        },
        {
            title: 'Progress',
            dataIndex: 'progress',
            key: 'progress',
            render: (value: number) => (
                <Space>
                    <Progress percent={value} size='small' style={{ width: 80 }} showInfo={false} />
                    <Text type='secondary'>{value}%</Text>
                </Space>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => <Tag {...getStatusTagProps(status)} />
        },
        {
            title: 'Last Accessed',
            dataIndex: 'lastAccessed',
            key: 'lastAccessed',
            render: (value?: string) =>
                value ? <Text type='secondary'>{new Date(value).toLocaleDateString()}</Text> : <Text type='secondary'>-</Text>
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right',
            render: (_, enrollment) => (
                <Space>
                    <Tooltip title='Send Reminder'>
                        <Button
                            type='text'
                            icon={<MailOutlined />}
                            onClick={() => message.info(`Reminder (mock) sent to ${enrollment.incubateeName}`)}
                        />
                    </Tooltip>

                    <Tooltip title='View Progress'>
                        <Button
                            type='text'
                            icon={<BarChartOutlined />}
                            onClick={() => message.info(`Viewing progress (mock) for ${enrollment.incubateeName}`)}
                        />
                    </Tooltip>

                    <Tooltip title='Unenroll'>
                        <Popconfirm
                            title='Unenroll student?'
                            okText='Yes'
                            cancelText='No'
                            onConfirm={() =>
                                message.warning(`Unenroll (mock) for ${enrollment.incubateeName} from ${enrollment.courseName}`)
                            }
                        >
                            <Button type='text' danger icon={<UserDeleteOutlined />} />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            )
        }
    ]

    return (
        <div style={{ padding: 24 }}>
            {/* Header */}
            <DashboardHeaderCard
                title={courseId ? `Enrollments • ${(activeCourse as any)?.title || 'Selected Course'}` : 'Enrollments'}
                subtitle={courseId ? 'Showing enrollments for the selected course only' : 'Manage student course enrollments'}
                extraRight={
                    <Space>
                        {courseId && (
                            <Button
                                icon={<ArrowLeftOutlined />}
                                onClick={() => navigate('/lms/operations/courses')}
                            >
                                Back to Courses
                            </Button>
                        )}
                    </Space>
                }
            />

            {/* If courseId missing, warn that page is in "All Courses" mode */}
            {!courseId && (
                <Alert
                    style={{ marginBottom: 16 }}
                    type='info'
                    showIcon
                    message='Tip'
                    description='Open this page from Courses → “View Enrollments” to auto-filter by course.'
                />
            )}

            {/* Metrics */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={8}>
                    <MotionCard>
                        <Space align='center'>
                            <div
                                style={{
                                    height: 40,
                                    width: 40,
                                    borderRadius: '50%',
                                    background: 'rgba(24,144,255,0.12)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <LineChartOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 600 }}>{activeCount}</div>
                                <Text type='secondary'>Active Enrollments</Text>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>

                <Col xs={24} md={8}>
                    <MotionCard>
                        <Space align='center'>
                            <div
                                style={{
                                    height: 40,
                                    width: 40,
                                    borderRadius: '50%',
                                    background: 'rgba(82,196,26,0.12)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <LineChartOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 600 }}>{completedCount}</div>
                                <Text type='secondary'>Completed</Text>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>

                <Col xs={24} md={8}>
                    <MotionCard>
                        <Space align='center'>
                            <div
                                style={{
                                    height: 40,
                                    width: 40,
                                    borderRadius: '50%',
                                    background: 'rgba(250,173,20,0.12)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <LineChartOutlined style={{ fontSize: 20, color: '#faad14' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 600 }}>{avgProgress}%</div>
                                <Text type='secondary'>Avg Progress</Text>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>
            </Row>

            {/* Search + Bulk Actions */}
            <MotionCard style={{ marginBottom: 16, padding: 4 }}>
                <Row gutter={[16, 16]} align='middle' justify='space-between' style={{ width: '100%' }}>
                    <Col xs={24} sm={12} md={8}>
                        <Input
                            placeholder='Search enrollments...'
                            prefix={<SearchOutlined />}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            allowClear
                            style={{ width: '100%' }}
                        />
                    </Col>

                    <Col
                        xs={24}
                        sm={12}
                        md={16}
                        style={{
                            textAlign: 'right',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 12,
                            justifyContent: 'flex-end'
                        }}
                    >
                        <Button onClick={() => setIsMassEnrollOpen(true)}>Enroll All in Course</Button>

                        <Button danger disabled={selectedRowKeys.length === 0} onClick={handleMassUnenroll}>
                            Unenroll Selected
                        </Button>

                        <Button type='primary' icon={<UserAddOutlined />} onClick={() => setIsEnrollOpen(true)}>
                            Enroll Student
                        </Button>
                    </Col>
                </Row>
            </MotionCard>

            {/* Table */}
            <Table<Enrollment>
                columns={columns}
                dataSource={filteredEnrollments}
                rowKey='id'
                pagination={{ pageSize: 10 }}
                rowSelection={rowSelection}
            />

            {/* Enroll Single Modal */}
            <Modal
                title={courseId ? 'Enroll Student in This Course' : 'Enroll Student in Course'}
                open={isEnrollOpen}
                onCancel={() => setIsEnrollOpen(false)}
                onOk={handleEnrollSubmit}
                okText='Enroll Student'
                destroyOnClose
            >
                <Form form={form} layout='vertical' name='enroll-student' preserve={false} style={{ marginTop: 12 }}>
                    <Form.Item
                        name='studentId'
                        label='Select Student'
                        rules={[{ required: true, message: 'Please choose a student' }]}
                    >
                        <Select placeholder='Choose a student' showSearch optionFilterProp='label'>
                            {mockIncubatees
                                .filter(i => i.status === 'active')
                                .map(incubatee => (
                                    <Option
                                        key={incubatee.id}
                                        value={incubatee.id}
                                        label={`${incubatee.name} - ${incubatee.company}`}
                                    >
                                        {incubatee.name} - {incubatee.company}
                                    </Option>
                                ))}
                        </Select>
                    </Form.Item>

                    {/* ✅ If we arrived from a course, lock course selection */}
                    <Form.Item
                        name='courseId'
                        label='Select Course'
                        rules={[{ required: true, message: 'Please choose a course' }]}
                    >
                        <Select
                            placeholder='Choose a course'
                            showSearch
                            optionFilterProp='label'
                            disabled={!!courseId}
                        >
                            {mockCourses
                                .filter(c => c.status === 'published')
                                .map(course => (
                                    <Option key={course.id} value={course.id} label={(course as any).title}>
                                        {(course as any).title}
                                    </Option>
                                ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Mass Enroll Modal */}
            <Modal
                title={courseId ? 'Enroll All Students in This Course' : 'Enroll All Students in Course'}
                open={isMassEnrollOpen}
                onCancel={() => setIsMassEnrollOpen(false)}
                onOk={handleMassEnrollSubmit}
                okText='Enroll All'
                destroyOnClose
            >
                <Text type='secondary'>
                    This will enroll all active students under the current program (mocked as all active incubatees) into the selected course.
                </Text>

                <Form form={massForm} layout='vertical' name='mass-enroll' preserve={false} style={{ marginTop: 16 }}>
                    <Form.Item
                        name='courseId'
                        label='Select Course'
                        rules={[{ required: true, message: 'Please choose a course' }]}
                    >
                        <Select
                            placeholder='Choose a course'
                            showSearch
                            optionFilterProp='label'
                            disabled={!!courseId}
                        >
                            {mockCourses
                                .filter(c => c.status === 'published')
                                .map(course => (
                                    <Option key={course.id} value={course.id} label={(course as any).title}>
                                        {(course as any).title}
                                    </Option>
                                ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
