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
  Drawer,
  Modal,
  Spin,
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
import { Helmet } from 'react-helmet'
import { auth, db } from '@/firebase'
import { doc, getDoc } from 'firebase/firestore'
import ProfileForm from './ProfileForm' // adjust path if needed

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

const topParticipantsOptions: Highcharts.Options = {
  chart: { type: 'bar' },
  title: { text: 'Top 5 Participants by Completed Interventions' },
  xAxis: {
    categories: [
      'Thandi M.',
      'Peter K.',
      'Bongani T.',
      'Zanele L.',
      'David O.'
    ],
    title: { text: 'Participant' }
  },
  yAxis: {
    min: 0,
    title: { text: 'Completed Interventions' }
  },
  series: [
    {
      name: 'Interventions',
      data: [12, 9, 8, 7, 6],
      type: 'bar'
    }
  ]
}
const provinceReachOptions: Highcharts.Options = {
  chart: { type: 'column' },
  title: { text: 'Program Reach by Province' },
  xAxis: {
    categories: ['Gauteng', 'Limpopo', 'KZN', 'WC', 'EC'],
    title: { text: 'Province' }
  },
  yAxis: {
    title: { text: 'Participants Supported' }
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
      name: 'Participants',
      data: [32, 24, 18, 12, 7],
      type: 'column'
    }
  ]
}
const genderDistOptions: Highcharts.Options = {
  chart: { type: 'pie' },
  title: { text: 'Gender Distribution of Participants' },
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
      name: 'Participants',
      colorByPoint: true,
      type: 'pie',
      data: [
        { name: 'Female', y: 58 },
        { name: 'Male', y: 42 }
      ]
    }
  ]
}
const ageDistOptions: Highcharts.Options = {
  chart: { type: 'column' },
  title: { text: 'Age Distribution of Participants' },
  xAxis: {
    categories: ['18-24', '25-34', '35-44', '45-54', '55+'],
    title: { text: 'Age Group' }
  },
  yAxis: {
    min: 0,
    title: { text: 'Number of Participants' }
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
      name: 'Participants',
      data: [12, 35, 25, 10, 3],
      type: 'column'
    }
  ]
}
const genderCompletionOptions: Highcharts.Options = {
  chart: { type: 'column' },
  title: { text: 'Intervention Completion by Gender' },
  xAxis: {
    categories: ['Male', 'Female'],
    title: { text: 'Gender' }
  },
  yAxis: {
    min: 0,
    title: { text: 'Completed Interventions' }
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
      name: 'Completed',
      data: [40, 60],
      type: 'column'
    },
    {
      name: 'Incomplete',
      data: [10, 5],
      type: 'column'
    }
  ]
}
const participantRatingOptions: Highcharts.Options = {
  chart: { type: 'bar' },
  title: { text: 'Participant Ratings Distribution' },
  xAxis: {
    categories: ['1★', '2★', '3★', '4★', '5★'],
    title: { text: 'Rating' }
  },
  yAxis: {
    min: 0,
    title: { text: 'Number of Ratings' }
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
      name: 'Participants',
      data: [1, 2, 10, 25, 45],
      type: 'bar'
    }
  ]
}
const sectorComparativeOptions: Highcharts.Options = {
  chart: { type: 'column' },
  title: { text: 'Interventions: Completed vs Needed by Sector' },
  xAxis: {
    categories: ['Marketing', 'Finance', 'Compliance'],
    title: { text: 'Sector' }
  },
  yAxis: {
    min: 0,
    title: { text: 'Number of Interventions' }
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
      name: 'Completed',
      data: [28, 14, 8],
      type: 'column'
    },
    {
      name: 'Outstanding',
      data: [5, 10, 3],
      type: 'column'
    }
  ]
}

