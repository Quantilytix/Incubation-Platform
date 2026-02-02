// src/pages/FormResponseViewer.tsx
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
import { DashboardHeaderCard, MotionCard } from '../shared/Header'
import { Helmet } from 'react-helmet'

import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import WordcloudModule from 'highcharts/modules/wordcloud'

// ✅ make sure this path matches your project
import { useFullIdentity } from '@/hooks/useFullIdentity'

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
    // assessment templates may include this
    correctAnswer?: string
    name?: string
}

interface FormTemplate {
    id: string
    title: string
    description: string
    category: string
    fields: FormField[]
    status?: 'draft' | 'published' | string
    companyCode?: string
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

    // sometimes present
    kind?: 'survey' | 'assessment'
    companyCode?: string
}

interface Props {
    formId?: string
}

type KindFilter = 'all' | 'survey' | 'assessment'

const STOP_WORDS = new Set([
    'the', 'and', 'a', 'an', 'to', 'of', 'in', 'for', 'on', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'it',
    'this', 'that', 'i', 'we', 'you', 'they', 'he', 'she', 'them', 'us', 'our', 'your', 'as', 'at', 'by', 'from',
    'or', 'but', 'not', 'so', 'if'
])

// ✅ classify templates/responses
const ASSESSMENT_CATEGORIES = new Set(['post_intervention', 'general'])
const isAssessmentCategory = (cat?: string) => ASSESSMENT_CATEGORIES.has(String(cat || ''))

const CHOICE_TYPES = new Set([
    'radio',
    'select',
    'dropdown',
    'checkbox',
    'multiselect',
    'multi_select',
    'mcq',
    'multiple_choice'
])

const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

