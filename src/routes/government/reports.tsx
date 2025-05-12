import React, { useState, useEffect } from 'react'
import {
  Card,
  Row,
  Col,
  Typography,
  Select,
  Space,
  Spin,
  Button,
  Divider,
  Tabs,
  Table,
  Tag,
  Progress,
  Statistic,
  DatePicker
} from 'antd'
import {
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  DownloadOutlined,
  TeamOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  RiseOutlined,
  UserOutlined,
  AimOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import {
  collection,
  getDocs,
  query,
  orderBy,
  Timestamp,
  where
} from 'firebase/firestore'
import { db } from '@/firebase'
import dayjs from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import GeoChallengeMap from '@/components/charts/GeoChallengeMap'

dayjs.extend(quarterOfYear)

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { RangePicker } = DatePicker
const { TabPane } = Tabs

interface SupportProgram {
  id: string
  participantId: string
  participantName?: string
  programName: string
  programType: string
  startDate: Timestamp
  endDate: Timestamp
  description: string
  budget?: number
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  outcomes?: string[]
  createdBy: string
  createdAt: Timestamp
}

interface Participant {
  id: string
  name: string
  industry: string
  location: string
  stage?: string
}

interface ImpactMetric {
  id: string
  programId: string
  programName?: string
  participantId: string
  participantName?: string
  metricType: 'economic' | 'social' | 'environmental'
  metricName: string
  value: number
  unit: string
  date: Timestamp
  notes?: string
}

const impactByTypeOptions: Highcharts.Options = {
  chart: { type: 'column' },
  title: { text: 'Impact by Type' },
  xAxis: {
    categories: ['Economic', 'Social', 'Environmental'],
    title: { text: 'Type' }
  },
  yAxis: {
    min: 0,
    title: { text: 'Number of Metrics' }
  },
  plotOptions: {
    series: {
      dataLabels: {
        enabled: true,
        format: '{point.y}'
      }
    }
  },
  series: [
    {
      name: 'Metrics Count',
      data: [45, 30, 25], // Replace with real data from `generateChartData(...)`
      type: 'column'
    }
  ]
}
const impactByType: Highcharts.Options = {
  chart: { type: 'pie' },
  title: { text: 'Impact by Type' },
  plotOptions: {
    series: {
      dataLabels: {
        enabled: true,
        format: '{point.y}'
      }
    }
  },
  series: [
    {
      name: 'Metrics',
      type: 'pie',
      colorByPoint: true,
      data: [
        { name: 'Economic', y: 45 },
        { name: 'Social', y: 30 },
        { name: 'Environmental', y: 25 }
      ]
    }
  ]
}
const beneficiariesByProgram: Highcharts.Options = {
  chart: { type: 'column' },
  title: { text: 'Beneficiaries Reached by Program' },
  xAxis: {
    categories: ['Prog A', 'Prog B', 'Prog C', 'Prog D'],
    title: { text: 'Program' }
  },
  yAxis: { min: 0, title: { text: 'Beneficiaries' } },
  plotOptions: {
    series: {
      dataLabels: {
        enabled: true,
        format: '{point.y}'
      }
    }
  },
  series: [{ name: 'Beneficiaries', data: [150, 120, 90, 70], type: 'column' }]
}
const jobsCreatedTop5: Highcharts.Options = {
  chart: { type: 'bar' },
  title: { text: 'Jobs Created by Participant (Top 5)' },
  xAxis: {
    categories: ['Biz A', 'Biz B', 'Biz C', 'Biz D', 'Biz E'],
    title: { text: 'Participant' }
  },
  yAxis: { min: 0, title: { text: 'Jobs Created' } },
  plotOptions: {
    series: {
      dataLabels: {
        enabled: true,
        format: '{point.y}'
      }
    }
  },
  series: [{ name: 'Jobs', data: [120, 90, 80, 60, 50], type: 'bar' }]
}

const metricsOverTime: Highcharts.Options = {
  chart: { type: 'line' },
  title: { text: 'Metrics Over Time' },
  xAxis: {
    categories: ['Q1 2023', 'Q2 2023', 'Q3 2023', 'Q4 2023'],
    title: { text: 'Quarter' }
  },
  yAxis: { title: { text: 'Metric Count' } },
  plotOptions: {
    series: {
      dataLabels: {
        enabled: true,
        format: '{point.y}'
      }
    }
  },
  series: [{ name: 'Impact Metrics', data: [45, 60, 52, 78], type: 'line' }]
}

const environmentalImpact: Highcharts.Options = {
  chart: { type: 'pie' },
  title: { text: 'Environmental Impact' },
  plotOptions: {
    series: {
      dataLabels: {
        enabled: true,
        format: '{point.y}'
      }
    }
  },
  series: [
    {
      name: 'Impact',
      type: 'pie',
      colorByPoint: true,
      data: [
        { name: 'CO2 Reduction', y: 100 },
        { name: 'Renewable Energy', y: 80 },
        { name: 'Waste Reduced', y: 60 },
        { name: 'Water Saved', y: 40 }
      ]
    }
  ]
}

const impactByProgram: Highcharts.Options = {
  chart: { type: 'pie' },
  title: { text: 'Impact by Program' },
  plotOptions: {
    series: {
      dataLabels: {
        enabled: true,
        format: '{point.y}'
      }
    }
  },
  series: [
    {
      name: 'Impact',
      type: 'pie',
      colorByPoint: true,
      data: [
        { name: 'Prog A', y: 40 },
        { name: 'Prog B', y: 35 },
        { name: 'Prog C', y: 25 }
      ]
    }
  ]
}

// Demo impact metrics since we don't have them stored yet
const generateDemoImpactMetrics = (
  programs: SupportProgram[],
  participants: Map<string, Participant>
): ImpactMetric[] => {
  const metrics: ImpactMetric[] = []
  const metricTypes = ['economic', 'social', 'environmental']
  const metricNames = {
    economic: [
      'Jobs Created',
      'Revenue Generated (R)',
      'Investment Attracted (R)',
      'New Markets Accessed'
    ],
    social: [
      'People Trained',
      'Communities Impacted',
      'Beneficiaries Reached',
      'Services Provided'
    ],
    environmental: [
      'CO2 Reduction (tons)',
      'Renewable Energy Generated (kWh)',
      'Waste Reduced (tons)',
      'Water Saved (liters)'
    ]
  }

  let id = 1

  programs.forEach(program => {
    // Only generate metrics for active or completed programs
    if (program.status !== 'active' && program.status !== 'completed') return

    const participant = participants.get(program.participantId)
    if (!participant) return

    // Determine which types of metrics to generate based on program type
    let types = [...metricTypes]
    if (
      program.programType === 'Grant Funding' ||
      program.programType === 'Market Access Support'
    ) {
      types = ['economic', 'social']
    } else if (
      program.programType === 'Technical Assistance' ||
      program.programType === 'Mentorship'
    ) {
      types = ['economic', 'social']
    } else if (program.programType === 'Infrastructure Access') {
      types = ['economic', 'environmental']
    }

    // Generate 1-3 metrics for each applicable type
    types.forEach(type => {
      const count = Math.floor(Math.random() * 3) + 1 // 1 to 3 metrics
      const typeMetrics = metricNames[type as keyof typeof metricNames]

      for (let i = 0; i < count; i++) {
        const metricName =
          typeMetrics[Math.floor(Math.random() * typeMetrics.length)]
        let value = 0

        // Generate realistic values based on metric name
        if (metricName === 'Jobs Created') {
          value = Math.floor(Math.random() * 50) + 5
        } else if (metricName.includes('Revenue')) {
          value = (Math.floor(Math.random() * 10000) + 1000) * 1000
        } else if (metricName.includes('Investment')) {
          value = (Math.floor(Math.random() * 5000) + 500) * 1000
        } else if (metricName === 'New Markets Accessed') {
          value = Math.floor(Math.random() * 5) + 1
        } else if (metricName.includes('Trained')) {
          value = Math.floor(Math.random() * 200) + 20
        } else if (metricName.includes('Communities')) {
          value = Math.floor(Math.random() * 10) + 1
        } else if (metricName.includes('Beneficiaries')) {
          value = Math.floor(Math.random() * 1000) + 100
        } else if (metricName.includes('Services')) {
          value = Math.floor(Math.random() * 500) + 50
        } else if (metricName.includes('CO2')) {
          value = Math.floor(Math.random() * 1000) + 100
        } else if (metricName.includes('Energy')) {
          value = Math.floor(Math.random() * 10000) + 1000
        } else if (metricName.includes('Waste')) {
          value = Math.floor(Math.random() * 100) + 10
        } else if (metricName.includes('Water')) {
          value = Math.floor(Math.random() * 100000) + 10000
        }

        // Create a date within the program's duration
        const startTime = program.startDate.toDate().getTime()
        const endTime =
          program.endDate.toDate().getTime() || new Date().getTime()
        const randomTime = startTime + Math.random() * (endTime - startTime)

        metrics.push({
          id: String(id++),
          programId: program.id,
          programName: program.programName,
          participantId: program.participantId,
          participantName: participant.name,
          metricType: type as 'economic' | 'social' | 'environmental',
          metricName,
          value,
          unit: metricName.includes('(')
            ? metricName.split('(')[1].replace(')', '')
            : 'count',
          date: Timestamp.fromDate(new Date(randomTime)),
          notes: `Impact from ${program.programType} program`
        })
      }
    })
  })

  return metrics
}

// Generate chart data from impact metrics
const generateChartData = (metrics: ImpactMetric[], type: string) => {
  if (type === 'byType') {
    const data: Record<string, number> = {}
    metrics.forEach(metric => {
      if (!data[metric.metricType]) {
        data[metric.metricType] = 0
      }
      data[metric.metricType] += 1
    })
    return Object.keys(data).map(key => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: data[key]
    }))
  } else if (type === 'byProgram') {
    const data: Record<string, number> = {}
    metrics.forEach(metric => {
      if (!metric.programName) return
      if (!data[metric.programName]) {
        data[metric.programName] = 0
      }
      data[metric.programName] += 1
    })
    return Object.keys(data).map(key => ({
      name: key,
      value: data[key]
    }))
  } else if (type === 'byTime') {
    const data: Record<string, number> = {}
    metrics.forEach(metric => {
      const date = metric.date.toDate()
      const quarter = `Q${dayjs(date).quarter()} ${dayjs(date).year()}`
      if (!data[quarter]) {
        data[quarter] = 0
      }
      data[quarter] += 1
    })

    // Sort by quarter
    return Object.keys(data)
      .map(key => ({ name: key, value: data[key] }))
      .sort((a, b) => {
        const aYear = parseInt(a.name.split(' ')[1])
        const bYear = parseInt(b.name.split(' ')[1])
        if (aYear !== bYear) return aYear - bYear

        const aQuarter = parseInt(a.name.split('Q')[1].split(' ')[0])
        const bQuarter = parseInt(b.name.split('Q')[1].split(' ')[0])
        return aQuarter - bQuarter
      })
  } else if (type === 'jobsCreated') {
    const jobMetrics = metrics.filter(m => m.metricName === 'Jobs Created')
    const data: Record<string, number> = {}

    jobMetrics.forEach(metric => {
      if (!metric.participantName) return
      if (!data[metric.participantName]) {
        data[metric.participantName] = 0
      }
      data[metric.participantName] += metric.value
    })

    return Object.keys(data)
      .map(key => ({ name: key, jobs: data[key] }))
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 5) // Top 5
  } else if (type === 'investment') {
    const investmentMetrics = metrics.filter(m =>
      m.metricName.includes('Investment')
    )
    const data: Record<string, number> = {}

    investmentMetrics.forEach(metric => {
      if (!metric.participantName) return
      if (!data[metric.participantName]) {
        data[metric.participantName] = 0
      }
      data[metric.participantName] += metric.value
    })

    return Object.keys(data)
      .map(key => ({ name: key, investment: data[key] / 1000000 })) // Convert to millions
      .sort((a, b) => b.investment - a.investment)
      .slice(0, 5) // Top 5
  } else if (type === 'environmentalImpact') {
    const envMetrics = metrics.filter(m => m.metricType === 'environmental')
    const data: Record<string, number> = {}

    envMetrics.forEach(metric => {
      if (!data[metric.metricName]) {
        data[metric.metricName] = 0
      }
      data[metric.metricName] += metric.value
    })

    return Object.keys(data).map(key => ({
      name: key.split(' (')[0], // Remove unit from name
      value: data[key]
    }))
  } else if (type === 'communities') {
    const communityMetrics = metrics.filter(
      m =>
        m.metricName.includes('Communities') ||
        m.metricName.includes('Beneficiaries')
    )
    const data: Record<string, number> = {}

    communityMetrics.forEach(metric => {
      if (!metric.programName) return
      if (!data[metric.programName]) {
        data[metric.programName] = 0
      }
      data[metric.programName] += metric.value
    })

    return Object.keys(data)
      .map(key => ({ name: key, beneficiaries: data[key] }))
      .sort((a, b) => b.beneficiaries - a.beneficiaries)
  }

  return []
}

