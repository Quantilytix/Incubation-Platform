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
  Rate,
  Alert
} from 'antd'
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  SendOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  PaperClipOutlined
} from '@ant-design/icons'
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  runTransaction
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { useNavigate } from 'react-router-dom'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'

const { Title, Text } = Typography
const { Option } = Select

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

// helpers
const sanitizeName = (s: string) =>
  (s || 'field')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')

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
const makeAssignmentId = (templateId: string, applicationId: string) =>
  `${templateId}__${applicationId}`

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
  const [sending, setSending] = useState(false)

  // "already sent" bookkeeping
  const [alreadyAssignedIds, setAlreadyAssignedIds] = useState<Set<string>>(
    new Set()
  )
  const [alreadyAssignedEmails, setAlreadyAssignedEmails] = useState<
    Set<string>
  >(new Set())
  const [allAlreadyAssigned, setAllAlreadyAssigned] = useState(false)

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

      // metrics (simple, global)
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
  }, []) // eslint-disable-line

  // actions
  const goToNew = () => navigate('/operations/surveys/builder')
  const goToEdit = (id: string) => navigate(`/operations/surveys/builder/${id}`)

  // OPEN SEND MODAL
  const openSendModal = async (template: FormTemplate) => {
    setSendTemplate(template)
    setSendOpen(true)
    try {
      // Load accepted recipients for this company
      const qApps = query(
        collection(db, 'applications'),
        where('applicationStatus', '==', 'accepted'),
        where('companyCode', '==', user.companyCode)
      )
      const appsSnap = await getDocs(qApps)
      const list: Array<{ id: string; name: string; email: string }> = []
      appsSnap.forEach(d => {
        const data = d.data() as any
        list.push({
          id: d.id,
          name: data.beneficiaryName || data.fullName || 'Unnamed',
          email: String(data.email || '').toLowerCase()
        })
      })
      setApplicants(list)

      // Primary: assignments scoped by companyCode
      const companyCode = user?.companyCode
      let assDocs: Array<any> = []
      if (companyCode) {
        const qScoped = query(
          collection(db, 'formAssignments'),
          where('templateId', '==', template.id),
          where('companyCode', '==', companyCode)
        )
        const scoped = await getDocs(qScoped)
        assDocs = [...scoped.docs]
      }

      // Fallback: template-only query for legacy rows without companyCode
      if (assDocs.length === 0 || !companyCode) {
        const qLegacy = query(
          collection(db, 'formAssignments'),
          where('templateId', '==', template.id)
        )
        const legacy = await getDocs(qLegacy)
        const had = new Set(assDocs.map(d => d.id))
        legacy.docs.forEach(d => {
          if (!had.has(d.id)) assDocs.push(d)
        })
      }

      const takenIds = new Set<string>()
      const takenEmails = new Set<string>()
      assDocs.forEach(d => {
        const a = d.data() as any
        if (a.applicationId) takenIds.add(String(a.applicationId))
        if (a.participantId) takenIds.add(String(a.participantId)) // legacy
        if (a.recipientEmail)
          takenEmails.add(String(a.recipientEmail).toLowerCase())
      })

      setAlreadyAssignedIds(takenIds)
      setAlreadyAssignedEmails(takenEmails)

      // Default select ONLY those who are eligible (not already sent by id or email)
      const selectable = list
        .filter(a => !takenIds.has(a.id) && !takenEmails.has(a.email))
        .map(a => a.id)

      setSelectedIds(selectable)
      setSelectAll(selectable.length > 0 && selectable.length === list.length)
      setAllAlreadyAssigned(selectable.length === 0 && list.length > 0)
    } catch (e) {
      console.error(e)
      message.error('Failed to load recipients')
    }
  }

  // Transactional send with deterministic ID to prevent duplicates
  const sendAssignments = async () => {
    if (!sendTemplate) return
    if (selectedIds.length === 0)
      return message.error('Select at least one recipient')

    try {
      setSending(true)
      const now = new Date().toISOString()
      const selected = applicants.filter(a => selectedIds.includes(a.id))

      const results = await Promise.all(
        selected.map(async a => {
          const assignmentId = makeAssignmentId(sendTemplate.id!, a.id)
          const ref = doc(db, 'formAssignments', assignmentId)
          try {
            await runTransaction(db, async tx => {
              const snap = await tx.get(ref)
              if (snap.exists()) throw new Error('ALREADY_EXISTS')
              const linkToken = generateToken()
              const payload = pruneUndefinedDeep({
                templateId: sendTemplate.id,
                applicationId: a.id,
                recipientEmail: a.email,
                status: 'pending',
                // 👇 forced in-app delivery
                deliveryMethod: 'in_app',
                linkToken,
                createdAt: now,
                createdBy: user?.email || '',
                companyCode: user?.companyCode || ''
              })
              tx.set(ref, payload as any)
            })
            return { ok: true }
          } catch (err: any) {
            return {
              ok: false,
              reason: err?.message === 'ALREADY_EXISTS' ? 'already' : 'error'
            }
          }
        })
      )

      const ok = results.filter(r => r.ok).length
      const dup = results.filter(r => r.reason === 'already').length
      const fail = results.filter(r => r.reason === 'error').length

      if (ok) message.success(`Sent to ${ok} recipient(s).`)
      if (dup) message.info(`${dup} skipped (already sent).`)
      if (fail) message.error(`${fail} failed.`)

      setSendOpen(false)
      setSendTemplate(null)
    } catch (e) {
      console.error(e)
      message.error('Failed to send form')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <DashboardHeaderCard
        title='Form Templates'
        subtitle='Build, preview and publish forms.'
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
        okButtonProps={{
          loading: sending,
          disabled: sending || selectedIds.length === 0
        }}
        width={700}
      >
        <Space direction='vertical' style={{ width: '100%' }}>
          {allAlreadyAssigned && (
            <Alert
              type='warning'
              showIcon
              message='All incubatees have already received this survey.'
              description='No participants are selectable. Close this dialog or pick a different template/cohort.'
            />
          )}

          <MotionCard size='small' title='Delivery'>
            <Alert
              type='info'
              showIcon
              message='Delivery method: In-app'
              description='Recipients will see the form inside their portal.'
            />
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
                disabled={allAlreadyAssigned}
                onChange={e => {
                  const checked = e.target.checked
                  setSelectAll(checked)
                  const available = applicants
                    .filter(
                      a =>
                        !alreadyAssignedIds.has(a.id) &&
                        !alreadyAssignedEmails.has(a.email)
                    )
                    .map(a => a.id)
                  setSelectedIds(checked ? available : [])
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
                applicants.map(a => {
                  const disabled =
                    alreadyAssignedIds.has(a.id) ||
                    alreadyAssignedEmails.has(a.email)
                  const checked = selectedIds.includes(a.id)
                  return (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '6px 0',
                        opacity: disabled ? 0.6 : 1
                      }}
                    >
                      <Checkbox
                        disabled={disabled || allAlreadyAssigned}
                        checked={checked}
                        onChange={e => {
                          const next = new Set(selectedIds)
                          e.target.checked ? next.add(a.id) : next.delete(a.id)
                          setSelectedIds([...next])
                          const selectableCount = applicants.filter(
                            x =>
                              !alreadyAssignedIds.has(x.id) &&
                              !alreadyAssignedEmails.has(x.email)
                          ).length
                          setSelectAll(
                            next.size === selectableCount && selectableCount > 0
                          )
                        }}
                      />
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}
                        >
                          <strong>{a.name}</strong>
                          {disabled && <Tag color='gold'>Already sent</Tag>}
                        </div>
                        <div style={{ color: 'rgba(0,0,0,.45)' }}>
                          {a.email}
                        </div>
                      </div>
                    </div>
                  )
                })
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
