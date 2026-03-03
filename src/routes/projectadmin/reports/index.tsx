// src/pages/project-admin/ProjectAdminReports.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
    Card,
    Typography,
    Table,
    Space,
    Button,
    Tabs,
    Row,
    Col,
    DatePicker,
    Form,
    Divider,
    Modal,
    Spin,
    Segmented,
    message,
    Alert,
    Tag,
    Empty
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    BarChartOutlined,
    FilterOutlined,
    FileExcelOutlined,
    FilePdfOutlined,
    TeamOutlined,
    ApartmentOutlined,
    DollarOutlined,
    AuditOutlined,
    CheckCircleOutlined
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { Helmet } from 'react-helmet'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { MotionCard } from '@/components/shared/Header'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { TabPane } = Tabs

Highcharts.setOptions({ credits: { enabled: false } })

type AnyDoc = Record<string, any>

type Participant = {
    id: string
    companyCode: string
    beneficiaryName?: string
    enterpriseName?: string
    participantName?: string
    province?: string
    businessAddressProvince?: string
    gender?: string
    age?: number
    ageGroup?: string
    complianceScore?: number
    createdAt?: any
} & AnyDoc

type Application = {
    id: string
    companyCode: string
    status?: string
    applicationStatus?: string
    participantId?: string
    acceptedAt?: any
    submittedAt?: any
    interventions?: { required?: Array<string | { title?: string; area?: string; id?: string }> }
} & AnyDoc

type AssignedIntervention = {
    id: string
    companyCode: string
    participantId?: string
    beneficiaryName?: string
    interventionTitle?: string
    areaOfSupport?: string
    status?: string
    assigneeName?: string
    assigneeEmail?: string
    programId?: string
    activeProgramId?: string
    createdAt?: any
    confirmedAt?: any
    dueDate?: any
} & AnyDoc

const norm = (v: any) => String(v ?? '').trim()
const normLower = (v: any) => norm(v).toLowerCase()

