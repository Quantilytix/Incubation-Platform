// src/pages/OperationsReports.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  Typography,
  Row,
  Col,
  DatePicker,
  Select,
  Segmented,
  Space,
  Statistic,
  message
} from 'antd'
import { Helmet } from 'react-helmet'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import HighchartsMore from 'highcharts/highcharts-more'
import HighchartsTreemap from 'highcharts/modules/treemap'
import HighchartsFunnel from 'highcharts/modules/funnel'

import dayjs, { Dayjs } from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import isoWeek from 'dayjs/plugin/isoWeek'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(weekOfYear)
dayjs.extend(isoWeek)
dayjs.extend(quarterOfYear)

import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where
} from 'firebase/firestore'
import { db } from '@/firebase'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'
import { useFullIdentity } from '@/hooks/useFullIdentity'

if (typeof HighchartsFunnel === 'function') HighchartsFunnel(Highcharts)
if (typeof HighchartsTreemap === 'function') HighchartsTreemap(Highcharts)
if (typeof HighchartsMore === 'function') HighchartsMore(Highcharts)

const { Title } = Typography
const { RangePicker } = DatePicker

type TimeBucket = 'week' | 'month' | 'quarter' | 'year' | 'custom'
type SegmentKey =
  | 'Applications'
  | 'Participants'
  | 'Consultants Performance'
  | 'Interventions Overview'

type AppInterventionItem = { id: string; title: string; area?: string }

type ApplicationDoc = {
  id: string
  participantId?: string
  programName?: string
  beneficiaryName?: string
  email?: string
  companyCode?: string
  applicationStatus?: string
  stage?: string
  createdAt?: any
  submittedAt?: any
  updatedAt?: any
  interventions?: {
    required?: AppInterventionItem[]
    completed?: { id: string; title: string }[]
  }
  complianceDocuments?: Array<{
    docType: string
    status: 'valid' | 'expiring' | 'expired' | 'missing' | 'pending'
    updatedAt?: any
  }>
}

type Participant = {
  id: string
  beneficiaryName: string
  programName?: string
  sector?: string
  stage?: string
  province?: string
  city?: string
  email?: string
  gender?: string
  idNumber?: string
  beeLevel?: string
  hub?: string
  femaleOwnedPercent?: number
  youthOwnedPercent?: number
  blackOwnedPercent?: number
}

type Assignment = {
  id: string
  participantId: string
  beneficiaryName?: string
  consultantId?: string
  consultantName?: string
  interventionId: string
  interventionTitle?: string
  areaOfSupport?: string
  status?: 'assigned' | 'in-progress' | 'completed' | 'cancelled' | string
  dueDate?: any
  createdAt?: any
  updatedAt?: any
}

type IntervMeta = {
  id: string
  title?: string
  areaOfSupport?: string
  area?: string
}

/** Robust timestamp → Date */
function toDate (v: any): Date | null {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  if (v && typeof v === 'object' && typeof v.seconds === 'number') {
    const ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6)
    const d = new Date(ms)
    return isNaN(+d) ? null : d
  }
  if (typeof v === 'number') {
    const ms = v > 1e12 ? v : v * 1000
    const d = new Date(ms)
    return isNaN(+d) ? null : d
  }
  if (typeof v === 'string') {
    const d = new Date(v)
    return isNaN(+d) ? null : d
  }
  return null
}

/** Pick best date on an application for time-bucketing */
function appPrimaryDate (a: ApplicationDoc): Date | null {
  return toDate(a.submittedAt) || toDate(a.createdAt) || toDate(a.updatedAt)
}

