import React, { useEffect, useState } from 'react'
import { Typography, Row, Col, Card, Spin } from 'antd'
import { db } from '@/firebase'
import { collection, getDocs } from 'firebase/firestore'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

const { Title } = Typography

interface SME {
  id: string
  name: string
  interventions: number
  revenue: number
  headCount: number
  stage: string
}

export const ProjectAnalytics: React.FC = () => {
  const [smes, setSMEs] = useState<SME[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSMEs = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'participants'))
        const data: SME[] = snapshot.docs.map(doc => {
          const p = doc.data()

          const interventionsAssigned = p.interventions?.assigned?.length || 0
          const interventionsCompleted = p.interventions?.completed?.length || 0
          const totalInterventions =
            interventionsAssigned + interventionsCompleted

          const revenue = p.revenueHistory?.yearly?.['2023'] || 0
          const headCount = p.headcountHistory?.yearly?.['2023'] || 0

          return {
            id: doc.id,
            name: p.beneficiaryName || 'Unknown SME',
            interventions: totalInterventions,
            revenue: revenue,
            headCount: headCount,
            stage: p.stage || 'Unknown'
          }
        })

        setSMEs(data)
      } catch (error) {
        console.error('Error fetching SMEs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSMEs()
  }, [])

  const stageCounts = smes.reduce<Record<string, number>>((acc, sme) => {
    acc[sme.stage] = (acc[sme.stage] || 0) + 1
    return acc
  }, {})

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
        type: 'spline',
        data: smes.map(s => s.revenue)
      }
    ]
  }

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

      {loading ? (
        <Spin size='large' />
      ) : (
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
              <HighchartsReact
                highcharts={Highcharts}
                options={headCountChart}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card>
              <HighchartsReact
                highcharts={Highcharts}
                options={lifeCycleChart}
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )
}
