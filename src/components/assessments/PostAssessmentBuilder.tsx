// =============================================
// components/assessments/AssessmentBuilder.tsx
// Modern + friendly + proper filtering + select-all-results + guide answers only when autograde on
// =============================================
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    Card,
    Typography,
    Form,
    Input,
    Button,
    Space,
    Select,
    Tag,
    DatePicker,
    Table,
    Modal,
    Divider,
    Tooltip,
    Badge,
    App,
    Switch,
    Empty,
    List,
    BackTop,
    Grid,
    Alert,
    Segmented
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    query,
    where,
    Timestamp,
    documentId
} from 'firebase/firestore'
import dayjs, { Dayjs } from 'dayjs'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { useNavigate, useParams } from 'react-router-dom'
import { DashboardHeaderCard } from '../shared/Header'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

type InterventionType = 'singular' | 'grouped'

type Assigned = {
    id: string
    participantId: string
    participantName: string
    interventionId: string
    interventionTitle: string
    status: string
    type: InterventionType
    completedAt?: any
    companyCode?: string
}

type ParticipantRow = {
    id: string
    beneficiaryName: string
    email?: string
    sector?: string
    companyCode?: string
}

export type FormField = {
    id: string
    type: 'short' | 'long' | 'radio' | 'checkbox' | 'rating' | 'number' | 'heading'
    label: string
    required: boolean
    description?: string
    options?: string[]
    correctAnswer?: any // radio:string, checkbox:string[], number/rating:number, short/long:string(guide)
    points?: number
}

type AssessmentType = 'post_intervention' | 'general'

function normalizeOptions(opts: string[]) {
    return opts.map(o => o.trim()).filter(o => o.length > 0)
}

function ensureAtLeastTwoOptions(type: FormField['type'], options?: string[]) {
    if (type !== 'radio' && type !== 'checkbox') return options
    const cleaned = normalizeOptions(options || [])
    if (cleaned.length >= 2) return cleaned
    const base = cleaned.length ? cleaned : ['Option 1']
    while (base.length < 2) base.push(`Option ${base.length + 1}`)
    return base
}

