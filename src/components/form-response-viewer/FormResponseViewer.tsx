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
  message,
  Select,
  Row,
  Col,
  Empty,
  Input,
  App,
  Spin
} from 'antd'
import {
  EyeOutlined,
  DownloadOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined
} from '@ant-design/icons'
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy
} from 'firebase/firestore'
import { db } from '@/firebase'
import { CSVLink } from 'react-csv'

const { Title, Text } = Typography
const { Option } = Select
const { Search } = Input

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
  // newer shape from your submit
  templateId?: string
  answers?: AnswersMap

  // older/alt shape
  formId?: string
  responses?: AnswersMap

  formTitle: string
  submittedBy: { id?: string; name?: string; email?: string }
  submittedAt: string
  status?: string // often "submitted" in your flow
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

  // csv
  const [csvData, setCsvData] = useState<any[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        // templates
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

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)

        // build query:
        // Your submit writes templateId, not formId.
        // We’ll first try templateId, and if no template selected we just order by submittedAt.
        const colRef = collection(db, 'formResponses')

        let qRef
        if (selectedTemplate) {
          // Prefer templateId. (If your older docs used formId, we’ll client-filter below.)
          qRef = query(
            colRef,
            where('templateId', '==', selectedTemplate),
            orderBy('submittedAt', sortOrder)
          )
        } else {
          qRef = query(colRef, orderBy('submittedAt', sortOrder))
        }

        const rSnap = await getDocs(qRef)
        let rows: FormResponse[] = rSnap.docs.map(d => ({
          id: d.id,
          ...(d.data() as any)
        }))

        // If user picked a template and some older rows only have formId, include those too:
        if (selectedTemplate) {
          const legacySnap = await getDocs(
            query(
              colRef,
              where('formId', '==', selectedTemplate),
              orderBy('submittedAt', sortOrder)
            )
          )
          const legacyRows: FormResponse[] = legacySnap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any)
          }))
          // Merge (avoid dupes by id)
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

  // search filter
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

  // CSV
  useEffect(() => {
    if (!filtered.length) {
      setCsvData([])
      return
    }

    const template = templates.find(
      t =>
        t.id ===
        (selectedTemplate || filtered[0]?.templateId || filtered[0]?.formId)
    )

    const data = filtered.map(r => {
      const answers = (r.answers ?? r.responses ?? {}) as AnswersMap
      const base: Record<string, any> = {
        id: r.id,
        formTitle: r.formTitle,
        submitter_name: r.submittedBy?.name || '',
        submitter_email: r.submittedBy?.email || '',
        submittedAt: new Date(r.submittedAt).toLocaleString(),
        status: (r.status || 'submitted').toUpperCase()
      }

      if (template) {
        template.fields.forEach(f => {
          if (f.type === 'heading') return
          const v = answers[f.id]
          base[f.label] =
            typeof v === 'object' && v !== null && !Array.isArray(v)
              ? JSON.stringify(v)
              : Array.isArray(v)
              ? v.join(', ')
              : v ?? ''
        })
      } else {
        // fallback: dump all keys
        Object.entries(answers).forEach(([k, v]) => {
          base[k] = Array.isArray(v)
            ? v.join(', ')
            : typeof v === 'object' && v !== null
            ? JSON.stringify(v)
            : v ?? ''
        })
      }

      return base
    })

    setCsvData(data)
  }, [filtered, templates, selectedTemplate])

  // columns
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
      render: (iso: string) => (iso ? new Date(iso).toLocaleString() : '-')
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
            setViewOpen(true)
          }}
        >
          View
        </Button>
      )
    }
  ]

  const renderDetails = () => {
    if (!selectedResponse) return null

    const template =
      templates.find(t => t.id === selectedResponse.templateId) ||
      templates.find(t => t.id === selectedResponse.formId)

    const answers = (selectedResponse.answers ??
      selectedResponse.responses ??
      {}) as AnswersMap

    return (
      <div>
        <Descriptions title='Submission' bordered column={1}>
          <Descriptions.Item label='Form'>
            {selectedResponse.formTitle}
          </Descriptions.Item>
          <Descriptions.Item label='Submitted By'>
            {selectedResponse.submittedBy?.name} (
            {selectedResponse.submittedBy?.email})
          </Descriptions.Item>
          <Descriptions.Item label='Submitted At'>
            {new Date(selectedResponse.submittedAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label='Status'>
            <Tag>{(selectedResponse.status || 'submitted').toUpperCase()}</Tag>
          </Descriptions.Item>
        </Descriptions>

        <Divider orientation='left'>Responses</Divider>

        <Descriptions bordered column={1}>
          {template
            ? template.fields.map(f => {
                if (f.type === 'heading') {
                  return (
                    <Descriptions.Item key={f.id} label=''>
                      <Title level={5} style={{ margin: 0 }}>
                        {f.label}
                      </Title>
                    </Descriptions.Item>
                  )
                }
                const v = answers[f.id]
                if (v === undefined) return null

                return (
                  <Descriptions.Item key={f.id} label={f.label}>
                    {f.type === 'file' && typeof v === 'string' ? (
                      <a href={v} target='_blank' rel='noopener noreferrer'>
                        View File
                      </a>
                    ) : Array.isArray(v) ? (
                      v.join(', ')
                    ) : typeof v === 'object' && v !== null ? (
                      JSON.stringify(v)
                    ) : (
                      String(v)
                    )}
                  </Descriptions.Item>
                )
              })
            : // fallback: show all keys if no template found
              Object.entries(answers).map(([k, v]) => (
                <Descriptions.Item key={k} label={k}>
                  {Array.isArray(v)
                    ? v.join(', ')
                    : typeof v === 'object' && v !== null
                    ? JSON.stringify(v)
                    : String(v)}
                </Descriptions.Item>
              ))}
        </Descriptions>
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
        title='Form Response Details'
        open={viewOpen}
        onCancel={() => setViewOpen(false)}
        footer={<Button onClick={() => setViewOpen(false)}>Close</Button>}
        width={800}
        destroyOnClose
      >
        <Spin spinning={false}>{renderDetails()}</Spin>
      </Modal>
    </div>
  )
}

export default FormResponseViewer
