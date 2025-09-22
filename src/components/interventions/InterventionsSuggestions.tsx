import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Card,
  Table,
  Tag,
  Typography,
  DatePicker,
  Select,
  Button,
  Space,
  message,
  Tooltip,
  Divider,
  Modal,
  List,
  Input
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  UserOutlined
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  Timestamp,
  documentId
} from 'firebase/firestore'
import type { ColumnsType } from 'antd/es/table'
import { db } from '@/firebase'

const { Text, Title } = Typography

type InterventionType = 'singular' | 'grouped'

type Participant = {
  id: string
  beneficiaryName: string
  requiredInterventions: Array<{
    id: string | number
    title?: string
    interventionTitle?: string
    area?: string
    areaOfSupport?: string
  }>
  programName?: string
  sector?: string
  stage?: string
  province?: string
  city?: string
}

type CoordinatorLite = {
  id: string
  name: string
  rating?: number // 0–5
  expertise?: string[] // keywords
}

type UserLite = {
  name?: string
  email?: string
  companyCode?: string
}

type PersonMini = { id: string; name: string }

type SuggestionRow = {
  key: string
  interventionId: string
  interventionTitle: string
  areaOfSupport: string
  type: InterventionType
  participants: PersonMini[]
  targetDate: Dayjs
  suggestedCoordinatorId?: string
  coordinatorOptions: CoordinatorLite[]
  // recurrence
  isRecurring?: boolean
  frequency?: string | null
  subtitle?: string | null
  // bookkeeping
  batchIndex?: number
}

const ciEq = (a?: string, b?: string) =>
  String(a || '')
    .trim()
    .toLowerCase() ===
  String(b || '')
    .trim()
    .toLowerCase()

const normalizeId = (v: any) => (v == null ? '' : String(v))

// next Tuesday utility (group default)
const nextTuesday = (from: Dayjs = dayjs()) => {
  const d = from.startOf('day')
  const weekday = d.day() // 0 Sun .. 6 Sat
  const diff = (9 - weekday) % 7 || 7 // next Tuesday
  return d.add(diff, 'day')
}

// next weekday skipping Sun/Tue/Sat (reserve Tue for grouped)
const nextNonTuesdayWeekday = (from: Dayjs = dayjs()) => {
  let d = from.startOf('day').add(1, 'day')
  while ([0, 2, 6].includes(d.day())) d = d.add(1, 'day')
  return d
}

const isWeekend = (d: Dayjs) => d.day() === 0 || d.day() === 6

function splitIntoBatches<T> (arr: T[], size: number): T[][] {
  if (size <= 0) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Rank coordinators by dept match + expertise hits + rating */
function rankCoordinators (
  coordinators: CoordinatorLite[],
  areaOfSupport: string, // you can keep this param for call sites, even if unused
  title: string
) {
  const titleWords = (title || '').toLowerCase().split(/\W+/).filter(Boolean)
  return [...coordinators]
    .map(c => {
      const expertise = (c.expertise || []).map(e => e.toLowerCase())
      const hits = expertise.reduce(
        (acc, kw) => acc + (titleWords.includes(kw) ? 1 : 0),
        0
      )
      const score = hits * 2 + (c.rating ?? 0)
      return { ...c, _score: score }
    })
    .sort((a, b) => b._score - a._score)
}

// yes/no → boolean (also accepts true/false/1/0)
const ynToBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v
  if (v == null) return false
  const s = String(v).trim().toLowerCase()
  if (s === 'yes' || s === 'true' || s === '1') return true
  if (s === 'no' || s === 'false' || s === '0') return false
  return false
}

async function loadIsCompulsoryMap (interventionIds: string[]) {
  const uniq = Array.from(new Set(interventionIds.map(String))).filter(Boolean)
  const out = new Map<string, boolean>()
  if (!uniq.length) return out

  // try by documentId() first
  const chunks = splitIntoBatches(uniq, 10)
  const seen = new Set<string>()
  for (const ids of chunks) {
    const snap = await getDocs(
      query(collection(db, 'interventions'), where(documentId(), 'in', ids))
    )
    snap.forEach(d => {
      const data = d.data() as any
      out.set(d.id, ynToBool(data?.isCompulsory))
      seen.add(d.id)
    })
  }

  // fallback: try by the "id" field for any misses
  const misses = uniq.filter(id => !seen.has(id))
  if (misses.length) {
    const missChunks = splitIntoBatches(misses, 10)
    for (const ids of missChunks) {
      const snap = await getDocs(
        query(collection(db, 'interventions'), where('id', 'in', ids))
      )
      snap.forEach(d => {
        const data = d.data() as any
        const key = String(data?.id ?? d.id)
        out.set(key, ynToBool(data?.isCompulsory))
        seen.add(key)
      })
    }
  }

  return out
}

