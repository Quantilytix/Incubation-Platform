// ConsultantDashboard.tsx — live data only, grouped rows + member viewer + batch actions
import React, { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  List,
  Button,
  Tag,
  Table,
  Modal,
  Input,
  message,
  Spin,
  Space,
  Badge
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  FileSearchOutlined,
  MessageOutlined,
  BarChartOutlined,
  CalendarOutlined,
  FullscreenOutlined,
  TeamOutlined,
  UserOutlined,
  EyeOutlined,
  LoginOutlined
} from '@ant-design/icons'
import { auth, db } from '@/firebase'
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  Timestamp,
  getDoc,
  addDoc,
  writeBatch,
  onSnapshot,
  increment
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { Helmet } from 'react-helmet'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { motion } from 'framer-motion'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import dayjs from 'dayjs'

const { Text } = Typography

type ConsultantStatus = 'pending' | 'accepted' | 'declined'

interface Intervention {
  id: string
  beneficiaryName: string
  intervention: string
  sector: string
  stage: string
  location: string
  status: string
  consultantStatus: ConsultantStatus
  declined: boolean
  declineReason: string
  groupId?: string
  consultantId?: string
  userStatus?: string
  interventionTitle?: string
  participantId?: string
  createdAt?: Date | null
  updatedAt?: Date | null
  dueDate?: Date | null
}

interface Feedback {
  id: string
  sme: string
  comment: string
  rating?: number
}

type RowKind = 'group' | 'single'
interface GroupRow {
  kind: 'group'
  id: string // groupId
  groupId: string
  interventionTitle: string
  sector: string | 'Various'
  total: number
  pending: number
  members: Intervention[]
}
interface SingleRow {
  kind: 'single'
  id: string
  beneficiaryName: string
  interventionTitle: string
  sector: string
}
type TableRow = GroupRow | SingleRow

/** ---------- Small UI helper ---------- */
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

/** ---------- Time helpers ---------- */
const lastMonths = (n: number) => {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--)
    out.push(dayjs().subtract(i, 'month').format('MMM'))
  return out
}
const toJsDate = (v: any): Date | null => {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  if (typeof v === 'string') {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d
    const dj = (dayjs as any)(v)
    return dj?.isValid() ? dj.toDate() : null
  }
  if (typeof v === 'number') return new Date(v)
  if (v?.seconds != null) return new Date(v.seconds * 1000)
  return null
}

