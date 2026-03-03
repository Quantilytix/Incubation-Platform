// src/pages/director/DirectorProgramsOverview.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
    Avatar,
    Button,
    Card,
    Col,
    DatePicker,
    Divider,
    Drawer,
    Empty,
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
    Tooltip,
    message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Helmet } from 'react-helmet'
import dayjs, { Dayjs } from 'dayjs'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import Drilldown from 'highcharts/modules/drilldown'
import {
    ApartmentOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    DollarOutlined,
    EyeOutlined,
    FileTextOutlined,
    SearchOutlined,
    TeamOutlined,
    WarningOutlined,
    RiseOutlined,
    UserOutlined
} from '@ant-design/icons'
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    Timestamp
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'

if (typeof Drilldown === 'function') {
    Drilldown(Highcharts)
}

const { Text, Title } = Typography
const { RangePicker } = DatePicker
const { useBreakpoint } = Grid

// -------------------- helpers --------------------
type AnyDoc = { id: string;[k: string]: any }

const safeStr = (v: any) => (v === undefined || v === null ? '' : String(v))

const toDayjs = (v: any): Dayjs | null => {
    if (!v) return null
    if (dayjs.isDayjs(v)) return v
    if (v instanceof Date) return dayjs(v)
    if (v instanceof Timestamp) return dayjs(v.toDate())
    if (v?.toDate) return dayjs(v.toDate())
    // handles plain JSON timestamps like {seconds,nanoseconds}
    if (typeof v?.seconds === 'number') return dayjs(new Date(v.seconds * 1000))
    return null
}

const getAny = (obj: any, keys: string[], fallback: any = null) => {
    for (const k of keys) {
        if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k]
    }
    return fallback
}

const getProgramIdFrom = (docx: AnyDoc) =>
    getAny(docx, ['programId', 'programID', 'program', 'program_id'], null)

const getCompanyCodeFrom = (docx: AnyDoc) =>
    getAny(docx, ['companyCode', 'company_code', 'company'], null)

const getStatusFrom = (docx: AnyDoc) =>
    safeStr(getAny(docx, ['status', 'state', 'currentStatus'], '')).toLowerCase()

const getParticipantIdFromAny = (docx: AnyDoc) => {
    const v =
        getAny(docx, ['participantId'], null) ??
        getAny(docx, ['beneficiaryId'], null) ??
        getAny(docx, ['smeId'], null) ??
        getAny(docx, ['participant', 'id'], null) ??
        getAny(docx, ['beneficiary', 'id'], null)

    const s = safeStr(v || '')
    return s || null
}

const getSubmittedAtFromApp = (a: AnyDoc) =>
    getAny(a, ['submittedAt', 'createdAt', 'created_at', 'updatedAt', 'date'], null)

const getInvoiceDateForRange = (inv: AnyDoc) =>
    getAny(inv, ['updatedAt', 'createdAt', 'date', 'issuedAt'], null)

const getAssignmentDateForRange = (ai: AnyDoc) =>
    getAny(ai, ['createdAt', 'updatedAt', 'completedAt', 'consultantDecisionAt'], null)

const getDueDateFromAssignment = (ai: AnyDoc) =>
    getAny(ai, ['dueDate', 'due_date', 'deadline', 'endDate', 'end_date'], null)

const isAcceptedApplication = (a: AnyDoc) => {
    const s = getStatusFrom(a)
    return ['accepted', 'approved', 'selected', 'enrolled'].includes(s)
}

const isAssignmentCompleted = (ai: AnyDoc) => {
    const s = getStatusFrom(ai)
    if (['completed', 'complete', 'done', 'closed', 'finalized'].includes(s)) return true

    const ccs = safeStr(ai.consultantCompletionStatus || '').toLowerCase()
    const ucs = safeStr(ai.userCompletionStatus || '').toLowerCase()
    const computed = Number(ai.computedProgress ?? ai.progress ?? 0)

    if (['completed', 'complete', 'done', 'confirmed'].includes(ccs)) return true
    if (['confirmed', 'completed', 'complete', 'done'].includes(ucs)) return true
    if (computed >= 100) return true
    if (toDayjs(ai.completedAt)) return true

    return false
}