function chunk<T>(arr: T[], size: number) {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

export default function AssessmentBuilder() {
    const { user } = useFullIdentity()
    const { message } = App.useApp()
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const [draftId, setDraftId] = useState<string | null>(null)

    // Sticky offsets
    const STICKY_TOP = 16
    const stickyBodyMaxHeight = `calc(100vh - ${STICKY_TOP + 32}px)`

    // Mobile guard
    const screens = Grid.useBreakpoint()
    const isSmall = !screens.md

    // Assessment type
    const [assessmentType, setAssessmentType] = useState<AssessmentType>('post_intervention')

    // Super access rule
    const isSuper =
        (user?.email || '').toLowerCase().endsWith('@quantilytix.co.za') ||
        (user?.role || '').toLowerCase() === 'superadmin'

    // ----------------------------
    // Post-intervention recipients
    // ----------------------------
    const [completed, setCompleted] = useState<Assigned[]>([])
    const [loadingCompleted, setLoadingCompleted] = useState(false)
    const [mode, setMode] = useState<'single' | 'grouped'>('single')
    const [selectedAssigned, setSelectedAssigned] = useState<Assigned[]>([])
    const [searchAssigned, setSearchAssigned] = useState('')

    useEffect(() => {
        const loadDraft = async () => {
            if (!id) return

            try {
                const ref = doc(db, 'formTemplates', id)
                const snap = await getDoc(ref)
                if (!snap.exists()) {
                    message.error('Draft not found')
                    return
                }

                const data = snap.data() as any

                setDraftId(id)

                // category is your assessmentType in this component
                setAssessmentType((data.category as AssessmentType) || 'post_intervention')

                // fields
                setFields(Array.isArray(data.fields) ? data.fields : [])

                // meta
                const meta = data.assessmentMeta || {}
                setAutoGradeOn(Boolean(meta.autoGrade))
                setTimeWindowOn(Boolean(meta.timeWindowEnabled))

                // mode (only relevant for post_intervention)
                if (meta.interventionScope === 'grouped') setMode('grouped')
                else setMode('single')

                // fill form values
                form.setFieldsValue({
                    title: data.title || '',
                    description: data.description || '',
                    dueAt: meta?.dueAt ? dayjs(meta.dueAt?.toDate?.() ?? meta.dueAt) : undefined,
                    timeWindow:
                        meta?.startAt && meta?.endAt
                            ? [
                                dayjs(meta.startAt?.toDate?.() ?? meta.startAt),
                                dayjs(meta.endAt?.toDate?.() ?? meta.endAt)
                            ]
                            : undefined
                })

                // restore selections (optional but recommended)
                // 1) general -> participants selection
                if ((data.category || '') === 'general' && Array.isArray(meta.participantIds)) {
                    // we’ll apply these after participants load
                    // easiest: keep an ids buffer
                    ; (window as any).__pendingParticipantIds = meta.participantIds
                }

                // 2) post_intervention -> assignedInterventions selection
                if ((data.category || '') === 'post_intervention' && Array.isArray(meta.interventionIds)) {
                    ; (window as any).__pendingInterventionIds = meta.interventionIds
                }
            } catch (e) {
                console.error(e)
                message.error('Failed to load draft')
            }
        }

        loadDraft()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])


    useEffect(() => {
        const load = async () => {
            if (assessmentType !== 'post_intervention') {
                setCompleted([])
                return
            }
            setLoadingCompleted(true)
            try {
                const snap = await getDocs(
                    query(collection(db, 'assignedInterventions'), where('status', '==', 'completed'))
                )

                const rows: Assigned[] = []
                for (const d of snap.docs) {
                    const data = d.data() as any

                    // company filter (unless super)
                    if (!isSuper && user?.companyCode) {
                        const cc = (data.companyCode || '').toString()
                        if (cc && cc !== user.companyCode) continue
                    }

                    let participantName = '—'
                    try {
                        const p = await getDoc(doc(db, 'participants', data.participantId))
                        if (p.exists()) participantName = (p.data() as any).beneficiaryName || '—'
                    } catch { }

                    rows.push({
                        id: d.id,
                        participantId: data.participantId,
                        participantName,
                        interventionId: data.interventionId,
                        interventionTitle: data.interventionTitle || 'Untitled',
                        status: data.status,
                        type: (data.type as InterventionType) || 'singular',
                        completedAt: data.updatedAt || data.completedAt || Timestamp.now(),
                        companyCode: data.companyCode || ''
                    })
                }

                // sort newest first
                rows.sort((a, b) => {
                    const ta = (a.completedAt?.toDate?.() ?? new Date(a.completedAt)).getTime?.() ?? 0
                    const tb = (b.completedAt?.toDate?.() ?? new Date(b.completedAt)).getTime?.() ?? 0
                    return tb - ta
                })

                const pending = (window as any).__pendingInterventionIds as string[] | undefined
                if (pending?.length) {
                    // select all rows whose interventionId is in pending
                    const pick = rows.filter(r => pending.includes(r.interventionId))
                    setSelectedAssigned(mode === 'single' ? pick.slice(0, 1) : pick)
                        ; (window as any).__pendingInterventionIds = undefined
                }


                setCompleted(rows)
            } catch (e) {
                console.error(e)
                message.error('Failed to load completed interventions')
            } finally {
                setLoadingCompleted(false)
            }
        }
        load()
    }, [assessmentType, isSuper, message, user?.companyCode])

    const filteredAssigned = useMemo(() => {
        const s = searchAssigned.trim().toLowerCase()
        if (!s) return completed
        return completed.filter(r => {
            return (
                (r.participantName || '').toLowerCase().includes(s) ||
                (r.interventionTitle || '').toLowerCase().includes(s)
            )
        })
    }, [completed, searchAssigned])

    // ----------------------------
    // General recipients (accepted SMEs only)
    // - filter by applications.applicationStatus === 'accepted'
    // - filter by companyCode unless super
    // - then fetch corresponding participants by docId (assumption: application doc id == participantId)
    // ----------------------------
    const [participants, setParticipants] = useState<ParticipantRow[]>([])
    const [loadingParticipants, setLoadingParticipants] = useState(false)
    const [selectedParticipants, setSelectedParticipants] = useState<ParticipantRow[]>([])
    const [searchParticipants, setSearchParticipants] = useState('')

    useEffect(() => {
        const load = async () => {
            if (assessmentType !== 'general') {
                setParticipants([])
                return
            }

            setLoadingParticipants(true)
            try {
                // 1) load accepted applications
                const appQ = isSuper
                    ? query(collection(db, 'applications'), where('applicationStatus', '==', 'accepted'))
                    : query(
                        collection(db, 'applications'),
                        where('applicationStatus', '==', 'accepted'),
                        where('companyCode', '==', user?.companyCode || '')
                    )

                const appSnap = await getDocs(appQ)

                // ✅ IMPORTANT: use participantId from applications (not doc.id)
                const acceptedIds = Array.from(
                    new Set(
                        appSnap.docs
                            .map(d => (d.data() as any)?.participantId)
                            .filter(Boolean)
                    )
                )



                if (!acceptedIds.length) {
                    setParticipants([])
                    return
                }

                // 2) fetch participant docs for those ids (IN chunks of 10)
                const idsChunks = chunk(acceptedIds, 10)
                const rows: ParticipantRow[] = []

                for (const c of idsChunks) {
                    const pSnap = await getDocs(
                        query(collection(db, 'participants'), where(documentId(), 'in', c))
                    )
                    pSnap.forEach(p => {
                        const pd = p.data() as any
                        rows.push({
                            id: p.id,
                            beneficiaryName: pd.beneficiaryName || '—',
                            email: pd.email || '',
                            sector: pd.sector || '',
                            companyCode: pd.companyCode || ''
                        })
                    })
                }

                rows.sort((a, b) =>
                    (a.beneficiaryName || '').localeCompare(b.beneficiaryName || '')
                )

                const pending = (window as any).__pendingParticipantIds as string[] | undefined
                if (pending?.length) {
                    const pick = rows.filter(r => pending.includes(r.id))
                    setSelectedParticipants(pick)
                        ; (window as any).__pendingParticipantIds = undefined
                }

                setParticipants(rows)
            } catch (e) {
                console.error(e)
                message.error('Failed to load accepted participants')
            } finally {
                setLoadingParticipants(false)
            }
        }

        load()
    }, [assessmentType, isSuper, message, user?.companyCode])

    const filteredParticipants = useMemo(() => {
        const s = searchParticipants.trim().toLowerCase()
        if (!s) return participants
        return participants.filter(p => {
            return (
                (p.beneficiaryName || '').toLowerCase().includes(s) ||
                (p.email || '').toLowerCase().includes(s) ||
                (p.sector || '').toLowerCase().includes(s)
            )
        })
    }, [participants, searchParticipants])

    // Derived selection ids
    const participantsInSelection = useMemo(() => {
        if (assessmentType === 'post_intervention') {
            return Array.from(new Set(selectedAssigned.map(s => s.participantId)))
        }
        return Array.from(new Set(selectedParticipants.map(p => p.id)))
    }, [assessmentType, selectedAssigned, selectedParticipants])

    const interventionIdsInSelection = useMemo(() => {
        if (assessmentType !== 'post_intervention') return []
        return Array.from(new Set(selectedAssigned.map(s => s.interventionId)))
    }, [assessmentType, selectedAssigned])

    // ----------------------------
    // Builder
    // ----------------------------
    const [form] = Form.useForm()
    const [fields, setFields] = useState<FormField[]>([])
    const [autoGradeOn, setAutoGradeOn] = useState(true)
    const [timeWindowOn, setTimeWindowOn] = useState(false)

    const qRefs = useRef<Record<string, HTMLDivElement | null>>({})

    const addField = (type: FormField['type']) => {
        const id = `${type}_${Date.now()}`
        const base: FormField = {
            id,
            type,
            label: type === 'heading' ? 'Section' : 'Question',
            required: type !== 'heading',
            description: '',
            options: ensureAtLeastTwoOptions(
                type,
                type === 'radio' || type === 'checkbox' ? ['Option 1', 'Option 2'] : []
            ),
            points: type === 'heading' ? 0 : 1
        }
        setFields(prev => [...prev, base])
    }

    const updateField = (id: string, patch: Partial<FormField>) =>
        setFields(prev =>
            prev.map(f => {
                if (f.id !== id) return f
                const next = { ...f, ...patch }
                if (next.type === 'radio' || next.type === 'checkbox') {
                    next.options = ensureAtLeastTwoOptions(next.type, next.options)
                    // prune keys if options removed
                    if (next.type === 'radio' && next.correctAnswer && !(next.options || []).includes(next.correctAnswer)) {
                        next.correctAnswer = undefined
                    }
                    if (next.type === 'checkbox' && Array.isArray(next.correctAnswer)) {
                        next.correctAnswer = next.correctAnswer.filter((x: string) => (next.options || []).includes(x))
                    }
                }
                return next
            })
        )

    const removeField = (id: string) => setFields(prev => prev.filter(f => f.id !== id))

    const totals = useMemo(() => {
        const hardAuto = new Set(['radio', 'checkbox', 'number', 'rating'])
        const questions = fields.filter(f => f.type !== 'heading')
        const autoGraded = questions.filter(q => {
            if (!autoGradeOn) return false
            if (hardAuto.has(q.type)) return true
            // short/long only count if guide answer exists
            if ((q.type === 'short' || q.type === 'long') && typeof q.correctAnswer === 'string' && q.correctAnswer.trim())
                return true
            return false
        }).length
        const totalPoints = questions.reduce((sum, q) => sum + Number(q.points || 0), 0)
        return { questions: questions.length, autoGraded, totalPoints }
    }, [fields, autoGradeOn])

    // ----------------------------
    // Save draft
    // ----------------------------
    const handleSaveDraft = async () => {
        try {
            const vals = form.getFieldsValue()

            // time window validation
            const tw = vals.timeWindow as [Dayjs, Dayjs] | undefined
            const startAt = timeWindowOn ? tw?.[0]?.toDate?.() : undefined
            const endAt = timeWindowOn ? tw?.[1]?.toDate?.() : undefined
            if (timeWindowOn && (!startAt || !endAt)) return message.warning('Set Start Time and End Time (or switch off).')
            if (timeWindowOn && startAt && endAt && dayjs(endAt).isBefore(dayjs(startAt)))
                return message.warning('End Time must be after Start Time.')

            const newId = draftId ?? doc(collection(db, 'formTemplates')).id
            const templateRef = draftId ? doc(db, 'formTemplates', draftId) : doc(db, 'formTemplates', newId)

            const templateDoc: any = {
                id: templateRef.id,
                title: vals.title || 'Untitled draft',
                description: vals.description || '',
                category: assessmentType,
                status: 'draft' as const,
                fields,
                assessmentMeta: {
                    assessmentType,
                    interventionScope: assessmentType === 'post_intervention' ? mode : 'none',
                    interventionIds: interventionIdsInSelection,
                    participantIds: participantsInSelection,
                    autoGrade: autoGradeOn,
                    timeWindowEnabled: timeWindowOn,
                    startAt: startAt || null,
                    endAt: endAt || null
                },
                companyCode: user?.companyCode || '',
                updatedAt: new Date()
            }

            await setDoc(templateRef, templateDoc, { merge: true })
            if (!draftId) setDraftId(templateRef.id)
            message.success('Draft saved')
        } catch (e) {
            console.error(e)
            message.error('Failed to save draft')
        }
    }

    // ----------------------------
    // Send
    // ----------------------------
    const [sendOpen, setSendOpen] = useState(false)

    const handleCreateAndSend = async () => {
        try {
            const vals = await form.validateFields()
            if (!fields.length) return message.warning('Add at least one question')
            if (!participantsInSelection.length) return message.warning('Select at least one recipient')

            // time window validation
            const tw = vals.timeWindow as [Dayjs, Dayjs] | undefined
            const startAt = timeWindowOn ? tw?.[0]?.toDate?.() : undefined
            const endAt = timeWindowOn ? tw?.[1]?.toDate?.() : undefined
            if (timeWindowOn && (!startAt || !endAt)) return message.warning('Set Start Time and End Time (or switch off).')
            if (timeWindowOn && startAt && endAt && dayjs(endAt).isBefore(dayjs(startAt)))
                return message.warning('End Time must be after Start Time.')

            const dueAt =
                (vals.dueAt as Dayjs | undefined)?.toDate?.() ||
                dayjs().add(7, 'day').toDate()

            const templateRef = doc(collection(db, 'formTemplates'))
            const templateDoc: any = {
                id: templateRef.id,
                title: vals.title,
                description: vals.description || '',
                category: assessmentType,
                status: 'published' as const,
                fields,
                assessmentMeta: {
                    assessmentType,
                    interventionScope: assessmentType === 'post_intervention' ? mode : 'none',
                    interventionIds: interventionIdsInSelection,
                    participantIds: participantsInSelection,
                    autoGrade: autoGradeOn,
                    timeWindowEnabled: timeWindowOn,
                    startAt: startAt || null,
                    endAt: endAt || null
                },
                companyCode: user?.companyCode || '',
                createdAt: new Date(),
                updatedAt: new Date()
            }

            await setDoc(templateRef, templateDoc)

            const ops: Promise<any>[] = []
            for (const pId of participantsInSelection) {
                let pName = '—'
                let pEmail = ''
                try {
                    const p = await getDoc(doc(db, 'participants', pId))
                    if (p.exists()) {
                        const pd = p.data() as any
                        pName = pd.beneficiaryName || '—'
                        pEmail = pd.email || ''
                    }
                } catch { }

                ops.push(
                    addDoc(collection(db, 'formRequests'), {
                        templateId: templateRef.id,
                        formTitle: vals.title,
                        participantId: pId,
                        participantName: pName,
                        participantEmail: pEmail,
                        sentAt: new Date(),
                        dueAt,
                        timeWindowEnabled: timeWindowOn,
                        startAt: startAt || null,
                        endAt: endAt || null,
                        status: 'sent' as const,
                        companyCode: user?.companyCode || '',
                        category: assessmentType
                    })
                )
            }

            await Promise.all(ops)

            setSendOpen(false)
            message.success('Assessment created and sent')
            form.resetFields()
            setFields([])
            setSelectedAssigned([])
            setSelectedParticipants([])
            setSearchAssigned('')
            setSearchParticipants('')
        } catch (e: any) {
            if (e?.errorFields) return
            console.error(e)
            message.error('Failed to create / send assessment')
        }
    }

    // ----------------------------
    // Columns
    // ----------------------------
    const assignedColumns: ColumnsType<Assigned> = [
        { title: 'SME', dataIndex: 'participantName', key: 'participantName' },
        { title: 'Intervention', dataIndex: 'interventionTitle', key: 'interventionTitle' }
    ]

    const participantColumns: ColumnsType<ParticipantRow> = [
        { title: 'SME', dataIndex: 'beneficiaryName', key: 'beneficiaryName' },
        { title: 'Email', dataIndex: 'email', key: 'email' },
        { title: 'Sector', dataIndex: 'sector', key: 'sector' }
    ]

    // ----------------------------
    // “Select all filtered results” actions
    // ----------------------------
    const selectAllFilteredAssigned = () => {
        if (mode === 'single') {
            // in single mode, select first result (still makes sense)
            setSelectedAssigned(filteredAssigned.slice(0, 1))
            return
        }
        setSelectedAssigned(filteredAssigned)
    }
    const clearAssigned = () => setSelectedAssigned([])

    const selectAllFilteredParticipants = () => setSelectedParticipants(filteredParticipants)
    const clearParticipants = () => setSelectedParticipants([])

    // ----------------------------
    // UI
    // ----------------------------
    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            {isSmall ? (
                <>
                    <Title level={4}>Assessment Builder</Title>
                    <Alert
                        type='warning'
                        showIcon
                        message='Use a larger screen'
                        description='This builder works best on a tablet or desktop.'
                    />
                </>
            ) : (
                <>
                    <DashboardHeaderCard
                        title='Assessment Builder'
                        subtitle='Modern builder with recipient filtering, select-all-results, time-window lockout, and future-ready auto-grading.'
                        extraRight={
                            <Space wrap>
                                <Button onClick={() => navigate(-1)}>Back</Button>
                                <Button onClick={handleSaveDraft}>Save Draft</Button>
                                <Button
                                    type='primary'
                                    disabled={!participantsInSelection.length || !fields.length}
                                    onClick={() => setSendOpen(true)}
                                >
                                    Create & Send
                                </Button>
                                <Tag color='blue'>Recipients: {participantsInSelection.length}</Tag>
                                {assessmentType === 'post_intervention' && (
                                    <Tag>Interventions: {interventionIdsInSelection.length}</Tag>
                                )}
                            </Space>
                        }
                    />

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '260px 1fr 380px',
                            gap: 16,
                            marginTop: 16
                        }}
                    >
                        {/* LEFT: QUESTION NAV */}
                        <Card
                            style={{ position: 'sticky', top: STICKY_TOP, alignSelf: 'start', borderRadius: 16 }}
                            bodyStyle={{ padding: 16, maxHeight: stickyBodyMaxHeight, overflow: 'auto' }}
                            title={
                                <Space align='baseline'>
                                    <span>Questions</span>
                                    <Badge count={fields.filter(f => f.type !== 'heading').length} showZero />
                                </Space>
                            }
                        >
                            <List
                                size='small'
                                dataSource={fields}
                                locale={{ emptyText: 'No questions yet' }}
                                renderItem={(f, idx) => (
                                    <List.Item
                                        style={{
                                            cursor: 'pointer',
                                            borderRadius: 10,
                                            padding: '8px 10px'
                                        }}
                                        onClick={() =>
                                            qRefs.current[f.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                        }
                                    >
                                        <Space>
                                            <Tag>{idx + 1}</Tag>
                                            <span
                                                style={{
                                                    maxWidth: 170,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {f.label || f.type.toUpperCase()}
                                            </span>
                                        </Space>
                                    </List.Item>
                                )}
                            />
                        </Card>

                        {/* CENTER: BUILDER */}
                        <Card style={{ overflow: 'visible', borderRadius: 16 }} bodyStyle={{ paddingBottom: 24 }}>
                            {/* Sticky header */}
                            <div style={{ position: 'sticky', top: STICKY_TOP, zIndex: 2, background: '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
                                    <Space align='baseline' wrap>
                                        <Text strong>Build Assessment</Text>
                                        <Tooltip title='Questions (excluding headings)'>
                                            <Tag color='blue'>Q: {totals.questions}</Tag>
                                        </Tooltip>
                                        <Tooltip title='Auto-gradable questions (based on your settings)'>
                                            <Tag>Auto: {totals.autoGraded}</Tag>
                                        </Tooltip>
                                        <Tooltip title='Total points'>
                                            <Tag color='gold'>Pts: {totals.totalPoints}</Tag>
                                        </Tooltip>
                                    </Space>
                                </div>
                                <Divider style={{ margin: '10px 0' }} />
                            </div>

                            <Form form={form} layout='vertical'>
                                <Form.Item label='Assessment Type' required>
                                    <Segmented
                                        value={assessmentType}
                                        onChange={(v: any) => {
                                            setAssessmentType(v)
                                            setSelectedAssigned([])
                                            setSelectedParticipants([])
                                            setMode('single')
                                            setSearchAssigned('')
                                            setSearchParticipants('')
                                        }}
                                        options={[
                                            { value: 'post_intervention', label: 'Post-Intervention' },
                                            { value: 'general', label: 'General' }
                                        ]}
                                    />
                                </Form.Item>

                                <Form.Item
                                    name='title'
                                    label='Title'
                                    rules={[{ required: true, message: 'Title is required' }]}
                                >
                                    <Input placeholder='e.g., Post-Workshop Knowledge Check' />
                                </Form.Item>

                                <Form.Item name='description' label='Description'>
                                    <Input.TextArea rows={2} placeholder='Short description shown to learners' />
                                </Form.Item>

                                <Space wrap size='large' style={{ marginBottom: 8 }}>
                                    <Form.Item name='dueAt' label='Due date' style={{ marginBottom: 0 }}>
                                        <DatePicker style={{ width: 240 }} />
                                    </Form.Item>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <Space>
                                            <Text strong>Time Window Lockout</Text>
                                            <Tooltip title='When ON, submissions should be blocked outside Start → End. (Your submission page enforces this using the request/template fields.)'>
                                                <Switch checked={timeWindowOn} onChange={setTimeWindowOn} />
                                            </Tooltip>
                                        </Space>

                                        <Form.Item
                                            name='timeWindow'
                                            style={{ marginBottom: 0 }}
                                            rules={
                                                timeWindowOn
                                                    ? [
                                                        {
                                                            validator: async (_, value: [Dayjs, Dayjs] | undefined) => {
                                                                if (!value || !value[0] || !value[1]) {
                                                                    throw new Error('Start Time and End Time are required')
                                                                }
                                                                if (dayjs(value[1]).isBefore(dayjs(value[0]))) {
                                                                    throw new Error('End Time must be after Start Time')
                                                                }
                                                            }
                                                        }
                                                    ]
                                                    : []
                                            }
                                        >
                                            <RangePicker
                                                showTime
                                                style={{ width: 420 }}
                                                disabled={!timeWindowOn}
                                                placeholder={['Start Time', 'End Time']}
                                            />
                                        </Form.Item>
                                    </div>

                                    <div>
                                        <Text strong style={{ marginRight: 8 }}>Auto-grading</Text>
                                        <Tooltip title='When ON: MCQ/Checkbox/Number/Rating can be auto-graded. Short/Long will be AI-graded later if you provide Guide Answers.'>
                                            <Switch checked={autoGradeOn} onChange={setAutoGradeOn} />
                                        </Tooltip>
                                    </div>
                                </Space>
                            </Form>

                            <Divider />

                            <Space wrap>
                                <Button onClick={() => addField('heading')}>Section</Button>
                                <Button onClick={() => addField('short')}>Short Answer</Button>
                                <Button onClick={() => addField('long')}>Long Answer</Button>
                                <Button onClick={() => addField('radio')}>Multiple Choice</Button>
                                <Button onClick={() => addField('checkbox')}>Checkboxes</Button>
                                <Button onClick={() => addField('number')}>Number</Button>
                                <Button onClick={() => addField('rating')}>Rating (1-5)</Button>
                            </Space>

                            <div style={{ marginTop: 16 }}>
                                <div
                                    style={{
                                        maxHeight: stickyBodyMaxHeight,
                                        overflow: 'auto',
                                        display: 'grid',
                                        gap: 12,
                                        paddingRight: 8
                                    }}
                                >
                                    {fields.length === 0 && (
                                        <Empty description='Add questions using the buttons above' />
                                    )}

                                    {fields.map((f, idx) => (
                                        <Card
                                            key={f.id}
                                            ref={el => (qRefs.current[f.id] = el)}
                                            size='small'
                                            style={{ borderRadius: 16 }}
                                            title={
                                                <Space>
                                                    <Tag>{idx + 1}</Tag>
                                                    <span>{f.label || f.type.toUpperCase()}</span>
                                                </Space>
                                            }
                                        >
                                            <Space direction='vertical' style={{ width: '100%' }}>
                                                <Input
                                                    value={f.label}
                                                    onChange={e => updateField(f.id, { label: e.target.value })}
                                                    placeholder='Question / Section title'
                                                />

                                                {f.type !== 'heading' && (
                                                    <>
                                                        <Space wrap>
                                                            <Select
                                                                style={{ width: 160 }}
                                                                value={f.required ? 'required' : 'optional'}
                                                                onChange={v => updateField(f.id, { required: v === 'required' })}
                                                                options={[
                                                                    { value: 'required', label: 'Required' },
                                                                    { value: 'optional', label: 'Optional' }
                                                                ]}
                                                            />
                                                            <Tooltip title='Points = weight this question contributes to the total score'>
                                                                <Input
                                                                    type='number'
                                                                    style={{ width: 140 }}
                                                                    value={f.points ?? 1}
                                                                    min={0}
                                                                    onChange={e => updateField(f.id, { points: Number(e.target.value) })}
                                                                    addonBefore='Points'
                                                                />
                                                            </Tooltip>
                                                        </Space>

                                                        {/* Options editor */}
                                                        {(f.type === 'radio' || f.type === 'checkbox') && (
                                                            <div style={{ width: '100%' }}>
                                                                <Text strong>Options</Text>
                                                                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                                                                    {(f.options || []).map((opt, optIdx) => (
                                                                        <div
                                                                            key={`${f.id}_opt_${optIdx}`}
                                                                            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                                                                        >
                                                                            <Input
                                                                                value={opt}
                                                                                onChange={e => {
                                                                                    const next = [...(f.options || [])]
                                                                                    next[optIdx] = e.target.value
                                                                                    updateField(f.id, { options: normalizeOptions(next) })
                                                                                }}
                                                                                placeholder={`Option ${optIdx + 1}`}
                                                                            />
                                                                            <Button
                                                                                danger
                                                                                disabled={(f.options || []).length <= 2}
                                                                                onClick={() => {
                                                                                    const next = [...(f.options || [])]
                                                                                    next.splice(optIdx, 1)
                                                                                    updateField(f.id, { options: ensureAtLeastTwoOptions(f.type, next) })
                                                                                }}
                                                                            >
                                                                                Remove
                                                                            </Button>
                                                                        </div>
                                                                    ))}

                                                                    <Button
                                                                        onClick={() => {
                                                                            const next = [...(f.options || [])]
                                                                            next.push(`Option ${next.length + 1}`)
                                                                            updateField(f.id, { options: normalizeOptions(next) })
                                                                        }}
                                                                    >
                                                                        + Add option
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Auto-grade keys (only when Auto-grade ON) */}
                                                        {autoGradeOn && f.type === 'radio' && (
                                                            <Select
                                                                allowClear
                                                                placeholder='Correct option (auto-grade key)'
                                                                value={f.correctAnswer}
                                                                onChange={v => updateField(f.id, { correctAnswer: v })}
                                                                options={(f.options || []).map(o => ({ label: o, value: o }))}
                                                                style={{ width: 360 }}
                                                            />
                                                        )}

                                                        {autoGradeOn && f.type === 'checkbox' && (
                                                            <Select
                                                                mode='multiple'
                                                                allowClear
                                                                placeholder='Correct options (auto-grade key)'
                                                                value={f.correctAnswer as string[] | undefined}
                                                                onChange={v => updateField(f.id, { correctAnswer: v })}
                                                                options={(f.options || []).map(o => ({ label: o, value: o }))}
                                                                style={{ width: 420 }}
                                                            />
                                                        )}

                                                        {autoGradeOn && f.type === 'number' && (
                                                            <Input
                                                                type='number'
                                                                placeholder='Correct value (auto-grade key)'
                                                                value={typeof f.correctAnswer === 'number' ? f.correctAnswer : undefined}
                                                                onChange={e => updateField(f.id, { correctAnswer: Number(e.target.value) })}
                                                                style={{ width: 240 }}
                                                            />
                                                        )}

                                                        {autoGradeOn && f.type === 'rating' && (
                                                            <Select
                                                                style={{ width: 240 }}
                                                                value={typeof f.correctAnswer === 'number' ? f.correctAnswer : undefined}
                                                                onChange={v => updateField(f.id, { correctAnswer: v })}
                                                                options={[1, 2, 3, 4, 5].map(n => ({
                                                                    label: `${n} star${n > 1 ? 's' : ''}`,
                                                                    value: n
                                                                }))}
                                                                placeholder='Correct rating (optional)'
                                                            />
                                                        )}

                                                        {/* ✅ Guide Answer for short/long ONLY when Auto-grade ON */}
                                                        {autoGradeOn && (f.type === 'short' || f.type === 'long') && (
                                                            <div style={{ width: '100%' }}>
                                                                <Text strong>Guide Answer (for AI grading)</Text>
                                                                <Tooltip title='Optional. Later, AI will compare the learner response to this guide answer for auto-grading.'>
                                                                    <Input.TextArea
                                                                        rows={f.type === 'short' ? 2 : 4}
                                                                        value={typeof f.correctAnswer === 'string' ? f.correctAnswer : ''}
                                                                        onChange={e => updateField(f.id, { correctAnswer: e.target.value })}
                                                                        placeholder={
                                                                            f.type === 'short'
                                                                                ? 'Ideal answer in 1–3 sentences...'
                                                                                : 'Model answer / rubric / key points expected...'
                                                                        }
                                                                        style={{ marginTop: 8 }}
                                                                    />
                                                                </Tooltip>
                                                                <Text type='secondary' style={{ display: 'block', marginTop: 6 }}>
                                                                    Tip: include key points the learner must mention.
                                                                </Text>
                                                            </div>
                                                        )}
                                                    </>
                                                )}

                                                <Space>
                                                    <Button danger onClick={() => removeField(f.id)}>Remove</Button>
                                                </Space>
                                            </Space>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </Card>

                        {/* RIGHT: RECIPIENTS */}
                        <Card
                            style={{ position: 'sticky', top: STICKY_TOP, alignSelf: 'start', borderRadius: 16 }}
                            bodyStyle={{ padding: 16, maxHeight: stickyBodyMaxHeight, overflow: 'auto' }}
                            title={
                                <Space align='baseline' wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                                    <Space>
                                        <span>Recipients</span>
                                        <Tag color='blue'>{participantsInSelection.length} selected</Tag>
                                    </Space>
                                    {assessmentType === 'post_intervention' && <Tag>Mode: {mode}</Tag>}
                                </Space>
                            }
                        >
                            {assessmentType === 'post_intervention' ? (
                                <>
                                    <Space direction='vertical' style={{ width: '100%' }} size='middle'>
                                        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                                            <Space>
                                                <Text>Mode</Text>
                                                <Select
                                                    value={mode}
                                                    onChange={v => {
                                                        setMode(v)
                                                        setSelectedAssigned([])
                                                    }}
                                                    style={{ width: 160 }}
                                                    options={[
                                                        { value: 'single', label: 'Single' },
                                                        { value: 'grouped', label: 'Grouped' }
                                                    ]}
                                                />
                                            </Space>

                                            <Space>
                                                <Button onClick={selectAllFilteredAssigned}>
                                                    Select all results
                                                </Button>
                                                <Button onClick={clearAssigned}>Clear</Button>
                                            </Space>
                                        </Space>

                                        <Input.Search
                                            value={searchAssigned}
                                            onChange={e => setSearchAssigned(e.target.value)}
                                            placeholder='Search SME or Intervention...'
                                            allowClear
                                        />

                                        <Table
                                            size='small'
                                            rowKey='id'
                                            loading={loadingCompleted}
                                            columns={assignedColumns}
                                            dataSource={filteredAssigned}
                                            rowSelection={{
                                                type: mode === 'single' ? 'radio' : 'checkbox',
                                                selectedRowKeys: selectedAssigned.map(s => s.id),
                                                onChange: (_keys: React.Key[], rows: Assigned[]) => {
                                                    if (mode === 'grouped') setSelectedAssigned(rows)
                                                    else setSelectedAssigned(rows.slice(0, 1))
                                                }
                                            }}
                                            pagination={{ pageSize: 7, showSizeChanger: false }}
                                            scroll={{ y: 360 }}
                                            locale={{
                                                emptyText: (
                                                    <Empty
                                                        description={
                                                            <div>
                                                                <div>No completed interventions found</div>
                                                                <Text type='secondary'>Try changing the search or check completion statuses.</Text>
                                                            </div>
                                                        }
                                                    />
                                                )
                                            }}
                                        />

                                        <Space wrap>
                                            <Tag color='blue'>Participants: {participantsInSelection.length}</Tag>
                                            <Tag>Interventions: {interventionIdsInSelection.length}</Tag>
                                            <Tag color='geekblue'>Results: {filteredAssigned.length}</Tag>
                                        </Space>
                                    </Space>
                                </>
                            ) : (
                                <>
                                    <Space direction='vertical' style={{ width: '100%' }} size='middle'>

                                        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                                            <Tag color='geekblue'>Accepted SMEs: {participants.length}</Tag>
                                            <Space>
                                                <Button onClick={selectAllFilteredParticipants}>Select all results</Button>
                                                <Button onClick={clearParticipants}>Clear</Button>
                                            </Space>
                                        </Space>

                                        <Input.Search
                                            value={searchParticipants}
                                            onChange={e => setSearchParticipants(e.target.value)}
                                            placeholder='Search SME, email, sector...'
                                            allowClear
                                        />

                                        <Table
                                            size='small'
                                            rowKey='id'
                                            loading={loadingParticipants}
                                            columns={participantColumns}
                                            dataSource={filteredParticipants}
                                            rowSelection={{
                                                type: 'checkbox',
                                                selectedRowKeys: selectedParticipants.map(p => p.id),
                                                onChange: (_keys: React.Key[], rows: ParticipantRow[]) => setSelectedParticipants(rows)
                                            }}
                                            pagination={{ pageSize: 7, showSizeChanger: false }}
                                            scroll={{ y: 360 }}
                                            locale={{
                                                emptyText: (
                                                    <Empty
                                                        description={
                                                            <div>
                                                                <div>No accepted SMEs found</div>
                                                                <Text type='secondary'>
                                                                    Ensure applications exist and have been accepted.
                                                                </Text>
                                                            </div>
                                                        }
                                                    />
                                                )
                                            }}
                                        />

                                        <Space wrap>
                                            <Tag color='blue'>Selected: {participantsInSelection.length}</Tag>
                                            <Tag color='geekblue'>Results: {filteredParticipants.length}</Tag>
                                        </Space>
                                    </Space>
                                </>
                            )}
                        </Card>
                    </div>

                    <BackTop visibilityHeight={200} />

                    <Modal
                        title='Send assessment'
                        open={sendOpen}
                        onCancel={() => setSendOpen(false)}
                        onOk={handleCreateAndSend}
                        okText='Send'
                    >
                        <p><b>Type:</b> {assessmentType}</p>
                        <p><b>Template:</b> {form.getFieldValue('title') || 'Untitled'}</p>
                        <p>
                            <b>Questions:</b> {totals.questions} • <b>Auto-gradable:</b> {totals.autoGraded} •{' '}
                            <b>Total Points:</b> {totals.totalPoints}
                        </p>
                        <p><b>Recipients:</b> {participantsInSelection.length} participant(s)</p>
                        {assessmentType === 'post_intervention' && (
                            <p><b>Interventions:</b> {interventionIdsInSelection.length}</p>
                        )}
                        <p>
                            <b>Time Window:</b>{' '}
                            {timeWindowOn
                                ? (() => {
                                    const tw = form.getFieldValue('timeWindow') as [Dayjs, Dayjs] | undefined
                                    const s = tw?.[0] ? dayjs(tw[0]).format('DD MMM YYYY HH:mm') : '—'
                                    const e = tw?.[1] ? dayjs(tw[1]).format('DD MMM YYYY HH:mm') : '—'
                                    return `${s} → ${e}`
                                })()
                                : 'Off'}
                        </p>
                        <p style={{ marginTop: 8 }}>
                            <Text type='secondary'>
                                Lockout is enforced by checking formRequests.startAt/endAt (or template meta) in your submission page.
                            </Text>
                        </p>
                    </Modal>
                </>
            )}
        </div>
    )
}
