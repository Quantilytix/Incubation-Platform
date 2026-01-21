// src/pages/lms/operations/CourseAnalytics.tsx
import React, { useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
    Card,
    Col,
    Row,
    Typography,
    Button,
    Space,
    Statistic,
    List,
    Rate,
    Tag,
    Divider,
    Empty
} from 'antd'
import {
    ArrowLeftOutlined,
    StarFilled,
    RiseOutlined,
    TeamOutlined,
    BookOutlined
} from '@ant-design/icons'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { MotionCard } from '@/components/shared/Header'

// If you already have DashboardHeaderCard in your project, use it.
// Otherwise you can remove it and keep the top Card header.
import { DashboardHeaderCard } from '@/components/shared/Header'

type Review = {
    id: string
    studentName: string
    rating: number
    comment: string
    date: string
    courseName: string
}

const mockReviews: Review[] = [
    {
        id: '1',
        studentName: 'Alice Johnson',
        rating: 5,
        comment:
            'Excellent course! Very well structured and easy to follow. The instructor explains concepts clearly.',
        date: '2025-01-10',
        courseName: 'Introduction to React'
    },
    {
        id: '2',
        studentName: 'Bob Smith',
        rating: 4,
        comment:
            'Great content but could use more practical examples. Overall very helpful.',
        date: '2025-01-08',
        courseName: 'Introduction to React'
    },
    {
        id: '3',
        studentName: 'Carol Davis',
        rating: 5,
        comment:
            "Best React course I've taken! Highly recommend to anyone starting with React.",
        date: '2025-01-05',
        courseName: 'Introduction to React'
    }
]

const commonDataLabel = {
    enabled: true,
    formatter: function (this: Highcharts.DataLabelsFormatterContextObject) {
        const y = typeof this.y === 'number' ? this.y : (this.point as any)?.y
        return y && y > 0 ? String(Math.round(y)) : ''
    }
}

const pieDataLabels: Highcharts.PlotPieDataLabelsOptions = {
    enabled: true,
    distance: 18,
    style: { textOutline: 'none', fontWeight: '600' },
    formatter: function () {
        const p = this.point as Highcharts.Point & { y: number }
        return p && p.y > 0 ? `${p.name}: ${Math.round(p.y)}` : null
    }
}

