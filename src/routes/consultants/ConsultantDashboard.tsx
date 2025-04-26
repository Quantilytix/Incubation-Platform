import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  List,
  Button,
  Tag,
  Table,
  Modal,
  Input,
  message,
  Spin,
  Space
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  FileSearchOutlined,
  MessageOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { db } from '@/firebase'
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'

const { Title } = Typography

interface Intervention {
  id: string
  sme: string
  intervention: string
  sector: string
  stage: string
  location: string
  status: string
  declined: boolean
  declineReason: string
}

interface Feedback {
  id: string
  sme: string
  comment: string
}

export const ConsultantDashboard: React.FC = () => {
  const navigate = useNavigate()
  const auth = getAuth()

  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [currentDeclineId, setCurrentDeclineId] = useState<string | null>(null)
  const [consultantId, setConsultantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [ongoingCount, setOngoingCount] = useState(0)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (user) {
        const consultantSnap = await getDocs(
          query(collection(db, 'consultants'), where('email', '==', user.email))
        )
        if (!consultantSnap.empty) {
          setConsultantId(consultantSnap.docs[0].id)
        }
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      if (!consultantId) return
      try {
        const interventionsSnap = await getDocs(
          query(
            collection(db, 'assignedInterventions'),
            where('consultantId', '==', consultantId),
            where('status', '==', 'assigned')
          )
        )

        const interventionList: Intervention[] = await Promise.all(
          interventionsSnap.docs.map(async docSnap => {
            const data = docSnap.data()
            let sector = 'Unknown'
            let stage = 'Unknown'
            let location = 'Unknown'

            if (data.participantId) {
              const participantSnap = await getDocs(
                query(
                  collection(db, 'participants'),
                  where('id', '==', data.participantId)
                )
              )

              if (!participantSnap.empty) {
                const participant = participantSnap.docs[0].data()
                sector = participant.sector || sector
                stage = participant.stage || stage
                location = participant.location || location
              }
            }

            return {
              id: docSnap.id,
              sme: data.smeName,
              intervention: data.interventionTitle,
              sector,
              stage,
              location,
              status: data.status,
              declined: data.status === 'declined',
              declineReason: data.declineReason || ''
            }
          })
        )

        const feedbackSnap = await getDocs(collection(db, 'feedbacks'))
        const feedbackList: Feedback[] = feedbackSnap.docs.map(docSnap => {
          const data = docSnap.data()
          return {
            id: docSnap.id,
            sme: data.smeName,
            comment: data.comment
          }
        })

        const inProgressSnap = await getDocs(
          query(
            collection(db, 'assignedInterventions'),
            where('consultantId', '==', consultantId),
            where('status', '==', 'in-progress')
          )
        )
        setOngoingCount(inProgressSnap.size)

        setInterventions(interventionList)
        setFeedbacks(feedbackList)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [consultantId])

  const handleAccept = async (id: string) => {
    try {
      await updateDoc(doc(db, 'assignedInterventions', id), {
        status: 'in-progress'
      })
      message.success('Intervention accepted!')
      setInterventions(prev => prev.filter(item => item.id !== id))
    } catch (error) {
      console.error(error)
      message.error('Failed to accept intervention.')
    }
  }

  const handleDecline = (id: string) => {
    setCurrentDeclineId(id)
    setModalVisible(true)
  }

  const confirmDecline = async () => {
    if (!currentDeclineId) return
    try {
      await updateDoc(doc(db, 'assignedInterventions', currentDeclineId), {
        status: 'declined',
        declineReason
      })
      message.success('Intervention declined.')
      setInterventions(prev =>
        prev.filter(item => item.id !== currentDeclineId)
      )
      setModalVisible(false)
      setDeclineReason('')
      setCurrentDeclineId(null)
    } catch (error) {
      console.error(error)
      message.error('Failed to decline intervention.')
    }
  }

  const columns = [
    { title: 'SME Name', dataIndex: 'sme', key: 'sme' },
    { title: 'Intervention', dataIndex: 'intervention', key: 'intervention' },
    { title: 'Sector', dataIndex: 'sector', key: 'sector' },
    { title: 'Lifecycle Stage', dataIndex: 'stage', key: 'stage' },
    {
      title: 'Action',
      render: (_: any, record: Intervention) =>
        record.declined ? (
          <Tag color='red'>Declined</Tag>
        ) : (
          <Space>
            <Button
              type='link'
              icon={<CheckOutlined />}
              onClick={() => handleAccept(record.id)}
              style={{ color: 'green' }}
            >
              Accept
            </Button>
            <Button
              type='link'
              icon={<CloseOutlined />}
              onClick={() => handleDecline(record.id)}
              style={{ color: 'red' }}
            >
              Decline
            </Button>
          </Space>
        )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Consultant Workspace</Title>

      {loading ? (
        <Spin size='large' />
      ) : (
        <Row gutter={[16, 16]}>
          {/* Top Stats */}
          <Col span={8}>
            <Card>
              <Statistic
                title='Total Feedbacks'
                value={feedbacks.length}
                prefix={<MessageOutlined />}
              />
            </Card>
          </Col>

          <Col span={8}>
            <Card>
              <Statistic
                title='Pending Interventions'
                value={interventions.length}
                prefix={<FileSearchOutlined />}
              />
            </Card>
          </Col>

          <Col span={8}>
            <Card>
              <Statistic
                title='Ongoing Interventions'
                value={ongoingCount}
                prefix={<BarChartOutlined />}
              />
            </Card>
          </Col>

          {/* Allocated Interventions Table */}
          <Col span={24}>
            <Card title='Allocated Interventions'>
              <Table
                dataSource={interventions}
                columns={columns}
                rowKey='id'
                pagination={false}
                rowClassName={record => (record.declined ? 'declined-row' : '')}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Decline Reason Modal */}
      <Modal
        title='Reason for Declining'
        open={modalVisible}
        onOk={confirmDecline}
        onCancel={() => setModalVisible(false)}
        okText='Confirm'
      >
        <Input.TextArea
          rows={4}
          value={declineReason}
          onChange={e => setDeclineReason(e.target.value)}
          placeholder='Please enter a reason...'
        />
      </Modal>

      {/* Declined Row Style */}
      <style>
        {`
          .declined-row {
            background-color: #f5f5f5 !important;
            color: #999;
            font-style: italic;
          }
        `}
      </style>
    </div>
  )
}
