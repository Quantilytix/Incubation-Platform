import React, { useEffect, useState, useCallback } from 'react'
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
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  updateDoc,
  Timestamp
} from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { autoGenerateMOVFromIntervention } from '@/services/movService'

const { Title, Paragraph } = Typography

interface AssignedIntervention {
  id: string
  beneficiaryName: string
  consultantCompletionStatus: string
  consultantId: string
  consultantName?: string
  consultantStatus: string
  createdAt: Timestamp
  dueDate: Timestamp
  interventionId: string
  interventionTitle: string
  notes: string
  participantId: string
  progress: number
  resources: {
    type: string
    label: string
    link: string
  }[]
  status: string
  targetMetric: string[]
  targetType: string
  targetValue: string
  timeSpent: number
  type: string
  updatedAt: string
  userCompletionStatus: string
  userStatus: string
  invoiceId?: string
}

interface Consultant {
  id: string
  name: string
  email: string
  rate: string
}

interface Invoice {
  assignedInterventionId: string
  consultantId: string
  participantId: string
  beneficiaryName: string
  interventionTitle: string
  hoursSpent: number
  consultantRatePerHour: number
  amount: number
  generatedDate: Timestamp
  status: 'pending' | 'submitted' | 'approved' | 'paid' | 'cancelled'
}

