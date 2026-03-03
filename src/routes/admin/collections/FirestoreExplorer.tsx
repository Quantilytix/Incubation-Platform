// pages/admin/FirestoreExplorer.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    Layout,
    List,
    Input,
    Table,
    Space,
    Button,
    Modal,
    Form,
    message,
    Popconfirm,
    Typography,
    Divider,
    Select,
    Alert,
    Row,
    Col,
    Tag,
    Tooltip,
    Drawer,
    Checkbox
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import axios from 'axios'
import { auth } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
    DatabaseOutlined,
    ReloadOutlined,
    SearchOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SettingOutlined,
    CheckSquareOutlined,
    AppstoreOutlined,
    CodeOutlined
} from '@ant-design/icons'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'
import { getCollectionSchema, renderExplorerCell, type ColumnSpec } from '@/lib/firestoreExplorerSchema'
import { Helmet } from 'react-helmet'

const { Sider, Content } = Layout
const { Title, Text } = Typography

type AnyDoc = { id: string;[k: string]: any }

const ADMIN_BASE_URL = 'https://us-central1-incubation-platform-61610.cloudfunctions.net/adminApi'

async function getIdToken() {
    const userNow = auth.currentUser
    if (userNow) return await userNow.getIdToken(true)

    const u = await new Promise<any>((resolve, reject) => {
        const unsub = onAuthStateChanged(
            auth,
            async usr => {
                unsub()
                if (!usr) reject(new Error('Not logged in'))
                else resolve(usr)
            },
            err => {
                unsub()
                reject(err)
            }
        )
    })

    return await u.getIdToken(true)
}

async function adminRequest<T = any>(method: 'get' | 'post', path: string, body?: any): Promise<T> {
    const token = await getIdToken()
    const url = `${ADMIN_BASE_URL}${path}`

    const res = await axios.request<T>({
        method,
        url,
        headers: {
            Authorization: `Bearer ${token}`,
            'X-Admin-Explorer': '1'
        },
        ...(method === 'get' ? {} : { data: body })
    })

    return res.data
}

