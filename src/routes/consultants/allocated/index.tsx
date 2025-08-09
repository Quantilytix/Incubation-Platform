import React, { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Typography,
  Tag,
  List,
  Card,
  Space,
  message,
  Progress,
  Spin
} from 'antd'
import {
  CheckOutlined,
  FileTextOutlined,
  LinkOutlined,
  PictureOutlined
} from '@ant-design/icons'
import { auth, db } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  writeBatch,
  onSnapshot,
  increment,
  Timestamp,
  doc,
  query,
  where,
  collection,
  getDocs,
  getDoc
} from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { motion } from 'framer-motion'

const { Title, Paragraph } = Typography

interface AssignedIntervention {
  id: string
  participantId: string
  consultantId: string
  beneficiaryName: string
  interventionTitle: string
  description: string
  timeSpent: number
  status: string
  dueDate: string
  resources: {
    type: string
    label: string
    link: string
  }[]
}

export const AssignedInterventions: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  const [consultantId, setConsultantId] = useState<string | null>(null)
  const [selected, setSelected] = useState<AssignedIntervention | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [assignedInterventions, setAssignedInterventions] = useState<
    AssignedIntervention[]
  >([])
  const [completedInterventions, setCompletedInterventions] = useState<
    AssignedIntervention[]
  >([])
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null)

  useEffect(() => {
    const fetchCompletedInterventions = async () => {
      if (!consultantId || !selectedParticipantId) return

      try {
        const q = query(
          collection(db, 'assignedInterventions'),
          where('participantId', '==', selectedParticipantId),
          where('status', '==', 'completed')
        )

        const snapshot = await getDocs(q)

        const data = await Promise.all(
          snapshot.docs.map(async docSnap => {
            const intervention = docSnap.data() as AssignedIntervention

            let consultantName = 'Unknown Consultant'
            try {
              const cSnap = await getDoc(
                doc(db, 'consultants', intervention.consultantId)
              )
              if (cSnap.exists()) {
                const c = cSnap.data()
                consultantName = c.name || consultantName
              }
            } catch {}

            return {
              id: docSnap.id,
              ...intervention,
              consultantName
            }
          })
        )

        setCompletedInterventions(data)
      } catch (error) {
        console.error('Error fetching completed interventions:', error)
      }
    }

    fetchCompletedInterventions()
  }, [selectedParticipantId])

  // Fetch consultant ID based on logged-in user's email
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (user) {
        const consultantSnapshot = await getDocs(
          query(collection(db, 'consultants'), where('email', '==', user.email))
        )
        if (!consultantSnapshot.empty) {
          const consultantDoc = consultantSnapshot.docs[0]
          setConsultantId(consultantDoc.id)
        } else {
          console.error('No consultant found for the logged-in user.')
        }
      } else {
        console.log('No user is logged in.')
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!consultantId) return

    const q = query(
      collection(db, 'assignedInterventions'),
      where('consultantId', '==', consultantId),
      where('userStatus', '==', 'accepted')
    )

    const unsub = onSnapshot(q, async snap => {
      const newlyAccepted = snap.docs.filter(
        d => !d.data().countedForConsultant
      )
      if (newlyAccepted.length === 0) return

      try {
        const batch = writeBatch(db)
        newlyAccepted.forEach(d => {
          batch.update(doc(db, 'assignedInterventions', d.id), {
            countedForConsultant: true,
            countedAt: Timestamp.now()
          })
        })
        batch.update(doc(db, 'consultants', consultantId), {
          assignmentCount: increment(newlyAccepted.length)
        })
        await batch.commit()
      } catch (e) {
        console.error('Failed to increment assignmentCount:', e)
      }
    })

    return () => unsub()
  }, [consultantId])

  // Fetch assigned interventions for the logged-in consultant
  useEffect(() => {
    const fetchAssignedInterventions = async () => {
      if (!consultantId) return
      setLoading(true) // 🔄 Begin loading

      try {
        const q = query(
          collection(db, 'assignedInterventions'),
          where('consultantId', '==', consultantId),
          where('status', 'in', ['assigned', 'in-progress'])
        )
        const snapshot = await getDocs(q)
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AssignedIntervention[]
        setAssignedInterventions(data)
      } catch (error) {
        console.error('Error fetching assigned interventions:', error)
        message.error('Failed to load assigned interventions.')
      } finally {
        setLoading(false) // ✅ End loading
      }
    }

    fetchAssignedInterventions()
  }, [consultantId])

  // Open modal to view details
  const openDetails = (record: AssignedIntervention) => {
    setSelected(record)
    setSelectedParticipantId(record.participantId)
    setModalOpen(true)
  }

  // Table columns
  const columns = [
    { title: 'Beneficiary Name', dataIndex: 'beneficiaryName' },
    { title: 'Intervention', dataIndex: 'interventionTitle' },
    {
      title: 'Time Spent (hrs)',
      dataIndex: 'timeSpent',
      render: (timeSpent: number) => timeSpent || 0 // Default to 0 if undefined
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      render: (value: number) => (
        <Progress percent={value || 0} size='small' strokeColor='#52c41a' />
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status: string) => {
        let color = 'default'

        switch (status.toLowerCase()) {
          case 'assigned':
            color = 'gold'
            break
          case 'in-progress':
            color = 'blue'
            break
          case 'completed':
            color = 'green'
            break
          case 'declined':
            color = 'red'
            break
          case 'pending':
            color = 'orange'
            break
          default:
            color = 'default'
        }

        return (
          <Tag color={color} style={{ textTransform: 'capitalize' }}>
            {status}
          </Tag>
        )
      }
    },
    {
      title: 'Action',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 12 }}>
          {record.status !== 'completed' && (
            <Button
              type='link'
              icon={<CheckOutlined />}
              onClick={() =>
                navigate(`/consultant/allocated/intervention/${record.id}`)
              }
            >
              Update
            </Button>
          )}
        </div>
      )
    }
  ]

  // Get icons for resource types
  const getIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileTextOutlined />
      case 'link':
        return <LinkOutlined />
      case 'image':
        return <PictureOutlined />
      default:
        return null
    }
  }
  const handleDownloadAll = (resources: AssignedIntervention['resources']) => {
    if (!resources || resources.length === 0) {
      message.warning('No resources to download')
      return
    }

    resources.forEach(resource => {
      const link = document.createElement('a')
      link.href = resource.link
      link.download = resource.label || 'resource'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  }

  const completedColumns = [
    {
      title: 'Intervention',
      dataIndex: 'interventionTitle'
    },
    {
      title: 'Consultant',
      dataIndex: 'consultantName',
      render: (name: string, record: AssignedIntervention) => (
        <span>
          {name}
          {record.consultantId !== consultantId && (
            <Tag color='red' style={{ marginLeft: 8 }}>
              Other Consultant
            </Tag>
          )}
        </span>
      )
    },
    {
      title: 'Resources',
      key: 'resources',
      render: (_: any, record: AssignedIntervention) => (
        <div>
          {(record.resources || []).map(res => (
            <span key={res.link} style={{ marginRight: 8 }}>
              {getIcon(res.type)}{' '}
              <a href={res.link} target='_blank' rel='noopener noreferrer'>
                {res.label}
              </a>
            </span>
          ))}
        </div>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: AssignedIntervention) => (
        <Space>
          <Button type='link' onClick={() => openDetails(record)}>
            View
          </Button>
          <Button
            type='link'
            onClick={() => handleDownloadAll(record.resources)}
          >
            Download All
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div style={{ minHeight: '100vh' }}>
      <Helmet>
        <title>Ongoing Interventions | Consultant Workspace</title>
        <meta
          name='description'
          content='View and manage your assigned interventions as a consultant.'
        />
      </Helmet>

      <Spin tip='Loading interventions' spinning={loading} size='large'>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card
            hoverable
            style={{
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
              transition: 'all 0.3s ease',
              borderRadius: 8,
              border: '1px solid #d6e4ff'
            }}
            title='Ongoing Interventions'
          >
            <Table
              dataSource={assignedInterventions}
              columns={columns}
              rowKey='id'
              onRow={record => ({
                onClick: () => {
                  setSelected(record)
                  setSelectedParticipantId(record.participantId)
                }
              })}
            />
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card
            title={`Completed Interventions for ${
              assignedInterventions.find(
                i => i.participantId === selectedParticipantId
              )?.beneficiaryName || 'this SME'
            }`}
            style={{
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
              transition: 'all 0.3s ease',
              borderRadius: 8,
              marginTop: 32,
              border: '1px solid #d6e4ff'
            }}
          >
            <Table
              dataSource={completedInterventions}
              columns={completedColumns}
              rowKey='id'
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </motion.div>
      </Spin>

      <Modal
        open={modalOpen}
        title='Intervention Details & Resources'
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        {selected && (
          <>
            <Title level={5}>{selected.interventionTitle}</Title>
            <Paragraph>
              <b>SME:</b> {selected.beneficiaryName}
              <br />
              <b>Time Spent:</b> {selected.timeSpent || 0} hours
              <br />
              <b>Status:</b> {selected.status}
            </Paragraph>
            <Paragraph>
              <b>Description:</b> <br />
              {selected.description || 'No description available'}
            </Paragraph>

            <Paragraph>
              <b>Reference Material:</b>
            </Paragraph>
            <List
              dataSource={selected.resources || []} // Default to empty array if undefined
              renderItem={item => (
                <List.Item>
                  {getIcon(item.type)}{' '}
                  <a href={item.link} target='_blank' rel='noopener noreferrer'>
                    {item.label}
                  </a>
                </List.Item>
              )}
            />
          </>
        )}
      </Modal>
    </div>
  )
}
