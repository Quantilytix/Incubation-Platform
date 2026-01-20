// src/pages/FeedbackWorkspace.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    Card,
    Typography,
    message,
    Spin,
    Row,
    Col,
    Statistic,
    Modal,
    Button,
    List,
    Space,
    Input,
    Select,
    Tag,
    Segmented,
    Slider,
    DatePicker,
    Tooltip,
    Empty,
    Divider,
    Rate,
    Badge
} from 'antd'
import {
    BarChartOutlined,
    PieChartOutlined,
    StarOutlined,
    FullscreenOutlined,
    ReloadOutlined,
    DownloadOutlined,
    SearchOutlined,
    ExclamationCircleOutlined,
    MessageOutlined
} from '@ant-design/icons'
import {
    collection,
    getDocs,
    query,
    where,
    onSnapshot
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { Helmet } from 'react-helmet'
import { onAuthStateChanged } from 'firebase/auth'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import dayjs, { Dayjs } from 'dayjs'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'

const { Title, Paragraph, Text } = Typography
const { RangePicker } = DatePicker

interface Feedback {
    id: string
    sme: string
    interventionTitle: string
    comment: string
    rating?: number
    createdAt?: Date | null
    participantId?: string
    interventionId?: string
}

type SortMode = 'newest' | 'oldest' | 'lowest_rating' | 'highest_rating'

/** ---------- Time helper ---------- */
const toJsDate = (v: any): Date | null => {
    if (!v) return null
    if (typeof v?.toDate === 'function') return v.toDate()
    if (typeof v === 'string') {
        const d = new Date(v)
        if (!Number.isNaN(d.getTime())) return d
        const dj = (dayjs as any)(v)
        return dj?.isValid?.() ? dj.toDate() : null
    }
    if (typeof v === 'number') return new Date(v)
    if (v?.seconds != null) return new Date(v.seconds * 1000)
    return null
}

/** ---------- CSV export ---------- */
const downloadCsv = (filename: string, rows: Record<string, any>[]) => {
    if (!rows.length) {
        message.info('Nothing to export.')
        return
    }

    const headers = Object.keys(rows[0])
    const esc = (val: any) => {
        const s = String(val ?? '')
        // CSV escaping
        if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
        return s
    }

    const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => esc(r[h])).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

/** ---------- Chart helpers ---------- */
const baseChart: Partial<Highcharts.Options> = {
    credits: { enabled: false },
    chart: { backgroundColor: 'transparent' }
}

export const FeedbackWorkspace: React.FC = () => {
    const [consultantId, setConsultantId] = useState<string | null>(null)

    // data
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
    const [loading, setLoading] = useState(true)

    // filters
    const [search, setSearch] = useState('')
    const [selectedSme, setSelectedSme] = useState<string | null>(null)
    const [minRating, setMinRating] = useState<number>(0)
    const [datePreset, setDatePreset] = useState<'all' | '7d' | '30d' | '90d' | 'custom'>('30d')
    const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([
        dayjs().subtract(30, 'day').startOf('day'),
        dayjs().endOf('day')
    ])
    const [sortMode, setSortMode] = useState<SortMode>('newest')

    // modals
    const [expandedChart, setExpandedChart] = useState<'pie' | 'bar' | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)
    const [detailItem, setDetailItem] = useState<Feedback | null>(null)

    // live subscription
    const unsubRef = useRef<null | (() => void)>(null)

    /** ---------- identify consultant ---------- */
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async user => {
            if (!user?.email) return
            try {
                const consultantSnap = await getDocs(
                    query(collection(db, 'consultants'), where('email', '==', user.email))
                )
                if (consultantSnap.empty) {
                    message.error('Consultant not found.')
                    setLoading(false)
                    return
                }
                // Source of truth: doc.id
                setConsultantId(consultantSnap.docs[0].id)
            } catch (e) {
                console.error(e)
                message.error('Failed to identify consultant.')
                setLoading(false)
            }
        })
        return () => unsubscribe()
    }, [])

    /** ---------- fetch + subscribe (assignedInterventions is source of truth) ---------- */
    const loadFeedback = async (mode: 'snapshot' | 'refresh' = 'snapshot') => {
        if (!consultantId) return
        setLoading(true)

        try {
            const q = query(
                collection(db, 'assignedInterventions'),
                where('consultantId', '==', consultantId),
                where('status', '==', 'completed')
            )

            if (mode === 'snapshot') {
                // live updates
                if (unsubRef.current) unsubRef.current()
                unsubRef.current = onSnapshot(
                    q,
                    snap => {
                        const data: Feedback[] = snap.docs
                            .map(docSnap => {
                                const d = docSnap.data() as any
                                if (!d?.feedback?.comments) return null

                                const created =
                                    toJsDate(d.feedback?.createdAt) ||
                                    toJsDate(d.completedAt) ||
                                    toJsDate(d.updatedAt) ||
                                    toJsDate(d.createdAt) ||
                                    null

                                return {
                                    id: docSnap.id,
                                    sme: d.beneficiaryName || 'Unknown SME',
                                    interventionTitle: d.interventionTitle || 'Untitled',
                                    comment: d.feedback.comments,
                                    rating: typeof d.feedback.rating === 'number' ? d.feedback.rating : undefined,
                                    createdAt: created,
                                    participantId: d.participantId,
                                    interventionId: d.interventionId
                                } as Feedback
                            })
                            .filter(Boolean) as Feedback[]

                        setFeedbacks(data)
                        setLoading(false)
                    },
                    err => {
                        console.error(err)
                        message.error('Failed to load feedback (live).')
                        setLoading(false)
                    }
                )
            } else {
                // manual refresh via getDocs
                const snap = await getDocs(q)
                const data: Feedback[] = snap.docs
                    .map(docSnap => {
                        const d = docSnap.data() as any
                        if (!d?.feedback?.comments) return null

                        const created =
                            toJsDate(d.feedback?.createdAt) ||
                            toJsDate(d.completedAt) ||
                            toJsDate(d.updatedAt) ||
                            toJsDate(d.createdAt) ||
                            null

                        return {
                            id: docSnap.id,
                            sme: d.beneficiaryName || 'Unknown SME',
                            interventionTitle: d.interventionTitle || 'Untitled',
                            comment: d.feedback.comments,
                            rating: typeof d.feedback.rating === 'number' ? d.feedback.rating : undefined,
                            createdAt: created,
                            participantId: d.participantId,
                            interventionId: d.interventionId
                        } as Feedback
                    })
                    .filter(Boolean) as Feedback[]

                setFeedbacks(data)
                setLoading(false)
            }
        } catch (e) {
            console.error(e)
            message.error('Failed to load feedback.')
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!consultantId) return
        loadFeedback('snapshot')
        return () => {
            if (unsubRef.current) unsubRef.current()
            unsubRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [consultantId])

    /** ---------- date range behavior ---------- */
    useEffect(() => {
        if (datePreset === 'all') {
            setDateRange([null, null])
            return
        }
        if (datePreset === 'custom') return
        const days = datePreset === '7d' ? 7 : datePreset === '30d' ? 30 : 90
        setDateRange([dayjs().subtract(days, 'day').startOf('day'), dayjs().endOf('day')])
    }, [datePreset])

    /** ---------- derived data ---------- */
    const smeOptions = useMemo(() => {
        const set = new Set<string>()
        feedbacks.forEach(f => set.add(f.sme || 'Unknown SME'))
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [feedbacks])

    const filteredFeedbacks = useMemo(() => {
        const q = search.trim().toLowerCase()

        const [from, to] = dateRange
        const hasDateFilter = !!from && !!to
        const fromMs = from ? from.valueOf() : null
        const toMs = to ? to.endOf('day').valueOf() : null

        let list = [...feedbacks]

        if (selectedSme) {
            list = list.filter(f => f.sme === selectedSme)
        }

        if (minRating > 0) {
            list = list.filter(f => (typeof f.rating === 'number' ? f.rating >= minRating : false))
        }

        if (hasDateFilter) {
            // If createdAt missing, exclude when date filtering is active (prevents misleading “recent” views)
            list = list.filter(f => {
                if (!f.createdAt || fromMs == null || toMs == null) return false
                const t = f.createdAt.getTime()
                return t >= fromMs && t <= toMs
            })
        }

        if (q) {
            list = list.filter(f => {
                const title = (f.interventionTitle || '').toLowerCase()
                const sme = (f.sme || '').toLowerCase()
                const comment = (f.comment || '').toLowerCase()
                return title.includes(q) || sme.includes(q) || comment.includes(q)
            })
        }

        list.sort((a, b) => {
            const aT = a.createdAt?.getTime() ?? 0
            const bT = b.createdAt?.getTime() ?? 0
            const aR = typeof a.rating === 'number' ? a.rating : null
            const bR = typeof b.rating === 'number' ? b.rating : null

            switch (sortMode) {
                case 'oldest':
                    return aT - bT
                case 'lowest_rating':
                    // unrated go last
                    if (aR == null && bR == null) return bT - aT
                    if (aR == null) return 1
                    if (bR == null) return -1
                    return aR - bR
                case 'highest_rating':
                    if (aR == null && bR == null) return bT - aT
                    if (aR == null) return 1
                    if (bR == null) return -1
                    return bR - aR
                case 'newest':
                default:
                    return bT - aT
            }
        })

        return list
    }, [feedbacks, selectedSme, minRating, dateRange, search, sortMode])

    const ratedFeedbacks = filteredFeedbacks

    const totalFeedbacks = filteredFeedbacks.length
    const ratedCount = ratedFeedbacks.length
    const ratedPercent = totalFeedbacks ? Math.round((ratedCount / totalFeedbacks) * 100) : 0
    const lowRatingsCount = useMemo(
        () => ratedFeedbacks.filter(f => (f.rating ?? 0) <= 2).length,
        [ratedFeedbacks]
    )

    const averageRating = useMemo(() => {
        if (!ratedCount) return 0
        const sum = ratedFeedbacks.reduce((acc, f) => acc + (f.rating ?? 0), 0)
        return sum / ratedCount
    }, [ratedFeedbacks, ratedCount])

    const feedbacksBySME = useMemo(() => {
        return filteredFeedbacks.reduce((acc, curr) => {
            const key = curr.sme || 'Unknown SME'
            acc[key] = (acc[key] || 0) + 1
            return acc
        }, {} as Record<string, number>)
    }, [filteredFeedbacks])

    const avgRatingsBySME = useMemo(() => {
        const ratingsBySME = ratedFeedbacks.reduce((acc, f) => {
            const key = f.sme || 'Unknown SME'
            if (!acc[key]) acc[key] = { total: 0, count: 0 }
            acc[key].total += f.rating!
            acc[key].count += 1
            return acc
        }, {} as Record<string, { total: number; count: number }>)

        return Object.entries(ratingsBySME)
            .map(([sme, val]) => ({
                name: sme,
                y: parseFloat((val.total / val.count).toFixed(2))
            }))
            .sort((a, b) => b.y - a.y)
    }, [ratedFeedbacks])

    /** ---------- charts ---------- */
    const pieChartOptions: Highcharts.Options = useMemo(() => {
        const data = Object.entries(feedbacksBySME)
            .map(([name, y]) => ({ name, y }))
            .sort((a, b) => (b.y as number) - (a.y as number))

        return {
            ...baseChart,
            chart: { ...(baseChart.chart as any), type: 'pie' },
            title: { text: 'Feedback distribution (by SME)' },
            tooltip: { pointFormat: '<b>{point.y}</b> ({point.percentage:.1f}%)' },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    showInLegend: true,
                    dataLabels: {
                        enabled: true,
                        format: '<b>{point.name}</b>: {point.y} ({point.percentage:.1f}%)',
                        style: { textOutline: 'none' }
                    }
                }
            },
            series: [
                {
                    type: 'pie',
                    name: 'Feedback Count',
                    data
                }
            ]
        }
    }, [feedbacksBySME])

    const barChartOptions: Highcharts.Options = useMemo(() => {
        return {
            ...baseChart,
            chart: { ...(baseChart.chart as any), type: 'column' },
            title: { text: 'Average rating (by SME)' },
            xAxis: {
                type: 'category',
                title: { text: 'SME' },
                labels: { style: { fontSize: '11px' } }
            },
            yAxis: { min: 0, max: 5, title: { text: 'Average Rating' } },
            tooltip: { pointFormat: '<b>{point.y}</b>/5' },
            plotOptions: {
                column: {
                    borderWidth: 0,
                    groupPadding: 0.15,
                    pointPadding: 0.08,
                    dataLabels: { enabled: true, format: '{point.y:.2f}', style: { textOutline: 'none' } }
                }
            },
            series: [
                {
                    name: 'Rating',
                    type: 'column',
                    data: avgRatingsBySME
                }
            ]
        }
    }, [avgRatingsBySME])

    /** ---------- actions ---------- */
    const handleRefresh = async () => {
        await loadFeedback('refresh')
        message.success('Refreshed.')
    }

    const handleExport = () => {
        const rows = filteredFeedbacks.map(f => ({
            SME: f.sme,
            Intervention: f.interventionTitle,
            Rating: typeof f.rating === 'number' ? f.rating : '',
            Comment: f.comment,
            CreatedAt: f.createdAt ? dayjs(f.createdAt).format('YYYY-MM-DD HH:mm') : ''
        }))
        const presetLabel =
            datePreset === 'all' ? 'ALL' : datePreset === 'custom' ? 'CUSTOM' : datePreset.toUpperCase()
        downloadCsv(`feedback_${presetLabel}_${dayjs().format('YYYYMMDD_HHmm')}.csv`, rows)
    }

    const ratingTag = (rating?: number) => {
        if (typeof rating !== 'number') return <Tag>Unrated</Tag>
        if (rating <= 2) return <Tag color="red">Low ({rating}/5)</Tag>
        if (rating === 3) return <Tag color="orange">Average (3/5)</Tag>
        return <Tag color="green">Good ({rating}/5)</Tag>
    }

    const rangeLabel = useMemo(() => {
        if (datePreset === 'all') return 'All time'
        if (datePreset === 'custom') {
            const [f, t] = dateRange
            if (f && t) return `${f.format('DD MMM YYYY')} – ${t.format('DD MMM YYYY')}`
            return 'Custom'
        }
        return datePreset === '7d'
            ? 'Last 7 days'
            : datePreset === '30d'
                ? 'Last 30 days'
                : 'Last 90 days'
    }, [datePreset, dateRange])

    const missingCreatedAtCount = useMemo(() => {
        // only matters when filtering by dates
        return filteredFeedbacks.filter(f => !f.createdAt).length
    }, [filteredFeedbacks])

    return (
        <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
            <Helmet>
                <title>Feedback Workspace | Smart Incubation</title>
            </Helmet>

            <DashboardHeaderCard title='  Feedback Workspace' subtitle={`Insights from completed interventions • ${rangeLabel}`} extraRight={ <Space>
                        <Tooltip title="Refresh">
                            <Button icon={<ReloadOutlined />} onClick={handleRefresh} />
                        </Tooltip>
                        <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!filteredFeedbacks.length}>
                            Export CSV
                        </Button>
                    </Space>} />

            {/* Toolbar */}
            <Card style={{ marginBottom: 16, borderRadius: 12 }}>
                <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} md={8}>
                        <Input
                            prefix={<SearchOutlined />}
                            placeholder="Search SME, intervention, or comment..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            allowClear
                        />
                    </Col>

                    <Col xs={24} md={6}>
                        <Select
                            style={{ width: '100%' }}
                            placeholder="Filter by SME"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            value={selectedSme ?? undefined}
                            onChange={(v: string | undefined) => setSelectedSme(v ?? null)}
                            options={smeOptions.map(s => ({ value: s, label: s }))}
                        />
                    </Col>

                    <Col xs={24} md={5}>
                        <Select
                            style={{ width: '100%' }}
                            value={datePreset}
                            onChange={v => setDatePreset(v)}
                            options={[
                                { value: 'all', label: 'All time' },
                                { value: '7d', label: 'Last 7 days' },
                                { value: '30d', label: 'Last 30 days' },
                                { value: '90d', label: 'Last 90 days' },
                                { value: 'custom', label: 'Custom range' }
                            ]}
                        />
                    </Col>

                    <Col xs={24} md={5}>
                        <RangePicker
                            style={{ width: '100%' }}
                            disabled={datePreset !== 'custom'}
                            value={dateRange}
                            onChange={vals => setDateRange(vals as any)}
                            allowClear
                        />
                    </Col>

                    <Col xs={24} md={12}>
                        <Space wrap>
                            <Space align="center" size={8}>
                                <Text type="secondary">Min rating</Text>
                                <Slider
                                    style={{ width: 180 }}
                                    min={0}
                                    max={5}
                                    step={1}
                                    value={minRating}
                                    onChange={v => setMinRating(v as number)}
                                    marks={{ 0: '0', 3: '3', 5: '5' }}
                                />
                            </Space>

                            <Select
                                style={{ width: 220 }}
                                value={sortMode}
                                onChange={v => setSortMode(v)}
                                options={[
                                    { value: 'newest', label: 'Newest first' },
                                    { value: 'oldest', label: 'Oldest first' },
                                    { value: 'lowest_rating', label: 'Lowest rating first' },
                                    { value: 'highest_rating', label: 'Highest rating first' }
                                ]}
                            />

                        </Space>
                    </Col>

                    <Col xs={24} md={12} style={{ textAlign: 'right' }}>
                        <Space wrap>
                            <Tag>
                                Showing <b>{filteredFeedbacks.length}</b> of <b>{feedbacks.length}</b>
                            </Tag>
                            {/* {datePreset !== 'all' && (
                                <Tag icon={<ExclamationCircleOutlined />} color="gold">
                                    Requires createdAt (missing ones excluded)
                                </Tag>
                            )} */}
                        </Space>
                    </Col>
                </Row>
            </Card>

            {/* Loading state */}
            {!consultantId && loading ? (
                <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin size="large" />
                </div>
            ) : null}

            {/* KPIs */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8}>
                    <MotionCard>
                        <Statistic
                            title="Total Feedbacks"
                            value={totalFeedbacks}
                            prefix={<PieChartOutlined />}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            After filters
                        </Text>
                    </MotionCard>
                </Col>

                <Col xs={24} sm={12} md={8}>
                    <MotionCard>
                        <Statistic
                            title="Average Rating"
                            value={averageRating ? averageRating.toFixed(2) : '—'}
                            prefix={<StarOutlined />}
                            suffix="/5"
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            From rated feedback only
                        </Text>
                    </MotionCard>
                </Col>

                <Col xs={24} sm={12} md={8}>
                    <MotionCard>
                        <Statistic
                            title="Low Ratings (≤2)"
                            value={lowRatingsCount}
                            prefix={<ExclamationCircleOutlined />}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Needs attention
                        </Text>
                    </MotionCard>
                </Col>
            </Row>

            {/* Charts */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} md={12}>
                    <Card
                        title="Feedback Distribution"
                        style={{ borderRadius: 12 }}
                        extra={
                            <Button icon={<FullscreenOutlined />} onClick={() => setExpandedChart('pie')}>
                                Expand
                            </Button>
                        }
                    >
                        {totalFeedbacks ? (
                            <HighchartsReact highcharts={Highcharts} options={pieChartOptions} />
                        ) : (
                            <Empty description="No feedback data for this filter set." />
                        )}
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    <Card
                        title="Average Rating by SME"
                        style={{ borderRadius: 12 }}
                        extra={
                            <Button icon={<FullscreenOutlined />} onClick={() => setExpandedChart('bar')}>
                                Expand
                            </Button>
                        }
                    >
                        {avgRatingsBySME.length ? (
                            <HighchartsReact highcharts={Highcharts} options={barChartOptions} />
                        ) : (
                            <Empty description="Not enough rated feedback to compute averages." />
                        )}
                    </Card>
                </Col>
            </Row>

            {/* Expand charts modal */}
            <Modal
                title={
                    <Space>
                        <FullscreenOutlined />
                        <span>{expandedChart === 'pie' ? 'Feedback Distribution (by SME)' : 'Average Rating (by SME)'}</span>
                        <Tag>{rangeLabel}</Tag>
                    </Space>
                }
                open={!!expandedChart}
                onCancel={() => setExpandedChart(null)}
                footer={null}
                width={980}
            >
                {expandedChart === 'pie' && (
                    <HighchartsReact highcharts={Highcharts} options={{ ...pieChartOptions, chart: { ...(pieChartOptions.chart as any), height: 520 } }} />
                )}
                {expandedChart === 'bar' && (
                    <HighchartsReact highcharts={Highcharts} options={{ ...barChartOptions, chart: { ...(barChartOptions.chart as any), height: 520 } }} />
                )}
            </Modal>

            {/* Comments */}
            <Card
                title={
                    <Space>
                        <MessageOutlined />
                        <span>Feedback Comments</span>
                        <Tag>{filteredFeedbacks.length}</Tag>
                    </Space>
                }
                style={{ borderRadius: 12 }}
            >
                {loading ? (
                    <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
                        <Spin />
                    </div>
                ) : !filteredFeedbacks.length ? (
                    <Empty
                        description={
                            <span>
                                No feedback comments found. Try widening your filters.
                            </span>
                        }
                    />
                ) : (
                    <List
                        dataSource={filteredFeedbacks}
                        pagination={{
                            pageSize: 8,
                            showSizeChanger: true,
                            pageSizeOptions: [8, 12, 20],
                            size: 'small'
                        }}
                        renderItem={item => {
                            const created = item.createdAt ? dayjs(item.createdAt).format('DD MMM YYYY, HH:mm') : '—'
                            const isLow = typeof item.rating === 'number' && item.rating <= 2

                            return (
                                <List.Item style={{ padding: 0, marginBottom: 12 }}>
                                    <Card
                                        style={{
                                            width: '100%',
                                            borderRadius: 12,
                                            border: isLow ? '1px solid #ffccc7' : '1px solid #f0f0f0'
                                        }}
                                        bodyStyle={{ padding: 14 }}
                                    >
                                        <Row gutter={[12, 8]} align="middle">
                                            <Col xs={24} md={16}>
                                                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                                                    <Space wrap>
                                                        <Text strong>{item.sme}</Text>
                                                        <Tag>{item.interventionTitle}</Tag>
                                                        {ratingTag(item.rating)}
                                                        {item.createdAt ? (
                                                            <Tag color="blue">{created}</Tag>
                                                        ) : (
                                                            <Tag>Missing createdAt</Tag>
                                                        )}
                                                    </Space>

                                                    <Paragraph style={{ margin: 0 }} ellipsis={{ rows: 2 }}>
                                                        {item.comment}
                                                    </Paragraph>
                                                </Space>
                                            </Col>

                                            <Col xs={24} md={8} style={{ textAlign: 'right' }}>
                                                <Space direction="vertical" size={6} style={{ width: '100%' }} align="end">
                                                    <Space>
                                                        <Text type="secondary">Rating</Text>
                                                        <Badge
                                                            count={typeof item.rating === 'number' ? item.rating : '—'}
                                                            color={isLow ? '#ff4d4f' : '#1890ff'}
                                                            overflowCount={99}
                                                        />
                                                    </Space>
                                                    <Rate disabled value={typeof item.rating === 'number' ? item.rating : 0} />
                                                    <Button
                                                        onClick={() => {
                                                            setDetailItem(item)
                                                            setDetailOpen(true)
                                                        }}
                                                    >
                                                        View details
                                                    </Button>
                                                </Space>
                                            </Col>
                                        </Row>
                                    </Card>
                                </List.Item>
                            )
                        }}
                    />
                )}
            </Card>

            {/* Detail modal */}
            <Modal
                title={
                    <Space>
                        <MessageOutlined />
                        <span>Feedback detail</span>
                        {detailItem?.rating != null ? <Tag color="blue">{detailItem.rating}/5</Tag> : <Tag>Unrated</Tag>}
                    </Space>
                }
                open={detailOpen}
                onCancel={() => {
                    setDetailOpen(false)
                    setDetailItem(null)
                }}
                footer={null}
                width={760}
            >
                {!detailItem ? null : (
                    <>
                        <Space direction="vertical" style={{ width: '100%' }} size={8}>
                            <Space wrap>
                                <Tag color="purple">{detailItem.sme}</Tag>
                                <Tag>{detailItem.interventionTitle}</Tag>
                                {ratingTag(detailItem.rating)}
                                <Tag>
                                    {detailItem.createdAt ? dayjs(detailItem.createdAt).format('DD MMM YYYY, HH:mm') : '—'}
                                </Tag>
                            </Space>

                            <Divider style={{ margin: '8px 0' }} />

                            <Title level={5} style={{ margin: 0 }}>
                                Comment
                            </Title>
                            <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                                {detailItem.comment}
                            </Paragraph>
                        </Space>
                    </>
                )}
            </Modal>
        </div>
    )
}

export default FeedbackWorkspace
