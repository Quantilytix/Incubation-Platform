import React, { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Table,
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  Descriptions,
  Divider,
  message as antdMessage,
  Select,
  Row,
  Col,
  Empty,
  Input,
  App,
  Spin,
  Collapse
} from 'antd'
import {
  EyeOutlined,
  DownloadOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined
} from '@ant-design/icons'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/firebase'
import { CSVLink } from 'react-csv'

const { Title, Text } = Typography
const { Option } = Select
const { Search } = Input
const { Panel } = Collapse

type AnswersMap = Record<string, any>

interface FormField {
  id: string
  type: string
  label: string
  required: boolean
  options?: string[]
  description?: string
}

interface FormTemplate {
  id: string
  title: string
  description: string
  category: string
  fields: FormField[]
  status: 'draft' | 'published'
}

interface FormResponse {
  id: string
  templateId?: string
  answers?: AnswersMap

  // legacy/alt shape
  formId?: string
  responses?: AnswersMap

  formTitle: string
  submittedBy: { id?: string; name?: string; email?: string }
  submittedAt: string
  status?: string
  notes?: string
}

interface Props {
  formId?: string // optional: preselect a form
}

const FormResponseViewer: React.FC<Props> = ({ formId }) => {
  const { message } = App.useApp()

  // UI state
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [responses, setResponses] = useState<FormResponse[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(
    formId
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchText, setSearchText] = useState('')

  // view modal
  const [viewOpen, setViewOpen] = useState(false)
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(
    null
  )
  const [fs, setFs] = useState(false) // full-screen toggle
  const [ansFilter, setAnsFilter] = useState('') // in-modal quick filter

  // csv
  const [csvData, setCsvData] = useState<any[]>([])
  const [csvHeaders, setCsvHeaders] = useState<
    { label: string; key: string }[]
  >([])

  // --- Load templates ---
  useEffect(() => {
    ;(async () => {
      try {
        const tSnap = await getDocs(
          query(
            collection(db, 'formTemplates'),
            where('status', '==', 'published')
          )
        )
        const t: FormTemplate[] = tSnap.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<FormTemplate, 'id'>)
        }))
        setTemplates(t)
      } catch (e) {
        console.error(e)
        message.error('Failed to load form templates')
      }
    })()
  }, [message])

  // --- Load responses (handles templateId + legacy formId) ---
  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const colRef = collection(db, 'formResponses')

        // Build primary query
        let primaryQ = selectedTemplate
          ? query(
              colRef,
              where('templateId', '==', selectedTemplate),
              orderBy('submittedAt', sortOrder)
            )
          : query(colRef, orderBy('submittedAt', sortOrder))

        const pSnap = await getDocs(primaryQ)
        let rows: FormResponse[] = pSnap.docs.map(d => ({
          id: d.id,
          ...(d.data() as any)
        }))

        // If template selected, include legacy docs that used formId
        if (selectedTemplate) {
          const legacyQ = query(
            colRef,
            where('formId', '==', selectedTemplate),
            orderBy('submittedAt', sortOrder)
          )
          const lSnap = await getDocs(legacyQ)
          const legacyRows: FormResponse[] = lSnap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any)
          }))
          const merged = new Map(rows.map(r => [r.id, r]))
          legacyRows.forEach(r => merged.set(r.id, r))
          rows = Array.from(merged.values())
        }

        setResponses(rows)
      } catch (e) {
        console.error(e)
        message.error('Failed to load form responses')
      } finally {
        setLoading(false)
      }
    })()
  }, [selectedTemplate, sortOrder, message])

  // --- Search filter (table) ---
  const filtered = useMemo(() => {
    if (!searchText) return responses
    const s = searchText.toLowerCase()
    return responses.filter(r => {
      const who = `${r.submittedBy?.name || ''} ${
        r.submittedBy?.email || ''
      }`.toLowerCase()
      return r.formTitle.toLowerCase().includes(s) || who.includes(s)
    })
  }, [responses, searchText])

  // --- CSV generation based on current filtered ---
  useEffect(() => {
    if (!filtered.length) {
      setCsvData([])
      setCsvHeaders([])
      return
    }

    const template =
      templates.find(
        t =>
          t.id ===
          (selectedTemplate || filtered[0]?.templateId || filtered[0]?.formId)
      ) || null

    // 1) Standard headers (friendly names)
    const baseHeaders: { label: string; key: string }[] = [
      { label: 'Form', key: 'formTitle' },
      { label: 'Submitter Name', key: 'submitter_name' },
      { label: 'Submitter Email', key: 'submitter_email' },
      { label: 'Submitted At', key: 'submittedAt' },
      { label: 'Status', key: 'status' }
    ]

    // 2) Dynamic field headers (friendly label -> stable key field__<id>)
    let fieldHeaders: { label: string; key: string }[] = []
    if (template) {
      fieldHeaders = (template.fields || [])
        .filter(f => f.type !== 'heading')
        .map(f => ({
          label: f.label || 'Field',
          key: `field__${f.id}`
        }))
    } else {
      // No template? fall back to whatever keys exist in answers
      // Gather union of keys across filtered responses
      const answerKeys = new Set<string>()
      filtered.forEach(r => {
        const answers = (r.answers ?? r.responses ?? {}) as AnswersMap
        Object.keys(answers).forEach(k => answerKeys.add(k))
      })
      fieldHeaders = Array.from(answerKeys).map(k => ({
        label: k, // friendly label = raw key (best we can do here)
        key: `answer__${k}` // stable export key
      }))
    }

    // 3) Build rows matching the headers
    const data = filtered.map(r => {
      const answers = (r.answers ?? r.responses ?? {}) as AnswersMap

      // base row (NO id)
      const row: Record<string, any> = {
        formTitle: r.formTitle,
        submitter_name: r.submittedBy?.name || '',
        submitter_email: r.submittedBy?.email || '',
        submittedAt: formatDateTime(r.submittedAt),
        status: (r.status || 'submitted').toUpperCase()
      }

      if (template) {
        // write each field value to field__<id>
        template.fields.forEach(f => {
          if (f.type === 'heading') return
          const v = answers[f.id]
          row[`field__${f.id}`] = Array.isArray(v)
            ? v.join(', ')
            : typeof v === 'object' && v !== null
            ? JSON.stringify(v)
            : v ?? ''
        })
      } else {
        // fallback: dump all answer keys as answer__<key>
        Object.entries(answers).forEach(([k, v]) => {
          row[`answer__${k}`] = Array.isArray(v)
            ? v.join(', ')
            : typeof v === 'object' && v !== null
            ? JSON.stringify(v)
            : v ?? ''
        })
      }

      return row
    })

    setCsvHeaders([...baseHeaders, ...fieldHeaders])
    setCsvData(data)
  }, [filtered, templates, selectedTemplate])

  // put this above your columns
  const toDateSafe = (v: any): Date | null => {
    if (!v) return null

    // Firestore Timestamp (has toDate)
    if (typeof v?.toDate === 'function') {
      try {
        return v.toDate()
      } catch {}
    }

    // Firestore { seconds, nanoseconds }
    if (typeof v?.seconds === 'number') {
      const ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6)
      return new Date(ms)
    }

    // JS Date
    if (v instanceof Date) return v

    // Numeric epoch (assume ms; if it's seconds, convert)
    if (typeof v === 'number') {
      const ms = v < 10_000_000_000 ? v * 1000 : v // seconds vs ms
      return new Date(ms)
    }

    // ISO string or anything Date can parse
    if (typeof v === 'string') {
      const d = new Date(v)
      return isNaN(d.getTime()) ? null : d
    }

    return null
  }

  const formatDateTime = (v: any) => {
    const d = toDateSafe(v)
    return d ? d.toLocaleString() : '-'
  }

  // --- Table columns ---
  const columns = [
    { title: 'Form', dataIndex: 'formTitle', key: 'formTitle' },
    {
      title: 'Submitted By',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      render: (sb: FormResponse['submittedBy']) => (
        <div>
          <div>{sb?.name || '-'}</div>
          <Text type='secondary'>{sb?.email || '-'}</Text>
        </div>
      )
    },
    {
      title: 'Submitted At',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      render: (val: any) => formatDateTime(val)
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s?: string) => {
        const status = (s || 'submitted').toLowerCase()
        const color =
          status === 'approved'
            ? 'success'
            : status === 'rejected'
            ? 'error'
            : 'processing'
        return <Tag color={color}>{status.toUpperCase()}</Tag>
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: FormResponse) => (
        <Button
          icon={<EyeOutlined />}
          size='small'
          onClick={() => {
            setSelectedResponse(record)
            setAnsFilter('')
            setFs(false)
            setViewOpen(true)
          }}
        >
          View
        </Button>
      )
    }
  ]

  // --- Helpers for modal details ---
  const renderAnswerValue = (v: any) => {
    const str = Array.isArray(v)
      ? v.join(', ')
      : typeof v === 'object' && v !== null
      ? JSON.stringify(v)
      : String(v ?? '')

    if (!ansFilter) return str
    // hide if value doesn't match filter
    return str.toLowerCase().includes(ansFilter.toLowerCase()) ? str : null
  }

  const renderDetails = () => {
    if (!selectedResponse) return null

    const template =
      templates.find(t => t.id === selectedResponse.templateId) ||
      templates.find(t => t.id === selectedResponse.formId)

    const answers = (selectedResponse.answers ??
      selectedResponse.responses ??
      {}) as AnswersMap

    // Build section groups using `heading` fields
    const groups: Record<string, FormField[]> = {}
    let current = 'General'
    ;(template?.fields || []).forEach(f => {
      if (f.type === 'heading') {
        current = f.label || 'Section'
        return
      }
      ;(groups[current] ||= []).push(f)
    })

    return (
      <div>
        {/* Sticky-ish meta block */}
        <Card
          size='small'
          style={{
            marginBottom: 12,
            position: 'sticky',
            top: 0,
            zIndex: 1
          }}
        >
          <Descriptions title='Submission' bordered column={1} size='small'>
            <Descriptions.Item label='Form'>
              {selectedResponse.formTitle}
            </Descriptions.Item>
            <Descriptions.Item label='Submitted By'>
              {selectedResponse.submittedBy?.name || '-'} (
              {selectedResponse.submittedBy?.email || '-'})
            </Descriptions.Item>
            <Descriptions.Item label='Submitted At'>
              {formatDateTime(selectedResponse.submittedAt)}
            </Descriptions.Item>
            <Descriptions.Item label='Status'>
              <Tag color='processing'>
                {(selectedResponse.status || 'submitted').toUpperCase()}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Divider orientation='left' style={{ marginTop: 8, marginBottom: 8 }}>
          Responses
        </Divider>

        {/* Quick in-modal search */}
        <Input
          allowClear
          placeholder='Search within responses'
          value={ansFilter}
          onChange={e => setAnsFilter(e.target.value)}
          style={{ marginBottom: 8 }}
        />

        <Collapse accordion>
          {Object.entries(groups).map(([section, fields]) => (
            <Panel header={section} key={section}>
              <Descriptions bordered column={1} size='small'>
                {fields.map(f => {
                  const v = answers[f.id]
                  if (v === undefined) return null
                  const rendered = renderAnswerValue(v)
                  if (rendered === null) return null
                  return (
                    <Descriptions.Item key={f.id} label={f.label}>
                      {f.type === 'file' && typeof v === 'string' ? (
                        <a href={v} target='_blank' rel='noopener noreferrer'>
                          View File
                        </a>
                      ) : (
                        rendered
                      )}
                    </Descriptions.Item>
                  )
                })}
              </Descriptions>
            </Panel>
          ))}

          {/* Fallback: if no template or no grouped fields, dump all answer keys */}
          {(!template || Object.keys(groups).length === 0) && (
            <Panel header='Responses' key='__all__'>
              <Descriptions bordered column={1} size='small'>
                {Object.entries(answers).map(([k, v]) => {
                  const rendered = renderAnswerValue(v)
                  if (rendered === null) return null
                  return (
                    <Descriptions.Item key={k} label={k}>
                      {rendered}
                    </Descriptions.Item>
                  )
                })}
              </Descriptions>
            </Panel>
          )}
        </Collapse>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Card
        title='Form Responses'
        extra={
          <Space>
            <Button
              icon={
                sortOrder === 'asc' ? (
                  <SortAscendingOutlined />
                ) : (
                  <SortDescendingOutlined />
                )
              }
              onClick={() => setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
            >
              {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
            </Button>
            {csvData.length > 0 && (
              <CSVLink
                data={csvData}
                headers={csvHeaders}
                filename={`form-responses-${new Date()
                  .toISOString()
                  .slice(0, 10)}.csv`}
              >
                <Button icon={<DownloadOutlined />}>Export CSV</Button>
              </CSVLink>
            )}
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={10}>
            <Select
              placeholder='Select Form Template'
              style={{ width: '100%' }}
              onChange={setSelectedTemplate}
              value={selectedTemplate}
              allowClear
            >
              {templates.map(t => (
                <Option key={t.id} value={t.id}>
                  {t.title}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={14}>
            <Search
              placeholder='Search by form or submitter'
              onSearch={setSearchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: '100%' }}
              allowClear
            />
          </Col>
        </Row>

        <Divider />

        <Table
          dataSource={filtered}
          columns={columns}
          rowKey='id'
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: <Empty description='No form responses found' />
          }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <span>Form Response Details</span>
            <Button size='small' onClick={() => setFs(v => !v)}>
              {fs ? 'Exit full screen' : 'Full screen'}
            </Button>
          </Space>
        }
        open={viewOpen}
        onCancel={() => setViewOpen(false)}
        footer={<Button onClick={() => setViewOpen(false)}>Close</Button>}
        width={fs ? '100vw' : '90vw'}
        style={{ top: fs ? 0 : 16, padding: 0 }}
        bodyStyle={{
          height: fs ? 'calc(100dvh - 120px)' : '72vh',
          overflowY: 'auto',
          padding: fs ? 16 : 12
        }}
        destroyOnClose
      >
        <Spin spinning={false}>{renderDetails()}</Spin>
      </Modal>
    </div>
  )
}

export default FormResponseViewer
