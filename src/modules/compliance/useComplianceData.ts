// src/modules/compliance/useComplianceData.ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where
} from 'firebase/firestore'
import { db } from '@/firebase'
import dayjs from 'dayjs'
import {
  RawComplianceDoc,
  ParticipantComplianceSummary,
  aggregateGlobalStats,
  buildParticipantSummary
} from './complianceLogic'

type AppDoc = {
  participantId: string
  beneficiaryName?: string
  companyCode?: string
  applicationStatus?: string
  complianceDocuments?: RawComplianceDoc[]
}

type ParticipantDoc = {
  beneficiaryName?: string
  email?: string
  phone?: string
  contactNumber?: string
}

export const useComplianceData = (companyCode?: string) => {
  const [loading, setLoading] = useState(true)
  const [participants, setParticipants] = useState<ParticipantComplianceSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!companyCode) return
    setLoading(true)
    setError(null)

    try {
      // 1) Applications (accepted, scoped)
      const appsSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('companyCode', '==', companyCode),
          where('applicationStatus', '==', 'accepted')
        )
      )

      const apps: Array<{ appId: string; data: AppDoc }> = appsSnap.docs.map(d => ({
        appId: d.id,
        data: d.data() as any
      }))

      // 2) Collect participantIds in scope
      const participantIds = Array.from(
        new Set(apps.map(a => a.data.participantId).filter(Boolean))
      ) as string[]

      // 3) Fetch only needed participants (fallback: if you don't have a participants companyCode index)
      // If you DO store companyCode on participants, replace this with a scoped query.
      const participantsSnap = await getDocs(collection(db, 'participants'))
      const participantMap = participantsSnap.docs.reduce((acc, d) => {
        acc[d.id] = d.data() as ParticipantDoc
        return acc
      }, {} as Record<string, ParticipantDoc>)

      // 4) Build participant summaries
      const now = dayjs()
      const built: ParticipantComplianceSummary[] = apps.map(a => {
        const pId = a.data.participantId
        const p = participantMap[pId] || {}
        const beneficiaryName =
          a.data.beneficiaryName ||
          p.beneficiaryName ||
          'Unknown'

        const rawDocs = (a.data.complianceDocuments || []).map((cd: any) => ({
          ...cd,
          participantId: pId,
          beneficiaryName
        }))

        return buildParticipantSummary({
          participantId: pId,
          beneficiaryName,
          email: p.email,
          phone: p.phone || p.contactNumber,
          rawDocs,
          now
        })
      })

      // Remove duplicates (in case multiple apps per participant)
      const dedup = new Map<string, ParticipantComplianceSummary>()
      for (const p of built) {
        const existing = dedup.get(p.participantId)
        if (!existing) dedup.set(p.participantId, p)
        else {
          // merge docs if needed
          dedup.set(p.participantId, {
            ...existing,
            docs: [...existing.docs, ...p.docs],
            counts: {
              ...existing.counts,
              total: existing.counts.total + p.counts.total,
              valid: existing.counts.valid + p.counts.valid,
              expiring: existing.counts.expiring + p.counts.expiring,
              expired: existing.counts.expired + p.counts.expired,
              missing: existing.counts.missing + p.counts.missing,
              pending: existing.counts.pending + p.counts.pending,
              invalid: existing.counts.invalid + p.counts.invalid,
              verified: existing.counts.verified + p.counts.verified,
              queried: existing.counts.queried + p.counts.queried,
              unverified: existing.counts.unverified + p.counts.unverified
            },
            // recompute simple flags
            complianceScore: Math.round((existing.complianceScore + p.complianceScore) / 2),
            actionNeeded: existing.actionNeeded || p.actionNeeded
          })
        }
      }

      setParticipants(
        Array.from(dedup.values()).sort((a, b) =>
          (b.actionNeeded ? 1 : 0) - (a.actionNeeded ? 1 : 0) ||
          b.complianceScore - a.complianceScore ||
          a.beneficiaryName.localeCompare(b.beneficiaryName)
        )
      )
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'Failed to load compliance data')
    } finally {
      setLoading(false)
    }
  }, [companyCode])

  useEffect(() => {
    refetch()
  }, [refetch])

  const globalStats = useMemo(() => aggregateGlobalStats(participants), [participants])

  /**
   * Writes still target applications.complianceDocuments array (your current model).
   * Later, swap these for subcollection writes without changing the UI.
   */
  const updateDocumentInApplication = useCallback(
    async (participantId: string, updater: (docs: RawComplianceDoc[]) => RawComplianceDoc[]) => {
      if (!companyCode) throw new Error('Missing companyCode')

      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('companyCode', '==', companyCode),
          where('participantId', '==', participantId)
        )
      )
      if (appSnap.empty) throw new Error('Application not found')

      const appRef = doc(db, 'applications', appSnap.docs[0].id)
      const appData = appSnap.docs[0].data() as any
      const currentDocs = (appData.complianceDocuments || []) as RawComplianceDoc[]
      const nextDocs = updater(currentDocs)

      await updateDoc(appRef, { complianceDocuments: nextDocs })
      await refetch()
    },
    [companyCode, refetch]
  )

  const verifyDocument = useCallback(
    async (participantId: string, docId: string | undefined, composite: { type?: string; documentName?: string; expiryDate?: any }, status: 'verified' | 'queried', comment?: string, userName?: string) => {
      await updateDocumentInApplication(participantId, (docs) => {
        const norm = (s: any) => String(s ?? '').trim().toLowerCase()

        return docs.map((d) => {
          const sameById = docId && d.id && d.id === docId
          const sameByComposite =
            !d.id &&
            norm(d.type) === norm(composite.type) &&
            norm(d.documentName) === norm(composite.documentName) &&
            String(d.expiryDate ?? '') === String(composite.expiryDate ?? '')

          if (!sameById && !sameByComposite) return d

          return {
            ...d,
            verificationStatus: status,
            verificationComment: comment || '',
            lastVerifiedBy: userName || 'Unknown',
            lastVerifiedAt: new Date().toISOString().split('T')[0],
            // align with your old behavior
            status: status === 'queried' ? 'invalid' : d.status
          }
        })
      })
    },
    [updateDocumentInApplication]
  )

  return {
    loading,
    error,
    participants,
    globalStats,
    refetch,
    updateDocumentInApplication,
    verifyDocument
  }
}
