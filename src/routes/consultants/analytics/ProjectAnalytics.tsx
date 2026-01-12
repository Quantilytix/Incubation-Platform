import React, { useEffect, useMemo, useState } from 'react'
import {
    Typography,
    Row,
    Col,
    Card,
    Spin,
    message,
    Select,
    DatePicker,
    Space,
    Statistic,
    Tag,
    Empty
} from 'antd'
import { db } from '@/firebase'
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc
} from 'firebase/firestore'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { Helmet } from 'react-helmet'
import dayjs, { Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    PieChartOutlined
} from '@ant-design/icons'

dayjs.extend(isoWeek)

const { Title, Text } = Typography
const { RangePicker } = DatePicker

type AnyTS = any

type AssignedIntervention = {
    id: string
    participantId?: string
    beneficiaryName?: string
    interventionTitle?: string
    status?: string
    progress?: number
    dueDate?: any
    createdAt?: AnyTS
    updatedAt?: AnyTS
    consultantStatus?: 'pending' | 'accepted' | 'declined'
    consultantAcceptanceStatus?: 'pending' | 'accepted' | 'declined'
}

type ParticipantLite = {
    id: string
    beneficiaryName?: string
    sector?: string
    gender?: string
}

const toDate = (v: any): Date | null => {
    if (!v) return null
    if (typeof v === 'object' && v?.seconds && typeof v.seconds === 'number') {
        return new Date(v.seconds * 1000)
    }
    if (v instanceof Date) return v
    const d = new Date(v)
    return isNaN(+d) ? null : d
}

const norm = (v?: string) => (v || '').trim()

const normalizeStatus = (raw?: string) => {
    const s = (raw || '').toLowerCase().trim()
    if (!s) return 'unknown'
    return s
}

const isTerminal = (s: string) => ['completed', 'declined'].includes(s)

const normalizeStatusLabel = (raw?: string) => {
    if (!raw) return 'Unknown'

    const s = raw.toLowerCase().trim()

    const MAP: Record<string, string> = {
        'in-progress': 'In Progress',
        'in progress': 'In Progress',
        'assigned': 'Assigned',
        'pending': 'Pending',
        'completed': 'Completed',
        'declined': 'Declined',
        'overdue': 'Overdue'
    }

    return MAP[s] || s.replace(/\b\w/g, c => c.toUpperCase())
}


