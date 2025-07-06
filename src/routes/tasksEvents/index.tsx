import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  message,
  Popconfirm,
  Badge,
  Tabs,
  Upload,
  Input,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip
} from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  UploadOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  TeamOutlined,
  LinkOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { EventModal } from '@/components/op-dashboard/EventModal'
import { TaskModal } from '@/components/op-dashboard/TaskModal'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'

const { TabPane } = Tabs
const { Title, Link } = Typography

export const TasksEventsPage: React.FC = () => {
  const { user } = useFullIdentity()
  const [events, setEvents] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<any>(null)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [eventForm] = Form.useForm()
  const [taskForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [proofModalOpen, setProofModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)

  const isOperations = user?.role === 'operations'

  useEffect(() => {
    // Mock data - replace with actual API calls
    const mockEvents = [
      {
        id: '1',
        title: 'Team Meeting',
        type: { name: 'Meeting' },
        format: 'virtual',
        date: '2024-01-15',
        startTime: new Date('2024-01-15T09:00:00'),
        endTime: new Date('2024-01-15T10:00:00'),
        participants: ['user1', 'user2'],
        link: 'https://meet.google.com/abc-defg-hij',
        userStatus: 'pending'
      },
      {
        id: '2',
        title: 'Client Workshop',
        type: { name: 'Workshop' },
        format: 'hybrid',
        date: '2024-01-18',
        startTime: new Date('2024-01-18T14:00:00'),
        endTime: new Date('2024-01-18T16:00:00'),
        participants: ['user1', 'user2', 'user3', 'user4'],
        location: 'Conference Room A',
        link: 'https://zoom.us/j/123456789',
        userStatus: 'confirmed'
      },
      {
        id: '3',
        title: 'Site Visit',
        type: { name: 'Site Visit' },
        format: 'in-person',
        date: '2024-01-20',
        startTime: new Date('2024-01-20T10:00:00'),
        endTime: new Date('2024-01-20T12:00:00'),
        participants: ['user1', 'user2'],
        location: '123 Business Ave, City',
        userStatus: 'declined'
      }
    ]

    const mockTasks = [
      {
        id: '1',
        title: 'Complete Project Report',
        taskType: { name: 'Report', proofRequired: true },
        priority: 'High',
        dueDate: new Date('2024-01-20'),
        status: 'To Do',
        assignedTo: user?.id
      },
      {
        id: '2',
        title: 'Update Documentation',
        taskType: { name: 'Documentation', proofRequired: false },
        priority: 'Medium',
        dueDate: new Date('2024-01-25'),
        status: 'In Progress',
        assignedTo: user?.id
      },
      {
        id: '3',
        title: 'Code Review',
        taskType: { name: 'Review', proofRequired: false },
        priority: 'Low',
        dueDate: new Date('2024-01-30'),
        status: 'Completed',
        assignedTo: user?.id
      }
    ]

    setEvents(mockEvents)
    setTasks(mockTasks)
  }, [user])

  // Calculate metrics
  const eventMetrics = {
    total: events.length,
    confirmed: events.filter(e => e.userStatus === 'confirmed').length,
    pending: events.filter(e => e.userStatus === 'pending').length,
    virtual: events.filter(e => e.format === 'virtual').length
  }

  const taskMetrics = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'Completed').length,
    inProgress: tasks.filter(t => t.status === 'In Progress').length,
    overdue: tasks.filter(
      t => t.status !== 'Completed' && new Date(t.dueDate) < new Date()
    ).length
  }

  const handleConfirmAttendance = (
    eventId: string,
    status: 'confirmed' | 'declined'
  ) => {
    setEvents(prev =>
      prev.map(event =>
        event.id === eventId ? { ...event, userStatus: status } : event
      )
    )
    message.success(`Attendance ${status}`)
  }

  const handleDeleteEvent = (eventId: string) => {
    setEvents(prev => prev.filter(event => event.id !== eventId))
    message.success('Event deleted successfully')
  }

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId))
    message.success('Task deleted successfully')
  }

  const handleCompleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (task?.taskType?.proofRequired) {
      setSelectedTask(task)
      setProofModalOpen(true)
    } else {
      setTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, status: 'Completed' } : t))
      )
      message.success('Task completed')
    }
  }

  const handleProofSubmission = (values: any) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === selectedTask?.id ? { ...t, status: 'Completed' } : t
      )
    )
    setProofModalOpen(false)
    setSelectedTask(null)
    message.success('Task completed with proof')
  }

  const eventColumns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: any) => (
        <div>
          <strong>{title}</strong>
          {record.format === 'virtual' && record.link && (
            <div style={{ marginTop: 4 }}>
              <Link
                href={record.link}
                target='_blank'
                rel='noopener noreferrer'
              >
                <LinkOutlined style={{ marginRight: 4 }} />
                Join Meeting
              </Link>
            </div>
          )}
          {record.format === 'hybrid' && record.link && (
            <div style={{ marginTop: 4 }}>
              <Link
                href={record.link}
                target='_blank'
                rel='noopener noreferrer'
              >
                <LinkOutlined style={{ marginRight: 4 }} />
                Online Link
              </Link>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Type',
      dataIndex: ['type', 'name'],
      key: 'type'
    },
    {
      title: 'Format',
      dataIndex: 'format',
      key: 'format',
      render: (format: string) => (
        <Tag
          color={
            format === 'virtual'
              ? 'blue'
              : format === 'in-person'
              ? 'green'
              : 'orange'
          }
        >
          {format}
        </Tag>
      )
    },
    {
      title: 'Date & Time',
      key: 'datetime',
      render: (record: any) => (
        <div>
          <div>{dayjs(record.date).format('MMM DD, YYYY')}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {dayjs(record.startTime).format('HH:mm')} -{' '}
            {dayjs(record.endTime).format('HH:mm')}
          </div>
        </div>
      )
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (location: string) => location || '-'
    },
    {
      title: 'Participants',
      dataIndex: 'participants',
      key: 'participants',
      render: (participants: string[]) => (
        <Tooltip title={`${participants?.length || 0} participants`}>
          <Badge count={participants?.length || 0} showZero />
        </Tooltip>
      )
    },
    ...(isOperations
      ? [
          {
            title: 'Actions',
            key: 'actions',
            render: (record: any) => (
              <Space>
                <Button
                  icon={<EditOutlined />}
                  size='small'
                  onClick={() => {
                    setEditingEvent(record)
                    setEventModalOpen(true)
                  }}
                />
                <Popconfirm
                  title='Are you sure you want to delete this event?'
                  onConfirm={() => handleDeleteEvent(record.id)}
                >
                  <Button icon={<DeleteOutlined />} size='small' danger />
                </Popconfirm>
              </Space>
            )
          }
        ]
      : [
          {
            title: 'Your Status',
            key: 'status',
            render: (record: any) => (
              <Space>
                {record.userStatus === 'pending' && (
                  <>
                    <Button
                      icon={<CheckOutlined />}
                      size='small'
                      type='primary'
                      onClick={() =>
                        handleConfirmAttendance(record.id, 'confirmed')
                      }
                    >
                      Confirm
                    </Button>
                    <Button
                      icon={<CloseOutlined />}
                      size='small'
                      danger
                      onClick={() =>
                        handleConfirmAttendance(record.id, 'declined')
                      }
                    >
                      Decline
                    </Button>
                  </>
                )}
                {record.userStatus !== 'pending' && (
                  <Tag
                    color={record.userStatus === 'confirmed' ? 'green' : 'red'}
                  >
                    {record.userStatus}
                  </Tag>
                )}
              </Space>
            )
          }
        ])
  ]

  const taskColumns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title'
    },
    {
      title: 'Type',
      dataIndex: ['taskType', 'name'],
      key: 'type'
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag
          color={
            priority === 'High'
              ? 'red'
              : priority === 'Medium'
              ? 'orange'
              : 'green'
          }
          icon={priority === 'High' ? <ExclamationCircleOutlined /> : undefined}
        >
          {priority}
        </Tag>
      )
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date: Date, record: any) => {
        const isOverdue =
          record.status !== 'Completed' && new Date(date) < new Date()
        return (
          <div style={{ color: isOverdue ? '#ff4d4f' : undefined }}>
            {dayjs(date).format('MMM DD, YYYY')}
            {isOverdue && <div style={{ fontSize: '12px' }}>Overdue</div>}
          </div>
        )
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={
            status === 'Completed'
              ? 'success'
              : status === 'In Progress'
              ? 'processing'
              : 'default'
          }
          text={status}
        />
      )
    },
    ...(isOperations
      ? [
          {
            title: 'Actions',
            key: 'actions',
            render: (record: any) => (
              <Space>
                <Button
                  icon={<EditOutlined />}
                  size='small'
                  onClick={() => {
                    setEditingTask(record)
                    setTaskModalOpen(true)
                  }}
                />
                <Popconfirm
                  title='Are you sure you want to delete this task?'
                  onConfirm={() => handleDeleteTask(record.id)}
                >
                  <Button icon={<DeleteOutlined />} size='small' danger />
                </Popconfirm>
              </Space>
            )
          }
        ]
      : [
          {
            title: 'Actions',
            key: 'actions',
            render: (record: any) =>
              record.status !== 'Completed' && (
                <Button
                  type='primary'
                  size='small'
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleCompleteTask(record.id)}
                >
                  Complete
                </Button>
              )
          }
        ])
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        <BarChartOutlined style={{ marginRight: 8 }} />
        Tasks & Events Dashboard
      </Title>

      {/* Metrics Overview */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title='Total Events'
              value={eventMetrics.total}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title='Confirmed'
              value={eventMetrics.confirmed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title='Tasks Completed'
              value={taskMetrics.completed}
              suffix={`/ ${taskMetrics.total}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title='Overdue Tasks'
              value={taskMetrics.overdue}
              prefix={<ClockCircleOutlined />}
              valueStyle={{
                color: taskMetrics.overdue > 0 ? '#ff4d4f' : '#52c41a'
              }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey='events'>
        <TabPane
          tab={
            <span>
              <CalendarOutlined />
              Events ({eventMetrics.total})
            </span>
          }
          key='events'
        >
          <Card
            title='Upcoming Events'
            extra={
              isOperations && (
                <Button
                  type='primary'
                  icon={<CalendarOutlined />}
                  onClick={() => setEventModalOpen(true)}
                >
                  Add Event
                </Button>
              )
            }
          >
            <Table
              columns={eventColumns}
              dataSource={events}
              rowKey='id'
              loading={loading}
              scroll={{ x: 800 }}
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <CheckCircleOutlined />
              Tasks ({taskMetrics.total})
            </span>
          }
          key='tasks'
        >
          <Card
            title='My Tasks'
            extra={
              isOperations && (
                <Button
                  type='primary'
                  icon={<CheckCircleOutlined />}
                  onClick={() => setTaskModalOpen(true)}
                >
                  Add Task
                </Button>
              )
            }
          >
            <Table
              columns={taskColumns}
              dataSource={tasks}
              rowKey='id'
              loading={loading}
              scroll={{ x: 800 }}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Modals for Operations users */}
      {isOperations && (
        <>
          <EventModal
            open={eventModalOpen}
            onCancel={() => {
              setEventModalOpen(false)
              setEditingEvent(null)
              eventForm.resetFields()
            }}
            onSubmit={values => {
              console.log('Event values:', values)
              setEventModalOpen(false)
              eventForm.resetFields()
              message.success('Event saved successfully')
            }}
            form={eventForm}
            consultants={[]}
            projectAdmins={[]}
            operationsUsers={[]}
            participants={[]}
          />

          <TaskModal
            open={taskModalOpen}
            onCancel={() => {
              setTaskModalOpen(false)
              setEditingTask(null)
              taskForm.resetFields()
            }}
            onSubmit={values => {
              console.log('Task values:', values)
              setTaskModalOpen(false)
              taskForm.resetFields()
              message.success('Task saved successfully')
            }}
            form={taskForm}
            consultants={[]}
            projectAdmins={[]}
            operationsUsers={[]}
            departments={[]}
            userDepartment={null}
          />
        </>
      )}

      {/* Proof Submission Modal */}
      <Modal
        title='Submit Proof of Completion'
        open={proofModalOpen}
        onCancel={() => {
          setProofModalOpen(false)
          setSelectedTask(null)
        }}
        footer={null}
        width={500}
      >
        {selectedTask && (
          <Form onFinish={handleProofSubmission} layout='vertical'>
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                background: '#f5f5f5',
                borderRadius: 6
              }}
            >
              <strong>Task:</strong> {selectedTask.title}
              <br />
              <strong>Type:</strong> {selectedTask.taskType.name}
            </div>
            <Form.Item
              name='description'
              label='Description of Completion'
              rules={[
                { required: true, message: 'Please provide a description' }
              ]}
            >
              <Input.TextArea
                rows={4}
                placeholder='Describe how you completed this task and what was accomplished'
              />
            </Form.Item>
            <Form.Item name='file' label='Upload Supporting Files (Optional)'>
              <Upload>
                <Button icon={<UploadOutlined />}>Click to Upload</Button>
              </Upload>
            </Form.Item>
            <Form.Item>
              <Button type='primary' htmlType='submit' block>
                Submit Proof & Complete Task
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}
