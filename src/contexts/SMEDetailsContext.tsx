import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
    type DocumentData,
    type Timestamp,
    type Unsubscribe
} from 'firebase/firestore'
import { db } from '@/firebase'

type AnyDoc = Record<string, any>

type MonthHistoryDoc = {
    month?: string
    createdAt?: Timestamp | string
    revenue?: number
    customers?: number
    orders?: number
    traffic?: number
    networking?: number
    headPermanent?: number
    headTemporary?: number
    employeeProofUrls?: string[]
    revenueProofUrls?: string[]
    employeeProofMeta?: any
    revenueProofMeta?: any
} & AnyDoc

export type SMEDetailsRecord = {
    participantId: string
    user: (AnyDoc & { id: string }) | null

    participant: (AnyDoc & { id: string }) | null
    latestApplication: (AnyDoc & { id: string }) | null

    monthlyHistory: (MonthHistoryDoc & { id: string })[]
    latestMonthly: (MonthHistoryDoc & { id: string }) | null

    // derived convenience fields
    beneficiaryName: string | null
    sector: string | null
    email: string | null
    gender: string | null
    blackOwnedPercent: number | null
    femaleOwnedPercent: number | null

    acceptedAt: string | null
    applicationStatus: string | null
    programId: string | null
    programName: string | null
    companyCode: string | null

    loading: boolean
    errors: { user?: string; participant?: string; application?: string; monthlyHistory?: string; latestMonthly?: string }
    lastUpdatedAt: number
}

type SMEDetailsContextValue = {
    selectedParticipantId: string | null
    selected: SMEDetailsRecord | null

    selectSME: (participantId: string | null) => void
    prefetchSME: (participantId: string) => Promise<void>
    clearCache: (participantId?: string) => void
    getCached: (participantId: string) => SMEDetailsRecord | null
}

const SMEDetailsContext = createContext<SMEDetailsContextValue | null>(null)

export const useSMEDetails = () => {
    const ctx = useContext(SMEDetailsContext)
    if (!ctx) throw new Error('useSMEDetails must be used within SMEDetailsProvider')
    return ctx
}

// Collections
const PARTICIPANTS_COL = 'participants'
const APPLICATIONS_COL = 'applications'
const MONTHLY_PERF_COL = 'monthlyPerformance'
const USERS_COL = 'users'

function getLikelyAuthUid(p: AnyDoc | null): string | null {
    if (!p) return null
    const cands = [p.authUid, p.uid, p.userId, p.userUid, p.authId].filter(v => typeof v === 'string' && v.trim())
    return (cands[0] as string) || null
}

function toMillis(v: any): number {
    if (!v) return 0
    if (typeof v === 'string') {
        const t = Date.parse(v)
        return Number.isFinite(t) ? t : 0
    }
    if (typeof v?.toMillis === 'function') return v.toMillis()
    const seconds = v?._seconds
    if (typeof seconds === 'number') return seconds * 1000
    return 0
}

function sortByCreatedAtDesc<T extends { createdAt?: any }>(a: T, b: T) {
    return toMillis(b.createdAt) - toMillis(a.createdAt)
}

