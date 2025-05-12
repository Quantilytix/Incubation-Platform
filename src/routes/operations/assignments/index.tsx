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
  Select,
  Row,
  Col
} from 'antd'
import {
  CalendarOutlined,
  CommentOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { useGetIdentity } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  getDoc,
  setDoc,
  doc,
  Timestamp,
  updateDoc,
  getDocs,
  addDoc
} from 'firebase/firestore'
import { db } from '@/firebase'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
type InterventionType = 'singular' | 'grouped'

interface Assignment {
  id: string
  participantId: string
  beneficiaryName: string
  interventionTitle: string
  type: InterventionType
  consultantId: string
  consultantName: string
  status: 'assigned' | 'in-progress' | 'completed' | 'cancelled'
  consultantStatus: 'pending' | 'accepted' | 'declined'
  userStatus: 'pending' | 'accepted' | 'declined'
  consultantCompletionStatus: 'pending' | 'done'
  userCompletionStatus: 'pending' | 'confirmed'
  createdAt: Timestamp
  updatedAt?: Timestamp
  dueDate?: Timestamp
  notes?: string
  feedback?: {
    rating: number
    comments: string
  }
  timeSpentHours?: number
  targetType?: 'percentage' | 'number'
  targetValue?: number
  targetMetric?: string
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
  beneficiaryName: string
  requiredInterventions: { id: string; title: string }[]
  completedInterventions: { id: string; title: string }[]
}
interface Intervention {
  id: string
  interventionTitle: string
  areaOfSupport: string
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
  const [newAssignmentId, setNewAssignmentId] = useState<string | null>(null)

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
            beneficiaryName: data.beneficiaryName || data.name,
            sector: data.sector,
            stage: data.stage,
            province: data.province,
            city: data.city,
            location: data.location,
            interventions: data.interventions || { required: [], completed: [] }
          }
        })

        const fetchedConsultants = consultantsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }))

        const fetchedInterventions = interventionsSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            interventionTitle: data.interventionTitle,
            areaOfSupport: data.areaOfSupport,
            programId: data.programId,
            type: data.interventionType
          }
        })

        // Map participantId to required intervention ids
        const map: Record<string, string[]> = {}
        fetchedParticipants.forEach(p => {
          map[p.id] = (p.interventions.required || []).map(i => i.id)
        })

        setParticipants(fetchedParticipants)
        setConsultants(fetchedConsultants)
        setInterventions(fetchedInterventions)
        setParticipantInterventionMap(map)
        setDataLoaded(true)
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
  const fetchAssignments = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'assignedInterventions'))
      const fetchedAssignments: Assignment[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assignment[]

      const currentParticipantMap = new Map(
        participants.map(p => [p.id, p.beneficiaryName])
      )
      const currentConsultantMap = new Map(consultants.map(c => [c.id, c.name]))

      const enrichedAssignments = fetchedAssignments.map(assignment => {
        const foundIntervention = interventions.find(
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
          area: foundIntervention?.areaOfSupport || 'Unknown Area',
          interventionTitle:
            foundIntervention?.interventionTitle || assignment.interventionTitle
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

  useEffect(() => {
    if (dataLoaded) {
      setLoading(true)
      fetchAssignments()
    }
  }, [dataLoaded, participants, consultants, interventions])

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
          const assignmentToComplete = assignments.find(
            a => a.id === assignmentId
          )
          if (!assignmentToComplete) {
            message.error('Assignment not found')
            return
          }

          // 1. Update the assignment status locally
          const updatedAssignments = assignments.map(a =>
            a.id === assignmentId ? { ...a, status: 'completed' } : a
          )
          setAssignments(updatedAssignments)

          // 2. Update Firestore for this assignment
          await setDoc(doc(db, 'assignedInterventions', assignmentId), {
            ...assignmentToComplete,
            status: 'completed'
          })

          // 3. Update Participant's completedInterventions array
          const participantRef = doc(
            db,
            'participants',
            assignmentToComplete.participantId
          )
          const participantSnap = await getDoc(participantRef)

          if (participantSnap.exists()) {
            const participantData = participantSnap.data()
            const currentCompleted: any[] =
              participantData.interventions?.completed || []

            // Add the interventionId if not already added
            const interventionIdToAdd = assignmentToComplete.interventionId
            const interventionTitleToAdd =
              assignmentToComplete.interventionTitle

            if (
              !currentCompleted.some(comp => comp.id === interventionIdToAdd)
            ) {
              const updatedCompleted = [
                ...currentCompleted,
                { id: interventionIdToAdd, title: interventionTitleToAdd }
              ]
              await updateDoc(participantRef, {
                'interventions.completed': updatedCompleted
              })
            }
          }

          // 4. Notify relevant roles that the intervention is completed
          await addDoc(collection(db, 'notifications'), {
            interventionId: assignmentToComplete.id,
            participantId: assignmentToComplete.participantId,
            consultantId: assignmentToComplete.consultantId,
            interventionTitle: assignmentToComplete.interventionTitle,
            type: 'intervention-completed',
            recipientRoles: [
              'projectadmin',
              'consultant',
              'incubatee',
              'operations'
            ],
            message: {
              consultant: `You have completed the intervention: ${assignmentToComplete.interventionTitle}.`,
              projectadmin: `Consultant ${assignmentToComplete.consultantName} completed the intervention for ${assignmentToComplete.beneficiaryName}.`,
              operations: `Consultant ${assignmentToComplete.consultantName} completed the intervention for ${assignmentToComplete.beneficiaryName}.`,
              incubatee: `Consultant ${assignmentToComplete.consultantName} has completed the intervention: ${assignmentToComplete.interventionTitle}. Please confirm if completed as expected.`
            },
            createdAt: new Date(),
            readBy: {}
          })

          message.success(
            'Assignment marked as completed and participant progress updated! 🎯'
          )
        } catch (error) {
          console.error('Error completing assignment:', error)
          message.error('Failed to complete assignment')
        }
      }
    })
  }

  const getCompositeStatus = (assignment: Assignment) => {
    const {
      status,
      consultantStatus,
      userStatus,
      consultantCompletionStatus,
      userCompletionStatus
    } = assignment

    if (status === 'cancelled') return { label: 'Cancelled', color: 'red' }

    if (
      status === 'completed' ||
      (consultantCompletionStatus === 'done' &&
        userCompletionStatus === 'confirmed')
    ) {
      return { label: 'Completed', color: 'green' }
    }

    if (consultantStatus === 'declined' || userStatus === 'declined') {
      return { label: 'Declined', color: 'red' }
    }

    if (userCompletionStatus === 'rejected') {
      return { label: 'Rejected', color: 'volcano' }
    }

    if (
      consultantCompletionStatus === 'done' &&
      userCompletionStatus === 'pending'
    ) {
      return { label: 'Awaiting Confirmation', color: 'purple' }
    }

    if (
      consultantStatus === 'accepted' &&
      userStatus === 'accepted' &&
      consultantCompletionStatus !== 'done'
    ) {
      return { label: 'In Progress', color: 'blue' }
    }

    if (consultantStatus === 'pending' || userStatus === 'pending') {
      return { label: 'Awaiting Acceptance', color: 'orange' }
    }

    return { label: 'Assigned', color: 'gold' }
  }

  const columns = [
    {
      title: 'Beneficiary',
      dataIndex: 'beneficiaryName',
      key: 'beneficiaryName'
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
      key: 'compositeStatus',
      render: (record: Assignment) => {
        const { label, color } = getCompositeStatus(record)
        const tooltip = `
            Overall: ${record.status}
            • Consultant: ${record.consultantStatus}
            • User: ${record.userStatus}
            • Consultant Done: ${record.consultantCompletionStatus}
            • User Confirmed: ${record.userCompletionStatus}
          `.trim()

        return (
          <Tooltip title={<pre style={{ margin: 0 }}>{tooltip}</pre>}>
            <Tag color={color}>{label}</Tag>
          </Tooltip>
        )
      }
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
          expandedRowRender: record => {
            const {
              beneficiaryName,
              consultantName,
              type,
              targetType,
              targetValue,
              targetMetric,
              status,
              consultantStatus,
              userStatus,
              consultantCompletionStatus,
              userCompletionStatus,
              dueDate,
              notes
            } = record

            const formatStatus = (label: string, value: string) => (
              <Paragraph>
                <Text strong>{label}:</Text> <Tag>{value}</Tag>
              </Paragraph>
            )

            const pendingFrom: string[] = []
            const pendingDetails: string[] = []
            if (record.consultantStatus === 'pending') {
              pendingFrom.push('Consultant')
              pendingDetails.push(
                'Consultant has not accepted the intervention.'
              )
            }
            if (record.userStatus === 'pending') {
              pendingFrom.push('Participant')
              pendingDetails.push(
                'Participant has not accepted the intervention.'
              )
            }
            if (record.consultantCompletionStatus === 'pending') {
              if (!pendingFrom.includes('Consultant'))
                pendingFrom.push('Consultant')
              pendingDetails.push(
                'Consultant has not marked the intervention as complete.'
              )
            }
            if (record.userCompletionStatus === 'pending') {
              if (!pendingFrom.includes('Participant'))
                pendingFrom.push('Participant')
              pendingDetails.push('Participant has not confirmed completion.')
            }
            return (
              <div style={{ padding: '20px' }}>
                <Title level={5}>Assignment Details</Title>

                <Paragraph>
                  <Text strong>Type:</Text> {type}
                  <br />
                  <Text strong>Target:</Text> {targetValue} {targetType} (
                  {targetMetric})
                </Paragraph>
                <Paragraph>
                  <Text strong>Assigned: </Text>
                  {record.createdAt?.toMillis
                    ? new Date(record.createdAt.toMillis()).toLocaleDateString()
                    : 'No assignment date available'}
                </Paragraph>

                {dueDate && (
                  <Paragraph>
                    <Text strong>Due Date:</Text>{' '}
                    {typeof dueDate === 'string'
                      ? new Date(dueDate).toLocaleDateString()
                      : dueDate.toDate?.()?.toLocaleDateString() ?? 'N/A'}
                  </Paragraph>
                )}
                <>
                  <Paragraph>
                    <Text strong>Status Summary:</Text>
                    <br />
                    <Tag color='blue'>Overall: {record.status}</Tag>
                    <Tag color='purple'>
                      Consultant: {record.consultantStatus}
                    </Tag>
                    <Tag color='gold'>User: {record.userStatus}</Tag>
                    <Tag color='cyan'>
                      Consultant Completion: {record.consultantCompletionStatus}
                    </Tag>
                    <Tag color='lime'>
                      User Confirmation: {record.userCompletionStatus}
                    </Tag>
                  </Paragraph>

                  {record.feedback && (
                    <Paragraph>
                      <Text strong>Feedback:</Text>
                      <br />
                      <Text italic>"{record.feedback.comments}"</Text>
                      <br />
                      <Tag color='green'>
                        Rating: {record.feedback.rating} / 5
                      </Tag>
                    </Paragraph>
                  )}

                  {record.notes && (
                    <Paragraph>
                      <Text strong>Notes:</Text> {record.notes}
                    </Paragraph>
                  )}
                </>

                {pendingDetails.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Paragraph>
                      <Text strong>Awaiting Action From:</Text>
                      <br />
                      {pendingFrom.join(', ')}
                    </Paragraph>
                    <Paragraph>
                      <Text strong>Actions:</Text>
                      <ul style={{ paddingLeft: 20 }}>
                        {pendingDetails.map((action, idx) => (
                          <li key={idx}>{action}</li>
                        ))}
                      </ul>
                    </Paragraph>
                  </div>
                )}
              </div>
            )
          }
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
              const selectedIntervention = interventions.find(
                i => i.id === values.intervention
              )

              if (
                !selectedParticipant ||
                !selectedConsultant ||
                !selectedIntervention
              ) {
                console.warn('DEBUG:', {
                  participant: values.participant,
                  consultant: values.consultant,
                  intervention: values.intervention,
                  selectedParticipant,
                  selectedConsultant,
                  selectedIntervention
                })
                message.error('Invalid data selected. Please retry.')
                return
              }

              const newId = `ai${Date.now()}`

              const newAssignment = {
                id: newId,
                participantId: selectedParticipant.id,
                beneficiaryName: selectedParticipant.beneficiaryName,
                consultantId: selectedConsultant.id,
                consultantName: selectedConsultant.name,
                interventionId: selectedIntervention.id,
                interventionTitle: selectedIntervention.interventionTitle,
                type: values.type,
                targetType: values.targetType,
                targetValue: values.targetValue,
                targetMetric: values.targetMetric,
                dueDate: values.dueDate
                  ? Timestamp.fromDate(values.dueDate.toDate())
                  : null, // ✅ ADD THIS
                status: 'assigned',
                consultantStatus: 'pending',
                userStatus: 'pending',
                consultantCompletionStatus: 'pending',
                userCompletionStatus: 'pending',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
              }

              await setDoc(
                doc(db, 'assignedInterventions', newId),
                newAssignment
              )

              setNewAssignmentId(newId)

              fetchAssignments()

              message.success('New intervention assigned successfully')
              setAssignmentModalVisible(false)
              assignmentForm.resetFields()
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
            if (changedValues.targetType) {
              if (changedValues.targetType === 'percentage') {
                assignmentForm.setFieldsValue({ targetMetric: 'Completion' })
              } else {
                assignmentForm.setFieldsValue({ targetMetric: undefined })
              }
            }
          }}
        >
          {/* Participant */}
          <Form.Item
            name='participant'
            label='Select Beneficiary'
            rules={[{ required: true, message: 'Please select a participant' }]}
          >
            <Select placeholder='Choose a beneficiary'>
              {participants.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  {p.beneficiaryName}
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
                        {intervention.interventionTitle} (
                        {intervention.areaOfSupport})
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
            shouldUpdate={(prev, curr) => prev.targetType !== curr.targetType}
            noStyle
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('targetType')

              if (type === 'percentage') {
                return (
                  <>
                    <Form.Item
                      name='targetMetric'
                      label='Percentage Goal Label'
                    >
                      <Input disabled value='Completion' />
                    </Form.Item>
                    <Form.Item
                      name='targetValue'
                      label='Target Completion (%)'
                      rules={[{ required: true, message: 'Enter % target' }]}
                    >
                      <Input type='number' max={100} min={1} suffix='%' />
                    </Form.Item>
                  </>
                )
              }

              if (type === 'number') {
                return (
                  <>
                    <Form.Item
                      name='targetMetric'
                      label='Unit of Measure'
                      rules={[{ required: true, message: 'Choose a metric' }]}
                    >
                      <Select mode='tags' placeholder='e.g. Hours, Sessions'>
                        <Select.Option value='hours'>Hours</Select.Option>
                        <Select.Option value='sessions'>Sessions</Select.Option>
                      </Select>
                    </Form.Item>
                    <Form.Item
                      name='targetValue'
                      label='Target Value'
                      rules={[
                        { required: true, message: 'Enter numeric goal' }
                      ]}
                    >
                      <Input type='number' placeholder='e.g. 5 or 10' />
                    </Form.Item>
                  </>
                )
              }

              return null
            }}
          </Form.Item>
          <Form.Item
            name='dueDate'
            label='Due Date'
            rules={[{ required: true, message: 'Please select a due date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              Create Assignment
            </Button>
          </Form.Item>
        </Form>
      </Modal>
      <style>
        {`
      .highlghted {
        background-color: #e6fffb !important;
        animation: fadeOut 8s forwards;
      }
      @keyframes fadeOut {
        0% {background-color: #e6fffb; }
        100% {background-color: white; }
      }
      `}
      </style>
    </div>
  )
}
