import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Card,
  Row,
  Col,
  Form,
  InputNumber,
  Spin,
  Button,
  Slider,
  Space,
  Tabs,
  List
} from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import Treegraph from 'highcharts/modules/treegraph'
import { Helmet } from 'react-helmet'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'
import { auth, db } from '@/firebase'
import { doc, getDoc } from 'firebase/firestore'

if (typeof Highcharts === 'function') {
  Treegraph(Highcharts)
}

type Target = 'sales' | 'revenue'

interface Intervention {
  name: string
  weightByMonth: number[]
}
interface Incubatee {
  id: string
  name: string
  revenue: number[]
  headcount: number[]
  impacts: Record<Target, Intervention[]>
}
type ImpactRow = { name: string; value: number }

// === Weight scale (no percentages) ===
const WEIGHT_MIN = -10
const WEIGHT_MAX = 12
const neutralStop = (0 - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN) // center=0

// Unified Card style + motion wrapper
const cardStyle: React.CSSProperties = {
  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
  transition: 'all 0.3s ease',
  borderRadius: 8,
  border: '1px solid #d6e4ff'
}
const MotionCard: React.FC<React.ComponentProps<typeof Card>> = ({
  children,
  style,
  ...rest
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    <Card {...rest} style={{ ...cardStyle, ...(style || {}) }}>
      {children}
    </Card>
  </motion.div>
)

/** ---------------- Dummy fallbacks ---------------- */
const DUMMY_IMPACTS: Record<Target, Intervention[]> = {
  sales: [
    { name: 'Website Development', weightByMonth: [80, 85, 90, 92] },
    { name: 'CRM Setup', weightByMonth: [60, 65, 75, 78] },
    { name: 'Mentorship Sessions', weightByMonth: [88, 89, 91, 94] },
    { name: 'Financial Literacy', weightByMonth: [55, 60, 68, 70] },
    { name: 'Branding & Logo', weightByMonth: [-10, -5, 5, 12] },
    { name: 'Compliance Training', weightByMonth: [70, 72, -15, 78] },
    { name: 'Strategic Planning', weightByMonth: [83, 84, 86, 88] },
    { name: 'Workflow Tools', weightByMonth: [-30, -22, -10, 5] },
    { name: 'Legal Structuring', weightByMonth: [10, 15, 5, -8] }
  ],
  revenue: [
    { name: 'Website Development', weightByMonth: [65, 72, 81, 88] },
    { name: 'CRM Setup', weightByMonth: [50, 58, 70, 76] },
    { name: 'Mentorship Sessions', weightByMonth: [75, 80, 86, 92] },
    { name: 'Financial Literacy', weightByMonth: [40, 50, 60, 66] },
    { name: 'Branding & Logo', weightByMonth: [-15, -6, 4, 10] },
    { name: 'Compliance Training', weightByMonth: [55, 60, -12, 70] },
    { name: 'Strategic Planning', weightByMonth: [70, 76, 82, 87] },
    { name: 'Workflow Tools', weightByMonth: [-25, -15, -5, 6] },
    { name: 'Legal Structuring', weightByMonth: [8, 12, 10, -5] }
  ]
}

const AREA_OF_SUPPORT: Record<string, string> = {
  'Website Development': 'Marketing',
  'Branding & Logo': 'Marketing',
  'CRM Setup': 'Operations',
  'Mentorship Sessions': 'Operations',
  'Workflow Tools': 'Operations',
  'Strategic Planning': 'Operations',
  'Compliance Training': 'Operations',
  'Financial Literacy': 'Finance',
  'Legal Structuring': 'Finance'
}

const DUMMY_INCUBATEES: Incubatee[] = [
  {
    id: 'john',
    name: 'John Mokoena',
    revenue: [120, 138, 145, 162, 175, 189],
    headcount: [3, 3, 4, 4, 5, 5],
    impacts: { sales: DUMMY_IMPACTS.sales, revenue: DUMMY_IMPACTS.revenue }
  },
  {
    id: 'sarah',
    name: 'Sarah Nkosi',
    revenue: [95, 102, 110, 118, 130, 141],
    headcount: [2, 2, 2, 3, 3, 3],
    impacts: { sales: DUMMY_IMPACTS.sales, revenue: DUMMY_IMPACTS.revenue }
  },
  {
    id: 'lebo',
    name: 'Lebo Dlamini',
    revenue: [150, 155, 160, 170, 180, 195],
    headcount: [4, 4, 4, 5, 5, 6],
    impacts: { sales: DUMMY_IMPACTS.sales, revenue: DUMMY_IMPACTS.revenue }
  }
]

/** ---------------- Helpers ---------------- */
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n))

