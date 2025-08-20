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
  Rate
} from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { BellOutlined, CheckCircleOutlined, FileTextOutlined, TeamOutlined } from '@ant-design/icons'
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
import { Helmet } from 'react-helmet'
import { motion } from 'framer-motion'

const { Title } = Typography
const { Option } = Select

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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
  createdAt: any
  updatedAt: any
  type: 'singular' | 'recurring'
  targetType: 'percentage' | 'metric' | 'custom'
  targetMetric: string
  targetValue: number
  timeSpent: number

  consultantStatus: 'pending' | 'accepted' | 'declined'
  userStatus: 'pending' | 'accepted' | 'declined'
  consultantCompletionStatus: 'pending' | 'done'
  userCompletionStatus: 'pending' | 'confirmed' | 'rejected'

  resources?: { type: 'document' | 'link'; label: string; link: string }[]

  feedback?: { rating: number; comments: string }

  consultant?: { name: string; email: string; expertise: string[]; rating: number }
}

export const IncubateeDashboard: React.FC = () => {
  // ---- Spacing & layout tokens (consistent everywhere) ----
  const SPACING = {
    page: 'clamp(12px, 3.2vw, 24px)',
    sectionGap: 16,
    cardPad: 16,
    gridGutter: 16,
    modalPad: 16,
  }

  const [revenueData, setRevenueData] = useState<number[]>([])
  const [avgRevenueData, setAvgRevenueData] = useState<number[]>([])
  const [permHeadcount, setPermHeadcount] = useState<number[]>([])
  const [tempHeadcount, setTempHeadcount] = useState<number[]>([])
  const [participation, setParticipation] = useState<number>(0)
  const [outstandingDocs, setOutstandingDocs] = useState<number>(0)
  const [pendingInterventions, setPendingInterventions] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false)
  const [declineModalVisible, setDeclineModalVisible] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [selectedInterventionId, setSelectedInterventionId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'consultant' | 'incubatee' | 'operations' | 'director'>()
  const [participantId, setParticipantId] = useState<string>('')
  const [filterType, setFilterType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedChart, setExpandedChart] = useState<'revenue' | 'avgRevenue' | null>(null)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false)
  const [selectedIntervention, setSelectedIntervention] = useState<AssignedIntervention | null>(null)
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
        const userData = userSnap.docs[0].data() as any
        const normalized = (userData.role || '').toLowerCase().replace(/\s+/g, '')
        setUserRole(normalized)
      }
    }

    fetchUserRole()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      const authInst = getAuth()
      onAuthStateChanged(authInst, async user => {
        if (!user) return

        const snapshot = await getDocs(
          query(collection(db, 'participants'), where('email', '==', user.email))
        )

        if (snapshot.empty) return

        const participantDoc = snapshot.docs[0]
        const participant = participantDoc.data() as any
        const pid = participantDoc.id
        setParticipantId(pid)

        // Month labels (full) to match data record keys
        const monthLabels = [
          'January','February','March','April','May','June',
          'July','August','September','October','November','December'
        ]

        // Revenue
        const revMonthly = participant?.revenueHistory?.monthly || {}
        const computedRevenue = monthLabels.map(month => {
          const monthly = revMonthly[month]
          const flat = participant[`revenue_${month}`]
          return typeof monthly === 'number' ? monthly : typeof flat === 'number' ? flat : 0
        })
        setRevenueData(computedRevenue)
        // Average revenue derived from computed revenue
        setAvgRevenueData(computedRevenue.map(v => Math.round(v * 0.85)))

        // Headcount
        const headMonthly = participant?.headcountHistory?.monthly || {}
        setPermHeadcount(
          monthLabels.map(month => {
            const monthly = headMonthly[month]?.permanent
            const flat = participant[`permHeadcount_${month}`]
            return typeof monthly === 'number' ? monthly : typeof flat === 'number' ? flat : 0
          })
        )
        setTempHeadcount(
          monthLabels.map(month => {
            const monthly = headMonthly[month]?.temporary
            const flat = participant[`tempHeadcount_${month}`]
            return typeof monthly === 'number' ? monthly : typeof flat === 'number' ? flat : 0
          })
        )

        setParticipation(participant?.interventions?.participationRate || 0)

        // Compliance Docs
        const applicationSnap = await getDocs(
          query(collection(db, 'applications'), where('participantId', '==', pid))
        )

        let complianceDocs: any[] = []
        if (!applicationSnap.empty) {
          const appData = applicationSnap.docs[0].data() as any
          complianceDocs = appData.complianceDocuments || []
        }
        const invalidDocs = complianceDocs.filter((d: any) => !['valid', 'approved'].includes(d.status))
        setOutstandingDocs(invalidDocs.length)

        // Notifications
        const notificationsSnap = await getDocs(
          query(collection(db, 'notifications'), where('participantId', '==', pid))
        )
        setNotifications(
          notificationsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }))
        )

        // Interventions
        const interventionsSnap = await getDocs(
          query(collection(db, 'assignedInterventions'), where('participantId', '==', pid))
        )
        const interventionsData: AssignedIntervention[] = interventionsSnap.docs.map(d => ({
          id: d.id, ...(d.data() as Omit<AssignedIntervention, 'id'>)
        }))

        const pending = interventionsData.filter(
          item => item.consultantStatus === 'accepted' && item.userStatus === 'pending'
        )
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
            full: item
          }))
        )

        setLoading(false)
      })
    }

    fetchData()
  }, [])

  const formatDueDate = (dueDate: any): string => {
    if (!dueDate) return 'TBD'
    if (dueDate?.seconds) return dayjs(dueDate.seconds * 1000).format('YYYY-MM-DD')
    if (typeof dueDate === 'string' || dueDate instanceof Date) {
      return dayjs(dueDate).isValid() ? dayjs(dueDate).format('YYYY-MM-DD') : 'TBD'
    }
    return 'TBD'
  }

  const getQuarter = (date: any) => {
    const d = date instanceof Date ? date : new Date(date)
    const month = d.getMonth()
    return `Q${Math.floor(month / 3) + 1}`
  }

  const handleAccept = async (interventionId: string) => {
    try {
      const ref = doc(db, 'assignedInterventions', interventionId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return

      const data = snap.data() as any

      const appSnap = await getDocs(
        query(collection(db, 'applications'), where('participantId', '==', data.participantId))
      )

      const assignedObj = {
        id: data.interventionId || interventionId,
        title: data.interventionTitle,
        consultantId: data.consultantId,
        groupId: data.groupId || null,
        assignedAt: Timestamp.now(),
        dueDate: data.dueDate || null
      }

      const batch = writeBatch(db)
      const next: any = { userStatus: 'accepted', updatedAt: Timestamp.now() }
      if (data.consultantStatus === 'accepted') next.status = 'in-progress'
      batch.update(ref, next)

      if (!appSnap.empty) {
        const appRef = doc(db, 'applications', appSnap.docs[0].id)
        batch.update(appRef, { 'interventions.assigned': arrayUnion(assignedObj) })
      }

      await batch.commit()

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
      setPendingInterventions(prev => prev.filter(item => item.id !== interventionId))
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

      const data = snap.data() as any

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

      setPendingInterventions(prev => prev.filter(item => item.id !== selectedInterventionId))

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
    if (!selectedIntervention || !rejectReason.trim()) return message.warning('Please provide a reason.')

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

    const participantSnap = await getDoc(doc(db, 'participants', selectedIntervention.participantId))
    const participant = participantSnap.exists() ? (participantSnap.data() as any) : {}

    const appSnap = await getDocs(
      query(collection(db, 'applications'), where('participantId', '==', selectedIntervention.participantId))
    )

    const assignedObj = {
      id: selectedIntervention.interventionId || selectedIntervention.id,
      title: selectedIntervention.interventionTitle,
      consultantId: selectedIntervention.consultantId,
      groupId: (selectedIntervention as any).groupId || null,
      assignedAt: selectedIntervention.createdAt?.toDate?.() || new Date(),
      dueDate: selectedIntervention.dueDate || null
    }

    const completedObj = {
      id: selectedIntervention.interventionId || selectedIntervention.id,
      title: selectedIntervention.interventionTitle,
      consultantId: selectedIntervention.consultantId,
      groupId: (selectedIntervention as any).groupId || null,
      confirmedAt: Timestamp.now(),
      timeSpent: selectedIntervention.timeSpent || 0,
      rating: feedbackRating,
      comments: feedbackComments || ''
    }

    const dbRef = doc(collection(db, 'interventionsDatabase'))
    const batch = writeBatch(db)

    batch.update(aiRef, {
      userCompletionStatus: 'confirmed',
      feedback: { rating: feedbackRating, comments: feedbackComments },
      updatedAt: Timestamp.now(),
      status: 'completed'
    })

    batch.set(dbRef, {
      programId: participant.programId || '',
      companyCode: participant.companyCode || '',
      interventionId: selectedIntervention.interventionId,
      interventionTitle: selectedIntervention.interventionTitle,
      areaOfSupport: selectedIntervention.areaOfSupport || 'Area',
      participantId: selectedIntervention.participantId,
      beneficiaryName: selectedIntervention.beneficiaryName || participant.beneficiaryName,
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

    if (!appSnap.empty) {
      const appRef = doc(db, 'applications', appSnap.docs[0].id)
      batch.update(appRef, {
        'interventions.completed': arrayUnion(completedObj),
        'interventions.assigned': arrayRemove(assignedObj)
      })
    }

    await batch.commit()

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
    if (!userRole) return
    const ref = doc(db, 'notifications', id)
    await updateDoc(ref, { [`readBy.${userRole}`]: true })
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, readBy: { ...n.readBy, [userRole]: true } } : n)))
  }

  const handleMarkAsUnread = async (id: string) => {
    if (!userRole) return
    const ref = doc(db, 'notifications', id)
    await updateDoc(ref, { [`readBy.${userRole}`]: false })
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, readBy: { ...n.readBy, [userRole]: false } } : n)))
  }

  const visibleNotifications = notifications.filter(n => {
    if (!userRole) return false
    const isRoleMatch = n.recipientRoles?.includes(userRole)
    const isParticipantMatch = userRole !== 'incubatee' || n.participantId === participantId
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
    if (value >= 1_000_000_000) return `R ${(value / 1_000_000_000).toFixed(1)}B`
    if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `R ${(value / 1_000).toFixed(1)}K`
    return `R ${value}`
  }

  // ---- Charts (with responsive rules) ----
  const revenueChart: Highcharts.Options = {
    chart: { zoomType: 'xy', spacing: [8, 8, 8, 8] },
    title: { text: 'Revenue vs Workforce' },
    credits: { enabled: false },
    xAxis: [{ categories: months, crosshair: true }],
    yAxis: [
      { title: { text: 'Revenue (ZAR)' } },
      { title: { text: 'Workers' }, opposite: true }
    ],
    legend: { itemStyle: { fontSize: '12px' } },
    plotOptions: {
      series: { dataLabels: { style: { textOutline: 'none' } } },
      column: { pointPadding: 0.1, borderWidth: 0 }
    },
    tooltip: { shared: true },
    series: [
      {
        name: 'Permanent',
        type: 'column',
        data: permHeadcount,
        yAxis: 1,
        dataLabels: {
          enabled: true,
          formatter: function () { return this.y && this.y > 0 ? this.y : null }
        }
      },
      {
        name: 'Temporary',
        type: 'column',
        data: tempHeadcount,
        yAxis: 1,
        dataLabels: {
          enabled: true,
          formatter: function () { return this.y && this.y > 0 ? this.y : null }
        }
      },
      {
        name: 'Revenue',
        type: 'spline',
        data: revenueData,
        dataLabels: {
          enabled: true,
          formatter: function () { return this.y && this.y > 0 ? formatCurrencyAbbreviation(this.y as number) : null }
        }
      }
    ],
    responsive: {
      rules: [
        {
          condition: { maxWidth: 575 },
          chartOptions: {
            legend: { layout: 'horizontal', align: 'center', verticalAlign: 'bottom' },
            yAxis: [{ title: { text: '' } }, { title: { text: '' } }],
          }
        }
      ]
    }
  }

  const avgRevenueChart: Highcharts.Options = {
    chart: { type: 'spline', spacing: [8, 8, 8, 8] },
    title: { text: 'Total Revenue vs Average Revenue' },
    credits: { enabled: false },
    xAxis: { categories: months },
    yAxis: { title: { text: 'Revenue (ZAR)' } },
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          formatter: function () {
            return this.y && (this.y as number) > 0 ? formatCurrencyAbbreviation(this.y as number) : null
          }
        }
      }
    },
    tooltip: { shared: true },
    series: [
      { name: 'Total Revenue', type: 'spline', data: revenueData },
      { name: 'Average Revenue', type: 'spline', data: avgRevenueData }
    ],
    responsive: {
      rules: [
        {
          condition: { maxWidth: 575 },
          chartOptions: {
            legend: { layout: 'horizontal', align: 'center', verticalAlign: 'bottom' },
            yAxis: { title: { text: '' } },
          }
        }
      ]
    }
  }

  return (
    <Spin spinning={loading} tip='Loading...'>
      <div
        style={{
          padding: SPACING.page,
          minHeight: '100vh',
          background: '#fff',
          display: 'grid',
          gap: SPACING.sectionGap
        }}
      >
        <Helmet>
          <title>Smart Incubation | Incubatee Dashboard</title>
        </Helmet>

        {/* Page-level responsive helpers */}
        <style>{`
          .card-body-pad .ant-card-body { padding: ${SPACING.cardPad}px !important; }
          /* Smooth list spacing on mobile */
          @media (max-width: 575px) {
            .ant-statistic-title { font-size: 12px; }
            .ant-statistic-content { font-size: 18px; }
          }
          /* Table responsiveness helper */
          .table-wrap { width: 100%; overflow-x: auto; }
          .table-wrap table { min-width: 640px; }
        `}</style>

        {/* KPIs */}
        <Row gutter={[SPACING.gridGutter, SPACING.gridGutter]}>
          <Col xs={24} md={8}>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <Card
                hoverable
                className='card-body-pad'
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #d6e4ff',
                  height: '100%'
                }}
              >
                <Statistic title='Participation Rate' value={`${participation}%`} prefix={<CheckCircleOutlined />} />
              </Card>
            </motion.div>
          </Col>

          <Col xs={24} md={8}>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <Card
                hoverable
                className='card-body-pad'
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #d6e4ff',
                  height: '100%'
                }}
              >
                <Statistic title='Outstanding Documents' value={outstandingDocs} prefix={<FileTextOutlined />} />
              </Card>
            </motion.div>
          </Col>

          <Col xs={24} md={8}>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <Card
                hoverable
                className='card-body-pad'
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
                  value={permHeadcount.reduce((a, b) => a + b, 0) + tempHeadcount.reduce((a, b) => a + b, 0)}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </motion.div>
          </Col>
        </Row>

        {/* Pending Interventions */}
        <Card
          hoverable
          className='card-body-pad'
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
                style={{ paddingInline: 0 }}
                actions={
                  item.type === 'assignment'
                    ? [
                        <Button key='accept' type='link' onClick={() => handleAccept(item.id)}>
                          Accept
                        </Button>,
                        <Button
                          key='decline'
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
                          key='confirm'
                          type='link'
                          onClick={() => {
                            setSelectedIntervention(item.full)
                            setConfirmModalVisible(true)
                          }}
                        >
                          Confirm
                        </Button>,
                        <Button
                          key='reject'
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
                <List.Item.Meta title={item.title} description={`Due: ${item.date}`} />
              </List.Item>
            )}
          />
        </Card>

        {/* Charts */}
        <Row gutter={[SPACING.gridGutter, SPACING.gridGutter]}>
          <Col xs={24} lg={12}>
            <Card
              hoverable
              className='card-body-pad'
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #d6e4ff'
              }}
              title='Revenue vs Workforce'
              extra={
                <Button size='small' onClick={() => setExpandedChart('revenue')}>
                  Expand
                </Button>
              }
            >
              <HighchartsReact highcharts={Highcharts} options={revenueChart} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              hoverable
              className='card-body-pad'
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #d6e4ff'
              }}
              title='Total Revenue vs Average Revenue'
              extra={
                <Button size='small' onClick={() => setExpandedChart('avgRevenue')}>
                  Expand
                </Button>
              }
            >
              <HighchartsReact highcharts={Highcharts} options={avgRevenueChart} />
            </Card>
          </Col>
        </Row>

        {/* Notifications FAB */}
        <Button
          type='primary'
          shape='circle'
          icon={
            <Badge count={unreadCount} size='small'>
              <BellOutlined />
            </Badge>
          }
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.16)'
          }}
          onClick={() => setNotificationsModalVisible(true)}
        />

        {/* Notifications Modal */}
        <Modal
          title='Notifications'
          open={notificationsModalVisible}
          footer={null}
          onCancel={() => setNotificationsModalVisible(false)}
          styles={{ body: { padding: SPACING.modalPad } }}
          width='min(92vw, 760px)'
        >
          <Select
            placeholder='Filter by Type'
            allowClear
            style={{ marginBottom: 16, width: 'min(100%, 320px)' }}
            onChange={val => setFilterType(val)}
          >
            <Option value='intervention-accepted'>Accepted</Option>
            <Option value='intervention-declined'>Declined</Option>
            <Option value='intervention-assigned'>Assigned</Option>
            <Option value='intervention-requested'>Requested</Option>
            <Option value='requested-intervention-accepted'>Req. Approved</Option>
            <Option value='requested-intervention-rejected'>Req. Rejected</Option>
            <Option value='consultant-assigned'>Consultant Assigned</Option>
          </Select>

          <List
            dataSource={filteredNotifications}
            renderItem={item => (
              <List.Item
                style={{ paddingInline: 0 }}
                actions={[
                  userRole && item.readBy?.[userRole] ? (
                    <Button size='small' onClick={() => handleMarkAsUnread(item.id)} key='unread'>
                      Mark Unread
                    </Button>
                  ) : (
                    <Button size='small' onClick={() => handleMarkAsRead(item.id)} key='read'>
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

        {/* Decline Modal */}
        <Modal
          title='Decline Intervention'
          open={declineModalVisible}
          onOk={handleDecline}
          onCancel={() => setDeclineModalVisible(false)}
          styles={{ body: { padding: SPACING.modalPad } }}
          width='min(92vw, 600px)'
        >
          <Input.TextArea
            rows={4}
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            placeholder='Enter reason...'
          />
        </Modal>

        {/* Reject Completion Modal */}
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
          styles={{ body: { padding: SPACING.modalPad } }}
          width='min(92vw, 600px)'
        >
          <Input.TextArea
            rows={4}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder='Please explain why you’re rejecting this intervention’s completion...'
          />
        </Modal>

        {/* Expanded Chart Modal */}
        <Modal
          title={
            expandedChart === 'revenue'
              ? 'Expanded: Revenue vs Workforce'
              : 'Expanded: Total Revenue vs Average Revenue'
          }
          open={!!expandedChart}
          onCancel={() => setExpandedChart(null)}
          footer={null}
          styles={{ body: { padding: SPACING.modalPad } }}
          width='min(96vw, 980px)'
        >
          {expandedChart === 'revenue' && (
            <HighchartsReact highcharts={Highcharts} options={revenueChart} />
          )}
          {expandedChart === 'avgRevenue' && (
            <HighchartsReact highcharts={Highcharts} options={avgRevenueChart} />
          )}
        </Modal>

        {/* Confirm Completion Modal */}
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
            <Button key='submit' type='primary' onClick={handleConfirmIntervention}>
              Confirm Completion
            </Button>
          ]}
          onCancel={() => setConfirmModalVisible(false)}
          styles={{ body: { padding: SPACING.modalPad } }}
          width='min(92vw, 640px)'
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
          <Rate value={feedbackRating} onChange={setFeedbackRating} style={{ marginBottom: 8 }} />
        </Modal>
      </div>
    </Spin>
  )
}

export default IncubateeDashboard