export const SMEDetailsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null)
    const [selected, setSelected] = useState<SMEDetailsRecord | null>(null)

    const cacheRef = useRef<Map<string, SMEDetailsRecord>>(new Map())
    const activeUnsubsRef = useRef<Unsubscribe[]>([])

    const stopActiveSubs = () => {
        activeUnsubsRef.current.forEach(u => {
            try {
                u()
            } catch {
                // noop
            }
        })
        activeUnsubsRef.current = []
    }

    const ensureShell = (participantId: string) => {
        const existing = cacheRef.current.get(participantId)
        if (existing) return existing

        const shell: SMEDetailsRecord = {
            participantId,
            participant: null,
            latestApplication: null,
            user: null,

            monthlyHistory: [],
            latestMonthly: null,

            beneficiaryName: null,
            sector: null,
            email: null,
            gender: null,
            blackOwnedPercent: null,
            femaleOwnedPercent: null,

            acceptedAt: null,
            applicationStatus: null,
            programId: null,
            programName: null,
            companyCode: null,

            loading: true,
            errors: {},
            lastUpdatedAt: Date.now()
        }

        cacheRef.current.set(participantId, shell)
        return shell
    }

    const buildNext = (participantId: string, patch: Partial<SMEDetailsRecord>) => {
        const curr = cacheRef.current.get(participantId) || ensureShell(participantId)

        const participant = patch.participant !== undefined ? patch.participant : curr.participant
        const latestApplication = patch.latestApplication !== undefined ? patch.latestApplication : curr.latestApplication
        const monthlyHistory = patch.monthlyHistory !== undefined ? patch.monthlyHistory : curr.monthlyHistory
        const latestMonthly = patch.latestMonthly !== undefined ? patch.latestMonthly : curr.latestMonthly
        const userDoc = patch.user !== undefined ? patch.user : curr.user

        const beneficiaryName =
            latestApplication?.beneficiaryName || participant?.beneficiaryName || curr.beneficiaryName || null

        const sector = participant?.sector ?? curr.sector ?? null
        const email = participant?.email || latestApplication?.email || curr.email || null
        const gender = participant?.gender || latestApplication?.gender || curr.gender || null

        const blackOwnedPercent =
            typeof participant?.blackOwnedPercent === 'number' ? participant.blackOwnedPercent : curr.blackOwnedPercent

        const femaleOwnedPercent =
            typeof participant?.femaleOwnedPercent === 'number' ? participant.femaleOwnedPercent : curr.femaleOwnedPercent

        const acceptedAt =
            typeof latestApplication?.acceptedAt === 'string' ? latestApplication.acceptedAt : curr.acceptedAt

        const applicationStatus =
            typeof latestApplication?.applicationStatus === 'string'
                ? latestApplication.applicationStatus
                : curr.applicationStatus

        const programId = typeof latestApplication?.programId === 'string' ? latestApplication.programId : curr.programId
        const programName =
            typeof latestApplication?.programName === 'string' ? latestApplication.programName : curr.programName

        const companyCode =
            typeof latestApplication?.companyCode === 'string'
                ? latestApplication.companyCode
                : participant?.companyCode || curr.companyCode || null

        const next: SMEDetailsRecord = {
            ...curr,
            ...patch,

            participant,
            latestApplication,
            user: userDoc,

            monthlyHistory,
            latestMonthly,

            beneficiaryName,
            sector,
            email,
            gender,
            blackOwnedPercent: blackOwnedPercent ?? null,
            femaleOwnedPercent: femaleOwnedPercent ?? null,

            acceptedAt: acceptedAt ?? null,
            applicationStatus: applicationStatus ?? null,
            programId: programId ?? null,
            programName: programName ?? null,
            companyCode: companyCode ?? null,

            lastUpdatedAt: Date.now()
        }

        cacheRef.current.set(participantId, next)
        if (selectedParticipantId === participantId) setSelected(next)
    }

    const subscribeSelected = (participantId: string) => {
        stopActiveSubs()
        const shell = ensureShell(participantId)
        buildNext(participantId, { loading: true })

        let userUnsub: Unsubscribe | null = null
        const stopUserSub = () => {
            if (!userUnsub) return
            try { userUnsub() } catch { /* noop */ }
            userUnsub = null
        }
        activeUnsubsRef.current.push(stopUserSub)

        // participants/{participantId}
        activeUnsubsRef.current.push(
            onSnapshot(
                doc(db, PARTICIPANTS_COL, participantId),
                snap => {
                    const participant = snap.exists() ? ({ id: snap.id, ...(snap.data() as DocumentData) } as any) : null
                    const curr = cacheRef.current.get(participantId) || shell

                    // update participant first
                    buildNext(participantId, {
                        participant,
                        loading: false,
                        errors: { ...curr.errors, participant: undefined }
                    })

                    // user doc lookup (photoURL etc)
                    stopUserSub()

                    const authUid = getLikelyAuthUid(participant)
                    const email =
                        (typeof participant?.email === 'string' && participant.email) ||
                        (typeof curr.email === 'string' && curr.email) ||
                        null

                    if (authUid) {
                        userUnsub = onSnapshot(
                            doc(db, USERS_COL, authUid),
                            uSnap => {
                                const userDoc = uSnap.exists() ? ({ id: uSnap.id, ...(uSnap.data() as DocumentData) } as any) : null
                                const curr2 = cacheRef.current.get(participantId) || shell
                                buildNext(participantId, {
                                    user: userDoc,
                                    errors: { ...curr2.errors, user: undefined }
                                })
                            },
                            err => {
                                const curr2 = cacheRef.current.get(participantId) || shell
                                buildNext(participantId, {
                                    user: null,
                                    errors: { ...curr2.errors, user: err?.message || 'Failed to load user' }
                                })
                            }
                        )
                        return
                    }

                    if (email) {
                        const uq = query(collection(db, USERS_COL), where('email', '==', email), limit(1))
                        userUnsub = onSnapshot(
                            uq,
                            uSnap => {
                                const d = uSnap.docs[0]
                                const userDoc = d ? ({ id: d.id, ...(d.data() as DocumentData) } as any) : null
                                const curr2 = cacheRef.current.get(participantId) || shell
                                buildNext(participantId, {
                                    user: userDoc,
                                    errors: { ...curr2.errors, user: undefined }
                                })
                            },
                            err => {
                                const curr2 = cacheRef.current.get(participantId) || shell
                                buildNext(participantId, {
                                    user: null,
                                    errors: { ...curr2.errors, user: err?.message || 'Failed to load user (email lookup)' }
                                })
                            }
                        )
                    }
                },
                err => {
                    const curr = cacheRef.current.get(participantId) || shell
                    buildNext(participantId, {
                        loading: false,
                        errors: { ...curr.errors, participant: err?.message || 'Failed to load participant' }
                    })
                }
            )
        )

        // latest application by participantId
        const appsQ = query(
            collection(db, APPLICATIONS_COL),
            where('participantId', '==', participantId),
            orderBy('submittedAt', 'desc'),
            limit(1)
        )

        activeUnsubsRef.current.push(
            onSnapshot(
                appsQ,
                snap => {
                    const d = snap.docs[0]
                    const latestApplication = d ? ({ id: d.id, ...(d.data() as DocumentData) } as any) : null
                    const curr = cacheRef.current.get(participantId) || shell
                    buildNext(participantId, {
                        latestApplication,
                        loading: false,
                        errors: { ...curr.errors, application: undefined }
                    })
                },
                err => {
                    const curr = cacheRef.current.get(participantId) || shell
                    buildNext(participantId, {
                        loading: false,
                        errors: { ...curr.errors, application: err?.message || 'Failed to load application' }
                    })
                }
            )
        )

        // monthlyPerformance/{participantId}/history (latest + full list)
        const histCol = collection(db, MONTHLY_PERF_COL, participantId, 'history')

        // Full list (sorted in-memory for safety)
        const histQ = query(histCol, orderBy('createdAt', 'desc'))
        activeUnsubsRef.current.push(
            onSnapshot(
                histQ,
                snap => {
                    const monthlyHistory = snap.docs
                        .map(d => ({ id: d.id, ...(d.data() as DocumentData) } as any))
                        .sort(sortByCreatedAtDesc)

                    const latestMonthly = monthlyHistory[0] || null

                    const curr = cacheRef.current.get(participantId) || shell
                    buildNext(participantId, {
                        monthlyHistory,
                        latestMonthly,
                        loading: false,
                        errors: { ...curr.errors, monthlyHistory: undefined, latestMonthly: undefined }
                    })
                },
                err => {
                    const curr = cacheRef.current.get(participantId) || shell
                    buildNext(participantId, {
                        loading: false,
                        errors: { ...curr.errors, monthlyHistory: err?.message || 'Failed to load monthly history' }
                    })
                }
            )
        )
    }

    const selectSME = (participantId: string | null) => {
        setSelectedParticipantId(participantId)

        if (!participantId) {
            stopActiveSubs()
            setSelected(null)
            return
        }

        setSelected(cacheRef.current.get(participantId) || ensureShell(participantId))
        subscribeSelected(participantId)
    }

    const prefetchSME = async (participantId: string) => {
        const shell = ensureShell(participantId)
        buildNext(participantId, { loading: true })

        try {
            const pSnap = await getDoc(doc(db, PARTICIPANTS_COL, participantId))
            const participant = pSnap.exists() ? ({ id: pSnap.id, ...(pSnap.data() as any) } as any) : null

            const appsQ = query(
                collection(db, APPLICATIONS_COL),
                where('participantId', '==', participantId),
                orderBy('submittedAt', 'desc'),
                limit(1)
            )
            const aSnap = await getDocs(appsQ)
            const aDoc = aSnap.docs[0]
            const latestApplication = aDoc ? ({ id: aDoc.id, ...(aDoc.data() as any) } as any) : null

            const histCol = collection(db, MONTHLY_PERF_COL, participantId, 'history')
            const histQ = query(histCol, orderBy('createdAt', 'desc'), limit(50))
            const hSnap = await getDocs(histQ)
            const monthlyHistory = hSnap.docs
                .map(d => ({ id: d.id, ...(d.data() as any) } as any))
                .sort(sortByCreatedAtDesc)

            buildNext(participantId, {
                participant,
                latestApplication,
                monthlyHistory,
                latestMonthly: monthlyHistory[0] || null,
                loading: false,
                errors: {}
            })
        } catch (e: any) {
            const curr = cacheRef.current.get(participantId) || shell
            buildNext(participantId, {
                loading: false,
                errors: { ...curr.errors, participant: e?.message || 'Prefetch failed' }
            })
        }
    }

    const clearCache = (participantId?: string) => {
        if (participantId) {
            cacheRef.current.delete(participantId)
            if (selectedParticipantId === participantId) setSelected(null)
            return
        }
        cacheRef.current.clear()
        setSelected(null)
    }

    const getCached = (participantId: string) => cacheRef.current.get(participantId) || null

    useEffect(() => {
        return () => stopActiveSubs()
    }, [])

    const value = useMemo<SMEDetailsContextValue>(
        () => ({
            selectedParticipantId,
            selected,
            selectSME,
            prefetchSME,
            clearCache,
            getCached
        }),
        [selectedParticipantId, selected]
    )

    return <SMEDetailsContext.Provider value={value}>{children}</SMEDetailsContext.Provider>
}
