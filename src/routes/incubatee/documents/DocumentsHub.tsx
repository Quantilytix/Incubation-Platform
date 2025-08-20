import React, { useEffect, useState } from 'react'
import {
  Card,
  Typography,
  Tag,
  Table,
  Upload,
  Button,
  message,
  Layout,
  Space,
  Modal,
  Select,
  Alert,
  Col,
  Row,
  Divider,
  Tooltip
} from 'antd'
import {
  UploadOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { onAuthStateChanged, getAuth } from 'firebase/auth'
// + Firestore & Storage
import {
  getDoc,
  updateDoc,
  serverTimestamp,
  DocumentReference,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Helmet } from 'react-helmet'
import { db } from '@/firebase'
import moment from 'moment'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

const documentTypes = [
  'Certified ID Copy',
  'Proof of Address',
  'B-BBEE Certificate',
  'Tax PIN',
  'CIPC',
  'Management Accounts',
  'Three Months Bank Statements'
]

export const DocumentHub: React.FC = () => {
  const [complianceDocs, setComplianceDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [missingCount, setMissingCount] = useState(0)
  const [expiredCount, setExpiredCount] = useState(0)
  const [validCount, setValidCount] = useState(0)
  const [missingDocsList, setMissingDocsList] = useState<string[]>([])

  const [isModalVisible, setIsModalVisible] = useState(false)
  const [selectedType, setSelectedType] = useState('')
  const [uploadFile, setUploadFile] = useState<any>(null)

  const [appRef, setAppRef] = useState<DocumentReference | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)

  useEffect(() => {
    const auth = getAuth()
    setLoading(true)

    const unsub = onAuthStateChanged(auth, async user => {
      try {
        if (!user) {
          setComplianceDocs([])
          setMissingCount(documentTypes.length)
          setExpiredCount(0)
          setValidCount(0)
          return
        }

        const participantSnap = await getDocs(
          query(
            collection(db, 'participants'),
            where('email', '==', user.email)
          )
        )
        if (participantSnap.empty) {
          setComplianceDocs([])
          setMissingCount(documentTypes.length)
          return
        }

        const participantId = participantSnap.docs[0].id
        const appSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('participantId', '==', participantId)
          )
        )
        if (appSnap.empty) {
          setComplianceDocs([])
          setMissingCount(documentTypes.length)
          return
        }

        const appData = appSnap.docs[0].data()
        const docsRaw = appData.complianceDocuments || []
        const docs = Array.isArray(docsRaw) ? docsRaw : Object.values(docsRaw)

        // after appSnap = await getDocs(...)
        const appDoc = appSnap.docs[0]
        setAppRef(appDoc.ref)
        setParticipantId(participantId) // you already computed this above

        const presentTypes = docs.map((d: any) => d.type)
        const statusOf = (s: any) => (s || 'missing').toString().toLowerCase()
        const hasFileForType = (type: string) =>
          docs.some(d => d.type === type && !!(d.url || d.link || d.fileUrl))

        const isExplicitMissing = (type: string) =>
          docs.some(d => d.type === type && statusOf(d.status) === 'missing')

        // Missing if no file OR explicitly marked missing
        const missingTypes = documentTypes.filter(
          dt => !hasFileForType(dt) || isExplicitMissing(dt)
        )

        setMissingDocsList(missingTypes)
        setMissingCount(missingTypes.length)

        let expired = 0,
          valid = 0
        const normalizedDocs = docs.map((doc: any, index: number) => {
          const statusLower = (doc.status || 'missing').toString().toLowerCase()
          const expiryDate = formatExpiryDate(doc.expiryDate)
          const isExpired =
            (expiryDate !== '—' && moment(expiryDate).isBefore(moment())) ||
            statusLower === 'expired'

          if (isExpired) expired++
          else if (['valid', 'approved'].includes(statusLower)) valid++

          return {
            key: `${doc.type}-${index}`,
            type: doc.type,
            status: statusLower,
            expiry: expiryDate,
            url: doc.url || doc.link || doc.fileUrl || null,
            fileName: doc.fileName || null
          }
        })

        setExpiredCount(expired)
        setValidCount(valid)
        setComplianceDocs(normalizedDocs)
      } catch (e) {
        console.error(e)
        message.error('Failed to load documents')
      } finally {
        setLoading(false)
      }
    })

    return () => unsub()
  }, [])

  const formatExpiryDate = (expiry: any) => {
    if (!expiry) return '—'

    // Firestore Timestamp (with toDate())
    if (expiry?.toDate && typeof expiry.toDate === 'function') {
      return moment(expiry.toDate()).format('YYYY-MM-DD')
    }

    // Firestore { seconds, nanoseconds } shape
    if (typeof expiry === 'object' && typeof expiry?.seconds === 'number') {
      const d = new Date(expiry.seconds * 1000)
      return isNaN(d.getTime()) ? '—' : moment(d).format('YYYY-MM-DD')
    }

    // moment()
    if (moment.isMoment(expiry)) {
      return expiry.isValid() ? expiry.format('YYYY-MM-DD') : '—'
    }

    // dayjs()
    if (typeof dayjs.isDayjs === 'function' && dayjs.isDayjs(expiry)) {
      return expiry.isValid()
        ? moment(expiry.toDate()).format('YYYY-MM-DD')
        : '—'
    }

    // Native Date
    if (expiry instanceof Date && !isNaN(expiry.getTime())) {
      return moment(expiry).format('YYYY-MM-DD')
    }

    // Number (ms or seconds)
    if (typeof expiry === 'number') {
      const ms = expiry.toString().length === 10 ? expiry * 1000 : expiry
      return moment(ms).isValid() ? moment(ms).format('YYYY-MM-DD') : '—'
    }

    // String (trim + strict parse across common formats & ISO)
    if (typeof expiry === 'string') {
      const s = expiry.trim()
      const m = moment(
        s,
        [
          moment.ISO_8601,
          'YYYY-MM-DD',
          'YYYY/MM/DD',
          'DD/MM/YYYY',
          'MM/DD/YYYY'
        ],
        true // strict
      )
      if (m.isValid()) return m.format('YYYY-MM-DD')

      // last-resort parse
      const d = new Date(s)
      return isNaN(d.getTime()) ? '—' : moment(d).format('YYYY-MM-DD')
    }

    return '—'
  }

  const getStatusTag = (status: string) => {
    const s = (status || '').toLowerCase()
    const colorMap: any = {
      valid: 'green',
      approved: 'blue',
      expired: 'orange',
      missing: 'red',
      pending: 'gold',
      rejected: 'volcano'
    }
    return <Tag color={colorMap[s] || 'default'}>{s.toUpperCase() || '—'}</Tag>
  }

  async function uploadComplianceDoc (type: string, file: File) {
    if (!appRef || !participantId) {
      message.error('Cannot upload: missing app reference.')
      return
    }

    // 1) Upload to Storage
    const storage = getStorage()
    const safeType = type.replace(/[^\w-]+/g, '_')
    const path = `compliance/${participantId}/${safeType}/${Date.now()}_${
      file.name
    }`
    const sref = ref(storage, path)
    await uploadBytes(sref, file)
    const url = await getDownloadURL(sref)

    // 2) Merge into complianceDocuments array (replace existing type if present)
    const snap = await getDoc(appRef)
    const data = snap.data() || {}
    const current = Array.isArray(data.complianceDocuments)
      ? data.complianceDocuments
      : Array.isArray(Object.values(data.complianceDocuments || {}))
      ? Object.values(data.complianceDocuments || {})
      : []

    const next = [...current]
    const idx = next.findIndex((d: any) => d?.type === type)
    const newEntry = {
      ...(idx >= 0 ? next[idx] : {}),
      type,
      status: 'pending', // or 'uploaded'
      url,
      fileName: file.name,
      uploadedAt: serverTimestamp()
    }
    if (idx >= 0) next[idx] = newEntry
    else next.push(newEntry)

    await updateDoc(appRef, { complianceDocuments: next })
    message.success(`Uploaded ${type} successfully`)
  }

  const columns = [
    { title: 'Document Type', dataIndex: 'type', key: 'type' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag
    },
    { title: 'Expiry Date', dataIndex: 'expiry', key: 'expiry' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          {record.url ? (
            <Tooltip title='Open current file'>
              <Button
                type='text'
                shape='circle'
                icon={<EyeOutlined />}
                onClick={() =>
                  window.open(record.url, '_blank', 'noopener,noreferrer')
                }
              />
            </Tooltip>
          ) : (
            <Tooltip title='No file uploaded yet'>
              <Button
                type='text'
                shape='circle'
                icon={<EyeOutlined />}
                disabled
              />
            </Tooltip>
          )}

          <Upload
            beforeUpload={async file => {
              message.loading({
                content: `Uploading ${file.name}...`,
                key: record.key
              })
              try {
                await uploadComplianceDoc(record.type, file)
                message.success({ content: 'Upload complete', key: record.key })
                // optionally re-fetch list or update state locally
              } catch (e) {
                console.error(e)
                message.error({ content: 'Upload failed', key: record.key })
              }
              return false // keep preventing auto-upload
            }}
            showUploadList={false}
            maxCount={1}
          >
            <Tooltip title='Replace document'>
              <Button type='text' shape='circle' icon={<UploadOutlined />} />
            </Tooltip>
          </Upload>
        </Space>
      )
    }
  ]

  const handleAddNew = async () => {
    if (!selectedType || !uploadFile) {
      message.error('Please select a type and file.')
      return
    }
    try {
      await uploadComplianceDoc(selectedType, uploadFile as File)
      setIsModalVisible(false)
      setSelectedType('')
      setUploadFile(null)
    } catch (e) {
      console.error(e)
      message.error('Failed to upload document.')
    }
  }

  if (loading) {
    return (
      <Layout style={{ background: '#fff', minHeight: '100vh', padding: 24 }}>
        <Helmet>
          <title>Documents Tracking</title>
        </Helmet>

        <Alert
          type='info'
          showIcon
          message='Checking document statuses…'
          description='Hang tight while we load your compliance documents.'
          style={{ marginBottom: 16 }}
        />

        <Card
          loading
          style={{ borderRadius: 8, border: '1px solid #d6e4ff' }}
        />
        <div style={{ height: 16 }} />
        <Card
          loading
          style={{ borderRadius: 8, border: '1px solid #d6e4ff' }}
        />
      </Layout>
    )
  }

  return (
    <Layout style={{ background: '#fff', minHeight: '100vh', padding: 24 }}>
      <Helmet>
        <title>Documents Tracking</title>
      </Helmet>

      {/* Informational alert */}
      <Alert
        type='info'
        showIcon
        message='Upload your compliance documents here'
        description='To proceed in the program, please upload all required documents. You can drag & drop files or use the upload button. Expired or invalid documents should be replaced.'
        style={{ marginBottom: 16 }}
      />

      {/* Metrics row (full width, responsive) */}
      <Row gutter={[16, 16]} style={{ width: '100%', marginBottom: 24 }}>
        <Col xs={24} md={8}>
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
                height: '100%'
              }}
            >
              <Space align='center'>
                <CheckCircleOutlined style={{ fontSize: 24, color: 'green' }} />
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    {validCount}
                  </Title>
                  <Text type='secondary'>Valid</Text>
                </div>
              </Space>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} md={8}>
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
                height: '100%'
              }}
            >
              <Space align='center'>
                <ExclamationCircleOutlined
                  style={{ fontSize: 24, color: 'red' }}
                />
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    {missingCount ? missingCount : missingDocsList.length}
                  </Title>
                  <Text>Unsubmitted</Text>
                </div>
              </Space>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} md={8}>
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
                height: '100%'
              }}
            >
              <Space align='center'>
                <ClockCircleOutlined
                  style={{ fontSize: 24, color: 'orange' }}
                />
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    {expiredCount}
                  </Title>
                  <Text type='warning'>Expired</Text>
                </div>
              </Space>
            </Card>
          </motion.div>
        </Col>
      </Row>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 12
        }}
      >
        <Divider>Compliance Documents</Divider>
      </div>

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
          extra={
            <Button
              type='primary'
              icon={<PlusOutlined />}
              onClick={() => setIsModalVisible(true)}
            >
              Add New Document
            </Button>
          }
        >
          <Table
            columns={columns}
            dataSource={complianceDocs}
            loading={loading}
            pagination={false}
          />
        </Card>
      </motion.div>

      <Modal
        title='Upload New Document'
        open={isModalVisible}
        onOk={handleAddNew}
        onCancel={() => setIsModalVisible(false)}
        okText='Upload'
      >
        <Space direction='vertical' style={{ width: '100%' }}>
          <div>
            <Text strong>Document Type</Text>
            <Select
              placeholder='Select document type'
              style={{ width: '100%', marginTop: 4 }}
              value={selectedType}
              onChange={setSelectedType}
            >
              {missingDocsList.map(type => (
                <Option key={type} value={type}>
                  {type}
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <Text strong>Upload File</Text>
            <Upload
              beforeUpload={file => {
                setUploadFile(file)
                return false
              }}
              maxCount={1}
              style={{ marginTop: 4 }}
            >
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </div>
        </Space>
      </Modal>
    </Layout>
  )
}