async function loadRecurringMetaMap (interventionIds: string[]) {
  const uniq = Array.from(new Set(interventionIds.map(String))).filter(Boolean)
  const out = new Map<
    string,
    { isRecurring: boolean; frequency?: string | null }
  >()
  if (!uniq.length) return out

  const chunks = splitIntoBatches(uniq, 10)
  const seen = new Set<string>()

  // try by documentId() first
  for (const ids of chunks) {
    const snap = await getDocs(
      query(collection(db, 'interventions'), where(documentId(), 'in', ids))
    )
    snap.forEach(d => {
      const data = d.data() as any
      out.set(d.id, {
        isRecurring: ynToBool(data?.isRecurring),
        frequency: data?.frequency ?? null
      })
      seen.add(d.id)
    })
  }

  // fallback: try by "id" field for misses
  const misses = uniq.filter(id => !seen.has(id))
  if (misses.length) {
    const missChunks = splitIntoBatches(misses, 10)
    for (const ids of missChunks) {
      const snap = await getDocs(
        query(collection(db, 'interventions'), where('id', 'in', ids))
      )
      snap.forEach(d => {
        const data = d.data() as any
        const key = String(data?.id ?? d.id)
        out.set(key, {
          isRecurring: ynToBool(data?.isRecurring),
          frequency: data?.frequency ?? null
        })
        seen.add(key)
      })
    }
  }

  // (keep your debug logs if you like)
  console.group('[recurring-meta] loaded')
  console.log('Requested IDs:', uniq)
  console.log('Resolved keys:', Array.from(out.keys()))
  console.table(
    Array.from(out.entries()).map(([k, v]) => ({
      key: k,
      isRecurring: v.isRecurring,
      frequency: v.frequency ?? ''
    }))
  )
  console.groupEnd()

  const unfound = uniq.filter(id => !out.has(id))
  if (unfound.length) {
    console.warn('[recurring-meta] Unresolved IDs:', unfound)
  }

  return out
}

/** Firestore write: one indicative calendar entry per participant */
async function createIndicativeEntries ({
  user,
  rows
}: {
  user: UserLite
  rows: SuggestionRow[]
}) {
  const created: string[] = []
  for (const row of rows) {
    const targetTs = Timestamp.fromDate(row.targetDate.toDate())
    const implTs = targetTs // implementationDate mirrors targetDate
    const coordinatorId = row.suggestedCoordinatorId || ''
    const coordinator = row.coordinatorOptions.find(c => c.id === coordinatorId)
    const coordinatorName = coordinator?.name || user.name || 'Operations'

    for (const p of row.participants) {
      const newId = `ic_${p.id}_${
        row.interventionId
      }_${row.targetDate.valueOf()}`
      await setDoc(doc(db, 'indicativeCalender', newId), {
        id: newId,
        participantId: p.id,
        beneficiaryName: p.name,

        interventionId: row.interventionId,
        interventionTitle: row.interventionTitle,
        type: row.type,

        targetDate: targetTs,
        implementationDate: implTs, // 👈 saved
        isRecurring: !!row.isRecurring, // 👈 saved (for downstream use)
        frequency: row.frequency ?? null,
        subtitle: row.isRecurring ? row.subtitle || null : null, // 👈 saved if recurring

        coordinatorId: coordinatorId || (user.email ?? 'ops'),
        coordinatorName,

        areaOfSupport: row.areaOfSupport,
        companyCode: user.companyCode ?? null,

        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        status: 'planned'
      })
      created.push(newId)
    }
  }
  return created
}

