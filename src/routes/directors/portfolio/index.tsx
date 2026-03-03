import React, { useMemo, useState } from 'react'
import {
    Avatar,
    Button,
    Card,
    Col,
    DatePicker,
    Divider,
    Grid,
    Input,
    Modal,
    Progress,
    Row,
    Select,
    Space,
    Statistic,
    Table,
    Tag,
    Tooltip,
    Typography
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Helmet } from 'react-helmet'
import dayjs, { Dayjs } from 'dayjs'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import {
    SearchOutlined,
    EyeOutlined,
    RiseOutlined,
    WarningOutlined,
    TeamOutlined,
    DollarOutlined,
    AppstoreOutlined,
    CheckCircleOutlined,
    FundOutlined,
    ThunderboltOutlined
} from '@ant-design/icons'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'

const { Text, Title } = Typography
const { RangePicker } = DatePicker
const { useBreakpoint } = Grid

type Risk = 'Low' | 'Medium' | 'High'
type Stage = 'Seed' | 'Startup' | 'Early Growth' | 'Growth' | 'Mature'

type PortfolioSME = {
    id: string
    name: string
    sector: string
    stage: Stage
    status: 'Active' | 'Warning' | 'Paused'
    risk: Risk
    valuation: number
    investment: number
    progress: number // 0-100
    lastUpdate: string // YYYY-MM-DD

    metrics: {
        revenue: number
        customers: number
        employees: number
        growthRate: number // %
    }

    // dummy timeseries for modal charts
    timeseries: Array<{
        month: string
        revenue: number
        customers: number
    }>

    // dummy “execution view”
    interventions: {
        required: number
        completed: number
        overdue: number
        unresponsive: number
        upcoming: number
    }
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value)

const riskColor = (risk: Risk) => {
    if (risk === 'High') return 'red'
    if (risk === 'Medium') return 'orange'
    return 'green'
}

const statusColor = (status: PortfolioSME['status']) => {
    if (status === 'Warning') return 'orange'
    if (status === 'Paused') return 'default'
    return 'green'
}

const stageColor = (stage: Stage) => {
    if (stage === 'Seed') return 'purple'
    if (stage === 'Startup') return 'blue'
    if (stage === 'Early Growth') return 'geekblue'
    if (stage === 'Growth') return 'green'
    return 'gold'
}

const makeInitials = (name: string) =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(s => s[0]?.toUpperCase())
        .join('')

const dummyPortfolio: PortfolioSME[] = [
    {
        id: 'sme_1',
        name: 'TechInnovate',
        sector: 'FinTech',
        stage: 'Growth',
        status: 'Active',
        risk: 'Low',
        valuation: 4500000,
        investment: 750000,
        progress: 72,
        lastUpdate: '2026-01-12',
        metrics: { revenue: 1200000, customers: 5800, employees: 32, growthRate: 68 },
        timeseries: [
            { month: 'Aug', revenue: 650000, customers: 4200 },
            { month: 'Sep', revenue: 720000, customers: 4500 },
            { month: 'Oct', revenue: 860000, customers: 4900 },
            { month: 'Nov', revenue: 980000, customers: 5300 },
            { month: 'Dec', revenue: 1100000, customers: 5600 },
            { month: 'Jan', revenue: 1200000, customers: 5800 }
        ],
        interventions: { required: 18, completed: 13, overdue: 2, unresponsive: 1, upcoming: 3 }
    },
    {
        id: 'sme_2',
        name: 'GreenSolutions',
        sector: 'CleanEnergy',
        stage: 'Early Growth',
        status: 'Active',
        risk: 'Medium',
        valuation: 2800000,
        investment: 500000,
        progress: 56,
        lastUpdate: '2026-01-08',
        metrics: { revenue: 840000, customers: 1200, employees: 18, growthRate: 42 },
        timeseries: [
            { month: 'Aug', revenue: 420000, customers: 700 },
            { month: 'Sep', revenue: 480000, customers: 820 },
            { month: 'Oct', revenue: 560000, customers: 900 },
            { month: 'Nov', revenue: 620000, customers: 980 },
            { month: 'Dec', revenue: 740000, customers: 1100 },
            { month: 'Jan', revenue: 840000, customers: 1200 }
        ],
        interventions: { required: 14, completed: 8, overdue: 3, unresponsive: 2, upcoming: 2 }
    },
    {
        id: 'sme_3',
        name: 'HealthPlus',
        sector: 'HealthTech',
        stage: 'Seed',
        status: 'Warning',
        risk: 'High',
        valuation: 1200000,
        investment: 300000,
        progress: 45,
        lastUpdate: '2025-12-28',
        metrics: { revenue: 320000, customers: 1500, employees: 12, growthRate: 85 },
        timeseries: [
            { month: 'Aug', revenue: 90000, customers: 800 },
            { month: 'Sep', revenue: 120000, customers: 920 },
            { month: 'Oct', revenue: 180000, customers: 1050 },
            { month: 'Nov', revenue: 240000, customers: 1200 },
            { month: 'Dec', revenue: 280000, customers: 1400 },
            { month: 'Jan', revenue: 320000, customers: 1500 }
        ],
        interventions: { required: 16, completed: 6, overdue: 6, unresponsive: 4, upcoming: 1 }
    },
    {
        id: 'sme_4',
        name: 'EduConnect',
        sector: 'EdTech',
        stage: 'Growth',
        status: 'Active',
        risk: 'Low',
        valuation: 3800000,
        investment: 650000,
        progress: 81,
        lastUpdate: '2026-01-16',
        metrics: { revenue: 950000, customers: 8500, employees: 27, growthRate: 74 },
        timeseries: [
            { month: 'Aug', revenue: 520000, customers: 6200 },
            { month: 'Sep', revenue: 610000, customers: 6800 },
            { month: 'Oct', revenue: 700000, customers: 7400 },
            { month: 'Nov', revenue: 820000, customers: 7900 },
            { month: 'Dec', revenue: 900000, customers: 8300 },
            { month: 'Jan', revenue: 950000, customers: 8500 }
        ],
        interventions: { required: 20, completed: 17, overdue: 1, unresponsive: 0, upcoming: 4 }
    }
]

