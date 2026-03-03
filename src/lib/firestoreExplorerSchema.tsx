// lib/firestoreExplorerSchema.ts
import React from 'react'
import { Tag, Tooltip, Typography } from 'antd'

const { Text } = Typography

export type ValueKind = 'text' | 'tag' | 'bool' | 'date' | 'json' | 'number'

export type ColumnSpec = {
    key: string
    title?: string
    width?: number
    kind?: ValueKind
    ellipsis?: boolean
    showTooltip?: boolean
}

export type CollectionSchema = {
    name: string
    label?: string
    description?: string
    defaultVisibleKeys: string[]
    searchableKeys: string[]
    columns?: Record<string, ColumnSpec>
    subcollections?: string[]
}

const COMMON: Record<string, ColumnSpec> = {
    id: { key: 'id', title: 'ID', width: 260, kind: 'text', ellipsis: true, showTooltip: true },
    createdAt: { key: 'createdAt', kind: 'date', width: 160 },
    updatedAt: { key: 'updatedAt', kind: 'date', width: 160 },
    status: { key: 'status', kind: 'tag', width: 140 },
    role: { key: 'role', kind: 'tag', width: 140 },
    companyCode: { key: 'companyCode', kind: 'tag', width: 140 },
    email: { key: 'email', width: 220, ellipsis: true, showTooltip: true },
    phone: { key: 'phone', width: 160, ellipsis: true, showTooltip: true }
}

const SCHEMAS: Record<string, CollectionSchema> = {
    users: {
        name: 'users',
        label: 'Users',
        description: 'Platform users / roles',
        defaultVisibleKeys: ['id', 'fullName', 'email', 'role', 'companyCode', 'createdAt', 'updatedAt'],
        searchableKeys: ['id', 'fullName', 'name', 'email', 'role', 'companyCode', 'phone', 'status'],
        columns: {
            ...COMMON,
            fullName: { key: 'fullName', width: 220, ellipsis: true, showTooltip: true },
            name: { key: 'name', width: 220, ellipsis: true, showTooltip: true }
        }
    },
    participants: {
        name: 'participants',
        label: 'Participants',
        description: 'SMEs / incubatees primary profile',
        defaultVisibleKeys: ['id', 'beneficiaryName', 'email', 'phone', 'sector', 'companyCode', 'createdAt'],
        searchableKeys: ['id', 'beneficiaryName', 'email', 'phone', 'sector', 'companyCode', 'status'],
        columns: {
            ...COMMON,
            beneficiaryName: { key: 'beneficiaryName', title: 'Beneficiary', width: 240, ellipsis: true, showTooltip: true },
            sector: { key: 'sector', width: 180, ellipsis: true, showTooltip: true }
        },
        subcollections: ['monthlyPerformance', 'documents', 'revenueHistory']
    },
    applications: {
        name: 'applications',
        label: 'Applications',
        description: 'Applications / onboarding approvals',
        defaultVisibleKeys: ['id', 'beneficiaryName', 'email', 'status', 'companyCode', 'acceptedAt', 'createdAt'],
        searchableKeys: ['id', 'beneficiaryName', 'email', 'status', 'companyCode', 'programId'],
        columns: {
            ...COMMON,
            beneficiaryName: { key: 'beneficiaryName', title: 'Beneficiary', width: 240, ellipsis: true, showTooltip: true },
            programId: { key: 'programId', title: 'Program', width: 180, ellipsis: true, showTooltip: true },
            acceptedAt: { key: 'acceptedAt', kind: 'date', width: 160 }
        }
    },
    assignedInterventions: {
        name: 'assignedInterventions',
        label: 'Assigned Interventions',
        description: 'Assignment records (workflow state)',
        defaultVisibleKeys: ['id', 'participantId', 'interventionId', 'overallStatus', 'assigneeType', 'assigneeId', 'dueDate'],
        searchableKeys: ['id', 'participantId', 'interventionId', 'overallStatus', 'assigneeType', 'assigneeId'],
        columns: {
            ...COMMON,
            participantId: { key: 'participantId', title: 'Participant', width: 220, ellipsis: true, showTooltip: true },
            interventionId: { key: 'interventionId', title: 'Intervention', width: 220, ellipsis: true, showTooltip: true },
            overallStatus: { key: 'overallStatus', title: 'Status', kind: 'tag', width: 140 },
            assigneeType: { key: 'assigneeType', title: 'Assignee Type', kind: 'tag', width: 140 },
            assigneeId: { key: 'assigneeId', title: 'Assignee', width: 220, ellipsis: true, showTooltip: true },
            dueDate: { key: 'dueDate', kind: 'date', width: 160 }
        }
    },
    interventionsDatabase: {
        name: 'interventionsDatabase',
        label: 'Interventions DB',
        description: 'Intervention definitions / execution records',
        defaultVisibleKeys: ['id', 'title', 'areaOfSupport', 'department', 'status', 'createdAt'],
        searchableKeys: ['id', 'title', 'areaOfSupport', 'department', 'status'],
        columns: {
            ...COMMON,
            title: { key: 'title', width: 280, ellipsis: true, showTooltip: true },
            areaOfSupport: { key: 'areaOfSupport', title: 'Area', width: 200, ellipsis: true, showTooltip: true },
            department: { key: 'department', width: 180, ellipsis: true, showTooltip: true }
        }
    },
    resourceRequests: {
        name: 'resourceRequests',
        label: 'Resource Requests',
        description: 'Procurement workflow',
        defaultVisibleKeys: ['id', 'resourceName', 'status', 'requestedBy', 'companyCode', 'createdAt'],
        searchableKeys: ['id', 'resourceName', 'status', 'requestedBy', 'companyCode'],
        columns: {
            ...COMMON,
            resourceName: { key: 'resourceName', title: 'Resource', width: 260, ellipsis: true, showTooltip: true },
            requestedBy: { key: 'requestedBy', width: 220, ellipsis: true, showTooltip: true }
        }
    }
}

