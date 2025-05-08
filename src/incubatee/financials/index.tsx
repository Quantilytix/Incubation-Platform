import React, { useEffect, useState } from 'react'
import {
  Typography,
  Card,
  Upload,
  Button,
  DatePicker,
  Select,
  message,
  Space
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDocs, collection, query, where } from 'firebase/firestore'
import { db, auth } from '@/firebase'

const { Title, Paragraph } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

const BASE_URL = 'https://rairo-incu-api.hf.space'

const FinancialReportsInterface = () => {
  const [uploadFiles, setUploadFiles] = useState<any[]>([])
  const [uploadStatus, setUploadStatus] = useState('Idle.')
  const [stmtDateRange, setStmtDateRange] = useState<any>(null)
  const [stmtType, setStmtType] = useState('Income Statement')
  const [stmtStatus, setStmtStatus] = useState('Idle.')
  const [businessId, setBusinessId] = useState<string | null>(null)

  useEffect(() => {
    onAuthStateChanged(auth, async user => {
      if (user?.email) {
        const q = query(
          collection(db, 'participants'),
          where('email', '==', user.email)
        )
        const snap = await getDocs(q)
        if (!snap.empty) {
          const data = snap.docs[0].data()
          setBusinessId(data.id || data.businessId || snap.docs[0].id)
        }
      }
    })
  }, [])

  const handleUpload = async () => {
    if (!businessId || uploadFiles.length === 0) {
      setUploadStatus('Missing files or business ID.')
      return
    }

    const form = new FormData()
    form.append('business_id', businessId)
    uploadFiles.forEach(file => form.append('files', file))

    setUploadStatus('Uploading...')
    try {
      const resp = await fetch(`${BASE_URL}/upload_statements`, {
        method: 'POST',
        body: form
      })
      const data = await resp.json()
      if (!resp.ok) throw data
      setUploadStatus('Success:\n' + JSON.stringify(data, null, 2))
    } catch (err) {
      setUploadStatus('Error:\n' + JSON.stringify(err, null, 2))
    }
  }

  const handleGetStatement = async () => {
    if (!businessId || !stmtDateRange) {
      setStmtStatus('Please select a date range.')
      return
    }

    const [start, end] = stmtDateRange
    const body = {
      business_id: businessId,
      start_date: start.format('YYYY-MM-DD'),
      end_date: end.format('YYYY-MM-DD'),
      statement_type: stmtType
    }

    setStmtStatus('Requesting...')
    try {
      const resp = await fetch(`${BASE_URL}/financial_statement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await resp.json()
      if (!resp.ok) throw data
      setStmtStatus((data.cached ? '[CACHED]\n' : '') + data.report)
    } catch (err) {
      setStmtStatus('Error:\n' + JSON.stringify(err, null, 2))
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Helmet>
        <title>QTX | Financial Statement Portal</title>
        <meta
          name='description'
          content='Upload bank statements and retrieve financial reports.'
        />
      </Helmet>

      <Title level={2} style={{ textAlign: 'center', color: '#004aad' }}>
        Financial Statement Portal
      </Title>
      <Paragraph style={{ textAlign: 'center', marginBottom: 32 }}>
        Securely upload business bank statements and generate AI-based financial
        reports.
      </Paragraph>

      {/* Upload Section */}
      <Card title='1. Upload Bank Statements' style={{ marginBottom: 24 }}>
        <Upload
          beforeUpload={file => {
            setUploadFiles(prev => [...prev, file])
            return false
          }}
          fileList={uploadFiles}
          onRemove={file =>
            setUploadFiles(prev => prev.filter(f => f.uid !== file.uid))
          }
        >
          <Button icon={<UploadOutlined />}>Select PDF(s)</Button>
        </Upload>

        <Button type='primary' onClick={handleUpload} style={{ marginTop: 16 }}>
          Upload & Process
        </Button>

        <Paragraph
          style={{
            marginTop: 16,
            background: '#e8f0fe',
            borderLeft: '4px solid #004aad',
            padding: 12,
            whiteSpace: 'pre-wrap'
          }}
        >
          {uploadStatus}
        </Paragraph>
      </Card>

      {/* Statement Retrieval Section */}
      <Card title='2. Generate Financial Statement'>
        <RangePicker
          style={{ width: '100%', marginBottom: 12 }}
          onChange={setStmtDateRange}
        />
        <Select
          value={stmtType}
          style={{ width: '100%', marginBottom: 12 }}
          onChange={setStmtType}
        >
          <Option>Income Statement</Option>
          <Option>Cashflow Statement</Option>
          <Option>Balance Sheet</Option>
        </Select>
        <Button type='primary' onClick={handleGetStatement}>
          Generate Statement
        </Button>

        <Paragraph
          style={{
            marginTop: 16,
            background: '#e8f0fe',
            borderLeft: '4px solid #004aad',
            padding: 12,
            whiteSpace: 'pre-wrap'
          }}
        >
          {stmtStatus}
        </Paragraph>
      </Card>
    </div>
  )
}

export default FinancialReportsInterface
