import React, { useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Table,
  Space,
  Button,
  Tabs,
  Statistic,
  Row,
  Col,
  DatePicker,
  Select,
  Form,
  Input,
  Divider,
  Drawer
} from 'antd'
import {
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  DownloadOutlined,
  FilterOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  TeamOutlined,
  ApartmentOutlined,
  DollarOutlined,
  AuditOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import HighchartsFunnel from 'highcharts/modules/funnel'
import HighchartsTreemap from 'highcharts/modules/treemap'
import HighchartsMore from 'highcharts/highcharts-more'

// Initialize Highcharts modules
if (typeof HighchartsFunnel === 'function') HighchartsFunnel(Highcharts)
if (typeof HighchartsTreemap === 'function') HighchartsTreemap(Highcharts)
if (typeof HighchartsMore === 'function') HighchartsMore(Highcharts)
import('highcharts/modules/heatmap').then(HeatmapModule => {
  HeatmapModule.default(Highcharts)
})

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker
const { Option } = Select
const { TabPane } = Tabs

const fullBubbleData = [
  { name: 'FinTech Revolution', x: 85, y: 100, z: 35 },
  { name: 'BrightTech', x: 75, y: 88, z: 32 },
  { name: 'TechSolutions Inc.', x: 65, y: 50, z: 30 },
  { name: 'AgriSmart', x: 55, y: 70, z: 28 },
  { name: 'UrbanMakers', x: 60, y: 66, z: 26 }
  // ... more participants
]

// Define report types
const reportTypes = [
  { value: 'participant', label: 'Participant Reports' },
  { value: 'resource', label: 'Resource Utilization' },
  { value: 'compliance', label: 'Compliance Status' },
  { value: 'mentorship', label: 'Mentorship Progress' },
  { value: 'financials', label: 'Financial Reports' }
]

// Define time periods
const timePeriods = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'quarter', label: 'Quarterly' },
  { value: 'year', label: 'Yearly' },
  { value: 'custom', label: 'Custom Range' }
]

// Mock data for participant metrics
const participantMetrics = [
  { month: 'Jan', active: 35, new: 12, graduated: 5 },
  { month: 'Feb', active: 40, new: 15, graduated: 3 },
  { month: 'Mar', active: 48, new: 18, graduated: 2 },
  { month: 'Apr', active: 58, new: 22, graduated: 4 },
  { month: 'May', active: 70, new: 25, graduated: 6 },
  { month: 'Jun', active: 85, new: 28, graduated: 7 }
]

// Mock data for compliance status
const complianceStatus = [
  { type: 'Valid', count: 120 },
  { type: 'Expiring Soon', count: 15 },
  { type: 'Expired', count: 8 },
  { type: 'Missing', count: 12 },
  { type: 'Pending Review', count: 22 }
]

// Mock data for resource utilization
const resourceUtilization = [
  { resource: 'Workshop Space', utilization: 78 },
  { resource: 'Meeting Rooms', utilization: 85 },
  { resource: 'Equipment', utilization: 62 },
  { resource: 'Mentorship Hours', utilization: 90 },
  { resource: 'Funding', utilization: 45 }
]

