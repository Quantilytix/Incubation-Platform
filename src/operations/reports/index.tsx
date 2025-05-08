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

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker
const { Option } = Select
const { TabPane } = Tabs

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

            <Divider />

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
                plotOptions: { column: { stacking: 'normal' } },
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
                series: [
                  {
                    name: 'Delivered',
                    data: [12, 9, 8, 7, 6],
                    type: 'bar'
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
                series: [
                  {
                    name: 'Hours',
                    data: [42, 36, 30, 28, 24],
                    type: 'column'
                  }
                ]
              }}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}

export default OperationsReports
