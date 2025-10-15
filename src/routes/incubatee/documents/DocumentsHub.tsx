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
  Tooltip,
  DatePicker
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
import {
  getDoc,
  updateDoc,
  Timestamp,
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
import dayjs, { Dayjs } from 'dayjs'

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

  // Add New modal (type + file + dates)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [selectedType, setSelectedType] = useState('')
  const [uploadFile, setUploadFile] = useState<any>(null)
  const [issueDateAdd, setIssueDateAdd] = useState<Dayjs | null>(null)
  const [expiryDateAdd, setExpiryDateAdd] = useState<Dayjs | null>(null)

  // Replace flow (row) → choose file, then dates
  const [datesModalOpen, setDatesModalOpen] = useState(false)
  const [pendingReplaceType, setPendingReplaceType] = useState<string>('')
  const [pendingReplaceFile, setPendingReplaceFile] = useState<File | null>(
    null
  )
  const [issueDateReplace, setIssueDateReplace] = useState<Dayjs | null>(null)
  const [expiryDateReplace, setExpiryDateReplace] = useState<Dayjs | null>(null)

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

        const appDoc = appSnap.docs[0]
        const appData = appDoc.data()
        const docsRaw = appData.complianceDocuments || []
        const docs = Array.isArray(docsRaw) ? docsRaw : Object.values(docsRaw)

        setAppRef(appDoc.ref)
        setParticipantId(participantId)

        const statusOf = (s: any) => (s || 'missing').toString().toLowerCase()
        const hasFileForType = (type: string) =>
          docs.some(
            (d: any) => d.type === type && !!(d.url || d.link || d.fileUrl)
          )

        const isExplicitMissing = (type: string) =>
          docs.some(
            (d: any) => d.type === type && statusOf(d.status) === 'missing'
          )

        const missingTypes = documentTypes.filter(
          dt => !hasFileForType(dt) || isExplicitMissing(dt)
        )

        setMissingDocsList(missingTypes)
        setMissingCount(missingTypes.length)

        let expired = 0,
          valid = 0
        const normalizedDocs = docs.map((doc: any, index: number) => {
          const statusLower = (doc.status || 'missing').toString().toLowerCase()
          const expiryDate = formatAnyDate(doc.expiryDate)
          const issueDate = formatAnyDate(doc.issueDate)
          const isExpired =
            (expiryDate !== '—' && moment(expiryDate).isBefore(moment())) ||
            statusLower === 'expired'

          if (isExpired) expired++
          else if (['valid', 'approved'].includes(statusLower)) valid++

          return {
            key: `${doc.type}-${index}`,
            type: doc.type,
            status: statusLower,
            issue: issueDate,
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

  const toTimestamp = (d?: Dayjs | null) =>
    d && d.isValid() ? Timestamp.fromDate(d.toDate()) : undefined

  const formatAnyDate = (val: any) => {
    if (!val) return '—'
    if (val?.toDate && typeof val.toDate === 'function') {
      return moment(val.toDate()).format('YYYY-MM-DD')
    }
    if (typeof val === 'object' && typeof val?.seconds === 'number') {
      const d = new Date(val.seconds * 1000)
      return isNaN(d.getTime()) ? '—' : moment(d).format('YYYY-MM-DD')
    }
    if (moment.isMoment(val))
      return val.isValid() ? val.format('YYYY-MM-DD') : '—'
    if (typeof dayjs.isDayjs === 'function' && dayjs.isDayjs(val))
      return val.isValid() ? moment(val.toDate()).format('YYYY-MM-DD') : '—'
    if (val instanceof Date && !isNaN(val.getTime()))
      return moment(val).format('YYYY-MM-DD')
    if (typeof val === 'number') {
      const ms = val.toString().length === 10 ? val * 1000 : val
      return moment(ms).isValid() ? moment(ms).format('YYYY-MM-DD') : '—'
    }
    if (typeof val === 'string') {
      const s = val.trim()
      const m = moment(
        s,
        [
          moment.ISO_8601,
          'YYYY-MM-DD',
          'YYYY/MM/DD',
          'DD/MM/YYYY',
          'MM/DD/YYYY'
        ],
        true
      )
      if (m.isValid()) return m.format('YYYY-MM-DD')
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

  // ⬇️ now accepts issue/expiry
  async function uploadComplianceDoc (
    type: string,
    file: File,
    issue?: Dayjs | null,
    expiry?: Dayjs | null
  ) {
    if (!appRef || !participantId) {
      message.error('Cannot upload: missing app reference.')
      return null
    }
    const storage = getStorage()
    const safeType = type.replace(/[^\w-]+/g, '_')
    const path = `compliance/${participantId}/${safeType}/${Date.now()}_${
      file.name
    }`
    const sref = ref(storage, path)
    await uploadBytes(sref, file)
    const url = await getDownloadURL(sref)

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
      status: 'pending',
      url,
      fileName: file.name,
      uploadedAt: Timestamp.now(),
      // ✅ new:
      issueDate: toTimestamp(issue),
      expiryDate: toTimestamp(expiry)
    }
    if (idx >= 0) next[idx] = newEntry
    else next.push(newEntry)

    await updateDoc(appRef, { complianceDocuments: next })
    message.success(`Uploaded ${type} successfully`)
    return newEntry
  }

  const columns = [
    { title: 'Document Type', dataIndex: 'type', key: 'type' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag
    },
    { title: 'Issue Date', dataIndex: 'issue', key: 'issue' },
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

          {/* Replace → capture dates before uploading */}
          <Upload
            beforeUpload={async file => {
              // Hold file + type, open dates modal
              setPendingReplaceType(record.type)
              setPendingReplaceFile(file as File)
              setIssueDateReplace(null)
              setExpiryDateReplace(null)
              setDatesModalOpen(true)
              return false
            }}
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
      const entry = await uploadComplianceDoc(
        selectedType,
        uploadFile as File,
        issueDateAdd,
        expiryDateAdd
      )
      if (entry) {
        setComplianceDocs(prev => {
          const exists = prev.some(d => d.type === selectedType)
          const row = {
            key: `${selectedType}-${Date.now()}`,
            type: selectedType,
            status: entry.status || 'pending',
            issue: formatAnyDate(issueDateAdd),
            expiry: formatAnyDate(expiryDateAdd),
            url: entry.url,
            fileName: entry.fileName || null
          }
          return exists
            ? prev.map(d => (d.type === selectedType ? { ...d, ...row } : d))
            : [...prev, row]
        })
        setMissingDocsList(prev => prev.filter(t => t !== selectedType))
      }

      setIsModalVisible(false)
      setSelectedType('')
      setUploadFile(null)
      setIssueDateAdd(null)
      setExpiryDateAdd(null)
    } catch (e) {
      console.error(e)
      message.error('Failed to upload document.')
    }
  }

  const confirmReplaceUpload = async () => {
    if (!pendingReplaceType || !pendingReplaceFile) {
      setDatesModalOpen(false)
      return
    }
    message.loading({
      content: `Uploading ${pendingReplaceFile.name}...`,
      key: 'replace'
    })
    try {
      const entry = await uploadComplianceDoc(
        pendingReplaceType,
        pendingReplaceFile,
        issueDateReplace,
        expiryDateReplace
      )
      if (entry) {
        setComplianceDocs(prev =>
          prev.map(d =>
            d.type === pendingReplaceType
              ? {
                  ...d,
                  ...entry,
                  status: entry.status || d.status,
                  issue: formatAnyDate(issueDateReplace),
                  expiry: formatAnyDate(expiryDateReplace)
                }
              : d
          )
        )
        setMissingDocsList(prev => prev.filter(t => t !== pendingReplaceType))
      }
      message.success({ content: 'Upload complete', key: 'replace' })
    } catch (e) {
      console.error(e)
      message.error({ content: 'Upload failed', key: 'replace' })
    } finally {
      setDatesModalOpen(false)
      setPendingReplaceType('')
      setPendingReplaceFile(null)
      setIssueDateReplace(null)
      setExpiryDateReplace(null)
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

      <Alert
        type='info'
        showIcon
        message='Upload your compliance documents here'
        description='To proceed in the program, please upload all required documents. Provide the issue and expiry dates where applicable.'
        style={{ marginBottom: 16 }}
      />

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

      {/* Add New Document Modal (with dates) */}
      <Modal
        title='Upload New Document'
        open={isModalVisible}
        onOk={handleAddNew}
        onCancel={() => {
          setIsModalVisible(false)
          setSelectedType('')
          setUploadFile(null)
          setIssueDateAdd(null)
          setExpiryDateAdd(null)
        }}
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

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Text strong>Issue Date</Text>
              <DatePicker
                style={{ width: '100%', marginTop: 4 }}
                value={issueDateAdd}
                onChange={setIssueDateAdd}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Text strong>Expiry Date</Text>
              <DatePicker
                style={{ width: '100%', marginTop: 4 }}
                value={expiryDateAdd}
                onChange={setExpiryDateAdd}
              />
            </div>
          </div>

          <div>
            <Text strong style={{ marginRight: 10 }}>
              Upload File
            </Text>
            <Upload
              beforeUpload={file => {
                setUploadFile(file)
                return false
              }}
              maxCount={1}
              style={{ marginTop: 4 }}
              fileList={uploadFile ? [uploadFile] : []}
              onRemove={() => setUploadFile(null)}
            >
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </div>
        </Space>
      </Modal>

      {/* Replace document → choose dates */}
      <Modal
        title='Set Document Dates'
        open={datesModalOpen}
        onCancel={() => setDatesModalOpen(false)}
        onOk={confirmReplaceUpload}
        okText='Upload'
        destroyOnClose
      >
        <Space direction='vertical' style={{ width: '100%' }}>
          <Text>
            Replacing: <b>{pendingReplaceType || '—'}</b>
          </Text>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Text strong>Issue Date</Text>
              <DatePicker
                style={{ width: '100%', marginTop: 4 }}
                value={issueDateReplace}
                onChange={setIssueDateReplace}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Text strong>Expiry Date</Text>
              <DatePicker
                style={{ width: '100%', marginTop: 4 }}
                value={expiryDateReplace}
                onChange={setExpiryDateReplace}
              />
            </div>
          </div>
        </Space>
      </Modal>
    </Layout>
  )
}