export const AssignedInterventions: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  const [consultantId, setConsultantId] = useState<string | null>(null)
  const [consultantRate, setConsultantRate] = useState<number | null>(null)
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

  const generateInvoice = useCallback(
    async (intervention: AssignedIntervention) => {
      if (typeof consultantRate !== 'number' || isNaN(consultantRate)) {
        message.error(
          'Consultant hourly rate not available or invalid. Cannot generate invoice.'
        )
        console.error('Consultant rate is invalid:', consultantRate)
        return
      }

      if (intervention.timeSpent <= 0) {
        message.warning(
          'Time spent is 0. An invoice cannot be generated for 0 hours.'
        )
        return
      }

      const invoiceAmount = intervention.timeSpent * consultantRate

      const newInvoice: Invoice = {
        assignedInterventionId: intervention.id,
        consultantId: intervention.consultantId,
        participantId: intervention.participantId,
        beneficiaryName: intervention.beneficiaryName,
        interventionTitle: intervention.interventionTitle,
        hoursSpent: intervention.timeSpent,
        consultantRatePerHour: consultantRate,
        amount: invoiceAmount,
        generatedDate: Timestamp.now(),
        status: 'pending'
      }

      try {
        const docRef = await addDoc(collection(db, 'invoices'), newInvoice)
        message.success(
          `Invoice generated successfully for ${
            intervention.interventionTitle
          }! Amount: R${invoiceAmount.toFixed(2)}`
        )

        await updateDoc(doc(db, 'assignedInterventions', intervention.id), {
          invoiceId: docRef.id
        })

        setAssignedInterventions(prev =>
          prev.map(item =>
            item.id === intervention.id
              ? { ...item, invoiceId: docRef.id }
              : item
          )
        )
      } catch (error) {
        console.error('Error generating invoice:', error)
        message.error('Failed to generate invoice. Please try again.')
      }
    },
    [consultantRate]
  )

  // Inside the generateInvoice or right after it
  const generateMOV = async (intervention: AssignedIntervention) => {
    try {
      // ✅ Fetch participant data
      const participantSnap = await getDoc(
        doc(db, 'participants', intervention.participantId)
      )
      if (!participantSnap.exists()) return
      const participantData = participantSnap.data()

      // ✅ Fetch intervention data (to get department)
      const interventionSnap = await getDoc(
        doc(db, 'interventionsDatabase', intervention.interventionId)
      )
      const interventionData = interventionSnap.exists()
        ? interventionSnap.data()
        : {}

      // ✅ Auto-generate MOV with department
      const movId = await autoGenerateMOVFromIntervention(
        intervention.id, // interventionKey
        {
          interventionKey: intervention.id,
          interventionTitle: intervention.interventionTitle,
          participantId: intervention.participantId,
          beneficiaryName: intervention.beneficiaryName,
          confirmedAt: new Date(),
          consultantIds: [intervention.consultantId],
          companyCode: participantData.companyCode,
          areaOfSupport: interventionData.areaOfSupport || null // <-- department source
        },
        participantData
      )
    } catch (error) {
      console.error('Failed to generate MOV:', error)
    }
  }

  useEffect(() => {
    const fetchCompletedInterventions = async () => {
      if (!consultantId || !selectedParticipantId) return

      try {
        const q = query(
          collection(db, 'assignedInterventions'),
          where('participantId', '==', selectedParticipantId),
          where('progress', '==', 100)
        )

        const snapshot = await getDocs(q)

        const data = await Promise.all(
          snapshot.docs.map(async docSnap => {
            const intervention = docSnap.data() as AssignedIntervention

            let consultantName = 'Unknown Consultant'
            if (intervention.consultantId) {
              const consultantQuery = query(
                collection(db, 'consultants'),
                where('__name__', '==', intervention.consultantId)
              )
              const consultantSnap = await getDocs(consultantQuery)
              if (!consultantSnap.empty) {
                consultantName = consultantSnap.docs[0].data().name
              }
            }
            return {
              id: docSnap.id,
              ...intervention,
              consultantName: consultantName
            }
          })
        )
        setCompletedInterventions(data)
      } catch (error) {
        console.error('Error fetching completed interventions:', error)
        message.error('Failed to load completed interventions for this SME.')
      }
    }

    fetchCompletedInterventions()
  }, [consultantId, selectedParticipantId])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (user) {
        console.log('User logged in:', user.email)
        try {
          const consultantSnapshot = await getDocs(
            query(
              collection(db, 'consultants'),
              where('email', '==', user.email)
            )
          )
          if (!consultantSnapshot.empty) {
            const consultantDoc = consultantSnapshot.docs[0]
            const consultantData = consultantDoc.data() as Consultant

            setConsultantId(consultantDoc.id)

            const parsedRate = parseFloat(consultantData.rate)
            if (isNaN(parsedRate)) {
              console.error(
                "Parsed consultant rate is NaN. Check Firestore 'rate' field type and value for consultant:",
                consultantData.email
              )
              setConsultantRate(0)
            } else {
              setConsultantRate(parsedRate)
            }
            console.log('Consultant Data:', consultantData)
            console.log('Consultant Rate (parsed):', parsedRate)
          } else {
            console.error(
              'No consultant found for the logged-in user with email:',
              user.email
            )
            message.warn(
              'Your consultant profile could not be found. Please contact support.'
            )
            setLoading(false)
          }
        } catch (error) {
          console.error('Error fetching consultant details:', error)
          message.error('Failed to retrieve consultant profile.')
          setLoading(false)
        }
      } else {
        console.log('No user is logged in.')
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchAssignedInterventions = async () => {
      if (!consultantId) {
        return
      }
      setLoading(true)

      try {
        const q = query(
          collection(db, 'assignedInterventions'),
          where('consultantId', '==', consultantId)
        )
        const snapshot = await getDocs(q)
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<
            AssignedIntervention,
            'id' | 'createdAt' | 'dueDate'
          >),
          createdAt: doc.data().createdAt as Timestamp,
          dueDate: doc.data().dueDate as Timestamp
        })) as AssignedIntervention[]
        setAssignedInterventions(data)

        data.forEach(async intervention => {
          if (
            intervention.progress === 100 &&
            intervention.timeSpent > 0 &&
            !intervention.invoiceId
          ) {
            // ✅ Also generate MOV here
            await generateMOV(intervention)
          }
        })
      } catch (error) {
        console.error('Error fetching assigned interventions:', error)
        message.error('Failed to load assigned interventions.')
      } finally {
        setLoading(false)
      }
    }

    fetchAssignedInterventions()
  }, [consultantId, generateInvoice])

  const openDetails = (record: AssignedIntervention) => {
    setSelected(record)
    setSelectedParticipantId(record.participantId)
    setModalOpen(true)
  }

  // ✅ Merge old + new resources
  const getAllResources = (record: AssignedIntervention) => {
    const oldResources = record.resources || []
    const progressResources = (record.progressUpdates || []).flatMap(
      (update: any) => update.resources || []
    )
    return [...oldResources, ...progressResources]
  }

  // ✅ Compact Resource Count Helper
  const getResourceCounts = (resources: any[]) => {
    const counts = { document: 0, image: 0, link: 0 }
    resources.forEach(r => {
      if (r.type === 'document') counts.document++
      else if (r.type === 'image') counts.image++
      else if (r.type === 'link') counts.link++
    })
    return counts
  }

  const columns = [
    { title: 'Beneficiary Name', dataIndex: 'beneficiaryName' },
    { title: 'Intervention', dataIndex: 'interventionTitle' },
    {
      title: 'Time Spent (hrs)',
      dataIndex: 'timeSpent',
      render: (timeSpent: number) => timeSpent || 0
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
          case 'done':
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {record.progress !== 100 && (
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

          {record.progress === 100 &&
            record.timeSpent > 0 &&
            !record.invoiceId && (
              <Button type='primary' onClick={() => generateInvoice(record)}>
                Generate Invoice
              </Button>
            )}
        </div>
      )
    }
  ]

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

  // ✅ Download All as ZIP
  const handleDownloadAll = async (
    resources: { type: string; label: string; link: string }[],
    facilitatorName: string,
    interventionTitle: string
  ) => {
    if (!resources || resources.length === 0) {
      message.warning('No resources to download')
      return
    }

    const zip = new JSZip()
    const folder = zip.folder(
      `${facilitatorName}_${interventionTitle}_resources`
    )

    const fetchAndAdd = async (resource: any) => {
      const response = await fetch(resource.link)
      const blob = await response.blob()
      const cleanName = resource.label.replace(/[^\w\d.-]/g, '_')
      folder?.file(cleanName, blob)
    }

    await Promise.all(resources.map(r => fetchAndAdd(r)))
    const content = await zip.generateAsync({ type: 'blob' })

    saveAs(content, `${facilitatorName}_${interventionTitle}_resources.zip`)
    message.success('All resources downloaded as ZIP!')
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
      render: (_: any, record: AssignedIntervention) => {
        const allResources = getAllResources(record)
        const counts = getResourceCounts(allResources)
        return (
          <Space>
            {counts.document > 0 && (
              <Tag color='blue'>📄 {counts.document}</Tag>
            )}
            {counts.image > 0 && <Tag color='green'>🖼️ {counts.image}</Tag>}
            {counts.link > 0 && <Tag color='purple'>🔗 {counts.link}</Tag>}
          </Space>
        )
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: AssignedIntervention) => {
        const allResources = getAllResources(record)
        return (
          <Space>
            <Button type='link' onClick={() => openDetails(record)}>
              View
            </Button>
            <Button
              type='link'
              onClick={() =>
                handleDownloadAll(
                  allResources,
                  record.consultantName || 'Consultant',
                  record.interventionTitle
                )
              }
            >
              Download All
            </Button>
          </Space>
        )
      }
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

      <Spin tip='Loading interventions...' spinning={loading} size='large'>
        <Title level={4}>Ongoing Interventions</Title>
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

        <Card
          style={{ marginTop: 32 }}
          title={
            selectedParticipantId
              ? `Completed Interventions for ${
                  assignedInterventions.find(
                    i => i.participantId === selectedParticipantId
                  )?.beneficiaryName || 'this SME'
                }`
              : 'Completed Interventions (Select an ongoing intervention to view)'
          }
        >
          <Table
            dataSource={completedInterventions}
            columns={completedColumns}
            rowKey='id'
            pagination={{ pageSize: 5 }}
            locale={{
              emptyText: 'No completed interventions for this SME yet.'
            }}
          />
        </Card>
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
              <b>Progress:</b> {selected.progress || 0}%
              <br />
              <b>Status:</b> {selected.status} (Consultant:{' '}
              {selected.consultantCompletionStatus})
            </Paragraph>
            <Paragraph>
              <b>Reference Material:</b>
            </Paragraph>
            <List
              dataSource={getAllResources(selected)}
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
