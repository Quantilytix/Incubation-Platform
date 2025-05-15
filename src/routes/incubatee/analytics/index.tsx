import React, { useEffect, useState } from 'react'
import {
  Layout,
  Typography,
  Card,
  Row,
  Col,
  Spin,
  message,
  Modal,
  Button,
  Select
} from 'antd'
import HighchartsReact from 'highcharts-react-official'
import Highcharts from 'highcharts'
import { auth, db } from '@/firebase'
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from 'firebase/firestore'
import { Helmet } from 'react-helmet'
import dayjs from 'dayjs'

const { Title } = Typography
const { Content } = Layout

const fallbackMonths = [
  'November',
  'December',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June'
]
const fallbackData = [
  { month: 'November', revenue: 283373, permEmployees: 15, tempEmployees: 2 },
  { month: 'December', revenue: 448864, permEmployees: 10, tempEmployees: 8 },
  { month: 'January', revenue: 195199, permEmployees: 4, tempEmployees: 5 },
  { month: 'February', revenue: 203379, permEmployees: 10, tempEmployees: 5 },
  { month: 'March', revenue: 202453, permEmployees: 5, tempEmployees: 3 },
  { month: 'April', revenue: 221848, permEmployees: 5, tempEmployees: 8 }
]

const IncubateeAnalytics = () => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(fallbackData)
  const [applicationStats, setApplicationStats] = useState({
    accepted: 0,
    pending: 0,
    declined: 0,
    total: 0
  })
  const [modalVisible, setModalVisible] = useState(false)
  const [expandedChart, setExpandedChart] = useState<
    'revenue' | 'headcount' | 'applications' | null
  >(null)
  const [selectedYear, setSelectedYear] = useState<string>(
    dayjs().year().toString()
  )

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser
        if (!user) return

        // 🟢 Get application stats
        const appSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('email', '==', user.email)
          )
        )

        let accepted = 0,
          pending = 0,
          declined = 0

        appSnap.forEach(doc => {
          const status = doc.data().applicationStatus?.toLowerCase()
          if (status === 'accepted') accepted++
          else if (status === 'pending') pending++
          else if (status === 'declined') declined++
        })

        setApplicationStats({
          accepted,
          pending,
          declined,
          total: accepted + pending + declined
        })

        // 🟢 Get participant record
        const participantSnap = await getDocs(
          query(
            collection(db, 'participants'),
            where('email', '==', user.email)
          )
        )

        if (!participantSnap.empty) {
          const docData = participantSnap.docs[0].data()

          const revenueMonthly = docData?.revenueHistory?.monthly || {}
          const headcountMonthly = docData?.headcountHistory?.monthly || {}

          const parsed = fallbackMonths.map(month => ({
            month,
            revenue: Number(revenueMonthly[month]) || 0,
            permEmployees: Number(headcountMonthly[month]?.permanent) || 0,
            tempEmployees: Number(headcountMonthly[month]?.temporary) || 0
          }))

          setData(parsed)
        }
      } catch (err) {
        console.error(err)
        message.error('Failed to load analytics data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatRevenue = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toString()
  }

  const headcountVsRevenueOptions = {
    chart: { zoomType: 'xy' },
    title: { text: 'Headcount vs Revenue' },
    xAxis: [{ categories: data.map(d => d.month), crosshair: true }],
    yAxis: [
      { title: { text: 'Employees' } },
      {
        title: { text: 'Revenue (ZAR)' },
        opposite: true,
        labels: {
          formatter: function () {
            return formatRevenue(this.value)
          }
        }
      }
    ],
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          formatter: function () {
            const v = this.value
            if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
            if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K'
            return v
          }
        }
      }
    },
    tooltip: { shared: true },
    series: [
      {
        type: 'column',
        name: 'Permanent Employees',
        data: data.map(d => d.permEmployees),
        yAxis: 0
      },
      {
        type: 'column',
        name: 'Temporary Employees',
        data: data.map(d => d.tempEmployees),
        yAxis: 0
      },
      {
        type: 'spline',
        name: 'Revenue',
        data: data.map(d => d.revenue),
        yAxis: 1
      }
    ]
  }

  const revenueChartOptions = {
    title: { text: 'Monthly Revenue Trend' },
    xAxis: { categories: data.map(d => d.month) },
    yAxis: {
      title: { text: 'Revenue (ZAR)' },
      labels: {
        formatter: function () {
          const y = this.y
          if (y >= 1_000_000) return (y / 1_000_000).toFixed(1) + 'M'
          if (y >= 1_000) return (y / 1_000).toFixed(1) + 'K'
          return y
        }
      }
    },
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          formatter: function () {
            const y = this.y
            if (y >= 1_000_000) return (y / 1_000_000).toFixed(1) + 'M'
            if (y >= 1_000) return (y / 1_000).toFixed(1) + 'K'
            return y
          }
        }
      }
    },
    series: [
      { name: 'Revenue', data: data.map(d => d.revenue), type: 'spline' }
    ]
  }

  const applicationPieOptions = {
    chart: { type: 'pie' },
    title: { text: 'Application Status Distribution' },
    legend: {
      enabled: true, // ✅ Enable legend
      layout: 'vertical',
      align: 'right',
      verticalAlign: 'middle'
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
        name: 'Applications',
        colorByPoint: true,
        showInLegend: true, // ✅ required to show legend for pie
        data: [
          { name: 'Accepted', y: applicationStats.accepted },
          { name: 'Pending', y: applicationStats.pending },
          { name: 'Declined', y: applicationStats.declined }
        ]
      }
    ]
  }

  return (
    <>
      <Helmet>
        <title>My Analytics | Smart Incubation Platform</title>
        <meta
          name='description'
          content='Track your revenue, staff growth, and application success over time.'
        />
      </Helmet>
      <Layout>
        <Content style={{ padding: '24px' }}>
          <Row justify='space-between' align='middle'>
            <Col>
              <Title level={3}>📊 My Analytics</Title>
            </Col>
          </Row>

          {loading ? (
            <Spin size='large' />
          ) : (
            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <Card
                  title='Revenue Chart'
                  extra={
                    <Button
                      type='link'
                      onClick={() => {
                        setExpandedChart('revenue')
                        setModalVisible(true)
                      }}
                    >
                      Expand
                    </Button>
                  }
                >
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={revenueChartOptions}
                  />
                </Card>
              </Col>

              <Col xs={24} md={12}>
                <Card
                  title='Application Status'
                  extra={
                    <Button
                      type='link'
                      onClick={() => {
                        setExpandedChart('applications')
                        setModalVisible(true)
                      }}
                    >
                      Expand
                    </Button>
                  }
                >
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={applicationPieOptions}
                  />
                </Card>
              </Col>

              <Col span={24}>
                <Card
                  title='Headcount vs Revenue'
                  extra={
                    <Button
                      type='link'
                      onClick={() => {
                        setExpandedChart('headcount')
                        setModalVisible(true)
                      }}
                    >
                      Expand
                    </Button>
                  }
                >
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={headcountVsRevenueOptions}
                  />
                </Card>
              </Col>

              <Col span={24}>
                <Card>
                  <Title level={5}>
                    Acceptance Rate:{' '}
                    {applicationStats.total > 0
                      ? `${Math.round(
                          (applicationStats.accepted / applicationStats.total) *
                            100
                        )}%`
                      : 'N/A'}
                  </Title>
                </Card>
              </Col>
            </Row>
          )}
        </Content>
      </Layout>
      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        title={`Expanded View: ${
          expandedChart === 'revenue'
            ? 'Revenue Chart'
            : expandedChart === 'headcount'
            ? 'Headcount vs Revenue'
            : 'Application Status'
        }`}
        width={900}
      >
        <div style={{ marginBottom: 16 }}>
          <Select
            value={selectedYear}
            onChange={value => setSelectedYear(value)}
            options={[
              {
                label: dayjs().year().toString(),
                value: dayjs().year().toString()
              },
              {
                label: (dayjs().year() - 1).toString(),
                value: (dayjs().year() - 1).toString()
              }
            ]}
            style={{ width: 200 }}
          />
        </div>

        {expandedChart === 'revenue' && (
          <HighchartsReact
            highcharts={Highcharts}
            options={revenueChartOptions}
          />
        )}
        {expandedChart === 'headcount' && (
          <HighchartsReact
            highcharts={Highcharts}
            options={headcountVsRevenueOptions}
          />
        )}
        {expandedChart === 'applications' && (
          <HighchartsReact
            highcharts={Highcharts}
            options={applicationPieOptions}
          />
        )}
      </Modal>
    </>
  )
}

export default IncubateeAnalytics
