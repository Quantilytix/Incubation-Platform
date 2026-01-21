import React, { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
    Row,
    Col,
    Typography,
    Card,
    Input,
    Table,
    Tag,
    Button,
    Modal,
    Form,
    InputNumber,
    Space,
    Alert
} from 'antd'
import {
    SearchOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    FileTextOutlined,
    MessageOutlined,
    ArrowLeftOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { mockSubmissions, mockCourses } from '@/data/lmsMockData'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'

const { Text } = Typography
const { TextArea } = Input

type Submission = (typeof mockSubmissions)[number]

export const OperationsGrades: React.FC = () => {
    const location = useLocation()
    const navigate = useNavigate()

    const [searchQuery, setSearchQuery] = useState('')
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
    const [isGradeOpen, setIsGradeOpen] = useState(false)
    const [form] = Form.useForm()

    // ✅ Read courseId from URL: /lms/operations/grades?courseId=XYZ
    const courseId = useMemo(() => {
        const sp = new URLSearchParams(location.search)
        const id = sp.get('courseId')
        return id ? String(id) : null
    }, [location.search])

    const activeCourse = useMemo(() => {
        if (!courseId) return null
        return mockCourses.find(c => String((c as any).id) === String(courseId)) ?? null
    }, [courseId])

    // ✅ Scope submissions to selected course when courseId exists
    const courseScopedSubmissions = useMemo(() => {
        if (!courseId) return mockSubmissions

        return mockSubmissions.filter(s => {
            const sCourseId = (s as any)?.courseId ? String((s as any).courseId) : null
            if (sCourseId) return sCourseId === String(courseId)

            // Fallback if mocks don’t include courseId:
            const courseTitle = String((activeCourse as any)?.title || '')
            return courseTitle ? String(s.courseName) === courseTitle : false
        })
    }, [courseId, activeCourse])

    const filteredSubmissions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        const base = courseScopedSubmissions
        if (!q) return base

        return base.filter(submission => {
            return (
                submission.incubateeName.toLowerCase().includes(q) ||
                submission.courseName.toLowerCase().includes(q) ||
                submission.assignmentTitle.toLowerCase().includes(q)
            )
        })
    }, [searchQuery, courseScopedSubmissions])

    // ✅ Metrics must respect scope
    const pendingCount = useMemo(
        () => courseScopedSubmissions.filter(s => s.status === 'pending').length,
        [courseScopedSubmissions]
    )
    const gradedCount = useMemo(
        () => courseScopedSubmissions.filter(s => s.status === 'graded').length,
        [courseScopedSubmissions]
    )
    const totalCount = useMemo(() => courseScopedSubmissions.length, [courseScopedSubmissions])

    const getStatusTagProps = (status: string) => {
        switch (status) {
            case 'pending':
                return { color: 'gold', children: 'Pending' }
            case 'graded':
                return { color: 'green', children: 'Graded' }
            case 'returned':
                return { color: 'blue', children: 'Returned' }
            default:
                return { color: 'default', children: status }
        }
    }

    const handleOpenGrade = (submission: Submission) => {
        setSelectedSubmission(submission)
        setIsGradeOpen(true)

        form.setFieldsValue({
            score: submission.score,
            feedback: submission.feedback
        })
    }

    const handleGradeSubmit = async () => {
        if (!selectedSubmission) return
        try {
            const values = await form.validateFields()
            console.log('Submit grade (mock):', {
                submissionId: selectedSubmission.id,
                ...values
            })
            // TODO: integrate with backend/Firestore
            setIsGradeOpen(false)
        } catch {
            // validation handled by Form
        }
    }

    const columns: ColumnsType<Submission> = [
        {
            title: 'Student',
            dataIndex: 'incubateeName',
            key: 'student',
            render: value => <span style={{ fontWeight: 500 }}>{value}</span>
        },
        {
            title: 'Assignment',
            dataIndex: 'assignmentTitle',
            key: 'assignmentTitle',
            render: value => <span style={{ fontWeight: 500 }}>{value}</span>
        },

        // ✅ Hide Course column when page is course-scoped
        ...(courseId
            ? []
            : ([
                {
                    title: 'Course',
                    dataIndex: 'courseName',
                    key: 'courseName',
                    render: value => <Text type='secondary'>{value}</Text>
                }
            ] as ColumnsType<Submission>)),

        {
            title: 'Submitted',
            dataIndex: 'submittedDate',
            key: 'submittedDate',
            render: value => <Text type='secondary'>{new Date(value).toLocaleDateString()}</Text>
        },
        {
            title: 'Score',
            dataIndex: 'score',
            key: 'score',
            render: (_, submission) =>
                submission.score !== undefined ? (
                    <span style={{ fontWeight: 500 }}>
                        {submission.score}/{submission.maxScore}
                    </span>
                ) : (
                    <Text type='secondary'>-</Text>
                )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => <Tag {...getStatusTagProps(status)} />
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right',
            render: (_, submission) => (
                <Button
                    type={submission.status === 'pending' ? 'primary' : 'default'}
                    size='small'
                    onClick={() => handleOpenGrade(submission)}
                >
                    {submission.status === 'pending' ? 'Grade' : 'View'}
                </Button>
            )
        }
    ]

    const isReadOnly = selectedSubmission?.status === 'graded'

    return (
        <div style={{ padding: 24 }}>
            {/* Header */}
            <DashboardHeaderCard
                title={courseId ? `Assignment Grading • ${(activeCourse as any)?.title || 'Selected Course'}` : 'Assignment Grading'}
                subtitle={courseId ? 'Showing submissions for the selected course only' : 'Review and grade student submissions'}
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

            {!courseId && (
                <Alert
                    style={{ marginBottom: 16 }}
                    type='info'
                    showIcon
                    message='Tip'
                    description='Open Grades from Courses → “Grades” to auto-filter by course.'
                />
            )}

            {/* Metrics */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={8}>
                    <MotionCard>
                        <Space>
                            <div
                                style={{
                                    height: 40,
                                    width: 40,
                                    borderRadius: '50%',
                                    background: 'rgba(250,173,20,0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <ClockCircleOutlined style={{ fontSize: 20, color: '#faad14' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 600 }}>{pendingCount}</div>
                                <Text type='secondary'>Pending Review</Text>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>

                <Col xs={24} md={8}>
                    <MotionCard>
                        <Space>
                            <div
                                style={{
                                    height: 40,
                                    width: 40,
                                    borderRadius: '50%',
                                    background: 'rgba(82,196,26,0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 600 }}>{gradedCount}</div>
                                <Text type='secondary'>Graded</Text>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>

                <Col xs={24} md={8}>
                    <MotionCard>
                        <Space>
                            <div
                                style={{
                                    height: 40,
                                    width: 40,
                                    borderRadius: '50%',
                                    background: 'rgba(24,144,255,0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <FileTextOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 600 }}>{totalCount}</div>
                                <Text type='secondary'>Total Submissions</Text>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>
            </Row>

            {/* Search */}
            <Row style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8}>
                    <Input
                        placeholder='Search submissions...'
                        prefix={<SearchOutlined />}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        allowClear
                    />
                </Col>
            </Row>

            {/* Table */}
            <MotionCard>
                <Table<Submission>
                    columns={columns}
                    dataSource={filteredSubmissions}
                    rowKey='id'
                    pagination={{ pageSize: 10 }}
                />
            </MotionCard>

            {/* Grade / View Modal */}
            <Modal
                title={selectedSubmission?.status === 'pending' ? 'Grade Submission' : 'View Submission'}
                open={isGradeOpen}
                onCancel={() => setIsGradeOpen(false)}
                onOk={!isReadOnly ? handleGradeSubmit : undefined}
                okButtonProps={{ hidden: !!isReadOnly }}
                destroyOnClose
            >
                {selectedSubmission && (
                    <div style={{ marginTop: 8 }}>
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                            <Col span={12}>
                                <Text type='secondary'>Student</Text>
                                <div style={{ fontWeight: 500 }}>{selectedSubmission.incubateeName}</div>
                            </Col>
                            <Col span={12}>
                                <Text type='secondary'>Submitted</Text>
                                <div style={{ fontWeight: 500 }}>
                                    {new Date(selectedSubmission.submittedDate).toLocaleDateString()}
                                </div>
                            </Col>
                        </Row>

                        <div style={{ marginBottom: 16 }}>
                            <Text type='secondary'>Assignment</Text>
                            <div style={{ fontWeight: 500 }}>{selectedSubmission.assignmentTitle}</div>
                            <Text type='secondary'>{selectedSubmission.courseName}</Text>
                        </div>

                        <Card size='small' style={{ marginBottom: 16, background: '#fafafa' }} bordered>
                            <Text type='secondary'>Submission Preview</Text>
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FileTextOutlined />
                                <Text type='secondary'>submission_file.pdf</Text>
                            </div>
                        </Card>

                        <Form layout='vertical' form={form} preserve={false} disabled={isReadOnly}>
                            <Form.Item
                                name='score'
                                label={`Score (out of ${selectedSubmission.maxScore})`}
                                rules={[
                                    { required: true, message: 'Please enter a score' },
                                    {
                                        type: 'number',
                                        min: 0,
                                        max: selectedSubmission.maxScore,
                                        message: `Score must be between 0 and ${selectedSubmission.maxScore}`
                                    }
                                ]}
                            >
                                <InputNumber style={{ width: '100%' }} max={selectedSubmission.maxScore} />
                            </Form.Item>

                            <Form.Item
                                name='feedback'
                                label={
                                    <>
                                        <MessageOutlined style={{ marginRight: 4 }} />
                                        Feedback
                                    </>
                                }
                            >
                                <TextArea rows={4} placeholder='Provide feedback to the student...' />
                            </Form.Item>
                        </Form>
                    </div>
                )}
            </Modal>
        </div>
    )
}
