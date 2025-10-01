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
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  documentId
} from 'firebase/firestore'
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

  // if present on response or within answers/responses map
  applicationId?: string

  formTitle: string
  submittedBy: { id?: string; name?: string; email?: string }
  submittedAt: any
  status?: string
  notes?: string

  // derived/enriched
  beneficiaryName?: string
}

interface Props {
  formId?: string // optional: preselect a form
}

/* ---------------- Utilities ---------------- */

function chunkArray<T>(arr: T[], size = 10): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const toDateSafe = (v: any): Date | null => {
  if (!v) return null
  if (typeof v?.toDate === 'function') {
    try {
      return v.toDate()
    } catch {}
  }
  if (typeof v?.seconds === 'number') {
    const ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6)
    return new Date(ms)
  }
  if (v instanceof Date) return v
  if (typeof v === 'number') {
    const ms = v < 10_000_000_000 ? v * 1000 : v
    return new Date(ms)
  }
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

  // --- Resolve beneficiaries for a batch of responses ---
  const resolveBeneficiaries = async (rows: FormResponse[]) => {
    if (!rows.length) return rows

    // Collect candidate applicationIds (from top-level or answers/responses map)
    const appIds = Array.from(
      new Set(
        rows
          .map(r => {
            const ans = (r.answers ?? r.responses ?? {}) as AnswersMap
            return r.applicationId || ans['applicationId']
          })
          .filter(Boolean) as string[]
      )
    )

    // Collect emails for fallback
    const emails = Array.from(
      new Set(
        rows
          .map(r => r.submittedBy?.email?.toLowerCase().trim())
          .filter(Boolean) as string[]
      )
    )

    const byId = new Map<string, any>()
    const byEmail = new Map<string, any>()

    // 1) Fetch applications by documentId in chunks of 10
    if (appIds.length) {
      for (const group of chunkArray(appIds, 10)) {
        const snap = await getDocs(
          query(collection(db, 'applications'), where(documentId(), 'in', group))
        )
        snap.docs.forEach(d => byId.set(d.id, d.data()))
      }
    }

    // 2) Fetch applications by email in chunks of 10 (fallback)
    // NOTE: Ensure your applications have an 'email' field. If it's different (e.g., 'ownerEmail'),
    // change the field name below.
    if (emails.length) {
      for (const group of chunkArray(emails, 10)) {
        const snap = await getDocs(
          query(collection(db, 'applications'), where('email', 'in', group))
        )
        snap.docs.forEach(d => {
          const data = d.data() as any
          const key = String(data?.email || '').toLowerCase().trim()
          if (key) byEmail.set(key, data)
        })
      }
    }

    // 3) Attach beneficiaryName
    return rows.map(r => {
      const ans = (r.answers ?? r.responses ?? {}) as AnswersMap
      const idFromRow = r.applicationId || ans['applicationId']
      let name: string | undefined

      if (idFromRow && byId.has(idFromRow)) {
        const app = byId.get(idFromRow)
        name = app?.beneficiaryName || app?.companyName || app?.businessName
      }

      if (!name && r.submittedBy?.email) {
        const app = byEmail.get(r.submittedBy.email.toLowerCase().trim())
        name = app?.beneficiaryName || app?.companyName || app?.businessName
      }

      return { ...r, beneficiaryName: name || '-' }
    })
  }

  // --- Load responses (handles templateId + legacy formId) and enrich with beneficiaryName ---
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

        // 🔹 Enrich with beneficiaryName
        const enriched = await resolveBeneficiaries(rows)
        setResponses(enriched)
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
      const bene = (r.beneficiaryName || '').toLowerCase()
      return (
        r.formTitle.toLowerCase().includes(s) ||
        who.includes(s) ||
        bene.includes(s)
      )
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
      { label: 'Beneficiary', key: 'beneficiaryName' }, // NEW
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
      const answerKeys = new Set<string>()
      filtered.forEach(r => {
        const answers = (r.answers ?? r.responses ?? {}) as AnswersMap
        Object.keys(answers).forEach(k => answerKeys.add(k))
      })
      fieldHeaders = Array.from(answerKeys).map(k => ({
        label: k,
        key: `answer__${k}`
      }))
    }

    // 3) Build rows matching the headers
    const data = filtered.map(r => {
      const answers = (r.answers ?? r.responses ?? {}) as AnswersMap

      const row: Record<string, any> = {
        formTitle: r.formTitle,
        beneficiaryName: r.beneficiaryName || '', // NEW
        submitter_name: r.submittedBy?.name || '',
        submitter_email: r.submittedBy?.email || '',
        submittedAt: formatDateTime(r.submittedAt),
        status: (r.status || 'submitted').toUpperCase()
      }

      if (template) {
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

  // --- Table columns ---
  const columns = [
    { title: 'Form', dataIndex: 'formTitle', key: 'formTitle' },
    {
      title: 'Beneficiary',
      dataIndex: 'beneficiaryName',
      key: 'beneficiaryName'
    },
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
            <Descriptions.Item label='Beneficiary'>
              {selectedResponse.beneficiaryName || '-'}
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
              placeholder='Search by form, submitter, or beneficiary'
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
          columns={columns as any}
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
