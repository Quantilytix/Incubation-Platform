import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  Input,
  Rate,
  Divider,
  Typography,
  notification,
  Tooltip,
  Row,
  Col,
  Alert
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined
} from '@ant-design/icons'
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  query,
  where
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/firebase'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

// Define types
interface RequiredIntervention {
  id: string
  title: string
  area: string
}
interface Resource {
  type: 'document' | 'link'
  label: string
  link: string
}

interface Feedback {
  rating: number
  comments: string
}

interface Consultant {
  name: string
  email: string
  expertise: string[]
  rating: number
}

interface AssignedIntervention {
  id: string
  interventionId: string
  participantId: string
  consultantId: string
  beneficiaryName: string
  interventionTitle: string
  description?: string
  areaOfSupport: string
  dueDate: any
  createdAt: string
  updatedAt: string
  type: 'singular' | 'recurring'
  targetType: 'percentage' | 'metric' | 'custom'
  targetMetric: string
  targetValue: number
  timeSpent: number

  status: string // general system status (optional if you're phasing it out)
  consultantStatus: 'pending' | 'accepted' | 'declined'
  userStatus: 'pending' | 'accepted' | 'declined'
  consultantCompletionStatus: 'none' | 'done'
  userCompletionStatus: 'none' | 'confirmed' | 'rejected'

  consultant?: Consultant
  feedback?: Feedback
  resources?: Resource[]
}

interface InterventionRequest {
  id: string
  participantId: string
  areaOfSupport: string
  interventionTitle: string
  reason: string
  status: string
}

