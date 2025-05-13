import React, { useState } from 'react'
import { Card, Select, Typography, Row, Col, Button, Modal } from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { Helmet } from 'react-helmet'

import('highcharts/modules/heatmap').then(HeatmapModule => {
  HeatmapModule.default(Highcharts)
})

const { Title } = Typography
const { Option } = Select

const MonitoringEvaluationEvaluation = () => {
  const [gender, setGender] = useState('All')
  const [ageGroup, setAgeGroup] = useState('All')
  const [topN, setTopN] = useState(5)
  const [interventionChart, setInterventionChart] = useState(
    'Interventions per Month'
  )
  const [companyChart, setCompanyChart] = useState(
    'Interventions per Month (Companies)'
  )
  const [expandedChart, setExpandedChart] = useState<Highcharts.Options | null>(
    null
  )
  const [expandedVisible, setExpandedVisible] = useState(false)

  const months = ['Jan', 'Feb', 'Mar', 'Apr']
  const categories = ['Training', 'Funding', 'Mentoring']
  const sectors = ['Agriculture', 'Tech', 'Manufacturing']
  const companies = [
    'BrightTech',
    'GreenFarms',
    'AgroWave',
    'FinReach',
    'EduLift'
  ]

  const interventionsByMonth = [40, 50, 30, 60]
  const incomePerType = [30000, 45000, 25000]
  const expensePerType = [18000, 22000, 14000]
  const interventionsBySector = [25, 40, 30]
  const interventionsByCategory = [50, 35, 20]
  const revenue = [60000, 55000, 48000, 39000, 32000]
  const permanent = [30, 25, 20, 15, 10]
  const temporary = [15, 10, 8, 5, 4]
  const productivity = revenue.map(
    (rev, i) => rev / (permanent[i] + temporary[i])
  )

  const companyMonthly = {
    BrightTech: [10, 12, 8, 14],
    GreenFarms: [8, 9, 6, 10],
    AgroWave: [7, 11, 5, 9],
    FinReach: [6, 5, 7, 4],
    EduLift: [5, 4, 3, 6]
  }

  const incomeByCompany = revenue
  const expenseByCompany = [30000, 25000, 23000, 18000, 15000]
  const categoriesByCompany = [
    { name: 'Training', data: [4, 6, 5, 2, 1] },
    { name: 'Funding', data: [3, 2, 1, 1, 0] },
    { name: 'Mentoring', data: [2, 3, 3, 1, 2] }
  ]
  const sectorCountsByCompany = [4, 5, 3, 2, 1]

  const interventionCharts: Record<string, Highcharts.Options> = {
    'Interventions per Month': {
      chart: { type: 'column' },
      title: { text: 'Interventions per Month' },
      xAxis: { categories: months },
      yAxis: { title: { text: 'Count' } },
      plotOptions: {
        column: { dataLabels: { enabled: true, format: '{point.y}' } }
      },
      series: [{ name: 'Interventions', data: interventionsByMonth }]
    },
    'Income vs Expense (Type)': {
      chart: { type: 'column' },
      title: { text: 'Income vs Expense per Type' },
      xAxis: { categories },
      yAxis: { title: { text: 'Rands (R)' } },
      plotOptions: {
        column: { dataLabels: { enabled: true, format: 'R{point.y}' } }
      },
      series: [
        { name: 'Income', data: incomePerType },
        { name: 'Expense', data: expensePerType }
      ]
    },
    'Interventions by Sector': {
      chart: { type: 'bar' },
      title: { text: 'Interventions by Sector' },
      xAxis: { categories: sectors },
      yAxis: { title: { text: 'Total Interventions' } },
      plotOptions: {
        bar: { dataLabels: { enabled: true, format: '{point.y}' } }
      },
      series: [{ name: 'Sector Count', data: interventionsBySector }]
    },
    'Intervention Categories': {
      chart: { type: 'pie' },
      title: { text: 'Intervention Categories' },
      plotOptions: {
        pie: {
          dataLabels: { enabled: true, format: '{point.name}: {point.y}' }
        }
      },
      series: [
        {
          name: 'Categories',
          colorByPoint: true,
          data: categories.map((cat, i) => ({
            name: cat,
            y: interventionsByCategory[i]
          }))
        }
      ]
    },
    'Compliance Overview': {
      chart: { type: 'pie' },
      title: { text: 'Compliance Status Overview' },
      plotOptions: {
        pie: {
          dataLabels: { enabled: true, format: '{point.name}: {point.y}' }
        }
      },
      series: [
        {
          name: 'Companies',
          colorByPoint: true,
          data: [
            { name: 'Valid', y: 120 },
            { name: 'Expiring Soon', y: 30 },
            { name: 'Expired', y: 20 },
            { name: 'Missing', y: 10 },
            { name: 'Pending Review', y: 15 }
          ]
        }
      ]
    },
    'Revenue vs Workers': {
      chart: { type: 'column' },
      title: { text: 'Revenue vs Workers (Permanent & Temporary)' },
      xAxis: { categories: companies },
      yAxis: { title: { text: 'Values' } },
      plotOptions: {
        column: { dataLabels: { enabled: true, format: '{point.y}' } }
      },
      series: [
        { name: 'Revenue', data: revenue },
        { name: 'Permanent Workers', data: permanent },
        { name: 'Temporary Workers', data: temporary }
      ]
    },
    'Revenue vs Productivity': {
      chart: { type: 'line' },
      title: { text: 'Revenue per Worker (Productivity)' },
      xAxis: { categories: companies },
      yAxis: { title: { text: 'Rands per Headcount' } },
      plotOptions: {
        line: { dataLabels: { enabled: true, format: 'R {point.y:.0f}' } }
      },
      series: [
        {
          name: 'Productivity',
          data: productivity,
          color: '#722ed1'
        }
      ]
    }
  }

  const companyCharts: Record<string, Highcharts.Options> = {
    'Interventions per Month (Companies)': {
      chart: { type: 'line' },
      title: { text: 'Monthly Interventions by Company' },
      xAxis: { categories: months },
      yAxis: { title: { text: 'Interventions' } },
      plotOptions: {
        series: {
          dataLabels: {
            enabled: true,
            format: '{point.y}'
          }
        }
      },
      series: Object.entries(companyMonthly)
        .slice(0, topN)
        .map(([name, data]) => ({ name, data }))
    },
    'Income vs Expense (Companies)': {
      chart: { type: 'column' },
      title: { text: 'Income vs Expense per Company' },
      xAxis: { categories: companies.slice(0, topN) },
      yAxis: { title: { text: 'Rands (R)' } },
      plotOptions: {
        series: {
          dataLabels: {
            enabled: true,
            format: '{point.y}'
          }
        }
      },
      series: [
        { name: 'Income', data: incomeByCompany.slice(0, topN) },
        { name: 'Expense', data: expenseByCompany.slice(0, topN) }
      ]
    },
    'Categories per Company': {
      chart: { type: 'bar' },
      title: { text: 'Intervention Categories per Company' },
      xAxis: { categories: companies.slice(0, topN) },
      yAxis: { title: { text: 'Category Count' } },
      plotOptions: {
        series: {
          dataLabels: {
            enabled: true,
            format: '{point.y}'
          }
        }
      },
      series: categoriesByCompany.map(cat => ({
        name: cat.name,
        data: cat.data.slice(0, topN)
      }))
    },
    'Sector Counts per Company': {
      chart: { type: 'column' },
      title: { text: 'Sector Engagement by Company' },
      xAxis: { categories: companies.slice(0, topN) },
      plotOptions: {
        series: {
          dataLabels: {
            enabled: true,
            format: '{point.y}'
          }
        }
      },
      yAxis: { title: { text: 'Sectors' } },
      series: [
        { name: 'Sector Count', data: sectorCountsByCompany.slice(0, topN) }
      ]
    }
  }

  const challengeCategories = [
    'Access to Finance',
    'Market Access',
    'Regulatory Hurdles',
    'Lack of Equipment',
    'Skills Gap',
    'Infrastructure',
    'Mentorship',
    'Digital Presence',
    'Product Development'
  ]

  const challengeFrequency: [number, number, number][] = []

  months.forEach((month, y) => {
    challengeCategories.forEach((challenge, x) => {
      const frequency = Math.floor(Math.random() * 20) // random dummy values
      challengeFrequency.push([x, y, frequency])
    })
  })

  const challengeHeatmapOptions: Highcharts.Options = {
    chart: { type: 'heatmap' },
    title: { text: 'Challenge Frequency by Month' },
    xAxis: {
      categories: challengeCategories,
      title: { text: 'Challenges' }
    },
    yAxis: {
      categories: months,
      title: { text: 'Month' },
      reversed: true
    },
    colorAxis: {
      min: 0,
      max: 20,
      stops: [
        [0, '#00A651'], // Green (Low frequency)
        [0.5, '#FFC107'], // Amber (Moderate frequency)
        [1, '#D32F2F'] // Red (High frequency)
      ]
    },
    legend: {
      align: 'right',
      layout: 'vertical',
      margin: 0,
      verticalAlign: 'top',
      y: 25,
      symbolHeight: 280
    },
    tooltip: {
      formatter: function () {
        return `<b>${months[this.point.y]}</b><br/>${
          challengeCategories[this.point.x]
        }: <b>${this.point.value}</b>`
      }
    },
    series: [
      {
        name: 'Challenge Frequency',
        borderWidth: 1,
        type: 'heatmap',
        data: challengeFrequency,
        dataLabels: {
          enabled: true,
          color: '#000000'
        }
      }
    ]
  }

  const openExpand = (chart: Highcharts.Options) => {
    setExpandedChart(chart)
    setExpandedVisible(true)
  }

  return (
    <>
      <Helmet>
        <title>
          Monitoring & Evaluation Dashboard | Smart Incubation Platform
        </title>
        <meta
          name='description'
          content='Analyze intervention trends, company-level impacts, compliance, and demographic engagement across the incubation platform.'
        />
      </Helmet>
      <div style={{ padding: 24 }}>
        <Title level={3}>📈 Monitoring & Evaluation Dashboard</Title>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col>
            <Select value={gender} onChange={setGender} style={{ width: 120 }}>
              <Option value='All'>All</Option>
              <Option value='Male'>Male</Option>
              <Option value='Female'>Female</Option>
            </Select>
          </Col>
          <Col>
            <Select value={ageGroup} onChange={setAgeGroup}>
              <Option value='All'>All Ages</Option>
              <Option value='Youth'>Youth</Option>
              <Option value='Adult'>Adult</Option>
              <Option value='Senior'>Senior</Option>
            </Select>
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <Card
              title='📊 Interventions Overview'
              extra={
                <>
                  <Select
                    value={interventionChart}
                    onChange={setInterventionChart}
                    style={{ width: 250, marginRight: 12 }}
                  >
                    {Object.keys(interventionCharts).map(key => (
                      <Option key={key} value={key}>
                        {key}
                      </Option>
                    ))}
                  </Select>
                  <Button
                    onClick={() =>
                      openExpand(interventionCharts[interventionChart])
                    }
                  >
                    Expand
                  </Button>
                </>
              }
            >
              <HighchartsReact
                highcharts={Highcharts}
                options={interventionCharts[interventionChart]}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title='🏢 Company-Level Breakdowns'
              extra={
                <>
                  <Select
                    value={companyChart}
                    onChange={setCompanyChart}
                    style={{ width: 250, marginRight: 12 }}
                  >
                    {Object.keys(companyCharts).map(key => (
                      <Option key={key} value={key}>
                        {key}
                      </Option>
                    ))}
                  </Select>
                  <Button
                    onClick={() => openExpand(companyCharts[companyChart])}
                  >
                    Expand
                  </Button>
                </>
              }
            >
              <Select
                value={topN}
                onChange={setTopN}
                style={{ marginBottom: 16, width: 120 }}
              >
                {[5, 3, 10].map(n => (
                  <Option key={n} value={n}>
                    Top {n}
                  </Option>
                ))}
              </Select>

              <HighchartsReact
                highcharts={Highcharts}
                options={companyCharts[companyChart]}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]} style={{ marginTop: 32 }}>
          <Col span={24}>
            <Card title='Challenge Frequency Heatmap'>
              <HighchartsReact
                highcharts={Highcharts}
                options={challengeHeatmapOptions}
              />
            </Card>
          </Col>
        </Row>

        <Modal
          open={expandedVisible}
          onCancel={() => setExpandedVisible(false)}
          width='80%'
          footer={null}
        >
          {expandedChart && (
            <HighchartsReact highcharts={Highcharts} options={expandedChart} />
          )}
        </Modal>
      </div>
    </>
  )
}

export default MonitoringEvaluationEvaluation