/** ---------- Component ---------- */
export default function InterventionSuggestions ({
  user,
  participants,
  coordinators,
  maxGroupSize = 15
}: {
  user: UserLite
  participants: Participant[]
  coordinators: CoordinatorLite[]
  maxGroupSize?: number
}) {
  // 1) Clusters per interventionId
  const clusters = useMemo(() => {
    const map = new Map<
      string,
      {
        interventionId: string
        title: string
        areaOfSupport: string
        participants: PersonMini[]
      }
    >()

    participants.forEach(p => {
      ;(p.requiredInterventions || []).forEach(iv => {
        const area = iv.areaOfSupport || iv.area || '—'

        const id = normalizeId(iv.id)
        const title =
          iv.interventionTitle || iv.title || 'Untitled Intervention'
        const key = `${id}`

        const cur = map.get(key) || {
          interventionId: id,
          title,
          areaOfSupport: area,
          participants: []
        }
        cur.participants.push({ id: p.id, name: p.beneficiaryName })
        map.set(key, cur)
      })
    })

    return Array.from(map.values()).sort(
      (a, b) => b.participants.length - a.participants.length
    )
  }, [participants])

  // 2) Meta maps
  const [compulsoryMap, setCompulsoryMap] = useState<Map<string, boolean>>(
    new Map()
  )
  const [recurringMap, setRecurringMap] = useState<
    Map<string, { isRecurring: boolean; frequency?: string | null }>
  >(new Map())
  const [metaReady, setMetaReady] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setMetaReady(false)
      const ids = clusters.map(c => c.interventionId)

      try {
        const [comp, rec] = await Promise.all([
          loadIsCompulsoryMap(ids),
          loadRecurringMetaMap(ids)
        ])
        if (!alive) return
        setCompulsoryMap(comp)
        setRecurringMap(rec)
      } catch (e) {
        if (!alive) return
        setCompulsoryMap(new Map())
        setRecurringMap(new Map())
      } finally {
        if (alive) setMetaReady(true)
      }
    })()

    return () => {
      alive = false
    }
  }, [clusters])

  // 3) Suggested rows (force single group if compulsory)
  const suggestedRows = useMemo<SuggestionRow[]>(() => {
    if (!metaReady) return []
    const out: SuggestionRow[] = []

    clusters.forEach(cluster => {
      const demand = cluster.participants.length
      const ranked = rankCoordinators(
        coordinators,
        cluster.areaOfSupport,
        cluster.title
      )
      const defaultCoordinator = ranked[0]?.id
      const interventionId = cluster.interventionId
      const isCompulsory = compulsoryMap.get(interventionId) === true

      const recMeta = recurringMap.get(interventionId)
      const isRecurring = !!recMeta?.isRecurring
      const frequency = recMeta?.frequency ?? null

      console.debug('[suggest] cluster', {
        interventionId,
        title: cluster.title,
        participants: cluster.participants.length,
        isCompulsory,
        isRecurring,
        frequency,
        hasMeta: !!recMeta
      })

      if (isCompulsory) {
        // ✅ one grouped session with everyone
        const date = nextTuesday(dayjs())
        out.push({
          key: `${interventionId}__all_${demand}`,
          interventionId,
          interventionTitle: cluster.title,
          areaOfSupport: cluster.areaOfSupport,
          type: 'grouped',
          participants: cluster.participants,
          targetDate: date,
          suggestedCoordinatorId: defaultCoordinator,
          coordinatorOptions: ranked,
          isRecurring,
          frequency,
          subtitle: isRecurring
            ? `Session - ${date.format('YYYY-MM-DD')}`
            : null
        })
        return // move to next cluster
      }

      // non-compulsory logic (lenient grouping as you had)
      if (demand >= 2) {
        const groups = Math.min(
          3,
          Math.max(1, Math.ceil(demand / Math.ceil(demand / 3)))
        )
        const size = Math.ceil(demand / groups)
        const batches = splitIntoBatches(cluster.participants, size)
        batches.forEach((batch, idx) => {
          const date = nextTuesday(dayjs().add(idx, 'week'))
          out.push({
            key: `${interventionId}__soft_${idx}`,
            interventionId,
            interventionTitle: cluster.title,
            areaOfSupport: cluster.areaOfSupport,
            type: 'grouped',
            participants: batch,
            targetDate: date,
            suggestedCoordinatorId: defaultCoordinator,
            coordinatorOptions: ranked,
            isRecurring,
            frequency,
            subtitle: isRecurring
              ? `Session - ${date.format('YYYY-MM-DD')}`
              : null
          })
        })
      } else {
        const date = nextNonTuesdayWeekday(dayjs())
        out.push({
          key: `${interventionId}__single_${cluster.participants[0].id}`,
          interventionId,
          interventionTitle: cluster.title,
          areaOfSupport: cluster.areaOfSupport,
          type: 'singular',
          participants: cluster.participants,
          targetDate: date,
          suggestedCoordinatorId: defaultCoordinator,
          coordinatorOptions: ranked,
          isRecurring,
          frequency,
          subtitle: isRecurring
            ? `Session - ${date.format('YYYY-MM-DD')}`
            : null
        })
      }
    })

    return out
  }, [
    metaReady,
    clusters,
    coordinators,
    compulsoryMap,
    recurringMap,
    maxGroupSize
  ])

  // 4) Local editable rows
  const [rows, setRows] = useState<SuggestionRow[]>([])
  useEffect(() => {
    if (metaReady) setRows(suggestedRows)
  }, [metaReady, suggestedRows])

  const setRow = useCallback((key: string, patch: Partial<SuggestionRow>) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)))
  }, [])

  // ---------- Review Modal: remove participants & reassign ----------
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRow, setReviewRow] = useState<SuggestionRow | null>(null)
  const [reviewParticipants, setReviewParticipants] = useState<PersonMini[]>([])

  const openReview = (row: SuggestionRow) => {
    setReviewRow(row)
    setReviewParticipants(row.participants)
    setReviewOpen(true)
  }

  const removeFromReview = (id: string) => {
    setReviewParticipants(prev => prev.filter(p => p.id !== id))
  }

  const saveReview = () => {
    if (!reviewRow) return
    const removed = reviewRow.participants.filter(
      p => !reviewParticipants.some(s => s.id === p.id)
    )

    // update source row participants
    setRows(prev => {
      const updated = prev.map(r =>
        r.key === reviewRow.key ? { ...r, participants: reviewParticipants } : r
      )

      if (!removed.length) return updated

      // singles for removed on consecutive weekdays
      let cursor = nextNonTuesdayWeekday(dayjs().add(1, 'day'))
      const singles: SuggestionRow[] = removed.map(p => {
        while (isWeekend(cursor)) cursor = cursor.add(1, 'day')

        const single: SuggestionRow = {
          key: `${reviewRow.interventionId}__reassigned_${
            p.id
          }_${cursor.valueOf()}`,
          interventionId: reviewRow.interventionId,
          interventionTitle: reviewRow.interventionTitle,
          areaOfSupport: reviewRow.areaOfSupport,
          type: 'singular',
          participants: [p],
          targetDate: cursor,
          suggestedCoordinatorId: reviewRow.suggestedCoordinatorId,
          coordinatorOptions: reviewRow.coordinatorOptions,
          isRecurring: reviewRow.isRecurring,
          frequency: reviewRow.frequency,
          subtitle: reviewRow.isRecurring
            ? `Session - ${cursor.format('YYYY-MM-DD')}`
            : null
        }
        cursor = nextNonTuesdayWeekday(cursor)
        return single
      })

      return [...updated, ...singles]
    })

    setReviewOpen(false)
    setReviewRow(null)
  }

  // ---------- Columns ----------
  const columns: ColumnsType<SuggestionRow> = [
    {
      title: 'Area of Support',
      dataIndex: 'areaOfSupport',
      key: 'areaOfSupport',
      render: (v: string) => <Tag color='blue'>{v || '—'}</Tag>
    },
    {
      title: 'Intervention',
      dataIndex: 'interventionTitle',
      key: 'interventionTitle'
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (t: InterventionType) =>
        t === 'grouped' ? <Tag color='purple'>Group</Tag> : <Tag>Single</Tag>
    },
    {
      title: 'Participants',
      key: 'participants',
      render: (_: unknown, r: SuggestionRow) => (
        <Tooltip
          title={
            <div style={{ maxWidth: 320 }}>
              {r.participants.map(p => (
                <div key={p.id}>• {p.name}</div>
              ))}
            </div>
          }
        >
          <Tag icon={<UserOutlined />}>{r.participants.length}</Tag>
        </Tooltip>
      )
    },
    {
      title: 'Target Date',
      key: 'targetDate',
      render: (_: unknown, r: SuggestionRow) => (
        <DatePicker
          value={r.targetDate}
          onChange={d =>
            d &&
            setRow(r.key, {
              targetDate: d,
              // keep subtitle aligned for recurring rows when date changes
              subtitle: r.isRecurring
                ? r.subtitle || `Session - ${d.format('YYYY-MM-DD')}`
                : r.subtitle ?? null
            })
          }
          disabledDate={d => !!d && d < dayjs().startOf('day')}
          style={{ width: 160 }}
          suffixIcon={<CalendarOutlined />}
        />
      )
    },
    {
      title: 'Coordinator',
      key: 'coordinator',
      render: (_: unknown, r: SuggestionRow) => (
        <Select
          value={r.suggestedCoordinatorId}
          onChange={v => setRow(r.key, { suggestedCoordinatorId: v })}
          style={{ width: 260 }}
          placeholder='Select coordinator'
          options={(r.coordinatorOptions || []).map(c => ({
            label: `${c.name}${
              c.rating != null ? ` • ${c.rating.toFixed(1)}` : ''
            }`,
            value: c.id
          }))}
          showSearch
          optionFilterProp='label'
          allowClear
        />
      )
    },
    {
      title: 'Subtitle',
      key: 'subtitle',
      render: (_: unknown, r: SuggestionRow) =>
        r.isRecurring ? (
          <Input
            value={r.subtitle || ''}
            onChange={e => setRow(r.key, { subtitle: e.target.value })}
            placeholder='e.g., Week 1 — Intro to Bookkeeping'
            maxLength={120}
            style={{ width: 260 }}
          />
        ) : (
          <Text type='secondary'>—</Text>
        )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: SuggestionRow) => (
        <Space>
          <Button onClick={() => openReview(r)}>Review</Button>
          <Button
            type='primary'
            icon={<CheckCircleOutlined />}
            onClick={async () => {
              // if recurring, enforce subtitle presence
              if (r.isRecurring && !r.subtitle) {
                message.warning('Please add a Subtitle for recurring sessions.')
                return
              }
              const created = await createIndicativeEntries({ user, rows: [r] })
              if (created.length)
                message.success('Saved to indicative calendar')
              else message.info('No new entries saved')
            }}
          >
            Approve
          </Button>
        </Space>
      )
    }
  ]

  return (
    <>
      <Card
        title='Suggested Interventions (lenient grouping & scheduling)'
        bordered
        style={{
          boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
          borderRadius: 8,
          border: '1px solid #d6e4ff'
        }}
        extra={
          <Space>
            <Button onClick={() => setRows(suggestedRows)}>Reset</Button>
            <Button
              type='primary'
              onClick={async () => {
                // enforce subtitle for any recurring rows
                const missing = rows.filter(r => r.isRecurring && !r.subtitle)
                if (missing.length) {
                  message.warning(
                    'Please add a Subtitle for all recurring rows before approving.'
                  )
                  return
                }
                const created = await createIndicativeEntries({ user, rows })
                if (created.length) {
                  message.success(
                    `Saved ${created.length} items to indicative calendar`
                  )
                } else {
                  message.info('No new entries saved')
                }
              }}
            >
              Approve All
            </Button>
          </Space>
        }
      >
        <Space direction='vertical' style={{ width: '100%' }}>
          <Text type='secondary'>
            • Groups default to Tuesdays (future weeks). Singles default to the
            earliest non-Tuesday weekday. • Use <b>Review</b> to remove
            participants; removed participants are auto-reassigned as singles on
            consecutive weekdays.
          </Text>
          <Divider style={{ margin: '8px 0' }} />
          <Table<SuggestionRow>
            rowKey='key'
            columns={columns}
            dataSource={rows}
            loading={!metaReady}
            pagination={{ pageSize: 8 }}
          />
        </Space>
      </Card>

      {/* Review Modal */}
      <Modal
        open={reviewOpen}
        title='Review Participants'
        onCancel={() => setReviewOpen(false)}
        onOk={saveReview}
        okText='Save & Reassign Removed'
      >
        {reviewRow && (
          <>
            <Title level={5} style={{ marginTop: 0 }}>
              {reviewRow.interventionTitle}
            </Title>
            <Text type='secondary'>Area: {reviewRow.areaOfSupport}</Text>
            {reviewRow.isRecurring && (
              <>
                <Divider />
                <Text strong>Subtitle (recurring)</Text>
                <Input
                  value={reviewRow.subtitle || ''}
                  onChange={e =>
                    setReviewRow(prev =>
                      prev ? { ...prev, subtitle: e.target.value } : prev
                    )
                  }
                  placeholder='e.g., Week 2 — Cashflow Fundamentals'
                  maxLength={120}
                  style={{ marginTop: 6 }}
                />
              </>
            )}
            <Divider />
            <Text strong>Keep in this session:</Text>
            <List
              size='small'
              dataSource={reviewParticipants}
              renderItem={p => (
                <List.Item
                  actions={[
                    <Button
                      size='small'
                      danger
                      onClick={() => removeFromReview(p.id)}
                    >
                      Remove
                    </Button>
                  ]}
                >
                  {p.name}
                </List.Item>
              )}
              locale={{ emptyText: 'No participants' }}
            />
            <Divider />
            <Text type='secondary'>
              Removed participants will be scheduled as single sessions on
              consecutive weekdays (skipping weekends).
            </Text>
          </>
        )}
      </Modal>
    </>
  )
}