// Add this helper once (same palette as your stops)
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
const hexToRgb = (hex: string) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}
const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
const valueToColor = (v: number) => {
  const min = WEIGHT_MIN,
    max = WEIGHT_MAX
  const t = Math.max(0, Math.min(1, (v - min) / (max - min)))
  const red = '#d73027',
    mid = '#f0f0f0',
    green = '#1a9850'
  const c1 = t <= 0.5 ? hexToRgb(red) : hexToRgb(mid)
  const c2 = t <= 0.5 ? hexToRgb(mid) : hexToRgb(green)
  const tt = t <= 0.5 ? t / 0.5 : (t - 0.5) / 0.5
  return rgbToHex({
    r: lerp(c1.r, c2.r, tt),
    g: lerp(c1.g, c2.g, tt),
    b: lerp(c1.b, c2.b, tt)
  })
}

function projectPoint (series: number[], k: number): number {
  if (!series.length) return 0
  if (k <= 0) return series[series.length - 1]
  const last = series[series.length - 1]
  const prev = series.length > 1 ? series[series.length - 2] : last
  const slope = last - prev
  return Number((last + slope * k).toFixed(1))
}

function buildCategories (histLen: number, monthsAhead: number): string[] {
  const safeLen = Math.max(1, histLen)
  const baseEnd = dayjs()
  const start = baseEnd.subtract(safeLen - 1, 'month')
  const cats: string[] = []
  for (let i = 0; i < safeLen; i++)
    cats.push(start.add(i, 'month').format('MMM'))
  for (let k = 1; k <= monthsAhead; k++)
    cats.push(baseEnd.add(k, 'month').format('MMM'))
  return cats
}

function splitHistForecast (
  series: number[],
  monthsAhead: number
): { hist: (number | null)[]; fcst: (number | null)[] } {
  const histLen = series.length
  if (histLen === 0) {
    const hist: (number | null)[] = Array(monthsAhead).fill(null)
    const fcst: (number | null)[] = Array(monthsAhead).fill(null)
    for (let k = 1; k <= monthsAhead; k++) fcst[k - 1] = projectPoint([], k)
    return { hist, fcst }
  }
  const totalLen = histLen + monthsAhead
  const hist: (number | null)[] = Array(totalLen).fill(null)
  const fcst: (number | null)[] = Array(totalLen).fill(null)
  for (let i = 0; i < histLen; i++) hist[i] = series[i]
  fcst[histLen - 1] = series[histLen - 1]
  for (let k = 1; k <= monthsAhead; k++)
    fcst[histLen - 1 + k] = projectPoint(series, k)
  return { hist, fcst }
}

function averageSeries (rows: number[][]): number[] {
  if (!rows.length) return []
  const len = rows[0].length
  const out: number[] = Array(len).fill(0)
  for (let i = 0; i < len; i++) {
    let sum = 0,
      cnt = 0
    for (const r of rows)
      if (r[i] != null) {
        sum += r[i]
        cnt++
      }
    out[i] = cnt ? Number((sum / cnt).toFixed(1)) : 0
  }
  return out
}

// --- Deterministic PRNG (seeded) so weights are random but reproducible until you "shuffle"
const fnv1a = (str: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // ensure uint32
  return h >>> 0
}
const lcg01 = (seed: number): number => {
  let s = seed >>> 0
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0
  return s / 4294967296 // [0,1)
}

