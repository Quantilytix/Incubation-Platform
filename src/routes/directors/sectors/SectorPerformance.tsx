import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    Avatar,
    Button,
    Card,
    Col,
    DatePicker,
    Divider,
    Drawer,
    Grid,
    Input,
    Progress,
    Row,
    Select,
    Space,
    Statistic,
    Table,
    Tag,
    Typography,
    Empty,
    Spin,
    message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Helmet } from 'react-helmet'
import dayjs, { Dayjs } from 'dayjs'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import Drilldown from 'highcharts/modules/drilldown'
import {
    SearchOutlined,
    EyeOutlined,
    RiseOutlined,
    WarningOutlined,
    TeamOutlined,
    DollarOutlined,
    PieChartOutlined,
    AppstoreOutlined,
    CheckCircleOutlined,
    ThunderboltOutlined,
    ApartmentOutlined,
    CrownOutlined,
    AlertOutlined
} from '@ant-design/icons'
import {
    collection,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
    type DocumentData,
    type Unsubscribe
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'

if (typeof Drilldown === 'function') {
    Drilldown(Highcharts)
}

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
    progress: number
    lastUpdate: string // YYYY-MM-DD
    metrics: { revenue: number; customers: number; employees: number; growthRate: number }
}

type SectorRollup = {
    sector: string
    companies: number
    avgProgress: number
    avgGrowth: number
    totalRevenue: number
    totalValuation: number
    highRisk: number
    mediumRisk: number
    lowRisk: number
    topPerformers: PortfolioSME[]
    riskList: PortfolioSME[] // high/medium sorted
}

type AnyDoc = { id: string } & Record<string, any>

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value || 0)

