import React, { useState } from 'react'
import { Card, Select, Typography, Row, Col } from 'antd'
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

  const companyMonthly = {
    BrightTech: [10, 12, 8, 14],
    GreenFarms: [8, 9, 6, 10],
    AgroWave: [7, 11, 5, 9],
    FinReach: [6, 5, 7, 4],
    EduLift: [5, 4, 3, 6]
  }

  const incomeByCompany = [60000, 55000, 48000, 39000, 32000]
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
      series: [{ name: 'Interventions', data: interventionsByMonth }]
    },
    'Income vs Expense (Type)': {
      chart: { type: 'column' },
      title: { text: 'Income vs Expense per Type' },
      xAxis: { categories },
      yAxis: { title: { text: 'Rands (R)' } },
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
      series: [{ name: 'Sector Count', data: interventionsBySector }]
    },
    'Intervention Categories': {
      chart: { type: 'pie' },
      title: { text: 'Intervention Categories' },
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

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card title='📊 Interventions Overview (Aggregated)'>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col>
                <Select value={gender} onChange={setGender}>
                  <Option value='All'>All Genders</Option>
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
              <Col>
                <Select
                  value={interventionChart}
                  onChange={setInterventionChart}
                  style={{ width: 250 }}
                >
                  {Object.keys(interventionCharts).map(key => (
                    <Option key={key} value={key}>
                      {key}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>

            <HighchartsReact
              highcharts={Highcharts}
              options={interventionCharts[interventionChart]}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card title='🏢 Company-Level Breakdowns'>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col>
                <Select value={topN} onChange={setTopN}>
                  {[5, 3, 10].map(n => (
                    <Option key={n} value={n}>
                      Top {n}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col>
                <Select
                  value={companyChart}
                  onChange={setCompanyChart}
                  style={{ width: 250 }}
                >
                  {Object.keys(companyCharts).map(key => (
                    <Option key={key} value={key}>
                      {key}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>

            <HighchartsReact
              highcharts={Highcharts}
              options={companyCharts[companyChart]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default MonitoringEvaluationEvaluation
