import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    Card,
    Form,
    Input,
    Button,
    Select,
    Switch,
    Typography,
    Space,
    Divider,
    message as antdMessage,
    Tooltip,
    Modal,
    List,
    Tag,
    Badge,
    Radio,
    Checkbox,
    DatePicker,
    Upload,
    Rate,
    App
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
    SearchOutlined
} from '@ant-design/icons'
import {
    doc,
    collection,
    addDoc,
    updateDoc,
    getDoc,
    getDocs,
    query,
    where,
    runTransaction
} from 'firebase/firestore'
import { db } from '@/firebase'
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult
} from '@hello-pangea/dnd'
import { MotionCard } from '../shared/Header'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'

const { Title, Text } = Typography
const { Option } = Select

// ---------- Models ----------
interface FormField {
    id: string
    type: string
    label: string
    name?: string // internal only, auto-generated on save
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
]

const PRESET_QUESTIONS: { label: string; type: string }[] = [
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

const makeAssignmentId = (templateId: string, applicationId: string) =>
    `${templateId}__${applicationId}`

// ---------- Add Field Modal ----------
type AddFieldModalProps = {
    open: boolean
    onClose: () => void
    onAdd: (type: string, label?: string) => void
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
                    <Button icon={<CopyOutlined />}>Upload File</Button>
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
                                <Badge
                                    color='blue'
                                    text={
                                        FIELD_TYPES.find(t => t.value === field.type)?.label ||
                                        field.type
                                    }
                                />
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

// ---------- Settings Panel ----------
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

// ---------- Main ----------
export default function FormBuilder() {
    const { message } = App.useApp()
    const { user } = useFullIdentity()

    const [activeTab] = useState('builder') // left for future
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [templateLoading, setTemplateLoading] = useState(false)
    const [templateList, setTemplateList] = useState<FormTemplate[]>([])
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
        null
    )

    const [addModalOpen, setAddModalOpen] = useState(false)
    const [isPreviewVisible, setIsPreviewVisible] = useState(false)

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

    const [formData, setFormData] = useState<FormTemplate>({
        title: '',
        description: '',
        fields: [],
        status: 'draft',
        category: 'Evaluation Form',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    })

    // metrics
    const [metrics, setMetrics] = useState({
        total: 0,
        drafts: 0,
        published: 0,
        sentOut: 0
    })

    // per-template assignment counts
    const [assignmentCounts, setAssignmentCounts] = useState<
        Record<string, { sent: number; responded: number }>
    >({})

    // disable already sent
    const [alreadyAssignedIds, setAlreadyAssignedIds] = useState<Set<string>>(
        new Set()
    )
    const [alreadyAssignedEmails, setAlreadyAssignedEmails] = useState<
        Set<string>
    >(new Set())

    // track which card is selected
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)

    // ---------- helpers ----------
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

    const generateToken = () =>
        Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

    // ---------- field ops ----------
    const changeFieldType = (id: string, type: string) => {
        setFormData(prev => ({
            ...prev,
            fields: prev.fields.map(f => {
                if (f.id !== id) return f
                const updates: Partial<FormField> = { type }
                if (type === 'select' || type === 'checkbox' || type === 'radio') {
                    updates.options =
                        f.options && f.options.length ? f.options : ['Option 1', 'Option 2']
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

    const changeFieldLabel = (id: string, label: string) => {
        setFormData(prev => ({
            ...prev,
            fields: prev.fields.map(f => (f.id === id ? { ...f, label } : f))
        }))
    }

    const duplicateField = (id: string) => {
        const f = formData.fields.find(x => x.id === id)
        if (!f) return
        const copy: FormField = {
            ...f,
            id: generateId(),
            label: `${f.label} (Copy)`
        }
        setFormData(prev => ({ ...prev, fields: [...prev.fields, copy] }))
    }

    const removeField = (id: string) => {
        setFormData(prev => ({
            ...prev,
            fields: prev.fields.filter(f => f.id !== id)
        }))
        if (selectedFieldId === id) setSelectedFieldId(null)
    }

    const moveField = (id: string, dir: 'up' | 'down') => {
        const i = formData.fields.findIndex(f => f.id === id)
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

    // ---------- persistence ----------
    const saveTemplate = async (status?: 'draft' | 'published') => {
        if (!formData.title.trim()) return message.error('Give your form a title.')
        if (formData.fields.length === 0)
            return message.error('Add at least one field.')

        const payloadRaw: FormTemplate = withGeneratedNames({
            ...formData,
            status: status ?? formData.status,
            updatedAt: new Date().toISOString(),
            createdBy: user?.email || formData.createdBy
        })

        const payload = pruneUndefinedDeep(payloadRaw) as FormTemplate

        try {
            setSavingTemplate(true)
            if (editingTemplateId) {
                await updateDoc(
                    doc(db, 'formTemplates', editingTemplateId),
                    payload as any
                )
                message.success('Form template updated')
            } else {
                const created = await addDoc(
                    collection(db, 'formTemplates'),
                    payload as any
                )
                setEditingTemplateId(created.id)
                message.success('Form template saved')
            }
            setFormData(prev => ({ ...prev, status: payload.status }))
            fetchTemplates()
        } catch (e) {
            console.error(e)
            message.error('Failed to save template')
        } finally {
            setSavingTemplate(false)
        }
    }

    const publishForm = async () => saveTemplate('published')

    const loadTemplate = async (templateId: string) => {
        try {
            setTemplateLoading(true)
            const ref = doc(db, 'formTemplates', templateId)
            const ds = await getDoc(ref)
            if (!ds.exists()) return message.error('Template not found')
            const tpl = ds.data() as FormTemplate
            setFormData({ ...tpl, id: templateId })
            setEditingTemplateId(templateId)
            setSelectedFieldId(null)
        } catch (e) {
            console.error(e)
            message.error('Failed to load template')
        } finally {
            setTemplateLoading(false)
        }
    }

    const openSendModal = async (template: FormTemplate) => {
        setSendTemplate(template)
        setSendOpen(true)
        try {
            // Load recipients (accepted) for this company
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
                    name: data.fullName || 'Unnamed',
                    email: (data.email || '').toLowerCase()
                })
            })
            setApplicants(list)

            // Existing assignments for this template *for this company*
            const qAss = query(
                collection(db, 'formAssignments'),
                where('templateId', '==', template.id),
                where('companyCode', '==', user.companyCode)
            )
            const assSnap = await getDocs(qAss)

            const takenIds = new Set<string>()
            const takenEmails = new Set<string>()

            assSnap.forEach(d => {
                const a = d.data() as any
                if (a.applicationId) takenIds.add(a.applicationId)
                if (a.participantId) takenIds.add(a.participantId) // legacy
                if (a.recipientEmail)
                    takenEmails.add(String(a.recipientEmail).toLowerCase())
            })

            setAlreadyAssignedIds(takenIds)
            setAlreadyAssignedEmails(takenEmails)

            // Default select: only those not already assigned (by id or email)
            const selectable = list
                .filter(a => !takenIds.has(a.id) && !takenEmails.has(a.email))
                .map(a => a.id)

            setSelectedIds(selectable)
            setSelectAll(selectable.length > 0 && selectable.length === list.length)
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

            const results = await Promise.all(
                selected.map(async a => {
                    const assignmentId = makeAssignmentId(sendTemplate.id!, a.id)
                    const ref = doc(db, 'formAssignments', assignmentId)

                    try {
                        await runTransaction(db, async tx => {
                            const snap = await tx.get(ref)
                            if (snap.exists()) {
                                throw new Error('ALREADY_EXISTS')
                            }
                            const linkToken = generateToken()
                            const payload = pruneUndefinedDeep({
                                templateId: sendTemplate.id,
                                applicationId: a.id,
                                recipientEmail: a.email,
                                status: 'pending',
                                deliveryMethod,
                                linkToken,
                                createdAt: now,
                                createdBy: user?.email || '',
                                companyCode: user?.companyCode || ''
                            })
                            tx.set(ref, payload as any)
                        })
                        return { ok: true, name: a.name }
                    } catch (e: any) {
                        if (e?.message === 'ALREADY_EXISTS') {
                            return { ok: false, name: a.name, reason: 'already sent' }
                        }
                        return { ok: false, name: a.name, reason: 'error' }
                    }
                })
            )

            const okCount = results.filter(r => r.ok).length
            const dupCount = results.filter(r => r.reason === 'already sent').length
            const errCount = results.filter(r => r.reason === 'error').length

            if (okCount) message.success(`Sent to ${okCount} recipient(s).`)
            if (dupCount) message.info(`${dupCount} skipped (already sent).`)
            if (errCount) message.error(`${errCount} failed.`)

            setSendOpen(false)
            setSendTemplate(null)
            fetchTemplates() // refresh counts
        } catch (e) {
            console.error(e)
            message.error('Failed to send form')
        } finally {
            setSending(false)
        }
    }

    const createNewForm = () => {
        setFormData({
            title: '',
            description: '',
            fields: [],
            status: 'draft',
            category: 'Evaluation Form',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })
        setEditingTemplateId(null)
        setSelectedFieldId(null)
    }

    // ---------- counts ----------
    const fetchTemplates = async () => {
        try {
            setTemplateLoading(true)

            // 1) Templates (optionally scope to company via createdBy/companyCode if you store it there)
            const snap = await getDocs(collection(db, 'formTemplates'))
            const templates: FormTemplate[] = []
            snap.forEach(d =>
                templates.push({ id: d.id, ...(d.data() as FormTemplate) })
            )

            const total = templates.length
            const drafts = templates.filter(t => t.status === 'draft').length
            const published = templates.filter(t => t.status === 'published').length

            // 2) Assignments for *this company* only
            //    (some older docs might miss companyCode — we’ll handle that below with a fallback)
            const assQ = query(
                collection(db, 'formAssignments'),
                where('companyCode', '==', user.companyCode)
            )
            const assSnap = await getDocs(assQ)

            // If your old docs didn’t have companyCode set, uncomment this fallback:
            const assSnapAll = await getDocs(collection(db, 'formAssignments'))
            const mergedDocs = [
                ...assSnap.docs,
                ...assSnapAll.docs.filter(d => !assSnap.docs.find(x => x.id === d.id))
            ]

            const mapCounts: Record<string, { sent: number; responded: number }> = {}
            const seenPairs = new Set<string>() // de-dup per (templateId, recipient)

            assSnap.forEach(ds => {
                const data = ds.data() as any
                const tId = data.templateId
                if (!tId) return

                // unify recipient identity
                const rid =
                    data.applicationId || data.participantId || data.recipientEmail
                if (!rid) return

                const pairKey = `${tId}__${rid}`
                if (seenPairs.has(pairKey)) return
                seenPairs.add(pairKey)

                if (!mapCounts[tId]) mapCounts[tId] = { sent: 0, responded: 0 }
                mapCounts[tId].sent += 1
                if (data.status === 'completed') mapCounts[tId].responded += 1
            })

            setTemplateList(templates)
            setAssignmentCounts(mapCounts)
            // “Sent out” = sum across templates *after* de-dup
            const sentOut = Object.values(mapCounts).reduce((a, b) => a + b.sent, 0)
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ---------- UI chunks ----------
    const renderTemplateLibrary = () => (
        <div>
            <div
                style={{
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between'
                }}
            >
                <Title level={4}>Form Templates</Title>
                <Button type='primary' icon={<PlusOutlined />} onClick={createNewForm}>
                    Create New Form
                </Button>
            </div>

            <div
                style={{
                    marginBottom: 12,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 12
                }}
            >
                <MotionCard size='small'>
                    <Title level={5} style={{ margin: 0 }}>
                        Total
                    </Title>
                    <div style={{ fontSize: 22 }}>{metrics.total}</div>
                </MotionCard>
                <Card size='small'>
                    <Title level={5} style={{ margin: 0 }}>
                        Drafts
                    </Title>
                    <div style={{ fontSize: 22 }}>{metrics.drafts}</div>
                </Card>
                <Card size='small'>
                    <Title level={5} style={{ margin: 0 }}>
                        Published
                    </Title>
                    <div style={{ fontSize: 22 }}>{metrics.published}</div>
                </Card>
                <Card size='small'>
                    <Title level={5} style={{ margin: 0 }}>
                        Sent out
                    </Title>
                    <div style={{ fontSize: 22 }}>{metrics.sentOut}</div>
                </Card>
            </div>

            <List
                loading={templateLoading}
                itemLayout='horizontal'
                dataSource={templateList}
                renderItem={tpl => {
                    const counts = assignmentCounts[tpl.id || ''] || {
                        sent: 0,
                        responded: 0
                    }
                    return (
                        <List.Item
                            actions={[
                                <Button key='send' onClick={() => openSendModal(tpl)}>
                                    Send
                                </Button>,
                                <Button key='edit' onClick={() => loadTemplate(tpl.id!)}>
                                    Edit
                                </Button>,
                                <Button
                                    key='preview'
                                    onClick={() => {
                                        setFormData(tpl)
                                        setIsPreviewVisible(true)
                                    }}
                                >
                                    Preview
                                </Button>
                            ]}
                        >
                            <List.Item.Meta
                                title={
                                    <Space wrap>
                                        {tpl.title}
                                        <Tag
                                            color={tpl.status === 'published' ? 'green' : 'orange'}
                                        >
                                            {tpl.status === 'published' ? 'Published' : 'Draft'}
                                        </Tag>
                                        <Tag>
                                            Sent: <b style={{ marginLeft: 4 }}>{counts.sent}</b>
                                        </Tag>
                                        <Tag color='blue'>
                                            Responded:{' '}
                                            <b style={{ marginLeft: 4 }}>
                                                {counts.responded}/{counts.sent}
                                            </b>
                                        </Tag>
                                    </Space>
                                }
                                description={
                                    <div>
                                        <div>{tpl.description}</div>
                                        <div style={{ marginTop: 8 }}>
                                            <Text type='secondary'>
                                                Category: {tpl.category} • Fields: {tpl.fields.length} •
                                                Updated: {new Date(tpl.updatedAt).toLocaleDateString()}
                                            </Text>
                                        </div>
                                    </div>
                                }
                            />
                        </List.Item>
                    )
                }}
            />

            <Modal
                title={`Send: ${sendTemplate?.title || ''}`}
                open={sendOpen}
                onCancel={() => setSendOpen(false)}
                onOk={sendAssignments}
                okButtonProps={{ loading: sending }}
                width={700}
            >
                <Space direction='vertical' style={{ width: '100%' }}>
                    <Card size='small' title='Delivery'>
                        <Radio.Group
                            value={deliveryMethod}
                            onChange={e => setDeliveryMethod(e.target.value)}
                        >
                            <Radio.Button value='in_app'>In-app assignment</Radio.Button>
                            <Radio.Button value='email'>Email link</Radio.Button>
                        </Radio.Group>
                        <div style={{ marginTop: 8, color: 'rgba(0,0,0,.45)' }}>
                            {deliveryMethod === 'in_app'
                                ? 'Recipients will see the form in their portal.'
                                : 'Recipients get an email link to the portal form.'}
                        </div>
                    </Card>

                    <Card size='small' title='Recipients'>
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
                                    const available = applicants
                                        .filter(a => !alreadyAssignedIds.has(a.id))
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
                                                disabled={disabled}
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
                    </Card>
                </Space>
            </Modal>
        </div>
    )

    const PreviewModal = (
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
    )

    return (
        <div style={{ minHeight: '100vh' }}>
            {renderTemplateLibrary()}
            {PreviewModal}
        </div>
    )
}
