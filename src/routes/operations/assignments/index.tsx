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
import { Helmet } from 'react-helmet'
import { useGetIdentity } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, setDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
type InterventionType = 'singular' | 'grouped'

interface Assignment {
  id: string
  participantId: string
  participantName: string
  interventionTitle: string
  type: InterventionType
  consultantId: string
  consultantName: string
  status: 'active' | 'completed' | 'cancelled'
  createdAt: Timestamp
  dueDate?: Timestamp
  notes?: string
  feedback?: {
    rating: number
    comments: string
  }
  timeSpentHours?: number
  targetType?: 'percentage' | 'number' // 🔥 NEW
  targetValue?: number // 🔥 NEW
}

interface UserIdentity {
  id: string
  name?: string
  email?: string
  role?: string
  avatar?: string
  [key: string]: any
}
interface Participant {
  id: string
  name: string
  requiredInterventions: { id: string; title: string }[] // <-- Important
}
interface Intervention {
  id: string
  title: string
  area: string
}

export const ConsultantAssignments: React.FC = () => {
  const { data: user } = useGetIdentity<UserIdentity>()
  const navigate = useNavigate()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [consultants, setConsultants] = useState<
    { id: string; name: string }[]
  >([])
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [interventionList, setInterventionList] = useState<any[]>([])
  const [filteredInterventions, setFilteredInterventions] = useState<
    { id: string; name: string }[]
  >([])
  const [participantInterventionMap, setParticipantInterventionMap] = useState<
    Record<string, string[]>
  >({})

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionModalVisible, setSessionModalVisible] = useState(false)
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null)
  const [selectedType, setSelectedType] = useState<'singular' | 'grouped'>(
    'singular'
  )

  const [sessionForm] = Form.useForm()
  const [notesModalVisible, setNotesModalVisible] = useState(false)
  const [notesForm] = Form.useForm()
  const [assignmentModalVisible, setAssignmentModalVisible] = useState(false)
  const [assignmentForm] = Form.useForm()
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    const fetchParticipantsConsultantsAndInterventions = async () => {
      try {
        const [
          participantsSnapshot,
          consultantsSnapshot,
          interventionsSnapshot
        ] = await Promise.all([
          getDocs(collection(db, 'participants')),
          getDocs(collection(db, 'consultants')),
          getDocs(collection(db, 'interventions'))
        ])

        const fetchedParticipants = participantsSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.name,
            requiredInterventions: data.interventions?.required || []
          }
        })

        const fetchedConsultants = consultantsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }))

        const fetchedInterventions = interventionsSnapshot.docs.flatMap(doc =>
          doc.data().interventions.map(intervention => ({
            id: intervention.id,
            title: intervention.title,
            area: doc.data().area
          }))
        )

        const map: Record<string, string[]> = {}
        fetchedParticipants.forEach(p => {
          map[p.id] = p.requiredInterventions.map(i => i.id)
        })

        setParticipants(fetchedParticipants)
        setConsultants(fetchedConsultants)
        setInterventions(fetchedInterventions)
        setParticipantInterventionMap(map)
        setDataLoaded(true) // 🛑 IMPORTANT! Flag when data is loaded
      } catch (error) {
        console.error(
          '❌ Error fetching participants, consultants or interventions:',
          error
        )
        message.error(
          'Failed to load participants, consultants, or interventions'
        )
      }
    }

    if (user) {
      fetchParticipantsConsultantsAndInterventions()
    }
  }, [user])

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'assignedInterventions'))
        const fetchedAssignments: Assignment[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Assignment[]

        const currentParticipantMap = new Map(
          participants.map(p => [p.id, p.name])
        )
        const currentConsultantMap = new Map(
          consultants.map(c => [c.id, c.name])
        )

        const enrichedAssignments = fetchedAssignments.map(assignment => {
          const foundArea = interventions.find(
            i => i.title === assignment.interventionTitle
          )

          return {
            ...assignment,
            participantName:
              currentParticipantMap.get(assignment.participantId) ||
              'Unknown Participant',
            consultantName:
              currentConsultantMap.get(assignment.consultantId) ||
              'Unknown Consultant',
            area: foundArea?.area || 'Unknown Area'
          }
        })

        setAssignments(enrichedAssignments)
      } catch (error) {
        console.error('Error fetching assignments:', error)
        message.error('Failed to load assignments')
      } finally {
        setLoading(false)
      }
    }

    if (dataLoaded) {
      setLoading(true)
      fetchAssignments()
    }
  }, [dataLoaded, participants, consultants, interventions])

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
            dueDate: Timestamp.now(),
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
      dataIndex: 'interventionTitle',
      key: 'interventionTitle'
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
      title: 'Due Date',
      key: 'dueDate',
      render: (record: Assignment) => {
        if (!record.dueDate) return 'No due date'

        const date =
          typeof record.dueDate === 'string'
            ? new Date(record.dueDate)
            : record.dueDate.toDate?.() ?? new Date()

        return date.toLocaleDateString()
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Assignment) => (
        <div>
          <Space wrap>
            <Button
              size='small'
              icon={<CommentOutlined />}
              onClick={() => showNotesModal(record)}
              disabled={record.status !== 'in-progress'}
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
      <Helmet>
        <title>Consultant Assignments | Incubation Platform</title>
      </Helmet>

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
                <Text strong>Assigned: </Text>
                {record.createdAt?.toMillis
                  ? new Date(record.createdAt.toMillis()).toLocaleDateString()
                  : 'No assignment date available'}
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
          onFinish={async values => {
            try {
              const selectedParticipant = participants.find(
                p => p.id === values.participant
              )

              const selectedConsultant = consultants.find(
                c => c.id === values.consultant
              )

              const requiredInterventions =
                selectedParticipant?.requiredInterventions || []
              const selectedIntervention = requiredInterventions.find(
                (i: any) => i.id === values.intervention
              )

              if (
                !selectedParticipant ||
                !selectedConsultant ||
                !selectedIntervention
              ) {
                message.error('Invalid data selected. Please retry.')
                return
              }

              const newId = `ai${Date.now()}`

              const newAssignment = {
                id: newId,
                participantId: selectedParticipant.id,
                participantName: selectedParticipant.name,
                consultantId: selectedConsultant.id,
                consultantName: selectedConsultant.name,
                interventionId: selectedIntervention.id,
                interventionTitle: selectedIntervention.title,
                type: values.type,
                targetType: values.targetType,
                targetValue: values.targetValue,
                status: 'active',
                createdAt: Timestamp.now()
              }

              await setDoc(
                doc(db, 'assignedInterventions', newId),
                newAssignment
              )

              message.success('New intervention assigned successfully')
              setAssignmentModalVisible(false)
              assignmentForm.resetFields()
              // 🔥 Optional: Reload assigned interventions table here
            } catch (error) {
              console.error('❌ Error assigning intervention:', error)
              message.error('Failed to create assignment')
            }
          }}
          onValuesChange={changedValues => {
            if (changedValues.participant) {
              assignmentForm.setFieldsValue({
                intervention: undefined
              })

              const selectedParticipant = participants.find(
                p => p.id === changedValues.participant
              )

              console.log('🛠 Selected Participant:', selectedParticipant)
              console.log(
                '📋 Required Interventions:',
                selectedParticipant?.requiredInterventions
              )
            }
          }}
        >
          {/* Participant */}
          <Form.Item
            name='participant'
            label='Select Participant'
            rules={[{ required: true, message: 'Please select a participant' }]}
          >
            <Select placeholder='Choose a participant'>
              {participants.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  {p.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* Intervention */}
          <Form.Item
            shouldUpdate={(prev, curr) => prev.participant !== curr.participant}
            noStyle
          >
            {({ getFieldValue }) => {
              const participantId = getFieldValue('participant')
              const requiredInterventions =
                participantInterventionMap[participantId] || []
              const filtered = interventions.filter(i =>
                requiredInterventions.includes(i.id)
              )
              return (
                <Form.Item
                  name='intervention'
                  label='Select Intervention'
                  rules={[
                    { required: true, message: 'Please select an intervention' }
                  ]}
                >
                  <Select
                    placeholder='Choose an intervention'
                    disabled={!participantId}
                  >
                    {filtered.map(intervention => (
                      <Select.Option
                        key={intervention.id}
                        value={intervention.id}
                      >
                        {intervention.title} ({intervention.area})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }}
          </Form.Item>

          {/* Consultant */}
          <Form.Item
            name='consultant'
            label='Select Consultant'
            rules={[{ required: true, message: 'Please select a consultant' }]}
          >
            <Select placeholder='Choose a consultant'>
              {consultants.map(c => (
                <Select.Option key={c.id} value={c.id}>
                  {c.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* Type */}
          <Form.Item
            name='type'
            label='Assignment Type'
            rules={[
              { required: true, message: 'Please select assignment type' }
            ]}
          >
            <Select placeholder='Select type'>
              <Select.Option value='singular'>Singular (1 SME)</Select.Option>
              <Select.Option value='grouped'>
                Grouped (Multiple SMEs)
              </Select.Option>
            </Select>
          </Form.Item>

          {/* Target */}
          <Form.Item
            name='targetType'
            label='Target Type'
            rules={[{ required: true, message: 'Please select target type' }]}
          >
            <Select placeholder='Select target type'>
              <Select.Option value='percentage'>Percentage (%)</Select.Option>
              <Select.Option value='number'>
                Number (Hours, Sessions, etc.)
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name='targetValue'
            label='Target Value'
            rules={[{ required: true, message: 'Please input a target value' }]}
          >
            <Input type='number' placeholder='e.g. 10 hours or 100%' />
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
