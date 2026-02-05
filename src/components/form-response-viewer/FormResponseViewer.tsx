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
    Tooltip,
    Progress as AntProgress
} from 'antd'
import {
    EyeOutlined,
    DownloadOutlined,
    SortAscendingOutlined,
    SortDescendingOutlined,
    BarChartOutlined,
    FileTextOutlined,
    ClockCircleOutlined,
    TrophyOutlined
} from '@ant-design/icons'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/firebase'
import { CSVLink } from 'react-csv'
import { DashboardHeaderCard, MotionCard } from '../shared/Header'
import { Helmet } from 'react-helmet'

import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import WordcloudModule from 'highcharts/modules/wordcloud'
import HeatmapModule from 'highcharts/modules/heatmap'
import HighchartsMore from 'highcharts/highcharts-more'

import { useFullIdentity } from '@/hooks/useFullIdentity'

if (typeof WordcloudModule === 'function') WordcloudModule(Highcharts)
if (typeof HeatmapModule === 'function') HeatmapModule(Highcharts)
if (typeof HighchartsMore === 'function') HighchartsMore(Highcharts)

const { Text, Title } = Typography
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
    correctAnswer?: any
    points?: number
}

interface FormTemplate {
    id: string
    title: string
    description: string
    category: string
    fields: FormField[]
    status?: 'draft' | 'published' | string
    companyCode?: string
    assessmentMeta?: any
}

