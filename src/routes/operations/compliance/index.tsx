import React, { useMemo, useState } from 'react'
import {
    Alert,
    Button,
    Card,
    Col,
    DatePicker,
    Descriptions,
    Divider,
    Drawer,
    Form,
    Input,
    Modal,
    Progress,
    Row,
    Select,
    Space,
    Table,
    Tag,
    Tooltip,
    Typography,
    Upload,
    message
} from 'antd'
import type { UploadProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    EyeOutlined,
    FileProtectOutlined,
    PlusOutlined,
    SafetyCertificateOutlined,
    SearchOutlined,
    UploadOutlined,
    UserOutlined,
    WarningOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { motion } from 'framer-motion'
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import dayjs from 'dayjs'

import {
    EffectiveDocStatus,
    ParticipantComplianceSummary,
    RawComplianceDoc,
    buildReminderPayloads
} from '@/modules/compliance/complianceLogic'
import { useComplianceData } from '@/modules/compliance/useComplianceData'

import { documentTypes, documentStatuses } from './types'
import EDAgreementModal from './EDAgreementModal'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

type ParticipantRow = ParticipantComplianceSummary & { key: string }

const statusColor = (s: EffectiveDocStatus) => {
    if (s === 'valid') return 'green'
    if (s === 'expiring') return 'orange'
    if (s === 'expired') return 'red'
    if (s === 'missing') return 'volcano'
    if (s === 'invalid') return 'magenta'
    return 'blue'
}

const verificationColor = (v: string) => {
    if (v === 'verified') return 'green'
    if (v === 'queried') return 'red'
    return 'orange'
}

const makeStableId = () => `cd_${Date.now()}_${Math.random().toString(16).slice(2)}`

function norm(s: any) {
    return String(s ?? '').trim().toLowerCase()
}

/**
 * Ensure "invalid" exists in status dropdown even if ./types forgot it.
 * Also dedupe by value.
 */
function withInvalidStatusOptions(list: Array<{ value: string; label: string }>) {
    const base = Array.isArray(list) ? list.slice() : []
    const hasInvalid = base.some(x => norm(x.value) === 'invalid')
    if (!hasInvalid) base.push({ value: 'invalid', label: 'Invalid (Queried)' })

    const seen = new Set<string>()
    return base.filter(x => {
        const k = norm(x.value)
        if (!k) return false
        if (seen.has(k)) return false
        seen.add(k)
        return true
    })
}

const OperationsCompliance: React.FC = () => {
    const { user, loading: identityLoading } = useFullIdentity()
    const storage = getStorage()

    const { loading, error, participants, globalStats, refetch, updateDocumentInApplication, verifyDocument } =
        useComplianceData(user?.companyCode)

    // UI state
    const [searchText, setSearchText] = useState('')
    const [filterActionNeeded, setFilterActionNeeded] = useState<'all' | 'issues' | 'clean'>('all')

    const [drawerOpen, setDrawerOpen] = useState(false)
    const [activeParticipant, setActiveParticipant] = useState<ParticipantComplianceSummary | null>(null)

    // Add/Edit doc modal
    const [docModalOpen, setDocModalOpen] = useState(false)
    const [editingDoc, setEditingDoc] = useState<RawComplianceDoc | null>(null)
    const [docForm] = Form.useForm()

    // Upload state
    const [uploadingFile, setUploadingFile] = useState<File | null>(null)
    const [uploadPercent, setUploadPercent] = useState(0)
    const [isUploading, setIsUploading] = useState(false)

    // Verify modal
    const [verifyOpen, setVerifyOpen] = useState(false)
    const [verifyDoc, setVerifyDoc] = useState<any>(null)
    const [verifySubmitting, setVerifySubmitting] = useState(false)

    // ED agreement
    const [edOpen, setEdOpen] = useState(false)
    const [edParticipant, setEdParticipant] = useState<any>(null)

    const rows: ParticipantRow[] = useMemo(() => {
        return participants.map(p => ({ ...p, key: p.participantId }))
    }, [participants])

    const filteredRows = useMemo(() => {
        const q = searchText.trim().toLowerCase()
        return rows.filter(r => {
            if (filterActionNeeded === 'issues' && !r.actionNeeded) return false
            if (filterActionNeeded === 'clean' && r.actionNeeded) return false

            if (!q) return true
            return (
                r.beneficiaryName.toLowerCase().includes(q) ||
                (r.email || '').toLowerCase().includes(q) ||
                (r.phone || '').toLowerCase().includes(q)
            )
        })
    }, [rows, searchText, filterActionNeeded])

    const isCompliant = (status: EffectiveDocStatus) =>
        status === 'valid' || status === 'expiring'

    const participantColumns: ColumnsType<ParticipantRow> = [
        {
            title: 'Participant',
            dataIndex: 'beneficiaryName',
            key: 'beneficiaryName',
            sorter: (a, b) => a.beneficiaryName.localeCompare(b.beneficiaryName),
            render: (_, r) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{r.beneficiaryName}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.email || 'No email'} {r.phone ? `• ${r.phone}` : ''}
                    </Text>
                </Space>
            )
        },
        {
            title: 'Compliance',
            key: 'complianceScore',
            sorter: (a, b) => (a.complianceScore || 0) - (b.complianceScore || 0),
            render: (_, r) => {
                const docs = Array.isArray((r as any).docs) ? (r as any).docs : []
                const total = docs.length

                const compliantCount = docs.filter((d: any) =>
                    isCompliant(d.effectiveStatus as EffectiveDocStatus)
                ).length

                const percent = total > 0 ? Math.round((compliantCount / total) * 100) : 0
                const fullyCompliant = total > 0 && compliantCount === total

                return (
                    <Space direction="vertical" style={{ width: 220 }}>
                        <Space align="center">
                            <Progress percent={percent} size="small" style={{ width: 170 }} />
                            {fullyCompliant ? (
                                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            ) : (
                                <WarningOutlined style={{ color: '#faad14' }} />
                            )}
                        </Space>

                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {compliantCount}/{total} compliant
                        </Text>
                    </Space>
                )
            }
        }
        ,
        {
            title: 'Issues',
            key: 'issues',
            render: (_, r) => (
                <Space wrap>
                    {r.counts.missing > 0 && <Tag color="volcano">Missing: {r.counts.missing}</Tag>}
                    {r.counts.expired > 0 && <Tag color="red">Expired: {r.counts.expired}</Tag>}
                    {r.counts.queried > 0 && <Tag color="magenta">Queried: {r.counts.queried}</Tag>}
                    {r.counts.expiring > 0 && <Tag color="orange">Expiring: {r.counts.expiring}</Tag>}
                    {!r.actionNeeded && <Tag color="green">All good</Tag>}
                </Space>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, r) => (
                <Space>
                    <Tooltip title="Open participant">
                        <Button
                            type="primary"
                            ghost
                            icon={<SafetyCertificateOutlined />}
                            onClick={() => {
                                setActiveParticipant(r)
                                setDrawerOpen(true)
                            }}
                        >
                            Manage
                        </Button>
                    </Tooltip>

                    <Tooltip title="Contact">
                        <Button
                            icon={<UserOutlined />}
                            onClick={() => {
                                Modal.info({
                                    title: `Contact ${r.beneficiaryName}`,
                                    content: (
                                        <div>
                                            <p><strong>Email:</strong> {r.email || 'N/A'}</p>
                                            <p><strong>Phone:</strong> {r.phone || 'N/A'}</p>
                                        </div>
                                    )
                                })
                            }}
                        />
                    </Tooltip>
                </Space>
            )
        }
    ]


    const uploadProps: UploadProps = {
        beforeUpload: file => {
            setUploadingFile(file as any)
            return false
        },
        showUploadList: true
    }

    const openAddDocModal = (participant?: ParticipantComplianceSummary, doc?: any) => {
        setEditingDoc(doc || null)
        setDocModalOpen(true)

        if (doc) {
            docForm.setFieldsValue({
                participantId: participant?.participantId || doc.participantId,
                type: doc.type,
                documentName: doc.documentName,
                status: doc.statusRaw || doc.status,
                issueDate: doc.issue ? doc.issue : doc.issueDate ? dayjs(doc.issueDate) : null,
                expiryDate: doc.expiry ? doc.expiry : doc.expiryDate ? dayjs(doc.expiryDate) : null,
                notes: doc.notes
            })
        } else {
            docForm.resetFields()
            docForm.setFieldsValue({ participantId: participant?.participantId })
        }
    }

    const saveDoc = async (values: any) => {
        try {
            const participantId = values.participantId
            if (!participantId) throw new Error('Missing participantId')

            const performSave = async (url: string) => {
                await updateDocumentInApplication(participantId, (docs) => {
                    const next: RawComplianceDoc = {
                        id: editingDoc?.id || makeStableId(),
                        participantId,
                        type: values.type,
                        documentName: values.documentName,
                        status: values.status,
                        issueDate: values.issueDate ? values.issueDate.format('YYYY-MM-DD') : '',
                        expiryDate: values.expiryDate ? values.expiryDate.format('YYYY-MM-DD') : '',
                        notes: values.notes ?? '',
                        url,
                        uploadedBy: user?.name || 'Unknown',
                        uploadedAt: new Date().toISOString().split('T')[0],

                        // preserve verification fields on edit
                        lastVerifiedBy: editingDoc?.lastVerifiedBy,
                        lastVerifiedAt: editingDoc?.lastVerifiedAt,
                        verificationStatus: editingDoc?.verificationStatus || 'unverified',
                        verificationComment: editingDoc?.verificationComment || ''
                    }

                    if (editingDoc?.id) {
                        return docs.map(d => (d.id === editingDoc.id ? next : d))
                    }
                    return [...docs, next]
                })

                message.success(editingDoc ? 'Document updated' : 'Document added')
                setUploadingFile(null)
                setUploadPercent(0)
                setDocModalOpen(false)
                docForm.resetFields()
            }

            // Upload file if provided
            if (uploadingFile) {
                setIsUploading(true)
                const storageRef = ref(storage, `compliance-documents/${Date.now()}-${uploadingFile.name}`)
                const task = uploadBytesResumable(storageRef, uploadingFile)

                task.on(
                    'state_changed',
                    snap => {
                        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
                        setUploadPercent(pct)
                    },
                    err => {
                        console.error(err)
                        message.error('Upload failed')
                        setIsUploading(false)
                    },
                    async () => {
                        const url = await getDownloadURL(task.snapshot.ref)
                        setIsUploading(false)
                        await performSave(url)
                    }
                )
            } else {
                const url = editingDoc?.url || ''
                await performSave(url)
            }
        } catch (e: any) {
            console.error(e)
            message.error(e?.message || 'Failed to save document')
            setIsUploading(false)
        }
    }


    const openVerify = (docRow: any) => {
        setVerifyDoc(docRow)
        setVerifyOpen(true)
        setVerifySubmitting(false)
    }

    const doVerify = async (status: 'verified' | 'queried', comment?: string) => {
        if (!activeParticipant || !verifyDoc || verifySubmitting) return
        setVerifySubmitting(true)
        try {
            await verifyDocument(
                activeParticipant.participantId,
                verifyDoc.id,
                { type: verifyDoc.type, documentName: verifyDoc.documentName, expiryDate: verifyDoc.expiryDate },
                status,
                comment,
                user?.name
            )
            message.success(status === 'verified' ? '✅ Verified' : '❌ Queried')
            setVerifyOpen(false)
        } catch (e: any) {
            console.error(e)
            message.error(e?.message || 'Failed to update verification')
        } finally {
            setVerifySubmitting(false)
        }
    }

    const sendBulkReminders = async () => {
        try {
            const payloads = buildReminderPayloads(participants)
            if (!payloads.length) {
                message.info('No reminders to send.')
                return
            }

            const sendReminder = httpsCallable(functions, 'sendComplianceReminderEmail')
            await Promise.all(
                payloads.map(async p => {
                    await sendReminder({
                        email: p.email,
                        name: p.name,
                        issues: p.issues.map(i => `${i.type}${i.documentName ? ` - ${i.documentName}` : ''} (${i.status})`)
                    })
                })
            )

            message.success(`📧 Sent ${payloads.length} reminder(s)`)
        } catch (e) {
            console.error(e)
            message.error('Failed to send reminders')
        }
    }

    const openEDAgreement = (p: ParticipantComplianceSummary) => {
        setEdParticipant({ id: p.participantId, name: p.beneficiaryName, email: p.email, phone: p.phone })
        setEdOpen(true)
    }

    const docColumns: ColumnsType<any> = [
        {
            title: 'Type',
            dataIndex: 'type',
            render: (v: string) => documentTypes.find(t => t.value === v || t.label === v)?.label || v
        },
        {
            title: 'Status',
            key: 'status',
            render: (_: any, r: any) => (
                <Tag color={statusColor(r.effectiveStatus)}>
                    {String(r.effectiveStatus || '').toUpperCase()}
                </Tag>
            ),
            filters: [
                { text: 'Valid', value: 'valid' },
                { text: 'Expiring', value: 'expiring' },
                { text: 'Expired', value: 'expired' },
                { text: 'Missing', value: 'missing' },
                { text: 'Pending', value: 'pending' },
                { text: 'Invalid', value: 'invalid' }
            ],
            onFilter: (value: any, record: any) => record.effectiveStatus === value
        },
        {
            title: 'Verification',
            key: 'verification',
            render: (_: any, r: any) => (
                <Tag color={verificationColor(r.verificationStatusRaw)}>
                    {String(r.verificationStatusRaw || 'unverified').toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Query message',
            key: 'queryMessage',
            render: (_: any, r: any) => {
                const isQueried = norm(r.verificationStatusRaw) === 'queried'
                const msg = String(r.verificationComment || r.verificationCommentRaw || '').trim()

                if (!isQueried) return <Text type="secondary">—</Text>

                return msg ? (
                    <Tooltip title={msg}>
                        <Tag color="red" style={{ cursor: 'pointer' }}>View</Tag>
                    </Tooltip>
                ) : (
                    <Tag color="red">Queried (no reason)</Tag>
                )
            }
        },
        {
            title: 'Expiry',
            dataIndex: 'expiryDate',
            render: (_: any, r: any) => (r.expiry ? r.expiry.format('DD MMM YYYY') : 'N/A'),
            sorter: (a: any, b: any) => (a.expiry?.valueOf?.() || 0) - (b.expiry?.valueOf?.() || 0)
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, r: any) => (
                <Space>
                    {r.url && (
                        <Tooltip title="View">
                            <Button icon={<EyeOutlined />} onClick={() => window.open(r.url, '_blank')} />
                        </Tooltip>
                    )}

                    <Tooltip title="Edit">
                        <Button onClick={() => openAddDocModal(activeParticipant!, r)}>Edit</Button>
                    </Tooltip>

                    {r.url && norm(r.verificationStatusRaw) === 'unverified' && (
                        <Tooltip title="Verify / Query">
                            <Button icon={<FileProtectOutlined />} onClick={() => openVerify(r)} />
                        </Tooltip>
                    )}
                </Space>
            )
        }
    ]

    const statusOptions = useMemo(
        () => withInvalidStatusOptions(documentStatuses as any),
        []
    )

    return (
        <div style={{ minHeight: '100vh', padding: 16 }}>
            <Helmet>
                <title>Compliance | Smart Incubation</title>
            </Helmet>

            {error && (
                <Alert
                    message="Failed to load compliance data"
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            {/* Metric cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
                {[
                    {
                        title: 'Participants',
                        value: globalStats.totalParticipants,
                        icon: <SafetyCertificateOutlined />,
                        color: '#1890ff',
                        bg: '#e6f7ff'
                    },
                    {
                        title: 'Documents',
                        value: globalStats.totalDocuments,
                        icon: <SafetyCertificateOutlined />,
                        color: '#2f54eb',
                        bg: '#f0f5ff'
                    },
                    {
                        title: 'Action Needed',
                        value: globalStats.participantsActionNeeded,
                        icon: <WarningOutlined />,
                        color: '#faad14',
                        bg: '#fffbe6'
                    },
                    {
                        title: 'Avg Score',
                        value: `${globalStats.avgComplianceScore}%`,
                        icon: <CheckCircleOutlined />,
                        color: '#52c41a',
                        bg: '#f6ffed'
                    },
                    {
                        title: 'Expired',
                        value: globalStats.statusCounts.expired,
                        icon: <CloseCircleOutlined />,
                        color: '#f5222d',
                        bg: '#fff2f0'
                    },
                    {
                        title: 'Missing',
                        value: globalStats.statusCounts.missing,
                        icon: <WarningOutlined />,
                        color: '#fa541c',
                        bg: '#fff2e8'
                    }
                ].map((m, idx) => (
                    <Col xs={24} sm={12} md={8} lg={4} key={m.title}>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: idx * 0.05 }}
                        >
                            <Card
                                loading={loading || identityLoading}
                                style={{ borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
                            >
                                <Space>
                                    <div
                                        style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: 999,
                                            background: m.bg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {React.cloneElement(m.icon as any, { style: { color: m.color } })}
                                    </div>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>{m.title}</Text>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
                                    </div>
                                </Space>
                            </Card>
                        </motion.div>
                    </Col>
                ))}
            </Row>

            {/* Filters */}
            <Card style={{ borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.08)', marginBottom: 12 }}>
                <Row gutter={[12, 12]} align="middle" justify="space-between">
                    <Col>
                        <Space wrap>
                            <Input
                                style={{ width: 320 }}
                                prefix={<SearchOutlined />}
                                placeholder="Search participant (name/email/phone)"
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                            />

                            <Select value={filterActionNeeded} onChange={setFilterActionNeeded} style={{ width: 220 }}>
                                <Option value="all">All participants</Option>
                                <Option value="issues">Only action needed</Option>
                                <Option value="clean">Only compliant</Option>
                            </Select>

                            <Button onClick={refetch}>Refresh</Button>
                        </Space>
                    </Col>

                    <Col>
                        <Space wrap>
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => openAddDocModal()}>
                                Add Document
                            </Button>
                            <Button icon={<UserOutlined />} onClick={sendBulkReminders}>
                                Send Email Reminders
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Card>

            {/* Participant table */}
            <Card style={{ borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}>
                <Table
                    columns={participantColumns}
                    dataSource={filteredRows}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    rowKey="key"
                />
            </Card>

            {/* Participant drawer */}
            <Drawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={980}
                title={activeParticipant ? `Compliance • ${activeParticipant.beneficiaryName}` : 'Compliance'}
                extra={
                    activeParticipant ? (
                        <Space>
                            <Button type="primary" onClick={() => openAddDocModal(activeParticipant)}>
                                Upload Doc
                            </Button>
                        </Space>
                    ) : null
                }
            >
                {activeParticipant ? (
                    <>
                        <Descriptions bordered size="small" column={2}>
                            <Descriptions.Item label="Participant">{activeParticipant.beneficiaryName}</Descriptions.Item>
                            <Descriptions.Item label="Compliance Score">{activeParticipant.complianceScore}%</Descriptions.Item>
                            <Descriptions.Item label="Email">{activeParticipant.email || 'N/A'}</Descriptions.Item>
                            <Descriptions.Item label="Phone">{activeParticipant.phone || 'N/A'}</Descriptions.Item>
                        </Descriptions>

                        <Divider />

                        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                            {(['valid', 'expiring', 'expired', 'missing', 'pending', 'invalid'] as EffectiveDocStatus[]).map(s => (
                                <Col key={s}>
                                    <Tag color={statusColor(s)} style={{ padding: '4px 10px', fontSize: 12 }}>
                                        {s.toUpperCase()}: {activeParticipant.counts[s]}
                                    </Tag>
                                </Col>
                            ))}
                            <Col>
                                <Tag color="green" style={{ padding: '4px 10px', fontSize: 12 }}>
                                    VERIFIED: {activeParticipant.counts.verified}
                                </Tag>
                            </Col>
                            <Col>
                                <Tag color="red" style={{ padding: '4px 10px', fontSize: 12 }}>
                                    QUERIED: {activeParticipant.counts.queried}
                                </Tag>
                            </Col>
                        </Row>

                        <Table
                            columns={docColumns}
                            dataSource={activeParticipant.docs}
                            rowKey={(r: any) => r.id || `${r.type}_${r.documentName}_${r.expiryDate}`}
                            pagination={{ pageSize: 8 }}
                        />
                    </>
                ) : (
                    <Text type="secondary">Select a participant to manage compliance.</Text>
                )}
            </Drawer>

            {/* Add/Edit Document Modal */}
            <Modal
                open={docModalOpen}
                onCancel={() => setDocModalOpen(false)}
                title={editingDoc ? 'Edit Document' : 'Add Document'}
                footer={null}
                width={820}
            >
                <Form form={docForm} layout="vertical" onFinish={saveDoc}>
                    <Form.Item name="participantId" label="Participant" rules={[{ required: true }]}>
                        <Select placeholder="Select participant">
                            {participants.map(p => (
                                <Option key={p.participantId} value={p.participantId}>
                                    {p.beneficiaryName}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="type" label="Document Type" rules={[{ required: true }]}>
                        <Select placeholder="Select type">
                            {documentTypes.map(t => (
                                <Option key={t.value} value={t.value}>{t.label}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="documentName" label="Document Name" rules={[{ required: true }]}>
                        <Input placeholder="Enter document name" />
                    </Form.Item>

                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item name="issueDate" label="Issue Date">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="expiryDate" label="Expiry Date">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* ✅ includes INVALID */}
                    <Form.Item name="status" label="Stored Status" rules={[{ required: true }]}>
                        <Select placeholder="Select status">
                            {statusOptions.map(s => (
                                <Option key={s.value} value={s.value}>{s.label}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="notes" label="Notes">
                        <TextArea rows={3} placeholder="Optional notes" />
                    </Form.Item>

                    <Form.Item label="Document File">
                        <Upload
                            beforeUpload={file => {
                                setUploadingFile(file as any)
                                return false
                            }}
                            showUploadList
                        >
                            <Button icon={<UploadOutlined />}>Choose file</Button>
                        </Upload>

                        {isUploading && (
                            <div style={{ marginTop: 8 }}>
                                <Progress percent={uploadPercent} />
                            </div>
                        )}
                    </Form.Item>

                    <Row justify="end" gutter={8}>
                        <Col>
                            <Button onClick={() => setDocModalOpen(false)}>Cancel</Button>
                        </Col>
                        <Col>
                            <Button type="primary" htmlType="submit" disabled={isUploading}>
                                {isUploading ? 'Uploading...' : 'Save'}
                            </Button>
                        </Col>
                    </Row>
                </Form>
            </Modal>

            {/* Verify modal */}
            <Modal
                open={verifyOpen}
                onCancel={() => setVerifyOpen(false)}
                title="Verify Document"
                footer={null}
            >
                {verifyDoc && (
                    <>
                        {norm(verifyDoc?.verificationStatusRaw) === 'queried' && (
                            <Alert
                                type="warning"
                                showIcon
                                message="Previously queried"
                                description={
                                    String(verifyDoc?.verificationComment || '').trim()
                                        ? verifyDoc.verificationComment
                                        : 'No query message saved.'
                                }
                                style={{ marginBottom: 12 }}
                            />
                        )}

                        <Alert
                            type={verifyDoc.effectiveStatus === 'invalid' ? 'warning' : 'info'}
                            showIcon
                            message="Verification decision"
                            description="Verify if correct. Query if something is wrong (reason required)."
                            style={{ marginBottom: 12 }}
                        />

                        <Descriptions bordered size="small" column={1} style={{ marginBottom: 12 }}>
                            <Descriptions.Item label="Type">{verifyDoc.type}</Descriptions.Item>
                            <Descriptions.Item label="Document">{verifyDoc.documentName || 'N/A'}</Descriptions.Item>
                            <Descriptions.Item label="Effective Status">
                                <Tag color={statusColor(verifyDoc.effectiveStatus)}>{verifyDoc.effectiveStatus}</Tag>
                            </Descriptions.Item>
                        </Descriptions>

                        <Form layout="vertical" onFinish={(v) => doVerify('queried', v.reason)}>
                            <Form.Item
                                name="reason"
                                label="Reason (required to query)"
                                rules={[{ required: true, message: 'Please enter a reason for the query.' }]}
                            >
                                <TextArea rows={3} placeholder="Why is this document being queried?" />
                            </Form.Item>

                            <Row justify="end" gutter={8}>
                                <Col>
                                    <Button onClick={() => setVerifyOpen(false)} disabled={verifySubmitting}>
                                        Cancel
                                    </Button>
                                </Col>
                                <Col>
                                    <Button
                                        type="default"
                                        htmlType="submit"
                                        disabled={verifySubmitting}
                                        loading={verifySubmitting}
                                    >
                                        Query
                                    </Button>
                                </Col>
                                <Col>
                                    <Button
                                        type="primary"
                                        onClick={() => doVerify('verified')}
                                        disabled={verifySubmitting}
                                        loading={verifySubmitting}
                                    >
                                        Verify
                                    </Button>
                                </Col>
                            </Row>
                        </Form>
                    </>
                )}
            </Modal>

            {/* ED Agreement modal */}
            <EDAgreementModal
                visible={edOpen}
                onCancel={() => setEdOpen(false)}
                participant={edParticipant}
                onSave={() => {
                    message.success('ED agreement generated')
                    setEdOpen(false)
                    refetch()
                }}
            />
        </div>
    )
}

export default OperationsCompliance
