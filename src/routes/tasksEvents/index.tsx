import React, { useEffect, useState } from 'react'
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
  Tooltip,
  Select
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
  LinkOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import dayjs from 'dayjs'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { EventModal } from '@/components/op-dashboard/EventModal'
import { TaskModal } from '@/components/op-dashboard/TaskModal'

const { TabPane } = Tabs
const { Title, Link } = Typography
const { Option } = Select

const today = dayjs().startOf('day')
const startOfWeek = dayjs().startOf('week')
const endOfWeek = dayjs().endOf('week')
const startOfMonth = dayjs().startOf('month')
const endOfMonth = dayjs().endOf('month')

export const TasksEventsPage: React.FC = () => {
  const { user } = useFullIdentity()
  const isOperations = user?.role === 'operations'
  const [loading, setLoading] = useState(false)

  const [events, setEvents] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [editingEvent, setEditingEvent] = useState<any>(null)
  const [editingTask, setEditingTask] = useState<any>(null)

  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [proofModalOpen, setProofModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)

  const [eventForm] = Form.useForm()
  const [taskForm] = Form.useForm()
  const [filterRange, setFilterRange] = useState('All')

  useEffect(() => {
    if (!user?.email) return

    const unsubEvents = onSnapshot(
      isOperations
        ? collection(db, 'events')
        : query(
            collection(db, 'events'),
            where('participantEmails', 'array-contains', user.email)
          ),
      snapshot => {
        const fetched = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setEvents(fetched)
      }
    )

    const unsubTasks = onSnapshot(
      isOperations
        ? collection(db, 'tasks')
        : query(collection(db, 'tasks'), where('assignedTo', '==', user.email)),
      snapshot => {
        const fetched = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setTasks(fetched)
      }
    )

    return () => {
      unsubEvents()
      unsubTasks()
    }
  }, [user?.email])

  const filterByRange = (items: any[], dateField: string) => {
    return items.filter(item => {
      const d = dayjs(item[dateField])
      if (filterRange === 'Today') return d.isSame(today, 'day')
      if (filterRange === 'This Week')
        return d.isBetween(startOfWeek, endOfWeek, null, '[]')
      if (filterRange === 'This Month')
        return d.isBetween(startOfMonth, endOfMonth, null, '[]')
      return true
    })
  }

  const filteredEvents = filterByRange(events, 'date')
  const filteredTasks = filterByRange(tasks, 'dueDate')
  // Metrics
  const eventMetrics = {
    total: filteredEvents.length,
    confirmed: filteredEvents.filter(e => e.userStatus === 'confirmed').length,
    pending: filteredEvents.filter(e => e.userStatus === 'pending').length
  }

  const taskMetrics = {
    total: filteredTasks.length,
    completed: filteredTasks.filter(t => t.status === 'Completed').length,
    overdue: filteredTasks.filter(
      t => t.status !== 'Completed' && dayjs(t.dueDate).isBefore(today)
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
          {record.link && (
            <div style={{ fontSize: 12 }}>
              <Link href={record.link} target='_blank'>
                <LinkOutlined /> Join
              </Link>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Type',
      dataIndex: ['type', 'name']
    },
    {
      title: 'Format',
      dataIndex: 'format',
      render: (val: string) => (
        <Tag
          color={
            val === 'virtual'
              ? 'blue'
              : val === 'in-person'
              ? 'green'
              : 'orange'
          }
        >
          {val}
        </Tag>
      )
    },
    {
      title: 'Date',
      dataIndex: 'date',
      render: (val: string) => dayjs(val).format('MMM D, YYYY')
    },
    {
      title: 'Your Status',
      render: (_: any, record: any) =>
        record.userStatus === 'pending' ? (
          <Space>
            <Button
              type='link'
              icon={<CheckOutlined />}
              onClick={() => handleConfirmAttendance(record.id, 'confirmed')}
            />
            <Button
              type='link'
              danger
              icon={<CloseOutlined />}
              onClick={() => handleConfirmAttendance(record.id, 'declined')}
            />
          </Space>
        ) : (
          <Tag color={record.userStatus === 'confirmed' ? 'green' : 'red'}>
            {record.userStatus}
          </Tag>
        )
    }
  ]

  const taskColumns = [
    {
      title: 'Title',
      dataIndex: 'title'
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      render: (val: string) => (
        <Tag
          color={val === 'High' ? 'red' : val === 'Medium' ? 'orange' : 'green'}
        >
          {val}
        </Tag>
      )
    },
    {
      title: 'Due',
      dataIndex: 'dueDate',
      render: (val: string) => dayjs(val).format('MMM D')
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (val: string) => (
        <Badge
          status={val === 'Completed' ? 'success' : 'processing'}
          text={val}
        />
      )
    },
    {
      title: 'Actions',
      render: (_: any, record: any) =>
        record.status !== 'Completed' && (
          <Button
            type='primary'
            icon={<CheckOutlined />}
            onClick={() => handleCompleteTask(record.id)}
          >
            Complete
          </Button>
        )
    }
  ]
  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <BarChartOutlined /> Tasks & Events Dashboard
      </Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Events (Confirmed | Pending)'
              value={`${eventMetrics.confirmed} | ${eventMetrics.pending}`}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Completed Tasks'
              value={taskMetrics.completed}
              suffix={`/ ${taskMetrics.total}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
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

      <div style={{ marginBottom: 16 }}>
        <Select value={filterRange} onChange={setFilterRange}>
          <Select.Option value='All'>All</Select.Option>
          <Select.Option value='Today'>Today</Select.Option>
          <Select.Option value='This Week'>This Week</Select.Option>
          <Select.Option value='This Month'>This Month</Select.Option>
        </Select>
      </div>

      <Tabs defaultActiveKey='events'>
        <TabPane
          key='events'
          tab={
            <span>
              <CalendarOutlined /> Events
            </span>
          }
        >
          <Table
            dataSource={filteredEvents}
            columns={eventColumns}
            rowKey='id'
            pagination={{ pageSize: 5 }}
          />
        </TabPane>

        <TabPane
          key='tasks'
          tab={
            <span>
              <CheckCircleOutlined /> Tasks
            </span>
          }
        >
          <Table
            dataSource={filteredTasks}
            columns={taskColumns}
            rowKey='id'
            pagination={{ pageSize: 5 }}
          />
        </TabPane>
      </Tabs>

      <Modal
        title='Submit Proof of Completion'
        open={proofModalOpen}
        onCancel={() => setProofModalOpen(false)}
        onOk={() => proofForm.submit()}
        okText='Submit Proof'
        confirmLoading={loading}
      >
        <Form
          form={proofForm}
          layout='vertical'
          onFinish={handleProofSubmission}
        >
          <Form.Item
            name='description'
            label='Proof Description'
            rules={[{ required: true, message: 'Enter description' }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name='file' label='Upload File'>
            <Upload beforeUpload={() => false}>
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
