import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Timeline, Typography, Tag, Space, Spin, Empty } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/firebase'

const { Text } = Typography

export type InterventionHistoryModalProps = {
    open: boolean
    onClose: () => void
    // pass one id for single, or multiple ids for group scope
    interventionIds: string[]
    title?: string
}

type HistoryItem = {
    id: string
    interventionDocId: string
    type: 'progress_update' | string
    createdAt?: any
    actorRole?: string
    actorUid?: string
    hoursAdded?: number
    progressAdded?: number
    progressAfter?: number
    timeSpentAfter?: number
    notes?: string
    label?: string
    beneficiaryName?: string
}

const toDate = (v: any): Date | null => {
    if (!v) return null
    if (v?.toDate) return v.toDate()
    if (typeof v === 'object' && v?.seconds) return new Date(v.seconds * 1000)
    const d = new Date(v)
    return Number.isNaN(+d) ? null : d
}

export const InterventionHistoryModal: React.FC<InterventionHistoryModalProps> = ({
    open,
    onClose,
    interventionIds,
    title = 'Intervention History'
}) => {
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<HistoryItem[]>([])

    const idsKey = useMemo(() => interventionIds.slice().sort().join('|'), [interventionIds])

    useEffect(() => {
        if (!open) return
        if (!interventionIds?.length) {
            setItems([])
            return
        }

        const run = async () => {
            try {
                setLoading(true)

                const all: HistoryItem[] = []
                for (const docId of interventionIds) {
                    const qy = query(
                        collection(db, 'assignedInterventions', docId, 'history'),
                        orderBy('createdAt', 'asc')
                    )
                    const snap = await getDocs(qy)
                    snap.forEach(d => {
                        all.push({
                            id: d.id,
                            interventionDocId: docId,
                            ...(d.data() as any)
                        })
                    })
                }

                // global sort
                all.sort((a, b) => {
                    const da = toDate(a.createdAt)
                    const dbb = toDate(b.createdAt)
                    return (da ? +da : 0) - (dbb ? +dbb : 0)
                })

                setItems(all)
            } catch (e) {
                console.error(e)
                setItems([])
            } finally {
                setLoading(false)
            }
        }

        run()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, idsKey])

    const timelineItems = useMemo(() => {
        return items.map((it, idx) => {
            const d = toDate(it.createdAt)
            const when = d ? dayjs(d).format('DD MMM YYYY, HH:mm') : '—'
            const hrs = Number(it.hoursAdded) || 0
            const pct = Number(it.progressAdded) || 0
            const actor = String(it.actorRole || '').trim() || 'user'

            const header = (
                <Space wrap size={8}>
                    <Tag>{it.type === 'progress_update' ? 'Progress update' : it.type || 'Event'}</Tag>
                    <Text type="secondary">
                        <ClockCircleOutlined /> {when}
                    </Text>
                    <Tag color="blue">{actor}</Tag>
                    {it.beneficiaryName ? <Tag color="purple">{it.beneficiaryName}</Tag> : null}
                </Space>
            )

            const body =
                it.type === 'progress_update' ? (
                    <div style={{ marginTop: 6 }}>
                        <Space direction="vertical" size={2}>
                            <Text>
                                +{hrs}h, +{pct}% → <b>{Number(it.progressAfter) || 0}%</b> (
                                {Number(it.timeSpentAfter) || 0}h total)
                            </Text>
                            {String(it.notes || '').trim() ? (
                                <Text type="secondary">{String(it.notes || '').trim()}</Text>
                            ) : null}
                        </Space>
                    </div>
                ) : String(it.label || '').trim() ? (
                    <div style={{ marginTop: 6 }}>
                        <Text>{String(it.label || '').trim()}</Text>
                    </div>
                ) : null

            return {
                key: `${it.interventionDocId}:${it.id}:${idx}`,
                children: (
                    <div>
                        {header}
                        {body}
                    </div>
                )
            }
        })
    }, [items])

    return (
        <Modal
            open={open}
            onCancel={onClose}
            onOk={onClose}
            okText="Close"
            cancelButtonProps={{ style: { display: 'none' } }}
            width={880}
            title={title}
            destroyOnClose
        >
            {loading ? (
                <Space style={{ width: '100%', justifyContent: 'center', padding: 20 }}>
                    <Spin />
                </Space>
            ) : !timelineItems.length ? (
                <Empty description="No history recorded yet." />
            ) : (
                <Timeline mode="alternate" items={timelineItems} />
            )}
        </Modal>
    )
}

export default InterventionHistoryModal
