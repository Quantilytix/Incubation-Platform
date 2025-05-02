import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Table,
  Statistic,
  Tag,
  Button,
  Progress,
  Select,
  Form,
  Input,
  Space,
  message
} from 'antd'
import {
  TeamOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { db } from '@/firebase'
import { Helmet } from 'react-helmet'
import { addDoc, collection, getDocs } from 'firebase/firestore' // addDoc to create
import { useNavigate } from 'react-router-dom'

const { Option } = Select

const calculateProgress = (required: number, completed: number) => {
  if (!required || required === 0) return 0
  return Math.round((completed / required) * 100)
}

const getStatus = (progress: number) => {
  if (progress >= 70) return 'active'
  if (progress >= 30) return 'warning'
  return 'inactive'
}

const OperationsParticipantsManagement: React.FC = () => {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [participants, setParticipants] = useState<any[]>([])
  const [metrics, setMetrics] = useState({
    totalParticipants: 0,
    totalRequiredInterventions: 0,
    totalCompletedInterventions: 0,
    totalNeedingAssignment: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchParticipants = async () => {
      setLoading(true)
      try {
        const snapshot = await getDocs(collection(db, 'participants'))
        const participantsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        let totalRequired = 0
        let totalCompleted = 0
        let totalNeeding = 0

        participantsList.forEach((participant: any) => {
          const required = participant.interventions?.required || []
          const completed = participant.interventions?.completed || []
          const assigned = participant.interventions?.assigned || []

          totalRequired += required.length
          totalCompleted += completed.length

          if (assigned.length === 0) {
            totalNeeding += 1
          }
        })

        setParticipants(participantsList)
        setMetrics({
          totalParticipants: participantsList.length,
          totalRequiredInterventions: totalRequired,
          totalCompletedInterventions: totalCompleted,
          totalNeedingAssignment: totalNeeding
        })
      } catch (error) {
        console.error('Error fetching participants:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchParticipants()
  }, [])

  const handleAddParticipant = async (values: any) => {
    try {
      const newParticipant = {
        beneficiaryName: values.beneficiaryName,
        sector: values.sector,
        stage: values.stage,
        developmentType: values.developmentType,
        gender: values.gender,
        ageGroup: values.ageGroup,
        incubatorCode: values.incubatorCode,
        email: values.email || '',
        interventions: {
          required: [],
          assigned: [],
          completed: [],
          participationRate: values.participationRate ?? 0
        },
        revenueHistory: {
          monthly: {},
          yearly: {}
        },
        headcountHistory: {
          monthly: {},
          yearly: {}
        }
      }

      await addDoc(collection(db, 'participants'), newParticipant)

      message.success('Participant added successfully!')
      setModalOpen(false)
      form.resetFields()

      // Refresh participants
      const snapshot = await getDocs(collection(db, 'participants'))
      const participantsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setParticipants(participantsList)
    } catch (error) {
      console.error('Error adding participant:', error)
      message.error('Failed to add participant.')
    }
  }

  const columns = [
    {
      title: 'Beneficiary Name',
      dataIndex: 'beneficiaryName', // using beneficiaryName now
      key: 'beneficiaryName'
    },
    {
      title: 'Sector',
      dataIndex: 'sector',
      key: 'sector'
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage'
    },
    {
      title: 'Required',
      key: 'required',
      render: (record: any) => record.interventions?.required?.length ?? 0
    },
    {
      title: 'Completed',
      key: 'completed',
      render: (record: any) => record.interventions?.completed?.length ?? 0
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (record: any) => {
        const required = record.interventions?.required?.length ?? 0
        const completed = record.interventions?.completed?.length ?? 0
        const progress = calculateProgress(required, completed)
        return (
          <Progress
            percent={progress}
            size='small'
            status={progress === 100 ? 'success' : 'active'}
          />
        )
      }
    },
    {
      title: 'Participation Rate',
      key: 'participationRate',
      render: (record: any) =>
        `${record.interventions?.participationRate ?? 0}%`
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: any) => {
        const required = record.interventions?.required?.length ?? 0
        const completed = record.interventions?.completed?.length ?? 0
        const progress = calculateProgress(required, completed)
        const status = getStatus(progress)

        let color = 'default'
        if (status === 'active') color = 'green'
        else if (status === 'warning') color = 'orange'
        else color = 'gray'

        return <Tag color={color}>{status.toUpperCase()}</Tag>
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => <Button type='link'>View</Button>
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Helmet>
        <title>Participant Management | Incubation Platform</title>
      </Helmet>

      {/* Metrics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title='Total Participants'
              value={metrics.totalParticipants}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title='Total Required Interventions'
              value={metrics.totalRequiredInterventions}
              prefix={<PlusOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title='Total Completed Interventions'
              value={metrics.totalCompletedInterventions}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title='Need Consultant Assignment'
              value={metrics.totalNeedingAssignment}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>
      <Row justify='end' style={{ marginBottom: 16 }}>
        <Button
          type='primary'
          onClick={() => navigate('/consultant/participants/new')}
        >
          + Add New Participant
        </Button>
      </Row>

      {/* Participants Table */}
      <Card>
        <Table
          dataSource={participants}
          columns={columns}
          rowKey='id'
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  )
}

export default OperationsParticipantsManagement
