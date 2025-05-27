import React, { useEffect, useState } from 'react'
import { Typography, Row, Col, Card, Spin, message, Select } from 'antd'
import { db } from '@/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { Helmet } from 'react-helmet'

const { Title } = Typography
const { Option } = Select

interface Beneficiary {
  id: string
  name: string
  interventions: number
  revenue: number
  headCount: {
    permanent: number
    temporary: number
  }
  stage: string
}

export const ProjectAnalytics: React.FC = () => {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [loading, setLoading] = useState(true)
  const [timeScope, setTimeScope] = useState<'annual' | 'monthly'>('annual')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [consultantId, setConsultantId] = useState<string>('')

  // 1. Find consultant and their assigned participantIds on mount
  useEffect(() => {
    const fetchConsultantParticipants = async () => {
      const auth = getAuth()
      const user = auth.currentUser
      if (!user?.email) return
      const consultantSnap = await getDocs(
        query(collection(db, 'consultants'), where('email', '==', user.email))
      )
      if (consultantSnap.empty) {
        message.error('Consultant not found')
        return
      }
      const consultantId = consultantSnap.docs[0].id
      console.log(consultantId)
      setConsultantId(consultantId)
      // Assigned Interventions
      const interventionsSnap = await getDocs(
        query(
          collection(db, 'assignedInterventions'),
          where('consultantId', '==', consultantId)
        )
      )
      const ids = [
        ...new Set(interventionsSnap.docs.map(doc => doc.data().participantId))
      ]
      setParticipantIds(ids)
    }
    onAuthStateChanged(getAuth(), user => {
      if (user) fetchConsultantParticipants()
    })
  }, [])

  // 2. When participantIds or timeScope changes, fetch periods
  useEffect(() => {
    const fetchPeriods = async () => {
      if (participantIds.length === 0) return
      const participantsSnap = await getDocs(collection(db, 'participants'))
      const participants = participantsSnap.docs
        .filter(doc => participantIds.includes(doc.id))
        .map(doc => doc.data())
      let months = new Set<string>()
      let years = new Set<string>()
      participants.forEach(p => {
        Object.keys(p.revenueHistory?.monthly || {}).forEach(m => months.add(m))
        Object.keys(p.revenueHistory?.annual || {}).forEach(y => years.add(y))
      })
      const monthsArr = Array.from(months)
      const yearsArr = Array.from(years)
      setAvailableMonths(monthsArr)
      setAvailableYears(yearsArr)
      // Set default period if needed
      if (!selectedPeriod) {
        setSelectedPeriod(
          timeScope === 'annual' ? yearsArr[0] || '' : monthsArr[0] || ''
        )
      }
    }
    fetchPeriods()
    // eslint-disable-next-line
  }, [participantIds, timeScope])

  // 3. Main fetch for chart data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        if (participantIds.length === 0 || !selectedPeriod) {
          setBeneficiaries([])
          return
        }
        const participantsSnap = await getDocs(collection(db, 'participants'))
        const matched = participantsSnap.docs
          .filter(doc => participantIds.includes(doc.id))
          .map(doc => {
            const p = doc.data()
            const interventionsAssigned = p.interventions?.required?.length || 5
            const interventionsCompleted =
              p.interventions?.completed?.length || 0
            const totalInterventions =
              interventionsAssigned + interventionsCompleted

            const revenue = p.revenueHistory?.[timeScope]?.[selectedPeriod] || 0
            const headData =
              p.headcountHistory?.[timeScope]?.[selectedPeriod] || {}

            return {
              id: doc.id,
              name: p.beneficiaryName || 'Unknown',
              interventions: totalInterventions,
              revenue,
              headCount: {
                permanent: headData.permanent || 0,
                temporary: headData.temporary || 0
              },
              stage: p.stage || 'Unknown'
            }
          })
        setBeneficiaries(matched)
      } catch (error) {
        console.error('Error loading analytics data:', error)
        message.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    // eslint-disable-next-line
  }, [participantIds, timeScope, selectedPeriod])

  const stageCounts = beneficiaries.reduce<Record<string, number>>(
    (acc, sme) => {
      acc[sme.stage] = (acc[sme.stage] || 0) + 1
      return acc
    },
    {}
  )

  const chartOptions = {
    interventions: {
      chart: { type: 'column' },
      title: { text: 'Interventions per Beneficiary' },
      xAxis: { categories: beneficiaries.map(s => s.name) },
      yAxis: { title: { text: 'Interventions' } },
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
          name: 'Interventions',
          type: 'column',
          data: beneficiaries.map(s => s.interventions)
        }
      ]
    },
    revenue: {
      title: { text: 'Revenue by Beneficiary (R)' },
      xAxis: { categories: beneficiaries.map(s => s.name) },
      yAxis: {
        title: { text: 'Revenue (R)' },
        labels: {
          formatter: function () {
            return 'R' + Number(this.value).toLocaleString()
          }
        }
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
          name: 'Revenue',
          type: 'column',
          data: beneficiaries.map(s => s.revenue)
        }
      ]
    },
    headCount: {
      chart: { type: 'bar' },
      title: { text: `Head Count` },
      xAxis: { categories: beneficiaries.map(s => s.name) },
      yAxis: { title: { text: 'Employees' } },
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
          name: 'Permanent',
          type: 'bar',
          data: beneficiaries.map(s => s.headCount.permanent)
        },
        {
          name: 'Temporary',
          type: 'bar',
          data: beneficiaries.map(s => s.headCount.temporary)
        }
      ]
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Helmet>
        <title>Project Analytics | Smart Incubation</title>
      </Helmet>
      <Title level={3}>Project Analytics</Title>

      {loading ? (
        <div
          style={{
            display: 'flex',
            height: '100vh',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Spin tip='Loading analytics...' size='large' />
        </div>
      ) : (
        <>
          <Row style={{ marginBottom: 16 }} gutter={16}>
            <Col>
              <Select
                value={timeScope}
                onChange={val => {
                  setTimeScope(val)
                  setSelectedPeriod('') // clear so period resets when scope changes
                }}
              >
                <Option value='annual'>Annual</Option>
                <Option value='monthly'>Monthly</Option>
              </Select>
            </Col>
            <Col>
              <Select
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                style={{ minWidth: 120 }}
              >
                {(timeScope === 'annual'
                  ? availableYears
                  : availableMonths
                ).map(period => (
                  <Option key={period} value={period}>
                    {period}
                  </Option>
                ))}
              </Select>
            </Col>
          </Row>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <Card>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={chartOptions.interventions}
                />
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={chartOptions.revenue}
                />
              </Card>
            </Col>

            <Col xs={32} lg={24}>
              <Card>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={chartOptions.headCount}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
