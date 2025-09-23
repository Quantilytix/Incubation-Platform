import React, { useEffect, useState } from 'react'
import {
  Row,
  Col,
  Card,
  Typography,
  Statistic,
  Button,
  List,
  Modal,
  Input,
  message,
  Badge,
  Select,
  Spin,
  Tag,
  Rate,
  Table
} from 'antd'
import {
  BellOutlined,
  CheckCircleOutlined,
  ExpandAltOutlined,
  FileTextOutlined,
  TeamOutlined
} from '@ant-design/icons'
import {
  arrayUnion,
  arrayRemove,
  writeBatch,
  Timestamp,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  addDoc
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '@/firebase'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { motion } from 'framer-motion'

const { Title } = Typography
const { Option } = Select

const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]
interface AssignedIntervention {
  id: string
  interventionId: string
  participantId: string
  consultantId: string
  beneficiaryName: string
  interventionTitle: string
  description?: string
  areaOfSupport: string
  dueDate: any
  createdAt: string
  updatedAt: string
  type: 'singular' | 'recurring'
  targetType: 'percentage' | 'metric' | 'custom'
  targetMetric: string
  targetValue: number
  timeSpent: number

  consultantStatus: 'pending' | 'accepted' | 'declined'
  userStatus: 'pending' | 'accepted' | 'declined'
  consultantCompletionStatus: 'pending' | 'done'
  userCompletionStatus: 'pending' | 'confirmed' | 'rejected'

  resources?: {
    type: 'document' | 'link'
    label: string
    link: string
  }[]

  feedback?: {
    rating: number
    comments: string
  }

  consultant?: {
    name: string
    email: string
    expertise: string[]
    rating: number
  }
}

type AssignedSurveyRow = {
  id: string
  templateId: string
  title: string
  status: 'pending' | 'in_progress' | 'submitted'
  deliveryMethod: 'in_app' | 'email'
  linkToken?: string
  createdAt?: any
  updatedAt?: any
}

