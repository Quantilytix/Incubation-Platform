// =============================================
// src/pages/TimedAssessmentRunner.tsx
// UPDATED to align with your NEW AssessmentBuilder schema, while still supporting legacy fields.
//
// ✅ Supports NEW schema (from your AssessmentBuilder):
// - template.assessmentMeta.timingMode: 'none' | 'overall' | 'per_question'
// - template.assessmentMeta.overallTimeSeconds
// - template.assessmentMeta.maxAttempts
// - per-question time is stored per field: field.timeLimitSeconds
// - request denormalized fields (preferred for enforcement): formRequests.{timingMode, overallTimeSeconds, maxAttempts}
//
// ✅ Still supports LEGACY schema (your older runner):
// - template.assessmentMeta.timePerQuestionSec
// - template.assessmentMeta.totalTimeSec
//
// ✅ Fixes attempt enforcement:
// - attemptCount increments on START (first session creation), not only on submit.
// - prevents infinite restarts before submit.
//
// ✅ Fixes timer correctness:
// - Uses wall-clock (Date.now) deltas so refresh/exit doesn't "pause" time.
// - Session persisted in localStorage with lastTickAtMs.
//
// ✅ Runner behavior:
// - One question at a time
// - Auto-advance on per-question time up
// - Auto-submit on overall time up OR last-question time up
// - No back navigation
// - Required questions enforced on Next (but time expiry still records unanswered)
// - MCQ starts with no selection (value undefined) -> enforced
// =============================================

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    App,
    Button,
    Card,
    Divider,
    Progress,
    Space,
    Tag,
    Typography,
    Radio,
    Checkbox,
    Input,
    InputNumber,
    Rate,
    Alert,
    Modal,
    Spin
} from 'antd'
import { Helmet } from 'react-helmet'
import { useParams, useNavigate } from 'react-router-dom'
import {
    doc,
    getDoc,
    addDoc,
    collection,
    updateDoc,
    increment,
    serverTimestamp
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/useFullIdentity'

const { Title, Text } = Typography

type AnswersMap = Record<string, any>

type TimingMode = 'none' | 'overall' | 'per_question'

type FormField = {
    id: string
    type: 'short' | 'long' | 'radio' | 'checkbox' | 'rating' | 'number' | 'heading'
    label: string
    required: boolean
    description?: string
    options?: string[]
    correctAnswer?: any
    points?: number

    // ✅ NEW (builder): per-question time
    timeLimitSeconds?: number | null
}

type FormTemplate = {
    id: string
    title: string
    description?: string
    category?: string
    companyCode?: string
    fields: FormField[]
    assessmentMeta?: {
        // existing
        timeWindowEnabled?: boolean
        startAt?: any
        endAt?: any
        dueAt?: any
        autoGrade?: boolean

        // ✅ NEW builder fields:
        timingMode?: TimingMode
        overallTimeSeconds?: number | null
        maxAttempts?: number | null

        // ✅ LEGACY fields (still supported):
        timePerQuestionSec?: number | null
        totalTimeSec?: number | null
    }
}

type FormRequest = {
    id: string
    templateId: string
    participantId: string
    participantName?: string
    participantEmail?: string
    companyCode?: string
    status?: string

    attemptCount?: number

    // optional time window denormalized:
    startAt?: any
    endAt?: any
    dueAt?: any
    timeWindowEnabled?: boolean

    // ✅ NEW denormalized (preferred):
    timingMode?: TimingMode
    overallTimeSeconds?: number | null
    maxAttempts?: number | null
}

function toDateSafe(v: any): Date | null {
    if (!v) return null
    if (typeof v?.toDate === 'function') {
        try { return v.toDate() } catch { }
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

function secondsToClock(sec: number) {
    const s = Math.max(0, Math.floor(sec))
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function clampInt(v: any, min: number, max: number) {
    const n = Number(v)
    if (!Number.isFinite(n)) return min
    return Math.max(min, Math.min(max, Math.floor(n)))
}

const lsKey = (requestId: string) => `timed_assessment_session__${requestId}`

type SessionState = {
    startedAtMs: number
    lastTickAtMs: number

    currentIndex: number
    lockedIndexMax: number

    answers: AnswersMap
    unanswered: string[]
    questionTimeSpentSec: Record<string, number>

    remainingOverallSec: number | null
    remainingQuestionSec: number | null

    // ✅ prevent attemptCount double increment on refresh
    attemptStarted: boolean
}

export default function TimedAssessmentRunner() {
    const { message } = App.useApp()
    const { user } = useFullIdentity() as any
    const navigate = useNavigate()
    const { requestId } = useParams<{ requestId: string }>()

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    const [reqDoc, setReqDoc] = useState<FormRequest | null>(null)
    const [tpl, setTpl] = useState<FormTemplate | null>(null)

    const [blockedReason, setBlockedReason] = useState<string | null>(null)
    const [session, setSession] = useState<SessionState | null>(null)

    const tickRef = useRef<any>(null)

    // -----------------------------
    // Load request + template
    // -----------------------------
    useEffect(() => {
        ; (async () => {
            if (!requestId) return
            setLoading(true)
            try {
                const rRef = doc(db, 'formRequests', requestId)
                const rSnap = await getDoc(rRef)
                if (!rSnap.exists()) {
                    setBlockedReason('Assessment request not found.')
                    setLoading(false)
                    return
                }

                const r = { id: rSnap.id, ...(rSnap.data() as any) } as FormRequest
                if (!r.templateId) {
                    setBlockedReason('Assessment request is missing templateId.')
                    setLoading(false)
                    return
                }

                const tRef = doc(db, 'formTemplates', r.templateId)
                const tSnap = await getDoc(tRef)
                if (!tSnap.exists()) {
                    setBlockedReason('Assessment template not found.')
                    setLoading(false)
                    return
                }

                const t = { id: tSnap.id, ...(tSnap.data() as any) } as FormTemplate

                // time window enforcement (request overrides template)
                const meta = t.assessmentMeta || {}
                const timeWindowEnabled = Boolean(r.timeWindowEnabled ?? meta.timeWindowEnabled)
                const startAt = toDateSafe(r.startAt ?? meta.startAt)
                const endAt = toDateSafe(r.endAt ?? meta.endAt)

                if (timeWindowEnabled) {
                    const now = new Date()
                    if (startAt && now < startAt) {
                        setBlockedReason(`This assessment opens at ${startAt.toLocaleString()}.`)
                        setLoading(false)
                        return
                    }
                    if (endAt && now > endAt) {
                        setBlockedReason(`This assessment closed at ${endAt.toLocaleString()}.`)
                        setLoading(false)
                        return
                    }
                }

                // attempts enforcement (request overrides template)
                const maxAttemptsRaw =
                    r.maxAttempts ?? meta.maxAttempts

                const maxAttempts =
                    typeof maxAttemptsRaw === 'number' && maxAttemptsRaw > 0
                        ? Math.floor(maxAttemptsRaw)
                        : null

                const attemptCount = Number(r.attemptCount || 0)
                if (maxAttempts !== null && attemptCount >= maxAttempts) {
                    setBlockedReason(`Maximum attempts reached (${attemptCount}/${maxAttempts}).`)
                    setLoading(false)
                    return
                }

                setReqDoc(r)
                setTpl(t)
                setLoading(false)
            } catch (e) {
                console.error(e)
                setBlockedReason('Failed to load assessment.')
                setLoading(false)
            }
        })()
    }, [requestId])

    // -----------------------------
    // Questions (exclude headings)
    // -----------------------------
    const questions = useMemo(() => {
        return (tpl?.fields || []).filter(f => f.type !== 'heading')
    }, [tpl])

    // -----------------------------
    // Resolve timing mode + limits
    // -----------------------------
    const resolvedTiming = useMemo(() => {
        const meta = tpl?.assessmentMeta || {}

        // prefer request denormalized fields
        const mode: TimingMode =
            (reqDoc?.timingMode as any) ||
            (meta.timingMode as any) ||
            // legacy fallback: if old fields exist, infer mode
            ((typeof meta.totalTimeSec === 'number' && meta.totalTimeSec > 0) ? 'overall'
                : (typeof meta.timePerQuestionSec === 'number' && meta.timePerQuestionSec > 0) ? 'per_question'
                    : 'none')

        const overallSeconds =
            typeof reqDoc?.overallTimeSeconds === 'number'
                ? clampInt(reqDoc.overallTimeSeconds, 0, 24 * 60 * 60)
                : typeof meta.overallTimeSeconds === 'number'
                    ? clampInt(meta.overallTimeSeconds, 0, 24 * 60 * 60)
                    : typeof meta.totalTimeSec === 'number'
                        ? clampInt(meta.totalTimeSec, 0, 24 * 60 * 60)
                        : 0

        const legacyPerQ =
            typeof meta.timePerQuestionSec === 'number' ? clampInt(meta.timePerQuestionSec, 0, 60 * 60) : 0

        const maxAttemptsRaw = reqDoc?.maxAttempts ?? meta.maxAttempts
        const maxAttempts =
            typeof maxAttemptsRaw === 'number' && maxAttemptsRaw > 0 ? Math.floor(maxAttemptsRaw) : null

        return { mode, overallSeconds, legacyPerQ, maxAttempts }
    }, [tpl, reqDoc])

    // -----------------------------
    // Initialize / restore session
    // -----------------------------
    useEffect(() => {
        if (!requestId || !tpl || !reqDoc) return
        if (!questions.length) return

        const raw = localStorage.getItem(lsKey(requestId))
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as SessionState
                if (parsed && typeof parsed.currentIndex === 'number' && parsed.answers) {
                    setSession(parsed)
                    return
                }
            } catch { }
        }

        const now = Date.now()

        // initial remaining timers based on mode
        const initialOverall =
            resolvedTiming.mode === 'overall' && resolvedTiming.overallSeconds > 0
                ? resolvedTiming.overallSeconds
                : null

        const firstQ = questions[0]
        const initialPerQ =
            resolvedTiming.mode === 'per_question'
                ? (() => {
                    // NEW: per-field timeLimitSeconds wins
                    const sec = clampInt(firstQ?.timeLimitSeconds ?? 0, 0, 60 * 60)
                    if (sec > 0) return sec
                    // LEGACY: fallback to meta.timePerQuestionSec
                    return resolvedTiming.legacyPerQ > 0 ? resolvedTiming.legacyPerQ : null
                })()
                : null

        const initial: SessionState = {
            startedAtMs: now,
            lastTickAtMs: now,

            currentIndex: 0,
            lockedIndexMax: 0,

            answers: {},
            unanswered: [],
            questionTimeSpentSec: {},

            remainingOverallSec: initialOverall,
            remainingQuestionSec: initialPerQ,

            attemptStarted: false
        }

        setSession(initial)
        localStorage.setItem(lsKey(requestId), JSON.stringify(initial))
    }, [requestId, tpl, reqDoc, questions.length, resolvedTiming.mode, resolvedTiming.overallSeconds, resolvedTiming.legacyPerQ])

    // -----------------------------
    // Persist session
    // -----------------------------
    useEffect(() => {
        if (!requestId || !session) return
        localStorage.setItem(lsKey(requestId), JSON.stringify(session))
    }, [requestId, session])

    // -----------------------------
    // Increment attemptCount ON START (once)
    // -----------------------------
    useEffect(() => {
        ; (async () => {
            if (!requestId || !session || !reqDoc) return
            if (session.attemptStarted) return

            try {
                const rRef = doc(db, 'formRequests', requestId)
                await updateDoc(rRef, {
                    attemptCount: increment(1),
                    attemptStartedAt: serverTimestamp(),
                    status: reqDoc.status || 'in_progress'
                })

                // update local + state so we don’t double increment
                setReqDoc(prev => prev ? { ...prev, attemptCount: Number(prev.attemptCount || 0) + 1 } : prev)
                setSession(prev => prev ? { ...prev, attemptStarted: true } : prev)
            } catch (e) {
                console.error(e)
                // If this fails, do NOT block the user, but warn.
                message.warning('Could not register attempt start. Please check connectivity.')
            }
        })()
    }, [requestId, session?.attemptStarted, reqDoc?.id])

    // -----------------------------
    // Helpers
    // -----------------------------
    const currentQ = useMemo(() => {
        if (!session) return null
        return questions[session.currentIndex] || null
    }, [session, questions])

    const effectiveQuestionRemaining = useMemo(() => {
        if (!session) return null
        const q = session.remainingQuestionSec
        const o = session.remainingOverallSec
        if (typeof q === 'number' && typeof o === 'number') return Math.max(0, Math.min(q, o))
        if (typeof q === 'number') return Math.max(0, q)
        if (typeof o === 'number') return Math.max(0, o)
        return null
    }, [session?.remainingQuestionSec, session?.remainingOverallSec])

    const overallRemaining = useMemo(() => {
        if (!session) return null
        return typeof session.remainingOverallSec === 'number' ? Math.max(0, session.remainingOverallSec) : null
    }, [session?.remainingOverallSec])

    const progressPct = useMemo(() => {
        if (!session || questions.length === 0) return 0
        return Math.round(((session.currentIndex + 1) / questions.length) * 100)
    }, [session?.currentIndex, questions.length])

    const requiredUnansweredWarning = useMemo(() => {
        if (!session || !currentQ) return false
        if (!currentQ.required) return false
        const v = session.answers[currentQ.id]
        if (v === undefined || v === null) return true
        if (typeof v === 'string' && v.trim() === '') return true
        if (Array.isArray(v) && v.length === 0) return true
        return false
    }, [session, currentQ])

    const computePerQLimitForIndex = (index: number) => {
        const q = questions[index]
        if (!q) return null
        // NEW: field.timeLimitSeconds
        const secField = clampInt(q.timeLimitSeconds ?? 0, 0, 60 * 60)
        if (secField > 0) return secField
        // LEGACY fallback:
        return resolvedTiming.legacyPerQ > 0 ? resolvedTiming.legacyPerQ : null
    }

    // -----------------------------
    // Timers (wall clock)
    // -----------------------------
    useEffect(() => {
        if (!session || !currentQ) return

        if (tickRef.current) clearInterval(tickRef.current)

        tickRef.current = setInterval(() => {
            setSession(prev => {
                if (!prev) return prev

                const now = Date.now()
                const dtSec = Math.max(1, Math.floor((now - (prev.lastTickAtMs || now)) / 1000))

                const q = questions[prev.currentIndex]
                if (!q) return { ...prev, lastTickAtMs: now }

                // Update time spent for current question
                const spent = { ...(prev.questionTimeSpentSec || {}) }
                spent[q.id] = (spent[q.id] || 0) + dtSec

                let nextOverall = prev.remainingOverallSec
                let nextQ = prev.remainingQuestionSec

                if (typeof nextOverall === 'number') nextOverall -= dtSec
                if (typeof nextQ === 'number') nextQ -= dtSec

                const updated: SessionState = {
                    ...prev,
                    lastTickAtMs: now,
                    questionTimeSpentSec: spent,
                    remainingOverallSec: nextOverall,
                    remainingQuestionSec: nextQ
                }

                // helper to check answered
                const isAnswered = (val: any) => {
                    if (val === undefined || val === null) return false
                    if (typeof val === 'string' && val.trim() === '') return false
                    if (Array.isArray(val) && val.length === 0) return false
                    return true
                }

                // Overall time up => force submit
                if (typeof nextOverall === 'number' && nextOverall <= 0) {
                    const unanswered = new Set(updated.unanswered || [])
                    if (!isAnswered(updated.answers[q.id])) unanswered.add(q.id)

                    const finalState: SessionState = {
                        ...updated,
                        unanswered: Array.from(unanswered),
                        remainingOverallSec: 0
                    }

                    setTimeout(() => { handleSubmit(finalState).catch(() => { }) }, 0)
                    return finalState
                }

                // Per-question time up => auto-advance or submit on last
                if (typeof nextQ === 'number' && nextQ <= 0) {
                    const unanswered = new Set(updated.unanswered || [])
                    if (!isAnswered(updated.answers[q.id])) unanswered.add(q.id)

                    const isLast = updated.currentIndex >= questions.length - 1
                    if (isLast) {
                        const finalState: SessionState = {
                            ...updated,
                            unanswered: Array.from(unanswered),
                            remainingQuestionSec: 0
                        }
                        setTimeout(() => { handleSubmit(finalState).catch(() => { }) }, 0)
                        return finalState
                    }

                    const nextIndex = updated.currentIndex + 1
                    return {
                        ...updated,
                        unanswered: Array.from(unanswered),
                        currentIndex: nextIndex,
                        lockedIndexMax: Math.max(updated.lockedIndexMax, nextIndex),
                        remainingQuestionSec: computePerQLimitForIndex(nextIndex)
                    }
                }

                return updated
            })
        }, 1000)

        return () => {
            if (tickRef.current) clearInterval(tickRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.currentIndex, questions.length, currentQ?.id])

    // -----------------------------
    // Answer setter (MCQ starts undefined)
    // -----------------------------
    const setAnswer = (fieldId: string, value: any) => {
        setSession(prev => {
            if (!prev) return prev
            return { ...prev, answers: { ...prev.answers, [fieldId]: value } }
        })
    }

    // -----------------------------
    // Navigation (no back)
    // -----------------------------
    const handleNext = () => {
        if (!session || !currentQ) return

        if (currentQ.required) {
            const v = session.answers[currentQ.id]
            const missing =
                v === undefined ||
                v === null ||
                (typeof v === 'string' && v.trim() === '') ||
                (Array.isArray(v) && v.length === 0)
            if (missing) {
                message.warning('This question is required.')
                return
            }
        }

        const isLast = session.currentIndex >= questions.length - 1
        if (isLast) {
            handleSubmit(session).catch(() => { })
            return
        }

        const nextIndex = session.currentIndex + 1
        setSession(prev => {
            if (!prev) return prev
            return {
                ...prev,
                currentIndex: nextIndex,
                lockedIndexMax: Math.max(prev.lockedIndexMax, nextIndex),
                remainingQuestionSec: resolvedTiming.mode === 'per_question' ? computePerQLimitForIndex(nextIndex) : null,
                lastTickAtMs: Date.now()
            }
        })
    }

    // -----------------------------
    // Submit
    // -----------------------------
    const handleSubmit = async (stateOverride?: SessionState) => {
        const s = stateOverride || session
        if (!s || !tpl || !reqDoc || !requestId) return
        if (submitting) return

        setSubmitting(true)
        try {
            // Compute unanswered: any still empty
            const unanswered = new Set<string>(s.unanswered || [])
            for (const q of questions) {
                const v = s.answers[q.id]
                const isAnswered =
                    v !== undefined &&
                    v !== null &&
                    !(
                        (typeof v === 'string' && v.trim() === '') ||
                        (Array.isArray(v) && v.length === 0)
                    )
                if (!isAnswered) unanswered.add(q.id)
            }

            const durationSec = Math.max(1, Math.floor((Date.now() - s.startedAtMs) / 1000))

            // Write response
            await addDoc(collection(db, 'formResponses'), {
                templateId: reqDoc.templateId,
                formId: reqDoc.templateId, // legacy
                requestId,
                formTitle: tpl.title || 'Assessment',
                kind: 'assessment',
                companyCode: reqDoc.companyCode || tpl.companyCode || user?.companyCode || '',
                participantId: reqDoc.participantId,
                submittedBy: {
                    id: user?.uid || user?.id || '',
                    name: user?.name || user?.displayName || reqDoc.participantName || '',
                    email: user?.email || reqDoc.participantEmail || ''
                },
                submittedAt: serverTimestamp(),
                status: 'submitted',
                answers: s.answers,
                timing: {
                    startedAtMs: s.startedAtMs,
                    durationSec,
                    perQuestionTimeSpentSec: s.questionTimeSpentSec || {},
                    unansweredIds: Array.from(unanswered),

                    // record resolved timing for auditing
                    timingMode: resolvedTiming.mode,
                    overallTimeSeconds:
                        resolvedTiming.mode === 'overall'
                            ? (resolvedTiming.overallSeconds || null)
                            : null,
                    // for per-question, store per-field map (best)
                    perQuestionLimits: resolvedTiming.mode === 'per_question'
                        ? questions.reduce((acc: any, q) => {
                            const lim = clampInt(q.timeLimitSeconds ?? 0, 0, 60 * 60)
                            if (lim > 0) acc[q.id] = lim
                            return acc
                        }, {})
                        : {}
                }
            })

            // Update request
            const rRef = doc(db, 'formRequests', requestId)
            await updateDoc(rRef, {
                status: 'submitted',
                submittedAt: serverTimestamp()
            })

            // Clear local session
            localStorage.removeItem(lsKey(requestId))

            Modal.success({
                title: 'Submitted',
                content: 'Your assessment has been submitted.',
                onOk: () => navigate(-1)
            })
        } catch (e) {
            console.error(e)
            message.error('Failed to submit assessment.')
        } finally {
            setSubmitting(false)
        }
    }

    // -----------------------------
    // Render input by type
    // -----------------------------
    const renderQuestionInput = (q: FormField) => {
        const v = session?.answers?.[q.id]

        switch (q.type) {
            case 'radio':
                return (
                    <Radio.Group
                        value={v} // ✅ undefined by default => nothing selected
                        onChange={e => setAnswer(q.id, e.target.value)}
                        style={{ display: 'grid', gap: 8 }}
                    >
                        {(q.options || []).map(opt => (
                            <Radio key={opt} value={opt}>
                                {opt}
                            </Radio>
                        ))}
                    </Radio.Group>
                )

            case 'checkbox': {
                const arr = Array.isArray(v) ? v : []
                return (
                    <Checkbox.Group
                        value={arr}
                        onChange={vals => setAnswer(q.id, vals)}
                        style={{ display: 'grid', gap: 8 }}
                        options={(q.options || []).map(o => ({ label: o, value: o }))}
                    />
                )
            }

            case 'short':
                return (
                    <Input
                        value={typeof v === 'string' ? v : ''}
                        onChange={e => setAnswer(q.id, e.target.value)}
                        placeholder="Type your answer…"
                    />
                )

            case 'long':
                return (
                    <Input.TextArea
                        rows={5}
                        value={typeof v === 'string' ? v : ''}
                        onChange={e => setAnswer(q.id, e.target.value)}
                        placeholder="Type your answer…"
                    />
                )

            case 'number':
                return (
                    <InputNumber
                        style={{ width: 240 }}
                        value={typeof v === 'number' ? v : undefined}
                        onChange={val => setAnswer(q.id, typeof val === 'number' ? val : undefined)}
                        placeholder="Enter a number"
                    />
                )

            case 'rating':
                return (
                    <Rate
                        value={typeof v === 'number' ? v : 0}
                        onChange={val => setAnswer(q.id, val)}
                    />
                )

            default:
                return <Alert type="warning" showIcon message={`Unsupported question type: ${q.type}`} />
        }
    }

    // -----------------------------
    // UI states
    // -----------------------------
    if (loading) {
        return (
            <div style={{ minHeight: '100vh', padding: 24 }}>
                <Card style={{ borderRadius: 16 }}>
                    <Spin />
                </Card>
            </div>
        )
    }

    if (blockedReason) {
        return (
            <div style={{ minHeight: '100vh', padding: 24 }}>
                <Helmet>
                    <title>Assessment | Smart Incubation</title>
                </Helmet>
                <Card style={{ borderRadius: 16 }}>
                    <Title level={4}>Assessment</Title>
                    <Alert type="error" showIcon message="Cannot start assessment" description={blockedReason} />
                    <Divider />
                    <Button onClick={() => navigate(-1)}>Back</Button>
                </Card>
            </div>
        )
    }

    if (!tpl || !reqDoc || !session || !currentQ) {
        return (
            <div style={{ minHeight: '100vh', padding: 24 }}>
                <Card style={{ borderRadius: 16 }}>
                    <Alert type="warning" showIcon message="Nothing to display" />
                    <Divider />
                    <Button onClick={() => navigate(-1)}>Back</Button>
                </Card>
            </div>
        )
    }

    const maxAttempts = resolvedTiming.maxAttempts
    const attemptCount = Number(reqDoc.attemptCount || 0)
    const attemptLabel = maxAttempts !== null ? `${attemptCount}/${maxAttempts}` : `${attemptCount}`

    const showOverall = typeof overallRemaining === 'number'
    const showPerQ = typeof effectiveQuestionRemaining === 'number'

    const overallPct = useMemo(() => {
        if (!showOverall) return null
        const total = resolvedTiming.overallSeconds
        if (!total || total <= 0) return null
        return Math.round((Math.max(0, overallRemaining!) / total) * 100)
    }, [showOverall, overallRemaining, resolvedTiming.overallSeconds])

    const perQPct = useMemo(() => {
        if (!showPerQ) return null
        const lim = computePerQLimitForIndex(session.currentIndex)
        if (!lim || lim <= 0) return null
        return Math.round((Math.max(0, effectiveQuestionRemaining!) / lim) * 100)
    }, [showPerQ, effectiveQuestionRemaining, session.currentIndex])

    return (
        <div style={{ minHeight: '100vh', padding: 24 }}>
            <Helmet>
                <title>{tpl.title || 'Assessment'} | Smart Incubation</title>
            </Helmet>

            <Card style={{ borderRadius: 16 }} bodyStyle={{ padding: 18 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={10}>
                    <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }} wrap>
                        <div>
                            <Title level={4} style={{ margin: 0 }}>
                                {tpl.title || 'Assessment'}
                            </Title>
                            {tpl.description ? (
                                <Text type="secondary">{tpl.description}</Text>
                            ) : (
                                <Text type="secondary">Answer each question before time runs out.</Text>
                            )}
                        </div>

                        <Space wrap>
                            <Tag color="blue">Attempt: {attemptLabel}</Tag>
                            <Tag>
                                Q {session.currentIndex + 1} / {questions.length}
                            </Tag>
                            <Tag color="geekblue">Progress: {progressPct}%</Tag>
                            <Tag>
                                Timer: {resolvedTiming.mode === 'none' ? 'Off' : resolvedTiming.mode === 'overall' ? 'Overall' : 'Per Question'}
                            </Tag>
                        </Space>
                    </Space>

                    {(showOverall || showPerQ) && (
                        <Card size="small" style={{ borderRadius: 12 }}>
                            <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                {showOverall && (
                                    <div>
                                        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                                            <Text strong>Overall time left</Text>
                                            <Tag color={overallRemaining! <= 30 ? 'red' : 'default'}>
                                                {secondsToClock(overallRemaining!)}
                                            </Tag>
                                        </Space>
                                        {overallPct !== null && <Progress percent={overallPct} showInfo={false} />}
                                    </div>
                                )}

                                {showPerQ && (
                                    <div>
                                        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                                            <Text strong>Question time left</Text>
                                            <Tag color={effectiveQuestionRemaining! <= 10 ? 'red' : 'default'}>
                                                {secondsToClock(effectiveQuestionRemaining!)}
                                            </Tag>
                                        </Space>
                                        {perQPct !== null && <Progress percent={perQPct} showInfo={false} />}
                                    </div>
                                )}
                            </Space>
                        </Card>
                    )}

                    <Divider style={{ margin: '6px 0' }} />

                    <Card style={{ borderRadius: 14 }} bodyStyle={{ padding: 16 }}>
                        <Space direction="vertical" style={{ width: '100%' }} size={10}>
                            <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }} wrap>
                                <div>
                                    <Text strong style={{ fontSize: 16 }}>
                                        {currentQ.label || 'Question'}
                                    </Text>
                                    {currentQ.description ? (
                                        <div style={{ marginTop: 6 }}>
                                            <Text type="secondary">{currentQ.description}</Text>
                                        </div>
                                    ) : null}
                                </div>

                                <Space wrap>
                                    {currentQ.required ? <Tag color="red">Required</Tag> : <Tag>Optional</Tag>}
                                    <Tag>{String(currentQ.type).toUpperCase()}</Tag>
                                    {resolvedTiming.mode === 'per_question' && (
                                        <Tag>
                                            Limit: {computePerQLimitForIndex(session.currentIndex) ? `${computePerQLimitForIndex(session.currentIndex)}s` : '—'}
                                        </Tag>
                                    )}
                                </Space>
                            </Space>

                            {requiredUnansweredWarning && (
                                <Alert
                                    type="warning"
                                    showIcon
                                    message="This question is required."
                                    description="Pick / type an answer before clicking Next. If time runs out, it will be recorded as unanswered."
                                />
                            )}

                            <div style={{ marginTop: 6 }}>{renderQuestionInput(currentQ)}</div>

                            <Divider style={{ margin: '10px 0' }} />

                            <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
                                <Text type="secondary">
                                    No back navigation. Timing is enforced using real elapsed time.
                                </Text>

                                <Space>
                                    <Button
                                        onClick={() => {
                                            Modal.confirm({
                                                title: 'Exit assessment?',
                                                content:
                                                    'If you exit now, your progress is saved on this device. When you return, elapsed time is still counted.',
                                                okText: 'Exit',
                                                onOk: () => navigate(-1)
                                            })
                                        }}
                                    >
                                        Exit
                                    </Button>

                                    <Button type="primary" loading={submitting} onClick={handleNext}>
                                        {session.currentIndex >= questions.length - 1 ? 'Submit' : 'Next'}
                                    </Button>
                                </Space>
                            </Space>
                        </Space>
                    </Card>
                </Space>
            </Card>
        </div>
    )
}
