import React, { useEffect, useMemo, useState } from 'react'
import {
    Card,
    Table,
    Typography,
    Button,
    Space,
    Tag,
    Modal,
    Descriptions,
    Divider,
    Select,
    Row,
    Col,
    Empty,
    Input,
    App,
    Spin,
    Collapse,
    Statistic,
    Tooltip
} from 'antd'
import {
    EyeOutlined,
    DownloadOutlined,
    SortAscendingOutlined,
    SortDescendingOutlined,
    BarChartOutlined,
    FileTextOutlined,
    TeamOutlined,
    ClockCircleOutlined
} from '@ant-design/icons'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/firebase'
import { CSVLink } from 'react-csv'

// If you already have this component in your project (you mentioned it), keep this import.
// If your path differs, adjust it.
import { DashboardHeaderCard, MotionCard } from '../shared/Header'

import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import WordcloudModule from 'highcharts/modules/wordcloud'

if (typeof WordcloudModule === 'function') {
    WordcloudModule(Highcharts)
}


const { Text } = Typography
const { Option } = Select
const { Search } = Input
const { Panel } = Collapse

type AnswersMap = Record<string, any>

interface FormField {
    id: string
    type: string
    label: string
    required: boolean
    options?: string[]
    description?: string
}

interface FormTemplate {
    id: string
    title: string
    description: string
    category: string
    fields: FormField[]
    status: 'draft' | 'published'
}

interface FormResponse {
    id: string
    templateId?: string
    answers?: AnswersMap

    // legacy/alt shape
    formId?: string
    responses?: AnswersMap

    formTitle: string
    submittedBy: { id?: string; name?: string; email?: string }
    submittedAt: any
    status?: string
    notes?: string
}

interface Props {
    formId?: string // optional: preselect a form
}

const STOP_WORDS = new Set([
    'the',
    'and',
    'a',
    'an',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'it',
    'this',
    'that',
    'i',
    'we',
    'you',
    'they',
    'he',
    'she',
    'them',
    'us',
    'our',
    'your',
    'as',
    'at',
    'by',
    'from',
    'or',
    'but',
    'not',
    'so',
    'if'
])

