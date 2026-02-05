import React, { useEffect, useMemo, useState } from 'react'
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
    Alert,
    Segmented,
    Collapse,
    Divider,
    Tooltip
} from 'antd'
import {
    EyeOutlined,
    EditOutlined,
    SendOutlined,
    FileTextOutlined,
    CheckCircleOutlined,
    PaperClipOutlined,
    InfoCircleOutlined,
    AppstoreOutlined,
    FormOutlined
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
import { Helmet } from 'react-helmet'
import dayjs from 'dayjs'


const { Title, Text } = Typography
const { Option } = Select

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
const makeAssignmentId = (templateId: string, recipientId: string) =>
    `${templateId}__${recipientId}`

const clampStyle = (lines = 2): React.CSSProperties => ({
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
})

const smartCut = (text: string, max = 220) => {
    const t = String(text || '').trim()
    if (t.length <= max) return t
    const slice = t.slice(0, max)
    const lastSpace = slice.lastIndexOf(' ')
    const cut = lastSpace > 80 ? slice.slice(0, lastSpace) : slice
    return cut.replace(/[.,;:\-–—\s]+$/, '') + '…'
}

const categoryLabel = (cat?: string) => {
    const v = String(cat || '').toLowerCase()

    if (v === 'general') return 'General'
    if (v === 'post_intervention') return 'Post-Intervention'

    // fallback for legacy/typos
    if (v === 'post-intervention') return 'Post-Intervention'
    if (v === 'postintervention') return 'Post-Intervention'

    // default: title case anything else
    return v
        ? v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : '—'
}


const toDateSafe = (v: any): Date | null => {
    if (!v) return null

    // Firestore Timestamp (has toDate)
    if (typeof v?.toDate === 'function') {
        const d = v.toDate()
        return d instanceof Date && !isNaN(d.getTime()) ? d : null
    }

    // Firestore-like { seconds, nanoseconds }
    if (typeof v?.seconds === 'number') {
        const ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6)
        const d = new Date(ms)
        return !isNaN(d.getTime()) ? d : null
    }

    // number (ms epoch)
    if (typeof v === 'number') {
        const d = new Date(v)
        return !isNaN(d.getTime()) ? d : null
    }

    // string (ISO or date string)
    if (typeof v === 'string') {
        const dj = dayjs(v)
        if (dj.isValid()) return dj.toDate()

        const d2 = new Date(v)
        return !isNaN(d2.getTime()) ? d2 : null
    }

    // Date object
    if (v instanceof Date) {
        return !isNaN(v.getTime()) ? v : null
    }

    // last resort
    const d = new Date(v)
    return !isNaN(d.getTime()) ? d : null
}

const formatDateSafe = (v: any, fallback = '—') => {
    const d = toDateSafe(v)
    if (!d) return fallback
    return d.toLocaleDateString()
}




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

// Surveys vs Assessments
const ASSESSMENT_CATEGORIES = new Set(['post_intervention', 'general'])
const isAssessmentCategory = (cat?: string) => ASSESSMENT_CATEGORIES.has(String(cat || ''))

// group fields by heading into sections for preview collapsibles
function groupFieldsForPreview(fields: FormField[]) {
    const sections: Array<{ title: string; items: FormField[] }> = []
    let current = { title: 'Questions', items: [] as FormField[] }

    for (const f of fields || []) {
        if (f.type === 'heading') {
            // push previous section if it has items
            if (current.items.length) sections.push(current)
            current = { title: f.label || 'Section', items: [] }
        } else {
            current.items.push(f)
        }
    }
    if (current.items.length) sections.push(current)
    return sections
}

