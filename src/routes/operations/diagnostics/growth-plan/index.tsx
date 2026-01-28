// GrowthPlanPage.tsx (updated modal: table-first, select-multiple, filter by Area first + keyword for title)

import React, { useEffect, useMemo, useState } from 'react'
import {
    Card,
    Typography,
    Spin,
    Table,
    Divider,
    message,
    Button,
    Modal,
    Form,
    Input,
    Select,
    Space,
    Tag
} from 'antd'
import {
    doc,
    getDocs,
    getDoc,
    query,
    collection,
    where,
    updateDoc
} from 'firebase/firestore'
import { db } from '@/firebase'
import dayjs from 'dayjs'
import { DeleteOutlined } from '@ant-design/icons'
import { CompanyLogo } from '@/components/CompanyLogo'

const { Text, Paragraph } = Typography
const { Option } = Select

// ---------- Helpers ----------
const normalizeFsDate = (v: any): Date | null => {
    if (!v) return null
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v
    if (typeof v === 'string') {
        const d = new Date(v)
        return isNaN(d.getTime()) ? null : d
    }
    if (v && typeof v.toDate === 'function') {
        const d = v.toDate()
        return isNaN(d.getTime()) ? null : d
    }
    if (v && typeof v.seconds === 'number') {
        const d = new Date(v.seconds * 1000)
        return isNaN(d.getTime()) ? null : d
    }
    return null
}

const asList = (v: any): string[] => {
    if (!v) return []
    if (Array.isArray(v)) return v.filter(Boolean).map(String)
    if (typeof v === 'string') {
        return v
            .split(/\n|,/g)
            .map(s => s.trim())
            .filter(Boolean)
    }
    return []
}

const pickSWOT = (app: any) => {
    const swot =
        app?.swot ||
        app?.SWOT ||
        app?.swotAnalysis ||
        app?.analysis?.swot ||
        app?.aiEvaluation?.swot ||
        null

    if (!swot || typeof swot !== 'object') {
        return { strengths: [], weaknesses: [], opportunities: [], threats: [] }
    }

    const strengths = asList(swot.strengths ?? swot.Strengths ?? swot.S)
    const weaknesses = asList(swot.weaknesses ?? swot.Weaknesses ?? swot.W)
    const opportunities = asList(swot.opportunities ?? swot.Opportunities ?? swot.O)
    const threats = asList(swot.threats ?? swot.Threats ?? swot.T)

    return { strengths, weaknesses, opportunities, threats }
}