const FormResponseViewer: React.FC<Props> = ({ formId }) => {
    const { message } = App.useApp()

    // UI state
    const [loading, setLoading] = useState(true)
    const [templates, setTemplates] = useState<FormTemplate[]>([])
    const [responses, setResponses] = useState<FormResponse[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(formId)
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [searchText, setSearchText] = useState('')

    // view modal
    const [viewOpen, setViewOpen] = useState(false)
    const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null)
    const [fs, setFs] = useState(false)
    const [ansFilter, setAnsFilter] = useState('')

    // summary modal
    const [summaryOpen, setSummaryOpen] = useState(false)
    const [summaryFs, setSummaryFs] = useState(false)

    // csv
    const [csvData, setCsvData] = useState<any[]>([])
    const [csvHeaders, setCsvHeaders] = useState<{ label: string; key: string }[]>([])

    // -------- date helpers --------
    const toDateSafe = (v: any): Date | null => {
        if (!v) return null

        // Firestore Timestamp
        if (typeof v?.toDate === 'function') {
            try {
                return v.toDate()
            } catch {
                // ignore
            }
        }

        // Firestore { seconds, nanoseconds }
        if (typeof v?.seconds === 'number') {
            const ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6)
            return new Date(ms)
        }

        if (v instanceof Date) return v

        if (typeof v === 'number') {
            const ms = v < 10_000_000_000 ? v * 1000 : v
            return new Date(ms)
        }

        if (typeof v === 'string') {
            const d = new Date(v)
            return isNaN(d.getTime()) ? null : d
        }

        return null
    }

    const formatDateTime = (v: any) => {
        const d = toDateSafe(v)
        return d ? d.toLocaleString() : '-'
    }

    // -------- answer helpers --------
    const getAnswers = (r: FormResponse): AnswersMap => (r.answers ?? r.responses ?? {}) as AnswersMap

    const getTemplateForResponse = (r: FormResponse) => {
        const id = r.templateId || r.formId
        if (!id) return null
        return templates.find(t => t.id === id) || null
    }

    const tryParseLikert = (v: any): number | null => {
        if (v === null || v === undefined) return null
        const n = typeof v === 'number' ? v : Number(String(v).trim())
        if (!Number.isFinite(n)) return null
        return n >= 1 && n <= 5 ? n : null
    }

    const extractKeywords = (texts: string[]) => {
        const freq = new Map<string, number>()
        for (const t of texts) {
            const words = (t || '')
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length >= 3 && !STOP_WORDS.has(w))

            for (const w of words) freq.set(w, (freq.get(w) || 0) + 1)
        }

        return Array.from(freq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30) // more words helps the cloud
    }

    // -------- chart option builders --------
    const wordcloudOptions = (title: string, keywords: Array<[string, number]>) => ({
        chart: { height: 320 },
        title: { text: title },
        credits: { enabled: false },
        series: [
            {
                type: 'wordcloud' as any,
                name: 'Occurrences',
                data: keywords.map(([name, weight]) => ({ name, weight }))
            }
        ]
    })

    const radarLikertOptions = (title: string, dist: Record<number, number>) => ({
        chart: { polar: true, type: 'column', height: 320 },
        title: { text: title },
        credits: { enabled: false },

        xAxis: {
            categories: ['1', '2', '3', '4', '5'],
            tickmarkPlacement: 'on',
            lineWidth: 0
        },

        yAxis: {
            gridLineInterpolation: 'polygon',
            min: 0,
            title: { text: '' }
        },

        tooltip: { shared: true },

        plotOptions: {
            series: {
                // keeps it looking like a filled “spider”
                fillOpacity: 0.25,
                marker: { enabled: true }
            }
        },

        series: [
            {
                name: 'Responses',
                data: [dist[1] || 0, dist[2] || 0, dist[3] || 0, dist[4] || 0, dist[5] || 0]
            }
        ]
    })


    // -------- load templates (published only) --------
    useEffect(() => {
        ; (async () => {
            try {
                const tSnap = await getDocs(
                    query(collection(db, 'formTemplates'), where('status', '==', 'published'))
                )
                const t: FormTemplate[] = tSnap.docs.map(d => ({
                    id: d.id,
                    ...(d.data() as Omit<FormTemplate, 'id'>)
                }))
                setTemplates(t)
            } catch (e) {
                console.error(e)
                message.error('Failed to load form templates')
            }
        })()
    }, [message])

    // -------- load responses (templateId + legacy formId) --------
    useEffect(() => {
        ; (async () => {
            try {
                setLoading(true)
                const colRef = collection(db, 'formResponses')

                let primaryQ = selectedTemplate
                    ? query(colRef, where('templateId', '==', selectedTemplate), orderBy('submittedAt', sortOrder))
                    : query(colRef, orderBy('submittedAt', sortOrder))

                const pSnap = await getDocs(primaryQ)
                let rows: FormResponse[] = pSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))

                if (selectedTemplate) {
                    const legacyQ = query(colRef, where('formId', '==', selectedTemplate), orderBy('submittedAt', sortOrder))
                    const lSnap = await getDocs(legacyQ)
                    const legacyRows: FormResponse[] = lSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))

                    const merged = new Map(rows.map(r => [r.id, r]))
                    legacyRows.forEach(r => merged.set(r.id, r))
                    rows = Array.from(merged.values())
                }

                // ✅ Filter out draft/unknown templates when templates are loaded (published list)
                if (templates.length > 0) {
                    const publishedIds = new Set(templates.map(t => t.id))
                    const allowSelected = selectedTemplate ? new Set([selectedTemplate]) : new Set<string>()

                    rows = rows.filter(r => {
                        const id = r.templateId || r.formId
                        if (!id) return false
                        return publishedIds.has(id) || allowSelected.has(id)
                    })
                }

                setResponses(rows)
            } catch (e) {
                console.error(e)
                message.error('Failed to load form responses')
            } finally {
                setLoading(false)
            }
        })()
    }, [selectedTemplate, sortOrder, message, templates])

    // -------- search filter --------
    const filtered = useMemo(() => {
        if (!searchText) return responses
        const s = searchText.toLowerCase()
        return responses.filter(r => {
            const who = `${r.submittedBy?.name || ''} ${r.submittedBy?.email || ''}`.toLowerCase()
            return (r.formTitle || '').toLowerCase().includes(s) || who.includes(s)
        })
    }, [responses, searchText])

    // -------- stable ordering (group by form, then date) --------
    const groupedSorted = useMemo(() => {
        const arr = [...filtered]
        const dir = sortOrder === 'asc' ? 1 : -1

        arr.sort((a, b) => {
            const fa = (a.formTitle || '').toLowerCase()
            const fb = (b.formTitle || '').toLowerCase()
            if (fa < fb) return -1
            if (fa > fb) return 1

            const da = toDateSafe(a.submittedAt)?.getTime() ?? 0
            const dbt = toDateSafe(b.submittedAt)?.getTime() ?? 0
            return dir * (da - dbt)
        })

        return arr
    }, [filtered, sortOrder])

    // -------- metrics --------
    const metrics = useMemo(() => {
        const total = filtered.length
        const uniqueForms = new Set(filtered.map(r => r.formTitle || 'Unknown')).size
        const uniqueSubmitters = new Set(
            filtered.map(r => r.submittedBy?.email || r.submittedBy?.id || 'unknown')
        ).size
        const latestMs = filtered
            .map(r => toDateSafe(r.submittedAt)?.getTime() ?? 0)
            .reduce((m, v) => Math.max(m, v), 0)

        return {
            total,
            uniqueForms,
            uniqueSubmitters,
            latest: latestMs ? new Date(latestMs).toLocaleString() : '-'
        }
    }, [filtered])

    // -------- CSV generation based on groupedSorted --------
    useEffect(() => {
        if (!groupedSorted.length) {
            setCsvData([])
            setCsvHeaders([])
            return
        }

        const template =
            templates.find(t => t.id === (selectedTemplate || groupedSorted[0]?.templateId || groupedSorted[0]?.formId)) ||
            null

        const baseHeaders: { label: string; key: string }[] = [
            { label: 'Form', key: 'formTitle' },
            { label: 'Submitter Name', key: 'submitter_name' },
            { label: 'Submitter Email', key: 'submitter_email' },
            { label: 'Submitted At', key: 'submittedAt' },
            { label: 'Status', key: 'status' }
        ]

        let fieldHeaders: { label: string; key: string }[] = []
        if (template) {
            fieldHeaders = (template.fields || [])
                .filter(f => f.type !== 'heading')
                .map(f => ({ label: f.label || 'Field', key: `field__${f.id}` }))
        } else {
            const answerKeys = new Set<string>()
            groupedSorted.forEach(r => Object.keys(getAnswers(r)).forEach(k => answerKeys.add(k)))
            fieldHeaders = Array.from(answerKeys).map(k => ({ label: k, key: `answer__${k}` }))
        }

        const data = groupedSorted.map(r => {
            const answers = getAnswers(r)

            const row: Record<string, any> = {
                formTitle: r.formTitle,
                submitter_name: r.submittedBy?.name || '',
                submitter_email: r.submittedBy?.email || '',
                submittedAt: formatDateTime(r.submittedAt),
                status: (r.status || 'submitted').toUpperCase()
            }

            if (template) {
                template.fields.forEach(f => {
                    if (f.type === 'heading') return
                    const v = answers[f.id]
                    row[`field__${f.id}`] = Array.isArray(v)
                        ? v.join(', ')
                        : typeof v === 'object' && v !== null
                            ? JSON.stringify(v)
                            : v ?? ''
                })
            } else {
                Object.entries(answers).forEach(([k, v]) => {
                    row[`answer__${k}`] = Array.isArray(v)
                        ? v.join(', ')
                        : typeof v === 'object' && v !== null
                            ? JSON.stringify(v)
                            : v ?? ''
                })
            }

            return row
        })

        setCsvHeaders([...baseHeaders, ...fieldHeaders])
        setCsvData(data)
    }, [groupedSorted, templates, selectedTemplate])

    // -------- table columns --------
    const columns = [
        { title: 'Form', dataIndex: 'formTitle', key: 'formTitle' },
        {
            title: 'Submitted By',
            dataIndex: 'submittedBy',
            key: 'submittedBy',
            render: (sb: FormResponse['submittedBy']) => (
                <div>
                    <div>{sb?.name || '-'}</div>
                    <Text type="secondary">{sb?.email || '-'}</Text>
                </div>
            )
        },
        {
            title: 'Submitted At',
            dataIndex: 'submittedAt',
            key: 'submittedAt',
            render: (val: any) => formatDateTime(val)
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (s?: string) => {
                const status = (s || 'submitted').toLowerCase()
                const color = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'processing'
                return <Tag color={color}>{status.toUpperCase()}</Tag>
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: FormResponse) => (
                <Button
                    icon={<EyeOutlined />}
                    size="small"
                    onClick={() => {
                        setSelectedResponse(record)
                        setAnsFilter('')
                        setFs(false)
                        setViewOpen(true)
                    }}
                >
                    View
                </Button>
            )
        }
    ]

    // -------- modal details --------
    const renderAnswerValue = (v: any) => {
        const str = Array.isArray(v)
            ? v.join(', ')
            : typeof v === 'object' && v !== null
                ? JSON.stringify(v)
                : String(v ?? '')

        if (!ansFilter) return str
        return str.toLowerCase().includes(ansFilter.toLowerCase()) ? str : null
    }

    const renderDetails = () => {
        if (!selectedResponse) return null

        const template = getTemplateForResponse(selectedResponse)
        const answers = getAnswers(selectedResponse)

        // group using headings
        const groups: Record<string, FormField[]> = {}
        let current = 'General'
            ; (template?.fields || []).forEach(f => {
                if (f.type === 'heading') {
                    current = f.label || 'Section'
                    return
                }
                ; (groups[current] ||= []).push(f)
            })

        return (
            <div>
                <Card size="small" style={{ marginBottom: 12, position: 'sticky', top: 0, zIndex: 1 }}>
                    <Descriptions title="Submission" bordered column={1} size="small">
                        <Descriptions.Item label="Form">{selectedResponse.formTitle}</Descriptions.Item>
                        <Descriptions.Item label="Submitted By">
                            {selectedResponse.submittedBy?.name || '-'} ({selectedResponse.submittedBy?.email || '-'})
                        </Descriptions.Item>
                        <Descriptions.Item label="Submitted At">{formatDateTime(selectedResponse.submittedAt)}</Descriptions.Item>
                        <Descriptions.Item label="Status">
                            <Tag color="processing">{(selectedResponse.status || 'submitted').toUpperCase()}</Tag>
                        </Descriptions.Item>
                    </Descriptions>
                </Card>

                <Divider orientation="left" style={{ marginTop: 8, marginBottom: 8 }}>
                    Responses
                </Divider>

                <Input
                    allowClear
                    placeholder="Search within responses"
                    value={ansFilter}
                    onChange={e => setAnsFilter(e.target.value)}
                    style={{ marginBottom: 8 }}
                />

                <Collapse accordion>
                    {Object.entries(groups).map(([section, fields]) => (
                        <Panel header={section} key={section}>
                            <Descriptions bordered column={1} size="small">
                                {fields.map(f => {
                                    const v = answers[f.id]
                                    if (v === undefined) return null
                                    const rendered = renderAnswerValue(v)
                                    if (rendered === null) return null
                                    return (
                                        <Descriptions.Item key={f.id} label={f.label}>
                                            {f.type === 'file' && typeof v === 'string' ? (
                                                <a href={v} target="_blank" rel="noopener noreferrer">
                                                    View File
                                                </a>
                                            ) : (
                                                rendered
                                            )}
                                        </Descriptions.Item>
                                    )
                                })}
                            </Descriptions>
                        </Panel>
                    ))}

                    {/* fallback if template missing */}
                    {!template && (
                        <Panel header="Responses (raw)" key="__all__">
                            <Descriptions bordered column={1} size="small">
                                {Object.entries(answers).map(([k, v]) => {
                                    const rendered = renderAnswerValue(v)
                                    if (rendered === null) return null
                                    return (
                                        <Descriptions.Item key={k} label={k}>
                                            {rendered}
                                        </Descriptions.Item>
                                    )
                                })}
                            </Descriptions>
                        </Panel>
                    )}
                </Collapse>
            </div>
        )
    }

    // -------- consolidated summary --------
    const renderConsolidatedSummary = () => {
        if (!groupedSorted.length) return <Empty description="No responses to summarize" />

        // group by templateId/formId (more reliable than title)
        const byTemplate = new Map<string, { title: string; rows: FormResponse[] }>()
        for (const r of groupedSorted) {
            const tid = r.templateId || r.formId || '__unknown__'
            const existing = byTemplate.get(tid)
            if (!existing) {
                byTemplate.set(tid, { title: r.formTitle || 'Unknown Form', rows: [r] })
            } else {
                existing.rows.push(r)
            }
        }

        return (
            <div>
                {Array.from(byTemplate.entries()).map(([tid, { title, rows }]) => {
                    const t = templates.find(x => x.id === tid) || null

                    // fields excluding headings
                    const fields = (t?.fields || []).filter(f => f.type !== 'heading') as FormField[]

                    // fallback keys if no template
                    const fallbackFields: FormField[] = !fields.length
                        ? Array.from(
                            rows.reduce((acc, r) => {
                                Object.keys(getAnswers(r)).forEach(k => acc.add(k))
                                return acc
                            }, new Set<string>())
                        ).map(k => ({
                            id: k,
                            type: 'text',
                            label: k,
                            required: false
                        }))
                        : []

                    const effectiveFields = fields.length ? fields : fallbackFields

                    const fieldBlocks = effectiveFields.map(f => {
                        const values = rows
                            .map(r => getAnswers(r)[f.id])
                            .filter(v => v !== undefined && v !== null && String(v).trim() !== '')

                        if (!values.length) return null

                        const likerts = values.map(tryParseLikert).filter((n): n is number => n !== null)
                        const isLikert = likerts.length >= Math.max(3, Math.floor(values.length * 0.6))

                        if (isLikert) {
                            const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
                            likerts.forEach(n => (dist[n] += 1))
                            const avg = likerts.reduce((a, b) => a + b, 0) / likerts.length
                            const positive = ((dist[4] + dist[5]) / likerts.length) * 100

                            return (
                                <Card key={f.id} size="small" style={{ marginBottom: 10 }}>
                                    <Space direction="vertical" style={{ width: '100%' }} size={6}>
                                        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                                            <Text strong>{f.label}</Text>
                                            <Tag color="blue">LIKERT</Tag>
                                        </Space>

                                        <Row gutter={12}>
                                            <Col xs={24} sm={8}>
                                                <Statistic title="Avg" value={Number.isFinite(avg) ? avg.toFixed(2) : '-'} />
                                            </Col>
                                            <Col xs={24} sm={8}>
                                                <Statistic title="Responses" value={likerts.length} />
                                            </Col>
                                            <Col xs={24} sm={8}>
                                                <Statistic title="% Positive (4–5)" value={positive.toFixed(0)} suffix="%" />
                                            </Col>
                                        </Row>

                                        <Divider style={{ margin: '8px 0' }} />

                                        <Space wrap>
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <Tag key={n}>
                                                    {n}: {dist[n]}
                                                </Tag>
                                            ))}
                                        </Space>

                                        <Collapse style={{ marginTop: 8 }}>
                                            <Panel header="Visual distribution (Spiderweb)" key="radar">
                                                <HighchartsReact
                                                    highcharts={Highcharts}
                                                    options={radarLikertOptions(`Likert Distribution: ${f.label}`, dist)}
                                                />
                                            </Panel>
                                        </Collapse>
                                    </Space>
                                </Card>
                            )
                        }

                        // text summary
                        const texts = values.map(v => String(v))
                        const keywords = extractKeywords(texts)
                        const samples = texts.slice(0, 8)

                        return (
                            <Card key={f.id} size="small" style={{ marginBottom: 10 }}>
                                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                                    <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                                        <Text strong>{f.label}</Text>
                                        <Tag color="purple">TEXT</Tag>
                                    </Space>

                                    <Row gutter={12}>
                                        <Col xs={24} sm={8}>
                                            <Statistic title="Responses" value={texts.length} />
                                        </Col>
                                        <Col xs={24} sm={16}>
                                            <Text type="secondary">Top keywords:</Text>
                                            <div style={{ marginTop: 6 }}>
                                                {keywords.length ? (
                                                    <Space wrap>
                                                        {keywords.slice(0, 12).map(([w, c]) => (
                                                            <Tag key={w}>
                                                                {w} ({c})
                                                            </Tag>
                                                        ))}
                                                    </Space>
                                                ) : (
                                                    <Text type="secondary">No keywords found</Text>
                                                )}
                                            </div>
                                        </Col>
                                    </Row>

                                    <Collapse style={{ marginTop: 8 }}>
                                        <Panel header="Word cloud" key="wc">
                                            {keywords.length ? (
                                                <HighchartsReact
                                                    highcharts={Highcharts}
                                                    options={wordcloudOptions(`Word Cloud: ${f.label}`, keywords)}
                                                />
                                            ) : (
                                                <Empty description="Not enough text to build a word cloud" />
                                            )}
                                        </Panel>

                                        <Panel header="Sample responses" key="samples">
                                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                                                {samples.map((s, idx) => (
                                                    <li key={idx}>{s}</li>
                                                ))}
                                            </ul>
                                        </Panel>
                                    </Collapse>
                                </Space>
                            </Card>
                        )
                    })

                    return (
                        <Collapse key={tid} style={{ marginBottom: 12 }}>
                            <Panel
                                header={
                                    <Space>
                                        <FileTextOutlined />
                                        <span>{title}</span>
                                        <Tag color="geekblue">{rows.length} submissions</Tag>
                                        {!t && <Tag color="warning">Template missing</Tag>}
                                    </Space>
                                }
                                key={tid}
                            >
                                {fieldBlocks.filter(Boolean).length ? fieldBlocks : <Empty description="Nothing to summarize for this form" />}
                            </Panel>
                        </Collapse>
                    )
                })}
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', padding: 24 }}>
            <DashboardHeaderCard
                title="Form Responses"
                subtitle="Browse submissions, export CSV, and view a consolidated summary with visuals."
            />

            <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
                <Col xs={24} sm={6}>
                    <MotionCard>
                        <Statistic title="Total Submissions" value={metrics.total} prefix={<BarChartOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} sm={6}>
                    <MotionCard>
                        <Statistic title="Unique Forms" value={metrics.uniqueForms} prefix={<FileTextOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} sm={6}>
                    <MotionCard>
                        <Statistic title="Unique Submitters" value={metrics.uniqueSubmitters} prefix={<TeamOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} sm={6}>
                    <MotionCard>
                        <Statistic title="Latest Submission" value={metrics.latest} prefix={<ClockCircleOutlined />} />
                    </MotionCard>
                </Col>
            </Row>

            <Card
                title="Submissions"
                extra={
                    <Space>
                        <Button
                            icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                            onClick={() => setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
                        >
                            {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
                        </Button>

                        <Tooltip title="Summarize current filtered results">
                            <Button icon={<BarChartOutlined />} onClick={() => setSummaryOpen(true)}>
                                Consolidated Summary
                            </Button>
                        </Tooltip>

                        {csvData.length > 0 && (
                            <CSVLink
                                data={csvData}
                                headers={csvHeaders}
                                filename={`form-responses-${new Date().toISOString().slice(0, 10)}.csv`}
                            >
                                <Button icon={<DownloadOutlined />}>Export CSV</Button>
                            </CSVLink>
                        )}
                    </Space>
                }
            >
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={10}>
                        <Select
                            placeholder="Select Form Template"
                            style={{ width: '100%' }}
                            onChange={setSelectedTemplate}
                            value={selectedTemplate}
                            allowClear
                            showSearch
                            optionFilterProp="children"
                        >
                            {templates.map(t => (
                                <Option key={t.id} value={t.id}>
                                    {t.title}
                                </Option>
                            ))}
                        </Select>
                    </Col>

                    <Col xs={24} sm={12} md={14}>
                        <Search
                            placeholder="Search by form or submitter"
                            onSearch={setSearchText}
                            onChange={e => setSearchText(e.target.value)}
                            style={{ width: '100%' }}
                            allowClear
                        />
                    </Col>
                </Row>

                <Divider />

                <Table
                    dataSource={groupedSorted}
                    columns={columns as any}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    locale={{ emptyText: <Empty description="No form responses found" /> }}
                />
            </Card>

            {/* View single response */}
            <Modal
                title={
                    <Space>
                        <span>Form Response Details</span>
                        <Button size="small" onClick={() => setFs(v => !v)}>
                            {fs ? 'Exit full screen' : 'Full screen'}
                        </Button>
                    </Space>
                }
                open={viewOpen}
                onCancel={() => setViewOpen(false)}
                footer={<Button onClick={() => setViewOpen(false)}>Close</Button>}
                width={fs ? '100vw' : '90vw'}
                style={{ top: fs ? 0 : 16, padding: 0 }}
                bodyStyle={{
                    height: fs ? 'calc(100dvh - 120px)' : '72vh',
                    overflowY: 'auto',
                    padding: fs ? 16 : 12
                }}
                destroyOnClose
            >
                <Spin spinning={false}>{renderDetails()}</Spin>
            </Modal>

            {/* Consolidated summary */}
            <Modal
                title={
                    <Space>
                        <span>Consolidated Summary</span>
                        <Button size="small" onClick={() => setSummaryFs(v => !v)}>
                            {summaryFs ? 'Exit full screen' : 'Full screen'}
                        </Button>
                    </Space>
                }
                open={summaryOpen}
                onCancel={() => setSummaryOpen(false)}
                footer={<Button onClick={() => setSummaryOpen(false)}>Close</Button>}
                width={summaryFs ? '100vw' : '92vw'}
                style={{ top: summaryFs ? 0 : 16 }}
                bodyStyle={{
                    height: summaryFs ? 'calc(100dvh - 120px)' : '78vh',
                    overflowY: 'auto',
                    padding: 12
                }}
                destroyOnClose
            >
                {renderConsolidatedSummary()}
            </Modal>
        </div>
    )
}

export default FormResponseViewer
