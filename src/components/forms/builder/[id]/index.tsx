// FormBuilderPage.tsx
'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Card,
  Form,
  Input,
  Button,
  Select,
  Switch,
  Typography,
  Space,
  Divider,
  Tooltip,
  Modal,
  Radio,
  Checkbox,
  DatePicker,
  Upload,
  Rate,
  Spin
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EyeOutlined,
  SaveOutlined,
  DragOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  PaperClipOutlined
} from '@ant-design/icons'
import { doc, collection, addDoc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from '@hello-pangea/dnd'
import { useNavigate, useParams } from 'react-router-dom'

const { Title, Text } = Typography
const { Option } = Select

// ---------- Models ----------
interface FormField {
  id: string
  type: string
  label: string
  name?: string
  placeholder?: string
  required: boolean
  options?: string[]
  description?: string
  defaultValue?: any
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

// ---------- Constants ----------
const FIELD_TYPES = [
  { value: 'text', label: 'Text Field' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox Group' },
  { value: 'radio', label: 'Radio Group' },
  { value: 'date', label: 'Date Picker' },
  { value: 'file', label: 'File Upload' },
  { value: 'rating', label: 'Rating (Stars)' },
  { value: 'heading', label: 'Section Heading' }
] as const

const FORM_CATEGORIES = ['Evaluation Form', 'Feedback Form'] as const

const PRESET_QUESTIONS: {
  label: string
  type: typeof FIELD_TYPES[number]['value']
}[] = [
  { type: 'text', label: 'Full Name' },
  { type: 'email', label: 'Email Address' },
  { type: 'number', label: 'Phone Number' },
  { type: 'textarea', label: 'Describe your business' },
  { type: 'select', label: 'Business sector' },
  { type: 'date', label: 'Date of registration' },
  { type: 'checkbox', label: 'Compliance documents provided' },
  { type: 'radio', label: 'Registered for VAT?' },
  { type: 'file', label: 'Upload Company Documents' },
  { type: 'rating', label: 'Rate Our Services' },
  { type: 'heading', label: 'Section Heading' }
]

const generateId = () => Math.random().toString(36).substring(2, 9)
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

// ---------- Add Field Modal ----------
type AddFieldModalProps = {
  open: boolean
  onClose: () => void
  onAdd: (type: FormField['type'], label?: string) => void
}
const AddFieldModal: React.FC<AddFieldModalProps> = ({
  open,
  onClose,
  onAdd
}) => {
  const [search, setSearch] = useState('')
  const filteredTypes = useMemo(
    () =>
      FIELD_TYPES.filter(t =>
        t.label.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  )
  const filteredPresets = useMemo(
    () =>
      PRESET_QUESTIONS.filter(q =>
        q.label.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  )

  return (
    <Modal
      title='Add Field'
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
    >
      <Input
        placeholder='Search field types or presets...'
        prefix={<SearchOutlined />}
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card size='small' title='Field Types'>
          <Space direction='vertical' style={{ width: '100%' }}>
            {filteredTypes.map(t => (
              <Button
                key={t.value}
                block
                icon={<PlusOutlined />}
                onClick={() => onAdd(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </Space>
        </Card>
        <Card size='small' title='Common Questions'>
          <Space direction='vertical' style={{ width: '100%' }}>
            {filteredPresets.map(q => (
              <Button
                key={`${q.type}-${q.label}`}
                block
                onClick={() => onAdd(q.type, q.label)}
              >
                {q.label}
              </Button>
            ))}
          </Space>
        </Card>
      </div>
    </Modal>
  )
}

// ---------- Field Preview ----------
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

// ---------- Field Card ----------
const FieldCard: React.FC<{
  field: FormField
  index: number
  selected: boolean
  onSelect: (id: string) => void
  onChangeType: (id: string, type: string) => void
  onChangeLabel: (id: string, label: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, dir: 'up' | 'down') => void
  dragHandleProps?: any
  draggableProps?: any
  innerRef?: (el: HTMLDivElement | null) => void
}> = React.memo(
  ({
    field,
    index,
    selected,
    onSelect,
    onChangeType,
    onChangeLabel,
    onDuplicate,
    onDelete,
    onMove,
    dragHandleProps,
    draggableProps,
    innerRef
  }) => {
    return (
      <div
        ref={innerRef}
        {...draggableProps}
        onClick={() => onSelect(field.id)}
        style={{
          marginBottom: 12,
          borderRadius: 8,
          outline: selected ? '2px solid #1677ff' : 'none',
          ...draggableProps?.style
        }}
      >
        <Card
          size='small'
          bodyStyle={{ padding: 16 }}
          title={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span {...dragHandleProps} style={{ cursor: 'grab' }}>
                  <DragOutlined />
                </span>
                <Input
                  size='small'
                  value={field.label}
                  onChange={e => onChangeLabel(field.id, e.target.value)}
                  style={{ width: 260 }}
                  placeholder='Question label'
                />
                <Select
                  size='small'
                  value={field.type}
                  onChange={v => onChangeType(field.id, v)}
                  style={{ width: 180 }}
                >
                  {FIELD_TYPES.map(t => (
                    <Option key={t.value} value={t.value}>
                      {t.label}
                    </Option>
                  ))}
                </Select>
              </div>
              <Space size='small'>
                <Tooltip title='Move up'>
                  <Button
                    size='small'
                    onClick={() => onMove(field.id, 'up')}
                    icon={<ArrowUpOutlined />}
                  />
                </Tooltip>
                <Tooltip title='Move down'>
                  <Button
                    size='small'
                    onClick={() => onMove(field.id, 'down')}
                    icon={<ArrowDownOutlined />}
                  />
                </Tooltip>
                <Tooltip title='Duplicate'>
                  <Button
                    size='small'
                    onClick={() => onDuplicate(field.id)}
                    icon={<CopyOutlined />}
                  />
                </Tooltip>
                <Tooltip title='Delete'>
                  <Button
                    size='small'
                    danger
                    onClick={() => onDelete(field.id)}
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Space>
            </div>
          }
        >
          <Form layout='vertical'>
            {field.type !== 'heading' ? (
              <Form.Item
                label={field.label}
                required={field.required}
                help={field.description}
              >
                <FieldPreview field={field} />
              </Form.Item>
            ) : (
              <div style={{ paddingTop: 6 }}>
                <FieldPreview field={field} />
              </div>
            )}
          </Form>
        </Card>
      </div>
    )
  }
)

// ---------- Field Settings Panel ----------
const FieldSettingsPanel: React.FC<{
  field?: FormField
  onPatch: (updates: Partial<FormField>) => void
  onPatchOptions: (options: string[]) => void
}> = ({ field, onPatch, onPatchOptions }) => {
  if (!field) {
    return (
      <Card
        size='small'
        title='Field Settings'
        style={{ position: 'sticky', top: 12 }}
      >
        <Text type='secondary'>Select a field to edit its settings.</Text>
      </Card>
    )
  }

  const isOptionsType =
    field.type === 'select' ||
    field.type === 'radio' ||
    field.type === 'checkbox'

  return (
    <Card
      size='small'
      title='Field Settings'
      style={{ position: 'sticky', top: 12 }}
    >
      <Form layout='vertical' size='small'>
        <Form.Item label='Label'>
          <Input
            value={field.label}
            onChange={e => onPatch({ label: e.target.value })}
          />
        </Form.Item>

        {field.type !== 'heading' &&
          field.type !== 'checkbox' &&
          field.type !== 'radio' &&
          field.type !== 'rating' && (
            <Form.Item label='Placeholder'>
              <Input
                value={field.placeholder}
                onChange={e => onPatch({ placeholder: e.target.value })}
              />
            </Form.Item>
          )}

        {field.type !== 'heading' && (
          <Form.Item label='Required'>
            <Switch
              checked={field.required}
              onChange={checked => onPatch({ required: checked })}
            />
          </Form.Item>
        )}

        <Form.Item label='Help text'>
          <Input.TextArea
            rows={2}
            value={field.description}
            onChange={e => onPatch({ description: e.target.value })}
          />
        </Form.Item>

        {isOptionsType && (
          <Form.Item label='Options'>
            {(field.options || []).map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <Input
                  value={opt}
                  onChange={e => {
                    const next = [...(field.options || [])]
                    next[i] = e.target.value
                    onPatchOptions(next)
                  }}
                />
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    const next = [...(field.options || [])]
                    next.splice(i, 1)
                    onPatchOptions(next)
                  }}
                />
              </div>
            ))}
            <Button
              block
              type='dashed'
              icon={<PlusOutlined />}
              onClick={() =>
                onPatchOptions([
                  ...(field.options || []),
                  `Option ${(field.options?.length || 0) + 1}`
                ])
              }
            >
              Add option
            </Button>
          </Form.Item>
        )}
      </Form>
    </Card>
  )
}

// ---------- Page ----------
export default function FormBuilderPage () {
  const { message } = App.useApp()
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(!!id)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormTemplate>({
    title: '',
    description: '',
    fields: [],
    status: 'draft',
    category: 'Evaluation Form',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  const initialSnapshotRef = useRef<string>('')

  // Load template if editing
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!id) return
      try {
        setLoading(true)
        const ref = doc(db, 'formTemplates', id)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          message.error('Template not found')
          navigate('/forms/templates')
          return
        }
        const tpl = snap.data() as FormTemplate
        if (!mounted) return
        setFormData({ ...tpl, id })
        initialSnapshotRef.current = JSON.stringify(
          pruneUndefinedDeep({ ...tpl, id })
        )
      } catch (e) {
        console.error(e)
        message.error('Failed to load template')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id, message, navigate])

  const isDirty = useMemo(() => {
    const current = JSON.stringify(pruneUndefinedDeep(formData))
    return (
      current !==
      (initialSnapshotRef.current ||
        JSON.stringify(
          pruneUndefinedDeep({
            ...formData,
            id: undefined // new template has no initial snapshot
          })
        ))
    )
  }, [formData])

  // Field ops
  const addField = (type: FormField['type'], presetLabel?: string) => {
    const newField: FormField = {
      id: generateId(),
      type,
      label: presetLabel || (type === 'heading' ? 'Section' : 'New Field'),
      required: false,
      placeholder: [
        'text',
        'textarea',
        'number',
        'email',
        'select',
        'radio'
      ].includes(type)
        ? 'Enter value...'
        : undefined,
      options: ['select', 'checkbox', 'radio'].includes(type)
        ? ['Option 1', 'Option 2']
        : undefined
    }
    setFormData(prev => ({ ...prev, fields: [...prev.fields, newField] }))
    setSelectedFieldId(newField.id)
  }

  const changeFieldType = (fid: string, type: string) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map(f => {
        if (f.id !== fid) return f
        const updates: Partial<FormField> = { type }
        if (type === 'select' || type === 'checkbox' || type === 'radio') {
          updates.options = f.options?.length
            ? f.options
            : ['Option 1', 'Option 2']
        } else if (type === 'heading' || type === 'rating') {
          updates.placeholder = undefined
          updates.options = undefined
        } else {
          updates.options = undefined
        }
        return { ...f, ...updates }
      })
    }))
  }

  const changeFieldLabel = (fid: string, label: string) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map(f => (f.id === fid ? { ...f, label } : f))
    }))
  }

  const duplicateField = (fid: string) => {
    const f = formData.fields.find(x => x.id === fid)
    if (!f) return
    const copy: FormField = {
      ...f,
      id: generateId(),
      label: `${f.label} (Copy)`
    }
    setFormData(prev => ({ ...prev, fields: [...prev.fields, copy] }))
  }

  const removeField = (fid: string) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== fid)
    }))
    if (selectedFieldId === fid) setSelectedFieldId(null)
  }

  const moveField = (fid: string, dir: 'up' | 'down') => {
    const i = formData.fields.findIndex(f => f.id === fid)
    if (i < 0) return
    const j = dir === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= formData.fields.length) return
    const next = [...formData.fields]
    const [m] = next.splice(i, 1)
    next.splice(j, 0, m)
    setFormData(prev => ({ ...prev, fields: next }))
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const src = result.source.index
    const dst = result.destination.index
    if (src === dst) return
    const next = [...formData.fields]
    const [moved] = next.splice(src, 1)
    next.splice(dst, 0, moved)
    setFormData(prev => ({ ...prev, fields: next }))
  }

  // Save / Publish
  const withGeneratedNames = (tpl: FormTemplate): FormTemplate => {
    const fields = tpl.fields.map((f, idx) => ({
      ...f,
      name:
        f.name && f.name.length > 0
          ? f.name
          : sanitizeName(f.label || `field_${idx + 1}`)
    }))
    return { ...tpl, fields }
  }

  const saveTemplate = async (status?: 'draft' | 'published') => {
    if (!formData.title.trim()) return message.error('Give your form a title.')
    if (formData.fields.length === 0)
      return message.error('Add at least one field.')

    const raw: FormTemplate = withGeneratedNames({
      ...formData,
      status: status ?? formData.status,
      updatedAt: new Date().toISOString()
    })
    const payload = pruneUndefinedDeep(raw) as FormTemplate

    try {
      setSavingTemplate(true)
      if (formData.id) {
        await updateDoc(doc(db, 'formTemplates', formData.id), payload as any)
        message.success('Form template updated')
      } else {
        const created = await addDoc(
          collection(db, 'formTemplates'),
          payload as any
        )
        setFormData(prev => ({ ...prev, id: created.id }))
        message.success('Form template saved')
      }
      initialSnapshotRef.current = JSON.stringify(
        pruneUndefinedDeep({ ...payload })
      ) // reset dirty
    } catch (e) {
      console.error(e)
      message.error('Failed to save template')
    } finally {
      setSavingTemplate(false)
    }
  }

  const publishForm = async () => saveTemplate('published')

  // Back to templates with draft prompt
  const confirmBack = () => {
    if (!isDirty) {
      navigate('/forms/templates')
      return
    }
    Modal.confirm({
      title: 'Leave builder?',
      content: 'You have unsaved changes. Save this as a draft before leaving?',
      okText: 'Save as Draft',
      cancelText: 'Discard',
      onOk: async () => {
        await saveTemplate('draft')
        navigate('/forms/templates')
      },
      onCancel: () => {
        navigate('/forms/templates')
      }
    })
  }

  // Panels
  const selectedField = formData.fields.find(f => f.id === selectedFieldId)

  const LeftPanel = (
    <div style={{ position: 'sticky', top: 12 }}>
      <Card
        size='small'
        style={{
          marginBottom: 12,
          position: 'sticky',
          top: 12,
          zIndex: 2,
          background: '#fff'
        }}
      >
        {formData.fields.length === 0 ? (
          <Text type='secondary'>No questions yet.</Text>
        ) : (
          <div>
            {formData.fields.map((f, idx) => (
              <div
                key={f.id}
                onClick={() => setSelectedFieldId(f.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: selectedFieldId === f.id ? '#f0f5ff' : undefined
                }}
              >
                <Tag>{idx + 1}</Tag>
                <span
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {f.label || '(no label)'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        size='small'
        style={{
          marginBottom: 12,
          position: 'sticky',
          top: 32,
          zIndex: 2,
          background: '#fff'
        }}
        title='Form Settings'
      >
        <Form layout='vertical' size='small'>
          <Form.Item label='Title' required>
            <Input
              value={formData.title}
              onChange={e =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder='Enter form title'
            />
          </Form.Item>
          <Form.Item label='Description'>
            <Input.TextArea
              rows={3}
              value={formData.description}
              onChange={e =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </Form.Item>
          <Form.Item label='Category'>
            <Select
              value={formData.category}
              onChange={v => setFormData({ ...formData, category: v })}
            >
              {FORM_CATEGORIES.map(c => (
                <Option key={c} value={c}>
                  {c}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )

  const RightPanel = (
    <FieldSettingsPanel
      field={selectedField || undefined}
      onPatch={updates => {
        if (!selectedField) return
        setFormData(prev => ({
          ...prev,
          fields: prev.fields.map(f =>
            f.id === selectedField.id ? { ...f, ...updates } : f
          )
        }))
      }}
      onPatchOptions={options => {
        if (!selectedField) return
        setFormData(prev => ({
          ...prev,
          fields: prev.fields.map(f =>
            f.id === selectedField.id ? { ...f, options } : f
          )
        }))
      }}
    />
  )

  const BuilderCenter = (
    <>
      <Card
        size='small'
        style={{
          marginBottom: 12,
          position: 'sticky',
          top: 12,
          zIndex: 3,
          background: '#fff'
        }}
        bodyStyle={{ padding: 12 }}
      >
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap'
          }}
        >
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={confirmBack}>
              Back to Templates
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => setAddModalOpen(true)}
            >
              Add Field
            </Button>
            <Button
              icon={<EyeOutlined />}
              onClick={() => setIsPreviewVisible(true)}
            >
              Preview
            </Button>
          </Space>
          <Space>
            <Button
              type='primary'
              icon={<SaveOutlined />}
              onClick={() => saveTemplate()}
              loading={savingTemplate}
            >
              Save Draft
            </Button>
            <Button
              type='primary'
              onClick={publishForm}
              loading={savingTemplate}
            >
              Publish
            </Button>
          </Space>
        </div>
      </Card>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId='canvas'>
          {provided => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{ minHeight: 60 }}
            >
              {formData.fields.length === 0 ? (
                <Card>No fields added yet</Card>
              ) : (
                formData.fields.map((f, i) => (
                  <Draggable key={f.id} draggableId={f.id} index={i}>
                    {dr => (
                      <FieldCard
                        field={f}
                        index={i}
                        selected={selectedFieldId === f.id}
                        onSelect={setSelectedFieldId}
                        onChangeType={changeFieldType}
                        onChangeLabel={changeFieldLabel}
                        onDuplicate={duplicateField}
                        onDelete={removeField}
                        onMove={moveField}
                        draggableProps={dr.draggableProps}
                        dragHandleProps={dr.dragHandleProps}
                        innerRef={dr.innerRef}
                      />
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </>
  )

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
        <Spin />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 320px',
          gap: 16
        }}
      >
        <div>{LeftPanel}</div>
        <div>{BuilderCenter}</div>
        <div>{RightPanel}</div>
      </div>

      {/* Add Field Modal */}
      <AddFieldModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={(type, label) => {
          addField(type, label)
          // keep modal open for rapid adding
        }}
      />

      {/* Preview */}
      <Modal
        title='Form Preview'
        open={isPreviewVisible}
        onCancel={() => setIsPreviewVisible(false)}
        footer={null}
        width={800}
      >
        <Title level={3}>{formData.title}</Title>
        <Text>{formData.description}</Text>
        <Divider />
        <Form layout='vertical'>
          {formData.fields.map((f, i) =>
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
      </Modal>
    </div>
  )
}
