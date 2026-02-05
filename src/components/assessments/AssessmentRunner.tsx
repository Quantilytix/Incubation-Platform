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
import {
    doc,
    getDoc,
    addDoc,
    collection,
    updateDoc,
    increment,
    serverTimestamp,
    runTransaction
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { LoadingOverlay } from '../shared/LoadingOverlay'

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
    attemptStarted: boolean
}

type SubmitTrigger = 'manual_submit' | 'overall_timeout' | 'per_question_timeout' | 'user_exit'

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

    // guards
    const attemptRegisteringRef = useRef(false)
    const attemptStartLockRef = useRef(false)

    // FINALIZATION HARD-LOCKS (fixes modal looping + glitch)
    const finalizingRef = useRef(false)
    const finalizedRef = useRef(false)

    const [showSubmittedResult, setShowSubmittedResult] = useState(false)
    const [submittedTrigger, setSubmittedTrigger] = useState<SubmitTrigger>('manual_submit')

    useEffect(() => {
        attemptStartLockRef.current = false
        finalizingRef.current = false
        finalizedRef.current = false
        Modal.destroyAll()
    }, [requestId])

    // ensure cleanup
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

                // attempts enforcement (IMPORTANT: allow resume when status is in_progress)
                const maxAttemptsRaw = r.maxAttempts ?? meta.maxAttempts
                const maxAttempts = typeof maxAttemptsRaw === 'number' && maxAttemptsRaw > 0 ? Math.floor(maxAttemptsRaw) : null

                const attemptCount = Number(r.attemptCount || 0)
                const status = String(r.status || '').toLowerCase()
                const isInProgress = status === 'in_progress'

                // block only if not in progress
                if (maxAttempts !== null && attemptCount >= maxAttempts && !isInProgress) {
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
    const questions = useMemo(() => (tpl?.fields || []).filter(f => f.type !== 'heading'), [tpl])

    // -----------------------------
    // Resolve timing mode + limits
    // -----------------------------
    const resolvedTiming = useMemo(() => {
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

        const initialOverall = resolvedTiming.mode === 'overall' && resolvedTiming.overallSeconds > 0 ? resolvedTiming.overallSeconds : null

        const firstQ = questions[0]
        const initialPerQ =
            resolvedTiming.mode === 'per_question'
                ? (() => {
                    const sec = clampInt(firstQ?.timeLimitSeconds ?? 0, 0, 60 * 60)
                    if (sec > 0) return sec
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
    }, [requestId, tpl, reqDoc, questions, resolvedTiming.mode, resolvedTiming.overallSeconds, resolvedTiming.legacyPerQ])

    // -----------------------------
    // Persist session
    // -----------------------------
    useEffect(() => {
        if (!requestId || !session) return
        localStorage.setItem(lsKey(requestId), JSON.stringify(session))
    }, [requestId, session])

    // -----------------------------
    // Mark in_progress + increment attemptCount ON FIRST OPEN (once)
    // -----------------------------
    useEffect(() => {
        ; (async () => {
            if (!requestId || !reqDoc) return
            if (!session) return
            if (attemptStartLockRef.current) return
            if (session.attemptStarted) return
            if (finalizingRef.current || finalizedRef.current) return

            attemptStartLockRef.current = true

            setSession(prev => (prev ? { ...prev, attemptStarted: true } : prev))

            try {
                const rRef = doc(db, 'formRequests', requestId)
                await updateDoc(rRef, {
                    status: 'in_progress',
                    attemptCount: increment(1),
                    attemptStartedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })

                setReqDoc(prev =>
                    prev
                        ? {
                            ...prev,
                            status: 'in_progress',
                            attemptCount: Number(prev.attemptCount || 0) + 1
                        }
                        : prev
                )
            } catch (e) {
                console.error(e)
                message.warning('Could not register attempt start. Please check connectivity.')
            }
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestId, reqDoc?.templateId, session?.startedAtMs])

    // -----------------------------
    // Helpers
    // -----------------------------
    const currentQ = useMemo(() => {
        if (!session) return null
        return questions[session.currentIndex] || null
    }, [session, questions])

    const computePerQLimitForIndex = (index: number) => {
        const q = questions[index]
        if (!q) return null
        const secField = clampInt(q.timeLimitSeconds ?? 0, 0, 60 * 60)
        if (secField > 0) return secField
        return resolvedTiming.legacyPerQ > 0 ? resolvedTiming.legacyPerQ : null
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

    const requiredUnansweredWarning = useMemo(() => {
        if (!session || !currentQ) return false
        if (!currentQ.required) return false
        const v = session.answers[currentQ.id]
        if (v === undefined || v === null) return true
        if (typeof v === 'string' && v.trim() === '') return true
        if (Array.isArray(v) && v.length === 0) return true
        return false
    }, [session, currentQ])

    const isAnswered = (val: any) => {
        if (val === undefined || val === null) return false
        if (typeof val === 'string' && val.trim() === '') return false
        if (Array.isArray(val) && val.length === 0) return false
        return true
    }

    // -----------------------------
    // Submit / finalize (single-fire)
    // -----------------------------
    const ensureAttemptRegistered = async (): Promise<number | null> => {
        if (!requestId) return null
        if (!reqDoc) return null
        if (!session) return null

        if (finalizedRef.current) return Number(reqDoc.attemptCount || 0)

        // If UI already knows attempt was registered AND reqDoc shows it, skip.
        if (session.attemptStarted && Number(reqDoc.attemptCount || 0) > 0) return Number(reqDoc.attemptCount || 0)

        if (attemptRegisteringRef.current) return Number(reqDoc.attemptCount || 0)
        attemptRegisteringRef.current = true

        try {
            const rRef = doc(db, 'formRequests', requestId)

            const nextCount = await runTransaction(db, async tx => {
                const snap = await tx.get(rRef)
                if (!snap.exists()) throw new Error('Request no longer exists')

                const data = snap.data() as any
                const status = String(data.status || '').toLowerCase()

                // If already submitted, do not consume/modify attempts
                if (status === 'submitted') return Number(data.attemptCount || 0)

                const current = Number(data.attemptCount || 0)
                const updated = current + 1

                tx.update(rRef, {
                    status: 'in_progress',
                    attemptCount: updated,
                    attemptStartedAt: data.attemptStartedAt || serverTimestamp(),
                    updatedAt: serverTimestamp()
                })

                return updated
            })

            setSession(prev => (prev ? { ...prev, attemptStarted: true } : prev))
            setReqDoc(prev => (prev ? { ...prev, status: 'in_progress', attemptCount: nextCount } : prev))

            return nextCount
        } catch (e) {
            console.error('[ensureAttemptRegistered] failed:', e)
            message.error('Could not register attempt. Check permissions / connectivity.')
            return null
        } finally {
            attemptRegisteringRef.current = false
        }
    }

    const submitResponse = async (s: SessionState, trigger: SubmitTrigger) => {
        if (!tpl || !reqDoc || !requestId) return

        const unanswered = new Set<string>(s.unanswered || [])
        for (const q of questions) {
            if (!isAnswered(s.answers[q.id])) unanswered.add(q.id)
        }

        const durationSec = Math.max(1, Math.floor((Date.now() - s.startedAtMs) / 1000))

        const atEnd = s.currentIndex >= questions.length - 1
        const leftMidway =
            trigger === 'user_exit'
                ? true
                : trigger === 'overall_timeout' || trigger === 'per_question_timeout'
                    ? !atEnd || unanswered.size > 0
                    : unanswered.size > 0

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
                leftMidway,
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
                timingMode: resolvedTiming.mode,
                overallTimeSeconds: resolvedTiming.mode === 'overall' ? resolvedTiming.overallSeconds || null : null,
                perQuestionLimits:
                    resolvedTiming.mode === 'per_question'
                        ? questions.reduce((acc: any, q) => {
                            const lim = clampInt(q.timeLimitSeconds ?? 0, 0, 60 * 60)
                            if (lim > 0) acc[q.id] = lim
                            return acc
                        }, {})
                        : {}
            }
        })

        await updateDoc(doc(db, 'formRequests', requestId), {
            status: 'submitted',
            submittedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            leftMidway
        })

        localStorage.removeItem(lsKey(requestId))
    }

    const finalize = async (stateOverride?: SessionState, trigger: SubmitTrigger = 'manual_submit') => {
        const s = stateOverride || session
        if (!s || !tpl || !reqDoc || !requestId) return

        if (finalizingRef.current || finalizedRef.current) return
        finalizingRef.current = true

        // stop timers + kill any modals
        if (tickRef.current) {
            clearInterval(tickRef.current)
            tickRef.current = null
        }
        Modal.destroyAll()

        setSubmitting(true)
        try {
            await ensureAttemptRegistered()
            await submitResponse(s, trigger)

            finalizedRef.current = true
            Modal.destroyAll()

            // If user EXITED, don't show Result screen — just leave (or toast)
            if (trigger === 'user_exit') {
                message.info('Saved & submitted (incomplete).')
                navigate(-1)
                return
            }

            // If actually submitted/completed, show Result screen
            setSubmittedTrigger(trigger)
            setShowSubmittedResult(true)
        } catch (e) {
            console.error(e)
            message.error('Failed to submit assessment.')
            finalizingRef.current = false // allow retry only on failure
        } finally {
            setSubmitting(false)
        }
    }


    // -----------------------------
    // Timers (wall clock)
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
    // Answer setter
    // -----------------------------
    const setAnswer = (fieldId: string, value: any) => {
        setSession(prev => {
            if (!prev) return prev
            return { ...prev, answers: { ...prev.answers, [fieldId]: value } }
        })
    }

    // -----------------------------
    // Navigation
    // -----------------------------
    const handleNext = () => {
        if (!session || !currentQ) return
        if (finalizingRef.current || finalizedRef.current) return

        if (currentQ.required) {
            const v = session.answers[currentQ.id]
            const missing = !isAnswered(v)
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
                remainingQuestionSec: resolvedTiming.mode === 'per_question' ? computePerQLimitForIndex(nextIndex) : null,
                lastTickAtMs: Date.now()
            }
        })
    }

    // -----------------------------
    // Exit behaviour (resume vs forced submit)
    // -----------------------------
    const handleExit = () => {
        if (!reqDoc || !session) {
            navigate(-1)
            return
        }
        if (finalizingRef.current || finalizedRef.current) return

        const maxAttempts = resolvedTiming.maxAttempts
        const attemptCountDb = Number(reqDoc.attemptCount || 0)

        // If maxAttempts exists, exiting should ALWAYS submit (since attempts are limited)
        // so user can't "pause" a 1-attempt assessment and come back later.
        const mustFinalizeOnExit = maxAttempts !== null

        Modal.confirm({
            title: 'Exit assessment?',
            width: 620,
            icon: null,
            okText: mustFinalizeOnExit ? 'Exit & Submit' : 'Exit',
            cancelText: 'Continue',
            okButtonProps: mustFinalizeOnExit ? { danger: true } : undefined,
            content: (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Alert
                        type="info"
                        showIcon
                        message="Progress saved"
                        description="Your progress is saved on this device."
                        style={{ width: '100%', margin: 0 }}
                    />

                    {mustFinalizeOnExit ? (
                        <Alert
                            type="warning"
                            showIcon
                            message="Limited attempts — exiting will submit"
                            description={
                                <span style={{ display: 'block', lineHeight: 1.45 }}>
                                    This assessment has limited attempts ({Math.min(attemptCountDb + (session.attemptStarted ? 0 : 1), maxAttempts)}/{maxAttempts}).
                                    If you exit now, your current answers will be <b>submitted automatically</b> and marked as <b>left mid-way</b>.
                                    You may not be able to reopen it.
                                </span>
                            }
                            style={{ width: '100%', margin: 0 }}
                        />
                    ) : (
                        <Alert
                            type="success"
                            showIcon
                            message="You can continue later"
                            description={
                                <span style={{ display: 'block', lineHeight: 1.45 }}>
                                    You can exit now and return later to continue, as long as the assessment remains open and unsubmitted.
                                </span>
                            }
                            style={{ width: '100%', margin: 0 }}
                        />
                    )}
                </Space>
            ),
            onOk: () => {
                if (!mustFinalizeOnExit) {
                    navigate(-1)
                    return
                }
                return finalize(session, 'user_exit')
            }
        })
    }

    // -----------------------------
    // Render by type
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

    const overallPct =
        showOverall && resolvedTiming.overallSeconds > 0 && typeof overallRemaining === 'number'
            ? Math.round((Math.max(0, overallRemaining) / resolvedTiming.overallSeconds) * 100)
            : null

    const perQPct =
        showPerQ && typeof effectiveQuestionRemaining === 'number'
            ? (() => {
                const lim = computePerQLimitForIndex(session.currentIndex)
                if (!lim || lim <= 0) return null
                return Math.round((Math.max(0, effectiveQuestionRemaining) / lim) * 100)
            })()
            : null

    if (showSubmittedResult) {
        return (
            <div style={{ padding: 24, minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
                <Result
                    status="success"
                    title="Submitted"
                    subTitle="Your assessment has been submitted."
                    extra={[
                        <Button type="primary" key="back" onClick={() => navigate(-1)}>
                            Back
                        </Button>
                    ]}
                />
            </div>
        )
    }


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
                            <Tag color="blue">Attempt: {attemptLabel}</Tag>
                            <Tag>
                                Q {session.currentIndex + 1} / {questions.length}
                            </Tag>
                            <Tag color="geekblue">Progress: {progressPct}%</Tag>
                            <Tag>
                                Timer:{' '}
                                {resolvedTiming.mode === 'none' ? 'Off' : resolvedTiming.mode === 'overall' ? 'Overall' : 'Per Question'}
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
                                            <Tag color={overallRemaining! <= 30 ? 'red' : 'default'}>{secondsToClock(overallRemaining!)}</Tag>
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
                                            Limit:{' '}
                                            {computePerQLimitForIndex(session.currentIndex) ? `${computePerQLimitForIndex(session.currentIndex)}s` : '—'}
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
                                    No back navigation. {resolvedTiming.mode === 'overall' ? 'Overall timing is enforced.' : 'You can finish all questions without being “logged out”.'}
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
