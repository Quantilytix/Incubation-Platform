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
  Layout
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
  query
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

const { Title, Text } = Typography
const { TabPane } = Tabs
const { Option } = Select
const { TextArea } = Input

// Mock data for participants
const mockParticipants = [
  { id: 'p1', name: 'TechSolutions Inc.' },
  { id: 'p2', name: 'GreenEnergy Startup' },
  { id: 'p3', name: 'HealthTech Innovations' },
  { id: 'p4', name: 'EdTech Solutions' },
  { id: 'p5', name: 'FinTech Revolution' }
]

const OperationsCompliance: React.FC = () => {
  const [documents, setDocuments] = useState<ComplianceDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isEDAgreementModalVisible, setIsEDAgreementModalVisible] =
    useState(false)
  const [selectedDocument, setSelectedDocument] =
    useState<ComplianceDocument | null>(null)
  const storage = getStorage()

  const [selectedParticipant, setSelectedParticipant] = useState<any>(null)
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('1')
  const navigate = useNavigate()
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [uploadPercent, setUploadPercent] = useState<number>(0)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [contactInfoMap, setContactInfoMap] = useState<Record<string, any>>({})

  useEffect(() => {
    const fetchContactInfo = async () => {
      const appsSnap = await getDocs(collection(db, 'applications'))
      const participantsSnap = await getDocs(collection(db, 'participants'))

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

      console.log('ContactInfoMap', contactInfoMap)

      setContactInfoMap(contactMap)
    }

    fetchContactInfo()
  }, [])

  const uploadProps: UploadProps = {
    beforeUpload: file => {
      setUploadingFile(file)
      return false // ❗ Prevent AntD from auto-uploading
    },
    showUploadList: true
  }

  // Load data
  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true)
      try {
        const snapshot = await getDocs(collection(db, 'applications'))
        const fetchedDocuments: ComplianceDocument[] = []

        snapshot.forEach(applicationDoc => {
          const appData = applicationDoc.data()
          const applicantEmail = appData.email
          const complianceDocs = appData.complianceDocuments || []

          complianceDocs.forEach((doc, index) => {
            fetchedDocuments.push({
              id: `${applicationDoc.id}-${index}`,
              participantName: applicantEmail,
              participantId: appData.participantId, // ✅ Add this
              ...doc
            })
          })
        })

        setDocuments(fetchedDocuments)
      } catch (error) {
        console.error(
          'Error fetching compliance docs from participants:',
          error
        )
        message.error('Failed to load documents.')
      } finally {
        setLoading(false)
      }
    }

    fetchDocuments()
  }, [])

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

  const continueSaving = async (url: string) => {
    try {
      const newDocument: ComplianceDocument = {
        id: selectedDocument?.id || `d${Date.now()}`,
        participantId: form.getFieldValue('participantId'),
        participantName:
          mockParticipants.find(
            p => p.id === form.getFieldValue('participantId')
          )?.name || '',
        type: form.getFieldValue('type'),
        documentName: form.getFieldValue('documentName'),
        status: form.getFieldValue('status'),
        issueDate: form.getFieldValue('issueDate')
          ? form.getFieldValue('issueDate').format('YYYY-MM-DD')
          : '',
        expiryDate: form.getFieldValue('expiryDate')
          ? form.getFieldValue('expiryDate').format('YYYY-MM-DD')
          : '',
        notes: form.getFieldValue('notes'),
        url,
        uploadedBy: 'Current User',
        uploadedAt: new Date().toISOString().split('T')[0],
        lastVerifiedBy: selectedDocument?.lastVerifiedBy,
        lastVerifiedAt: selectedDocument?.lastVerifiedAt
      }

      if (selectedDocument) {
        await updateDoc(
          doc(db, 'complianceDocuments', selectedDocument.id),
          newDocument
        )
        setDocuments(prev =>
          prev.map(doc =>
            doc.id === selectedDocument.id
              ? { ...newDocument, id: selectedDocument.id }
              : doc
          )
        )
        message.success('Document updated successfully')
      } else {
        const docRef = await addDoc(
          collection(db, 'complianceDocuments'),
          newDocument
        )
        setDocuments(prev => [...prev, { ...newDocument, id: docRef.id }])
        message.success('Document added successfully')
      }

      setUploadingFile(null)
      setIsModalVisible(false)
      form.resetFields()
    } catch (error) {
      console.error('Error saving document:', error)
      message.error('Failed to save document.')
    }
  }

  // Handle form submission
  const handleSubmit = async (values: any) => {
    try {
      let url = selectedDocument?.url || ''

      // If a new file was selected for upload
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
            // Calculate progress percentage
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
            // Upload completed successfully
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
            url = downloadURL
            setIsUploading(false)
            setUploadPercent(0)
            continueSaving(url) // ➡ continue with saving the document
          }
        )
      } else {
        continueSaving(url) // ➡ no file upload, just save
      }

      const newDocument: ComplianceDocument = {
        id: selectedDocument?.id || `d${Date.now()}`,
        participantId: values.participantId,
        participantName:
          mockParticipants.find(p => p.id === values.participantId)?.name || '',
        type: values.type,
        documentName: values.documentName,
        status: values.status,
        issueDate: values.issueDate
          ? values.issueDate.format('YYYY-MM-DD')
          : '',
        expiryDate: values.expiryDate
          ? values.expiryDate.format('YYYY-MM-DD')
          : '',
        notes: values.notes,
        url, // use uploaded file URL
        uploadedBy: 'Current User',
        uploadedAt: new Date().toISOString().split('T')[0],
        lastVerifiedBy: selectedDocument?.lastVerifiedBy,
        lastVerifiedAt: selectedDocument?.lastVerifiedAt
      }

      if (selectedDocument) {
        await updateDoc(
          doc(db, 'complianceDocuments', selectedDocument.id),
          newDocument
        )
        setDocuments(prev =>
          prev.map(doc =>
            doc.id === selectedDocument.id
              ? { ...newDocument, id: selectedDocument.id }
              : doc
          )
        )
        message.success('Document updated successfully')
      } else {
        const docRef = await addDoc(
          collection(db, 'complianceDocuments'),
          newDocument
        )
        setDocuments(prev => [...prev, { ...newDocument, id: docRef.id }])
        message.success('Document added successfully')
      }

      setUploadingFile(null)
      setIsModalVisible(false)
      form.resetFields()
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
    const participant = mockParticipants.find(p => p.id === participantId)
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
            {record.url && (
              <Tooltip title='View Document'>
                <Button
                  icon={<EyeOutlined />}
                  onClick={() => window.open(record.url, '_blank')}
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

      <Title level={2}>Compliance Management</Title>
      <Text>Track and manage compliance documents for participants.</Text>

      {/* Statistics Cards */}
      <Row
        gutter={[16, 16]}
        style={{ marginTop: '20px', marginBottom: '20px' }}
      >
        <Col span={4}>
          <Card loading={loading}>
            <Statistic
              title='Total Documents'
              value={complianceStats.total}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card loading={loading}>
            <Statistic
              title='Valid'
              value={complianceStats.valid}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card loading={loading}>
            <Statistic
              title='Expiring Soon'
              value={complianceStats.expiring}
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card loading={loading}>
            <Statistic
              title='Expired'
              value={complianceStats.expired}
              valueStyle={{ color: '#f5222d' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card loading={loading}>
            <Statistic
              title='Missing'
              value={complianceStats.missing}
              valueStyle={{ color: '#fa541c' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card loading={loading}>
            <Statistic
              title='Pending Review'
              value={complianceStats.pending}
              valueStyle={{ color: '#1890ff' }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <div
        style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between'
        }}
      >
        <Input
          placeholder='Search documents or participants'
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: '300px' }}
          prefix={<SearchOutlined />}
        />
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
      </div>

      <Card loading={loading}>
        <Table
          columns={columns}
          dataSource={filteredDocuments}
          rowKey='id'
          loading={loading}
          expandable={{
            expandedRowRender: record => (
              <div style={{ padding: '0 20px' }}>
                <p>
                  <strong>Issue Date:</strong> {record.issueDate || 'N/A'}
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
              {mockParticipants.map(participant => (
                <Option key={participant.id} value={participant.id}>
                  {participant.name}
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
            {selectedDocument?.url && (
              <div style={{ marginTop: '10px' }}>
                <Text>Current file: </Text>
                <Button
                  type='link'
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(selectedDocument.url, '_blank')}
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
