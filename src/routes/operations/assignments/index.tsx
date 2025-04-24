import React, { useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Table,
  Space,
  Tag,
  Button,
  Tooltip,
  Modal,
  Form,
  Input,
  message,
  DatePicker,
  Select
} from 'antd'
import {
  CalendarOutlined,
  CommentOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { Timestamp } from 'firebase/firestore'
import { useGetIdentity } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface Assignment {
  id: string
  participantId: string
  participantName: string
  intervention: string
  consultantId: string
  consultantName: string
  status: 'active' | 'completed' | 'cancelled'
  createdAt: Timestamp
  lastSessionDate?: Timestamp
  nextSessionDate?: Timestamp
  notes?: string
  feedback?: {
    rating: number
    comments: string
  }
}

interface UserIdentity {
  id: string
  name?: string
  email?: string
  role?: string
  avatar?: string
  [key: string]: any
}

export const ConsultantAssignments: React.FC = () => {
  const { data: user } = useGetIdentity<UserIdentity>()
  const navigate = useNavigate()

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionModalVisible, setSessionModalVisible] = useState(false)
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null)
  const [sessionForm] = Form.useForm()
  const [notesModalVisible, setNotesModalVisible] = useState(false)
  const [notesForm] = Form.useForm()
  const [assignmentModalVisible, setAssignmentModalVisible] = useState(false)
  const [assignmentForm] = Form.useForm()

  // Dummy options (replace with Firebase fetches if needed)
  const participantOptions = [
    'John Smith',
    'Sara Johnson',
    'BrightTech',
    'Green Farms'
  ]
  const consultantOptions = ['Dr. Michael Brown', 'Jane Wilson']
  const interventionOptions = [
    'Website Development',
    'Logo Design',
    'Financial Literacy',
    'Market Research',
    'Technical Training'
  ]

  useEffect(() => {
    const fetchAssignments = async () => {
      setLoading(true)
      try {
        const mockAssignments: Assignment[] = [
          {
            id: 'a1',
            participantId: 'p1',
            participantName: 'John Smith',
            intervention: 'Website Development',
            consultantId: 'c1',
            consultantName: user?.name || 'Current Consultant',
            status: 'active',
            createdAt: Timestamp.fromDate(
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            ),
            lastSessionDate: Timestamp.fromDate(
              new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
            ),
            nextSessionDate: Timestamp.fromDate(
              new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
            )
          },
          {
            id: 'a2',
            participantId: 'p2',
            participantName: 'Sara Johnson',
            intervention: 'Logo Design',
            consultantId: 'c1',
            consultantName: user?.name || 'Current Consultant',
            status: 'active',
            createdAt: Timestamp.fromDate(
              new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
            ),
            lastSessionDate: Timestamp.fromDate(
              new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
            )
          }
        ]

        setAssignments(mockAssignments)
      } catch (error) {
        console.error('Error fetching assignments:', error)
        message.error('Failed to load assignments')
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchAssignments()
    }
  }, [user])

  const showSessionModal = (assignment: Assignment) => {
    setSelectedAssignment(assignment)
    sessionForm.resetFields()
    setSessionModalVisible(true)
  }

  const handleRecordSession = async (values: any) => {
    if (!selectedAssignment) return

    try {
      const updatedAssignments = assignments.map(a => {
        if (a.id === selectedAssignment.id) {
          return {
            ...a,
            lastSessionDate: Timestamp.now(),
            nextSessionDate: values.nextSessionDate
              ? Timestamp.fromDate(values.nextSessionDate.toDate())
              : undefined
          }
        }
        return a
      })

      setAssignments(updatedAssignments)
      setSessionModalVisible(false)
      message.success('Session recorded successfully')
    } catch (error) {
      console.error('Error recording session:', error)
      message.error('Failed to record session')
    }
  }

  const showNotesModal = (assignment: Assignment) => {
    setSelectedAssignment(assignment)
    notesForm.setFieldsValue({
      notes: assignment.notes || ''
    })
    setNotesModalVisible(true)
  }

  const handleSaveNotes = async (values: any) => {
    if (!selectedAssignment) return

    try {
      const updatedAssignments = assignments.map(a => {
        if (a.id === selectedAssignment.id) {
          return {
            ...a,
            notes: values.notes
          }
        }
        return a
      })

      setAssignments(updatedAssignments)
      setNotesModalVisible(false)
      message.success('Notes saved successfully')
    } catch (error) {
      console.error('Error saving notes:', error)
      message.error('Failed to save notes')
    }
  }

  const handleCompleteAssignment = (assignmentId: string) => {
    Modal.confirm({
      title: 'Mark Assignment as Completed',
      content: 'Are you sure you want to mark this assignment as completed?',
      onOk: async () => {
        try {
          const updatedAssignments = assignments.map(a => {
            if (a.id === assignmentId) {
              return {
                ...a,
                status: 'completed'
              }
            }
            return a
          })

          setAssignments(updatedAssignments)
          message.success('Assignment marked as completed')
        } catch (error) {
          console.error('Error updating assignment:', error)
          message.error('Failed to update assignment')
        }
      }
    })
  }

  const columns = [
    {
      title: 'Participant',
      dataIndex: 'participantName',
      key: 'participantName'
    },
    {
      title: 'Consultant',
      dataIndex: 'consultantName',
      key: 'consultantName'
    },
    {
      title: 'Intervention',
      dataIndex: 'intervention',
      key: 'intervention'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag
          color={
            status === 'active'
              ? 'green'
              : status === 'completed'
              ? 'blue'
              : 'red'
          }
        >
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Last Session',
      key: 'lastSessionDate',
      render: (record: Assignment) =>
        record.lastSessionDate
          ? new Date(record.lastSessionDate.toMillis()).toLocaleDateString()
          : 'No sessions yet'
    },
    {
      title: 'Next Session',
      key: 'nextSessionDate',
      render: (record: Assignment) =>
        record.nextSessionDate
          ? new Date(record.nextSessionDate.toMillis()).toLocaleDateString()
          : 'Not scheduled'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Assignment) => (
        <div>
          <Space wrap>
            <Button
              type='primary'
              size='small'
              icon={<CalendarOutlined />}
              onClick={() => showSessionModal(record)}
              disabled={record.status !== 'active'}
            >
              Record Session
            </Button>
            <Button
              size='small'
              icon={<CommentOutlined />}
              onClick={() => showNotesModal(record)}
              disabled={record.status !== 'active'}
            >
              Notes
            </Button>
          </Space>
          {record.status === 'active' && (
            <div style={{ marginTop: 8 }}>
              <Space wrap>
                <Button
                  type='primary'
                  size='small'
                  icon={<CheckCircleOutlined />}
                  style={{ backgroundColor: '#52c41a' }}
                  onClick={() => handleCompleteAssignment(record.id)}
                >
                  Complete
                </Button>
                <Button
                  danger
                  size='small'
                  onClick={() => {
                    Modal.confirm({
                      title: 'Cancel Assignment',
                      content:
                        'Are you sure you want to cancel this assignment?',
                      onOk: () => {
                        const updated = assignments.map(a =>
                          a.id === record.id
                            ? {
                                ...a,
                                status: 'cancelled' as Assignment['status']
                              }
                            : a
                        )
                        setAssignments(updated)
                        message.success('Assignment cancelled')
                      }
                    })
                  }}
                >
                  Cancel
                </Button>
              </Space>
            </div>
          )}
        </div>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* 🔘 Header + Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 24
        }}
      >
        <Title level={4}>Consultant Assignments</Title>
        <Button
          type='primary'
          icon={<CheckCircleOutlined />}
          onClick={() => setAssignmentModalVisible(true)}
        >
          Assign New Intervention
        </Button>
      </div>

      {/* 🔁 Assignment Table */}
      <Table
        columns={columns}
        dataSource={assignments}
        rowKey='id'
        loading={loading}
        expandable={{
          expandedRowRender: record => (
            <div style={{ padding: '20px' }}>
              <Title level={5}>Assignment Details</Title>
              <Paragraph>
                <Text strong>Created: </Text>
                {new Date(record.createdAt.toMillis()).toLocaleDateString()}
              </Paragraph>
              {record.notes && (
                <div>
                  <Text strong>Notes: </Text>
                  <Paragraph>{record.notes}</Paragraph>
                </div>
              )}
            </div>
          )
        }}
      />

      {/* 📆 Session Modal */}
      <Modal
        title='Record Mentoring Session'
        open={sessionModalVisible}
        onCancel={() => setSessionModalVisible(false)}
        footer={null}
      >
        <Form
          form={sessionForm}
          layout='vertical'
          onFinish={handleRecordSession}
        >
          <Form.Item name='nextSessionDate' label='Schedule Next Session'>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name='sessionNotes' label='Session Notes'>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type='primary' htmlType='submit'>
              Record Session
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 📝 Notes Modal */}
      <Modal
        title='Participant Notes'
        open={notesModalVisible}
        onCancel={() => setNotesModalVisible(false)}
        footer={null}
      >
        <Form form={notesForm} layout='vertical' onFinish={handleSaveNotes}>
          <Form.Item name='notes' label='Notes'>
            <TextArea
              rows={6}
              placeholder='Enter your notes about this participant...'
            />
          </Form.Item>
          <Form.Item>
            <Button type='primary' htmlType='submit'>
              Save Notes
            </Button>
          </Form.Item>
        </Form>
      </Modal>
      {/* 📝 Assignments Modal */}
      <Modal
        title='Assign New Intervention'
        open={assignmentModalVisible}
        onCancel={() => setAssignmentModalVisible(false)}
        footer={null}
      >
        <Form
          form={assignmentForm}
          layout='vertical'
          onFinish={values => {
            const newAssignment = {
              id: `a${Date.now()}`,
              participantId: `pid-${Date.now()}`,
              participantName: values.participant,
              consultantId: `cid-${Date.now()}`,
              consultantName: values.consultant,
              intervention: values.intervention,
              status: 'active',
              createdAt: Timestamp.now()
            }
            setAssignments(prev => [...prev, newAssignment])
            message.success('New intervention assigned successfully')
            setAssignmentModalVisible(false)
            assignmentForm.resetFields()
          }}
        >
          <Form.Item
            name='participant'
            label='Select Participant'
            rules={[{ required: true, message: 'Please select a participant' }]}
          >
            <Select placeholder='Choose a participant'>
              {participantOptions.map(name => (
                <Select.Option key={name} value={name}>
                  {name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name='consultant'
            label='Select Consultant'
            rules={[{ required: true, message: 'Please select a consultant' }]}
          >
            <Select placeholder='Choose a consultant'>
              {consultantOptions.map(name => (
                <Select.Option key={name} value={name}>
                  {name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name='intervention'
            label='Select Intervention'
            rules={[
              { required: true, message: 'Please select an intervention' }
            ]}
          >
            <Select placeholder='Choose an intervention'>
              {interventionOptions.map(name => (
                <Select.Option key={name} value={name}>
                  {name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              Create Assignment
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