export const ImpactAnalysisForm: React.FC = () => {
  // shared controls
  const [topN, setTopN] = useState(5)
  const [forecastAhead, setForecastAhead] = useState<number>(0)
  const [target, setTarget] = useState<Target>('sales')

  // PRNG seed; change to re-randomize
  const [randSeed, setRandSeed] = useState<number>(() => Date.now())

  // company + data sources
  const [companyCode, setCompanyCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [liveImpacts, setLiveImpacts] = useState<Record<
    Target,
    Intervention[]
  > | null>(null)
  const [liveIncubatees, setLiveIncubatees] = useState<Incubatee[] | null>(null)

  // selection
  const [selectedIncubateeId, setSelectedIncubateeId] = useState<string>('john')

  useEffect(() => {
    const fetchCompanyCode = async () => {
      setLoading(true)
      try {
        const user = auth.currentUser
        if (!user) {
          setCompanyCode(null)
          setLoading(false)
          return
        }
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        if (!userSnap.exists()) {
          setCompanyCode(null)
          setLoading(false)
          return
        }
        setCompanyCode('QTX')
      } catch {
        setCompanyCode(null)
      } finally {
        setLoading(false)
      }
    }
    fetchCompanyCode()
  }, [])

  const impactsSource: Record<Target, Intervention[]> = useMemo(() => {
    if (companyCode && liveImpacts) return liveImpacts
    return DUMMY_IMPACTS
  }, [companyCode, liveImpacts])

  const incubateesSource: Incubatee[] = useMemo(() => {
    if (companyCode && liveIncubatees) return liveIncubatees
    return DUMMY_INCUBATEES
  }, [companyCode, liveIncubatees])

  // Utility: produce a deterministic random weight in [WEIGHT_MIN, WEIGHT_MAX]
  const randomWeight = (name: string) => {
    const key = `${randSeed}|${selectedIncubateeId}|${target}|${forecastAhead}|${name}`
    const u = lcg01(fnv1a(key))
    const val = WEIGHT_MIN + (WEIGHT_MAX - WEIGHT_MIN) * u
    // one decimal place looks nice
    return Number(val.toFixed(1))
  }

  /** ---------- Ranking ---------- */
  const rankingData: ImpactRow[] = useMemo(() => {
    const rows = (impactsSource[target] || []).map(intervention => ({
      name: intervention.name,
      value: randomWeight(intervention.name)
    }))
    return rows
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, topN)
  }, [
    impactsSource,
    target,
    topN,
    randomWeight,
    randSeed,
    selectedIncubateeId,
    forecastAhead
  ])

  const rankingChart: Highcharts.Options = {
    chart: { type: 'bar', height: 360 },
    title: {
      text: `Top ${topN} Interventions — ${
        target === 'sales' ? 'Sales' : 'Revenue'
      } (Horizon: ${forecastAhead} mo)`
    },
    xAxis: { categories: rankingData.map(i => i.name), title: { text: null } },
    yAxis: {
      min: WEIGHT_MIN,
      max: WEIGHT_MAX,
      title: {
        text: `Weight on ${target === 'sales' ? 'Sales' : 'Revenue'}`,
        align: 'high'
      },
      plotLines: [{ value: 0, width: 1, color: '#999' }]
    },
    plotOptions: {
      series: { dataLabels: { enabled: true, format: '{point.y}' } }
    },
    tooltip: {
      formatter: function () {
        // @ts-ignore
        return `<strong>${this.key}</strong><br/>Weight: <b>${this.y}</b>`
      }
    },
    series: [
      {
        name: 'Weight',
        type: 'bar',
        data: rankingData.map(i => i.value),
        colorByPoint: true
      }
    ],
    credits: { enabled: false }
  }

  // Pareto (absolute weight + cumulative share). No '%' symbol anywhere.
  const paretoOptions: Highcharts.Options = useMemo(() => {
    const absVals = rankingData.map(r => Math.abs(r.value))
    const total = absVals.reduce((a, b) => a + b, 0) || 1
    let cum = 0
    const cumShare = absVals.map(v => {
      cum += v
      return Number(((cum / total) * 100).toFixed(1))
    })
    return {
      chart: { height: 360 },
      title: { text: 'Pareto of Absolute Weight (Top N)' },
      xAxis: { categories: rankingData.map(r => r.name), crosshair: true },
      yAxis: [
        { title: { text: 'Abs weight' } },
        {
          title: { text: 'Cumulative share' },
          max: 100,
          min: 0,
          opposite: true
        }
      ],
      tooltip: { shared: true },
      plotOptions: { column: { dataLabels: { enabled: true } } },
      series: [
        { type: 'column', name: 'Abs weight', data: absVals },
        { type: 'spline', name: 'Cumulative share', yAxis: 1, data: cumShare }
      ],
      credits: { enabled: false }
    }
  }, [rankingData])

  /** ---------- XAI ---------- */
  const selectedIncubatee = useMemo(
    () =>
      incubateesSource.find(x => x.id === selectedIncubateeId) ||
      incubateesSource[0],
    [incubateesSource, selectedIncubateeId]
  )

  const histLen = Math.max(1, selectedIncubatee?.revenue?.length ?? 0)
  const categories = buildCategories(histLen, forecastAhead)

  const avgRevenue = useMemo(
    () => averageSeries(incubateesSource.map(i => i.revenue)),
    [incubateesSource]
  )
  const avgHeadcount = useMemo(
    () => averageSeries(incubateesSource.map(i => i.headcount)),
    [incubateesSource]
  )

  const incRevSplit = splitHistForecast(
    selectedIncubatee?.revenue ?? [],
    forecastAhead
  )
  const incHeadSplit = splitHistForecast(
    selectedIncubatee?.headcount ?? [],
    forecastAhead
  )
  const avgRevSplit = splitHistForecast(avgRevenue, forecastAhead)
  const avgHeadSplit = splitHistForecast(avgHeadcount, forecastAhead)

  // Per-incubatee impacts (randomized)
  const incubateeImpacts: ImpactRow[] = useMemo(() => {
    const src = selectedIncubatee?.impacts?.[target] || []
    const rows = src.map(intervention => ({
      name: intervention.name,
      value: randomWeight(intervention.name)
    }))
    return rows
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, topN)
  }, [selectedIncubatee, target, topN, randomWeight, randSeed, forecastAhead])

  // Tree data

  const treeData = useMemo(() => {
    const rootId = 'root'
    const rootName = selectedIncubatee?.name ?? 'Incubatee'
    const pts: Array<Record<string, any>> = [{ id: rootId, name: rootName }]
    const seenAreas = new Set<string>()

    incubateeImpacts.forEach(i => {
      const area = AREA_OF_SUPPORT[i.name] ?? 'Other'
      const areaId = `area:${area}`
      if (!seenAreas.has(areaId)) {
        seenAreas.add(areaId)
        pts.push({ id: areaId, parent: rootId, name: area })
      }
      pts.push({
        id: `int:${i.name}`,
        parent: areaId,
        name: i.name,
        value: i.value,
        colorValue: i.value, // <-- used by colorAxis
        color: valueToColor(i.value) // <-- direct color (ensures non-uniform now)
      })
    })
    return pts
  }, [selectedIncubatee, incubateeImpacts])

  const xaiForecastChart: Highcharts.Options = {
    chart: { type: 'line' },
    title: {
      text: `${
        selectedIncubatee?.name ?? 'Incubatee'
      } — Revenue & Headcount (${forecastAhead} mo forecast)`
    },
    xAxis: { categories },
    yAxis: [
      { title: { text: 'Revenue' }, opposite: false },
      { title: { text: 'Headcount' }, opposite: true }
    ],
    tooltip: { shared: true },
    plotOptions: {
      series: { marker: { enabled: false }, dataLabels: { enabled: false } }
    },
    series: [
      {
        id: 'inc-rev',
        name: 'Incubatee Revenue',
        type: 'line',
        yAxis: 0,
        data: incRevSplit.hist,
        color: undefined
      },
      {
        linkedTo: 'inc-rev',
        name: 'Incubatee Revenue (forecast)',
        type: 'line',
        yAxis: 0,
        data: incRevSplit.fcst,
        dashStyle: 'Dash',
        showInLegend: false
      },
      {
        id: 'inc-hc',
        name: 'Incubatee Headcount',
        type: 'line',
        yAxis: 1,
        data: incHeadSplit.hist,
        color: undefined
      },
      {
        linkedTo: 'inc-hc',
        name: 'Incubatee Headcount (forecast)',
        type: 'line',
        yAxis: 1,
        data: incHeadSplit.fcst,
        dashStyle: 'Dash',
        showInLegend: false
      },
      {
        id: 'avg-rev',
        name: 'Average Revenue',
        type: 'line',
        yAxis: 0,
        data: avgRevSplit.hist,
        color: undefined
      },
      {
        linkedTo: 'avg-rev',
        name: 'Average Revenue (forecast)',
        type: 'line',
        yAxis: 0,
        data: avgRevSplit.fcst,
        dashStyle: 'Dash',
        showInLegend: false
      },
      {
        id: 'avg-hc',
        name: 'Average Headcount',
        type: 'line',
        yAxis: 1,
        data: avgHeadSplit.hist,
        color: undefined
      },
      {
        linkedTo: 'avg-hc',
        name: 'Average Headcount (forecast)',
        type: 'line',
        yAxis: 1,
        data: avgHeadSplit.fcst,
        dashStyle: 'Dash',
        showInLegend: false
      }
    ],
    credits: { enabled: false }
  }

  const xaiImpactChart: Highcharts.Options = {
    chart: { type: 'bar' },
    title: {
      text: `Top ${topN} Interventions for ${
        selectedIncubatee?.name ?? 'Incubatee'
      } — ${target === 'sales' ? 'Sales' : 'Revenue'}`
    },
    xAxis: { categories: incubateeImpacts.map(i => i.name) },
    yAxis: {
      min: WEIGHT_MIN,
      max: WEIGHT_MAX,
      title: { text: 'Weight' },
      plotLines: [{ value: 0, width: 1, color: '#999' }]
    },
    series: [
      {
        name: 'Weight',
        type: 'bar',
        data: incubateeImpacts.map(i => i.value),
        colorByPoint: true
      }
    ],
    plotOptions: {
      series: { dataLabels: { enabled: true, format: '{point.y}' } }
    },
    tooltip: {
      formatter: function () {
        // @ts-ignore
        return `<strong>${this.key}</strong><br/>Weight: <b>${this.y}</b>`
      }
    },
    credits: { enabled: false }
  }

  const xaiImpactTreeOptions: Highcharts.Options = {
    chart: {
      type: 'treegraph',
      height: 420,
      marginRight: 320,
      spacingBottom: 20
    },
    title: {
      text: `Intervention Map — ${selectedIncubatee?.name ?? 'Incubatee'} (${
        target === 'sales' ? 'Sales' : 'Revenue'
      })`
    },
    colorAxis: {
      min: WEIGHT_MIN,
      max: WEIGHT_MAX,
      stops: [
        [0, '#d73027'],
        [neutralStop, '#f0f0f0'],
        [1, '#1a9850']
      ]
    },
    series: [
      {
        type: 'treegraph',
        data: treeData as any,
        colorKey: 'colorValue',
        clip: false,
        link: { width: 1, color: '#B0BEC5' },
        marker: { symbol: 'circle', radius: 6, lineWidth: 1 },
        dataLabels: {
          align: 'left',
          formatter: function () {
            const p = this.point as Highcharts.Point & { value?: number }
            const isLeaf = typeof p.value === 'number'
            return `<span style="font-weight:600">${p.name}</span>`
          },
          style: {
            color: 'var(--highcharts-neutral-color-100, #000)',
            textOutline: '3px contrast',
            whiteSpace: 'nowrap'
          },
          x: 24,
          crop: false,
          overflow: 'none'
        },
        levels: [
          {
            level: 1,
            color: '#90A4AE',
            marker: { radius: 7, lineColor: '#90A4AE' }
          }, // root fixed color (ok)
          {
            level: 2,
            color: '#B0BEC5',
            marker: { radius: 6, lineColor: '#B0BEC5', fillColor: '#fff' }
          },
          { level: 3 } // <-- no color here so leaves can use colorAxis / point.color
        ]
      }
    ],
    tooltip: {
      useHTML: true,
      formatter: function () {
        const p = this.point as Highcharts.Point & { value?: number }
        return typeof p.value === 'number'
          ? `<b>${p.name}</b><br/>Weight: ${p.value}`
          : `<b>${p.name}</b>`
      }
    },
    credits: { enabled: false }
  }

  return (
    <>
      <Helmet>
        <title>Impact Analysis | Smart Incubation Platform</title>
      </Helmet>

      {loading ? (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Spin tip='Loading company info...' size='large' />
        </div>
      ) : (
        <div style={{ padding: 24, minHeight: '100vh' }}>
          {/* Controls */}
          <MotionCard style={{ marginBottom: 16 }}>
            <Row gutter={[16, 8]} align='middle'>
              <Col xs={24} md={6}>
                <Form.Item
                  label='Top N Interventions'
                  style={{ marginBottom: 8 }}
                >
                  <InputNumber
                    min={1}
                    max={(impactsSource[target] || []).length || 1}
                    value={topN}
                    onChange={val => setTopN(val || 5)}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label='Forecast Horizon (months ahead)'
                  style={{ marginBottom: 8 }}
                >
                  <Slider
                    min={0}
                    max={12}
                    step={1}
                    tooltip={{ open: true }}
                    value={forecastAhead}
                    onChange={v => setForecastAhead(v as number)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label='Target' style={{ marginBottom: 8 }}>
                  <Space.Compact block>
                    <Button
                      type={target === 'sales' ? 'primary' : 'default'}
                      onClick={() => setTarget('sales')}
                    >
                      Sales
                    </Button>
                    <Button
                      type={target === 'revenue' ? 'primary' : 'default'}
                      onClick={() => setTarget('revenue')}
                    >
                      Revenue
                    </Button>
                  </Space.Compact>
                </Form.Item>
              </Col>
            </Row>
          </MotionCard>

          <Tabs
            defaultActiveKey='ranking'
            centered
            items={[
              {
                key: 'ranking',
                label: 'Ranking',
                children: (
                  <>
                    <MotionCard style={{ marginBottom: 16 }}>
                      <HighchartsReact
                        highcharts={Highcharts}
                        options={rankingChart}
                      />
                    </MotionCard>
                    <MotionCard>
                      <HighchartsReact
                        highcharts={Highcharts}
                        options={paretoOptions}
                      />
                    </MotionCard>
                  </>
                )
              },
              {
                key: 'xai',
                label: 'XAI',
                children: (
                  <>
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col xs={24} md={6}>
                        <MotionCard title='Incubatees'>
                          <List
                            dataSource={incubateesSource}
                            rowKey='id'
                            renderItem={item => (
                              <List.Item
                                onClick={() => setSelectedIncubateeId(item.id)}
                                style={{
                                  cursor: 'pointer',
                                  background:
                                    item.id === selectedIncubateeId
                                      ? 'rgba(0,0,0,0.04)'
                                      : 'transparent',
                                  borderRadius: 8,
                                  padding: 8
                                }}
                              >
                                <List.Item.Meta
                                  title={item.name}
                                  description={`Rev last: ${
                                    item.revenue[item.revenue.length - 1]
                                  } | Headcount last: ${
                                    item.headcount[item.headcount.length - 1]
                                  }`}
                                />
                              </List.Item>
                            )}
                          />
                        </MotionCard>
                      </Col>
                      <Col xs={24} md={18}>
                        <Row gutter={16}>
                          <Col xs={24} lg={12}>
                            <MotionCard>
                              <HighchartsReact
                                highcharts={Highcharts}
                                options={xaiForecastChart}
                              />
                            </MotionCard>
                          </Col>
                          <Col xs={24} lg={12}>
                            <MotionCard style={{ marginBottom: 16 }}>
                              <HighchartsReact
                                highcharts={Highcharts}
                                options={xaiImpactChart}
                              />
                            </MotionCard>
                          </Col>
                        </Row>
                      </Col>
                    </Row>

                    <Row>
                      <Col span={24}>
                        <MotionCard>
                          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
                            <HighchartsReact
                              highcharts={Highcharts}
                              options={xaiImpactTreeOptions}
                            />
                          </div>
                        </MotionCard>
                      </Col>
                    </Row>
                  </>
                )
              }
            ]}
          />
        </div>
      )}
    </>
  )
}

export default ImpactAnalysisForm