const OperationsReports: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [reportType, setReportType] = useState('participant')
  const [timePeriod, setTimePeriod] = useState('month')
  const [customDateRange, setCustomDateRange] = useState<
    [dayjs.Dayjs, dayjs.Dayjs] | null
  >(null)
  const [form] = Form.useForm()
  const [insightsVisible, setInsightsVisible] = useState(false)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [resourceInsightVisible, setResourceInsightVisible] = useState(false)
  const [resourceAiInsight, setResourceAiInsight] = useState<string | null>(
    null
  )

  const [resourceInsightLoading, setResourceInsightLoading] = useState(false)
  const [complianceInsightVisible, setComplianceInsightVisible] =
    useState(false)
  const [complianceAiInsight, setComplianceAiInsight] = useState<string | null>(
    null
  )
  const [complianceInsightLoading, setComplianceInsightLoading] =
    useState(false)
  const [topN, setTopN] = useState(5)
  const topParticipants = fullBubbleData
    .sort((a, b) => b.z - a.z)
    .slice(0, topN)

  const consultantData = [
    { name: 'John', x: 4.1, y: 4, z: 30 },
    { name: 'Amanda', x: 4.7, y: 10, z: 40 },
    { name: 'Kabelo', x: 4.8, y: 3, z: 25 },
    { name: 'Naledi', x: 3.7, y: 2, z: 20 },
    { name: 'Thabo', x: 4.9, y: 2, z: 35 }
  ]

  const [topNConsultants, setTopNConsultants] = useState(5)

  const topConsultants = consultantData
    .sort((a, b) => b.z - a.z)
    .slice(0, topNConsultants)

  const consultantSeries = topConsultants.map(consultant => ({
    name: consultant.name,
    type: 'bubble',
    data: [{ x: consultant.x, y: consultant.y, z: consultant.z }],
    color: Highcharts.getOptions().colors[topConsultants.indexOf(consultant)],
    marker: { symbol: 'circle' },
    dataLabels: {
      enabled: true,
      format: '{point.z}',
      allowOverlap: true
    }
  }))
  const participantData = [
    { name: 'FinTech Revolution', x: 85, y: 100, z: 35 },
    { name: 'BrightTech', x: 75, y: 88, z: 32 },
    { name: 'TechSolutions Inc.', x: 65, y: 50, z: 30 },
    { name: 'AgriSmart', x: 55, y: 70, z: 28 },
    { name: 'UrbanMakers', x: 60, y: 66, z: 26 }
  ]

  const participantSeries = participantData.map(participant => ({
    name: participant.name,
    type: 'bubble',
    data: [{ x: participant.x, y: participant.y, z: participant.z }],
    color: Highcharts.getOptions().colors[participantData.indexOf(participant)],
    marker: { symbol: 'circle' },
    dataLabels: {
      enabled: true,
      format: '{point.z}',
      allowOverlap: true
    }
  }))

  const handleGenerateInsight = () => {
    setInsightLoading(true)
    setTimeout(() => {
      setAiInsight(
        `AI Insight: Notable increase in new participants in ${participantMetrics[3]?.month}. Graduation rate stable, suggesting effective retention strategies.`
      )
      setInsightLoading(false)
    }, 1200)
  }
  const handleGenerateResourceInsight = () => {
    setResourceInsightLoading(true)
    setTimeout(() => {
      setResourceAiInsight(
        'AI Insight: Mentorship Hours are nearing capacity. Workshop Space usage may benefit from better scheduling.'
      )
      setResourceInsightLoading(false)
    }, 1200)
  }
  const handleGenerateComplianceInsight = () => {
    setComplianceInsightLoading(true)
    setTimeout(() => {
      setComplianceAiInsight(
        'AI Insight: High number of documents are pending review or missing. Recommend prioritizing follow-ups to maintain compliance rate.'
      )
      setComplianceInsightLoading(false)
    }, 1200)
  }

  const chartOptions: Highcharts.Options = {
    chart: { type: 'column' },
    title: { text: 'Participant Growth Over Time' },
    xAxis: {
      categories: participantMetrics.map(p => p.month),
      title: { text: 'Month' }
    },
    yAxis: {
      min: 0,
      title: { text: 'Number of Participants' }
    },
    tooltip: {
      shared: true,
      valueSuffix: ' participants'
    },
    plotOptions: {
      column: {
        dataLabels: {
          enabled: true
        }
      }
    },
    series: [
      {
        name: 'Active',
        data: participantMetrics.map(p => p.active),
        type: 'column'
      },
      {
        name: 'New',
        data: participantMetrics.map(p => p.new),
        type: 'column'
      },
      {
        name: 'Graduated',
        data: participantMetrics.map(p => p.graduated),
        type: 'column'
      }
    ]
  }

  useEffect(() => {
    // In a real app, fetch report data based on selected criteria
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
    }, 500)
  }, [reportType, timePeriod, customDateRange])

  // Handle report type change
  const handleReportTypeChange = (value: string) => {
    setReportType(value)
  }

  // Handle time period change
  const handleTimePeriodChange = (value: string) => {
    setTimePeriod(value)
  }

  // Handle date range change
  const handleDateRangeChange = (dates: any) => {
    if (dates) {
      setCustomDateRange(dates)
    } else {
      setCustomDateRange(null)
    }
  }

  const formatRevenue = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toString()
  }

  // Generate report
  const handleGenerateReport = (values: any) => {
    console.log('Generating report with values:', values)
    // In a real app, this would fetch data based on the form values
  }

  // Export report
  const handleExport = (format: 'excel' | 'pdf') => {
    console.log(`Exporting report as ${format}`)
    // In a real app, this would trigger a download
  }

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Reports & Analytics</Title>
      <Text>Generate and analyze reports for operations management.</Text>

      {/* Report Filters */}
      <Card style={{ marginTop: '20px', marginBottom: '20px' }}>
        <Form
          form={form}
          layout='vertical'
          onFinish={handleGenerateReport}
          initialValues={{
            reportType: 'participant',
            timePeriod: 'month'
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name='reportType'
                label='Report Type'
                rules={[
                  { required: true, message: 'Please select a report type' }
                ]}
              >
                <Select
                  placeholder='Select report type'
                  onChange={handleReportTypeChange}
                >
                  {reportTypes.map(type => (
                    <Option key={type.value} value={type.value}>
                      {type.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name='timePeriod'
                label='Time Period'
                rules={[
                  { required: true, message: 'Please select a time period' }
                ]}
              >
                <Select
                  placeholder='Select time period'
                  onChange={handleTimePeriodChange}
                >
                  {timePeriods.map(period => (
                    <Option key={period.value} value={period.value}>
                      {period.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              {timePeriod === 'custom' && (
                <Form.Item
                  name='dateRange'
                  label='Date Range'
                  rules={[
                    { required: true, message: 'Please select date range' }
                  ]}
                >
                  <RangePicker
                    style={{ width: '100%' }}
                    onChange={handleDateRangeChange}
                  />
                </Form.Item>
              )}
            </Col>
          </Row>
          <Row>
            <Col span={24} style={{ textAlign: 'right' }}>
              <Space>
                <Button
                  icon={<FilterOutlined />}
                  type='primary'
                  htmlType='submit'
                >
                  Generate Report
                </Button>
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={() => handleExport('excel')}
                >
                  Export Excel
                </Button>
                <Button
                  icon={<FilePdfOutlined />}
                  onClick={() => handleExport('pdf')}
                >
                  Export PDF
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* Dashboard Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title='Total Participants'
              value={85}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title='Resources Allocated'
              value={68}
              prefix={<ApartmentOutlined />}
              suffix='%'
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title='Funding Utilized'
              value={2450000}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title='Compliance Rate'
              value={92}
              prefix={<AuditOutlined />}
              suffix='%'
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Report Content */}
      <Card>
        <Tabs defaultActiveKey='1'>
          <TabPane
            tab={
              <span>
                <BarChartOutlined />
                Participant Statistics
              </span>
            }
            key='1'
          >
            <Title level={4}>Participant Growth Over Time</Title>
            <Paragraph>
              Tracks active, new, and graduated participants over time.
            </Paragraph>

            <HighchartsReact highcharts={Highcharts} options={chartOptions} />

            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: { type: 'funnel' },
                title: { text: 'Participant Journey Funnel' },
                plotOptions: {
                  funnel: {
                    dataLabels: {
                      enabled: true,
                      format: '<b>{point.name}</b>: {point.y}',
                      softConnector: true
                    }
                  }
                },
                series: [
                  {
                    name: 'Participants',
                    data: [
                      ['Applications Submitted', 2],
                      ['Applications Approved', 1],
                      ['Interventions Assigned', 3],
                      ['Interventions Completed', 2],
                      ['Feedback Provided', 3]
                    ]
                  }
                ]
              }}
            />

            <Divider />

            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: {
                  type: 'bubble',
                  plotBorderWidth: 1,
                  zoomType: 'xy'
                },
                title: {
                  text: 'Top Participants by Engagement'
                },
                xAxis: {
                  title: { text: 'Activity Score' }
                },
                yAxis: {
                  title: { text: 'Compliance Rate (%)' }
                },
                legend: {
                  enabled: true
                },
                tooltip: {
                  useHTML: true,
                  headerFormat: '<table>',
                  pointFormat:
                    '<tr><th>Participant:</th><td>{series.name}</td></tr>' +
                    '<tr><th>Activity:</th><td>{point.x}</td></tr>' +
                    '<tr><th>Compliance:</th><td>{point.y}%</td></tr>' +
                    '<tr><th>Impact Score:</th><td>{point.z}</td></tr>',
                  footerFormat: '</table>',
                  followPointer: true
                },
                plotOptions: {
                  bubble: {
                    minSize: 10,
                    maxSize: 60
                  }
                },
                series: participantSeries
              }}
            />

            <Button type='primary' onClick={() => setInsightsVisible(true)}>
              View AI Insights
            </Button>

            <Drawer
              title='AI Insights on Participant Metrics'
              placement='bottom'
              height={220}
              onClose={() => setInsightsVisible(false)}
              open={insightsVisible}
            >
              <Button
                loading={insightLoading}
                onClick={handleGenerateInsight}
                type='dashed'
              >
                Generate Insight
              </Button>
              <Divider />
              <Text>
                {aiInsight || 'Click generate to analyze this chart.'}
              </Text>
            </Drawer>
          </TabPane>

          <TabPane
            tab={
              <span>
                <LineChartOutlined />
                Resource Utilization
              </span>
            }
            key='2'
          >
            <Title level={4}>Resource Usage Analysis</Title>
            <Paragraph>
              Tracks the usage of different resources across the incubation
              program.
            </Paragraph>

            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: { zoomType: 'xy' },
                title: { text: 'Program Budget & Capacity Overview' },
                xAxis: [
                  {
                    categories: [
                      'Startup Boost',
                      'ScaleUp Ventures',
                      'Green Innovators',
                      'Digital Pioneers',
                      'Women in Business'
                    ]
                  }
                ],
                yAxis: [
                  {
                    // Primary yAxis
                    labels: {
                      formatter: function () {
                        const v = this.value
                        return (
                          'R' +
                          (v >= 1000000
                            ? (v / 1000000).toFixed(1) + 'M'
                            : (v / 1000).toFixed(0) + 'K')
                        )
                      },
                      style: { color: Highcharts.getOptions().colors[1] }
                    },
                    title: {
                      text: 'Budget/Spent',
                      style: { color: Highcharts.getOptions().colors[1] }
                    }
                  },
                  {
                    // Secondary yAxis
                    title: {
                      text: 'Capacity Utilization (%)',
                      style: { color: Highcharts.getOptions().colors[0] }
                    },
                    labels: {
                      format: '{value}%',
                      style: { color: Highcharts.getOptions().colors[0] }
                    },
                    opposite: true
                  }
                ],
                tooltip: {
                  shared: true,
                  formatter: function () {
                    const points = this.points || []
                    return (
                      `<b>${this.x}</b><br/>` +
                      points
                        .map(p => {
                          let value = p.y
                          if (
                            p.series.name === 'Budget' ||
                            p.series.name === 'Spent'
                          ) {
                            value =
                              value >= 1000000
                                ? `R${(value / 1000000).toFixed(1)}M`
                                : `R${(value / 1000).toFixed(1)}K`
                          } else {
                            value = `${value}%`
                          }
                          return `<span style="color:${p.color}">\u25CF</span> ${p.series.name}: <b>${value}</b><br/>`
                        })
                        .join('')
                    )
                  }
                },
                plotOptions: {
                  column: {
                    dataLabels: { enabled: true }
                  },
                  spline: {
                    dataLabels: { enabled: true, format: '{point.y}%' }
                  }
                },
                series: [
                  {
                    name: 'Budget',
                    type: 'column',
                    data: [500000, 750000, 300000, 600000, 400000]
                  },
                  {
                    name: 'Spent',
                    type: 'column',
                    data: [320000, 415000, 295000, 0, 385000]
                  },
                  {
                    name: 'Utilization',
                    type: 'spline',
                    yAxis: 1,
                    data: [64, 55.3, 98.3, 0, 96.3],
                    tooltip: { valueSuffix: '%' }
                  }
                ]
              }}
            />

            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: { type: 'bar' },
                title: { text: 'Utilization by Resource' },
                xAxis: {
                  categories: resourceUtilization.map(r => r.resource),
                  title: { text: null }
                },
                yAxis: {
                  min: 0,
                  max: 100,
                  title: { text: 'Utilization (%)' }
                },
                tooltip: { valueSuffix: '%' },
                plotOptions: {
                  bar: {
                    dataLabels: { enabled: true },
                    colorByPoint: true,
                    colors: resourceUtilization.map(r =>
                      r.utilization > 90
                        ? '#ff4d4f'
                        : r.utilization > 70
                        ? '#faad14'
                        : '#52c41a'
                    )
                  }
                },
                series: [
                  {
                    name: 'Utilization %',
                    type: 'bar',
                    data: resourceUtilization.map(r => r.utilization)
                  }
                ]
              }}
            />

            <Divider />

            <Button
              type='primary'
              onClick={() => setResourceInsightVisible(true)}
            >
              View AI Insights
            </Button>

            <Drawer
              title='AI Insights on Resource Usage'
              placement='bottom'
              height={220}
              onClose={() => setResourceInsightVisible(false)}
              open={resourceInsightVisible}
            >
              <Button
                type='dashed'
                loading={resourceInsightLoading}
                onClick={handleGenerateResourceInsight}
              >
                Generate Insight
              </Button>
              <Divider />
              <Text>
                {resourceAiInsight ||
                  'Click generate to analyze resource data.'}
              </Text>
            </Drawer>
          </TabPane>

          <TabPane
            tab={
              <span>
                <PieChartOutlined />
                Compliance Status
              </span>
            }
            key='3'
          >
            <Title level={4}>Document Compliance Analysis</Title>
            <Paragraph>
              Overview of the compliance status of all participant documents.
            </Paragraph>

            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: { type: 'pie' },
                title: { text: 'Compliance Document Breakdown' },
                tooltip: {
                  pointFormat:
                    '{series.name}: <b>{point.y}</b> ({point.percentage:.1f}%)'
                },
                accessibility: { point: { valueSuffix: '%' } },
                plotOptions: {
                  pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    dataLabels: {
                      enabled: true,
                      format:
                        '<b>{point.name}</b>: {point.y} ({point.percentage:.1f}%)'
                    }
                  }
                },
                series: [
                  {
                    name: 'Documents',
                    type: 'pie',
                    data: complianceStatus.map(status => ({
                      name: status.type,
                      y: status.count
                    }))
                  }
                ]
              }}
            />

            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: { type: 'heatmap' },
                title: { text: 'Compliance Risk Heatmap' },
                xAxis: {
                  categories: ['BEE Cert', 'Tax', 'UIF', 'CIPC', 'ID Copies'],
                  title: { text: 'Document Types' }
                },
                yAxis: {
                  categories: [
                    'TechSolutions Inc.',
                    'GreenEnergy Startup',
                    'HealthTech Innovations',
                    'EdTech Solutions',
                    'FinTech Revolution'
                  ],
                  title: null,
                  reversed: true
                },
                colorAxis: {
                  dataClasses: [
                    { from: 0, to: 0, color: '#faad14', name: 'Pending' },
                    { from: 1, to: 1, color: '#f5222d', name: 'Expired' },
                    { from: 2, to: 2, color: '#d9d9d9', name: 'Missing' },
                    { from: 3, to: 3, color: '#52c41a', name: 'Valid' }
                  ]
                },
                series: [
                  {
                    name: 'Compliance Status',
                    borderWidth: 1,
                    data: [
                      [0, 0, 0],
                      [1, 0, 1],
                      [2, 0, 2],
                      [3, 0, 3],
                      [4, 0, 0],
                      [0, 1, 1],
                      [1, 1, 2],
                      [2, 1, 3],
                      [3, 1, 0],
                      [4, 1, 1],
                      [0, 2, 2],
                      [1, 2, 3],
                      [2, 2, 0],
                      [3, 2, 1],
                      [4, 2, 2],
                      [0, 3, 3],
                      [1, 3, 0],
                      [2, 3, 1],
                      [3, 3, 2],
                      [4, 3, 3],
                      [0, 4, 0],
                      [1, 4, 1],
                      [2, 4, 2],
                      [3, 4, 3],
                      [4, 4, 0]
                    ],
                    dataLabels: { enabled: true, color: '#000000' }
                  }
                ]
              }}
            />

            <Divider />

            <Button
              type='primary'
              onClick={() => setComplianceInsightVisible(true)}
            >
              View AI Insights
            </Button>

            <Drawer
              title='AI Insights on Document Compliance'
              placement='bottom'
              height={220}
              onClose={() => setComplianceInsightVisible(false)}
              open={complianceInsightVisible}
            >
              <Button
                type='dashed'
                loading={complianceInsightLoading}
                onClick={handleGenerateComplianceInsight}
              >
                Generate Insight
              </Button>
              <Divider />
              <Text>
                {complianceAiInsight ||
                  'Click generate to analyze compliance status.'}
              </Text>
            </Drawer>
          </TabPane>

          <TabPane
            tab={
              <span>
                <BarChartOutlined />
                Interventions Overview
              </span>
            }
            key='4'
          >
            <Title level={4}>Interventions by Area Of Support</Title>
            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: { type: 'column' },
                title: { text: null },
                xAxis: { categories: ['Marketing', 'Financial', 'Compliance'] },
                yAxis: { min: 0, title: { text: 'Count' } },
                tooltip: { shared: true },
                plotOptions: {
                  column: { stacking: 'normal' },
                  series: {
                    dataLabels: {
                      enabled: true,
                      format: '{point.y}'
                    }
                  }
                },
                series: [
                  {
                    name: 'Assigned',
                    data: [18, 10, 12],
                    type: 'column'
                  },
                  {
                    name: 'Completed',
                    data: [15, 7, 10],
                    type: 'column'
                  }
                ]
              }}
            />

            <Divider />

            <Title level={4}>Top 5 Interventions by Frequency</Title>
            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: { type: 'bar' },
                title: { text: null },
                xAxis: {
                  categories: [
                    'Website Dev',
                    'Social Media',
                    'Food Safety',
                    'CRM Setup',
                    'Marketing Plan'
                  ]
                },
                yAxis: {
                  min: 0,
                  title: { text: 'Intervention Count' }
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
                    name: 'Delivered',
                    data: [12, 9, 8, 7, 6],
                    type: 'bar'
                  }
                ]
              }}
            />

            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: { type: 'treemap' },
                title: { text: 'Intervention Delivery Overview' },
                series: [
                  {
                    type: 'treemap',
                    layoutAlgorithm: 'squarified',
                    data: [
                      {
                        name: 'Marketing - Email Signature',
                        value: 3,
                        group: 'Marketing'
                      },
                      {
                        name: 'Compliance - Food Safety',
                        value: 12,
                        group: 'Compliance'
                      },
                      {
                        name: 'Marketing - CRM Setup',
                        value: 10,
                        group: 'Marketing'
                      },
                      {
                        name: 'Marketing - Social Media',
                        value: 4,
                        group: 'Marketing'
                      }
                    ]
                  }
                ]
              }}
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <TeamOutlined />
                Consultant Analytics
              </span>
            }
            key='5'
          >
            <Title level={4}>Top Consultants by Intervention Count</Title>
            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: { type: 'bar' },
                title: { text: null },
                xAxis: {
                  categories: ['John', 'Amanda', 'Kabelo', 'Naledi', 'Thabo']
                },
                yAxis: { title: { text: 'Interventions' } },
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
                    name: 'Interventions',
                    data: [9, 8, 7, 6, 5],
                    type: 'bar'
                  }
                ]
              }}
            />

            <Divider />

            <Title level={4}>Top Consultants by Hours</Title>
            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: { type: 'column' },
                title: { text: null },
                xAxis: {
                  categories: ['John', 'Amanda', 'Kabelo', 'Naledi', 'Thabo']
                },
                yAxis: { title: { text: 'Hours' } },
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
                    name: 'Hours',
                    data: [42, 36, 30, 28, 24],
                    type: 'column'
                  }
                ]
              }}
            />
            <Select
              value={topNConsultants}
              onChange={value => setTopNConsultants(value)}
              style={{ width: 120 }}
            >
              {[5, 10, 15, 20].map(n => (
                <Option key={n} value={n}>{`Top ${n}`}</Option>
              ))}
            </Select>

            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: { type: 'bubble', plotBorderWidth: 1, zoomType: 'xy' },
                title: { text: 'Consultant Performance Matrix' },
                xAxis: {
                  title: { text: 'Rating' },
                  startOnTick: true,
                  endOnTick: true,
                  showLastLabel: true
                },
                yAxis: { title: { text: 'Assignments' } },
                legend: { enabled: true },
                tooltip: {
                  useHTML: true,
                  headerFormat: '<table>',
                  pointFormat:
                    '<tr><th>Consultant:</th><td>{series.name}</td></tr>' +
                    '<tr><th>Rating:</th><td>{point.x}</td></tr>' +
                    '<tr><th>Assignments:</th><td>{point.y}</td></tr>' +
                    '<tr><th>Impact Score:</th><td>{point.z}</td></tr>',
                  footerFormat: '</table>',
                  followPointer: true
                },
                plotOptions: { bubble: { minSize: 10, maxSize: 60 } },
                series: consultantSeries
              }}
            />

            <Select
              value={topN}
              onChange={value => setTopN(value)}
              style={{ width: 120 }}
            >
              {[5, 10, 15, 20].map(n => (
                <Option key={n} value={n}>{`Top ${n}`}</Option>
              ))}
            </Select>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}

export default OperationsReports
