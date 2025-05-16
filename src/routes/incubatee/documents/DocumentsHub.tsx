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
  Select
} from 'antd'
import {
  UploadOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { onAuthStateChanged, getAuth } from 'firebase/auth'
import { Helmet } from 'react-helmet'
import { db } from '@/firebase'
import moment from 'moment'

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
  const [invalidCount, setInvalidCount] = useState(0)
  const [missingDocsList, setMissingDocsList] = useState<string[]>([])

  const [isModalVisible, setIsModalVisible] = useState(false)
  const [selectedType, setSelectedType] = useState('')
  const [uploadFile, setUploadFile] = useState<any>(null)

  useEffect(() => {
    const fetchDocuments = async () => {
      const auth = getAuth()
      onAuthStateChanged(auth, async user => {
        if (!user) return

        const participantSnap = await getDocs(
          query(
            collection(db, 'participants'),
            where('email', '==', user.email)
          )
        )

        if (participantSnap.empty) return

        const participantId = participantSnap.docs[0].id

        const appSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('participantId', '==', participantId)
          )
        )

        if (appSnap.empty) return

        const appData = appSnap.docs[0].data()
        const docs = appData.complianceDocuments || []

        const now = moment()
        let missing = 0
        let expired = 0
        let invalid = 0

        const presentTypes = docs.map((doc: any) => doc.type)
        const missingTypes = documentTypes.filter(
          dt => !presentTypes.includes(dt)
        )
        setMissingDocsList(missingTypes)

        const normalizedDocs = docs.map((doc: any, index: number) => {
          const expiryDate = formatExpiryDate(doc.expiryDate)
          const isExpired =
            (expiryDate !== '—' && moment(expiryDate).isBefore(moment())) ||
            doc.status === 'expired'

          if (!doc.status || doc.status === 'missing') {
            missing++
          } else if (isExpired) {
            expired++
          } else if (
            !['valid', 'approved'].includes(doc.status?.toLowerCase())
          ) {
            invalid++
          }

          return {
            key: `${doc.type}-${index}`, // unique key
            type: doc.type,
            status: doc.status || 'missing',
            expiry: expiryDate
          }
        })

        setMissingCount(missing)
        setExpiredCount(expired)
        setInvalidCount(invalid)
        setComplianceDocs(normalizedDocs)
        setLoading(false)
      })
    }

    fetchDocuments()
  }, [])

  const formatExpiryDate = (expiry: any) => {
    if (!expiry) return '—'
    if (expiry.toDate && typeof expiry.toDate === 'function') {
      return moment(expiry.toDate()).format('YYYY-MM-DD')
    }
    if (expiry instanceof Date) {
      return moment(expiry).format('YYYY-MM-DD')
    }
    return '—'
  }

  const getStatusTag = (status: string) => {
    const colorMap: any = {
      valid: 'green',
      approved: 'blue',
      expired: 'orange',
      missing: 'red',
      pending: 'gold',
      rejected: 'volcano'
    }
    return (
      <Tag color={colorMap[status] || 'default'}>{status.toUpperCase()}</Tag>
    )
  }

  const columns = [
    {
      title: 'Document Type',
      dataIndex: 'type',
      key: 'type'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag
    },
    {
      title: 'Expiry Date',
      dataIndex: 'expiry',
      key: 'expiry'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Upload
          beforeUpload={() => false}
          multiple={false}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />}>Replace</Button>
        </Upload>
      )
    }
  ]

  const handleAddNew = () => {
    if (!selectedType || !uploadFile) {
      message.error('Please select a type and file.')
      return
    }

    // Mock handler – replace with upload logic
    message.success(`Uploaded ${selectedType} successfully`)
    setIsModalVisible(false)
    setSelectedType('')
    setUploadFile(null)
  }

  return (
    <Layout style={{ background: '#fff', minHeight: '100vh', padding: 24 }}>
      <Helmet>
        <title>Documents Tracking</title>
      </Helmet>

      <Title level={3}>Document Compliance Tracker</Title>

      <Space size='middle' style={{ marginBottom: 24, flexWrap: 'wrap' }}>
        <Card style={{ minWidth: 200 }}>
          <Space direction='horizontal' align='center'>
            <ExclamationCircleOutlined style={{ fontSize: 24, color: 'red' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {missingCount ? missingCount : missingDocsList.length}
              </Title>
              <Text>Unsubmitted</Text>
            </div>
          </Space>
        </Card>

        <Card style={{ minWidth: 200 }}>
          <Space direction='horizontal' align='center'>
            <ClockCircleOutlined style={{ fontSize: 24, color: 'orange' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {expiredCount}
              </Title>
              <Text type='warning'>Expired</Text>
            </div>
          </Space>
        </Card>

        <Card style={{ minWidth: 200 }}>
          <Space direction='horizontal' align='center'>
            <CheckCircleOutlined style={{ fontSize: 24, color: 'volcano' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {invalidCount}
              </Title>
              <Text type='secondary'>Invalid</Text>
            </div>
          </Space>
        </Card>
      </Space>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 12
        }}
      >
        <Title level={4}>Compliance Documents</Title>
        <Button
          type='primary'
          icon={<PlusOutlined />}
          onClick={() => setIsModalVisible(true)}
        >
          Add New Document
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={complianceDocs}
          loading={loading}
          pagination={false}
        />
      </Card>

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