export const FirestoreExplorer: React.FC = () => {
    const [collections, setCollections] = useState<string[]>([])
    const [collectionsFilter, setCollectionsFilter] = useState('')
    const [activeCollection, setActiveCollection] = useState<string | null>(null)

    const [rows, setRows] = useState<AnyDoc[]>([])
    const [loadingCollections, setLoadingCollections] = useState(false)
    const [loadingRows, setLoadingRows] = useState(false)

    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const selectedIds = useMemo(() => selectedRowKeys.map(String), [selectedRowKeys])

    const [searchField, setSearchField] = useState<string>('__any__')
    const [searchValue, setSearchValue] = useState<string>('')

    const [editOpen, setEditOpen] = useState(false)
    const [editDoc, setEditDoc] = useState<AnyDoc | null>(null)
    const [editForm] = Form.useForm()

    const [bulkOpen, setBulkOpen] = useState(false)
    const [bulkMode, setBulkMode] = useState<'add' | 'delete'>('add')
    const [bulkForm] = Form.useForm()

    const [columnsOpen, setColumnsOpen] = useState(false)
    const [visibleKeys, setVisibleKeys] = useState<string[]>([])

    const PAGE_SIZE = 200
    const [cursor, setCursor] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState<boolean>(false)

    const schema = useMemo(() => getCollectionSchema(activeCollection), [activeCollection])

    const filteredCollections = useMemo(() => {
        const q = collectionsFilter.trim().toLowerCase()
        if (!q) return collections
        return collections.filter(c => c.toLowerCase().includes(q))
    }, [collections, collectionsFilter])

    const allKeys = useMemo(() => {
        const s = new Set<string>(['id'])
        rows.forEach(r => Object.keys(r || {}).forEach(k => s.add(k)))
        return Array.from(s)
    }, [rows])

    useEffect(() => {
        if (!activeCollection) return
        const next = schema?.defaultVisibleKeys?.length ? schema.defaultVisibleKeys : ['id', ...allKeys.filter(k => k !== 'id').slice(0, 8)]
        setVisibleKeys(next)
        setSearchField('__any__')
        setSearchValue('')
    }, [activeCollection])

    const effectiveVisibleKeys = useMemo(() => {
        const base = visibleKeys?.length ? visibleKeys : ['id', ...allKeys.filter(k => k !== 'id').slice(0, 8)]
        const dedup = Array.from(new Set(base))
        if (!dedup.includes('id')) dedup.unshift('id')
        return dedup
    }, [visibleKeys, allKeys])

    const searchableKeys = useMemo(() => {
        const keys = schema?.searchableKeys?.length ? schema.searchableKeys : allKeys
        const dedup = Array.from(new Set(['id', ...keys]))
        return dedup.filter(Boolean)
    }, [schema, allKeys])

    const filteredRows = useMemo(() => {
        const q = searchValue.trim().toLowerCase()
        if (!q) return rows

        const contains = (v: any) => {
            if (v === null || v === undefined) return false
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v).toLowerCase().includes(q)
            try {
                return JSON.stringify(v).toLowerCase().includes(q)
            } catch {
                return false
            }
        }

        if (searchField === '__any__') {
            return rows.filter(r => {
                if (String(r.id).toLowerCase().includes(q)) return true
                return Object.keys(r || {}).some(k => k !== 'id' && contains((r as any)[k]))
            })
        }

        return rows.filter(r => contains((r as any)[searchField]))
    }, [rows, searchValue, searchField])

    const loadCollections = async () => {
        setLoadingCollections(true)
        try {
            const data = await adminRequest<{ collections: string[] }>('get', '/collections')
            const list = (data.collections || []).slice().sort((a, b) => a.localeCompare(b))
            setCollections(list)
            setActiveCollection(prev => prev || list[0] || null)
        } catch (e: any) {
            message.error(e?.response?.data?.error || e?.message || 'Failed to load collections')
        } finally {
            setLoadingCollections(false)
        }
    }

    const loadDocs = async (mode: 'reset' | 'more' = 'reset') => {
        if (!activeCollection) return
        setLoadingRows(true)

        try {
            const data = await adminRequest<{ rows: AnyDoc[]; nextCursor?: string | null }>('post', '/documents/query', {
                collectionName: activeCollection,
                limit: PAGE_SIZE,
                cursor: mode === 'more' ? cursor : null
            })

            const incoming = data.rows || []
            setRows(prev => (mode === 'more' ? [...prev, ...incoming] : incoming))
            setSelectedRowKeys([])

            const next = data.nextCursor ?? null
            setCursor(next)
            setHasMore(!!next)
        } catch (e: any) {
            message.error(e?.response?.data?.error || e?.message || 'Failed to load documents')
        } finally {
            setLoadingRows(false)
        }
    }

    const didInit = useRef(false)
    useEffect(() => {
        if (didInit.current) return
        didInit.current = true
        loadCollections()
    }, [])

    useEffect(() => {
        if (!activeCollection) return
        setCursor(null)
        setHasMore(false)
        setRows([])
        setSelectedRowKeys([])
        loadDocs('reset')
    }, [activeCollection])

    const columns: ColumnsType<AnyDoc> = useMemo(() => {
        const mkSpec = (key: string): ColumnSpec => {
            const spec = schema?.columns?.[key]
            if (spec) return spec
            return { key, title: key, ellipsis: true }
        }

        const visible = effectiveVisibleKeys
            .filter(k => k === 'id' || allKeys.includes(k))
            .filter((k, idx, arr) => arr.indexOf(k) === idx)

        const base: ColumnsType<AnyDoc> = visible.map(k => {
            const spec = mkSpec(k)
            const title = spec.title || k
            return {
                title,
                dataIndex: k,
                key: k,
                width: spec.width,
                fixed: k === 'id' ? 'left' : undefined,
                ellipsis: spec.ellipsis ?? true,
                render: (v: any) => renderExplorerCell(v, spec)
            }
        })

        base.push({
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 200,
            render: (_, record) => (
                <Space>
                    <Button
                        shape='round'
                        variant='filled'
                        color='orange'
                        style={{ border: '1px solid orange' }}
                        icon={<EditOutlined />}
                        onClick={() => openEdit(record)}
                    />
                    <Popconfirm
                        title="Delete document?"
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => onDelete(record.id)}
                    >
                        <Button shape='round' variant='filled' danger icon={<DeleteOutlined />} />

                    </Popconfirm>
                </Space>
            )
        })

        return base
    }, [schema, effectiveVisibleKeys, allKeys])

    const openEdit = (doc: AnyDoc) => {
        setEditDoc(doc)
        setEditOpen(true)
        editForm.setFieldsValue({
            id: doc.id,
            json: JSON.stringify(stripId(doc), null, 2)
        })
    }

    const openCreate = () => {
        setEditDoc(null)
        setEditOpen(true)
        editForm.resetFields()
        editForm.setFieldsValue({
            id: '',
            json: '{\n  \n}'
        })
    }

    const onSave = async () => {
        if (!activeCollection) return
        const values = await editForm.validateFields()
        const id = (values.id || '').trim()

        let data: any
        try {
            data = JSON.parse(values.json)
        } catch {
            message.error('Invalid JSON')
            return
        }

        try {
            if (editDoc?.id) {
                await adminRequest('post', '/documents/update', { collectionName: activeCollection, id: editDoc.id, data })
                message.success('Updated')
            } else {
                await adminRequest('post', '/documents/create', { collectionName: activeCollection, id: id || undefined, data })
                message.success('Created')
            }
            setEditOpen(false)
            await loadDocs('reset')
        } catch (e: any) {
            message.error(e?.response?.data?.error || e?.message || 'Save failed')
        }
    }

    const onDelete = async (id: string) => {
        if (!activeCollection) return
        try {
            await adminRequest('post', '/documents/delete', { collectionName: activeCollection, id })
            message.success('Deleted')
            await loadDocs('reset')
        } catch (e: any) {
            message.error(e?.response?.data?.error || e?.message || 'Delete failed')
        }
    }

    const onBulkApply = async () => {
        if (!activeCollection) return
        const v = await bulkForm.validateFields()

        const applyTo = v.applyTo as 'selected' | 'all'
        const ids = applyTo === 'selected' ? selectedIds : null

        if (applyTo === 'selected' && (!ids || ids.length === 0)) {
            message.warning('Select rows first')
            return
        }

        try {
            if (bulkMode === 'add') {
                await adminRequest('post', '/documents/bulk-add-field', {
                    collectionName: activeCollection,
                    docIds: ids,
                    fieldPath: v.fieldPath,
                    value: coerce(v.value)
                })
                message.success('Bulk field added/updated')
            } else {
                await adminRequest('post', '/documents/bulk-delete-field', {
                    collectionName: activeCollection,
                    docIds: ids,
                    fieldPath: v.fieldPath
                })
                message.success('Bulk field deleted')
            }

            setBulkOpen(false)
            await loadDocs('reset')
        } catch (e: any) {
            message.error(e?.response?.data?.error || e?.message || 'Bulk operation failed')
        }
    }

    const totalCollections = collections.length
    const totalDocsLoaded = rows.length
    const selectedCount = selectedIds.length
    const visibleFields = effectiveVisibleKeys.filter(k => k !== 'id').length

    const overlayTip = loadingCollections ? 'Loading collections…' : loadingRows ? 'Loading documents…' : undefined

    return (
        <div style={{ padding: 16 }}>
            {(loadingCollections || loadingRows) && overlayTip ? <LoadingOverlay tip={overlayTip} /> : null}

            <Helmet>
                <title>
                    Firestore Explorer | Smart Incubation
                </title>
            </Helmet>

            <DashboardHeaderCard
                title={
                    <Space size={8}>
                        <DatabaseOutlined />
                        <span>Firestore Explorer</span>
                    </Space>
                }
                subtitle={schema?.description || 'Inspect collections, view documents, edit JSON, and run bulk field operations.'}
                subtitleTags={
                    schema?.subcollections?.length
                        ? [{ label: `Subcollections: ${schema.subcollections.join(', ')}`, color: 'geekblue' }]
                        : []
                }
                extraRight={
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                loadCollections()
                                if (activeCollection) loadDocs('reset')
                            }}
                        >
                            Refresh
                        </Button>

                        <Tooltip title="Choose which fields become table columns for this collection">
                            <Button icon={<CodeOutlined />} onClick={() => setColumnsOpen(true)} disabled={!activeCollection}>
                                Columns
                            </Button>
                        </Tooltip>

                        <Button
                            shape='round'
                            variant='filled'
                            color='geekblue'
                            style={{ border: '1px solid dodgerblue' }}
                            icon={<PlusOutlined />}
                            onClick={openCreate}
                            disabled={!activeCollection}>
                            Add Document
                        </Button>
                    </Space>
                }
            />

            <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                <Col xs={24} md={6}>
                    <MotionCard bodyStyle={{ padding: 14 }}>
                        <MotionCard.Metric
                            icon={<AppstoreOutlined style={{ color: '#1677ff', fontSize: 18 }} />}
                            iconBg="rgba(22,119,255,.12)"
                            title="Collections"
                            value={<span>{totalCollections}</span>}
                            subtitle={activeCollection ? <span>Active: {activeCollection}</span> : 'No selection'}
                        />
                    </MotionCard>
                </Col>

                <Col xs={24} md={6}>
                    <MotionCard bodyStyle={{ padding: 14 }}>
                        <MotionCard.Metric
                            icon={<DatabaseOutlined style={{ color: '#13c2c2', fontSize: 18 }} />}
                            iconBg="rgba(19,194,194,.12)"
                            title="Docs Loaded"
                            value={<span>{totalDocsLoaded}</span>}
                            subtitle={hasMore ? 'More available' : 'End of page'}
                        />
                    </MotionCard>
                </Col>

                <Col xs={24} md={6}>
                    <MotionCard bodyStyle={{ padding: 14 }}>
                        <MotionCard.Metric
                            icon={<CheckSquareOutlined style={{ color: '#52c41a', fontSize: 18 }} />}
                            iconBg="rgba(82,196,26,.12)"
                            title="Selected"
                            value={<span>{selectedCount}</span>}
                            subtitle="Row selection"
                        />
                    </MotionCard>
                </Col>

                <Col xs={24} md={6}>
                    <MotionCard bodyStyle={{ padding: 14 }}>
                        <MotionCard.Metric
                            icon={<CodeOutlined style={{ color: '#722ed1', fontSize: 18 }} />}
                            iconBg="rgba(114,46,209,.12)"
                            title="Visible Fields"
                            value={<span>{visibleFields}</span>}
                            subtitle="Table columns"
                        />
                    </MotionCard>
                </Col>
            </Row>

            <Layout style={{ marginTop: 12, borderRadius: 16, overflow: 'hidden' }}>
                <Sider width={320} theme="light" style={{ borderRight: '1px solid #f0f0f0', padding: 12, background: '#fff' }}>
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                        <div>
                            <Title level={5} style={{ margin: 0 }}>
                                Collections
                            </Title>
                            <Text type="secondary">Filter and select a collection.</Text>
                        </div>

                        <Input
                            prefix={<SearchOutlined />}
                            placeholder="Filter collections..."
                            value={collectionsFilter}
                            onChange={e => setCollectionsFilter(e.target.value)}
                        />

                        <Button icon={<ReloadOutlined />} onClick={loadCollections} block loading={loadingCollections}>
                            Reload Collections
                        </Button>

                        <Divider style={{ margin: '8px 0' }} />

                        <div style={{ height: 'calc(100vh - 360px)', overflow: 'auto', paddingRight: 4 }}>
                            <List
                                size="small"
                                dataSource={filteredCollections}
                                renderItem={item => {
                                    const active = item === activeCollection
                                    return (
                                        <List.Item
                                            onClick={() => setActiveCollection(item)}
                                            style={{
                                                cursor: 'pointer',
                                                borderRadius: 12,
                                                padding: '10px 12px',
                                                marginBottom: 8,
                                                border: active ? '1px solid #91caff' : '1px solid #f0f0f0',
                                                background: active ? '#e6f4ff' : '#fff'
                                            }}
                                        >
                                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                <Space>
                                                    <DatabaseOutlined />
                                                    <Text strong={active}>{item}</Text>
                                                </Space>
                                                {active ? <Tag color="blue">active</Tag> : null}
                                            </Space>
                                        </List.Item>
                                    )
                                }}
                            />
                        </div>
                    </Space>
                </Sider>

                <Content style={{ padding: 16, background: '#fafafa' }}>
                    <MotionCard
                        bodyStyle={{ padding: 14 }}
                        title={
                            <Space>
                                <Text strong>{activeCollection || 'No collection selected'}</Text>
                                {activeCollection ? <Tag color="geekblue">{rows.length} loaded • limit {PAGE_SIZE}</Tag> : null}
                                {hasMore ? <Tag color="blue">more available</Tag> : null}
                            </Space>
                        }
                        extra={
                            <Space wrap>
                                <Select
                                    value={searchField}
                                    style={{ width: 240 }}
                                    onChange={setSearchField}
                                    showSearch
                                    options={[
                                        { value: '__any__', label: 'Search: any field (contains)' },
                                        ...searchableKeys.slice(0, 80).map(k => ({ value: k, label: `Search: ${k} (contains)` }))
                                    ]}
                                />

                                <Input
                                    placeholder="Search value..."
                                    value={searchValue}
                                    onChange={e => setSearchValue(e.target.value)}
                                    style={{ width: 300 }}
                                    prefix={<SearchOutlined />}
                                />

                                <Button icon={<ReloadOutlined />} onClick={() => loadDocs('reset')} loading={loadingRows}>
                                    Run
                                </Button>

                                <Button onClick={() => loadDocs('more')} disabled={!hasMore || loadingRows}>
                                    Load more
                                </Button>

                                <Divider type="vertical" />

                                <Tooltip title="Bulk add/delete a field across documents">
                                    <Button icon={<SettingOutlined />} onClick={() => setBulkOpen(true)} disabled={!activeCollection}>
                                        Bulk Fields
                                    </Button>
                                </Tooltip>
                            </Space>
                        }
                    >
                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 12, borderRadius: 12 }}
                            message="Explorer tips"
                            description={
                                <div>
                                    <div>• Use Columns to lock table fields per collection.</div>
                                    <div>• Bulk ops are destructive, prefer Apply-to-selected.</div>
                                </div>
                            }
                        />

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 12,
                                padding: '10px 12px',
                                background: '#fff',
                                border: '1px solid #f0f0f0',
                                borderRadius: 12
                            }}
                        >
                            <Space>
                                <Tag color={selectedCount ? 'blue' : 'default'}>Selected: {selectedCount}</Tag>
                                <Tag>Fields found: {allKeys.length}</Tag>
                                <Tag>Columns: {effectiveVisibleKeys.length}</Tag>
                            </Space>

                            <Space>
                                <Button
                                    shape='round'
                                    variant='filled'
                                    color='orange'
                                    style={{ border: '1px solid orange' }}
                                    onClick={() => setSelectedRowKeys([])}
                                    disabled={!selectedCount}>
                                    Clear selection
                                </Button>
                                <Button
                                    shape='round'
                                    variant='filled'
                                    color='geekblue'
                                    style={{ border: '1px solid dodgerblue' }} icon={<PlusOutlined />} onClick={openCreate} disabled={!activeCollection}>
                                    Add Document
                                </Button>
                            </Space>
                        </div>

                        <Table
                            rowKey="id"
                            dataSource={filteredRows}
                            columns={columns}
                            size="middle"
                            scroll={{ x: 1200, y: 520 }}
                            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
                            pagination={{ pageSize: 12, showSizeChanger: true }}
                        />
                    </MotionCard>
                </Content>
            </Layout>

            <Modal
                open={editOpen}
                title={editDoc ? `Edit: ${editDoc.id}` : 'Create Document'}
                onCancel={() => setEditOpen(false)}
                onOk={onSave}
                okText="Save"
                width={860}
                destroyOnClose
            >
                <Form form={editForm} layout="vertical">
                    {!editDoc ? (
                        <Form.Item name="id" label="Document ID (optional)" tooltip="Leave empty to auto-generate an ID">
                            <Input />
                        </Form.Item>
                    ) : null}

                    <Form.Item name="json" label="Document JSON" rules={[{ required: true, message: 'JSON is required' }]}>
                        <Input.TextArea rows={16} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                open={bulkOpen}
                title="Bulk Field Operations"
                onCancel={() => setBulkOpen(false)}
                onOk={onBulkApply}
                okText="Apply"
                width={680}
                destroyOnClose
            >
                <Form form={bulkForm} layout="vertical" initialValues={{ applyTo: 'selected', fieldPath: '', value: '' }}>
                    <Form.Item label="Mode">
                        <Select
                            value={bulkMode}
                            onChange={v => setBulkMode(v)}
                            options={[
                                { value: 'add', label: 'Add / Update field' },
                                { value: 'delete', label: 'Delete field' }
                            ]}
                        />
                    </Form.Item>

                    <Form.Item name="applyTo" label="Apply to" rules={[{ required: true }]}>
                        <Select
                            options={[
                                { value: 'selected', label: `Selected rows (${selectedIds.length})` },
                                { value: 'all', label: 'ALL documents in this collection' }
                            ]}
                        />
                    </Form.Item>

                    <Form.Item
                        name="fieldPath"
                        label="Field path"
                        tooltip='Supports dot paths like "profile.phone"'
                        rules={[{ required: true, message: 'fieldPath required' }]}
                    >
                        <Input placeholder="e.g. companyCode" />
                    </Form.Item>

                    {bulkMode === 'add' ? (
                        <Form.Item name="value" label="Value (string/number/bool/json)">
                            <Input placeholder='e.g. LPH | 123 | true | {"a":1}' />
                        </Form.Item>
                    ) : null}

                    <Alert
                        type="warning"
                        showIcon
                        style={{ borderRadius: 12 }}
                        message="Bulk operations are destructive"
                        description="Apply-to-ALL may touch hundreds/thousands of docs. Double-check your field path."
                    />
                </Form>
            </Modal>

            <Drawer
                open={columnsOpen}
                onClose={() => setColumnsOpen(false)}
                title="Columns"
                width={520}
                destroyOnClose
                extra={
                    <Space>
                        <Button
                            onClick={() => {
                                const next = schema?.defaultVisibleKeys?.length
                                    ? schema.defaultVisibleKeys
                                    : ['id', ...allKeys.filter(k => k !== 'id').slice(0, 8)]
                                setVisibleKeys(next)
                            }}
                        >
                            Reset
                        </Button>
                        <Button type="primary" onClick={() => setColumnsOpen(false)}>
                            Done
                        </Button>
                    </Space>
                }
            >
                <Alert
                    type="info"
                    showIcon
                    style={{ borderRadius: 12, marginBottom: 12 }}
                    message={activeCollection || 'No collection selected'}
                    description="Pick fields that become table columns. Saved in component state (wire to localStorage later if needed)."
                />

                <div style={{ marginBottom: 10 }}>
                    <Text strong>Visible fields</Text>
                    <div style={{ marginTop: 8 }}>
                        <Select
                            mode="multiple"
                            style={{ width: '100%' }}
                            value={effectiveVisibleKeys}
                            onChange={setVisibleKeys}
                            showSearch
                            placeholder="Select fields…"
                            options={allKeys.map(k => ({ value: k, label: k }))}
                        />
                    </div>
                </div>

                <Divider />

                <Text strong>Quick pick</Text>
                <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                    <Button onClick={() => setVisibleKeys(['id', ...allKeys.filter(k => k !== 'id').slice(0, 8)])} block>
                        Auto (first 8 fields found)
                    </Button>
                    <Button onClick={() => setVisibleKeys(['id'])} block>
                        ID only
                    </Button>
                </div>

                <Divider />

                <Text strong>Fields found in loaded docs</Text>
                <div style={{ marginTop: 10, maxHeight: 360, overflow: 'auto', paddingRight: 6 }}>
                    <Space direction="vertical" style={{ width: '100%' }} size={6}>
                        {allKeys.map(k => {
                            const checked = effectiveVisibleKeys.includes(k)
                            return (
                                <div
                                    key={k}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 10px',
                                        border: '1px solid #f0f0f0',
                                        borderRadius: 12,
                                        background: '#fff'
                                    }}
                                >
                                    <Space>
                                        <Checkbox checked={checked} onChange={e => {
                                            const next = e.target.checked
                                                ? Array.from(new Set([...effectiveVisibleKeys, k]))
                                                : effectiveVisibleKeys.filter(x => x !== k)
                                            setVisibleKeys(next)
                                        }} />
                                        <Text>{k}</Text>
                                    </Space>

                                    {schema?.columns?.[k]?.kind ? (
                                        <Tag style={{ borderRadius: 999 }}>{schema.columns[k].kind}</Tag>
                                    ) : null}
                                </div>
                            )
                        })}
                    </Space>
                </div>
            </Drawer>
        </div>
    )
}

function stripId(doc: AnyDoc) {
    const { id, ...rest } = doc
    return rest
}

function coerce(input: string) {
    const s = String(input || '').trim()
    if (!s) return ''
    if (s === 'true') return true
    if (s === 'false') return false
    if (!Number.isNaN(Number(s)) && /^-?\d+(\.\d+)?$/.test(s)) return Number(s)
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
        try {
            return JSON.parse(s)
        } catch {
            return input
        }
    }
    return input
}
