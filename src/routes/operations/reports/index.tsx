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
  Modal,
  Drawer
} from 'antd'
import type { StatisticProps } from 'antd'
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
import { Helmet } from 'react-helmet'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import HighchartsFunnel from 'highcharts/modules/funnel'
import HighchartsTreemap from 'highcharts/modules/treemap'
import HighchartsMore from 'highcharts/highcharts-more'
import CountUp from 'react-countup'

const formatter: StatisticProps['formatter'] = value => (
  <CountUp end={value as number} separator=',' />
)
// Initialize Highcharts modules
if (typeof HighchartsFunnel === 'function') HighchartsFunnel(Highcharts)
if (typeof HighchartsTreemap === 'function') HighchartsTreemap(Highcharts)
if (typeof HighchartsMore === 'function') HighchartsMore(Highcharts)
import('highcharts/modules/heatmap').then(HeatmapModule => {
  HeatmapModule.default(Highcharts)
})

const renderInsight = (raw: string): any | null => {
  try {
    // Remove code block wrapping if it exists
    const cleaned = raw
      .trim()
      .replace(/^```json/, '')
      .replace(/```$/, '')
      .trim()

    return JSON.parse(cleaned)
  } catch (err) {
    console.warn('⚠️ Failed to parse AI insight as JSON.', err)
    return null
  }
}