const PortfolioPage: React.FC = () => {
    const screens = useBreakpoint()
    const isMobile = !screens.md

    const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [
        dayjs().subtract(6, 'month').startOf('month'),
        dayjs().endOf('day')
    ])

    const [queryText, setQueryText] = useState('')
    const [sector, setSector] = useState<string | undefined>(undefined)
    const [risk, setRisk] = useState<Risk | undefined>(undefined)
    const [stage, setStage] = useState<Stage | undefined>(undefined)

    const [selected, setSelected] = useState<PortfolioSME | null>(null)
    const [open, setOpen] = useState(false)

    const sectors = useMemo(() => {
        return Array.from(new Set(dummyPortfolio.map(x => x.sector))).sort()
    }, [])

    const filtered = useMemo(() => {
        const [from, to] = range
        return dummyPortfolio.filter(s => {
            const matchText =
                !queryText ||
                s.name.toLowerCase().includes(queryText.toLowerCase()) ||
                s.sector.toLowerCase().includes(queryText.toLowerCase())

            const matchSector = !sector || s.sector === sector
            const matchRisk = !risk || s.risk === risk
            const matchStage = !stage || s.stage === stage

            const d = dayjs(s.lastUpdate)
            const matchRange =
                (d.isAfter(from.startOf('day')) || d.isSame(from.startOf('day'))) &&
                (d.isBefore(to.endOf('day')) || d.isSame(to.endOf('day')))

            return matchText && matchSector && matchRisk && matchStage && matchRange
        })
    }, [range, queryText, sector, risk, stage])

    // KPI strip based on filtered data
    const kpis = useMemo(() => {
        const total = filtered.length
        const highRisk = filtered.filter(x => x.risk === 'High').length
        const avgProgress =
            total === 0 ? 0 : Math.round(filtered.reduce((a, b) => a + b.progress, 0) / total)

        const totalValue = filtered.reduce((a, b) => a + b.valuation, 0)

        const totalRequired = filtered.reduce((a, b) => a + b.interventions.required, 0)
        const totalCompleted = filtered.reduce((a, b) => a + b.interventions.completed, 0)
        const completionRate = totalRequired <= 0 ? 0 : Math.round((totalCompleted / totalRequired) * 100)

        return { total, highRisk, avgProgress, totalValue, totalRequired, totalCompleted, completionRate }
    }, [filtered])

    const openPerformance = (s: PortfolioSME) => {
        setSelected(s)
        setOpen(true)
    }

    const revenueCustomersChart = useMemo(() => {
        if (!selected) return null

        const cats = selected.timeseries.map(x => x.month)
        const revenue = selected.timeseries.map(x => x.revenue)
        const customers = selected.timeseries.map(x => x.customers)

        return {
            chart: { type: 'column', height: 300 },
            title: { text: 'Growth Trend' },
            xAxis: { categories: cats },
            yAxis: [{ title: { text: 'Revenue (ZAR)' } }, { title: { text: 'Customers' }, opposite: true }],
            tooltip: { shared: true },
            plotOptions: { column: { borderRadius: 6 } },
            series: [
                { name: 'Revenue', type: 'column', data: revenue as any, yAxis: 0 },
                { name: 'Customers', type: 'line', data: customers as any, yAxis: 1 }
            ]
        } as Highcharts.Options
    }, [selected])

    const executionDonut = useMemo(() => {
        if (!selected) return null
        const c = selected.interventions.completed
        const r = Math.max(selected.interventions.required - c, 0)

        return {
            chart: { type: 'pie', height: 280 },
            title: { text: 'Execution (Required vs Completed)' },
            tooltip: { pointFormat: '<b>{point.y}</b>' },
            plotOptions: {
                pie: {
                    innerSize: '65%',
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            // @ts-ignore
                            return `${this.point.name}: ${this.point.y}`
                        }
                    }
                }
            },
            series: [
                {
                    name: 'Items',
                    data: [
                        { name: 'Completed', y: c },
                        { name: 'Remaining', y: r }
                    ] as any
                }
            ]
        } as Highcharts.Options
    }, [selected])

    const columns: ColumnsType<PortfolioSME> = [
        {
            title: 'SME',
            key: 'name',
            render: (_, r) => (
                <Space>
                    <Avatar style={{ borderRadius: 10 }}>{makeInitials(r.name)}</Avatar>
                    <div style={{ lineHeight: 1.1 }}>
                        <Text strong>{r.name}</Text>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>{r.sector}</div>
                    </div>
                </Space>
            ),
            sorter: (a, b) => a.name.localeCompare(b.name)
        },
        {
            title: 'Stage',
            dataIndex: 'stage',
            key: 'stage',
            render: v => <Tag color={stageColor(v)}>{v}</Tag>
        },
        {
            title: 'Risk',
            dataIndex: 'risk',
            key: 'risk',
            render: v => <Tag color={riskColor(v)}>{v}</Tag>
        },
        {
            title: 'Progress',
            dataIndex: 'progress',
            key: 'progress',
            render: (v: number, r) => (
                <div style={{ minWidth: 160 }}>
                    <Progress
                        percent={v}
                        size="small"
                        status={r.risk === 'High' ? 'exception' : v >= 80 ? 'success' : 'active'}
                    />
                </div>
            ),
            sorter: (a, b) => a.progress - b.progress
        },
        {
            title: 'Valuation',
            dataIndex: 'valuation',
            key: 'valuation',
            render: v => <Text>{formatCurrency(v)}</Text>,
            sorter: (a, b) => a.valuation - b.valuation
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: v => <Tag color={statusColor(v)}>{v}</Tag>
        },
        {
            title: '',
            key: 'action',
            align: 'right',
            render: (_, r) => (
                <Button icon={<EyeOutlined />} type="primary" onClick={() => openPerformance(r)}>
                    View Performance
                </Button>
            )
        }
    ]

    return (
        <div style={{ minHeight: '100vh', padding: 24 }}>
            <Helmet>
                <title>Portfolio | Director</title>
            </Helmet>

            <DashboardHeaderCard
                title="Portfolio"
                subtitle="Track SME performance, spot risks early, and drill into execution."
                extraRight={
                    <Space wrap size="middle" style={{ width: '100%', justifyContent: 'center' }}>
                        <RangePicker
                            value={range}
                            onChange={v => {
                                if (!v?.[0] || !v?.[1]) return
                                setRange([v[0], v[1]])
                            }}
                            allowClear={false}
                        />

                        <Input
                            allowClear
                            prefix={<SearchOutlined />}
                            placeholder="Search SME or sector..."
                            value={queryText}
                            onChange={e => setQueryText(e.target.value)}
                            style={{ width: isMobile ? 220 : 280 }}
                        />

                        <Select
                            allowClear
                            placeholder="Sector"
                            value={sector}
                            onChange={setSector}
                            style={{ width: 170 }}
                            options={sectors.map(s => ({ value: s, label: s }))}
                        />

                        <Select
                            allowClear
                            placeholder="Risk"
                            value={risk}
                            onChange={setRisk}
                            style={{ width: 140 }}
                            options={[
                                { value: 'Low', label: 'Low' },
                                { value: 'Medium', label: 'Medium' },
                                { value: 'High', label: 'High' }
                            ]}
                        />

                        <Select
                            allowClear
                            placeholder="Stage"
                            value={stage}
                            onChange={setStage}
                            style={{ width: 170 }}
                            options={[
                                { value: 'Seed', label: 'Seed' },
                                { value: 'Startup', label: 'Startup' },
                                { value: 'Early Growth', label: 'Early Growth' },
                                { value: 'Growth', label: 'Growth' },
                                { value: 'Mature', label: 'Mature' }
                            ]}
                        />
                    </Space>
                }
            />

            {/* KPI strip */}
            <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                <Col xs={24} md={6}>
                    <MotionCard style={{ borderRadius: 18 }} bodyStyle={{ padding: 16 }}>
                        <Space align="start">
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 12,
                                    display: 'grid',
                                    placeItems: 'center',
                                    background: 'rgba(24,144,255,0.12)'
                                }}
                            >
                                <TeamOutlined style={{ color: '#1677ff' }} />
                            </div>
                            <div>
                                <Text type="secondary">Portfolio SMEs</Text>
                                <div style={{ fontSize: 22, fontWeight: 700 }}>{kpis.total}</div>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>

                <Col xs={24} md={6}>
                    <MotionCard style={{ borderRadius: 18 }} bodyStyle={{ padding: 16 }}>
                        <Space align="start">
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 12,
                                    display: 'grid',
                                    placeItems: 'center',
                                    background: 'rgba(245,158,11,0.14)'
                                }}
                            >
                                <WarningOutlined style={{ color: '#d97706' }} />
                            </div>
                            <div>
                                <Text type="secondary">High Risk</Text>
                                <div style={{ fontSize: 22, fontWeight: 700 }}>{kpis.highRisk}</div>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>

                <Col xs={24} md={6}>
                    <MotionCard style={{ borderRadius: 18 }} bodyStyle={{ padding: 16 }}>
                        <Space align="start">
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 12,
                                    display: 'grid',
                                    placeItems: 'center',
                                    background: 'rgba(34,197,94,0.12)'
                                }}
                            >
                                <RiseOutlined style={{ color: '#16a34a' }} />
                            </div>
                            <div>
                                <Text type="secondary">Avg Progress</Text>
                                <div style={{ fontSize: 22, fontWeight: 700 }}>{kpis.avgProgress}%</div>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>

                <Col xs={24} md={6}>
                    <MotionCard style={{ borderRadius: 18 }} bodyStyle={{ padding: 16 }}>
                        <Space align="start">
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 12,
                                    display: 'grid',
                                    placeItems: 'center',
                                    background: 'rgba(168,85,247,0.12)'
                                }}
                            >
                                <DollarOutlined style={{ color: '#a855f7' }} />
                            </div>
                            <div>
                                <Text type="secondary">Portfolio Value</Text>
                                <div style={{ fontSize: 18, fontWeight: 800 }}>{formatCurrency(kpis.totalValue)}</div>
                            </div>
                        </Space>

                        <Divider style={{ margin: '10px 0' }} />

                        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Execution
                            </Text>
                            <Text strong style={{ fontSize: 12 }}>
                                {kpis.totalCompleted}/{kpis.totalRequired} ({kpis.completionRate}%)
                            </Text>
                        </Space>
                    </MotionCard>
                </Col>
            </Row>

            {/* Table */}
            <Card style={{ borderRadius: 18, marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>
                            SMEs
                        </Title>
                        <Text type="secondary">Click “View Performance” for a focused drill-down.</Text>
                    </div>
                    <Tag icon={<AppstoreOutlined />} color="blue" style={{ borderRadius: 999, paddingInline: 12 }}>
                        Portfolio View
                    </Tag>
                </div>

                <Divider style={{ margin: '12px 0' }} />

                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={filtered}
                    pagination={{ pageSize: 8, showSizeChanger: true }}
                />
            </Card>

            {/* Performance Modal */}
            <Modal
                open={open}
                onCancel={() => setOpen(false)}
                footer={null}
                width={isMobile ? '100%' : 980}
                style={isMobile ? { top: 0, paddingBottom: 0 } : undefined}
                title={
                    selected ? (
                        <Space>
                            <Avatar style={{ borderRadius: 12 }}>{makeInitials(selected.name)}</Avatar>
                            <div style={{ lineHeight: 1.1 }}>
                                <Text strong style={{ fontSize: 16 }}>
                                    {selected.name}
                                </Text>
                                <div style={{ fontSize: 12, opacity: 0.75 }}>
                                    {selected.sector} • <Tag color={stageColor(selected.stage)}>{selected.stage}</Tag>{' '}
                                    <Tag color={riskColor(selected.risk)}>{selected.risk} Risk</Tag>
                                </div>
                            </div>
                        </Space>
                    ) : (
                        'SME Performance'
                    )
                }
            >
                {selected && (
                    <>
                        <Row gutter={[12, 12]}>
                            <Col xs={24} md={6}>
                                <Card style={{ borderRadius: 16 }}>
                                    <Statistic
                                        title="Revenue"
                                        value={selected.metrics.revenue}
                                        formatter={v => formatCurrency(Number(v))}
                                        prefix={<DollarOutlined />}
                                    />
                                </Card>
                            </Col>

                            <Col xs={24} md={6}>
                                <Card style={{ borderRadius: 16 }}>
                                    <Statistic title="Customers" value={selected.metrics.customers} prefix={<TeamOutlined />} />
                                </Card>
                            </Col>

                            <Col xs={24} md={6}>
                                <Card style={{ borderRadius: 16 }}>
                                    <Statistic title="Growth Rate" value={selected.metrics.growthRate} suffix="%" prefix={<ThunderboltOutlined />} />
                                </Card>
                            </Col>

                            <Col xs={24} md={6}>
                                <Card style={{ borderRadius: 16 }}>
                                    <Statistic title="Progress" value={selected.progress} suffix="%" prefix={<CheckCircleOutlined />} />
                                </Card>
                            </Col>
                        </Row>

                        <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                            <Col xs={24} md={14}>
                                <Card style={{ borderRadius: 16 }}>
                                    <HighchartsReact highcharts={Highcharts} options={revenueCustomersChart as any} />
                                </Card>
                            </Col>

                            <Col xs={24} md={10}>
                                <Card style={{ borderRadius: 16 }}>
                                    <HighchartsReact highcharts={Highcharts} options={executionDonut as any} />

                                    <Divider style={{ margin: '10px 0' }} />

                                    <Row gutter={[10, 10]}>
                                        <Col span={12}>
                                            <Tooltip title="Overdue interventions">
                                                <Card style={{ borderRadius: 14 }}>
                                                    <Space>
                                                        <WarningOutlined style={{ color: '#d97706' }} />
                                                        <div>
                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                Overdue
                                                            </Text>
                                                            <div style={{ fontSize: 18, fontWeight: 800 }}>{selected.interventions.overdue}</div>
                                                        </div>
                                                    </Space>
                                                </Card>
                                            </Tooltip>
                                        </Col>

                                        <Col span={12}>
                                            <Tooltip title="SMEs waiting on response/actions">
                                                <Card style={{ borderRadius: 14 }}>
                                                    <Space>
                                                        <FundOutlined style={{ color: '#1677ff' }} />
                                                        <div>
                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                Unresponsive
                                                            </Text>
                                                            <div style={{ fontSize: 18, fontWeight: 800 }}>{selected.interventions.unresponsive}</div>
                                                        </div>
                                                    </Space>
                                                </Card>
                                            </Tooltip>
                                        </Col>

                                        <Col span={12}>
                                            <Tooltip title="Upcoming due items">
                                                <Card style={{ borderRadius: 14 }}>
                                                    <Space>
                                                        <RiseOutlined style={{ color: '#16a34a' }} />
                                                        <div>
                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                Upcoming
                                                            </Text>
                                                            <div style={{ fontSize: 18, fontWeight: 800 }}>{selected.interventions.upcoming}</div>
                                                        </div>
                                                    </Space>
                                                </Card>
                                            </Tooltip>
                                        </Col>

                                        <Col span={12}>
                                            <Tooltip title="Required interventions total">
                                                <Card style={{ borderRadius: 14 }}>
                                                    <Space>
                                                        <CheckCircleOutlined style={{ color: '#a855f7' }} />
                                                        <div>
                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                Required
                                                            </Text>
                                                            <div style={{ fontSize: 18, fontWeight: 800 }}>{selected.interventions.required}</div>
                                                        </div>
                                                    </Space>
                                                </Card>
                                            </Tooltip>
                                        </Col>
                                    </Row>
                                </Card>
                            </Col>
                        </Row>
                    </>
                )}
            </Modal>
        </div>
    )
}

export default PortfolioPage
