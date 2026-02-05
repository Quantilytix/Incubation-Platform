import React, { useEffect, useMemo, useState } from 'react'
import { Col, Row, Table, Tag, Button, Space, Input, Segmented, App, Tooltip, Modal, Card, Typography, Descriptions, Progress, Empty, Spin, Divider } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileTextOutlined, FormOutlined, CheckCircleOutlined, ClockCircleOutlined, TrophyOutlined } from '@ant-design/icons'
import { auth, db } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, query, where, doc, getDoc, limit } from 'firebase/firestore'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { MotionCard } from '@/components/shared/Header'
import { Helmet } from 'react-helmet'

const { Text, Title } = Typography

// ---------- utils ----------
const toDateSafe = (v: any): Date | null => {
    if (!v) return null
    if (typeof v?.toDate === 'function') {
        const d = v.toDate()
        return d instanceof Date && !isNaN(d.getTime()) ? d : null
    }
    if (typeof v?.seconds === 'number') {
        const ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6)
        const d = new Date(ms)
        return isNaN(d.getTime()) ? null : d
    }
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
}
const millis = (v: any) => toDateSafe(v)?.getTime() ?? 0

const clampInt = (n: any, min: number, max: number) => {
    const x = Number(n)
    if (!Number.isFinite(x)) return min
    return Math.max(min, Math.min(max, Math.floor(x)))
}

type InboxItemType = 'survey' | 'assessment'
type InboxStatus = 'pending' | 'in_progress' | 'sent' | 'submitted' | 'completed'
type ResultsReleaseMode = 'instant' | 'after_hours'

type InboxItem = {
    id: string
    type: InboxItemType
    title: string
    status: InboxStatus
    deliveryMethod?: 'in_app' | 'email'
    linkToken?: string

    templateId?: string
    participantId: string
    participantEmail?: string

    createdAt?: any
    updatedAt?: any
    sentAt?: any
    dueAt?: any

    // assessment-only
    timeWindowEnabled?: boolean
    startAt?: any
    endAt?: any
    maxAttempts?: number
    attemptsUsed?: number

    // results policy hints (optional)
    submittedAt?: any
    resultsReleaseMode?: ResultsReleaseMode
    resultsReleaseHours?: number

    source: 'formAssignments' | 'formRequests'
}

type AnswersMap = Record<string, any>

interface FormField {
    id: string
    type: string
    label: string
    required: boolean
    options?: string[]
    description?: string
    correctAnswer?: any
    points?: number
}

interface FormTemplate {
    id: string
    title: string
    description?: string
    category?: string
    fields: FormField[]
    assessmentMeta?: any
}

interface FormResponse {
    id: string
    templateId?: string
    formId?: string
    formTitle?: string
    answers?: AnswersMap
    responses?: AnswersMap
    submittedBy?: { id?: string; name?: string; email?: string }
    submittedAt?: any
    status?: string
    timing?: any
    // possible link fields
    requestId?: string
    formRequestId?: string
    assignmentId?: string
}

const statusTag = (s: InboxStatus) => {
    const color =
        s === 'submitted' || s === 'completed'
            ? 'green'
            : s === 'in_progress'
                ? 'blue'
                : s === 'sent'
                    ? 'geekblue'
                    : 'orange'
    const label = s.replace('_', ' ')
    return <Tag color={color}>{label.charAt(0).toUpperCase() + label.slice(1)}</Tag>
}

const CHOICE_TYPES = new Set(['radio', 'select', 'dropdown', 'checkbox', 'multiselect', 'multi_select', 'mcq', 'multiple_choice'])
const isChoiceType = (t?: string) => CHOICE_TYPES.has(String(t || '').toLowerCase())
const isGradableType = (t?: string) => {
    const x = String(t || '').toLowerCase()
    return isChoiceType(x) || x === 'number' || x === 'rating'
}

const normalizeForCompare = (v: any) => {
    if (Array.isArray(v)) return v.map(x => String(x).trim()).sort()
    if (v === null || v === undefined) return null
    return String(v).trim()
}
const isCorrect = (answer: any, correct: any) => {
    const a = normalizeForCompare(answer)
    const c = normalizeForCompare(correct)
    if (a === null || c === null) return false
    if (Array.isArray(a) && Array.isArray(c)) {
        if (a.length !== c.length) return false
        return a.every((x, i) => x === c[i])
    }
    return String(a) === String(c)
}

const getAnswers = (r: FormResponse): AnswersMap => (r.answers ?? r.responses ?? {}) as AnswersMap