const GrowthPlanPage = ({ participant }: { participant: any }) => {
    const [loading, setLoading] = useState(true)
    const [applicationData, setApplicationData] = useState<any>(null)
    const [interventions, setInterventions] = useState<any[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [form] = Form.useForm()

    const [availableInterventions, setAvailableInterventions] = useState<any[]>([])

    // NEW modal filters
    const [selectedAreas, setSelectedAreas] = useState<string[]>([]) // multi-select
    const [titleKeyword, setTitleKeyword] = useState('')
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

    const confirmByOperations = async () => {
        try {
            const appSnap = await getDocs(
                query(
                    collection(db, 'applications'),
                    where('email', '==', participant.email),
                    where('applicationStatus', 'in', ['accepted', 'Accepted'])
                )
            )
            if (appSnap.empty) return

            const appDoc = appSnap.docs[0]
            const appRef = appDoc.ref
            const appData = appDoc.data()

            await updateDoc(appRef, {
                interventions: {
                    ...(appData?.interventions || {}),
                    confirmedBy: { ...(appData?.interventions?.confirmedBy || {}), operations: true }
                },
                confirmedAt: new Date().toISOString()
            })

            message.success('Growth plan confirmed!')
            await fetchData()
        } catch (error) {
            console.error('❌ Failed to confirm growth plan:', error)
            message.error('Error during confirmation')
        }
    }

    const handleDeleteIntervention = async (record: any) => {
        try {
            const appSnap = await getDocs(
                query(
                    collection(db, 'applications'),
                    where('email', '==', participant.email),
                    where('applicationStatus', 'in', ['accepted', 'Accepted'])
                )
            )
            if (appSnap.empty) return

            const appRef = appSnap.docs[0].ref
            const appData = appSnap.docs[0].data()
            const existingRequired = appData?.interventions?.required || []
            const aiEvaluation = appData?.aiEvaluation || {}

            if (record.source === 'SME' || record.source === 'System') {
                const updatedRequired = existingRequired.filter((i: any) => {
                    const id = typeof i === 'string' ? i : i?.id
                    return id !== record.id
                })
                await updateDoc(appRef, { 'interventions.required': updatedRequired })
                message.success('Intervention removed from required.')
            }

            if (record.source === 'AI') {
                const recs = aiEvaluation['Recommended Interventions'] || {}
                const area = record.areaOfSupport

                if (recs[area]) {
                    const updatedAreaList = (recs[area] || []).filter(
                        (title: string) => title !== record.interventionTitle
                    )
                    if (updatedAreaList.length === 0) delete recs[area]
                    else recs[area] = updatedAreaList

                    await updateDoc(appRef, { 'aiEvaluation.Recommended Interventions': recs })
                    message.success('AI intervention removed from evaluation.')
                }
            }

            setInterventions(prev => prev.filter(i => i.id !== record.id))
            await fetchData()
        } catch (err) {
            console.error('Error deleting intervention:', err)
            message.error('Could not delete intervention.')
        }
    }

    // ✅ NEW: Add multiple selected from TABLE (no free response)
    const handleAddMultipleSelected = async () => {
        try {
            if (selectedRowKeys.length === 0) {
                message.warning('Select at least one intervention from the table.')
                return
            }

            const selected = filteredAvailableInterventions.filter((i: any) =>
                selectedRowKeys.includes(i.id)
            )
            if (!selected.length) {
                message.error('Nothing selected.')
                return
            }

            const appSnap = await getDocs(
                query(
                    collection(db, 'applications'),
                    where('email', '==', participant.email),
                    where('applicationStatus', 'in', ['accepted', 'Accepted'])
                )
            )
            if (appSnap.empty) return message.error('Application not found.')

            const appRef = appSnap.docs[0].ref
            const appData = appSnap.docs[0].data()
            const existingRequired = appData?.interventions?.required || []

            const existingIds = new Set(
                (existingRequired || []).map((x: any) => (typeof x === 'string' ? x : x?.id))
            )

            const additions = selected
                .filter((i: any) => i?.id && i?.interventionTitle && i?.areaOfSupport)
                .filter((i: any) => !existingIds.has(i.id))
                .map((i: any) => ({
                    id: i.id,
                    title: i.interventionTitle,
                    area: i.areaOfSupport
                }))

            if (!additions.length) {
                message.info('All selected items were already added.')
                return
            }

            await updateDoc(appRef, {
                'interventions.required': [...existingRequired, ...additions]
            })

            message.success(`${additions.length} intervention(s) added.`)

            setIsModalOpen(false)
            setSelectedRowKeys([])
            setSelectedAreas([])
            setTitleKeyword('')
            form.resetFields()

            await fetchData()
        } catch (err) {
            console.error(err)
            message.error('Error adding interventions.')
        }
    }

    const fetchData = async () => {
        setLoading(true)
        try {
            const appSnap = await getDocs(
                query(
                    collection(db, 'applications'),
                    where('email', '==', participant.email),
                    where('applicationStatus', 'in', ['accepted', 'Accepted'])
                )
            )
            if (appSnap.empty) {
                setApplicationData(null)
                setInterventions([])
                setAvailableInterventions([])
                return
            }

            const appDoc = appSnap.docs[0]
            const app = appDoc.data()
            const appRef = appDoc.ref

            setApplicationData({
                ...app,
                confirmedAt: app?.confirmedAt || null,
                digitalSignature: app?.digitalSignature || null
            })

            const userSnap = await getDocs(
                query(collection(db, 'users'), where('email', '==', participant.email))
            )
            if (!userSnap.empty) {
                const userData = userSnap.docs[0].data()
                setApplicationData((prev: any) => ({
                    ...prev,
                    userSignatureURL: userData.signatureURL || null
                }))
            }

            // Normalize required interventions
            const allRequired: any[] = []
            const normalizedRequired: any[] = []

            for (const entry of app?.interventions?.required || []) {
                if (typeof entry === 'string') {
                    const intvSnap = await getDoc(doc(db, 'interventions', entry))
                    if (intvSnap.exists()) {
                        const intvData: any = intvSnap.data()
                        const norm = {
                            id: entry,
                            title: intvData.interventionTitle || '',
                            area: intvData.areaOfSupport || ''
                        }
                        allRequired.push({
                            id: entry,
                            interventionTitle: norm.title,
                            areaOfSupport: norm.area,
                            source: 'SME',
                            confirmedAt: null
                        })
                        normalizedRequired.push(norm)
                    }
                } else {
                    allRequired.push({
                        id: entry.id,
                        interventionTitle: entry.title || '',
                        areaOfSupport: entry.area || '',
                        source: 'SME',
                        confirmedAt: null
                    })
                    normalizedRequired.push(entry)
                }
            }

            if (normalizedRequired.length > 0) {
                await updateDoc(appRef, { 'interventions.required': normalizedRequired })
            }

            // AI recs
            let aiRecommended: any[] = []
            if (typeof app?.aiEvaluation?.['Recommended Interventions'] === 'object') {
                const recs = app.aiEvaluation['Recommended Interventions']
                aiRecommended = Object.entries(recs).flatMap(([area, items]) =>
                    (items as any[]).map((title: string, i: number) => ({
                        id: `ai-${area}-${i}`,
                        interventionTitle: title,
                        areaOfSupport: area,
                        source: 'AI',
                        confirmedAt: null
                    }))
                )
            }

            setInterventions([...allRequired, ...aiRecommended])

            // Load all system interventions
            const companyCode = app?.companyCode || 'RCM'
            const intvSnap = await getDocs(
                query(collection(db, 'interventions'), where('companyCode', '==', companyCode))
            )
            const allInterventions = intvSnap.docs.map(d => ({ id: d.id, ...d.data() }))

            // Exclude required + AI titles
            const requiredIds = new Set(allRequired.map(i => i.id))
            const aiTitles = new Set(aiRecommended.map(i => i.interventionTitle))

            const available = allInterventions.filter((intv: any) => {
                if (requiredIds.has(intv.id)) return false
                if (aiTitles.has(intv.interventionTitle)) return false
                return true
            })

            setAvailableInterventions(available)
        } catch (err) {
            console.error('Error fetching growth plan data', err)
            message.error('Failed to fetch participant data.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [participant?.email])

    // ---------- SWOT ----------
    const swot = useMemo(() => pickSWOT(applicationData), [applicationData])

    const swotRows = useMemo(() => {
        const maxLen = Math.max(
            swot.strengths.length,
            swot.weaknesses.length,
            swot.opportunities.length,
            swot.threats.length
        )
        if (maxLen === 0) return []
        return Array.from({ length: maxLen }).map((_, idx) => ({
            key: String(idx),
            strengths: swot.strengths[idx] || '—',
            weaknesses: swot.weaknesses[idx] || '—',
            opportunities: swot.opportunities[idx] || '—',
            threats: swot.threats[idx] || '—'
        }))
    }, [swot])

    // ---------- Modal: Area-first filter + keyword title filter ----------
    const areaOptions = useMemo(() => {
        const areas = new Set<string>()
        availableInterventions.forEach((i: any) => {
            if (i?.areaOfSupport) areas.add(String(i.areaOfSupport))
        })
        return Array.from(areas).sort((a, b) => a.localeCompare(b))
    }, [availableInterventions])

    const filteredAvailableInterventions = useMemo(() => {
        let list = [...availableInterventions]

        // ✅ Area of Support multi-select first (core requirement)
        if (selectedAreas.length) {
            const selected = new Set(selectedAreas.map(String))
            list = list.filter((i: any) => selected.has(String(i.areaOfSupport)))
        }

        // ✅ Keyword filter for title (secondary requirement)
        if (titleKeyword.trim()) {
            const kw = titleKeyword.toLowerCase()
            list = list.filter((i: any) =>
                String(i.interventionTitle || '').toLowerCase().includes(kw)
            )
        }

        list.sort((a: any, b: any) =>
            String(a.interventionTitle || '').localeCompare(String(b.interventionTitle || ''))
        )

        return list
    }, [availableInterventions, selectedAreas, titleKeyword])

    if (loading) return <Spin style={{ marginTop: 48 }} tip='Loading participant details...' />
    if (!applicationData) return <Paragraph>No application found for this participant.</Paragraph>

    return (
        <Card bordered={false} style={{ padding: 24, marginTop: 10 }}>
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    marginBottom: 24,
                    justifyContent: 'space-between'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #d9d9d9',
                        borderRadius: 8,
                        padding: 24,
                        marginBottom: 24,
                        width: '100%',
                        boxSizing: 'border-box'
                    }}
                >
                    <div
                        style={{
                            width: 200,
                            height: 100,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 24
                        }}
                    >
                        <CompanyLogo collapsed={false} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <Text style={{ fontSize: 18, fontWeight: 500 }}>
                            {participant.beneficiaryName || 'Participant'}
                        </Text>
                        <Text style={{ fontSize: 36, fontWeight: 700, color: '#222' }}>
                            Growth Plan
                        </Text>
                    </div>
                </div>
            </div>

            <Divider>Business Overview</Divider>
            <Text strong>Business Owner:</Text> {participant.participantName || 'N/A'}
            <br />
            <Text strong>Sector:</Text> {participant.sector}
            <br />
            <Text strong>Province:</Text> {participant.province}
            <br />
            <Text strong>City:</Text> {participant.city}
            <br />
            <Text strong>Years Trading:</Text> {participant.yearsOfTrading || 'N/A'}
            <br />
            <Text strong>Date of Registration:</Text>{' '}
            {participant.dateOfRegistration?.toDate
                ? dayjs(participant.dateOfRegistration.toDate()).format('YYYY-MM-DD')
                : participant.dateOfRegistration || 'N/A'}
            <br />

            <Divider>Application Summary</Divider>
            <Text strong>Motivation:</Text> {applicationData.motivation || '—'}
            <br />
            <Text strong>Challenges:</Text> {applicationData.challenges || '—'}
            <br />
            <Text strong>Stage:</Text> {applicationData.stage || '—'}
            <br />
            <Text strong>Compliance Score:</Text>{' '}
            {typeof applicationData.complianceScore === 'number'
                ? `${applicationData.complianceScore}%`
                : applicationData.complianceScore
                    ? `${applicationData.complianceScore}%`
                    : '—'}
            <br />

            <Divider>SWOT Analysis</Divider>
            {swotRows.length ? (
                <Table
                    size='small'
                    bordered
                    pagination={false}
                    dataSource={swotRows}
                    rowKey='key'
                    columns={[
                        { title: 'Strengths', dataIndex: 'strengths' },
                        { title: 'Weaknesses', dataIndex: 'weaknesses' },
                        { title: 'Opportunities', dataIndex: 'opportunities' },
                        { title: 'Threats', dataIndex: 'threats' }
                    ]}
                />
            ) : (
                <Text type='secondary'>No SWOT data found on the application.</Text>
            )}

            <Divider>Interventions</Divider>

            <div style={{ textAlign: 'right', marginBottom: 12 }}>
                <Button type='primary' onClick={() => setIsModalOpen(true)}>
                    + Add New Intervention
                </Button>
            </div>

            <Table
                size='small'
                bordered
                dataSource={interventions}
                style={{ marginBottom: 10 }}
                columns={[
                    { title: 'Title', dataIndex: 'interventionTitle' },
                    { title: 'Area', dataIndex: 'areaOfSupport' },
                    {
                        title: 'Source',
                        dataIndex: 'source',
                        render: (v: string) => <Tag>{v}</Tag>
                    },
                    {
                        title: 'Actions',
                        key: 'actions',
                        render: (_: any, record: any) => (
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div
                                    style={{ transition: 'transform 0.2s', cursor: 'pointer' }}
                                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
                                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                                    title='Delete'
                                    onClick={() => handleDeleteIntervention(record)}
                                >
                                    <DeleteOutlined style={{ color: 'red', fontSize: 18 }} />
                                </div>
                            </div>
                        )
                    }
                ]}
                rowKey={(record: any) => record.id || `${record.areaOfSupport}-${record.interventionTitle}`}
                pagination={false}
            />

            <Divider />

            {applicationData.interventions?.confirmedBy?.operations &&
                applicationData.interventions?.confirmedBy?.incubatee ? (
                <Button type='primary'>Download Growth Plan</Button>
            ) : applicationData.interventions?.confirmedBy?.operations ? (
                <Text type='secondary'>Waiting for Incubatee to confirm</Text>
            ) : (
                <Button type='primary' onClick={confirmByOperations}>
                    Confirm Growth Plan
                </Button>
            )}

            {/* ✅ MODAL: Area-first filters + table + multi-select add */}
            <Modal
                open={isModalOpen}
                onCancel={() => {
                    setIsModalOpen(false)
                    setSelectedRowKeys([])
                    setSelectedAreas([])
                    setTitleKeyword('')
                    form.resetFields()
                }}
                footer={null}
                title='Add New Interventions'
                width={900}
            >
                <Form layout='vertical' form={form} onFinish={handleAddMultipleSelected}>
                    {/* 1) Area of Support multi-filter FIRST */}
                    <Form.Item label='Area of Support (select one or more)'>
                        <Select
                            mode='multiple'
                            placeholder='Select areas...'
                            value={selectedAreas}
                            onChange={vals => {
                                setSelectedAreas(vals as string[])
                                setSelectedRowKeys([]) // avoid stale selections when filter changes
                            }}
                            allowClear
                            showSearch
                            optionFilterProp='children'
                        >
                            {areaOptions.map(a => (
                                <Option key={a} value={a}>
                                    {a}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {/* 2) Keyword filter for Intervention title */}
                    <Form.Item label='Keyword in Intervention Title'>
                        <Input
                            placeholder='e.g. Website, Bookkeeping, Branding...'
                            value={titleKeyword}
                            onChange={e => {
                                setTitleKeyword(e.target.value)
                                setSelectedRowKeys([]) // reset selection when list changes
                            }}
                            allowClear
                        />
                    </Form.Item>

                    {/* 3) Table of filtered interventions (select multiple) */}
                    <Table
                        size='small'
                        bordered
                        dataSource={filteredAvailableInterventions}
                        rowKey='id'
                        rowSelection={{
                            selectedRowKeys,
                            onChange: keys => setSelectedRowKeys(keys)
                        }}
                        columns={[
                            { title: 'Title', dataIndex: 'interventionTitle' },
                            { title: 'Area', dataIndex: 'areaOfSupport' }
                        ]}
                        pagination={{ pageSize: 8 }}
                    />

                    <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                        <Button
                            onClick={() => {
                                setIsModalOpen(false)
                                setSelectedRowKeys([])
                                setSelectedAreas([])
                                setTitleKeyword('')
                                form.resetFields()
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type='primary'
                            htmlType='submit'
                            disabled={selectedRowKeys.length === 0}
                        >
                            Add Selected Interventions
                        </Button>
                    </Space>
                </Form>
            </Modal>
        </Card>
    )
}

export default GrowthPlanPage
