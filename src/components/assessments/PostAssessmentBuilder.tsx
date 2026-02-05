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
    Segmented,
    InputNumber,
    Collapse,
    Upload,
    Modal
} from 'antd'
import type { UploadProps } from 'antd'
import {
    collection,
    doc,
    getDoc,
    getDocs,
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
import {
    ArrowLeftOutlined,
    SaveOutlined,
    CloudUploadOutlined,
    PlusOutlined,
    FileTextOutlined,
    InboxOutlined,
    FileDoneOutlined,
    TeamOutlined,
    ClockCircleOutlined,
    FieldTimeOutlined,
    StopOutlined,
    CheckCircleOutlined
} from '@ant-design/icons'
import { LoadingOverlay } from '../shared/LoadingOverlay'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { Dragger } = Upload

type InterventionType = 'singular' | 'grouped'
type AssessmentType = 'post_intervention' | 'general'
type TimingMode = 'none' | 'per_question' | 'overall'
type ResultsReleaseMode = 'instant' | 'after_hours'

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
    correctAnswer?: any
    points?: number
    timeLimitSeconds?: number | null
}

type TimedQuestionType = Exclude<FormField['type'], 'heading'>

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

function clampInt(n: any, min: number, max: number) {
    const x = Number(n)
    if (!Number.isFinite(x)) return min
    return Math.max(min, Math.min(max, Math.floor(x)))
}

function secondsToLabel(sec?: number | null) {
    if (!sec || sec <= 0) return '—'
    if (sec < 60) return `${sec}s`
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return s ? `${m}m ${s}s` : `${m}m`
}

const toDayjsSafe = (v: any) => {
    if (!v) return null
    const d = v?.toDate ? v.toDate() : v
    const dj = dayjs(d)
    return dj.isValid() ? dj : null
}

const DEFAULT_TYPE_TIMES: Record<TimedQuestionType, number> = {
    short: 60,
    long: 180,
    radio: 45,
    checkbox: 60,
    number: 45,
    rating: 30
}

const AI_EXTRACT_ENDPOINT = 'https://yoursdvniel-smart-incubation.hf.space/extract-assessment'

type ExtractResponse = {
    ok?: boolean
    draft?: any
    warnings?: Array<{ code?: string; message?: string; fieldIds?: string[] }>
    source?: any
    error?: string
    message?: string
}

function safeFieldType(t: any): FormField['type'] {
    const allowed: FormField['type'][] = ['short', 'long', 'radio', 'checkbox', 'rating', 'number', 'heading']
    if (allowed.includes(t)) return t
    return 'short'
}

function makeId(prefix: string) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function sanitizeFields(raw: any[], timingMode: TimingMode, perTypeTimes: Record<TimedQuestionType, number>): FormField[] {
    const arr = Array.isArray(raw) ? raw : []
    return arr
        .map((x: any) => {
            const type = safeFieldType(x?.type)
            const id = (x?.id && String(x.id)) || makeId(type)
            const label = (x?.label && String(x.label).trim()) || (type === 'heading' ? 'Section' : 'Question')
            const required = type === 'heading' ? false : Boolean(x?.required ?? true)

            const options =
                type === 'radio' || type === 'checkbox'
                    ? ensureAtLeastTwoOptions(type, Array.isArray(x?.options) ? x.options.map((o: any) => String(o)) : [])
                    : []

            const points = type === 'heading' ? 0 : clampInt(x?.points ?? 1, 0, 1000)

            // If timingMode === per_question:
            // - use provided timeLimitSeconds if valid
            // - otherwise inherit from perTypeTimes for that type
            let timeLimitSeconds: number | null = null
            if (type === 'heading') {
                timeLimitSeconds = null
            } else if (timingMode === 'per_question') {
                const provided = x?.timeLimitSeconds
                const hasProvided = Number.isFinite(Number(provided)) && Number(provided) > 0
                const inherited = clampInt(perTypeTimes[type as TimedQuestionType] ?? 0, 0, 60 * 60)
                timeLimitSeconds = hasProvided ? clampInt(provided, 1, 60 * 60) : inherited || null
            } else {
                // keep null unless explicitly present (but your UI only uses it in per_question)
                timeLimitSeconds = Number.isFinite(Number(x?.timeLimitSeconds)) ? clampInt(x.timeLimitSeconds, 0, 60 * 60) : null
            }

            // correctAnswer – keep as is, but ensure it matches options for radio/checkbox if possible
            let correctAnswer = x?.correctAnswer
            if (type === 'radio' && correctAnswer && !(options || []).includes(correctAnswer)) {
                correctAnswer = undefined
            }
            if (type === 'checkbox' && Array.isArray(correctAnswer)) {
                correctAnswer = correctAnswer.filter((v: any) => (options || []).includes(v))
            }

            return {
                id,
                type,
                label,
                required,
                description: x?.description ? String(x.description) : '',
                options,
                correctAnswer,
                points,
                timeLimitSeconds
            } as FormField
        })
        .filter(Boolean)
}