interface FormResponse {
    id: string
    templateId?: string
    answers?: AnswersMap
    formId?: string
    responses?: AnswersMap
    formTitle: string
    submittedBy: { id?: string; name?: string; email?: string }
    submittedAt: any
    status?: string
    notes?: string
    kind?: 'survey' | 'assessment'
    companyCode?: string
    timing?: any
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

const ASSESSMENT_CATEGORIES = new Set(['post_intervention', 'general'])
const isAssessmentCategory = (cat?: string) => ASSESSMENT_CATEGORIES.has(String(cat || ''))

const CHOICE_TYPES = new Set([
    'radio', 'select', 'dropdown', 'checkbox', 'multiselect', 'multi_select', 'mcq', 'multiple_choice'
])

const isTextType = (t?: string) => {
    const x = String(t || '').toLowerCase()
    return x === 'short' || x === 'long' || x === 'text' || x === 'textarea'
}

const isChoiceType = (t?: string) => {
    const x = String(t || '').toLowerCase()
    return CHOICE_TYPES.has(x)
}

const isGradableType = (t?: string) => {
    const x = String(t || '').toLowerCase()
    // grade only if it has correctAnswer and is choice/number/rating
    return isChoiceType(x) || x === 'number' || x === 'rating'
}

const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

function toDateSafe(v: any): Date | null {
    if (!v) return null
    if (typeof v?.toDate === 'function') {
        try { return v.toDate() } catch { /* ignore */ }
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

function formatDateTime(v: any) {
    const d = toDateSafe(v)
    return d ? d.toLocaleString() : '-'
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

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
    series: [
        {
            name: 'Responses',
            data: [dist[1] || 0, dist[2] || 0, dist[3] || 0, dist[4] || 0, dist[5] || 0]
        }
    ]
})

const radarChoiceOptions = (title: string, cats: string[], counts: number[]) => ({
    chart: { polar: true, type: 'column', height: 320 },
    title: { text: title },
    credits: { enabled: false },
    xAxis: {
        categories: cats,
        tickmarkPlacement: 'on',
        lineWidth: 0
    },
    yAxis: {
        gridLineInterpolation: 'polygon',
        min: 0,
        title: { text: '' }
    },
    tooltip: { shared: true },
    series: [{ name: 'Count', data: counts }]
})

const choiceHeatmapOptions = (title: string, xCats: string[], yCats: string[], data: Array<[number, number, number]>) => {
    const maxV = data.reduce((m, p) => Math.max(m, p[2]), 0)
    return {
        chart: { type: 'heatmap', height: Math.max(360, 28 * yCats.length + 120) },
        title: { text: title },
        credits: { enabled: false },
        xAxis: { categories: xCats, title: { text: 'Options' } },
        yAxis: { categories: yCats, title: { text: 'Questions' }, reversed: true },
        colorAxis: {
            min: 0,
            max: Math.max(1, maxV),
            stops: [
                [0, '#f7fbff'],
                [0.4, '#c6dbef'],
                [0.7, '#6baed6'],
                [1, '#08519c']
            ]
        },
        tooltip: {
            pointFormat: '<b>{point.value}</b> selections'
        },
        series: [
            {
                type: 'heatmap' as const,
                borderWidth: 1,
                data,
                dataLabels: { enabled: true, format: '{point.value}' }
            }
        ]
    }
}

const normalizeForCompare = (v: any) => {
    if (Array.isArray(v)) return v.map(x => String(x).trim()).sort()
    if (v === null || v === undefined) return null
    return String(v).trim()
}

const isCorrect = (answer: any, correct: any) => {
    const a = normalizeForCompare(answer)
    const c = normalizeForCompare(correct)
    if (a === null || c === null) return false
    if (Array.isArray(a) && Array.isArray(c)) {
        if (a.length !== c.length) return false
        return a.every((x, i) => x === c[i])
    }
    return String(a) === String(c)
}

const letter = (i: number) => String.fromCharCode('A'.charCodeAt(0) + i)

const FormResponseViewer: React.FC<Props> = ({ formId }) => {
    const { message } = App.useApp()
    const { user } = useFullIdentity() as any
    const myEmail = String(user?.email || '')
    const myCompany = String(user?.companyCode || '')
    const isMainDomain = myEmail.toLowerCase().endsWith('@quantilytix.co.za')

    const [loading, setLoading] = useState(true)
    const [templates, setTemplates] = useState<FormTemplate[]>([])
    const [responses, setResponses] = useState<FormResponse[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(formId)
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [searchText, setSearchText] = useState('')
    const [kindFilter, setKindFilter] = useState<KindFilter>('all')

    const [selectedCompany, setSelectedCompany] = useState<string>(
        isMainDomain ? 'all' : (myCompany || 'all')
    )

    const [viewOpen, setViewOpen] = useState(false)
    const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null)
    const [fs, setFs] = useState(false)
    const [ansFilter, setAnsFilter] = useState('')

    const [summaryOpen, setSummaryOpen] = useState(false)
    const [summaryFs, setSummaryFs] = useState(false)

    const [csvData, setCsvData] = useState<any[]>([])
    const [csvHeaders, setCsvHeaders] = useState<{ label: string; key: string }[]>([])

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
        if (!t) return 'unknown'
        return isAssessmentCategory(t.category) ? 'assessment' : 'survey'
    }


    const getCompanyForResponse = (r: FormResponse): string => {
        if (r.companyCode) return String(r.companyCode)
        const t = getTemplateForResponse(r)
        if (t?.companyCode) return String(t.companyCode)
        return 'UNKNOWN'
    }

    const companyOptions = useMemo(() => {
        const s = new Set<string>()
        templates.forEach(t => t.companyCode && s.add(String(t.companyCode)))
        responses.forEach(r => r.companyCode && s.add(String(r.companyCode)))
        return Array.from(s).sort()
    }, [templates, responses])

    // -------- load templates --------
    useEffect(() => {
        ; (async () => {
            try {
                const colRef = collection(db, 'formTemplates')
                const qRef = (!isMainDomain && myCompany)
                    ? query(colRef, where('companyCode', '==', myCompany))
                    : query(colRef)

                const snap = await getDocs(qRef)
                const t: FormTemplate[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
                setTemplates(t)
            } catch (e) {
                console.error(e)
                message.error('Failed to load form templates')
            }
        })()
    }, [message, isMainDomain, myCompany])

    // -------- load responses --------
    useEffect(() => {
        ; (async () => {
            try {
                setLoading(true)
                const colRef = collection(db, 'formResponses')
                const merged = new Map<string, FormResponse>()

                const addRows = (rows: FormResponse[]) => rows.forEach(r => merged.set(r.id, r))

                if (selectedTemplate) {
                    const q1 = query(colRef, where('templateId', '==', selectedTemplate), orderBy('submittedAt', sortOrder))
                    const s1 = await getDocs(q1)


                    addRows(s1.docs.map(d => ({ id: d.id, ...(d.data() as any) })))

                    const q2 = query(colRef, where('formId', '==', selectedTemplate), orderBy('submittedAt', sortOrder))
                    const s2 = await getDocs(q2)
                    addRows(s2.docs.map(d => ({ id: d.id, ...(d.data() as any) })))

                    if (s1) {
                        console.log('S1:', s1)
                    } else {
                        console.log('S2:', s2)
                    }

                    setResponses(Array.from(merged.values()))
                    return
                }

                if (isMainDomain) {
                    const qAll = query(colRef, orderBy('submittedAt', sortOrder))
                    const sAll = await getDocs(qAll)
                    addRows(sAll.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
                    setResponses(Array.from(merged.values()))
                    return
                }

                const companyTemplates = templates.filter(t => String(t.companyCode || '') === myCompany)
                const companyTemplateIds = companyTemplates.map(t => t.id)


                if (myCompany) {
                    const qByCompany = query(colRef, where('companyCode', '==', myCompany), orderBy('submittedAt', sortOrder))
                    const sByCompany = await getDocs(qByCompany)
                    addRows(sByCompany.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
                }

                for (const ids of chunk(companyTemplateIds, 10)) {
                    if (!ids.length) continue
                    const qByTpl = query(colRef, where('templateId', 'in', ids), orderBy('submittedAt', sortOrder))
                    const sByTpl = await getDocs(qByTpl)
                    addRows(sByTpl.docs.map(d => ({ id: d.id, ...(d.data() as any) })))

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

    // templates filter
    const filteredTemplates = useMemo(() => {
        const base = templates
        const byCompany =
            selectedCompany === 'all' ? base : base.filter(t => String(t.companyCode || '') === selectedCompany)

        if (kindFilter === 'all') return byCompany
        return byCompany.filter(t =>
            kindFilter === 'assessment' ? isAssessmentCategory(t.category) : !isAssessmentCategory(t.category)
        )
    }, [templates, kindFilter, selectedCompany])

    // response filter
    const filtered = useMemo(() => {
        let arr = [...responses]

        if (selectedCompany !== 'all') arr = arr.filter(r => getCompanyForResponse(r) === selectedCompany)
        if (kindFilter !== 'all') arr = arr.filter(r => getKindForResponse(r) === kindFilter)

        if (searchText) {
            const s = searchText.toLowerCase()
            arr = arr.filter(r => {
                const who = `${r.submittedBy?.name || ''} ${r.submittedBy?.email || ''}`.toLowerCase()
                return (r.formTitle || '').toLowerCase().includes(s) || who.includes(s)
            })
        }

        return arr
    }, [responses, searchText, kindFilter, selectedCompany])

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
            total, surveys, assessments, uniqueForms, uniqueSubmitters,
            latest: latestMs ? new Date(latestMs).toLocaleString() : '-'
        }
    }, [filtered])

    // -------- CSV pivot (unchanged) --------
    useEffect(() => {
        if (!selectedTemplate) {
            setCsvData([])
            setCsvHeaders([])
            return
        }

        const template = templates.find(t => t.id === selectedTemplate) || null
        const rowsForThisForm = groupedSorted.filter(r => (r.templateId || r.formId) === selectedTemplate)

        if (!rowsForThisForm.length) {
            setCsvData([])
            setCsvHeaders([])
            return
        }

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

        const headers: { label: string; key: string }[] = [
            { label: 'Respondent Name', key: 'respondent_name' },
            { label: 'Respondent Email', key: 'respondent_email' },
            { label: 'Submitted At', key: 'submitted_at' },
            ...effectiveFields.map(f => ({ label: f.label, key: `q__${f.id}` }))
        ]

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

    // -------- render helpers --------
    const renderAnswerValue = (v: any) => {
        const str = Array.isArray(v) ? v.join(', ')
            : typeof v === 'object' && v !== null ? JSON.stringify(v)
                : String(v ?? '')

        if (!ansFilter) return str
        return str.toLowerCase().includes(ansFilter.toLowerCase()) ? str : null
    }

    const computeScoreForResponse = (tpl: FormTemplate, r: FormResponse) => {
        const answers = getAnswers(r)
        const fields = (tpl.fields || []).filter(f => f.type !== 'heading')
        const gradable = fields.filter(f => f.correctAnswer !== undefined && f.correctAnswer !== null && isGradableType(f.type))
        if (!gradable.length) return null

        let earned = 0
        let total = 0
        let gradedCount = 0

        for (const f of gradable) {
            const pts = typeof f.points === 'number' && f.points > 0 ? f.points : 1
            total += pts
            const ok = isCorrect(answers[f.id], f.correctAnswer)
            if (ok) earned += pts
            gradedCount += 1
        }

        const pct = total > 0 ? (earned / total) * 100 : 0
        return { earned, total, pct, gradedCount, totalGradable: gradable.length }
    }

    // -------- VIEW MODAL (fix duplication + remove sticky + show assessment grading) --------

    const renderDetails = () => {
        if (!selectedResponse) return null

        const template = getTemplateForResponse(selectedResponse)
        const answers = getAnswers(selectedResponse)
        const kind = getKindForResponse(selectedResponse)
        const isAssessment = kind === 'assessment'

        const tplFields = (template?.fields || []) as FormField[]
        const hasHeadings = tplFields.some(f => f.type === 'heading')
        const fieldsNoHeadings = tplFields.filter(f => f.type !== 'heading')

        const score = template && isAssessment ? computeScoreForResponse(template, selectedResponse) : null

        const gradableKeyFields =
            template && isAssessment
                ? fieldsNoHeadings.filter(
                    f => f.correctAnswer !== undefined && f.correctAnswer !== null && isGradableType(f.type)
                )
                : []

        // Anything NOT in auto-graded key fields is treated as “ungraded / extra responses”
        const ungradedFields =
            template && isAssessment
                ? fieldsNoHeadings.filter(f => !gradableKeyFields.some(g => g.id === f.id))
                : fieldsNoHeadings

        // ---- Grouping helpers (respect headings) ----
        const groupByHeadings = (list: FormField[]) => {
            const groups: Array<{ title: string; fields: FormField[] }> = []
            if (!template) return groups

            if (!hasHeadings) {
                groups.push({ title: 'Responses', fields: list })
                return groups
            }

            let currentTitle = 'Section'
            let bucket: FormField[] = []

            const flush = () => {
                if (bucket.length) groups.push({ title: currentTitle, fields: bucket })
                bucket = []
            }

            for (const f of tplFields) {
                if (f.type === 'heading') {
                    flush()
                    currentTitle = f.label || 'Section'
                    continue
                }
                if (list.some(x => x.id === f.id)) bucket.push(f)
            }
            flush()
            return groups
        }

        const responseGroups = groupByHeadings(ungradedFields)

        const headerCard = (
            <Card
                size="small"
                style={{ borderRadius: 14, marginBottom: 12 }}
                bodyStyle={{ padding: 14 }}
            >
                <Typography.Title level={5} style={{ margin: 0, marginBottom: 10 }}>
                    Submission
                </Typography.Title>

                <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Form">{selectedResponse.formTitle}</Descriptions.Item>
                    <Descriptions.Item label="Type">
                        {kind === 'assessment' ? (
                            <Tag color="geekblue">ASSESSMENT</Tag>
                        ) : kind === 'survey' ? (
                            <Tag color="cyan">SURVEY</Tag>
                        ) : (
                            <Tag>UNKNOWN</Tag>
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Submitted By">
                        {selectedResponse.submittedBy?.name || '-'}{' '}
                        <Text type="secondary">({selectedResponse.submittedBy?.email || '-'})</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Submitted At">{formatDateTime(selectedResponse.submittedAt)}</Descriptions.Item>
                    <Descriptions.Item label="Status">
                        <Tag color="processing">{String(selectedResponse.status || 'submitted').toUpperCase()}</Tag>
                    </Descriptions.Item>
                </Descriptions>
            </Card>
        )

        const scoreCard =
            isAssessment && score ? (
                <Card
                    size="small"
                    style={{ borderRadius: 14, marginBottom: 12 }}
                    bodyStyle={{ padding: 14 }}
                >
                    <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space direction="vertical" size={2}>
                            <Space align="center" wrap>
                                <TrophyOutlined />
                                <Text strong style={{ fontSize: 16 }}>
                                    Score
                                </Text>

                                <Tag
                                    color={score.pct >= 70 ? 'success' : score.pct >= 50 ? 'warning' : 'error'}
                                    style={{ marginInlineStart: 6 }}
                                >
                                    {Math.round(score.pct)}%
                                </Tag>
                            </Space>

                            <Text type="secondary">
                                Points: <Text strong>{score.earned}</Text> / <Text strong>{score.total}</Text>
                                {'  '}•{'  '}
                                Auto-graded: <Text strong>{score.gradedCount}</Text>
                            </Text>
                        </Space>

                        <div style={{ minWidth: 220 }}>
                            <AntProgress
                                percent={Math.round(score.pct)}
                                showInfo={false}
                            />
                        </div>
                    </Space>
                </Card>
            ) : null

        // ---- Answer key comparison rows (auto-graded) ----
        const renderAnswerKey = () => {
            if (!isAssessment) return null
            if (!template) return <Empty description="Template missing — cannot compute answer key." />
            if (!gradableKeyFields.length) return <Empty description="No auto-graded questions (missing correctAnswer / unsupported types)." />

            return (
                <Space direction="vertical" style={{ width: '100%' }} size={10}>
                    {gradableKeyFields.map((f, idx) => {
                        const userAns = answers[f.id]
                        const correct = f.correctAnswer
                        const ok = isCorrect(userAns, correct)

                        const userStr = Array.isArray(userAns) ? userAns.join(', ') : String(userAns ?? '')
                        const correctStr = Array.isArray(correct) ? correct.join(', ') : String(correct ?? '')

                        return (
                            <Card key={f.id} size="small" style={{ borderRadius: 12 }}>
                                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                    <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Text strong>{`Q${idx + 1}. ${f.label || f.id}`}</Text>
                                        {ok ? <Tag color="success">Correct</Tag> : <Tag color="error">Incorrect</Tag>}
                                    </Space>

                                    <Row gutter={[12, 8]}>
                                        <Col xs={24} md={12}>
                                            <Text type="secondary">User answer</Text>
                                            <div style={{ marginTop: 6 }}>
                                                <Tag color={ok ? 'success' : 'default'}>{userStr || '-'}</Tag>
                                            </div>
                                        </Col>

                                        <Col xs={24} md={12}>
                                            <Text type="secondary">Correct answer</Text>
                                            <div style={{ marginTop: 6 }}>
                                                <Tag color="geekblue">{correctStr || '-'}</Tag>
                                            </div>
                                        </Col>
                                    </Row>
                                </Space>
                            </Card>
                        )
                    })}
                </Space>
            )
        }

        // ---- Responses (survey OR ungraded-only for assessment) ----
        const renderResponses = () => {
            if (!template) {
                // raw fallback
                const rows = Object.entries(answers)
                if (!rows.length) return <Empty description="No responses to show." />

                return (
                    <Descriptions bordered column={1} size="small">
                        {rows.map(([k, v]) => {
                            const rendered = renderAnswerValue(v)
                            if (rendered === null) return null
                            return (
                                <Descriptions.Item key={k} label={k}>
                                    {rendered}
                                </Descriptions.Item>
                            )
                        })}
                    </Descriptions>
                )
            }

            const any = responseGroups.some(g => g.fields.some(f => answers[f.id] !== undefined))
            if (!any) {
                return (
                    <Empty
                        description={
                            isAssessment
                                ? 'No additional (ungraded) responses to show.'
                                : 'No responses to show.'
                        }
                    />
                )
            }

            return (
                <Collapse accordion>
                    {responseGroups.map(g => (
                        <Collapse.Panel header={g.title} key={g.title}>
                            <Descriptions bordered column={1} size="small">
                                {g.fields.map(f => {
                                    const v = answers[f.id]
                                    if (v === undefined) return null
                                    const rendered = renderAnswerValue(v)
                                    if (rendered === null) return null
                                    return (
                                        <Descriptions.Item key={f.id} label={f.label || f.id}>
                                            {rendered}
                                        </Descriptions.Item>
                                    )
                                })}
                            </Descriptions>
                        </Collapse.Panel>
                    ))}
                </Collapse>
            )
        }

        return (
            <div>
                {headerCard}

                {/* Score always visible for assessments */}
                {scoreCard}

                {/* Search inside answers */}
                <Card size="small" style={{ borderRadius: 14, marginBottom: 12 }} bodyStyle={{ padding: 14 }}>
                    <Space direction="vertical" style={{ width: '100%' }} size={10}>
                        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text strong style={{ fontSize: 15 }}>
                                {isAssessment ? 'Answers' : 'Responses'}
                            </Text>
                            <Tag>{isAssessment ? 'Assessment View' : 'Survey View'}</Tag>
                        </Space>

                        <Input
                            allowClear
                            placeholder={isAssessment ? 'Search within answers (auto + ungraded)' : 'Search within responses'}
                            value={ansFilter}
                            onChange={e => setAnsFilter(e.target.value)}
                        />

                        {/* ONE conditional flow:
                - Survey: just responses
                - Assessment: collapse with 2 panels (auto-graded + ungraded) */}
                        {isAssessment ? (
                            <Collapse defaultActiveKey={['ak']} style={{ borderRadius: 12 }}>
                                <Collapse.Panel
                                    key="ak"
                                    header={
                                        <Space>
                                            <TrophyOutlined />
                                            <span>Auto-graded (Answer Key)</span>
                                            <Tag color="geekblue">{gradableKeyFields.length}</Tag>
                                        </Space>
                                    }
                                >
                                    {renderAnswerKey()}
                                </Collapse.Panel>

                                <Collapse.Panel
                                    key="ur"
                                    header={
                                        <Space>
                                            <FileTextOutlined />
                                            <span>Ungraded / Extra Responses</span>
                                            <Tag>{ungradedFields.length}</Tag>
                                        </Space>
                                    }
                                >
                                    {renderResponses()}
                                </Collapse.Panel>
                            </Collapse>
                        ) : (
                            renderResponses()
                        )}
                    </Space>
                </Card>
            </div>
        )
    }


    // -------- Consolidated Summary (add leaderboard per assessment + better choice charting) --------
    const renderLeaderboardBoard = (tpl: FormTemplate, rows: FormResponse[]) => {
        // compute scores for each response
        const scored = rows
            .map(r => {
                const s = computeScoreForResponse(tpl, r)
                if (!s) return null
                return {
                    id: r.id,
                    name: r.submittedBy?.name || r.submittedBy?.email || 'Unknown',
                    email: r.submittedBy?.email || '',
                    pct: s.pct,
                    earned: s.earned,
                    total: s.total,
                    submittedAt: r.submittedAt
                }
            })
            .filter(Boolean) as Array<any>

        if (!scored.length) return <Empty description="No gradable scores found for leaderboard." />

        scored.sort((a, b) => b.pct - a.pct)

        const top = scored.slice(0, 15)
        const maxPct = Math.max(...top.map(x => x.pct))

        return (
            <Card size="small" style={{ borderRadius: 12 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={10}>
                    {top.map((x, idx) => (
                        <div key={x.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ width: 34, textAlign: 'center' }}>
                                <Tag color={idx === 0 ? 'gold' : idx === 1 ? 'geekblue' : idx === 2 ? 'cyan' : 'default'}>
                                    {idx + 1}
                                </Tag>
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <Text strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {x.name}
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {x.email || '-'}
                                        </Text>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <Text strong>{Math.round(x.pct)}%</Text>
                                        <div>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {x.earned}/{x.total}
                                            </Text>
                                        </div>
                                    </div>
                                </div>

                                <AntProgress
                                    percent={Math.round(x.pct)}
                                    strokeColor={x.pct >= 70 ? '#52c41a' : x.pct >= 50 ? '#faad14' : '#ff4d4f'}
                                    showInfo={false}
                                />
                            </div>
                        </div>
                    ))}
                </Space>
            </Card>
        )
    }

    const buildChoiceOverallHeatmap = (tpl: FormTemplate, rows: FormResponse[]) => {
        // Only choice questions with options
        const choiceFields = (tpl.fields || [])
            .filter(f => f.type !== 'heading')
            .filter(f => (isChoiceType(f.type) && Array.isArray(f.options) && f.options.length >= 2))

        if (!choiceFields.length) return null

        // Keep it readable: top 25 questions by response count
        const withCounts = choiceFields.map(f => {
            let c = 0
            for (const r of rows) {
                const v = getAnswers(r)[f.id]
                if (v === undefined || v === null || String(v).trim() === '') continue
                c += Array.isArray(v) ? v.length : 1
            }
            return { f, c }
        }).sort((a, b) => b.c - a.c).slice(0, 25)

        const picked = withCounts.map(x => x.f)
        const maxOptions = Math.max(...picked.map(f => (f.options || []).length))

        const xCats = Array.from({ length: maxOptions }, (_, i) => letter(i)) // A..N
        const yCats = picked.map((_, i) => `Q${i + 1}`)

        const data: Array<[number, number, number]> = []
        picked.forEach((f, qi) => {
            const opts = f.options || []
            // map option text -> index
            const optIndex = new Map<string, number>()
            opts.forEach((o, i) => optIndex.set(String(o), i))

            const counts = new Array(maxOptions).fill(0)
            rows.forEach(r => {
                const v = getAnswers(r)[f.id]
                if (v === undefined || v === null) return
                const add = (val: any) => {
                    const idx = optIndex.get(String(val))
                    if (typeof idx === 'number') counts[idx] += 1
                }
                if (Array.isArray(v)) v.forEach(add)
                else add(v)
            })

            counts.forEach((cnt, oi) => {
                if (cnt > 0) data.push([oi, qi, cnt])
                else data.push([oi, qi, 0])
            })
        })

        return {
            xCats,
            yCats,
            data,
            mapQuestionLabel: (qIdx: number) => {
                const f = picked[qIdx]
                return f?.label || `Q${qIdx + 1}`
            },
            pickedFields: picked
        }
    }

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

                    const choiceOverall = (t && kind === 'assessment') ? buildChoiceOverallHeatmap(t, rows) : null

                    const fieldBlocks = effectiveFields.map((f, fieldIdx) => {
                        const valuesRaw = rows.map(r => getAnswers(r)[f.id]).filter(v => v !== undefined && v !== null && String(v).trim() !== '')
                        if (!valuesRaw.length) return null

                        const flatValues: any[] = []
                        valuesRaw.forEach(v => Array.isArray(v) ? v.forEach(x => flatValues.push(x)) : flatValues.push(v))

                        // Likert detection
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

                                        <Collapse style={{ marginTop: 8 }}>
                                            <Panel header="Distribution (Spiderweb)" key="radar">
                                                <HighchartsReact
                                                    highcharts={Highcharts}
                                                    options={radarLikertOptions(`Likert Distribution: ${f.label || f.id}`, dist)}
                                                />
                                            </Panel>
                                        </Collapse>
                                    </Space>
                                </Card>
                            )
                        }

                        // Choice detection
                        const hasOptions = Array.isArray(f.options) && f.options.length > 0
                        const isChoice = hasOptions || isChoiceType(f.type)

                        if (isChoice && hasOptions) {
                            const opts = f.options || []
                            const counts = opts.map(() => 0)
                            const optIndex = new Map<string, number>()
                            opts.forEach((o, i) => optIndex.set(String(o), i))

                            flatValues.forEach(v => {
                                const idx = optIndex.get(String(v))
                                if (typeof idx === 'number') counts[idx] += 1
                            })

                            const cats = opts.map((_, i) => letter(i))
                            const titleShort = `Q${fieldIdx + 1} Choice Breakdown (A–${letter(Math.max(0, cats.length - 1))})`

                            return (
                                <Card key={f.id} size="small" style={{ marginBottom: 10 }}>
                                    <Space direction="vertical" style={{ width: '100%' }} size={6}>
                                        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                                            <Text strong>{f.label || f.id}</Text>
                                            <Tag color="geekblue">CHOICE</Tag>
                                        </Space>

                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            Options mapped as A–{letter(opts.length - 1)} for distribution consistency.
                                        </Text>

                                        <Collapse style={{ marginTop: 8 }}>
                                            <Panel header="Distribution (Spiderweb)" key="spider">
                                                <HighchartsReact
                                                    highcharts={Highcharts}
                                                    options={radarChoiceOptions(titleShort, cats, counts)}
                                                />
                                            </Panel>

                                            <Panel header="Option legend" key="legend">
                                                <div style={{ display: 'grid', gap: 6 }}>
                                                    {opts.map((o, i) => (
                                                        <div key={o} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                            <Tag style={{ width: 40, textAlign: 'center' }}>{letter(i)}</Tag>
                                                            <Text>{o}</Text>
                                                            <Text type="secondary">({counts[i]})</Text>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Panel>
                                        </Collapse>
                                    </Space>
                                </Card>
                            )
                        }

                        // Text summary
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
                                                <HighchartsReact
                                                    highcharts={Highcharts}
                                                    options={wordcloudOptions(`Word Cloud: ${f.label || f.id}`, keywords)}
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
                                        {kind === 'assessment'
                                            ? <Tag color="geekblue">Assessment</Tag>
                                            : kind === 'survey'
                                                ? <Tag color="cyan">Survey</Tag>
                                                : <Tag>UNKNOWN</Tag>}
                                        <Tag color="geekblue">{rows.length} submissions</Tag>
                                        {!t && <Tag color="warning">Template missing</Tag>}
                                    </Space>
                                }
                                key={tid}
                            >
                                {/* Leaderboard under assessment (folded) */}
                                {t && kind === 'assessment' && (
                                    <Collapse style={{ marginBottom: 12 }}>
                                        <Panel header={<Space><TrophyOutlined />Leaderboard</Space>} key="lb">
                                            {renderLeaderboardBoard(t, rows)}
                                        </Panel>
                                    </Collapse>
                                )}

                                {/* Overall choice distribution heatmap */}
                                {t && kind === 'assessment' && choiceOverall && (
                                    <Card size="small" style={{ marginBottom: 12 }}>
                                        <Space direction="vertical" style={{ width: '100%' }} size={6}>
                                            <Text strong>Overall choice distribution (Q1–Qn vs A–N)</Text>
                                            <Text type="secondary">
                                                Each cell is how many times an option letter was selected for that question.
                                            </Text>

                                            <HighchartsReact
                                                highcharts={Highcharts}
                                                options={choiceHeatmapOptions(
                                                    `Choice Heatmap: ${t.title}`,
                                                    choiceOverall.xCats,
                                                    choiceOverall.yCats,
                                                    choiceOverall.data
                                                )}
                                            />

                                            <Collapse style={{ marginTop: 8 }}>
                                                <Panel header="Question mapping" key="qm">
                                                    <div style={{ display: 'grid', gap: 6 }}>
                                                        {choiceOverall.yCats.map((q, idx) => (
                                                            <div key={q} style={{ display: 'flex', gap: 10 }}>
                                                                <Tag style={{ width: 50, textAlign: 'center' }}>{q}</Tag>
                                                                <Text>{choiceOverall.mapQuestionLabel(idx)}</Text>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </Panel>
                                            </Collapse>
                                        </Space>
                                    </Card>
                                )}

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
