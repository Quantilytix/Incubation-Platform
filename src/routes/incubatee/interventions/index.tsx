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
  Col
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
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

interface AssignedIntervention {
  id: string
  participantId: string
  consultantId: string
  areaOfSupport: string
  interventionTitle: string
  dueDate: any
  status: string
  consultant?: {
    name: string
    email: string
    expertise: string[]
    rating: number
  }
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

  // Handle accept intervention
  const handleAccept = async (id: string) => {
    try {
      await updateDoc(doc(db, 'assignedInterventions', id), {
        status: 'accepted'
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
        status: 'declined',
        declineReason: values.reason
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
          status: 'completed',
          feedback: values.feedback,
          rating: values.rating
        }
      )
      setAssignedInterventions(prev =>
        prev.map(item =>
          item.id === selectedIntervention.id
            ? { ...item, status: 'completed' }
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
            <Text type='secondary'>{consultant.email}</Text>
            <Rate disabled value={consultant.rating} />
          </Space>
        ) : (
          <Text type='secondary'>Unassigned</Text>
        )
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (dueDate: any) =>
        dueDate ? dayjs(dueDate.seconds * 1000).format('YYYY-MM-DD') : '-'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default'
        let icon = null
        switch (status) {
          case 'pendingAssignment':
            color = 'orange'
            icon = <ExclamationCircleOutlined />
            break
          case 'assigned':
            color = 'blue'
            icon = <ClockCircleOutlined />
            break
          case 'requested':
            color = 'purple'
            icon = <FileSearchOutlined />
            break
          case 'completed':
            color = 'green'
            icon = <CheckCircleOutlined />
            break
          case 'ongoing':
            color = 'blue'
            icon = <ClockCircleOutlined />
            break
          default:
            break
        }
        return (
          <Space>
            {icon}
            <Tag color={color}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Tag>
          </Space>
        )
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        return (
          <Space>
            {record.status === 'assigned' && (
              <>
                <Button
                  size='small'
                  type='link'
                  onClick={() => handleAccept(record.id)}
                  icon={<CheckCircleOutlined />}
                >
                  Accept
                </Button>
                <Button
                  size='small'
                  danger
                  type='link'
                  onClick={() => showDeclineModal(record.id)}
                  icon={<CloseCircleOutlined />}
                >
                  Decline
                </Button>
              </>
            )}

            {record.status === 'completed' && (
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
            <Option value='pendingAssignment'>Pending Assignment</Option>
            <Option value='assigned'>Assigned</Option>
            <Option value='requested'>Requested</Option>
            <Option value='completed'>Completed</Option>
            <Option value='ongoing'>Ongoing</Option>
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
        />
      </Card>

      {/* Request Intervention Modal */}
      <Modal
        title='Request New Intervention'
        visible={isRequestModalVisible}
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
        visible={isConfirmModalVisible}
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

      {/* Decline Intervention Modal */}
      <Modal
        title='Decline Intervention'
        visible={isDeclineModalVisible}
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
