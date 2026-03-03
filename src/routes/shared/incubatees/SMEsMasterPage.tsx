// pages/SMEsMasterPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import {
    App,
    Avatar,
    Badge,
    Button,
    Card,
    Col,
    DatePicker,
    Divider,
    Dropdown,
    Grid,
    Input,
    Modal,
    Progress,
    Row,
    Segmented,
    Select,
    Space,
    Statistic,
    Table,
    Tag,
    Tooltip,
    Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import {
    ApartmentOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    EnvironmentOutlined,
    EyeOutlined,
    FlagOutlined,
    ReloadOutlined,
    SearchOutlined,
    TeamOutlined,
    TrophyOutlined,
    UserOutlined,
    WarningOutlined,
    PieChartOutlined,
    LineChartOutlined,
    BarChartOutlined,
    FileTextOutlined,
    DatabaseOutlined,
    AppstoreOutlined,
    RightCircleOutlined,
    SyncOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { collection, onSnapshot, query, where, type DocumentData } from 'firebase/firestore'
import { db } from '@/firebase'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { useSMEDetails } from '@/contexts/SMEDetailsContext'
import { TableRowSelection } from 'antd/es/table/interface'
import { Helmet } from 'react-helmet'

const { Text, Title } = Typography
const { useBreakpoint } = Grid

type AnyDoc = { id: string;[k: string]: any }

type SMEState = 'active' | 'inactive' | 'at_risk' | 'graduated' | 'unknown'
type PerfLevel = 'all' | 'high' | 'medium' | 'low'
type RiskFilter = 'all' | 'at_risk' | 'ok'
type RevenueBracket = 'all' | 'lt5k' | '5k_20k' | '20k_100k' | '100k_plus'

type SMEListRow = {
    participantId: string
    beneficiaryName: string
    sector: string | null
    email: string | null
    phone: string | null
    locationLabel: string | null
    acceptedAtMs: number
    joinedLabel: string

    latestRevenue: number | null
    revenueGrowthPct: number | null
    revenueTrend: number[]
    complianceStatus: 'complete' | 'missing' | 'unknown'

    requiredCount: number
    assignedCount: number
    assignmentCoveragePct: number | null

    state: SMEState
    perfScore: number | null
    perfLevel: 'high' | 'medium' | 'low' | 'unknown'
    riskReasons: string[]
    wins: string[]
    needsAttention: string[]

    lastActivityMs: number
}

type LatestApp = {
    id: string
    participantId?: string
    submittedAt?: any
    acceptedAt?: any
    companyCode?: string
    beneficiaryName?: string
    email?: string
    sector?: string
    applicationStatus?: string
    programId?: string
    programName?: string
    interventions?: { required?: any[] }
    natureOfBusiness?: string
} & Record<string, any>

type AssignedInterventionDoc = {
    id: string
    participantId?: string
    companyCode?: string
    status?: string
    createdAt?: any
    dueAt?: any
    interventionTitle?: string
    title?: string
} & Record<string, any>

function toMillis(v: any): number {
    if (!v) return 0
    if (typeof v === 'string') {
        const t = Date.parse(v)
        return Number.isFinite(t) ? t : 0
    }
    if (typeof v?.toMillis === 'function') return v.toMillis()
    const seconds = v?._seconds
    if (typeof seconds === 'number') return seconds * 1000
    return 0
}

function safeLower(v: any) {
    return (typeof v === 'string' ? v : '').toLowerCase()
}

function clamp(n: number, a = 0, b = 100) {
    return Math.max(a, Math.min(b, n))
}

function msToHumanAgo(ms: number, nowMs: number) {
    if (!ms) return 'n/a'
    const d = nowMs - ms
    if (d < 60 * 1000) return 'just now'
    const mins = Math.floor(d / (60 * 1000))
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(d / (60 * 60 * 1000))
    if (hrs < 48) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
    const days = Math.floor(d / (24 * 60 * 60 * 1000))
    return `${days} day${days === 1 ? '' : 's'} ago`
}

function sparklineSvg(values: number[], w = 92, h = 22) {
    const v = values.filter(x => Number.isFinite(x))
    if (v.length < 2) return null

    const min = Math.min(...v)
    const max = Math.max(...v)
    const span = max - min || 1

    const pts = v.map((val, i) => {
        const x = (i / (v.length - 1)) * w
        const y = h - ((val - min) / span) * h
        return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    const last = v[v.length - 1]
    const first = v[0]
    const up = last >= first

    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
            <polyline
                fill="none"
                stroke={up ? '#52c41a' : '#ff4d4f'}
                strokeWidth="2"
                points={pts.join(' ')}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    )
}

function pctTag(pct: number | null, label: string) {
    if (pct === null) return <Tag>{label}: n/a</Tag>
    const color = pct >= 80 ? 'green' : pct >= 50 ? 'blue' : pct >= 25 ? 'gold' : 'red'
    return (
        <Tag color={color}>
            {label}: {Math.round(pct)}%
        </Tag>
    )
}

function stateTag(state: SMEState) {
    if (state === 'active') return <Tag color="green">Active</Tag>
    if (state === 'inactive') return <Tag color="default">Inactive</Tag>
    if (state === 'at_risk') return <Tag color="gold">At Risk</Tag>
    if (state === 'graduated') return <Tag color="blue">Graduated</Tag>
    return <Tag>Unknown</Tag>
}

function perfLevelTag(level: SMEListRow['perfLevel'], score: number | null) {
    if (level === 'high') return <Tag color="green">High {score !== null ? `(${score})` : ''}</Tag>
    if (level === 'medium') return <Tag color="blue">Medium {score !== null ? `(${score})` : ''}</Tag>
    if (level === 'low') return <Tag color="red">Low {score !== null ? `(${score})` : ''}</Tag>
    return <Tag>n/a</Tag>
}

function revenueBracketOf(v: number | null): RevenueBracket {
    if (v === null) return 'all'
    if (v < 5000) return 'lt5k'
    if (v < 20000) return '5k_20k'
    if (v < 100000) return '20k_100k'
    return '100k_plus'
}

function inferRevenueTrendFromParticipant(p: AnyDoc): { latest: number | null; growthPct: number | null; series: number[] } {
    const raw = p?.revenueHistory
    if (!Array.isArray(raw) || raw.length === 0) return { latest: null, growthPct: null, series: [] }

    const nums = raw
        .map((x: any) => {
            if (typeof x === 'number') return x
            if (typeof x?.revenue === 'number') return x.revenue
            if (typeof x?.value === 'number') return x.value
            return NaN
        })
        .filter((n: number) => Number.isFinite(n))

    if (nums.length === 0) return { latest: null, growthPct: null, series: [] }

    const series = nums.slice(-6)
    const latest = series[series.length - 1]
    const prev = series.length >= 2 ? series[series.length - 2] : null
    const growthPct = prev !== null && prev !== 0 ? ((latest - prev) / prev) * 100 : null

    return { latest, growthPct, series }
}

function computePerformanceScore(p: AnyDoc, latestRevenue: number | null, assignmentCoveragePct: number | null) {
    let score = 0
    let weight = 0

    if (typeof p?.performanceScore === 'number') return clamp(p.performanceScore, 0, 100)

    if (typeof assignmentCoveragePct === 'number') {
        score += assignmentCoveragePct * 0.6
        weight += 0.6
    }

    if (typeof latestRevenue === 'number') {
        const revScore = latestRevenue < 5000 ? 20 : latestRevenue < 20000 ? 45 : latestRevenue < 100000 ? 70 : 90
        score += revScore * 0.4
        weight += 0.4
    }

    if (!weight) return null
    return Math.round(score / weight)
}

function perfLevelFromScore(score: number | null): SMEListRow['perfLevel'] {
    if (score === null) return 'unknown'
    if (score >= 75) return 'high'
    if (score >= 45) return 'medium'
    return 'low'
}

function computeStateAndSignals(args: {
    participant: AnyDoc
    app: LatestApp | null
    assignedCount: number
    requiredCount: number
    revenueGrowthPct: number | null
    latestRevenue: number | null
    nowMs: number
}) {
    const { participant, app, assignedCount, requiredCount, revenueGrowthPct, latestRevenue, nowMs } = args

    const riskReasons: string[] = []
    const wins: string[] = []
    const needsAttention: string[] = []

    const hasBasics =
        !!(participant?.email || app?.email) &&
        !!(participant?.phone || participant?.phoneNumber) &&
        !!(participant?.sector || app?.sector)

    if (!hasBasics) riskReasons.push('Missing basic profile fields')

    const lastActivityMs = Math.max(
        toMillis(participant?.updatedAt),
        toMillis(participant?.lastActivityAt),
        toMillis(participant?.lastServicedAt),
        toMillis(participant?.lastServiceAt),
        toMillis(app?.submittedAt),
        toMillis(app?.acceptedAt),
        0
    )

    const inactive30d = lastActivityMs ? nowMs - lastActivityMs > 30 * 24 * 60 * 60 * 1000 : false
    if (inactive30d) riskReasons.push('No activity / servicing in 30 days')

    if (typeof revenueGrowthPct === 'number' && revenueGrowthPct < -20) riskReasons.push('Revenue drop detected')
    if (typeof revenueGrowthPct === 'number' && revenueGrowthPct > 20) wins.push('Revenue growth strong')

    const coveragePct = requiredCount ? (assignedCount / requiredCount) * 100 : null
    if (coveragePct !== null && coveragePct < 50) needsAttention.push('Low assignment coverage')
    if (coveragePct !== null && coveragePct >= 80) wins.push('Assignment coverage strong')

    const complianceStatus: 'complete' | 'missing' | 'unknown' =
        typeof participant?.complianceStatus === 'string'
            ? participant.complianceStatus === 'complete'
                ? 'complete'
                : participant.complianceStatus === 'missing'
                    ? 'missing'
                    : 'unknown'
            : 'unknown'

    if (complianceStatus === 'missing') needsAttention.push('Missing compliance documents')
    if (complianceStatus === 'complete') wins.push('Compliance complete')

    const isGraduated =
        participant?.graduated === true ||
        participant?.status === 'graduated' ||
        participant?.stage === 'graduated' ||
        participant?.graduatedAt

    let state: SMEState = 'unknown'
    if (isGraduated) state = 'graduated'
    else if (riskReasons.length) state = 'at_risk'
    else if (inactive30d) state = 'inactive'
    else state = 'active'

    return { state, riskReasons, wins, needsAttention, complianceStatus, lastActivityMs }
}

function getErrMsg(e: any) {
    if (!e) return 'unknown_error'
    if (typeof e === 'string') return e
    if (typeof e?.message === 'string') return e.message
    try {
        return JSON.stringify(e)
    } catch {
        return String(e)
    }
}

function isFirestoreIndexError(e: any) {
    const msg = getErrMsg(e).toLowerCase()
    return msg.includes('index') && msg.includes('firestore')
}

function mean(nums: number[]) {
    if (!nums.length) return null
    return nums.reduce((a, b) => a + b, 0) / nums.length
}

function formatZarCompact(v: number) {
    try {
        return new Intl.NumberFormat('en-ZA', {
            style: 'currency',
            currency: 'ZAR',
            notation: 'compact',
            maximumFractionDigits: 1,
        }).format(v)
    } catch {
        return v.toLocaleString()
    }
}

function normalizeMonthlySeries(input: any): Array<{ t: number; v: number }> {
    if (!input) return []

    if (Array.isArray(input)) {
        const points: Array<{ t: number; v: number }> = []
        input.forEach((x: any, idx: number) => {
            const t =
                toMillis(x?.date) ||
                toMillis(x?.month) ||
                toMillis(x?.createdAt) ||
                toMillis(x?.timestamp) ||
                (Number.isFinite(x?._seconds) ? x._seconds * 1000 : 0) ||
                0

            const v =
                typeof x === 'number'
                    ? x
                    : typeof x?.revenue === 'number'
                        ? x.revenue
                        : typeof x?.value === 'number'
                            ? x.value
                            : typeof x?.amount === 'number'
                                ? x.amount
                                : NaN

            if (Number.isFinite(v)) points.push({ t: t || idx, v })
        })

        if (points.some(p => p.t && p.t > 10_000_000_000)) {
            points.sort((a, b) => a.t - b.t)
            return points
        }

        return points.map((p, i) => ({ t: p.t || i, v: p.v }))
    }

    return []
}

const panelCardStyle: React.CSSProperties = {
    borderRadius: 16,
    border: '1px solid #eef2ff',
    boxShadow: '0 10px 28px rgba(0,0,0,0.08)',
    overflow: 'hidden',
}

const panelBodyStyle: React.CSSProperties = { padding: 14 }

const hoverLiftWrap: React.CSSProperties = {
    transition: 'transform .15s ease, box-shadow .15s ease',
}

export const SMEsMasterPage: React.FC = () => {
    const { message: messageApi } = App.useApp()
    const screens = useBreakpoint()
    const isMobile = !!screens.xs && !screens.md

    const { user } = useFullIdentity() as any
    const { selected, selectSME, prefetchSME } = useSMEDetails()

    const [loading, setLoading] = useState(false)

    const [participants, setParticipants] = useState<AnyDoc[]>([])
    const [appsLatestByParticipant, setAppsLatestByParticipant] = useState<Record<string, LatestApp | null>>({})
    const [assignedCountByParticipant, setAssignedCountByParticipant] = useState<Record<string, number>>({})

    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
    const [detailsOpen, setDetailsOpen] = useState(false)

    const [detailsAssignments, setDetailsAssignments] = useState<AssignedInterventionDoc[]>([])
    const [detailsAssignmentsLoading, setDetailsAssignmentsLoading] = useState(false)

    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

    const [search, setSearch] = useState('')
    const [sector, setSector] = useState<string | 'all'>('all')
    const [stateFilter, setStateFilter] = useState<SMEState | 'all'>('all')
    const [perfLevel, setPerfLevel] = useState<PerfLevel>('all')
    const [revenueBracket, setRevenueBracket] = useState<RevenueBracket>('all')
    const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
    const [joinRange, setJoinRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])

    const [detailsTab, setDetailsTab] = useState<'overview' | 'visuals' | 'interventions'>('overview')
    const [compareBy, setCompareBy] = useState<'sector' | 'female' | 'black_owned'>('sector')

    const lastToastKeyRef = useRef<string>('')

    const toastErrorOnce = (key: string, text: string) => {
        if (lastToastKeyRef.current === key) return
        lastToastKeyRef.current = key
        messageApi.error(text)
    }

    const reportLoadError = (scope: string, e: any) => {
        console.log('[SMEsMasterPage] ERROR scope=', scope)
        console.log(e)

        if (isFirestoreIndexError(e)) {
            toastErrorOnce(
                `idx:${scope}`,
                'Some SME data needs a Firestore index. Open the browser console, click the index link, create it, then refresh.'
            )
            return
        }

        toastErrorOnce(
            `err:${scope}`,
            'Could not load some SME data right now. Refresh the page. If it keeps happening, check console logs.'
        )
    }

    const applyMetricFilter = (k: 'all' | 'active' | 'at_risk' | 'graduated') => {
        if (k === 'all') setStateFilter('all')
        if (k === 'active') setStateFilter('active')
        if (k === 'at_risk') setStateFilter('at_risk')
        if (k === 'graduated') setStateFilter('graduated')
    }

    useEffect(() => {
        if (!user?.companyCode) return

        setLoading(true)

        const unsubs: Array<() => void> = []

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
                        reportLoadError('participants_snapshot', e)
                        setLoading(false)
                    }
                )
            )
        } catch (e: any) {
            console.log('[SMEsMasterPage] participants init failed')
            console.log(e)
            toastErrorOnce('init:participants', 'Failed to initialize SME participants feed. Check console.')
            setLoading(false)
        }

        try {
            const aq = query(collection(db, 'applications'), where('companyCode', '==', user.companyCode))
            unsubs.push(
                onSnapshot(
                    aq,
                    snap => {
                        const map: Record<string, LatestApp | null> = {}
                        snap.docs.forEach(d => {
                            const a = { id: d.id, ...(d.data() as DocumentData) } as LatestApp
                            const pid = typeof a.participantId === 'string' ? a.participantId : null
                            if (!pid) return
                            if (!map[pid]) map[pid] = a
                        })
                        setAppsLatestByParticipant(map)
                    },
                    e => reportLoadError('applications_snapshot', e)
                )
            )
        } catch (e: any) {
            console.log('[SMEsMasterPage] applications init failed')
            console.log(e)
            toastErrorOnce('init:applications', 'Failed to initialize applications feed. Check console.')
        }

        try {
            const iq = query(collection(db, 'assignedInterventions'), where('companyCode', '==', user.companyCode))
            unsubs.push(
                onSnapshot(
                    iq,
                    snap => {
                        const counts: Record<string, number> = {}
                        snap.docs.forEach(d => {
                            const x = { id: d.id, ...(d.data() as DocumentData) } as AssignedInterventionDoc
                            const pid = typeof x.participantId === 'string' ? x.participantId : null
                            if (!pid) return
                            counts[pid] = (counts[pid] || 0) + 1
                        })
                        setAssignedCountByParticipant(counts)
                    },
                    e => reportLoadError('assignedInterventions_snapshot', e)
                )
            )
        } catch (e: any) {
            console.log('[SMEsMasterPage] assignedInterventions init failed')
            console.log(e)
            toastErrorOnce('init:assignedInterventions', 'Failed to initialize intervention assignments feed. Check console.')
        }

        return () => {
            unsubs.forEach(u => {
                try {
                    u()
                } catch {
                    // noop
                }
            })
        }
    }, [user?.companyCode])

    useEffect(() => {
        if (!detailsOpen) return
        if (!user?.companyCode) return
        if (!selected?.participantId) return


        setDetailsAssignmentsLoading(true)
        setDetailsAssignments([])

        const qx = query(
            collection(db, 'assignedInterventions'),
            where('companyCode', '==', user.companyCode),
            where('participantId', '==', selected.participantId)
        )

        const unsub = onSnapshot(
            qx,
            snap => {
                const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as DocumentData) } as AssignedInterventionDoc))
                arr.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
                setDetailsAssignments(arr)
                console.log('Assigned Interventions: ', arr)
                setDetailsAssignmentsLoading(false)
            },
            e => {
                reportLoadError('details_assignments_snapshot', e)
                setDetailsAssignmentsLoading(false)
            }
        )

        return () => {
            try {
                unsub()
            } catch {
                // noop
            }
        }
    }, [detailsOpen, user?.companyCode, selected?.participantId])

    const sectorOptions = useMemo(() => {
        const set = new Set<string>()
        participants.forEach(p => {
            const v = p?.sector
            if (typeof v === 'string' && v.trim()) set.add(v)
        })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [participants])

    const rows: SMEListRow[] = useMemo(() => {
        const nowMs = Date.now()

        const acceptedParticipants = participants.filter(p => {
            const pid = p.id as string
            return !!appsLatestByParticipant[pid] // has an application doc tracked
        })

        return acceptedParticipants.map(p => {
            const participantId = p.id as string
            const app = appsLatestByParticipant[participantId] || null

            const beneficiaryName =
                (typeof p?.beneficiaryName === 'string' && p.beneficiaryName) ||
                (typeof app?.beneficiaryName === 'string' && app.beneficiaryName) ||
                (typeof p?.businessName === 'string' && p.businessName) ||
                'Unnamed SME'

            const sector = typeof p?.sector === 'string' ? p.sector : typeof app?.sector === 'string' ? app.sector : null
            const email = typeof p?.email === 'string' ? p.email : typeof app?.email === 'string' ? app.email : null
            const phone = typeof p?.phone === 'string' ? p.phone : typeof p?.phoneNumber === 'string' ? p.phoneNumber : null

            const locationLabel =
                typeof p?.city === 'string' ? p.city : typeof p?.location === 'string' ? p.location : null

            const acceptedAtMs = Math.max(toMillis(app?.acceptedAt), toMillis(app?.submittedAt), 0)
            const joinedLabel = acceptedAtMs ? dayjs(acceptedAtMs).format('YYYY-MM-DD') : 'n/a'

            const requiredRaw = app?.interventions?.required
            const requiredCount = Array.isArray(requiredRaw) ? requiredRaw.length : 0

            const assignedCount = assignedCountByParticipant[participantId] || 0
            const assignmentCoveragePct = requiredCount ? (assignedCount / requiredCount) * 100 : null

            const rev = inferRevenueTrendFromParticipant(p)
            const { state, riskReasons, wins, needsAttention, complianceStatus, lastActivityMs } = computeStateAndSignals({
                participant: p,
                app,
                assignedCount,
                requiredCount,
                revenueGrowthPct: rev.growthPct,
                latestRevenue: rev.latest,
                nowMs,
            })

            const perfScore = computePerformanceScore(p, rev.latest, assignmentCoveragePct)
            const perfLvl = perfLevelFromScore(perfScore)

            return {
                participantId,
                beneficiaryName,
                sector,
                email,
                phone,
                locationLabel,
                acceptedAtMs,
                joinedLabel,

                latestRevenue: rev.latest,
                revenueGrowthPct: rev.growthPct,
                revenueTrend: rev.series,
                complianceStatus,

                requiredCount,
                assignedCount,
                assignmentCoveragePct,

                state,
                perfScore,
                perfLevel: perfLvl,

                riskReasons,
                wins,
                needsAttention,

                lastActivityMs,
            }
        })
    }, [participants, appsLatestByParticipant, assignedCountByParticipant])

    const filtered = useMemo(() => {
        const s = safeLower(search)
        const [from, to] = joinRange

        return rows.filter(r => {
            const hay = safeLower(r.beneficiaryName) + ' ' + safeLower(r.email) + ' ' + safeLower(r.sector) + ' ' + safeLower(r.participantId)

            if (s && !hay.includes(s)) return false
            if (sector !== 'all' && r.sector !== sector) return false
            if (stateFilter !== 'all' && r.state !== stateFilter) return false

            if (from && r.acceptedAtMs && r.acceptedAtMs < from.startOf('day').valueOf()) return false
            if (to && r.acceptedAtMs && r.acceptedAtMs > to.endOf('day').valueOf()) return false

            if (riskFilter !== 'all') {
                const isAtRisk = r.state === 'at_risk'
                if (riskFilter === 'at_risk' && !isAtRisk) return false
                if (riskFilter === 'ok' && isAtRisk) return false
            }

            if (perfLevel !== 'all') {
                if (perfLevel === 'high' && r.perfLevel !== 'high') return false
                if (perfLevel === 'medium' && r.perfLevel !== 'medium') return false
                if (perfLevel === 'low' && r.perfLevel !== 'low') return false
            }

            if (revenueBracket !== 'all') {
                const b = revenueBracketOf(r.latestRevenue)
                if (b !== revenueBracket) return false
            }

            return true
        })
    }, [rows, search, sector, stateFilter, joinRange, riskFilter, perfLevel, revenueBracket])

    const metrics = useMemo(() => {
        const total = rows.length
        const active = rows.filter(r => r.state === 'active').length
        const atRisk = rows.filter(r => r.state === 'at_risk').length
        const graduated = rows.filter(r => r.state === 'graduated').length
        return { total, active, atRisk, graduated }
    }, [rows])

    const resetFilters = () => {
        setSearch('')
        setSector('all')
        setStateFilter('all')
        setPerfLevel('all')
        setRevenueBracket('all')
        setRiskFilter('all')
        setJoinRange([null, null])
        setSelectedRowKeys([])
    }

    const openSME = async (participantId: string) => {
        selectSME(participantId)
        setDetailsTab('overview')
        setCompareBy('sector')
        setDetailsOpen(true)

        try {
            await prefetchSME(participantId)
        } catch (e) {
            console.log('[SMEsMasterPage] prefetchSME failed')
            console.log(e)
            toastErrorOnce('prefetch', 'Could not pre-load SME details. The details modal will still try to load live data.')
        }
    }

    const closeDetails = () => {
        setDetailsOpen(false)
        selectSME(null)
        setDetailsAssignments([])
    }

    const flagSME = (participantId: string) => {
        void participantId
        messageApi.info('Flag logic not implemented yet.')
    }

    const bulkMenu: MenuProps = {
        items: [
            { key: 'send', label: 'Send communication' },
            { key: 'export', label: 'Export selected' },
            { key: 'flag', label: 'Flag selected' },
            { key: 'note', label: 'Add bulk note' },
        ],
        onClick: ({ key }) => {
            if (!selectedRowKeys.length) {
                messageApi.warning('Select at least one SME first.')
                return
            }
            messageApi.info(`Bulk action "${key}" not implemented yet.`)
        },
    }

    const rowSelection: TableRowSelection<SMEListRow> = {
        selectedRowKeys,
        onChange: keys => setSelectedRowKeys(keys),
    }

    const columns: ColumnsType<SMEListRow> = [
        {
            title: 'SME',
            key: 'sme',
            fixed: 'left',
            width: 280,
            render: (_, r) => (
                <Space>
                    <Avatar size={38} icon={<UserOutlined />} style={{ background: 'rgba(22,119,255,.12)', color: '#1677ff' }} />
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, lineHeight: 1.15 }}>{r.beneficiaryName}</div>
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
                            {r.sector || 'No sector'}
                            {r.locationLabel ? ` • ${r.locationLabel}` : ''}
                        </div>
                    </div>
                </Space>
            ),
        },
        { title: 'Joined', dataIndex: 'joinedLabel', key: 'joinedLabel', width: 120 },
        {
            title: 'Performance',
            key: 'performance',
            width: 190,
            render: (_, r) => (
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        {perfLevelTag(r.perfLevel, r.perfScore)}
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {r.perfScore !== null ? `${r.perfScore}%` : 'n/a'}
                        </Text>
                    </Space>
                    <Progress
                        percent={r.perfScore ?? 0}
                        showInfo={false}
                        status={r.perfScore === null ? 'normal' : r.perfScore >= 75 ? 'success' : r.perfScore >= 45 ? 'active' : 'exception'}
                    />
                </Space>
            ),
        },
        {
            title: 'Revenue Trend',
            key: 'revenueTrend',
            width: 160,
            render: (_, r) => (
                <Space direction="vertical" size={2}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text strong>{typeof r.latestRevenue === 'number' ? r.latestRevenue.toLocaleString() : 'n/a'}</Text>
                        <Tag color={typeof r.revenueGrowthPct === 'number' ? (r.revenueGrowthPct >= 0 ? 'green' : 'red') : 'default'}>
                            {typeof r.revenueGrowthPct === 'number' ? `${Math.round(r.revenueGrowthPct)}%` : 'n/a'}
                        </Tag>
                    </Space>
                    <Tooltip title="Trend derived from participants.revenueHistory (last 6 points)">
                        <span>{sparklineSvg(r.revenueTrend) || <Text type="secondary">n/a</Text>}</span>
                    </Tooltip>
                </Space>
            ),
        },
        {
            title: 'Assignments',
            key: 'assignments',
            width: 170,
            render: (_, r) => (
                <Tooltip title={r.requiredCount ? `Assigned ${r.assignedCount} of ${r.requiredCount} required` : 'No required interventions found on latest application'}>
                    <Space>
                        <Text>
                            {r.assignedCount} / {r.requiredCount}
                        </Text>
                        {pctTag(r.assignmentCoveragePct, 'Coverage')}
                    </Space>
                </Tooltip>
            ),
        },
        {
            title: 'Risk',
            key: 'risk',
            width: 220,
            render: (_, r) => {
                const isRisk = r.state === 'at_risk'
                const badgeColor = isRisk ? '#faad14' : '#52c41a'
                const tip = isRisk ? r.riskReasons.join(' • ') : r.wins.length ? `Wins: ${r.wins.join(' • ')}` : 'No risk flags'
                return (
                    <Tooltip title={tip}>
                        <Space>
                            <Badge color={badgeColor} />
                            <Text>{isRisk ? 'Attention' : 'OK'}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                • last activity {msToHumanAgo(r.lastActivityMs, Date.now())}
                            </Text>
                        </Space>
                    </Tooltip>
                )
            },
        },
        { title: 'State', key: 'state', width: 120, render: (_, r) => stateTag(r.state) },
        {
            title: 'Actions',
            key: 'actions',
            width: 240,
            fixed: 'right',
            render: (_, r) => (
                <Space>
                    <Button
                        shape='round'
                        variant='filled'
                        color='geekblue'
                        style={{ border: '1px solid dodgerblue' }}
                        icon={<EyeOutlined />}

                        onClick={() => openSME(r.participantId)}
                        onMouseEnter={() => {
                            void prefetchSME(r.participantId)
                        }}
                    >
                        View
                    </Button>
                    <Button
                        color='red'
                        shape='circle'
                        variant='filled'
                        icon={<FlagOutlined />}
                        style={{ border: '1px solid crimson' }}
                        onClick={() => flagSME(r.participantId)}
                    />
                </Space>
            ),
        },
    ]

    const drawerDetails = useMemo(() => {
        const nowMs = Date.now()
        if (!selected) return null

        const p = (selected.participant || {}) as AnyDoc
        const a = (selected.latestApplication || {}) as LatestApp

        const natureOfBusiness =
            (typeof p?.natureOfBusiness === 'string' && p.natureOfBusiness) ||
            (typeof p?.businessNature === 'string' && p.businessNature) ||
            (typeof p?.businessDescription === 'string' && p.businessDescription) ||
            (typeof a?.natureOfBusiness === 'string' && a.natureOfBusiness) ||
            'n/a'

        const ownershipBreakdown = p?.ownershipBreakdown || p?.ownership || null

        const locationParts = [
            typeof p?.address === 'string' ? p.address : null,
            typeof p?.city === 'string' ? p.city : null,
            typeof p?.province === 'string' ? p.province : null,
            typeof p?.country === 'string' ? p.country : null,
        ].filter(Boolean)

        const location = locationParts.length ? locationParts.join(', ') : 'n/a'

        const lastActivityMs = Math.max(
            toMillis(p?.updatedAt),
            toMillis(p?.lastActivityAt),
            toMillis(p?.lastServicedAt),
            toMillis(p?.lastServiceAt),
            toMillis(selected.latestMonthly?.createdAt),
            0
        )

        const riskItems: Array<{ level: 'warn' | 'ok'; text: string }> = []

        if (lastActivityMs && nowMs - lastActivityMs > 30 * 24 * 60 * 60 * 1000) {
            riskItems.push({ level: 'warn', text: `No activity / servicing for 30+ days (last: ${dayjs(lastActivityMs).format('YYYY-MM-DD')}).` })
        } else if (lastActivityMs) {
            riskItems.push({ level: 'ok', text: `Recent activity: ${msToHumanAgo(lastActivityMs, nowMs)}.` })
        }

        const assignedStale = detailsAssignments.filter(x => {
            const st = safeLower(x.status)
            const createdAtMs = toMillis(x.createdAt)
            return (st === 'assigned' || st === 'pending' || st === 'new') && createdAtMs && nowMs - createdAtMs > 7 * 24 * 60 * 60 * 1000
        })
        if (assignedStale.length) {
            riskItems.push({ level: 'warn', text: `${assignedStale.length} intervention(s) assigned but not accepted for 7+ days.` })
        }

        const inProgressOver = detailsAssignments.filter(x => {
            const st = safeLower(x.status)
            if (st !== 'in-progress' && st !== 'inprogress') return false
            const createdAtMs = toMillis(x.createdAt)
            if (!createdAtMs) return false
            const dueAtMs = toMillis(x.dueAt)
            if (dueAtMs && nowMs <= dueAtMs) return false
            return nowMs - createdAtMs > 30 * 24 * 60 * 60 * 1000
        })
        if (inProgressOver.length) {
            riskItems.push({ level: 'warn', text: `${inProgressOver.length} intervention(s) in progress for 30+ days.` })
        }

        const completed = detailsAssignments
            .filter(x => safeLower(x.status) === 'completed' || safeLower(x.status) === 'done')
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))

        const lastCompletedAtMs = completed.length ? toMillis(completed[0].createdAt) : 0
        if (detailsAssignments.length && !lastCompletedAtMs) {
            riskItems.push({ level: 'warn', text: 'No completed interventions found for this SME.' })
        } else if (lastCompletedAtMs && nowMs - lastCompletedAtMs > 30 * 24 * 60 * 60 * 1000) {
            riskItems.push({ level: 'warn', text: `No intervention completion in 30+ days (last: ${dayjs(lastCompletedAtMs).format('YYYY-MM-DD')}).` })
        }

        const riskSummary = riskItems.length ? riskItems : [{ level: 'ok' as const, text: 'No risk signals detected from current data.' }]

        return {
            natureOfBusiness,
            ownershipBreakdown,
            location,
            lastActivityMs,
            riskSummary,
        }
    }, [selected, detailsAssignments])

    const selectedRow = useMemo(() => {
        if (!selected?.participantId) return null
        return rows.find(r => r.participantId === selected.participantId) || null
    }, [selected?.participantId, rows])

    const compareGroup = useMemo(() => {
        if (!selected || !selectedRow) return []

        const p = (selected.participant || {}) as AnyDoc
        const sectorValue = selectedRow.sector || null

        const femaleOwned = (() => {
            const fp = (selected as any)?.femaleOwnedPercent
            if (typeof fp === 'number') return fp >= 51 ? '51%+ female-owned' : '< 51% female-owned'
            if (typeof p?.femaleOwnedPercent === 'number') return p.femaleOwnedPercent >= 51 ? '51%+ female-owned' : '< 51% female-owned'
            return 'unknown'
        })()

        const blackOwned = (() => {
            const bp = (selected as any)?.blackOwnedPercent
            if (typeof bp === 'number') return bp >= 51 ? '51%+ black-owned' : '< 51% black-owned'
            if (typeof p?.blackOwnedPercent === 'number') return p.blackOwnedPercent >= 51 ? '51%+ black-owned' : '< 51% black-owned'
            return 'unknown'
        })()

        const inSameGroup = (r: SMEListRow) => {
            if (compareBy === 'sector') return !!sectorValue && r.sector === sectorValue
            if (compareBy === 'female') {
                const rr = participants.find(x => x.id === r.participantId) || {}
                const val = typeof rr?.femaleOwnedPercent === 'number' ? (rr.femaleOwnedPercent >= 51 ? '51%+ female-owned' : '< 51% female-owned') : 'unknown'
                return val === femaleOwned
            }
            if (compareBy === 'black_owned') {
                const rr = participants.find(x => x.id === r.participantId) || {}
                const val = typeof rr?.blackOwnedPercent === 'number' ? (rr.blackOwnedPercent >= 51 ? '51%+ black-owned' : '< 51% black-owned') : 'unknown'
                return val === blackOwned
            }
            return false
        }

        return rows.filter(r => inSameGroup(r))
    }, [selected, selectedRow, compareBy, rows, participants])

    const visuals = useMemo(() => {
        const nowMs = Date.now()
        const sr = selectedRow
        if (!selected || !sr) return null

        const p = (selected.participant || {}) as AnyDoc

        const selectedRevenuePoints =
            normalizeMonthlySeries(selected.monthlyHistory) ||
            normalizeMonthlySeries(p?.monthlyPerformance) ||
            normalizeMonthlySeries(p?.revenueHistory) ||
            []

        const fallbackSpark = (sr.revenueTrend || []).map((v, idx) => ({ t: idx, v }))
        const revPts = selectedRevenuePoints.length ? selectedRevenuePoints : fallbackSpark

        const revCategories = revPts.map(pt => {
            if (pt.t > 10_000_000_000) return dayjs(pt.t).format('MMM YY')
            return `P${pt.t}`
        })
        const revSeries = revPts.map(pt => pt.v)

        const groupPerf = compareGroup
            .map(r => r.perfScore)
            .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        const groupPerfAvg = mean(groupPerf)
        const overallPerf = rows
            .map(r => r.perfScore)
            .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        const overallPerfAvg = mean(overallPerf)

        const groupRev = compareGroup
            .map(r => r.latestRevenue)
            .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        const groupRevAvg = mean(groupRev)
        const overallRev = rows
            .map(r => r.latestRevenue)
            .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        const overallRevAvg = mean(overallRev)

        const revenueOptions: Highcharts.Options = {
            title: { text: undefined },
            credits: { enabled: false },
            legend: { enabled: false },
            xAxis: { categories: revCategories, tickLength: 0 },
            yAxis: { title: { text: undefined } },
            tooltip: {
                shared: true,
                formatter: function () {
                    const idx = (this as any)?.points?.[0]?.point?.index ?? (this as any)?.point?.index
                    const y = typeof idx === 'number' ? revSeries[idx] : null
                    return y === null ? '' : `<b>${revCategories[idx] ?? ''}</b><br/>Revenue: <b>${formatZarCompact(Number(y))}</b>`
                },
            },
            series: [{ type: 'line', name: 'Revenue', data: revSeries }],
        }

        const compareLabel = (() => {
            if (compareBy === 'sector') return sr.sector ? `Sector: ${sr.sector}` : 'Sector: n/a'
            if (compareBy === 'female') return 'Ownership: Female'
            return 'Ownership: Black-owned'
        })()

        const perfCompareOptions: Highcharts.Options = {
            chart: { type: 'column' },
            title: { text: undefined },
            credits: { enabled: false },
            xAxis: { categories: ['Selected', compareLabel, 'Overall'] },
            yAxis: { title: { text: undefined }, max: 100 },
            tooltip: {
                formatter: function () {
                    const y = (this as any)?.y
                    return y === null || y === undefined ? '' : `<b>${(this as any)?.key}</b><br/>Performance: <b>${Math.round(Number(y))}%</b>`
                },
            },
            series: [
                {
                    type: 'column',
                    name: 'Performance',
                    data: [
                        typeof sr.perfScore === 'number' ? sr.perfScore : null,
                        typeof groupPerfAvg === 'number' ? Math.round(groupPerfAvg) : null,
                        typeof overallPerfAvg === 'number' ? Math.round(overallPerfAvg) : null,
                    ],
                },
            ],
        }

        const revenueCompareOptions: Highcharts.Options = {
            chart: { type: 'bar' },
            title: { text: undefined },
            credits: { enabled: false },
            xAxis: { categories: ['Selected', compareLabel, 'Overall'] },
            yAxis: { title: { text: undefined } },
            tooltip: {
                formatter: function () {
                    const y = (this as any)?.y
                    return y === null || y === undefined ? '' : `<b>${(this as any)?.key}</b><br/>Revenue: <b>${formatZarCompact(Number(y))}</b>`
                },
            },
            series: [
                {
                    type: 'bar',
                    name: 'Latest Revenue',
                    data: [
                        typeof sr.latestRevenue === 'number' ? sr.latestRevenue : null,
                        typeof groupRevAvg === 'number' ? Math.round(groupRevAvg) : null,
                        typeof overallRevAvg === 'number' ? Math.round(overallRevAvg) : null,
                    ],
                },
            ],
        }

        const unaccepted7d = detailsAssignments.filter(x => {
            const st = safeLower(x.incubateeStatus)
            const createdAtMs = toMillis(x.createdAt)
            return (st === 'assigned' || st === 'pending' || st === 'new') && createdAtMs && nowMs - createdAtMs > 7 * 24 * 60 * 60 * 1000
        }).length

        const inProgress30d = detailsAssignments.filter(x => {
            const st = safeLower(x.status)
            if (st !== 'in-progress' && st !== 'inprogress') return false
            const createdAtMs = toMillis(x.createdAt)
            if (!createdAtMs) return false
            return nowMs - createdAtMs > 30 * 24 * 60 * 60 * 1000
        }).length

        const completed = detailsAssignments.filter(x => safeLower(x.status) === 'completed' || safeLower(x.status) === 'done').length

        return {
            revenueOptions,
            perfCompareOptions,
            revenueCompareOptions,
            kpis: { unaccepted7d, inProgress30d, completed },
        }
    }, [selected, selectedRow, compareBy, compareGroup, rows, detailsAssignments])

    const bulkActionsDisabled = !selectedRowKeys.length

    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            <Helmet>
                <title>
                    SMEs Repository | Smart Incubation
                </title>
            </Helmet>

            <DashboardHeaderCard
                title="SMEs Repository"
                subtitle="Portfolio overview with risk, wins, and attention signals"
                extraRight={
                    <Space>
                        <Segmented
                            block
                            value={viewMode}
                            onChange={v => setViewMode(v as any)}
                            options={[
                                {
                                    label: (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <DatabaseOutlined />
                                            Table
                                        </span>
                                    ),
                                    value: 'table'
                                },
                                {
                                    label: (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <AppstoreOutlined />
                                            Cards
                                        </span>
                                    ),
                                    value: 'cards'
                                }
                            ]}
                        />
                        <Dropdown menu={bulkMenu} trigger={['click']}>
                            <Button shape='round' icon={< RightCircleOutlined />} disabled={bulkActionsDisabled}>
                                Bulk Actions
                            </Button>
                        </Dropdown>
                        <Button shape='round' icon={<ReloadOutlined />} onClick={resetFilters}>
                            Reset
                        </Button>
                    </Space>
                }
            />

            {loading ? <LoadingOverlay tip="Loading SMEs..." /> : null}

            <Row gutter={[10, 10]} style={{ marginBottom: 15 }}>
                <Col flex="1 1 0" style={{ minWidth: 240 }}>
                    <MotionCard>
                        <MotionCard.Metric
                            onClick={() => applyMetricFilter('all')}
                            icon={<TeamOutlined style={{ color: '#1677ff', fontSize: 18 }} />}
                            iconBg="rgba(22,119,255,.12)"
                            title="Total SMEs"
                            value={metrics.total}
                            right={stateFilter === 'all' ? <Tag color="blue">Filtered</Tag> : null}
                        />
                    </MotionCard>
                </Col>

                <Col flex="1 1 0" style={{ minWidth: 240 }}>
                    <MotionCard>
                        <MotionCard.Metric
                            onClick={() => applyMetricFilter('active')}
                            icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />}
                            iconBg="rgba(82,196,26,.12)"
                            title="Active"
                            value={metrics.active}
                            right={stateFilter === 'active' ? <Tag color="blue">Filtered</Tag> : null}
                        />
                    </MotionCard>
                </Col>

                <Col flex="1 1 0" style={{ minWidth: 240 }}>
                    <MotionCard>
                        <MotionCard.Metric
                            onClick={() => applyMetricFilter('at_risk')}
                            icon={<WarningOutlined style={{ color: '#faad14', fontSize: 18 }} />}
                            iconBg="rgba(250,173,20,.12)"
                            title="At Risk"
                            value={metrics.atRisk}
                            right={stateFilter === 'at_risk' ? <Tag color="blue">Filtered</Tag> : null}
                        />
                    </MotionCard>
                </Col>

                <Col flex="1 1 0" style={{ minWidth: 240 }}>
                    <MotionCard                >
                        <MotionCard.Metric
                            onClick={() => applyMetricFilter('graduated')}
                            icon={<TrophyOutlined style={{ color: '#1677ff', fontSize: 18 }} />}
                            iconBg="rgba(22,119,255,.12)"
                            title="Graduated"
                            value={metrics.graduated}
                            right={stateFilter === 'graduated' ? <Tag color="blue">Filtered</Tag> : null}
                        />
                    </MotionCard>
                </Col>
            </Row>

            <MotionCard style={{ marginBottom: 10 }}>
                <Row gutter={[10, 10]} align="middle">
                    <Col xs={24} md={6}>
                        <Input
                            allowClear
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            prefix={<SearchOutlined />}
                            placeholder="Search name, sector, email, ID"
                        />
                    </Col>

                    <Col xs={24} md={4}>
                        <Select
                            value={sector}
                            onChange={v => setSector(v)}
                            style={{ width: '100%' }}
                            options={[{ label: 'All sectors', value: 'all' }, ...sectorOptions.map(s => ({ label: s, value: s }))]}
                        />
                    </Col>

                    <Col xs={24} md={4}>
                        <Select
                            value={stateFilter}
                            onChange={v => setStateFilter(v)}
                            style={{ width: '100%' }}
                            options={[
                                { label: 'All states', value: 'all' },
                                { label: 'Active', value: 'active' },
                                { label: 'Inactive', value: 'inactive' },
                                { label: 'At Risk', value: 'at_risk' },
                                { label: 'Graduated', value: 'graduated' },
                                { label: 'Unknown', value: 'unknown' },
                            ]}
                        />
                    </Col>

                    <Col xs={24} md={4}>
                        <Select
                            value={perfLevel}
                            onChange={v => setPerfLevel(v)}
                            style={{ width: '100%' }}
                            options={[
                                { label: 'All performance', value: 'all' },
                                { label: 'High', value: 'high' },
                                { label: 'Medium', value: 'medium' },
                                { label: 'Low', value: 'low' },
                            ]}
                        />
                    </Col>

                    {/* <Col xs={24} md={4}>
                        <Select
                            value={revenueBracket}
                            onChange={v => setRevenueBracket(v)}
                            style={{ width: '100%' }}
                            options={[
                                { label: 'All revenue', value: 'all' },
                                { label: '< 5k', value: 'lt5k' },
                                { label: '5k - 20k', value: '5k_20k' },
                                { label: '20k - 100k', value: '20k_100k' },
                                { label: '100k+', value: '100k_plus' },
                            ]}
                        />
                    </Col> */}

                    {/* <Col xs={24} md={4}>
                        <Select
                            value={riskFilter}
                            onChange={v => setRiskFilter(v)}
                            style={{ width: '100%' }}
                            options={[
                                { label: 'All', value: 'all' },
                                { label: 'At risk', value: 'at_risk' },
                                { label: 'OK', value: 'ok' },
                            ]}
                        />
                    </Col> */}

                    <Col xs={24} md={6}>
                        <DatePicker.RangePicker
                            style={{ width: '100%' }}
                            value={joinRange}
                            onChange={vals => setJoinRange((vals as any) || [null, null])}
                        />
                    </Col>
                </Row>
            </MotionCard>

            {viewMode === 'table' ? (
                <MotionCard>
                    <Table
                        rowKey="participantId"
                        columns={columns}
                        dataSource={filtered}
                        scroll={{ x: 1400 }}
                        pagination={{ pageSize: 10, showSizeChanger: true }}
                        rowSelection={rowSelection}
                    />
                </MotionCard>
            ) : (
                <Row gutter={[10, 10]}>
                    {filtered.map(r => (
                        <Col key={r.participantId} xs={24} sm={12} lg={8} xl={6}>
                            <MotionCard>
                                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                    <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Space>
                                            <Avatar size={44} icon={<UserOutlined />} style={{ background: 'rgba(22,119,255,.12)', color: '#1677ff' }} />
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 800, lineHeight: 1.15 }}>{r.beneficiaryName}</div>
                                                <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
                                                    {r.sector || 'No sector'}
                                                    {r.locationLabel ? ` • ${r.locationLabel}` : ''}
                                                </div>
                                            </div>
                                        </Space>
                                        <Space>
                                            {stateTag(r.state)}
                                            <Button
                                                icon={<EyeOutlined />}
                                                onClick={() => openSME(r.participantId)}
                                                onMouseEnter={() => {
                                                    void prefetchSME(r.participantId)
                                                }}
                                            />
                                        </Space>
                                    </Space>

                                    <Divider style={{ margin: '6px 0' }} />

                                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                            <Text type="secondary">Performance</Text>
                                            {perfLevelTag(r.perfLevel, r.perfScore)}
                                        </Space>
                                        <Progress
                                            percent={r.perfScore ?? 0}
                                            showInfo={false}
                                            status={r.perfScore === null ? 'normal' : r.perfScore >= 75 ? 'success' : r.perfScore >= 45 ? 'active' : 'exception'}
                                        />

                                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                            <Text type="secondary">Revenue</Text>
                                            <Tag color={typeof r.revenueGrowthPct === 'number' ? (r.revenueGrowthPct >= 0 ? 'green' : 'red') : 'default'}>
                                                {typeof r.revenueGrowthPct === 'number' ? `${Math.round(r.revenueGrowthPct)}%` : 'n/a'}
                                            </Tag>
                                        </Space>
                                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                            <Text strong>{typeof r.latestRevenue === 'number' ? r.latestRevenue.toLocaleString() : 'n/a'}</Text>
                                            {sparklineSvg(r.revenueTrend)}
                                        </Space>

                                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                            <Text type="secondary">Assignments</Text>
                                            <Text>
                                                {r.assignedCount} / {r.requiredCount}
                                            </Text>
                                        </Space>
                                        {pctTag(r.assignmentCoveragePct, 'Coverage')}

                                        <Space wrap>
                                            {r.riskReasons.slice(0, 2).map(x => (
                                                <Tag key={x} color="gold">
                                                    {x}
                                                </Tag>
                                            ))}
                                            {!r.riskReasons.length &&
                                                r.wins.slice(0, 2).map(x => (
                                                    <Tag key={x} color="green">
                                                        {x}
                                                    </Tag>
                                                ))}
                                        </Space>
                                    </Space>

                                    <Divider style={{ margin: '6px 0' }} />

                                    <Row gutter={24}>
                                        <Col span={24}>
                                            <Button
                                                block
                                                shape='round'
                                                color="geekblue"
                                                variant='filled'
                                                icon={<EyeOutlined />}
                                                style={{ border: '1px solid dodgerblue' }}
                                                onClick={() => openSME(r.participantId)}>
                                                View
                                            </Button>
                                        </Col>
                                    </Row>
                                </Space>
                            </MotionCard>
                        </Col>
                    ))}
                </Row>
            )}

            <Modal
                open={detailsOpen}
                onCancel={closeDetails}
                width={isMobile ? '100%' : 1120}
                style={isMobile ? { top: 0, paddingBottom: 0 } : undefined}
                destroyOnClose
                title={null}
                footer={null}
                styles={{
                    body: { padding: 14 },
                    content: { borderRadius: 16 },
                }}
            >
                <style>{`
    .lift:hover { transform: translateY(-2px); }
    .segWrap .ant-segmented { background: transparent; }
    .segWrap .ant-segmented-group { gap: 8px; }
    .segWrap .ant-segmented-item { border-radius: 12px !important; }
    .segWrap .ant-segmented-item-label { padding: 6px 12px !important; font-weight: 600; }
    .segWrap .ant-segmented-thumb { border-radius: 12px !important; }
  `}</style>

                {!selected ? (
                    <div style={{ padding: 8 }}>
                        <Text type="secondary">Select an SME to view details.</Text>
                    </div>
                ) : (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {/* HEADER CARD */}
                        <Row gutter={[12, 12]} align="middle" justify="space-between">
                            <Col flex="auto">
                                <MotionCard>
                                    <Space align="center" size={12} style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Space align="center" size={12}>
                                            <Avatar
                                                size={56}
                                                src={(selected.user as any)?.photoURL}
                                                icon={<UserOutlined />}
                                                style={{ background: '#f5f5f5' }}
                                            />
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <Text strong style={{ fontSize: 16 }}>
                                                        {selected.beneficiaryName || 'SME'}
                                                    </Text>
                                                    {selectedRow ? stateTag(selectedRow.state) : null}
                                                </div>
                                                <div style={{ fontSize: 12, color: 'rgba(0,0,0,.65)' }}>
                                                    {selected.sector || selectedRow?.sector || 'No sector'}
                                                    {selectedRow?.locationLabel ? ` • ${selectedRow.locationLabel}` : ''}
                                                </div>
                                                <div style={{ marginTop: 6 }}>
                                                    <Space wrap>
                                                        <Tag>{selected.email || 'No email'}</Tag>
                                                        <Tag>
                                                            {(selected.participant as any)?.phone ||
                                                                (selected.participant as any)?.phoneNumber ||
                                                                'No phone'}
                                                        </Tag>
                                                    </Space>
                                                </div>
                                            </div>
                                        </Space>

                                        <Space>
                                            <Button
                                                color='red'
                                                shape='circle'
                                                variant='filled'
                                                icon={<FlagOutlined />}
                                                style={{ border: '1px solid crimson' }}
                                                onClick={() => flagSME(selected.participantId)}
                                            />
                                        </Space>
                                    </Space>
                                </MotionCard>
                            </Col>
                        </Row>

                        {(selected.errors?.participant ||
                            selected.errors?.application ||
                            selected.errors?.monthlyHistory ||
                            selected.errors?.latestMonthly) ? (
                            <Card
                                size="small"
                                style={{ borderRadius: 12, border: '1px solid #fff7e6', background: '#fffbe6' }}
                                bodyStyle={{ padding: 10 }}
                            >
                                <Space align="start">
                                    <WarningOutlined style={{ color: '#faad14', marginTop: 2 }} />
                                    <div>
                                        <div style={{ fontWeight: 700 }}>Some details did not load</div>
                                        <div style={{ color: 'rgba(0,0,0,.65)', fontSize: 12 }}>Refresh if something looks missing.</div>
                                    </div>
                                </Space>
                            </Card>
                        ) : null}

                        {/* SEGMENTED (more visible) + compare filter */}
                        <MotionCard
                            style={{
                                marginBottom: 10,
                                background: 'linear-gradient(90deg, #eef4ff 0%, #f7faff 100%)',
                                border: '1px solid #d6e4ff',
                            }}
                            bodyStyle={{ padding: 14 }}
                        >
                            <Row justify="space-between" align="middle" gutter={[12, 12]} wrap>
                                <Col flex="auto">
                                    <div>
                                        <Segmented
                                            value={detailsTab}
                                            onChange={(v) => setDetailsTab(v as any)}
                                            options={[
                                                { label: 'Overview', value: 'overview', icon: <FileTextOutlined /> },
                                                { label: 'Visualisations', value: 'visuals', icon: <LineChartOutlined /> },
                                                { label: 'Interventions', value: 'interventions', icon: <BarChartOutlined /> },
                                            ]}
                                            style={{
                                                background: 'transparent',
                                                borderRadius: 25
                                            }}
                                        />
                                    </div>
                                </Col>

                                {detailsTab === 'visuals' && (
                                    <Col>
                                        <div>
                                            <Text type="secondary" style={{ marginRight: 8 }}>
                                                Compare by
                                            </Text>
                                            <Select
                                                value={compareBy}
                                                onChange={(v) => setCompareBy(v)}
                                                style={{ width: 240 }}
                                                options={[
                                                    { label: 'Sector', value: 'sector' },
                                                    { label: 'Female ownership', value: 'female' },
                                                    { label: 'Black ownership', value: 'black_owned' },
                                                ]}
                                            />
                                        </div>
                                    </Col>
                                )}
                            </Row>
                        </MotionCard>

                        {/* OVERVIEW */}
                        {detailsTab === 'overview' ? (
                            <>
                                <Row gutter={[10, 10]}>
                                    <Col xs={24} md={14}>
                                        <div className="lift" style={hoverLiftWrap}>
                                            <Card style={panelCardStyle} bodyStyle={panelBodyStyle}>
                                                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                                    <Space align="start">
                                                        <ApartmentOutlined style={{ color: '#1677ff' }} />
                                                        <div>
                                                            <div style={{ fontWeight: 800 }}>Nature of Business</div>
                                                            <div style={{ color: 'rgba(0,0,0,.65)' }}>{drawerDetails?.natureOfBusiness || 'n/a'}</div>
                                                        </div>
                                                    </Space>

                                                    <Divider style={{ margin: '6px 0' }} />

                                                    <Space align="start">
                                                        <EnvironmentOutlined style={{ color: '#1677ff' }} />
                                                        <div>
                                                            <div style={{ fontWeight: 800 }}>Location</div>
                                                            <div style={{ color: 'rgba(0,0,0,.65)' }}>{drawerDetails?.location || 'n/a'}</div>
                                                        </div>
                                                    </Space>

                                                    <Divider style={{ margin: '6px 0' }} />

                                                    <Space align="start">
                                                        <PieChartOutlined style={{ color: '#1677ff' }} />
                                                        <div style={{ width: '100%' }}>
                                                            <div style={{ fontWeight: 800 }}>Ownership Breakdown</div>
                                                            <Space wrap style={{ marginTop: 6 }}>
                                                                {typeof (selected as any)?.blackOwnedPercent === 'number' ? (
                                                                    <Tag color="blue">{(selected as any).blackOwnedPercent}% Black-owned</Tag>
                                                                ) : (
                                                                    <Tag>Black-owned: n/a</Tag>
                                                                )}
                                                                {typeof (selected as any)?.femaleOwnedPercent === 'number' ? (
                                                                    <Tag color="purple">{(selected as any).femaleOwnedPercent}% Female-owned</Tag>
                                                                ) : (
                                                                    <Tag>Female-owned: n/a</Tag>
                                                                )}
                                                            </Space>

                                                            {drawerDetails?.ownershipBreakdown ? (
                                                                <div style={{ marginTop: 10 }}>
                                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                                        Additional ownership data
                                                                    </Text>
                                                                    <pre
                                                                        style={{
                                                                            margin: 0,
                                                                            marginTop: 6,
                                                                            padding: 10,
                                                                            background: '#f7faff',
                                                                            border: '1px solid #e6efff',
                                                                            borderRadius: 10,
                                                                            overflow: 'auto',
                                                                            maxHeight: 160,
                                                                        }}
                                                                    >
                                                                        {(() => {
                                                                            try {
                                                                                return JSON.stringify(drawerDetails.ownershipBreakdown, null, 2)
                                                                            } catch {
                                                                                return String(drawerDetails.ownershipBreakdown)
                                                                            }
                                                                        })()}
                                                                    </pre>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </Space>
                                                </Space>
                                            </Card>
                                        </div>
                                    </Col>

                                    <Col xs={24} md={10}>
                                        <div className="lift" style={hoverLiftWrap}>
                                            <Card style={panelCardStyle} bodyStyle={panelBodyStyle}>
                                                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                                    <Space align="start">
                                                        <ClockCircleOutlined style={{ color: '#1677ff', marginTop: 2 }} />
                                                        <div>
                                                            <div style={{ fontWeight: 800 }}>Last activity / servicing</div>
                                                            <div style={{ color: 'rgba(0,0,0,.65)' }}>
                                                                {drawerDetails?.lastActivityMs
                                                                    ? `${dayjs(drawerDetails.lastActivityMs).format('YYYY-MM-DD')} • ${msToHumanAgo(
                                                                        drawerDetails.lastActivityMs,
                                                                        Date.now()
                                                                    )}`
                                                                    : 'n/a'}
                                                            </div>
                                                        </div>
                                                    </Space>

                                                    <Divider style={{ margin: '6px 0' }} />

                                                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                                        {(drawerDetails?.riskSummary || []).map((x, idx) => (
                                                            <Space key={idx} align="start">
                                                                {x.level === 'warn' ? (
                                                                    <WarningOutlined style={{ color: '#faad14', marginTop: 2 }} />
                                                                ) : (
                                                                    <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 2 }} />
                                                                )}
                                                                <Text style={{ color: 'rgba(0,0,0,.75)' }}>{x.text}</Text>
                                                            </Space>
                                                        ))}
                                                    </Space>
                                                </Space>
                                            </Card>
                                        </div>
                                    </Col>
                                </Row>


                                <Row gutter={[10, 10]}>
                                    <Col xs={24} md={24}>
                                        <div className="lift" style={hoverLiftWrap}>
                                            <Card style={panelCardStyle} bodyStyle={panelBodyStyle}>
                                                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                                    <Text>
                                                        Accepted At: <Text strong>{selected.acceptedAt || 'n/a'}</Text>
                                                    </Text>
                                                    <Text>
                                                        Program: <Text strong>{selected.programName || selected.programId || 'n/a'}</Text>
                                                    </Text>
                                                </Space>
                                            </Card>
                                        </div>
                                    </Col>
                                </Row>
                            </>
                        ) : null}

                        {/* VISUALS */}
                        {detailsTab === 'visuals' ? (
                            <>
                                <Row gutter={[10, 10]}>
                                    <Col xs={24} md={14}>
                                        <div className="lift" style={hoverLiftWrap}>
                                            <Card style={panelCardStyle} bodyStyle={panelBodyStyle}>
                                                <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                                                    <Title level={5} style={{ margin: 0 }}>
                                                        Revenue Growth
                                                    </Title>
                                                    <Tag>Revenue history</Tag>
                                                </Space>
                                                <Divider style={{ margin: '10px 0' }} />
                                                <HighchartsReact highcharts={Highcharts} options={visuals?.revenueOptions as any} />
                                            </Card>
                                        </div>
                                    </Col>

                                    <Col xs={24} md={10}>
                                        <div className="lift" style={hoverLiftWrap}>
                                            <Row gutter={[10, 10]}>
                                                <Col span={12}>
                                                    <div className="lift" style={hoverLiftWrap}>
                                                        <Card style={{
                                                            border: '1px solid #e6efff',
                                                            borderRadius: 14,
                                                            boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
                                                            transition: 'all 0.3s ease',
                                                        }}>
                                                            <Space align="start">
                                                                <WarningOutlined style={{ marginTop: 3, color: '#faad14' }} />
                                                                <div>
                                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                                        Unaccepted (7d+)
                                                                    </Text>
                                                                    <div style={{ fontSize: 18, fontWeight: 900 }}>{visuals?.kpis.unaccepted7d}</div>
                                                                </div>
                                                            </Space>
                                                        </Card>
                                                    </div>
                                                </Col>

                                                <Col span={12}>
                                                    <div className="lift" style={hoverLiftWrap}>
                                                        <Card style={{
                                                            border: '1px solid #e6efff',
                                                            borderRadius: 14,
                                                            boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
                                                            transition: 'all 0.3s ease',
                                                        }}>
                                                            <Space align="start">
                                                                <ClockCircleOutlined style={{ marginTop: 3, color: '#1677ff' }} />
                                                                <div>
                                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                                        In progress (30d+)
                                                                    </Text>
                                                                    <div style={{ fontSize: 18, fontWeight: 900 }}>{visuals?.kpis.inProgress30d}</div>
                                                                </div>
                                                            </Space>
                                                        </Card>
                                                    </div>
                                                </Col>

                                                <Col span={24}>
                                                    <div className="lift" style={hoverLiftWrap}>
                                                        <Card style={{
                                                            border: '1px solid #e6efff',
                                                            borderRadius: 14,
                                                            boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
                                                            transition: 'all 0.3s ease',
                                                        }}>
                                                            <Space align="start">
                                                                <CheckCircleOutlined style={{ marginTop: 3, color: '#52c41a' }} />
                                                                <div>
                                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                                        Completed
                                                                    </Text>
                                                                    <div style={{ fontSize: 18, fontWeight: 900 }}>{visuals?.kpis.completed}</div>
                                                                </div>
                                                            </Space>
                                                        </Card>
                                                    </div>
                                                </Col>
                                            </Row>
                                        </div>
                                    </Col>
                                </Row>

                                <Row gutter={[10, 10]}>
                                    <Col xs={24} md={12}>
                                        <div className="lift" style={hoverLiftWrap}>
                                            <Card style={panelCardStyle} bodyStyle={panelBodyStyle}>
                                                <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                                                    <Title level={5} style={{ margin: 0 }}>
                                                        Performance Comparison
                                                    </Title>
                                                    <Tag>Selected vs group vs overall</Tag>
                                                </Space>
                                                <Divider style={{ margin: '10px 0' }} />
                                                <HighchartsReact highcharts={Highcharts} options={visuals?.perfCompareOptions as any} />
                                            </Card>
                                        </div>
                                    </Col>

                                    <Col xs={24} md={12}>
                                        <div className="lift" style={hoverLiftWrap}>
                                            <Card style={panelCardStyle} bodyStyle={panelBodyStyle}>
                                                <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                                                    <Title level={5} style={{ margin: 0 }}>
                                                        Latest Revenue Comparison
                                                    </Title>
                                                    <Tag>Selected vs group vs overall</Tag>
                                                </Space>
                                                <Divider style={{ margin: '10px 0' }} />
                                                <HighchartsReact highcharts={Highcharts} options={visuals?.revenueCompareOptions as any} />
                                            </Card>
                                        </div>
                                    </Col>
                                </Row>
                            </>
                        ) : null}

                        {/* INTERVENTIONS */}
                        {detailsTab === 'interventions' ? (
                            <div className="lift" style={hoverLiftWrap}>
                                <Row gutter={[10, 10]} style={{ marginBottom: 15 }}>
                                    <Col span={12}>
                                        <div className="lift" style={hoverLiftWrap}>
                                            <Card
                                                style={{
                                                    border: '1px solid #e6efff',
                                                    borderRadius: 14,
                                                    boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
                                                    transition: 'all 0.3s ease',
                                                }} bodyStyle={{ padding: 14 }}>
                                                <MotionCard.Metric
                                                    icon={<ClockCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />}
                                                    iconBg="rgba(250,173,20,.12)"
                                                    title="Assigned"
                                                    value={
                                                        detailsAssignments.filter((x) => {
                                                            const st = safeLower(x.status)
                                                            return st === 'assigned' || st === 'pending' || st === 'new'
                                                        }).length
                                                    }
                                                />
                                            </Card>
                                        </div>
                                    </Col>

                                    <Col span={12}>
                                        <div className="lift" style={hoverLiftWrap}>
                                            <Card
                                                style={{
                                                    border: '1px solid #e6efff',
                                                    borderRadius: 14,
                                                    boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
                                                    transition: 'all 0.3s ease',
                                                }}
                                                bodyStyle={{ padding: 14 }}
                                            >
                                                <MotionCard.Metric
                                                    icon={<SyncOutlined style={{ color: '#1677ff', fontSize: 18 }} spin />}
                                                    iconBg="rgba(22,119,255,.12)"
                                                    title="In Progress"
                                                    value={
                                                        detailsAssignments.filter((x) => {
                                                            const st = safeLower(x.status)
                                                            return st === 'in-progress' || st === 'inprogress'
                                                        }).length
                                                    }
                                                />
                                            </Card>
                                        </div>
                                    </Col>

                                    <Col span={24}>
                                        <div className="lift" style={hoverLiftWrap}>
                                            <Card style={{
                                                border: '1px solid #e6efff',
                                                borderRadius: 14,
                                                boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
                                                transition: 'all 0.3s ease',
                                            }} bodyStyle={{ padding: 14 }}>
                                                <MotionCard.Metric
                                                    icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />}
                                                    iconBg="rgba(82,196,26,.12)"
                                                    title="Completed"
                                                    value={
                                                        detailsAssignments.filter((x) => {
                                                            const st = safeLower(x.status)
                                                            return st === 'completed' || st === 'done'
                                                        }).length
                                                    }
                                                />
                                            </Card>
                                        </div>
                                    </Col>
                                </Row>

                                <Card style={panelCardStyle} bodyStyle={panelBodyStyle}>
                                    <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Title level={5} style={{ margin: 0 }}>
                                            Assigned Interventions
                                        </Title>
                                        {detailsAssignmentsLoading ? <Tag>Loading…</Tag> : <Tag>{detailsAssignments.length} item(s)</Tag>}
                                    </Space>

                                    <Divider style={{ margin: '10px 0' }} />

                                    {detailsAssignments.length ? (
                                        <Table
                                            rowKey="id"
                                            size="small"
                                            pagination={{ pageSize: 8, showSizeChanger: true }}
                                            dataSource={detailsAssignments}
                                            columns={[
                                                {
                                                    title: 'Title',
                                                    key: 'title',
                                                    render: (_: any, r: AssignedInterventionDoc) => (
                                                        <Space direction="vertical" size={0}>
                                                            <Text strong>{r.interventionTitle || r.title || 'Untitled intervention'}</Text>
                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                Assigned: {toMillis(r.createdAt) ? dayjs(toMillis(r.createdAt)).format('YYYY-MM-DD') : 'n/a'}
                                                                {toMillis(r.dueAt) ? ` • Due: ${dayjs(toMillis(r.dueAt)).format('YYYY-MM-DD')}` : ''}
                                                            </Text>
                                                        </Space>
                                                    ),
                                                },
                                                {
                                                    title: 'Status',
                                                    key: 'status',
                                                    width: 180,
                                                    render: (_: any, r: AssignedInterventionDoc) => {
                                                        const inc = safeLower((r as any).incubateeStatus)
                                                        const asg = safeLower((r as any).assigneeStatus)

                                                        const incDone = safeLower((r as any).incubateeCompletionStatus)
                                                        const asgDone = safeLower((r as any).assigneeCompletionStatus)

                                                        const isPending = (x: string) => x === 'pending'
                                                        const isAccepted = (x: string) => x === 'accepted'
                                                        const isCompleted = (x: string) => x === 'completed' || x === 'done'

                                                        // 1) Completed only when BOTH completions are completed
                                                        if (isCompleted(incDone) && isCompleted(asgDone)) {
                                                            return <Tag color="green">Completed</Tag>
                                                        }

                                                        // 2) If either side hasn't accepted => still "Assigned" but explain who
                                                        if (isPending(inc) && isPending(asg)) {
                                                            return <Tag color="gold">Assigned • awaiting both</Tag>
                                                        }
                                                        if (isPending(inc) && isAccepted(asg)) {
                                                            return <Tag color="gold">Assigned • awaiting SME</Tag>
                                                        }
                                                        if (isAccepted(inc) && isPending(asg)) {
                                                            return <Tag color="gold">Assigned • awaiting facilitator</Tag>
                                                        }

                                                        // 3) In progress only when BOTH have accepted (your rule)
                                                        if (isAccepted(inc) && isAccepted(asg)) {
                                                            return <Tag color="blue">In progress</Tag>
                                                        }

                                                        // 4) Fallback (unknown combinations)
                                                        return <Tag>n/a</Tag>
                                                    }
                                                },
                                                {
                                                    title: 'Age',
                                                    key: 'age',
                                                    width: 140,
                                                    render: (_: any, r: AssignedInterventionDoc) => {
                                                        const ms = toMillis(r.createdAt)
                                                        return <Text>{ms ? msToHumanAgo(ms, Date.now()) : 'n/a'}</Text>
                                                    },
                                                },
                                            ]}
                                        />
                                    ) : (
                                        <Text type="secondary">No assigned interventions found for this SME.</Text>
                                    )}
                                </Card>
                            </div>
                        ) : null}
                    </Space>
                )}
            </Modal>
        </div >
    )
}

export default SMEsMasterPage