const CourseAnalytics: React.FC = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { courseId: courseIdParam } = useParams()

    // Supports both:
    // 1) /lms/operations/courses/:courseId?tab=analytics
    // 2) /lms/operations/courses/:courseId/analytics
    // 3) /lms/operations/course-analytics?courseId=...
    const courseId = useMemo(() => {
        const sp = new URLSearchParams(location.search)
        return courseIdParam || sp.get('courseId') || ''
    }, [courseIdParam, location.search])

    // ---- MOCK numbers (replace with real Firestore later) ----
    const totalStudents = 120
    const completionRate = 65
    const totalReviews = 100
    const averageRating = 4.5

    const enrollmentOptions: Highcharts.Options = {
        chart: { type: 'line', backgroundColor: 'transparent' },
        title: { text: 'Enrollment Trend' },
        xAxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
        yAxis: {
            min: 0,
            title: { text: 'Students' }
        },
        plotOptions: { series: { dataLabels: commonDataLabel } },
        tooltip: { pointFormat: '<b>{point.y}</b>' },
        series: [
            { name: 'Enrollments', type: 'line', data: [10, 25, 45, 70, 95, 120] }
        ],
        credits: { enabled: false }
    }

    const completionOptions: Highcharts.Options = {
        chart: { type: 'pie', backgroundColor: 'transparent' },
        title: { text: 'Course Completion' },
        tooltip: { pointFormat: '<b>{point.y}</b>' },
        plotOptions: {
            pie: { innerSize: '55%', dataLabels: pieDataLabels, showInLegend: true }
        },
        legend: {
            labelFormatter: function () {
                // @ts-ignore
                return `${this.name} (${Math.round(this.y)})`
            }
        },
        series: [
            {
                name: 'Students',
                type: 'pie',
                data: [
                    { name: 'Completed', y: 65 },
                    { name: 'In Progress', y: 25 },
                    { name: 'Not Started', y: 10 }
                ]
            }
        ],
        credits: { enabled: false }
    }

    const ratingDistributionOptions: Highcharts.Options = {
        chart: { type: 'column', backgroundColor: 'transparent' },
        title: { text: 'Rating Distribution' },
        xAxis: { categories: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'] },
        yAxis: { min: 0, title: { text: 'Count' } },
        plotOptions: { series: { dataLabels: commonDataLabel } },
        tooltip: { pointFormat: '<b>{point.y}</b>' },
        series: [
            { name: 'Reviews', type: 'column', data: [2, 5, 15, 30, 48] }
        ],
        credits: { enabled: false }
    }

    const headerTitle = 'Course Analytics'
    const headerSubtitle = 'Performance & Reviews'

    return (
        <div style={{ padding: 16 }}>
            <DashboardHeaderCard
                title={headerTitle}
                subtitle={headerSubtitle}
                extraRight={
                    <Space>
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={() => navigate('/lms/operations/courses')}
                        >
                            Back to Courses
                        </Button>
                    </Space>
                }
            />

            {/* Stats */}
            <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
                <Col xs={24} sm={12} md={6}>
                    <MotionCard>
                        <Statistic title='Total Students' value={totalStudents} prefix={<TeamOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <MotionCard>
                        <Statistic
                            title='Avg. Rating'
                            value={averageRating}
                            precision={1}
                            prefix={<StarFilled />}
                            suffix={<Tag style={{ marginLeft: 8 }}>{totalReviews} reviews</Tag>}
                        />
                    </MotionCard>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <MotionCard>
                        <Statistic title='Completion Rate' value={completionRate} suffix='%' prefix={<RiseOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <MotionCard>
                        <Statistic title='Total Reviews' value={totalReviews} prefix={<BookOutlined />} />
                    </MotionCard>
                </Col>
            </Row>

            {/* Charts */}
            <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
                <Col xs={24} lg={12}>
                    <MotionCard>
                        <HighchartsReact highcharts={Highcharts} options={enrollmentOptions} />
                    </MotionCard>
                </Col>
                <Col xs={24} lg={12}>
                    <MotionCard>
                        <HighchartsReact highcharts={Highcharts} options={completionOptions} />
                    </MotionCard>
                </Col>
                <Col xs={24}>
                    <MotionCard>
                        <HighchartsReact highcharts={Highcharts} options={ratingDistributionOptions} />
                    </MotionCard>
                </Col>
            </Row>

            {/* Reviews */}
            <MotionCard style={{ marginTop: 12 }} title='Recent Reviews'>
                {mockReviews.length === 0 ? (
                    <Empty description='No reviews yet.' />
                ) : (
                    <List
                        itemLayout='vertical'
                        dataSource={mockReviews}
                        renderItem={review => (
                            <Card style={{ borderRadius: 12, marginBottom: 12 }}>
                                <Row gutter={[12, 12]} align='top'>
                                    <Col xs={24} md={16}>
                                        <Space direction='vertical' size={2} style={{ width: '100%' }}>
                                            <Space wrap>
                                                <Typography.Text strong>{review.studentName}</Typography.Text>
                                                <Tag color='blue'>{review.courseName}</Tag>
                                            </Space>
                                            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                                                {review.date}
                                            </Typography.Text>
                                        </Space>

                                        <Divider style={{ margin: '10px 0' }} />

                                        <Typography.Text type='secondary'>{review.comment}</Typography.Text>
                                    </Col>

                                    <Col xs={24} md={8} style={{ textAlign: 'right' }}>
                                        <Space direction='vertical' size={6} style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <Rate disabled value={review.rating} />
                                            </div>
                                            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                                                Rating: {review.rating}/5
                                            </Typography.Text>
                                        </Space>
                                    </Col>
                                </Row>
                            </Card>
                        )}
                    />
                )}
            </MotionCard>

            {/* Optional: show courseId for debugging */}
            {!courseId ? null : (
                <Typography.Text type='secondary' style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                    Course ID: {courseId}
                </Typography.Text>
            )}
        </div>
    )
}

export default CourseAnalytics
