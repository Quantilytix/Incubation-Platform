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
  addDoc
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { Helmet } from 'react-helmet'

const { Title } = Typography

type ConsultantStatus = 'pending' | 'accepted' | 'declined'

interface Intervention {
  id: string
  sme: string
  intervention: string
  sector: string
  stage: string
  location: string
  status: string
  consultantStatus: ConsultantStatus
  declined: boolean
  declineReason: string
}

interface Feedback {
  id: string
  sme: string
  comment: string
  rating?: number
}

export const ConsultantDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [dashboardReady, setDashboardReady] = useState(false)

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
  const [companyCode, setCompanyCode] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (user?.email) {
        const consultantSnap = await getDocs(
          query(collection(db, 'consultants'), where('email', '==', user.email))
        )

        if (!consultantSnap.empty) {
          const consultantDoc = consultantSnap.docs[0]
          const consultantData = consultantDoc.data()

          // Prefer the embedded consultant ID, or fallback to Firestore doc ID
          if (consultantData.id) {
            setConsultantId(consultantData.id)
          } else {
            console.warn('Missing consultantData.id — falling back to doc.id')
            setConsultantId(consultantDoc.id)
          }

          if (consultantData.role) {
            setCurrentRole(consultantData.role.toLowerCase())
          }

          // After fetching consultantData:
          setCompanyCode(consultantData.companyCode || null)

          setRoleLoading(false)
        } else {
          console.error('Consultant not found in consultants collection')
          setRoleLoading(false)
          setLoading(false)
        }
      }
    })

    return () => unsubscribe()
  }, [])

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

        const allInterventions: Intervention[] = await Promise.all(
          allSnap.docs.map(async docSnap => {
            const data = docSnap.data()
            let sector = 'Unknown'
            let stage = 'Unknown'
            let location = 'Unknown'

            if (data.participantId) {
              const participantRef = doc(db, 'participants', data.participantId)
              const participantSnap = await getDoc(participantRef)

              if (participantSnap.exists()) {
                const participant = participantSnap.data()
                sector = participant.sector || sector
                stage = participant.stage || stage
                location = participant.location || location
              }
            }

            return {
              id: docSnap.id,
              beneficiaryName: data.beneficiaryName,
              intervention: data.interventionTitle,
              sector,
              stage,
              location,
              status: data.status,
              consultantStatus: data.consultantStatus || 'pending',
              declined: data.consultantStatus === 'declined',
              declineReason: data.declineReason || ''
            }
          })
        )

        const assigned = allInterventions.filter(
          i => i.status === 'assigned' && i.consultantStatus === 'pending'
        )

        const inProgress = allInterventions.filter(
          i => i.status === 'in-progress'
        )

        setInterventions(assigned)
        setOngoingCount(inProgress.length)

        const feedbackSnap = await getDocs(
          query(
            collection(db, 'interventionsDatabase'),
            where('consultantId', '==', consultantId),
            where('companyCode', '==', companyCode)
          )
        )

        const feedbackList: Feedback[] = feedbackSnap.docs
          .map(docSnap => {
            const data = docSnap.data()
            if (!data.feedback || !data.feedback.comments) return null

            return {
              id: docSnap.id,
              sme: data.beneficiaryName || 'Unknown SME',
              comment: data.feedback.comments,
              rating: data.feedback?.rating
            }
          })
          .filter(Boolean) as Feedback[] // remove nulls

        setFeedbacks(feedbackList)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
        setDashboardReady(true) // ✅ mark entire page as ready
      }
    }

    fetchData()
  }, [consultantId])

  useEffect(() => {
    if (currentRole) {
      console.log('Triggering fetchNotifications with role:', currentRole)
      fetchNotifications()
    }
  }, [currentRole])

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
          where('recipientRoles', 'array-contains', currentRole)
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
      const interventionRef = doc(db, 'assignedInterventions', id)
      const interventionSnap = await getDoc(interventionRef)

      if (!interventionSnap.exists()) {
        message.error('Intervention not found.')
        return
      }

      const interventionData = interventionSnap.data()

      await updateDoc(interventionRef, {
        consultantStatus: 'accepted',
        updatedAt: Timestamp.now()
      })

      if (interventionData.userStatus === 'accepted') {
        await updateDoc(interventionRef, {
          status: 'in-progress'
        })
      }

      // ✅ Add notification
      await addDoc(collection(db, 'notifications'), {
        participantId: interventionData.participantId,
        participantName: interventionData.beneficiaryName,
        interventionId: id,
        interventionTitle: interventionData.interventionTitle,
        type: 'consultant-accepted',
        recipientRoles: ['admin', 'participant'],
        createdAt: new Date(),
        readBy: {},
        message: {
          admin: `Consultant accepted: ${interventionData.interventionTitle}`,
          participant: `Your intervention "${interventionData.interventionTitle}" was accepted.`
        }
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
      const interventionRef = doc(db, 'assignedInterventions', currentDeclineId)
      const interventionSnap = await getDoc(interventionRef)

      if (!interventionSnap.exists()) {
        message.error('Intervention not found.')
        return
      }

      const data = interventionSnap.data()

      await updateDoc(interventionRef, {
        consultantStatus: 'declined',
        status: 'declined',
        declineReason,
        updatedAt: Timestamp.now()
      })

      // ✅ Add notification
      await addDoc(collection(db, 'notifications'), {
        participantId: data.participantId,
        participantName: data.beneficiaryName,
        interventionId: currentDeclineId,
        interventionTitle: data.interventionTitle,
        type: 'consultant-declined',
        recipientRoles: ['admin', 'participant'],
        createdAt: new Date(),
        readBy: {},
        message: {
          admin: `Consultant declined: ${data.interventionTitle}`,
          participant: `Your intervention "${data.interventionTitle}" was declined.`
        }
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
    {
      title: 'Beneficiary Name',
      dataIndex: 'beneficiaryName',
      key: 'beneficiaryName'
    },
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
    <>
      {!dashboardReady ? (
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
                      rowClassName={record =>
                        record.declined ? 'declined-row' : ''
                      }
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
        </Row>
      )}
    </>
  )
}
