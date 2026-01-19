import React, { useEffect, useMemo, useState } from 'react'
import {
    Row,
    Col,
    Button,
    Space,
    Typography,
    DatePicker,
    Segmented,
    Spin,
    Alert,
    Empty,
    message
} from 'antd'
import {
    TeamOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    ArrowLeftOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import dayjs, { Dayjs } from 'dayjs'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import drilldown from 'highcharts/modules/drilldown'
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    limit
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'

if (typeof Highcharts === 'function') drilldown(Highcharts)

const { RangePicker } = DatePicker
const { Title, Text } = Typography

type FSTimestamp = { toDate?: () => Date } | any

type Intervention = {
    id?: string
    interventionId?: string
    title?: string
    interventionTitle?: string
    area?: string
    areaOfSupport?: string
    consultantEmail?: string
    consultantName?: string
    status?: string
    date?: string | Date | FSTimestamp
    completedAt?: string | Date | FSTimestamp
    interventionDate?: string | Date | FSTimestamp
    programId?: string
}

type ComplianceDoc = { status?: string }

type MPRow = {
    id: string
    createdAt?: any
    submittedAt?: any
    month?: string
    revenue?: number
    headPermanent?: number
    headTemporary?: number
}

type PresetKey = 'THIS_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'CUSTOM' | 'ALL_TIME'

function asDate(v: any): Date | null {
    if (!v) return null
    if (typeof v === 'string') {
        const d = dayjs(v)
        if (d.isValid()) return d.toDate()
        const x = new Date(`${v} 01`)
        return isNaN(+x) ? null : x
    }
    if (v?.toDate) {
        try {
            return v.toDate()
        } catch { }
    }
    if (v instanceof Date) return v
    return null
}

function monthKey(d: Date) {
    return dayjs(d).format('YYYY-MM')
}

// ---- baseline helpers (participants.monthly has no year) ----
function toDate(v: any): Date | null {
    if (!v) return null
    if (v instanceof Date) return v
    if (typeof v?.toDate === 'function') {
        try {
            return v.toDate()
        } catch {
            return null
        }
    }
    return null
}

function baselineMonthsFromSubmittedAt(submittedAt: any, n = 3) {
    const sub = toDate(submittedAt)
    if (!sub) return []
    const base = dayjs(sub).startOf('month') // submission month start
    // last n months BEFORE submission month
    return Array.from({ length: n }, (_, i) => {
        const m = base.subtract(i + 1, 'month')
        return {
            ym: m.format('YYYY-MM'),
            label: m.format('MMMM'), // key used in participants.monthly
            display: m.format('MMM YYYY')
        }
    }).reverse()
}

function normalizeTitleCase(s: string) {
    return s
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
}

function normalizeStatus(s: any) {
    const raw = String(s || 'Unknown').trim()
    if (!raw) return 'Unknown'
    return normalizeTitleCase(raw.replace(/[_-]+/g, ' '))
}

// Create a stable status bucket for inconsistent statuses
function statusBucket(s: any) {
    const v = String(s || '').toLowerCase().trim()
    if (!v) return 'Unknown'
    if (v.includes('complete')) return 'Completed'
    if (v.includes('done')) return 'Completed'
    if (v.includes('in progress') || v.includes('progress')) return 'In Progress'
    if (v.includes('active')) return 'In Progress'
    if (v.includes('pending')) return 'Pending'
    if (v.includes('overdue')) return 'Overdue'
    if (v.includes('cancel')) return 'Cancelled'
    if (v.includes('reject')) return 'Rejected'
    if (v.includes('approved')) return 'Approved'
    if (v.includes('assigned')) return 'Assigned'
    return normalizeStatus(s)
}

function getPresetRange(preset: PresetKey): [Dayjs, Dayjs] | null {
    const now = dayjs()
    if (preset === 'THIS_MONTH') return [now.startOf('month'), now.endOf('month')]
    if (preset === 'THIS_QUARTER') return [now.startOf('quarter'), now.endOf('quarter')]
    if (preset === 'THIS_YEAR') return [now.startOf('year'), now.endOf('year')]
    if (preset === 'ALL_TIME') return null
    return null
}

const IncubateePerformancePage: React.FC = () => {
    const { participantId } = useParams()
    const location = useLocation() as any
    const navigate = useNavigate()
    const { user } = useFullIdentity()

    const companyCode = user?.companyCode || null

    const [loading, setLoading] = useState(true)
    const [participant, setParticipant] = useState<any>(null)
    const [application, setApplication] = useState<any>(null)

    const [assigned, setAssigned] = useState<Intervention[]>([])
    const [compliance, setCompliance] = useState<ComplianceDoc[]>([])
    const [mpHistory, setMpHistory] = useState<MPRow[]>([])

    // single date filter
    const [preset, setPreset] = useState<PresetKey>('THIS_MONTH')
    const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)

    const effectiveRange = useMemo<[Dayjs | null, Dayjs | null] | null>(() => {
        if (preset === 'CUSTOM') return customRange
        const r = getPresetRange(preset)
        return r ? [r[0], r[1]] : null
    }, [preset, customRange])

    const displayName = useMemo(
        () =>
            participant?.beneficiaryName ||
            application?.beneficiaryName ||
            participant?.name ||
            participantId ||
            'Incubatee',
        [participant?.beneficiaryName, application?.beneficiaryName, participant?.name, participantId]
    )

    function norm(v: any): string {
        return String(v ?? '').trim().toLowerCase()
    }

    function isAccepted(v: any) {
        const x = norm(v)
        return x === 'accepted' || x === 'approve' || x === 'approved'
    }

    function isPending(v: any) {
        const x = norm(v)
        return x === 'pending' || x === 'awaiting' || x === 'assigned' || x === ''
    }

    function isCompleted(v: any) {
        const x = norm(v)
        return x === 'completed' || x === 'complete' || x === 'done'
    }

    function deriveAssignmentStatus(a: any): string {
        const consultantStatus = norm(a?.consultantStatus)
        const userStatus = norm(a?.userStatus)

        const consultantCompletion = norm(a?.consultantCompletionStatus)
        const userCompletion = norm(a?.userCompletionStatus)

        // 1) Acceptance gates first
        if (isPending(consultantStatus) && !isAccepted(consultantStatus)) {
            return 'Awaiting Consultant Acceptance'
        }

        if (isAccepted(consultantStatus) && isPending(userStatus) && !isAccepted(userStatus)) {
            return 'Awaiting SME Acceptance'
        }

        // 2) Completion/confirmation gates
        if (isCompleted(consultantCompletion) && !isCompleted(userCompletion)) {
            return 'Awaiting SME Confirmation'
        }

        if (isCompleted(consultantCompletion) && isCompleted(userCompletion)) {
            return 'Completed'
        }

        // 3) If both accepted but no completion yet
        if (isAccepted(consultantStatus) && isAccepted(userStatus)) {
            return 'Pending Execution'
        }

        // 4) Fallback to raw status if nothing matches
        const raw = String(a?.status ?? '').trim()
        return raw ? raw : 'Unknown'
    }


    // participant + application + compliance
    useEffect(() => {
        if (!participantId) return
        setLoading(true)

            ; (async () => {
                try {
                    let pData: any = null
                    const pDoc = await getDoc(doc(db, 'participants', participantId))
                    if (pDoc.exists()) pData = { id: pDoc.id, ...pDoc.data() }
                    else {
                        const alt = await getDocs(
                            query(collection(db, 'participants'), where('participantId', '==', participantId), limit(1))
                        )
                        if (!alt.empty) pData = { id: alt.docs[0].id, ...alt.docs[0].data() }
                    }

                    let aData: any = null
                    const appSnap = await getDocs(
                        query(collection(db, 'applications'), where('participantId', '==', participantId), limit(1))
                    )
                    if (!appSnap.empty) aData = { id: appSnap.docs[0].id, ...appSnap.docs[0].data() }

                    // company safety
                    if (companyCode) {
                        const pCC = pData?.companyCode
                        const aCC = aData?.companyCode
                        if ((pCC && pCC !== companyCode) || (aCC && aCC !== companyCode)) {
                            setParticipant(null)
                            setApplication(null)
                            setCompliance([])
                            return
                        }
                    }

                    const complianceDocs: ComplianceDoc[] = Array.isArray(pData?.complianceDocuments)
                        ? pData.complianceDocuments
                        : Array.isArray(aData?.complianceDocuments)
                            ? aData.complianceDocuments
                            : []

                    setParticipant(pData)
                    setApplication(aData)
                    setCompliance(complianceDocs)
                } catch (e) {
                    console.error(e)
                    message.error('Failed to load participant data.')
                } finally {
                    setLoading(false)
                }
            })()
    }, [participantId, companyCode])

    // interventions (ONLY assignedInterventions) + log unknown statuses
    // interventions (ONLY assignedInterventions) + log bad records
    useEffect(() => {
        if (!participantId) return

            ; (async () => {
                try {
                    const q1 = query(
                        collection(db, 'assignedInterventions'),
                        where('participantId', '==', participantId)
                    )
                    const s1 = await getDocs(q1)

                    const rows = s1.docs.map(d => {
                        const data = d.data() as any

                        const displayStatus = deriveAssignmentStatus(data)

                        // normalize title/id (your firestore uses interventionTitle + interventionId)
                        const interventionTitle =
                            String(data?.interventionTitle || data?.title || '').trim() || 'Unknown'

                        const interventionId =
                            String(
                                data?.interventionId ||
                                data?.interventionID ||
                                data?.interventionid ||
                                ''
                            ).trim() || null

                        return {
                            id: d.id,
                            ...data,

                            interventionTitle,
                            interventionId,

                            // IMPORTANT: use displayStatus as status so charts/tables use the derived value
                            status: displayStatus,
                            displayStatus,

                            rawStatus: data?.status
                        }
                    }) as any[]

                    setAssigned(rows)

                    // ✅ LOG ALWAYS (so you know it ran)
                    console.log('[IncubateePerformance] assignedInterventions loaded', {
                        participantId,
                        count: rows.length
                    })

                    // ✅ LOG PROBLEM RECORDS (this is what you actually need)
                    const bad = rows.filter(r => {
                        const titleBad = norm(r.interventionTitle) === 'unknown'
                        const idBad = !r.interventionId
                        const statusBad = norm(r.displayStatus) === 'unknown'
                        return titleBad || idBad || statusBad
                    })

                    if (bad.length) {
                        console.warn('[IncubateePerformance] bad assignedInterventions detected', {
                            participantId,
                            count: bad.length
                        })

                        // use table so you can SEE exactly which field is missing
                        console.table(
                            bad.slice(0, 50).map(b => ({
                                docId: b.id,
                                interventionId: b.interventionId,
                                interventionTitle: b.interventionTitle,
                                displayStatus: b.displayStatus,
                                rawStatus: b.rawStatus,
                                consultantStatus: b.consultantStatus,
                                userStatus: b.userStatus,
                                consultantCompletionStatus: b.consultantCompletionStatus,
                                userCompletionStatus: b.userCompletionStatus
                            }))
                        )
                    }
                } catch (e) {
                    console.error(e)
                }
            })()
    }, [participantId])



    // monthly performance subcollection
    useEffect(() => {
        if (!participantId) return
            ; (async () => {
                try {
                    const histRef = collection(db, 'monthlyPerformance', participantId, 'history')
                    const snap = await getDocs(histRef)
                    const rows: MPRow[] = snap.docs.map(d => {
                        const data = d.data() as any
                        return {
                            id: d.id,
                            createdAt: data.createdAt,
                            submittedAt: data.submittedAt,
                            month: data.month ?? d.id,
                            revenue: Number(data.revenue || 0),
                            headPermanent: Number(data.headPermanent || 0),
                            headTemporary: Number(data.headTemporary || 0)
                        }
                    })
                    setMpHistory(rows)
                } catch (e) {
                    console.error(e)
                }
            })()
    }, [participantId])

    // merge interventions sources
    const requiredFromApp = useMemo<Intervention[]>(
        () => (application?.interventions?.required || []) as Intervention[],
        [application]
    )
    const completedFromApp = useMemo<Intervention[]>(
        () => (application?.interventions?.completed || []) as Intervention[],
        [application]
    )

    const assignedOnly = useMemo(() => {
        return assigned.map((x: any) => ({
            ...x,
            // make sure we have consistent fields for charts
            title: x.interventionTitle || x.title || 'Untitled',
            interventionTitle: x.interventionTitle || x.title || 'Untitled',
            // IMPORTANT: status used by charts is the derived one
            status: x.displayStatus || x.status || 'Unknown',
            displayStatus: x.displayStatus || null
        }))
    }, [assigned])

    const filteredInterventions = useMemo(() => {
        const [start, end] = effectiveRange || [null, null]
        return assignedOnly.filter((it: any) => {
            if (start && end) {
                const d =
                    asDate(it.updatedAt) ||
                    asDate(it.createdAt) ||
                    asDate(it.implementationDate) ||
                    asDate(it.date)
                if (!d) return false
                if (dayjs(d).isBefore(start, 'day') || dayjs(d).isAfter(end, 'day')) return false
            }
            return true
        })
    }, [assignedOnly, effectiveRange])


    const filteredMP = useMemo(() => {
        if (!effectiveRange) return mpHistory
        const [start, end] = effectiveRange
        if (!start || !end) return mpHistory
        return mpHistory.filter(r => {
            const d = asDate(r.submittedAt) || asDate(r.createdAt)
            if (!d) return false
            return !dayjs(d).isBefore(start, 'day') && !dayjs(d).isAfter(end, 'day')
        })
    }, [mpHistory, effectiveRange])

    // KPIs (interventions)
    const requiredCount = requiredFromApp.length
    const completedCount = useMemo(
        () => filteredInterventions.filter(i => statusBucket(i.status) === 'Completed').length,
        [filteredInterventions]
    )
    const derivedParticipation = requiredCount > 0 ? Math.min(100, Math.round((completedCount / requiredCount) * 100)) : 0

    const latestMP = useMemo(() => {
        const list = (filteredMP.length ? filteredMP : mpHistory)
            .map(r => ({ r, d: asDate(r.submittedAt) || asDate(r.createdAt) }))
            .filter(x => !!x.d)
            .sort((a, b) => Number(a.d) - Number(b.d))
        return list.length ? list[list.length - 1].r : null
    }, [filteredMP, mpHistory])

    const employeesKPI = (latestMP?.headPermanent || 0) + (latestMP?.headTemporary || 0)

    // ---- revenue series (Actual from monthlyPerformance + Baseline from participants using application.submittedAt) ----
    const appSubmittedAt = application?.submittedAt || application?.createdAt || null

    const actualRevenue = useMemo(() => {
        const acc: Record<string, number> = {}
        filteredMP.forEach(r => {
            const d = asDate(r.submittedAt) || asDate(r.createdAt)
            if (!d) return
            const k = monthKey(d)
            acc[k] = (acc[k] || 0) + Number(r.revenue || 0)
        })
        const cats = Object.keys(acc).sort()
        return { categories: cats, data: cats.map(k => acc[k]) }
    }, [filteredMP])

    const baselineRevenue = useMemo(() => {
        const months = baselineMonthsFromSubmittedAt(appSubmittedAt, 3)
        const monthly = participant?.revenueHistory?.monthly || {}
        const categories = months.map(m => m.ym)
        const data = months.map(m => Number(monthly?.[m.label] || 0))
        return { categories, data, months }
    }, [participant?.revenueHistory?.monthly, appSubmittedAt])

    const revenueCats = useMemo(() => {
        const set = new Set<string>([...actualRevenue.categories, ...baselineRevenue.categories])
        return Array.from(set).sort()
    }, [actualRevenue.categories, baselineRevenue.categories])

    const revenueActualAligned = useMemo(() => {
        const map = new Map(actualRevenue.categories.map((c, i) => [c, actualRevenue.data[i] ?? 0]))
        return revenueCats.map(c => map.get(c) ?? 0)
    }, [revenueCats, actualRevenue])

    const revenueBaselineAligned = useMemo(() => {
        const map = new Map(baselineRevenue.categories.map((c, i) => [c, baselineRevenue.data[i] ?? 0]))
        return revenueCats.map(c => map.get(c) ?? 0)
    }, [revenueCats, baselineRevenue])

    // ---- headcount (Actual from monthlyPerformance + Baseline from participants using application.submittedAt) ----
    const actualHeadcountBreakdown = useMemo(() => {
        const acc: Record<string, { perm: number; temp: number }> = {}
        filteredMP.forEach(r => {
            const d = asDate(r.submittedAt) || asDate(r.createdAt)
            if (!d) return
            const k = monthKey(d)
            if (!acc[k]) acc[k] = { perm: 0, temp: 0 }
            acc[k].perm += Number(r.headPermanent || 0)
            acc[k].temp += Number(r.headTemporary || 0)
        })
        return acc
    }, [filteredMP])

    const baselineHeadcountBreakdown = useMemo(() => {
        const months = baselineMonthsFromSubmittedAt(appSubmittedAt, 3)
        const monthly = participant?.headcountHistory?.monthly || {}
        const acc: Record<string, { perm: number; temp: number }> = {}
        months.forEach(m => {
            const obj = monthly?.[m.label] || {}
            acc[m.ym] = { perm: Number(obj?.permanent || 0), temp: Number(obj?.temporary || 0) }
        })
        return acc
    }, [participant?.headcountHistory?.monthly, appSubmittedAt])

    const headCats = useMemo(() => {
        const set = new Set<string>([...Object.keys(actualHeadcountBreakdown), ...Object.keys(baselineHeadcountBreakdown)])
        return Array.from(set).sort()
    }, [actualHeadcountBreakdown, baselineHeadcountBreakdown])

    const headTotalsActual = useMemo(
        () => headCats.map(k => (actualHeadcountBreakdown[k]?.perm || 0) + (actualHeadcountBreakdown[k]?.temp || 0)),
        [headCats, actualHeadcountBreakdown]
    )
    const headTotalsBaseline = useMemo(
        () => headCats.map(k => (baselineHeadcountBreakdown[k]?.perm || 0) + (baselineHeadcountBreakdown[k]?.temp || 0)),
        [headCats, baselineHeadcountBreakdown]
    )

    const headcountDrillSeries = useMemo(
        () =>
            headCats.map(k => ({
                id: `actual-${k}`,
                type: 'column',
                data: [
                    ['Permanent', actualHeadcountBreakdown[k]?.perm || 0],
                    ['Temporary', actualHeadcountBreakdown[k]?.temp || 0]
                ]
            })),
        [headCats, actualHeadcountBreakdown]
    )

    // Compliance donut (show real statuses)
    const complianceDonutData = useMemo(() => {
        const counts: Record<string, number> = {}
            ; (compliance || []).forEach(c => {
                const key = normalizeStatus(c?.status)
                counts[key] = (counts[key] || 0) + 1
            })
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, y]) => ({ name, y }))
    }, [compliance])

    // ✅ interventions donut: ALL assigned interventions grouped by STATUS, drilldown to titles
    const interventionsStatusDonut = useMemo(() => {
        const list = filteredInterventions
        const byStatus: Record<string, { total: number; titles: Record<string, number> }> = {}

        list.forEach((i: any) => {
            const st = statusBucket(i.displayStatus || i.status)
            const title = String(i.interventionTitle || 'Untitled')
            if (!byStatus[st]) byStatus[st] = { total: 0, titles: {} }
            byStatus[st].total++
            byStatus[st].titles[title] = (byStatus[st].titles[title] || 0) + 1
        })

        const top = Object.entries(byStatus)
            .map(([name, v]) => ({ name, y: v.total, drilldown: name }))
            .sort((a, b) => b.y - a.y)

        const drill = Object.entries(byStatus).map(([name, v]) => ({
            id: name,
            data: Object.entries(v.titles).sort((a, b) => b[1] - a[1]) as Array<[string, number]>
        }))

        return { top, drill }
    }, [filteredInterventions])


    // Baseline warning (if monthly keys don’t match expected months)
    const baselineWarning = useMemo(() => {
        const months = baselineMonthsFromSubmittedAt(appSubmittedAt, 3)
        if (!months.length) return null
        const revMonthly = participant?.revenueHistory?.monthly || {}
        const headMonthly = participant?.headcountHistory?.monthly || {}
        const missing = months.filter(m => revMonthly?.[m.label] == null && headMonthly?.[m.label] == null)
        if (!missing.length) return null
        return `Baseline expects: ${months.map(m => m.display).join(', ')}. Missing entries for: ${missing
            .map(m => m.label)
            .join(', ')}.`
    }, [appSubmittedAt, participant?.revenueHistory?.monthly, participant?.headcountHistory?.monthly])

    // charts
    const chartInterventionsStatusDonut: Highcharts.Options = {
        chart: { type: 'pie' },
        title: { text: 'Interventions by Status' },
        plotOptions: {
            pie: {
                innerSize: '60%',
                showInLegend: true,
                dataLabels: {
                    enabled: true,
                    format: '<b>{point.name}</b>: {point.y}',
                    distance: 18,
                    style: { textOutline: 'none' }
                }
            }
        },
        series: [{ type: 'pie', name: 'Interventions', data: interventionsStatusDonut.top }],
        drilldown: { series: interventionsStatusDonut.drill as any },
        credits: { enabled: false }
    }

    const chartComplianceDonut: Highcharts.Options = {
        chart: { type: 'pie' },
        title: { text: 'Compliance Status' },
        plotOptions: {
            pie: {
                showInLegend: true,
                dataLabels: {
                    enabled: true,
                    format: '<b>{point.name}</b>: {point.y}',
                    distance: 18,
                    style: { textOutline: 'none' }
                }
            }
        },
        series: [{ name: 'Compliance', type: 'pie', innerSize: '45%', size: '70%', data: complianceDonutData }],
        credits: { enabled: false }
    }

    const chartRevenue: Highcharts.Options = {
        chart: { type: 'line' },
        title: { text: 'Revenue by Month' },
        xAxis: { categories: revenueCats.map(k => dayjs(`${k}-01`).format('MMM YYYY')) },
        yAxis: { title: { text: 'Revenue' }, allowDecimals: false },
        plotOptions: {
            series: {
                dataLabels: { enabled: true, format: '{y}', style: { textOutline: 'none', fontWeight: '600' } }
            }
        },
        series: [
            { type: 'line', name: 'Actual (Monthly Performance)', data: revenueActualAligned },
        ],
        credits: { enabled: false }
    }

    const chartHeadcountDrill: Highcharts.Options = {
        chart: { type: 'column' },
        title: { text: 'Workforce by Month (Actual + Baseline)' },
        xAxis: { type: 'category' },
        yAxis: { title: { text: 'Employees' }, allowDecimals: false },
        plotOptions: {
            series: {
                dataLabels: { enabled: true, format: '{y}', style: { textOutline: 'none', fontWeight: '600' } }
            }
        },
        series: [
            {
                type: 'column',
                name: 'Actual Total',
                data: headCats.map((k, i) => ({
                    name: dayjs(`${k}-01`).format('MMM YYYY'),
                    y: headTotalsActual[i],
                    drilldown: `actual-${k}`
                }))
            },
        ],
        drilldown: { series: headcountDrillSeries as any },
        credits: { enabled: false }
    }

    // early returns
    if (loading) {
        return (
            <div style={{ padding: 24, minHeight: '100vh' }}>
                <Spin />
            </div>
        )
    }

    if (!participant && !application) {
        return (
            <div style={{ padding: 24, minHeight: '100vh' }}>
                <Alert type='warning' showIcon message='Participant not found' />
                <Button type='link' onClick={() => navigate('/operations/participants')}>
                    Back
                </Button>
            </div>
        )
    }

    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            <Helmet>
                <title>Incubatee Performance</title>
            </Helmet>

            <DashboardHeaderCard
                title={`${displayName} Performance`}
                extraRight={
                    <>
                        <Space align="center" style={{ justifyContent: 'flex-end' }}>
                            <Button
                                type="link"
                                icon={<ArrowLeftOutlined />}
                                onClick={() => {
                                    if (location?.state?.from) navigate(-1)
                                    else navigate('/operations/participants')
                                }}
                            >
                                Back to selection
                            </Button>

                            <Segmented
                                value={preset}
                                onChange={(v) => {
                                    const next = v as PresetKey
                                    setPreset(next)
                                    if (next !== 'CUSTOM') setCustomRange(null)
                                }}
                                options={[
                                    { label: 'This Month', value: 'THIS_MONTH' },
                                    { label: 'This Quarter', value: 'THIS_QUARTER' },
                                    { label: 'This Year', value: 'THIS_YEAR' },
                                    { label: 'All Time', value: 'ALL_TIME' },
                                    { label: 'Custom', value: 'CUSTOM' },
                                ]}
                            />
                        </Space>

                        {preset === 'CUSTOM' && (
                            <div style={{ marginTop: 8, textAlign: 'right' }}>
                                <RangePicker
                                    allowClear
                                    value={customRange as any}
                                    onChange={(vals) => setCustomRange(vals as any)}
                                    style={{ width: 320 }}
                                />
                            </div>
                        )}
                    </>
                }
            />

            {baselineWarning ? <Alert style={{ marginBottom: 12 }} type='warning' showIcon message={baselineWarning} /> : null}

            {/* KPI tiles */}
            <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
                <Col xs={24} sm={12} md={6}>
                    <MotionCard>
                        <Space align='start'>
                            <div style={{ background: '#f0f5ff', padding: 8, borderRadius: '50%' }}>
                                <WarningOutlined style={{ fontSize: 18 }} />
                            </div>
                            <div>
                                <Text strong>Required Interventions</Text>
                                <Title level={3} style={{ margin: 0 }}>
                                    {requiredCount}
                                </Title>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>

                <Col xs={24} sm={12} md={6}>
                    <MotionCard>
                        <Space align='start'>
                            <div style={{ background: '#f6ffed', padding: 8, borderRadius: '50%' }}>
                                <CheckCircleOutlined style={{ fontSize: 18 }} />
                            </div>
                            <div>
                                <Text strong>Completed (in range)</Text>
                                <Title level={3} style={{ margin: 0 }}>
                                    {completedCount}
                                </Title>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>

                <Col xs={24} sm={12} md={6}>
                    <MotionCard>
                        <Space align='start'>
                            <div style={{ background: '#fffbe6', padding: 8, borderRadius: '50%' }}>
                                <Text strong>%</Text>
                            </div>
                            <div>
                                <Text strong>Participation Rate</Text>
                                <Title level={3} style={{ margin: 0 }}>
                                    {derivedParticipation}%
                                </Title>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>

                <Col xs={24} sm={12} md={6}>
                    <MotionCard>
                        <Space align='start'>
                            <div style={{ background: '#e6f7ff', padding: 8, borderRadius: '50%' }}>
                                <TeamOutlined style={{ fontSize: 18 }} />
                            </div>
                            <div>
                                <Text strong>Employees (latest)</Text>
                                <Title level={3} style={{ margin: 0 }}>
                                    {employeesKPI}
                                </Title>
                            </div>
                        </Space>
                    </MotionCard>
                </Col>
            </Row>

            {/* Donuts */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} lg={12}>
                    <MotionCard>
                        {interventionsStatusDonut.top.length ? (
                            <HighchartsReact highcharts={Highcharts} options={chartInterventionsStatusDonut} />
                        ) : (
                            <Empty description='No interventions found for this participant' />
                        )}
                    </MotionCard>
                </Col>

                <Col xs={24} lg={12}>
                    <MotionCard>
                        {complianceDonutData.length ? (
                            <HighchartsReact highcharts={Highcharts} options={chartComplianceDonut} />
                        ) : (
                            <Empty description='No compliance data' />
                        )}
                    </MotionCard>
                </Col>
            </Row>

            {/* Revenue + Workforce */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                    <MotionCard>
                        {revenueCats.length ? <HighchartsReact highcharts={Highcharts} options={chartRevenue} /> : <Empty description='No revenue data' />}
                    </MotionCard>
                </Col>

                <Col xs={24} lg={12}>
                    <MotionCard>
                        {headCats.length ? <HighchartsReact highcharts={Highcharts} options={chartHeadcountDrill} /> : <Empty description='No workforce data' />}
                    </MotionCard>
                </Col>
            </Row>
        </div>
    )
}

export default IncubateePerformancePage
