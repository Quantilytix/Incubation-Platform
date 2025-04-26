import React, { useState } from 'react'
import {
  Row,
  Col,
  Card,
  Typography,
  Statistic,
  Tag,
  Button,
  List,
  message,
  Modal,
  Input
} from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import {
  RiseOutlined,
  SmileOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import { useEffect } from 'react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/firebase'
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
import { BellOutlined } from '@ant-design/icons'
import { Badge } from 'antd'
import { useNavigate } from 'react-router-dom'
import { Rate } from 'antd'

const { Title } = Typography

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May']

const headPerm = [30, 32, 35, 37, 40]
const headTemp = [10, 12, 15, 14, 13]
const productivity = [1.2, 1.3, 1.5, 1.6, 1.7]
const outstandingDocs = [5, 4, 3, 2, 1]

// 🔹 Headcount Trend Line
const headcountTrendChart: Highcharts.Options = {
  chart: { type: 'line' },
  title: { text: 'Monthly Headcount (Permanent vs Temporary)' },
  xAxis: { categories: months },
  yAxis: { title: { text: 'Employees' } },
  series: [
    { name: 'Permanent', type: 'line', data: headPerm },
    { name: 'Temporary', type: 'line', data: headTemp }
  ]
}

export const IncubateeDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [revenueData, setRevenueData] = useState<number[]>([])
  const [avgRevenueData, setAvgRevenueData] = useState<number[]>([])
  const [permHeadcount, setPermHeadcount] = useState<number[]>([])
  const [tempHeadcount, setTempHeadcount] = useState<number[]>([])
  const [participation, setParticipation] = useState<number>(0)
  const [pendingInterventions, setPendingInterventions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [declineModalVisible, setDeclineModalVisible] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [selectedInterventionId, setSelectedInterventionId] = useState<
    string | null
  >(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notificationsModalVisible, setNotificationsModalVisible] =
    useState(false)
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [selectedNotification, setSelectedNotification] = useState<any>(null)

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

        if (!snapshot.empty) {
          const participant = snapshot.docs[0].data()
          const participantDoc = snapshot.docs[0]
          const participantData = participantDoc.data()
          const participantId = participantDoc.id

          const revMonthly = participant.revenueHistory?.monthly || {}
          const headMonthly = participant.headcountHistory?.monthly || {}

          const monthsSorted = Object.keys(revMonthly).sort() // e.g. ['2024-01', '2024-02']
          const revenueVals = monthsSorted.map(month => revMonthly[month])
          const avgRev = revenueVals.map(val => val * 0.85) // Placeholder for average logic
          const headVals = monthsSorted.map(month => headMonthly[month] || 0)
          //  Fetch Notifications
          const notificationsSnap = await getDocs(
            query(
              collection(db, 'notifications'),
              where('participantId', '==', participantId)
            )
          )

          const notis = notificationsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))

          setNotifications(notis)
          setRevenueData(revenueVals)
          setAvgRevenueData(avgRev)
          setPermHeadcount(headVals) // assuming all headcount = perm
          setTempHeadcount(headVals.map(val => Math.floor(val * 0.25))) // mock logic
          setParticipation(participant.interventions?.participationRate || 0)
        }

        // Load pending interventions
        const interventionSnap = await getDocs(
          query(
            collection(db, 'assignedInterventions'),
            where('participantId', '==', snapshot.docs[0].id),
            where('status', '==', 'assigned')
          )
        )
        const pending = interventionSnap.docs.map(doc => ({
          id: doc.id,
          title: doc.data().interventionTitle,
          date: doc.data().dueDate // placeholder, unless you have a `dueDate`
        }))
        setPendingInterventions(pending)

        setLoading(false)
      })
    }

    fetchData()
  }, [])
  const openFeedbackModal = (notification: any) => {
    setSelectedNotification(notification)
    setFeedbackModalVisible(true)
  }

  const handleSubmitFeedback = async () => {
    if (!selectedNotification) return

    try {
      await addDoc(collection(db, 'feedbacks'), {
        participantId: selectedNotification.participantId,
        smeName: selectedNotification.participantName,
        consultantId: selectedNotification.consultantId || '',
        interventionTitle: selectedNotification.interventionTitle,
        comment: feedbackComment,
        createdAt: new Date()
      })

      message.success('Feedback submitted successfully!')
      setFeedbackModalVisible(false)
      setFeedbackComment('')
      setFeedbackRating(0)
      setSelectedNotification(null)
    } catch (error) {
      console.error('Error submitting feedback:', error)
      message.error('Failed to submit feedback.')
    }
  }

  const handleAccept = async (interventionId: string) => {
    try {
      await updateDoc(doc(db, 'assignedInterventions', interventionId), {
        status: 'pending'
      })
      message.success('Intervention accepted.')
      setPendingInterventions(prev =>
        prev.filter(item => item.id !== interventionId)
      )
    } catch (error) {
      console.error('Error accepting intervention:', error)
      message.error('Failed to accept intervention.')
    }
  }
  const showDeclineModal = (id: string) => {
    setSelectedInterventionId(id)
    setDeclineModalVisible(true)
  }

  const handleConfirmDecline = async () => {
    if (!selectedInterventionId) return

    try {
      const interventionDoc = doc(
        db,
        'assignedInterventions',
        selectedInterventionId
      )
      await updateDoc(interventionDoc, {
        status: 'declined'
      })

      await addDoc(collection(db, 'notifications'), {
        participantId: selectedInterventionId,
        message: `Intervention declined by participant.`,
        reason: declineReason,
        type: 'intervention-declined',
        recipientRole: 'admin',
        createdAt: new Date()
      })

      message.success('Declined and notification sent.')
      setPendingInterventions(prev =>
        prev.filter(item => item.id !== selectedInterventionId)
      )
      setDeclineModalVisible(false)
      setDeclineReason('')
      setSelectedInterventionId(null)
    } catch (error) {
      console.error('Decline failed:', error)
      message.error('Failed to decline.')
    }
  }

  // 🔹 Revenue + Workers Mixed Chart
  const revenueWorkersChart: Highcharts.Options = {
    chart: { zoomType: 'xy' },
    title: { text: 'Revenue vs Workforce' },
    xAxis: [{ categories: months }],
    yAxis: [
      { title: { text: 'Revenue (R)' } },
      { title: { text: 'Number of Workers' }, opposite: true }
    ],
    series: [
      {
        name: 'Permanent Workers',
        type: 'column',
        data: permHeadcount,
        yAxis: 1
      },
      {
        name: 'Temporary Workers',
        type: 'column',
        data: tempHeadcount,
        yAxis: 1
      },
      {
        name: 'Revenue',
        type: 'spline',
        data: revenueData,
        tooltip: { valuePrefix: 'R' }
      }
    ]
  }

  const totalVsAvgRevenueChart: Highcharts.Options = {
    chart: { type: 'spline' },
    title: { text: 'Total Revenue vs Avg Revenue' },
    xAxis: { categories: months },
    yAxis: {
      title: { text: 'Revenue (R)' },
      labels: {
        formatter: function () {
          return 'R' + Number(this.value).toLocaleString()
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
    <div style={{ padding: 24 }}>
      <Title level={3}>Incubatee Dashboard</Title>

      <Row gutter={[24, 24]}>
        {/* KPI Cards */}
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Participation Rate'
              value={`${participation}%`}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Outstanding Documents'
              value={outstandingDocs[outstandingDocs.length - 1]}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Productivity Ratio'
              value={productivity[productivity.length - 1]}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        {/* Pending Interventions */}
        <Col xs={24} lg={24}>
          <Card title='Pending Interventions'>
            <List
              itemLayout='horizontal'
              dataSource={pendingInterventions}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button
                      type='primary'
                      key='accept'
                      onClick={() => handleAccept(item.id)}
                    >
                      Accept
                    </Button>,
                    <Button
                      danger
                      key='decline'
                      onClick={() => showDeclineModal(item.id)}
                    >
                      Decline
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={item.title}
                    description={`Scheduled Date: ${item.date}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Chart: Revenue vs Workforce */}
        <Col span={24}>
          <Card>
            <HighchartsReact
              highcharts={Highcharts}
              options={revenueWorkersChart}
            />
          </Card>
        </Col>

        {/* Chart: Total vs Avg Revenue */}
        <Col span={24}>
          <Card>
            <HighchartsReact
              highcharts={Highcharts}
              options={totalVsAvgRevenueChart}
            />
          </Card>
        </Col>
      </Row>
      <Modal
        title='Provide Feedback'
        open={feedbackModalVisible}
        onCancel={() => setFeedbackModalVisible(false)}
        onOk={handleSubmitFeedback}
      >
        <Rate
          value={feedbackRating}
          onChange={value => setFeedbackRating(value)}
        />
        <Input.TextArea
          rows={4}
          value={feedbackComment}
          onChange={e => setFeedbackComment(e.target.value)}
          placeholder='Write your feedback here'
          style={{ marginTop: 16 }}
        />
      </Modal>

      <Modal
        title='Reason for Declining'
        open={declineModalVisible}
        onOk={handleConfirmDecline}
        onCancel={() => setDeclineModalVisible(false)}
        okText='Submit'
      >
        <Input.TextArea
          rows={4}
          value={declineReason}
          onChange={e => setDeclineReason(e.target.value)}
          placeholder='Please provide a reason for declining this intervention.'
        />
      </Modal>

      <Modal
        title='Notifications'
        open={notificationsModalVisible}
        onCancel={() => setNotificationsModalVisible(false)}
        footer={null}
        width={600}
      >
        <List
          itemLayout='horizontal'
          dataSource={notifications}
          renderItem={item => (
            <List.Item
              actions={[
                item.type === 'intervention-assigned' && (
                  <>
                    <Button
                      type='link'
                      onClick={() => handleAccept(item.interventionId)}
                    >
                      Accept
                    </Button>
                    <Button
                      danger
                      type='link'
                      onClick={() => showDeclineModal(item.interventionId)}
                    >
                      Decline
                    </Button>
                  </>
                ),
                item.type === 'intervention-completed' && (
                  <Button
                    type='primary'
                    onClick={() => openFeedbackModal(item)}
                  >
                    Confirm & Feedback
                  </Button>
                )
              ]}
            >
              <List.Item.Meta title={item.message} />
            </List.Item>
          )}
        />
      </Modal>
      <Button
        type='primary'
        shape='circle'
        icon={
          <Badge count={notifications.length} size='small'>
            <BellOutlined style={{ fontSize: 20 }} />
          </Badge>
        }
        size='large'
        style={{
          position: 'fixed',
          right: 32,
          bottom: 32,
          zIndex: 1000
        }}
        onClick={() => setNotificationsModalVisible(true)}
      />
    </div>
  )
}