const isAssignmentAccepted = (ai: AnyDoc) => {
    const c = safeStr(ai.consultantStatus || '').toLowerCase()
    const u = safeStr(ai.userStatus || '').toLowerCase()
    // Treat missing statuses as not blocking
    const consultantOk = !c || c === 'accepted'
    const userOk = !u || u === 'accepted'
    return consultantOk && userOk
}

const fmtMoney = (value: number) =>
    new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value)

const riskLabel = (score: number) => {
    if (score >= 70) return { label: 'High', color: 'red' as const }
    if (score >= 35) return { label: 'Medium', color: 'orange' as const }
    return { label: 'Low', color: 'green' as const }
}

const inDayRange = (raw: any, from: Dayjs, to: Dayjs) => {
    const dt = toDayjs(raw)
    if (!dt) return true
    return (
        (dt.isAfter(from.startOf('day')) || dt.isSame(from.startOf('day'))) &&
        (dt.isBefore(to.endOf('day')) || dt.isSame(to.endOf('day')))
    )
}

// -------------------- view model --------------------
type ProgramRow = {
    id: string
    name: string
    status: string
    type: string
    cohortYear?: number | string
    startDate?: any
    endDate?: any
    budget?: number

    applicants: number
    applicantsDistinct: number
    accepted: number
    participantsProfiles: number

    interventions: number
    interventionsCompleted: number
    overdueInterventions: number
    completionRate: number

    spend: number
    budgetUseRate: number | null
    riskScore: number

    topConsultants: { name: string; count: number }[]
    topOverdue: AnyDoc[]
}