export function getCollectionSchema(collectionName: string | null | undefined): CollectionSchema | null {
    if (!collectionName) return null
    return SCHEMAS[collectionName] || null
}

export function listKnownCollections(): string[] {
    return Object.keys(SCHEMAS).sort((a, b) => a.localeCompare(b))
}

function isTsLike(v: any) {
    if (!v || typeof v !== 'object') return false
    if (typeof v.toDate === 'function') return true
    if (typeof v.seconds === 'number' && typeof v.nanoseconds === 'number') return true
    if (typeof v._seconds === 'number') return true
    return false
}

function toIso(v: any): string | null {
    try {
        if (!v) return null
        if (typeof v === 'string') {
            const d = new Date(v)
            if (!Number.isNaN(d.getTime())) return d.toISOString()
            return null
        }
        if (typeof v === 'number') {
            const d = new Date(v)
            if (!Number.isNaN(d.getTime())) return d.toISOString()
            return null
        }
        if (typeof v?.toDate === 'function') return v.toDate().toISOString()
        if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000).toISOString()
        if (typeof v?._seconds === 'number') return new Date(v._seconds * 1000).toISOString()
        return null
    } catch {
        return null
    }
}

export function renderExplorerCell(value: any, spec?: ColumnSpec) {
    if (value === null || value === undefined) return <Text type="secondary">—</Text>

    const kind: ValueKind =
        spec?.kind ||
        (typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'number' : isTsLike(value) ? 'date' : 'text')

    const tooltip = spec?.showTooltip ? String(value) : null

    const inner = (() => {
        if (kind === 'bool') return <Tag color={value ? 'green' : 'red'}>{value ? 'true' : 'false'}</Tag>

        if (kind === 'tag') return <Tag style={{ borderRadius: 999 }}>{String(value)}</Tag>

        if (kind === 'date') {
            const iso = toIso(value)
            return iso ? <Text>{iso.slice(0, 10)} {iso.slice(11, 19)}</Text> : <Text>{String(value)}</Text>
        }

        if (kind === 'number') return <Text>{String(value)}</Text>

        if (typeof value === 'object') {
            const s = safeStringify(value)
            return <Text style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{s}</Text>
        }

        return <Text>{String(value)}</Text>
    })()

    if (tooltip) {
        return (
            <Tooltip title={tooltip}>
                <span>{inner}</span>
            </Tooltip>
        )
    }

    return inner
}

export function safeStringify(v: any) {
    try {
        return JSON.stringify(v)
    } catch {
        return String(v)
    }
}
