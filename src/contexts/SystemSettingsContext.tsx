// contexts/SystemSettingsContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
    doc,
    getDoc,
    onSnapshot,
    type DocumentData,
    type Unsubscribe
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'

type AnyDoc = Record<string, any>

export type SystemSettingDoc = {
    id: string
    programId?: string | null
    key?: string
    name?: string
    value?: any
} & AnyDoc

type Ctx = {
    companyCode?: string
    programId?: string
    loading: boolean
    error?: string
    items: SystemSettingDoc[]
    byKey: Record<string, SystemSettingDoc>
    getSetting: <T = any>(key: string, fallback?: T) => T
    refresh: () => Promise<void>
}

const SystemSettingsContext = createContext<Ctx | null>(null)

export const useSystemSettings = () => {
    const ctx = useContext(SystemSettingsContext)
    if (!ctx) throw new Error('useSystemSettings must be used within SystemSettingsProvider')
    return ctx
}

const pickKey = (r: SystemSettingDoc) => String(r.key ?? r.name ?? r.id ?? '').trim()

const normalizeItem = (raw: AnyDoc, id: string): SystemSettingDoc => {
    const r = { id, ...(raw || {}) } as SystemSettingDoc
    if (!('programId' in r)) r.programId = null
    return r
}

const isPlainObject = (v: any) =>
    !!v && typeof v === 'object' && !Array.isArray(v)

const toItemsFromDoc = (data: DocumentData | undefined, companyCode: string): SystemSettingDoc[] => {
    if (!data) return []

    // Shape A: { items: [...] }
    if (Array.isArray((data as any).items)) {
        return (data as any).items
            .filter(Boolean)
            .map((x: any, i: number) => normalizeItem(x, String(x?.id || x?.key || x?.name || `item_${i}`)))
    }

    // Shape B: { settings: { key: value, ... } }
    if (isPlainObject((data as any).settings)) {
        const settings = (data as any).settings as Record<string, any>
        return Object.entries(settings).map(([k, v]) =>
            normalizeItem({ key: k, value: v, programId: null }, k)
        )
    }

    // Shape C: settings stored directly on doc fields (exclude known meta fields)
    const META = new Set([
        'companyCode',
        'createdAt',
        'updatedAt',
        'created_by',
        'updated_by',
        'items',
        'settings'
    ])

    return Object.entries(data)
        .filter(([k]) => !META.has(k))
        .map(([k, v]) => normalizeItem({ key: k, value: v, programId: null }, k))
}

export const SystemSettingsProvider: React.FC<{
    children: React.ReactNode
    programId?: string
    debug?: boolean
}> = ({ children, programId, debug = false }) => {
    const { user } = useFullIdentity()
    const companyCode = user?.companyCode

    const [items, setItems] = useState<SystemSettingDoc[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | undefined>(undefined)

    const docRef = useMemo(() => {
        if (!companyCode) return null
        return doc(db, 'systemSettings', String(companyCode))
    }, [companyCode])

    useEffect(() => {
        if (!docRef || !companyCode) {
            setItems([])
            setLoading(false)
            setError(undefined)
            return
        }

        setLoading(true)
        setError(undefined)

        let unsub: Unsubscribe | null = null

        try {
            unsub = onSnapshot(
                docRef,
                snap => {
                    const data = snap.exists() ? snap.data() : undefined
                    const next = toItemsFromDoc(data, String(companyCode))

                    if (debug) {
                        console.group('[SystemSettingsProvider] doc snapshot')
                        console.log('companyCode:', companyCode)
                        console.log('exists:', snap.exists())
                        console.log('items:', next.length)
                        console.log('keys:', next.map(x => pickKey(x)))
                        console.groupEnd()
                    }

                    setItems(next)
                    setLoading(false)
                },
                e => {
                    if (debug) console.log('[SystemSettingsProvider] snapshot error:', e)
                    setLoading(false)
                    setError(e?.message || 'Failed to load system settings')
                }
            )
        } catch (e: any) {
            if (debug) console.log('[SystemSettingsProvider] init failed:', e)
            setLoading(false)
            setError(e?.message || 'Failed to initialize system settings feed')
        }

        return () => {
            try {
                unsub?.()
            } catch {
                // noop
            }
        }
    }, [docRef, companyCode, debug])

    const filteredItems = useMemo(() => {
        if (!programId) return items
        return items.filter(r => {
            const pid = typeof r.programId === 'string' ? r.programId : null
            return !pid || pid === programId
        })
    }, [items, programId])

    const byKey = useMemo(() => {
        const out: Record<string, SystemSettingDoc> = {}
        for (const r of filteredItems) {
            const k = pickKey(r)
            if (!k) continue
            out[k] = r
        }
        return out
    }, [filteredItems])

    const getSetting = useMemo(() => {
        return <T,>(key: string, fallback?: T): T => {
            const k = String(key ?? '').trim()
            const row = byKey[k]
            if (!row) return fallback as T
            if ('value' in row) return row.value as T
            return (row as any) as T
        }
    }, [byKey])

    const refresh = async () => {
        if (!docRef || !companyCode) return
        setLoading(true)
        setError(undefined)
        try {
            const snap = await getDoc(docRef)
            const data = snap.exists() ? snap.data() : undefined
            const next = toItemsFromDoc(data, String(companyCode))
            setItems(next)
            setLoading(false)
        } catch (e: any) {
            setLoading(false)
            setError(e?.message || 'Failed to refresh system settings')
        }
    }

    const value = useMemo<Ctx>(
        () => ({
            companyCode,
            programId,
            loading,
            error,
            items: filteredItems,
            byKey,
            getSetting,
            refresh
        }),
        [companyCode, programId, loading, error, filteredItems, byKey, getSetting]
    )

    return <SystemSettingsContext.Provider value={value}>{children}</SystemSettingsContext.Provider>
}