/** ---------- Sparklines (now fed by real arrays) ---------- */
const spark = (data: number[], categories: string[]): Highcharts.Options => ({
  chart: {
    type: 'areaspline',
    height: 84,
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
  tooltip: {
    pointFormat: '<b>{point.y}</b>',
    headerFormat: '<span>{point.key}</span><br/>'
  },
  credits: { enabled: false },
  plotOptions: {
    areaspline: { marker: { enabled: false }, fillOpacity: 0.2, lineWidth: 2 }
  },
  series: [{ type: 'areaspline', data }]
})

export const ConsultantDashboard: React.FC = () => {
  const { user } = useFullIdentity()
  const [dashboardReady, setDashboardReady] = useState(false)

  const [events, setEvents] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [consultantId, setConsultantId] = useState<string | null>(null)
  const [companyCode, setCompanyCode] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [ongoingCount, setOngoingCount] = useState(0)

  // Table (group collapsed)
  const [tableRows, setTableRows] = useState<TableRow[]>([])
  const [groupPendingCounts, setGroupPendingCounts] = useState<
    Record<string, number>
  >({})

  // Members modal
  const [membersOpen, setMembersOpen] = useState(false)
  const [membersList, setMembersList] = useState<Intervention[]>([])
  const [membersTitle, setMembersTitle] = useState<string>('Group Members')

  // Notifications
  const [notificationsModalVisible, setNotificationsModalVisible] =
    useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  // Charts
  const MONTH_CATS_8 = useMemo(() => lastMonths(8), [])
  const [seriesPending8, setSeriesPending8] = useState<number[]>(
    Array(8).fill(0)
  )
  const [seriesInprog8, setSeriesInprog8] = useState<number[]>(Array(8).fill(0))

  // Expand modal
  const [expandOpen, setExpandOpen] = useState(false)
  const [expandTitle, setExpandTitle] = useState<string>('')
  const [expandOptions, setExpandOptions] = useState<Highcharts.Options>({})
  const openExpand = (title: string, options: Highcharts.Options) => {
    setExpandTitle(title)
    setExpandOptions(options)
    setExpandOpen(true)
  }

  /** ---------- who am I ---------- */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async u => {
      if (!u?.email) return
      const consultantSnap = await getDocs(
        query(collection(db, 'consultants'), where('email', '==', u.email))
      )
      if (consultantSnap.empty) {
        console.error('Consultant not found')
        setRoleLoading(false)
        setLoading(false)
        return
      }
      const consultantDoc = consultantSnap.docs[0]
      const data = consultantDoc.data()
      setConsultantId(consultantDoc.id)
      setCompanyCode(data.companyCode || null)
      setCurrentRole('consultant')
      setRoleLoading(false)
    })
    return () => unsubscribe()
  }, [])

  /** ---------- live: count accepted for consultant ---------- */
  useEffect(() => {
    if (!consultantId) return
    const q = query(
      collection(db, 'assignedInterventions'),
      where('consultantId', '==', consultantId),
      where('userStatus', '==', 'accepted')
    )
    const unsub = onSnapshot(q, async snap => {
      const newlyAccepted = snap.docs.filter(
        d => !d.data().countedForConsultant
      )
      if (newlyAccepted.length === 0) return
      try {
        const batch = writeBatch(db)
        newlyAccepted.forEach(d => {
          batch.update(doc(db, 'assignedInterventions', d.id), {
            countedForConsultant: true,
            countedAt: Timestamp.now()
          })
        })
        await batch
          .update(doc(db, 'consultants', consultantId), {
            assignmentCount: increment(newlyAccepted.length)
          })
          .commit()
      } catch (e) {
        console.error('Failed to increment assignmentCount:', e)
      }
    })
    return () => unsub()
  }, [consultantId])

  /** ---------- Events (live) ---------- */
  useEffect(() => {
    if (!companyCode) return
    ;(async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, 'events'),
            where('companyCode', '==', companyCode)
          )
        )
        setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('Failed to load events:', err)
      }
    })()
  }, [companyCode])

  /** ---------- Appointments (live) ---------- */
  useEffect(() => {
    if (!companyCode || !user?.email) return
    ;(async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, 'appointments'),
            where('companyCode', '==', companyCode),
            where('email', '==', user.email)
          )
        )
        setAppointments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('Failed to load appointments:', err)
      }
    })()
  }, [companyCode, user?.email])

  /** ---------- Assigned Interventions (live) -> collapse to rows + build chart series ---------- */
  useEffect(() => {
    const fetchData = async () => {
      if (!consultantId) {
        setLoading(false)
        return
      }
      try {
        const allSnap = await getDocs(
          query(
            collection(db, 'assignedInterventions'),
            where('consultantId', '==', consultantId)
          )
        )

        const all: Intervention[] = []
        for (const docSnap of allSnap.docs) {
          const x = docSnap.data() as any
          let sector = 'Unknown',
            stage = 'Unknown',
            location = 'Unknown'
          if (x.participantId) {
            const pr = doc(db, 'participants', x.participantId)
            const pSnap = await getDoc(pr)
            if (pSnap.exists()) {
              const p = pSnap.data() as any
              sector = p.sector || sector
              stage = p.stage || stage
              location = p.location || location
            }
          }
          all.push({
            id: docSnap.id,
            beneficiaryName: x.beneficiaryName,
            intervention: x.interventionTitle,
            sector,
            stage,
            location,
            status: x.status,
            consultantStatus:
              (x.consultantStatus as ConsultantStatus) || 'pending',
            declined: x.consultantStatus === 'declined',
            declineReason: x.declineReason || '',
            groupId: x.groupId,
            consultantId: x.consultantId,
            userStatus: x.userStatus,
            interventionTitle: x.interventionTitle,
            participantId: x.participantId,
            createdAt: toJsDate(x.createdAt),
            updatedAt: toJsDate(x.updatedAt),
            dueDate: toJsDate(x.dueDate)
          })
        }

        // collapse to group rows
        const { rows, pendingMap, ongoing } = collapseToRows(all)
        setTableRows(rows)
        setGroupPendingCounts(pendingMap)
        setOngoingCount(ongoing)

        // build 8-month buckets based on createdAt -> updatedAt -> dueDate -> today
        const keys = MONTH_CATS_8
        const idx = new Map<string, number>(keys.map((k, i) => [k, i]))
        const pend = Array(8).fill(0)
        const inpr = Array(8).fill(0)

        for (const it of all) {
          const when = it.createdAt || it.updatedAt || it.dueDate || new Date()
          const k = dayjs(when).format('MMM')
          const i = idx.get(k)
          if (i === undefined) continue
          if (it.status === 'assigned' && it.consultantStatus === 'pending')
            pend[i]++
          if (it.status === 'in-progress') inpr[i]++
        }

        setSeriesPending8(pend)
        setSeriesInprog8(inpr)

        // feedbacks (live)
        if (companyCode) {
          const fbSnap = await getDocs(
            query(
              collection(db, 'interventionsDatabase'),
              where('consultantId', '==', consultantId),
              where('companyCode', '==', companyCode)
            )
          )
          const list: Feedback[] = fbSnap.docs
            .map(d => {
              const y = d.data() as any
              if (!y.feedback?.comments) return null
              return {
                id: d.id,
                sme: y.beneficiaryName || 'Unknown SME',
                comment: y.feedback.comments,
                rating: y.feedback?.rating
              }
            })
            .filter(Boolean) as Feedback[]
          setFeedbacks(list)
        }
      } catch (e) {
        console.error('Error loading dashboard:', e)
      } finally {
        setLoading(false)
        setDashboardReady(true)
      }
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultantId, companyCode])

  /** ---------- collapse helper (grouped -> single row) ---------- */
  const collapseToRows = (all: Intervention[]) => {
    const singles = all.filter(
      i =>
        !i.groupId &&
        i.status === 'assigned' &&
        i.consultantStatus === 'pending'
    )
    const groups = new Map<string, Intervention[]>()
    for (const it of all) {
      if (!it.groupId) continue
      const arr = groups.get(it.groupId) || []
      arr.push(it)
      groups.set(it.groupId, arr)
    }
    const groupRows: GroupRow[] = []
    const pendingMap: Record<string, number> = {}
    for (const [gid, members] of groups.entries()) {
      const pending = members.filter(
        m => m.status === 'assigned' && m.consultantStatus === 'pending'
      )
      if (pending.length === 0) continue
      pendingMap[gid] = pending.length
      const first = members[0]
      const sector = members.every(m => m.sector === first.sector)
        ? first.sector || 'Unknown'
        : 'Various'
      groupRows.push({
        kind: 'group',
        id: gid,
        groupId: gid,
        interventionTitle:
          first.interventionTitle || first.intervention || 'Intervention',
        sector,
        total: members.length,
        pending: pending.length,
        members
      })
    }
    const singleRows: SingleRow[] = singles.map(s => ({
      kind: 'single',
      id: s.id,
      beneficiaryName: s.beneficiaryName,
      interventionTitle:
        s.interventionTitle || s.intervention || 'Intervention',
      sector: s.sector || 'Unknown'
    }))
    const rows: TableRow[] = [...groupRows, ...singleRows]
    const ongoing = all.filter(i => i.status === 'in-progress').length
    return { rows, pendingMap, ongoing }
  }

  /** ---------- Notifications ---------- */
  useEffect(() => {
    if (currentRole) fetchNotifications()
  }, [currentRole])
  const fetchNotifications = async () => {
    if (!currentRole) return
    try {
      setLoadingNotifications(true)
      const notificationsSnap = await getDocs(
        query(
          collection(db, 'notifications'),
          where('recipientRoles', 'array-contains', currentRole)
        )
      )
      const list = notificationsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setNotifications(list)
      setUnreadCount(list.filter(item => !item.readBy?.[currentRole]).length)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoadingNotifications(false)
    }
  }

  /** ---------- Batch confirm (group/single) ---------- */
  const confirmBatch = async (
    action: 'accept' | 'decline',
    baseLabel: string,
    targets: Array<{ id: string; data: any }>
  ) => {
    const count = targets.length
    const title =
      action === 'accept'
        ? `Accept ${count} intervention${count > 1 ? 's' : ''}?`
        : `Decline ${count} intervention${count > 1 ? 's' : ''}?`

    return new Promise<void>((resolve, reject) => {
      Modal.confirm({
        title,
        content: `This will ${action} ${
          count > 1 ? 'all selected assignments' : 'this assignment'
        } for: ${baseLabel}.`,
        okText: action === 'accept' ? 'Accept' : 'Decline',
        okButtonProps: { danger: action === 'decline' },
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            const now = Timestamp.now()
            const batch = writeBatch(db)
            for (const t of targets) {
              const ref = doc(db, 'assignedInterventions', t.id)
              if (action === 'accept') {
                const next: any = {
                  consultantStatus: 'accepted',
                  updatedAt: now
                }
                if (t.data.userStatus === 'accepted')
                  next.status = 'in-progress'
                batch.update(ref, next)
              } else {
                batch.update(ref, {
                  consultantStatus: 'declined',
                  status: 'declined',
                  declineReason: '',
                  updatedAt: now
                })
              }
            }
            await batch.commit()

            await Promise.all(
              targets.map(t =>
                addDoc(collection(db, 'notifications'), {
                  participantId: t.data.participantId,
                  participantName: t.data.beneficiaryName,
                  interventionId: t.id,
                  interventionTitle: t.data.interventionTitle,
                  type:
                    action === 'accept'
                      ? 'consultant-accepted'
                      : 'consultant-declined',
                  recipientRoles: ['admin', 'participant'],
                  createdAt: new Date(),
                  readBy: {},
                  message:
                    action === 'accept'
                      ? {
                          admin: `Consultant accepted: ${t.data.interventionTitle}`,
                          participant: `Your intervention "${t.data.interventionTitle}" was accepted.`
                        }
                      : {
                          admin: `Consultant declined: ${t.data.interventionTitle}`,
                          participant: `Your intervention "${t.data.interventionTitle}" was declined.`
                        }
                })
              )
            )

            // remove affected from table / update counts
            setTableRows(prev => {
              const next: TableRow[] = []
              for (const r of prev) {
                if (r.kind === 'single') {
                  if (!targets.some(t => t.id === r.id)) next.push(r)
                } else {
                  if (r.groupId !== (targets[0]?.data?.groupId || ''))
                    next.push(r)
                }
              }
              return next
            })
            setGroupPendingCounts(prev => {
              const gid = targets[0]?.data?.groupId
              if (!gid) return prev
              const left = Math.max((prev[gid] || 0) - targets.length, 0)
              const m = { ...prev }
              if (left === 0) delete m[gid]
              else m[gid] = left
              return m
            })

            message.success(
              `${
                action === 'accept' ? 'Accepted' : 'Declined'
              } ${count} intervention(s).`
            )
            resolve()
          } catch (e) {
            console.error(e)
            message.error(`Failed to ${action} intervention(s).`)
            reject(e)
          }
        },
        onCancel: () => resolve()
      })
    })
  }

  /** ---------- Actions from table ---------- */
  const handleAcceptGroup = async (row: GroupRow) => {
    try {
      const grpSnap = await getDocs(
        query(
          collection(db, 'assignedInterventions'),
          where('groupId', '==', row.groupId),
          where('consultantId', '==', consultantId)
        )
      )
      const targets = grpSnap.docs
        .map(d => ({ id: d.id, data: d.data() }))
        .filter(
          t =>
            t.data.consultantStatus === 'pending' &&
            t.data.status === 'assigned'
        )
      if (targets.length === 0)
        return message.info('Nothing pending in this group.')
      await confirmBatch(
        'accept',
        `${row.interventionTitle} (Group of ${row.total})`,
        targets
      )
    } catch (e) {
      console.error(e)
      message.error('Failed to accept group.')
    }
  }

  const handleDeclineGroup = async (row: GroupRow) => {
    try {
      const grpSnap = await getDocs(
        query(
          collection(db, 'assignedInterventions'),
          where('groupId', '==', row.groupId),
          where('consultantId', '==', consultantId)
        )
      )
      const targets = grpSnap.docs
        .map(d => ({ id: d.id, data: d.data() }))
        .filter(
          t =>
            t.data.consultantStatus === 'pending' &&
            t.data.status === 'assigned'
        )
      if (targets.length === 0)
        return message.info('Nothing pending in this group.')
      await confirmBatch(
        'decline',
        `${row.interventionTitle} (Group of ${row.total})`,
        targets
      )
    } catch (e) {
      console.error(e)
      message.error('Failed to decline group.')
    }
  }

  const handleAcceptSingle = async (row: SingleRow) => {
    try {
      const ref = doc(db, 'assignedInterventions', row.id)
      const snap = await getDoc(ref)
      if (!snap.exists()) return message.error('Intervention not found.')
      const data = snap.data()
      await confirmBatch('accept', row.beneficiaryName, [{ id: row.id, data }])
    } catch (e) {
      console.error(e)
      message.error('Failed to accept.')
    }
  }
  const handleDeclineSingle = async (row: SingleRow) => {
    try {
      const ref = doc(db, 'assignedInterventions', row.id)
      const snap = await getDoc(ref)
      if (!snap.exists()) return message.error('Intervention not found.')
      const data = snap.data()
      await confirmBatch('decline', row.beneficiaryName, [{ id: row.id, data }])
    } catch (e) {
      console.error(e)
      message.error('Failed to decline.')
    }
  }

  /** ---------- Columns ---------- */
  const columns = [
    {
      title: 'Grouped',
      key: 'grouped',
      width: 140,
      render: (_: any, record: TableRow) =>
        record.kind === 'group' ? (
          <Tag color='purple' icon={<TeamOutlined />}>
            Group
          </Tag>
        ) : (
          <Tag icon={<UserOutlined />}>Single</Tag>
        )
    },
    {
      title: 'Beneficiary Name',
      key: 'beneficiary',
      render: (_: any, record: TableRow) =>
        record.kind === 'group' ? (
          <Space size={8}>
            <span style={{ color: '#8c8c8c' }}>
              {record.total} SMEs
              {record.pending ? ` · ${record.pending} pending` : ''}
            </span>
            <Button
              type='link'
              icon={<EyeOutlined />}
              onClick={() => {
                setMembersList(record.members)
                setMembersTitle(
                  `${record.interventionTitle} — Group Members (${record.total})`
                )
                setMembersOpen(true)
              }}
            >
              View members
            </Button>
          </Space>
        ) : (
          <span>{record.beneficiaryName}</span>
        )
    },
    {
      title: 'Intervention',
      key: 'intervention',
      render: (_: any, record: TableRow) =>
        record.kind === 'group'
          ? record.interventionTitle
          : record.interventionTitle
    },
    {
      title: 'Sector',
      key: 'sector',
      render: (_: any, record: TableRow) =>
        record.kind === 'group' ? record.sector : record.sector
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: TableRow) =>
        record.kind === 'group' ? (
          <Space>
            <Button
              type='link'
              icon={<CheckOutlined />}
              style={{ color: 'green' }}
              onClick={() => handleAcceptGroup(record)}
            >
              Accept Group
              {groupPendingCounts[record.groupId]
                ? ` (${groupPendingCounts[record.groupId]})`
                : ''}
            </Button>
            <Button
              type='link'
              icon={<CloseOutlined />}
              style={{ color: 'red' }}
              onClick={() => handleDeclineGroup(record)}
            >
              Decline Group
              {groupPendingCounts[record.groupId]
                ? ` (${groupPendingCounts[record.groupId]})`
                : ''}
            </Button>
          </Space>
        ) : (
          <Space>
            <Button
              type='link'
              icon={<CheckOutlined />}
              style={{ color: 'green' }}
              onClick={() => handleAcceptSingle(record)}
            >
              Accept
            </Button>
            <Button
              type='link'
              icon={<CloseOutlined />}
              style={{ color: 'red' }}
              onClick={() => handleDeclineSingle(record)}
            >
              Decline
            </Button>
          </Space>
        )
    }
  ]

  /** ---------- KPIs & charts (all REAL now) ---------- */
  const tasksPending = tableRows.length
  const tasksOngoing = ongoingCount

  const spPending = useMemo(
    () => spark(seriesPending8, MONTH_CATS_8),
    [MONTH_CATS_8, seriesPending8]
  )
  const spOngoing = useMemo(
    () => spark(seriesInprog8, MONTH_CATS_8),
    [MONTH_CATS_8, seriesInprog8]
  )
  const feedbackAvg = feedbacks.length
    ? Math.round(
        feedbacks.reduce((s, f) => s + (f.rating || 4), 0) / feedbacks.length
      )
    : 0
  const spRating = useMemo(
    () =>
      spark(
        // crude but real: average rating per month if you later bucket it; for now keep flat line at current avg
        Array(8).fill(feedbackAvg),
        MONTH_CATS_8
      ),
    [MONTH_CATS_8, feedbackAvg]
  )

  const upcomingAppts = appointments.length
  const spAppts = useMemo(
    () =>
      spark(
        // same idea: if you later bucket appointments by month, wire here; for now constant line at count
        Array(8).fill(upcomingAppts),
        MONTH_CATS_8
      ),
    [MONTH_CATS_8, upcomingAppts]
  )

  // NEW: Stacked Column (rounded “pills”), using the same 8-month arrays
  const workloadTrend: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'column', height: 320, backgroundColor: 'transparent' },
      title: { text: 'Workload (last 8 months)' },
      credits: { enabled: false },
      xAxis: { categories: MONTH_CATS_8, tickLength: 0 },
      yAxis: {
        min: 0,
        title: { text: 'Assignments' },
        stackLabels: { enabled: true }
      },
      tooltip: { shared: true },
      plotOptions: {
        column: {
          stacking: 'normal',
          pointPadding: 0.12,
          borderWidth: 0,
          groupPadding: 0.16,
          borderRadius: 10 // rounded “pill” look (supported in recent Highcharts)
        }
      },
      series: [
        { name: 'Assigned (pending)', type: 'column', data: seriesPending8 },
        { name: 'In-progress', type: 'column', data: seriesInprog8 }
      ]
    }),
    [MONTH_CATS_8, seriesPending8, seriesInprog8]
  )

  return (
    <>
      {!dashboardReady ? (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Spin size='large' />
        </div>
      ) : (
        <div style={{ padding: 24, minHeight: '100vh', background: '#f7faff' }}>
          <Helmet>
            <title>Consultant Workspace | Smart Incubation</title>
          </Helmet>

          {/* KPI row */}
          <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
            <Col xs={24} sm={12} md={6}>
              <MotionCard>
                <Space direction='vertical' style={{ width: '100%' }}>
                  <Statistic
                    title='Pending Interventions'
                    value={tasksPending}
                    prefix={<FileSearchOutlined />}
                  />
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={spPending}
                  />
                </Space>
              </MotionCard>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <MotionCard>
                <Space direction='vertical' style={{ width: '100%' }}>
                  <Statistic
                    title='Ongoing Interventions'
                    value={tasksOngoing}
                    prefix={<BarChartOutlined />}
                  />
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={spOngoing}
                  />
                </Space>
              </MotionCard>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <MotionCard>
                <Space direction='vertical' style={{ width: '100%' }}>
                  <Statistic
                    title='Avg. Feedback Rating'
                    value={feedbackAvg}
                    suffix='/5'
                    prefix={<MessageOutlined />}
                  />
                  <HighchartsReact highcharts={Highcharts} options={spRating} />
                </Space>
              </MotionCard>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <MotionCard>
                <Space direction='vertical' style={{ width: '100%' }}>
                  <Statistic
                    title='Upcoming Appointments'
                    value={upcomingAppts}
                    prefix={<CalendarOutlined />}
                  />
                  <HighchartsReact highcharts={Highcharts} options={spAppts} />
                </Space>
              </MotionCard>
            </Col>
          </Row>

          {/* Visual row */}
          <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
            <Col xs={24} lg={14}>
              <MotionCard
                title='Workload'
                extra={
                  <Button
                    icon={<FullscreenOutlined />}
                    onClick={() => openExpand('Workload', workloadTrend)}
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
              <MotionCard title='Upcoming Events'>
                <div
                  style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}
                >
                  <List
                    itemLayout='horizontal'
                    dataSource={events.slice(0, 10)}
                    renderItem={(event: any) => {
                      const start =
                        toJsDate(event.startTime) ??
                        toJsDate(event.time) ??
                        (dayjs(event.date).isValid()
                          ? dayjs(event.date).toDate()
                          : null)
                      const end = toJsDate(event.endTime)

                      const joinUrl =
                        event?.joinUrl ||
                        event?.link ||
                        event?.meetLink ||
                        event?.zoomLink ||
                        event?.teamsLink ||
                        event?.googleMeetLink ||
                        null

                      const location =
                        event?.location ||
                        event?.venue ||
                        event?.address ||
                        null

                      const isVirtual =
                        (typeof event?.mode === 'string' &&
                          event.mode.toLowerCase() === 'virtual') ||
                        event?.isVirtual === true ||
                        !!joinUrl

                      const dateStr = start
                        ? dayjs(start).format('DD MMM YYYY')
                        : 'N/A'
                      const timeStr = start
                        ? dayjs(start).format('HH:mm')
                        : 'N/A'
                      const endStr = end
                        ? `– ${dayjs(end).format('HH:mm')}`
                        : ''

                      return (
                        <List.Item
                          actions={
                            isVirtual && joinUrl
                              ? [
                                  <Button
                                    key='join'
                                    type='link'
                                    size='small'
                                    href={joinUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    icon={<LoginOutlined />}
                                  >
                                    Join Now
                                  </Button>
                                ]
                              : undefined
                          }
                        >
                          <List.Item.Meta
                            title={
                              <Text strong>{event.title || 'Untitled'}</Text>
                            }
                            description={
                              <>
                                <Text type='secondary'>
                                  {dateStr} · {timeStr}
                                  {endStr} ·{' '}
                                  {event.type ||
                                    (isVirtual ? 'Virtual' : 'In-person')}
                                </Text>
                                {!isVirtual && location ? (
                                  <>
                                    <br />
                                    <Text type='secondary'>
                                      Location: {location}
                                    </Text>
                                  </>
                                ) : null}
                              </>
                            }
                          />
                        </List.Item>
                      )
                    }}
                  />
                </div>
              </MotionCard>
            </Col>
          </Row>

          {/* Appointments + Table */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <MotionCard
                title='Upcoming Appointments'
                style={{
                  height: 420,
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
                  <List
                    itemLayout='horizontal'
                    dataSource={[...appointments].sort((a, b) =>
                      dayjs(
                        a.date +
                          ' ' +
                          (a.time?.toDate
                            ? dayjs(a.time.toDate()).format('HH:mm')
                            : '')
                      ).diff(
                        dayjs(
                          b.date +
                            ' ' +
                            (b.time?.toDate
                              ? dayjs(b.time.toDate()).format('HH:mm')
                              : '')
                        )
                      )
                    )}
                    renderItem={(appointment: any) => (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <Text strong>
                              {appointment.title || 'Untitled'}
                            </Text>
                          }
                          description={
                            <Text type='secondary'>
                              {dayjs(appointment.date).isValid()
                                ? dayjs(appointment.date).format('DD MMM YYYY')
                                : 'N/A'}
                              {' · '}
                              {appointment.time?.toDate
                                ? dayjs(appointment.time.toDate()).format(
                                    'HH:mm'
                                  )
                                : 'N/A'}
                              {' · '}
                              {appointment.type}
                            </Text>
                          }
                        />
                        <Tag color='blue'>
                          {appointment.consultantName || 'You'}
                        </Tag>
                      </List.Item>
                    )}
                  />
                </div>
              </MotionCard>
            </Col>

            <Col xs={24} lg={12}>
              <MotionCard title='Allocated Interventions'>
                <Table<TableRow>
                  dataSource={tableRows}
                  columns={columns as any}
                  rowKey='id'
                  pagination={{ pageSize: 6 }}
                />
              </MotionCard>
            </Col>
          </Row>

          {/* Expand Modal */}
          <Modal
            title={expandTitle}
            open={expandOpen}
            onCancel={() => setExpandOpen(false)}
            footer={null}
            width={900}
          >
            <HighchartsReact highcharts={Highcharts} options={expandOptions} />
          </Modal>

          {/* Group Members Modal */}
          <Modal
            title={membersTitle}
            open={membersOpen}
            onCancel={() => setMembersOpen(false)}
            footer={null}
            width={720}
          >
            <List
              dataSource={membersList}
              pagination={{
                pageSize: 5,
                size: 'medium'
              }}
              renderItem={m => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <UserOutlined />
                        <strong>{m.beneficiaryName}</strong>
                      </Space>
                    }
                    description={
                      <span>
                        {m.sector || 'Unknown'} · {m.location || 'N/A'}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </Modal>

          {/* Notifications */}
          <Modal
            title='My Notifications'
            open={notificationsModalVisible}
            onCancel={() => setNotificationsModalVisible(false)}
            footer={null}
            width={600}
          >
            {loadingNotifications ? (
              <Spin
                size='large'
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginTop: 20
                }}
              />
            ) : (
              <List
                itemLayout='horizontal'
                dataSource={notifications}
                renderItem={item => (
                  <List.Item
                    style={{
                      backgroundColor: item.readBy?.[currentRole]
                        ? 'white'
                        : '#f0f5ff',
                      cursor: 'default'
                    }}
                    actions={
                      !item.readBy?.[currentRole]
                        ? [
                            <Button
                              size='small'
                              type='link'
                              onClick={() =>
                                updateDoc(doc(db, 'notifications', item.id), {
                                  [`readBy.${currentRole}`]: true
                                }).then(() => {
                                  setNotifications(prev =>
                                    prev.map(n =>
                                      n.id === item.id
                                        ? {
                                            ...n,
                                            readBy: {
                                              ...n.readBy,
                                              [currentRole!]: true
                                            }
                                          }
                                        : n
                                    )
                                  )
                                  setUnreadCount(prev => Math.max(prev - 1, 0))
                                })
                              }
                            >
                              Mark as Read
                            </Button>
                          ]
                        : []
                    }
                  >
                    <List.Item.Meta
                      title={item.interventionTitle || 'Notification'}
                      description={
                        item.message?.[currentRole] ||
                        'No message available for your role.'
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Modal>

          <Button
            type='primary'
            shape='circle'
            size='large'
            disabled={roleLoading || !currentRole}
            style={{
              position: 'fixed',
              right: 32,
              bottom: 32,
              zIndex: 1000,
              backgroundColor: '#1890ff',
              boxShadow: '0px 4px 10px rgba(0,0,0,0.2)'
            }}
            onClick={() => {
              fetchNotifications()
              setNotificationsModalVisible(true)
            }}
          >
            <Badge count={unreadCount} size='small' offset={[-5, 5]}>
              <MessageOutlined style={{ fontSize: 24, color: 'white' }} />
            </Badge>
          </Button>
        </div>
      )}
    </>
  )
}

export default ConsultantDashboard
