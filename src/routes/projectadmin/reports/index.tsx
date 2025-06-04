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

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker
const { Option } = Select
const { TabPane } = Tabs

// Chart options factory functions
const emptySeries = (type: 'bar' | 'column' | 'pie', length = 5) =>
  type === 'pie'
    ? []
    : Array(length).fill(0)

const emptyPieData = () => []

const makeChartOption = (original: Highcharts.Options, empty: boolean) => {
  const option = { ...original }
  if (!option.series) return option
  option.series = option.series.map(s => {
    if ('type' in s && (s.type === 'bar' || s.type === 'column')) {
      return { ...s, data: empty ? emptySeries(s.type, Array.isArray(s.data) ? s.data.length : 5) }
    }
    if ('type' in s && s.type === 'pie') {
      return { ...s, data: empty ? emptyPieData() : s.data }
    }
    return s
  })
  return option
}

// Mock data for participant metrics
const participantMetrics = [
  { month: 'Jan', active: 35, new: 12, graduated: 5 },
  { month: 'Feb', active: 40, new: 15, graduated: 3 },
  { month: 'Mar', active: 48, new: 18, graduated: 2 },
  { month: 'Apr', active: 58, new: 22, graduated: 4 },
  { month: 'May', active: 70, new: 25, graduated: 6 },
  { month: 'Jun', active: 85, new: 28, graduated: 7 }
]

const getTopParticipantsOptions = (empty: boolean) => ({
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
      data: empty ? [] : [12, 9, 8, 7, 6],
      type: 'bar'
    }
  ]
})

const getProvinceReachOptions = (empty: boolean) => ({
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
      data: empty ? [] : [32, 24, 18, 12, 7],
      type: 'column'
    }
  ]
})

const getGenderDistOptions = (empty: boolean) => ({
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
      data: empty
        ? []
        : [
            { name: 'Female', y: 58 },
            { name: 'Male', y: 42 }
          ]
    }
  ]
})

const getAgeDistOptions = (empty: boolean) => ({
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
      data: empty ? [] : [12, 35, 25, 10, 3],
      type: 'column'
    }
  ]
})

const getGenderCompletionOptions = (empty: boolean) => ({
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
      data: empty ? [] : [40, 60],
      type: 'column'
    },
    {
      name: 'Incomplete',
      data: empty ? [] : [10, 5],
      type: 'column'
    }
  ]
})

const getParticipantRatingOptions = (empty: boolean) => ({
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
      data: empty ? [] : [1, 2, 10, 25, 45],
      type: 'bar'
    }
  ]
})

const getSectorComparativeOptions = (empty: boolean) => ({
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
      data: empty ? [] : [28, 14, 8],
      type: 'column'
    },
    {
      name: 'Outstanding',
      data: empty ? [] : [5, 10, 3],
      type: 'column'
    }
  ]
})

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

  const isQTX = companyCode === 'QTX'

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
    series: isQTX
      ? [
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
      : [
          { name: 'Active', data: [], type: 'column' },
          { name: 'New', data: [], type: 'column' },
          { name: 'Graduated', data: [], type: 'column' }
        ]
  }

  const topParticipants = getTopParticipantsOptions(isQTX)
  const provinceReach = getProvinceReachOptions(isQTX)
  const genderDist = getGenderDistOptions(isQTX)
  const ageDist = getAgeDistOptions(isQTX)
  const genderCompletion = getGenderCompletionOptions(isQTX)
  const participantRating = getParticipantRatingOptions(isQTX)
  const sectorComparative = getSectorComparativeOptions(isQTX)

  useEffect(() => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
    }, 500)
  }, [reportType, timePeriod, customDateRange, companyCode])

  const handleGenerateInsight = () => {
    setInsightLoading(true)
    setTimeout(() => {
      setAiInsight(
        `AI Insight: Notable increase in new participants in ${participantMetrics[3]?.month}. Graduation rate stable, suggesting effective retention strategies.`
      )
      setInsightLoading(false)
    }, 1200)
  }

  // --- rest unchanged ---

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
      ) : (
        <div style={{ padding: '20px' }}>
          <Title level={2}>Reports & Analytics</Title>
          <Text>Generate and analyze reports for operations management.</Text>

          {/* Report Filters */}
          <Card style={{ marginTop: '20px', marginBottom: '20px' }}>
            <Form
              form={form}
              layout='vertical'
              onFinish={() => {}}
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
                      onChange={setReportType}
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
                      onChange={setTimePeriod}
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
                        onChange={dates => setCustomDateRange(dates)}
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
                    <Button icon={<FileExcelOutlined />}>Export Excel</Button>
                    <Button icon={<FilePdfOutlined />}>Export PDF</Button>
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
                  value={isQTX ? 85 : 0}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title='Resources Allocated'
                  value={isQTX ? 68 : 0}
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
                  value={isQTX ? 2450000 : 0}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title='Compliance Rate'
                  value={isQTX ? 92 : 0}
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
                        options={topParticipants}
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
                        options={genderDist}
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
                        options={ageDist}
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
                        options={genderCompletion}
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
                        options={participantRating}
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
                        options={sectorComparative}
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
                        options={provinceReach}
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

              {/* Other tabs... */}
              {/* (leave unchanged for brevity, add empty data logic if needed) */}

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
                options={topParticipants}
              />
            )}
            {expandedChart === 'genderDist' && (
              <HighchartsReact
                highcharts={Highcharts}
                options={genderDist}
              />
            )}
            {expandedChart === 'ageDist' && (
              <HighchartsReact highcharts={Highcharts} options={ageDist} />
            )}
            {expandedChart === 'genderCompletion' && (
              <HighchartsReact
                highcharts={Highcharts}
                options={genderCompletion}
              />
            )}
            {expandedChart === 'participantRating' && (
              <HighchartsReact
                highcharts={Highcharts}
                options={participantRating}
              />
            )}
            {expandedChart === 'programReach' && (
              <HighchartsReact
                highcharts={Highcharts}
                options={provinceReach}
              />
            )}
            {expandedChart === 'interventionFulfillment' && (
              <HighchartsReact
                highcharts={Highcharts}
                options={sectorComparative}
              />
            )}
          </Modal>
        </div>
      )}
    </>
  )
}

export default ProjectAdminReports
