import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Typography,
  Table,
  Space,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  message,
  DatePicker,
  Select,
  Tabs,
  Row,
  Col,
  Statistic,
  Progress,
  Tooltip,
  Drawer,
  Slider,
  Switch
} from 'antd'
import {
  CheckCircleOutlined,
  CalendarOutlined,
  CommentOutlined,
  UserOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import {
  collection,
  getDoc,
  setDoc,
  doc,
  Timestamp,
  updateDoc,
  getDocs,
  addDoc,
  query,
  where,
  writeBatch
} from 'firebase/firestore'
import dayjs, { Dayjs } from 'dayjs'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { MotionCard } from '@/components/shared/Header'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs

type InterventionType = 'singular' | 'grouped'

interface Assignment {
  id: string
  participantId: string
  beneficiaryName: string
  interventionId: string
  interventionTitle: string
  type: InterventionType
  consultantId: string
  consultantName: string
  status: 'assigned' | 'in-progress' | 'completed' | 'cancelled'
  consultantStatus: 'pending' | 'accepted' | 'declined'
  userStatus: 'pending' | 'accepted' | 'declined'
  consultantCompletionStatus: 'pending' | 'done'
  userCompletionStatus: 'pending' | 'confirmed' | 'rejected'
  createdAt: Timestamp
  updatedAt?: Timestamp
  dueDate?: Timestamp | null
  notes?: string
  feedback?: { rating: number; comments: string }
  timeSpentHours?: number
  targetType?: 'percentage' | 'number'
  targetValue?: number
  targetMetric?: string
}

interface Participant {
  id: string
  beneficiaryName: string
  requiredInterventions: {
    id: string
    title: string
    area?: string
  }[]
  completedInterventions: { id: string; title: string }[]
  sector?: string
  stage?: string
  province?: string
  city?: string
  location?: string
  programName?: string
  email?: string
}

type AnalyticsFilters = {
  statuses: string[]
  consultants: string[]
  programs: string[]
  sectors: string[]
  stages: string[]
  provinces: string[]
  cities: string[]
  dueFrom?: dayjs.Dayjs | null
  dueTo?: dayjs.Dayjs | null
  overdueOnly?: boolean
  dueWithinDays?: number | null
  progressRange?: [number, number]
}

export const ConsultantAssignments: React.FC = () => {
  const { user } = useFullIdentity()

  const [participants, setParticipants] = useState<Participant[]>([])
  const [consultants, setConsultants] = useState<
    { id: string; name: string }[]
  >([])
  const [participantInterventionMap, setParticipantInterventionMap] = useState<
    Record<string, string[]>
  >({})

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRow, setReviewRow] = useState<SuggestionRow | null>(null)
  const [assignmentModalVisible, setAssignmentModalVisible] = useState(false)
  const [assignmentForm] = Form.useForm()
  const [selectedType, setSelectedType] = useState<'singular' | 'grouped'>(
    'singular'
  )
  const [sharedInterventions, setSharedInterventions] = useState<any[]>([])
  const [lockedIntervention, setLockedIntervention] = useState<any>(null)
  const [assignmentParticipant, setAssignmentParticipant] =
    useState<Participant | null>(null)

  const [manageModalVisible, setManageModalVisible] = useState(false)
  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null)
  const [interventionFilter, setInterventionFilter] = useState<
    'all' | 'assigned' | 'unassigned'
  >('all')

  const [searchText, setSearchText] = useState('')
  const [selectedProgram, setSelectedProgram] = useState<string | undefined>()
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [analyticsSearch, setAnalyticsSearch] = useState('')
  const [analyticsProgram, setAnalyticsProgram] = useState<string | undefined>()
  const [donutStatus, setDonutStatus] = useState<string | null>(null)

  const [af, setAf] = useState<AnalyticsFilters>({
    statuses: [],
    consultants: [],
    programs: [],
    sectors: [],
    stages: [],
    provinces: [],
    cities: [],
    dueFrom: undefined,
    dueTo: undefined,
    overdueOnly: false,
    dueWithinDays: null,
    progressRange: [0, 100]
  })

  // ---------- data load ----------
  const fetchAssignments = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'assignedInterventions'))
      const fetched: Assignment[] = snapshot.docs.map(d => ({
        id: d.id,
        ...(d.data() as any)
      }))

      // enrich with participant/consultant names + titles we can find
      const pMap = new Map(participants.map(p => [p.id, p.beneficiaryName]))
      const cMap = new Map(consultants.map(c => [c.id, c.name]))
      const enrich = fetched.map(a => {
        const foundP = participants.find(p => p.id === a.participantId)
        const fromP = foundP?.requiredInterventions.find(
          i => i.id === a.interventionId
        )
        return {
          ...a,
          beneficiaryName:
            pMap.get(a.participantId) || a.beneficiaryName || '—',
          consultantName: cMap.get(a.consultantId) || a.consultantName || '—',
          interventionTitle: fromP?.title || a.interventionTitle || 'Untitled'
        }
      })
      setAssignments(enrich)
    } catch (e) {
      console.error(e)
      message.error('Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [appsSnap, consSnap, partsSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'applications'),
              where('companyCode', '==', user.companyCode)
            )
          ),
          getDocs(
            query(
              collection(db, 'consultants'),
              where('companyCode', '==', user.companyCode)
            )
          ),
          getDocs(query(collection(db, 'participants')))
        ])

        const partsMap = new Map(partsSnap.docs.map(d => [d.id, d.data()]))
        const apps = appsSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter(
            a =>
              a.companyCode === user?.companyCode &&
              String(a.applicationStatus || '').toLowerCase() === 'accepted'
          )

        const fetchedParticipants: Participant[] = apps.map(app => {
          const pdata = (partsMap.get(app.participantId) as any) || {}
          return {
            id: app.participantId,
            beneficiaryName: app.beneficiaryName || 'Unknown',
            sector: pdata.sector || '—',
            stage: app.stage || '—',
            province: pdata.province || '—',
            city: pdata.city || '—',
            location: pdata.location || '—',
            programName: app.programName,
            requiredInterventions: app.interventions?.required || [],
            completedInterventions: app.interventions?.completed || [],
            email: pdata.email || app.email || '—'
          }
        })
        console.log(fetchedParticipants)

        const pim: Record<string, string[]> = {}
        fetchedParticipants.forEach(p => {
          pim[p.id] = (p.requiredInterventions || []).map(i => i.id)
        })

        const fetchedConsultants = consSnap.docs.map(d => {
          const data = d.data() as any
          return { id: d.id, name: data.name || 'Unnamed' }
        })

        setParticipants(fetchedParticipants)
        setConsultants(fetchedConsultants)
        setParticipantInterventionMap(pim)
      } catch (e) {
        console.error(e)
        message.error('Failed to load participants/consultants')
      }
    }
    if (user?.companyCode) fetchAll()
  }, [user?.companyCode])

  useEffect(() => {
    if (participants.length || consultants.length) {
      setLoading(true)
      fetchAssignments()
    }
  }, [participants.length, consultants.length])

  // ---------- helpers ----------
  const getCompositeStatus = (a: Assignment) => {
    const {
      status,
      consultantStatus,
      userStatus,
      consultantCompletionStatus,
      userCompletionStatus
    } = a

    if (status === 'cancelled') return { label: 'Cancelled', color: 'red' }
    if (
      status === 'completed' ||
      (consultantCompletionStatus === 'done' &&
        userCompletionStatus === 'confirmed')
    )
      return { label: 'Completed', color: 'green' }
    if (consultantStatus === 'declined' || userStatus === 'declined')
      return { label: 'Declined', color: 'red' }
    if (userCompletionStatus === 'rejected')
      return { label: 'Rejected', color: 'volcano' }
    if (
      consultantCompletionStatus === 'done' &&
      userCompletionStatus === 'pending'
    )
      return { label: 'Awaiting Confirmation', color: 'purple' }
    if (
      consultantStatus === 'accepted' &&
      userStatus === 'accepted' &&
      consultantCompletionStatus !== 'done'
    )
      return { label: 'In Progress', color: 'blue' }
    if (consultantStatus === 'pending' || userStatus === 'pending')
      return { label: 'Awaiting Acceptance', color: 'orange' }
    return { label: 'Assigned', color: 'gold' }
  }

  const openReview = (row: SuggestionRow) => {
    setReviewRow(row)
    setReviewOpen(true)
  }

  // keep modal and table in sync when you edit inside the modal
  const patchReview = (patch: Partial<SuggestionRow>) => {
    if (!reviewRow) return
    const next = { ...reviewRow, ...patch }
    setReviewRow(next)
    setRow(reviewRow.key, patch) // update the table row too
  }

  // ---------- filtering & metrics for Assignments tab ----------
  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      const okName = (p.beneficiaryName || '')
        .toLowerCase()
        .includes(searchText.toLowerCase())
      const okProgram = !selectedProgram || p.programName === selectedProgram
      return okName && okProgram
    })
  }, [participants, searchText, selectedProgram])

  const participantIds = new Set(filteredParticipants.map(p => p.id))
  const visibleAssignments = assignments.filter(a =>
    participantIds.has(a.participantId)
  )

  const totalRequired = filteredParticipants.reduce(
    (sum, p) => sum + (participantInterventionMap[p.id]?.length || 0),
    0
  )
  const totalAssigned = visibleAssignments.length
  const totalCompleted = visibleAssignments.filter(
    a => getCompositeStatus(a).label === 'Completed'
  ).length
  const completionRate = totalRequired
    ? Math.round((totalCompleted / totalRequired) * 100)
    : 0

  const progressMetrics = [
    {
      title: 'Assigned / Required',
      value: `${totalAssigned} / ${totalRequired}`,
      color: '#1890ff',
      icon: <CheckCircleOutlined />,
      bgColor: '#e6f7ff'
    },
    {
      title: 'Completed / Assigned',
      value: `${totalCompleted} / ${totalAssigned}`,
      color: '#52c41a',
      icon: <CalendarOutlined />,
      bgColor: '#f6ffed'
    },
    {
      title: 'Completion Rate',
      customRender: (
        <Progress
          percent={completionRate}
          strokeColor={
            completionRate > 75
              ? '#52c41a'
              : completionRate > 40
              ? '#faad14'
              : '#f5222d'
          }
        />
      ),
      color: '#faad14',
      icon: <CommentOutlined />,
      bgColor: '#fffbe6'
    }
  ]

  // ---------- Suggestions tab ----------
  const normalizeId = (v: any) => (v == null ? '' : String(v))
  const nextTuesday = (from: Dayjs = dayjs()) => {
    const d = from.startOf('day')
    const day = d.day() // 0 Sun .. 6 Sat
    const diff = (9 - day) % 7 || 7 // next Tuesday (2)
    return d.add(diff, 'day')
  }
  const nextNonTuesdayWeekday = (from: Dayjs = dayjs()) => {
    let d = from.startOf('day').add(1, 'day')
    while ([0, 2, 6].includes(d.day())) d = d.add(1, 'day')
    return d
  }

  function splitIntoBatches<T> (arr: T[], size: number): T[][] {
    if (size <= 0) return [arr]
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size))
    }
    return out
  }

  type SuggestionParticipant = { id: string; name: string; email?: string }
  type SuggestionRow = {
    key: string
    interventionId: string
    interventionTitle: string
    area: string
    type: 'singular' | 'grouped'
    participants: SuggestionParticipant[]
    suggestedDate: Dayjs
    suggestedConsultantId?: string
  }

  const clusters = useMemo(() => {
    const map = new Map<
      string,
      {
        interventionId: string
        title: string
        area: string
        participants: SuggestionParticipant[]
      }
    >()

    filteredParticipants.forEach(p => {
      ;(p.requiredInterventions || []).forEach(iv => {
        const id = String(iv.id ?? '')
        const title = iv.title || 'Untitled Intervention'
        const area = (iv.area || iv.areaOfSupport || '—').toString()

        const cur = map.get(id) || {
          interventionId: id,
          title,
          area,
          participants: []
        }
        // keep the first non-empty area we see
        if (!cur.area || cur.area === '—') cur.area = area

        cur.participants.push({
          id: p.id,
          name: p.beneficiaryName,
          email: p.email || '—'
        })
        map.set(id, cur)
      })
    })

    return Array.from(map.values()).sort(
      (a, b) => b.participants.length - a.participants.length
    )
  }, [filteredParticipants])

  const suggestedRows = useMemo<SuggestionRow[]>(() => {
    const out: SuggestionRow[] = []
    clusters.forEach(cluster => {
      const demand = cluster.participants.length
      const isGroup = demand >= 2
      const defaultConsultant = consultants[0]?.id

      if (isGroup) {
        const batches = splitIntoBatches(cluster.participants, 15)
        batches.forEach((batch, idx) => {
          out.push({
            key: `${cluster.interventionId}__b${idx}`,
            interventionId: cluster.interventionId,
            interventionTitle: cluster.title,
            area: cluster.area, // 👈 set
            type: 'grouped',
            participants: batch,
            suggestedDate: nextTuesday(dayjs().add(idx, 'week')),
            suggestedConsultantId: defaultConsultant
          })
        })
      } else {
        out.push({
          key: `${cluster.interventionId}__${cluster.participants[0].id}`,
          interventionId: cluster.interventionId,
          interventionTitle: cluster.title,
          area: cluster.area, // 👈 set
          type: 'singular',
          participants: cluster.participants,
          suggestedDate: nextNonTuesdayWeekday(dayjs()),
          suggestedConsultantId: defaultConsultant
        })
      }
    })
    return out
  }, [clusters, consultants])

  const [rows, setRows] = useState<SuggestionRow[]>([])
  useEffect(() => setRows(suggestedRows), [suggestedRows])
  const setRow = (key: string, patch: Partial<SuggestionRow>) =>
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)))

  const approveRows = async (chosen: SuggestionRow[]) => {
    const created: string[] = []
    for (const r of chosen) {
      const dueTs = Timestamp.fromDate(r.suggestedDate.toDate())
      const consId = r.suggestedConsultantId || ''
      const consName =
        consultants.find(c => c.id === consId)?.name ||
        (user?.name ?? 'Operations')

      for (const p of r.participants) {
        // duplicate guard
        const dup = await getDocs(
          query(
            collection(db, 'assignedInterventions'),
            where('participantId', '==', p.id),
            where('interventionId', '==', r.interventionId),
            where('status', 'in', ['assigned', 'in-progress', 'completed'])
          )
        )
        if (!dup.empty) continue

        const aRef = doc(collection(db, 'assignedInterventions'))
        await setDoc(aRef, {
          id: aRef.id,
          participantId: p.id,
          beneficiaryName: p.name,
          interventionId: r.interventionId,
          interventionTitle: r.interventionTitle,
          type: r.type,
          consultantId: consId || (user?.email ?? 'ops'),
          consultantName: consName,
          status: 'assigned',
          consultantStatus: consId ? 'pending' : 'accepted',
          userStatus: 'pending',
          consultantCompletionStatus: 'pending',
          userCompletionStatus: 'pending',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          dueDate: dueTs,
          targetType: 'percentage',
          targetMetric: 'Completion',
          targetValue: 100,
          areaOfSupport: r.area
        })
        created.push(aRef.id)
      }
    }
    if (created.length) {
      message.success(`Created ${created.length} assignment(s)`)
      fetchAssignments()
    } else {
      message.info('Nothing to create (duplicates skipped)')
    }
  }

  const suggestionColumns = [
    {
      title: 'Intervention',
      dataIndex: 'interventionTitle',
      key: 'interventionTitle'
    },
    { title: 'Area', dataIndex: 'area', key: 'area' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (t: InterventionType) =>
        t === 'grouped' ? <Tag color='purple'>Group</Tag> : <Tag>Single</Tag>
    },
    {
      title: 'Participants',
      key: 'participants',
      render: (_: any, r: SuggestionRow) => (
        <Tooltip
          title={
            <div style={{ maxWidth: 320 }}>
              {r.participants.map(p => (
                <div key={p.id}>• {p.name}</div>
              ))}
            </div>
          }
        >
          <Tag icon={<UserOutlined />}>{r.participants.length}</Tag>
        </Tooltip>
      )
    },
    {
      title: 'Suggested Date',
      key: 'date',
      render: (_: any, r: SuggestionRow) => (
        <DatePicker
          value={r.suggestedDate}
          onChange={d => d && setRow(r.key, { suggestedDate: d })}
          style={{ width: 160 }}
          disabledDate={d => d && d < dayjs().startOf('day')}
        />
      )
    },
    {
      title: 'Consultant',
      key: 'consultant',
      render: (_: any, r: SuggestionRow) => (
        <Select
          value={r.suggestedConsultantId}
          onChange={v => setRow(r.key, { suggestedConsultantId: v })}
          style={{ width: 240 }}
          placeholder='Select consultant'
          options={consultants.map(c => ({ label: c.name, value: c.id }))}
          showSearch
          optionFilterProp='label'
          allowClear
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: SuggestionRow) => (
        <Space>
          <Button onClick={() => openReview(r)}>Review</Button>
          <Button
            type='primary'
            icon={<CheckCircleOutlined />}
            onClick={() => approveRows([r])}
          >
            Approve
          </Button>
        </Space>
      )
    }
  ]

  // ---------- Assignment tab UI ----------
  const getRateTag = (rate: number) => {
    if (rate <= 25) return <Tag color='red'>Critical</Tag>
    if (rate <= 60) return <Tag color='orange'>Low</Tag>
    if (rate <= 85) return <Tag color='gold'>Moderate</Tag>
    return <Tag color='green'>Good</Tag>
  }

  const columns = [
    {
      title: 'Beneficiary',
      dataIndex: 'beneficiaryName',
      key: 'beneficiaryName'
    },
    { title: 'Sector', dataIndex: 'sector', key: 'sector' },
    { title: 'Program', dataIndex: 'programName', key: 'programName' },
    {
      title: 'Required Interventions',
      key: 'requiredInterventions',
      render: (_: any, r: Participant) => (
        <Tag>{participantInterventionMap[r.id]?.length || 0}</Tag>
      )
    },
    {
      title: 'Assignment Rate',
      key: 'assignmentRate',
      render: (_: any, r: Participant) => {
        const required = participantInterventionMap[r.id]?.length || 0
        const assigned = assignments.filter(
          a => a.participantId === r.id
        ).length
        const pct = required ? (assigned / required) * 100 : 0
        return (
          <Space>
            <Text>
              {assigned} / {required}
            </Text>
            {getRateTag(pct)}
          </Space>
        )
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: Participant) => (
        <Button type='link' onClick={() => handleManageParticipant(r)}>
          Manage
        </Button>
      )
    }
  ]

  const handleManageParticipant = (p: Participant) => {
    setSelectedParticipant(p)
    setManageModalVisible(true)
    setInterventionFilter('all')
  }

  const getFilteredInterventions = () => {
    if (!selectedParticipant) return []
    const requiredIds = participantInterventionMap[selectedParticipant.id] || []
    const assignedForP = assignments.filter(
      a => a.participantId === selectedParticipant.id
    )
    const assignedIds = new Set(assignedForP.map(a => a.interventionId))

    if (interventionFilter === 'assigned') return assignedForP

    if (interventionFilter === 'unassigned') {
      return requiredIds
        .filter(id => !assignedIds.has(id))
        .map(id => {
          const intervention = selectedParticipant.requiredInterventions.find(
            i => i.id === id
          )
          return {
            id,
            interventionTitle: intervention?.title || 'Unknown',
            consultantName: 'Not Assigned',
            status: 'Not Assigned',
            dueDate: null,
            isUnassigned: true,
            beneficiaryName: selectedParticipant.beneficiaryName,
            sector: selectedParticipant.sector,
            programName: selectedParticipant.programName
          }
        })
    }

    const assignedMap = new Map(assignedForP.map(a => [a.interventionId, a]))
    return requiredIds.map(id => {
      const a = assignedMap.get(id)
      if (a) return a
      const intervention = selectedParticipant.requiredInterventions.find(
        i => i.id === id
      )
      return {
        id,
        interventionId: id,
        interventionTitle: intervention?.title || 'Unknown',
        consultantName: 'Not Assigned',
        status: 'Unassigned',
        dueDate: null,
        isUnassigned: true
      }
    })
  }

  const modalColumns = [
    {
      title: 'Intervention Title',
      dataIndex: 'interventionTitle',
      key: 'interventionTitle'
    },
    { title: 'Consultant', dataIndex: 'consultantName', key: 'consultantName' },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: any) => {
        if (record.isUnassigned) return <Tag>Unassigned</Tag>
        const { label, color } = getCompositeStatus(record as Assignment)
        return <Tag color={color}>{label}</Tag>
      }
    },
    {
      title: 'Due Date',
      key: 'dueDate',
      render: (_: any, record: any) => {
        if (!record.dueDate) return '—'
        const d =
          typeof record.dueDate === 'string'
            ? new Date(record.dueDate)
            : record.dueDate?.toDate?.() ?? new Date()
        return d.toLocaleDateString()
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) =>
        record.isUnassigned ? (
          <Button type='link' onClick={() => handleQuickAssign(record)}>
            Assign
          </Button>
        ) : null
    }
  ]

  const handleQuickAssign = (intervention: any) => {
    if (!selectedParticipant) return
    setAssignmentParticipant(selectedParticipant)
    setLockedIntervention(intervention)
    assignmentForm.setFieldsValue({
      participant: selectedParticipant.id,
      intervention: intervention.id
    })
    setAssignmentModalVisible(true)
  }

  // ---------- Analytics tab ----------
  // simple progress proxy (since this screen doesn't track Target/Tracking)
  const progressFor = (a: Assignment) =>
    getCompositeStatus(a).label === 'Completed' ? 100 : 0

  type DetailedRow = {
    key: string
    id: string
    beneficiaryName: string
    interventionTitle: string
    programName: string
    sector: string
    stage: string
    province: string
    city: string
    consultantName: string
    statusLabel: string
    statusColor: string
    dueDate: dayjs.Dayjs | null
    progress: number
  }

  const allInterventionRows = useMemo<DetailedRow[]>(() => {
    return visibleAssignments.map(a => {
      const p = participants.find(pp => pp.id === a.participantId)
      const st = getCompositeStatus(a)
      const due =
        (a.dueDate as any)?.toDate?.() ??
        (a.dueDate ? new Date(String(a.dueDate)) : null)
      return {
        key: a.id,
        id: a.id,
        beneficiaryName: a.beneficiaryName || '—',
        interventionTitle: a.interventionTitle || 'Untitled',
        programName: p?.programName || '—',
        sector: p?.sector || '—',
        stage: p?.stage || '—',
        province: p?.province || '—',
        city: p?.city || '—',
        consultantName: a.consultantName || '—',
        statusLabel: st.label,
        statusColor: st.color,
        dueDate: due ? dayjs(due) : null,
        progress: progressFor(a)
      }
    })
  }, [visibleAssignments, participants])

  // options for Program dropdown and Advanced Drawer
  const analyticsProgramOptions = useMemo(
    () =>
      Array.from(new Set(allInterventionRows.map(r => r.programName))).filter(
        Boolean
      ) as string[],
    [allInterventionRows]
  )

  const afOptions = useMemo(() => {
    const uniq = (arr: string[]) =>
      Array.from(new Set(arr.filter(Boolean))).sort()
    return {
      statuses: uniq(allInterventionRows.map(r => r.statusLabel)),
      consultants: uniq(allInterventionRows.map(r => r.consultantName)),
      programs: uniq(allInterventionRows.map(r => r.programName)),
      sectors: uniq(allInterventionRows.map(r => r.sector)),
      stages: uniq(allInterventionRows.map(r => r.stage)),
      provinces: uniq(allInterventionRows.map(r => r.province)),
      cities: uniq(allInterventionRows.map(r => r.city))
    }
  }, [allInterventionRows])

  // base filters (no donut)
  const filteredRowsNoDonut = useMemo(() => {
    const withinProgress = (v: number) => {
      const [lo, hi] = af.progressRange || [0, 100]
      return v >= lo && v <= hi
    }

    return allInterventionRows.filter(r => {
      if (analyticsSearch) {
        const q = analyticsSearch.toLowerCase().trim()
        const hit =
          (r.beneficiaryName || '').toLowerCase().includes(q) ||
          (r.interventionTitle || '').toLowerCase().includes(q)
        if (!hit) return false
      }
      if (analyticsProgram && r.programName !== analyticsProgram) return false

      if (af.statuses.length && !af.statuses.includes(r.statusLabel))
        return false
      if (af.consultants.length && !af.consultants.includes(r.consultantName))
        return false
      if (af.programs.length && !af.programs.includes(r.programName))
        return false
      if (af.sectors.length && !af.sectors.includes(r.sector)) return false
      if (af.stages.length && !af.stages.includes(r.stage)) return false
      if (af.provinces.length && !af.provinces.includes(r.province))
        return false
      if (af.cities.length && !af.cities.includes(r.city)) return false

      if (af.dueFrom && (!r.dueDate || r.dueDate.isBefore(af.dueFrom, 'day')))
        return false
      if (af.dueTo && (!r.dueDate || r.dueDate.isAfter(af.dueTo, 'day')))
        return false

      if (af.overdueOnly) {
        const isOverdue =
          r.dueDate &&
          r.dueDate.isBefore(dayjs(), 'day') &&
          r.statusLabel !== 'Completed'
        if (!isOverdue) return false
      }

      if (af.dueWithinDays && af.dueWithinDays > 0) {
        const lim = dayjs().add(af.dueWithinDays, 'day').endOf('day')
        if (!r.dueDate || r.dueDate.isAfter(lim)) return false
      }

      if (!withinProgress(r.progress)) return false
      return true
    })
  }, [allInterventionRows, af, analyticsSearch, analyticsProgram])

  // donut selection
  const filteredInterventionRows = useMemo(() => {
    if (!donutStatus) return filteredRowsNoDonut
    return filteredRowsNoDonut.filter(r => r.statusLabel === donutStatus)
  }, [filteredRowsNoDonut, donutStatus])

  const overdueRows = useMemo(
    () =>
      filteredInterventionRows.filter(r => {
        const isOverdue =
          r.dueDate &&
          r.dueDate.isBefore(dayjs(), 'day') &&
          r.statusLabel !== 'Completed'
        return !!isOverdue
      }),
    [filteredInterventionRows]
  )

  const avgProgress = useMemo(() => {
    if (!filteredInterventionRows.length) return 0
    const s = filteredInterventionRows.reduce(
      (a, r) => a + (r.progress || 0),
      0
    )
    return Math.round(s / filteredInterventionRows.length)
  }, [filteredInterventionRows])

  // donut series
  const donutSeries = useMemo(() => {
    const by: Record<string, { color: string; count: number }> = {}
    filteredRowsNoDonut.forEach(r => {
      by[r.statusLabel] = by[r.statusLabel] || {
        color: r.statusColor,
        count: 0
      }
      by[r.statusLabel].count += 1
    })
    return Object.entries(by)
      .filter(([, v]) => v.count > 0)
      .map(([name, v]) => ({
        name,
        y: v.count,
        color: v.color,
        sliced: donutStatus === name,
        selected: donutStatus === name
      }))
  }, [filteredRowsNoDonut, donutStatus])

  const statusDonutOptions: Highcharts.Options = {
    chart: { type: 'pie', height: 260, backgroundColor: 'transparent' },
    title: { text: 'Interventions by Status' },
    credits: { enabled: false },
    legend: { enabled: true },
    plotOptions: {
      pie: {
        innerSize: '60%',
        allowPointSelect: true,
        cursor: 'pointer',
        animation: { duration: 250 },
        point: {
          events: {
            click: function () {
              const name = (this as any).name as string
              setDonutStatus(prev => (prev === name ? null : name))
            }
          }
        },
        dataLabels: {
          enabled: true,
          distance: 18,
          formatter: function () {
            // @ts-ignore
            const y = this.y || 0
            if (!y) return null
            // @ts-ignore
            return `${this.point.name} ${y}`
          },
          style: { color: '#000', textOutline: 'none', fontWeight: '600' }
        }
      }
    },
    series: [{ name: 'Assignments', type: 'pie', data: donutSeries }]
  }

  const analyticsCols = [
    {
      title: 'Beneficiary',
      dataIndex: 'beneficiaryName',
      fixed: 'left',
      width: 180
    },
    { title: 'Intervention', dataIndex: 'interventionTitle', width: 220 },
    { title: 'Program', dataIndex: 'programName', width: 150 },
    { title: 'Sector', dataIndex: 'sector', width: 140 },
    { title: 'Stage', dataIndex: 'stage', width: 120 },
    { title: 'Province', dataIndex: 'province', width: 120 },
    { title: 'Assignee', dataIndex: 'consultantName', width: 180 },
    {
      title: 'Status',
      dataIndex: 'statusLabel',
      width: 170,
      render: (_: any, r: any) => (
        <Tag color={r.statusColor}>{r.statusLabel}</Tag>
      )
    },
    {
      title: 'Due',
      dataIndex: 'dueDate',
      width: 120,
      render: (d: dayjs.Dayjs | null) => (d ? d.format('YYYY-MM-DD') : '—')
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      width: 150,
      render: (v: number) => <Progress percent={v} size='small' />
    }
  ]

  // ---------- UI ----------
  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      <Helmet>
        <title>Consultant Assignments | Incubation Platform</title>
      </Helmet>

      <Tabs centered defaultActiveKey='assignments' destroyInactiveTabPane>
        {/* ASSIGNMENTS */}
        <TabPane tab='Assignments' key='assignments'>
          <Row gutter={[16, 16]} style={{ marginBottom: 15 }}>
            {progressMetrics.map(
              ({ title, value, icon, customRender, color, bgColor }) => (
                <Col xs={24} sm={12} md={8} key={title}>
                  <MotionCard>
                    <Statistic
                      title={
                        <Space>
                          <div
                            style={{
                              background: bgColor,
                              padding: 8,
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {React.cloneElement(icon, {
                              style: { fontSize: 18, color }
                            })}
                          </div>
                          <span>{title}</span>
                        </Space>
                      }
                      valueRender={() => customRender ?? <span>{value}</span>}
                    />
                  </MotionCard>
                </Col>
              )
            )}
          </Row>

          <MotionCard style={{ marginBottom: 10 }}>
            <Row justify='space-between' style={{ marginBottom: 16 }}>
              <Col>
                <Input.Search
                  placeholder='Search beneficiary...'
                  allowClear
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  style={{ width: 250 }}
                />
              </Col>
              <Col>
                <Space>
                  <Select
                    placeholder='Filter by program'
                    allowClear
                    style={{ width: 250 }}
                    value={selectedProgram}
                    onChange={value => setSelectedProgram(value)}
                  >
                    {[...new Set(participants.map(p => p.programName))].map(
                      p => (
                        <Select.Option key={p} value={p}>
                          {p}
                        </Select.Option>
                      )
                    )}
                  </Select>
                  <Button
                    type='primary'
                    icon={<CheckCircleOutlined />}
                    onClick={() => setAssignmentModalVisible(true)}
                  >
                    Assign New Intervention
                  </Button>
                </Space>
              </Col>
            </Row>
          </MotionCard>

          <MotionCard>
            <Table
              columns={columns}
              dataSource={filteredParticipants}
              rowKey='id'
              pagination={{ pageSize: 10 }}
              loading={loading}
            />
          </MotionCard>
        </TabPane>

        {/* SUGGESTIONS */}
        <TabPane tab='Suggestions' key='suggestions'>
          <Card
            title='Suggested Interventions (auto-grouped & scheduled)'
            bordered
            extra={
              <Space>
                <Button onClick={() => setRows(suggestedRows)}>Reset</Button>
                <Button type='primary' onClick={() => approveRows(rows)}>
                  Approve All
                </Button>
              </Space>
            }
          >
            <Text type='secondary'>
              • Groups (≥2 needing same intervention) default to next Tuesday.
              Singles default to the earliest non-Tuesday weekday. Edit
              date/consultant per row before approving.
            </Text>
            <div style={{ height: 8 }} />
            <Table<SuggestionRow>
              rowKey='key'
              columns={suggestionColumns as any}
              dataSource={rows}
              pagination={{ pageSize: 8 }}
            />
          </Card>
        </TabPane>

        {/* ANALYTICS */}
        <TabPane tab='Analytics' key='analytics'>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card>
                <Text type='secondary'>Average Progress</Text>
                <div style={{ marginTop: 8 }}>
                  <Progress percent={avgProgress} />
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Text type='secondary'>Total Interventions (filtered)</Text>
                <Title level={3} style={{ margin: 0 }}>
                  {filteredInterventionRows.length}
                </Title>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Text type='secondary'>Completed (filtered)</Text>
                <Title level={3} style={{ margin: 0 }}>
                  {
                    filteredInterventionRows.filter(
                      r => r.statusLabel === 'Completed'
                    ).length
                  }
                </Title>
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col xs={24} md={10}>
              <Card
                title={
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Text type='secondary'>Interventions by Status</Text>
                    {donutStatus && (
                      <Button size='small' onClick={() => setDonutStatus(null)}>
                        Clear
                      </Button>
                    )}
                  </div>
                }
              >
                <HighchartsReact
                  highcharts={Highcharts}
                  options={statusDonutOptions}
                />
              </Card>
            </Col>

            <Col xs={24} md={14}>
              <Card style={{ marginBottom: 12 }}>
                <Row gutter={8} wrap={false}>
                  <Col flex='0 1 300px'>
                    <Input.Search
                      placeholder='Search by beneficiary / intervention'
                      allowClear
                      value={analyticsSearch}
                      onChange={e => setAnalyticsSearch(e.target.value)}
                    />
                  </Col>
                  <Col flex='0 1 220px'>
                    <Select
                      allowClear
                      placeholder='Filter by program'
                      style={{ width: '100%' }}
                      value={analyticsProgram}
                      onChange={v => setAnalyticsProgram(v)}
                    >
                      {analyticsProgramOptions.map(p => (
                        <Select.Option key={p} value={p}>
                          {p}
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col flex='none'>
                    <Button onClick={() => setAnalyticsOpen(true)}>
                      Advanced Filters
                    </Button>
                  </Col>
                  <Col flex='none'>
                    <Button
                      onClick={() => {
                        setAnalyticsSearch('')
                        setAnalyticsProgram(undefined)
                        setDonutStatus(null)
                      }}
                    >
                      Reset
                    </Button>
                  </Col>
                </Row>
              </Card>

              <Card title='Overdue (filtered)'>
                <Table
                  rowKey='id'
                  columns={analyticsCols as any}
                  dataSource={overdueRows}
                  size='small'
                  pagination={{ pageSize: 5 }}
                  scroll={{ x: 1200 }}
                />
              </Card>
            </Col>
          </Row>

          <Row style={{ marginTop: 12 }}>
            <Col span={24}>
              <Card title='Interventions (Detailed)'>
                <Table
                  rowKey='id'
                  columns={analyticsCols as any}
                  dataSource={filteredInterventionRows}
                  scroll={{ x: 1400 }}
                  pagination={{ pageSize: 8 }}
                />
              </Card>
            </Col>
          </Row>

          {/* Advanced Filters Drawer */}
          <Drawer
            title='Analytics — Advanced Filters'
            width={420}
            open={analyticsOpen}
            onClose={() => setAnalyticsOpen(false)}
            extra={
              <Space>
                <Button
                  onClick={() =>
                    setAf({
                      statuses: [],
                      consultants: [],
                      programs: [],
                      sectors: [],
                      stages: [],
                      provinces: [],
                      cities: [],
                      dueFrom: undefined,
                      dueTo: undefined,
                      overdueOnly: false,
                      dueWithinDays: null,
                      progressRange: [0, 100]
                    })
                  }
                >
                  Reset
                </Button>
                <Button type='primary' onClick={() => setAnalyticsOpen(false)}>
                  Apply
                </Button>
              </Space>
            }
          >
            <Form layout='vertical'>
              <Form.Item label='Status'>
                <Select
                  mode='multiple'
                  value={af.statuses}
                  onChange={v => setAf(s => ({ ...s, statuses: v }))}
                  options={afOptions.statuses.map(s => ({
                    label: s,
                    value: s
                  }))}
                  allowClear
                />
              </Form.Item>
              <Form.Item label='Consultant'>
                <Select
                  mode='multiple'
                  value={af.consultants}
                  onChange={v => setAf(s => ({ ...s, consultants: v }))}
                  options={afOptions.consultants.map(s => ({
                    label: s,
                    value: s
                  }))}
                  allowClear
                />
              </Form.Item>
              <Form.Item label='Program'>
                <Select
                  mode='multiple'
                  value={af.programs}
                  onChange={v => setAf(s => ({ ...s, programs: v }))}
                  options={afOptions.programs.map(s => ({
                    label: s,
                    value: s
                  }))}
                  allowClear
                />
              </Form.Item>
              <Form.Item label='Sector'>
                <Select
                  mode='multiple'
                  value={af.sectors}
                  onChange={v => setAf(s => ({ ...s, sectors: v }))}
                  options={afOptions.sectors.map(s => ({ label: s, value: s }))}
                  allowClear
                />
              </Form.Item>
              <Form.Item label='Stage'>
                <Select
                  mode='multiple'
                  value={af.stages}
                  onChange={v => setAf(s => ({ ...s, stages: v }))}
                  options={afOptions.stages.map(s => ({ label: s, value: s }))}
                  allowClear
                />
              </Form.Item>
              <Form.Item label='Province'>
                <Select
                  mode='multiple'
                  value={af.provinces}
                  onChange={v => setAf(s => ({ ...s, provinces: v }))}
                  options={afOptions.provinces.map(s => ({
                    label: s,
                    value: s
                  }))}
                  allowClear
                />
              </Form.Item>
              <Form.Item label='City'>
                <Select
                  mode='multiple'
                  value={af.cities}
                  onChange={v => setAf(s => ({ ...s, cities: v }))}
                  options={afOptions.cities.map(s => ({ label: s, value: s }))}
                  allowClear
                />
              </Form.Item>

              <Form.Item label='Due Date Window'>
                <Space.Compact block>
                  <DatePicker
                    value={af.dueFrom || null}
                    onChange={d =>
                      setAf(s => ({ ...s, dueFrom: d || undefined }))
                    }
                    style={{ width: '50%' }}
                    placeholder='From'
                  />
                  <DatePicker
                    value={af.dueTo || null}
                    onChange={d =>
                      setAf(s => ({ ...s, dueTo: d || undefined }))
                    }
                    style={{ width: '50%' }}
                    placeholder='To'
                  />
                </Space.Compact>
              </Form.Item>

              <Form.Item label='Overdue Only'>
                <Switch
                  checked={!!af.overdueOnly}
                  onChange={v => setAf(s => ({ ...s, overdueOnly: v }))}
                />
              </Form.Item>

              <Form.Item label='Due Within (days)'>
                <Input
                  type='number'
                  min={1}
                  value={af.dueWithinDays ?? ''}
                  onChange={e =>
                    setAf(s => ({
                      ...s,
                      dueWithinDays: e.target.value
                        ? Number(e.target.value)
                        : null
                    }))
                  }
                  placeholder='e.g. 14'
                />
              </Form.Item>

              <Form.Item label='Progress Range (%)'>
                <Slider
                  range
                  min={0}
                  max={100}
                  value={af.progressRange || [0, 100]}
                  onChange={(v: [number, number]) =>
                    setAf(s => ({ ...s, progressRange: v }))
                  }
                />
              </Form.Item>
            </Form>
          </Drawer>
        </TabPane>
      </Tabs>

      {/* ASSIGN MODAL (unchanged logic, no departments) */}
      <Modal
        title='Assign New Intervention'
        open={assignmentModalVisible}
        onCancel={() => {
          setAssignmentModalVisible(false)
          setLockedIntervention(null)
          setAssignmentParticipant(null)
          assignmentForm.resetFields()
        }}
        footer={null}
      >
        <Form
          form={assignmentForm}
          layout='vertical'
          onFinish={async values => {
            try {
              const isGrouped = values.type === 'grouped'
              const selectedIds: string[] = isGrouped
                ? values.participants
                : [values.participant]

              const consultant = consultants.find(
                c => c.id === values.consultant
              )
              if (!consultant) {
                message.error('Consultant not found')
                return
              }

              const selectedParticipants = selectedIds
                .map((pid: string) => participants.find(p => p.id === pid))
                .filter(Boolean) as Participant[]
              if (!selectedParticipants.length) {
                message.error('No valid participant(s) selected')
                return
              }

              let interventionId: string = values.intervention
              if (isGrouped && !interventionId) {
                message.error('Select a shared intervention')
                return
              }
              if (!isGrouped) {
                const p0 = selectedParticipants[0]
                const found = (p0.requiredInterventions || []).find(
                  i => i.id === values.intervention
                )
                if (!found) {
                  message.error(
                    'Intervention not found for selected participant'
                  )
                  return
                }
              }

              const batch = writeBatch(db)
              const now = Timestamp.now()
              const dueTs = values.dueDate
                ? Timestamp.fromDate(values.dueDate.toDate())
                : null

              let groupId: string | null = null
              if (isGrouped) {
                const groupRef = doc(collection(db, 'groupAssignments'))
                groupId = groupRef.id
                batch.set(groupRef, {
                  id: groupRef.id,
                  groupId,
                  type: 'grouped',
                  consultantId: consultant.id,
                  consultantName: consultant.name,
                  interventionId,
                  participantIds: selectedParticipants.map(p => p.id),
                  dueDate: dueTs,
                  createdAt: now,
                  updatedAt: now
                })
              }

              for (const p of selectedParticipants) {
                const intv = (p.requiredInterventions || []).find(
                  i => i.id === interventionId
                ) || { id: interventionId, title: 'Unknown' }

                const aRef = doc(collection(db, 'assignedInterventions'))
                batch.set(aRef, {
                  id: aRef.id,
                  groupId,
                  type: values.type,
                  participantId: p.id,
                  beneficiaryName: p.beneficiaryName,
                  consultantId: consultant.id,
                  consultantName: consultant.name,
                  interventionId: intv.id,
                  interventionTitle: intv.title,
                  targetType: values.targetType,
                  targetValue: values.targetValue ?? null,
                  targetMetric: values.targetMetric ?? null,
                  dueDate: dueTs,
                  status: 'assigned',
                  consultantStatus: 'pending',
                  userStatus: 'pending',
                  consultantCompletionStatus: 'pending',
                  userCompletionStatus: 'pending',
                  createdAt: now,
                  updatedAt: now
                })
              }

              await batch.commit()
              message.success(
                isGrouped
                  ? `Assigned shared intervention to ${selectedParticipants.length} participant(s)`
                  : 'Intervention assigned'
              )

              setAssignmentModalVisible(false)
              setLockedIntervention(null)
              setAssignmentParticipant(null)
              assignmentForm.resetFields()
              fetchAssignments()
            } catch (err) {
              console.error('Assign failed:', err)
              message.error('Failed to create assignment(s)')
            }
          }}
          onValuesChange={changedValues => {
            if (changedValues.type) setSelectedType(changedValues.type)
            if (changedValues.participants && selectedType === 'grouped') {
              const selectedIds: string[] = changedValues.participants
              const selectedList = participants.filter(p =>
                selectedIds.includes(p.id)
              )
              const sets = selectedList.map(
                p => new Set((p.requiredInterventions || []).map(i => i.id))
              )
              const sharedIds = sets.reduce(
                (acc, set) => new Set([...acc].filter(id => set.has(id))),
                sets[0] || new Set<string>()
              )
              const intersection = [...sharedIds]
                .map(id => {
                  const example = selectedList.find(p =>
                    (p.requiredInterventions || []).some(i => i.id === id)
                  )
                  return example?.requiredInterventions.find(i => i.id === id)
                })
                .filter(Boolean)
              setSharedInterventions(intersection as any[])
            }

            if (changedValues.targetType === 'percentage') {
              assignmentForm.setFieldsValue({ targetMetric: 'Completion' })
            } else if (changedValues.targetType) {
              assignmentForm.setFieldsValue({ targetMetric: undefined })
            }
          }}
        >
          <Form.Item
            name='type'
            label='Assignment Type'
            rules={[
              { required: true, message: 'Please select assignment type' }
            ]}
          >
            <Select placeholder='Select type' defaultValue='singular'>
              <Select.Option value='singular'>Singular (1 SME)</Select.Option>
              <Select.Option value='grouped'>
                Grouped (Multiple SMEs)
              </Select.Option>
            </Select>
          </Form.Item>

          {selectedType === 'grouped' ? (
            <Form.Item
              name='participants'
              label='Select Multiple Beneficiaries'
              rules={[
                { required: true, message: 'Please select participants' }
              ]}
            >
              <Select mode='multiple' placeholder='Choose beneficiaries'>
                {participants.map(p => (
                  <Select.Option key={p.id} value={p.id}>
                    {p.beneficiaryName}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <Form.Item
              name='participant'
              label='Select Beneficiary'
              rules={[
                { required: true, message: 'Please select a participant' }
              ]}
            >
              <Select placeholder='Choose a beneficiary'>
                {participants.map(p => (
                  <Select.Option key={p.id} value={p.id}>
                    {p.beneficiaryName}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            shouldUpdate={(prev, curr) =>
              prev.participant !== curr.participant ||
              prev.participants !== curr.participants ||
              prev.type !== curr.type
            }
            noStyle
          >
            {({ getFieldValue }) => {
              const isGrouped = getFieldValue('type') === 'grouped'
              if (isGrouped) {
                return (
                  <Form.Item
                    name='intervention'
                    label='Select Shared Intervention'
                    rules={[
                      { required: true, message: 'Select an intervention' }
                    ]}
                  >
                    <Select placeholder='Select intervention (shared)'>
                      {sharedInterventions.map(iv => (
                        <Select.Option key={iv.id} value={iv.id}>
                          {iv.title}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                )
              }
              const pid = getFieldValue('participant')
              const selected = participants.find(p => p.id === pid)
              const options = selected?.requiredInterventions || []
              return (
                <Form.Item
                  name='intervention'
                  label='Select Intervention'
                  rules={[
                    { required: true, message: 'Select an intervention' }
                  ]}
                >
                  <Select
                    placeholder='Choose an intervention'
                    disabled={!pid || !!lockedIntervention}
                  >
                    {options.map(iv => (
                      <Select.Option key={iv.id} value={iv.id}>
                        {iv.title}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }}
          </Form.Item>

          <Form.Item
            name='consultant'
            label='Select Consultant'
            rules={[{ required: true, message: 'Please select a consultant' }]}
          >
            <Select placeholder='Choose a consultant'>
              {consultants.map(c => (
                <Select.Option key={c.id} value={c.id}>
                  {c.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name='targetType'
            label='Target Type'
            rules={[{ required: true, message: 'Please select target type' }]}
          >
            <Select placeholder='Select target type'>
              <Select.Option value='percentage'>Percentage (%)</Select.Option>
              <Select.Option value='number'>
                Number (Hours/Sessions)
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            shouldUpdate={(p, c) => p.targetType !== c.targetType}
            noStyle
          >
            {({ getFieldValue }) =>
              getFieldValue('targetType') === 'percentage' ? (
                <>
                  <Form.Item name='targetMetric' label='Label'>
                    <Input disabled value='Completion' />
                  </Form.Item>
                  <Form.Item
                    name='targetValue'
                    label='Target Completion (%)'
                    rules={[{ required: true, message: 'Enter % target' }]}
                  >
                    <Input type='number' max={100} min={1} suffix='%' />
                  </Form.Item>
                </>
              ) : getFieldValue('targetType') === 'number' ? (
                <>
                  <Form.Item
                    name='targetMetric'
                    label='Unit of Measure'
                    rules={[{ required: true, message: 'Choose a metric' }]}
                  >
                    <Select mode='tags' placeholder='e.g. Hours, Sessions'>
                      <Select.Option value='hours'>Hours</Select.Option>
                      <Select.Option value='sessions'>Sessions</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item
                    name='targetValue'
                    label='Target Value'
                    rules={[{ required: true, message: 'Enter numeric goal' }]}
                  >
                    <Input type='number' placeholder='e.g. 5 or 10' />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>

          <Form.Item
            name='dueDate'
            label='Due Date'
            rules={[{ required: true, message: 'Please select a due date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              Create Assignment
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* MANAGE PARTICIPANT MODAL */}
      <Modal
        title={`Interventions for ${
          selectedParticipant?.beneficiaryName || ''
        }`}
        open={manageModalVisible}
        onCancel={() => setManageModalVisible(false)}
        footer={null}
        width={900}
      >
        <Form layout='inline' style={{ marginBottom: 16 }}>
          <Form.Item label='Filter'>
            <Select
              value={interventionFilter}
              onChange={setInterventionFilter}
              style={{ width: 220 }}
            >
              <Select.Option value='all'>All Interventions</Select.Option>
              <Select.Option value='assigned'>Assigned</Select.Option>
              <Select.Option value='unassigned'>Unassigned</Select.Option>
            </Select>
          </Form.Item>
        </Form>

        <Table
          columns={modalColumns as any}
          dataSource={getFilteredInterventions()}
          rowKey='id'
          expandable={{
            expandedRowRender: (record: any) =>
              record.isUnassigned ? (
                <Text type='secondary'>
                  This intervention has not been assigned yet.
                </Text>
              ) : (
                <div style={{ padding: 10 }}>
                  <Paragraph>
                    <Text strong>Type:</Text> {record.type || 'N/A'} <br />
                    <Text strong>Target:</Text> {record.targetValue ?? '—'}{' '}
                    {record.targetType ?? ''} ({record.targetMetric || '—'})
                  </Paragraph>
                  <Paragraph>
                    <Text strong>Assigned On:</Text>{' '}
                    {record.createdAt?.toMillis
                      ? new Date(
                          record.createdAt.toMillis()
                        ).toLocaleDateString()
                      : 'N/A'}
                  </Paragraph>
                  {record.dueDate && (
                    <Paragraph>
                      <Text strong>Due Date:</Text>{' '}
                      {typeof record.dueDate === 'string'
                        ? new Date(record.dueDate).toLocaleDateString()
                        : record.dueDate?.toDate?.()?.toLocaleDateString() ??
                          'N/A'}
                    </Paragraph>
                  )}
                  <Paragraph>
                    <Text strong>Status Summary:</Text>
                    <br />
                    <Tag color='blue'>Overall: {record.status}</Tag>
                    <Tag color='purple'>
                      Consultant: {record.consultantStatus}
                    </Tag>
                    <Tag color='gold'>User: {record.userStatus}</Tag>
                    <Tag color='cyan'>
                      Consultant Completion: {record.consultantCompletionStatus}
                    </Tag>
                    <Tag color='lime'>
                      User Confirmation: {record.userCompletionStatus}
                    </Tag>
                  </Paragraph>
                  {record.feedback && (
                    <Paragraph>
                      <Text strong>Feedback:</Text>
                      <br />
                      <Text italic>"{record.feedback.comments}"</Text>
                      <br />
                      <Tag color='green'>
                        Rating: {record.feedback.rating} / 5
                      </Tag>
                    </Paragraph>
                  )}
                </div>
              )
          }}
        />
      </Modal>

      {/* SUGGESTED INTERVENTIONS MODAL */}
      <Modal
        title={reviewRow ? `Review: ${reviewRow.interventionTitle}` : 'Review'}
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        footer={null}
        destroyOnClose
      >
        {reviewRow && (
          <Space direction='vertical' style={{ width: '100%' }}>
            <Space wrap>
              <Tag color={reviewRow.type === 'grouped' ? 'purple' : 'default'}>
                {reviewRow.type === 'grouped' ? 'Group' : 'Single'}
              </Tag>
              <Text type='secondary'>Area:</Text>
              <Tag>{reviewRow.area}</Tag>
            </Space>

            <Row gutter={12}>
              <Col xs={24} md={12}>
                <Text strong>Suggested Date</Text>
                <DatePicker
                  value={reviewRow.suggestedDate}
                  onChange={d => d && patchReview({ suggestedDate: d })}
                  style={{ width: '100%', marginTop: 6 }}
                  disabledDate={d => d && d < dayjs().startOf('day')}
                />
              </Col>
              <Col xs={24} md={12}>
                <Text strong>Consultant</Text>
                <Select
                  value={reviewRow.suggestedConsultantId}
                  onChange={v => patchReview({ suggestedConsultantId: v })}
                  style={{ width: '100%', marginTop: 6 }}
                  placeholder='Select consultant'
                  options={consultants.map(c => ({
                    label: c.name,
                    value: c.id
                  }))}
                  showSearch
                  optionFilterProp='label'
                  allowClear
                />
              </Col>
            </Row>

            <Card
              size='small'
              title={`Incubatees (${reviewRow.participants.length})`}
            >
              <Table
                size='small'
                rowKey='id'
                pagination={{ pageSize: 8 }} // 👈 paginate
                columns={[
                  { title: 'Incubatee', dataIndex: 'name', key: 'name' },
                  { title: 'Email', dataIndex: 'email', key: 'email' } // 👈 show email
                ]}
                dataSource={reviewRow.participants}
              />
            </Card>

            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setReviewOpen(false)}>Close</Button>
              <Button
                type='primary'
                icon={<CheckCircleOutlined />}
                onClick={async () => {
                  await approveRows([reviewRow])
                  setReviewOpen(false)
                }}
              >
                Confirm & Create
              </Button>
            </Space>
          </Space>
        )}
      </Modal>
    </div>
  )
}
