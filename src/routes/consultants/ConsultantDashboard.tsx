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
  BarChartOutlined,
  CalendarOutlined
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

const { Title } = Typography

type ConsultantStatus = 'pending' | 'accepted' | 'declined'

interface Intervention {
  id: string
  beneficiaryName: string
  intervention: string
  sector: string
  stage: string
  location: string
  status: string
  consultantStatus: 'pending' | 'accepted' | 'declined'
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
  const { user } = useFullIdentity()
  const [dashboardReady, setDashboardReady] = useState(false)
  const [events, setEvents] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
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

          setConsultantId(consultantDoc.id)
          setCurrentRole('consultant')
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
        batch.update(doc(db, 'consultants', consultantId), {
          assignmentCount: increment(newlyAccepted.length)
        })
        await batch.commit()
      } catch (e) {
        console.error('Failed to increment assignmentCount:', e)
      }
    })

    return () => unsub()
  }, [consultantId]) // single dependency

  //   Fetch Events
  useEffect(() => {
    if (!companyCode) return

    const fetchEvents = async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, 'events'),
            where('companyCode', '==', companyCode)
          )
        )
        const eventList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setEvents(eventList)
      } catch (err) {
        console.error('Failed to load events:', err)
      }
    }

    fetchEvents()
  }, [companyCode])

  //   Fetch Appointments
  useEffect(() => {
    if (!companyCode || !user?.email) return

    const fetchAppointments = async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, 'appointments'),
            where('companyCode', '==', companyCode),
            where('email', '==', user.email)
          )
        )
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        setAppointments(list)
      } catch (err) {
        console.error('Failed to load appointments:', err)
      }
    }

    fetchAppointments()
  }, [companyCode, user?.email])

  //   Fetch Assigned Interventions
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

  //   Fetch Notifications
  useEffect(() => {
    if (currentRole) {
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
      const clickedRef = doc(db, 'assignedInterventions', id)
      const clickedSnap = await getDoc(clickedRef)
      if (!clickedSnap.exists()) return message.error('Intervention not found.')

      const base = clickedSnap.data()
      const now = Timestamp.now()

      // Build list of docs to accept
      let targets: Array<{ id: string; data: any }> = [{ id, data: base }]

      if (base.groupId) {
        // Accept all in the group for this consultant that are still pending
        const grpSnap = await getDocs(
          query(
            collection(db, 'assignedInterventions'),
            where('groupId', '==', base.groupId),
            where('consultantId', '==', base.consultantId)
          )
        )
        targets = grpSnap.docs
          .map(d => ({ id: d.id, data: d.data() }))
          .filter(t => t.data.consultantStatus === 'pending')
        if (targets.length === 0) {
          return message.info('Nothing pending in this group to accept.')
        }
      }

      const batch = writeBatch(db)

      for (const t of targets) {
        const ref = doc(db, 'assignedInterventions', t.id)
        const next: any = { consultantStatus: 'accepted', updatedAt: now }
        if (t.data.userStatus === 'accepted') {
          next.status = 'in-progress'
        }
        batch.update(ref, next)
      }

      await batch.commit()

      // Notify per assignment (keep simple; you can coalesce if you prefer)
      await Promise.all(
        targets.map(t =>
          addDoc(collection(db, 'notifications'), {
            participantId: t.data.participantId,
            participantName: t.data.beneficiaryName,
            interventionId: t.id,
            interventionTitle: t.data.interventionTitle,
            type: 'consultant-accepted',
            recipientRoles: ['admin', 'participant'],
            createdAt: new Date(),
            readBy: {},
            message: {
              admin: `Consultant accepted: ${t.data.interventionTitle}`,
              participant: `Your intervention "${t.data.interventionTitle}" was accepted.`
            }
          })
        )
      )

      message.success(
        base.groupId
          ? `Accepted ${targets.length} intervention(s) in this group`
          : 'Intervention accepted!'
      )

      // Remove accepted ones from "pending" list in UI
      setInterventions(prev =>
        prev.filter(item => !targets.some(t => t.id === item.id))
      )
    } catch (error) {
      console.error(error)
      message.error('Failed to accept intervention(s).')
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
              minHeight: '100vh',
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
                <Col xs={24} md={6}>
                  <Card>
                    <Statistic
                      title='Total Feedbacks'
                      value={feedbacks.length}
                      prefix={<MessageOutlined />}
                    />
                  </Card>
                </Col>

                <Col xs={24} md={6}>
                  <Card>
                    <Statistic
                      title='Pending Interventions'
                      value={interventions.length}
                      prefix={<FileSearchOutlined />}
                    />
                  </Card>
                </Col>

                <Col xs={24} md={6}>
                  <Card>
                    <Statistic
                      title='Ongoing Interventions'
                      value={ongoingCount}
                      prefix={<BarChartOutlined />}
                    />
                  </Card>
                </Col>

                <Col xs={24} md={6}>
                  <Card>
                    <Statistic
                      title='Upcoming Appointments'
                      value={events.length || 0}
                      prefix={<CalendarOutlined />}
                    />
                  </Card>
                </Col>

                {/* Event Details List */}
                <Col xs={24} md={12}>
                  <Card title='Upcoming Events'>
                    <List
                      itemLayout='horizontal'
                      dataSource={events.slice(0, 5)} // show top 5
                      renderItem={event => (
                        <List.Item>
                          <List.Item.Meta
                            title={event.title || 'Untitled'}
                            description={`Date: ${
                              event.date || 'N/A'
                            } | Time: ${
                              event.time?.toDate
                                ? new Date(
                                    event.time.toDate()
                                  ).toLocaleTimeString()
                                : 'N/A'
                            } | Type: ${event.type}`}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>

                {/* Appointments Details List */}
                <Col xs={24} md={12}>
                  <Card title='Upcoming Appointments'>
                    <List
                      itemLayout='horizontal'
                      dataSource={appointments.slice(0, 5)} // show top 5
                      renderItem={appointment => (
                        <List.Item>
                          <List.Item.Meta
                            title={appointment.title || 'Untitled'}
                            description={`Date: ${
                              appointment.date || 'N/A'
                            } | Time: ${
                              appointment.time?.toDate
                                ? new Date(
                                    appointment.time.toDate()
                                  ).toLocaleTimeString()
                                : 'N/A'
                            } | Type: ${appointment.type}`}
                          />
                        </List.Item>
                      )}
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
