// src/modules/compliance/complianceLogic.ts
import dayjs, { Dayjs } from 'dayjs'

/**
 * Keep these types lightweight so other modules (reports/charts) can import them.
 * If you already have types in ./types, you can map to these.
 */

export type VerificationStatus = 'verified' | 'queried' | 'unverified'

export type EffectiveDocStatus =
  | 'valid'
  | 'expiring'
  | 'expired'
  | 'missing'
  | 'pending'
  | 'invalid'

export type RawComplianceDoc = {
  id?: string
  participantId: string
  beneficiaryName?: string
  type: string
  documentName?: string
  status?: string
  issueDate?: any // string | Timestamp | Date
  expiryDate?: any // string | Timestamp | Date
  notes?: string
  url?: string
  uploadedBy?: string
  uploadedAt?: string
  verificationStatus?: VerificationStatus | string
  verificationComment?: string
  lastVerifiedBy?: string
  lastVerifiedAt?: string
}

export type NormalizedComplianceDoc = Omit<RawComplianceDoc, 'status' | 'verificationStatus'> & {
  statusRaw: string // normalized lower
  verificationStatusRaw: VerificationStatus
  expiry?: Dayjs | null
  issue?: Dayjs | null
  hasFile: boolean
}

export type ComplianceCounts = Record<EffectiveDocStatus, number> & {
  total: number
  verified: number
  queried: number
  unverified: number
}

export type ParticipantComplianceSummary = {
  participantId: string
  beneficiaryName: string
  email?: string
  phone?: string

  docs: Array<NormalizedComplianceDoc & { effectiveStatus: EffectiveDocStatus }>
  counts: ComplianceCounts

  // Importable for charts
  complianceScore: number // 0-100
  actionNeeded: boolean
  lastActivityAt?: string // ISO date string (optional helper)
}

export type GlobalComplianceStats = {
  totalParticipants: number
  totalDocuments: number
  statusCounts: Record<EffectiveDocStatus, number>
  verificationCounts: { verified: number; queried: number; unverified: number }
  avgComplianceScore: number
  participantsActionNeeded: number
}

export const DEFAULT_EXPIRING_WINDOW_DAYS = 30

// ---------- Date helpers ----------
const toDayjs = (v: any): Dayjs | null => {
  if (!v) return null
  // Firestore Timestamp
  if (typeof v?.toDate === 'function') return dayjs(v.toDate())
  // Date
  if (v instanceof Date) return dayjs(v)
  // string
  if (typeof v === 'string') {
    const d = dayjs(v)
    return d.isValid() ? d : null
  }
  // number
  if (typeof v === 'number') return dayjs(v)
  // fallback
  const d = dayjs(v)
  return d.isValid() ? d : null
}

const norm = (s: any) => String(s ?? '').trim().toLowerCase()

export const normalizeDoc = (doc: RawComplianceDoc): NormalizedComplianceDoc => {
  const statusRaw = norm(doc.status) || 'pending'
  const verificationStatusRaw =
    (norm(doc.verificationStatus) as VerificationStatus) || 'unverified'

  const expiry = toDayjs(doc.expiryDate)
  const issue = toDayjs(doc.issueDate)

  return {
    ...doc,
    statusRaw,
    verificationStatusRaw:
      verificationStatusRaw === 'verified' || verificationStatusRaw === 'queried'
        ? verificationStatusRaw
        : 'unverified',
    expiry,
    issue,
    hasFile: Boolean(doc.url) && statusRaw !== 'missing'
  }
}

/**
 * Single status truth:
 * - If missing/no file => missing (unless explicitly invalid/expired etc)
 * - If expiry passed => expired
 * - If expiry soon => expiring
 * - If queried => invalid (effective), because it requires action
 * - Else fallback to stored statusRaw
 */
export const getEffectiveStatus = (
  doc: NormalizedComplianceDoc,
  now = dayjs(),
  expiringWindowDays = DEFAULT_EXPIRING_WINDOW_DAYS
): EffectiveDocStatus => {
  // If verifier queried it, we treat as invalid for ops actions/charts
  if (doc.verificationStatusRaw === 'queried') return 'invalid'

  // Missing file or explicitly missing
  if (!doc.hasFile || doc.statusRaw === 'missing') return 'missing'

  // Expiry logic
  if (doc.expiry && doc.expiry.isValid()) {
    if (doc.expiry.isBefore(now, 'day')) return 'expired'
    if (doc.expiry.diff(now, 'day') <= expiringWindowDays) return 'expiring'
  }

  // Stored statuses mapping
  const s = doc.statusRaw
  if (s === 'valid') return 'valid'
  if (s === 'expired') return 'expired'
  if (s === 'expiring') return 'expiring'
  if (s === 'invalid') return 'invalid'
  if (s === 'missing') return 'missing'
  return 'pending'
}