const InterventionsTrackingView: React.FC = () => {
  const [requiredInterventions, setRequiredInterventions] = useState<
    RequiredIntervention[]
  >([])
  const [assignedInterventions, setAssignedInterventions] = useState<
    AssignedIntervention[]
  >([])
  const [requests, setRequests] = useState<InterventionRequest[]>([])
  const [filters, setFilters] = useState({ status: 'all' })
  const [isRequestModalVisible, setIsRequestModalVisible] = useState(false)
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false)
  const [selectedIntervention, setSelectedIntervention] =
    useState<AssignedIntervention | null>(null)
  const [requestForm] = Form.useForm()
  const [confirmForm] = Form.useForm()
  const [participantId, setParticipantId] = useState<string | null>(null)
  const auth = getAuth()
  // Decline Modal
  const [isDeclineModalVisible, setIsDeclineModalVisible] = useState(false)
  const [isDeclineCompletionModalVisible, setIsDeclineCompletionModalVisible] =
    useState(false)
  const [rejectCompletionForm] = Form.useForm()
  const [declineForm] = Form.useForm()
  const [declineTargetId, setDeclineTargetId] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (user) {
        console.log('User logged in:', user.email)
        const participantSnapshot = await getDocs(
          query(
            collection(db, 'participants'),
            where('email', '==', user.email)
          )
        )
        if (!participantSnapshot.empty) {
          const participantDoc = participantSnapshot.docs[0]
          const participantData = participantDoc.data()
          setParticipantId(participantDoc.id) // Use Firestore document ID
          setRequiredInterventions(participantData.interventions.required || [])
        } else {
          console.error('No participant found for the logged-in user.')
        }
      } else {
        console.log('No user is logged in.')
      }
    })
    return () => unsubscribe()
  }, [])

  // Fetch assigned interventions
  useEffect(() => {
    const fetchAssignedInterventions = async () => {
      if (!participantId) return
      try {
        const q = query(
          collection(db, 'assignedInterventions'),
          where('participantId', '==', participantId)
        )
        const snapshot = await getDocs(q)

        const data = await Promise.all(
          snapshot.docs.map(async docSnap => {
            const data = docSnap.data()
            const consultantSnap = await getDocs(
              query(
                collection(db, 'consultants'),
                where('id', '==', data.consultantId)
              )
            )
            const consultant = !consultantSnap.empty
              ? consultantSnap.docs[0].data()
              : null

            return {
              id: docSnap.id,
              ...data,
              consultant
            }
          })
        )

        setAssignedInterventions(data as AssignedIntervention[])
      } catch (error) {
        console.error('Error fetching assigned interventions:', error)
      }
    }

    const fetchRequests = async () => {
      if (!participantId) {
        return <Text>Loading participant data...</Text>
      }

      try {
        const q = query(
          collection(db, 'interventionRequests'),
          where('participantId', '==', participantId) // Use the dynamic participant ID
        )
        const snapshot = await getDocs(q)
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as InterventionRequest[]
        setRequests(data)
      } catch (error) {
        console.error('Error fetching intervention requests:', error)
        notification.error({
          message: 'Error',
          description: 'Failed to fetch intervention requests.'
        })
      }
    }

    fetchAssignedInterventions()
    fetchRequests()
  }, [participantId])

  const deriveDisplayStatus = (intervention: AssignedIntervention): string => {
    const {
      consultantStatus,
      userStatus,
      consultantCompletionStatus,
      userCompletionStatus
    } = intervention

    // If consultant has not accepted yet
    if (consultantStatus === 'pending') return 'Awaiting Consultant'

    // Consultant accepted, incubatee has not
    if (consultantStatus === 'accepted' && userStatus === 'pending')
      return 'Awaiting Your Acceptance'

    // Either party declined
    if (consultantStatus === 'declined' || userStatus === 'declined')
      return 'Declined'

    // Work is underway (both accepted)
    if (consultantStatus === 'accepted' && userStatus === 'accepted') {
      // Consultant done, incubatee yet to confirm
      if (consultantCompletionStatus === 'done') {
        if (userCompletionStatus === 'none') return 'Awaiting Confirmation'
        if (userCompletionStatus === 'confirmed') return 'Completed'
        if (userCompletionStatus === 'rejected') return 'Rejected'
      }
      // Still in progress
      return 'In Progress'
    }

    return 'Pending'
  }

  // Handle accept intervention
  const handleAccept = async (id: string) => {
    try {
      await updateDoc(doc(db, 'assignedInterventions', id), {
        userStatus: 'accepted'
      })

      await addDoc(collection(db, 'notifications'), {
        participantId: selectedIntervention?.participantId,
        consultantId: selectedIntervention?.consultantId,
        interventionId: selectedIntervention?.id,
        interventionTitle: selectedIntervention?.interventionTitle,
        type: 'intervention-accepted',
        recipientRoles: ['projectadmin', 'consultant'],
        message: {
          consultant: `Beneficiary ${selectedIntervention?.beneficiaryName} accepted the intervention: ${selectedIntervention?.interventionTitle}.`,
          projectadmin: `Beneficiary ${selectedIntervention?.beneficiaryName} accepted the intervention.`,
          incubatee: `You accepted the intervention: ${selectedIntervention?.interventionTitle}.`
        },
        createdAt: new Date(),
        readBy: {}
      })

      setAssignedInterventions(prev =>
        prev.map(item =>
          item.id === id ? { ...item, status: 'accepted' } : item
        )
      )
      notification.success({
        message: 'Success',
        description: 'Intervention accepted.'
      })
    } catch (error) {
      console.error('Error accepting intervention:', error)
      notification.error({
        message: 'Error',
        description: 'Failed to accept intervention.'
      })
    }
  }

  // Handle decline intervention
  const showDeclineModal = (id: string) => {
    setDeclineTargetId(id)
    setIsDeclineModalVisible(true)
  }

  const handleDeclineSubmit = async (values: any) => {
    if (!declineTargetId) return
    try {
      await updateDoc(doc(db, 'assignedInterventions', declineTargetId), {
        userStatus: 'declined',
        declineReason: values.reason
      })
      await addDoc(collection(db, 'notifications'), {
        interventionId: declineTargetId,
        participantId: selectedIntervention?.participantId,
        consultantId: selectedIntervention?.consultantId,
        interventionTitle: selectedIntervention?.interventionTitle,
        type: 'intervention-declined',
        recipientRoles: ['projectadmin', 'consultant'],
        message: {
          consultant: `Beneficiary ${selectedIntervention?.beneficiaryName} declined the intervention: ${data.interventionTitle}.`,
          projectadmin: `Beneficiary ${selectedIntervention?.beneficiaryName} declined the intervention.`,
          incubatee: `You declined the intervention: ${selectedIntervention?.interventionTitle}.`
        },
        reason: values.reason,
        createdAt: new Date(),
        readBy: {}
      })

      setAssignedInterventions(prev =>
        prev.map(item =>
          item.id === declineTargetId ? { ...item, status: 'declined' } : item
        )
      )
      notification.success({ message: 'Declined successfully' })
      setIsDeclineModalVisible(false)
      declineForm.resetFields()
    } catch (err) {
      console.error(err)
      notification.error({ message: 'Failed to decline intervention' })
    }
  }

  // Handle confirm completion
  const handleConfirmCompletion = async (values: any) => {
    if (!selectedIntervention) return

    try {
      await updateDoc(
        doc(db, 'assignedInterventions', selectedIntervention.id),
        {
          userCompletionStatus: 'confirmed',
          feedback: {
            rating: values.rating,
            comments: values.feedback
          }
        }
      )
      try {
        await addDoc(collection(db, 'notifications'), {
          participantId: selectedIntervention.participantId,
          consultantId: selectedIntervention.consultantId,
          interventionId: selectedIntervention.id,
          interventionTitle: selectedIntervention.interventionTitle,
          type: 'intervention-confirmed',
          recipientRoles: ['consultant', 'projectadmin'],
          message: {
            consultant: `Beneficiary ${selectedIntervention.beneficiaryName} confirmed the intervention.`,
            projectadmin: `Intervention "${selectedIntervention.interventionTitle}" has been confirmed.`,
            incubatee: `You confirmed the completion of: ${selectedIntervention.interventionTitle}.`
          },
          createdAt: new Date(),
          readBy: {}
        })
      } catch (error) {}

      setAssignedInterventions(prev =>
        prev.map(item =>
          item.id === selectedIntervention.id
            ? {
                ...item,
                userCompletionStatus: 'confirmed',
                feedback: {
                  rating: values.rating,
                  comments: values.feedback
                }
              }
            : item
        )
      )

      setIsConfirmModalVisible(false)
      notification.success({
        message: 'Success',
        description: 'Intervention marked as completed.'
      })
    } catch (error) {
      console.error('Error confirming completion:', error)
      notification.error({
        message: 'Error',
        description: 'Failed to confirm completion.'
      })
    }
  }
  const handleRejectCompletion = async (
    intervention: AssignedIntervention,
    reason: string
  ) => {
    try {
      await updateDoc(doc(db, 'assignedInterventions', intervention.id), {
        userCompletionStatus: 'rejected'
      })

      await addDoc(collection(db, 'notifications'), {
        interventionId: intervention.id,
        participantId: intervention.participantId,
        consultantId: intervention.consultantId,
        interventionTitle: intervention.interventionTitle,
        type: 'completion-rejected',
        recipientRoles: ['projectadmin', 'consultant'],
        message: {
          consultant: `Beneficiary ${intervention.beneficiaryName} rejected the completion of: ${intervention.interventionTitle}.`,
          projectadmin: `Completion was rejected for intervention: ${intervention.interventionTitle}.`,
          incubatee: `You rejected the completion of: ${intervention.interventionTitle}.`
        },
        reason,
        createdAt: new Date(),
        readBy: {}
      })

      notification.success({ message: 'Completion rejected successfully.' })
    } catch (err) {
      console.error(err)
      notification.error({ message: 'Failed to reject completion.' })
    }
  }

  // Handle request intervention
  const handleRequestIntervention = async (values: any) => {
    try {
      const docRef = await addDoc(collection(db, 'interventionRequests'), {
        participantId: participantId || '', // Use the actual participant ID
        areaOfSupport: values.areaOfSupport,
        interventionTitle: values.interventionTitle,
        reason: values.reason,
        status: 'pending',
        createdAt: new Date()
      })
      setRequests(prev => [...prev, { id: docRef.id, ...values }])
      setIsRequestModalVisible(false)
      notification.success({
        message: 'Success',
        description: 'Intervention request submitted.'
      })
    } catch (error) {
      console.error('Error submitting intervention request:', error)
      notification.error({
        message: 'Error',
        description: 'Failed to submit intervention request.'
      })
    }
  }

  const filteredInterventions = assignedInterventions.filter(item => {
    if (filters.status === 'all') return true
    return (
      deriveDisplayStatus(item).toLowerCase() === filters.status.toLowerCase()
    )
  })

  // Filter interventions based on status
  const getFilteredInterventions = () => {
    // Pending Assignment: Required interventions not yet assigned
    const pendingAssignment = requiredInterventions.filter(
      req =>
        !assignedInterventions.some(
          assigned => assigned.interventionTitle === req.title
        )
    )

    // Assigned: All assigned interventions
    const assigned = assignedInterventions.filter(
      item => item.status !== 'completed'
    )

    // Completed: Assigned interventions with status `completed`
    const completed = assignedInterventions.filter(
      item => item.status === 'completed'
    )

    // Ongoing: Assigned interventions with status `in-progress`
    const ongoing = assignedInterventions.filter(
      item => item.status === 'in-progress'
    )

    // Requested: Intervention requests with status `pending`
    const requested = requests.filter(req => req.status === 'pending')

    // Return filtered results based on selected status
    switch (filters.status) {
      case 'pendingAssignment':
        return pendingAssignment.map(item => ({
          ...item,
          status: 'pendingAssignment'
        }))
      case 'assigned':
        return assigned
      case 'requested':
        return requested
      case 'completed':
        return completed
      case 'ongoing':
        return ongoing
      default:
        return [
          ...pendingAssignment.map(item => ({
            ...item,
            status: 'pendingAssignment'
          })),
          ...assigned,
          ...requested,
          ...completed,
          ...ongoing
        ]
    }
  }

  // Intervention columns
  const interventionColumns = [
    {
      title: 'Intervention',
      dataIndex: 'interventionTitle',
      key: 'interventionTitle',
      render: (text: string, record: any) => (
        <Space direction='vertical' size={0}>
          <Text strong>{text}</Text>
          <Text type='secondary'>{record.area || record.areaOfSupport}</Text>
        </Space>
      )
    },
    {
      title: 'Consultant',
      dataIndex: 'consultant',
      key: 'consultant',
      render: (consultant: any) =>
        consultant ? (
          <Space direction='vertical' size={0}>
            <Text strong>{consultant.name}</Text>
          </Space>
        ) : (
          <Text type='secondary'>Unassigned</Text>
        )
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (dueDate: any) => {
        if (!dueDate) return '-'

        // Handle Firestore Timestamp
        if (dueDate.seconds) {
          return dayjs(dueDate.seconds * 1000).format('YYYY-MM-DD')
        }

        // Handle ISO date strings or other date-valid strings
        if (dayjs(dueDate).isValid()) {
          return dayjs(dueDate).format('YYYY-MM-DD')
        }

        return '-'
      }
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: AssignedIntervention) => {
        const status = deriveDisplayStatus(record)
        let color = 'default'
        let icon = null

        switch (status) {
          case 'Pending':
            color = 'default'
            icon = <ClockCircleOutlined />
            break
          case 'Awaiting Consultant':
            color = 'orange'
            icon = <ExclamationCircleOutlined />
            break
          case 'Awaiting Your Acceptance':
            color = 'gold'
            icon = <ExclamationCircleOutlined />
            break
          case 'In Progress':
            color = 'blue'
            icon = <ClockCircleOutlined />
            break
          case 'Awaiting Confirmation':
            color = 'purple'
            icon = <ClockCircleOutlined />
            break
          case 'Completed':
            color = 'green'
            icon = <CheckCircleOutlined />
            break
          case 'Declined':
          case 'Rejected':
            color = 'red'
            icon = <CloseCircleOutlined />
            break
          default:
            color = 'default'
            icon = null
            break
        }

        return (
          <Tag color={color} icon={icon}>
            {status}
          </Tag>
        )
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        return (
          <Space>
            {record.consultantStatus === 'accepted' &&
              record.userStatus === 'pending' && (
                <>
                  <Button
                    size='small'
                    type='link'
                    icon={<CheckCircleOutlined />}
                    onClick={() => {
                      setSelectedIntervention(record)
                      handleAccept(record.id)
                    }}
                  >
                    Accept
                  </Button>
                  <Button
                    size='small'
                    danger
                    type='link'
                    icon={<CloseCircleOutlined />}
                    onClick={() => showDeclineModal(record.id)}
                  >
                    Decline
                  </Button>
                </>
              )}

            {record.consultantCompletionStatus === 'done' &&
              record.userCompletionStatus === 'none' && (
                <>
                  <Tooltip title='Reject completion and provide a reason'>
                    <Button
                      size='small'
                      danger
                      type='link'
                      icon={<CloseCircleOutlined />}
                      onClick={() => {
                        setSelectedIntervention(record)
                        setIsDeclineCompletionModalVisible(true)
                      }}
                    >
                      Decline
                    </Button>
                  </Tooltip>
                </>
              )}

            {record.consultantCompletionStatus === 'done' &&
              record.userCompletionStatus === 'none' && (
                <>
                  <Tooltip title='Confirm intervention was completed successfully'>
                    <Button
                      size='small'
                      type='link'
                      icon={<CheckCircleOutlined />}
                      onClick={() => {
                        setSelectedIntervention(record)
                        setIsConfirmModalVisible(true)
                      }}
                    >
                      Confirm
                    </Button>
                  </Tooltip>
                  <Tooltip title='Reject completion and provide a reason'>
                    <Button
                      size='small'
                      danger
                      type='link'
                      icon={<CloseCircleOutlined />}
                      onClick={() => showDeclineModal(record.id)}
                    >
                      Decline
                    </Button>
                  </Tooltip>
                </>
              )}
            {record.consultantStatus === 'pending' && (
              <Alert
                type='info'
                showIcon
                message='Waiting for consultant to accept this intervention.'
                style={{ marginBottom: 12 }}
              />
            )}

            {record.consultantStatus === 'accepted' &&
              record.userStatus === 'pending' && (
                <Alert
                  type='warning'
                  showIcon
                  message='Consultant has accepted the intervention. Please accept to begin.'
                  style={{ marginBottom: 12 }}
                />
              )}
          </Space>
        )
      }
    }
  ]

  return (
    <div style={{ padding: '20px' }}>
      <Title level={3}>Interventions Tracking</Title>
      <Text type='secondary'>
        Track and manage your assigned interventions.
      </Text>
      <Divider />

      {/* Filters */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12}>
          <Select
            placeholder='Filter by Status'
            value={filters.status}
            onChange={value => setFilters({ ...filters, status: value })}
            style={{ width: '100%' }}
          >
            <Option value='all'>All</Option>
            <Option value='accepted'>Accepted</Option>
            <Option value='declined'>Declined</Option>
            <Option value='pending'>Pending</Option>
            <Option value='confirmed'>Completed</Option>
            <Option value='rejected'>Rejected</Option>
          </Select>
        </Col>
        <Col xs={24} sm={12}>
          <Button
            type='primary'
            icon={<PlusOutlined />}
            onClick={() => setIsRequestModalVisible(true)}
            block
          >
            Request New Intervention
          </Button>
        </Col>
      </Row>

      {/* Assigned Interventions Table */}
      <Card>
        <Table
          dataSource={getFilteredInterventions()}
          columns={interventionColumns}
          rowKey='id'
          pagination={{ pageSize: 10 }}
          expandable={{
            expandedRowRender: (record: AssignedIntervention) => (
              <div style={{ padding: '12px 24px' }}>
                <p>
                  <strong>Description:</strong>{' '}
                  {record.description || (
                    <Text type='secondary'>No description provided.</Text>
                  )}
                </p>

                {record.resources?.length > 0 && (
                  <>
                    <Divider />
                    <strong>Resources:</strong>
                    <ul>
                      {record.resources?.map((res, idx) => (
                        <li key={idx}>
                          {res.type === 'link' ? '🔗' : '📄'}{' '}
                          <a
                            href={res.link}
                            target='_blank'
                            rel='noopener noreferrer'
                          >
                            {res.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {record.feedback && (
                  <>
                    <Divider />
                    <strong>Feedback:</strong>
                    <p>
                      <Rate disabled value={record.feedback.rating} />
                    </p>
                    <Text>
                      {record.feedback.comments || 'No comments provided.'}
                    </Text>
                  </>
                )}
              </div>
            )
          }}
        />
      </Card>

      {/* Request Intervention Modal */}
      <Modal
        title='Request New Intervention'
        open={isRequestModalVisible}
        onCancel={() => setIsRequestModalVisible(false)}
        footer={[
          <Button key='cancel' onClick={() => setIsRequestModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key='submit'
            type='primary'
            onClick={() => requestForm.submit()}
          >
            Submit
          </Button>
        ]}
      >
        <Form
          form={requestForm}
          layout='vertical'
          onFinish={handleRequestIntervention}
        >
          <Form.Item
            name='areaOfSupport'
            label='Area of Support'
            rules={[
              { required: true, message: 'Please select an area of support' }
            ]}
          >
            <Select placeholder='Select area of support'>
              <Option value='Marketing Support'>Marketing Support</Option>
              <Option value='Financial management'>Financial Management</Option>
              <Option value='Compliance'>Compliance</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name='interventionTitle'
            label='Intervention Title'
            rules={[
              { required: true, message: 'Please enter the intervention title' }
            ]}
          >
            <Input placeholder='Enter intervention title' />
          </Form.Item>
          <Form.Item
            name='reason'
            label='Reason'
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder='Explain why you need this intervention'
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Confirm Completion Modal */}
      <Modal
        title='Confirm Completion'
        open={isConfirmModalVisible}
        onCancel={() => setIsConfirmModalVisible(false)}
        footer={[
          <Button key='cancel' onClick={() => setIsConfirmModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key='submit'
            type='primary'
            onClick={() => confirmForm.submit()}
          >
            Submit
          </Button>
        ]}
      >
        <Form
          form={confirmForm}
          layout='vertical'
          onFinish={handleConfirmCompletion}
        >
          <Form.Item
            name='rating'
            label='Rating'
            rules={[
              { required: true, message: 'Please rate the intervention' }
            ]}
          >
            <Rate />
          </Form.Item>
          <Form.Item
            name='feedback'
            label='Feedback'
            rules={[{ required: true, message: 'Please provide feedback' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder='Provide feedback about the intervention'
            />
          </Form.Item>
        </Form>
      </Modal>
      {/* Reject Completion Modal */}
      <Modal
        title='Reject Completion'
        open={isDeclineCompletionModalVisible}
        onCancel={() => setIsDeclineCompletionModalVisible(false)}
        footer={[
          <Button
            key='cancel'
            onClick={() => setIsDeclineCompletionModalVisible(false)}
          >
            Cancel
          </Button>,
          <Button
            key='submit'
            type='primary'
            danger
            onClick={() => rejectCompletionForm.submit()}
          >
            Submit
          </Button>
        ]}
      >
        <Form
          form={rejectCompletionForm}
          layout='vertical'
          onFinish={values => {
            if (selectedIntervention) {
              handleRejectCompletion(selectedIntervention, values.reason)
              setIsDeclineCompletionModalVisible(false)
              rejectCompletionForm.resetFields()
            }
          }}
        >
          <Form.Item
            name='reason'
            label='Reason for Rejection'
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Explain why you're rejecting this intervention's completion"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Decline Intervention Modal */}
      <Modal
        title='Decline Intervention'
        open={isDeclineModalVisible}
        onCancel={() => setIsDeclineModalVisible(false)}
        footer={[
          <Button key='cancel' onClick={() => setIsDeclineModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key='submit'
            type='primary'
            danger
            onClick={() => declineForm.submit()}
          >
            Submit
          </Button>
        ]}
      >
        <Form
          form={declineForm}
          layout='vertical'
          onFinish={handleDeclineSubmit}
        >
          <Form.Item
            name='reason'
            label='Reason for Declining'
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Explain why you're declining this intervention"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default InterventionsTrackingView
