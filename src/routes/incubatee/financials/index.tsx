import React, { useEffect, useState } from 'react'
import {
  Typography,
  Card,
  Upload,
  Button,
  DatePicker,
  Select,
  message,
  Space,
  Spin,
  Table,
  Row,
  Col,
  Statistic
} from 'antd'
import {
  UploadOutlined,
  FileSearchOutlined,
  RiseOutlined,
  FallOutlined,
  DollarCircleOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db, auth } from '@/firebase'
import { Tag } from 'antd'

// For Revenue
const revenueColumns = [
  {
    title: 'Source',
    dataIndex: 'name',
    key: 'name',
    render: (text, record) => (
      <>
        {text}{' '}
        {record.type && (
          <Tag color={record.type === 'Income' ? 'green' : 'blue'}>
            {record.type}
          </Tag>
        )}
      </>
    )
  },
  {
    title: 'Amount (ZAR)',
    dataIndex: 'amount',
    key: 'amount'
  }
]
// For Expenses (same structure)
const expenseColumns = [
  {
    title: 'Category',
    dataIndex: 'name',
    key: 'name',
    render: (text, record) => (
      <>
        {text}{' '}
        {record.type && (
          <Tag color={record.type === 'Expense' ? 'red' : 'volcano'}>
            {record.type}
          </Tag>
        )}
      </>
    )
  },
  {
    title: 'Amount (ZAR)',
    dataIndex: 'amount',
    key: 'amount'
  }
]

const { Title, Paragraph, Text } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

const BASE_URL = 'https://rairo-incu-api.hf.space'

const parseFinancialMarkdown = (markdown: string) => {
  const result: any = {
    Revenue: [],
    Expenses: [],
    NetProfit: 0,
    Highlights: '',
    Summary: ''
  }

  const lines = markdown.trim().split('\n')
  let currentSection:
    | 'Revenue'
    | 'Expenses'
    | 'NetProfit'
    | 'Highlights'
    | 'Summary'
    | null = null
  let capturingText = false
  let textBuffer: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Check section headers
    if (/^\|.*Revenue.*\|/i.test(line)) {
      currentSection = 'Revenue'
      capturingText = false
      continue
    }
    if (/^\|.*Expenses.*\|/i.test(line)) {
      currentSection = 'Expenses'
      capturingText = false
      continue
    }
    if (/^\|.*Net Profit.*\|/i.test(line)) {
      currentSection = 'NetProfit'
      capturingText = false
      continue
    }
    if (/^###\s*Key Highlights/i.test(line)) {
      currentSection = 'Highlights'
      capturingText = true
      textBuffer = []
      continue
    }
    if (/^###\s*Summary/i.test(line)) {
      if (currentSection === 'Highlights') {
        result.Highlights = textBuffer.join('\n').trim()
      }
      currentSection = 'Summary'
      capturingText = true
      textBuffer = []
      continue
    }

    // Table row parsing
    if (!capturingText && line.startsWith('|') && !/^\|[- ]+\|$/.test(line)) {
      const cols = line
        .split('|')
        .map(c => c.trim())
        .filter(Boolean)
      if (cols.length !== 2) continue

      const [label, amountStr] = cols
      const amountMatch = amountStr.match(/R\s?([\d,]+)/)
      if (!amountMatch) continue
      const amount = parseInt(amountMatch[1].replace(/,/g, ''))

      const typeMatch = label.match(/\b(Income|Expense|Other)\b/i)
      const type = typeMatch ? typeMatch[1] : ''
      const cleanedLabel = label
        .replace(/\b(Income|Expense|Other)\b/i, '')
        .trim()

      if (currentSection === 'Revenue' && !/total/i.test(label)) {
        result.Revenue.push({ name: cleanedLabel, amount, type })
      }

      if (currentSection === 'Expenses' && !/total/i.test(label)) {
        result.Expenses.push({ name: cleanedLabel, amount, type })
      }

      if (currentSection === 'NetProfit' && /net income/i.test(label)) {
        result.NetProfit = amount
      }

      continue
    }

    // Capture bullet point text or markdown summary
    if (capturingText) {
      textBuffer.push(line)
    }
  }

  // Assign Summary if ended while in it
  if (currentSection === 'Summary') {
    result.Summary = textBuffer.join('\n').trim()
  }

  return result
}

