import React, { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  List,
  Tag,
  Space,
  Button,
  Timeline,
  Badge,
  Modal,
  Form,
  message,
  Layout,
  Alert,
  Descriptions,
  Calendar,
  Select
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ScheduleOutlined,
  FileTextOutlined,
  TeamOutlined,
  BellOutlined,
  ArrowRightOutlined,
  FullscreenOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { db } from '@/firebase'
import {
  collection,
  getDocs,
  setDoc,
  doc,
  Timestamp,
  where,
  query
} from 'firebase/firestore'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import dayjs from 'dayjs'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { EventModal } from '@/components/op-dashboard/EventModal'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import HighchartsMore from 'highcharts/highcharts-more'
import HighchartsAccessibility from 'highcharts/modules/accessibility'
import NoData from 'highcharts/modules/no-data-to-display'
import { motion } from 'framer-motion'

if (typeof HighchartsMore === 'function') HighchartsMore(Highcharts)
if (typeof HighchartsAccessibility === 'function')
  HighchartsAccessibility(Highcharts)
if (typeof NoData === 'function') NoData(Highcharts)

const { Text, Title } = Typography

const cardStyle: React.CSSProperties = {
  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
  transition: 'all 0.3s ease',
  borderRadius: 8,
  border: '1px solid #d6e4ff'
}

const MotionCard: React.FC<React.ComponentProps<typeof Card>> = ({
  children,
  style,
  ...rest
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    <Card {...rest} style={{ ...cardStyle, ...(style || {}) }}>
      {children}
    </Card>
  </motion.div>
)

/** Helpers */
const normRole = (r: any) =>
  String(r || '')
    .toLowerCase()
    .replace(/\s+/g, '')
const isOverdue = (item: any) => {
  const due = item.dueDate?.toDate
    ? item.dueDate.toDate()
    : new Date(item.dueDate)
  return item.status !== 'Completed' && dayjs(due).isBefore(dayjs())
}
const lastMonths = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    dayjs()
      .subtract(n - 1 - i, 'month')
      .format('MMM')
  )
const spark = (data: number[], categories: string[]): Highcharts.Options => ({
  chart: {
    type: 'areaspline',
    height: 80,
    backgroundColor: 'transparent',
    margin: [4, 0, 8, 0]
  },
  title: { text: undefined },
  xAxis: {
    categories,
    tickLength: 0,
    lineWidth: 0,
    labels: { style: { fontSize: '10px', color: '#86909c' } }
  },
  yAxis: { visible: false },
  legend: { enabled: false },
  credits: { enabled: false },
  tooltip: {
    pointFormat: '<b>{point.y}</b>',
    headerFormat: '<span>{point.key}</span><br/>'
  },
  plotOptions: {
    areaspline: { marker: { enabled: false }, fillOpacity: 0.2, lineWidth: 2 }
  },
  series: [{ type: 'areaspline', data }]
})

export const OperationsDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useFullIdentity()
  const companyCode = user?.companyCode

  // core data
  const [participants, setParticipants] = useState<any[]>([])
  const [consultants, setConsultants] = useState<any[]>([])
  const [projectAdmins, setProjectAdmins] = useState<any[]>([])
  const [operationsUsers, setOperationsUsers] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [interventions, setInterventions] = useState<any[]>([])
  const [complianceDocuments, setComplianceDocuments] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)

  // modals / forms
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)
  const [eventDetailModalOpen, setEventDetailModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [expandOpen, setExpandOpen] = useState<{
    open: boolean
    which?: 'workload' | 'compliance' | 'tasks'
  }>({ open: false })
  const [eventForm] = Form.useForm()

  /** Fetch everything from Firestore (no dummies) */
  useEffect(() => {
    if (!companyCode) return
    const toArr = (snap: any) =>
      snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))

    const fetchAll = async () => {
      try {
        setAppointmentsLoading(true)

        // Users (single fetch, then split by role)
        const usersSnap = await getDocs(
          query(
            collection(db, 'users'),
            where('companyCode', '==', companyCode)
          )
        )
        const allUsers = toArr(usersSnap)
        setConsultants(allUsers.filter(u => normRole(u.role) === 'consultant'))
        setProjectAdmins(
          allUsers.filter(u => normRole(u.role) === 'projectadmin')
        )
        setOperationsUsers(
          allUsers.filter(u => normRole(u.role) === 'operations')
        )

        // Participants: accepted applications -> shape to {id,name,email} for EventModal

        const appsSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('applicationStatus', '==', 'accepted'),
            where('companyCode', '==', companyCode)
          )
        )

        const apps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        setParticipants(apps)

        // flatten complianceDocuments from each application
        const complianceFlat = apps.flatMap(app => {
          const docs = Array.isArray(app.complianceDocuments)
            ? app.complianceDocuments
            : []
          return docs.map((doc: any) => ({
            ...doc,
            // helpful context for UI
            applicationId: app.id,
            participantName:
              app.beneficiaryName ||
              app.companyName ||
              app.applicantName ||
              app.email,
            participantEmail: app.email,
            status: String(doc?.status || '').toLowerCase()
          }))
        })
        setComplianceDocuments(complianceFlat)

        // Other collections
        const [tasksSnap, intsSnap, apptSnap, notifSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'tasks'),
              where('companyCode', '==', companyCode)
            )
          ),
          getDocs(
            query(
              collection(db, 'assignedInterventions'),
              where('companyCode', '==', companyCode)
            )
          ),
          getDocs(
            query(
              collection(db, 'appointments'),
              where('companyCode', '==', companyCode)
            )
          ),

          getDocs(
            query(
              collection(db, 'notifications'),
              where('companyCode', '==', companyCode)
            )
          )
        ])

        setTasks(toArr(tasksSnap))
        setInterventions(toArr(intsSnap))
        setAppointments(toArr(apptSnap))
        setNotifications(toArr(notifSnap))
      } catch (e) {
        console.error('Dashboard load failed:', e)
        message.error('Failed to load some data.')
      } finally {
        setAppointmentsLoading(false)
      }
    }

    fetchAll()
  }, [companyCode])

  useEffect(() => {
    if (!user?.companyCode) return

    const fetchEvents = async () => {
      try {
        const q = query(
          collection(db, 'events'),
          where('companyCode', '==', user?.companyCode)
        )
        const snapshot = await getDocs(q)
        const eventList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setEvents(eventList)
      } catch (error) {
        console.error('Error fetching events:', error)
      }
    }
    fetchEvents()
  }, [user?.companyCode])

  /** KPIs & charts */
  const tasksPending = tasks.filter(
    t => t.status !== 'Completed' && !isOverdue(t)
  ).length
  const tasksCompleted = tasks.filter(t => t.status === 'Completed').length
  const tasksOverdue = tasks.filter(t => isOverdue(t)).length

  const intsPending = interventions.filter(
    i => i.status !== 'Completed' && !isOverdue(i)
  ).length
  const intsCompleted = interventions.filter(
    i => i.status === 'Completed'
  ).length
  const intsOverdue = interventions.filter(i => isOverdue(i)).length

  const totalInterventions = intsPending + intsCompleted + intsOverdue
  const completionRate = totalInterventions
    ? Math.round((intsCompleted / totalInterventions) * 100)
    : 0

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />
      case 'deadline':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'event':
        return <CalendarOutlined style={{ color: '#52c41a' }} />
      case 'workshop':
        return <FileTextOutlined style={{ color: '#722ed1' }} />
      default:
        return <CalendarOutlined style={{ color: '#1890ff' }} />
    }
  }

  const upToDate = complianceDocuments.filter(d => d.status === 'valid').length
  const needsReview = complianceDocuments.filter(
    d => d.status === 'expiring'
  ).length
  const overdueDocs = complianceDocuments.filter(d =>
    ['expired', 'missing', 'pending'].includes(d.status)
  ).length

  // --- time helpers ---
  const toDayjs = (val: any) => {
    if (!val) return null
    const d = typeof val?.toDate === 'function' ? val.toDate() : val
    const dj = dayjs(d)
    return dj.isValid() ? dj : null
  }

  const normalizeUrl = (u?: string) =>
    u && !/^(https?:)?\/\//i.test(u) ? `https://${u}` : u

  const formatTimeRange = (start: any, end: any) => {
    const s = toDayjs(start)
    const e = toDayjs(end)
    if (!s) return 'N/A'
    if (!e) return s.format('HH:mm')

    const mins = Math.max(0, e.diff(s, 'minute'))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    const dur = h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`

    return `${s.format('HH:mm')} – ${e.format('HH:mm')} (${dur})`
  }

  // Monday -> Sunday of the *current* week (no plugins needed)
  const getWeekBounds = () => {
    const today = dayjs()
    const monday = today.startOf('day').subtract((today.day() + 6) % 7, 'day')
    const sunday = monday.add(6, 'day').endOf('day')
    return { monday, sunday }
  }

  const eventStart = (e: any) =>
    e?.startTime?.toDate
      ? dayjs(e.startTime.toDate())
      : e?.startTime
      ? dayjs(e.startTime)
      : e?.date
      ? dayjs(e.date)
      : null

  const eventsThisWeek = useMemo(() => {
    const { monday, sunday } = getWeekBounds()
    const lo = monday.valueOf()
    const hi = sunday.valueOf()

    return events
      .map((e: any) => ({ e, d: eventStart(e) }))
      .filter(({ d }) => d && d.isValid())
      .filter(({ d }) => {
        const t = d!.valueOf()
        return t >= lo && t <= hi
      })
      .sort((a, b) => a.d!.valueOf() - b.d!.valueOf())
      .map(({ e }) => e)
  }, [events])

  // helper: month buckets + labels
  const monthBuckets = (months = 8) => {
    const starts = Array.from({ length: months }, (_, i) =>
      dayjs()
        .startOf('month')
        .subtract(months - 1 - i, 'month')
    )
    return {
      keys: starts.map(d => d.format('YYYY-MM')),
      labels: starts.map(d => d.format('MMM'))
    }
  }

  const { keys: MONTH_KEYS_8, labels: MONTH_CATS_8 } = monthBuckets(8)

  // --- helpers to build month series from live data ---
  const MONTHS_BACK = 8

  const monthKeys = useMemo(() => {
    // ex: ['2025-02','2025-03',...,'2025-09']
    return Array.from({ length: MONTHS_BACK }, (_, i) =>
      dayjs()
        .subtract(MONTHS_BACK - 1 - i, 'month')
        .format('YYYY-MM')
    )
  }, [])

  const monthLabels = useMemo(
    () => monthKeys.map(k => dayjs(k + '-01').format('MMM')),
    [monthKeys]
  )

  function toDate (val: any): Date | null {
    if (!val) return null
    if (typeof val?.toDate === 'function') return val.toDate()
    try {
      return new Date(val)
    } catch {
      return null
    }
  }

  function bucketCount<T> (
    items: T[],
    getDate: (x: T) => Date | null,
    include: (x: T) => boolean = () => true
  ): number[] {
    const counts = Object.fromEntries(monthKeys.map(k => [k, 0]))
    for (const it of items) {
      if (!include(it)) continue
      const d = getDate(it)
      if (!d) continue
      const key = dayjs(d).format('YYYY-MM')
      if (key in counts) counts[key] += 1
    }
    return monthKeys.map(k => counts[k])
  }

  // open tasks per (due) month
  const sparkTasks = useMemo(() => {
    const series = bucketCount(
      tasks,
      t => toDate((t as any).dueDate),
      t => String((t as any).status).toLowerCase() !== 'completed'
    )
    return spark(series, monthLabels)
  }, [tasks, monthLabels])

  // new participants per month (dateAccepted > createdAt > created_on > applicationDate)
  const sparkParticipants = useMemo(() => {
    const series = bucketCount(
      participants,
      p =>
        toDate((p as any).dateAccepted) ||
        toDate((p as any).createdAt) ||
        toDate((p as any).created_on) ||
        toDate((p as any).submittedAt)
    )
    return spark(series, monthLabels)
  }, [participants, monthLabels])

  // overdue (tasks + interventions) per month (by dueDate and not completed, and overdue relative to now)
  const sparkOverdue = useMemo(() => {
    const all = [...tasks, ...interventions]
    const series = bucketCount(
      all,
      i => toDate((i as any).dueDate),
      i => {
        const status = String((i as any).status).toLowerCase()
        const d = toDate((i as any).dueDate)
        return status !== 'completed' && !!d && dayjs(d).isBefore(dayjs())
      }
    )
    return spark(series, monthLabels)
  }, [tasks, interventions, monthLabels])

  // monthly completion rate for interventions: completed / total in month (0 if no data)
  // NOTE: grouped by dueDate; swap to createdAt if that's your definition
  const sparkCompletion = useMemo(() => {
    const totals = bucketCount(interventions, i => toDate((i as any).dueDate))
    const completed = bucketCount(
      interventions,
      i => toDate((i as any).dueDate),
      i => String((i as any).status).toLowerCase() === 'completed'
    )
    const pct = totals.map((t, idx) =>
      t ? Math.round((completed[idx] / t) * 100) : 0
    )
    return spark(pct, monthLabels)
  }, [interventions, monthLabels])

  const CHART_HEIGHT = 320
  const buildPillTimeChartOptions = (
    tasks: any[],
    interventions: any[],
    months = 6
  ): Highcharts.Options => {
    // Build month buckets (first day of each month)
    const monthStarts = Array.from({ length: months }, (_, i) =>
      dayjs()
        .startOf('month')
        .subtract(months - 1 - i, 'month')
    )
    const monthKeys = monthStarts.map(d => d.valueOf())

    // Init counters
    const makeZeroMap = () =>
      Object.fromEntries(monthKeys.map(k => [k, 0])) as Record<number, number>

    const counts = {
      tasks: {
        pending: makeZeroMap(),
        completed: makeZeroMap(),
        overdue: makeZeroMap()
      },
      interventions: {
        pending: makeZeroMap(),
        completed: makeZeroMap(),
        overdue: makeZeroMap()
      }
    }

    const getDate = (item: any): dayjs.Dayjs | null => {
      const raw =
        (item?.dueDate?.toDate ? item.dueDate.toDate() : item?.dueDate) ||
        (item?.createdAt?.toDate ? item.createdAt.toDate() : item?.createdAt)
      return raw ? dayjs(raw) : null
    }

    const bucketKeyFor = (d: dayjs.Dayjs | null) => {
      if (!d) return null
      const start = d.startOf('month').valueOf()
      return monthKeys.includes(start) ? start : null
    }

    const bump = (
      which: 'tasks' | 'interventions',
      status: 'pending' | 'completed' | 'overdue',
      key: number
    ) => {
      counts[which][status][key] += 1
    }

    const mark = (item: any, which: 'tasks' | 'interventions') => {
      const d = getDate(item)
      const key = bucketKeyFor(d)
      if (key == null) return
      const done = String(item.status || '').toLowerCase() === 'completed'
      const overdue =
        !done &&
        (() => {
          const due = item?.dueDate?.toDate
            ? item.dueDate.toDate()
            : item?.dueDate
          return due ? dayjs(due).isBefore(dayjs()) : false
        })()

      if (done) bump(which, 'completed', key)
      else if (overdue) bump(which, 'overdue', key)
      else bump(which, 'pending', key)
    }

    tasks.forEach(t => mark(t, 'tasks'))
    interventions.forEach(i => mark(i, 'interventions'))

    // Series (two stacks per month: tasks + interventions)
    const S = [
      {
        name: 'Pending (Tasks)',
        stack: 'tasks',
        color: '#faad14',
        data: monthKeys.map(k => [k, counts.tasks.pending[k]])
      },
      {
        name: 'Completed (Tasks)',
        stack: 'tasks',
        color: '#52c41a',
        data: monthKeys.map(k => [k, counts.tasks.completed[k]])
      },
      {
        name: 'Overdue (Tasks)',
        stack: 'tasks',
        color: '#ff4d4f',
        data: monthKeys.map(k => [k, counts.tasks.overdue[k]])
      },
      {
        name: 'Pending (Interventions)',
        stack: 'interventions',
        color: '#ffd666',
        data: monthKeys.map(k => [k, counts.interventions.pending[k]])
      },
      {
        name: 'Completed (Interventions)',
        stack: 'interventions',
        color: '#95de64',
        data: monthKeys.map(k => [k, counts.interventions.completed[k]])
      },
      {
        name: 'Overdue (Interventions)',
        stack: 'interventions',
        color: '#ff7875',
        data: monthKeys.map(k => [k, counts.interventions.overdue[k]])
      }
    ] as const

    const hasAnyData = S.some(ser => ser.data.some(([, y]) => y > 0))

    return {
      lang: { noData: 'No data for the selected period' },
      noData: { style: { fontSize: '14px', color: '#8c8c8c' } },
      chart: {
        type: 'column',
        height: 320,
        backgroundColor: 'transparent'
      },
      title: { text: 'Tasks vs Interventions (last 6 months)' },
      credits: { enabled: false },
      legend: { itemDistance: 8 },
      xAxis: {
        type: 'datetime',
        tickInterval: 1000 * 60 * 60 * 24 * 30, // ~1 month
        min: monthKeys[0],
        max: dayjs(monthStarts[monthStarts.length - 1])
          .endOf('month')
          .valueOf(),
        labels: { format: '{value:%b}' }
      },
      yAxis: {
        title: { text: 'Count' },
        gridLineWidth: 0,
        min: 0,
        allowDecimals: false,
        stackLabels: {
          enabled: true,
          style: { fontWeight: 'bold', color: '#666' }
        }
      },
      tooltip: {
        shared: true,
        xDateFormat: '%B %Y'
      },
      plotOptions: {
        column: {
          stacking: 'normal',
          grouping: true,
          groupPadding: 0.08,
          pointPadding: 0.05,
          pointWidth: 16,
          borderWidth: 0,
          borderRadius: 999 // pill shape
        },
        series: {
          animation: { duration: 400 }
        }
      },
      // If nothing to show, return empty series so the no-data module kicks in
      series: hasAnyData
        ? S.map(s => ({
            type: 'column',
            name: s.name,
            data: s.data,
            stack: s.stack,
            color: s.color
          }))
        : []
    }
  }

  const tasksVsInterventionsChart = useMemo(
    () => buildPillTimeChartOptions(tasks, interventions, 6),
    [tasks, interventions]
  )

  // Build points and drop zeros so they don't appear in labels/legend
  const compliancePoints = [
    { name: 'Valid', y: upToDate, color: '#52c41a' },
    { name: 'Expiring', y: needsReview, color: '#faad14' },
    { name: 'Overdue', y: overdueDocs, color: '#ff4d4f' }
  ].filter(p => (Number(p.y) || 0) > 0)

  const complianceDonut: Highcharts.Options = {
    lang: { noData: 'No compliance data to display' },
    noData: { style: { fontSize: '14px', color: '#8c8c8c' } },

    chart: {
      type: 'pie',
      height: CHART_HEIGHT,
      backgroundColor: 'transparent'
    },
    title: { text: 'Compliance Overview' },
    credits: { enabled: false },

    legend: {
      enabled: true,
      align: 'center',
      verticalAlign: 'bottom'
      // No need for labelFormatter because zero slices are filtered out
    },

    tooltip: { pointFormat: '<b>{point.y}</b>' },

    plotOptions: {
      series: {
        // Smooth in + animate updates
        animation: { duration: 700 }
      },
      pie: {
        innerSize: '60%',
        showInLegend: true,
        // Only render labels for non-zero points (extra safety)
        dataLabels: {
          enabled: true,
          distance: 20,
          style: {
            fontSize: '12px',
            textOutline: 'none',
            color: '#1f2937',
            fontWeight: 500
          },
          filter: { property: 'y', operator: '>', value: 0 },
          formatter: function () {
            return `${this.point.name}: ${this.y}`
          }
        },
        // Nice “grow” effect on first render
        animation: { duration: 700 }
      }
    },

    // If everything is zero, return an empty series to trigger the no-data message
    series: compliancePoints.length
      ? [{ type: 'pie', data: compliancePoints }]
      : []
  }

  // count open (not Completed) by dueDate month
  const countOpenByMonth = (items: any[], keys: string[]) => {
    const map = Object.fromEntries(keys.map(k => [k, 0])) as Record<
      string,
      number
    >
    for (const it of items) {
      const dueRaw = it?.dueDate?.toDate ? it.dueDate.toDate() : it?.dueDate
      if (!dueRaw) continue
      const monthKey = dayjs(dueRaw).startOf('month').format('YYYY-MM')
      if (!keys.includes(monthKey)) continue
      const isCompleted = String(it.status || '').toLowerCase() === 'completed'
      if (!isCompleted) map[monthKey]++
    }
    return keys.map(k => map[k])
  }

  const dataTasksOpen = useMemo(
    () => countOpenByMonth(tasks, MONTH_KEYS_8),
    [tasks]
  )
  const dataIntsOpen = useMemo(
    () => countOpenByMonth(interventions, MONTH_KEYS_8),
    [interventions]
  )

  const workloadTrend: Highcharts.Options = {
    lang: { noData: 'No data for the selected period' },
    noData: { style: { fontSize: '14px', color: '#8c8c8c' } },
    chart: {
      type: 'areaspline',
      height: CHART_HEIGHT,
      backgroundColor: 'transparent'
    },
    title: { text: 'Workload Trend (last 8 months)' },
    credits: { enabled: false },
    xAxis: { categories: MONTH_CATS_8 },
    yAxis: { title: { text: 'Open Items' }, min: 0, allowDecimals: false },
    tooltip: { shared: true },
    plotOptions: {
      areaspline: { marker: { enabled: false }, fillOpacity: 0.2 },
      series: { animation: { duration: 400 } }
    },
    series:
      dataTasksOpen.some(v => v > 0) || dataIntsOpen.some(v => v > 0)
        ? [
            { name: 'Tasks (open)', type: 'areaspline', data: dataTasksOpen },
            {
              name: 'Interventions (open)',
              type: 'areaspline',
              data: dataIntsOpen
            }
          ]
        : [] // triggers the no-data message
  }

  /** Events */

  const handleEventClick = (event: any) => {
    const eventData = events.find(e => e.id === event.id)
    setSelectedEvent(eventData)
    setEventDetailModalOpen(true)
  }
  const handleAddEvent = async (values: any) => {
    const eventDate = dayjs(values.date).format('YYYY-MM-DD')
    const start = dayjs(values.startTime)
    const end = dayjs(values.endTime)
    if (!start.isValid() || !end.isValid())
      return message.error('Please select a valid start and end time.')
    if (start.hour() < 6 || end.hour() > 18 || end.isBefore(start))
      return message.error(
        'Event time must be between 06:00 and 18:00, and end after start.'
      )

    const newId = `event-${Date.now()}`
    const newEvent = {
      id: newId,
      title: values.title,
      date: eventDate,
      startTime: Timestamp.fromDate(start.toDate()),
      endTime: Timestamp.fromDate(end.toDate()),
      type: values.eventType,
      format: values.format,
      location: values.location || '',
      link: values.link || '',
      description: values.description || '',
      participants: values.participants || [],
      createdAt: Timestamp.now(),
      companyCode
    }

    try {
      if (companyCode) await setDoc(doc(db, 'events', newId), newEvent)
      setEvents(prev => [...prev, newEvent])
      message.success('Event added successfully')
      setEventModalOpen(false)
      eventForm.resetFields()
    } catch {
      message.error('Failed to add event')
    }
  }

  // Group events by YYYY-MM-DD for fast lookup
  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const ev of events) {
      const key = dayjs(ev.date).format('YYYY-MM-DD')
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    return map
  }, [events])

  // Date cell renderer for AntD Calendar
  const dateCellRender = (date: dayjs.Dayjs) => {
    const key = date.format('YYYY-MM-DD')
    const items = eventsByDate[key] || []
    if (!items.length) return null

    const maxToShow = 3
    const visible = items.slice(0, maxToShow)
    const remaining = items.length - visible.length

    const statusFor = (type?: string): any =>
      type === 'deadline'
        ? 'error'
        : type === 'meeting'
        ? 'processing'
        : type === 'workshop'
        ? 'success'
        : 'warning'

    return (
      <Space direction='vertical' size={4} style={{ width: '100%' }}>
        {visible.map(ev => (
          <div
            key={ev.id}
            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <Badge status={statusFor(ev.type)} />
            <Button
              type='link'
              style={{
                padding: 0,
                height: 'auto',
                lineHeight: 1.2,
                flex: 1,
                textAlign: 'left',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              onClick={() => {
                setSelectedEvent(ev)
                setEventDetailModalOpen(true)
              }}
            >
              {ev.title}
            </Button>
          </div>
        ))}
        {remaining > 0 && (
          <Text type='secondary' style={{ fontSize: 12 }}>
            +{remaining} more
          </Text>
        )}
      </Space>
    )
  }

  /** Render */
  return (
    <Layout style={{ minHeight: '100vh', background: '#f7faff' }}>
      <Helmet>
        <title>Operations Dashboard</title>
        <meta
          name='description'
          content='Manage daily operations and track incubatee progress'
        />
      </Helmet>

      {/* Hero */}
      <div style={{ padding: 24, paddingBottom: 0 }}>
        <MotionCard
          style={{ background: 'linear-gradient(90deg,#eef4ff, #f9fbff)' }}
        >
          <Row align='middle' justify='space-between'>
            <Col>
              <Title level={4} style={{ marginBottom: 0 }}>
                Operations Overview
              </Title>
              <Text type='secondary'>
                Stay on top of tasks, interventions, compliance and events.
              </Text>
            </Col>
            <Col>
              <Space>
                <Button
                  type='primary'
                  icon={<CalendarOutlined />}
                  onClick={() => setEventModalOpen(true)}
                >
                  Add Event
                </Button>
                <Button onClick={() => setCalendarModalOpen(true)}>
                  Open Calendar
                </Button>
              </Space>
            </Col>
          </Row>
        </MotionCard>
      </div>

      <div style={{ padding: 24 }}>
        {/* KPI row with sparklines */}
        <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
          <Col xs={24} sm={12} md={6}>
            <MotionCard>
              <Space direction='vertical' style={{ width: '100%' }}>
                <Statistic
                  title='Pending Tasks'
                  value={tasksPending}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
                <HighchartsReact highcharts={Highcharts} options={sparkTasks} />
              </Space>
            </MotionCard>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <MotionCard>
              <Space direction='vertical' style={{ width: '100%' }}>
                <Statistic
                  title='Active Participants'
                  value={participants.length}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
                <HighchartsReact
                  highcharts={Highcharts}
                  options={sparkParticipants}
                />
              </Space>
            </MotionCard>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <MotionCard>
              <Space direction='vertical' style={{ width: '100%' }}>
                <Statistic
                  title='Overdue Items'
                  value={tasksOverdue + intsOverdue}
                  prefix={<ExclamationCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
                <HighchartsReact
                  highcharts={Highcharts}
                  options={sparkOverdue}
                />
              </Space>
            </MotionCard>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <MotionCard>
              <Space direction='vertical' style={{ width: '100%' }}>
                <Statistic
                  title='Completion Rate'
                  value={completionRate}
                  suffix='%'
                  valueStyle={{ color: '#52c41a' }}
                />
                <HighchartsReact
                  highcharts={Highcharts}
                  options={sparkCompletion}
                />
              </Space>
            </MotionCard>
          </Col>
        </Row>

        {/* Visual row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
          <Col xs={24} lg={14}>
            <MotionCard
              title='Workload Trend'
              extra={
                <Button
                  icon={<FullscreenOutlined />}
                  onClick={() =>
                    setExpandOpen({ open: true, which: 'workload' })
                  }
                >
                  Expand
                </Button>
              }
            >
              <HighchartsReact
                highcharts={Highcharts}
                options={workloadTrend}
              />
            </MotionCard>
          </Col>
          <Col xs={24} lg={10}>
            <MotionCard
              title={
                <Space>
                  <ScheduleOutlined />
                  <span>Upcoming Events</span>
                </Space>
              }
              extra={
                <Button
                  type='link'
                  style={{ padding: 0 }}
                  onClick={() => setCalendarModalOpen(true)}
                  icon={<CalendarOutlined />}
                  iconPosition='end'
                >
                  View Full Calendar
                </Button>
              }
            >
              <Timeline mode='left'>
                {eventsThisWeek.length === 0 ? (
                  <Text type='secondary'>No events this week</Text>
                ) : (
                  eventsThisWeek.map((event, index) => {
                    const fmt = String(event.format || '').toLowerCase()
                    const hasLink = !!event.link
                    const hasLoc = !!event.location

                    return (
                      <Timeline.Item
                        key={event.id || index}
                        dot={getEventIcon(event.type)}
                      >
                        <Text strong>
                          {event.date} - {event.title}
                        </Text>
                        <br />
                        <Space wrap>
                          <Text type='secondary'>
                            Time:{' '}
                            {formatTimeRange(event.startTime, event.endTime)}
                          </Text>
                          <Tag color='blue'>{event.format}</Tag>
                          <Tag color='green'>{event.type}</Tag>
                        </Space>

                        {/* Location / Link based on format */}
                        {(fmt === 'in-person' || fmt === 'hybrid') && hasLoc && (
                          <>
                            <br />
                            <Text type='secondary'>
                              Location: {event.location}
                            </Text>
                          </>
                        )}

                        {(fmt === 'virtual' || fmt === 'hybrid') && hasLink && (
                          <>
                            <br />
                            <Button
                              type='link'
                              href={normalizeUrl(event.link)}
                              target='_blank'
                              rel='noopener noreferrer'
                              style={{ padding: 0 }}
                            >
                              Join Now
                            </Button>
                          </>
                        )}

                        {event.participants?.length > 0 && (
                          <>
                            <br />
                            <Text type='secondary'>
                              Participants: {event.participants.length}
                            </Text>
                          </>
                        )}
                      </Timeline.Item>
                    )
                  })
                )}
              </Timeline>
            </MotionCard>
          </Col>
        </Row>

        {/* Lists & stacked chart */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            {' '}
            <MotionCard
              title='Compliance'
              extra={
                <Button
                  icon={<FullscreenOutlined />}
                  onClick={() =>
                    setExpandOpen({ open: true, which: 'compliance' })
                  }
                >
                  Expand
                </Button>
              }
            >
              <HighchartsReact
                highcharts={Highcharts}
                options={complianceDonut}
              />
            </MotionCard>
          </Col>

          <Col xs={24} lg={12}>
            <MotionCard
              title='Tasks vs Interventions'
              extra={
                <Button
                  icon={<FullscreenOutlined />}
                  onClick={() => setExpandOpen({ open: true, which: 'tasks' })}
                >
                  Expand
                </Button>
              }
            >
              <HighchartsReact
                highcharts={Highcharts}
                options={tasksVsInterventionsChart}
              />
            </MotionCard>
          </Col>
        </Row>
      </div>

      {/* Add Event (now with ALL roles passed) */}
      <EventModal
        open={eventModalOpen}
        onCancel={() => setEventModalOpen(false)}
        onSubmit={handleAddEvent}
        form={eventForm}
        consultants={consultants}
        projectAdmins={projectAdmins}
        operationsUsers={operationsUsers}
        participants={participants}
      />

      {/* Calendar Modal */}
      <Modal
        title='Full Calendar View'
        open={calendarModalOpen}
        onCancel={() => setCalendarModalOpen(false)}
        footer={null}
        width={1200}
      >
        <Calendar
          mode='month'
          headerRender={({ value, onChange }) => {
            const cur = value.clone()
            const monthOptions = Array.from({ length: 12 }, (_, i) => ({
              label: dayjs().month(i).format('MMM'),
              value: i
            }))

            return (
              <Row
                align='middle'
                justify='space-between'
                style={{ padding: '8px 16px' }}
              >
                {/* Left: current month + year */}
                <Col>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>
                    {cur.format('MMMM YYYY')}
                  </div>
                </Col>

                {/* Right: month select + prev/next */}
                <Col>
                  <Space>
                    <Select
                      size='small'
                      value={cur.month()}
                      options={monthOptions}
                      dropdownMatchSelectWidth={false}
                      onChange={m => onChange(cur.clone().month(m))}
                      style={{ width: 100 }}
                    />
                    <Button
                      type='text'
                      icon={<LeftOutlined />}
                      onClick={() => onChange(cur.clone().subtract(1, 'month'))}
                    />
                    <Button
                      type='text'
                      icon={<RightOutlined />}
                      onClick={() => onChange(cur.clone().add(1, 'month'))}
                    />
                  </Space>
                </Col>
              </Row>
            )
          }}
          dateCellRender={dateCellRender}
        />
      </Modal>

      {/* Event Details */}
      <Modal
        title='Event Details'
        open={eventDetailModalOpen}
        onCancel={() => setEventDetailModalOpen(false)}
        footer={null}
        width={600}
      >
        {selectedEvent && (
          <>
            <Alert
              message='This is a scheduled event. Please ensure all participants are informed.'
              type='info'
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Descriptions
              bordered
              column={1}
              size='middle'
              labelStyle={{ width: '40%' }}
            >
              <Descriptions.Item label='Title'>
                {selectedEvent.title}
              </Descriptions.Item>

              <Descriptions.Item label='Date'>
                {selectedEvent.date}
              </Descriptions.Item>

              <Descriptions.Item label='Time'>
                {formatTimeRange(
                  selectedEvent.startTime,
                  selectedEvent.endTime
                )}
              </Descriptions.Item>

              <Descriptions.Item label='Type'>
                <Tag color='blue'>{selectedEvent.type}</Tag>
              </Descriptions.Item>

              <Descriptions.Item label='Format'>
                <Tag color='green'>{selectedEvent.format}</Tag>
              </Descriptions.Item>

              {(selectedEvent?.location ?? '').trim().length > 0 && (
                <Descriptions.Item label='Location'>
                  {selectedEvent.location}
                </Descriptions.Item>
              )}

              {(selectedEvent?.link ?? '').trim().length > 0 && (
                <Descriptions.Item label='Meeting'>
                  <Button
                    color='primary'
                    variant='filled'
                    href={normalizeUrl(selectedEvent.link)}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    Join Now
                  </Button>
                </Descriptions.Item>
              )}

              {Array.isArray(selectedEvent.participants) &&
                selectedEvent.participants.length > 0 && (
                  <Descriptions.Item label='Participants'>
                    <Space wrap>
                      {selectedEvent.participants.map((p: any, idx: number) => {
                        const name =
                          typeof p === 'string'
                            ? p
                            : p?.name ||
                              p?.label ||
                              p?.beneficiaryName ||
                              p?.email ||
                              p?.id ||
                              'Unknown'
                        return <Tag key={idx}>{name}</Tag>
                      })}
                    </Space>
                  </Descriptions.Item>
                )}

              {selectedEvent.description && (
                <Descriptions.Item label='Description'>
                  {selectedEvent.description}
                </Descriptions.Item>
              )}
            </Descriptions>
          </>
        )}
      </Modal>

      {/* Expand charts modal */}
      <Modal
        title={
          expandOpen.which === 'workload'
            ? 'Workload Trend'
            : expandOpen.which === 'compliance'
            ? 'Compliance Overview'
            : 'Tasks vs Interventions'
        }
        open={expandOpen.open}
        onCancel={() => setExpandOpen({ open: false })}
        footer={null}
        width={900}
      >
        {expandOpen.which === 'workload' && (
          <HighchartsReact highcharts={Highcharts} options={workloadTrend} />
        )}
        {expandOpen.which === 'compliance' && (
          <HighchartsReact highcharts={Highcharts} options={complianceDonut} />
        )}
        {expandOpen.which === 'tasks' && (
          <HighchartsReact
            highcharts={Highcharts}
            options={tasksVsInterventionsChart}
          />
        )}
      </Modal>

      {/* Floating notifications button */}
      <Button
        type='primary'
        shape='circle'
        icon={
          <Badge
            count={
              notifications.filter((n: any) => !n.readBy?.operations).length
            }
          >
            <BellOutlined />
          </Badge>
        }
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}
        onClick={() => message.info('Notifications panel coming soon')}
      />
    </Layout>
  )
}

export default OperationsDashboard
