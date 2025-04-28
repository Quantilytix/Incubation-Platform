import React, { useEffect, useState } from 'react'
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
  BarChartOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { db } from '@/firebase'
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { Helmet } from 'react-helmet'

const { Title } = Typography

interface Intervention {
  id: string
  sme: string
  intervention: string
  sector: string
  stage: string
  location: string
  status: string
  declined: boolean
  declineReason: string
}

interface Feedback {
  id: string
  sme: string
  comment: string
}

export const ConsultantDashboard: React.FC = () => {
  const navigate = useNavigate()
  const auth = getAuth()

  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [currentDeclineId, setCurrentDeclineId] = useState<string | null>(null)
  const [consultantId, setConsultantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [ongoingCount, setOngoingCount] = useState(0)
  const [notificationsModalVisible, setNotificationsModalVisible] =
    useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (user) {
        const userSnap = await getDocs(
          query(collection(db, 'users'), where('email', '==', user.email))
        )
        if (!userSnap.empty) {
          const userData = userSnap.docs[0].data()
          if (userData.role) {
            setCurrentRole(userData.role.toLowerCase())
          }
        }
      }
      setRoleLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      if (!consultantId) return
      try {
        const interventionsSnap = await getDocs(
          query(
            collection(db, 'assignedInterventions'),
            where('consultantId', '==', consultantId),
            where('status', '==', 'assigned')
          )
        )

        const interventionList: Intervention[] = await Promise.all(
          interventionsSnap.docs.map(async docSnap => {
            const data = docSnap.data()
            let sector = 'Unknown'
            let stage = 'Unknown'
            let location = 'Unknown'

            if (data.participantId) {
              const participantSnap = await getDocs(
                query(
                  collection(db, 'participants'),
                  where('id', '==', data.participantId)
                )
              )
              if (!participantSnap.empty) {
                const participant = participantSnap.docs[0].data()
                sector = participant.sector || sector
                stage = participant.stage || stage
                location = participant.location || location
              }
            }

            return {
              id: docSnap.id,
              sme: data.smeName,
              intervention: data.interventionTitle,
              sector,
              stage,
              location,
              status: data.status,
              declined: data.status === 'declined',
              declineReason: data.declineReason || ''
            }
          })
        )

        const feedbackSnap = await getDocs(collection(db, 'feedbacks'))
        const feedbackList: Feedback[] = feedbackSnap.docs.map(docSnap => {
          const data = docSnap.data()
          return {
            id: docSnap.id,
            sme: data.smeName,
            comment: data.comment
          }
        })

        const inProgressSnap = await getDocs(
          query(
            collection(db, 'assignedInterventions'),
            where('consultantId', '==', consultantId),
            where('status', '==', 'in-progress')
          )
        )

        setOngoingCount(inProgressSnap.size)
        setInterventions(interventionList)
        setFeedbacks(feedbackList)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [consultantId])

  const fetchNotifications = async () => {
    if (!currentRole) {
      console.log('No currentRole - cannot fetch notifications')
      return
    }
    try {
      setLoadingNotifications(true)
      const notificationsSnap = await getDocs(
        query(
          collection(db, 'notifications'),
          where('recipientRole', 'array-contains', currentRole)
        )
      )

      const notificationsList = notificationsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      console.log('Fetched notificationsList:', notificationsList) // 🔥
      setNotifications(notificationsList)

      const unread = notificationsList.filter(
        item => !item.readBy?.[currentRole]
      ).length
      setUnreadCount(unread)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoadingNotifications(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    if (!currentRole) return
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        [`readBy.${currentRole}`]: true
      })

      setNotifications(prev =>
        prev.map(noti =>
          noti.id === notificationId
            ? { ...noti, readBy: { ...noti.readBy, [currentRole]: true } }
            : noti
        )
      )

      setUnreadCount(prev => Math.max(prev - 1, 0))
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const handleAccept = async (id: string) => {
    try {
      await updateDoc(doc(db, 'assignedInterventions', id), {
        status: 'in-progress'
      })
      message.success('Intervention accepted!')
      setInterventions(prev => prev.filter(item => item.id !== id))
    } catch (error) {
      console.error(error)
      message.error('Failed to accept intervention.')
    }
  }

  const handleDecline = (id: string) => {
    setCurrentDeclineId(id)
    setModalVisible(true)
  }

  const confirmDecline = async () => {
    if (!currentDeclineId) return
    try {
      await updateDoc(doc(db, 'assignedInterventions', currentDeclineId), {
        status: 'declined',
        declineReason
      })
      message.success('Intervention declined.')
      setInterventions(prev =>
        prev.filter(item => item.id !== currentDeclineId)
      )
      setModalVisible(false)
      setDeclineReason('')
      setCurrentDeclineId(null)
    } catch (error) {
      console.error(error)
      message.error('Failed to decline intervention.')
    }
  }

  const columns = [
    { title: 'SME Name', dataIndex: 'sme', key: 'sme' },
    { title: 'Intervention', dataIndex: 'intervention', key: 'intervention' },
    { title: 'Sector', dataIndex: 'sector', key: 'sector' },
    { title: 'Lifecycle Stage', dataIndex: 'stage', key: 'stage' },
    {
      title: 'Action',
      render: (_: any, record: Intervention) =>
        record.declined ? (
          <Tag color='red'>Declined</Tag>
        ) : (
          <Space>
            <Button
              type='link'
              icon={<CheckOutlined />}
              onClick={() => handleAccept(record.id)}
              style={{ color: 'green' }}
            >
              Accept
            </Button>
            <Button
              type='link'
              icon={<CloseOutlined />}
              onClick={() => handleDecline(record.id)}
              style={{ color: 'red' }}
            >
              Decline
            </Button>
          </Space>
        )
    }
  ]

  return (
    <div
      style={{
        padding: 24,
        height: '100vh',
        overflow: 'auto'
      }}
    >
      <Helmet>
        <title>Consultant Workspace | Smart Incubation</title>
      </Helmet>

      <Title level={3}>Consultant Workspace</Title>

      {loading ? (
        <div
          style={{
            height: '80vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Spin size='large' />
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {/* Top Stats */}
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title='Total Feedbacks'
                value={feedbacks.length}
                prefix={<MessageOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title='Pending Interventions'
                value={interventions.length}
                prefix={<FileSearchOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title='Ongoing Interventions'
                value={ongoingCount}
                prefix={<BarChartOutlined />}
              />
            </Card>
          </Col>

          {/* Allocated Interventions */}
          <Col span={24}>
            <Card title='Allocated Interventions'>
              <Table
                dataSource={interventions}
                columns={columns}
                rowKey='id'
                pagination={false}
                rowClassName={record => (record.declined ? 'declined-row' : '')}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Decline Modal */}
      <Modal
        title='Reason for Declining'
        open={modalVisible}
        onOk={confirmDecline}
        onCancel={() => setModalVisible(false)}
        okText='Confirm'
      >
        <Input.TextArea
          rows={4}
          value={declineReason}
          onChange={e => setDeclineReason(e.target.value)}
          placeholder='Please enter a reason...'
        />
      </Modal>
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
            style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}
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
                  cursor: 'default' // no pointer click on item
                }}
                actions={
                  !item.readBy?.[currentRole]
                    ? [
                        <Button
                          size='small'
                          type='link'
                          onClick={() => markAsRead(item.id)}
                        >
                          Mark as Read
                        </Button>
                      ]
                    : []
                }
              >
                <List.Item.Meta
                  title={item.interventionTitle || 'Notification'}
                  description={item.message}
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
        disabled={roleLoading || !currentRole} // ✅ disable while loading
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

      <style>
        {`
          .declined-row {
            background-color: #f5f5f5 !important;
            color: #999;
            font-style: italic;
          }
        `}
      </style>
    </div>
  )
}