export default function FormsInbox() {
    const { message } = App.useApp()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(true)
    const [participantId, setParticipantId] = useState<string>('')
    const [participantEmail, setParticipantEmail] = useState<string>('')

    const [items, setItems] = useState<InboxItem[]>([])
    const [tab, setTab] = useState<'all' | 'survey' | 'assessment'>('all')
    const [search, setSearch] = useState('')

    // ===== modals =====
    const [summaryOpen, setSummaryOpen] = useState(false)
    const [resultsOpen, setResultsOpen] = useState(false)
    const [modalFs, setModalFs] = useState(false)
    const [activeRow, setActiveRow] = useState<InboxItem | null>(null)

    const [modalLoading, setModalLoading] = useState(false)
    const [activeTemplate, setActiveTemplate] = useState<FormTemplate | null>(null)
    const [activeResponse, setActiveResponse] = useState<FormResponse | null>(null)
    const [modalError, setModalError] = useState<string>('')

    // ---------- load participant ----------
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async u => {
            if (!u?.email) return
            setParticipantEmail(u.email.toLowerCase())

            const pSnap = await getDocs(query(collection(db, 'participants'), where('email', '==', u.email)))
            if (pSnap.empty) {
                message.error('Participant record not found for this account.')
                setLoading(false)
                return
            }
            setParticipantId(pSnap.docs[0].id)
        })
        return () => unsub()
    }, [message])

    // ---------- attempt counting (assessment only; matches runner) ----------
    const getAttemptsUsedFromFormRequest = async (requestId: string) => {
        try {
            const snap = await getDoc(doc(db, 'formRequests', requestId))
            if (!snap.exists()) return 0
            const r = snap.data() as any
            return Number(r.attemptCount || 0)
        } catch {
            return 0
        }
    }

    // ---------- results policy helpers ----------
    const resolveResultsPolicy = async (row: InboxItem, tpl?: FormTemplate | null) => {
        // defaults
        let mode: ResultsReleaseMode = 'instant'
        let hours = 0

        // request-level override already in row (if you stored it)
        if (row.resultsReleaseMode === 'after_hours') mode = 'after_hours'
        if (Number.isFinite(Number(row.resultsReleaseHours))) hours = clampInt(row.resultsReleaseHours, 0, 24 * 30)

        // template fallback
        const tm = tpl?.assessmentMeta
        if (tm && typeof tm === 'object') {
            if (tm.resultsReleaseMode === 'instant' || tm.resultsReleaseMode === 'after_hours') mode = tm.resultsReleaseMode
            if (Number.isFinite(Number(tm.resultsReleaseHours))) hours = clampInt(tm.resultsReleaseHours, 0, 24 * 30)
        }

        if (mode === 'after_hours' && hours < 1) hours = 1
        if (mode === 'instant') hours = 0

        const submittedAt = row.submittedAt ?? row.updatedAt ?? row.sentAt ?? row.createdAt ?? null

        return { mode, hours, submittedAt }
    }

    const canShowResultsNow = (mode: ResultsReleaseMode, hours: number, submittedAt: any) => {
        if (mode === 'instant') return true
        const d = toDateSafe(submittedAt)
        if (!d) return false
        const unlockAt = d.getTime() + hours * 60 * 60 * 1000
        return Date.now() >= unlockAt
    }

    const resultsLockedReason = (mode: ResultsReleaseMode, hours: number, submittedAt: any) => {
        if (mode === 'instant') return ''
        const d = toDateSafe(submittedAt)
        if (!d) return 'Results are not available yet.'
        const unlockAt = new Date(d.getTime() + hours * 60 * 60 * 1000)
        const diffMs = unlockAt.getTime() - Date.now()
        if (diffMs <= 0) return ''
        const diffH = Math.ceil(diffMs / (60 * 60 * 1000))
        return `Results available in ~${diffH} hour(s) (${dayjs(unlockAt).format('YYYY-MM-DD HH:mm')}).`
    }

    // ---------- load inbox ----------
    useEffect(() => {
        if (!participantId) return

        const run = async () => {
            setLoading(true)
            try {
                const merged: InboxItem[] = []
                const templateCache = new Map<string, { title?: string; maxAttempts?: number; assessmentMeta?: any }>()

                // 1) formAssignments (SURVEYS ONLY)
                const faQueries: Promise<any>[] = []
                faQueries.push(getDocs(query(collection(db, 'formAssignments'), where('participantId', '==', participantId))))
                if (participantEmail) {
                    faQueries.push(getDocs(query(collection(db, 'formAssignments'), where('recipientEmail', '==', participantEmail))))
                    faQueries.push(getDocs(query(collection(db, 'formAssignments'), where('email', '==', participantEmail))))
                }

                const faSnaps = await Promise.all(faQueries)
                const faDocs = faSnaps.flatMap(s => s.docs)

                const faSeen = new Set<string>()
                for (const d of faDocs) {
                    if (faSeen.has(d.id)) continue
                    faSeen.add(d.id)

                    const a = d.data() as any
                    let title = a.templateTitle || a.title

                    if (a.templateId && !templateCache.get(a.templateId)) {
                        try {
                            const tSnap = await getDoc(doc(db, 'formTemplates', a.templateId))
                            if (tSnap.exists()) {
                                const tpl = tSnap.data() as any
                                templateCache.set(a.templateId, {
                                    title: tpl.title,
                                    maxAttempts: clampInt(tpl?.assessmentMeta?.maxAttempts ?? 1, 1, 50),
                                    assessmentMeta: tpl?.assessmentMeta || null
                                })
                                title = title || tpl.title
                            }
                        } catch { }
                    } else if (a.templateId) {
                        const c = templateCache.get(a.templateId)
                        title = title || c?.title
                    }

                    merged.push({
                        id: d.id,
                        type: 'survey',
                        title: title || 'Untitled Survey',
                        status: (a.status || 'pending') as InboxStatus,
                        deliveryMethod: (a.deliveryMethod || 'in_app') as any,
                        linkToken: a.linkToken,
                        templateId: a.templateId,
                        participantId,
                        participantEmail,
                        createdAt: a.createdAt,
                        updatedAt: a.updatedAt,
                        dueAt: a.dueAt,
                        source: 'formAssignments'
                    })
                }

                // 2) formRequests (ASSESSMENTS ONLY)
                const frSnap = await getDocs(query(collection(db, 'formRequests'), where('participantId', '==', participantId)))
                frSnap.forEach(d => {
                    const r = d.data() as any
                    const maxAttempts = clampInt(r.maxAttempts ?? r?.assessmentMeta?.maxAttempts ?? 1, 1, 50)

                    merged.push({
                        id: d.id,
                        type: 'assessment',
                        title: r.formTitle || r.title || 'Untitled Assessment',
                        status: (r.status || 'sent') as InboxStatus,
                        deliveryMethod: 'in_app',
                        templateId: r.templateId,
                        participantId,
                        participantEmail: r.participantEmail || participantEmail,
                        sentAt: r.sentAt,
                        createdAt: r.createdAt,
                        updatedAt: r.updatedAt,

                        //  DO NOT change dueAt logic
                        dueAt: r.dueAt,

                        timeWindowEnabled: Boolean(r.timeWindowEnabled),
                        startAt: r.startAt,
                        endAt: r.endAt,
                        maxAttempts,
                        attemptsUsed: Number.isFinite(Number(r.attemptCount)) ? clampInt(r.attemptCount, 0, 999) : undefined,

                        // results policy hints (if stored)
                        submittedAt: r.submittedAt ?? r.completedAt ?? r.updatedAt ?? null,
                        resultsReleaseMode:
                            r?.assessmentMeta?.resultsReleaseMode === 'instant' || r?.assessmentMeta?.resultsReleaseMode === 'after_hours'
                                ? r.assessmentMeta.resultsReleaseMode
                                : undefined,
                        resultsReleaseHours: Number.isFinite(Number(r?.assessmentMeta?.resultsReleaseHours))
                            ? clampInt(r.assessmentMeta.resultsReleaseHours, 0, 24 * 30)
                            : undefined,

                        source: 'formRequests'
                    })
                })

                // fill attemptsUsed if missing (assessment only) + make sure template meta cached
                const enriched = await Promise.all(
                    merged.map(async it => {
                        if (it.type !== 'assessment') return it

                        if (it.templateId && !templateCache.get(it.templateId)) {
                            try {
                                const tSnap = await getDoc(doc(db, 'formTemplates', it.templateId))
                                if (tSnap.exists()) {
                                    const tpl = tSnap.data() as any
                                    templateCache.set(it.templateId, {
                                        title: tpl.title,
                                        maxAttempts: clampInt(tpl?.assessmentMeta?.maxAttempts ?? 1, 1, 50),
                                        assessmentMeta: tpl?.assessmentMeta || null
                                    })
                                }
                            } catch { }
                        }

                        let attemptsUsed = it.attemptsUsed
                        if (!Number.isFinite(Number(attemptsUsed))) {
                            attemptsUsed = await getAttemptsUsedFromFormRequest(it.id)
                        }

                        // ensure maxAttempts fallback from template if missing
                        let maxAttempts = it.maxAttempts
                        if ((!maxAttempts || maxAttempts < 1) && it.templateId) {
                            const c = templateCache.get(it.templateId)
                            if (c?.maxAttempts) maxAttempts = c.maxAttempts
                        }

                        return { ...it, attemptsUsed, maxAttempts: maxAttempts ?? 1 }
                    })
                )

                enriched.sort((a, b) => {
                    const ta = Math.max(millis(a.updatedAt), millis(a.sentAt), millis(a.createdAt))
                    const tb = Math.max(millis(b.updatedAt), millis(b.sentAt), millis(b.createdAt))
                    return tb - ta
                })

                setItems(enriched)
            } catch (e) {
                console.error(e)
                message.error('Failed to load your inbox.')
                setItems([])
            } finally {
                setLoading(false)
            }
        }

        run()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [participantId, participantEmail])

    // ---------- filters ----------
    const filtered = useMemo(() => {
        const s = search.trim().toLowerCase()
        return items.filter(it => {
            if (tab !== 'all' && it.type !== tab) return false
            if (!s) return true
            return (
                (it.title || '').toLowerCase().includes(s) ||
                (it.type || '').toLowerCase().includes(s) ||
                (it.status || '').toLowerCase().includes(s)
            )
        })
    }, [items, tab, search])

    // ---------- metrics ----------
    const metrics = useMemo(() => {
        const total = items.length
        const surveys = items.filter(i => i.type === 'survey').length
        const assessments = items.filter(i => i.type === 'assessment').length
        const completed = items.filter(i => i.status === 'submitted' || i.status === 'completed').length
        return { total, surveys, assessments, completed }
    }, [items])

    // ---------- lock rules (assessments only) ----------
    const getAssessmentLock = (row: InboxItem): { locked: boolean; reason?: string } => {
        if (row.type !== 'assessment') return { locked: false }

        // runner should not be opened after submit
        if (row.status === 'submitted' || row.status === 'completed') {
            return { locked: true, reason: 'Already submitted.' }
        }

        const due = toDateSafe(row.dueAt)
        if (due && Date.now() > due.getTime()) {
            return { locked: true, reason: `Past due (${dayjs(due).format('YYYY-MM-DD')}).` }
        }

        const maxA = clampInt(row.maxAttempts ?? 1, 1, 50)
        const used = clampInt(row.attemptsUsed ?? 0, 0, 999)
        if (used >= maxA) {
            return { locked: true, reason: `No attempts left (${used}/${maxA}).` }
        }

        return { locked: false }
    }

    const openRunner = (row: InboxItem) => {
        if (row.type === 'assessment') {
            const lock = getAssessmentLock(row)
            if (lock.locked) {
                message.warning(lock.reason || 'This assessment is locked.')
                return
            }
            navigate(`/incubatee/assessments/${row.id}`)
            return
        }
        const q = row.linkToken ? `?token=${row.linkToken}` : ''
        navigate(`/incubatee/surveys/${row.id}${q}`)
    }

    // ---------- modal data fetch (template + best response) ----------
    const loadTemplate = async (templateId?: string) => {
        if (!templateId) return null
        try {
            const snap = await getDoc(doc(db, 'formTemplates', templateId))
            if (!snap.exists()) return null
            return { id: snap.id, ...(snap.data() as any) } as FormTemplate
        } catch {
            return null
        }
    }

    const pickLatest = (rows: FormResponse[]) => {
        const sorted = [...rows].sort((a, b) => (millis(b.submittedAt) - millis(a.submittedAt)))
        return sorted[0] || null
    }

    const tryFetchResponseByLinkField = async (field: string, value: string) => {
        try {
            const snap = await getDocs(query(collection(db, 'formResponses'), where(field, '==', value), limit(20)))
            if (snap.empty) return null
            const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as FormResponse[]
            return pickLatest(rows)
        } catch {
            return null
        }
    }

    const tryFetchResponseFallback = async (row: InboxItem) => {
        // Fallback: by templateId + user identity (email first; participantId second)
        const tpl = row.templateId
        if (!tpl) return null

        // 1) templateId + submittedBy.email
        if (participantEmail) {
            try {
                const snap = await getDocs(
                    query(
                        collection(db, 'formResponses'),
                        where('templateId', '==', tpl),
                        where('submittedBy.email', '==', participantEmail),
                        limit(50)
                    )
                )
                if (!snap.empty) {
                    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as FormResponse[]
                    return pickLatest(rows)
                }
            } catch { /* ignore */ }
        }

        // 2) formId + submittedBy.email (some docs use formId)
        if (participantEmail) {
            try {
                const snap = await getDocs(
                    query(
                        collection(db, 'formResponses'),
                        where('formId', '==', tpl),
                        where('submittedBy.email', '==', participantEmail),
                        limit(50)
                    )
                )
                if (!snap.empty) {
                    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as FormResponse[]
                    return pickLatest(rows)
                }
            } catch { /* ignore */ }
        }

        // 3) templateId + submittedBy.id (participantId)
        if (participantId) {
            try {
                const snap = await getDocs(
                    query(
                        collection(db, 'formResponses'),
                        where('templateId', '==', tpl),
                        where('submittedBy.id', '==', participantId),
                        limit(50)
                    )
                )
                if (!snap.empty) {
                    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as FormResponse[]
                    return pickLatest(rows)
                }
            } catch { /* ignore */ }
        }

        return null
    }

    const openSummaryModal = async (row: InboxItem) => {
        setActiveRow(row)
        setSummaryOpen(true)
        setResultsOpen(false)
        setModalFs(false)
        setModalLoading(true)
        setModalError('')
        setActiveTemplate(null)
        setActiveResponse(null)

        try {
            const tpl = await loadTemplate(row.templateId)
            setActiveTemplate(tpl)

            // best shot to find matching response
            let resp: FormResponse | null = null
            resp = (await tryFetchResponseByLinkField('assignmentId', row.id))
                || (await tryFetchResponseByLinkField('formAssignmentId', row.id))
                || (await tryFetchResponseByLinkField('requestId', row.id))
                || (await tryFetchResponseByLinkField('formRequestId', row.id))
                || (await tryFetchResponseFallback(row))

            setActiveResponse(resp)
            if (!resp) setModalError('No submission found for this item yet.')
        } catch (e) {
            console.error(e)
            setModalError('Failed to load summary.')
        } finally {
            setModalLoading(false)
        }
    }

    const openResultsModal = async (row: InboxItem) => {
        setActiveRow(row)
        setResultsOpen(true)
        setSummaryOpen(false)
        setModalFs(false)
        setModalLoading(true)
        setModalError('')
        setActiveTemplate(null)
        setActiveResponse(null)

        try {
            const tpl = await loadTemplate(row.templateId)
            setActiveTemplate(tpl)

            // best shot to find matching response
            let resp: FormResponse | null = null
            resp = (await tryFetchResponseByLinkField('requestId', row.id))
                || (await tryFetchResponseByLinkField('formRequestId', row.id))
                || (await tryFetchResponseFallback(row))

            setActiveResponse(resp)
            if (!resp) setModalError('No submission found for this assessment yet.')
        } catch (e) {
            console.error(e)
            setModalError('Failed to load results.')
        } finally {
            setModalLoading(false)
        }
    }

    // ---------- modal render helpers ----------
    const computeScore = (tpl: FormTemplate, r: FormResponse) => {
        const answers = getAnswers(r)
        const fields = (tpl.fields || []).filter(f => f.type !== 'heading')
        const gradable = fields.filter(f => f.correctAnswer !== undefined && f.correctAnswer !== null && isGradableType(f.type))
        if (!gradable.length) return null

        let earned = 0
        let total = 0
        let gradedCount = 0

        for (const f of gradable) {
            const pts = typeof f.points === 'number' && f.points > 0 ? f.points : 1
            total += pts
            const ok = isCorrect(answers[f.id], f.correctAnswer)
            if (ok) earned += pts
            gradedCount += 1
        }

        const pct = total > 0 ? (earned / total) * 100 : 0
        return { earned, total, pct, gradedCount, totalGradable: gradable.length }
    }

    const renderSurveySummary = () => {
        if (modalLoading) return <Spin />
        if (modalError) return <Empty description={modalError} />

        const row = activeRow
        const tpl = activeTemplate
        const resp = activeResponse
        if (!row || !resp) return <Empty description="No data" />

        const answers = getAnswers(resp)
        const keys = Object.keys(answers || {})
        const answeredCount = keys.filter(k => answers[k] !== undefined && answers[k] !== null && String(answers[k]).trim() !== '').length

        return (
            <div>
                <Card size="small" style={{ borderRadius: 14, marginBottom: 12 }}>
                    <Title level={5} style={{ marginTop: 0 }}>Summary</Title>
                    <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="Title">{row.title}</Descriptions.Item>
                        <Descriptions.Item label="Submitted At">{toDateSafe(resp.submittedAt) ? dayjs(toDateSafe(resp.submittedAt)!).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
                        <Descriptions.Item label="Answered">{answeredCount}</Descriptions.Item>
                        <Descriptions.Item label="Questions">{(tpl?.fields || []).filter(f => f.type !== 'heading').length || '-'}</Descriptions.Item>
                    </Descriptions>
                </Card>

                <Card size="small" style={{ borderRadius: 14 }}>
                    <Title level={5} style={{ marginTop: 0 }}>Your Responses</Title>
                    {tpl?.fields?.length ? (
                        <Descriptions bordered size="small" column={1}>
                            {tpl.fields.filter(f => f.type !== 'heading').map(f => {
                                const v = answers?.[f.id]
                                const val = Array.isArray(v) ? v.join(', ') : (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''))
                                return (
                                    <Descriptions.Item key={f.id} label={f.label || f.id}>
                                        {val || <Text type="secondary">-</Text>}
                                    </Descriptions.Item>
                                )
                            })}
                        </Descriptions>
                    ) : (
                        <Descriptions bordered size="small" column={1}>
                            {Object.entries(answers).map(([k, v]) => {
                                const val = Array.isArray(v) ? v.join(', ') : (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''))
                                return (
                                    <Descriptions.Item key={k} label={k}>
                                        {val || <Text type="secondary">-</Text>}
                                    </Descriptions.Item>
                                )
                            })}
                        </Descriptions>
                    )}
                </Card>
            </div>
        )
    }

    const renderAssessmentResults = () => {
        if (modalLoading) return <Spin />
        if (modalError) return <Empty description={modalError} />

        const row = activeRow
        const tpl = activeTemplate
        const resp = activeResponse
        if (!row || !tpl || !resp) return <Empty description="Missing template/response." />

        const answers = getAnswers(resp)
        const score = computeScore(tpl, resp)

        const fields = (tpl.fields || []).filter(f => f.type !== 'heading')
        const gradable = fields.filter(f => f.correctAnswer !== undefined && f.correctAnswer !== null && isGradableType(f.type))

        const ungradedFieldsWithValues = fields
            .filter(f => !gradable.some(g => g.id === f.id))
            .filter(f => {
                const v = answers?.[f.id]
                if (v === undefined || v === null) return false
                if (Array.isArray(v)) return v.length > 0
                if (typeof v === 'object') return Object.keys(v).length > 0
                return String(v).trim() !== ''
            })


        return (
            <div>
                {score ? (
                    <Card size="small" style={{ borderRadius: 14, marginBottom: 12 }}>
                        <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Space direction="vertical" size={2}>
                                <Space align="center" wrap>
                                    <TrophyOutlined />
                                    <Text strong style={{ fontSize: 16 }}>Score</Text>
                                    <Tag color={score.pct >= 70 ? 'success' : score.pct >= 50 ? 'warning' : 'error'} style={{ marginInlineStart: 6 }}>
                                        {Math.round(score.pct)}%
                                    </Tag>
                                </Space>
                                <Text type="secondary">
                                    Points: <Text strong>{score.earned}</Text> / <Text strong>{score.total}</Text>
                                    {'  '}•{'  '}
                                    Auto-graded: <Text strong>{score.gradedCount}</Text>
                                </Text>
                            </Space>
                            <div style={{ minWidth: 220 }}>
                                <Progress percent={Math.round(score.pct)} showInfo={false} />
                            </div>
                        </Space>
                    </Card>
                ) : (
                    <Card size="small" style={{ borderRadius: 14, marginBottom: 12 }}>
                        <Text type="secondary">No auto-graded questions found (missing correctAnswer / unsupported field types).</Text>
                    </Card>
                )}

                <Card size="small" style={{ borderRadius: 14 }}>
                    <Title level={5} style={{ marginTop: 0 }}>Answer Key (Your Answer vs Correct)</Title>
                    {!gradable.length ? (
                        <Empty description="No answer key questions configured." />
                    ) : (
                        <Space direction="vertical" style={{ width: '100%' }} size={10}>
                            {gradable.map((f, idx) => {
                                const userAns = answers[f.id]
                                const correct = f.correctAnswer
                                const ok = isCorrect(userAns, correct)

                                const userStr = Array.isArray(userAns) ? userAns.join(', ') : String(userAns ?? '')
                                const correctStr = Array.isArray(correct) ? correct.join(', ') : String(correct ?? '')

                                return (
                                    <Card key={f.id} size="small" style={{ borderRadius: 12 }}>
                                        <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                            <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                                                <Text strong>{`Q${idx + 1}. ${f.label || f.id}`}</Text>
                                                {ok ? <Tag color="success">Correct</Tag> : <Tag color="error">Incorrect</Tag>}
                                            </Space>

                                            <Row gutter={[12, 8]}>
                                                <Col xs={24} md={12}>
                                                    <Text type="secondary">Your answer</Text>
                                                    <div style={{ marginTop: 6 }}>
                                                        <Tag color={ok ? 'success' : 'default'}>{userStr || '-'}</Tag>
                                                    </div>
                                                </Col>
                                                <Col xs={24} md={12}>
                                                    <Text type="secondary">Correct answer</Text>
                                                    <div style={{ marginTop: 6 }}>
                                                        <Tag color="geekblue">{correctStr || '-'}</Tag>
                                                    </div>
                                                </Col>
                                            </Row>
                                        </Space>
                                    </Card>
                                )
                            })}
                        </Space>
                    )}
                </Card>

                {ungradedFieldsWithValues.length > 0 && (
                    <>
                        <Divider />
                        <Card size="small" style={{ borderRadius: 14 }}>
                            <Title level={5} style={{ marginTop: 0 }}>Other Responses (Ungraded)</Title>
                            <Descriptions bordered size="small" column={1}>
                                {fields
                                    .filter(f => !gradable.some(g => g.id === f.id))
                                    .map(f => {
                                        const v = answers?.[f.id]
                                        const val = Array.isArray(v) ? v.join(', ') : (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''))
                                        return (
                                            <Descriptions.Item key={f.id} label={f.label || f.id}>
                                                {val || <Text type="secondary">-</Text>}
                                            </Descriptions.Item>
                                        )
                                    })}
                            </Descriptions>
                        </Card>
                    </>
                )}
            </div>
        )
    }




    // ---------- table columns ----------
    const cols: ColumnsType<InboxItem> = [
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (t: InboxItemType) => (
                <Tag color={t === 'survey' ? 'blue' : 'purple'}>{t === 'survey' ? 'Survey' : 'Assessment'}</Tag>
            )
        },
        { title: 'Title', dataIndex: 'title', key: 'title' },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (s: InboxStatus) => statusTag(s)
        },
        {
            title: 'Due',
            key: 'dueAt',
            render: (_: any, r: InboxItem) => {
                const d = toDateSafe(r.dueAt)
                return d ? dayjs(d).format('YYYY-MM-DD') : '-'
            }
        },
        {
            title: 'Attempts',
            key: 'attempts',
            render: (_: any, r: InboxItem) => {
                if (r.type !== 'assessment') return '-'
                const used = clampInt(r.attemptsUsed ?? 0, 0, 999)
                const maxA = clampInt(r.maxAttempts ?? 1, 1, 50)
                return <Tag color={used >= maxA ? 'red' : 'default'}>{used}/{maxA}</Tag>
            }
        },
        {
            title: 'Updated',
            key: 'updatedAt',
            render: (_: any, r: InboxItem) => {
                const d = toDateSafe(r.updatedAt || r.sentAt || r.createdAt)
                return d ? dayjs(d).format('YYYY-MM-DD') : '-'
            }
        },
        {
            title: 'Action',
            key: 'action',
            render: (_: any, r: InboxItem) => {
                const done = r.status === 'submitted' || r.status === 'completed'

                // ---- Surveys ----
                if (r.type === 'survey') {
                    if (!done) {
                        return (
                            <Tooltip title="Open">
                                <Button type="link" onClick={() => openRunner(r)}>Open</Button>
                            </Tooltip>
                        )
                    }
                    return (
                        <Tooltip title="View summary">
                            <Button type="link" onClick={() => openSummaryModal(r)}>Summary</Button>
                        </Tooltip>
                    )
                }

                // ---- Assessments ----
                if (!done) {
                    const lock = getAssessmentLock(r)
                    return (
                        <Tooltip title={lock.locked ? lock.reason : 'Open'}>
                            <Button type="link" disabled={lock.locked} onClick={() => openRunner(r)}>
                                Open
                            </Button>
                        </Tooltip>
                    )
                }

                // Done => allow results depending on results visibility
                // We need template to fully resolve policy, but we can still decide with row hints.
                // If template is missing, we default to instant (show results).
                const quickMode: ResultsReleaseMode = r.resultsReleaseMode === 'after_hours' ? 'after_hours' : 'instant'
                const quickHours = clampInt(r.resultsReleaseHours ?? 0, 0, 24 * 30)
                const submittedAt = r.submittedAt ?? r.updatedAt ?? r.sentAt ?? r.createdAt

                // If after-hours and time not reached: disable with tooltip
                const allowed = canShowResultsNow(quickMode, quickHours, submittedAt)
                const reason = resultsLockedReason(quickMode, quickHours, submittedAt)

                return (
                    <Tooltip title={allowed ? 'Show results' : (reason || 'Results locked')}>
                        <Button type="link" disabled={!allowed} onClick={() => openResultsModal(r)}>
                            Show Results
                        </Button>
                    </Tooltip>
                )
            }
        }
    ]

    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            <Helmet>
                <title>Action Centre | Smart Incubation</title>
            </Helmet>

            {/* ===== Metrics Row ===== */}
            <Row gutter={[16, 16]}>
                <Col xs={24} md={6}>
                    <MotionCard>
                        <MotionCard.Metric
                            icon={<FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />}
                            iconBg="rgba(22,119,255,.12)"
                            title="Total"
                            value={metrics.total}
                        />
                    </MotionCard>
                </Col>

                <Col xs={24} md={6}>
                    <MotionCard>
                        <MotionCard.Metric
                            icon={<FormOutlined style={{ fontSize: 20, color: '#faad14' }} />}
                            iconBg="rgba(250,173,20,.14)"
                            title="Surveys"
                            value={metrics.surveys}
                        />
                    </MotionCard>
                </Col>

                <Col xs={24} md={6}>
                    <MotionCard>
                        <MotionCard.Metric
                            icon={<ClockCircleOutlined style={{ fontSize: 20, color: '#722ed1' }} />}
                            iconBg="rgba(114,46,209,.12)"
                            title="Assessments"
                            value={metrics.assessments}
                        />
                    </MotionCard>
                </Col>

                <Col xs={24} md={6}>
                    <MotionCard>
                        <MotionCard.Metric
                            icon={<CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />}
                            iconBg="rgba(82,196,26,.14)"
                            title="Completed"
                            value={metrics.completed}
                        />
                    </MotionCard>
                </Col>
            </Row>

            {/* ===== Main Table ===== */}
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24}>
                    <MotionCard
                        title="Action Centre"
                        extra={
                            <Space wrap>
                                <Segmented
                                    value={tab}
                                    onChange={(v: any) => setTab(v)}
                                    options={[
                                        { label: 'All', value: 'all' },
                                        { label: 'Surveys', value: 'survey' },
                                        { label: 'Assessments', value: 'assessment' }
                                    ]}
                                    style={{ borderRadius: 999, padding: 4, background: '#f5f7fa' }}
                                />
                                <Input.Search
                                    placeholder="Search title, status..."
                                    allowClear
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ width: 320 }}
                                />
                            </Space>
                        }
                    >
                        <Table rowKey="id" loading={loading} dataSource={filtered} columns={cols} pagination={{ pageSize: 10 }} />
                    </MotionCard>
                </Col>
            </Row>

            {/* ===== Survey Summary Modal ===== */}
            <Modal
                title={
                    <Space style={{ width: '100%', justifyContent: 'space-between', paddingRight: 44 }}>
                        <Space>
                            <span>Survey Summary</span>
                            {activeRow?.title ? <Tag color="cyan">{activeRow.title}</Tag> : null}
                        </Space>

                        <Button size="small" onClick={() => setModalFs(v => !v)}>
                            {modalFs ? 'Exit full screen' : 'Full screen'}
                        </Button>
                    </Space>
                }
                open={summaryOpen}
                onCancel={() => {
                    setSummaryOpen(false)
                    setActiveRow(null)
                    setActiveTemplate(null)
                    setActiveResponse(null)
                    setModalError('')
                }}
                footer={<Button onClick={() => setSummaryOpen(false)}>Close</Button>}
                width={modalFs ? '100vw' : '92vw'}
                style={{ top: modalFs ? 0 : 16 }}
                bodyStyle={{ height: modalFs ? 'calc(100dvh - 120px)' : '78vh', overflowY: 'auto', padding: 12 }}
                styles={{
                    header: {
                        padding: modalFs ? '16px 56px 16px 16px' : undefined //  reserves space for X
                    },
                    content: {
                        borderRadius: modalFs ? 0 : 8 //  no rounded corners in fullscreen
                    }
                }}
                destroyOnClose
            >
                {renderSurveySummary()}
            </Modal>

            {/* ===== Assessment Results Modal ===== */}
            <Modal
                title={
                    <Space style={{ width: '100%', justifyContent: 'space-between', paddingRight: 44 }}>
                        <Space>
                            <span>Assessment Results</span>
                            {activeRow?.title ? <Tag color="geekblue">{activeRow.title}</Tag> : null}
                        </Space>

                        <Button size="small" onClick={() => setModalFs(v => !v)}>
                            {modalFs ? 'Exit full screen' : 'Full screen'}
                        </Button>
                    </Space>
                }
                open={resultsOpen}
                onCancel={() => {
                    setResultsOpen(false)
                    setActiveRow(null)
                    setActiveTemplate(null)
                    setActiveResponse(null)
                    setModalError('')
                }}
                footer={<Button onClick={() => setResultsOpen(false)}>Close</Button>}
                width={modalFs ? '100vw' : '92vw'}
                style={{ top: modalFs ? 0 : 16 }}
                bodyStyle={{ height: modalFs ? 'calc(100dvh - 120px)' : '78vh', overflowY: 'auto', padding: 12 }}
                styles={{
                    header: {
                        padding: modalFs ? '16px 56px 16px 16px' : undefined // reserves space for X
                    },
                    content: {
                        borderRadius: modalFs ? 0 : 8
                    }
                }}
                destroyOnClose
            >
                {renderAssessmentResults()}
            </Modal>

        </div>
    )
}