const FinancialReportsInterface = () => {
  const [uploadFiles, setUploadFiles] = useState([])
  const [stmtDateRange, setStmtDateRange] = useState(null)
  const [stmtType, setStmtType] = useState('Income Statement')
  const [structuredStmt, setStructuredStmt] = useState(null)
  const [businessId, setBusinessId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)

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
      message.warning(
        'Please select files and ensure your business ID is available.'
      )
      return
    }

    const form = new FormData()
    form.append('business_id', businessId)
    uploadFiles.forEach(file => form.append('files', file))

    setUploading(true)
    try {
      const resp = await fetch(`${BASE_URL}/upload_statements`, {
        method: 'POST',
        body: form
      })
      const data = await resp.json()
      if (!resp.ok) throw data
      message.success(
        `Stored ${data.message?.match(/\d+/)?.[0] || '?'} transactions.`
      )
    } catch (err) {
      console.error('Upload error:', err)
      message.error('Upload failed. See console for details.')
    } finally {
      setUploading(false)
    }
  }

  const handleGetStatement = async () => {
    if (!businessId || !stmtDateRange) {
      message.warning('Please select a date range.')
      return
    }

    const [start, end] = stmtDateRange
    const body = {
      business_id: businessId,
      start_date: start.format('YYYY-MM-DD'),
      end_date: end.format('YYYY-MM-DD'),
      statement_type: stmtType
    }

    setGenerating(true)
    try {
      const resp = await fetch(`${BASE_URL}/financial_statement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await resp.json()
      console.log('📄 Raw Report:\n', data.report)
      if (!resp.ok || !data.report) {
        throw new Error(data?.error || 'Unexpected server response')
      }

      const parsed = parseFinancialMarkdown(data.report)
      console.log('🧾 Parsed Financial Data:', parsed)
      setStructuredStmt(parsed)

      message.success('Statement generated.')
    } catch (err) {
      console.error('Generation error:', err)
      message.error('Failed to retrieve statement.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Spin spinning={uploading || generating} tip='Processing...'>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 32 }}>
        <Helmet>
          <title>QTX | Financial Statement Portal</title>
        </Helmet>

        <Title level={2} style={{ textAlign: 'center', color: '#004aad' }}>
          <FileSearchOutlined style={{ marginRight: 8 }} />
          Financial Statement Portal
        </Title>

        <Paragraph style={{ textAlign: 'center', marginBottom: 40 }}>
          Upload bank statements and generate AI-powered financial reports.
        </Paragraph>

        <Card title='1. Upload Bank Statements' style={{ marginBottom: 40 }}>
          <Upload
            multiple
            beforeUpload={file => {
              setUploadFiles(prev => [...prev, file])
              return false
            }}
            fileList={uploadFiles}
            onRemove={file =>
              setUploadFiles(prev => prev.filter(f => f.uid !== file.uid))
            }
          >
            <Button icon={<UploadOutlined />}>Select PDF File(s)</Button>
          </Upload>

          <Button
            type='primary'
            onClick={handleUpload}
            style={{ marginTop: 16 }}
            loading={uploading}
          >
            Upload & Analyze
          </Button>
        </Card>

        <Card title='2. Generate Financial Statement'>
          <Space direction='vertical' style={{ width: '100%' }} size='large'>
            <RangePicker
              style={{ width: '100%' }}
              onChange={setStmtDateRange}
            />
            <Select
              value={stmtType}
              onChange={setStmtType}
              style={{ width: '100%' }}
            >
              <Option value='Income Statement'>Income Statement</Option>
              <Option value='Cashflow Statement'>Cashflow Statement</Option>
              <Option value='Balance Sheet'>Balance Sheet</Option>
            </Select>
            <Button
              type='primary'
              onClick={handleGetStatement}
              loading={generating}
            >
              Generate Statement
            </Button>
          </Space>

          {structuredStmt && (
            <div style={{ marginTop: 32 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title='Total Revenue'
                    value={structuredStmt.Revenue?.reduce(
                      (a, b) => a + b.amount,
                      0
                    )}
                    prefix={<RiseOutlined />}
                    suffix='ZAR'
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title='Total Expenses'
                    value={structuredStmt.Expenses?.reduce(
                      (a, b) => a + b.amount,
                      0
                    )}
                    prefix={<FallOutlined />}
                    suffix='ZAR'
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title='Net Profit'
                    value={structuredStmt.NetProfit}
                    prefix={<DollarCircleOutlined />}
                    suffix='ZAR'
                  />
                </Col>
              </Row>

              <Card title='Revenue Breakdown' style={{ marginTop: 24 }}>
                <Table
                  dataSource={structuredStmt.Revenue}
                  columns={revenueColumns}
                  pagination={false}
                />
              </Card>

              <Card title='Expense Breakdown' style={{ marginTop: 24 }}>
                <Table
                  dataSource={structuredStmt.Expenses}
                  columns={expenseColumns}
                  pagination={false}
                />
              </Card>

              {structuredStmt.Highlights && (
                <Card title='Key Highlights' style={{ marginTop: 24 }}>
                  <Paragraph>
                    {structuredStmt.Highlights.split('\n').map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </Paragraph>
                </Card>
              )}

              {structuredStmt.Summary && (
                <Card title='Summary' style={{ marginTop: 24 }}>
                  <Paragraph>{structuredStmt.Summary}</Paragraph>
                </Card>
              )}
            </div>
          )}
        </Card>
      </div>
    </Spin>
  )
}

export default FinancialReportsInterface
