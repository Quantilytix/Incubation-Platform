import React, { useEffect, useState } from 'react'
import {
  Layout,
  Typography,
  Card,
  Row,
  Col,
  Spin,
  message,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Divider,
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
import dayjs from 'dayjs'
import { useForm } from 'antd/es/form/Form'

const { Title } = Typography
const { Content } = Layout

const fallbackMonths = [
  'November',
  'December',
  'January',
  'February',
  'March',
  'April'
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

  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser
      if (!user) return

      try {
        const participantSnap = await getDocs(
          query(
            collection(db, 'participants'),
            where('email', '==', user.email)
          )
        )

        if (!participantSnap.empty) {
          const docData = participantSnap.docs[0].data()
          const parsedData = fallbackMonths.map(month => ({
            month,
            revenue: Number(docData[`revenue${month}`]) || 0,
            permEmployees: Number(docData[`empPerm${month}`]) || 0,
            tempEmployees: Number(docData[`empTemp${month}`]) || 0
          }))
          setData(parsedData)
        }

        // Application Status
        let accepted = 0,
          pending = 0,
          declined = 0
        participantSnap.forEach(doc => {
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
      } catch (err) {
        message.error('Failed to load analytics data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const headcountVsRevenueOptions = {
    chart: { zoomType: 'xy' },
    title: { text: 'Headcount vs Revenue' },
    xAxis: [{ categories: data.map(d => d.month), crosshair: true }],
    yAxis: [
      { title: { text: 'Employees' } },
      {
        title: { text: 'Revenue (ZAR)' },
        opposite: true
      }
    ],
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          format: '{point.y}'
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
    yAxis: { title: { text: 'Revenue (ZAR)' } },
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          format: '{point.y}'
        }
      }
    },
    series: [{ name: 'Revenue', data: data.map(d => d.revenue), type: 'line' }]
  }

  const applicationPieOptions = {
    chart: { type: 'pie' },
    title: { text: 'Application Status Distribution' },
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
        data: [
          { name: 'Accepted', y: applicationStats.accepted },
          { name: 'Pending', y: applicationStats.pending },
          { name: 'Declined', y: applicationStats.declined }
        ]
      }
    ]
  }

  return (
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
              <Card title='Revenue Chart'>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={revenueChartOptions}
                />
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card title='Application Status'>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={applicationPieOptions}
                />
              </Card>
            </Col>

            <Col span={24}>
              <Card title='Headcount vs Revenue'>
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
  )
}

export default IncubateeAnalytics
