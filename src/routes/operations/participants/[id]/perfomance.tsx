import React, { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Drawer,
  Button,
  Space,
  Typography,
  Tag,
  Select,
  DatePicker,
  Divider,
  Spin,
  Alert,
  Empty,
  message,
  Switch
} from 'antd'
import {
  FilterOutlined,
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
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { MotionCard } from '@/components/shared/Header'

if (typeof Highcharts === 'function') {
  drilldown(Highcharts)
}

const { RangePicker } = DatePicker
const { Title, Text } = Typography
const { Option } = Select

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
  month?: string
  revenue?: number
  headPermanent?: number
  headTemporary?: number
}

type CompareBy = 'gender' | 'sector' | 'program'

function asDate (v: any): Date | null {
  if (!v) return null
  if (typeof v === 'string') {
    const d = dayjs(v)
    if (d.isValid()) return d.toDate()
    // sometimes "July 2025"
    const x = new Date(`${v} 01`)
    return isNaN(+x) ? null : x
  }
  if (v?.toDate) {
    try {
      return v.toDate()
    } catch {}
  }
  if (v instanceof Date) return v
  return null
}
function monthKey (d: Date) {
  return dayjs(d).format('YYYY-MM')
}
function firstOfMonthFromLabel (label?: string): Date | null {
  if (!label) return null
  const d = new Date(`${label} 01`)
  return isNaN(+d) ? null : d
}
export function chunk<T> (arr: T[], size = 10): T[][] {
  if (size <= 0) throw new Error('chunk size must be > 0')
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

// Parse month labels like "April" or "2024-04" -> Date (defaults to current year if no year)
function parseMonthLabelToDate (label: string): Date | null {
  if (!label) return null
  const trimmed = label.trim()
  // "YYYY-MM" or "YYYY/MM"
  const ymd = /^(\d{4})[-/](\d{1,2})$/.exec(trimmed)
  if (ymd) {
    const y = +ymd[1],
      m = +ymd[2] - 1
    const d = new Date(y, m, 1)
    return isNaN(+d) ? null : d
  }
  // "April" / "Apr"
  const guess = dayjs(
    `${trimmed} ${dayjs().year()} 01`,
    ['MMMM YYYY DD', 'MMM YYYY DD'],
    true
  )
  if (guess.isValid()) return guess.toDate()
  // fallback generic Date parse
  const d = new Date(`${trimmed} 01`)
  return isNaN(+d) ? null : d
}

const IncubateePerformancePage: React.FC = () => {
  const { participantId } = useParams()
  const location = useLocation() as any
  const navigate = useNavigate()
  const { user } = useFullIdentity()

  const [loading, setLoading] = useState(true)
  const [participant, setParticipant] = useState<any>(null)
  const [application, setApplication] = useState<any>(null)
  const [assigned, setAssigned] = useState<Intervention[]>([])
  const [fromDb, setFromDb] = useState<Intervention[]>([])
  const [compliance, setCompliance] = useState<ComplianceDoc[]>([])
  const [mpHistory, setMpHistory] = useState<MPRow[]>([])
  const [compareEnabled, setCompareEnabled] = useState(false)

  // committed filters
  const [selectedProgram, setSelectedProgram] = useState<string | 'all'>(
    location?.state?.programId || 'all'
  )
  const [selectedConsultant, setSelectedConsultant] = useState<string | 'all'>(
    'all'
  )
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null)

  // drawer staged
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tmpProgram, setTmpProgram] = useState<string | 'all'>('all')
  const [tmpConsultant, setTmpConsultant] = useState<string | 'all'>('all')
  const [tmpDateRange, setTmpDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null)

  // compare selector
  const [compareBy, setCompareBy] = useState<CompareBy>('program')
  // staged (drawer)
  const [tmpCompareEnabled, setTmpCompareEnabled] = useState(compareEnabled)
  const [tmpCompareBy, setTmpCompareBy] = useState<CompareBy>(compareBy)

  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([])
  const [consultants, setConsultants] = useState<
    { id: string; name: string; email: string }[]
  >([])

  const companyCode = user?.companyCode || null
  const displayName = React.useMemo(
    () =>
      participant?.beneficiaryName ||
      application?.beneficiaryName ||
      participant?.name ||
      participantId ||
      'Incubatee',
    [
      participant?.beneficiaryName,
      application?.beneficiaryName,
      participant?.name,
      participantId
    ]
  )
  const [start, end] = dateRange || [null, null]

  useEffect(() => {
    if (!drawerOpen) return
    setTmpProgram(selectedProgram)
    setTmpConsultant(selectedConsultant)
    setTmpDateRange(dateRange)
    // NEW
    setTmpCompareEnabled(compareEnabled)
    setTmpCompareBy(compareBy)
  }, [drawerOpen]) // eslint-disable-line

  // dropdown data
  useEffect(() => {
    ;(async () => {
      try {
        const [progSnap, consSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'programs'),
              where('companyCode', '==', user?.companyCode)
            )
          ),
          getDocs(
            query(
              collection(db, 'users'),
              where('role', '==', 'consultant'),
              where('companyCode', '==', user?.companyCode)
            )
          )
        ])
        setPrograms(
          progSnap.docs.map(d => ({
            id: d.id,
            name: d.data().programName || d.data().name || d.id
          }))
        )
        setConsultants(
          consSnap.docs.map(d => ({
            id: d.id,
            name:
              d.data().name || d.data().displayName || d.data().email || d.id,
            email: d.data().email || ''
          }))
        )
      } catch {}
    })()
  }, [])

  // participant + application + compliance
  useEffect(() => {
    if (!participantId) return
    setLoading(true)
    ;(async () => {
      try {
        let pData: any = null
        const pDoc = await getDoc(doc(db, 'participants', participantId))
        if (pDoc.exists()) pData = { id: pDoc.id, ...pDoc.data() }
        else {
          const alt = await getDocs(
            query(
              collection(db, 'participants'),
              where('participantId', '==', participantId),
              limit(1)
            )
          )
          if (!alt.empty) pData = { id: alt.docs[0].id, ...alt.docs[0].data() }
        }

        let aData: any = null
        const appSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('participantId', '==', participantId),
            limit(1)
          )
        )
        if (!appSnap.empty)
          aData = { id: appSnap.docs[0].id, ...appSnap.docs[0].data() }

        const complianceDocs: ComplianceDoc[] = Array.isArray(
          pData?.complianceDocuments
        )
          ? pData.complianceDocuments
          : Array.isArray(aData?.complianceDocuments)
          ? aData.complianceDocuments
          : []

        setParticipant(pData)
        setApplication(aData)
        setCompliance(complianceDocs)
      } finally {
        setLoading(false)
      }
    })()
  }, [participantId])

  // interventions for this participant
  useEffect(() => {
    if (!participantId) return
    ;(async () => {
      try {
        const q1 = query(
          collection(db, 'assignedInterventions'),
          where('participantId', '==', participantId)
        )
        const q2 = query(
          collection(db, 'interventionsDatabase'),
          where('participantId', '==', participantId)
        )
        const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)])
        setAssigned(
          s1.docs.map(d => ({ id: d.id, ...d.data() })) as Intervention[]
        )
        setFromDb(
          s2.docs.map(d => ({ id: d.id, ...d.data() })) as Intervention[]
        )
      } catch {}
    })()
  }, [participantId])

  // monthly performance (this participant)
  useEffect(() => {
    if (!participantId) return
    ;(async () => {
      try {
        const histRef = collection(
          db,
          'monthlyPerformance',
          participantId,
          'history'
        )
        const snap = await getDocs(histRef)
        const rows: MPRow[] = snap.docs.map(d => {
          const data = d.data() as any
          return {
            id: d.id,
            createdAt: data.createdAt,
            month: data.month ?? d.id,
            revenue: Number(data.revenue || 0),
            headPermanent: Number(data.headPermanent || 0),
            headTemporary: Number(data.headTemporary || 0)
          }
        })
        setMpHistory(rows)
      } catch {}
    })()
  }, [participantId])

  // merge + filter for this participant
  const requiredFromApp = useMemo<Intervention[]>(
    () => (application?.interventions?.required || []) as Intervention[],
    [application]
  )
  const completedFromApp = useMemo<Intervention[]>(
    () => (application?.interventions?.completed || []) as Intervention[],
    [application]
  )
  const allInterventions = useMemo<Intervention[]>(() => {
    const normalize = (x: Intervention): Intervention => ({
      ...x,
      title: x.title || x.interventionTitle,
      area: x.area || x.areaOfSupport
    })
    const keyOf = (x: Intervention) =>
      x.interventionId || x.id || x.title || JSON.stringify(x)
    const map = new Map<string, Intervention>()
    ;[
      ...requiredFromApp.map(normalize),
      ...completedFromApp.map(i =>
        normalize({ ...i, status: i.status || 'completed' })
      ),
      ...assigned.map(normalize),
      ...fromDb.map(normalize)
    ].forEach(it => map.set(keyOf(it), it))
    return Array.from(map.values())
  }, [requiredFromApp, completedFromApp, assigned, fromDb])

  const filteredInterventions = useMemo(() => {
    const [start, end] = dateRange || [null, null]
    return allInterventions.filter(it => {
      if (
        companyCode &&
        (participant?.companyCode || application?.companyCode)
      ) {
        if (
          (participant?.companyCode &&
            participant.companyCode !== companyCode) ||
          (application?.companyCode && application.companyCode !== companyCode)
        ) {
          return false
        }
      }

      if (selectedProgram !== 'all') {
        const prog = it.programId || application?.programId
        if ((prog || '') !== selectedProgram) return false
      }
      if (selectedConsultant !== 'all') {
        const c = (it.consultantEmail || it.consultantName || '')
          .toString()
          .toLowerCase()
        if (!c.includes(selectedConsultant.toLowerCase())) return false
      }
      if (start && end) {
        const d =
          asDate(it.completedAt) ||
          asDate(it.interventionDate) ||
          asDate(it.date)
        if (!d) return false
        if (dayjs(d).isBefore(start, 'day') || dayjs(d).isAfter(end, 'day'))
          return false
      }
      return true
    })
  }, [
    allInterventions,
    application?.programId,
    participant?.companyCode,
    application?.companyCode,
    companyCode,
    selectedProgram,
    selectedConsultant,
    dateRange
  ])

  // filter monthly performance by date
  const filteredMP = useMemo(() => {
    if (!dateRange) return mpHistory
    const [start, end] = dateRange
    if (!start || !end) return mpHistory
    return mpHistory.filter(r => {
      const d = asDate(r.createdAt) || firstOfMonthFromLabel(r.month)
      if (!d) return false
      return !dayjs(d).isBefore(start, 'day') && !dayjs(d).isAfter(end, 'day')
    })
  }, [mpHistory, dateRange])

  // KPIs
  const requiredCount = requiredFromApp.length
  const completedCount = useMemo(
    () =>
      filteredInterventions.filter(
        i => (i.status || '').toLowerCase() === 'completed'
      ).length || completedFromApp.length,
    [filteredInterventions, completedFromApp.length]
  )
  const derivedParticipation =
    application?.interventions?.participationRate ??
    (requiredCount > 0
      ? Math.min(100, Math.round((completedCount / requiredCount) * 100))
      : 0)

  // employees KPI — latest record within filteredMP (fallback latest overall)
  const latestMP = useMemo(() => {
    const list = (filteredMP.length ? filteredMP : mpHistory)
      .map(r => ({
        r,
        d: asDate(r.createdAt) || firstOfMonthFromLabel(r.month)
      }))
      .filter(x => !!x.d)
      .sort((a, b) => Number(a.d) - Number(b.d))
    return list.length ? list[list.length - 1].r : null
  }, [filteredMP, mpHistory])
  const employeesKPI =
    (latestMP?.headPermanent || 0) + (latestMP?.headTemporary || 0)

  // Revenue + Headcount categories/data
  // Merge monthlyPerformance + participant.revenueHistory.monthly
  const revenueByMonth = useMemo(() => {
    const acc: Record<string, number> = {}

    // from monthlyPerformance subcollection
    filteredMP.forEach(r => {
      const d = asDate(r.createdAt) || firstOfMonthFromLabel(r.month)
      if (!d) return
      const k = monthKey(d)
      acc[k] = (acc[k] || 0) + Number(r.revenue || 0)
    })

    // from participant doc
    const rh = participant?.revenueHistory
    if (rh?.monthly && typeof rh.monthly === 'object') {
      Object.entries(rh.monthly ?? {}).forEach(([label, val]) => {
        const d = parseMonthLabelToDate(label)
        if (!d) return
        if (
          start &&
          end &&
          (dayjs(d).isBefore(start, 'day') || dayjs(d).isAfter(end, 'day'))
        )
          return
        const k = monthKey(d)
        acc[k] = (acc[k] || 0) + Number(val || 0)
      })
    }

    const cats = Object.keys(acc).sort()
    return { categories: cats, data: cats.map(c => acc[c]) }
  }, [filteredMP, participant?.revenueHistory])

  // Merge monthlyPerformance + participant.headcountHistory.monthly (perm+temp)
  const headcountByMonth = useMemo(() => {
    const acc: Record<string, number> = {}

    // from monthlyPerformance subcollection
    filteredMP.forEach(r => {
      const d = asDate(r.createdAt) || firstOfMonthFromLabel(r.month)
      if (!d) return
      const k = monthKey(d)
      const total = Number(r.headPermanent || 0) + Number(r.headTemporary || 0)
      acc[k] = (acc[k] || 0) + total
    })

    // from participant doc
    const hh = participant?.headcountHistory
    if (hh?.monthly && typeof hh.monthly === 'object') {
      Object.entries(hh.monthly as Record<string, any>).forEach(
        ([label, obj]) => {
          const d = parseMonthLabelToDate(label)
          if (!d) return
          const k = monthKey(d)
          const total =
            Number(obj?.permanent || 0) + Number(obj?.temporary || 0)
          acc[k] = (acc[k] || 0) + total
        }
      )
    }

    const cats = Object.keys(acc).sort()
    return { categories: cats, data: cats.map(c => acc[c]) }
  }, [filteredMP, participant?.headcountHistory])

  // Interventions donut for this participant (with drilldown)
  const donutData = useMemo(() => {
    // already filtered by all your filters
    const completed = filteredInterventions.filter(
      i => (i.status || '').toLowerCase() === 'completed'
    )
    const byArea: Record<
      string,
      { total: number; titles: Record<string, number> }
    > = {}

    completed.forEach(i => {
      const area = (i.area || i.areaOfSupport || 'Unknown') as string
      const title = (i.title || i.interventionTitle || 'Untitled') as string
      if (!byArea[area]) byArea[area] = { total: 0, titles: {} }
      byArea[area].total++
      byArea[area].titles[title] = (byArea[area].titles[title] || 0) + 1
    })

    const top = Object.entries(byArea)
      .map(([name, v]) => ({ name, y: v.total, drilldown: name }))
      .sort((a, b) => b.y - a.y)

    const drill = Object.entries(byArea).map(([name, v]) => ({
      id: name,
      data: Object.entries(v.titles).sort((a, b) => b[1] - a[1]) as Array<
        [string, number]
      >
    }))

    return { top, drill }
  }, [filteredInterventions])

  // ───────────────────────────────────────────────────────────
  // PEER AVERAGES
  // ───────────────────────────────────────────────────────────
  const [peerRevenueAvg, setPeerRevenueAvg] = useState<{
    categories: string[]
    data: number[]
  }>({ categories: [], data: [] })
  const [peerHeadcountAvg, setPeerHeadcountAvg] = useState<{
    categories: string[]
    data: number[]
  }>({ categories: [], data: [] })
  const [peerInterventionsDept, setPeerInterventionsDept] = useState<
    Array<{ name: string; y: number }>
  >([])
  const [peerComplianceDonut, setPeerComplianceDonut] = useState<
    Array<{ name: string; y: number }>
  >([])

  useEffect(() => {
    // build peers based on compareBy
    const run = async () => {
      try {
        if (!compareEnabled || !companyCode || !participantId) {
          setPeerRevenueAvg({ categories: [], data: [] })
          setPeerHeadcountAvg({ categories: [], data: [] })
          setPeerInterventionsDept([])
          setPeerComplianceDonut([])
          return
        }

        // 1) gather candidate peer IDs
        let ids: string[] = []

        if (compareBy === 'gender' || compareBy === 'sector') {
          const field =
            compareBy === 'gender'
              ? participant?.gender || participant?.sex
              : participant?.sector
          if (!field) return
          const snap = await getDocs(
            query(
              collection(db, 'participants'),
              where('companyCode', '==', companyCode),
              where(compareBy === 'gender' ? 'gender' : 'sector', '==', field)
            )
          )
          ids = snap.docs.map(d => d.id).filter(id => id !== participantId)
        } else if (compareBy === 'program') {
          // Program to compare against: explicit filter first, else participant's program
          const prog =
            (selectedProgram !== 'all'
              ? selectedProgram
              : application?.programId) || ''
          if (!prog) return

          // peers from applications in same company + program
          const snap = await getDocs(
            query(
              collection(db, 'applications'),
              where('companyCode', '==', companyCode),
              where('programId', '==', prog)
            )
          )
          ids = snap.docs
            .map(d => (d.data() as any).participantId)
            .filter((id: string) => id && id !== participantId)
        }

        if (!ids.length) {
          setPeerRevenueAvg({ categories: [], data: [] })
          setPeerHeadcountAvg({ categories: [], data: [] })
          setPeerInterventionsDept([])
          setPeerComplianceDonut([])
          return
        }

        // cap to avoid read explosion
        const maxPeers = 25
        if (ids.length > maxPeers) ids = ids.slice(0, maxPeers)

        // map peerId -> programId (used for selectedProgram filter and annotating interventions)
        const programMap = new Map<string, string>()
        for (const chunkIds of chunk(ids, 10)) {
          const apps = await getDocs(
            query(
              collection(db, 'applications'),
              where('participantId', 'in', chunkIds as any)
            )
          )
          apps.docs.forEach(d => {
            const data = d.data() as any
            if (data.participantId)
              programMap.set(data.participantId, data.programId || '')
          })
        }

        // if selectedProgram filter is set, keep only peers with that program
        if (selectedProgram !== 'all' && compareBy !== 'program') {
          ids = ids.filter(id => programMap.get(id) === selectedProgram)
          if (!ids.length) {
            setPeerRevenueAvg({ categories: [], data: [] })
            setPeerHeadcountAvg({ categories: [], data: [] })
            setPeerInterventionsDept([])
            setPeerComplianceDonut([])
            return
          }
        }

        // 2) peer revenue/headcount from monthlyPerformance
        const [start, end] = dateRange || [null, null]
        const revAcc: Record<string, { sum: number; n: number }> = {}
        const headAcc: Record<string, { sum: number; n: number }> = {}

        // Also prepare compliance + interventions accumulators
        const compAcc: Record<string, number> = {
          Valid: 0,
          Missing: 0,
          Expired: 0,
          'Other/Unknown': 0
        }
        const deptAcc: Record<string, number> = {}

        // fetch peers in manageable batches
        for (const id of ids) {
          // monthly performance
          try {
            const histRef = collection(db, 'monthlyPerformance', id, 'history')
            const snap = await getDocs(histRef)
            snap.docs.forEach(docu => {
              const r = docu.data() as any
              const d = asDate(r.createdAt) || firstOfMonthFromLabel(r.month)
              if (!d) return
              if (start && end) {
                if (
                  dayjs(d).isBefore(start, 'day') ||
                  dayjs(d).isAfter(end, 'day')
                )
                  return
              }
              const k = monthKey(d)
              const rev = Number(r.revenue || 0)
              const head =
                Number(r.headPermanent || 0) + Number(r.headTemporary || 0)
              revAcc[k] = {
                sum: (revAcc[k]?.sum || 0) + rev,
                n: (revAcc[k]?.n || 0) + 1
              }
              headAcc[k] = {
                sum: (headAcc[k]?.sum || 0) + head,
                n: (headAcc[k]?.n || 0) + 1
              }
            })
          } catch {}

          // compliance (prefer participant doc, fallback application if needed)
          try {
            const pDoc = await getDoc(doc(db, 'participants', id))
            let cdocs: ComplianceDoc[] = Array.isArray(
              pDoc.data()?.complianceDocuments
            )
              ? pDoc.data()!.complianceDocuments
              : []
            if (!cdocs.length) {
              const appSnap = await getDocs(
                query(
                  collection(db, 'applications'),
                  where('participantId', '==', id),
                  limit(1)
                )
              )
              if (!appSnap.empty) {
                const a = appSnap.docs[0].data() as any
                if (Array.isArray(a?.complianceDocuments))
                  cdocs = a.complianceDocuments
              }
            }
            cdocs.forEach(c => {
              const s = (c?.status || '').toLowerCase()
              if (s === 'valid') compAcc['Valid']++
              else if (s === 'missing') compAcc['Missing']++
              else if (s === 'expired') compAcc['Expired']++
              else compAcc['Other/Unknown']++
            })
          } catch {}
        }

        // interventions for peers (via IN chunks)
        for (const ten of chunk(ids, 10)) {
          const [s1, s2] = await Promise.all([
            getDocs(
              query(
                collection(db, 'assignedInterventions'),
                where('participantId', 'in', ten as any)
              )
            ),
            getDocs(
              query(
                collection(db, 'interventionsDatabase'),
                where('participantId', 'in', ten as any)
              )
            )
          ])
          const list: Intervention[] = [
            ...s1.docs.map(d => ({ id: d.id, ...d.data() } as any)),
            ...s2.docs.map(d => ({ id: d.id, ...d.data() } as any))
          ]
          // filter like the main page
          list.forEach(it => {
            const dep = (it.area || it.areaOfSupport || '')
              .toString()
              .toLowerCase()
            if (selectedConsultant !== 'all') {
              const c = (it.consultantEmail || it.consultantName || '')
                .toString()
                .toLowerCase()
              if (!c.includes(selectedConsultant.toLowerCase())) return
            }
            if (selectedProgram !== 'all') {
              const prog =
                it.programId || programMap.get((it as any).participantId)
              if ((prog || '') !== selectedProgram) return
            }
            const d =
              asDate((it as any).completedAt) ||
              asDate((it as any).interventionDate) ||
              asDate((it as any).date)
            if (dateRange && dateRange[0] && dateRange[1]) {
              if (!d) return
              if (
                dayjs(d).isBefore(dateRange[0], 'day') ||
                dayjs(d).isAfter(dateRange[1], 'day')
              )
                return
            }
            if (((it.status || '') as string).toLowerCase() !== 'completed')
              return
            const key = (it.area || it.areaOfSupport || 'Unknown') as string
            deptAcc[key] = (deptAcc[key] || 0) + 1
          })
        }

        // build peer revenue/headcount averages aligned with this user's x-axis
        const catSet = new Set<string>([
          ...revenueByMonth.categories,
          ...Object.keys(revAcc)
        ])
        const cats = Array.from(catSet).sort()
        const revAvg = cats.map(k => {
          const v = revAcc[k]
          return v ? Number((v.sum / v.n).toFixed(2)) : 0
        })
        const headAvg = cats.map(k => {
          const v = headAcc[k]
          return v ? Number((v.sum / v.n).toFixed(2)) : 0
        })

        // peer donuts
        const peerDeptData = Object.entries(deptAcc)
          .filter(([_, y]) => y > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([name, y]) => ({ name, y }))

        const peerCompData = Object.entries(compAcc)
          .filter(([_, y]) => y > 0)
          .map(([name, y]) => ({ name, y }))

        setPeerRevenueAvg({ categories: cats, data: revAvg })
        setPeerHeadcountAvg({ categories: cats, data: headAvg })
        setPeerInterventionsDept(peerDeptData)
        setPeerComplianceDonut(peerCompData)
      } catch (e: any) {
        console.error(e)
        message.warning(
          'Could not compute peer averages for the selected criteria.'
        )
        setPeerRevenueAvg({ categories: [], data: [] })
        setPeerHeadcountAvg({ categories: [], data: [] })
        setPeerInterventionsDept([])
        setPeerComplianceDonut([])
      }
    }

    run()
  }, [
    compareEnabled,
    compareBy,
    companyCode,
    participantId,
    participant?.gender,
    participant?.sex,
    participant?.sector,
    application?.programId,
    selectedProgram,
    selectedConsultant,
    dateRange,
    revenueByMonth.categories
  ])

  // Compliance donut for this participant (hide zeros)
  const complianceDonutData = useMemo(() => {
    const counts: Record<string, number> = {
      Valid: 0,
      Missing: 0,
      Expired: 0,
      'Other/Unknown': 0
    }
    ;(compliance || []).forEach(c => {
      const s = (c?.status || '').toLowerCase()
      if (s === 'valid') counts['Valid']++
      else if (s === 'missing') counts['Missing']++
      else if (s === 'expired') counts['Expired']++
      else counts['Other/Unknown']++
    })
    return Object.entries(counts)
      .filter(([_, y]) => y > 0)
      .map(([name, y]) => ({ name, y }))
  }, [compliance])

  // Charts
  const alignTo = (cats: string[], srcCats: string[], srcData: number[]) => {
    const map = new Map(srcCats.map((c, i) => [c, srcData[i] ?? 0]))
    return cats.map(c => map.get(c) ?? 0)
  }

  const headcountMonthlyBreakdown = useMemo(() => {
    const acc: Record<string, { perm: number; temp: number }> = {}

    // from monthlyPerformance
    filteredMP.forEach(r => {
      const d = asDate(r.createdAt) || firstOfMonthFromLabel(r.month)
      if (!d) return
      const k = monthKey(d)
      if (!acc[k]) acc[k] = { perm: 0, temp: 0 }
      acc[k].perm += Number(r.headPermanent || 0)
      acc[k].temp += Number(r.headTemporary || 0)
    })

    // from participant doc
    const hh = participant?.headcountHistory
    if (hh?.monthly && typeof hh.monthly === 'object') {
      Object.entries(hh.monthly as Record<string, any>).forEach(
        ([label, obj]) => {
          const d = parseMonthLabelToDate(label)
          if (!d) return
          const k = monthKey(d)
          if (!acc[k]) acc[k] = { perm: 0, temp: 0 }
          acc[k].perm += Number(obj?.permanent || 0)
          acc[k].temp += Number(obj?.temporary || 0)
        }
      )
    }

    return acc
  }, [filteredMP, participant?.headcountHistory])

  const headcountCats = useMemo(
    () => Object.keys(headcountMonthlyBreakdown).sort(),
    [headcountMonthlyBreakdown]
  )
  const headcountTotals = useMemo(
    () =>
      headcountCats.map(
        k =>
          headcountMonthlyBreakdown[k].perm + headcountMonthlyBreakdown[k].temp
      ),
    [headcountCats, headcountMonthlyBreakdown]
  )
  const headcountDrillSeries = useMemo(
    () =>
      headcountCats.map(k => ({
        id: k,
        type: 'column',
        data: [
          ['Permanent', headcountMonthlyBreakdown[k].perm],
          ['Temporary', headcountMonthlyBreakdown[k].temp]
        ]
      })),
    [headcountCats, headcountMonthlyBreakdown]
  )

  const headPeer = useMemo(
    () =>
      alignTo(
        headcountCats,
        peerHeadcountAvg.categories,
        peerHeadcountAvg.data
      ),
    [headcountCats, peerHeadcountAvg]
  )

  const chartHeadcountDrill: Highcharts.Options = {
    chart: { type: 'column' },
    title: { text: 'Workforce by Month (drilldown)' },
    xAxis: { type: 'category' },
    yAxis: { title: { text: 'Employees' }, allowDecimals: false },
    plotOptions: { series: { borderRadius: 4 } },
    series: [
      {
        type: 'column',
        name: 'Employees',
        data: headcountCats.map((k, i) => ({
          name: dayjs(k + '-01').format('MMM YYYY'),
          y: headcountTotals[i],
          drilldown: k
        }))
      },
      ...(compareEnabled
        ? [
            {
              type: 'spline', // overlay peer avg by month
              name: 'Peer Avg Employees',
              data: headPeer
            } as Highcharts.SeriesOptionsType
          ]
        : [])
    ],
    drilldown: { series: headcountDrillSeries as any },
    credits: { enabled: false }
  }

  // Revenue
  const revenueYearAgg = useMemo(() => {
    const yearly: Record<string, number> = {}
    const monthly: Record<string, Record<string, number>> = {}

    // monthly from merged series
    revenueByMonth.categories.forEach((ym, i) => {
      const val = Number(revenueByMonth.data[i] || 0)
      const y = ym.slice(0, 4),
        m = ym.slice(5, 7)
      yearly[y] = (yearly[y] || 0) + val
      ;(monthly[y] ||= {})[m] = ((monthly[y] || {})[m] || 0) + val
    })

    // add annual only where we have no monthly
    const rh = participant?.revenueHistory
    if (rh?.annual && typeof rh.annual === 'object') {
      const yearsWithMonthly = new Set(Object.keys(monthly))
      Object.entries(rh.annual as Record<string, any>).forEach(([y, v]) => {
        if (!yearsWithMonthly.has(y))
          yearly[y] = (yearly[y] || 0) + Number(v || 0)
      })
    }

    return { yearly, monthly }
  }, [revenueByMonth, participant?.revenueHistory])

  const revYears = useMemo(
    () => Object.keys(revenueYearAgg.yearly).sort(),
    [revenueYearAgg]
  )

  const xCatsRev = useMemo(
    () =>
      Array.from(
        new Set([...revenueByMonth.categories, ...peerRevenueAvg.categories])
      ).sort(),
    [revenueByMonth.categories, peerRevenueAvg.categories]
  )
  const revThis = useMemo(
    () => alignTo(xCatsRev, revenueByMonth.categories, revenueByMonth.data),
    [xCatsRev, revenueByMonth.categories, revenueByMonth.data]
  )
  const revPeer = useMemo(
    () => alignTo(xCatsRev, peerRevenueAvg.categories, peerRevenueAvg.data),
    [xCatsRev, peerRevenueAvg.categories, peerRevenueAvg.data]
  )
  const peerRevYearAgg = useMemo(() => {
    const yearly: Record<string, number> = {}
    const monthly: Record<string, Record<string, number>> = {}
    peerRevenueAvg.categories.forEach((ym, i) => {
      const y = ym.slice(0, 4),
        m = ym.slice(5, 7)
      const v = Number(peerRevenueAvg.data[i] || 0)
      yearly[y] = (yearly[y] || 0) + v
      ;(monthly[y] ||= {})[m] = ((monthly[y] || {})[m] || 0) + v
    })
    return { yearly, monthly }
  }, [peerRevenueAvg])

  const allYears = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(revenueYearAgg.yearly),
          ...Object.keys(peerRevYearAgg.yearly)
        ])
      ).sort(),
    [revenueYearAgg, peerRevYearAgg]
  )

  const revenueDrillSeries = useMemo(
    () => [
      // existing incubatee per-year monthly drill
      ...allYears.map(y => {
        const mm = revenueYearAgg.monthly[y] || {}
        const months = Object.keys(mm).sort()
        return {
          id: y,
          name: y,
          type: 'column',
          data: months.map(m => [dayjs(`${y}-${m}-01`).format('MMM'), mm[m]])
        }
      }),
      // peer per-year monthly drill
      ...(!compareEnabled
        ? []
        : allYears.map(y => {
            const mm = peerRevYearAgg.monthly[y] || {}
            const months = Object.keys(mm).sort()
            return {
              id: `peer-${y}`,
              name: `Peer Avg ${y}`,
              type: 'column',
              data: months.map(m => [
                dayjs(`${y}-${m}-01`).format('MMM'),
                mm[m]
              ])
            }
          }))
    ],
    [allYears, revenueYearAgg, peerRevYearAgg, compareEnabled]
  )

  const chartRevenueDrill: Highcharts.Options = {
    chart: { type: 'column' },
    title: { text: 'Revenue (Annual → Monthly)' },
    xAxis: { type: 'category' },
    yAxis: { title: { text: 'Revenue' }, allowDecimals: false },
    series: [
      {
        type: 'column',
        name: 'Revenue',
        data: allYears.map(y => ({
          name: y,
          y: revenueYearAgg.yearly[y] || 0,
          drilldown: y
        }))
      },
      ...(compareEnabled
        ? [
            {
              type: 'column',
              name: 'Peer Avg (Year)',
              data: allYears.map(y => ({
                name: y,
                y: peerRevYearAgg.yearly[y] || 0,
                drilldown: `peer-${y}`
              }))
            } as Highcharts.SeriesOptionsType
          ]
        : [])
    ],
    drilldown: { series: revenueDrillSeries as any },
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
          distance: 10,
          formatter: function (this: any) {
            return this.y > 0 ? `${this.point.name} (${this.y})` : null
          }
        }
      }
    },
    series: [
      {
        name: 'This Incubatee',
        type: 'pie',
        innerSize: '45%',
        size: '60%',
        data: complianceDonutData // inner ring
      },
      // ⬇️ OUTER RING (peer average) — only when enabled & has data
      ...(compareEnabled && peerComplianceDonut.length
        ? [
            {
              name: 'Peer Avg',
              type: 'pie',
              size: '80%',
              innerSize: '65%',
              data: peerComplianceDonut
            } as Highcharts.SeriesOptionsType
          ]
        : [])
    ],

    credits: { enabled: false }
  }
  const chartInterventionsDonut: Highcharts.Options = {
    chart: { type: 'pie' },
    title: { text: 'Completed Interventions by Area' },
    plotOptions: {
      pie: {
        innerSize: '60%',
        showInLegend: true,
        dataLabels: { enabled: false }
      }
    },
    series: [
      { type: 'pie', name: 'This Incubatee', data: donutData.top },
      ...(compareEnabled && peerInterventionsDept.length
        ? [
            {
              type: 'pie',
              name: 'Peer Avg',
              size: '80%',
              innerSize: '70%',
              data: peerInterventionsDept
            }
          ]
        : [])
    ],
    drilldown: { series: donutData.drill as any },
    credits: { enabled: false }
  }

  if (loading)
    return (
      <div style={{ padding: 8, minHeight: '100vh' }}>
        <Spin />
      </div>
    )

  if (!participant && !application) {
    return (
      <div style={{ padding: 8, minHeight: '100vh' }}>
        <Alert type='warning' showIcon message='Participant not found' />
        <Button
          type='link'
          onClick={() => navigate('/operations/participants')}
        >
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

      <Row justify='space-between' align='middle' style={{ marginBottom: 12 }}>
        <Col>
          <Space>
            <Button
              type='link'
              icon={<ArrowLeftOutlined />}
              onClick={() => {
                if (location?.state?.from) navigate(-1)
                else navigate('/operations/participants')
              }}
            >
              Back to selection
            </Button>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {displayName} Performance
              </Title>
            </div>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setDrawerOpen(true)}
            >
              Advanced Filters
            </Button>
          </Space>
        </Col>
      </Row>

      {loading ? (
        <Spin />
      ) : !participant && !application ? (
        <Alert type='warning' showIcon message='Participant not found' />
      ) : (
        <>
          {/* KPI tiles */}
          <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
            <Col xs={24} sm={12} md={6}>
              <MotionCard>
                <Space align='start'>
                  <div
                    style={{
                      background: '#f0f5ff',
                      padding: 8,
                      borderRadius: '50%'
                    }}
                  >
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
                  <div
                    style={{
                      background: '#f6ffed',
                      padding: 8,
                      borderRadius: '50%'
                    }}
                  >
                    <CheckCircleOutlined style={{ fontSize: 18 }} />
                  </div>
                  <div>
                    <Text strong>Completed</Text>
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
                  <div
                    style={{
                      background: '#fffbe6',
                      padding: 8,
                      borderRadius: '50%'
                    }}
                  >
                    <Tag color='gold'>%</Tag>
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
                  <div
                    style={{
                      background: '#e6f7ff',
                      padding: 8,
                      borderRadius: '50%'
                    }}
                  >
                    <TeamOutlined style={{ fontSize: 18 }} />
                  </div>
                  <div>
                    <Text strong>Employees (from monthly records)</Text>
                    <Title level={3} style={{ margin: 0 }}>
                      {employeesKPI}
                    </Title>
                  </div>
                </Space>
              </MotionCard>
            </Col>
          </Row>

          {/* Donuts + lines */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={12}>
              <MotionCard>
                {donutData.top.length ? (
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={chartInterventionsDonut}
                  />
                ) : (
                  <Empty description='No completed interventions in period' />
                )}
              </MotionCard>
            </Col>

            {/* keep your Compliance donut in the other half if you want */}
            <Col xs={24} lg={12}>
              <MotionCard>
                {complianceDonutData.length || peerComplianceDonut.length ? (
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={chartComplianceDonut}
                  />
                ) : (
                  <Empty description='No compliance data' />
                )}
              </MotionCard>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <MotionCard>
                {revYears.length ? (
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={chartRevenueDrill}
                  />
                ) : (
                  <Empty description='No revenue data' />
                )}
              </MotionCard>
            </Col>
            <Col xs={24} lg={12}>
              <MotionCard>
                {headcountCats.length ? (
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={chartHeadcountDrill}
                  />
                ) : (
                  <Empty description='No workforce data' />
                )}
              </MotionCard>
            </Col>
          </Row>
        </>
      )}

      {/* Advanced Filters Drawer */}
      <Drawer
        title='Advanced Filters'
        placement='right'
        width={420}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        <Space direction='vertical' size='large' style={{ width: '100%' }}>
          <div>
            <Text strong>Program</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={tmpProgram}
              onChange={setTmpProgram}
            >
              <Option value='all'>All</Option>
              {programs.map(p => (
                <Option key={p.id} value={p.id}>
                  {p.name}
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <Text strong>Consultant</Text>
            <Select
              showSearch
              style={{ width: '100%', marginTop: 8 }}
              value={tmpConsultant}
              onChange={setTmpConsultant}
              optionFilterProp='children'
            >
              <Option value='all'>All</Option>
              {consultants.map(c => (
                <Option key={c.id} value={(c.email || c.name).toLowerCase()}>
                  {c.name} {c.email ? `(${c.email})` : ''}
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <Text strong>Period</Text>
            <div style={{ marginTop: 8 }}>
              <RangePicker
                allowClear
                value={tmpDateRange as any}
                onChange={vals => setTmpDateRange(vals as any)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div>
            <Text strong>Peer averages</Text>
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 12,
                alignItems: 'center'
              }}
            >
              <Switch
                checked={tmpCompareEnabled}
                onChange={setTmpCompareEnabled}
              />
              <Select
                style={{ minWidth: 220 }}
                value={tmpCompareBy}
                onChange={setTmpCompareBy}
                disabled={!tmpCompareEnabled}
              >
                <Option value='gender'>Gender</Option>
                <Option value='sector'>Sector</Option>
                <Option value='program'>Program</Option>
              </Select>
            </div>
          </div>

          <Divider />

          <Space>
            <Button
              onClick={() => {
                setTmpProgram('all')
                setTmpConsultant('all')
                setTmpDateRange(null)
                // NEW
                setTmpCompareEnabled(false)
                setTmpCompareBy('program')
              }}
            >
              Reset
            </Button>
            <Button
              type='primary'
              onClick={() => {
                setSelectedProgram(tmpProgram)
                setSelectedConsultant(tmpConsultant)
                setDateRange(tmpDateRange)
                // NEW
                setCompareEnabled(tmpCompareEnabled)
                setCompareBy(tmpCompareBy)
                setDrawerOpen(false)
              }}
            >
              Apply
            </Button>
          </Space>
        </Space>
      </Drawer>
    </div>
  )
}

export default IncubateePerformancePage
