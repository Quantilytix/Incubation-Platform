// src/pages/monitoring-evaluation/MonitoringEvaluationEvaluation.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
    Spin,
    Typography,
    Card,
    Select,
    Row,
    Col,
    Empty,
    Segmented,
    Space,
    Statistic,
    Tag,
    Divider,
    Table,
    Tooltip
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Helmet } from 'react-helmet'
import { motion } from 'framer-motion'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import drilldown from 'highcharts/modules/drilldown'
import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { useAssignedInterventions } from '@/contexts/AssignedInterventionsContext'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'
import { FileTextOutlined, DatabaseOutlined, ClockCircleOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'

if (typeof drilldown === 'function') drilldown(Highcharts)
Highcharts.setOptions({ credits: { enabled: false } })

const { Title, Text } = Typography
const { Option } = Select

type ViewKey = 'overview' | 'sme' | 'pipeline'
type AnyDoc = Record<string, any>

type RequiredItem = { id?: string; title?: string; area?: string } & AnyDoc
type Application = {
    id: string
    participantId?: string
    companyCode?: string
    programId?: string | null
    activeProgramId?: string | null
    status?: string
    applicationStatus?: string
    beneficiaryName?: string
    interventions?: { required?: Array<string | RequiredItem> }
} & AnyDoc

const norm = (v: any) => String(v ?? '').trim()
const normLower = (v: any) => norm(v).toLowerCase()

const toDate = (v: any): Date | null => {
    if (!v) return null
    if (v?.toDate) return v.toDate()
    if (typeof v === 'object' && v?.seconds && typeof v.seconds === 'number') return new Date(v.seconds * 1000)
    const d = new Date(v)
    return isNaN(+d) ? null : d
}

const fmtDate = (v: any) => {
    const d = toDate(v)
    if (!d) return '—'
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

const extractRequiredTitles = (a: Application): string[] => {
    const raw = a?.interventions?.required
    if (!Array.isArray(raw)) return []
    const out: string[] = []
    raw.forEach((x: any) => {
        if (typeof x === 'string') {
            const t = norm(x)
            if (t) out.push(t)
            return
        }
        if (x && typeof x === 'object') {
            const t = norm(x.title)
            if (t) out.push(t)
        }
    })
    return Array.from(new Set(out))
}

const extractRequiredTitleToArea = (a: Application): Record<string, string> => {
    const raw = a?.interventions?.required
    if (!Array.isArray(raw)) return {}
    const map: Record<string, string> = {}
    raw.forEach((x: any) => {
        if (!x || typeof x !== 'object') return
        const t = norm(x.title)
        if (!t) return
        map[t] = norm(x.area) || 'Unknown'
    })
    return map
}

// AssignedInterventions status helpers (THIS is what gives you assignee + incubatee)
const isCompletedAssigned = (x: any) => {
    const s = normLower(x?.status)
    if (['completed', 'complete', 'done', 'finished', 'closed'].includes(s)) return true
    // extra safety: if both completion flags are terminal
    if (normLower(x?.assigneeCompletionStatus) === 'done' && ['confirmed', 'rejected'].includes(normLower(x?.incubateeCompletionStatus)))
        return true
    return false
}

const isInProgressAssigned = (x: any) => {
    const s = normLower(x?.status)
    if (['in-progress', 'in_progress', 'in progress', 'ongoing', 'active', 'started', 'assigned'].includes(s)) return !isCompletedAssigned(x)
    // if no status, treat as in-progress unless completed
    return !isCompletedAssigned(x)
}

const MonitoringEvaluationEvaluation: React.FC = () => {
    const { user } = useFullIdentity()
    const companyCode = user?.companyCode ? String(user.companyCode) : null
    const activeProgramId = (user as any)?.activeProgramId || (user as any)?.programId || (user as any)?.currentProgramId || null

    // context (assignee + incubatee live fields)
    const { assignments, loading: assignmentsLoading } = useAssignedInterventions()

    const [appsLoading, setAppsLoading] = useState(true)
    const [applications, setApplications] = useState<Application[]>([])

    const [selectedGender, setSelectedGender] = useState<string>('All')
    const [selectedProvince, setSelectedProvince] = useState<string>('All')
    const [view, setView] = useState<ViewKey>('overview')

    // Participants are needed only for filters (gender/province). We load minimal map.
    const [participantsMap, setParticipantsMap] = useState<Record<string, AnyDoc>>({})
    const [participantsLoading, setParticipantsLoading] = useState(true)

    // ---- Accepted applications (required interventions live here)
    useEffect(() => {
        let u1: Unsubscribe | null = null
        let u2: Unsubscribe | null = null

        if (!companyCode) {
            setApplications([])
            setAppsLoading(false)
            return
        }

        setAppsLoading(true)

        const base: any[] = [where('companyCode', '==', companyCode)]
        const prog: any[] = activeProgramId ? [where('programId', '==', activeProgramId)] : []

        const qStatus = query(collection(db, 'applications'), ...base, ...prog, where('status', '==', 'accepted'))
        const qAppStatus = query(collection(db, 'applications'), ...base, ...prog, where('applicationStatus', '==', 'accepted'))

        const merge = (incoming: Application[]) => {
            setApplications(prev => {
                const map = new Map<string, Application>()
                    ;[...prev, ...incoming].forEach(a => map.set(a.id, a))
                return Array.from(map.values())
            })
        }

        u1 = onSnapshot(
            qStatus,
            snap => {
                merge(snap.docs.map(d => ({ id: d.id, ...(d.data() as AnyDoc) })) as Application[])
                setAppsLoading(false)
            },
            err => {
                console.error(err)
                setAppsLoading(false)
            }
        )

        u2 = onSnapshot(
            qAppStatus,
            snap => {
                merge(snap.docs.map(d => ({ id: d.id, ...(d.data() as AnyDoc) })) as Application[])
                setAppsLoading(false)
            },
            err => {
                console.error(err)
                setAppsLoading(false)
            }
        )

        return () => {
            if (u1) u1()
            if (u2) u2()
        }
    }, [companyCode, activeProgramId])

    // ---- Participants for filters (scoped by companyCode + optional program if present on participant)
    useEffect(() => {
        let unsub: Unsubscribe | null = null

        if (!companyCode) {
            setParticipantsMap({})
            setParticipantsLoading(false)
            return
        }

        setParticipantsLoading(true)

        const base: any[] = [where('companyCode', '==', companyCode)]
        unsub = onSnapshot(
            query(collection(db, 'participants'), ...base),
            snap => {
                const m: Record<string, AnyDoc> = {}
                snap.docs.forEach(d => (m[d.id] = { id: d.id, ...(d.data() as AnyDoc) }))
                setParticipantsMap(m)
                setParticipantsLoading(false)
            },
            err => {
                console.error(err)
                setParticipantsMap({})
                setParticipantsLoading(false)
            }
        )

        return () => {
            if (unsub) unsub()
        }
    }, [companyCode])

    const acceptedSmeIds = useMemo(() => {
        return new Set(
            applications
                .map(a => norm(a.participantId || a.id))
                .filter(Boolean)
        )
    }, [applications])

    // ---- filter options derived from participants
    const acceptedParticipants = useMemo(() => {
        const list: AnyDoc[] = []
        acceptedSmeIds.forEach(id => {
            const p = participantsMap[id]
            if (p) list.push(p)
        })
        return list
    }, [acceptedSmeIds, participantsMap])

    const genderOptions = useMemo(() => {
        const set = new Set<string>()
        acceptedParticipants.forEach(p => {
            const g = norm(p.gender)
            if (g) set.add(g)
        })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [acceptedParticipants])

    const provinceOptions = useMemo(() => {
        const set = new Set<string>()
        acceptedParticipants.forEach(p => {
            const prov = norm(p.province || p.businessAddressProvince)
            if (prov) set.add(prov)
        })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [acceptedParticipants])

    // ---- filtered participant ids
    const filteredAcceptedSmeIds = useMemo(() => {
        const ids = new Set<string>()

        acceptedSmeIds.forEach(id => {
            const p = participantsMap[id]
            if (!p) return

            const g = norm(p.gender)
            const prov = norm(p.province || p.businessAddressProvince)

            const matchGender = selectedGender === 'All' || g === selectedGender
            const matchProvince = selectedProvince === 'All' || prov === selectedProvince

            if (matchGender && matchProvince) ids.add(id)
        })

        return ids
    }, [acceptedSmeIds, participantsMap, selectedGender, selectedProvince])

    const filteredApplications = useMemo(() => {
        return applications.filter(a => {
            const pid = norm(a.participantId || a.id)
            return pid && filteredAcceptedSmeIds.has(pid)
        })
    }, [applications, filteredAcceptedSmeIds])

    const filteredAssignments = useMemo(() => {
        return assignments.filter(a => {
            const pid = norm((a as any).participantId)
            if (!pid || !filteredAcceptedSmeIds.has(pid)) return false

            if (!activeProgramId) return true
            const docProg = (a as any).programId || (a as any).activeProgramId
            if (!docProg) return true
            return String(docProg) === String(activeProgramId)
        })
    }, [assignments, filteredAcceptedSmeIds, activeProgramId])

    // =========================
    // Required vs Met across SMEs (using assignedInterventions as truth of delivery)
    // =========================
    const requiredCountsByTitle = useMemo(() => {
        const map: Record<string, number> = {}
        filteredApplications.forEach(a => {
            extractRequiredTitles(a).forEach(t => (map[t] = (map[t] || 0) + 1))
        })
        return map
    }, [filteredApplications])

    const titleToArea = useMemo(() => {
        const map: Record<string, string> = {}
        filteredApplications.forEach(a => {
            const m = extractRequiredTitleToArea(a)
            Object.entries(m).forEach(([t, area]) => {
                if (!map[t]) map[t] = area || 'Unknown'
            })
        })
        filteredAssignments.forEach(a => {
            const t = norm((a as any).interventionTitle) || 'Untitled'
            const area = norm((a as any).areaOfSupport) || 'Unknown'
            if (!map[t]) map[t] = area
        })
        return map
    }, [filteredApplications, filteredAssignments])

    const breakdownByTitle = useMemo(() => {
        const byTitle: Record<
            string,
            { title: string; area: string; completed: number; inProgress: number; other: number; total: number }
        > = {}

        filteredAssignments.forEach(a => {
            const title = norm((a as any).interventionTitle) || 'Untitled'
            const area = norm((a as any).areaOfSupport) || 'Unknown'
            if (!byTitle[title]) byTitle[title] = { title, area, completed: 0, inProgress: 0, other: 0, total: 0 }
            byTitle[title].total += 1
            if (isCompletedAssigned(a)) byTitle[title].completed += 1
            else if (isInProgressAssigned(a)) byTitle[title].inProgress += 1
            else byTitle[title].other += 1
        })

        return Object.values(byTitle).sort((a, b) => b.total - a.total)
    }, [filteredAssignments])

    const pipelineRows = useMemo(() => {
        const titles = new Set<string>([
            ...Object.keys(requiredCountsByTitle),
            ...breakdownByTitle.map(x => x.title)
        ])

        const rows = Array.from(titles).map(title => {
            const required = requiredCountsByTitle[title] || 0
            const hit = breakdownByTitle.find(x => x.title === title)
            const done = hit?.completed || 0
            const inProg = hit?.inProgress || 0
            const area = titleToArea[title] || 'Unknown'
            return { title, area, required, inProg, done }
        })

        return rows
            .sort((a, b) => (b.required + b.inProg + b.done) - (a.required + a.inProg + a.done))
            .slice(0, 20)
    }, [requiredCountsByTitle, breakdownByTitle, titleToArea])

    const smeRequiredMet = useMemo(() => {
        const requiredBySme: Record<string, Set<string>> = {}
        filteredApplications.forEach(a => {
            const pid = norm(a.participantId || a.id)
            if (!pid) return
            if (!requiredBySme[pid]) requiredBySme[pid] = new Set()
            extractRequiredTitles(a).forEach(t => requiredBySme[pid].add(t))
        })

        const completedBySme: Record<string, Set<string>> = {}
        filteredAssignments.forEach(a => {
            if (!isCompletedAssigned(a)) return
            const pid = norm((a as any).participantId)
            if (!pid) return
            if (!completedBySme[pid]) completedBySme[pid] = new Set()
            completedBySme[pid].add(norm((a as any).interventionTitle) || 'Untitled')
        })

        const rows = Object.keys(requiredBySme).map(pid => {
            const requiredSet = requiredBySme[pid] || new Set<string>()
            const completedSet = completedBySme[pid] || new Set<string>()
            let met = 0
            requiredSet.forEach(t => {
                if (completedSet.has(t)) met += 1
            })

            const p = participantsMap[pid]
            const name = norm(p?.beneficiaryName || p?.enterpriseName || p?.participantName) || pid
            const required = requiredSet.size
            const pct = required > 0 ? Math.round((met / required) * 100) : 0

            return { pid, name, required, met, pct }
        })

        return rows.sort((a, b) => b.required - a.required)
    }, [filteredApplications, filteredAssignments, participantsMap])

    // =========================
    // KPIs
    // =========================
    const kpis = useMemo(() => {
        const totalRequired = Object.values(requiredCountsByTitle).reduce((a, b) => a + b, 0)
        const totalAssigned = filteredAssignments.length
        const inProgress = filteredAssignments.filter(isInProgressAssigned).length
        const completed = filteredAssignments.filter(isCompletedAssigned).length
        const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0
        return { totalRequired, totalAssigned, inProgress, completed, completionRate }
    }, [requiredCountsByTitle, filteredAssignments])

    // =========================
    // Charts
    // =========================
    const statusMixChart = useMemo<Highcharts.Options>(() => {
        const completed = filteredAssignments.filter(isCompletedAssigned).length
        const inProgress = filteredAssignments.filter(isInProgressAssigned).length
        const other = Math.max(0, filteredAssignments.length - completed - inProgress)

        return {
            chart: { type: 'pie', height: 360 },
            title: { text: 'Delivery Status Mix' },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            // @ts-ignore Highcharts context
                            const y = this.y as number
                            // @ts-ignore Highcharts context
                            const name = this.point?.name as string
                            if (!y) return null
                            return `${name}: ${y}`
                        }
                    }
                }
            },
            series: [
                {
                    name: 'Count',
                    type: 'pie',
                    colorByPoint: true,
                    data: [
                        { name: 'Completed', y: completed },
                        { name: 'In Progress', y: inProgress },
                        { name: 'Other/Unknown', y: other }
                    ]
                }
            ]
        }
    }, [filteredAssignments])

    const pipelineChart = useMemo<Highcharts.Options>(() => {
        const categories = pipelineRows.map(r => r.title)
        const required = pipelineRows.map(r => r.required)
        const inProg = pipelineRows.map(r => r.inProg)
        const done = pipelineRows.map(r => r.done)

        return {
            chart: { type: 'bar', height: Math.max(420, categories.length * 26) },
            title: { text: 'Intervention Pipeline (Top 20)' },
            xAxis: { categories, title: { text: 'Intervention' }, labels: { style: { fontSize: '11px' } } },
            yAxis: { min: 0, title: { text: 'Count' } },
            tooltip: { shared: true },
            plotOptions: { series: { dataLabels: { enabled: true, format: '{point.y}' }, borderRadius: 6 } },
            series: [
                { name: 'Required', type: 'bar', data: required },
                { name: 'In Progress', type: 'bar', data: inProg },
                { name: 'Completed', type: 'bar', data: done }
            ]
        }
    }, [pipelineRows])

    const smeRequiredMetChart = useMemo<Highcharts.Options>(() => {
        const top = smeRequiredMet.slice(0, 15)
        const categories = top.map(x => x.name)
        const required = top.map(x => x.required)
        const met = top.map(x => x.met)
        const pct = top.map(x => x.pct)

        return {
            chart: { type: 'column', height: 420 },
            title: { text: 'Required vs Met (Top 15 SMEs by Required)' },
            xAxis: { categories, title: { text: 'SME' }, labels: { style: { fontSize: '11px' } } },
            yAxis: { min: 0, title: { text: 'Interventions' } },
            tooltip: { shared: true },
            plotOptions: {
                column: { borderRadius: 10, pointPadding: 0.15, groupPadding: 0.1 },
                series: { dataLabels: { enabled: true, format: '{point.y}' } }
            },
            series: [
                { name: 'Required', type: 'column', data: required },
                { name: 'Met (Completed)', type: 'column', data: met }
            ],
            subtitle: {
                text: top.length ? `Avg met rate (top 15): ${Math.round(pct.reduce((a, b) => a + b, 0) / top.length)}%` : ''
            }
        }
    }, [smeRequiredMet])

    // =========================
    // Overview table: show incubatee + assignee + exact intervention
    // =========================
    const overviewRows = useMemo(() => {
        const rows = filteredAssignments
            .map(a => {
                const due = toDate((a as any).dueDate)
                return {
                    key: (a as any).id,
                    interventionTitle: norm((a as any).interventionTitle) || 'Untitled',
                    areaOfSupport: norm((a as any).areaOfSupport) || 'Unknown',
                    incubatee: norm((a as any).beneficiaryName) || norm((participantsMap[(a as any).participantId]?.beneficiaryName)) || '—',
                    participantId: norm((a as any).participantId) || '—',
                    assigneeName: norm((a as any).assigneeName) || '—',
                    assigneeEmail: norm((a as any).assigneeEmail) || '—',
                    assigneeType: norm((a as any).assigneeType) || '—',
                    status: norm((a as any).status) || 'assigned',
                    dueDate: due ? due.getTime() : Number.MAX_SAFE_INTEGER,
                    dueLabel: fmtDate((a as any).dueDate)
                }
            })
            .sort((a, b) => a.dueDate - b.dueDate)

        return rows.slice(0, 30)
    }, [filteredAssignments, participantsMap])

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
        {
            title: 'Incubatee',
            dataIndex: 'incubatee',
            key: 'incubatee',
            render: (_, r) => (
                <div>
                    <div style={{ fontWeight: 600 }}>{r.incubatee}</div>
                </div>
            )
        },
        {
            title: 'Assignee',
            dataIndex: 'assigneeName',
            key: 'assigneeName',
            render: (_, r) => (
                <div>
                    <div style={{ fontWeight: 600 }}>{r.assigneeName}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {r.assigneeEmail !== '—' ? r.assigneeEmail : r.assigneeType}
                    </div>
                </div>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (_, r) => {
                const s = normLower(r.status)
                const completed = s === 'completed'
                const inprog = s === 'in-progress' || s === 'in_progress' || s === 'assigned'
                const color = completed ? 'green' : inprog ? 'gold' : 'default'
                return <Tag color={color}>{r.status}</Tag>
            }
        },
        {
            title: 'Due',
            dataIndex: 'dueLabel',
            key: 'dueLabel',
            render: (_, r) => <span>{r.dueLabel}</span>
        }
    ]

    const pageLoading = assignmentsLoading || appsLoading || participantsLoading

    return (
        <>
            <Helmet>
                <title>Monitoring & Evaluation | Smart Incubation</title>
            </Helmet>

            {pageLoading ? (
                <LoadingOverlay tip='Getting metrics ready...' />
            ) : (
                <div style={{ padding: 24, minHeight: '100vh' }}>
                    <Row align="middle" justify="space-between" style={{ marginBottom: 10 }}>
                        <Col>
                            <Title level={4} style={{ margin: 0 }}>

                            </Title>
                        </Col>

                        <Col>

                        </Col>
                    </Row>

                    <DashboardHeaderCard
                        title='Monitoring & Evaluation'
                        extraRight={
                            <Space>
                                <Select value={selectedGender} onChange={setSelectedGender} style={{ width: 200 }}>
                                    <Option value="All">All Genders</Option>
                                    {genderOptions.map(g => (
                                        <Option key={g} value={g}>
                                            {g}
                                        </Option>
                                    ))}
                                </Select>

                                <Select value={selectedProvince} onChange={setSelectedProvince} style={{ width: 240 }}>
                                    <Option value="All">All Provinces</Option>
                                    {provinceOptions.map(p => (
                                        <Option key={p} value={p}>
                                            {p}
                                        </Option>
                                    ))}
                                </Select>
                            </Space>} />

                    <Row gutter={[16, 16]} style={{ marginBottom: 14 }}>
                        {[
                            {
                                title: 'Total Required (Accepted Apps)',
                                value: kpis.totalRequired,
                                icon: <FileTextOutlined style={{ color: '#1890ff', fontSize: 18 }} />,
                                iconBg: 'rgba(24,144,255,.12)'
                            },
                            {
                                title: 'Total Assigned (Delivery Records)',
                                value: kpis.totalAssigned,
                                icon: <DatabaseOutlined style={{ color: '#722ed1', fontSize: 18 }} />,
                                iconBg: 'rgba(114,46,209,.12)'
                            },
                            {
                                title: 'In Progress',
                                value: kpis.inProgress,
                                icon: <ClockCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />,
                                iconBg: 'rgba(250,173,20,.12)'
                            },
                            {
                                title: 'Completed',
                                value: `${kpis.completed} (${kpis.completionRate}%)`,
                                icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />,
                                iconBg: 'rgba(82,196,26,.12)'
                            }
                        ].map((metric, index) => (
                            <Col xs={24} md={6} key={metric.title}>
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: index * 0.1 }}
                                >
                                    <MotionCard bodyStyle={{ padding: 14 }} style={{ height: '100%' }}>
                                        <MotionCard.Metric
                                            icon={metric.icon}
                                            iconBg={metric.iconBg}
                                            title={metric.title}
                                            value={metric.value}
                                        />
                                    </MotionCard>
                                </motion.div>
                            </Col>
                        ))}
                    </Row>

                    <Row justify="space-between" align="middle" style={{ marginBottom: 14 }}>
                        <Col>
                            <Segmented
                                value={view}
                                onChange={v => setView(v as ViewKey)}
                                options={[
                                    { label: 'Overview', value: 'overview' },
                                    { label: 'Required vs Met (SMEs)', value: 'sme' },
                                    { label: 'Intervention Pipeline', value: 'pipeline' }
                                ]}
                            />
                        </Col>
                        <Col>
                            <Tag color="blue">Accepted SMEs: {filteredApplications.length}</Tag>
                        </Col>
                    </Row>

                    {view === 'overview' && (
                        <Row gutter={[24, 24]}>
                            <Col xs={24} lg={9}>
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                                    <Card
                                        hoverable
                                        style={{
                                            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                                            borderRadius: 8,
                                            border: '1px solid #d6e4ff'
                                        }}
                                        title="Delivery Status Mix"
                                    >
                                        {filteredAssignments.length ? (
                                            <HighchartsReact highcharts={Highcharts} options={statusMixChart} />
                                        ) : (
                                            <Empty description="No assigned interventions match the current SME filters." />
                                        )}
                                    </Card>
                                </motion.div>
                            </Col>

                            <Col xs={24} lg={15}>
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                                    <Card
                                        hoverable
                                        style={{
                                            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                                            borderRadius: 8,
                                            border: '1px solid #d6e4ff'
                                        }}
                                        title="Live Intervention Breakdown (Incubatee + Assignee)"
                                        extra={
                                            <Tooltip title="Sorted by due date, limited to 30 rows for performance.">
                                                <Tag color="geekblue">Showing: {overviewRows.length}</Tag>
                                            </Tooltip>
                                        }
                                    >
                                        {overviewRows.length ? (
                                            <>
                                                <Table
                                                    columns={columns}
                                                    dataSource={overviewRows}
                                                    size="small"
                                                    pagination={false}
                                                    rowKey="key"
                                                />

                                                <Divider style={{ margin: '12px 0' }} />

                                                <div style={{ fontSize: 12, opacity: 0.8 }}>
                                                    Top interventions by volume (completed / in progress):
                                                </div>

                                                <div style={{ marginTop: 10 }}>
                                                    {breakdownByTitle.slice(0, 8).map(x => (
                                                        <div key={x.title} style={{ marginBottom: 10 }}>
                                                            <Row justify="space-between" align="middle">
                                                                <Col>
                                                                    <b>{x.title}</b> <Text type="secondary">({x.area})</Text>
                                                                </Col>
                                                                <Col>
                                                                    <Space size={6}>
                                                                        <Tag color="green">Completed: {x.completed}</Tag>
                                                                        <Tag color="gold">In Progress: {x.inProgress}</Tag>
                                                                        <Tag color="blue">Total: {x.total}</Tag>
                                                                    </Space>
                                                                </Col>
                                                            </Row>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <Empty description="No assigned interventions found for the current filters." />
                                        )}
                                    </Card>
                                </motion.div>
                            </Col>
                        </Row>
                    )}

                    {view === 'sme' && (
                        <Row gutter={[24, 24]}>
                            <Col xs={24}>
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                                    <Card
                                        hoverable
                                        style={{
                                            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                                            borderRadius: 8,
                                            border: '1px solid #d6e4ff'
                                        }}
                                        title="Required vs Met across SMEs"
                                    >
                                        {smeRequiredMet.length ? (
                                            <HighchartsReact highcharts={Highcharts} options={smeRequiredMetChart} />
                                        ) : (
                                            <Empty description="No required interventions found on accepted applications for the current filters." />
                                        )}
                                    </Card>
                                </motion.div>
                            </Col>
                        </Row>
                    )}

                    {view === 'pipeline' && (
                        <Row gutter={[24, 24]}>
                            <Col xs={24}>
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                                    <Card
                                        hoverable
                                        style={{
                                            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                                            borderRadius: 8,
                                            border: '1px solid #d6e4ff'
                                        }}
                                        title="Intervention Pipeline: Required vs In Progress vs Completed"
                                    >
                                        {pipelineRows.length ? (
                                            <HighchartsReact highcharts={Highcharts} options={pipelineChart} />
                                        ) : (
                                            <Empty description="No pipeline data available. Ensure applications have interventions.required and assignedInterventions has interventionTitle + status." />
                                        )}
                                    </Card>
                                </motion.div>
                            </Col>
                        </Row>
                    )}
                </div>
            )}
        </>
    )
}

export default MonitoringEvaluationEvaluation
