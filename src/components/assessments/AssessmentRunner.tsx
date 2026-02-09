// src/pages/TimedAssessmentRunner.tsx
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
    Result
} from 'antd'
import { Helmet } from 'react-helmet'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, addDoc, collection, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { LoadingOverlay } from '../shared/LoadingOverlay'

const { Title, Text } = Typography

type AnswersMap = Record<string, any>
type TimingMode = 'none' | 'overall' | 'per_question'
type RetryMode = 'none' | 'all' | 'belowScore'

type FormField = {
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

type FormTemplate = {
    id: string
    title: string
    description?: string
    category?: string
    companyCode?: string
    fields: FormField[]
    assessmentMeta?: {
        timeWindowEnabled?: boolean
        startAt?: any
        endAt?: any
        dueAt?: any

        autoGrade?: boolean

        timingMode?: TimingMode
        overallTimeSeconds?: number | null
        maxAttempts?: number | null

        passMarkPct?: number
        retryPolicy?: {
            enabled?: boolean
            mode?: RetryMode
            thresholdPct?: number
        }

        // legacy (optional)
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

    // We treat attemptCount as "submitted attempts count"
    attemptCount?: number

    // last submitted score (for retryPolicy belowScore)
    lastScorePct?: number

    startAt?: any
    endAt?: any
    dueAt?: any
    timeWindowEnabled?: boolean

    timingMode?: TimingMode
    overallTimeSeconds?: number | null
    maxAttempts?: number | null
}

function toDateSafe(v: any): Date | null {
    if (!v) return null
    if (typeof v?.toDate === 'function') {
        try {
            const d = v.toDate()
            return d instanceof Date && !isNaN(d.getTime()) ? d : null
        } catch {
            return null
        }
    }
    if (typeof v?.seconds === 'number') {
        const ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6)
        const d = new Date(ms)
        return isNaN(d.getTime()) ? null : d
    }
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v
    if (typeof v === 'number') {
        const ms = v < 10_000_000_000 ? v * 1000 : v
        const d = new Date(ms)
        return isNaN(d.getTime()) ? null : d
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
}

type SubmitTrigger = 'manual_submit' | 'overall_timeout' | 'per_question_timeout'

export default function TimedAssessmentRunner() {
    const { message } = App.useApp()
    const { user } = useFullIdentity() as any
    const navigate = useNavigate()

    const params = useParams()
    const requestId = (params as any).requestId || (params as any).id || (params as any).assignmentId || ''

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    const [reqDoc, setReqDoc] = useState<FormRequest | null>(null)
    const [tpl, setTpl] = useState<FormTemplate | null>(null)

    const [blockedReason, setBlockedReason] = useState<string | null>(null)
    const [session, setSession] = useState<SessionState | null>(null)

    const tickRef = useRef<any>(null)

    // hard locks
    const finalizingRef = useRef(false)
    const finalizedRef = useRef(false)

    const [showSubmittedResult, setShowSubmittedResult] = useState(false)
    const [submittedTrigger, setSubmittedTrigger] = useState<SubmitTrigger>('manual_submit')
    const [lastScorePctUi, setLastScorePctUi] = useState<number | null>(null)
    const [canRetakeUi, setCanRetakeUi] = useState<boolean>(false)

    useEffect(() => {
        finalizingRef.current = false
        finalizedRef.current = false
        Modal.destroyAll()
    }, [requestId])

    useEffect(() => {
        return () => {
            if (tickRef.current) {
                clearInterval(tickRef.current)
                tickRef.current = null
            }
            Modal.destroyAll()
        }
    }, [])

    // -----------------------------
    // Load request + template
    // -----------------------------
    useEffect(() => {
        ; (async () => {
            if (!requestId) {
                setBlockedReason('Missing assessment request id in the URL.')
                setLoading(false)
                return
            }

            setLoading(true)
            setBlockedReason(null)

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
                const meta = t.assessmentMeta || {}

                // time window enforcement (request overrides template)
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
    const questions = useMemo(() => (tpl?.fields || []).filter(f => f.type !== 'heading'), [tpl])

    // -----------------------------
    // Resolve timing + policy
    // -----------------------------
    const resolved = useMemo(() => {
        const meta = tpl?.assessmentMeta || {}

        const mode: TimingMode =
            (reqDoc?.timingMode as any) ||
            (meta.timingMode as any) ||
            (typeof meta.totalTimeSec === 'number' && meta.totalTimeSec > 0
                ? 'overall'
                : typeof meta.timePerQuestionSec === 'number' && meta.timePerQuestionSec > 0
                    ? 'per_question'
                    : 'none')

        const overallSeconds =
            typeof reqDoc?.overallTimeSeconds === 'number'
                ? clampInt(reqDoc.overallTimeSeconds, 0, 24 * 60 * 60)
                : typeof meta.overallTimeSeconds === 'number'
                    ? clampInt(meta.overallTimeSeconds, 0, 24 * 60 * 60)
                    : typeof meta.totalTimeSec === 'number'
                        ? clampInt(meta.totalTimeSec, 0, 24 * 60 * 60)
                        : 0

        const legacyPerQ = typeof meta.timePerQuestionSec === 'number' ? clampInt(meta.timePerQuestionSec, 0, 60 * 60) : 0

        const maxAttemptsRaw = reqDoc?.maxAttempts ?? meta.maxAttempts
        const maxAttempts = typeof maxAttemptsRaw === 'number' && maxAttemptsRaw > 0 ? Math.floor(maxAttemptsRaw) : null

        const passMarkPct = clampInt(meta.passMarkPct ?? 50, 0, 100)

        const rp = meta.retryPolicy || {}
        const retryEnabled = Boolean(rp.enabled ?? true)
        const retryMode: RetryMode =
            rp.mode === 'all' || rp.mode === 'belowScore' || rp.mode === 'none' ? rp.mode : 'belowScore'
        const retryThresholdPct = clampInt(rp.thresholdPct ?? 40, 0, 100)

        const autoGrade = Boolean(meta.autoGrade ?? true)

        return { mode, overallSeconds, legacyPerQ, maxAttempts, passMarkPct, retryEnabled, retryMode, retryThresholdPct, autoGrade }
    }, [tpl, reqDoc])

    // -----------------------------
    // init / restore session
    // -----------------------------
    useEffect(() => {
        if (!requestId || !tpl || !reqDoc) return
        if (!questions.length) return

        // if already submitted, we don't auto-restore session unless user retakes
        const status = String(reqDoc.status || '').toLowerCase()
        if (status === 'submitted') {
            setSession(null)
            return
        }

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

        const initialOverall = resolved.mode === 'overall' && resolved.overallSeconds > 0 ? resolved.overallSeconds : null

        const firstQ = questions[0]
        const initialPerQ =
            resolved.mode === 'per_question'
                ? (() => {
                    const sec = clampInt(firstQ?.timeLimitSeconds ?? 0, 0, 60 * 60)
                    if (sec > 0) return sec
                    return resolved.legacyPerQ > 0 ? resolved.legacyPerQ : null
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
            remainingQuestionSec: initialPerQ
        }

        setSession(initial)
        localStorage.setItem(lsKey(requestId), JSON.stringify(initial))
    }, [requestId, tpl, reqDoc, questions.length, resolved.mode, resolved.overallSeconds, resolved.legacyPerQ])

    // persist session
    useEffect(() => {
        if (!requestId || !session) return
        localStorage.setItem(lsKey(requestId), JSON.stringify(session))
    }, [requestId, session])

    const currentQ = useMemo(() => {
        if (!session) return null
        return questions[session.currentIndex] || null
    }, [session, questions])

    const computePerQLimitForIndex = (index: number) => {
        const q = questions[index]
        if (!q) return null
        const secField = clampInt(q.timeLimitSeconds ?? 0, 0, 60 * 60)
        if (secField > 0) return secField
        return resolved.legacyPerQ > 0 ? resolved.legacyPerQ : null
    }

    const effectiveQuestionRemaining = useMemo(() => {
        if (!session) return null
        const q = session.remainingQuestionSec
        const o = session.remainingOverallSec
        if (typeof q === 'number' && typeof o === 'number') return Math.max(0, Math.min(q, o))
        if (typeof q === 'number') return Math.max(0, q)
        if (typeof o === 'number') return Math.max(0, o)
        return null
    }, [session])

    const overallRemaining = useMemo(() => {
        if (!session) return null
        return typeof session.remainingOverallSec === 'number' ? Math.max(0, session.remainingOverallSec) : null
    }, [session])

    const progressPct = useMemo(() => {
        if (!session || questions.length === 0) return 0
        return Math.round(((session.currentIndex + 1) / questions.length) * 100)
    }, [session, questions.length])

    const isAnswered = (val: any) => {
        if (val === undefined || val === null) return false
        if (typeof val === 'string' && val.trim() === '') return false
        if (Array.isArray(val) && val.length === 0) return false
        return true
    }

    const requiredUnansweredWarning = useMemo(() => {
        if (!session || !currentQ) return false
        if (!currentQ.required) return false
        return !isAnswered(session.answers[currentQ.id])
    }, [session, currentQ])

    // -----------------------------
    // Timers: subtract real elapsed time (anti "pause")
    // -----------------------------
    useEffect(() => {
        if (!session || !currentQ) return
        if (finalizingRef.current || finalizedRef.current) return

        if (tickRef.current) clearInterval(tickRef.current)

        tickRef.current = setInterval(() => {
            setSession(prev => {
                if (!prev) return prev
                if (finalizingRef.current || finalizedRef.current) return prev

                const now = Date.now()

                // IMPORTANT: use real elapsed time since last tick (so leaving page still burns time when they come back)
                const dtSec = Math.max(1, Math.floor((now - (prev.lastTickAtMs || now)) / 1000))

                const q = questions[prev.currentIndex]
                if (!q) return { ...prev, lastTickAtMs: now }

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

                // Overall time up => force submit
                if (typeof nextOverall === 'number' && nextOverall <= 0) {
                    const finalState: SessionState = { ...updated, remainingOverallSec: 0 }
                    setTimeout(() => {
                        if (!finalizingRef.current && !finalizedRef.current) {
                            finalize(finalState, 'overall_timeout').catch(() => { })
                        }
                    }, 0)
                    return finalState
                }

                // Per-question time up => auto-advance or submit on last
                if (typeof nextQ === 'number' && nextQ <= 0) {
                    const isLast = updated.currentIndex >= questions.length - 1
                    if (isLast) {
                        const finalState: SessionState = { ...updated, remainingQuestionSec: 0 }
                        setTimeout(() => {
                            if (!finalizingRef.current && !finalizedRef.current) {
                                finalize(finalState, 'per_question_timeout').catch(() => { })
                            }
                        }, 0)
                        return finalState
                    }

                    const nextIndex = updated.currentIndex + 1
                    return {
                        ...updated,
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
    // Score + retry checks
    // -----------------------------
    const computeAutoScorePct = (answers: AnswersMap) => {
        // only auto-grade supported types
        const autoTypes = new Set(['radio', 'checkbox', 'number', 'rating'])
        const qs = questions.filter(q => q.type !== 'heading')

        let total = 0
        let earned = 0
        let autoCount = 0

        for (const q of qs) {
            const pts = clampInt(q.points ?? 1, 0, 1000)
            if (!pts) continue

            const canAuto = resolved.autoGrade && autoTypes.has(q.type) && q.correctAnswer !== undefined && q.correctAnswer !== null
            if (!canAuto) continue

            total += pts
            autoCount += 1

            const a = answers[q.id]
            if (q.type === 'radio') {
                if (a === q.correctAnswer) earned += pts
            } else if (q.type === 'number') {
                if (typeof a === 'number' && typeof q.correctAnswer === 'number' && a === q.correctAnswer) earned += pts
            } else if (q.type === 'rating') {
                if (typeof a === 'number' && typeof q.correctAnswer === 'number' && a === q.correctAnswer) earned += pts
            } else if (q.type === 'checkbox') {
                const arrA = Array.isArray(a) ? a.slice().sort() : []
                const arrC = Array.isArray(q.correctAnswer) ? q.correctAnswer.slice().sort() : []
                const sameLen = arrA.length === arrC.length
                const sameAll = sameLen && arrA.every((v, i) => v === arrC[i])
                if (sameAll) earned += pts
            }
        }

        if (total <= 0) return { scorePct: null as number | null, earned: 0, total: 0, autoCount }
        const scorePct = Math.round((earned / total) * 100)
        return { scorePct, earned, total, autoCount }
    }

    const canRetakeNow = (attemptCount: number, lastScorePct: number | null) => {
        if (!resolved.maxAttempts) return false
        if (attemptCount >= resolved.maxAttempts) return false
        if (!resolved.retryEnabled) return false

        if (resolved.retryMode === 'none') return false
        if (resolved.retryMode === 'all') return true

        // belowScore
        if (lastScorePct === null) return false
        return lastScorePct < resolved.retryThresholdPct
    }

    // -----------------------------
    // Submit (attempt counted HERE)
    // -----------------------------
    const submitResponse = async (s: SessionState, trigger: SubmitTrigger) => {
        if (!tpl || !reqDoc || !requestId) return

        const unanswered = new Set<string>(s.unanswered || [])
        for (const q of questions) {
            if (!isAnswered(s.answers[q.id])) unanswered.add(q.id)
        }

        const durationSec = Math.max(1, Math.floor((Date.now() - s.startedAtMs) / 1000))

        const { scorePct, earned, total, autoCount } = computeAutoScorePct(s.answers)
        const attemptCountNext = Number(reqDoc.attemptCount || 0) + 1

        await addDoc(collection(db, 'formResponses'), {
            templateId: reqDoc.templateId,
            formId: reqDoc.templateId,
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
            completion: {
                trigger,
                completedQuestions: Object.keys(s.answers || {}).filter(k => isAnswered((s.answers as any)[k])).length,
                totalQuestions: questions.length,
                lastQuestionIndex: s.currentIndex
            },
            timing: {
                startedAtMs: s.startedAtMs,
                durationSec,
                perQuestionTimeSpentSec: s.questionTimeSpentSec || {},
                unansweredIds: Array.from(unanswered),
                timingMode: resolved.mode,
                overallTimeSeconds: resolved.mode === 'overall' ? resolved.overallSeconds || null : null,
                perQuestionLimits:
                    resolved.mode === 'per_question'
                        ? questions.reduce((acc: any, q) => {
                            const lim = clampInt(q.timeLimitSeconds ?? 0, 0, 60 * 60)
                            if (lim > 0) acc[q.id] = lim
                            return acc
                        }, {})
                        : {}
            },
            grading: {
                autoGradeApplied: resolved.autoGrade,
                autoQuestionsCount: autoCount,
                earnedPoints: earned,
                totalPoints: total,
                scorePct
            }
        })

        await updateDoc(doc(db, 'formRequests', requestId), {
            status: 'submitted',
            submittedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            attemptCount: attemptCountNext,
            lastScorePct: scorePct
        })

        // keep local state in sync
        setReqDoc(prev =>
            prev
                ? { ...prev, status: 'submitted', attemptCount: attemptCountNext, lastScorePct: scorePct ?? undefined }
                : prev
        )

        localStorage.removeItem(lsKey(requestId))

        return { scorePct }
    }

    const finalize = async (stateOverride?: SessionState, trigger: SubmitTrigger = 'manual_submit') => {
        const s = stateOverride || session
        if (!s || !tpl || !reqDoc || !requestId) return

        if (finalizingRef.current || finalizedRef.current) return
        finalizingRef.current = true

        if (tickRef.current) {
            clearInterval(tickRef.current)
            tickRef.current = null
        }
        Modal.destroyAll()

        setSubmitting(true)
        try {
            const res = await submitResponse(s, trigger)

            finalizedRef.current = true
            Modal.destroyAll()

            const scorePct = res?.scorePct ?? null
            setLastScorePctUi(scorePct)

            const attemptCountNow = Number((reqDoc.attemptCount || 0) + 1)
            const canRetake = canRetakeNow(attemptCountNow, scorePct)
            setCanRetakeUi(canRetake)

            setSubmittedTrigger(trigger)
            setShowSubmittedResult(true)
        } catch (e) {
            console.error(e)
            message.error('Failed to submit assessment.')
            finalizingRef.current = false
        } finally {
            setSubmitting(false)
        }
    }

    // -----------------------------
    // Navigation + Exit (exit is NOT an attempt)
    // -----------------------------
    const setAnswer = (fieldId: string, value: any) => {
        setSession(prev => {
            if (!prev) return prev
            return { ...prev, answers: { ...prev.answers, [fieldId]: value } }
        })
    }

    const handleNext = () => {
        if (!session || !currentQ) return
        if (finalizingRef.current || finalizedRef.current) return

        if (currentQ.required) {
            const missing = !isAnswered(session.answers[currentQ.id])
            if (missing) {
                message.warning('This question is required.')
                return
            }
        }

        const isLast = session.currentIndex >= questions.length - 1
        if (isLast) {
            finalize(session, 'manual_submit').catch(() => { })
            return
        }

        const nextIndex = session.currentIndex + 1
        setSession(prev => {
            if (!prev) return prev
            return {
                ...prev,
                currentIndex: nextIndex,
                lockedIndexMax: Math.max(prev.lockedIndexMax, nextIndex),
                remainingQuestionSec: resolved.mode === 'per_question' ? computePerQLimitForIndex(nextIndex) : null,
                lastTickAtMs: Date.now()
            }
        })
    }

    const handleExit = () => {
        if (!reqDoc || !session) {
            navigate(-1)
            return
        }
        if (finalizingRef.current || finalizedRef.current) return

        Modal.confirm({
            title: 'Exit assessment?',
            width: 620,
            icon: null,
            okText: 'Exit',
            cancelText: 'Continue',
            content: (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Alert
                        type="info"
                        showIcon
                        message="Progress saved"
                        description="Your progress is saved on this device. Time continues to elapse while you’re away."
                        style={{ width: '100%', margin: 0 }}
                    />
                    <Alert
                        type="warning"
                        showIcon
                        message="No attempt consumed"
                        description="Exiting does not count as an attempt because attempts are only counted when you submit."
                        style={{ width: '100%', margin: 0 }}
                    />
                </Space>
            ),
            onOk: () => navigate(-1)
        })
    }

    // -----------------------------
    // Render input
    // -----------------------------
    const renderQuestionInput = (q: FormField) => {
        const v = session?.answers?.[q.id]
        switch (q.type) {
            case 'radio':
                return (
                    <Radio.Group value={v} onChange={e => setAnswer(q.id, e.target.value)} style={{ display: 'grid', gap: 8 }}>
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
                return <Input value={typeof v === 'string' ? v : ''} onChange={e => setAnswer(q.id, e.target.value)} placeholder="Type your answer…" />

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
                return <Rate value={typeof v === 'number' ? v : 0} onChange={val => setAnswer(q.id, val)} />

            default:
                return <Alert type="warning" showIcon message={`Unsupported question type: ${q.type}`} />
        }
    }

    // -----------------------------
    // UI states
    // -----------------------------
    if (loading) return <LoadingOverlay tip="Getting questions ready..." />

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

    if (!tpl || !reqDoc) {
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

    // If already submitted: show result + optional retake button
    const status = String(reqDoc.status || '').toLowerCase()
    const attemptCount = Number(reqDoc.attemptCount || 0)
    const maxAttempts = resolved.maxAttempts
    const attemptLabel = maxAttempts !== null ? `${attemptCount}/${maxAttempts}` : `${attemptCount}`

    const lastScorePct = typeof reqDoc.lastScorePct === 'number' ? clampInt(reqDoc.lastScorePct, 0, 100) : null
    const canRetake = canRetakeNow(attemptCount, lastScorePct)

    if (status === 'submitted' && !showSubmittedResult) {
        return (
            <div style={{ padding: 24, minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
                <Result
                    status="success"
                    title="Submitted"
                    subTitle={
                        <div style={{ display: 'grid', gap: 6 }}>
                            <div>Attempts: {attemptLabel}</div>
                            {lastScorePct !== null ? (
                                <div>
                                    Score: <b>{lastScorePct}%</b> (Pass mark: {resolved.passMarkPct}%)
                                </div>
                            ) : (
                                <div>Score: Pending (manual grading)</div>
                            )}
                            {resolved.retryEnabled ? (
                                <div>Retry policy: {resolved.retryMode === 'all' ? 'Everyone' : resolved.retryMode === 'belowScore' ? `Below ${resolved.retryThresholdPct}%` : 'No retry'}</div>
                            ) : (
                                <div>Retry policy: Disabled</div>
                            )}
                        </div>
                    }
                    extra={[
                        canRetake ? (
                            <Button
                                type="primary"
                                key="retake"
                                onClick={async () => {
                                    // reset local session + reopen
                                    localStorage.removeItem(lsKey(requestId))
                                    await updateDoc(doc(db, 'formRequests', requestId), {
                                        status: 'in_progress',
                                        updatedAt: serverTimestamp()
                                    })
                                    setReqDoc(prev => (prev ? { ...prev, status: 'in_progress' } : prev))
                                    message.success('Retake started')
                                }}
                            >
                                Retake
                            </Button>
                        ) : (
                            <Button type="primary" key="back" onClick={() => navigate(-1)}>
                                Back
                            </Button>
                        )
                    ]}
                />
            </div>
        )
    }

    // after submission in this session
    if (showSubmittedResult) {
        const scorePct = lastScorePctUi
        return (
            <div style={{ padding: 24, minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
                <Result
                    status="success"
                    title="Submitted"
                    subTitle={
                        <div style={{ display: 'grid', gap: 6 }}>
                            <div>Trigger: {submittedTrigger}</div>
                            {scorePct !== null ? (
                                <div>
                                    Score: <b>{scorePct}%</b> (Pass mark: {resolved.passMarkPct}%)
                                </div>
                            ) : (
                                <div>Score: Pending (manual grading)</div>
                            )}
                            {canRetakeUi ? <div>You can retake (attempts remaining + policy allows).</div> : <div>No retake available.</div>}
                        </div>
                    }
                    extra={[
                        canRetakeUi ? (
                            <Button
                                type="primary"
                                key="retake"
                                onClick={async () => {
                                    localStorage.removeItem(lsKey(requestId))
                                    await updateDoc(doc(db, 'formRequests', requestId), {
                                        status: 'in_progress',
                                        updatedAt: serverTimestamp()
                                    })
                                    setReqDoc(prev => (prev ? { ...prev, status: 'in_progress' } : prev))
                                    setShowSubmittedResult(false)
                                    setLastScorePctUi(null)
                                    setCanRetakeUi(false)
                                    finalizedRef.current = false
                                    finalizingRef.current = false
                                    message.success('Retake started')
                                }}
                            >
                                Retake
                            </Button>
                        ) : (
                            <Button type="primary" key="back" onClick={() => navigate(-1)}>
                                Back
                            </Button>
                        )
                    ]}
                />
            </div>
        )
    }

    // must have session + currentQ to run
    if (!session || !currentQ || questions.length === 0) {
        return (
            <div style={{ minHeight: '100vh', padding: 24 }}>
                <Card style={{ borderRadius: 16 }}>
                    <Alert type="warning" showIcon message="No questions to display" />
                    <Divider />
                    <Button onClick={() => navigate(-1)}>Back</Button>
                </Card>
            </div>
        )
    }

    const showOverall = typeof overallRemaining === 'number'
    const showPerQ = typeof effectiveQuestionRemaining === 'number'

    const overallPct =
        showOverall && resolved.overallSeconds > 0 && typeof overallRemaining === 'number'
            ? Math.round((Math.max(0, overallRemaining) / resolved.overallSeconds) * 100)
            : null

    const perQPct =
        showPerQ && typeof effectiveQuestionRemaining === 'number'
            ? (() => {
                const lim = computePerQLimitForIndex(session.currentIndex)
                if (!lim || lim <= 0) return null
                return Math.round((Math.max(0, effectiveQuestionRemaining) / lim) * 100)
            })()
            : null

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
                            <Text type="secondary">{tpl.description || 'Answer each question before time runs out.'}</Text>
                        </div>

                        <Space wrap>
                            <Tag color="blue">Attempts used: {attemptLabel}</Tag>
                            <Tag>
                                Q {session.currentIndex + 1} / {questions.length}
                            </Tag>
                            <Tag color="geekblue">Progress: {progressPct}%</Tag>
                            <Tag>
                                Timer: {resolved.mode === 'none' ? 'Off' : resolved.mode === 'overall' ? 'Overall' : 'Per Question'}
                            </Tag>
                            {maxAttempts !== null && attemptCount >= maxAttempts ? <Tag color="red">No attempts left</Tag> : null}
                        </Space>
                    </Space>

                    {(showOverall || showPerQ) && (
                        <Card size="small" style={{ borderRadius: 12 }}>
                            <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                {showOverall && (
                                    <div>
                                        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                                            <Text strong>Overall time left</Text>
                                            <Tag color={overallRemaining! <= 30 ? 'red' : 'default'}>{secondsToClock(overallRemaining!)}</Tag>
                                        </Space>
                                        {overallPct !== null && <Progress percent={overallPct} showInfo={false} />}
                                    </div>
                                )}

                                {showPerQ && (
                                    <div>
                                        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                                            <Text strong>Question time left</Text>
                                            <Tag color={effectiveQuestionRemaining! <= 10 ? 'red' : 'default'}>{secondsToClock(effectiveQuestionRemaining!)}</Tag>
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
                                    {resolved.mode === 'per_question' && (
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
                                    No back navigation. {resolved.mode === 'overall' ? 'Overall timing is enforced.' : 'Per-question timing is enforced.'}
                                </Text>

                                <Space>
                                    <Button disabled={submitting || finalizingRef.current || finalizedRef.current} onClick={handleExit}>
                                        Exit
                                    </Button>

                                    <Button
                                        type="primary"
                                        loading={submitting}
                                        disabled={submitting || finalizingRef.current || finalizedRef.current}
                                        onClick={handleNext}
                                    >
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
