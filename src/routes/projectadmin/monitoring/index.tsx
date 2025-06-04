import React, { useState, useEffect } from 'react'
import { Card, Select, Typography, Row, Col, Button, Modal, Spin } from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { Helmet } from 'react-helmet'
import { auth, db } from '@/firebase'
import { doc, getDoc } from 'firebase/firestore'

import('highcharts/modules/heatmap').then(HeatmapModule => {
  HeatmapModule.default(Highcharts)
})

const { Title } = Typography
const { Option } = Select

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

const defaultInterventionCharts = (empty = false) => ({
  'Interventions per Month': {
    chart: { type: 'column' },
    title: { text: 'Interventions per Month' },
    xAxis: { categories: months },
    yAxis: { title: { text: 'Count' } },
    plotOptions: {
      column: { dataLabels: { enabled: true, format: '{point.y}' } }
    },
    series: [{ name: 'Interventions', data: empty ? [] : [40, 50, 30, 60] }]
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
      { name: 'Income', data: empty ? [] : [30000, 45000, 25000] },
      { name: 'Expense', data: empty ? [] : [18000, 22000, 14000] }
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
    series: [{ name: 'Sector Count', data: empty ? [] : [25, 40, 30] }]
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
        data: empty
          ? []
          : categories.map((cat, i) => ({
              name: cat,
              y: [50, 35, 20][i]
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
        data: empty
          ? []
          : [
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
      { name: 'Revenue', data: empty ? [] : [60000, 55000, 48000, 39000, 32000] },
      { name: 'Permanent Workers', data: empty ? [] : [30, 25, 20, 15, 10] },
      { name: 'Temporary Workers', data: empty ? [] : [15, 10, 8, 5, 4] }
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
        data: empty ? [] : [1200, 1300, 1250, 1500, 1280],
        color: '#722ed1'
      }
    ]
  }
})

const defaultCompanyCharts = (empty = false) => ({
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
    series: empty
      ? []
      : [
          { name: 'BrightTech', data: [10, 12, 8, 14] },
          { name: 'GreenFarms', data: [8, 9, 6, 10] },
          { name: 'AgroWave', data: [7, 11, 5, 9] },
          { name: 'FinReach', data: [6, 5, 7, 4] },
          { name: 'EduLift', data: [5, 4, 3, 6] }
        ]
  },
  'Income vs Expense (Companies)': {
    chart: { type: 'column' },
    title: { text: 'Income vs Expense per Company' },
    xAxis: { categories: companies },
    yAxis: { title: { text: 'Rands (R)' } },
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          format: '{point.y}'
        }
      }
    },
    series: empty
      ? []
      : [
          { name: 'Income', data: [60000, 55000, 48000, 39000, 32000] },
          { name: 'Expense', data: [30000, 25000, 23000, 18000, 15000] }
        ]
  },
  'Categories per Company': {
    chart: { type: 'bar' },
    title: { text: 'Intervention Categories per Company' },
    xAxis: { categories: companies },
    yAxis: { title: { text: 'Category Count' } },
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          format: '{point.y}'
        }
      }
    },
    series: empty
      ? []
      : [
          { name: 'Training', data: [4, 6, 5, 2, 1] },
          { name: 'Funding', data: [3, 2, 1, 1, 0] },
          { name: 'Mentoring', data: [2, 3, 3, 1, 2] }
        ]
  },
  'Sector Counts per Company': {
    chart: { type: 'column' },
    title: { text: 'Sector Engagement by Company' },
    xAxis: { categories: companies },
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          format: '{point.y}'
        }
      }
    },
    yAxis: { title: { text: 'Sectors' } },
    series: empty ? [] : [{ name: 'Sector Count', data: [4, 5, 3, 2, 1] }]
  }
})

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

const MonitoringEvaluationEvaluation = () => {
  // Company logic
  const [companyCode, setCompanyCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCompanyCode = async () => {
      setLoading(true)
      try {
        const user = auth.currentUser
        if (!user) {
          setCompanyCode(null)
          setLoading(false)
          return
        }
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        if (!userSnap.exists()) {
          setCompanyCode(null)
          setLoading(false)
          return
        }
        const code = userSnap.data().companyCode
        setCompanyCode(code)
      } catch (err) {
        setCompanyCode(null)
      }
      setLoading(false)
    }
    fetchCompanyCode()
  }, [])

  // Dashboard state and data
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

  // Use empty chart data for non-QTX
  const isQTX = companyCode === 'QTX'
  const interventionCharts = isQTX ? defaultInterventionCharts(false) : defaultInterventionCharts(true)
  const companyCharts = isQTX ? defaultCompanyCharts(false) : defaultCompanyCharts(true)

  // Heatmap: use empty data if not QTX
  const challengeFrequency: [number, number, number][] = []
  if (isQTX) {
    months.forEach((month, y) => {
      challengeCategories.forEach((challenge, x) => {
        const frequency = Math.floor(Math.random() * 20)
        challengeFrequency.push([x, y, frequency])
      })
    })
  }

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
        [0, '#00A651'],
        [0.5, '#FFC107'],
        [1, '#D32F2F']
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
        data: isQTX ? challengeFrequency : [],
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
      {loading ? (
        <div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin tip="Loading company info..." size="large" />
        </div>
      ) : (
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
      )}
    </>
  )
}

export default MonitoringEvaluationEvaluation