export const ProjectAnalytics: React.FC = () => {
    const { user } = useFullIdentity()

    const [loading, setLoading] = useState(true)
    const [consultantId, setConsultantId] = useState<string>('')

    // raw data
    const [allInterventions, setAllInterventions] = useState<AssignedIntervention[]>([])
    const [participantsById, setParticipantsById] = useState<Record<string, ParticipantLite>>({})

    // filters
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
        dayjs().subtract(30, 'day').startOf('day'),
        dayjs().endOf('day')
    ])
    const [sectorFilter, setSectorFilter] = useState<string>('all')
    const [genderFilter, setGenderFilter] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<string>('all')

    /** Resolve consultantId */
    useEffect(() => {
        const run = async () => {
            try {
                const email = (user?.email || '').toLowerCase()
                if (!email) return
                const snap = await getDocs(query(collection(db, 'consultants'), where('email', '==', email)))
                if (snap.empty) {
                    setConsultantId('')
                    return
                }
                setConsultantId(snap.docs[0].id)
            } catch (e) {
                console.error(e)
                setConsultantId('')
            }
        }
        run()
    }, [user?.email])

    /** Fetch consultant interventions + participants */
    useEffect(() => {
        const run = async () => {
            if (!consultantId) return
            setLoading(true)
            try {
                // 1) interventions
                const intSnap = await getDocs(
                    query(collection(db, 'assignedInterventions'), where('consultantId', '==', consultantId))
                )

                const interventions: AssignedIntervention[] = intSnap.docs.map(d => ({
                    id: d.id,
                    ...(d.data() as any)
                }))

                setAllInterventions(interventions)

                // 2) participants (only those involved)
                const pIds = Array.from(new Set(interventions.map(i => i.participantId).filter(Boolean))) as string[]
                const map: Record<string, ParticipantLite> = {}

                // You can speed this up with chunked getDocs + where('__name__','in', chunk)
                // but doc() reads are simplest and reliable.
                await Promise.all(
                    pIds.map(async pid => {
                        try {
                            const pSnap = await getDoc(doc(db, 'participants', pid))
                            if (pSnap.exists()) {
                                const p = pSnap.data() as any
                                map[pid] = {
                                    id: pid,
                                    beneficiaryName: p.beneficiaryName || p.name || 'Unknown',
                                    sector: p.sector || p.industry || p.businessSector || 'Unspecified',
                                    gender: p.gender || 'Unspecified'
                                }
                            } else {
                                map[pid] = { id: pid, sector: 'Unspecified', gender: 'Unspecified' }
                            }
                        } catch {
                            map[pid] = { id: pid, sector: 'Unspecified', gender: 'Unspecified' }
                        }
                    })
                )

                setParticipantsById(map)
            } catch (e) {
                console.error(e)
                message.error('Failed to load consultant analytics.')
            } finally {
                setLoading(false)
            }
        }

        run()
    }, [consultantId])

    /** Filtered interventions (date range + demographic filters) */
    const filtered = useMemo(() => {
        const [start, end] = dateRange

        return allInterventions.filter(i => {
            const pid = i.participantId || ''
            const p = participantsById[pid]

            // status filter
            const st = normalizeStatus(i.status)
            if (statusFilter !== 'all' && st !== statusFilter) return false

            // sector / gender filter
            const sector = norm(p?.sector || 'Unspecified')
            const gender = norm(p?.gender || 'Unspecified')
            if (sectorFilter !== 'all' && sector !== sectorFilter) return false
            if (genderFilter !== 'all' && gender !== genderFilter) return false

            // date filter: prefer updatedAt, fallback createdAt
            const d =
                toDate(i.updatedAt) ||
                toDate(i.createdAt) ||
                null

            if (!d) return true // if no timestamp, keep it (or change to false if you want strict)
            const dd = dayjs(d)
            return dd.isAfter(start.subtract(1, 'millisecond')) && dd.isBefore(end.add(1, 'millisecond'))
        })
    }, [allInterventions, participantsById, dateRange, sectorFilter, genderFilter, statusFilter])

    /** Filter options */
    const sectorOptions = useMemo(() => {
        const set = new Set<string>()
        Object.values(participantsById).forEach(p => set.add(norm(p.sector || 'Unspecified')))
        return ['all', ...Array.from(set).sort()]
    }, [participantsById])

    const genderOptions = useMemo(() => {
        const set = new Set<string>()
        Object.values(participantsById).forEach(p => set.add(norm(p.gender || 'Unspecified')))
        return ['all', ...Array.from(set).sort()]
    }, [participantsById])

    const statusOptions = useMemo(() => {
        const set = new Set<string>()
        allInterventions.forEach(i => set.add(normalizeStatus(i.status)))
        return ['all', ...Array.from(set).sort()]
    }, [allInterventions])

    /** Metrics */
    const metrics = useMemo(() => {
        const now = dayjs()

        const total = filtered.length
        const byStatus: Record<string, number> = {}
        let progressSum = 0
        let progressCount = 0
        let overdue = 0

        filtered.forEach(i => {
            const st = normalizeStatus(i.status)
            byStatus[st] = (byStatus[st] || 0) + 1

            if (typeof i.progress === 'number') {
                progressSum += i.progress
                progressCount++
            }

            const due = toDate(i.dueDate)
            if (due) {
                const terminal = isTerminal(st)
                if (!terminal && dayjs(due).isBefore(now, 'day')) overdue++
            }
        })

        const completed = byStatus['completed'] || 0
        const inProgress = byStatus['in-progress'] || 0
        const assigned = byStatus['assigned'] || 0
        const pending = byStatus['pending'] || 0
        const declined = byStatus['declined'] || 0

        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
        const avgProgress = progressCount > 0 ? Math.round(progressSum / progressCount) : 0

        return {
            total,
            completed,
            inProgress,
            assigned,
            pending,
            declined,
            overdue,
            completionRate,
            avgProgress,
            byStatus
        }
    }, [filtered])

    /** Charts */
    const statusPieOptions: Highcharts.Options = useMemo(() => {
        const data = Object.entries(metrics.byStatus)
            .sort((a, b) => b[1] - a[1])
            .map(([name, y]) => ({
                name: normalizeStatusLabel(name),
                y
            }))


        return {
            chart: {
                type: 'pie',
                backgroundColor: 'transparent',
                spacing: [10, 10, 10, 10]
            },
            title: { text: 'Workload breakdown (by status)' },
            credits: { enabled: false },
            tooltip: { pointFormat: '<b>{point.y}</b>' },

            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    showInLegend: true,
                    dataLabels: {
                        enabled: true,
                        format: '{point.name}: {point.y} ({point.percentage:.1f}%)',
                        distance: 25,
                        crop: false,
                        overflow: 'allow',
                        // 🔥 FORCE visibility (your issue)
                        style: {
                            color: '#111',          // <— this is the big fix
                            fill: '#111',           // <— some themes affect SVG fill instead
                            fontSize: '12px',
                            fontWeight: '600',
                            textOutline: 'none'
                        }
                    }
                }
            },

            series: [
                {
                    type: 'pie',
                    name: 'Count',
                    data,
                    // 🔥 ALSO force at series level (overrides any merge/theme)
                    dataLabels: {
                        enabled: true,
                        format: '{point.name}: {point.y} ({point.percentage:.1f}%)',
                        distance: 25,
                        crop: false,
                        overflow: 'allow',
                        style: {
                            color: '#111',
                            fill: '#111',
                            fontSize: '12px',
                            fontWeight: '600',
                            textOutline: 'none'
                        }
                    }
                }
            ]
        }
    }, [metrics.byStatus])


    const completionsOverTimeOptions: Highcharts.Options = useMemo(() => {
        // weekly buckets based on updatedAt/createdAt
        const buckets: Record<string, number> = {}
        filtered.forEach(i => {
            const st = normalizeStatus(i.status)
            if (st !== 'completed') return
            const d = toDate(i.updatedAt) || toDate(i.createdAt)
            if (!d) return
            const key = `${dayjs(d).isoWeekYear()}-W${String(dayjs(d).isoWeek()).padStart(2, '0')}`
            buckets[key] = (buckets[key] || 0) + 1
        })

        const keys = Object.keys(buckets).sort()
        const seriesData = keys.map(k => buckets[k])

        return {
            chart: { type: 'column', backgroundColor: 'transparent' },
            title: { text: 'Completions over time (weekly)' },
            credits: { enabled: false },
            xAxis: { categories: keys },
            yAxis: { title: { text: 'Completed' }, allowDecimals: false },
            tooltip: { pointFormat: '<b>{point.y}</b>' },
            plotOptions: { column: { dataLabels: { enabled: true, format: '{point.y}' } } },
            series: [{ type: 'column', name: 'Completed', data: seriesData }]
        }
    }, [filtered])

    const avgProgressBySectorOptions: Highcharts.Options = useMemo(() => {
        const agg: Record<string, { sum: number; n: number }> = {}

        filtered.forEach(i => {
            const pid = i.participantId || ''
            const sector = norm(participantsById[pid]?.sector || 'Unspecified')
            const v = typeof i.progress === 'number' ? i.progress : null
            if (v === null) return
            agg[sector] = agg[sector] || { sum: 0, n: 0 }
            agg[sector].sum += v
            agg[sector].n += 1
        })

        const rows = Object.entries(agg)
            .map(([sector, v]) => ({ sector, avg: v.n ? Math.round(v.sum / v.n) : 0 }))
            .sort((a, b) => b.avg - a.avg)

        return {
            chart: { type: 'bar', backgroundColor: 'transparent' },
            title: { text: 'Avg progress by sector' },
            credits: { enabled: false },
            xAxis: { categories: rows.map(r => r.sector) },
            yAxis: { title: { text: 'Avg progress (%)' }, max: 100 },
            tooltip: { pointFormat: '<b>{point.y}%</b>' },
            plotOptions: { bar: { dataLabels: { enabled: true, format: '{point.y}%' } } },
            series: [{ type: 'bar', name: 'Avg progress', data: rows.map(r => r.avg) }]
        }
    }, [filtered, participantsById])

    const completionRateByGenderOptions: Highcharts.Options = useMemo(() => {
        const agg: Record<string, { total: number; completed: number }> = {}

        filtered.forEach(i => {
            const pid = i.participantId || ''
            const gender = norm(participantsById[pid]?.gender || 'Unspecified')
            const st = normalizeStatus(i.status)

            agg[gender] = agg[gender] || { total: 0, completed: 0 }
            agg[gender].total += 1
            if (st === 'completed') agg[gender].completed += 1
        })

        const rows = Object.entries(agg)
            .map(([gender, v]) => ({
                gender,
                rate: v.total ? Math.round((v.completed / v.total) * 100) : 0
            }))
            .sort((a, b) => b.rate - a.rate)

        return {
            chart: { type: 'column', backgroundColor: 'transparent' },
            title: { text: 'Completion rate by gender' },
            credits: { enabled: false },
            xAxis: { categories: rows.map(r => r.gender) },
            yAxis: { title: { text: 'Completion rate (%)' }, max: 100 },
            tooltip: { pointFormat: '<b>{point.y}%</b>' },
            plotOptions: { column: { dataLabels: { enabled: true, format: '{point.y}%' } } },
            series: [{ type: 'column', name: 'Completion rate', data: rows.map(r => r.rate) }]
        }
    }, [filtered, participantsById])

    return (
        <div style={{ padding: 24 }}>
            <Helmet>
                <title>Consultant Analytics | Smart Incubation</title>
            </Helmet>


            <Card style={{ marginBottom: 16 }}>
                <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} md={10}>
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                            <Text type="secondary">Date range</Text>
                            <RangePicker
                                style={{ width: '100%' }}
                                value={dateRange}
                                onChange={(v) => {
                                    if (!v || !v[0] || !v[1]) return
                                    setDateRange([v[0].startOf('day'), v[1].endOf('day')])
                                }}
                                allowClear={false}
                            />
                        </Space>
                    </Col>

                    <Col xs={24} md={5}>
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                            <Text type="secondary">Sector</Text>
                            <Select value={sectorFilter} onChange={setSectorFilter} style={{ width: '100%' }}>
                                {sectorOptions.map(s => (
                                    <Select.Option key={s} value={s}>
                                        {s === 'all' ? 'All sectors' : s}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Space>
                    </Col>

                    <Col xs={24} md={4}>
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                            <Text type="secondary">Gender</Text>
                            <Select value={genderFilter} onChange={setGenderFilter} style={{ width: '100%' }}>
                                {genderOptions.map(g => (
                                    <Select.Option key={g} value={g}>
                                        {g === 'all' ? 'All genders' : g}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Space>
                    </Col>

                    <Col xs={24} md={5}>
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                            <Text type="secondary">Status</Text>
                            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: '100%' }}>
                                {statusOptions.map(s => (
                                    <Select.Option key={s} value={s}>
                                        {s === 'all' ? 'All statuses' : s}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Space>
                    </Col>
                </Row>
            </Card>

            {loading ? (
                <div style={{ display: 'flex', height: 300, alignItems: 'center', justifyContent: 'center' }}>
                    <Spin tip="Loading analytics..." size="large" />
                </div>
            ) : (
                <>
                    {filtered.length === 0 ? (
                        <Card>
                            <Empty description="No interventions match the current filters." />
                        </Card>
                    ) : (
                        <>
                            {/* Metrics */}
                            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                                <Col xs={24} sm={12} lg={4}>
                                    <Card>
                                        <Statistic title="Assigned (total)" value={metrics.total} prefix={<PieChartOutlined />} />
                                    </Card>
                                </Col>
                                <Col xs={24} sm={12} lg={4}>
                                    <Card>
                                        <Statistic title="Completed" value={metrics.completed} prefix={<CheckCircleOutlined />} />
                                    </Card>
                                </Col>
                                <Col xs={24} sm={12} lg={4}>
                                    <Card>
                                        <Statistic title="In progress" value={metrics.inProgress} prefix={<ClockCircleOutlined />} />
                                    </Card>
                                </Col>
                                <Col xs={24} sm={12} lg={4}>
                                    <Card>
                                        <Statistic title="Declined" value={metrics.declined} prefix={<CloseCircleOutlined />} />
                                    </Card>
                                </Col>
                                <Col xs={24} sm={12} lg={4}>
                                    <Card>
                                        <Statistic
                                            title="Overdue"
                                            value={metrics.overdue}
                                            prefix={<ExclamationCircleOutlined />}
                                            valueStyle={metrics.overdue > 0 ? { color: '#cf1322' } : undefined}
                                        />
                                        {metrics.overdue > 0 && <Tag color="red" style={{ marginTop: 8 }}>Needs attention</Tag>}
                                    </Card>
                                </Col>
                                <Col xs={24} sm={12} lg={4}>
                                    <Card>
                                        <Statistic title="Completion rate" value={metrics.completionRate} suffix="%" />
                                        <div style={{ marginTop: 8 }}>
                                            <Text type="secondary">Avg progress: </Text>
                                            <Text strong>{metrics.avgProgress}%</Text>
                                        </div>
                                    </Card>
                                </Col>
                            </Row>

                            {/* Charts */}
                            <Row gutter={[16, 16]}>
                                <Col xs={24} lg={12}>
                                    <Card>
                                        <HighchartsReact highcharts={Highcharts} options={statusPieOptions} />
                                    </Card>
                                </Col>

                                <Col xs={24} lg={12}>
                                    <Card>
                                        <HighchartsReact highcharts={Highcharts} options={completionsOverTimeOptions} />
                                    </Card>
                                </Col>

                                <Col xs={24} lg={12}>
                                    <Card>
                                        <HighchartsReact highcharts={Highcharts} options={avgProgressBySectorOptions} />
                                    </Card>
                                </Col>

                                <Col xs={24} lg={12}>
                                    <Card>
                                        <HighchartsReact highcharts={Highcharts} options={completionRateByGenderOptions} />
                                    </Card>
                                </Col>
                            </Row>
                        </>
                    )}
                </>
            )}
        </div>
    )
}
