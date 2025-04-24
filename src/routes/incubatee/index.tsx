import React from 'react'
import { Row, Col, Card, Typography, Statistic, Tag, Button, List } from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import {
  RiseOutlined,
  SmileOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title } = Typography

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May']

const revenue = [15000, 18000, 20000, 22000, 21000]
const headPerm = [30, 32, 35, 37, 40]
const headTemp = [10, 12, 15, 14, 13]
const participation = [88, 90, 93, 95, 92]
const productivity = [1.2, 1.3, 1.5, 1.6, 1.7]
const outstandingDocs = [5, 4, 3, 2, 1]
const avgRevenue = [12000, 12500, 13000, 13500, 14000]

const totalVsAvgRevenueChart: Highcharts.Options = {
  chart: { type: 'spline' },
  title: { text: 'Total Revenue vs Avg Revenue' },
  xAxis: {
    categories: months,
    title: { text: 'Month' }
  },
  yAxis: {
    title: { text: 'Revenue (R)' },
    labels: {
      formatter: function () {
        return 'R' + Number(this.value).toLocaleString()
      }
    }
  },
  tooltip: { shared: true },
  series: [
    {
      name: 'Total Revenue',
      type: 'spline',
      data: revenue,
      color: '#52c41a'
    },
    {
      name: 'Avg Revenue',
      type: 'spline',
      data: avgRevenue,
      color: '#faad14'
    }
  ]
}

const notifications = [
  { id: 1, message: 'New mentoring session added for Smart Incubation.' },
  { id: 2, message: 'Performance benchmark updated for your cohort.' }
]

const pendingInterventions = [
  { id: 1, title: 'Financial Literacy Training', date: '2024-04-01' },
  { id: 2, title: 'Product Development Workshop', date: '2024-04-10' }
]

// 🔹 Revenue + Workers Mixed Chart
const revenueWorkersChart: Highcharts.Options = {
  chart: { zoomType: 'xy' },
  title: { text: 'Revenue vs Workforce' },
  xAxis: [{ categories: months }],
  yAxis: [
    {
      title: { text: 'Revenue (R)' },
      labels: {
        formatter: function () {
          return 'R' + Number(this.value).toLocaleString()
        }
      }
    },
    {
      title: { text: 'Number of Workers' },
      opposite: true
    }
  ],
  tooltip: { shared: true },
  series: [
    {
      name: 'Permanent Workers',
      type: 'column',
      data: headPerm,
      yAxis: 1
    },
    {
      name: 'Temporary Workers',
      type: 'column',
      data: headTemp,
      yAxis: 1
    },
    {
      name: 'Revenue',
      type: 'spline',
      data: revenue,
      tooltip: { valuePrefix: 'R' }
    }
  ]
}

// 🔹 Headcount Trend Line
const headcountTrendChart: Highcharts.Options = {
  chart: { type: 'line' },
  title: { text: 'Monthly Headcount (Permanent vs Temporary)' },
  xAxis: { categories: months },
  yAxis: { title: { text: 'Employees' } },
  series: [
    { name: 'Permanent', type: 'line', data: headPerm },
    { name: 'Temporary', type: 'line', data: headTemp }
  ]
}

export const IncubateeDashboard: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Incubatee Dashboard</Title>

      <Row gutter={[24, 24]}>
        {/* KPI Cards */}
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Participation Rate'
              value={`${participation[participation.length - 1]}%`}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Outstanding Documents'
              value={outstandingDocs[outstandingDocs.length - 1]}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Productivity Ratio'
              value={productivity[productivity.length - 1]}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        {/* Pending Interventions */}
        <Col xs={24} lg={16}>
          <Card title='Pending Interventions'>
            <List
              itemLayout='horizontal'
              dataSource={pendingInterventions}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button type='primary' key='accept'>
                      Accept
                    </Button>,
                    <Button danger key='decline'>
                      Decline
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={item.title}
                    description={`Scheduled Date: ${item.date}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Notifications + Quick Actions */}
        <Col xs={24} lg={8}>
          <Card title='Notifications'>
            {notifications.map(note => (
              <Tag color='blue' key={note.id} style={{ marginBottom: 8 }}>
                {note.message}
              </Tag>
            ))}
          </Card>
        </Col>

        {/* Chart: Revenue vs Workforce */}
        <Col span={24}>
          <Card>
            <HighchartsReact
              highcharts={Highcharts}
              options={revenueWorkersChart}
            />
          </Card>
        </Col>

        {/* Chart: Total vs Avg Revenue */}
        <Col span={24}>
          <Card>
            <HighchartsReact
              highcharts={Highcharts}
              options={totalVsAvgRevenueChart}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