/** Return start-of-bucket key + pretty label */
function bucketKey (d: Dayjs, bucket: TimeBucket): string {
  switch (bucket) {
    case 'week':
      return d.startOf('isoWeek').format('YYYY-MM-DD')
    case 'month':
      return d.startOf('month').format('YYYY-MM')
    case 'quarter':
      return d.startOf('quarter').format('YYYY-[Q]Q')
    case 'year':
      return d.startOf('year').format('YYYY')
    default:
      return d.startOf('day').format('YYYY-MM-DD')
  }
}
function labelForKey (key: string, bucket: TimeBucket): string {
  if (bucket === 'week') return `W${dayjs(key).isoWeek()} ${dayjs(key).year()}`
  if (bucket === 'month') return dayjs(key).format('MMM YYYY')
  if (bucket === 'quarter') return key.replace('-', ' ')
  if (bucket === 'year') return key
  return dayjs(key).format('YYYY-MM-DD')
}

/** Round numbers for labels/tooltips */
function round (v: number | undefined | null): number | null {
  if (v == null) return null
  return Math.round(v as number)
}

const OperationsReports: React.FC = () => {
  const { user } = useFullIdentity()

  const [segment, setSegment] = useState<SegmentKey>('Applications')
  const [period, setPeriod] = useState<TimeBucket>('year')
  const [[start, end], setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('year'),
    dayjs().endOf('year')
  ])

  const [appsAll, setAppsAll] = useState<ApplicationDoc[]>([])
  const [appsAccepted, setAppsAccepted] = useState<ApplicationDoc[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user?.companyCode) return
    ;(async () => {
      setLoading(true)
      try {
        // Applications (company-scoped)
        const appsSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('companyCode', '==', user.companyCode)
          )
        )
        const allApps: ApplicationDoc[] = appsSnap.docs.map(d => ({
          id: d.id,
          ...(d.data() as any)
        }))
        const accepted = allApps.filter(
          a => String(a.applicationStatus || '').toLowerCase() === 'accepted'
        )
        setAppsAll(allApps)
        setAppsAccepted(accepted)

        // Participants for accepted apps
        const partIds = new Set(
          accepted.map(a => a.participantId).filter(Boolean)
        )
        const pSnap = await getDocs(collection(db, 'participants'))
        const pMap = new Map(pSnap.docs.map(d => [d.id, d.data() as any]))
        const acceptedParticipants: Participant[] = Array.from(partIds).map(
          pid => {
            const p = pMap.get(pid) || {}
            const app = accepted.find(a => a.participantId === pid)
            return {
              id: pid!,
              beneficiaryName:
                app?.beneficiaryName || p.beneficiaryName || 'Unknown',
              programName: app?.programName || p.programName || '—',
              sector: p.sector || '—',
              stage: app?.stage || p.stage || '—',
              province: p.province || '—',
              city: p.city || '—',
              email: p.email || app?.email || '—',
              gender: p.gender,
              idNumber: p.idNumber,
              beeLevel: p.beeLevel,
              hub: p.hub,
              femaleOwnedPercent: p.femaleOwnedPercent,
              youthOwnedPercent: p.youthOwnedPercent,
              blackOwnedPercent: p.blackOwnedPercent
            }
          }
        )
        setParticipants(acceptedParticipants)

        // Assigned Interventions (scoped)
        const aiSnap = await getDocs(collection(db, 'assignedInterventions'))
        const aiAll: Assignment[] = aiSnap.docs.map(d => ({
          id: d.id,
          ...(d.data() as any)
        }))
        const aiScoped = aiAll.filter(a => partIds.has(a.participantId))
        const uniqInterventionIds = Array.from(
          new Set(aiScoped.map(a => a.interventionId).filter(Boolean))
        )
        const metaMap = new Map<string, IntervMeta>()
        await Promise.all(
          uniqInterventionIds.map(async id => {
            try {
              const m = await getDoc(doc(db, 'interventions', id))
              if (m.exists()) metaMap.set(id, { id, ...(m.data() as any) })
            } catch {}
          })
        )
        const aiEnriched = aiScoped.map(a => {
          const meta = metaMap.get(a.interventionId) || {}
          return {
            ...a,
            interventionTitle: a.interventionTitle || meta.title || 'Untitled',
            areaOfSupport:
              a.areaOfSupport || meta.areaOfSupport || meta.area || '—'
          }
        })
        setAssignments(aiEnriched)
      } catch (e) {
        console.error(e)
        message.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.companyCode])

  useEffect(() => {
    if (period === 'custom') return
    const now = dayjs()
    const newRange: [Dayjs, Dayjs] =
      period === 'week'
        ? [now.startOf('isoWeek'), now.endOf('isoWeek')]
        : period === 'month'
        ? [now.startOf('month'), now.endOf('month')]
        : period === 'quarter'
        ? [now.startOf('quarter'), now.endOf('quarter')]
        : [now.startOf('year'), now.endOf('year')]
    setRange(newRange)
  }, [period])

  const inWindow = (d?: any) => {
    const dt = toDate(d)
    if (!dt) return false
    const dj = dayjs(dt)
    return dj.isSameOrAfter(start, 'day') && dj.isSameOrBefore(end, 'day')
  }

  // ---------------------------- Applications vs Accepted (true time buckets) ---
  const appSeries = useMemo(() => {
    const allMap = new Map<string, number>()
    const accMap = new Map<string, number>()
    const add = (m: Map<string, number>, k: string) =>
      m.set(k, (m.get(k) || 0) + 1)

    // Use primary date and filter to window
    const allIn = appsAll
      .map(appPrimaryDate)
      .filter(Boolean)
      .filter(d => inWindow(d))
    const accIn = appsAccepted
      .map(appPrimaryDate)
      .filter(Boolean)
      .filter(d => inWindow(d))

    const allList = (
      allIn.length ? allIn : appsAll.map(appPrimaryDate).filter(Boolean)
    ) as Date[]
    const accList = (
      accIn.length ? accIn : appsAccepted.map(appPrimaryDate).filter(Boolean)
    ) as Date[]

    allList.forEach(d => add(allMap, bucketKey(dayjs(d), period)))
    accList.forEach(d => add(accMap, bucketKey(dayjs(d), period)))

    const keys = Array.from(new Set([...allMap.keys(), ...accMap.keys()]))
    keys.sort((a, b) => (a < b ? -1 : 1))
    const cats = keys.map(k => labelForKey(k, period))
    return {
      categories: cats,
      all: keys.map(k => allMap.get(k) || 0),
      accepted: keys.map(k => accMap.get(k) || 0)
    }
  }, [appsAll, appsAccepted, period, start, end])

  // ---------------------------- Most Requested Interventions (from apps) -------
  const mostRequested = useMemo(() => {
    const source = appsAll.filter(a => {
      const dt = appPrimaryDate(a)
      return dt ? inWindow(dt) : false
    }) as ApplicationDoc[]

    const useList = source.length ? source : appsAll
    const counts: Record<string, number> = {}
    const titles: Record<string, string> = {}

    useList.forEach(a => {
      ;(a.interventions?.required || []).forEach(it => {
        const key = it.id || it.title || 'unknown'
        titles[key] = it.title || key
        counts[key] = (counts[key] || 0) + 1
      })
    })

    const pairs = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    return {
      categories: pairs.map(([id]) => titles[id] || id),
      data: pairs.map(([, n]) => n)
    }
  }, [appsAll, start, end])

  // ---------------------------- Participants (demographics & ownership) --------
  const genderPie = useMemo(() => {
    const by: Record<string, number> = {}
    participants.forEach(p => {
      const g = (p.gender || 'Unknown').toString()
      by[g] = (by[g] || 0) + 1
    })
    return Object.entries(by).map(([name, y]) => ({ name, y }))
  }, [participants])

  const beeColumn = useMemo(() => {
    const by: Record<string, number> = {}
    participants.forEach(p => {
      const lvl = (p.beeLevel || 'Unspecified').toString()
      by[lvl] = (by[lvl] || 0) + 1
    })
    const cats = Object.keys(by)
    return { categories: cats, data: cats.map(k => by[k]) }
  }, [participants])

  const hubDist = useMemo(() => {
    const by: Record<string, number> = {}
    participants.forEach(p => {
      const h = p.hub || 'Unassigned'
      by[h] = (by[h] || 0) + 1
    })
    const cats = Object.keys(by)
    return { categories: cats, data: cats.map(k => by[k]) }
  }, [participants])

  const ownershipKPIs = useMemo(() => {
    const n = participants.length || 1
    const avg = (arr: number[]) =>
      Math.round((arr.reduce((s, v) => s + (v || 0), 0) / n) * 10) / 10
    const youthGuess = participants.map(p => {
      if (typeof p.youthOwnedPercent === 'number') return p.youthOwnedPercent
      const id = p.idNumber
      if (!id || !/^\d{13}$/.test(id)) return 0
      const yy = parseInt(id.slice(0, 2), 10)
      const mm = parseInt(id.slice(2, 4), 10)
      const dd = parseInt(id.slice(4, 6), 10)
      const currYY = parseInt(dayjs().format('YY'), 10)
      const century = yy > currYY ? 1900 : 2000
      const dob = dayjs(
        `${century + yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(
          2,
          '0'
        )}`
      )
      if (!dob.isValid()) return 0
      return dayjs().diff(dob, 'year') <= 35 ? 100 : 0
    })
    const femaleGuess = participants.map(p => {
      if (typeof p.femaleOwnedPercent === 'number') return p.femaleOwnedPercent
      return (p.gender || '').toLowerCase() === 'female' ? 100 : 0
    })
    const blackGuess = participants.map(p =>
      typeof p.blackOwnedPercent === 'number' ? p.blackOwnedPercent : 0
    )
    return {
      femaleOwnedAvg: avg(femaleGuess),
      youthOwnedAvg: avg(youthGuess),
      blackOwnedAvg: avg(blackGuess)
    }
  }, [participants])

  // ---------------------------- Compliance (under Participants) ----------------
  const compliancePie = useMemo(() => {
    const map: Record<string, number> = {}
    appsAccepted.forEach(a =>
      (a.complianceDocuments || []).forEach(doc => {
        const s = (doc.status || 'pending').toLowerCase()
        const label =
          s === 'valid'
            ? 'Valid'
            : s === 'expiring'
            ? 'Expiring Soon'
            : s === 'expired'
            ? 'Expired'
            : s === 'missing'
            ? 'Missing'
            : 'Pending Review'
        map[label] = (map[label] || 0) + 1
      })
    )
    return Object.entries(map).map(([name, y]) => ({ name, y }))
  }, [appsAccepted])

  // ---------------------------- Assignments filtered to window -----------------
  const assignmentsFiltered = useMemo(
    () =>
      assignments.filter(a =>
        inWindow(a.createdAt || a.updatedAt || a.dueDate)
      ),
    [assignments, start, end]
  )

  // Interventions by Area (status-specified)
  const areaByStatus = useMemo(() => {
    const areas = new Map<
      string,
      { assigned: number; inProg: number; completed: number; cancelled: number }
    >()
    const bump = (
      area: string,
      bucket: 'assigned' | 'inProg' | 'completed' | 'cancelled'
    ) => {
      if (!areas.has(area))
        areas.set(area, { assigned: 0, inProg: 0, completed: 0, cancelled: 0 })
      const row = areas.get(area)!
      row[bucket]++
    }
    assignmentsFiltered.forEach(a => {
      const area = a.areaOfSupport || '—'
      const s = (a.status || 'assigned').toLowerCase()
      if (s === 'completed') bump(area, 'completed')
      else if (s === 'in-progress') bump(area, 'inProg')
      else if (s === 'cancelled') bump(area, 'cancelled')
      else bump(area, 'assigned')
    })
    const cats = Array.from(areas.keys()).sort()
    const get = (k: keyof ReturnType<typeof areas.get> & string) =>
      cats.map(c => (areas.get(c) as any)?.[k] || 0)
    return {
      categories: cats,
      assigned: get('assigned'),
      inProg: get('inProg'),
      completed: get('completed'),
      cancelled: get('cancelled')
    }
  }, [assignmentsFiltered])

  // Top 5 interventions (by title)
  const topInterventions = useMemo(() => {
    const by: Record<string, number> = {}
    assignmentsFiltered.forEach(a => {
      const title = a.interventionTitle || 'Untitled'
      by[title] = (by[title] || 0) + 1
    })
    return Object.entries(by)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [assignmentsFiltered])

  // Treemap (Area → Intervention Title) with clear breadcrumb
  const treemapData = useMemo(() => {
    const parents = new Map<string, number>()
    const children: Array<{
      id?: string
      name: string
      parent: string
      value: number
    }> = []
    const counts = new Map<string, number>() // area::title

    assignmentsFiltered.forEach(a => {
      const area = a.areaOfSupport || '—'
      const title = a.interventionTitle || 'Untitled'
      const k = `${area}::${title}`
      counts.set(k, (counts.get(k) || 0) + 1)
      parents.set(area, 1)
    })

    const palette = Highcharts.getOptions().colors || []
    let colorIdx = 0
    const parentNodes: any[] = Array.from(parents.keys()).map(area => ({
      id: area,
      name: area,
      color: palette[colorIdx++ % palette.length]
    }))
    counts.forEach((v, k) => {
      const [area, title] = k.split('::')
      children.push({ name: title, parent: area, value: v })
    })
    return [...parentNodes, ...children]
  }, [assignmentsFiltered])

  // ----------------------------------- CHART OPTIONS ---------------------------
  const commonDataLabel = {
    enabled: true,
    formatter (this: Highcharts.DataLabelsFormatterContextObject) {
      const y = typeof this.y === 'number' ? this.y : (this.point as any)?.y
      return y && y > 0 ? String(round(y)) : ''
    }
  }

  const pieDataLabels: Highcharts.PlotPieDataLabelsOptions = {
    enabled: true,
    distance: 18,
    connectorWidth: 0,
    softConnector: false,
    allowOverlap: false,
    style: { textOutline: 'none', fontWeight: '600' },
    formatter: function () {
      const p = this.point as Highcharts.Point & { y: number }
      return p && p.y > 0 ? `${p.name}: ${Math.round(p.y)}` : null
    }
  }

  const genderPieFiltered = useMemo(
    () => genderPie.filter(pt => (pt as any).y > 0),
    [genderPie]
  )
  const compliancePieFiltered = useMemo(
    () => compliancePie.filter(pt => (pt as any).y > 0),
    [compliancePie]
  )

  const applicationsOptions: Highcharts.Options = {
    chart: { type: 'column', backgroundColor: 'transparent' },
    title: { text: 'Applications vs Accepted' },
    xAxis: { categories: appSeries.categories },
    yAxis: { min: 0, title: { text: 'Count' } },
    tooltip: {
      shared: true,
      pointFormatter: function () {
        // @ts-ignore
        const v = round(this.y)
        return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <b>${v}</b><br/>`
      }
    },
    plotOptions: { column: { dataLabels: commonDataLabel } },
    series: [
      { name: 'Submitted', type: 'column', data: appSeries.all },
      { name: 'Accepted', type: 'column', data: appSeries.accepted }
    ],
    credits: { enabled: false }
  }

  const mostRequestedOptions: Highcharts.Options = {
    chart: { type: 'bar', backgroundColor: 'transparent' },
    title: { text: 'Most Requested Interventions' },
    xAxis: { categories: mostRequested.categories, title: { text: '' } },
    yAxis: { min: 0, title: { text: 'Requests' } },
    plotOptions: { series: { dataLabels: commonDataLabel } },
    series: [{ name: 'Requests', type: 'bar', data: mostRequested.data }],
    credits: { enabled: false }
  }

  const genderPieOptions: Highcharts.Options = {
    chart: { type: 'pie', backgroundColor: 'transparent', height: 300 },
    title: { text: 'Gender' },
    tooltip: { pointFormat: '<b>{point.y}</b>' },
    plotOptions: {
      pie: {
        innerSize: '55%',
        dataLabels: pieDataLabels,
        showInLegend: true
      }
    },
    legend: {
      labelFormatter: function () {
        // @ts-ignore
        return `${this.name} (${Math.round(this.y)})`
      }
    },
    series: [{ type: 'pie', data: genderPieFiltered }],
    credits: { enabled: false }
  }

  const compliancePieOptions: Highcharts.Options = {
    chart: { type: 'pie', backgroundColor: 'transparent', height: 320 },
    title: { text: 'Compliance Documents' },
    tooltip: { pointFormat: '<b>{point.y}</b>' },
    plotOptions: {
      pie: {
        innerSize: '45%',
        dataLabels: pieDataLabels,
        showInLegend: true
      }
    },
    legend: {
      labelFormatter: function () {
        // @ts-ignore
        return `${this.name} (${Math.round(this.y)})`
      }
    },
    series: [{ name: 'Documents', type: 'pie', data: compliancePieFiltered }],
    credits: { enabled: false }
  }

  const beeLevelOptions: Highcharts.Options = {
    chart: { type: 'column', backgroundColor: 'transparent' },
    title: { text: 'B-BBEE Level Distribution' },
    xAxis: { categories: beeColumn.categories },
    yAxis: { min: 0, title: { text: 'Participants' } },
    plotOptions: { column: { dataLabels: commonDataLabel } },
    legend: { enabled: false }, // 🔹 hide legend
    series: [{ name: 'Count', type: 'column', data: beeColumn.data }],
    credits: { enabled: false }
  }

  const hubOptions: Highcharts.Options = {
    chart: { type: 'bar', backgroundColor: 'transparent' },
    title: { text: 'Hub Distribution' },
    xAxis: { categories: hubDist.categories, title: { text: '' } },
    yAxis: { min: 0, title: { text: 'Participants' } },
    plotOptions: { series: { dataLabels: commonDataLabel } },
    legend: { enabled: false }, // 🔹 hide legend
    series: [{ name: 'Count', type: 'bar', data: hubDist.data }],
    credits: { enabled: false }
  }

  // Per-consultant status buckets (sorted by total desc)
  const consultantPerfByConsultant = useMemo(() => {
    type Buckets = {
      assigned: number
      inProg: number
      completed: number
      cancelled: number
      total: number
    }
    const map = new Map<string, Buckets>()

    const bump = (k: string, key: keyof Buckets) => {
      if (!map.has(k))
        map.set(k, {
          assigned: 0,
          inProg: 0,
          completed: 0,
          cancelled: 0,
          total: 0
        })
      const row = map.get(k)!
      // @ts-ignore
      row[key] += 1
      row.total += 1
    }

    assignmentsFiltered.forEach(a => {
      const name = (a.consultantName?.trim() ||
        a.consultantId ||
        'Unassigned') as string
      const s = (a.status || 'assigned').toLowerCase()
      if (s === 'completed') bump(name, 'completed')
      else if (s === 'in-progress') bump(name, 'inProg')
      else if (s === 'cancelled') bump(name, 'cancelled')
      else bump(name, 'assigned')
    })

    // sort by total desc then name asc
    const rows = Array.from(map.entries())
      .sort(([, A], [, B]) => B.total - A.total || 0)
      .map(([name, b]) => ({ name, ...b }))

    const categories = rows.map(r => r.name)
    return {
      categories,
      assigned: rows.map(r => r.assigned),
      inProg: rows.map(r => r.inProg),
      completed: rows.map(r => r.completed),
      cancelled: rows.map(r => r.cancelled),
      totals: rows.map(r => r.total)
    }
  }, [assignmentsFiltered])

  const consultantPerfOptions: Highcharts.Options = {
    chart: { type: 'column', backgroundColor: 'transparent' },
    title: { text: 'Consultant Performance' },
    xAxis: {
      categories: consultantPerfByConsultant.categories,
      title: { text: '' }
    },
    yAxis: { min: 0, title: { text: 'Assignments' } },
    tooltip: {
      shared: true,
      formatter: function () {
        // @ts-ignore
        const idx = this.points?.[0]?.point?.index ?? this.point?.index ?? 0
        const total = consultantPerfByConsultant.totals[idx] || 0
        const lines = (this as any).points
          ? (this as any).points
              .map(
                (p: any) =>
                  `<span style="color:${p.color}">\u25CF</span> ${
                    p.series.name
                  }: <b>${Math.round(p.y)}</b>`
              )
              .join('<br/>')
          : `<span style="color:${(this as any).color}">\u25CF</span> ${
              (this as any).series.name
            }: <b>${Math.round((this as any).y)}</b>`
        // @ts-ignore
        const name = this.x ?? consultantPerfByConsultant.categories[idx]
        return `<b>${name}</b><br/>${lines}<br/><span style="opacity:.7">Total: ${Math.round(
          total
        )}</span>`
      }
    },
    plotOptions: {
      column: {
        stacking: 'normal',
        dataLabels: commonDataLabel // your existing "only show when > 0, rounded"
      }
    },
    series: [
      {
        name: 'Assigned',
        type: 'column',
        data: consultantPerfByConsultant.assigned
      },
      {
        name: 'In-progress',
        type: 'column',
        data: consultantPerfByConsultant.inProg
      },
      {
        name: 'Completed',
        type: 'column',
        data: consultantPerfByConsultant.completed
      },
      {
        name: 'Cancelled',
        type: 'column',
        data: consultantPerfByConsultant.cancelled
      }
    ],
    credits: { enabled: false }
  }

  // Interventions by Area with explicit statuses
  const areaStatusOptions: Highcharts.Options = {
    chart: { type: 'column', backgroundColor: 'transparent' },
    title: { text: 'Interventions by Area of Support (by Status)' },
    xAxis: { categories: areaByStatus.categories },
    yAxis: { min: 0, title: { text: 'Count' } },
    plotOptions: {
      column: { stacking: 'normal', dataLabels: commonDataLabel }
    },
    series: [
      { name: 'Assigned', type: 'column', data: areaByStatus.assigned },
      { name: 'In-progress', type: 'column', data: areaByStatus.inProg },
      { name: 'Completed', type: 'column', data: areaByStatus.completed },
      { name: 'Cancelled', type: 'column', data: areaByStatus.cancelled }
    ],
    credits: { enabled: false }
  }

  const top5BarOptions: Highcharts.Options = {
    chart: { type: 'bar', backgroundColor: 'transparent' },
    title: { text: 'Top 5 Interventions' },
    xAxis: { categories: topInterventions.map(([t]) => t) },
    yAxis: { min: 0, title: { text: 'Count' } },
    plotOptions: { series: { dataLabels: commonDataLabel } },
    series: [
      {
        name: 'Delivered',
        type: 'bar',
        data: topInterventions.map(([, n]) => n)
      }
    ],
    credits: { enabled: false }
  }

  // Ownership composition chart
  const ownershipOptions: Highcharts.Options = {
    chart: { type: 'bar', backgroundColor: 'transparent', height: 260 },
    title: { text: 'Ownership Composition (%)' },
    xAxis: {
      categories: ['Female-Owned', 'Youth-Owned', 'Black-Owned'],
      title: { text: '' }
    },
    yAxis: {
      min: 0,
      max: 100,
      title: { text: 'Average %' },
      labels: { format: '{value}%' }
    },
    legend: { enabled: false },
    tooltip: {
      pointFormat: '<b>{point.y}%</b>'
    },
    plotOptions: {
      series: {
        borderRadius: 4,
        dataLabels: {
          enabled: true,
          format: '{point.y:.0f}%',
          style: { fontWeight: '600', textOutline: 'none' }
        }
      }
    },
    series: [
      {
        name: 'Ownership %',
        type: 'bar',
        colorByPoint: true,
        data: [
          ownershipKPIs.femaleOwnedAvg,
          ownershipKPIs.youthOwnedAvg,
          ownershipKPIs.blackOwnedAvg
        ]
      }
    ],
    credits: { enabled: false }
  }

  const treemapOptions: Highcharts.Options = {
    chart: { backgroundColor: 'transparent' },
    title: { text: 'Interventions by Area (Treemap)', align: 'left' },
    // Make breadcrumb show the parent Area of Support (not "Series 1")
    // Highcharts treemap uses breadcrumb; ensure proper label
    // @ts-ignore
    breadcrumb: { showFullPath: true, format: '{point.name}' },
    series: [
      {
        name: 'Area of Support',
        type: 'treemap',
        layoutAlgorithm: 'squarified',
        allowTraversingTree: true,
        alternateStartingDirection: true,
        data: treemapData,
        dataLabels: { enabled: true },
        // Make sure level shows area names clearly
        levels: [{ level: 1, dataLabels: { enabled: true } }]
      } as any
    ],
    credits: { enabled: false }
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      <Helmet>
        <title>Operations Reports</title>
      </Helmet>

      <DashboardHeaderCard
        title='Reports & Analytics'
        subtitle='Company-scoped real-time analytics.'
        extraRight={
          <Space wrap>
            <Segmented<SegmentKey>
              value={segment}
              onChange={v => setSegment(v as SegmentKey)}
              options={[
                'Applications',
                'Participants',
                'Consultants Performance',
                'Interventions Overview'
              ]}
            />
            <Select<TimeBucket>
              value={period}
              onChange={setPeriod}
              style={{ width: 150 }}
              options={[
                { value: 'week', label: 'Weekly' },
                { value: 'month', label: 'Monthly' },
                { value: 'quarter', label: 'Quarterly' },
                { value: 'year', label: 'Yearly' },
                { value: 'custom', label: 'Custom' }
              ]}
            />
            {period === 'custom' && (
              <RangePicker
                value={[start, end]}
                onChange={d => {
                  if (d && d[0] && d[1]) setRange([d[0], d[1]])
                }}
                allowClear={false}
              />
            )}
          </Space>
        }
      />

      {/* APPLICATIONS */}
      {segment === 'Applications' && (
        <>
          <MotionCard style={{ marginTop: 12 }} loading={loading}>
            <HighchartsReact
              highcharts={Highcharts}
              options={applicationsOptions}
            />
          </MotionCard>

          <MotionCard style={{ marginTop: 12 }} loading={loading}>
            <HighchartsReact
              highcharts={Highcharts}
              options={mostRequestedOptions}
            />
          </MotionCard>
        </>
      )}

      {/* PARTICIPANTS */}
      {segment === 'Participants' && (
        <>
          <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
            <Col xs={24} md={8}>
              <MotionCard>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={ownershipOptions}
                />
              </MotionCard>
            </Col>

            <Col xs={24} md={8}>
              <MotionCard>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={genderPieOptions}
                />
              </MotionCard>
            </Col>
            <Col xs={24} md={8}>
              <MotionCard>
                <HighchartsReact highcharts={Highcharts} options={hubOptions} />
              </MotionCard>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
            <Col xs={24} md={12}>
              <MotionCard>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={beeLevelOptions}
                />
              </MotionCard>
            </Col>
            <Col xs={24} md={12}>
              <MotionCard>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={compliancePieOptions}
                />
              </MotionCard>
            </Col>
          </Row>
        </>
      )}

      {/* CONSULTANTS PERFORMANCE (stacked by area status for now) */}
      {segment === 'Consultants Performance' && (
        <MotionCard style={{ marginTop: 12 }} loading={loading}>
          <HighchartsReact
            highcharts={Highcharts}
            options={consultantPerfOptions}
          />
        </MotionCard>
      )}

      {/* INTERVENTIONS OVERVIEW */}
      {segment === 'Interventions Overview' && (
        <>
          <MotionCard style={{ marginTop: 12 }} loading={loading}>
            <HighchartsReact
              highcharts={Highcharts}
              options={areaStatusOptions}
            />
          </MotionCard>

          <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
            <Col xs={24} md={12}>
              <MotionCard>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={top5BarOptions}
                />
              </MotionCard>
            </Col>
            <Col xs={24} md={12}>
              <MotionCard>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={treemapOptions}
                />
              </MotionCard>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}

export default OperationsReports