const ProjectAdminReports: React.FC = () => {
  // Company check state
  const [companyCode, setCompanyCode] = useState<string | null>(null)
  const [loadingCompany, setLoadingCompany] = useState(true)
  // Page state
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
  const [expandedChart, setExpandedChart] = useState<null | string>(null)

  // Company check effect
  useEffect(() => {
    const fetchCompanyCode = async () => {
      setLoadingCompany(true)
      try {
        const user = auth.currentUser
        if (!user) {
          setCompanyCode(null)
          setLoadingCompany(false)
          return
        }
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        if (!userSnap.exists()) {
          setCompanyCode(null)
          setLoadingCompany(false)
          return
        }
        setCompanyCode(userSnap.data().companyCode)
      } catch {
        setCompanyCode(null)
      }
      setLoadingCompany(false)
    }
    fetchCompanyCode()
  }, [])

  const handleGenerateInsight = () => {
    setInsightLoading(true)
    setTimeout(() => {
      setAiInsight(
        `AI Insight: Notable increase in new participants in ${participantMetrics[3]?.month}. Graduation rate stable, suggesting effective retention strategies.`
      )
      setInsightLoading(false)
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
    <>
      <Helmet>
        <title>Project Reports & Analytics</title>
        <meta
          name='description'
          content='Generate and analyze incubation program reports, participant growth, and compliance status.'
        />
      </Helmet>
      {loadingCompany ? (
        <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin tip="Loading company info..." size="large" />
        </div>
      ) : companyCode !== 'QTX' ? (
        <div style={{ maxWidth: 850, margin: '40px auto' }}>
          <Card>
            <Title level={4} style={{ marginBottom: 16 }}>Complete Your Company Profile</Title>
            <ProfileForm />
          </Card>
        </div>
      ) : (
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
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Card
                      title='Participant Growth Over Time'
                      extra={
                        <Button
                          size='small'
                          onClick={() => setExpandedChart('participantGrowth')}
                        >
                          Expand
                        </Button>
                      }
                    >
                      <HighchartsReact
                        highcharts={Highcharts}
                        options={chartOptions}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card
                      title='Top Performing Participants'
                      extra={
                        <Button
                          size='small'
                          onClick={() =>
                            setExpandedChart('topPerformingParticipants')
                          }
                        >
                          Expand
                        </Button>
                      }
                    >
                      <HighchartsReact
                        highcharts={Highcharts}
                        options={topParticipantsOptions}
                      />
                    </Card>
                  </Col>

                  <Col xs={24} md={12}>
                    <Card
                      title='Gender Distribution'
                      extra={
                        <Button
                          size='small'
                          onClick={() => setExpandedChart('genderDist')}
                        >
                          Expand
                        </Button>
                      }
                    >
                      <HighchartsReact
                        highcharts={Highcharts}
                        options={genderDistOptions}
                      />
                    </Card>
                  </Col>

                  <Col xs={24} md={12}>
                    <Card
                      title='Age Distribution'
                      extra={
                        <Button
                          size='small'
                          onClick={() => setExpandedChart('ageDist')}
                        >
                          Expand
                        </Button>
                      }
                    >
                      <HighchartsReact
                        highcharts={Highcharts}
                        options={ageDistOptions}
                      />
                    </Card>
                  </Col>

                  <Col xs={24} md={12}>
                    <Card
                      title='Completion by Gender'
                      extra={
                        <Button
                          size='small'
                          onClick={() => setExpandedChart('genderCompletion')}
                        >
                          Expand
                        </Button>
                      }
                    >
                      <HighchartsReact
                        highcharts={Highcharts}
                        options={genderCompletionOptions}
                      />
                    </Card>
                  </Col>

                  <Col xs={24} md={12}>
                    <Card
                      title='Participant Ratings'
                      extra={
                        <Button
                          size='small'
                          onClick={() => setExpandedChart('participantRating')}
                        >
                          Expand
                        </Button>
                      }
                    >
                      <HighchartsReact
                        highcharts={Highcharts}
                        options={participantRatingOptions}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card
                      title='Intervention Fulfillment'
                      extra={
                        <Button
                          size='small'
                          onClick={() =>
                            setExpandedChart('interventionFulfillment')
                          }
                        >
                          Expand
                        </Button>
                      }
                    >
                      <HighchartsReact
                        highcharts={Highcharts}
                        options={sectorComparativeOptions}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card
                      title='Program Reach'
                      extra={
                        <Button
                          size='small'
                          onClick={() => setExpandedChart('programReach')}
                        >
                          Expand
                        </Button>
                      }
                    >
                      <HighchartsReact
                        highcharts={Highcharts}
                        options={provinceReachOptions}
                      />
                    </Card>
                  </Col>
                </Row>

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
                    xAxis: {
                      categories: ['Marketing', 'Financial', 'Compliance']
                    },
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
            </Tabs>
          </Card>
          <Modal
            open={!!expandedChart}
            footer={null}
            onCancel={() => setExpandedChart(null)}
            width={900}
            title={`Expanded View: ${expandedChart?.replace(/([A-Z])/g, ' $1')}`}
          >
            {expandedChart === 'participantGrowth' && (
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            )}

            {expandedChart === 'topPerformingParticipants' && (
              <HighchartsReact
                highcharts={Highcharts}
                options={topParticipantsOptions}
              />
            )}
            {expandedChart === 'genderDist' && (
              <HighchartsReact
                highcharts={Highcharts}
                options={genderDistOptions}
              />
            )}
            {expandedChart === 'ageDist' && (
              <HighchartsReact highcharts={Highcharts} options={ageDistOptions} />
            )}
            {expandedChart === 'genderCompletion' && (
              <HighchartsReact
                highcharts={Highcharts}
                options={genderCompletionOptions}
              />
            )}
            {expandedChart === 'participantRating' && (
              <HighchartsReact
                highcharts={Highcharts}
                options={participantRatingOptions}
              />
            )}
            {expandedChart === 'programReach' && (
              <HighchartsReact
                highcharts={Highcharts}
                options={provinceReachOptions}
              />
            )}
            {expandedChart === 'interventionFulfillment' && (
              <HighchartsReact
                highcharts={Highcharts}
                options={sectorComparativeOptions}
              />
            )}
          </Modal>
        </div>
      )}
    </>
  )
}

export default ProjectAdminReports
