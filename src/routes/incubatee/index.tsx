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
  Alert
} from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import {
  BellOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  TeamOutlined
} from '@ant-design/icons'
import {
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

const { Title } = Typography
const { Option } = Select

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May']
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
  consultantCompletionStatus: 'none' | 'done'
  userCompletionStatus: 'none' | 'confirmed' | 'rejected'

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
  const [expandedChart, setExpandedChart] = useState<
    'revenue' | 'avgRevenue' | null
  >(null)

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
        const revMonthly = participant.revenueHistory?.monthly || {}
        const headMonthly = participant.headcountHistory?.monthly || {}
        const sortedMonths = Object.keys(revMonthly).sort()

        setRevenueData(sortedMonths.map(m => revMonthly[m] || 0))
        setAvgRevenueData(sortedMonths.map(m => (revMonthly[m] || 0) * 0.85))
        setPermHeadcount(sortedMonths.map(m => headMonthly[m]?.permanent || 0))
        setTempHeadcount(sortedMonths.map(m => headMonthly[m]?.temporary || 0))
        setParticipation(participant.interventions?.participationRate || 0)

        // Compliance Docs
        const docs = participant.complianceDocuments || []
        const invalidDocs = docs.filter((doc: any) => doc.status !== 'valid')
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
            item.userCompletionStatus === 'none'
        )

        setPendingInterventions(
          [...pending, ...needsConfirmation].map(item => ({
            id: item.id,
            title: item.interventionTitle,
            date: item.dueDate || 'TBD'
          }))
        )

        setLoading(false)
      })
    }

    fetchData()
  }, [])

  const handleAccept = async (interventionId: string) => {
    const ref = doc(db, 'assignedInterventions', interventionId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return

    const data = snap.data()

    await updateDoc(ref, {
      userStatus: 'accepted',
      updatedAt: new Date().toISOString()
    })

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

  const revenueChart: Highcharts.Options = {
    chart: { zoomType: 'xy' },
    title: { text: 'Revenue vs Workforce' },
    xAxis: [{ categories: months }],
    yAxis: [
      { title: { text: 'Revenue (ZAR)' } },
      { title: { text: 'Workers' }, opposite: true }
    ],
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          format: '{point.y}'
        }
      }
    },
    series: [
      { name: 'Permanent', type: 'column', data: permHeadcount, yAxis: 1 },
      { name: 'Temporary', type: 'column', data: tempHeadcount, yAxis: 1 },
      { name: 'Revenue', type: 'spline', data: revenueData }
    ]
  }

  const avgRevenueChart: Highcharts.Options = {
    chart: { type: 'spline' },
    title: { text: 'Total Revenue vs Avg Revenue' },
    xAxis: { categories: months },
    yAxis: { title: { text: 'Revenue (ZAR)' } },
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          format: '{point.y}'
        }
      }
    },
    tooltip: { shared: true },
    series: [
      {
        name: 'Total Revenue',
        type: 'spline',
        data: revenueData,
        color: '#52c41a'
      },
      {
        name: 'Avg Revenue',
        type: 'spline',
        data: avgRevenueData,
        color: '#faad14'
      }
    ]
  }

  return (
    <Spin spinning={loading} tip='Loading...'>
      <div style={{ padding: 24 }}>
        <Title level={3}>Incubatee Dashboard</Title>

        <Row gutter={[16, 16]}>
          <Row gutter={[16, 16]}>
            {/* Metrics Section */}
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title='Participation Rate'
                  value={`${participation}%`}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title='Outstanding Documents'
                  value={outstandingDocs}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title='Total Workers'
                  value={permHeadcount.at(-1) + tempHeadcount.at(-1)}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>

            {/* New Tool Cards */}
            <Col xs={24} md={12}>
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
            </Col>
          </Row>

          <Col xs={24}>
            <Card title='Pending Interventions'>
              <List
                itemLayout='horizontal'
                dataSource={pendingInterventions}
                renderItem={item => (
                  <List.Item
                    actions={[
                      <Button type='link' onClick={() => handleAccept(item.id)}>
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
                    ]}
                  >
                    <List.Item.Meta
                      title={item.title}
                      description={`Due: ${item.date}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          <Col xs={24}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card
                  title='Revenue vs Workforce'
                  extra={
                    <Button
                      type='link'
                      onClick={() => setExpandedChart('revenue')}
                    >
                      Expand
                    </Button>
                  }
                >
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={revenueChart}
                  />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card
                  title='Total Revenue vs Avg Revenue'
                  extra={
                    <Button
                      type='link'
                      onClick={() => setExpandedChart('avgRevenue')}
                    >
                      Expand
                    </Button>
                  }
                >
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={avgRevenueChart}
                  />
                </Card>
              </Col>
            </Row>
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
          title={
            expandedChart === 'revenue'
              ? 'Expanded: Revenue vs Workforce'
              : 'Expanded: Total Revenue vs Avg Revenue'
          }
          open={!!expandedChart}
          onCancel={() => setExpandedChart(null)}
          footer={null}
          width={900}
        >
          {expandedChart === 'revenue' && (
            <HighchartsReact highcharts={Highcharts} options={revenueChart} />
          )}
          {expandedChart === 'avgRevenue' && (
            <HighchartsReact
              highcharts={Highcharts}
              options={avgRevenueChart}
            />
          )}
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
    </Spin>
  )
}