export default function AssessmentBuilder() {
    const { user } = useFullIdentity()
    const { message, modal } = App.useApp()
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const [draftId, setDraftId] = useState<string | null>(null)

    const [savingAction, setSavingAction] = useState<null | 'draft' | 'publish'>(null)

    const isEditing = Boolean(id || draftId)
    const publishLabel = isEditing ? 'Update' : 'Publish'

    const STICKY_TOP = 16
    const stickyBodyMaxHeight = `calc(100vh - ${STICKY_TOP + 32}px)`

    const screens = Grid.useBreakpoint()
    const isSmall = !screens.md

    const [assessmentType, setAssessmentType] = useState<AssessmentType>('post_intervention')

    const isSuper =
        (user?.email || '').toLowerCase().endsWith('@quantilytix.co.za') ||
        (user?.role || '').toLowerCase() === 'superadmin'

    // results visibility
    const [resultsReleaseMode, setResultsReleaseMode] = useState<ResultsReleaseMode>('instant')
    const [resultsReleaseHours, setResultsReleaseHours] = useState<number>(24) // sensible default


    // Post-intervention recipients
    const [completed, setCompleted] = useState<Assigned[]>([])
    const [mode, setMode] = useState<'single' | 'grouped'>('single')
    const [selectedAssigned, setSelectedAssigned] = useState<Assigned[]>([])
    const [searchAssigned, setSearchAssigned] = useState('')

    // General recipients
    const [participants, setParticipants] = useState<ParticipantRow[]>([])
    const [loadingParticipants, setLoadingParticipants] = useState(false)
    const [selectedParticipants, setSelectedParticipants] = useState<ParticipantRow[]>([])
    const [searchParticipants, setSearchParticipants] = useState('')

    // Builder
    const [form] = Form.useForm()
    const [fields, setFields] = useState<FormField[]>([])
    const [autoGradeOn, setAutoGradeOn] = useState(true)
    const [timeWindowOn, setTimeWindowOn] = useState(false)

    // timing + attempts
    const [timingMode, setTimingMode] = useState<TimingMode>('none')
    const [overallTimeSeconds, setOverallTimeSeconds] = useState<number>(0)
    const [maxAttempts, setMaxAttempts] = useState<number>(1)

    // per question type defaults
    const [perTypeTimes, setPerTypeTimes] = useState<Record<TimedQuestionType, number>>(DEFAULT_TYPE_TIMES)

    const qRefs = useRef<Record<string, HTMLDivElement | null>>({})

    // ✅ AI extraction UI state
    const [extractOpen, setExtractOpen] = useState(false)
    const [extracting, setExtracting] = useState(false)
    const [extractWarnings, setExtractWarnings] = useState<Array<{ code?: string; message?: string }>>([])
    const [extractSource, setExtractSource] = useState<any>(null)

    // ----------------------------
    // AI: call endpoint & apply result
    // ----------------------------
    const applyDraftToBuilder = (draft: any, mode: 'replace' | 'append') => {
        const nextTitle = (draft?.title && String(draft.title)) || ''
        const nextDesc = (draft?.description && String(draft.description)) || ''

        // category may come from AI, but we should not unexpectedly flip it unless it’s valid
        const nextCategory = (draft?.category as AssessmentType) || (draft?.assessmentMeta?.assessmentType as AssessmentType) || null
        if (nextCategory === 'general' || nextCategory === 'post_intervention') {
            setAssessmentType(nextCategory)
        }

        const meta = draft?.assessmentMeta || {}

        const restoredResultsMode: ResultsReleaseMode =
            meta?.resultsReleaseMode === 'after_hours' || meta?.resultsReleaseMode === 'instant'
                ? meta.resultsReleaseMode
                : resultsReleaseMode

        const restoredResultsHours = clampInt(meta?.resultsReleaseHours ?? resultsReleaseHours, 1, 24 * 30)

        setResultsReleaseMode(restoredResultsMode)
        setResultsReleaseHours(restoredResultsHours)


        // timing/attempts (only set if present and valid)
        const restoredTiming: TimingMode =
            meta?.timingMode === 'per_question' || meta?.timingMode === 'overall' || meta?.timingMode === 'none'
                ? meta.timingMode
                : timingMode

        // Restore perTypeTimes FIRST (so field inheritance works)
        const restoredTypeTimes = meta?.perTypeTimes
        if (restoredTypeTimes && typeof restoredTypeTimes === 'object') {
            const cleaned: Record<TimedQuestionType, number> = {
                short: clampInt(restoredTypeTimes.short ?? perTypeTimes.short, 0, 60 * 60),
                long: clampInt(restoredTypeTimes.long ?? perTypeTimes.long, 0, 60 * 60),
                radio: clampInt(restoredTypeTimes.radio ?? perTypeTimes.radio, 0, 60 * 60),
                checkbox: clampInt(restoredTypeTimes.checkbox ?? perTypeTimes.checkbox, 0, 60 * 60),
                number: clampInt(restoredTypeTimes.number ?? perTypeTimes.number, 0, 60 * 60),
                rating: clampInt(restoredTypeTimes.rating ?? perTypeTimes.rating, 0, 60 * 60)
            }
            setPerTypeTimes(cleaned)
        }

        setTimingMode(restoredTiming)

        const restoredOverall = clampInt(meta?.overallTimeSeconds ?? overallTimeSeconds, 0, 24 * 60 * 60)
        setOverallTimeSeconds(restoredTiming === 'overall' ? restoredOverall : 0)

        const restoredMaxAttempts = clampInt(meta?.maxAttempts ?? maxAttempts, 1, 50)
        setMaxAttempts(restoredMaxAttempts)

        setAutoGradeOn(Boolean(meta?.autoGrade ?? autoGradeOn))

        // time window
        const startDj = toDayjsSafe(meta?.startAt)
        const endDj = toDayjsSafe(meta?.endAt)
        const dueDj = toDayjsSafe(meta?.dueAt)

        const hasValidWindow = Boolean(meta?.timeWindowEnabled && startDj && endDj)
        setTimeWindowOn(hasValidWindow)

        form.setFieldsValue({
            title: nextTitle || form.getFieldValue('title') || '',
            description: nextDesc || form.getFieldValue('description') || '',
            dueAt: dueDj ?? form.getFieldValue('dueAt') ?? undefined,
            timeWindow: hasValidWindow ? [startDj!, endDj!] : undefined
        })

        // sanitize fields
        const effectivePerTypeTimes =
            restoredTypeTimes && typeof restoredTypeTimes === 'object'
                ? {
                    short: clampInt(restoredTypeTimes.short ?? DEFAULT_TYPE_TIMES.short, 0, 60 * 60),
                    long: clampInt(restoredTypeTimes.long ?? DEFAULT_TYPE_TIMES.long, 0, 60 * 60),
                    radio: clampInt(restoredTypeTimes.radio ?? DEFAULT_TYPE_TIMES.radio, 0, 60 * 60),
                    checkbox: clampInt(restoredTypeTimes.checkbox ?? DEFAULT_TYPE_TIMES.checkbox, 0, 60 * 60),
                    number: clampInt(restoredTypeTimes.number ?? DEFAULT_TYPE_TIMES.number, 0, 60 * 60),
                    rating: clampInt(restoredTypeTimes.rating ?? DEFAULT_TYPE_TIMES.rating, 0, 60 * 60)
                }
                : perTypeTimes

        const parsedFields = sanitizeFields(draft?.fields || [], restoredTiming, effectivePerTypeTimes)

        setFields(prev => (mode === 'append' ? [...prev, ...parsedFields] : parsedFields))

        message.success(mode === 'append' ? 'AI questions added' : 'AI questions loaded')
    }

    const extractFromFile = async (file: File) => {
        setExtracting(true)
        setExtractWarnings([])
        setExtractSource(null)

        try {
            const fd = new FormData()
            // Most HF spaces expect "file" – if yours expects a different key, change this to match backend
            fd.append('file', file, file.name)

            // Optional hints for backend (safe to ignore server-side)
            fd.append(
                'builderHints',
                JSON.stringify({
                    timingMode,
                    perTypeTimes,
                    autoGrade: autoGradeOn,
                    maxAttempts
                })
            )

            const res = await fetch(AI_EXTRACT_ENDPOINT, {
                method: 'POST',
                body: fd
            })

            // if server returns non-JSON error, this protects UI
            const text = await res.text()
            let data: ExtractResponse | any = null
            try {
                data = JSON.parse(text)
            } catch {
                data = { ok: false, error: 'non_json_response', message: text?.slice(0, 500) }
            }

            if (!res.ok || data?.ok === false) {
                const errMsg = data?.message || data?.error || `Extraction failed (${res.status})`
                message.error(errMsg)
                return
            }

            const draft = data?.draft ?? data // some backends might return draft at root
            if (!draft || !Array.isArray(draft?.fields) || draft.fields.length === 0) {
                message.error('AI returned no questions. Check document formatting or endpoint output.')
                return
            }

            setExtractWarnings(Array.isArray(data?.warnings) ? data.warnings : [])
            setExtractSource(data?.source || null)

            modal.confirm({
                title: 'Populate builder with AI extraction?',
                content: (
                    <div style={{ display: 'grid', gap: 8 }}>
                        <Text>
                            Found <b>{draft.fields.length}</b> items (including headings/questions).
                        </Text>
                        <Text type="secondary">
                            Choose whether to replace your current questions or append to them.
                        </Text>
                        {Array.isArray(data?.warnings) && data.warnings.length > 0 && (
                            <Alert
                                type="warning"
                                showIcon
                                message="Warnings"
                                description={
                                    <div style={{ display: 'grid', gap: 4 }}>
                                        {data.warnings.slice(0, 5).map((w: any, i: number) => (
                                            <div key={i}>• {w?.message || w?.code || 'Warning'}</div>
                                        ))}
                                    </div>
                                }
                            />
                        )}
                    </div>
                ),
                okText: 'Replace',
                cancelText: 'Append',
                onOk: () => applyDraftToBuilder(draft, 'replace'),
                onCancel: () => applyDraftToBuilder(draft, 'append')
            })
        } catch (e) {
            console.error(e)
            message.error('Failed to call extraction endpoint')
        } finally {
            setExtracting(false)
        }
    }

    const uploadProps: UploadProps = {
        multiple: false,
        showUploadList: false,
        beforeUpload: file => {
            // block auto-upload; we control upload manually
            const okTypes = [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain'
            ]
            // allow unknown types too (some browsers give empty type for docx)
            const isProbablyOk = okTypes.includes(file.type) || !file.type
            if (!isProbablyOk) {
                message.warning('Upload a PDF, DOCX, or TXT')
                return Upload.LIST_IGNORE
            }
            extractFromFile(file as File)
            return false
        }
    }

    // ----------------------------
    // Load draft (template)
    // ----------------------------
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

                setAssessmentType((data.category as AssessmentType) || 'post_intervention')

                const loadedFields = Array.isArray(data.fields) ? (data.fields as FormField[]) : []
                setFields(
                    loadedFields.map(f => ({
                        ...f,
                        options: ensureAtLeastTwoOptions(f.type, f.options),
                        timeLimitSeconds:
                            f.type === 'heading'
                                ? null
                                : (typeof (f as any).timeLimitSeconds === 'number' ? (f as any).timeLimitSeconds : null)
                    }))
                )

                const meta = data.assessmentMeta || {}

                const restoredResultsMode: ResultsReleaseMode =
                    meta?.resultsReleaseMode === 'after_hours' || meta?.resultsReleaseMode === 'instant'
                        ? meta.resultsReleaseMode
                        : 'instant'

                setResultsReleaseMode(restoredResultsMode)

                const restoredResultsHours = clampInt(meta?.resultsReleaseHours ?? 24, 1, 24 * 30)
                setResultsReleaseHours(restoredResultsHours)

                setAutoGradeOn(Boolean(meta.autoGrade))

                if (meta.interventionScope === 'grouped') setMode('grouped')
                else setMode('single')

                const restoredTiming: TimingMode =
                    meta?.timingMode === 'per_question' || meta?.timingMode === 'overall' || meta?.timingMode === 'none'
                        ? meta.timingMode
                        : 'none'
                setTimingMode(restoredTiming)

                const restoredOverall = clampInt(meta?.overallTimeSeconds ?? 0, 0, 24 * 60 * 60)
                setOverallTimeSeconds(restoredOverall)

                const restoredMaxAttempts = clampInt(meta?.maxAttempts ?? 1, 1, 50)
                setMaxAttempts(restoredMaxAttempts)

                const restoredTypeTimes = meta?.perTypeTimes
                if (restoredTypeTimes && typeof restoredTypeTimes === 'object') {
                    setPerTypeTimes({
                        short: clampInt(restoredTypeTimes.short ?? DEFAULT_TYPE_TIMES.short, 0, 60 * 60),
                        long: clampInt(restoredTypeTimes.long ?? DEFAULT_TYPE_TIMES.long, 0, 60 * 60),
                        radio: clampInt(restoredTypeTimes.radio ?? DEFAULT_TYPE_TIMES.radio, 0, 60 * 60),
                        checkbox: clampInt(restoredTypeTimes.checkbox ?? DEFAULT_TYPE_TIMES.checkbox, 0, 60 * 60),
                        number: clampInt(restoredTypeTimes.number ?? DEFAULT_TYPE_TIMES.number, 0, 60 * 60),
                        rating: clampInt(restoredTypeTimes.rating ?? DEFAULT_TYPE_TIMES.rating, 0, 60 * 60)
                    })
                }

                const dueDj = toDayjsSafe(meta?.dueAt)
                const startDj = toDayjsSafe(meta?.startAt)
                const endDj = toDayjsSafe(meta?.endAt)

                const hasValidWindow = Boolean(meta?.timeWindowEnabled && startDj && endDj)
                setTimeWindowOn(hasValidWindow)

                form.setFieldsValue({
                    title: data.title || '',
                    description: data.description || '',
                    dueAt: dueDj ?? undefined,
                    timeWindow: hasValidWindow ? [startDj!, endDj!] : undefined
                })

                if ((data.category || '') === 'general' && Array.isArray(meta.participantIds)) {
                    ; (window as any).__pendingParticipantIds = meta.participantIds
                }
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

    // Load completed assignedInterventions
    useEffect(() => {
        const load = async () => {
            if (assessmentType !== 'post_intervention') {
                setCompleted([])
                return
            }

            try {
                const snap = await getDocs(query(collection(db, 'assignedInterventions'), where('status', '==', 'completed')))

                const rows: Assigned[] = []
                for (const d of snap.docs) {
                    const data = d.data() as any

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

                rows.sort((a, b) => {
                    const ta = (a.completedAt?.toDate?.() ?? new Date(a.completedAt)).getTime?.() ?? 0
                    const tb = (b.completedAt?.toDate?.() ?? new Date(b.completedAt)).getTime?.() ?? 0
                    return tb - ta
                })

                const pending = (window as any).__pendingInterventionIds as string[] | undefined
                if (pending?.length) {
                    const pick = rows.filter(r => pending.includes(r.interventionId))
                    setSelectedAssigned(mode === 'single' ? pick.slice(0, 1) : pick)
                        ; (window as any).__pendingInterventionIds = undefined
                }

                setCompleted(rows)
            } catch (e) {
                console.error(e)
                message.error('Failed to load completed interventions')
            }
        }
        load()
    }, [assessmentType, isSuper, message, user?.companyCode, mode])

    const filteredAssigned = useMemo(() => {
        const s = searchAssigned.trim().toLowerCase()
        if (!s) return completed
        return completed.filter(
            r =>
                (r.participantName || '').toLowerCase().includes(s) ||
                (r.interventionTitle || '').toLowerCase().includes(s)
        )
    }, [completed, searchAssigned])

    // Load accepted participants
    useEffect(() => {
        const load = async () => {
            if (assessmentType !== 'general') {
                setParticipants([])
                return
            }

            setLoadingParticipants(true)
            try {
                const appQ = isSuper
                    ? query(collection(db, 'applications'), where('applicationStatus', '==', 'accepted'))
                    : query(
                        collection(db, 'applications'),
                        where('applicationStatus', '==', 'accepted'),
                        where('companyCode', '==', user?.companyCode || '')
                    )

                const appSnap = await getDocs(appQ)

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

                const idsChunks = chunk(acceptedIds, 10)
                const rows: ParticipantRow[] = []

                for (const c of idsChunks) {
                    const pSnap = await getDocs(query(collection(db, 'participants'), where(documentId(), 'in', c)))
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

                rows.sort((a, b) => (a.beneficiaryName || '').localeCompare(b.beneficiaryName || ''))

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
        return participants.filter(
            p =>
                (p.beneficiaryName || '').toLowerCase().includes(s) ||
                (p.email || '').toLowerCase().includes(s) ||
                (p.sector || '').toLowerCase().includes(s)
        )
    }, [participants, searchParticipants])

    const interventionIdsInSelection = useMemo(() => {
        if (assessmentType !== 'post_intervention') return []
        return Array.from(new Set(selectedAssigned.map(s => s.interventionId)))
    }, [assessmentType, selectedAssigned])

    const totals = useMemo(() => {
        const hardAuto = new Set(['radio', 'checkbox', 'number', 'rating'])
        const questions = fields.filter(f => f.type !== 'heading')
        const autoGraded = questions.filter(q => {
            if (!autoGradeOn) return false
            if (hardAuto.has(q.type)) return true
            if ((q.type === 'short' || q.type === 'long') && typeof q.correctAnswer === 'string' && q.correctAnswer.trim())
                return true
            return false
        }).length
        const totalPoints = questions.reduce((sum, q) => sum + Number(q.points || 0), 0)
        const perQCount = questions.filter(q => (q.timeLimitSeconds || 0) > 0).length
        return { questions: questions.length, autoGraded, totalPoints, perQCount }
    }, [fields, autoGradeOn])

    const presentTimedTypes = useMemo(() => {
        const set = new Set<TimedQuestionType>()
        fields.forEach(f => {
            if (f.type !== 'heading') set.add(f.type as TimedQuestionType)
        })
        // keep a stable, predictable order
        const order: TimedQuestionType[] = ['short', 'long', 'radio', 'checkbox', 'number', 'rating']
        return order.filter(t => set.has(t))
    }, [fields])


    // Field ops
    const addField = (type: FormField['type']) => {
        const id = `${type}_${Date.now()}`

        const inheritedTime =
            timingMode === 'per_question' && type !== 'heading'
                ? clampInt(perTypeTimes[type as TimedQuestionType] ?? 0, 0, 60 * 60)
                : null

        const base: FormField = {
            id,
            type,
            label: type === 'heading' ? 'Section' : 'Question',
            required: type !== 'heading',
            description: '',
            options: ensureAtLeastTwoOptions(type, type === 'radio' || type === 'checkbox' ? ['Option 1', 'Option 2'] : []),
            points: type === 'heading' ? 0 : 1,
            timeLimitSeconds: type === 'heading' ? null : inheritedTime
        }

        setFields(prev => [...prev, base])

        requestAnimationFrame(() => {
            qRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
    }

    const updateField = (id: string, patch: Partial<FormField>) =>
        setFields(prev =>
            prev.map(f => {
                if (f.id !== id) return f
                const next: FormField = { ...f, ...patch }

                if (next.type === 'radio' || next.type === 'checkbox') {
                    next.options = ensureAtLeastTwoOptions(next.type, next.options)
                    if (next.type === 'radio' && next.correctAnswer && !(next.options || []).includes(next.correctAnswer)) {
                        next.correctAnswer = undefined
                    }
                    if (next.type === 'checkbox' && Array.isArray(next.correctAnswer)) {
                        next.correctAnswer = next.correctAnswer.filter((x: string) => (next.options || []).includes(x))
                    }
                }

                if (next.type === 'heading') next.timeLimitSeconds = null
                if (next.timeLimitSeconds != null) {
                    next.timeLimitSeconds = clampInt(next.timeLimitSeconds, 0, 60 * 60)
                }

                return next
            })
        )

    const removeField = (id: string) => setFields(prev => prev.filter(f => f.id !== id))

    const clearAllQuestions = () => {
        Modal.confirm({
            title: 'Clear all questions?',
            content: 'This will remove every question/section in the builder. This cannot be undone.',
            okText: 'Clear All',
            okButtonProps: { danger: true },
            cancelText: 'Cancel',
            onOk: () => setFields([])
        })
    }


    const applyDefaultsToExisting = () => {
        if (timingMode !== 'per_question') return
        setFields(prev =>
            prev.map(f => {
                if (f.type === 'heading') return f
                const t = clampInt(perTypeTimes[f.type as TimedQuestionType] ?? 0, 0, 60 * 60)
                return { ...f, timeLimitSeconds: t }
            })
        )
        message.success('Applied defaults to existing questions')
    }

    // Save draft
    const handleSaveDraft = async () => {
        if (savingAction) return
        setSavingAction('draft')

        try {
            const vals = await form.validateFields()

            const tw = vals.timeWindow as [Dayjs, Dayjs] | undefined
            const startAt = timeWindowOn ? tw?.[0]?.toDate?.() : undefined
            const endAt = timeWindowOn ? tw?.[1]?.toDate?.() : undefined
            const dueAt = (vals.dueAt as Dayjs | undefined)?.toDate?.() || dayjs().add(7, 'day').toDate()

            if (timeWindowOn && (!startAt || !endAt)) return message.warning('Set Start Time and End Time (or switch off).')
            if (timeWindowOn && startAt && endAt && dayjs(endAt).isBefore(dayjs(startAt)))
                return message.warning('End Time must be after Start Time.')

            if (timingMode === 'overall' && overallTimeSeconds <= 0)
                return message.warning('Set an overall time limit (or switch timing off).')

            if (timingMode === 'per_question') {
                const q = fields.filter(f => f.type !== 'heading')
                const anyMissing = q.some(x => !x.timeLimitSeconds || x.timeLimitSeconds <= 0)
                if (anyMissing) return message.warning('Per-question timing is ON: set a time limit for every question (or apply defaults).')
            }

            const templateId = draftId || id || doc(collection(db, 'formTemplates')).id
            const templateRef = doc(db, 'formTemplates', templateId)

            const now = new Date()

            if (resultsReleaseMode === 'after_hours' && (!resultsReleaseHours || resultsReleaseHours < 1)) {
                return message.warning('Set a valid results delay in hours (minimum 1).')
            }

            await setDoc(
                templateRef,
                {
                    id: templateRef.id,
                    title: vals.title || 'Untitled draft',
                    description: vals.description || '',
                    category: assessmentType,
                    status: 'draft',
                    fields,
                    assessmentMeta: {
                        assessmentType,
                        interventionScope: assessmentType === 'post_intervention' ? mode : 'none',
                        autoGrade: autoGradeOn,
                        timeWindowEnabled: timeWindowOn,
                        startAt: startAt || null,
                        endAt: endAt || null,
                        dueAt,
                        timingMode,
                        overallTimeSeconds: timingMode === 'overall' ? clampInt(overallTimeSeconds, 0, 24 * 60 * 60) : 0,
                        maxAttempts: clampInt(maxAttempts, 1, 50),
                        perTypeTimes: timingMode === 'per_question' ? perTypeTimes : null
                    },
                    companyCode: user?.companyCode || '',
                    updatedAt: now,
                    ...(draftId || id ? {} : { createdAt: now })
                },
                { merge: true }
            )

            if (!draftId) setDraftId(templateRef.id)
            message.success('Draft saved')
        } catch (e: any) {
            if (e?.errorFields) return
            console.error(e)
            message.error('Failed to save draft')
        } finally {
            setSavingAction(null)
        }
    }

    // Publish
    const handlePublish = async () => {
        if (savingAction) return
        setSavingAction('publish')

        try {
            const vals = await form.validateFields()
            if (!fields.length) return message.warning('Add at least one question')

            const tw = vals.timeWindow as [Dayjs, Dayjs] | undefined
            const startAt = timeWindowOn ? tw?.[0]?.toDate?.() : undefined
            const endAt = timeWindowOn ? tw?.[1]?.toDate?.() : undefined

            if (timeWindowOn && (!startAt || !endAt)) return message.warning('Set Start Time and End Time (or switch off).')
            if (timeWindowOn && startAt && endAt && dayjs(endAt).isBefore(dayjs(startAt)))
                return message.warning('End Time must be after Start Time.')

            if (timingMode === 'overall' && overallTimeSeconds <= 0)
                return message.warning('Set an overall time limit (or switch timing off).')

            if (timingMode === 'per_question') {
                const q = fields.filter(f => f.type !== 'heading')
                const anyMissing = q.some(x => !x.timeLimitSeconds || x.timeLimitSeconds <= 0)
                if (anyMissing) return message.warning('Per-question timing is ON: set a time limit for every question (or apply defaults).')
            }

            const dueAt = (vals.dueAt as Dayjs | undefined)?.toDate?.() || dayjs().add(7, 'day').toDate()

            const templateId = draftId || id || doc(collection(db, 'formTemplates')).id
            const templateRef = doc(db, 'formTemplates', templateId)

            const now = new Date()

            if (resultsReleaseMode === 'after_hours' && (!resultsReleaseHours || resultsReleaseHours < 1)) {
                return message.warning('Set a valid results delay in hours (minimum 1).')
            }


            await setDoc(
                templateRef,
                {
                    id: templateRef.id,
                    title: vals.title,
                    description: vals.description || '',
                    category: assessmentType,
                    status: 'published',
                    fields,
                    assessmentMeta: {
                        assessmentType,
                        interventionScope: assessmentType === 'post_intervention' ? mode : 'none',
                        autoGrade: autoGradeOn,
                        timeWindowEnabled: timeWindowOn,
                        startAt: startAt || null,
                        endAt: endAt || null,
                        dueAt,
                        timingMode,
                        overallTimeSeconds: timingMode === 'overall' ? clampInt(overallTimeSeconds, 0, 24 * 60 * 60) : 0,
                        maxAttempts: clampInt(maxAttempts, 1, 50),
                        resultsReleaseMode,
                        resultsReleaseHours: resultsReleaseMode === 'after_hours' ? clampInt(resultsReleaseHours, 1, 24 * 30) : 0,
                        perTypeTimes: timingMode === 'per_question' ? perTypeTimes : null
                    },
                    companyCode: user?.companyCode || '',
                    updatedAt: now,
                    ...(draftId || id ? {} : { createdAt: now })
                },
                { merge: true }
            )

            if (!draftId) setDraftId(templateRef.id)

            message.success(isEditing ? 'Updated. You can send it from the Send Form page.' : 'Published. You can send it from the Send Form page.')
            navigate(-1)
        } catch (e: any) {
            if (e?.errorFields) return
            console.error(e)
            message.error(isEditing ? 'Failed to update' : 'Failed to publish')
        } finally {
            setSavingAction(null)
        }
    }

    const onToggleTimeWindow = (checked: boolean) => {
        setTimeWindowOn(checked)
        if (!checked) form.setFieldsValue({ timeWindow: undefined })
    }

    // UI
    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            {(savingAction || extracting) && (
                <LoadingOverlay
                    tip={
                        extracting
                            ? 'Extracting from document...'
                            : savingAction === 'draft'
                                ? 'Saving draft...'
                                : isEditing
                                    ? 'Updating...'
                                    : 'Publishing...'
                    }
                />
            )}

            {isSmall ? (
                <>
                    <Title level={4}>Assessment Builder</Title>
                    <Alert type="warning" showIcon message="Use a larger screen" description="This builder works best on a tablet or desktop." />
                </>
            ) : (
                <>
                    <DashboardHeaderCard
                        title="Assessment Builder"
                        subtitle="Builder with recipient filtering, time-window lockout, timers, max attempts, auto-grading, and AI extraction."
                        extraRight={
                            <Space wrap>
                                <Button icon={<FileTextOutlined />} onClick={() => setExtractOpen(true)}>
                                    AI Extract
                                </Button>

                                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
                                    Back
                                </Button>

                                <Button icon={<SaveOutlined />} onClick={handleSaveDraft}>
                                    Save Draft
                                </Button>

                                <Button type="primary" icon={<CloudUploadOutlined />} onClick={handlePublish} disabled={!fields.length}>
                                    {publishLabel}
                                </Button>

                                {assessmentType === 'post_intervention' && <Tag>Interventions: {interventionIdsInSelection.length}</Tag>}
                            </Space>
                        }
                    />

                    <Modal
                        open={extractOpen}
                        onCancel={() => setExtractOpen(false)}
                        footer={null}
                        title="Extract assessment from document"
                        width={720}
                    >
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                            <Alert
                                type="info"
                                showIcon
                                message="How it works"
                                description="Drop a PDF/DOCX/TXT. The AI will return a draft (title, description, questions). You can Replace or Append."
                            />

                            <Dragger {...uploadProps} disabled={extracting}>
                                <p className="ant-upload-drag-icon">
                                    <InboxOutlined />
                                </p>
                                <p className="ant-upload-text">Click or drag file to this area to extract</p>
                                <p className="ant-upload-hint">PDF / DOCX / TXT</p>
                            </Dragger>

                            {extractSource && (
                                <Card size="small" style={{ borderRadius: 12 }}>
                                    <Space wrap>
                                        <Tag color="blue">Source</Tag>
                                        <Text type="secondary">{JSON.stringify(extractSource).slice(0, 200)}{JSON.stringify(extractSource).length > 200 ? '…' : ''}</Text>
                                    </Space>
                                </Card>
                            )}

                            {extractWarnings.length > 0 && (
                                <Alert
                                    type="warning"
                                    showIcon
                                    message="Warnings from extraction"
                                    description={
                                        <div style={{ display: 'grid', gap: 4 }}>
                                            {extractWarnings.slice(0, 8).map((w, i) => (
                                                <div key={i}>• {w.message || w.code || 'Warning'}</div>
                                            ))}
                                        </div>
                                    }
                                />
                            )}

                            <Divider />

                            <Space wrap>
                                <Button
                                    danger
                                    onClick={() => {
                                        if (!fields.length) return
                                        Modal.confirm({
                                            title: 'Clear all questions?',
                                            content: 'This will remove all current questions in the builder.',
                                            okText: 'Clear',
                                            okButtonProps: { danger: true },
                                            onOk: () => setFields([])
                                        })
                                    }}
                                >
                                    Clear Questions
                                </Button>

                                <Button onClick={() => setExtractOpen(false)}>Close</Button>
                            </Space>
                        </Space>
                    </Modal>

                    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 16, marginTop: 16 }}>
                        {/* LEFT: QUESTION NAV */}
                        <Card
                            style={{ position: 'sticky', top: 16, alignSelf: 'start', borderRadius: 16 }}
                            bodyStyle={{ padding: 16, maxHeight: stickyBodyMaxHeight, overflow: 'auto' }}
                            title={
                                <Space align="baseline">
                                    <span>Questions</span>
                                    <Badge count={fields.filter(f => f.type !== 'heading').length} showZero />
                                </Space>
                            }
                        >
                            <List
                                size="small"
                                dataSource={fields}
                                locale={{ emptyText: 'No questions yet' }}
                                renderItem={(f, idx) => (
                                    <List.Item
                                        style={{ cursor: 'pointer', borderRadius: 10, padding: '8px 10px' }}
                                        onClick={() => qRefs.current[f.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                    >
                                        <Space>
                                            <Tag>{idx + 1}</Tag>
                                            <span style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {f.label || f.type.toUpperCase()}
                                            </span>
                                            {timingMode === 'per_question' && f.type !== 'heading' && (
                                                <Tag color={(f.timeLimitSeconds || 0) > 0 ? 'green' : 'default'}>{secondsToLabel(f.timeLimitSeconds)}</Tag>
                                            )}
                                        </Space>
                                    </List.Item>
                                )}
                            />
                        </Card>

                        {/* CENTER: BUILDER */}
                        <Card style={{ overflow: 'visible', borderRadius: 16 }} bodyStyle={{ paddingBottom: 24 }}>
                            <div style={{ position: 'sticky', top: 16, zIndex: 2, background: '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
                                    <Space align="baseline" wrap>
                                        <Text strong>Build Assessment</Text>
                                        <Tooltip title="Questions (excluding headings)">
                                            <Tag color="blue">Q: {totals.questions}</Tag>
                                        </Tooltip>
                                        <Tooltip title="Auto-gradable questions (based on your settings)">
                                            <Tag>Auto: {totals.autoGraded}</Tag>
                                        </Tooltip>
                                        <Tooltip title="Total points">
                                            <Tag color="gold">Pts: {totals.totalPoints}</Tag>
                                        </Tooltip>
                                        <Tooltip title="Timing mode">
                                            <Tag color="geekblue">
                                                Timer:{' '}
                                                {timingMode === 'none'
                                                    ? 'Off'
                                                    : timingMode === 'overall'
                                                        ? `Overall (${secondsToLabel(overallTimeSeconds)})`
                                                        : `Per Q (${totals.perQCount}/${totals.questions})`}
                                            </Tag>
                                        </Tooltip>
                                        <Tooltip title="When learners can view results">
                                            <Tag color="cyan">
                                                Results: {resultsReleaseMode === 'instant' ? 'Instant' : `After ${resultsReleaseHours}h`}
                                            </Tag>
                                        </Tooltip>

                                        <Tooltip title="Maximum tries per learner">
                                            <Tag color="purple">Tries: {maxAttempts}</Tag>
                                        </Tooltip>
                                    </Space>
                                </div>
                                <Divider style={{ margin: '10px 0' }} />
                            </div>

                            <Form form={form} layout="vertical">
                                <Form.Item label="Assessment Type" required>

                                    <Segmented
                                        value={assessmentType}
                                        size="large"
                                        onChange={(v: any) => {
                                            setAssessmentType(v)
                                            setSelectedAssigned([])
                                            setSelectedParticipants([])
                                            setMode('single')
                                            setSearchAssigned('')
                                            setSearchParticipants('')
                                        }}
                                        options={[
                                            {
                                                value: 'post_intervention',
                                                label: (
                                                    <Space>
                                                        <FileDoneOutlined />
                                                        <span>Post-Intervention</span>
                                                    </Space>
                                                )
                                            },
                                            {
                                                value: 'general',
                                                label: (
                                                    <Space>
                                                        <TeamOutlined />
                                                        <span>General</span>
                                                    </Space>
                                                )
                                            }
                                        ]}
                                        style={{
                                            width: 'fit-content',
                                            display: 'inline-flex',
                                            borderRadius: 999,
                                            padding: 4,
                                            background: '#f5f7fa'
                                        }}
                                    />

                                </Form.Item>

                                <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
                                    <Input placeholder="e.g., Post-Workshop Knowledge Check" />
                                </Form.Item>

                                <Form.Item name="description" label="Description">
                                    <Input.TextArea rows={2} placeholder="Short description shown to learners" />
                                </Form.Item>

                                <Space wrap size="large" style={{ marginBottom: 8 }}>
                                    <Form.Item name="dueAt" label="Due date" style={{ marginBottom: 0 }}>
                                        <DatePicker style={{ width: 240 }} />
                                    </Form.Item>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <Space>
                                            <Text strong>Time Window Lockout</Text>
                                            <Tooltip title="When ON, submissions should be blocked outside Start → End.">
                                                <Switch checked={timeWindowOn} onChange={onToggleTimeWindow} />
                                            </Tooltip>
                                        </Space>

                                        {timeWindowOn && (
                                            <Form.Item
                                                name="timeWindow"
                                                rules={[
                                                    {
                                                        validator: async (_, value: [Dayjs, Dayjs] | undefined) => {
                                                            if (!value || !value[0] || !value[1]) throw new Error('Start Time and End Time are required')
                                                            if (dayjs(value[1]).isBefore(dayjs(value[0]))) throw new Error('End Time must be after Start Time')
                                                        }
                                                    }
                                                ]}
                                            >
                                                <RangePicker showTime style={{ width: 420 }} placeholder={['Start Time', 'End Time']} />
                                            </Form.Item>
                                        )}
                                    </div>

                                    <div>
                                        <Text strong style={{ marginRight: 8 }}>
                                            Auto-grading
                                        </Text>
                                        <Tooltip title="When ON: MCQ/Checkbox/Number/Rating can be auto-graded. Short/Long can use guide answers.">
                                            <Switch checked={autoGradeOn} onChange={setAutoGradeOn} />
                                        </Tooltip>
                                    </div>
                                </Space>

                                <Divider />

                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(420px, 1fr) minmax(360px, 1fr)',
                                        columnGap: 16,
                                        rowGap: 10,
                                        alignItems: 'start'
                                    }}
                                >
                                    {/* LEFT (row 1): Timer label + segmented */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <Text strong>Timer</Text>

                                        <Segmented
                                            value={timingMode}
                                            size="large"
                                            onChange={(v: any) => {
                                                const next = v as TimingMode
                                                setTimingMode(next)

                                                if (next !== 'overall') setOverallTimeSeconds(0)

                                                if (next !== 'per_question') {
                                                    setFields(prev => prev.map(f => (f.type === 'heading' ? f : { ...f, timeLimitSeconds: null })))
                                                }
                                            }}
                                            options={[
                                                { value: 'none', label: <Space><StopOutlined />Off</Space> },
                                                { value: 'overall', label: <Space><ClockCircleOutlined />Whole Assessment</Space> },
                                                { value: 'per_question', label: <Space><FieldTimeOutlined />Per Question</Space> }
                                            ]}
                                            style={{
                                                width: 'fit-content',
                                                display: 'inline-flex',
                                                borderRadius: 999,
                                                padding: 4,
                                                background: '#f5f7fa'
                                            }}
                                        />
                                    </div>

                                    {/* RIGHT (row 1): Max tries label + input (NO empty space now) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <Text strong>Max tries</Text>

                                        <Space>
                                            <InputNumber
                                                min={1}
                                                max={50}
                                                value={maxAttempts}
                                                onChange={v => setMaxAttempts(clampInt(v, 1, 50))}
                                                addonBefore="Attempts"
                                                style={{ width: 220 }}
                                            />
                                            <Text type="secondary">How many times a learner can submit.</Text>
                                        </Space>
                                    </div>

                                    {/* LEFT (row 2): Timer details only */}
                                    <div style={{ minHeight: 44 }}>
                                        {timingMode === 'overall' && (
                                            <Space>
                                                <InputNumber
                                                    min={1}
                                                    max={24 * 60}
                                                    value={Math.floor((overallTimeSeconds || 0) / 60)}
                                                    onChange={v => setOverallTimeSeconds(clampInt(Number(v) * 60, 0, 24 * 60 * 60))}
                                                    addonBefore="Minutes"
                                                    style={{ width: 220 }}
                                                />
                                                <Text type="secondary">Total time for the entire assessment.</Text>
                                            </Space>
                                        )}

                                        {timingMode === 'per_question' && (
                                            <Text type="secondary">
                                                New questions inherit default seconds (right panel). AI extraction also respects these defaults.
                                            </Text>
                                        )}
                                    </div>

                                    {/* RIGHT (row 2): empty on purpose, but now it's BELOW the input so it doesn't look like a gap */}
                                    <div />
                                </div>

                                <Divider />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <Text strong>Results visibility</Text>

                                    <Segmented
                                        value={resultsReleaseMode}
                                        size="large"
                                        onChange={(v: any) => setResultsReleaseMode(v as ResultsReleaseMode)}
                                        options={[
                                            { value: 'instant', label: <Space><CheckCircleOutlined />Instant</Space> },
                                            { value: 'after_hours', label: <Space><ClockCircleOutlined />After N hours</Space> }
                                        ]}
                                        style={{
                                            width: 'fit-content',
                                            display: 'inline-flex',
                                            borderRadius: 999,
                                            padding: 4,
                                            background: '#f5f7fa'
                                        }}
                                    />

                                    {resultsReleaseMode === 'after_hours' && (
                                        <Space>
                                            <InputNumber
                                                min={1}
                                                max={24 * 30}
                                                value={resultsReleaseHours}
                                                onChange={v => setResultsReleaseHours(clampInt(v, 1, 24 * 30))}
                                                addonBefore="Hours"
                                                style={{ width: 220 }}
                                            />
                                            <Text type="secondary">
                                                Learners see results only after this delay from submission.
                                            </Text>
                                        </Space>
                                    )}
                                </div>


                            </Form>

                            <Divider />

                            <div style={{ marginTop: 8 }}>
                                <div style={{ maxHeight: stickyBodyMaxHeight, overflow: 'auto', display: 'grid', gap: 12, paddingRight: 8 }}>
                                    {fields.length === 0 && <Empty description="Add questions using the panel on the right (or AI Extract)" />}

                                    {fields.map((f, idx) => (
                                        <Card
                                            key={f.id}
                                            ref={el => (qRefs.current[f.id] = el)}
                                            size="small"
                                            style={{ borderRadius: 16 }}
                                            title={
                                                <Space>
                                                    <Tag>{idx + 1}</Tag>
                                                    <span>{f.label || f.type.toUpperCase()}</span>
                                                    {timingMode === 'per_question' && f.type !== 'heading' && (
                                                        <Tag color={(f.timeLimitSeconds || 0) > 0 ? 'green' : 'default'}>{secondsToLabel(f.timeLimitSeconds)}</Tag>
                                                    )}
                                                </Space>
                                            }
                                        >
                                            <Space direction="vertical" style={{ width: '100%' }}>
                                                <Input value={f.label} onChange={e => updateField(f.id, { label: e.target.value })} placeholder="Question / Section title" />

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

                                                            <Tooltip title="Points = weight this question contributes to the total score">
                                                                <Input
                                                                    type="number"
                                                                    style={{ width: 140 }}
                                                                    value={f.points ?? 1}
                                                                    min={0}
                                                                    onChange={e => updateField(f.id, { points: Number(e.target.value) })}
                                                                    addonBefore="Points"
                                                                />
                                                            </Tooltip>

                                                            {timingMode === 'per_question' && (
                                                                <Tooltip title="Time allowed for this question (seconds).">
                                                                    <InputNumber
                                                                        min={0}
                                                                        max={60 * 60}
                                                                        value={Number(f.timeLimitSeconds || 0)}
                                                                        onChange={v => updateField(f.id, { timeLimitSeconds: clampInt(v, 0, 60 * 60) })}
                                                                        addonBefore="Seconds"
                                                                        style={{ width: 200 }}
                                                                    />
                                                                </Tooltip>
                                                            )}
                                                        </Space>

                                                        {(f.type === 'radio' || f.type === 'checkbox') && (
                                                            <div style={{ width: '100%' }}>
                                                                <Text strong>Options</Text>
                                                                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                                                                    {(f.options || []).map((opt, optIdx) => (
                                                                        <div key={`${f.id}_opt_${optIdx}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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

                                                        {autoGradeOn && f.type === 'radio' && (
                                                            <Select
                                                                allowClear
                                                                placeholder="Correct option (auto-grade key)"
                                                                value={f.correctAnswer}
                                                                onChange={v => updateField(f.id, { correctAnswer: v })}
                                                                options={(f.options || []).map(o => ({ label: o, value: o }))}
                                                                style={{ width: 360 }}
                                                            />
                                                        )}

                                                        {autoGradeOn && f.type === 'checkbox' && (
                                                            <Select
                                                                mode="multiple"
                                                                allowClear
                                                                placeholder="Correct options (auto-grade key)"
                                                                value={f.correctAnswer as string[] | undefined}
                                                                onChange={v => updateField(f.id, { correctAnswer: v })}
                                                                options={(f.options || []).map(o => ({ label: o, value: o }))}
                                                                style={{ width: 420 }}
                                                            />
                                                        )}

                                                        {autoGradeOn && f.type === 'number' && (
                                                            <Input
                                                                type="number"
                                                                placeholder="Correct value (auto-grade key)"
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
                                                                options={[1, 2, 3, 4, 5].map(n => ({ label: `${n} star${n > 1 ? 's' : ''}`, value: n }))}
                                                                placeholder="Correct rating (optional)"
                                                            />
                                                        )}

                                                        {autoGradeOn && (f.type === 'short' || f.type === 'long') && (
                                                            <div style={{ width: '100%' }}>
                                                                <Text strong>Guide Answer (for AI grading)</Text>
                                                                <Tooltip title="Optional. AI will compare the learner response to this guide answer for auto-grading.">
                                                                    <Input.TextArea
                                                                        rows={f.type === 'short' ? 2 : 4}
                                                                        value={typeof f.correctAnswer === 'string' ? f.correctAnswer : ''}
                                                                        onChange={e => updateField(f.id, { correctAnswer: e.target.value })}
                                                                        placeholder={f.type === 'short' ? 'Ideal answer...' : 'Model answer / rubric...'}
                                                                        style={{ marginTop: 8 }}
                                                                    />
                                                                </Tooltip>
                                                            </div>
                                                        )}
                                                    </>
                                                )}

                                                <Space>
                                                    <Button danger onClick={() => removeField(f.id)}>
                                                        Remove
                                                    </Button>
                                                </Space>
                                            </Space>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </Card>

                        {/* RIGHT: QUESTION TYPES + DEFAULT TIMERS + AI EXTRACT ENTRY */}
                        <Card
                            style={{ position: 'sticky', top: 16, alignSelf: 'start', borderRadius: 16 }}
                            bodyStyle={{ padding: 16, maxHeight: stickyBodyMaxHeight, overflow: 'auto' }}
                            title={
                                <Space>
                                    <PlusOutlined />
                                    <span>Add Questions</span>
                                </Space>
                            }
                        >
                            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                <Button block icon={<FileTextOutlined />} onClick={() => setExtractOpen(true)}>
                                    AI Extract from Document
                                </Button>

                                <Divider style={{ margin: '14px 0' }} />

                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Button danger block disabled={fields.length === 0} onClick={clearAllQuestions}>
                                        Clear all questions
                                    </Button>
                                </Space>


                                <Divider style={{ margin: '8px 0' }} />

                                <Button block onClick={() => addField('heading')}>Section</Button>
                                <Divider style={{ margin: '8px 0' }} />
                                <Button block onClick={() => addField('short')}>Short Answer</Button>
                                <Button block onClick={() => addField('long')}>Long Answer</Button>
                                <Button block onClick={() => addField('radio')}>Multiple Choice</Button>
                                <Button block onClick={() => addField('checkbox')}>Checkboxes</Button>
                                <Button block onClick={() => addField('number')}>Number</Button>
                                <Button block onClick={() => addField('rating')}>Rating (1-5)</Button>
                            </Space>

                            <Divider style={{ margin: '14px 0' }} />

                            {timingMode === 'per_question' && (
                                <Collapse
                                    defaultActiveKey={timingMode === 'per_question' ? ['typeDefaults'] : []}
                                    items={[
                                        {
                                            key: 'typeDefaults',
                                            label: (
                                                <Space>
                                                    <Text strong>Per-question time</Text>
                                                    {timingMode !== 'per_question' && <Tag>Enable “Per Question”</Tag>}
                                                </Space>
                                            ),
                                            children: (
                                                <div style={{ display: 'grid', gap: 10 }}>
                                                    <Text type="secondary">Used for new questions, and also fills missing timers from AI extraction.</Text>

                                                    <div style={{ display: 'grid', gap: 10 }}>
                                                        {presentTimedTypes.length === 0 ? (
                                                            <Alert
                                                                type="info"
                                                                showIcon
                                                                message="No question types yet"
                                                            />
                                                        ) : (
                                                            <div style={{ display: 'grid', gap: 10 }}>
                                                                {presentTimedTypes.map(k => {
                                                                    const labelMap: Record<TimedQuestionType, string> = {
                                                                        short: 'Short Answer',
                                                                        long: 'Long Answer',
                                                                        radio: 'Multiple Choice',
                                                                        checkbox: 'Checkboxes',
                                                                        number: 'Number',
                                                                        rating: 'Rating'
                                                                    }

                                                                    return (
                                                                        <div
                                                                            key={k}
                                                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                                                                        >
                                                                            <Text>{labelMap[k]}</Text>
                                                                            <InputNumber
                                                                                min={0}
                                                                                max={60 * 60}
                                                                                disabled={timingMode !== 'per_question'}
                                                                                value={perTypeTimes[k]}
                                                                                onChange={v => {
                                                                                    const sec = clampInt(v, 0, 60 * 60)
                                                                                    setPerTypeTimes(prev => ({ ...prev, [k]: sec }))
                                                                                }}
                                                                                addonAfter="s"
                                                                                style={{ width: 140 }}
                                                                            />
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}

                                                    </div>

                                                    <Space wrap>
                                                        <Button disabled={timingMode !== 'per_question'} onClick={() => setPerTypeTimes(DEFAULT_TYPE_TIMES)}>
                                                            Reset defaults
                                                        </Button>

                                                        <Tooltip title="Overwrite all existing questions’ timers to match the defaults above.">
                                                            <Button
                                                                type="primary"
                                                                disabled={timingMode !== 'per_question' || presentTimedTypes.length === 0}
                                                                onClick={applyDefaultsToExisting}
                                                            >
                                                                Apply to existing
                                                            </Button>
                                                        </Tooltip>
                                                    </Space>
                                                </div>
                                            )
                                        }
                                    ]}
                                />

                            )}

                            <Divider style={{ margin: '14px 0' }} />

                            <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                <Text strong>Quick stats</Text>
                                <Space wrap>
                                    <Tag color="blue">Q: {totals.questions}</Tag>
                                    <Tag>Auto: {totals.autoGraded}</Tag>
                                    <Tag color="gold">Pts: {totals.totalPoints}</Tag>
                                </Space>
                                {timingMode === 'per_question' && <Text type="secondary">Timers set: {totals.perQCount}/{totals.questions}</Text>}
                            </Space>
                        </Card>
                    </div>

                    <BackTop visibilityHeight={200} />
                </>
            )}
        </div>
    )
}
