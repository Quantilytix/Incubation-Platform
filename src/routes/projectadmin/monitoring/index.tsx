import React, { useState } from 'react'
import { Card, Select, Typography, Row, Col, Button, Modal } from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

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
      series: Object.entries(companyMonthly)
        .slice(0, topN)
        .map(([name, data]) => ({ name, data }))
    },
    'Income vs Expense (Companies)': {
      chart: { type: 'column' },
      title: { text: 'Income vs Expense per Company' },
      xAxis: { categories: companies.slice(0, topN) },
      yAxis: { title: { text: 'Rands (R)' } },
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
      series: categoriesByCompany.map(cat => ({
        name: cat.name,
        data: cat.data.slice(0, topN)
      }))
    },
    'Sector Counts per Company': {
      chart: { type: 'column' },
      title: { text: 'Sector Engagement by Company' },
      xAxis: { categories: companies.slice(0, topN) },
      yAxis: { title: { text: 'Sectors' } },
      series: [
        { name: 'Sector Count', data: sectorCountsByCompany.slice(0, topN) }
      ]
    }
  }

  const openExpand = (chart: Highcharts.Options) => {
    setExpandedChart(chart)
    setExpandedVisible(true)
  }

  return (
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
                <Button onClick={() => openExpand(companyCharts[companyChart])}>
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
  )
}

export default MonitoringEvaluationEvaluation
