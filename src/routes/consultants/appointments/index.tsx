import React, { useEffect, useState } from 'react'
import {
  Form,
  Select,
  DatePicker,
  Input,
  Button,
  message,
  Spin,
  Table,
  Tag,
  Space,
  Modal,
  Row,
  Col,
  Card,
  Statistic,
  Typography
} from 'antd'
import dayjs from 'dayjs'
import {
  Timestamp,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc
} from 'firebase/firestore'
import { db, auth } from '@/firebase'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  StopOutlined
} from '@ant-design/icons'

const { Option } = Select
const { Title } = Typography
const { RangePicker } = DatePicker

const AppointmentForm = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [interventions, setInterventions] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [viewReason, setViewReason] = useState<{
    reason: string
    record: any
  } | null>(null)
  const [consultantId, setConsultantId] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [filters, setFilters] = useState({
    status: 'all',
    period: 'all',
    range: []
  })

  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser
      if (!user) return
      setConsultantId(user.uid)

      const interventionQuery = query(
        collection(db, 'assignedInterventions'),
        where('consultantId', '==', user.uid)
      )
      const snapshot = await getDocs(interventionQuery)
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setInterventions(data)

      const appointmentsSnap = await getDocs(
        query(
          collection(db, 'appointments'),
          where('consultantId', '==', user.uid)
        )
      )
      const appts = appointmentsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setAppointments(appts)
    }
    fetchData()
  }, [])

  const sendNotification = async (type: string, appointment: any) => {
    const intervention = interventions.find(
      i => i.interventionId === appointment.interventionId
    )
    const participantName = intervention?.beneficiaryName || 'Participant'
    const interventionTitle =
      intervention?.interventionTitle || 'an intervention'

    await addDoc(collection(db, 'notifications'), {
      type: `appointment/${type.replace('appointment-', '')}`,
      appointmentId: appointment.id,
      recipientRoles: ['admin', 'participant'],
      message: {
        participant: `Your appointment regarding "${interventionTitle}" has been ${
          type === 'appointment-cancelled' ? 'cancelled' : 'updated'
        }.`,
        admin: `A consultant ${
          type === 'appointment-cancelled' ? 'cancelled' : 'updated'
        } an appointment for ${participantName}.`
      },
      metadata: {
        participantId: appointment.participantId,
        consultantId,
        startTime: appointment.startTime,
        endTime: appointment.endTime
      },
      readBy: {},
      createdAt: Timestamp.now()
    })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      const payload = {
        participantId: values.participantId,
        consultantId,
        interventionId: values.interventionId,
        meetingType: values.meetingType,
        meetingLink: values.meetingLink || null,
        startTime: Timestamp.fromDate(values.timeRange[0].toDate()),
        endTime: Timestamp.fromDate(values.timeRange[1].toDate()),
        status: 'pending',
        createdBy: 'consultant',
        updatedAt: Timestamp.now()
      }

      if (editingId) {
        await updateDoc(doc(db, 'appointments', editingId), payload)
        await sendNotification('appointment-edited', {
          ...payload,
          id: editingId
        })
        message.success('Appointment updated successfully')
      } else {
        payload.createdAt = Timestamp.now()
        await addDoc(collection(db, 'appointments'), payload)
        message.success('Appointment scheduled successfully')
      }

      form.resetFields()
      setEditingId(null)
      setShowFormModal(false)
    } catch (error) {
      console.error(error)
      message.error('Failed to save appointment')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (record: any) => {
    form.setFieldsValue({
      interventionId: record.interventionId,
      meetingType: record.meetingType,
      meetingLink: record.meetingLink,
      timeRange: [
        dayjs(record.startTime.toDate()),
        dayjs(record.endTime.toDate())
      ],
      participantId: record.participantId
    })
    setEditingId(record.id)
    setShowFormModal(true)
  }

  const handleCancelAppointment = async (record: any) => {
    try {
      await updateDoc(doc(db, 'appointments', record.id), {
        status: 'cancelled',
        updatedAt: Timestamp.now()
      })
      await sendNotification('appointment-cancelled', record)
      message.success('Appointment cancelled.')
      setViewReason(null)
    } catch (error) {
      console.error(error)
      message.error('Failed to cancel appointment.')
    }
  }

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const filteredAppointments = appointments.filter(a => {
    const matchesStatus =
      filters.status === 'all' || a.status === filters.status
    const now = dayjs()
    let matchesPeriod = true
    if (filters.period === 'today') {
      matchesPeriod = dayjs(a.startTime.toDate()).isSame(now, 'day')
    } else if (filters.period === 'week') {
      matchesPeriod = dayjs(a.startTime.toDate()).isSame(now, 'week')
    } else if (filters.period === 'month') {
      matchesPeriod = dayjs(a.startTime.toDate()).isSame(now, 'month')
    }
    let matchesRange = true
    if (filters.range.length === 2) {
      const [start, end] = filters.range
      matchesRange = dayjs(a.startTime.toDate()).isBetween(
        start,
        end,
        null,
        '[]'
      )
    }
    return matchesStatus && matchesPeriod && matchesRange
  })

  const columns = [
    {
      title: 'Participant',
      dataIndex: 'participantId',
      key: 'participantId'
    },
    {
      title: 'Intervention',
      dataIndex: 'interventionTitle',
      key: 'interventionTitle'
    },
    {
      title: 'Meeting Type',
      dataIndex: 'meetingType',
      key: 'meetingType'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => (
        <Tag color={text === 'declined' ? 'red' : 'blue'}>{text}</Tag>
      )
    },
    {
      title: 'Time',
      key: 'time',
      render: (_, record) => (
        <span>
          {dayjs(record.startTime.toDate()).format('DD MMM YYYY HH:mm')} -{' '}
          {dayjs(record.endTime.toDate()).format('HH:mm')}
        </span>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size='small' onClick={() => handleEdit(record)}>
            Edit
          </Button>
          {record.status === 'declined' && (
            <Button
              size='small'
              onClick={() =>
                setViewReason({
                  reason: record.declinedReason || 'No reason provided',
                  record
                })
              }
            >
              View Reason
            </Button>
          )}
          {record.meetingType !== 'in_person' && record.meetingLink && (
            <Button
              size='small'
              type='link'
              href={record.meetingLink}
              target='_blank'
            >
              Join
            </Button>
          )}
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      <Spin spinning={loading}>
        <Title level={4}>Appointments Manager</Title>
        <Row gutter={[16, 16]} wrap={false} style={{ marginBottom: 16 }}>
          <Col flex='1'>
            <Card>
              <Statistic
                title='Total Appointments'
                value={appointments.length}
                prefix={<CalendarOutlined style={{ color: '#1890ff' }} />}
              />
            </Card>
          </Col>
          <Col flex='1'>
            <Card>
              <Statistic
                title='Pending'
                value={appointments.filter(a => a.status === 'pending').length}
                prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              />
            </Card>
          </Col>
          <Col flex='1'>
            <Card>
              <Statistic
                title='Accepted | Declined'
                value={`${
                  appointments.filter(a => a.status === 'accepted').length
                } | ${
                  appointments.filter(a => a.status === 'declined').length
                }`}
                prefix={
                  <CheckOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                }
                suffix={
                  <CloseOutlined style={{ color: '#f5222d', marginLeft: 8 }} />
                }
              />
            </Card>
          </Col>
          <Col flex='1'>
            <Card>
              <Statistic
                title='Cancelled'
                value={
                  appointments.filter(a => a.status === 'cancelled').length
                }
                prefix={<StopOutlined style={{ color: '#ff4d4f' }} />}
              />
            </Card>
          </Col>
        </Row>

        <Row
          gutter={16}
          align='middle'
          justify='space-between'
          style={{ marginBottom: 16 }}
        >
          <Col>
            <Space>
              <Select
                value={filters.status}
                onChange={val => handleFilterChange('status', val)}
                style={{ width: 150 }}
              >
                <Option value='all'>All Status</Option>
                <Option value='pending'>Pending</Option>
                <Option value='declined'>Declined</Option>
                <Option value='cancelled'>Cancelled</Option>
                <Option value='accepted'>Accepted</Option>
              </Select>
              <Select
                value={filters.period}
                onChange={val => handleFilterChange('period', val)}
                style={{ width: 150 }}
              >
                <Option value='all'>All Periods</Option>
                <Option value='today'>Today</Option>
                <Option value='week'>This Week</Option>
                <Option value='month'>This Month</Option>
              </Select>
              <RangePicker onChange={val => handleFilterChange('range', val)} />
            </Space>
          </Col>
          <Col>
            <Button type='primary' onClick={() => setShowFormModal(true)}>
              Add New
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredAppointments}
          rowKey='id'
          pagination={false}
          style={{ marginBottom: 24 }}
        />
      </Spin>

      <Modal
        title={editingId ? 'Edit Appointment' : 'Appointment Details'}
        open={showFormModal}
        onCancel={() => {
          form.resetFields()
          setEditingId(null)
          setShowFormModal(false)
        }}
        onOk={handleSubmit}
        okText={editingId ? 'Update' : 'Save'}
      >
        <Form layout='vertical' form={form}>
          <Form.Item
            name='interventionId'
            label='Intervention'
            rules={[{ required: true, message: 'Select an intervention' }]}
          >
            <Select placeholder='Select intervention'>
              {interventions.map(item => (
                <Option key={item.id} value={item.id}>
                  {item.interventionTitle} – {item.beneficiaryName}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name='meetingType'
            label='Meeting Type'
            rules={[{ required: true, message: 'Select meeting type' }]}
          >
            <Select
              placeholder='Select meeting type'
              onChange={() => {
                // trigger re-render for conditional display
                form.setFieldsValue({}) // this line forces rerender
              }}
            >
              <Option value='telephonic'>Telephonic</Option>
              <Option value='zoom'>Zoom</Option>
              <Option value='google_meet'>Google Meet</Option>
              <Option value='teams'>Microsoft Teams</Option>
              <Option value='in_person'>In Person</Option>
            </Select>
          </Form.Item>

          {['zoom', 'google_meet', 'teams'].includes(
            form.getFieldValue('meetingType')
          ) && (
            <Form.Item
              name='meetingLink'
              label='Meeting Link'
              rules={[
                {
                  required: true,
                  message: 'Meeting link required for online meeting'
                }
              ]}
            >
              <Input placeholder='Paste meeting link here' />
            </Form.Item>
          )}

          <Form.Item
            name='timeRange'
            label='Start and End Time'
            rules={[{ required: true, message: 'Select date and time range' }]}
          >
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title='Rejection Reason'
        open={!!viewReason}
        onCancel={() => setViewReason(null)}
        footer={null}
      >
        <p>{viewReason?.reason}</p>
        <Space style={{ marginTop: 16 }}>
          <Button type='primary' onClick={() => handleEdit(viewReason!.record)}>
            Reschedule
          </Button>
          <Button
            danger
            onClick={() => handleCancelAppointment(viewReason!.record)}
          >
            Cancel Appointment
          </Button>
        </Space>
      </Modal>
    </div>
  )
}

export default AppointmentForm