const ChartCard = ({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) => {
  const [modalVisible, setModalVisible] = useState(false)

  return (
    <>
      <Helmet>
        <title>Operations Reports</title>
      </Helmet>
      <Card
        title={title}
        extra={
          <Button type='link' onClick={() => setModalVisible(true)}>
            Expand
          </Button>
        }
        style={{ height: '100%' }}
        bodyStyle={{ minHeight: 280 }}
      >
        {children}
      </Card>

      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width='80%'
        style={{ top: 40 }}
      >
        <Title level={4}>{title}</Title>
        {children}
      </Modal>
    </>
  )
}

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

const consultantData = [
  { name: 'John', x: 4.1, y: 4, z: 30 },
  { name: 'Amanda', x: 4.7, y: 10, z: 40 },
  { name: 'Kabelo', x: 4.8, y: 3, z: 25 },
  { name: 'Naledi', x: 3.7, y: 2, z: 20 },
  { name: 'Thabo', x: 4.9, y: 2, z: 35 }
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

  const [drawer, setDrawer] = useState<{
    visible: boolean
    loading: boolean
    title: string
    data: any
    insightType: string
    content: string | null
  }>({
    visible: false,
    loading: false,
    title: '',
    data: null,
    insightType: '',
    content: null
  })

  const openInsightDrawer = (title: string, insightType: string, data: any) => {
    setDrawer({
      visible: true,
      loading: false,
      title,
      insightType,
      data,
      content: null
    })
  }

  const generateInsight = async (type: string) => {
    setDrawer(prev => ({ ...prev, loading: true }))
    const insight = await fetchAIInsight(type, drawer.data)
    setDrawer(prev => ({ ...prev, content: insight, loading: false }))
  }

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

  const fetchAIInsight = async (type: string, data: any): Promise<string> => {
    try {
      const response = await fetch(
        'https://yoursdvniel-smart-inc.hf.space/api/ai-insight',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ type, data })
        }
      )

      const result = await response.json()
      console.log(result)
      return result.insight || 'No insight returned.'
    } catch (error) {
      console.error('AI insight error:', error)
      return '⚠️ Failed to fetch AI insight.'
    }
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
      <Card style={{ marginTop: 20, marginBottom: 20 }}>
        <Form
          form={form}
          layout='vertical'
          onFinish={handleGenerateReport}
          initialValues={{
            reportType: 'participant',
            timePeriod: 'month'
          }}
        >
          <Row gutter={16} align='bottom'>
            <Col flex='1'>
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

            <Col flex='1'>
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

            {timePeriod === 'custom' && (
              <Col flex='1'>
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
              </Col>
            )}

            <Col>
              <Form.Item label=' ' colon={false}>
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
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* Dashboard Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title='Total Participants'
              value={85}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
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
          <Card loading={loading}>
            <Statistic
              title='Funding Utilized'
              value={2450000}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14' }}
              formatter={formatter}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
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

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <ChartCard title='Participant Growth Over Time'>
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={chartOptions}
                  />
                </ChartCard>
              </Col>

              <Col xs={24} md={12}>
                <ChartCard title='Participant Funnel'>
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
                </ChartCard>
              </Col>

              <Col xs={24}>
                <ChartCard title='Top Participants by Engagement'>
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
                </ChartCard>
              </Col>
            </Row>

            <Divider />

            <Button
              type='primary'
              onClick={() =>
                openInsightDrawer(
                  'AI Insights on Participant Metrics',
                  'participant',
                  participantMetrics
                )
              }
            >
              View AI Insights
            </Button>
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

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <ChartCard title='Program Budget & Capacity Overview'>
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                      chart: { zoomType: 'xy' },
                      title: { text: '' },
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
                </ChartCard>
              </Col>

              <Col xs={24} md={12}>
                <ChartCard title='Utilization by Resource'>
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                      chart: { type: 'bar' },
                      title: '',
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
                </ChartCard>
              </Col>
            </Row>

            <Divider />

            <Button
              type='primary'
              onClick={() =>
                openInsightDrawer(
                  'AI Insights on Resource Utilization',
                  'resource',
                  resourceUtilization
                )
              }
            >
              View AI Insights
            </Button>
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
                  categories: [
                    'B-BBEE Cert',
                    'Tax',
                    'UIF',
                    'CIPC',
                    'ID Copies'
                  ],
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
              onClick={() =>
                openInsightDrawer(
                  'AI Insights on Compliance Status',
                  'compliance',
                  complianceStatus
                )
              }
            >
              View AI Insights
            </Button>
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
            <Title level={4}></Title>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <ChartCard title='Interventions by Area Of Support'>
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                      chart: { type: 'column' },
                      title: { text: null },
                      xAxis: {
                        categories: ['Marketing', 'Financial', 'Compliance']
                      },
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
                </ChartCard>
              </Col>

              <Col xs={24} md={12}>
                <ChartCard title='Top 5 Interventions by Frequency'>
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
                </ChartCard>
              </Col>

              <Col xs={24}>
                <ChartCard title='Intervention Delivery Overview'>
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                      chart: {
                        type: 'treemap'
                      },
                      title: {
                        text: 'Interventions by Area of Support',
                        align: 'left'
                      },
                      tooltip: {
                        useHTML: true,
                        pointFormat:
                          'Intervention: <b>{point.name}</b><br/>Count: <b>{point.value}</b>'
                      },
                      series: [
                        {
                          type: 'treemap',
                          name: 'Areas Of Support',
                          allowTraversingTree: true,
                          alternateStartingDirection: true,
                          layoutAlgorithm: 'squarified',
                          nodeSizeBy: 'leaf',
                          borderColor: '#ffffff',
                          borderRadius: 3,
                          levels: [
                            {
                              level: 1,
                              layoutAlgorithm: 'sliceAndDice',
                              groupPadding: 3,
                              dataLabels: {
                                headers: true,
                                enabled: true,
                                style: {
                                  fontSize: '0.6em',
                                  fontWeight: 'normal',
                                  textTransform: 'uppercase'
                                }
                              },
                              borderRadius: 3,
                              borderWidth: 1,
                              colorByPoint: true // 🎨 Use color per parent
                            },
                            {
                              level: 2,
                              dataLabels: {
                                enabled: true,
                                inside: false
                              }
                            }
                          ],
                          data: [
                            // Parents
                            {
                              id: 'marketing',
                              name: 'Marketing',
                              color: '#50FFB1'
                            },
                            {
                              id: 'compliance',
                              name: 'Compliance',
                              color: '#F5FBEF'
                            },
                            {
                              id: 'finance',
                              name: 'Finance',
                              color: '#A09FA8'
                            },
                            {
                              id: 'operations',
                              name: 'Operations',
                              color: '#E7ECEF'
                            },
                            {
                              id: 'technology',
                              name: 'Technology',
                              color: '#A9B4C2'
                            },
                            { id: 'legal', name: 'Legal', color: '#FF5630' },

                            // Children (interventions)
                            {
                              name: 'CRM Setup',
                              parent: 'marketing',
                              value: 10
                            },
                            {
                              name: 'Email Campaign',
                              parent: 'marketing',
                              value: 5
                            },
                            {
                              name: 'Social Media Strategy',
                              parent: 'marketing',
                              value: 6
                            },
                            {
                              name: 'Brand Guidelines',
                              parent: 'marketing',
                              value: 4
                            },

                            {
                              name: 'Food Safety Audit',
                              parent: 'compliance',
                              value: 12
                            },
                            {
                              name: 'Tax Clearance',
                              parent: 'compliance',
                              value: 7
                            },
                            {
                              name: 'B-BBEE Verification',
                              parent: 'compliance',
                              value: 6
                            },
                            {
                              name: 'Health Certificate',
                              parent: 'compliance',
                              value: 5
                            },

                            {
                              name: 'Budget Forecasting',
                              parent: 'finance',
                              value: 8
                            },
                            {
                              name: 'Investment Readiness',
                              parent: 'finance',
                              value: 6
                            },
                            {
                              name: 'Funding Access',
                              parent: 'finance',
                              value: 5
                            },
                            {
                              name: 'Cash Flow Management',
                              parent: 'finance',
                              value: 4
                            },

                            {
                              name: 'Workflow Automation',
                              parent: 'operations',
                              value: 9
                            },
                            {
                              name: 'Inventory Setup',
                              parent: 'operations',
                              value: 7
                            },
                            {
                              name: 'Supplier Engagement',
                              parent: 'operations',
                              value: 3
                            },

                            {
                              name: 'Website Development',
                              parent: 'technology',
                              value: 11
                            },
                            {
                              name: 'Mobile App Planning',
                              parent: 'technology',
                              value: 6
                            },
                            {
                              name: 'Cloud Tools',
                              parent: 'technology',
                              value: 5
                            },

                            {
                              name: 'Company Registration',
                              parent: 'legal',
                              value: 8
                            },
                            {
                              name: 'Contract Templates',
                              parent: 'legal',
                              value: 5
                            },
                            {
                              name: 'IP Protection Advice',
                              parent: 'legal',
                              value: 4
                            }
                          ]
                        }
                      ]
                    }}
                  />
                </ChartCard>
              </Col>
            </Row>

            <Button
              type='primary'
              onClick={() =>
                openInsightDrawer(
                  'AI Insights on Interventions',
                  'intervention',
                  [
                    { category: 'Assigned', data: [18, 10, 12] },
                    { category: 'Completed', data: [15, 7, 10] },
                    {
                      top5: [
                        'Website Dev',
                        'Social Media',
                        'Food Safety',
                        'CRM Setup',
                        'Marketing Plan'
                      ]
                    },
                    {
                      treemap: [
                        { name: 'Marketing - Email Signature', value: 3 },
                        { name: 'Compliance - Food Safety', value: 12 },
                        { name: 'Marketing - CRM Setup', value: 10 },
                        { name: 'Marketing - Social Media', value: 4 }
                      ]
                    }
                  ]
                )
              }
            >
              View AI Insights
            </Button>
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
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <ChartCard title='Top Consultants by Intervention Count'>
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                      chart: { type: 'bar' },
                      title: { text: null },
                      xAxis: {
                        categories: [
                          'John',
                          'Amanda',
                          'Kabelo',
                          'Naledi',
                          'Thabo'
                        ]
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
                </ChartCard>
              </Col>

              <Col xs={24} md={12}>
                <ChartCard title='Top Consultants by Hours'>
                  <Select
                    value={topN}
                    onChange={value => setTopN(value)}
                    style={{ width: 150, marginBottom: 10 }}
                  >
                    {[5, 10, 15, 20].map(n => (
                      <Option key={n} value={n}>{`Top ${n}`}</Option>
                    ))}
                  </Select>
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                      chart: { type: 'column' },
                      title: { text: null },
                      xAxis: {
                        categories: [
                          'John',
                          'Amanda',
                          'Kabelo',
                          'Naledi',
                          'Thabo'
                        ]
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
                </ChartCard>
              </Col>

              <Col xs={24}>
                <ChartCard title='Consultant Performance Matrix'>
                  <Select
                    value={topNConsultants}
                    onChange={value => setTopNConsultants(value)}
                    style={{ width: 150, marginBottom: 10 }}
                  >
                    {[5, 10, 15, 20].map(n => (
                      <Option key={n} value={n}>{`Top ${n}`}</Option>
                    ))}
                  </Select>
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                      chart: {
                        type: 'bubble',
                        plotBorderWidth: 1,
                        zoomType: 'xy'
                      },
                      title: { text: '' },
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
                </ChartCard>
              </Col>
            </Row>

            <Button
              type='primary'
              onClick={() =>
                openInsightDrawer(
                  'AI Insights on Consultant Performance',
                  'consultant',
                  consultantData
                )
              }
            >
              View AI Insights
            </Button>
          </TabPane>
        </Tabs>
        <Drawer
          title={drawer.title}
          placement='right'
          width={480}
          onClose={() => setDrawer(prev => ({ ...prev, visible: false }))}
          open={drawer.visible}
        >
          <Button
            type='dashed'
            loading={drawer.loading}
            onClick={() => generateInsight(drawer.insightType)}
            block
          >
            Generate Insight
          </Button>

          <Divider />

          {/* {renderInsight()} */}

          {drawer.content ? (
            (() => {
              const parsed = renderInsight(drawer.content)
              if (!parsed)
                return (
                  <Text type='danger'>
                    ⚠️ Failed to generate insight. Kindly retry.
                  </Text>
                )

              return (
                <>
                  <Paragraph strong>{parsed.summary}</Paragraph>
                  <Title level={5}>Details</Title>
                  <ul>
                    {parsed.details?.map((d: string, i: number) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                  <Title level={5}>Recommendations</Title>
                  <ul>
                    {parsed.recommendations?.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </>
              )
            })()
          ) : (
            <Text type='secondary'>Click generate to analyze the data.</Text>
          )}
        </Drawer>
      </Card>
    </div>
  )
}

export default OperationsReports