const riskColor = (risk: Risk) => {
    if (risk === 'High') return 'red'
    if (risk === 'Medium') return 'orange'
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
    String(name || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(s => s[0]?.toUpperCase())
        .join('')

const toNumber = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
}

const toISODate = (v: any): string | null => {
    if (!v) return null
    if (typeof v === 'string') {
        const d = dayjs(v)
        return d.isValid() ? d.format('YYYY-MM-DD') : null
    }
    if (typeof v?.toDate === 'function') {
        return dayjs(v.toDate()).format('YYYY-MM-DD')
    }
    return null
}

const normalizeStage = (v: any): Stage | null => {
    const s = String(v || '').toLowerCase()
    if (!s) return null
    if (s.includes('seed')) return 'Seed'
    if (s.includes('startup')) return 'Startup'
    if (s.includes('early')) return 'Early Growth'
    if (s.includes('growth')) return 'Growth'
    if (s.includes('mature')) return 'Mature'
    return null
}

const deriveStageFromAcceptedAt = (acceptedAtISO?: string | null): Stage => {
    if (!acceptedAtISO) return 'Startup'
    const months = dayjs().diff(dayjs(acceptedAtISO), 'month')
    if (months <= 3) return 'Seed'
    if (months <= 9) return 'Startup'
    if (months <= 18) return 'Early Growth'
    if (months <= 36) return 'Growth'
    return 'Mature'
}

const deriveGrowthRateFromRevenue = (revNow: number, revPrev: number) => {
    if (revPrev <= 0) return revNow > 0 ? 100 : 0
    return Math.round(((revNow - revPrev) / revPrev) * 100)
}

const deriveRisk = (progress: number, growthRate: number): Risk => {
    if (progress < 45 || growthRate < 20) return 'High'
    if (progress < 65 || growthRate < 40) return 'Medium'
    return 'Low'
}

const deriveStatus = (raw: any, risk: Risk): 'Active' | 'Warning' | 'Paused' => {
    const s = String(raw || '').toLowerCase()
    if (s.includes('pause')) return 'Paused'
    if (s.includes('warning')) return 'Warning'
    if (risk === 'High') return 'Warning'
    return 'Active'
}

const pick = <T,>(...vals: T[]): T | undefined => vals.find(v => v !== undefined && v !== null)

const SectorsPage: React.FC = () => {
    const { user } = useFullIdentity()
    const screens = useBreakpoint()
    const isMobile = !screens.md

    const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [
        dayjs().subtract(6, 'month').startOf('month'),
        dayjs().endOf('day')
    ])
    const [queryText, setQueryText] = useState('')
    const [selectedSector, setSelectedSector] = useState<string | undefined>(undefined)

    const [drillSector, setDrillSector] = useState<string | null>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)

    const [loading, setLoading] = useState(true)
    const [acceptedMap, setAcceptedMap] = useState<Record<string, { acceptedAt?: string | null }>>({})
    const [participants, setParticipants] = useState<AnyDoc[]>([])
    const [perfMap, setPerfMap] = useState<
        Record<
            string,
            {
                progress?: number
                growthRate?: number
                lastUpdate?: string | null
                revenueNow?: number
                revenuePrev?: number
            }
        >
    >({})

    const hydrateRunId = useRef(0)

    useEffect(() => {
        if (!user?.companyCode) return

        const unsubs: Unsubscribe[] = []
        setLoading(true)

        // Applications: only accepted SMEs for the active program (if present)
        try {
            const base = [
                where('companyCode', '==', user.companyCode),
                where('applicationStatus', '==', 'accepted')
            ] as any[]

            const activeProgramId = (user as any)?.activeProgramId
            if (activeProgramId) {
                base.push(where('programId', '==', activeProgramId))
            }

            const aq = query(collection(db, 'applications'), ...base)
            unsubs.push(
                onSnapshot(
                    aq,
                    snap => {
                        const next: Record<string, { acceptedAt?: string | null }> = {}
                        snap.docs.forEach(d => {
                            const data = d.data() as DocumentData
                            const participantId = String(
                                pick<any>(data.participantId, data.participantID, data.participant_id, data.smeId, data.smeID, d.id) || d.id
                            )
                            const acceptedAtISO =
                                toISODate(data.acceptedAt) ||
                                toISODate(data.approvedAt) ||
                                toISODate(data.updatedAt) ||
                                toISODate(data.createdAt) ||
                                null
                            next[participantId] = { acceptedAt: acceptedAtISO }
                        })
                        setAcceptedMap(next)
                    },
                    e => {
                        console.log('[SectorsPage] applications snapshot failed', e)
                        message.error('Failed to load applications.')
                    }
                )
            )
        } catch (e) {
            console.log('[SectorsPage] applications init failed', e)
            message.error('Failed to initialize applications feed.')
        }

        // Participants: pull all, then filter by accepted IDs
        try {
            const pq = query(collection(db, 'participants'), where('companyCode', '==', user.companyCode))
            unsubs.push(
                onSnapshot(
                    pq,
                    snap => {
                        const next = snap.docs.map(d => ({ id: d.id, ...(d.data() as DocumentData) } as AnyDoc))
                        setParticipants(next)
                        setLoading(false)
                    },
                    e => {
                        console.log('[SectorsPage] participants snapshot failed', e)
                        setLoading(false)
                        message.error('Failed to load participants.')
                    }
                )
            )
        } catch (e) {
            console.log('[SectorsPage] participants init failed', e)
            setLoading(false)
            message.error('Failed to initialize participants feed.')
        }

        return () => unsubs.forEach(u => u())
    }, [user?.companyCode, (user as any)?.activeProgramId])

    const acceptedIds = useMemo(() => new Set(Object.keys(acceptedMap || {})), [acceptedMap])

    const acceptedParticipants = useMemo(() => {
        if (!acceptedIds.size) return []
        return participants.filter(p => acceptedIds.has(String(p.id)))
    }, [participants, acceptedIds])

    // Hydrate latest performance per accepted participant:
    // monthlyPerformance/{participantId}/history (latest doc)
    useEffect(() => {
        if (!user?.companyCode) return
        if (!acceptedParticipants.length) {
            setPerfMap({})
            return
        }

        const runId = ++hydrateRunId.current

        const run = async () => {
            const next: typeof perfMap = {}

            // Keep it bounded for UI responsiveness
            const ids = acceptedParticipants.map(p => String(p.id))

            await Promise.all(
                ids.map(async participantId => {
                    try {
                        const hq = query(
                            collection(db, 'monthlyPerformance', participantId, 'history'),
                            orderBy('createdAt', 'desc'),
                            limit(1)
                        )
                        const snap = await getDocs(hq)
                        const d = snap.docs[0]
                        const data = d?.data() as DocumentData | undefined

                        // tolerate schema variations
                        const progress = toNumber(
                            pick<any>(data?.progress, data?.overallProgress, data?.score, data?.overallScore)
                        )
                        const growthRate = toNumber(pick<any>(data?.growthRate, data?.revenueGrowthRate, data?.growth))
                        const lastUpdate =
                            toISODate(pick<any>(data?.asOfDate, data?.periodEnd, data?.date, data?.createdAt, data?.updatedAt)) ||
                            null

                        // If performance doc contains revenue snapshots, use them
                        const revenueNow = toNumber(pick<any>(data?.revenue, data?.totalRevenue, data?.revenueNow))
                        const revenuePrev = toNumber(pick<any>(data?.revenuePrev, data?.previousRevenue))

                        next[participantId] = {
                            progress: progress || undefined,
                            growthRate: growthRate || undefined,
                            lastUpdate,
                            revenueNow: revenueNow || undefined,
                            revenuePrev: revenuePrev || undefined
                        }
                    } catch (e) {
                        // no history or missing index: just skip
                        next[participantId] = {}
                    }
                })
            )

            if (hydrateRunId.current !== runId) return
            setPerfMap(next)
        }

        run().catch(e => console.log('[SectorsPage] hydrate performance failed', e))
    }, [user?.companyCode, acceptedParticipants])

    const smes: PortfolioSME[] = useMemo(() => {
        return acceptedParticipants.map(p => {
            const acceptedAt = acceptedMap[String(p.id)]?.acceptedAt || null
            const perf = perfMap[String(p.id)] || {}

            const name = String(p.businessName || p.name || p.companyName || p.smeName || p.tradeName || '—')
            const sector = String(p.sector || p.industry || p.businessSector || 'Unspecified')

            // Revenue from participant revenueHistory array (fallbacks)
            const revHistory = Array.isArray(p.revenueHistory) ? p.revenueHistory : []
            const revSorted = [...revHistory]
                .map(x => ({
                    date: toISODate(x?.date || x?.month || x?.period || x?.createdAt) || null,
                    value: toNumber(x?.revenue ?? x?.amount ?? x?.value)
                }))
                .filter(x => x.value > 0)

            const revNowFromHistory = revSorted.length ? revSorted[revSorted.length - 1].value : 0
            const revPrevFromHistory = revSorted.length >= 2 ? revSorted[revSorted.length - 2].value : 0

            const revenueNow = toNumber(pick<any>(perf.revenueNow, p.totalRevenue, p.revenue, revNowFromHistory))
            const revenuePrev = toNumber(pick<any>(perf.revenuePrev, revPrevFromHistory))

            const growthRate =
                toNumber(pick<any>(perf.growthRate, p.growthRate, p.revenueGrowthRate)) ||
                deriveGrowthRateFromRevenue(revenueNow, revenuePrev)

            const progress = Math.max(
                0,
                Math.min(
                    100,
                    toNumber(
                        pick<any>(
                            perf.progress,
                            p.progress,
                            p.overallProgress,
                            p.kpiProgress,
                            p.score,
                            p.overallScore
                        )
                    )
                )
            )

            const stage = normalizeStage(p.stage) || deriveStageFromAcceptedAt(acceptedAt)

            const risk = deriveRisk(progress, growthRate)
            const status = deriveStatus(p.status, risk)

            const employees = toNumber(pick<any>(p.employees, p.workers, p.numberOfWorkers, p.staffCount))
            const customers = toNumber(pick<any>(p.customers, p.customerCount, p.clients, p.clientCount))

            const valuation = toNumber(pick<any>(p.valuation, p.companyValuation))
            const investment = toNumber(pick<any>(p.investment, p.totalInvestment, p.fundingReceived))

            const lastUpdate =
                perf.lastUpdate ||
                toISODate(p.updatedAt) ||
                toISODate(p.createdAt) ||
                acceptedAt ||
                dayjs().format('YYYY-MM-DD')

            return {
                id: String(p.id),
                name,
                sector,
                stage,
                status,
                risk,
                valuation,
                investment,
                progress,
                lastUpdate: String(lastUpdate),
                metrics: { revenue: revenueNow, customers, employees, growthRate }
            }
        })
    }, [acceptedParticipants, acceptedMap, perfMap])

    const inRange = (d: string) => {
        const [from, to] = range
        const x = dayjs(d)
        return (
            (x.isAfter(from.startOf('day')) || x.isSame(from.startOf('day'))) &&
            (x.isBefore(to.endOf('day')) || x.isSame(to.endOf('day')))
        )
    }

    const filteredSMEs = useMemo(() => {
        return smes.filter(s => {
            const matchText =
                !queryText ||
                s.name.toLowerCase().includes(queryText.toLowerCase()) ||
                s.sector.toLowerCase().includes(queryText.toLowerCase())

            const matchSector = !selectedSector || s.sector === selectedSector
            const matchRange = inRange(s.lastUpdate)

            return matchText && matchSector && matchRange
        })
    }, [smes, queryText, selectedSector, range])

    const sectorOptions = useMemo(() => {
        return Array.from(new Set(smes.map(x => x.sector))).sort()
    }, [smes])

    const sectorRollups: SectorRollup[] = useMemo(() => {
        const bySector: Record<string, PortfolioSME[]> = {}
        filteredSMEs.forEach(s => {
            bySector[s.sector] = bySector[s.sector] || []
            bySector[s.sector].push(s)
        })

        return Object.keys(bySector)
            .sort()
            .map(sector => {
                const list = bySector[sector] || []
                const companies = list.length
                const totalRevenue = list.reduce((a, b) => a + b.metrics.revenue, 0)
                const totalValuation = list.reduce((a, b) => a + b.valuation, 0)
                const avgProgress = companies ? Math.round(list.reduce((a, b) => a + b.progress, 0) / companies) : 0
                const avgGrowth = companies ? Math.round(list.reduce((a, b) => a + b.metrics.growthRate, 0) / companies) : 0

                const highRisk = list.filter(x => x.risk === 'High').length
                const mediumRisk = list.filter(x => x.risk === 'Medium').length
                const lowRisk = list.filter(x => x.risk === 'Low').length

                const topPerformers = [...list].sort((a, b) => b.progress - a.progress).slice(0, 5)
                const riskList = [...list]
                    .filter(x => x.risk !== 'Low')
                    .sort((a, b) => (a.risk === b.risk ? b.progress - a.progress : a.risk === 'High' ? -1 : 1))
                    .slice(0, 8)

                return {
                    sector,
                    companies,
                    avgProgress,
                    avgGrowth,
                    totalRevenue,
                    totalValuation,
                    highRisk,
                    mediumRisk,
                    lowRisk,
                    topPerformers,
                    riskList
                }
            })
    }, [filteredSMEs])

    const globalKpis = useMemo(() => {
        const totalSectors = sectorRollups.length
        const totalCompanies = filteredSMEs.length
        const totalRevenue = filteredSMEs.reduce((a, b) => a + b.metrics.revenue, 0)
        const totalValuation = filteredSMEs.reduce((a, b) => a + b.valuation, 0)

        const avgProgress = totalCompanies
            ? Math.round(filteredSMEs.reduce((a, b) => a + b.progress, 0) / totalCompanies)
            : 0

        const highRisk = filteredSMEs.filter(x => x.risk === 'High').length
        const riskRate = totalCompanies ? Math.round((highRisk / totalCompanies) * 100) : 0

        const bestSector = sectorRollups.length
            ? [...sectorRollups].sort((a, b) => b.avgProgress - a.avgProgress)[0]?.sector
            : '—'

        return { totalSectors, totalCompanies, totalRevenue, totalValuation, avgProgress, highRisk, riskRate, bestSector }
    }, [sectorRollups, filteredSMEs])

    const sectorPerformanceChart = useMemo(() => {
        const categories = sectorRollups.map(x => x.sector)
        const data = sectorRollups.map(x => ({
            name: x.sector,
            y: x.avgProgress,
            drilldown: x.sector
        }))

        const drillSeries = sectorRollups.map(s => ({
            id: s.sector,
            name: `${s.sector} Top Performers`,
            type: 'column',
            data: s.topPerformers.map(p => [p.name, p.progress])
        }))

        return {
            chart: { type: 'column', height: 360 },
            title: { text: 'Sector Performance (Avg Progress)' },
            subtitle: { text: 'Click a sector to drill into top performers' },
            xAxis: { categories, labels: { style: { fontSize: '11px' } } },
            yAxis: { min: 0, max: 100, title: { text: 'Avg Progress (%)' } },
            tooltip: { pointFormat: '<b>{point.y}%</b>' },
            plotOptions: { column: { borderRadius: 6 } },
            series: [{ name: 'Avg Progress', data: data as any }],
            drilldown: { series: drillSeries as any }
        } as Highcharts.Options
    }, [sectorRollups])

    const sectorRiskChart = useMemo(() => {
        const categories = sectorRollups.map(x => x.sector)
        const low = sectorRollups.map(x => x.lowRisk)
        const med = sectorRollups.map(x => x.mediumRisk)
        const high = sectorRollups.map(x => x.highRisk)

        return {
            chart: { type: 'bar', height: 360, backgroundColor: 'transparent' },
            title: { text: 'Risk Mix by Sector' },
            xAxis: { categories, labels: { style: { fontSize: '11px' } } },
            yAxis: { min: 0, title: { text: 'SMEs' } },
            tooltip: { shared: true },
            legend: { itemStyle: { fontWeight: '600' } },
            plotOptions: { series: { stacking: 'normal', borderRadius: 6 } },
            series: [
                { name: 'Low', data: low as any, color: '#22c55e' },     // green
                { name: 'Medium', data: med as any, color: '#f59e0b' },  // amber
                { name: 'High', data: high as any, color: '#ef4444' }    // red
            ]
        } as Highcharts.Options
    }, [sectorRollups])

    const sectorTableCols: ColumnsType<SectorRollup> = [
        {
            title: 'Sector',
            dataIndex: 'sector',
            key: 'sector',
            render: (v: string) => (
                <Space>
                    <Avatar style={{ borderRadius: 10 }} icon={<ApartmentOutlined />} />
                    <Text strong>{v}</Text>
                </Space>
            ),
            sorter: (a, b) => a.sector.localeCompare(b.sector)
        },
        {
            title: 'Companies',
            dataIndex: 'companies',
            key: 'companies',
            sorter: (a, b) => a.companies - b.companies
        },
        {
            title: 'Avg Progress',
            dataIndex: 'avgProgress',
            key: 'avgProgress',
            render: (v: number) => (
                <div style={{ minWidth: 160 }}>
                    <Progress percent={v} size="small" status={v >= 80 ? 'success' : v < 50 ? 'exception' : 'active'} />
                </div>
            ),
            sorter: (a, b) => a.avgProgress - b.avgProgress
        },
        {
            title: 'Avg Growth',
            dataIndex: 'avgGrowth',
            key: 'avgGrowth',
            render: (v: number) => (
                <Tag icon={<RiseOutlined />} color={v >= 60 ? 'green' : v < 35 ? 'orange' : 'blue'}>
                    {v}%
                </Tag>
            ),
            sorter: (a, b) => a.avgGrowth - b.avgGrowth
        },
        {
            title: 'Revenue',
            dataIndex: 'totalRevenue',
            key: 'totalRevenue',
            render: (v: number) => <Text>{formatCurrency(v)}</Text>,
            sorter: (a, b) => a.totalRevenue - b.totalRevenue
        },
        {
            title: 'High Risk',
            dataIndex: 'highRisk',
            key: 'highRisk',
            render: (v: number) => <Tag color={v > 0 ? 'red' : 'green'}>{v}</Tag>,
            sorter: (a, b) => a.highRisk - b.highRisk
        },
        {
            title: '',
            key: 'actions',
            align: 'right',
            render: (_, r) => (
                <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={() => {
                        setDrillSector(r.sector)
                        setDrawerOpen(true)
                    }}
                >
                    Drilldown
                </Button>
            )
        }
    ]

    const drillData = useMemo(() => {
        if (!drillSector) return null
        const roll = sectorRollups.find(x => x.sector === drillSector)
        if (!roll) return null

        const list = filteredSMEs.filter(x => x.sector === drillSector)
        const topByRevenue = [...list].sort((a, b) => b.metrics.revenue - a.metrics.revenue).slice(0, 6)
        const topByProgress = [...list].sort((a, b) => b.progress - a.progress).slice(0, 6)

        const kpi = {
            companies: roll.companies,
            avgProgress: roll.avgProgress,
            avgGrowth: roll.avgGrowth,
            revenue: roll.totalRevenue,
            valuation: roll.totalValuation,
            highRisk: roll.highRisk
        }

        const revenueProgressChart = {
            chart: { type: 'scatter', height: 320 },
            title: { text: `${drillSector}: Revenue vs Progress` },
            xAxis: { title: { text: 'Revenue (ZAR)' } },
            yAxis: { min: 0, max: 100, title: { text: 'Progress (%)' } },
            tooltip: {
                formatter: function () {
                    // @ts-ignore
                    const p = this.point
                    return `<b>${p.name}</b><br/>Revenue: <b>${formatCurrency(p.x)}</b><br/>Progress: <b>${p.y}%</b>`
                }
            },
            series: [
                {
                    name: 'SMEs',
                    data: list.map(s => ({
                        name: s.name,
                        x: s.metrics.revenue,
                        y: s.progress
                    })) as any
                }
            ]
        } as Highcharts.Options

        return { roll, list, topByRevenue, topByProgress, kpi, revenueProgressChart }
    }, [drillSector, sectorRollups, filteredSMEs])

    const smeCols: ColumnsType<PortfolioSME> = [
        {
            title: 'SME',
            key: 'name',
            render: (_, r) => (
                <Space>
                    <Avatar style={{ borderRadius: 10 }}>{makeInitials(r.name)}</Avatar>
                    <div style={{ lineHeight: 1.1 }}>
                        <Text strong>{r.name}</Text>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                            <Tag color={stageColor(r.stage)}>{r.stage}</Tag>
                            <Tag color={riskColor(r.risk)}>{r.risk}</Tag>
                        </div>
                    </div>
                </Space>
            )
        },
        {
            title: 'Progress',
            dataIndex: 'progress',
            key: 'progress',
            render: (v: number, r) => (
                <div style={{ minWidth: 160 }}>
                    <Progress percent={v} size="small" status={r.risk === 'High' ? 'exception' : v >= 80 ? 'success' : 'active'} />
                </div>
            ),
            sorter: (a, b) => a.progress - b.progress
        },
        {
            title: 'Revenue',
            dataIndex: ['metrics', 'revenue'],
            key: 'revenue',
            render: (v: number) => formatCurrency(v),
            sorter: (a, b) => a.metrics.revenue - b.metrics.revenue
        }
    ]

    return (
        <div style={{ minHeight: '100vh', padding: 24 }}>
            <Helmet>
                <title>Sectors Overview | Smart Incubation</title>
            </Helmet>

            <DashboardHeaderCard
                title="Sectors Overview"
                subtitle="Performance across sectors, risk distribution, and drilldowns to top performers."
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
                            placeholder="Search sector or SME..."
                            value={queryText}
                            onChange={e => setQueryText(e.target.value)}
                            style={{ width: isMobile ? 220 : 280 }}
                        />

                        <Select
                            allowClear
                            placeholder="Sector"
                            value={selectedSector}
                            onChange={setSelectedSector}
                            style={{ width: 200 }}
                            options={sectorOptions.map(s => ({ value: s, label: s }))}
                        />

                        <Tag icon={<AppstoreOutlined />} color="blue" style={{ borderRadius: 999, paddingInline: 12 }}>
                            Sector View
                        </Tag>
                    </Space>
                }
            />

            {loading ? (
                <LoadingOverlay tip='Loading sector data...' />
            ) : !acceptedParticipants.length ? (
                <Card style={{ borderRadius: 18, marginTop: 12 }}>
                    <Empty description="No accepted SMEs found for the active program / filters." />
                </Card>
            ) : (
                <>
                    {/* KPIs */}
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
                                        <ApartmentOutlined style={{ color: '#1677ff' }} />
                                    </div>
                                    <div>
                                        <Text type="secondary">Sectors</Text>
                                        <div style={{ fontSize: 22, fontWeight: 700 }}>{globalKpis.totalSectors}</div>
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
                                        <TeamOutlined style={{ color: '#16a34a' }} />
                                    </div>
                                    <div>
                                        <Text type="secondary">SMEs</Text>
                                        <div style={{ fontSize: 22, fontWeight: 700 }}>{globalKpis.totalCompanies}</div>
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
                                        <Text type="secondary">Total Revenue</Text>
                                        <div style={{ fontSize: 18, fontWeight: 800 }}>{formatCurrency(globalKpis.totalRevenue)}</div>
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
                                        <div style={{ fontSize: 22, fontWeight: 700 }}>
                                            {globalKpis.highRisk}{' '}
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                ({globalKpis.riskRate}%)
                                            </Text>
                                        </div>
                                    </div>
                                </Space>
                            </MotionCard>
                        </Col>
                    </Row>

                    {/* Charts */}
                    <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                        <Col xs={24} lg={14}>
                            <Card style={{ borderRadius: 18 }}>
                                {sectorRollups.length ? (
                                    <HighchartsReact highcharts={Highcharts} options={sectorPerformanceChart} />
                                ) : (
                                    <Empty description="No data for this range / filters." />
                                )}
                            </Card>
                        </Col>

                        <Col xs={24} lg={10}>
                            <Card style={{ borderRadius: 18 }}>
                                {sectorRollups.length ? (
                                    <HighchartsReact highcharts={Highcharts} options={sectorRiskChart} />
                                ) : (
                                    <Empty description="No data for this range / filters." />
                                )}
                            </Card>
                        </Col>
                    </Row>

                    {/* Sector Table */}
                    <Card style={{ borderRadius: 18, marginTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <div>
                                <Title level={4} style={{ margin: 0 }}>
                                    Sector Summary
                                </Title>
                                <Text type="secondary">Drill into a sector to see top performers + risk list.</Text>
                            </div>
                            <Tag icon={<PieChartOutlined />} color="blue" style={{ borderRadius: 999, paddingInline: 12 }}>
                                Drilldown Ready
                            </Tag>
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        <Table
                            rowKey="sector"
                            columns={sectorTableCols}
                            dataSource={sectorRollups}
                            pagination={{ pageSize: 8, showSizeChanger: true }}
                        />
                    </Card>

                    {/* Drilldown Drawer */}
                    <Drawer
                        open={drawerOpen}
                        onClose={() => setDrawerOpen(false)}
                        width={isMobile ? '100%' : 720}
                        title={
                            <Space>
                                <Avatar style={{ borderRadius: 12 }} icon={<ApartmentOutlined />} />
                                <div style={{ lineHeight: 1.1 }}>
                                    <Text strong style={{ fontSize: 16 }}>
                                        {drillSector || 'Sector Drilldown'}
                                    </Text>
                                    {drillData?.roll && (
                                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                                            {drillData.roll.companies} SMEs • Avg Progress {drillData.roll.avgProgress}% • High Risk{' '}
                                            {drillData.roll.highRisk}
                                        </div>
                                    )}
                                </div>
                            </Space>
                        }
                    >
                        {!drillData ? (
                            <Empty description="Pick a sector to drill down." />
                        ) : (
                            <>
                                <Row gutter={[12, 12]}>
                                    <Col span={12}>
                                        <Card style={{ borderRadius: 16 }}>
                                            <Statistic
                                                title="Total Revenue"
                                                value={drillData.kpi.revenue}
                                                formatter={v => formatCurrency(Number(v))}
                                                prefix={<DollarOutlined />}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={12}>
                                        <Card style={{ borderRadius: 16 }}>
                                            <Statistic
                                                title="Total Valuation"
                                                value={drillData.kpi.valuation}
                                                formatter={v => formatCurrency(Number(v))}
                                                prefix={<ThunderboltOutlined />}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={12}>
                                        <Card style={{ borderRadius: 16 }}>
                                            <Statistic
                                                title="Avg Progress"
                                                value={drillData.kpi.avgProgress}
                                                suffix="%"
                                                prefix={<CheckCircleOutlined />}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={12}>
                                        <Card style={{ borderRadius: 16 }}>
                                            <Statistic
                                                title="Avg Growth"
                                                value={drillData.kpi.avgGrowth}
                                                suffix="%"
                                                prefix={<RiseOutlined />}
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                <Divider />

                                <Card style={{ borderRadius: 16 }}>
                                    <HighchartsReact highcharts={Highcharts} options={drillData.revenueProgressChart} />
                                </Card>

                                <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                                    <Col xs={24} md={12}>
                                        <Card
                                            style={{ borderRadius: 16 }}
                                            title={
                                                <Space>
                                                    <CrownOutlined />
                                                    Top Performers (Progress)
                                                </Space>
                                            }
                                        >
                                            <Table rowKey="id" columns={smeCols} dataSource={drillData.topByProgress} pagination={false} size="small" />
                                        </Card>
                                    </Col>

                                    <Col xs={24} md={12}>
                                        <Card
                                            style={{ borderRadius: 16 }}
                                            title={
                                                <Space>
                                                    <DollarOutlined />
                                                    Top Earners (Revenue)
                                                </Space>
                                            }
                                        >
                                            <Table rowKey="id" columns={smeCols} dataSource={drillData.topByRevenue} pagination={false} size="small" />
                                        </Card>
                                    </Col>
                                </Row>

                                <Divider />

                                <Card
                                    style={{ borderRadius: 16 }}
                                    title={
                                        <Space>
                                            <AlertOutlined />
                                            Risk Watchlist (High / Medium)
                                        </Space>
                                    }
                                >
                                    {drillData.roll.riskList.length ? (
                                        <Table
                                            rowKey="id"
                                            size="small"
                                            pagination={false}
                                            dataSource={drillData.roll.riskList}
                                            columns={[
                                                {
                                                    title: 'SME',
                                                    key: 'name',
                                                    render: (_, r: PortfolioSME) => (
                                                        <Space>
                                                            <Avatar style={{ borderRadius: 10 }}>{makeInitials(r.name)}</Avatar>
                                                            <div style={{ lineHeight: 1.1 }}>
                                                                <Text strong>{r.name}</Text>
                                                                <div style={{ fontSize: 12, opacity: 0.75 }}>
                                                                    <Tag color={stageColor(r.stage)}>{r.stage}</Tag>
                                                                    <Tag color={riskColor(r.risk)}>{r.risk}</Tag>
                                                                </div>
                                                            </div>
                                                        </Space>
                                                    )
                                                },
                                                {
                                                    title: 'Progress',
                                                    dataIndex: 'progress',
                                                    render: (v: number, r: PortfolioSME) => (
                                                        <div style={{ minWidth: 160 }}>
                                                            <Progress
                                                                percent={v}
                                                                size="small"
                                                                status={r.risk === 'High' ? 'exception' : v >= 80 ? 'success' : 'active'}
                                                            />
                                                        </div>
                                                    )
                                                },
                                                {
                                                    title: 'Revenue',
                                                    dataIndex: ['metrics', 'revenue'],
                                                    render: (v: number) => formatCurrency(v)
                                                }
                                            ]}
                                        />
                                    ) : (
                                        <Empty description="No risk SMEs in this sector." />
                                    )}
                                </Card>
                            </>
                        )}
                    </Drawer>
                </>
            )}
        </div>
    )
}

export default SectorsPage