const FormResponseViewer: React.FC<Props> = ({ formId }) => {
    const { message } = App.useApp()
    const { user } = useFullIdentity() as any
    const myEmail = String(user?.email || '')
    const myCompany = String(user?.companyCode || '')
    const isMainDomain = myEmail.toLowerCase().endsWith('@quantilytix.co.za')

    // UI state
    const [loading, setLoading] = useState(true)
    const [templates, setTemplates] = useState<FormTemplate[]>([])
    const [responses, setResponses] = useState<FormResponse[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(formId)
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [searchText, setSearchText] = useState('')
    const [kindFilter, setKindFilter] = useState<KindFilter>('all')

    // company filter
    const [selectedCompany, setSelectedCompany] = useState<string>(
        isMainDomain ? 'all' : (myCompany || 'all')
    )

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
        if (typeof v?.toDate === 'function') {
            try { return v.toDate() } catch { }
        }
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

    // -------- template index --------
    const templateById = useMemo(() => {
        const m = new Map<string, FormTemplate>()
        templates.forEach(t => m.set(t.id, t))
        return m
    }, [templates])

    const getAnswers = (r: FormResponse): AnswersMap => (r.answers ?? r.responses ?? {}) as AnswersMap

    const getTemplateForResponse = (r: FormResponse) => {
        const id = r.templateId || r.formId
        if (!id) return null
        return templateById.get(id) || null
    }

    const getKindForTemplate = (t?: FormTemplate | null): 'survey' | 'assessment' | 'unknown' => {
        if (!t) return 'unknown'
        return isAssessmentCategory(t.category) ? 'assessment' : 'survey'
    }

    const getKindForResponse = (r: FormResponse): 'survey' | 'assessment' | 'unknown' => {
        if (r.kind === 'survey' || r.kind === 'assessment') return r.kind
        const t = getTemplateForResponse(r)
        return getKindForTemplate(t)
    }

    const getCompanyForResponse = (r: FormResponse): string => {
        // ✅ prefer response companyCode, else template companyCode
        if (r.companyCode) return String(r.companyCode)
        const t = getTemplateForResponse(r)
        if (t?.companyCode) return String(t.companyCode)
        return 'UNKNOWN'
    }

    const companyOptions = useMemo(() => {
        const s = new Set<string>()
        templates.forEach(t => t.companyCode && s.add(String(t.companyCode)))
        // if responses carry companyCode that templates don’t, still include:
        responses.forEach(r => r.companyCode && s.add(String(r.companyCode)))
        const arr = Array.from(s).sort()
        return arr
    }, [templates, responses])

    // -------- analytics helpers --------
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
        return Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 30)
    }

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

    const choiceColumnOptions = (title: string, dist: Array<{ name: string; y: number }>) => ({
        chart: { type: 'column', height: 320 },
        title: { text: title },
        credits: { enabled: false },
        xAxis: { type: 'category', labels: { rotation: -20 } },
        yAxis: { min: 0, title: { text: 'Count' } },
        tooltip: { pointFormat: '<b>{point.y}</b>' },
        series: [
            { name: 'Count', type: 'column' as const, data: dist.map(d => [d.name, d.y]) }
        ]
    })

    // -------- load templates --------
    useEffect(() => {
        ; (async () => {
            try {
                const colRef = collection(db, 'formTemplates')

                // ✅ don’t hide templates just because status is not exactly "published"
                // (your assessment template may be "active" or missing status)
                let qRef: any

                if (!isMainDomain && myCompany) {
                    qRef = query(colRef, where('companyCode', '==', myCompany))
                } else {
                    qRef = query(colRef)
                }

                const snap = await getDocs(qRef)
                const t: FormTemplate[] = snap.docs
                    .map(d => ({ id: d.id, ...(d.data() as any) }))
                    .filter(x => x) // keep all; we filter via UI, and via publishedIds for responses display
                setTemplates(t)
            } catch (e) {
                console.error(e)
                message.error('Failed to load form templates')
            }
        })()
    }, [message, isMainDomain, myCompany])

    // -------- load responses (respect company via templateId fallback) --------
    useEffect(() => {
        ; (async () => {
            try {
                setLoading(true)
                const colRef = collection(db, 'formResponses')

                const merged = new Map<string, FormResponse>()

                const addRows = (rows: FormResponse[]) => {
                    rows.forEach(r => merged.set(r.id, r))
                }

                // If a template is selected, keep it simple (still include legacy formId)
                if (selectedTemplate) {
                    const q1 = query(colRef, where('templateId', '==', selectedTemplate), orderBy('submittedAt', sortOrder))
                    const s1 = await getDocs(q1)
                    addRows(s1.docs.map(d => ({ id: d.id, ...(d.data() as any) })))

                    const q2 = query(colRef, where('formId', '==', selectedTemplate), orderBy('submittedAt', sortOrder))
                    const s2 = await getDocs(q2)
                    addRows(s2.docs.map(d => ({ id: d.id, ...(d.data() as any) })))

                    setResponses(Array.from(merged.values()))
                    return
                }

                // No selected template:
                if (isMainDomain) {
                    const qAll = query(colRef, orderBy('submittedAt', sortOrder))
                    const sAll = await getDocs(qAll)
                    addRows(sAll.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
                    setResponses(Array.from(merged.values()))
                    return
                }

                // Non-main domain: pull by companyCode AND by templateId (to catch missing companyCode on responses)
                const companyTemplates = templates.filter(t => String(t.companyCode || '') === myCompany)
                const companyTemplateIds = companyTemplates.map(t => t.id)

                // (A) responses that already have companyCode
                if (myCompany) {
                    const qByCompany = query(colRef, where('companyCode', '==', myCompany), orderBy('submittedAt', sortOrder))
                    const sByCompany = await getDocs(qByCompany)
                    addRows(sByCompany.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
                }

                // (B) responses missing companyCode but linked to our company templates
                // Firestore "in" supports up to 10 values
                for (const ids of chunk(companyTemplateIds, 10)) {
                    if (!ids.length) continue
                    const qByTpl = query(colRef, where('templateId', 'in', ids), orderBy('submittedAt', sortOrder))
                    const sByTpl = await getDocs(qByTpl)
                    addRows(sByTpl.docs.map(d => ({ id: d.id, ...(d.data() as any) })))

                    // legacy formId too
                    const qByFormId = query(colRef, where('formId', 'in', ids), orderBy('submittedAt', sortOrder))
                    const sByFormId = await getDocs(qByFormId)
                    addRows(sByFormId.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
                }

                setResponses(Array.from(merged.values()))
            } catch (e) {
                console.error(e)
                message.error('Failed to load form responses')
            } finally {
                setLoading(false)
            }
        })()
    }, [selectedTemplate, sortOrder, message, templates, isMainDomain, myCompany])

    // -------- template list respects kind + company filters --------
    const filteredTemplates = useMemo(() => {
        const base = templates

        const byCompany =
            selectedCompany === 'all'
                ? base
                : base.filter(t => String(t.companyCode || '') === selectedCompany)

        if (kindFilter === 'all') return byCompany

        return byCompany.filter(t =>
            kindFilter === 'assessment'
                ? isAssessmentCategory(t.category)
                : !isAssessmentCategory(t.category)
        )
    }, [templates, kindFilter, selectedCompany])

    // -------- response filters (company + kind + search) --------
    const filtered = useMemo(() => {
        let arr = [...responses]

        // company filter via response.companyCode OR template.companyCode
        if (selectedCompany !== 'all') {
            arr = arr.filter(r => getCompanyForResponse(r) === selectedCompany)
        }

        // kind filter
        if (kindFilter !== 'all') {
            arr = arr.filter(r => getKindForResponse(r) === kindFilter)
        }

        // search filter
        if (searchText) {
            const s = searchText.toLowerCase()
            arr = arr.filter(r => {
                const who = `${r.submittedBy?.name || ''} ${r.submittedBy?.email || ''}`.toLowerCase()
                return (r.formTitle || '').toLowerCase().includes(s) || who.includes(s)
            })
        }

        return arr
    }, [responses, searchText, kindFilter, selectedCompany, templateById])

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
        const surveys = filtered.filter(r => getKindForResponse(r) === 'survey').length
        const assessments = filtered.filter(r => getKindForResponse(r) === 'assessment').length

        const uniqueForms = new Set(filtered.map(r => r.formTitle || 'Unknown')).size
        const uniqueSubmitters = new Set(filtered.map(r => r.submittedBy?.email || r.submittedBy?.id || 'unknown')).size

        const latestMs = filtered
            .map(r => toDateSafe(r.submittedAt)?.getTime() ?? 0)
            .reduce((m, v) => Math.max(m, v), 0)

        return {
            total,
            surveys,
            assessments,
            uniqueForms,
            uniqueSubmitters,
            latest: latestMs ? new Date(latestMs).toLocaleString() : '-'
        }
    }, [filtered, templateById])

    // -------- CSV generation (pivot: one form -> questions as columns) --------
    useEffect(() => {
        // We only do pivot export when a template is selected
        if (!selectedTemplate) {
            setCsvData([])
            setCsvHeaders([])
            return
        }

        const template = templates.find(t => t.id === selectedTemplate) || null
        const rowsForThisForm = groupedSorted.filter(r => {
            const tid = r.templateId || r.formId
            return tid === selectedTemplate
        })

        if (!rowsForThisForm.length) {
            setCsvData([])
            setCsvHeaders([])
            return
        }

        // If template missing, fall back to answer keys (still pivoted)
        const effectiveFields: Array<{ id: string; label: string; type?: string }> = template
            ? (template.fields || [])
                .filter(f => f.type !== 'heading')
                .map(f => ({ id: f.id, label: f.label || f.id, type: f.type }))
            : Array.from(
                rowsForThisForm.reduce((acc, r) => {
                    Object.keys(getAnswers(r)).forEach(k => acc.add(k))
                    return acc
                }, new Set<string>())
            ).map(k => ({ id: k, label: k }))

        // 1) Headers: respondent first, then each question label
        // Use stable keys (based on field id) to avoid collisions.
        const headers: { label: string; key: string }[] = [
            { label: 'Respondent Name', key: 'respondent_name' },
            { label: 'Respondent Email', key: 'respondent_email' },
            { label: 'Submitted At', key: 'submitted_at' },
            ...effectiveFields.map(f => ({
                label: f.label,
                key: `q__${f.id}`
            }))
        ]

        // 2) Data: one row per response
        const data = rowsForThisForm.map(r => {
            const answers = getAnswers(r)
            const row: Record<string, any> = {
                respondent_name: r.submittedBy?.name || '',
                respondent_email: r.submittedBy?.email || '',
                submitted_at: formatDateTime(r.submittedAt)
            }

            for (const f of effectiveFields) {
                const v = answers?.[f.id]
                row[`q__${f.id}`] = Array.isArray(v)
                    ? v.join(', ')
                    : typeof v === 'object' && v !== null
                        ? JSON.stringify(v)
                        : (v ?? '')
            }

            return row
        })

        setCsvHeaders(headers)
        setCsvData(data)
    }, [selectedTemplate, templates, groupedSorted])


    // -------- table columns --------
    const columns = [
        { title: 'Form', dataIndex: 'formTitle', key: 'formTitle' },
        // {
        //     title: 'Company',
        //     key: 'company',
        //     render: (_: any, r: FormResponse) => <Tag>{getCompanyForResponse(r)}</Tag>
        // },
        {
            title: 'Type',
            key: 'kind',
            render: (_: any, r: FormResponse) => {
                const k = getKindForResponse(r)
                if (k === 'assessment') return <Tag color="geekblue">Assessment</Tag>
                if (k === 'survey') return <Tag>Survey</Tag>
                return <Tag>UNKNOWN</Tag>
            }
        },
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
        const str = Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')
        if (!ansFilter) return str
        return str.toLowerCase().includes(ansFilter.toLowerCase()) ? str : null
    }

    const renderDetails = () => {
        if (!selectedResponse) return null
        const template = getTemplateForResponse(selectedResponse)
        const answers = getAnswers(selectedResponse)
        const kind = getKindForResponse(selectedResponse)

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
                        <Descriptions.Item label="Company">{getCompanyForResponse(selectedResponse)}</Descriptions.Item>
                        <Descriptions.Item label="Type">
                            {kind === 'assessment' ? <Tag color="geekblue">ASSESSMENT</Tag> : kind === 'survey' ? <Tag>SURVEY</Tag> : <Tag>UNKNOWN</Tag>}
                        </Descriptions.Item>
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
                                        <Descriptions.Item key={f.id} label={f.label || f.id}>
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

    // -------- consolidated summary (fix MCQ vs TEXT + keep polar for likert) --------
    const renderConsolidatedSummary = () => {
        if (!groupedSorted.length) return <Empty description="No responses to summarize" />

        const byTemplate = new Map<string, { title: string; rows: FormResponse[] }>()
        for (const r of groupedSorted) {
            const tid = r.templateId || r.formId || '__unknown__'
            const existing = byTemplate.get(tid)
            if (!existing) byTemplate.set(tid, { title: r.formTitle || 'Unknown Form', rows: [r] })
            else existing.rows.push(r)
        }

        return (
            <div>
                {Array.from(byTemplate.entries()).map(([tid, { title, rows }]) => {
                    const t = templates.find(x => x.id === tid) || null
                    const kind = t ? getKindForTemplate(t) : 'unknown'
                    const company = t?.companyCode || (rows[0] ? getCompanyForResponse(rows[0]) : 'UNKNOWN')

                    const fields = (t?.fields || []).filter(f => f.type !== 'heading') as FormField[]

                    const fallbackFields: FormField[] = !fields.length
                        ? Array.from(
                            rows.reduce((acc, r) => {
                                Object.keys(getAnswers(r)).forEach(k => acc.add(k))
                                return acc
                            }, new Set<string>())
                        ).map(k => ({ id: k, type: 'text', label: k, required: false }))
                        : []

                    const effectiveFields = fields.length ? fields : fallbackFields

                    const fieldBlocks = effectiveFields.map(f => {
                        const valuesRaw = rows
                            .map(r => getAnswers(r)[f.id])
                            .filter(v => v !== undefined && v !== null && String(v).trim() !== '')

                        if (!valuesRaw.length) return null

                        // normalize values
                        const flatValues: any[] = []
                        valuesRaw.forEach(v => {
                            if (Array.isArray(v)) v.forEach(x => flatValues.push(x))
                            else flatValues.push(v)
                        })

                        // Likert detection (even if template says "radio")
                        const likerts = flatValues.map(tryParseLikert).filter((n): n is number => n !== null)
                        const isLikert = likerts.length >= Math.max(3, Math.floor(flatValues.length * 0.6))

                        if (isLikert) {
                            const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
                            likerts.forEach(n => (dist[n] += 1))
                            const avg = likerts.reduce((a, b) => a + b, 0) / likerts.length
                            const positive = ((dist[4] + dist[5]) / likerts.length) * 100

                            return (
                                <Card key={f.id} size="small" style={{ marginBottom: 10 }}>
                                    <Space direction="vertical" style={{ width: '100%' }} size={6}>
                                        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                                            <Text strong>{f.label || f.id}</Text>
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
                                                <HighchartsReact highcharts={Highcharts} options={radarLikertOptions(`Likert Distribution: ${f.label || f.id}`, dist)} />
                                            </Panel>
                                        </Collapse>
                                    </Space>
                                </Card>
                            )
                        }

                        // ✅ MCQ / choice detection: template options OR known choice types OR answers look like "A) ...", "B) ..."
                        const hasOptions = Array.isArray(f.options) && f.options.length > 0
                        const looksLikeChoice = flatValues.some(v => /^[A-D]\)/.test(String(v).trim()))
                        const isChoice = hasOptions || CHOICE_TYPES.has(String(f.type || '').toLowerCase()) || looksLikeChoice

                        if (isChoice) {
                            const freq = new Map<string, number>()
                            flatValues.forEach(v => {
                                const s = String(v).trim()
                                if (!s) return
                                freq.set(s, (freq.get(s) || 0) + 1)
                            })

                            // prefer template options order if present
                            const distArr: Array<{ name: string; y: number }> = hasOptions
                                ? f.options!.map(opt => ({ name: opt, y: freq.get(opt) || 0 }))
                                : Array.from(freq.entries())
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 12)
                                    .map(([name, y]) => ({ name, y }))

                            const top = distArr.slice().sort((a, b) => b.y - a.y)[0]

                            return (
                                <Card key={f.id} size="small" style={{ marginBottom: 10 }}>
                                    <Space direction="vertical" style={{ width: '100%' }} size={6}>
                                        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                                            <Text strong>{f.label || f.id}</Text>
                                            <Tag color="geekblue">CHOICE</Tag>
                                        </Space>

                                        <Row gutter={12}>
                                            <Col xs={24} sm={8}>
                                                <Statistic title="Responses" value={flatValues.length} />
                                            </Col>
                                            <Col xs={24} sm={16}>
                                                <Text type="secondary">Top selection:</Text>
                                                <div style={{ marginTop: 6 }}>
                                                    {top ? <Tag>{top.name} ({top.y})</Tag> : <Text type="secondary">-</Text>}
                                                </div>
                                            </Col>
                                        </Row>

                                        <Collapse style={{ marginTop: 8 }}>
                                            <Panel header="Distribution" key="dist">
                                                <HighchartsReact highcharts={Highcharts} options={choiceColumnOptions(`Choice Distribution: ${f.label || f.id}`, distArr)} />
                                            </Panel>
                                        </Collapse>
                                    </Space>
                                </Card>
                            )
                        }

                        // text summary
                        const texts = flatValues.map(v => String(v))
                        const keywords = extractKeywords(texts)
                        const samples = texts.slice(0, 8)

                        return (
                            <Card key={f.id} size="small" style={{ marginBottom: 10 }}>
                                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                                    <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                                        <Text strong>{f.label || f.id}</Text>
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
                                                <HighchartsReact highcharts={Highcharts} options={wordcloudOptions(`Word Cloud: ${f.label || f.id}`, keywords)} />
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
                                        {kind === 'assessment' ? <Tag color="geekblue">Assessment</Tag> : kind === 'survey' ? <Tag color='cyan'>Survey</Tag> : <Tag>UNKNOWN</Tag>}
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
            <Helmet>
                <title>Responses Viewer | Smart Incubation</title>
            </Helmet>

            <DashboardHeaderCard
                title="Form Responses"
                subtitle="Browse survey + assessment submissions, export CSV, and view consolidated summary with visuals."
            />

            <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
                <Col xs={24} sm={6}>
                    <MotionCard>
                        <Statistic title="Total Submissions" value={metrics.total} prefix={<BarChartOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} sm={6}>
                    <MotionCard>
                        <Statistic title="Surveys" value={metrics.surveys} prefix={<FileTextOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} sm={6}>
                    <MotionCard>
                        <Statistic title="Assessments" value={metrics.assessments} prefix={<FileTextOutlined />} />
                    </MotionCard>
                </Col>
                <Col xs={24} sm={6}>
                    <MotionCard>
                        <Statistic title="Latest Submission" value={metrics.latest} prefix={<ClockCircleOutlined />} />
                    </MotionCard>
                </Col>
            </Row>

            <MotionCard
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

                        {!selectedTemplate ? (
                            <Tooltip title="Select a form template first to export question-column CSV">
                                <Button icon={<DownloadOutlined />} disabled>
                                    Export CSV
                                </Button>
                            </Tooltip>
                        ) : (
                            csvData.length > 0 && (
                                <CSVLink
                                    data={csvData}
                                    headers={csvHeaders}
                                    filename={`form-${selectedTemplate}-responses-${new Date().toISOString().slice(0, 10)}.csv`}
                                >
                                    <Button icon={<DownloadOutlined />}>Export CSV</Button>
                                </CSVLink>
                            )
                        )}

                    </Space>
                }
            >
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                        <Select
                            placeholder="Filter: Survey / Assessment"
                            style={{ width: '100%' }}
                            value={kindFilter}
                            onChange={v => {
                                setKindFilter(v as KindFilter)
                                setSelectedTemplate(undefined)
                            }}
                        >
                            <Option value="all">All</Option>
                            <Option value="survey">Surveys</Option>
                            <Option value="assessment">Assessments</Option>
                        </Select>
                    </Col>

                    <Col xs={24} sm={12} md={6}>
                        <Select
                            placeholder="Select Form Template"
                            style={{ width: '100%' }}
                            onChange={setSelectedTemplate}
                            value={selectedTemplate}
                            allowClear
                            showSearch
                            optionFilterProp="children"
                        >
                            {filteredTemplates.map(t => (
                                <Option key={t.id} value={t.id}>
                                    {t.title}
                                </Option>
                            ))}
                        </Select>
                    </Col>

                    <Col xs={24} sm={24} md={6}>
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
            </MotionCard>

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