export const IncubateeDashboard: React.FC = () => {
  const [revenueData, setRevenueData] = useState<number[]>([])
  const [avgRevenueData, setAvgRevenueData] = useState<number[]>([])
  const [permHeadcount, setPermHeadcount] = useState<number[]>([])
  const [tempHeadcount, setTempHeadcount] = useState<number[]>([])
  const [participation, setParticipation] = useState<number>(0)
  const [outstandingDocs, setOutstandingDocs] = useState<number>(0)
  const [pendingInterventions, setPendingInterventions] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [notificationsModalVisible, setNotificationsModalVisible] =
    useState(false)
  const [declineModalVisible, setDeclineModalVisible] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [selectedInterventionId, setSelectedInterventionId] = useState<
    string | null
  >(null)
  const [userRole, setUserRole] = useState<
    'admin' | 'consultant' | 'incubatee' | 'operations' | 'director'
  >()
  const [participantId, setParticipantId] = useState<string>('')
  const [filterType, setFilterType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const [assignedSurveys, setAssignedSurveys] = useState<AssignedSurveyRow[]>(
    []
  )
  const [loadingSurveys, setLoadingSurveys] = useState(false)

  const [confirmModalVisible, setConfirmModalVisible] = useState(false)
  const [selectedIntervention, setSelectedIntervention] =
    useState<AssignedIntervention | null>(null)
  const [feedbackRating, setFeedbackRating] = useState<number>(0)
  const [feedbackComments, setFeedbackComments] = useState<string>('')
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    const fetchUserRole = async () => {
      const currentUser = auth.currentUser
      if (!currentUser) return

      const userSnap = await getDocs(
        query(collection(db, 'users'), where('email', '==', currentUser.email))
      )

      if (!userSnap.empty) {
        const userData = userSnap.docs[0].data()
        const normalized = (userData.role || '')
          .toLowerCase()
          .replace(/\s+/g, '')
        setUserRole(normalized)
      }
    }

    fetchUserRole()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      const auth = getAuth()
      onAuthStateChanged(auth, async user => {
        if (!user) return

        const snapshot = await getDocs(
          query(
            collection(db, 'participants'),
            where('email', '==', user.email)
          )
        )

        if (snapshot.empty) return

        const participantDoc = snapshot.docs[0]
        const participant = participantDoc.data()
        const pid = participantDoc.id
        setParticipantId(pid)

        // Revenue & Headcount
        const monthLabels = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December'
        ]

        const revMonthly = participant.revenueHistory?.monthly || {}
        const headMonthly = participant.headcountHistory?.monthly || {}

        setRevenueData(
          monthLabels.map(month => {
            // Prefer revenueHistory.monthly[month], fallback to flat key
            const monthly = revMonthly[month]
            const flat = participant[`revenue_${month}`]
            return typeof monthly === 'number'
              ? monthly
              : typeof flat === 'number'
              ? flat
              : 0
          })
        )

        setAvgRevenueData(prev =>
          monthLabels.map((_, i) => revenueData[i] * 0.85)
        )

        setPermHeadcount(
          monthLabels.map(month => {
            const monthly = headMonthly[month]?.permanent
            const flat = participant[`permHeadcount_${month}`]
            return typeof monthly === 'number'
              ? monthly
              : typeof flat === 'number'
              ? flat
              : 0
          })
        )

        setTempHeadcount(
          monthLabels.map(month => {
            const monthly = headMonthly[month]?.temporary
            const flat = participant[`tempHeadcount_${month}`]
            return typeof monthly === 'number'
              ? monthly
              : typeof flat === 'number'
              ? flat
              : 0
          })
        )

        setParticipation(participant.interventions?.participationRate || 0)

        // Compliance Docs
        const applicationSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('participantId', '==', pid)
          )
        )

        let complianceDocs: any[] = []

        if (!applicationSnap.empty) {
          const appData = applicationSnap.docs[0].data()
          complianceDocs = appData.complianceDocuments || []
        }

        const invalidDocs = complianceDocs.filter(
          (doc: any) => !['valid', 'approved'].includes(doc.status)
        )

        setOutstandingDocs(invalidDocs.length)

        // Notifications
        const notificationsSnap = await getDocs(
          query(
            collection(db, 'notifications'),
            where('participantId', '==', pid)
          )
        )
        setNotifications(
          notificationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        )

        // Interventions: Pull and categorize
        const interventionsSnap = await getDocs(
          query(
            collection(db, 'assignedInterventions'),
            where('participantId', '==', pid)
          )
        )

        const interventionsData: AssignedIntervention[] =
          interventionsSnap.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<AssignedIntervention, 'id'>)
          }))

        // Filter: incubatee must still respond
        const pending = interventionsData.filter(
          item =>
            item.consultantStatus === 'accepted' &&
            item.userStatus === 'pending'
        )

        // Filter: consultant has completed; incubatee must confirm
        const needsConfirmation = interventionsData.filter(
          item =>
            item.userStatus === 'accepted' &&
            item.consultantCompletionStatus === 'done' &&
            item.userCompletionStatus === 'pending'
        )

        setPendingInterventions(
          [...pending, ...needsConfirmation].map(item => ({
            id: item.id,
            title: item.interventionTitle,
            type:
              item.consultantCompletionStatus === 'done' &&
              item.userCompletionStatus === 'pending'
                ? 'confirmation'
                : 'assignment',
            date: formatDueDate(item.dueDate),
            full: item // for later use in modals
          }))
        )

        // ----- Assigned Surveys (formAssignments) -----
        try {
          setLoadingSurveys(true)

          if (!applicationSnap.empty) {
            const applicationId = applicationSnap.docs[0].id

            const asSnap = await getDocs(
              query(
                collection(db, 'formAssignments'),
                where('applicationId', '==', applicationId)
              )
            )

            const rows: AssignedSurveyRow[] = await Promise.all(
              asSnap.docs.map(async d => {
                const a = d.data() as any
                // resolve title (use snapshot if you later store it; otherwise fetch template)
                let title = a.templateTitle as string | undefined
                if (!title && a.templateId) {
                  const tSnap = await getDoc(
                    doc(db, 'formTemplates', a.templateId)
                  )
                  title = tSnap.exists()
                    ? (tSnap.data() as any).title
                    : 'Untitled Form'
                }
                return {
                  id: d.id,
                  templateId: a.templateId,
                  title: title || 'Untitled Form',
                  status: (a.status ||
                    'pending') as AssignedSurveyRow['status'],
                  deliveryMethod: (a.deliveryMethod ||
                    'in_app') as AssignedSurveyRow['deliveryMethod'],
                  linkToken: a.linkToken,
                  createdAt: a.createdAt,
                  updatedAt: a.updatedAt
                }
              })
            )

            // Sort: newest updated first
            rows.sort(
              (a, b) =>
                new Date(b.updatedAt || b.createdAt || 0).getTime() -
                new Date(a.updatedAt || a.createdAt || 0).getTime()
            )

            setAssignedSurveys(rows)
          } else {
            setAssignedSurveys([])
          }
        } catch (e) {
          console.error(e)
          // non-blocking
        } finally {
          setLoadingSurveys(false)
        }

        setLoading(false)
      })
    }

    fetchData()
  }, [])

  const formatDueDate = (dueDate: any): string => {
    if (!dueDate) return 'TBD'
    if (dueDate?.seconds)
      return dayjs(dueDate.seconds * 1000).format('YYYY-MM-DD')
    if (typeof dueDate === 'string' || dueDate instanceof Date) {
      return dayjs(dueDate).isValid()
        ? dayjs(dueDate).format('YYYY-MM-DD')
        : 'TBD'
    }
    return 'TBD'
  }

  const formatDateShort = (val: any): string => {
    if (!val) return '-'
    if (val?.seconds) return dayjs(val.seconds * 1000).format('YYYY-MM-DD')
    if (typeof val === 'string' || val instanceof Date) {
      return dayjs(val).isValid() ? dayjs(val).format('YYYY-MM-DD') : '-'
    }
    return '-'
  }

  const getQuarter = date => {
    // Accepts Date, string, or number (timestamp)
    const d = date instanceof Date ? date : new Date(date)
    const month = d.getMonth() // 0 = Jan, 11 = Dec
    const quarter = Math.floor(month / 3) + 1
    return `Q${quarter}`
  }

  const handleAccept = async (interventionId: string) => {
    try {
      const ref = doc(db, 'assignedInterventions', interventionId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return

      const data = snap.data()

      // find the participant's application
      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('participantId', '==', data.participantId)
        )
      )
      if (appSnap.empty) {
        message.warning('Application not found for this participant.')
      }

      const assignedObj = {
        id: data.interventionId || interventionId,
        title: data.interventionTitle,
        consultantId: data.consultantId,
        groupId: data.groupId || null,
        assignedAt: Timestamp.now(),
        dueDate: data.dueDate || null
      }

      const batch = writeBatch(db)

      // update assignment status
      const next: any = { userStatus: 'accepted', updatedAt: Timestamp.now() }
      if (data.consultantStatus === 'accepted') {
        next.status = 'in-progress'
      }
      batch.update(ref, next)

      // update application.assigned[]
      if (!appSnap.empty) {
        const appRef = doc(db, 'applications', appSnap.docs[0].id)
        batch.update(appRef, {
          'interventions.assigned': arrayUnion(assignedObj)
        })
      }

      await batch.commit()

      // notify (unchanged)
      await addDoc(collection(db, 'notifications'), {
        participantId: data.participantId,
        consultantId: data.consultantId,
        interventionId,
        interventionTitle: data.interventionTitle,
        type: 'intervention-accepted',
        recipientRoles: ['projectadmin', 'consultant', 'beneficiary'],
        message: {
          consultant: `Beneficiary ${data.beneficiaryName} accepted the intervention: ${data.interventionTitle}.`,
          projectadmin: `Beneficiary ${data.beneficiaryName} accepted the intervention.`,
          beneficiary: `You accepted the intervention: ${data.interventionTitle}.`
        },
        createdAt: new Date(),
        readBy: {}
      })

      message.success('Intervention accepted.')
      setPendingInterventions(prev =>
        prev.filter(item => item.id !== interventionId)
      )
    } catch (e) {
      console.error(e)
      message.error('Failed to accept intervention.')
    }
  }

  const handleDecline = async () => {
    if (!selectedInterventionId) return
    try {
      const ref = doc(db, 'assignedInterventions', selectedInterventionId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return

      const data = snap.data()

      await updateDoc(ref, {
        userStatus: 'declined',
        declineReason,
        updatedAt: new Date().toISOString()
      })

      await addDoc(collection(db, 'notifications'), {
        participantId: data.participantId,
        consultantId: data.consultantId,
        interventionId: selectedInterventionId,
        interventionTitle: data.interventionTitle,
        type: 'intervention-declined',
        recipientRoles: ['projectadmin', 'consultant', 'beneficiary'],
        message: {
          consultant: `Beneficiary ${data.beneficiaryName} declined the intervention: ${data.interventionTitle}.`,
          projectadmin: `Beneficiary ${data.beneficiaryName} declined the intervention.`,
          beneficiary: `You declined the intervention: ${data.interventionTitle}.`
        },
        reason: declineReason,
        createdAt: new Date(),
        readBy: {}
      })

      setPendingInterventions(prev =>
        prev.filter(item => item.id !== selectedInterventionId)
      )

      setDeclineModalVisible(false)
      setDeclineReason('')
      setSelectedInterventionId(null)
      message.success('Intervention declined.')
    } catch (err) {
      console.error(err)
      message.error('Failed to decline intervention.')
    }
  }

  const handleRejectCompletion = async () => {
    if (!selectedIntervention || !rejectReason.trim()) {
      return message.warning('Please provide a reason.')
    }

    const ref = doc(db, 'assignedInterventions', selectedIntervention.id)

    await updateDoc(ref, {
      userCompletionStatus: 'rejected',
      rejectionReason: rejectReason,
      updatedAt: new Date()
    })

    await addDoc(collection(db, 'notifications'), {
      participantId: selectedIntervention.participantId,
      consultantId: selectedIntervention.consultantId,
      interventionId: selectedIntervention.id,
      interventionTitle: selectedIntervention.interventionTitle,
      type: 'completion-rejected',
      recipientRoles: ['projectadmin', 'consultant', 'beneficiary'],
      message: {
        consultant: `Beneficiary ${selectedIntervention.beneficiaryName} rejected the completion of: ${selectedIntervention.interventionTitle}.`,
        projectadmin: `Completion rejected for: ${selectedIntervention.interventionTitle}.`,
        beneficiary: `You rejected the completion of: ${selectedIntervention.interventionTitle}.`
      },
      reason: rejectReason,
      createdAt: new Date(),
      readBy: {}
    })

    message.success('Intervention completion rejected.')

    setIsRejectModalVisible(false)
    setRejectReason('')
  }

  const handleConfirmIntervention = async () => {
    if (!selectedIntervention) return
    const aiRef = doc(db, 'assignedInterventions', selectedIntervention.id)

    // fetch participant for denorm fields (you already do this)
    const participantSnap = await getDoc(
      doc(db, 'participants', selectedIntervention.participantId)
    )
    const participant = participantSnap.exists() ? participantSnap.data() : {}

    // find application doc
    const appSnap = await getDocs(
      query(
        collection(db, 'applications'),
        where('participantId', '==', selectedIntervention.participantId)
      )
    )

    // Objects to store in arrays
    const assignedObj = {
      id: selectedIntervention.interventionId || selectedIntervention.id,
      title: selectedIntervention.interventionTitle,
      consultantId: selectedIntervention.consultantId,
      groupId: selectedIntervention.groupId || null,
      assignedAt: selectedIntervention.createdAt?.toDate?.() || new Date(),
      dueDate: selectedIntervention.dueDate || null
    }

    const completedObj = {
      id: selectedIntervention.interventionId || selectedIntervention.id,
      title: selectedIntervention.interventionTitle,
      consultantId: selectedIntervention.consultantId,
      groupId: selectedIntervention.groupId || null,
      confirmedAt: Timestamp.now(),
      timeSpent: selectedIntervention.timeSpent || 0,
      rating: feedbackRating,
      comments: feedbackComments || ''
    }

    // create interventionsDatabase doc with explicit id in a batch
    const dbRef = doc(collection(db, 'interventionsDatabase'))

    const batch = writeBatch(db)

    // 1) update assignedInterventions + feedback
    batch.update(aiRef, {
      userCompletionStatus: 'confirmed',
      feedback: { rating: feedbackRating, comments: feedbackComments },
      updatedAt: Timestamp.now(),
      status: 'completed'
    })

    // 2) add to interventionsDatabase
    batch.set(dbRef, {
      programId: participant.programId || '',
      companyCode: participant.companyCode || '',
      interventionId: selectedIntervention.interventionId,
      interventionTitle: selectedIntervention.interventionTitle,
      areaOfSupport: selectedIntervention.areaOfSupport || 'Area',
      participantId: selectedIntervention.participantId,
      beneficiaryName:
        selectedIntervention.beneficiaryName || participant.beneficiaryName,
      hub: participant.hub || '',
      province: participant.province || '',
      quarter: getQuarter(new Date()),
      consultantIds: [selectedIntervention.consultantId],
      timeSpent: [selectedIntervention.timeSpent || 0],
      interventionType: selectedIntervention.type,
      targetMetric: selectedIntervention.targetMetric,
      targetType: selectedIntervention.targetType,
      targetValue: selectedIntervention.targetValue,
      feedback: { rating: feedbackRating, comments: feedbackComments },
      confirmedAt: Timestamp.now(),
      createdAt: selectedIntervention.createdAt?.toDate?.() || new Date(),
      updatedAt: Timestamp.now()
    })

    // 3) update application arrays
    if (!appSnap.empty) {
      const appRef = doc(db, 'applications', appSnap.docs[0].id)
      batch.update(appRef, {
        'interventions.completed': arrayUnion(completedObj),
        // OPTIONAL: remove from assigned (requires exact match)
        'interventions.assigned': arrayRemove(assignedObj)
      })
    }

    await batch.commit()

    // notify (unchanged)
    await addDoc(collection(db, 'notifications'), {
      participantId: selectedIntervention.participantId,
      consultantId: selectedIntervention.consultantId,
      interventionId: selectedIntervention.id,
      interventionTitle: selectedIntervention.interventionTitle,
      type: 'intervention-confirmed',
      recipientRoles: ['projectadmin', 'consultant', 'beneficiary'],
      message: {
        consultant: `Beneficiary ${selectedIntervention.beneficiaryName} confirmed the completion of: ${selectedIntervention.interventionTitle}.`,
        projectadmin: `Completion confirmed for: ${selectedIntervention.interventionTitle}.`,
        beneficiary: `You confirmed the intervention: ${selectedIntervention.interventionTitle}.`
      },
      createdAt: new Date(),
      readBy: {}
    })

    message.success('Intervention confirmed and saved.')
    setConfirmModalVisible(false)
  }

  const handleMarkAsRead = async (id: string) => {
    const ref = doc(db, 'notifications', id)
    await updateDoc(ref, {
      [`readBy.${userRole}`]: true
    })
    setNotifications(prev =>
      prev.map(n =>
        n.id === id ? { ...n, readBy: { ...n.readBy, [userRole]: true } } : n
      )
    )
  }

  const handleMarkAsUnread = async (id: string) => {
    const ref = doc(db, 'notifications', id)
    await updateDoc(ref, {
      [`readBy.${userRole}`]: false
    })
    setNotifications(prev =>
      prev.map(n =>
        n.id === id ? { ...n, readBy: { ...n.readBy, [userRole]: false } } : n
      )
    )
  }
  // Notification filtering:
  const visibleNotifications = notifications.filter(n => {
    if (!userRole) return false
    const isRoleMatch = n.recipientRoles?.includes(userRole)
    const isParticipantMatch =
      userRole !== 'incubatee' || n.participantId === participantId
    return isRoleMatch && isParticipantMatch
  })

  const filteredNotifications = filterType
    ? visibleNotifications.filter(n => n.type === filterType)
    : visibleNotifications

  const unreadCount =
    userRole && visibleNotifications.length
      ? visibleNotifications.filter(n => !n.readBy?.[userRole]).length
      : 0
  const formatCurrencyAbbreviation = (value: number): string => {
    if (value >= 1_000_000_000)
      return `R ${(value / 1_000_000_000).toFixed(1)}B`
    if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `R ${(value / 1_000).toFixed(1)}K`
    return `R ${value}`
  }

  const openSurvey = (row: AssignedSurveyRow) => {
    const q = row.linkToken ? `?token=${row.linkToken}` : ''
    navigate(`/incubatee/surveys/${row.id}${q}`)
  }

  const surveyColumns = [
    {
      title: 'Form',
      dataIndex: 'title',
      key: 'title'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: AssignedSurveyRow['status']) => {
        const color =
          s === 'submitted' ? 'green' : s === 'in_progress' ? 'blue' : 'orange'
        const label = s.replace('_', ' ')
        return (
          <Tag color={color}>
            {label.charAt(0).toUpperCase() + label.slice(1)}
          </Tag>
        )
      }
    },
    {
      title: 'Delivery',
      dataIndex: 'deliveryMethod',
      key: 'deliveryMethod',
      render: (m: AssignedSurveyRow['deliveryMethod']) => (
        <Tag>{m === 'in_app' ? 'In-app' : 'Email link'}</Tag>
      )
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (v: any, r: AssignedSurveyRow) =>
        formatDateShort(v || r.createdAt)
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, row: AssignedSurveyRow) => {
        const label =
          row.status === 'submitted'
            ? 'View'
            : row.status === 'in_progress'
            ? 'Continue'
            : 'Start'
        return (
          <Button type='link' onClick={() => openSurvey(row)}>
            {label}
          </Button>
        )
      }
    }
  ]

  return (
    <Spin spinning={loading} tip='Loading...'>
      <div style={{ padding: '12px', minHeight: '100vh' }}>
        <Helmet>
          <title>Smart Incubation | Incubatee Dashboard</title>
        </Helmet>

        <Row gutter={[16, 16]}>
          <Row gutter={[16, 16]} style={{ width: '100%' }}>
            <Col xs={24} md={8}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card
                  hoverable
                  style={{
                    boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                    transition: 'all 0.3s ease',
                    borderRadius: 8,
                    border: '1px solid #d6e4ff',
                    height: '100%'
                  }}
                >
                  <Statistic
                    title='Participation Rate'
                    value={`${participation}%`}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </motion.div>
            </Col>

            <Col xs={24} md={8}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card
                  hoverable
                  style={{
                    boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                    transition: 'all 0.3s ease',
                    borderRadius: 8,
                    border: '1px solid #d6e4ff',
                    height: '100%'
                  }}
                >
                  <Statistic
                    title='Outstanding Documents'
                    value={outstandingDocs}
                    prefix={<FileTextOutlined />}
                  />
                </Card>
              </motion.div>
            </Col>

            <Col xs={24} md={8}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card
                  hoverable
                  style={{
                    boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                    transition: 'all 0.3s ease',
                    borderRadius: 8,
                    border: '1px solid #d6e4ff',
                    height: '100%'
                  }}
                >
                  <Statistic
                    title='Total Workers'
                    value={
                      permHeadcount.reduce((a, b) => a + b, 0) +
                      tempHeadcount.reduce((a, b) => a + b, 0)
                    }
                    prefix={<TeamOutlined />}
                  />
                </Card>
              </motion.div>
            </Col>
          </Row>

          {/* New Tool Cards */}
          {/* <Col xs={24} md={12}>
              <Card
                title='🌱 Sozo Dream Lab AI'
                type='inner'
                style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}
                extra={
                  <a
                    href='https://sozodreamlab.netlify.app/'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    Visit
                  </a>
                }
              >
                A smart AI driven automated tool for your audio, text and
                quantitative data analysis and insights.
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                title='📊 Quantilytix AI'
                type='inner'
                style={{ background: '#e6f7ff', borderColor: '#91d5ff' }}
                extra={
                  <a
                    href='https://quantilytix.co.za'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    Visit
                  </a>
                }
              >
                Manage your finances better and get advanced AI driven data
                analytics .
              </Card>
            </Col> */}

          <Col xs={24}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card
                hoverable
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #d6e4ff'
                }}
                title='Pending Interventions'
              >
                <List
                  itemLayout='horizontal'
                  dataSource={pendingInterventions}
                  renderItem={item => (
                    <List.Item
                      actions={
                        item.type === 'assignment'
                          ? [
                              <Button
                                type='link'
                                onClick={() => handleAccept(item.id)}
                              >
                                Accept
                              </Button>,
                              <Button
                                danger
                                type='link'
                                onClick={() => {
                                  setSelectedInterventionId(item.id)
                                  setDeclineModalVisible(true)
                                }}
                              >
                                Decline
                              </Button>
                            ]
                          : [
                              <Button
                                type='link'
                                onClick={() => {
                                  setSelectedIntervention(item.full)
                                  setConfirmModalVisible(true)
                                }}
                              >
                                Confirm
                              </Button>,
                              <Button
                                danger
                                type='link'
                                onClick={() => {
                                  setSelectedIntervention(item.full)
                                  setIsRejectModalVisible(true)
                                }}
                              >
                                Reject
                              </Button>
                            ]
                      }
                    >
                      <List.Item.Meta
                        title={item.title}
                        description={`Due: ${item.date}`}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </motion.div>
          </Col>

          <Col xs={24}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card
                hoverable
                title='My Surveys'
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #d6e4ff'
                }}
              >
                <Table
                  rowKey='id'
                  loading={loadingSurveys}
                  dataSource={assignedSurveys}
                  columns={surveyColumns as any}
                  pagination={{ pageSize: 8 }}
                  locale={{
                    emptyText: 'No surveys assigned yet.'
                  }}
                />
              </Card>
            </motion.div>
          </Col>
        </Row>

        <Modal
          title='Notifications'
          open={notificationsModalVisible}
          footer={null}
          onCancel={() => setNotificationsModalVisible(false)}
          width={700}
        >
          <Select
            placeholder='Filter by Type'
            allowClear
            style={{ marginBottom: 16, width: 300 }}
            onChange={val => setFilterType(val)}
          >
            <Option value='intervention-accepted'>Accepted</Option>
            <Option value='intervention-declined'>Declined</Option>
            <Option value='intervention-assigned'>Assigned</Option>
            <Option value='intervention-requested'>Requested</Option>
            <Option value='requested-intervention-accepted'>
              Req. Approved
            </Option>
            <Option value='requested-intervention-rejected'>
              Req. Rejected
            </Option>
            <Option value='consultant-assigned'>Consultant Assigned</Option>
          </Select>

          <List
            dataSource={filteredNotifications}
            renderItem={item => (
              <List.Item
                actions={[
                  item.readBy?.[userRole] ? (
                    <Button
                      size='small'
                      onClick={() => handleMarkAsUnread(item.id)}
                    >
                      Mark Unread
                    </Button>
                  ) : (
                    <Button
                      size='small'
                      onClick={() => handleMarkAsRead(item.id)}
                    >
                      Mark Read
                    </Button>
                  )
                ]}
              >
                <List.Item.Meta
                  title={item.message?.[userRole] || 'No message available'}
                  description={item.type}
                />
              </List.Item>
            )}
          />
        </Modal>

        <Modal
          title='Decline Intervention'
          open={declineModalVisible}
          onOk={handleDecline}
          onCancel={() => setDeclineModalVisible(false)}
        >
          <Input.TextArea
            rows={4}
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            placeholder='Enter reason...'
          />
        </Modal>

        <Modal
          title='Reject Completion'
          open={isRejectModalVisible}
          onCancel={() => {
            setIsRejectModalVisible(false)
            setRejectReason('')
          }}
          onOk={handleRejectCompletion}
          okButtonProps={{ danger: true }}
          okText='Submit Rejection'
        >
          <Input.TextArea
            rows={4}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder='Please explain why you’re rejecting this intervention’s completion...'
          />
        </Modal>

        <Button
          type='primary'
          shape='circle'
          icon={
            <Badge count={unreadCount}>
              <BellOutlined />
            </Badge>
          }
          style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}
          onClick={() => setNotificationsModalVisible(true)}
        />
      </div>
      <Modal
        title='Confirm Intervention Completion'
        open={confirmModalVisible}
        footer={[
          <Button key='reject' danger onClick={handleRejectCompletion}>
            Reject Completion
          </Button>,
          <Button key='cancel' onClick={() => setConfirmModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key='submit'
            type='primary'
            onClick={handleConfirmIntervention}
          >
            Confirm Completion
          </Button>
        ]}
        onCancel={() => setConfirmModalVisible(false)}
        onOk={handleConfirmIntervention}
      >
        <p>
          <strong>{selectedIntervention?.interventionTitle}</strong>
        </p>
        <p>Are you confirming this intervention was completed successfully?</p>
        <Input
          placeholder='Feedback comments'
          value={feedbackComments}
          onChange={e => setFeedbackComments(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <Rate
          value={feedbackRating}
          onChange={setFeedbackRating}
          style={{ marginBottom: 8 }}
        />
      </Modal>
    </Spin>
  )
}
