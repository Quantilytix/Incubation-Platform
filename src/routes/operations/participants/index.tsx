import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Progress,
  Select,
  Input,
  message,
  Typography,
  Modal,
  Form,
  Descriptions,
  Space,
  Alert,
  Spin
} from 'antd'
import {
  TeamOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  FilePdfOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  FundOutlined
} from '@ant-design/icons'
import { db } from '@/firebase'
import { Helmet } from 'react-helmet'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where
} from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

const { Option } = Select
const { Title, Text } = Typography

const calculateProgress = (required, completed) => {
  if (!required || required === 0) return 0
  return Math.round((completed / required) * 100)
}

type ComplianceDoc = {
  type: string
  status: 'valid' | 'missing' | 'expired' | string
  url?: string
  fileName?: string
  expiryDate?: any
}

type SignedAgreement = {
  key: string // e.g. "popia-act"
  acceptedAt?: any
  pdfUrl?: string
  pdfPath?: string
  participantDigitalSignature?: string
  userSignatureURL?: string
  signer?: {
    uid?: string
    name?: string
    email?: string
    signatureURL?: string
  }
  textHash?: string
  version?: number
  userAgent?: string
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
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([])
  const [filteredParticipants, setFilteredParticipants] = useState<any[]>([])
  const [searchText, setSearchText] = useState('')
  const [selectedProgram, setSelectedProgram] = useState('all')
  const { user } = useFullIdentity()
  const [departments, setDepartments] = useState<any[]>([])
  const [viewDocModal, setViewDocModal] = useState(false)
  const [userDepartment, setUserDepartment] = useState<any>(null)
  const [systemDocs, setSystemDocs] = useState<null | {
    complianceDocuments: ComplianceDoc[]
    signedAgreements: SignedAgreement[]
  }>(null)

  const [docLoading, setDocLoading] = useState(false)

  const formatDate = (v: any) => {
    if (!v) return '—'
    const d = v?.toDate?.() ? v.toDate() : v
    return dayjs(d).isValid() ? dayjs(d).format('YYYY-MM-DD HH:mm') : '—'
  }
  const statusToColor = (s?: string) => {
    switch ((s || '').toLowerCase()) {
      case 'valid':
        return 'green'
      case 'missing':
        return 'red'
      case 'expired':
        return 'orange'
      default:
        return 'default'
    }
  }
  const titleCase = (s: string) =>
    s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  // 1. Fetch departments and set userDepartment after user loads
  useEffect(() => {
    const fetchDepartments = async () => {
      if (user?.companyCode) {
        const snapshot = await getDocs(collection(db, 'departments'))
        const all = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
        setDepartments(all)
        if (user.departmentId) {
          setUserDepartment(
            all.find(dep => dep.id === user.departmentId) || null
          )
        } else {
          setUserDepartment(all.find(dep => dep.isMain) || null)
        }
      }
    }
    fetchDepartments()
  }, [user])

  // 2. Fetch programs
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'programs'))
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().programName || doc.data().name || doc.id
        }))
        setPrograms(list)
      } catch (error) {
        // fallback is fine
      }
    }
    fetchPrograms()
  }, [])

  // 3. Fetch participants & applications
  useEffect(() => {
    const fetchParticipants = async () => {
      setLoading(true)
      try {
        const applicationSnap = await getDocs(collection(db, 'applications'))
        const participantSnap = await getDocs(collection(db, 'participants'))
        const participantMap = new Map(
          participantSnap.docs.map(doc => [doc.id, doc.data()])
        )
        let participantsList = applicationSnap.docs
          .filter(doc => doc.data().applicationStatus === 'accepted') // ✅ Filter here
          .map(doc => {
            const app = doc.data()
            const participantId = app.participantId
            const participant = participantMap.get(participantId) || {}
            const interventions = app.interventions || {}
            const required = interventions.required || []
            const completed = interventions.completed || []
            const assigned = interventions.assigned || []
            const progress = calculateProgress(
              required.length,
              completed.length
            )

            return {
              id: participantId,
              ...participant,
              programId: app.programId || '',
              companyCode: app.companyCode || '',
              interventions: {
                required,
                completed,
                assigned,
                participationRate: interventions.participationRate || 0
              },
              assignedCount: assigned.length,
              completedCount: completed.length,
              progress,
              stage: app.stage || participant.stage || 'N/A'
            }
          })

        if (user?.companyCode) {
          participantsList = participantsList.filter(
            p => p.companyCode === user.companyCode
          )
        }
        // Supplement with dummy participants (avoid ID collisions)
        const ids = new Set(participantsList.map(p => p.id))
        const merged = [...participantsList]
        setParticipants(merged)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchParticipants()
    // eslint-disable-next-line
  }, [userDepartment, user])

  useEffect(() => {
    setMetrics({
      totalParticipants: participants.length,
      totalRequiredInterventions: participants.reduce(
        (a, p) => a + (p.interventions?.required?.length || 0),
        0
      ),
      totalCompletedInterventions: participants.reduce(
        (a, p) => a + (p.interventions?.completed?.length || 0),
        0
      ),
      totalNeedingAssignment: participants.filter(
        p => (p.interventions?.assigned?.length || 0) === 0
      ).length
    })
  }, [participants])

  useEffect(() => {
    let filtered = participants
    if (selectedProgram !== 'all') {
      filtered = filtered.filter(p => p.programId === selectedProgram)
    }
    if (searchText.trim()) {
      filtered = filtered.filter(
        p =>
          (p.beneficiaryName || '')
            .toLowerCase()
            .includes(searchText.toLowerCase()) ||
          (p.sector || '').toLowerCase().includes(searchText.toLowerCase())
      )
    }
    setFilteredParticipants(filtered)
  }, [participants, selectedProgram, searchText])

  const fetchSystemDocuments = async (participantId: string) => {
    setDocLoading(true)
    try {
      // Try participants/{participantId} first (matches your screenshots)
      let participantData: any = null
      const participantRef = doc(db, 'participants', participantId)
      const participantSnap = await getDoc(participantRef)
      if (participantSnap.exists()) {
        participantData = participantSnap.data()
      } else {
        // Fallback: in some setups participantId isn't the document id → query by field
        const pSnapByField = await getDocs(
          query(
            collection(db, 'participants'),
            where('participantId', '==', participantId),
            limit(1)
          )
        )
        if (!pSnapByField.empty) participantData = pSnapByField.docs[0].data()
      }

      // Also load the application (your original code used this)
      let applicationData: any = null
      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('participantId', '==', participantId),
          limit(1)
        )
      )
      if (!appSnap.empty) applicationData = appSnap.docs[0].data()

      // Pull docs from participants first, otherwise from applications
      const complianceFromParticipant = Array.isArray(
        participantData?.complianceDocuments
      )
        ? participantData.complianceDocuments
        : []
      const complianceFromApplication = Array.isArray(
        applicationData?.complianceDocuments
      )
        ? applicationData.complianceDocuments
        : []
      const complianceDocuments: ComplianceDoc[] =
        complianceFromParticipant.length
          ? complianceFromParticipant
          : complianceFromApplication

      // signedAgreements is usually an object/map → turn into an array
      const signedObj =
        participantData?.signedAgreements ||
        applicationData?.signedAgreements ||
        {}
      const signedAgreements: SignedAgreement[] = Object.entries(signedObj)
        .map(([key, val]: [string, any]) => ({
          key,
          ...val
        }))
        // optional: sort newest first
        .sort((a, b) => {
          const da = a.acceptedAt?.toDate?.() ?? new Date(a.acceptedAt ?? 0)
          const dbb = b.acceptedAt?.toDate?.() ?? new Date(b.acceptedAt ?? 0)
          return Number(dbb) - Number(da)
        })

      setSystemDocs({ complianceDocuments, signedAgreements })
    } catch (error) {
      console.error('❌ Failed to fetch system documents:', error)
      message.error('Failed to load system documents')
      setSystemDocs(null)
    } finally {
      setDocLoading(false)
    }
  }

  const columns = [
    {
      title: 'Beneficiary Name',
      dataIndex: 'beneficiaryName',
      key: 'beneficiaryName'
    },

    { title: 'Sector', dataIndex: 'sector', key: 'sector' },
    { title: 'Stage', dataIndex: 'stage', key: 'stage' },

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
      render: (record: any) => (
        <Progress
          percent={record.progress}
          size='small'
          status={record.progress === 100 ? 'success' : 'active'}
        />
      )
    },
    {
      title: 'Participation Rate',
      key: 'participationRate',
      render: (record: any) =>
        `${record.interventions?.participationRate ?? 0}%`
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            icon={<FilePdfOutlined />}
            onClick={() => {
              fetchSystemDocuments(record.id)
              setViewDocModal(true)
            }}
            disabled={loading}
          >
            View Documents
          </Button>

          {/* NEW: View Performance */}
          <Button
            icon={<BarChartOutlined />}
            onClick={() =>
              navigate(`/operations/participants/${record.id}/performance`, {
                state: {
                  // pass helpful context (optional)
                  name: record.beneficiaryName || '',
                  programId: record.programId || ''
                }
              })
            }
          >
            Performance
          </Button>
        </span>
      )
    }
  ]

  return (
    <div style={{ padding: 8, minHeight: '100vh' }}>
      <Helmet>
        <title>Participant Management | Incubation Platform</title>
      </Helmet>
      <Alert
        message='Participant Management'
        description='Manage participant promotion and review their system documents. Use filters to find participants by program or sector.'
        type='info'
        showIcon
        closable
        style={{ marginBottom: 16 }}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} md={6}>
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
                border: '1px solid #bae7ff',
                padding: '16px 20px',
                height: '100%'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 12
                }}
              >
                <div
                  style={{
                    background: '#e6f7ff',
                    padding: 8,
                    borderRadius: '50%',
                    marginRight: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <TeamOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                </div>
                <Text strong>Total Participants</Text>
              </div>
              <Title level={3} style={{ margin: 0 }}>
                {metrics.totalParticipants}
              </Title>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card
              hoverable
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #bae7ff',
                padding: '16px 20px',
                height: '100%'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 12
                }}
              >
                <div
                  style={{
                    background: '#f0f5ff',
                    padding: 8,
                    borderRadius: '50%',
                    marginRight: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <PlusOutlined style={{ fontSize: 18, color: '#096dd9' }} />
                </div>
                <Text strong>Required Interventions</Text>
              </div>
              <Title level={3} style={{ margin: 0 }}>
                {metrics.totalRequiredInterventions}
              </Title>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card
              hoverable
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #bae7ff',
                padding: '16px 20px',
                height: '100%'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 12
                }}
              >
                <div
                  style={{
                    background: '#f6ffed',
                    padding: 8,
                    borderRadius: '50%',
                    marginRight: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <CheckCircleOutlined
                    style={{ fontSize: 18, color: '#52c41a' }}
                  />
                </div>
                <Text strong>Completed Interventions</Text>
              </div>
              <Title level={3} style={{ margin: 0, color: '#52c41a' }}>
                {metrics.totalCompletedInterventions}
              </Title>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card
              hoverable
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #bae7ff',
                padding: '16px 20px',
                height: '100%'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 12
                }}
              >
                <div
                  style={{
                    background: '#fffbe6',
                    padding: 8,
                    borderRadius: '50%',
                    marginRight: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <WarningOutlined style={{ fontSize: 18, color: '#faad14' }} />
                </div>
                <Text strong>Need Assignment</Text>
              </div>
              <Title level={3} style={{ margin: 0, color: '#faad14' }}>
                {metrics.totalNeedingAssignment}
              </Title>
            </Card>
          </motion.div>
        </Col>
      </Row>

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
            marginBottom: 10,
            border: '1px solid #d6e4ff'
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Select
                style={{ width: '100%' }}
                value={selectedProgram}
                onChange={val => {
                  setSelectedProgram(val)
                }}
              >
                <Option value='all'>All Programs</Option>
                {programs.map(p => (
                  <Option key={p.id} value={p.id}>
                    {p.name}
                  </Option>
                ))}
              </Select>
            </Col>

            <Col span={8}>
              <Input
                placeholder='Search by name or sector'
                value={searchText}
                onChange={e => {
                  setSearchText(e.target.value)
                }}
                allowClear
              />
            </Col>
            <Col span={8} style={{ alignItems: 'flex-end' }}>
              <Button
                type='primary'
                onClick={() => navigate('/consultant/participants/new')}
              >
                + Add New Participant
              </Button>
            </Col>
          </Row>
        </Card>
      </motion.div>
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
        >
          <Table
            dataSource={filteredParticipants}
            columns={columns}
            rowKey='id'
            loading={loading}
            pagination={{ pageSize: 5 }}
          />
        </Card>
      </motion.div>

      {/* Docoments Modal logic */}
      <Modal
        title='📎 Incubation Documents'
        open={viewDocModal}
        onCancel={() => setViewDocModal(false)}
        footer={null}
        width={1000}
      >
        {docLoading ? (
          <Spin />
        ) : systemDocs ? (
          <>
            {/* Compliance Documents */}
            <Title level={5} style={{ marginTop: 0 }}>
              Compliance Documents
            </Title>
            {systemDocs.complianceDocuments?.length ? (
              <Descriptions
                bordered
                size='small'
                column={1}
                style={{ marginBottom: 16 }}
              >
                {systemDocs.complianceDocuments.map((d, idx) => (
                  <Descriptions.Item
                    key={idx}
                    label={d.type || `Document ${idx + 1}`}
                  >
                    <Space direction='vertical'>
                      <Space>
                        <Tag color={statusToColor(d.status)}>
                          {d.status || 'unknown'}
                        </Tag>
                        {d.expiryDate ? (
                          <span>Expires: {formatDate(d.expiryDate)}</span>
                        ) : null}
                      </Space>

                      {d.url ? (
                        <a
                          href={d.url}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          View Document
                        </a>
                      ) : (
                        <Tag color='red'>No file uploaded</Tag>
                      )}
                    </Space>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            ) : (
              <Alert
                type='info'
                showIcon
                message='No compliance documents'
                style={{ marginBottom: 16 }}
              />
            )}

            {/* Signed Agreements */}
            <Title level={5}>Signed Agreements</Title>
            {systemDocs.signedAgreements?.length ? (
              <Descriptions bordered size='small' column={1}>
                {systemDocs.signedAgreements.map(a => (
                  <Descriptions.Item key={a.key} label={titleCase(a.key)}>
                    <Space direction='vertical'>
                      <div>
                        <strong>Accepted:</strong> {formatDate(a.acceptedAt)}
                      </div>
                      {(a.signer?.name || a.signer?.email) && (
                        <div>
                          <strong>Signer:</strong> {a.signer?.name || '—'}
                          {a.signer?.email ? ` (${a.signer.email})` : ''}
                        </div>
                      )}
                      {a.pdfUrl ? (
                        <a
                          href={a.pdfUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          View PDF
                        </a>
                      ) : (
                        <Tag>PDF unavailable</Tag>
                      )}
                      {(a.userSignatureURL || a.signer?.signatureURL) && (
                        <Space align='center'>
                          <span>
                            <strong>Signature:</strong>
                          </span>
                          <img
                            src={a.userSignatureURL || a.signer?.signatureURL}
                            alt='signature'
                            style={{ height: 32 }}
                          />
                        </Space>
                      )}
                    </Space>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            ) : (
              <Alert type='info' showIcon message='No signed agreements' />
            )}
          </>
        ) : (
          <Alert
            message='No documents found'
            description='This participant has no system documents uploaded yet.'
            type='warning'
            showIcon
          />
        )}
      </Modal>
    </div>
  )
}

export default OperationsParticipantsManagement