const DirectorProgramsOverview: React.FC = () => {
    const screens = useBreakpoint()
    const isMobile = !screens.md

    const [loading, setLoading] = useState(false)
    const [companyCode, setCompanyCode] = useState<string | null>(null)

    const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [
        dayjs().subtract(6, 'month').startOf('month'),
        dayjs().endOf('day')
    ])

    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
    const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
    const [cohortFilter, setCohortFilter] = useState<string | undefined>(undefined)

    const [programRows, setProgramRows] = useState<ProgramRow[]>([])

    const [drillProgramId, setDrillProgramId] = useState<string | null>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)

    useEffect(() => {
        const run = async () => {
            const user = auth.currentUser
            if (!user?.uid) return

            try {
                const snap = await getDoc(doc(db, 'users', user.uid))
                if (!snap.exists()) return
                const data = snap.data() as AnyDoc
                setCompanyCode(data.companyCode || '')
            } catch (e) {
                console.error(e)
                message.error('Failed to load your profile')
            }
        }
        run()
    }, [])

    const fetchAll = async () => {
        if (!companyCode) return
        setLoading(true)

        try {
            const [from, to] = range
            const now = dayjs()

            // 1) Programs (source of truth)
            const programsSnap = await getDocs(
                query(collection(db, 'programs'), where('companyCode', '==', companyCode))
            )
            const programs = programsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as AnyDoc[]

            // 2) Company scoped docs
            const [applicationsSnap, assignedSnap, invoicesSnap] = await Promise.all([
                getDocs(query(collection(db, 'applications'), where('companyCode', '==', companyCode))),
                getDocs(query(collection(db, 'assignedInterventions'), where('companyCode', '==', companyCode))),
                getDocs(query(collection(db, 'invoices'), where('companyCode', '==', companyCode))).catch(
                    () => ({ docs: [] as any[] })
                )
            ])

            const applicationsAll = applicationsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as AnyDoc[]
            const assignedAll = assignedSnap.docs.map(d => ({ id: d.id, ...d.data() })) as AnyDoc[]
            const invoicesAll = (invoicesSnap as any).docs
                ? ((invoicesSnap as any).docs.map((d: any) => ({ id: d.id, ...d.data() })) as AnyDoc[])
                : ([] as AnyDoc[])

            // 3) Participants (profile docs). Prefer company-scoped query; fall back to filtering in-memory.
            let participantsAll: AnyDoc[] = []
            try {
                const snap = await getDocs(
                    query(collection(db, 'participants'), where('companyCode', '==', companyCode))
                )
                participantsAll = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AnyDoc[]
            } catch {
                const snap = await getDocs(query(collection(db, 'participants')))
                const all = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AnyDoc[]
                participantsAll = all.filter(p => getCompanyCodeFrom(p) === companyCode)
            }

            // 4) Range filtering
            const applicationsR = applicationsAll.filter(a =>
                inDayRange(getSubmittedAtFromApp(a), from, to)
            )

            const invoicesR = invoicesAll.filter(inv =>
                inDayRange(getInvoiceDateForRange(inv), from, to)
            )

            const assignedR = assignedAll.filter(ai =>
                inDayRange(getAssignmentDateForRange(ai), from, to)
            )

            const participantsById = new Map<string, AnyDoc>()
            participantsAll.forEach(p => participantsById.set(p.id, p))

            // 5) Aggregate per program
            const rows: ProgramRow[] = programs.map(p => {
                const pid = p.id

                const pApps = applicationsR.filter(a => getProgramIdFrom(a) === pid)

                const applicantIds = Array.from(
                    new Set(
                        pApps.map(a => getParticipantIdFromAny(a)).filter(Boolean) as string[]
                    )
                )

                const acceptedApps = pApps.filter(isAcceptedApplication)
                const acceptedIds = Array.from(
                    new Set(
                        acceptedApps.map(a => getParticipantIdFromAny(a)).filter(Boolean) as string[]
                    )
                )

                const profilesMatched = acceptedIds.filter(id => participantsById.has(id)).length

                // Only count assigned interventions for accepted SMEs, so "program delivery" matches membership.
                const pAssignedAllForProgram = assignedR.filter(ai => getProgramIdFrom(ai) === pid)
                const pAssigned = pAssignedAllForProgram.filter(ai => {
                    const pid2 = getParticipantIdFromAny(ai)
                    if (!pid2) return false
                    return acceptedIds.includes(pid2)
                })

                // Optional: exclude assignments not accepted by parties (keeps delivery metrics clean)
                const pAssignedEffective = pAssigned.filter(isAssignmentAccepted)

                const interventionsTotal = pAssignedEffective.length
                const completed = pAssignedEffective.filter(isAssignmentCompleted).length

                const overdue = pAssignedEffective.filter(ai => {
                    if (isAssignmentCompleted(ai)) return false
                    const due = toDayjs(getDueDateFromAssignment(ai))
                    if (!due) return false
                    return due.isBefore(now, 'day')
                }).length

                const completionRate = interventionsTotal
                    ? Math.round((completed / interventionsTotal) * 100)
                    : 0

                const pInvoices = invoicesR.filter(inv => getProgramIdFrom(inv) === pid)

                const spend = pInvoices.reduce((sum, inv) => {
                    const val = Number(getAny(inv, ['total', 'amount', 'grandTotal', 'totalAmount'], 0)) || 0
                    return sum + val
                }, 0)

                const budget = Number(p.budget || 0) || 0
                const budgetUseRate = budget > 0 ? Math.round((spend / budget) * 100) : null

                // Pipeline staleness: pending apps older than 21 days (uses submittedAt fallback chain)
                const stalePendingApps = pApps.filter(a => {
                    const s = getStatusFrom(a)
                    if (!['pending', 'submitted', 'in_review', 'in review'].includes(s)) return false
                    const dt = toDayjs(getSubmittedAtFromApp(a))
                    if (!dt) return false
                    return now.diff(dt, 'day') > 21
                }).length

                // Risk score: overdue pressure (0..40), low completion (0..40), stale pipeline (0..20)
                const overduePart = Math.min(40, overdue * 8)
                const completionPart = Math.min(40, Math.max(0, 80 - completionRate) * 0.5)
                const stalePart = Math.min(20, stalePendingApps * 5)
                const riskScore = Math.round(overduePart + completionPart + stalePart)

                // Top consultants (by number of assignments)
                const consultantCounts = new Map<string, number>()
                pAssignedEffective.forEach(ai => {
                    const nm =
                        safeStr(ai.consultantName || ai.assigneeName || '') ||
                        safeStr(ai.consultantId || ai.assigneeId || '') ||
                        'Unassigned'
                    consultantCounts.set(nm, (consultantCounts.get(nm) || 0) + 1)
                })
                const topConsultants = Array.from(consultantCounts.entries())
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)

                // Top overdue assignments (latest due date first)
                const topOverdue = pAssignedEffective
                    .filter(ai => {
                        if (isAssignmentCompleted(ai)) return false
                        const due = toDayjs(getDueDateFromAssignment(ai))
                        if (!due) return false
                        return due.isBefore(now, 'day')
                    })
                    .sort((a, b) => {
                        const da = toDayjs(getDueDateFromAssignment(a))?.valueOf() || 0
                        const dbv = toDayjs(getDueDateFromAssignment(b))?.valueOf() || 0
                        return dbv - da
                    })
                    .slice(0, 8)

                return {
                    id: pid,
                    name: safeStr(p.name || '—'),
                    status: safeStr(p.status || '—'),
                    type: safeStr(p.type || '—'),
                    cohortYear: p.cohortYear,
                    startDate: p.startDate,
                    endDate: p.endDate,
                    budget: budget || undefined,

                    applicants: pApps.length,
                    applicantsDistinct: applicantIds.length,
                    accepted: acceptedIds.length,
                    participantsProfiles: profilesMatched,

                    interventions: interventionsTotal,
                    interventionsCompleted: completed,
                    overdueInterventions: overdue,
                    completionRate,

                    spend,
                    budgetUseRate,
                    riskScore,

                    topConsultants,
                    topOverdue
                }
            })

            setProgramRows(rows)
        } catch (e) {
            console.error(e)
            message.error('Failed to load program analytics')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (companyCode) fetchAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyCode, range])

    // ------------ filters + options ------------
    const cohortOptions = useMemo(() => {
        const set = new Set<string>()
        programRows.forEach(p => {
            const y = p.cohortYear
            if (y === undefined || y === null) return
            set.add(String(y))
        })
        return Array.from(set).sort()
    }, [programRows])

    const typeOptions = useMemo(() => {
        const set = new Set<string>()
        programRows.forEach(p => {
            const t = safeStr(p.type).trim()
            if (t) set.add(t)
        })
        return Array.from(set).sort()
    }, [programRows])

    const filteredRows = useMemo(() => {
        return programRows.filter(p => {
            const q = searchText.trim().toLowerCase()
            const matchesSearch =
                !q ||
                p.name.toLowerCase().includes(q) ||
                p.type.toLowerCase().includes(q) ||
                safeStr(p.cohortYear).toLowerCase().includes(q)

            const matchesStatus = !statusFilter || p.status === statusFilter
            const matchesType = !typeFilter || p.type === typeFilter
            const matchesCohort = !cohortFilter || String(p.cohortYear || '') === cohortFilter

            return matchesSearch && matchesStatus && matchesType && matchesCohort
        })
    }, [programRows, searchText, statusFilter, typeFilter, cohortFilter])

    // ------------ global KPIs ------------
    const globalKpis = useMemo(() => {
        const list = filteredRows
        const programs = list.length
        const accepted = list.reduce((s, p) => s + p.accepted, 0)
        const applicants = list.reduce((s, p) => s + p.applicants, 0)

        const interventions = list.reduce((s, p) => s + p.interventions, 0)
        const completed = list.reduce((s, p) => s + p.interventionsCompleted, 0)
        const completionRate = interventions ? Math.round((completed / interventions) * 100) : 0

        const spend = list.reduce((s, p) => s + p.spend, 0)
        const highRisk = list.filter(p => p.riskScore >= 70).length
        const mediumRisk = list.filter(p => p.riskScore >= 35 && p.riskScore < 70).length

        const best = [...list].sort((a, b) => b.completionRate - a.completionRate)[0]?.name || '—'

        return {
            programs,
            accepted,
            applicants,
            interventions,
            completionRate,
            spend,
            highRisk,
            mediumRisk,
            best
        }
    }, [filteredRows])

    // ------------ charts ------------
    const performanceChart = useMemo(() => {
        const baseData = filteredRows.map(p => ({
            name: p.name,
            y: p.completionRate,
            drilldown: p.id
        }))

        const drill = filteredRows.map(p => ({
            id: p.id,
            name: `${p.name} breakdown`,
            type: 'column',
            data: [
                ['Completed', p.interventionsCompleted],
                [
                    'In progress',
                    Math.max(0, p.interventions - p.interventionsCompleted - p.overdueInterventions)
                ],
                ['Overdue', p.overdueInterventions]
            ]
        }))

        return {
            chart: { type: 'column', height: 360 },
            title: { text: 'Program Performance (Assigned Intervention Completion Rate)' },
            subtitle: { text: 'Click a program to drill into workload status' },
            xAxis: { type: 'category' },
            yAxis: { min: 0, max: 100, title: { text: 'Completion (%)' } },
            tooltip: { pointFormat: '<b>{point.y}%</b>' },
            plotOptions: { column: { borderRadius: 8 } },
            series: [{ name: 'Completion Rate', data: baseData as any }],
            drilldown: { series: drill as any }
        } as Highcharts.Options
    }, [filteredRows])

    const riskChart = useMemo(() => {
        const categories = filteredRows.map(p => p.name)
        return {
            chart: { type: 'bar', height: 360 },
            title: { text: 'Risk Drivers by Program' },
            xAxis: { categories },
            yAxis: { min: 0, max: 100, title: { text: 'Risk score (0–100)' } },
            tooltip: { shared: true },
            plotOptions: { series: { stacking: 'normal', borderRadius: 8 } },
            series: [
                {
                    name: 'Overdue pressure',
                    data: filteredRows.map(p => Math.min(40, p.overdueInterventions * 8)) as any
                },
                {
                    name: 'Low completion',
                    data: filteredRows.map(p => Math.min(40, Math.max(0, 80 - p.completionRate) * 0.5)) as any
                },
                {
                    name: 'Stale pipeline',
                    data: filteredRows.map(p => {
                        const overduePart = Math.min(40, p.overdueInterventions * 8)
                        const completionPart = Math.min(40, Math.max(0, 80 - p.completionRate) * 0.5)
                        return Math.max(0, p.riskScore - (overduePart + completionPart))
                    }) as any
                }
            ]
        } as Highcharts.Options
    }, [filteredRows])

    // ------------ table ------------
    const cols: ColumnsType<ProgramRow> = [
        {
            title: 'Program',
            key: 'name',
            render: (_, r) => (
                <Space>
                    <Avatar style={{ borderRadius: 12 }} icon={<ApartmentOutlined />} />
                    <div style={{ lineHeight: 1.1 }}>
                        <Text strong>{r.name}</Text>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                            <Tag
                                color={
                                    r.status === 'Active' ? 'green' : r.status === 'Upcoming' ? 'blue' : 'default'
                                }
                            >
                                {r.status || '—'}
                            </Tag>
                            {r.type && r.type !== '—' && <Tag>{r.type}</Tag>}
                            {r.cohortYear ? <Tag color="geekblue">{r.cohortYear}</Tag> : null}
                        </div>
                    </div>
                </Space>
            ),
            sorter: (a, b) => a.name.localeCompare(b.name)
        },
        {
            title: 'SMEs in program',
            key: 'accepted',
            render: (_, r) => (
                <Space>
                    <Tag icon={<TeamOutlined />} color="green">
                        {r.accepted}
                    </Tag>
                    <Tooltip title="Participant profile docs matched by participantId">
                        <Tag icon={<UserOutlined />} color="default">
                            {r.participantsProfiles}
                        </Tag>
                    </Tooltip>
                </Space>
            ),
            sorter: (a, b) => a.accepted - b.accepted
        },
        {
            title: 'Applicants',
            key: 'apps',
            render: (_, r) => (
                <Space>
                    <Tag icon={<FileTextOutlined />} color="blue">
                        {r.applicants}
                    </Tag>
                    <Tag icon={<CheckCircleOutlined />} color="geekblue">
                        {r.applicantsDistinct} unique
                    </Tag>
                </Space>
            ),
            sorter: (a, b) => a.applicants - b.applicants
        },
        {
            title: 'Delivery',
            key: 'completion',
            render: (_, r) => (
                <div style={{ minWidth: 190 }}>
                    <Progress
                        percent={r.completionRate}
                        size="small"
                        status={r.completionRate >= 80 ? 'success' : r.completionRate < 50 ? 'exception' : 'active'}
                    />
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                        {r.interventionsCompleted}/{r.interventions} assigned
                        {r.overdueInterventions > 0 ? (
                            <Tag style={{ marginLeft: 8 }} color="red" icon={<ClockCircleOutlined />}>
                                {r.overdueInterventions} overdue
                            </Tag>
                        ) : null}
                    </div>
                </div>
            ),
            sorter: (a, b) => a.completionRate - b.completionRate
        },
        {
            title: 'Spend',
            key: 'spend',
            render: (_, r) => (
                <div style={{ lineHeight: 1.1 }}>
                    <Text>{fmtMoney(r.spend || 0)}</Text>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                        {r.budgetUseRate === null ? (
                            <Text type="secondary">No budget set</Text>
                        ) : (
                            <Tag color={r.budgetUseRate >= 90 ? 'red' : r.budgetUseRate >= 60 ? 'orange' : 'green'}>
                                {r.budgetUseRate}% of budget
                            </Tag>
                        )}
                    </div>
                </div>
            ),
            sorter: (a, b) => a.spend - b.spend
        },
        {
            title: 'Risk',
            key: 'risk',
            render: (_, r) => {
                const rk = riskLabel(r.riskScore)
                return (
                    <Space>
                        <Tag color={rk.color} icon={<WarningOutlined />}>
                            {rk.label}
                        </Tag>
                        <Text type="secondary">{r.riskScore}/100</Text>
                    </Space>
                )
            },
            sorter: (a, b) => a.riskScore - b.riskScore
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
                        setDrillProgramId(r.id)
                        setDrawerOpen(true)
                    }}
                >
                    Drilldown
                </Button>
            )
        }
    ]

    // ------------ drilldown (per program) ------------
    const drill = useMemo(() => {
        if (!drillProgramId) return null
        const row = programRows.find(p => p.id === drillProgramId)
        if (!row) return null

        const rk = riskLabel(row.riskScore)

        const headline: string[] = []
        headline.push(`${row.accepted} SMEs accepted into the program`)
        headline.push(`${row.interventionsCompleted}/${row.interventions} assigned interventions completed`)
        if (row.overdueInterventions > 0) headline.push(`${row.overdueInterventions} interventions are overdue`)
        if (row.budgetUseRate !== null) {
            headline.push(`${row.budgetUseRate}% of budget used`)
        } else {
            headline.push(`No budget configured`)
        }

        return { row, rk, headline }
    }, [drillProgramId, programRows])

    return (
        <div style={{ minHeight: '100vh', padding: 24 }}>
            <Helmet>
                <title>Programs | Director View</title>
            </Helmet>

            <DashboardHeaderCard
                title="Programs"
                subtitle="Director summary: performance, risks, spend, and drilldowns per program."
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
                            placeholder="Search program..."
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            style={{ width: isMobile ? 220 : 260 }}
                        />
                        <Select
                            allowClear
                            placeholder="Status"
                            value={statusFilter}
                            onChange={setStatusFilter}
                            style={{ width: 160 }}
                            options={['Active', 'Upcoming', 'Completed', 'Inactive'].map(s => ({ value: s, label: s }))}
                        />
                        <Select
                            allowClear
                            placeholder="Type"
                            value={typeFilter}
                            onChange={setTypeFilter}
                            style={{ width: 200 }}
                            options={typeOptions.map(t => ({ value: t, label: t }))}
                        />
                        <Button onClick={fetchAll} loading={loading}>
                            Refresh
                        </Button>
                    </Space>
                }
            />

            {loading && <LoadingOverlay tip="Building program analytics..." />}

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
                                <Text type="secondary">Programs</Text>
                                <div style={{ fontSize: 22, fontWeight: 700 }}>{globalKpis.programs}</div>
                                <div style={{ fontSize: 12, opacity: 0.75 }}>
                                    Best performer: <Text strong>{globalKpis.best}</Text>
                                </div>
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
                                <Text type="secondary">SMEs accepted</Text>
                                <div style={{ fontSize: 22, fontWeight: 700 }}>{globalKpis.accepted}</div>
                                <div style={{ fontSize: 12, opacity: 0.75 }}>
                                    {globalKpis.applicants} applications in range
                                </div>
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
                                <RiseOutlined style={{ color: '#a855f7' }} />
                            </div>
                            <div>
                                <Text type="secondary">Delivery completion</Text>
                                <div style={{ fontSize: 22, fontWeight: 700 }}>{globalKpis.completionRate}%</div>
                                <div style={{ fontSize: 12, opacity: 0.75 }}>
                                    {globalKpis.interventions} assignments tracked
                                </div>
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
                                <DollarOutlined style={{ color: '#d97706' }} />
                            </div>
                            <div>
                                <Text type="secondary">Spend</Text>
                                <div style={{ fontSize: 18, fontWeight: 800 }}>{fmtMoney(globalKpis.spend)}</div>
                                <div style={{ fontSize: 12, opacity: 0.75 }}>
                                    <Tag color="red">{globalKpis.highRisk} high risk</Tag>
                                    <Tag color="orange">{globalKpis.mediumRisk} medium</Tag>
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
                        {filteredRows.length ? (
                            <HighchartsReact highcharts={Highcharts} options={performanceChart} />
                        ) : (
                            <Empty description="No programs match your filters." />
                        )}
                    </Card>
                </Col>
                <Col xs={24} lg={10}>
                    <Card style={{ borderRadius: 18 }}>
                        {filteredRows.length ? (
                            <HighchartsReact highcharts={Highcharts} options={riskChart} />
                        ) : (
                            <Empty description="No programs match your filters." />
                        )}
                    </Card>
                </Col>
            </Row>

            {/* Table */}
            <Card style={{ borderRadius: 18, marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>
                            Program Summary
                        </Title>
                        <Text type="secondary">
                            Aggregated from Firestore: programs, applications, assignedInterventions, participants (profile join), and optional invoices.
                        </Text>
                    </div>
                </div>

                <Divider style={{ margin: '12px 0' }} />

                <Table
                    rowKey="id"
                    columns={cols}
                    dataSource={filteredRows}
                    pagination={{ pageSize: 8, showSizeChanger: true }}
                />
            </Card>

            {/* Drilldown Drawer */}
            <Drawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={isMobile ? '100%' : 760}
                title={
                    <Space>
                        <Avatar style={{ borderRadius: 12 }} icon={<ApartmentOutlined />} />
                        <div style={{ lineHeight: 1.1 }}>
                            <Text strong style={{ fontSize: 16 }}>
                                {drill?.row.name || 'Program Drilldown'}
                            </Text>
                            {drill?.row ? (
                                <div style={{ fontSize: 12, opacity: 0.75 }}>
                                    {drill.row.accepted} SMEs • {drill.row.interventions} assigned • {drill.row.completionRate}% completion
                                </div>
                            ) : null}
                        </div>
                    </Space>
                }
            >
                {!drill?.row ? (
                    <Empty description="Pick a program to drill down." />
                ) : (
                    <>
                        <Row gutter={[12, 12]}>
                            <Col xs={24} md={12}>
                                <Card style={{ borderRadius: 16 }}>
                                    <Statistic
                                        title="Risk level"
                                        value={drill.rk.label}
                                        prefix={<WarningOutlined />}
                                        valueStyle={{
                                            color:
                                                drill.rk.color === 'red'
                                                    ? '#ff4d4f'
                                                    : drill.rk.color === 'orange'
                                                        ? '#fa8c16'
                                                        : '#52c41a'
                                        }}
                                    />
                                    <div style={{ marginTop: 8 }}>
                                        <Text type="secondary">Score: </Text>
                                        <Text strong>{drill.row.riskScore}/100</Text>
                                    </div>
                                </Card>
                            </Col>

                            <Col xs={24} md={12}>
                                <Card style={{ borderRadius: 16 }}>
                                    <Statistic
                                        title="Spend"
                                        value={drill.row.spend}
                                        formatter={v => fmtMoney(Number(v))}
                                        prefix={<DollarOutlined />}
                                    />
                                    <div style={{ marginTop: 8 }}>
                                        {drill.row.budgetUseRate === null ? (
                                            <Text type="secondary">Budget not configured</Text>
                                        ) : (
                                            <Tag
                                                color={
                                                    drill.row.budgetUseRate >= 90
                                                        ? 'red'
                                                        : drill.row.budgetUseRate >= 60
                                                            ? 'orange'
                                                            : 'green'
                                                }
                                            >
                                                {drill.row.budgetUseRate}% of budget used
                                            </Tag>
                                        )}
                                    </div>
                                </Card>
                            </Col>

                            <Col xs={24} md={12}>
                                <Card style={{ borderRadius: 16 }}>
                                    <Statistic title="Applications" value={drill.row.applicants} prefix={<FileTextOutlined />} />
                                    <div style={{ marginTop: 8 }}>
                                        <Tag color="green">{drill.row.accepted} accepted</Tag>
                                        <Tag color="geekblue">{drill.row.applicantsDistinct} unique SMEs</Tag>
                                    </div>
                                </Card>
                            </Col>

                            <Col xs={24} md={12}>
                                <Card style={{ borderRadius: 16 }}>
                                    <Statistic title="Overdue assignments" value={drill.row.overdueInterventions} prefix={<ClockCircleOutlined />} />
                                    <div style={{ marginTop: 8 }}>
                                        <Progress
                                            percent={drill.row.completionRate}
                                            size="small"
                                            status={
                                                drill.row.completionRate >= 80 ? 'success' : drill.row.completionRate < 50 ? 'exception' : 'active'
                                            }
                                        />
                                    </div>
                                </Card>
                            </Col>
                        </Row>

                        <Divider />

                        <Card style={{ borderRadius: 16 }} title="Director takeaways">
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {drill.headline.map((x, idx) => (
                                    <li key={idx} style={{ marginBottom: 6 }}>
                                        {x}
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                            <Col xs={24} lg={12}>
                                <Card style={{ borderRadius: 16 }} title="Top consultants by workload">
                                    {drill.row.topConsultants.length ? (
                                        <div style={{ display: 'grid', gap: 8 }}>
                                            {drill.row.topConsultants.map(c => (
                                                <div
                                                    key={c.name}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <Space>
                                                        <Avatar size="small" icon={<UserOutlined />} />
                                                        <Text>{c.name}</Text>
                                                    </Space>
                                                    <Tag color="blue">{c.count}</Tag>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <Empty description="No assignments in range." />
                                    )}
                                </Card>
                            </Col>

                            <Col xs={24} lg={12}>
                                <Card style={{ borderRadius: 16 }} title="Overdue items">
                                    {drill.row.topOverdue.length ? (
                                        <div style={{ display: 'grid', gap: 10 }}>
                                            {drill.row.topOverdue.map(ai => {
                                                const title = safeStr(ai.interventionTitle || ai.title || 'Intervention')
                                                const sme = safeStr(ai.beneficiaryName || ai.enterpriseName || ai.participantName || 'SME')
                                                const due = toDayjs(getDueDateFromAssignment(ai))
                                                return (
                                                    <div
                                                        key={ai.id}
                                                        style={{
                                                            border: '1px solid #f0f0f0',
                                                            borderRadius: 12,
                                                            padding: 10
                                                        }}
                                                    >
                                                        <Text strong>{title}</Text>
                                                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                                                            <Space wrap>
                                                                <Tag color="default">{sme}</Tag>
                                                                {due ? (
                                                                    <Tag color="red" icon={<ClockCircleOutlined />}>
                                                                        Due {due.format('YYYY-MM-DD')}
                                                                    </Tag>
                                                                ) : (
                                                                    <Tag color="orange">No due date</Tag>
                                                                )}
                                                                <Tag>{safeStr(ai.areaOfSupport || '—')}</Tag>
                                                            </Space>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <Empty description="No overdue assignments in range." />
                                    )}
                                </Card>
                            </Col>
                        </Row>
                    </>
                )}
            </Drawer>
        </div>
    )
}

export default DirectorProgramsOverview
