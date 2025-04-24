import React from 'react'
import { Typography, Row, Col, Card } from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

const { Title } = Typography

export const ProjectAnalytics: React.FC = () => {
  // Dummy SME data
  const smes = [
    {
      name: 'BrightTech',
      interventions: 5,
      revenue: 150000,
      headCount: 12,
      stage: 'Growth'
    },
    {
      name: 'Green Farms',
      interventions: 3,
      revenue: 80000,
      headCount: 8,
      stage: 'Startup'
    },
    {
      name: 'EduNext',
      interventions: 4,
      revenue: 120000,
      headCount: 10,
      stage: 'Maturity'
    }
  ]

  // Grouped stage data
  const stageCounts = smes.reduce<Record<string, number>>((acc, sme) => {
    acc[sme.stage] = (acc[sme.stage] || 0) + 1
    return acc
  }, {})

  // 📊 Interventions Bar Chart
  const interventionsChart: Highcharts.Options = {
    chart: { type: 'column' },
    title: { text: 'Interventions per SME' },
    xAxis: { categories: smes.map(s => s.name) },
    yAxis: { title: { text: 'Interventions' } },
    series: [
      {
        name: 'Interventions',
        type: 'column',
        data: smes.map(s => s.interventions)
      }
    ]
  }

  // 💰 Revenue Chart
  const revenueChart: Highcharts.Options = {
    chart: { type: 'spline' },
    title: { text: 'Revenue by SME (R)' },
    xAxis: { categories: smes.map(s => s.name) },
    yAxis: {
      title: { text: 'Revenue (R)' },
      labels: {
        formatter: function () {
          return 'R' + Number(this.value).toLocaleString()
        }
      }
    },
    series: [
      {
        name: 'Revenue',
        type: 'spline', // ✅ Match chart type
        data: smes.map(s => s.revenue)
      }
    ]
  }

  // 👥 Head Count Chart
  const headCountChart: Highcharts.Options = {
    chart: { type: 'bar' },
    title: { text: 'Head Count per SME' },
    xAxis: { categories: smes.map(s => s.name) },
    yAxis: { title: { text: 'Head Count' } },
    series: [
      {
        name: 'Employees',
        type: 'bar',
        data: smes.map(s => s.headCount)
      }
    ]
  }

  // 📈 Life Cycle Stages
  const lifeCycleChart: Highcharts.Options = {
    chart: { type: 'pie' },
    title: { text: 'Life Cycle Stage Distribution' },
    series: [
      {
        name: 'SMEs',
        type: 'pie',
        data: Object.entries(stageCounts).map(([stage, count]) => ({
          name: stage,
          y: count
        }))
      }
    ]
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Project Analytics</Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card>
            <HighchartsReact
              highcharts={Highcharts}
              options={interventionsChart}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card>
            <HighchartsReact highcharts={Highcharts} options={revenueChart} />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card>
            <HighchartsReact highcharts={Highcharts} options={headCountChart} />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card>
            <HighchartsReact highcharts={Highcharts} options={lifeCycleChart} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
