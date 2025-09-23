import React, { useEffect, useState } from 'react'
import {
  App,
  Button,
  Typography,
  Space,
  Modal,
  Tag,
  Checkbox,
  Form,
  Input,
  Select,
  Radio,
  DatePicker,
  Upload,
  Rate
} from 'antd'
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  SendOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  FormOutlined,
  PaperClipOutlined
} from '@ant-design/icons'
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { DashboardHeaderCard, MotionCard } from '../shared/Header'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

// --- Models kept minimal for this page ---
interface FormField {
  id: string
  type: string
  label: string
  required: boolean
  options?: string[]
  description?: string
  placeholder?: string
}

interface FormTemplate {
  id?: string
  title: string
  description: string
  fields: FormField[]
  status: 'draft' | 'published'
  category: string
  createdAt: string
  updatedAt: string
  createdBy?: string
}

export default function TemplatesPage () {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { user } = useFullIdentity()

  // data
  const [templateList, setTemplateList] = useState<FormTemplate[]>([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [metrics, setMetrics] = useState({
    total: 0,
    drafts: 0,
    published: 0,
    sentOut: 0
  })

  // preview
  const [previewTemplate, setPreviewTemplate] = useState<FormTemplate | null>(
    null
  )

  // send modal
  const [sendOpen, setSendOpen] = useState(false)
  const [sendTemplate, setSendTemplate] = useState<FormTemplate | null>(null)
  const [applicants, setApplicants] = useState<
    Array<{ id: string; name: string; email: string }>
  >([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [deliveryMethod, setDeliveryMethod] = useState<'in_app' | 'email'>(
    'in_app'
  )
  const [sending, setSending] = useState(false)

  // utils
  const pruneUndefinedDeep = (val: any): any => {
    if (Array.isArray(val)) return val.map(pruneUndefinedDeep)
    if (val && typeof val === 'object') {
      return Object.fromEntries(
        Object.entries(val)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, pruneUndefinedDeep(v)])
      )
    }
    return val
  }
  const generateToken = () =>
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

  // data load
  const fetchTemplates = async () => {
    try {
      setTemplateLoading(true)
      const snap = await getDocs(collection(db, 'formTemplates'))
      const templates: FormTemplate[] = []
      snap.forEach(d =>
        templates.push({ id: d.id, ...(d.data() as FormTemplate) })
      )

      // sort newest updated first
      templates.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )

      // metrics
      const total = templates.length
      const drafts = templates.filter(t => t.status === 'draft').length
      const published = templates.filter(t => t.status === 'published').length
      const assignmentsSnap = await getDocs(collection(db, 'formAssignments'))
      const sentOut = assignmentsSnap.size

      setTemplateList(templates)
      setMetrics({ total, drafts, published, sentOut })
    } catch (e) {
      console.error(e)
      message.error('Failed to load form templates')
    } finally {
      setTemplateLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  // actions
  const goToNew = () => navigate('/operations/surveys/builder')
  const goToEdit = (id: string) => navigate(`/operations/surveys/builder/${id}`)

  const openSendModal = async (template: FormTemplate) => {
    setSendTemplate(template)
    setSendOpen(true)
    try {
      const q = query(
        collection(db, 'applications'),
        where('applicationStatus', '==', 'accepted'),
        where('companyCode', '==', user.companyCode)
      )

      const snap = await getDocs(q)
      const list: Array<{ id: string; name: string; email: string }> = []
      snap.forEach(d => {
        const data = d.data() as any
        list.push({
          id: d.id,
          name: data.beneficiaryName || 'Unnamed',
          email: data.email || ''
        })
      })
      setApplicants(list)
      // default select all
      setSelectedIds(list.map(a => a.id))
      setSelectAll(true)
    } catch (e) {
      console.error(e)
      message.error('Failed to load recipients')
    }
  }

  const sendAssignments = async () => {
    if (!sendTemplate) return
    if (selectedIds.length === 0)
      return message.error('Select at least one recipient')

    try {
      setSending(true)
      const now = new Date().toISOString()
      const selected = applicants.filter(a => selectedIds.includes(a.id))

      await Promise.all(
        selected.map(async a => {
          const linkToken = generateToken()
          const payload = pruneUndefinedDeep({
            templateId: sendTemplate.id,
            applicationId: a.id,
            recipientEmail: a.email,
            status: 'pending',
            deliveryMethod,
            linkToken,
            createdAt: now
          })
          await addDoc(collection(db, 'formAssignments'), payload as any)
          // optional: trigger email via backend with:
          // const link = `${window.location.origin}/portal/forms/${sendTemplate.id}?token=${linkToken}`
        })
      )

      message.success(`Sent to ${selected.length} recipient(s)`)
      setSendOpen(false)
      setSendTemplate(null)
    } catch (e) {
      console.error(e)
      message.error('Failed to send form')
    } finally {
      setSending(false)
    }
  }

  const sanitizeName = (s: string) =>
    (s || 'field')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')

  // minimal preview control renderer
  const FieldPreview: React.FC<{ field: FormField }> = ({ field }) => {
    switch (field.type) {
      case 'text':
        return <Input placeholder={field.placeholder} />
      case 'textarea':
        return <Input.TextArea rows={4} placeholder={field.placeholder} />
      case 'number':
        return <Input type='number' placeholder={field.placeholder} />
      case 'email':
        return <Input type='email' placeholder={field.placeholder} />
      case 'select':
        return (
          <Select placeholder={field.placeholder} style={{ width: '100%' }}>
            {(field.options || []).map((o, i) => (
              <Option key={i} value={o}>
                {o}
              </Option>
            ))}
          </Select>
        )
      case 'checkbox':
        return (
          <Checkbox.Group
            options={(field.options || []).map(o => ({ label: o, value: o }))}
          />
        )
      case 'radio':
        return (
          <Radio.Group>
            {(field.options || []).map((o, i) => (
              <Radio key={i} value={o}>
                {o}
              </Radio>
            ))}
          </Radio.Group>
        )
      case 'date':
        return <DatePicker style={{ width: '100%' }} />
      case 'file':
        return (
          <Upload>
            <Button icon={<PaperClipOutlined />}>Upload File</Button>
          </Upload>
        )
      case 'rating':
        return <Rate />
      case 'heading':
        return (
          <Title level={4} style={{ margin: 0 }}>
            {field.label || 'Section'}
          </Title>
        )
      default:
        return null
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}

      <DashboardHeaderCard
        title='Form Templates'
        subtitle='Build, preveiw and publish forms.'
        extraRight={
          <Button type='primary' icon={<PlusOutlined />} onClick={goToNew}>
            Create New Form
          </Button>
        }
      />

      {/* Metrics */}
      <div
        style={{
          marginBottom: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12
        }}
      >
        <MotionCard size='small'>
          <Space size='large' align='center'>
            <FileTextOutlined style={{ fontSize: 22 }} />
            <div>
              <div style={{ fontSize: 16, color: 'rgba(0,0,0,.45)' }}>
                Total
              </div>
              <div style={{ fontSize: 22 }}>{metrics.total}</div>
            </div>
          </Space>
        </MotionCard>

        <MotionCard size='small'>
          <Space size='large' align='center'>
            <FileTextOutlined style={{ fontSize: 22 }} />
            <div>
              <div style={{ fontSize: 16, color: 'rgba(0,0,0,.45)' }}>
                Drafts
              </div>
              <div style={{ fontSize: 22 }}>{metrics.drafts}</div>
            </div>
          </Space>
        </MotionCard>

        <MotionCard size='small'>
          <Space size='large' align='center'>
            <CheckCircleOutlined style={{ fontSize: 22 }} />
            <div>
              <div style={{ fontSize: 16, color: 'rgba(0,0,0,.45)' }}>
                Published
              </div>
              <div style={{ fontSize: 22 }}>{metrics.published}</div>
            </div>
          </Space>
        </MotionCard>

        <MotionCard size='small'>
          <Space size='large' align='center'>
            <SendOutlined style={{ fontSize: 22 }} />
            <div>
              <div style={{ fontSize: 16, color: 'rgba(0,0,0,.45)' }}>
                Sent out
              </div>
              <div style={{ fontSize: 22 }}>{metrics.sentOut}</div>
            </div>
          </Space>
        </MotionCard>
      </div>

      {/* Templates list as MotionCards */}
      <Space direction='vertical' style={{ width: '100%' }} size={12}>
        {templateLoading && (
          <MotionCard size='small'>
            <Text type='secondary'>Loading templates…</Text>
          </MotionCard>
        )}

        {!templateLoading && templateList.length === 0 && (
          <MotionCard size='small'>
            <Text type='secondary'>
              No templates yet. Create your first form.
            </Text>
          </MotionCard>
        )}

        {!templateLoading &&
          templateList.map(tpl => (
            <MotionCard key={tpl.id} size='small'>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ minWidth: 260 }}>
                  <Space size='small'>
                    <Title level={5} style={{ margin: 0 }}>
                      {tpl.title}
                    </Title>
                    <Tag
                      color={tpl.status === 'published' ? 'green' : 'orange'}
                    >
                      {tpl.status === 'published' ? 'Published' : 'Draft'}
                    </Tag>
                  </Space>
                  <div style={{ marginTop: 6 }}>{tpl.description}</div>
                  <div style={{ marginTop: 8, color: 'rgba(0,0,0,.45)' }}>
                    Category: {tpl.category} • Fields: {tpl.fields.length} •
                    Updated: {new Date(tpl.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                <Space>
                  <Button
                    icon={<SendOutlined />}
                    onClick={() => openSendModal(tpl)}
                  >
                    Send
                  </Button>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => goToEdit(tpl.id!)}
                  >
                    Edit
                  </Button>
                  <Button
                    icon={<EyeOutlined />}
                    onClick={() => setPreviewTemplate(tpl)}
                  >
                    Preview
                  </Button>
                </Space>
              </div>
            </MotionCard>
          ))}
      </Space>

      {/* Send Modal */}
      <Modal
        title={`Send: ${sendTemplate?.title || ''}`}
        open={sendOpen}
        onCancel={() => setSendOpen(false)}
        onOk={sendAssignments}
        okButtonProps={{ loading: sending }}
        width={700}
      >
        <Space direction='vertical' style={{ width: '100%' }}>
          <MotionCard size='small' title='Delivery'>
            <Space.Compact>
              <Button
                type={deliveryMethod === 'in_app' ? 'primary' : 'default'}
                onClick={() => setDeliveryMethod('in_app')}
              >
                In-app
              </Button>
              <Button
                type={deliveryMethod === 'email' ? 'primary' : 'default'}
                onClick={() => setDeliveryMethod('email')}
              >
                Email link
              </Button>
            </Space.Compact>
            <div style={{ marginTop: 8, color: 'rgba(0,0,0,.45)' }}>
              {deliveryMethod === 'in_app'
                ? 'Recipients will see the form in their portal.'
                : 'Recipients get an email link to the portal form.'}
            </div>
          </MotionCard>

          <MotionCard size='small' title='Recipients'>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8
              }}
            >
              <Checkbox
                checked={selectAll}
                onChange={e => {
                  const checked = e.target.checked
                  setSelectAll(checked)
                  setSelectedIds(checked ? applicants.map(a => a.id) : [])
                }}
              >
                Select all
              </Checkbox>
              <div>{selectedIds.length} selected</div>
            </div>

            <div
              style={{
                maxHeight: 320,
                overflow: 'auto',
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: 12
              }}
            >
              {applicants.length === 0 ? (
                <Text type='secondary'>No accepted applications found.</Text>
              ) : (
                applicants.map(a => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '6px 0'
                    }}
                  >
                    <Checkbox
                      checked={selectedIds.includes(a.id)}
                      onChange={e => {
                        const next = new Set(selectedIds)
                        e.target.checked ? next.add(a.id) : next.delete(a.id)
                        setSelectedIds([...next])
                        setSelectAll(next.size === applicants.length)
                      }}
                    />
                    <div>
                      <div>
                        <strong>{a.name}</strong>
                      </div>
                      <div style={{ color: 'rgba(0,0,0,.45)' }}>{a.email}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </MotionCard>
        </Space>
      </Modal>

      {/* Preview Modal */}
      <Modal
        title='Form Preview'
        open={!!previewTemplate}
        onCancel={() => setPreviewTemplate(null)}
        footer={null}
        width={700}
      >
        {previewTemplate ? (
          <>
            <Title level={3} style={{ marginTop: 0 }}>
              {previewTemplate.title}
            </Title>
            <Text>{previewTemplate.description}</Text>
            <div style={{ marginTop: 16 }}>
              <Form layout='vertical'>
                {previewTemplate.fields.map((f, i) =>
                  f.type === 'heading' ? (
                    <div key={f.id} style={{ marginBottom: 8 }}>
                      <FieldPreview field={f} />
                    </div>
                  ) : (
                    <Form.Item
                      key={f.id}
                      label={f.label}
                      required={f.required}
                      help={f.description}
                      name={sanitizeName(f.label || `field_${i + 1}`)}
                    >
                      <FieldPreview field={f} />
                    </Form.Item>
                  )
                )}
                <Form.Item>
                  <Button type='primary'>Submit</Button>
                </Form.Item>
              </Form>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  )
}
