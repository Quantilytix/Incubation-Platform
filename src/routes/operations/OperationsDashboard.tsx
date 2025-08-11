import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  List,
  Tag,
  Space,
  Divider,
  Progress,
  Button,
  Timeline,
  Badge,
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  message,
  TimePicker,
  Layout
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  ScheduleOutlined,
  TeamOutlined,
  BellOutlined,
  DeleteOutlined
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
  getDoc,
  updateDoc,
  where,
  query,
  addDoc
} from 'firebase/firestore'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
const { Title, Text } = Typography
import dayjs from 'dayjs'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

// Inside OperationsDashboard, before return:
const branchPerformanceOptions = {
  chart: {
    type: 'column'
  },
  title: {
    text: 'Branch Performance - Interventions Completed'
  },
  xAxis: {
    categories: [
      'Springs (Head Office)',
      'Rustenburg',
      'Mogale City',
      'Welkom',
      'Matlosana',
      'Khutsong'
    ],
    title: { text: 'Branch' }
  },
  yAxis: {
    min: 0,
    title: { text: 'Interventions Completed' }
  },
  series: [
    {
      name: 'Completed Interventions',
      data: [25, 15, 20, 10, 18, 22],
      color: '#1890ff'
    }
  ],
  credits: { enabled: false }
}