const toDate = (v: any): Date | null => {
    if (!v) return null
    if (typeof v?.toDate === 'function') return v.toDate()
    if (typeof v === 'object' && typeof v?.seconds === 'number') return new Date(v.seconds * 1000)
    const d = new Date(v)
    return isNaN(+d) ? null : d
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const isCompleted = (x: AssignedIntervention) => {
    const s = normLower(x.status)
    return ['completed', 'complete', 'done', 'finished', 'closed'].includes(s)
}

const isInProgress = (x: AssignedIntervention) => {
    const s = normLower(x.status)
    if (isCompleted(x)) return false
    return ['in-progress', 'in_progress', 'in progress', 'ongoing', 'active', 'started', 'assigned'].includes(s) || !s
}

const ProjectAdminReports: React.FC = () => {
    const { user } = useFullIdentity()
    const companyCode = user?.companyCode ? String(user.companyCode) : null
    const activeProgramId =
        (user as any)?.activeProgramId || (user as any)?.programId || (user as any)?.currentProgramId || null

    const [loading, setLoading] = useState(true)

    const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'quarter' | 'year' | 'custom'>('month')
    const [customDateRange, setCustomDateRange] = useState<[Dayjs, Dayjs] | null>(null)

    const [participants, setParticipants] = useState<Participant[]>([])
    const [applications, setApplications] = useState<Application[]>([])
    const [assigned, setAssigned] = useState<AssignedIntervention[]>([])

    const [expandedChart, setExpandedChart] = useState<null | string>(null)
    const [insightsOpen, setInsightsOpen] = useState(false)

    const [form] = Form.useForm()

    // -------------------------
    // Date range
    // -------------------------
    const dateRange = useMemo(() => {
        const fallbackEnd = dayjs().endOf('day')
        const fallbackStart = fallbackEnd.subtract(1, 'month').startOf('day')

        if (customDateRange?.[0] && customDateRange?.[1]) {
            return {
                start: customDateRange[0].startOf('day'),
                end: customDateRange[1].endOf('day')
            }
        }

        return { start: fallbackStart, end: fallbackEnd }
    }, [customDateRange])

    // -------------------------
    // Firestore
    // -------------------------
    useEffect(() => {
        if (!companyCode) {
            setParticipants([])
            setApplications([])
            setAssigned([])
            setLoading(false)
            return
        }

        setLoading(true)

        const base: any[] = [where('companyCode', '==', companyCode)]

        const unsubParticipants = onSnapshot(
            query(collection(db, 'participants'), ...base),
            snap => {
                const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as AnyDoc) })) as Participant[]
                setParticipants(rows)
                setLoading(false)
            },
            err => {
                console.error(err)
                setParticipants([])
                setLoading(false)
            }
        )

        // accepted applications (support both schemas)
        const qAccepted1 = query(collection(db, 'applications'), ...base, where('status', '==', 'accepted'))
        const qAccepted2 = query(collection(db, 'applications'), ...base, where('applicationStatus', '==', 'accepted'))

        const mergeAccepted = (incoming: Application[]) => {
            setApplications(prev => {
                const map = new Map<string, Application>()
                    ;[...prev, ...incoming].forEach(a => map.set(a.id, a))
                return Array.from(map.values())
            })
        }

        const unsubApps1 = onSnapshot(
            qAccepted1,
            snap => mergeAccepted(snap.docs.map(d => ({ id: d.id, ...(d.data() as AnyDoc) })) as Application[]),
            err => {
                console.error(err)
                setApplications([])
            }
        )

        const unsubApps2 = onSnapshot(
            qAccepted2,
            snap => mergeAccepted(snap.docs.map(d => ({ id: d.id, ...(d.data() as AnyDoc) })) as Application[]),
            err => {
                console.error(err)
                setApplications([])
            }
        )

        // assigned interventions (delivery records)
        const unsubAssigned = onSnapshot(
            query(collection(db, 'assignedInterventions'), ...base),
            snap => {
                const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as AnyDoc) })) as AssignedIntervention[]
                setAssigned(rows)
            },
            err => {
                console.error(err)
                setAssigned([])
            }
        )

        return () => {
            unsubParticipants()
            unsubApps1()
            unsubApps2()
            unsubAssigned()
        }
    }, [companyCode])

    // Only ever show accepted SMEs
    const acceptedSmeIds = useMemo(() => {
        return new Set(
            applications
                .map(a => norm(a.participantId || a.id))
                .filter(Boolean)
        )
    }, [applications])

    const participantsMap = useMemo(() => {
        const m: Record<string, Participant> = {}
        participants.forEach(p => (m[p.id] = p))
        return m
    }, [participants])

    const acceptedParticipants = useMemo(() => {
        const list: Participant[] = []
        acceptedSmeIds.forEach(id => {
            const p = participantsMap[id]
            if (p) list.push(p)
        })
        return list
    }, [acceptedSmeIds, participantsMap])

    // optional: program scoping (don’t drop data if docs don’t have program linkage)
    const assignedScoped = useMemo(() => {
        return assigned.filter(a => {
            const pid = norm(a.participantId)
            if (!pid || !acceptedSmeIds.has(pid)) return false
            if (!activeProgramId) return true
            const docProg = a.programId || a.activeProgramId
            if (!docProg) return true
            return String(docProg) === String(activeProgramId)
        })
    }, [assigned, acceptedSmeIds, activeProgramId])

    // filter by date range (use best-available timestamp)
    const assignedInRange = useMemo(() => {
        const start = dateRange.start.toDate()
        const end = dateRange.end.toDate()
        return assignedScoped.filter(a => {
            const d = toDate(a.confirmedAt) || toDate(a.createdAt) || toDate(a.dueDate)
            if (!d) return true
            return d >= start && d <= end
        })
    }, [assignedScoped, dateRange])

    // -------------------------
    // KPIs
    // -------------------------
    const kpis = useMemo(() => {
        const totalAccepted = acceptedSmeIds.size
        const totalAssigned = assignedInRange.length
        const completed = assignedInRange.filter(isCompleted).length
        const inProgress = assignedInRange.filter(isInProgress).length
        const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0

        const complianceScores = acceptedParticipants
            .map(p => Number(p.complianceScore ?? 0))
            .filter(n => Number.isFinite(n))

        const avgCompliance =
            complianceScores.length > 0
                ? Math.round(complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length)
                : 0

        return {
            totalAccepted,
            totalAssigned,
            completed,
            inProgress,
            completionRate,
            avgCompliance
        }
    }, [acceptedSmeIds, assignedInRange, acceptedParticipants])

    // -------------------------
    // Charts
    // -------------------------
    const participantGrowthOptions = useMemo<Highcharts.Options>(() => {
        // count accepted SMEs by acceptedAt/submittedAt month within range
        const start = dateRange.start.toDate()
        const end = dateRange.end.toDate()

        const counts: Record<string, number> = {}
        applications.forEach(a => {
            const pid = norm(a.participantId || a.id)
            if (!pid || !acceptedSmeIds.has(pid)) return

            const d =
                toDate(a.acceptedAt) ||
                toDate(a.submittedAt) ||
                toDate((participantsMap[pid] as any)?.createdAt)

            if (!d) return
            if (d < start || d > end) return

            const k = monthKey(d)
            counts[k] = (counts[k] || 0) + 1
        })

        const keys = Object.keys(counts).sort()
        const categories = keys.map(k => {
            const [y, m] = k.split('-')
            return dayjs(`${y}-${m}-01`).format('MMM YY')
        })
        const data = keys.map(k => counts[k] || 0)

        return {
            chart: { type: 'column', height: 360 },
            title: { text: 'SMEs Over Time' },
            xAxis: { categories, title: { text: 'Month' } },
            yAxis: { min: 0, title: { text: 'SMEs' } },
            plotOptions: {
                series: {
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            // @ts-ignore
                            const y = this.y as number
                            if (!y) return null
                            return String(y)
                        }
                    },
                    borderRadius: 8
                }
            },
            series: [{ name: 'Accepted', type: 'column', data }]
        }
    }, [applications, acceptedSmeIds, participantsMap, dateRange])

    const topParticipantsOptions = useMemo<Highcharts.Options>(() => {
        const completedByParticipant: Record<string, number> = {}
        assignedInRange.forEach(a => {
            if (!isCompleted(a)) return
            const pid = norm(a.participantId)
            if (!pid) return
            completedByParticipant[pid] = (completedByParticipant[pid] || 0) + 1
        })

        const top = Object.entries(completedByParticipant)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)

        const categories = top.map(([pid]) => {
            const p = participantsMap[pid]
            return norm(p?.beneficiaryName || p?.enterpriseName || p?.participantName) || pid
        })
        const data = top.map(([, v]) => v)

        return {
            chart: { type: 'bar', height: 360 },
            title: { text: 'Top 5 SMEs by Completed Interventions' },
            xAxis: { categories, title: { text: 'SME' }, labels: { style: { fontSize: '11px' } } },
            yAxis: { min: 0, title: { text: 'Completed' } },
            plotOptions: {
                series: {
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            // @ts-ignore
                            const y = this.y as number
                            if (!y) return null
                            return String(y)
                        }
                    },
                    borderRadius: 6
                }
            },
            series: [{ name: 'Completed', type: 'bar', data }]
        }
    }, [assignedInRange, participantsMap])

    const provinceReachOptions = useMemo<Highcharts.Options>(() => {
        const counts: Record<string, number> = {}
        acceptedParticipants.forEach(p => {
            const prov = norm(p.province || p.businessAddressProvince) || 'Unknown'
            counts[prov] = (counts[prov] || 0) + 1
        })

        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
        const categories = entries.map(([k]) => k)
        const data = entries.map(([, v]) => v)

        return {
            chart: { type: 'column', height: 360 },
            title: { text: 'SMEs by Province' },
            xAxis: { categories, title: { text: 'Province' } },
            yAxis: { min: 0, title: { text: 'SMEs' } },
            plotOptions: {
                series: {
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            // @ts-ignore
                            const y = this.y as number
                            if (!y) return null
                            return String(y)
                        }
                    },
                    borderRadius: 8
                }
            },
            series: [{ name: 'SMEs', type: 'column', data }]
        }
    }, [acceptedParticipants])

    const genderDistOptions = useMemo<Highcharts.Options>(() => {
        const counts: Record<string, number> = {}
        acceptedParticipants.forEach(p => {
            const g = norm(p.gender) || 'Unknown'
            counts[g] = (counts[g] || 0) + 1
        })

        const data = Object.entries(counts).map(([name, y]) => ({ name, y }))

        return {
            chart: { type: 'pie', height: 360 },
            title: { text: 'Gender Distribution' },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            // @ts-ignore
                            const y = this.y as number
                            if (!y) return null
                            // @ts-ignore
                            return `${this.point?.name}: ${y}`
                        }
                    }
                }
            },
            series: [{ name: 'SMEs', type: 'pie', colorByPoint: true, data }]
        }
    }, [acceptedParticipants])

    const completionByGenderOptions = useMemo<Highcharts.Options>(() => {
        const completedByGender: Record<string, number> = {}
        const incompleteByGender: Record<string, number> = {}

        assignedInRange.forEach(a => {
            const pid = norm(a.participantId)
            const g = norm(participantsMap[pid]?.gender) || 'Unknown'
            if (isCompleted(a)) completedByGender[g] = (completedByGender[g] || 0) + 1
            else incompleteByGender[g] = (incompleteByGender[g] || 0) + 1
        })

        const genders = Array.from(new Set([...Object.keys(completedByGender), ...Object.keys(incompleteByGender)])).sort()

        return {
            chart: { type: 'column', height: 360 },
            title: { text: 'Intervention Delivery by Gender' },
            xAxis: { categories: genders, title: { text: 'Gender' } },
            yAxis: { min: 0, title: { text: 'Interventions' } },
            plotOptions: {
                series: {
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            // @ts-ignore
                            const y = this.y as number
                            if (!y) return null
                            return String(y)
                        }
                    },
                    borderRadius: 8
                }
            },
            series: [
                { name: 'Completed', type: 'column', data: genders.map(g => completedByGender[g] || 0) },
                { name: 'In Progress/Other', type: 'column', data: genders.map(g => incompleteByGender[g] || 0) }
            ]
        }
    }, [assignedInRange, participantsMap])

    const requiredVsMetOptions = useMemo<Highcharts.Options>(() => {
        // required by area from accepted applications
        const requiredByArea: Record<string, number> = {}
        applications.forEach(a => {
            const pid = norm(a.participantId || a.id)
            if (!pid || !acceptedSmeIds.has(pid)) return
            const req = a.interventions?.required
            if (!Array.isArray(req)) return
            req.forEach(x => {
                const area = typeof x === 'object' ? norm((x as any).area) : 'Unknown'
                const key = area || 'Unknown'
                requiredByArea[key] = (requiredByArea[key] || 0) + 1
            })
        })

        // completed by area from assigned interventions
        const completedByArea: Record<string, number> = {}
        assignedInRange.forEach(a => {
            if (!isCompleted(a)) return
            const area = norm(a.areaOfSupport) || 'Unknown'
            completedByArea[area] = (completedByArea[area] || 0) + 1
        })

        const areas = Array.from(new Set([...Object.keys(requiredByArea), ...Object.keys(completedByArea)])).sort()

        return {
            chart: { type: 'column', height: Math.max(360, areas.length * 26) },
            title: { text: 'Required vs Met (by Area of Support)' },
            xAxis: { categories: areas, labels: { style: { fontSize: '11px' } } },
            yAxis: { min: 0, title: { text: 'Count' } },
            tooltip: { shared: true },
            plotOptions: {
                series: {
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            // @ts-ignore
                            const y = this.y as number
                            if (!y) return null
                            return String(y)
                        }
                    },
                    borderRadius: 8
                }
            },
            series: [
                { name: 'Required', type: 'column', data: areas.map(a => requiredByArea[a] || 0) },
                { name: 'Met (Completed)', type: 'column', data: areas.map(a => completedByArea[a] || 0) }
            ]
        }
    }, [applications, acceptedSmeIds, assignedInRange])

    // -------------------------
    // Table
    // -------------------------
    const overviewRows = useMemo(() => {
        return assignedInRange
            .map(a => {
                const pid = norm(a.participantId)
                const p = participantsMap[pid]
                return {
                    key: a.id,
                    interventionTitle: norm(a.interventionTitle) || 'Untitled',
                    areaOfSupport: norm(a.areaOfSupport) || 'Unknown',
                    incubatee: norm(a.beneficiaryName) || norm(p?.beneficiaryName || p?.enterpriseName || p?.participantName) || pid || '—',
                    assigneeName: norm(a.assigneeName) || '—',
                    assigneeEmail: norm(a.assigneeEmail) || '—',
                    status: norm(a.status) || 'assigned',
                    due: toDate(a.dueDate)?.toLocaleDateString() || '—'
                }
            })
            .sort((x, y) => x.interventionTitle.localeCompare(y.interventionTitle))
            .slice(0, 50)
    }, [assignedInRange, participantsMap])

    const columns: ColumnsType<any> = [
        {
            title: 'Intervention',
            dataIndex: 'interventionTitle',
            key: 'interventionTitle',
            render: (_, r) => (
                <div>
                    <div style={{ fontWeight: 600 }}>{r.interventionTitle}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{r.areaOfSupport}</div>
                </div>
            )
        },
        { title: 'Incubatee (SME)', dataIndex: 'incubatee', key: 'incubatee' },
        {
            title: 'Assignee',
            key: 'assignee',
            render: (_, r) => (
                <div>
                    <div style={{ fontWeight: 600 }}>{r.assigneeName}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{r.assigneeEmail}</div>
                </div>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: v => {
                const s = normLower(v)
                const color = ['completed', 'done', 'finished'].includes(s) ? 'green' : ['in-progress', 'assigned', 'active'].includes(s) ? 'gold' : 'default'
                return <Tag color={color}>{v}</Tag>
            }
        },
        { title: 'Due', dataIndex: 'due', key: 'due' }
    ]

    // -------------------------
    // Actions (per your ask)
    // -------------------------
    const onGenerateReport = () => message.warning('Insufficient Data for now')

    const onExportExcel = () => message.warning('Insufficient Data for now')
    const onExportPdf = () => message.warning('Insufficient Data for now')

    // -------------------------
    // Expanded chart picker
    // -------------------------
    const chartByKey = (key: string): Highcharts.Options => {
        switch (key) {
            case 'participantGrowth':
                return participantGrowthOptions
            case 'topParticipants':
                return topParticipantsOptions
            case 'provinceReach':
                return provinceReachOptions
            case 'genderDist':
                return genderDistOptions
            case 'genderCompletion':
                return completionByGenderOptions
            case 'requiredVsMet':
                return requiredVsMetOptions
            default:
                return { title: { text: 'Insufficient Data for now' }, series: [] }
        }
    }

    return (
        <>
            <Helmet>
                <title>Analytics | Smart Incubation</title>
                <meta name="description" content="Generate and analyze incubation program reports and analytics." />
            </Helmet>

            {!companyCode ? (
                <div style={{ padding: 20 }}>
                    <Alert type="warning" showIcon message="No companyCode found for the logged-in user." />
                </div>
            ) : (
                <div style={{ padding: 20 }}>
                    <Card style={{ marginTop: 16, marginBottom: 16 }}>
                        <Form
                            form={form}
                            layout="inline"
                            onFinish={onGenerateReport}
                            style={{ width: '100%' }}
                        >
                            <Row gutter={[12, 12]} align="middle" style={{ width: '100%' }}>
                                <Col flex="auto">
                                    <Space wrap size={10}>
                                        <Form.Item label="Date Range" style={{ marginBottom: 0 }}>
                                            <RangePicker
                                                allowClear={false}
                                                value={customDateRange as any}
                                                onChange={dates => {
                                                    if (!dates || !dates[0] || !dates[1]) return
                                                    setCustomDateRange(dates as any)
                                                }}
                                            />
                                        </Form.Item>

                                        <Button icon={<FilterOutlined />} type="primary" htmlType="submit">
                                            Generate Report
                                        </Button>

                                        <Button icon={<FileExcelOutlined />} onClick={onExportExcel}>
                                            Export Excel
                                        </Button>

                                        <Button icon={<FilePdfOutlined />} onClick={onExportPdf}>
                                            Export PDF
                                        </Button>
                                    </Space>
                                </Col>
                            </Row>
                        </Form>
                    </Card>

                    {loading ? (
                        <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <LoadingOverlay tip='Loading data...' />
                        </div>
                    ) : (
                        <>
                            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                                {[
                                    {
                                        title: 'Accepted SMEs',
                                        value: kpis.totalAccepted,
                                        icon: <TeamOutlined style={{ color: '#1890ff', fontSize: 18 }} />,
                                        iconBg: 'rgba(24,144,255,.12)'
                                    },
                                    {
                                        title: 'Assigned Interventions',
                                        value: kpis.totalAssigned,
                                        icon: <ApartmentOutlined style={{ color: '#722ed1', fontSize: 18 }} />,
                                        iconBg: 'rgba(114,46,209,.12)'
                                    },
                                    {
                                        title: 'Completed',
                                        value: kpis.completed,
                                        icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />,
                                        iconBg: 'rgba(82,196,26,.12)'
                                    },
                                    {
                                        title: 'Avg Compliance',
                                        value: `${kpis.avgCompliance}%`,
                                        icon: <AuditOutlined style={{ color: '#fa8c16', fontSize: 18 }} />,
                                        iconBg: 'rgba(250,140,22,.12)'
                                    }
                                ].map((metric, index) => (
                                    <Col xs={24} sm={12} md={6} key={metric.title}>

                                        <MotionCard bodyStyle={{ padding: 14 }} style={{ height: '100%' }}>
                                            <MotionCard.Metric
                                                icon={metric.icon}
                                                iconBg={metric.iconBg}
                                                title={metric.title}
                                                value={metric.value}
                                            />
                                        </MotionCard>
                                    </Col>
                                ))}
                            </Row>

                            <Card style={{ marginBottom: 16 }}>
                                <Row justify="space-between" align="middle">
                                    <Col>
                                        <Text type="secondary">
                                            Completion Rate: <b>{kpis.completionRate}%</b>
                                        </Text>
                                    </Col>
                                    <Col>
                                        {activeProgramId ? <Tag color="blue">Program: {String(activeProgramId)}</Tag> : null}
                                    </Col>
                                </Row>
                            </Card>

                            <>
                                <Row gutter={[16, 16]}>
                                    <Col xs={24} md={12}>
                                        <Card
                                            title="Accepted SMEs Over Time"
                                            extra={
                                                <Button size="small" onClick={() => setExpandedChart('participantGrowth')}>
                                                    Expand
                                                </Button>
                                            }
                                        >
                                            <HighchartsReact highcharts={Highcharts} options={participantGrowthOptions} />
                                        </Card>
                                    </Col>

                                    <Col xs={24} md={12}>
                                        <Card
                                            title="Top SMEs by Completed Interventions"
                                            extra={
                                                <Button size="small" onClick={() => setExpandedChart('topParticipants')}>
                                                    Expand
                                                </Button>
                                            }
                                        >
                                            <HighchartsReact highcharts={Highcharts} options={topParticipantsOptions} />
                                        </Card>
                                    </Col>

                                    <Col xs={24} md={12}>
                                        <Card
                                            title="Accepted SMEs by Province"
                                            extra={
                                                <Button size="small" onClick={() => setExpandedChart('provinceReach')}>
                                                    Expand
                                                </Button>
                                            }
                                        >
                                            <HighchartsReact highcharts={Highcharts} options={provinceReachOptions} />
                                        </Card>
                                    </Col>

                                    <Col xs={24} md={12}>
                                        <Card
                                            title="Gender Distribution"
                                            extra={
                                                <Button size="small" onClick={() => setExpandedChart('genderDist')}>
                                                    Expand
                                                </Button>
                                            }
                                        >
                                            <HighchartsReact highcharts={Highcharts} options={genderDistOptions} />
                                        </Card>
                                    </Col>

                                    <Col xs={24} md={12}>
                                        <Card
                                            title="Intervention Delivery by Gender"
                                            extra={
                                                <Button size="small" onClick={() => setExpandedChart('genderCompletion')}>
                                                    Expand
                                                </Button>
                                            }
                                        >
                                            <HighchartsReact highcharts={Highcharts} options={completionByGenderOptions} />
                                        </Card>
                                    </Col>

                                    <Col xs={24} md={12}>
                                        <Card
                                            title="Required vs Met (by Area of Support)"
                                            extra={
                                                <Button size="small" onClick={() => setExpandedChart('requiredVsMet')}>
                                                    Expand
                                                </Button>
                                            }
                                        >
                                            <HighchartsReact highcharts={Highcharts} options={requiredVsMetOptions} />
                                        </Card>
                                    </Col>
                                </Row>

                                <Divider />

                                <Space>
                                    <Button type="primary" onClick={() => setInsightsOpen(true)}>
                                        View AI Insights
                                    </Button>
                                </Space>

                                <Divider />

                                <Card title="Live Intervention Overview">
                                    {overviewRows.length ? (
                                        <Table
                                            columns={columns}
                                            dataSource={overviewRows}
                                            size="small"
                                            pagination={{ pageSize: 10 }}
                                            rowKey="key"
                                        />
                                    ) : (
                                        <Empty description="No interventions found in the selected range." />
                                    )}
                                </Card>
                            </>



                            <Modal
                                open={insightsOpen}
                                onCancel={() => setInsightsOpen(false)}
                                footer={[
                                    <Button key="close" onClick={() => setInsightsOpen(false)}>
                                        Close
                                    </Button>,
                                    <Button
                                        key="gen"
                                        type="primary"
                                        onClick={() => message.warning('Insufficient Data for now')}
                                    >
                                        Generate Insight
                                    </Button>
                                ]}
                                title="AI Insights"
                            >
                                <Alert
                                    type="warning"
                                    showIcon
                                    message="Insufficient Data for now"
                                    description="We will enable insights once the reporting dataset is finalized and validated."
                                />
                            </Modal>

                            <Modal
                                open={!!expandedChart}
                                footer={null}
                                onCancel={() => setExpandedChart(null)}
                                width={980}
                                title={expandedChart ? `Expanded View` : undefined}
                            >
                                {expandedChart ? (
                                    <HighchartsReact highcharts={Highcharts} options={chartByKey(expandedChart)} />
                                ) : null}
                            </Modal>
                        </>
                    )}
                </div >
            )}
        </>
    )
}

export default ProjectAdminReports