export default function TemplatesPage() {
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

    const [descModal, setDescModal] = useState<{ title: string; desc: string } | null>(null)


    // Switch view (now: assessments not “assignment”)
    const [view, setView] = useState<'all' | 'survey' | 'assessment'>('all')

    const filtered = useMemo(() => {
        return templateList.filter(t => {
            if (view === 'all') return true
            if (view === 'assessment') return isAssessmentCategory(t.category)
            return !isAssessmentCategory(t.category)
        })
    }, [templateList, view])

    // preview
    const [previewTemplate, setPreviewTemplate] = useState<FormTemplate | null>(null)

    // send modal
    const [sendOpen, setSendOpen] = useState(false)
    const [sendTemplate, setSendTemplate] = useState<FormTemplate | null>(null)
    const [applicants, setApplicants] = useState<Array<{ id: string; name: string; email: string }>>(
        []
    )
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [selectAll, setSelectAll] = useState(false)
    const [sending, setSending] = useState(false)

    // already sent bookkeeping
    const [alreadyAssignedIds, setAlreadyAssignedIds] = useState<Set<string>>(new Set())
    const [alreadyAssignedEmails, setAlreadyAssignedEmails] = useState<Set<string>>(new Set())
    const [allAlreadyAssigned, setAllAlreadyAssigned] = useState(false)

    const isSuper =
        (user?.email || '').toLowerCase().endsWith('@quantilytix.co.za') ||
        (user?.role || '').toLowerCase() === 'superadmin'

    // data load
    const fetchTemplates = async () => {
        // guard BEFORE setting loading true (prevents infinite spinner)
        if (!user?.companyCode) {
            setTemplateList([])
            setMetrics({ total: 0, drafts: 0, published: 0, sentOut: 0 })
            return
        }

        setTemplateLoading(true)
        try {
            const q = query(
                collection(db, 'formTemplates'),
                where('companyCode', '==', user.companyCode)
            )

            const snap = await getDocs(q)

            const templates: FormTemplate[] = snap.docs.map(d => ({
                id: d.id,
                ...(d.data() as any),
            }))

            const toMs = (v: any) => (v?.toMillis ? v.toMillis() : (v ? new Date(v).getTime() : 0))
            templates.sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt))

            const total = templates.length
            const drafts = templates.filter(t => t.status === 'draft').length
            const published = templates.filter(t => t.status === 'published').length

            const assignmentsSnap = await getDocs(
                query(collection(db, 'formAssignments'), where('companyCode', '==', user.companyCode))
            )
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
    const goToNewSurvey = () => navigate('/operations/surveys/builder')
    const goToNewAssessment = () => navigate(`/${user?.role}/assessments/builder`) // adjust route if needed
    const goToEdit = (tpl: FormTemplate) => {
        // if you have separate editors, route based on type
        if (isAssessmentCategory(tpl.category)) return navigate(`/${user?.role}/assessments/builder/${tpl.id}`)
        return navigate(`/operations/surveys/builder/${tpl.id}`)
    }

    // OPEN SEND MODAL (still uses accepted apps; keep consistent with your current system)
    const openSendModal = async (template: FormTemplate) => {
        setSendTemplate(template)
        setSendOpen(true)
        try {
            const companyCode = user?.companyCode || ''

            // accepted apps for the company (super can see all)
            const qApps = isSuper
                ? query(collection(db, 'applications'), where('applicationStatus', '==', 'accepted'))
                : query(
                    collection(db, 'applications'),
                    where('applicationStatus', '==', 'accepted'),
                    where('companyCode', '==', companyCode)
                )

            const appsSnap = await getDocs(qApps)

            const list: Array<{ id: string; name: string; email: string }> = []
            appsSnap.forEach(d => {
                const data = d.data() as any
                // Use participantId if present, else fallback to app doc id
                const recipientId = String(data.participantId || d.id)
                list.push({
                    id: recipientId,
                    name: data.beneficiaryName || data.fullName || 'Unnamed',
                    email: String(data.email || '').toLowerCase()
                })
            })
            setApplicants(list)

            // assignments already created
            // already sent bookkeeping (split by template type)
            const isAssessment = isAssessmentCategory(template.category)

            const takenIds = new Set<string>()
            const takenEmails = new Set<string>()

            if (isAssessment) {
                // ✅ Assessments: check formRequests
                let reqSnap: any

                if (companyCode && !isSuper) {
                    reqSnap = await getDocs(
                        query(
                            collection(db, 'formRequests'),
                            where('templateId', '==', template.id),
                            where('companyCode', '==', companyCode)
                        )
                    )
                } else {
                    reqSnap = await getDocs(query(collection(db, 'formRequests'), where('templateId', '==', template.id)))
                }

                reqSnap.forEach((d: any) => {
                    const r = d.data() as any
                    if (r.participantId) takenIds.add(String(r.participantId))
                    if (r.participantEmail) takenEmails.add(String(r.participantEmail).toLowerCase())
                })
            } else {
                // ✅ Surveys: check formAssignments (existing)
                let assDocs: Array<any> = []
                if (companyCode && !isSuper) {
                    const qScoped = query(
                        collection(db, 'formAssignments'),
                        where('templateId', '==', template.id),
                        where('companyCode', '==', companyCode)
                    )
                    const scoped = await getDocs(qScoped)
                    assDocs = [...scoped.docs]
                }

                if (assDocs.length === 0) {
                    const qLegacy = query(collection(db, 'formAssignments'), where('templateId', '==', template.id))
                    const legacy = await getDocs(qLegacy)
                    assDocs = [...legacy.docs]
                }

                assDocs.forEach(d => {
                    const a = d.data() as any
                    if (a.recipientId) takenIds.add(String(a.recipientId))
                    if (a.applicationId) takenIds.add(String(a.applicationId))
                    if (a.participantId) takenIds.add(String(a.participantId))
                    if (a.recipientEmail) takenEmails.add(String(a.recipientEmail).toLowerCase())
                })
            }

            setAlreadyAssignedIds(takenIds)
            setAlreadyAssignedEmails(takenEmails)

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

    // Transactional send
    // Transactional send
    const sendAssignments = async () => {
        if (!sendTemplate?.id) return
        if (selectedIds.length === 0) return message.error('Select at least one recipient')

        const isAssessment = isAssessmentCategory(sendTemplate.category)

        try {
            setSending(true)
            const nowIso = new Date().toISOString()
            const selected = applicants.filter(a => selectedIds.includes(a.id))

            const results = await Promise.all(
                selected.map(async a => {
                    try {
                        if (isAssessment) {
                            // ✅ ASSESSMENT => formRequests (NOT formAssignments)
                            // You can keep deterministic id per (templateId + participantId) so resend becomes a no-op
                            const requestId = `${sendTemplate.id}__${a.id}`
                            const ref = doc(db, 'formRequests', requestId)

                            await runTransaction(db, async tx => {
                                const snap = await tx.get(ref)
                                if (snap.exists()) throw new Error('ALREADY_EXISTS')

                                const payload = pruneUndefinedDeep({
                                    templateId: sendTemplate.id,
                                    participantId: a.id,
                                    participantEmail: a.email,
                                    participantName: a.name,

                                    formTitle: sendTemplate.title,
                                    category: sendTemplate.category || 'general',
                                    companyCode: user?.companyCode || '',

                                    status: 'sent',
                                    deliveryMethod: 'in_app',
                                    sentAt: nowIso,
                                    createdAt: nowIso,
                                    updatedAt: nowIso,
                                    createdBy: user?.email || '',

                                    // optional: time window + attempts can be copied from template meta if you store it there
                                    // timeWindowEnabled: true,
                                    // startAt: ...,
                                    // endAt: ...,
                                    // maxAttempts: ...
                                    attemptCount: 0
                                })

                                tx.set(ref, payload as any)
                            })

                            return { ok: true }
                        } else {
                            // ✅ SURVEY => formAssignments (existing behavior)
                            const assignmentId = makeAssignmentId(sendTemplate.id!, a.id)
                            const ref = doc(db, 'formAssignments', assignmentId)

                            await runTransaction(db, async tx => {
                                const snap = await tx.get(ref)
                                if (snap.exists()) throw new Error('ALREADY_EXISTS')

                                const linkToken = generateToken()
                                const payload = pruneUndefinedDeep({
                                    templateId: sendTemplate.id,
                                    recipientId: a.id,
                                    recipientEmail: a.email,

                                    status: 'pending',
                                    deliveryMethod: 'in_app',
                                    linkToken,
                                    createdAt: nowIso,
                                    createdBy: user?.email || '',
                                    companyCode: user?.companyCode || '',
                                    category: sendTemplate.category || ''
                                })

                                tx.set(ref, payload as any)
                            })

                            return { ok: true }
                        }
                    } catch (err: any) {
                        return { ok: false, reason: err?.message === 'ALREADY_EXISTS' ? 'already' : 'error' }
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


    // metric icon chip
    const IconChip: React.FC<{ bg: string; icon: React.ReactNode }> = ({ bg, icon }) => (
        <div
            style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                display: 'grid',
                placeItems: 'center',
                background: bg
            }}
        >
            {icon}
        </div>
    )

    return (
        <div style={{ minHeight: '100vh', padding: 24 }}>
            <Helmet>
                <title>Form Templates | Smart Incubation</title>
            </Helmet>

            <DashboardHeaderCard
                title='Form Templates'
                subtitle='Build, preview and publish surveys and assessments.'
                extraRight={
                    <Space>
                        <Button icon={<FileTextOutlined />} onClick={goToNewSurvey}>
                            Create Survey
                        </Button>
                        <Button type='primary' icon={<CheckCircleOutlined />} onClick={goToNewAssessment}>
                            Create Assessment
                        </Button>
                    </Space>
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
                <MotionCard>
                    <Space size='large' align='center'>
                        <IconChip bg='rgba(22,119,255,.12)' icon={<FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />} />
                        <div>
                            <div style={{ fontSize: 13, color: 'rgba(0,0,0,.45)' }}>Total</div>
                            <div style={{ fontSize: 24, fontWeight: 700 }}>{metrics.total}</div>
                        </div>
                    </Space>
                </MotionCard>

                <MotionCard>
                    <Space size='large' align='center'>
                        <IconChip bg='rgba(250,173,20,.14)' icon={<FileTextOutlined style={{ fontSize: 20, color: '#faad14' }} />} />
                        <div>
                            <div style={{ fontSize: 13, color: 'rgba(0,0,0,.45)' }}>Drafts</div>
                            <div style={{ fontSize: 24, fontWeight: 700 }}>{metrics.drafts}</div>
                        </div>
                    </Space>
                </MotionCard>

                <MotionCard>
                    <Space size='large' align='center'>
                        <IconChip bg='rgba(82,196,26,.14)' icon={<CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />} />
                        <div>
                            <div style={{ fontSize: 13, color: 'rgba(0,0,0,.45)' }}>Published</div>
                            <div style={{ fontSize: 24, fontWeight: 700 }}>{metrics.published}</div>
                        </div>
                    </Space>
                </MotionCard>

                <MotionCard>
                    <Space size='large' align='center'>
                        <IconChip bg='rgba(114,46,209,.12)' icon={<SendOutlined style={{ fontSize: 20, color: '#722ed1' }} />} />
                        <div>
                            <div style={{ fontSize: 13, color: 'rgba(0,0,0,.45)' }}>Sent out</div>
                            <div style={{ fontSize: 24, fontWeight: 700 }}>{metrics.sentOut}</div>
                        </div>
                    </Space>
                </MotionCard>
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '12px 0' }}>
                <Segmented
                    value={view}
                    onChange={v => setView(v as any)}
                    options={[
                        {
                            value: 'all',
                            label: (
                                <Space>
                                    <AppstoreOutlined />
                                    <span>All</span>
                                </Space>
                            )
                        },
                        {
                            value: 'survey',
                            label: (
                                <Space>
                                    <FormOutlined />
                                    <span>Surveys</span>
                                </Space>
                            )
                        },
                        {
                            value: 'assessment',
                            label: (
                                <Space>
                                    <CheckCircleOutlined />
                                    <span>Assessments</span>
                                </Space>
                            )
                        }
                    ]}
                    style={{
                        borderRadius: 999,
                        padding: 4,
                        background: '#f5f7fa',

                    }}
                />

            </div>

            {/* Templates list */}
            <Space direction='vertical' style={{ width: '100%' }} size={12}>
                {templateLoading && (
                    <MotionCard size='small'>
                        <Text type='secondary'>Loading templates…</Text>
                    </MotionCard>
                )}

                {!templateLoading && filtered.length === 0 && (
                    <MotionCard size='small'>
                        <Text type='secondary'>No templates for this filter.</Text>
                    </MotionCard>
                )}

                {!templateLoading &&
                    filtered.map(tpl => {
                        const isAssessment = isAssessmentCategory(tpl.category)
                        const fullDesc = String(tpl.description || '').trim()
                        const shortDesc = smartCut(fullDesc, 220)
                        const isLong = fullDesc.length > shortDesc.length

                        return (
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
                                        <Space size='small' wrap>
                                            <Title level={5} style={{ margin: 0 }}>
                                                {tpl.title}
                                            </Title>

                                            <Tag color={tpl.status === 'published' ? 'green' : 'orange'}>
                                                {tpl.status === 'published' ? 'Published' : 'Draft'}
                                            </Tag>

                                            <Tag color={isAssessment ? 'geekblue' : 'default'}>
                                                {isAssessment ? 'Assessment' : 'Survey'}
                                            </Tag>
                                        </Space>



                                        <div style={{ marginTop: 6 }}>
                                            {fullDesc ? (
                                                <>
                                                    <div style={{ ...clampStyle(2), color: 'rgba(0,0,0,.75)' }}>
                                                        {shortDesc}
                                                    </div>

                                                    <Space size={6} style={{ marginTop: 6 }}>
                                                        {isLong && (
                                                            <Button
                                                                type="link"
                                                                size="small"
                                                                style={{ padding: 0, height: 'auto' }}
                                                                onClick={() => setDescModal({ title: tpl.title, desc: fullDesc })}
                                                            >
                                                                Read more
                                                            </Button>
                                                        )}

                                                        {fullDesc && (
                                                            <Tooltip title={fullDesc}>
                                                                <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                                                            </Tooltip>
                                                        )}
                                                    </Space>
                                                </>
                                            ) : (
                                                <Text type="secondary">No description.</Text>
                                            )}
                                        </div>


                                        <div style={{ marginTop: 8, color: 'rgba(0,0,0,.45)' }}>
                                            Category: {categoryLabel(tpl.category)} • Fields: {tpl.fields.length} • Updated: {formatDateSafe(tpl.updatedAt)}
                                        </div>
                                    </div>

                                    <Space>
                                        <Button icon={<SendOutlined />} onClick={() => openSendModal(tpl)}>
                                            Send
                                        </Button>
                                        <Button icon={<EditOutlined />} onClick={() => goToEdit(tpl)}>
                                            Edit
                                        </Button>
                                        <Button icon={<EyeOutlined />} onClick={() => setPreviewTemplate(tpl)}>
                                            Preview
                                        </Button>
                                    </Space>
                                </div>
                            </MotionCard>
                        )
                    })}
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
                            message='All recipients already have this form.'
                            description='No participants are selectable.'
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Checkbox
                                checked={selectAll}
                                disabled={allAlreadyAssigned}
                                onChange={e => {
                                    const checked = e.target.checked
                                    setSelectAll(checked)

                                    const available = applicants
                                        .filter(a => !alreadyAssignedIds.has(a.id) && !alreadyAssignedEmails.has(a.email))
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
                                borderRadius: 10,
                                padding: 12
                            }}
                        >
                            {applicants.length === 0 ? (
                                <Text type='secondary'>No accepted applications found.</Text>
                            ) : (
                                applicants.map(a => {
                                    const disabled = alreadyAssignedIds.has(a.id) || alreadyAssignedEmails.has(a.email)
                                    const checked = selectedIds.includes(a.id)

                                    return (
                                        <div
                                            key={a.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                padding: '8px 0',
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
                                                        x => !alreadyAssignedIds.has(x.id) && !alreadyAssignedEmails.has(x.email)
                                                    ).length
                                                    setSelectAll(next.size === selectableCount && selectableCount > 0)
                                                }}
                                            />

                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <strong>{a.name}</strong>
                                                    {disabled && <Tag color='gold'>Already sent</Tag>}
                                                </div>
                                                <div style={{ color: 'rgba(0,0,0,.45)' }}>{a.email}</div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </MotionCard>
                </Space>
            </Modal>

            {/* Preview Modal (now collapsible, not endless scrolling) */}
            <Modal
                title='Form Preview'
                open={!!previewTemplate}
                onCancel={() => setPreviewTemplate(null)}
                footer={null}
                width={780}
            >
                {previewTemplate ? (
                    <>
                        <Title level={3} style={{ marginTop: 0 }}>
                            {previewTemplate.title}
                        </Title>
                        <Text>{previewTemplate.description}</Text>

                        <Divider />

                        <Collapse
                            accordion={false}
                            defaultActiveKey={['0']}
                            items={groupFieldsForPreview(previewTemplate.fields).map((sec, idx) => ({
                                key: String(idx),
                                label: (
                                    <Space>
                                        <Text strong>{sec.title}</Text>
                                        <Tag>{sec.items.length}</Tag>
                                    </Space>
                                ),
                                children: (
                                    <Form layout='vertical'>
                                        {sec.items.map((f, i) => (
                                            <Form.Item
                                                key={f.id}
                                                label={f.label}
                                                required={f.required}
                                                help={f.description}
                                                name={sanitizeName(f.label || `field_${i + 1}`)}
                                            >
                                                <FieldPreview field={f} />
                                            </Form.Item>
                                        ))}
                                    </Form>
                                )
                            }))}
                        />
                    </>
                ) : null}
            </Modal>

            <Modal
                title={descModal?.title || 'Description'}
                open={!!descModal}
                onCancel={() => setDescModal(null)}
                footer={null}
                width={720}
            >
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                    {descModal?.desc || ''}
                </Typography.Paragraph>
            </Modal>

        </div>
    )
}