export const isProblematic = (effectiveStatus: EffectiveDocStatus) =>
  effectiveStatus === 'missing' ||
  effectiveStatus === 'expired' ||
  effectiveStatus === 'invalid' ||
  effectiveStatus === 'pending' ||
  effectiveStatus === 'expiring'

export const computeCounts = (
  docs: Array<NormalizedComplianceDoc & { effectiveStatus: EffectiveDocStatus }>
): ComplianceCounts => {
  const base: ComplianceCounts = {
    total: docs.length,
    valid: 0,
    expiring: 0,
    expired: 0,
    missing: 0,
    pending: 0,
    invalid: 0,
    verified: 0,
    queried: 0,
    unverified: 0
  }

  for (const d of docs) {
    base[d.effectiveStatus]++
    if (d.verificationStatusRaw === 'verified') base.verified++
    else if (d.verificationStatusRaw === 'queried') base.queried++
    else base.unverified++
  }

  return base
}

/**
 * Compliance score rules (importable for charts):
 * - "Good" if effectiveStatus is valid OR verificationStatus is verified
 * - Everything else counts as not compliant
 */
export const computeComplianceScore = (
  docs: Array<NormalizedComplianceDoc & { effectiveStatus: EffectiveDocStatus }>
): number => {
  if (!docs.length) return 0
  const good = docs.filter(
    d => d.effectiveStatus === 'valid' || d.verificationStatusRaw === 'verified'
  ).length
  return Math.round((good / docs.length) * 100)
}

export const buildParticipantSummary = (args: {
  participantId: string
  beneficiaryName: string
  email?: string
  phone?: string
  rawDocs: RawComplianceDoc[]
  now?: Dayjs
  expiringWindowDays?: number
}): ParticipantComplianceSummary => {
  const now = args.now ?? dayjs()
  const expDays = args.expiringWindowDays ?? DEFAULT_EXPIRING_WINDOW_DAYS

  const docs = args.rawDocs.map(d => {
    const n = normalizeDoc(d)
    const effectiveStatus = getEffectiveStatus(n, now, expDays)
    return { ...n, effectiveStatus }
  })

  const counts = computeCounts(docs)
  const complianceScore = computeComplianceScore(docs)
  const actionNeeded = docs.some(d => isProblematic(d.effectiveStatus))

  // Optional "last activity" helper for sorting
  const lastActivity = docs
    .map(d => d.lastVerifiedAt || d.uploadedAt)
    .filter(Boolean)
    .sort()
    .at(-1)

  return {
    participantId: args.participantId,
    beneficiaryName: args.beneficiaryName,
    email: args.email,
    phone: args.phone,
    docs,
    counts,
    complianceScore,
    actionNeeded,
    lastActivityAt: lastActivity
  }
}

export const aggregateGlobalStats = (
  participants: ParticipantComplianceSummary[]
): GlobalComplianceStats => {
  const statusCounts: Record<EffectiveDocStatus, number> = {
    valid: 0,
    expiring: 0,
    expired: 0,
    missing: 0,
    pending: 0,
    invalid: 0
  }

  const verificationCounts = { verified: 0, queried: 0, unverified: 0 }

  let totalDocs = 0
  let scoreSum = 0
  let actionNeeded = 0

  for (const p of participants) {
    totalDocs += p.counts.total
    scoreSum += p.complianceScore
    if (p.actionNeeded) actionNeeded++

    for (const k of Object.keys(statusCounts) as EffectiveDocStatus[]) {
      statusCounts[k] += p.counts[k]
    }
    verificationCounts.verified += p.counts.verified
    verificationCounts.queried += p.counts.queried
    verificationCounts.unverified += p.counts.unverified
  }

  return {
    totalParticipants: participants.length,
    totalDocuments: totalDocs,
    statusCounts,
    verificationCounts,
    avgComplianceScore: participants.length ? Math.round(scoreSum / participants.length) : 0,
    participantsActionNeeded: actionNeeded
  }
}

/**
 * Email reminders payload builder (importable).
 * Groups all issues per participant (or per email if you prefer).
 */
export type ReminderIssue = { type: string; status: EffectiveDocStatus; documentName?: string }
export type ReminderPayload = { email: string; name: string; issues: ReminderIssue[] }

export const buildReminderPayloads = (
  participants: ParticipantComplianceSummary[]
): ReminderPayload[] => {
  const payloads: ReminderPayload[] = []

  for (const p of participants) {
    if (!p.email) continue

    const issues = p.docs
      .filter(d => isProblematic(d.effectiveStatus))
      .map(d => ({
        type: d.type,
        status: d.effectiveStatus,
        documentName: d.documentName
      }))

    if (!issues.length) continue

    payloads.push({
      email: p.email,
      name: p.beneficiaryName || p.email,
      issues
    })
  }

  return payloads
}
