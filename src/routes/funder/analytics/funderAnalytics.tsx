import React from 'react'
import { Card, Typography, Row, Col, Statistic } from 'antd'
import {
  BarChartOutlined,
  TrophyOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

const { Title } = Typography

export const FunderAnalytics: React.FC = () => {
  const metrics = [
    {
      icon: <BarChartOutlined style={{ color: '#1890ff' }} />,
      title: 'Avg. Monthly Interventions',
      value: 47
    },
    {
      icon: <TrophyOutlined style={{ color: '#faad14' }} />,
      title: 'Trending Intervention',
      value: 'Marketing and Sales'
    },
    {
      icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      title: 'Overall Participation',
      value: '87%'
    }
  ]

  // 📈 Monthly Interventions Completed
  const interventionTrendOptions: Highcharts.Options = {
    title: { text: 'Monthly Interventions Completed' },
    xAxis: {
      categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      title: { text: 'Month' }
    },
    yAxis: {
      min: 0,
      title: { text: 'Interventions' }
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
        name: 'Interventions Completed',
        type: 'line',
        data: [30, 45, 50, 55, 60, 35]
      }
    ]
  }

  // 📊 Interventions by Name (Individual bars)
  const allInterventions = [
    'Marketing and Sales',
    'Financial Management & Systems',
    'Regulatory Compliance',
    'Business Mentorship',
    'Technical Training & Webinars',
    'Operational Support',
    'Business Diagnostics'
  ]

  const completionsData = [12, 8, 15, 6, 7, 4, 9] // dummy values

  const interventionsByNameOptions: Highcharts.Options = {
    chart: { type: 'column' },
    title: { text: 'Interventions by Completion Count' },
    xAxis: {
      categories: allInterventions,
      title: { text: 'Interventions' },
      labels: { style: { fontSize: '10px' }, rotation: -45 }
    },
    yAxis: {
      min: 0,
      title: { text: 'Completions' }
    },
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          format: '{point.y}'
        }
      }
    },
    tooltip: {
      pointFormat: 'Completed <b>{point.y}</b> times'
    },
    series: [
      {
        name: 'Completions',
        type: 'column',
        data: completionsData
      }
    ]
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        Intervention Performance Insights
      </Title>

      {/* Metrics */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        {metrics.map((metric, index) => (
          <Col xs={24} md={8} key={index}>
            <Card>
              <Statistic
                title={
                  <span
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {metric.icon}
                    {metric.title}
                  </span>
                }
                value={metric.value}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card>
            <HighchartsReact
              highcharts={Highcharts}
              options={interventionTrendOptions}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <HighchartsReact
              highcharts={Highcharts}
              options={interventionsByNameOptions}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
