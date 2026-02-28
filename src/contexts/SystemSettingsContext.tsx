// contexts/SystemSettingsContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Unsubscribe
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'

type AnyDoc = Record<string, any>

export type SystemSettingDoc = {
  id: string
  companyCode?: string
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

const normalize = (raw: DocumentData, id: string): SystemSettingDoc => {
  const r = { id, ...(raw || {}) } as SystemSettingDoc
  if (!('programId' in r)) r.programId = null
  return r
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

  const baseQuery = useMemo(() => {
    if (!companyCode) return null
    return query(collection(db, 'systemSettings'), where('companyCode', '==', companyCode))
  }, [companyCode])

  useEffect(() => {
    if (!baseQuery) {
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
        baseQuery,
        snap => {
          const next = snap.docs.map(d => normalize(d.data() as any, d.id))
          setItems(next)
          setLoading(false)
          if (debug) console.log('[SystemSettingsProvider] snapshot rows:', next.length)
        },
        e => {
          setLoading(false)
          setError(e?.message || 'Failed to load system settings')
          if (debug) console.log('[SystemSettingsProvider] snapshot error:', e)
        }
      )
    } catch (e: any) {
      setLoading(false)
      setError(e?.message || 'Failed to initialize system settings feed')
      if (debug) console.log('[SystemSettingsProvider] init failed:', e)
    }

    return () => {
      try {
        unsub?.()
      } catch {
        // noop
      }
    }
  }, [baseQuery, debug])

  const filteredItems = useMemo(() => {
    if (!programId) return items

    // Allow both: global settings (no programId) + program-specific ones
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
    if (!baseQuery) return
    setLoading(true)
    setError(undefined)
    try {
      const snap = await getDocs(baseQuery)
      const next = snap.docs.map(d => normalize(d.data() as any, d.id))
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
