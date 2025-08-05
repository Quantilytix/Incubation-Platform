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
  message,
  Layout,
  Alert,
  Descriptions
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  ClockCircleOutlined,
  ScheduleOutlined,
  FileTextOutlined,
  FormOutlined,
  ApartmentOutlined,
  TeamOutlined,
  BarsOutlined,
  BellOutlined,
  DeleteOutlined,
  UploadOutlined,
  BarChartOutlined,
  ArrowRightOutlined
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
  query
} from 'firebase/firestore'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import dayjs from 'dayjs'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { TaskModal } from '@/components/op-dashboard/TaskModal'
import { EventModal } from '@/components/op-dashboard/EventModal'
import { PREDEFINED_TASK_TYPES } from '@/types/TaskType'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import HighchartsMore from 'highcharts/highcharts-more'
import HighchartsAccessibility from 'highcharts/modules/accessibility'

// Initialize additional modules
if (typeof HighchartsMore === 'function') {
  HighchartsMore(Highcharts)
}
if (typeof HighchartsAccessibility === 'function') {
  HighchartsAccessibility(Highcharts)
}

const { Text } = Typography

export const OperationsDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [participants, setParticipants] = useState<any[]>([])
  const [interventions, setInterventions] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [complianceDocuments, setComplianceDocuments] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)
  const [eventForm] = Form.useForm()
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [eventDetailModalOpen, setEventDetailModalOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'operations'>()
  const [declineModalOpen, setDeclineModalOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [declining, setDeclining] = useState(false)
  const [directCosts, setDirectCosts] = useState([
    { description: '', amount: '' }
  ])
  const [departments, setDepartments] = useState<any[]>([])
  const [userDepartment, setUserDepartment] = useState<any>(null)
  const [consultants, setConsultants] = useState<any[]>([])
  const [projectAdmins, setProjectAdmins] = useState<any[]>([])
  const [operationsUsers, setOperationsUsers] = useState<any[]>([])
  const { user } = useFullIdentity()
  const [consultantDocIds, setConsultantDocIds] = useState<
    Record<string, string>
  >({})
  const [operationsDocIds, setOperationsDocIds] = useState<
    Record<string, string>
  >({})
  const [proofModalOpen, setProofModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'notifications'))
        const all = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[]
        const filtered = all.filter(n =>
          n.recipientRoles?.includes('operations')
        )

        setNotifications(filtered)
      } catch (err) {
        console.error('Error loading notifications:', err)
      }
    }
    fetchNotifications()
  }, [])

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

  //   Fetch Assigned Interventions
  const fetchAssignments = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'assignedInterventions'))
      const fetchedAssignments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      const currentParticipantMap = new Map(
        participants.map(p => [p.id, p.beneficiaryName])
      )
      const currentConsultantMap = new Map(consultants.map(c => [c.id, c.name]))

      const enrichedAssignments = fetchedAssignments.map(assignment => {
        const foundParticipant = participants.find(
          p => p.id === assignment.participantId
        )
        const foundIntervention = foundParticipant?.requiredInterventions.find(
          i => i.id === assignment.interventionId
        )

        return {
          ...assignment,
          beneficiaryName:
            currentParticipantMap.get(assignment.participantId) ||
            'Unknown Beneficiary',
          consultantName:
            currentConsultantMap.get(assignment.consultantId) ||
            'Unknown Consultant',
          area: foundIntervention?.area || 'Unknown Area',
          interventionTitle:
            foundIntervention?.title || assignment.interventionTitle
        }
      })

      setInterventions(enrichedAssignments)
    } catch (error) {
      console.error('Error fetching assignments:', error)
      message.error('Failed to load assignments')
    } finally {
      //   setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssignments()
  }, [user])

  useEffect(() => {
    if (!user?.companyCode) return

    const fetchTasks = async () => {
      try {
        const q = query(
          collection(db, 'tasks'),
          where('companyCode', '==', user?.companyCode)
        )
        const snapshot = await getDocs(q)
        const taskList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setTasks(taskList)
      } catch (error) {
        console.error('Error fetching tasks:', error)
      }
    }
    const fetchAllOtherData = async () => {
      try {
        const q = query(
          collection(db, 'applications'),
          where('status', '==', 'accepted'),
          where('companyCode', '==', user?.companyCode)
        )

        const snapshot = await getDocs(q)
        const applications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        setParticipants(applications)
      } catch (error) {
        console.error('Error fetching applications:', error)
      }
    }
    const fetchComplianceDocuments = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'complianceDocuments'))
        const documents = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setComplianceDocuments(documents)
      } catch (error) {
        console.error('Error fetching compliance documents:', error)
      }
    }

    fetchComplianceDocuments()
    fetchTasks()
    fetchAllOtherData()
  }, [user?.companyCode])

  useEffect(() => {
    if (!user?.companyCode) return

    const fetchEvents = async () => {
      try {
        const q = query(
          collection(db, 'events'),
          where('companyCode', '==', user?.companyCode)
        )
        const snapshot = await getDocs(q)
        const eventList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
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

  const handleAddEvent = async (values: any) => {
    const eventDate = dayjs(values.date).format('YYYY-MM-DD')

    const start = dayjs(values.startTime)
    const end = dayjs(values.endTime)

    if (!start.isValid() || !end.isValid()) {
      return message.error('Please select a valid start and end time.')
    }

    const startHour = start.hour()
    const endHour = end.hour()

    if (startHour < 6 || endHour > 18 || end.isBefore(start)) {
      return message.error(
        'Event time must be between 06:00 and 18:00, and end must be after start.'
      )
    }

    const clash = events.some(
      e =>
        e.date === eventDate &&
        dayjs(e.startTime).format('HH:mm') === start.format('HH:mm')
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
        startTime: Timestamp.fromDate(start.toDate()),
        endTime: Timestamp.fromDate(end.toDate()),
        type: values.eventType,
        format: values.format,
        location: values.location || '',
        link: values.link || '',
        description: values.description || '',
        participants: values.participants || [],
        createdAt: Timestamp.now(),
        companyCode: user?.companyCode
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

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />
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

  // Charts Logic
  const upToDate = complianceDocuments.filter(
    doc => doc.status === 'valid'
  ).length
  const needsReview = complianceDocuments.filter(
    doc => doc.status === 'expiring'
  ).length
  const overdue = complianceDocuments.filter(
    doc =>
      doc.status === 'expired' ||
      doc.status === 'missing' ||
      doc.status === 'pending'
  ).length
  const total = complianceDocuments.length

  const complianceChartOptions = {
    colors: ['#52c41a', '#faad14', '#ff4d4f'], // Valid, Expiring, Overdue
    chart: {
      type: 'column',
      inverted: true,
      polar: true,
      height: 320
    },
    title: {
      text: 'Compliance Status Overview'
    },
    credits: {
      enabled: false
    },
    tooltip: {
      outside: true,
      shared: true
    },
    pane: {
      size: '85%',
      innerSize: '20%',
      endAngle: 270
    },
    xAxis: {
      tickInterval: 1,
      labels: {
        align: 'right',
        allowOverlap: true,
        step: 1,
        y: 3,
        style: {
          fontSize: '13px'
        }
      },
      lineWidth: 0,
      gridLineWidth: 0,
      categories: [
        'Valid <span class="f16"><span class="dot valid"></span></span>',
        'Expiring <span class="f16"><span class="dot expiring"></span></span>',
        'Overdue <span class="f16"><span class="dot overdue"></span></span>'
      ],
      useHTML: true
    },
    yAxis: {
      lineWidth: 0,
      tickInterval: 1,
      reversedStacks: false,
      endOnTick: true,
      showLastLabel: true,
      gridLineWidth: 1,
      labels: {
        enabled: false // 🔥 hides "Ongoing", "Completed", etc.
      }
    },
    plotOptions: {
      column: {
        stacking: 'normal',
        borderWidth: 0,
        pointPadding: 0,
        groupPadding: 0.15,
        borderRadius: '50%',
        dataLabels: {
          enabled: true,
          format: '{point.y}',
          style: {
            fontWeight: 'bold',
            color: '#000'
          }
        }
      }
    },
    legend: {
      align: 'center',
      verticalAlign: 'bottom',
      itemStyle: {
        fontWeight: 'normal'
      }
    },
    series: [
      {
        name: 'Valid',
        data: [upToDate, 0, 0]
      },
      {
        name: 'Expiring',
        data: [0, needsReview, 0]
      },
      {
        name: 'Overdue',
        data: [0, 0, overdue]
      }
    ]
  }

  const tasksPending = tasks.filter(
    t => t.status !== 'Completed' && !isOverdue(t)
  ).length
  const tasksCompleted = tasks.filter(t => t.status === 'Completed').length
  const tasksOverdue = tasks.filter(t => isOverdue(t)).length

  const interventionsPending = interventions.filter(
    i => i.status !== 'Completed' && !isOverdue(i)
  ).length
  const interventionsCompleted = interventions.filter(
    i => i.status === 'Completed'
  ).length
  const interventionsOverdue = interventions.filter(i => isOverdue(i)).length

  const totalInterventions =
    interventionsCompleted + interventionsPending + interventionsOverdue

  const completionRate = totalInterventions
    ? Math.round((interventionsCompleted / totalInterventions) * 100)
    : 0

  // helper
  function isOverdue (item) {
    const due = item.dueDate?.toDate
      ? item.dueDate.toDate()
      : new Date(item.dueDate)
    return item.status !== 'Completed' && dayjs(due).isBefore(dayjs())
  }

  const tasksVsInterventionsChart = {
    colors: ['#faad14', '#52c41a', '#ff4d4f'], // Pending, Completed, Overdue
    chart: {
      type: 'column',
      inverted: true,
      polar: true,
      height: 320
    },
    title: {
      text: 'Tasks vs Interventions'
    },
    credits: {
      enabled: false
    },
    tooltip: {
      outside: true,
      shared: true,
      formatter: function () {
        return `<b>${this.series.name}</b><br/>${this.key}: ${this.y}`
      }
    },
    pane: {
      size: '70%',
      innerSize: '20%',
      endAngle: 270
    },
    xAxis: {
      categories: ['Tasks', 'Interventions'],
      tickInterval: 1,
      labels: {
        align: 'right',
        allowOverlap: true,
        step: 1,
        y: 3,
        style: {
          fontSize: '12px'
        }
      },
      lineWidth: 0,
      gridLineWidth: 0
    },
    yAxis: {
      lineWidth: 0,
      tickInterval: 1,
      endOnTick: true,
      showLastLabel: true,
      gridLineWidth: 0
    },
    plotOptions: {
      column: {
        stacking: 'normal',
        borderWidth: 0,
        pointPadding: 0,
        groupPadding: 0.15,
        borderRadius: '50%',
        dataLabels: {
          enabled: true,
          format: '{point.y}',
          style: {
            fontWeight: 'bold',
            color: '#000',
            fontSize: '11px'
          }
        }
      }
    },
    legend: {
      align: 'center',
      verticalAlign: 'bottom'
    },
    series: [
      {
        name: 'Pending',
        data: [tasksPending, interventionsPending]
      },
      {
        name: 'Completed',
        data: [tasksCompleted, interventionsCompleted]
      },
      {
        name: 'Overdue',
        data: [tasksOverdue, interventionsOverdue]
      }
    ]
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#fff' }}>
      <Helmet>
        <title>Operations Dashboard</title>
        <meta
          name='description'
          content='Manage daily operations and track incubatee progress'
        />
      </Helmet>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/** PENDING TASKS */}
        <Col xs={24} sm={12} md={8} lg={8}>
          <Card
            hoverable
            style={{
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
              minHeight: 150,
              position: 'relative'
            }}
          >
            <Statistic
              title='Pending Tasks'
              value={tasks.filter(t => t.status !== 'Completed').length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <Button
              type='link'
              ghost
              style={{
                border: '1px solid #d9d9d9',
                position: 'absolute',
                bottom: 16,
                right: 16
              }}
              onClick={() => navigate('/tasks')}
            >
              View All <ArrowRightOutlined />
            </Button>
          </Card>
        </Col>

        {/** INTERVENTIONS PROGRESS */}
        <Col xs={24} sm={12} md={8} lg={8}>
          <Card
            hoverable
            style={{
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
              minHeight: 150,
              position: 'relative'
              //   textAlign: 'center'
            }}
          >
            <Statistic
              title='Interventions Progress'
              valueRender={() => (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Progress
                    type='dashboard'
                    gapDegree={100}
                    percent={completionRate}
                    width={80}
                    strokeColor={
                      completionRate >= 90
                        ? '#ff4d4f'
                        : completionRate >= 50
                        ? '#faad14'
                        : '#52c41a'
                    }
                    format={() => `${completionRate}%`}
                  />
                </div>
              )}
            />
            <Button
              type='link'
              ghost
              style={{
                border: '1px solid #d9d9d9',
                position: 'absolute',
                bottom: 16,
                right: 16
              }}
              onClick={() => navigate('/interventions')}
            >
              View All <ArrowRightOutlined />
            </Button>
          </Card>
        </Col>

        {/** ACTIVE PARTICIPANTS */}
        <Col xs={24} sm={12} md={8} lg={8}>
          <Card
            hoverable
            style={{
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
              minHeight: 150,
              position: 'relative'
            }}
          >
            <Statistic
              title='Active Participants'
              value={participants.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <Button
              type='link'
              ghost
              style={{
                border: '1px solid #d9d9d9',
                position: 'absolute',
                bottom: 16,
                right: 16
              }}
              onClick={() => navigate('/participants')}
            >
              View All <ArrowRightOutlined />
            </Button>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginBottom: 10 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ScheduleOutlined />
                <span>Consultant Appointments</span>
              </Space>
            }
            hoverable
            style={{ boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)' }}
          >
            <List
              size='small'
              loading={appointmentsLoading}
              dataSource={[...appointments].sort((a, b) =>
                dayjs(a.date + ' ' + a.time).diff(dayjs(b.date + ' ' + b.time))
              )}
              renderItem={appt => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text>{appt.participantName}</Text>
                        <Tag color='blue'>{appt.consultantName}</Tag>
                      </Space>
                    }
                    description={
                      <>
                        Date/Time:{' '}
                        {dayjs(
                          `${appt.date} ${dayjs(appt.time).format('HH:mm')}`
                        ).format('YYYY-MM-DD HH:mm')}
                        <br />
                        Location: {appt.location || appt.meetingLink}
                      </>
                    }
                  />
                  <Badge
                    status={
                      appt.status === 'completed' ? 'success' : 'processing'
                    }
                    text={appt.status}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ScheduleOutlined />
                <span>Upcoming Events</span>
              </Space>
            }
            hoverable
            extra={
              <Button
                type='primary'
                size='small'
                onClick={() => setEventModalOpen(true)}
              >
                Add Event
              </Button>
            }
            style={{ boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)' }}
          >
            <Timeline mode='left'>
              {events.map((event, index) => (
                <Timeline.Item key={index} dot={getEventIcon(event.type)}>
                  <Text strong>
                    {event.date} - {event.title}
                  </Text>
                  <br />
                  <Space wrap>
                    <Text type='secondary'>
                      Time: {dayjs(event.time).format('HH:mm')}
                    </Text>
                    <Tag color='blue'>{event.format}</Tag>
                    <Tag color='green'>{event.type}</Tag>
                  </Space>
                  {event.participants?.length > 0 && (
                    <>
                      <br />
                      <Text type='secondary'>
                        Participants: {event.participants.length}
                      </Text>
                    </>
                  )}
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
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title='Tasks vs Interventions Breakdown'
            style={{ boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)' }}
            extra={
              <>
                <Button
                  type='primary'
                  size='small'
                  onClick={() => navigate('/operations/tasks')}
                  style={{ margin: 10 }}
                >
                  View All Tasks
                </Button>
                <Button
                  type='primary'
                  size='small'
                  onClick={() => navigate('/interventions')}
                  style={{ margin: 10 }}
                >
                  View All Interventions
                </Button>
              </>
            }
            hoverable
          >
            <HighchartsReact
              highcharts={Highcharts}
              options={tasksVsInterventionsChart}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title='Compliance Status Breakdown'
            style={{ boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)' }}
            extra={
              <Button
                type='primary'
                size='small'
                onClick={() => navigate('/operations/compliance')}
                style={{ margin: 10 }}
              >
                View All
              </Button>
            }
            hoverable
          >
            <HighchartsReact
              highcharts={Highcharts}
              options={complianceChartOptions}
            />
          </Card>
        </Col>
      </Row>
      <EventModal
        open={eventModalOpen}
        onCancel={() => setEventModalOpen(false)}
        onSubmit={handleAddEvent}
        form={eventForm}
        consultants={consultants}
        projectAdmins={projectAdmins}
        operationsUsers={operationsUsers}
        participants={participants}
      />
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
      <Modal
        title='Event Details'
        open={eventDetailModalOpen}
        onCancel={() => setEventDetailModalOpen(false)}
        footer={null}
        width={600}
      >
        {selectedEvent && (
          <>
            <Alert
              message='This is a scheduled event. Please ensure all participants are informed.'
              type='info'
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Descriptions
              bordered
              column={1}
              size='middle'
              labelStyle={{ width: '40%' }}
            >
              <Descriptions.Item label='Title'>
                {selectedEvent.title}
              </Descriptions.Item>

              <Descriptions.Item label='Date'>
                {selectedEvent.date}
              </Descriptions.Item>

              <Descriptions.Item label='Time'>
                {selectedEvent.startTime?.toDate &&
                selectedEvent.endTime?.toDate
                  ? `${dayjs(selectedEvent.startTime.toDate()).format(
                      'HH:mm'
                    )} - ${dayjs(selectedEvent.endTime.toDate()).format(
                      'HH:mm'
                    )}`
                  : 'N/A'}
              </Descriptions.Item>

              <Descriptions.Item label='Type'>
                <Tag color='blue'>
                  {selectedEvent.type?.charAt(0).toUpperCase() +
                    selectedEvent.type?.slice(1)}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label='Format'>
                <Tag color='green'>
                  {selectedEvent.format?.charAt(0).toUpperCase() +
                    selectedEvent.format?.slice(1)}
                </Tag>
              </Descriptions.Item>

              {selectedEvent.location && (
                <Descriptions.Item label='Location'>
                  {selectedEvent.location}
                </Descriptions.Item>
              )}

              {selectedEvent.link && (
                <Descriptions.Item label='Link'>
                  <a
                    href={selectedEvent.link}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {selectedEvent.link}
                  </a>
                </Descriptions.Item>
              )}

              {selectedEvent.description && (
                <Descriptions.Item label='Description'>
                  {selectedEvent.description}
                </Descriptions.Item>
              )}

              {selectedEvent.participants?.length > 0 && (
                <Descriptions.Item label='Participants'>
                  <ul style={{ paddingLeft: 20, margin: 0 }}>
                    {selectedEvent.participants.map(
                      (participant: any, index: number) => (
                        <li key={index}>{participant.name || participant}</li>
                      )
                    )}
                  </ul>
                </Descriptions.Item>
              )}
            </Descriptions>
          </>
        )}
      </Modal>

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
    </Layout>
  )
}

export default OperationsDashboard
