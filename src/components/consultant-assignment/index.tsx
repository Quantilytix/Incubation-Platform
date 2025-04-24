import React, { useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Form,
  Select,
  Button,
  Table,
  Space,
  Tag,
  Modal,
  Rate,
  Input,
  message,
  Tabs,
  Divider,
  Breadcrumb
} from 'antd'
import {
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
  HomeOutlined
} from '@ant-design/icons'
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
  getDoc
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { TextArea } = Input
const { TabPane } = Tabs

interface Participant {
  id: string
  name: string
  email: string
  stage: string
  needs: string[]
}

interface Consultant {
  id: string
  name: string
  email: string
  expertise: string[]
  availability: string
  rating: number
}

interface Assignment {
  id: string
  participantId: string
  participantName: string
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

export const ConsultantAssignment: React.FC = () => {
  const navigate = useNavigate()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(
    null
  )
  const [selectedConsultant, setSelectedConsultant] = useState<string | null>(
    null
  )
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false)
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null)
  const [feedbackForm] = Form.useForm()
  const [sessionModalVisible, setSessionModalVisible] = useState(false)
  const [sessionForm] = Form.useForm()

  // Load data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Mock data for now until we implement actual Firebase collections
        // In a real implementation, these would be fetched from Firestore
        const mockParticipants: Participant[] = [
          {
            id: 'p1',
            name: 'John Smith',
            email: 'john@example.com',
            stage: 'Ideation',
            needs: ['Business Model', 'Market Research']
          },
          {
            id: 'p2',
            name: 'Sara Johnson',
            email: 'sara@example.com',
            stage: 'MVP',
            needs: ['Technical Advice', 'Product Development']
          }
        ]

        const mockConsultants: Consultant[] = [
          {
            id: 'c1',
            name: 'Dr. Michael Brown',
            email: 'michael@example.com',
            expertise: ['Business Strategy', 'Market Research'],
            availability: 'Mon, Wed',
            rating: 4.8
          },
          {
            id: 'c2',
            name: 'Jane Wilson',
            email: 'jane@example.com',
            expertise: ['Technical Architecture', 'Product Development'],
            availability: 'Tue, Thu',
            rating: 4.5
          }
        ]

        const mockAssignments: Assignment[] = [
          {
            id: 'a1',
            participantId: 'p1',
            participantName: 'John Smith',
            consultantId: 'c1',
            consultantName: 'Dr. Michael Brown',
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
          }
        ]

        setParticipants(mockParticipants)
        setConsultants(mockConsultants)
        setAssignments(mockAssignments)
      } catch (error) {
        console.error('Error fetching data:', error)
        message.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Handle creating a new assignment
  const handleCreateAssignment = async () => {
    if (!selectedParticipant || !selectedConsultant) {
      message.error('Please select both a participant and a consultant')
      return
    }

    try {
      // Find the selected participant and consultant
      const participant = participants.find(p => p.id === selectedParticipant)
      const consultant = consultants.find(c => c.id === selectedConsultant)

      if (!participant || !consultant) {
        message.error('Invalid selection')
        return
      }

      // In a real implementation, this would create a document in Firestore
      const newAssignment: Assignment = {
        id: `a${Date.now()}`, // Mock ID generation
        participantId: participant.id,
        participantName: participant.name,
        consultantId: consultant.id,
        consultantName: consultant.name,
        status: 'active',
        createdAt: Timestamp.now()
      }

      // Add to our state (in a real implementation, this would happen after Firebase confirmation)
      setAssignments([...assignments, newAssignment])
      message.success(`Assigned ${consultant.name} to ${participant.name}`)

      // Reset selections
      setSelectedParticipant(null)
      setSelectedConsultant(null)
    } catch (error) {
      console.error('Error creating assignment:', error)
      message.error('Failed to create assignment')
    }
  }

  // Handle recording a session
  const showSessionModal = (assignment: Assignment) => {
    setSelectedAssignment(assignment)
    sessionForm.resetFields()
    setSessionModalVisible(true)
  }

  const handleRecordSession = async (values: any) => {
    if (!selectedAssignment) return

    try {
      // Update assignment with new session info
      const updatedAssignments = assignments.map(a => {
        if (a.id === selectedAssignment.id) {
          return {
            ...a,
            lastSessionDate: Timestamp.now(),
            nextSessionDate: values.nextSessionDate
              ? Timestamp.fromDate(values.nextSessionDate.toDate())
              : undefined,
            notes: values.notes
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

  // Handle providing feedback
  const showFeedbackModal = (assignment: Assignment) => {
    setSelectedAssignment(assignment)
    feedbackForm.resetFields()
    setFeedbackModalVisible(true)
  }

  const handleSubmitFeedback = async (values: any) => {
    if (!selectedAssignment) return

    try {
      // Update assignment with feedback
      const updatedAssignments = assignments.map(a => {
        if (a.id === selectedAssignment.id) {
          return {
            ...a,
            feedback: {
              rating: values.rating,
              comments: values.comments
            }
          }
        }
        return a
      })

      setAssignments(updatedAssignments)
      setFeedbackModalVisible(false)
      message.success('Feedback submitted successfully')
    } catch (error) {
      console.error('Error submitting feedback:', error)
      message.error('Failed to submit feedback')
    }
  }

  // Handle completing or cancelling an assignment
  const updateAssignmentStatus = async (
    assignmentId: string,
    status: 'active' | 'completed' | 'cancelled'
  ) => {
    try {
      // Update assignment status
      const updatedAssignments = assignments.map(a => {
        if (a.id === assignmentId) {
          return {
            ...a,
            status
          }
        }
        return a
      })

      setAssignments(updatedAssignments)
      message.success(`Assignment ${status}`)
    } catch (error) {
      console.error(`Error updating assignment to ${status}:`, error)
      message.error(`Failed to update assignment status`)
    }
  }

  // Table columns
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
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (timestamp: Timestamp) =>
        new Date(timestamp.toMillis()).toLocaleDateString()
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
      title: 'Feedback',
      key: 'feedback',
      render: (record: Assignment) =>
        record.feedback ? (
          <Rate disabled defaultValue={record.feedback.rating} />
        ) : (
          'No feedback'
        )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Assignment) => (
        <Space size='small'>
          <Button
            type='primary'
            size='small'
            onClick={() => showSessionModal(record)}
            disabled={record.status !== 'active'}
          >
            Record Session
          </Button>
          <Button
            size='small'
            onClick={() => showFeedbackModal(record)}
            disabled={record.status !== 'active'}
          >
            Feedback
          </Button>
          {record.status === 'active' && (
            <>
              <Button
                type='primary'
                size='small'
                style={{ backgroundColor: '#52c41a' }}
                onClick={() => updateAssignmentStatus(record.id, 'completed')}
              >
                Complete
              </Button>
              <Button
                danger
                size='small'
                onClick={() => updateAssignmentStatus(record.id, 'cancelled')}
              >
                Cancel
              </Button>
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <Title level={3} style={{ marginBottom: 0 }}>
              Consultant Assignment Management
            </Title>
            <Paragraph>
              Assign and manage consultants for participants
            </Paragraph>
          </div>
          <Button
            type='primary'
            icon={<PlusOutlined />}
            onClick={() =>
              window.scrollTo({
                top:
                  document.getElementById('create-assignment-form')
                    ?.offsetTop || 0,
                behavior: 'smooth'
              })
            }
          >
            Create New Assignment
          </Button>
        </div>
      </div>
      <Divider style={{ marginTop: 0 }} />

      <Tabs defaultActiveKey='1'>
        <TabPane tab='Current Assignments' key='1'>
          <Card>
            <Table
              columns={columns}
              dataSource={assignments}
              rowKey='id'
              loading={loading}
            />
          </Card>
        </TabPane>
        <TabPane tab='Create New Assignment' key='2'>
          <Card id='create-assignment-form'>
            <Form layout='vertical'>
              <Form.Item label='Select Participant'>
                <Select
                  placeholder='Select a participant'
                  value={selectedParticipant}
                  onChange={setSelectedParticipant}
                  style={{ width: '100%' }}
                >
                  {participants.map(participant => (
                    <Option key={participant.id} value={participant.id}>
                      <Space>
                        <UserOutlined />
                        {participant.name} - {participant.stage}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label='Select Consultant'>
                <Select
                  placeholder='Select a consultant'
                  value={selectedConsultant}
                  onChange={setSelectedConsultant}
                  style={{ width: '100%' }}
                >
                  {consultants.map(consultant => (
                    <Option key={consultant.id} value={consultant.id}>
                      <Space>
                        <TeamOutlined />
                        {consultant.name} - Rating: {consultant.rating}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item>
                <Button
                  type='primary'
                  onClick={handleCreateAssignment}
                  disabled={!selectedParticipant || !selectedConsultant}
                >
                  Create Assignment
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>
      </Tabs>

      {/* Session Recording Modal */}
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
            <Input type='datetime-local' />
          </Form.Item>
          <Form.Item name='notes' label='Session Notes'>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type='primary' htmlType='submit'>
              Record Session
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Feedback Modal */}
      <Modal
        title='Submit Feedback'
        open={feedbackModalVisible}
        onCancel={() => setFeedbackModalVisible(false)}
        footer={null}
      >
        <Form
          form={feedbackForm}
          layout='vertical'
          onFinish={handleSubmitFeedback}
        >
          <Form.Item
            name='rating'
            label='Rate the Session'
            rules={[{ required: true, message: 'Please rate the session' }]}
          >
            <Rate />
          </Form.Item>
          <Form.Item name='comments' label='Comments'>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type='primary' htmlType='submit'>
              Submit Feedback
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