// Colors for charts
const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#A28DFF',
  '#FF6B6B',
  '#4ECDC4',
  '#FFA69E'
]

export const ImpactReports: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [supportPrograms, setSupportPrograms] = useState<SupportProgram[]>([])
  const [participants, setParticipants] = useState<Map<string, Participant>>(
    new Map()
  )
  const [impactMetrics, setImpactMetrics] = useState<ImpactMetric[]>([])
  const [activeTab, setActiveTab] = useState('1')
  const [filterYear, setFilterYear] = useState<string>(
    String(new Date().getFullYear())
  )
  const [filterQuarter, setFilterQuarter] = useState<string>('all')
  const [filterRegion, setFilterRegion] = useState<string>('all')
  const [filterIndustry, setFilterIndustry] = useState<string>('all')

  // Statistics for dashboard
  const [stats, setStats] = useState({
    totalPrograms: 0,
    activePrograms: 0,
    completedPrograms: 0,
    totalBudget: 0,
    jobsCreated: 0,
    communitiesImpacted: 0,
    revenueGenerated: 0,
    environmentalMetrics: 0
  })

  // Available years, regions, and industries for filters
  const [years, setYears] = useState<string[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  // Apply filters to metrics and recalculate stats
  useEffect(() => {
    if (impactMetrics.length > 0) {
      const filtered = filterMetrics()
      calculateStats(filtered)
    }
  }, [filterYear, filterQuarter, filterRegion, filterIndustry, impactMetrics])

  // Fetch all required data
  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch programs
      const programsData = await fetchPrograms()

      // Fetch participants
      const participantsData = await fetchParticipants()

      // Generate demo impact metrics
      const metrics = generateDemoImpactMetrics(programsData, participantsData)
      setImpactMetrics(metrics)

      // Extract available years, regions, and industries for filters
      const uniqueYears = new Set<string>()
      metrics.forEach(metric => {
        uniqueYears.add(String(metric.date.toDate().getFullYear()))
      })
      setYears(Array.from(uniqueYears).sort())

      const uniqueRegions = new Set<string>()
      const uniqueIndustries = new Set<string>()
      participantsData.forEach(participant => {
        if (participant.location) uniqueRegions.add(participant.location)
        if (participant.industry) uniqueIndustries.add(participant.industry)
      })
      setRegions(Array.from(uniqueRegions).sort())
      setIndustries(Array.from(uniqueIndustries).sort())

      // Calculate initial stats
      calculateStats(metrics)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch all programs
  const fetchPrograms = async (): Promise<SupportProgram[]> => {
    try {
      const programsRef = collection(db, 'supportPrograms')
      const programsQuery = query(programsRef, orderBy('createdAt', 'desc'))
      const programsSnapshot = await getDocs(programsQuery)

      const programsData = programsSnapshot.docs.map(
        doc =>
          ({
            id: doc.id,
            ...doc.data()
          } as SupportProgram)
      )

      setSupportPrograms(programsData)
      return programsData
    } catch (error) {
      console.error('Error fetching support programs:', error)
      return []
    }
  }

  // Fetch all participants
  const fetchParticipants = async (): Promise<Map<string, Participant>> => {
    try {
      const participantsRef = collection(db, 'participants')
      const participantsQuery = query(
        participantsRef,
        where('status', '!=', 'deleted')
      )
      const participantsSnapshot = await getDocs(participantsQuery)

      const participantsMap = new Map<string, Participant>()

      participantsSnapshot.docs.forEach(doc => {
        const data = doc.data()
        participantsMap.set(doc.id, {
          id: doc.id,
          name: data.name,
          industry: data.industry || '',
          location: data.location || '',
          stage: data.stage || ''
        })
      })

      setParticipants(participantsMap)
      return participantsMap
    } catch (error) {
      console.error('Error fetching participants:', error)
      return new Map()
    }
  }

  // Apply filters to metrics
  const filterMetrics = (): ImpactMetric[] => {
    return impactMetrics.filter(metric => {
      const date = metric.date.toDate()
      const year = date.getFullYear()
      const quarter = dayjs(date).quarter()

      // Filter by year
      if (filterYear !== 'all' && String(year) !== filterYear) {
        return false
      }

      // Filter by quarter
      if (filterQuarter !== 'all' && String(quarter) !== filterQuarter) {
        return false
      }

      // Filter by region
      if (filterRegion !== 'all') {
        const participant = participants.get(metric.participantId)
        if (!participant || participant.location !== filterRegion) {
          return false
        }
      }

      // Filter by industry
      if (filterIndustry !== 'all') {
        const participant = participants.get(metric.participantId)
        if (!participant || participant.industry !== filterIndustry) {
          return false
        }
      }

      return true
    })
  }

  // Calculate statistics from metrics
  const calculateStats = (metrics: ImpactMetric[]) => {
    const jobsCreated = metrics
      .filter(m => m.metricName === 'Jobs Created')
      .reduce((sum, m) => sum + m.value, 0)

    const communitiesImpacted = metrics
      .filter(m => m.metricName === 'Communities Impacted')
      .reduce((sum, m) => sum + m.value, 0)

    const revenueGenerated = metrics
      .filter(m => m.metricName === 'Revenue Generated (R)')
      .reduce((sum, m) => sum + m.value, 0)

    const environmentalMetrics = metrics.filter(
      m => m.metricType === 'environmental'
    ).length

    // Count unique programs
    const uniquePrograms = new Set(metrics.map(m => m.programId)).size

    // Count active and completed programs
    const programIds = new Set(metrics.map(m => m.programId))
    const relevantPrograms = supportPrograms.filter(p => programIds.has(p.id))
    const activePrograms = relevantPrograms.filter(
      p => p.status === 'active'
    ).length
    const completedPrograms = relevantPrograms.filter(
      p => p.status === 'completed'
    ).length

    // Calculate total budget
    const totalBudget = relevantPrograms.reduce(
      (sum, p) => sum + (p.budget || 0),
      0
    )

    setStats({
      totalPrograms: uniquePrograms,
      activePrograms,
      completedPrograms,
      totalBudget,
      jobsCreated,
      communitiesImpacted,
      revenueGenerated,
      environmentalMetrics
    })
  }

  // Export report data
  const exportReport = () => {
    console.log('Exporting impact report data')
    // In a real app, this would generate a PDF or Excel report
  }

  // Table columns for metrics
  const metricColumns = [
    {
      title: 'Program',
      dataIndex: 'programName',
      key: 'program',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Participant',
      dataIndex: 'participantName',
      key: 'participant'
    },
    {
      title: 'Metric',
      dataIndex: 'metricName',
      key: 'metric'
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value: number, record: ImpactMetric) => (
        <Text>
          {value.toLocaleString()} {record.unit}
        </Text>
      ),
      sorter: (a: ImpactMetric, b: ImpactMetric) => a.value - b.value
    },
    {
      title: 'Type',
      dataIndex: 'metricType',
      key: 'type',
      render: (type: string) => {
        const colors = {
          economic: 'green',
          social: 'blue',
          environmental: 'purple'
        }
        return (
          <Tag color={colors[type as keyof typeof colors]}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Tag>
        )
      },
      filters: [
        { text: 'Economic', value: 'economic' },
        { text: 'Social', value: 'social' },
        { text: 'Environmental', value: 'environmental' }
      ],
      onFilter: (value: any, record: ImpactMetric) =>
        record.metricType === value
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: Timestamp) => date.toDate().toLocaleDateString(),
      sorter: (a: ImpactMetric, b: ImpactMetric) =>
        a.date.toDate().getTime() - b.date.toDate().getTime()
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]} align='middle' style={{ marginBottom: 24 }}>
        <Col flex='auto'>
          <Title level={3}>Impact Reports</Title>
          <Text type='secondary'>
            Track and analyze the impact of support programs across economic,
            social, and environmental dimensions
          </Text>
        </Col>
        <Col>
          <Button
            type='primary'
            icon={<DownloadOutlined />}
            onClick={exportReport}
          >
            Export Report
          </Button>
        </Col>
      </Row>

      {/* Filters Section */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Text>Year:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={filterYear}
              onChange={setFilterYear}
            >
              <Option value='all'>All Years</Option>
              {years.map(year => (
                <Option key={year} value={year}>
                  {year}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} md={6}>
            <Text>Quarter:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={filterQuarter}
              onChange={setFilterQuarter}
            >
              <Option value='all'>All Quarters</Option>
              <Option value='1'>Q1</Option>
              <Option value='2'>Q2</Option>
              <Option value='3'>Q3</Option>
              <Option value='4'>Q4</Option>
            </Select>
          </Col>

          <Col xs={24} md={6}>
            <Text>Region:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={filterRegion}
              onChange={setFilterRegion}
            >
              <Option value='all'>All Regions</Option>
              {regions.map(region => (
                <Option key={region} value={region}>
                  {region}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} md={6}>
            <Text>Industry:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={filterIndustry}
              onChange={setFilterIndustry}
            >
              <Option value='all'>All Industries</Option>
              {industries.map(industry => (
                <Option key={industry} value={industry}>
                  {industry}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size='large' />
          <div style={{ marginTop: 16 }}>Loading impact data...</div>
        </div>
      ) : (
        <>
          {/* Statistics Summary */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title='Jobs Created'
                  value={stats.jobsCreated}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title='Revenue Generated'
                  value={stats.revenueGenerated}
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<DollarOutlined />}
                  formatter={value => `R${Number(value).toLocaleString()}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title='Communities Impacted'
                  value={stats.communitiesImpacted}
                  valueStyle={{ color: '#722ed1' }}
                  prefix={<UserOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title='Programs Analyzed'
                  value={stats.totalPrograms}
                  valueStyle={{ color: '#fa8c16' }}
                  prefix={<AimOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* Main Content Tabs */}
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane
              tab={
                <span>
                  <LineChartOutlined /> Impact Trends
                </span>
              }
              key='1'
            >
              <Row gutter={[16, 24]}>
                <Col span={12}>
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={impactByTypeOptions}
                  />
                </Col>
              </Row>
            </TabPane>

            <TabPane
              tab={
                <span>
                  <PieChartOutlined /> Impact Distribution
                </span>
              }
              key='2'
            >
              <Row gutter={[16, 24]}>
                <Col span={12}>
                  <Card title='Impact by Type'>
                    <HighchartsReact
                      highcharts={Highcharts}
                      options={impactByType}
                    />
                  </Card>
                </Col>

                <Col span={12}>
                  <Card title='Impact by Program'>
                    <HighchartsReact
                      highcharts={Highcharts}
                      options={impactByProgram}
                    />
                  </Card>
                </Col>

                <Col span={24}>
                  <Card title='Progress Towards Economic Development Goals'>
                    <HighchartsReact
                      highcharts={Highcharts}
                      options={metricsOverTime}
                    />
                  </Card>
                </Col>

                <Col span={24}>
                  <Card title='Geographic Challenge Map'>
                    <GeoChallengeMap />
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane
              tab={
                <span>
                  <FileTextOutlined /> Detailed Metrics
                </span>
              }
              key='3'
            >
              <Card>
                <Table
                  dataSource={filterMetrics()}
                  columns={metricColumns}
                  rowKey='id'
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            </TabPane>
          </Tabs>
        </>
      )}
    </div>
  )
}

export default ImpactReports
