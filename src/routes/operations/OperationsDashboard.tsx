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
  Tabs,
  Table,
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  message,
  TimePicker
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
  BarsOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { db } from '@/firebase'
import { collection, getDocs, setDoc, doc, Timestamp } from 'firebase/firestore'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs
import dayjs from 'dayjs'

export const OperationsDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [formSubmissions, setFormSubmissions] = useState<any[]>([])
  const [resourceAllocation, setResourceAllocation] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [complianceDocuments, setComplianceDocuments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('1')
  const [tasks, setTasks] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)
  const [taskForm] = Form.useForm()
  const [eventForm] = Form.useForm()
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [eventDetailModalOpen, setEventDetailModalOpen] = useState(false)

  // Statistics Calculation
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

  // Fetch Tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'tasks'))
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
        // Form Submissions
        const formSnapshot = await getDocs(collection(db, 'formSubmissions'))
        const formsList = formSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setFormSubmissions(formsList)

        // Resource Allocation
        const resourceSnapshot = await getDocs(
          collection(db, 'resourceAllocation')
        )
        const resourcesList = resourceSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setResourceAllocation(resourcesList)

        // Participants
        const participantSnapshot = await getDocs(
          collection(db, 'participants')
        )
        const participantsList = participantSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setParticipants(participantsList)
      } catch (error) {
        console.error('Error fetching other dashboard data:', error)
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
  }, [])

  // Fetch Events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'events'))
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
  }, [])

  const handleEventClick = (event: any) => {
    const eventData = events.find(e => e.id === event.id)
    setSelectedEvent(eventData)
    setEventDetailModalOpen(true)
  }

  const handleAddEvent = async (values: any) => {
    try {
      const newId = `event-${Date.now()}`
      const newEvent = {
        id: newId,
        title: values.title,
        date: values.date.format('YYYY-MM-DD'), // ✅ format DatePicker value
        time: values.time || '',
        type: values.type,
        createdAt: Timestamp.now()
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
  const handleAddTask = async (values: any) => {
    try {
      const newId = `task-${Date.now()}`
      const newTask = {
        id: newId,
        title: values.title,
        dueDate: values.dueDate.toDate(), // 👈 convert properly
        priority: values.priority,
        status: 'To Do',
        createdAt: Timestamp.now()
      }
      await setDoc(doc(db, 'tasks', newId), newTask)
      setTasks(prev => [...prev, newTask])
      message.success('Task added successfully')
      setTaskModalOpen(false)
      taskForm.resetFields()
    } catch (error) {
      console.error('Error adding task:', error)
      message.error('Failed to add task')
    }
  }
  const handleCompleteTask = async (taskId: string) => {
    try {
      const updatedTasks = tasks.map(task =>
        task.id === taskId ? { ...task, status: 'Completed' } : task
      )
      setTasks(updatedTasks)
      // If you want to update it in Firestore also (optional):
      await setDoc(doc(db, 'tasks', taskId), {
        ...tasks.find(t => t.id === taskId),
        status: 'Completed'
      })
      message.success('Task marked as completed')
    } catch (error) {
      console.error('Error completing task:', error)
      message.error('Failed to complete task')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'success'
      case 'In Progress':
        return 'processing'
      case 'To Do':
        return 'default'
      case 'Active':
        return 'success'
      case 'Warning':
        return 'warning'
      case 'Closed':
        return 'default'
      default:
        return 'default'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'red'
      case 'Medium':
        return 'orange'
      case 'Low':
        return 'green'
      default:
        return 'blue'
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

  // Navigate to form management
  const goToFormManagement = () => {
    navigate('/operations/forms')
  }

  // Navigate to form responses
  const goToFormResponses = () => {
    navigate('/operations/form-responses')
  }

  // Navigate to resource management
  const goToResourceManagement = () => {
    navigate('/operations/resources')
  }

  // Navigate to participant management
  const goToParticipantManagement = () => {
    navigate('/operations/participants')
  }

  // Columns for form submissions table
  const formColumns = [
    {
      title: 'Form Name',
      dataIndex: 'formName',
      key: 'formName'
    },
    {
      title: 'Total Submissions',
      dataIndex: 'submissions',
      key: 'submissions',
      sorter: (a: any, b: any) => a.submissions - b.submissions
    },
    {
      title: 'Pending Review',
      dataIndex: 'pending',
      key: 'pending',
      render: (pending: number) => (
        <Badge
          count={pending}
          style={{
            backgroundColor: pending > 0 ? '#faad14' : '#52c41a',
            marginRight: '5px'
          }}
        />
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'Active' ? 'green' : 'default'}>{status}</Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button size='small' type='primary' onClick={goToFormResponses}>
            View Responses
          </Button>
        </Space>
      )
    }
  ]

  // Columns for resource allocation table
  const resourceColumns = [
    {
      title: 'Resource',
      dataIndex: 'resource',
      key: 'resource'
    },
    {
      title: 'Allocation',
      dataIndex: 'allocated',
      key: 'allocated',
      render: (allocated: number) => (
        <Progress
          percent={allocated}
          size='small'
          status={allocated > 90 ? 'exception' : 'normal'}
        />
      )
    },
    {
      title: 'Allocated To',
      dataIndex: 'allocatedTo',
      key: 'allocatedTo'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button size='small' type='primary' onClick={goToResourceManagement}>
          Manage
        </Button>
      )
    }
  ]

  // Columns for participants table
  const participantColumns = [
    {
      title: 'Participant',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (stage: string) => (
        <Tag
          color={
            stage === 'Early' ? 'blue' : stage === 'Growth' ? 'green' : 'purple'
          }
        >
          {stage}
        </Tag>
      )
    },
    {
      title: 'Mentor Assigned',
      dataIndex: 'mentorAssigned',
      key: 'mentorAssigned',
      render: (assigned: string) => (
        <Badge
          status={assigned === 'Yes' ? 'success' : 'warning'}
          text={assigned}
        />
      )
    },
    {
      title: 'Next Review',
      dataIndex: 'nextReview',
      key: 'nextReview'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge status={getStatusColor(status) as any} text={status} />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button size='small' type='primary' onClick={goToParticipantManagement}>
          View Details
        </Button>
      )
    }
  ]

  return (
    <div>
      <Helmet>
        <title>Operations Dashboard</title>
        <meta
          name='description'
          content='Manage daily operations and track incubatee progress'
        />
      </Helmet>

      {/* High-level Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card>
            <Statistic
              title='Pending Tasks'
              value={tasks.filter(t => t.status !== 'Completed').length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card>
            <Statistic
              title='Form Submissions'
              value={formSubmissions.length}
              prefix={<FormOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card>
            <Statistic
              title='Active Participants'
              value={participants.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card>
            <Statistic
              title='Resource Utilization'
              value={
                resourceAllocation.length > 0
                  ? Math.round(
                      (resourceAllocation.reduce(
                        (sum, r) => sum + r.allocated,
                        0
                      ) /
                        (resourceAllocation.length * 100)) *
                        100
                    )
                  : 0
              }
              suffix='%'
              prefix={<ApartmentOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main dashboard tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <span>
              <BarsOutlined />
              Daily Operations
            </span>
          }
          key='1'
        >
          <Row gutter={[16, 16]}>
            {/* Task Management */}
            <Col xs={24} lg={14}>
              <Card
                title={
                  <Space>
                    <CheckCircleOutlined />
                    <span>Task Management</span>
                  </Space>
                }
                extra={
                  <Button
                    type='primary'
                    size='small'
                    onClick={() => setTaskModalOpen(true)}
                  >
                    Add Task
                  </Button>
                }
                style={{ marginBottom: '24px' }}
              >
                <List
                  size='small'
                  dataSource={tasks}
                  renderItem={task => (
                    <List.Item
                      actions={[
                        task.status !== 'Completed' && (
                          <Button
                            key='complete'
                            type='link'
                            size='small'
                            onClick={() => handleCompleteTask(task.id)}
                          >
                            Complete
                          </Button>
                        )
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text
                              style={{
                                textDecoration:
                                  task.status === 'Completed'
                                    ? 'line-through'
                                    : 'none'
                              }}
                            >
                              {task.title}
                            </Text>
                            <Tag color={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Tag>
                          </Space>
                        }
                        description={`Due: ${dayjs(
                          task.dueDate.toDate
                            ? task.dueDate.toDate()
                            : task.dueDate
                        ).format('YYYY-MM-DD')}`}
                      />
                      <Badge
                        status={getStatusColor(task.status) as any}
                        text={task.status}
                      />
                    </List.Item>
                  )}
                />
              </Card>

              {/* Compliance Tracking */}

              <Card
                title={
                  <Space>
                    <FileSearchOutlined />
                    <span>Compliance Tracking</span>
                  </Space>
                }
                style={{ marginBottom: '24px' }}
              >
                {/* ➡️ First line - Horizontal Compliance Metrics */}
                <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                  <Col span={8}>
                    <Statistic
                      title='Up-to-date'
                      value={upToDate}
                      suffix={`/ ${total}`}
                      valueStyle={{ color: '#52c41a' }} // ✅ green
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title='Needs Review'
                      value={needsReview}
                      suffix={`/ ${total}`}
                      valueStyle={{ color: '#faad14' }} // ✅ orange
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title='Overdue'
                      value={overdue}
                      suffix={`/ ${total}`}
                      valueStyle={{ color: '#ff4d4f' }} // ✅ red
                    />
                  </Col>
                </Row>

                {/* ➡️ Second line - Progress Bar */}
                <Paragraph>
                  <Text strong>Overall Compliance Status</Text>
                </Paragraph>
                <Progress
                  percent={Math.round((upToDate / total) * 100)}
                  success={{
                    percent: Math.round((upToDate / total) * 100)
                  }}
                  format={percent => `${percent}% Compliant`}
                />

                <Divider style={{ margin: '12px 0' }} />

                {/* Optional: Generate report button */}
                <Button type='primary' block>
                  Generate Compliance Report
                </Button>
              </Card>
            </Col>

            {/* Calendar & Events */}
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
                style={{ marginBottom: '24px' }}
              >
                <Timeline mode='left'>
                  {events.map((event, index) => (
                    <Timeline.Item key={index} dot={getEventIcon(event.type)}>
                      <Text strong>
                        {event.date} - {event.title}
                      </Text>
                      <br />
                      <Space>
                        <Text type='secondary'>Time: {event.time}</Text>
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
                          {event.type.charAt(0).toUpperCase() +
                            event.type.slice(1)}
                        </Tag>
                      </Space>
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
        </TabPane>
      </Tabs>
      {/* Add Task Modal */}
      <Modal
        title='Add New Task'
        open={taskModalOpen}
        onCancel={() => setTaskModalOpen(false)}
        footer={null}
      >
        <Form form={taskForm} layout='vertical' onFinish={handleAddTask}>
          <Form.Item
            name='title'
            label='Task Title'
            rules={[{ required: true, message: 'Please input task title' }]}
          >
            <Input placeholder='Enter task title' />
          </Form.Item>
          <Form.Item
            name='dueDate'
            label='Due Date'
            rules={[{ required: true, message: 'Please select due date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name='priority'
            label='Priority'
            rules={[{ required: true, message: 'Please select priority' }]}
          >
            <Select placeholder='Select priority'>
              <Select.Option value='High'>High</Select.Option>
              <Select.Option value='Medium'>Medium</Select.Option>
              <Select.Option value='Low'>Low</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              Add Task
            </Button>
          </Form.Item>
        </Form>
      </Modal>
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
          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              Add Event
            </Button>
          </Form.Item>
        </Form>
      </Modal>
      {/* Calender Modal */}
      <Modal
        title='Full Calendar View'
        open={calendarModalOpen}
        onCancel={() => setCalendarModalOpen(false)}
        footer={null}
        width={900} // ✅ Wide but not crazy big
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
      {/* V */}
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
              <strong>Date:</strong> {selectedEvent.date}
            </p>
            <p>
              <strong>Time:</strong> {selectedEvent.time || 'N/A'}
            </p>
            <p>
              <strong>Type:</strong> {selectedEvent.type}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default OperationsDashboard
