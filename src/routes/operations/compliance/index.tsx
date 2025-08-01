import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Modal,
  Form,
  Select,
  DatePicker,
  Upload,
  message,
  Tooltip,
  Typography,
  Badge,
  Tabs,
  Row,
  Col,
  Statistic,
  Progress,
  Layout,
  Alert
} from 'antd'
import {
  SearchOutlined,
  UploadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  PlusOutlined,
  DownloadOutlined,
  FileAddOutlined,
  FileProtectOutlined,
  UserOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import moment from 'dayjs'
import type { UploadProps } from 'antd'
import type { ColumnType } from 'antd/es/table'
import { db } from '@/firebase'
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where
} from 'firebase/firestore'
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL
} from 'firebase/storage'

import { ComplianceDocument, documentTypes, documentStatuses } from './types'
import EDAgreementModal from './EDAgreementModal'
import { Helmet } from 'react-helmet'

import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase' // ⬅️ make sure this exports Firebase functions
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { motion } from 'framer-motion'

const { Title, Text } = Typography
const { TabPane } = Tabs
const { Option } = Select
const { TextArea } = Input

const OperationsCompliance: React.FC = () => {
  const [documents, setDocuments] = useState<ComplianceDocument[]>([])
  const [formLoading, setFormLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isEDAgreementModalVisible, setIsEDAgreementModalVisible] =
    useState(false)
  const [selectedDocument, setSelectedDocument] =
    useState<ComplianceDocument | null>(null)
  const storage = getStorage()
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    string | null
  >(null)

  const [selectedParticipant, setSelectedParticipant] = useState<any>(null)
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('1')
  const navigate = useNavigate()
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [uploadPercent, setUploadPercent] = useState<number>(0)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [contactInfoMap, setContactInfoMap] = useState<Record<string, any>>({})
  const { user, loading } = useFullIdentity()

  useEffect(() => {
    const fetchContactInfo = async () => {
      console.log('Company Code:', user?.companyCode)
      if (!user?.companyCode) return

      const appsSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('companyCode', '==', user.companyCode)
        )
      )

      const participantsSnap = await getDocs(
        query(collection(db, 'participants'))
      )

      const participantMap = participantsSnap.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data()
        return acc
      }, {} as Record<string, any>)

      const contactMap = appsSnap.docs.reduce((acc, doc) => {
        const data = doc.data()
        const pId = data.participantId
        if (participantMap[pId]) {
          acc[pId] = {
            name: participantMap[pId].beneficiaryName,
            email: participantMap[pId].email,
            phone:
              participantMap[pId].phone || participantMap[pId].contactNumber
          }
        }
        return acc
      }, {} as Record<string, any>)

      setContactInfoMap(contactMap)
    }

    fetchContactInfo()
  }, [user?.companyCode])

  const uploadProps: UploadProps = {
    beforeUpload: file => {
      setUploadingFile(file)
      return false
    },
    showUploadList: true
  }

  // Load data
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!user?.companyCode) return

      setFormLoading(true)
      try {
        const appsQuery = query(
          collection(db, 'applications'),
          where('companyCode', '==', user.companyCode),
          where('applicationStatus', '==', 'accepted')
        )
        const snapshot = await getDocs(appsQuery)

        const fetchedDocuments: ComplianceDocument[] = []

        snapshot.forEach(applicationDoc => {
          const appData = applicationDoc.data()
          const complianceDocs = appData.complianceDocuments || []

          complianceDocs.forEach((doc, index) => {
            const docStatus = doc.status?.toLowerCase()
            if (
              !selectedStatusFilter ||
              docStatus === selectedStatusFilter.toLowerCase()
            ) {
              fetchedDocuments.push({
                id: `${applicationDoc.id}-${index}`,
                participantName: appData.email,
                participantId: appData.participantId,
                ...doc
              })
            }
          })
        })

        setDocuments(fetchedDocuments)
      } catch (error) {
        console.error('Error fetching compliance docs:', error)
        message.error('Failed to load documents.')
      } finally {
        setFormLoading(false)
      }
    }

    fetchDocuments()
  }, [user?.companyCode, selectedStatusFilter]) // 🔁 refetch when filter changes

  const handleSendReminders = async () => {
    const remindersByUser: Record<string, ComplianceDocument[]> = {}

    documents.forEach(doc => {
      const isProblematic = ['missing', 'expired', 'pending'].includes(
        doc.status
      )
      const email = contactInfoMap[doc.participantId]?.email
      if (isProblematic && email) {
        if (!remindersByUser[email]) remindersByUser[email] = []
        remindersByUser[email].push(doc)
      }
    })

    const sendReminder = httpsCallable(functions, 'sendComplianceReminderEmail')

    const promises = Object.entries(remindersByUser).map(
      async ([email, docs]) => {
        const contact = Object.values(contactInfoMap).find(
          c => c.email === email
        )
        const issues = docs.map(d => `${d.type} (${d.status})`)

        try {
          await sendReminder({ email, name: contact.name, issues })
          message.success(`📧 Reminder sent to ${contact.name}`)
        } catch (err) {
          console.error('❌ Email failed:', err)
          message.error(`Failed to send to ${contact.name}`)
        }
      }
    )

    await Promise.all(promises)
  }

  // Show add/edit document modal
  const showModal = (document?: ComplianceDocument) => {
    if (document) {
      setSelectedDocument(document)
      form.setFieldsValue({
        participantId: document.participantId,
        type: document.type,
        status: document.status,
        issueDate: document.issueDate ? moment(document.issueDate) : null,
        expiryDate: document.expiryDate ? moment(document.expiryDate) : null,
        notes: document.notes
      })
    } else {
      setSelectedDocument(null)
      form.resetFields()
    }
    setIsModalVisible(true)
  }

  const continueSaving = async (fileUrl: string) => {
    try {
      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('participantId', '==', form.getFieldValue('participantId')),
          where('companyCode', '==', user?.companyCode)
        )
      )

      if (appSnap.empty) {
        message.error('Application not found for this participant.')
        return
      }

      const applicationDoc = appSnap.docs[0]
      const applicationId = applicationDoc.id
      const applicationData = applicationDoc.data()

      const complianceDocuments: ComplianceDocument[] =
        applicationData.complianceDocuments || []

      const newDoc: ComplianceDocument = {
        id: selectedDocument?.id || `d${Date.now()}`,
        participantId: form.getFieldValue('participantId'),
        participantName:
          contactInfoMap[form.getFieldValue('participantId')]?.name || '',
        type: form.getFieldValue('type'),
        documentName: form.getFieldValue('documentName'),
        status: form.getFieldValue('status'),
        issueDate: form.getFieldValue('issueDate')?.format('YYYY-MM-DD') || '',
        expiryDate:
          form.getFieldValue('expiryDate')?.format('YYYY-MM-DD') || '',
        notes: form.getFieldValue('notes'),
        fileUrl,
        uploadedBy: user?.name || 'Unknown',
        uploadedAt: new Date().toISOString().split('T')[0],
        lastVerifiedBy: selectedDocument?.lastVerifiedBy,
        lastVerifiedAt: selectedDocument?.lastVerifiedAt
      }

      let updatedDocs

      if (selectedDocument) {
        updatedDocs = complianceDocuments.map(doc =>
          doc.id === selectedDocument.id ? newDoc : doc
        )
      } else {
        updatedDocs = [...complianceDocuments, newDoc]
      }

      await updateDoc(doc(db, 'applications', applicationId), {
        complianceDocuments: updatedDocs
      })

      setDocuments(prev =>
        selectedDocument
          ? prev.map(doc => (doc.id === selectedDocument.id ? newDoc : doc))
          : [...prev, newDoc]
      )

      message.success(selectedDocument ? 'Document updated' : 'Document added')
      setUploadingFile(null)
      setIsModalVisible(false)
      form.resetFields()
    } catch (error) {
      console.error('Error saving document:', error)
      message.error('❌ Failed to update application.')
    }
  }

  // Handle form submission
  const handleSubmit = async (values: any) => {
    try {
      let fileUrl = selectedDocument?.fileUrl || ''

      if (uploadingFile) {
        setIsUploading(true)
        const storageRef = ref(
          storage,
          `compliance-documents/${Date.now()}-${uploadingFile.name}`
        )

        const uploadTask = uploadBytesResumable(storageRef, uploadingFile)

        uploadTask.on(
          'state_changed',
          snapshot => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            setUploadPercent(Math.round(progress))
          },
          error => {
            console.error('Upload error:', error)
            message.error('Upload failed.')
            setIsUploading(false)
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
            fileUrl = downloadURL
            setIsUploading(false)
            setUploadPercent(0)
            await continueSaving(fileUrl) // 👇 continue saving after upload
          }
        )
      } else {
        await continueSaving(fileUrl)
      }
    } catch (error) {
      console.error('Error saving document:', error)
      message.error('Failed to save document.')
    }
  }

  // Handle document verification
  const handleVerifyDocument = async (documentId: string) => {
    try {
      const docRef = doc(db, 'complianceDocuments', documentId)

      await updateDoc(docRef, {
        status: 'valid',
        lastVerifiedBy: 'Current User', // Replace with real user in production
        lastVerifiedAt: new Date().toISOString().split('T')[0]
      })

      const updatedDocuments = documents.map(doc => {
        if (doc.id === documentId) {
          return {
            ...doc,
            status: 'valid',
            lastVerifiedBy: 'Current User',
            lastVerifiedAt: new Date().toISOString().split('T')[0]
          }
        }
        return doc
      })

      setDocuments(updatedDocuments)
      message.success('Document verified successfully')
    } catch (error) {
      console.error('Error verifying document:', error)
      message.error('Failed to verify document.')
    }
  }

  // Show ED Agreement modal for specific participant
  const showEDAgreementModal = (participantId: string) => {
    const participant = {
      id: participantId,
      ...contactInfoMap[participantId]
    }

    setSelectedParticipant(participant)
    setIsEDAgreementModalVisible(true)
  }

  // Handle saving the new ED Agreement
  const handleSaveEDAgreement = (document: ComplianceDocument) => {
    setDocuments([...documents, document])
  }

  // Search functionality
  const filteredDocuments = searchText
    ? documents.filter(doc => {
        const docTypeLabel =
          documentTypes.find(t => t.value === doc.type || t.label === doc.type)
            ?.label || ''

        return (
          doc.participantName
            .toLowerCase()
            .includes(searchText.toLowerCase()) ||
          doc.type.toLowerCase().includes(searchText.toLowerCase()) ||
          docTypeLabel.toLowerCase().includes(searchText.toLowerCase())
        )
      })
    : documents

  // Get compliance statistics
  const complianceStats = {
    total: documents.length,
    valid: documents.filter(doc => doc.status === 'valid').length,
    expiring: documents.filter(doc => doc.status === 'expiring').length,
    expired: documents.filter(doc => doc.status === 'expired').length,
    missing: documents.filter(doc => doc.status === 'missing').length,
    pending: documents.filter(doc => doc.status === 'pending').length
  }

  // Table columns
  const columns: ColumnType<ComplianceDocument>[] = [
    {
      title: 'Participant',
      dataIndex: 'participantName',
      key: 'participantName',
      sorter: (a: ComplianceDocument, b: ComplianceDocument) =>
        a.participantName.localeCompare(b.participantName)
    },
    {
      title: 'Document Type',
      dataIndex: 'type',
      key: 'type',
      render: (value: string) =>
        documentTypes.find(t => t.value === value || t.label === value)
          ?.label || value,
      filters: documentTypes.map(type => ({
        text: type.label,
        value: type.value
      })),
      onFilter: (value: any, record: ComplianceDocument) =>
        record.type === value
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = documentStatuses.find(s => s.value === status)
        return (
          <Tag color={statusConfig?.color || 'default'}>
            {statusConfig?.label || status}
          </Tag>
        )
      },
      filters: documentStatuses.map(status => ({
        text: status.label,
        value: status.value
      })),
      onFilter: (value: any, record: ComplianceDocument) =>
        record.status === value
    },
    {
      title: 'Expiry Date',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (date: any) =>
        date?.toDate
          ? moment(date.toDate()).format('DD MMM YYYY')
          : moment(date).format('DD MMM YYYY'),
      sorter: (a: ComplianceDocument, b: ComplianceDocument) =>
        moment(a.expiryDate).unix() - moment(b.expiryDate).unix()
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ComplianceDocument) => {
        const contact = contactInfoMap[record.participantId]
        console.log('record.participantId', record.participantId)

        return (
          <Space size='middle'>
            {record.fileUrl && (
              <Tooltip title='View Document'>
                <Button
                  icon={<EyeOutlined />}
                  onClick={() => window.open(record.fileUrl, '_blank')}
                  type='text'
                />
              </Tooltip>
            )}
            {['missing', 'expired', 'pending'].includes(
              record.status.toLowerCase()
            ) &&
              contact && (
                <Tooltip title='Contact Participant'>
                  <Button
                    icon={<UserOutlined />}
                    type='text'
                    onClick={() => {
                      Modal.info({
                        title: `Contact ${contact.name}`,
                        content: (
                          <div>
                            <p>
                              <strong>Email:</strong> {contact.email}
                            </p>
                            <p>
                              <strong>Phone:</strong> {contact.phone || 'N/A'}
                            </p>
                          </div>
                        ),
                        okText: 'Close'
                      })
                    }}
                  />
                </Tooltip>
              )}
          </Space>
        )
      }
    }
  ] as const

  return (
    <Layout style={{ minHeight: '100vh', background: '#fff' }}>
      <Helmet>
        <title>Compliance Management | Smart Incubation</title>
      </Helmet>

      <Alert
        message='Compliance Document Tracking'
        description='Track and manage compliance documents for participants. You can send reminders to all users or to a specific user to prompt them to upload the required documents.'
        type='info'
        showIcon
        closable
        style={{ marginBottom: 16 }}
      />

      {/* Statistics Cards */}

      <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
        {[
          {
            title: 'Documents',
            value: complianceStats.total,
            color: '#1890ff',
            icon: <SafetyCertificateOutlined />,
            bgColor: '#e6f7ff'
          },
          {
            title: 'Valid',
            value: complianceStats.valid,
            color: '#52c41a',
            icon: <CheckCircleOutlined />,
            bgColor: '#f6ffed'
          },
          {
            title: 'Expiring',
            value: complianceStats.expiring,
            color: '#faad14',
            icon: <WarningOutlined />,
            bgColor: '#fffbe6'
          },
          {
            title: 'Expired',
            value: complianceStats.expired,
            color: '#f5222d',
            icon: <CloseCircleOutlined />,
            bgColor: '#fff2f0'
          },
          {
            title: 'Missing',
            value: complianceStats.missing,
            color: '#fa541c',
            icon: <WarningOutlined />,
            bgColor: '#fff2e8'
          },
          {
            title: 'Pending',
            value: complianceStats.pending,
            color: '#1890ff',
            icon: <FileTextOutlined />,
            bgColor: '#e6f7ff'
          }
        ].map((metric, index) => (
          <Col xs={24} sm={12} md={8} lg={4} key={metric.title}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card
                loading={loading}
                hoverable
                style={{
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #bae7ff',
                  padding: '12px',
                  height: '100%',
                  minHeight: '120px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      background: metric.bgColor,
                      padding: 8,
                      borderRadius: '50%',
                      marginRight: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {React.cloneElement(metric.icon, {
                      style: { fontSize: 16, color: metric.color }
                    })}
                  </div>
                  <Text strong style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
                    {metric.title}
                  </Text>
                </div>
                <Title
                  level={4}
                  style={{
                    margin: '8px 0 0 0',
                    color: metric.color,
                    textAlign: 'right'
                  }}
                >
                  {metric.value}
                </Title>
              </Card>
            </motion.div>
          </Col>
        ))}
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
            border: '1px solid #d6e4ff',
            marginBottom: 10
          }}
        >
          <Row justify='space-between' align='middle' gutter={[16, 16]}>
            {/* Left side: Search + Status Filter */}
            <Col>
              <Space>
                <Input
                  placeholder='Search documents or participants'
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  style={{ width: 300 }}
                  prefix={<SearchOutlined />}
                />

                <Select
                  placeholder='Filter by Status'
                  allowClear
                  style={{ width: 200 }}
                  onChange={value => setSelectedStatusFilter(value || null)}
                >
                  {documentStatuses.map(status => (
                    <Option key={status.value} value={status.value}>
                      {status.label}
                    </Option>
                  ))}
                </Select>
              </Space>
            </Col>

            {/* Right side: Buttons */}
            <Col>
              <Space>
                <Button
                  type='primary'
                  icon={<PlusOutlined />}
                  onClick={() => showModal()}
                >
                  Add New Document
                </Button>

                <Button
                  icon={<FileAddOutlined />}
                  onClick={() => setIsEDAgreementModalVisible(true)}
                >
                  Generate ED Agreement
                </Button>

                <Button
                  type='default'
                  icon={<UserOutlined />}
                  onClick={handleSendReminders}
                >
                  Send Email Reminders
                </Button>
              </Space>
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
          loading={formLoading}
        >
          <Table
            columns={columns}
            dataSource={filteredDocuments}
            rowKey='id'
            loading={formLoading}
            expandable={{
              expandedRowRender: record => (
                <div style={{ padding: '0 20px' }}>
                  <p>
                    <strong>Expiry Date:</strong> {record.expiryDate || 'N/A'}
                  </p>
                  {record.notes && (
                    <p>
                      <strong>Notes:</strong> {record.notes}
                    </p>
                  )}
                  <p>
                    <strong>Uploaded By:</strong> {record.uploadedBy} on{' '}
                    {record.uploadedAt}
                  </p>
                  {record.lastVerifiedBy && (
                    <p>
                      <strong>Last Verified By:</strong> {record.lastVerifiedBy}{' '}
                      on {record.lastVerifiedAt}
                    </p>
                  )}
                </div>
              )
            }}
          />
        </Card>
      </motion.div>

      {/* Add/Edit Document Modal */}
      <Modal
        title={selectedDocument ? 'Edit Document' : 'Add New Document'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form form={form} layout='vertical' onFinish={handleSubmit}>
          <Form.Item
            name='participantId'
            label='Participant'
            rules={[{ required: true, message: 'Please select a participant' }]}
          >
            <Select placeholder='Select a participant'>
              {Object.entries(contactInfoMap).map(([id, info]) => (
                <Option key={id} value={id}>
                  {info.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name='type'
            label='Document Type'
            rules={[
              { required: true, message: 'Please select a document type' }
            ]}
          >
            <Select placeholder='Select document type'>
              {documentTypes.map(type => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name='documentName'
            label='Document Name'
            rules={[
              { required: true, message: 'Please enter a document name' }
            ]}
          >
            <Input placeholder='Enter document name' />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name='issueDate' label='Issue Date'>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name='expiryDate' label='Expiry Date'>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name='status'
            label='Status'
            rules={[{ required: true, message: 'Please select a status' }]}
          >
            <Select placeholder='Select status'>
              {documentStatuses.map(status => (
                <Option key={status.value} value={status.value}>
                  {status.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name='notes' label='Notes'>
            <TextArea rows={4} placeholder='Enter notes about this document' />
          </Form.Item>

          <Form.Item label='Document File'>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>Upload Document</Button>
            </Upload>
            {selectedDocument?.fileUrl && (
              <div style={{ marginTop: '10px' }}>
                <Text>Current file: </Text>
                <Button
                  type='link'
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    window.open(selectedDocument.fileUrl, '_blank')
                  }
                >
                  View Document
                </Button>
              </div>
            )}
          </Form.Item>

          {isUploading && (
            <div style={{ marginBottom: 16 }}>
              <p>Uploading: {uploadPercent}%</p>
              <Progress percent={uploadPercent} />
            </div>
          )}

          <div style={{ textAlign: 'right' }}>
            <Button
              onClick={() => setIsModalVisible(false)}
              style={{ marginRight: 8 }}
            >
              Cancel
            </Button>
            <Button type='primary' htmlType='submit' disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Save'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ED Agreement Modal */}
      <EDAgreementModal
        visible={isEDAgreementModalVisible}
        onCancel={() => setIsEDAgreementModalVisible(false)}
        participant={selectedParticipant}
        onSave={handleSaveEDAgreement}
      />
    </Layout>
  )
}

export default OperationsCompliance