export const OperationsDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [participants, setParticipants] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [events, setEvents] = useState<any[]>([])
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)
  const [eventForm] = Form.useForm()
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [eventDetailModalOpen, setEventDetailModalOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [departments, setDepartments] = useState<any[]>([])
  const [userDepartment, setUserDepartment] = useState<any>(null)
  const [consultants, setConsultants] = useState<any[]>([])
  const [projectAdmins, setProjectAdmins] = useState<any[]>([])
  const [operationsUsers, setOperationsUsers] = useState<any[]>([])
  const { user } = useFullIdentity()
  const [allocations, setAllocations] = useState<any[]>([])
  const [progressModalOpen, setProgressModalOpen] = useState(false)
  const [selectedAllocation, setSelectedAllocation] = useState<any>(null)

  // Dummy allocations data
  useEffect(() => {
    setAllocations([
      {
        id: 'alloc1',
        consultant: 'John Doe',
        intervention: 'Business Strategy Workshop',
        department: 'Business Development',
        beneficiary: 'ABC Traders',
        progress: '50% complete - Sessions 1 & 2 done, session 3 scheduled'
      },
      {
        id: 'alloc2',
        consultant: 'Jane Smith',
        intervention: 'Financial Literacy Training',
        department: 'Finance',
        beneficiary: 'XYZ Supplies',
        progress: '25% complete - Initial session completed'
      },
      {
        id: 'alloc3',
        consultant: 'Michael Brown',
        intervention: 'Marketing Campaign Support',
        department: 'Marketing',
        beneficiary: 'LMN Enterprises',
        progress: '75% complete - Campaign live, final report pending'
      }
    ])
  }, [])

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'notifications'))
        const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        if (!user || !user.companyCode || !user.departmentName) {
          setNotifications([]) // or set as loading...
          return
        }
        const filtered = all.filter(
          n =>
            n.companyCode === user.companyCode &&
            n.recipientRoles?.includes('operations') &&
            n.department === user.departmentName
        )
        setNotifications(filtered)
      } catch (err) {
        console.error('Error loading notifications:', err)
      }
    }
    if (user && user.companyCode && user.departmentName) {
      fetchNotifications()
    }
  }, [user])

  // Fetch users for consultant/department selection
  useEffect(() => {
    const fetchRelevantUsers = async () => {
      if (!user?.companyCode) return
      const q = query(
        collection(db, 'users'),
        where('companyCode', '==', user.companyCode)
      )
      const snapshot = await getDocs(q)
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setConsultants(allUsers.filter(u => u.role === 'consultant'))
      setProjectAdmins(allUsers.filter(u => u.role === 'projectadmin'))
      setOperationsUsers(allUsers.filter(u => u.role === 'operations'))
    }
    fetchRelevantUsers()
  }, [user?.companyCode])

  // Fetch departments
  useEffect(() => {
    if (user?.companyCode) {
      const fetchDepartments = async () => {
        const snapshot = await getDocs(
          query(
            collection(db, 'departments'),
            where('companyCode', '==', user.companyCode)
          )
        )
        const deps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setDepartments(deps)
        if (user.departmentId) {
          setUserDepartment(deps.find(d => d.id === user.departmentId) || null)
        } else {
          setUserDepartment(deps.find(d => d.isMain) || null)
        }
      }
      fetchDepartments()
    }
  }, [user])

  // Fetch appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      setAppointmentsLoading(true)
      try {
        const q = query(
          collection(db, 'appointments'),
          where('companyCode', '==', user.companyCode)
        )
        const snapshot = await getDocs(q)
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setAppointments(items)
      } catch (err) {
        console.error('Error fetching appointments:', err)
      } finally {
        setAppointmentsLoading(false)
      }
    }
    if (user?.companyCode) fetchAppointments()
  }, [user?.companyCode])

  // Fetch participants
  useEffect(() => {
    const fetchParticipants = async () => {
      if (!user || !user.companyCode) return
      try {
        const participantSnapshot = await getDocs(
          query(
            collection(db, 'participants'),
            where('companyCode', '==', user.companyCode)
          )
        )
        const participantsList = participantSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setParticipants(participantsList)
      } catch (error) {
        console.error('Error fetching participants:', error)
      }
    }
    fetchParticipants()
  }, [user?.companyCode])

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      if (!user || !user.companyCode) return
      try {
        const snapshot = await getDocs(
          query(
            collection(db, 'events'),
            where('companyCode', '==', user.companyCode)
          )
        )
        const eventList = snapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
            // Fallback date derived from timestamp (for calendar rendering)
            date: data.time?.toDate
              ? dayjs(data.time.toDate()).format('YYYY-MM-DD')
              : 'Invalid'
          }
        })

        setEvents(eventList)
      } catch (error) {
        console.error('Error fetching events:', error)
      }
    }
    fetchEvents()
  }, [user?.companyCode])

  const handleEventClick = (event: any) => {
    const eventData = events.find(e => e.id === event.id)
    setSelectedEvent(eventData)
    setEventDetailModalOpen(true)
  }

  // Add new event (now with consultants/departments)
  const handleAddEvent = async (values: any) => {
    const eventDate = values.date.format('YYYY-MM-DD')
    const eventTime = values.time.format('HH:mm')
    const [eventHour, eventMinute] = eventTime.split(':').map(Number)
    if (
      eventHour < 6 ||
      (eventHour === 18 && eventMinute > 0) ||
      eventHour > 18
    ) {
      return message.error('Event time must be between 06:00 and 18:00.')
    }
    // Check for clash (same date and time)
    const clash = events.some(
      e => e.date === eventDate && dayjs(e.time).format('HH:mm') === eventTime
    )
    if (clash) {
      return message.error('Another event is already scheduled for this time.')
    }
    try {
      const newId = `event-${Date.now()}`
      const newEvent = {
        id: newId,
        title: values.title,
        date: eventDate,
        time: values.time.toDate ? values.time.toDate() : values.time,
        type: values.type,
        createdAt: Timestamp.now(),
        consultantsInvolved: values.consultantsInvolved || [],
        departmentsInvolved: values.departmentsInvolved || [],
        companyCode: user.companyCode
      }
      await setDoc(doc(db, 'events', newId), newEvent)
      setEvents(prev => [...prev, newEvent])
      message.success('Event added successfully')
      setEventModalOpen(false)
      eventForm.resetFields()
    } catch (error) {
      console.error('Error adding event:', error)
      message.error('Failed to add event')
    }
  }

  // Mark appointment as completed
  const markAppointmentComplete = async (apptId: string) => {
    try {
      await updateDoc(doc(db, 'appointments', apptId), { status: 'completed' })
      setAppointments(prev =>
        prev.map(a => (a.id === apptId ? { ...a, status: 'completed' } : a))
      )
      message.success('Appointment marked as completed.')
    } catch (err) {
      console.error(err)
      message.error('Failed to complete appointment.')
    }
  }

  // UI renderers and helpers
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return <ScheduleOutlined style={{ color: '#1890ff' }} />
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

  const handleAcceptRequest = async notif => {
    // 1. Mark notification as accepted
    await updateDoc(doc(db, 'notifications', notif.id), {
      status: 'accepted',
      actionedBy: user.id,
      actionedAt: new Date()
    })

    // 2. Update the application's interventions.required
    // Find the application by participantId
    const appSnap = await getDocs(
      query(
        collection(db, 'applications'),
        where('participantId', '==', notif.participantId)
      )
    )
    if (!appSnap.empty) {
      const appRef = appSnap.docs[0].ref
      const appData = appSnap.docs[0].data()
      const updatedRequired = [
        ...(appData?.interventions?.required || []),
        {
          id: `requested-${Date.now()}`,
          title: notif.interventionTitle,
          area: notif.areaOfSupport,
          fromRequest: true,
          approvedAt: new Date()
        }
      ]
      await updateDoc(appRef, {
        'interventions.required': updatedRequired
      })
    }

    // 3. Notify the participant
    await addDoc(collection(db, 'notifications'), {
      companyCode: user.companyCode,
      type: 'intervention-request-accepted',
      recipientRoles: ['incubatee'],
      participantId: notif.participantId,
      interventionTitle: notif.interventionTitle,
      areaOfSupport: notif.areaOfSupport,
      message: {
        incubatee: `Your request for "${notif.interventionTitle}" has been accepted by Operations.`
      },
      createdAt: new Date(),
      readBy: {}
    })

    message.success('Request accepted and participant notified.')
  }

  const handleDeclineRequest = async notif => {
    Modal.confirm({
      title: 'Decline Reason',
      content: (
        <Input.TextArea
          autoFocus
          placeholder='Enter reason for declining'
          onChange={e => (window.__declineReason = e.target.value)}
        />
      ),
      onOk: async () => {
        const reason = window.__declineReason || ''
        // 1. Update the notification
        await updateDoc(doc(db, 'notifications', notif.id), {
          status: 'declined',
          actionedBy: user.id,
          actionedAt: new Date(),
          declineReason: reason
        })
        // 2. Notify participant
        await addDoc(collection(db, 'notifications'), {
          companyCode: user.companyCode,
          type: 'intervention-request-declined',
          recipientRoles: ['incubatee'],
          participantId: notif.participantId,
          interventionTitle: notif.interventionTitle,
          areaOfSupport: notif.areaOfSupport,
          reason,
          message: {
            incubatee: `Your request for "${notif.interventionTitle}" was declined. Reason: ${reason}`
          },
          createdAt: new Date(),
          readBy: {}
        })
        message.success('Request declined and participant notified.')
      }
    })
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#fff', padding: 24 }}>
      <Helmet>
        <title>Operations Dashboard</title>
      </Helmet>
      {/* High-level Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={8}>
          <Card
            hoverable
            style={{
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
              transition: 'all 0.3s ease',
              borderRadius: 8,
              border: '1px solid #d6e4ff'
            }}
          >
            <Statistic
              title='Upcoming Appointments'
              value={appointments.filter(a => a.status === 'scheduled').length}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card
            hoverable
            style={{
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
              transition: 'all 0.3s ease',
              borderRadius: 8,
              border: '1px solid #d6e4ff'
            }}
          >
            <Statistic
              title='Completed Appointments'
              value={appointments.filter(a => a.status === 'completed').length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card
            hoverable
            style={{
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
              transition: 'all 0.3s ease',
              borderRadius: 8,
              border: '1px solid #d6e4ff'
            }}
          >
            <Statistic
              title='Active Participants'
              value={participants.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main dashboard */}
      {/* Top two cards side-by-side */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <ScheduleOutlined />
                <span>Consultant Allocations</span>
              </Space>
            }
          >
            <List
              size='small'
              dataSource={allocations}
              renderItem={alloc => (
                <List.Item
                  actions={[
                    <Button
                      key='view-progress'
                      type='link'
                      onClick={() => {
                        setSelectedAllocation(alloc)
                        setProgressModalOpen(true)
                      }}
                    >
                      View Progress
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space direction='vertical'>
                        <Text strong>Consultant: {alloc.consultant}</Text>
                        <Text>Intervention: {alloc.intervention}</Text>
                        <Text>Department: {alloc.department}</Text>
                        <Text>Beneficiary: {alloc.beneficiary}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <ScheduleOutlined />
                <span>Upcoming Events</span>
              </Space>
            }
            extra={
              <Button
                type='primary'
                size='small'
                onClick={() => setEventModalOpen(true)}
              >
                Add Event
              </Button>
            }
          >
            <Timeline mode='left'>
              {events.map((event, index) => (
                <Timeline.Item key={index} dot={getEventIcon(event.type)}>
                  <div style={{ marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 16 }}>
                      {event.title}
                    </Text>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <Text type='secondary'>
                      🕒{' '}
                      {event.time?.toDate
                        ? dayjs(event.time.toDate()).format('YYYY-MM-DD HH:mm')
                        : 'N/A'}
                    </Text>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <Tag
                      color={
                        event.type === 'meeting'
                          ? 'blue'
                          : event.type === 'deadline'
                          ? 'red'
                          : event.type === 'event'
                          ? 'green'
                          : 'purple'
                      }
                    >
                      {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                    </Tag>
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
            <Button
              type='link'
              style={{ padding: 0 }}
              onClick={() => setCalendarModalOpen(true)}
            >
              View Full Calendar
            </Button>
          </Card>
        </Col>
      </Row>

      {/* Chart full width */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <HighchartsReact
              highcharts={Highcharts}
              options={branchPerformanceOptions}
            />
          </Card>
        </Col>
      </Row>

      {/* Add Event Modal */}
      <Modal
        title='Add New Event'
        open={eventModalOpen}
        onCancel={() => setEventModalOpen(false)}
        footer={null}
      >
        <Form form={eventForm} layout='vertical' onFinish={handleAddEvent}>
          <Form.Item
            name='title'
            label='Event Title'
            rules={[{ required: true, message: 'Please input event title' }]}
          >
            <Input placeholder='Enter event title' />
          </Form.Item>
          <Form.Item
            name='date'
            label='Event Date'
            rules={[{ required: true, message: 'Please select event date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name='time' label='Event Time'>
            <TimePicker style={{ width: '100%' }} format='HH:mm' />
          </Form.Item>
          <Form.Item
            name='type'
            label='Event Type'
            rules={[{ required: true, message: 'Please select event type' }]}
          >
            <Select placeholder='Select event type'>
              <Select.Option value='meeting'>Meeting</Select.Option>
              <Select.Option value='deadline'>Deadline</Select.Option>
              <Select.Option value='event'>Event</Select.Option>
              <Select.Option value='workshop'>Workshop</Select.Option>
            </Select>
          </Form.Item>
          {/* Consultants involved */}
          <Form.Item name='consultantsInvolved' label='Consultants Involved'>
            <Select
              mode='multiple'
              placeholder='Select consultant(s)'
              optionFilterProp='children'
              showSearch
            >
              {consultants.map(user => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          {/* Departments involved */}
          <Form.Item name='departmentsInvolved' label='Departments Involved'>
            <Select
              mode='multiple'
              placeholder='Select department(s)'
              optionFilterProp='children'
              showSearch
            >
              {departments.map(dep => (
                <Select.Option key={dep.id} value={dep.id}>
                  {dep.name || dep.id}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              Add Event
            </Button>
          </Form.Item>
        </Form>
      </Modal>
      {/* Calendar Modal */}
      <Modal
        title='Full Calendar View'
        open={calendarModalOpen}
        onCancel={() => setCalendarModalOpen(false)}
        footer={null}
        width={900}
      >
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView='dayGridMonth'
          events={events.map(event => ({
            id: event.id,
            title: event.title,
            date: event.date
          }))}
          eventClick={info => handleEventClick(info.event)}
          height={600}
        />
      </Modal>
      {/* Calendar Event Details */}
      <Modal
        title='Event Details'
        open={eventDetailModalOpen}
        onCancel={() => setEventDetailModalOpen(false)}
        footer={null}
      >
        {selectedEvent && (
          <div>
            <p>
              <strong>Title:</strong> {selectedEvent.title}
            </p>
            <p>
              <strong>Date/Time:</strong>{' '}
              {selectedEvent.time?.toDate
                ? dayjs(selectedEvent.time.toDate()).format('YYYY-MM-DD HH:mm')
                : dayjs(selectedEvent.time).isValid()
                ? dayjs(selectedEvent.time).format('YYYY-MM-DD HH:mm')
                : 'Invalid Date'}
            </p>
            <p>
              <strong>Type:</strong> {selectedEvent.type}
            </p>
            <p>
              <strong>Consultants Involved:</strong>{' '}
              {(selectedEvent.consultantsInvolved || []).length > 0
                ? consultants
                    .filter(c =>
                      selectedEvent.consultantsInvolved.includes(c.id)
                    )
                    .map(c => c.name)
                    .join(', ')
                : 'None'}
            </p>

            <p>
              <strong>Departments Involved:</strong>{' '}
              {(selectedEvent.departmentsInvolved || []).length > 0
                ? departments
                    .filter(d =>
                      selectedEvent.departmentsInvolved.includes(d.id)
                    )
                    .map(d => d.name || d.id)
                    .join(', ')
                : 'None'}
            </p>
          </div>
        )}
      </Modal>
      {/* Notifications button/modal */}
      <Button
        type='primary'
        shape='circle'
        icon={
          <Badge
            count={notifications.filter(n => !n.readBy?.operations).length}
          >
            <BellOutlined />
          </Badge>
        }
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}
        onClick={() => setNotificationModalOpen(true)}
      />
      <Modal
        title='Notifications'
        open={notificationModalOpen}
        onCancel={() => setNotificationModalOpen(false)}
        footer={null}
        width={700}
      >
        <List
          itemLayout='horizontal'
          dataSource={notifications}
          renderItem={item => (
            <List.Item
              actions={
                item.type === 'intervention-request' &&
                item.status === 'pending'
                  ? [
                      <Button
                        key='accept'
                        type='link'
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleAcceptRequest(item)}
                      >
                        Accept
                      </Button>,
                      <Button
                        key='decline'
                        type='link'
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeclineRequest(item)}
                      >
                        Decline
                      </Button>
                    ]
                  : []
              }
            >
              <List.Item.Meta
                title={item.message?.operations || 'No message'}
                // description={`Type: ${item.type} | Dept: ${item.department}`}
              />
            </List.Item>
          )}
        />
      </Modal>
    </Layout>
  )
}

export default OperationsDashboard
