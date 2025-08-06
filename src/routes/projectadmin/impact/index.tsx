import React, { useState, useMemo, useEffect } from 'react'
import { Card, Typography, Row, Col, Form, InputNumber, Spin } from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { Helmet } from 'react-helmet'
import { auth, db } from '@/firebase'
import { doc, getDoc } from 'firebase/firestore'

const { Title } = Typography

const rawInterventions = [
  { name: 'Website Development', weightByMonth: [80, 85, 90, 92] },
  { name: 'CRM Setup', weightByMonth: [60, 65, 75, 78] },
  { name: 'Mentorship Sessions', weightByMonth: [88, 89, 91, 94] },
  { name: 'Financial Literacy', weightByMonth: [55, 60, 68, 70] },
  { name: 'Branding & Logo', weightByMonth: [-10, -5, 5, 12] },
  { name: 'Compliance Training', weightByMonth: [70, 72, -15, 78] },
  { name: 'Strategic Planning', weightByMonth: [83, 84, 86, 88] },
  { name: 'Workflow Tools', weightByMonth: [-30, -22, -10, 5] },
  { name: 'Legal Structuring', weightByMonth: [10, 15, 5, -8] }
]

export const ImpactAnalysisForm: React.FC = () => {
  const [topN, setTopN] = useState(5)
  const [lagMonths, setLagMonths] = useState(0)
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
        // setCompanyCode(userSnap.data().companyCode)
        setCompanyCode('QTX')
      } catch {
        setCompanyCode(null)
      }
      setLoading(false)
    }
    fetchCompanyCode()
  }, [])

  // If not QTX, provide empty data for the chart
  const chartData = useMemo(() => {
    if (companyCode !== 'QTX') {
      // Provide empty chart
      return []
    }
    const adjusted = rawInterventions.map(intervention => ({
      name: intervention.name,
      value:
        intervention.weightByMonth[lagMonths] ??
        intervention.weightByMonth.at(-1) ??
        0
    }))

    return adjusted
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, topN)
  }, [topN, lagMonths, companyCode])

  const chartOptions: Highcharts.Options = {
    chart: { type: 'bar' },
    title: {
      text: `Top ${topN} Interventions (Lag: ${lagMonths} month${
        lagMonths !== 1 ? 's' : ''
      })`
    },
    xAxis: {
      categories: chartData.map(i => i.name),
      title: { text: null }
    },
    yAxis: {
      min: chartData.length ? Math.min(...chartData.map(i => i.value)) - 10 : 0,
      max: chartData.length
        ? Math.max(...chartData.map(i => i.value)) + 10
        : 10,
      title: { text: 'Impact Weight (%)', align: 'high' },
      plotLines: [{ value: 0, width: 1, color: '#999' }]
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
      formatter: function () {
        // @ts-ignore
        return `<strong>${this.key}</strong><br/>Impact: <b>${this.y}%</b>`
      }
    },
    series: [
      {
        name: 'Impact Weight',
        type: 'bar',
        data: chartData.map(i => i.value),
        colorByPoint: true
      }
    ]
  }

  return (
    <>
      <Helmet>
        <title>Intervention Impact Ranking | Smart Incubation Platform</title>
        <meta
          name='description'
          content='Analyze and rank the impact of interventions based on participation weight and lag-adjusted influence.'
        />
      </Helmet>
      {loading ? (
        <div
          style={{
            minHeight: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Spin tip='Loading company info...' size='large' />
        </div>
      ) : (
        <div style={{ padding: 24 }}>
          <Title level={3}>Intervention Impact Ranking</Title>
          <Card style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item label='Top N Interventions'>
                  <InputNumber
                    min={1}
                    max={rawInterventions.length}
                    value={topN}
                    onChange={val => setTopN(val || 5)}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label='Lagging (months)'>
                  <InputNumber
                    min={0}
                    max={12}
                    value={lagMonths}
                    onChange={val => setLagMonths(val || 0)}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          <Card>
            <HighchartsReact highcharts={Highcharts} options={chartOptions} />
          </Card>
        </div>
      )}
    </>
  )
}

export default ImpactAnalysisForm
