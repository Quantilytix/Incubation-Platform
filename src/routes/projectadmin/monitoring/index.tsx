import React, { useEffect, useState } from 'react'
import { Alert, Spin, Tabs, Typography, Card, Select, Row, Col } from 'antd'
import type { TabsProps } from 'antd'
import { Helmet } from 'react-helmet'
import StickyBox from 'react-sticky-box'
import { auth, db } from '@/firebase'
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore'
import { motion } from 'framer-motion'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import drilldown from 'highcharts/modules/drilldown'

if (typeof drilldown === 'function') {
  drilldown(Highcharts)
}

const { Title } = Typography
const { Option } = Select

Highcharts.setOptions({
  credits: { enabled: false }
})

const chartTypes = [
  'Interventions per Month',
  'Interventions per Sector',
  'Most Required Interventions',
  'Required vs Completed Interventions'
]

const MonitoringEvaluationEvaluation: React.FC = () => {
  const [companyCode, setCompanyCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [interventionData, setInterventionData] = useState<any[]>([])
  const [participantsMap, setParticipantsMap] = useState<Record<string, any>>(
    {}
  )
  const [selectedGender, setSelectedGender] = useState('All')
  const [selectedProvince, setSelectedProvince] = useState('All')
  const [selectedChartType, setSelectedChartType] = useState(chartTypes[0])
  const [chartOptions, setChartOptions] = useState<Highcharts.Options>({})

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

        setCompanyCode(userSnap.data().companyCode)
      } catch (err) {
        console.error(err)
        setCompanyCode(null)
      }
      setLoading(false)
    }

    fetchCompanyCode()
  }, [])

  // 🔄 Fetch participants and interventions once
  useEffect(() => {
    const fetchData = async () => {
      // Fetch participants
      const participantsSnap = await getDocs(collection(db, 'participants'))
      const participantMap: Record<string, any> = {}
      participantsSnap.docs.forEach(doc => {
        participantMap[doc.id] = { id: doc.id, ...doc.data() }
      })

      setParticipantsMap(participantMap)

      // Fetch interventions
      const interventionsSnap = await getDocs(
        collection(db, 'interventionsDatabase')
      )
      const allInterventions = interventionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // Filter based on selectedGender and selectedProvince
      const filtered = allInterventions.filter(intv => {
        const participant = participantMap[intv.participantId]
        if (!participant) return false
        const matchGender =
          selectedGender === 'All' || participant.gender === selectedGender
        const matchProvince =
          selectedProvince === 'All' ||
          participant.province === selectedProvince
        return matchGender && matchProvince
      })

      setInterventionData(filtered)
    }

    fetchData()
  }, [selectedGender, selectedProvince])

  // Chart Logic
  useEffect(() => {
    const generateChart = async () => {
      if (!interventionData.length || !Object.keys(participantsMap).length)
        return

      if (selectedChartType === 'Interventions per Month') {
        const monthCounts: Record<string, number> = {}

        interventionData.forEach(i => {
          const date = i.confirmedAt?.toDate?.()
          if (date) {
            const label = new Intl.DateTimeFormat('en-US', {
              month: 'short',
              year: '2-digit'
            }).format(date) // e.g., Jan 23
            monthCounts[label] = (monthCounts[label] || 0) + 1
          }
        })

        const categories = Object.keys(monthCounts)
        const data = categories.map(label => monthCounts[label])

        setChartOptions({
          chart: { type: 'column' },
          title: { text: 'Interventions per Month' },
          xAxis: { categories, title: { text: 'Month' } },
          yAxis: { title: { text: 'Number of Interventions' } },
          plotOptions: {
            column: {
              borderRadius: 12,
              pointPadding: 0.2,
              groupPadding: 0.1
            },
            series: {
              dataLabels: {
                enabled: true,
                format: '{point.y}'
              }
            }
          },
          credits: { enabled: false },
          series: [{ name: 'Interventions', type: 'column', data }]
        })
      } else if (selectedChartType === 'Interventions per Sector') {
        const sectorCounts: Record<string, number> = {}

        interventionData.forEach(i => {
          const participant = participantsMap[i.participantId]
          const sector = participant?.sector || 'Unknown'
          sectorCounts[sector] = (sectorCounts[sector] || 0) + 1
        })

        const data = Object.entries(sectorCounts).map(([name, y]) => ({
          name,
          y
        }))

        setChartOptions({
          chart: { type: 'pie' },
          title: { text: 'Interventions by Sector' },
          plotOptions: {
            pie: {
              allowPointSelect: true,
              cursor: 'pointer',
              dataLabels: {
                enabled: true,
                format: '{point.name}: {point.y}'
              }
            }
          },
          credits: { enabled: false },
          series: [
            {
              name: 'Interventions',
              type: 'pie',
              colorByPoint: true,
              data
            }
          ]
        })
      } else if (selectedChartType === 'Most Required Interventions') {
        const appSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('status', '==', 'accepted')
          )
        )
        const requiredCount: Record<string, number> = {}

        appSnap.docs.forEach(doc => {
          const required = doc.data().interventions?.required || []
          required.forEach((title: string) => {
            requiredCount[title] = (requiredCount[title] || 0) + 1
          })
        })

        const categories = Object.keys(requiredCount)
        const data = categories.map(k => requiredCount[k])

        setChartOptions({
          chart: { type: 'bar' },
          title: {
            text: 'Most Required Interventions'
          },
          xAxis: { categories, title: { text: 'Intervention' } },
          yAxis: { title: { text: 'Required Count' } },
          plotOptions: {
            bar: {
              borderRadius: 12,
              pointPadding: 0.2,
              groupPadding: 0.1
            },
            series: {
              dataLabels: {
                enabled: true,
                format: '{point.y}'
              }
            }
          },
          credits: { enabled: false },
          series: [{ name: 'Required', type: 'bar', data }]
        })
      } else if (selectedChartType === 'Required vs Completed Interventions') {
        const appSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('status', '==', 'accepted')
          )
        )

        const requiredAreaMap: Record<string, number> = {}

        appSnap.docs.forEach(doc => {
          const required: string[] = doc.data().interventions?.required || []
          required.forEach(title => {
            // Use the intervention title as key (will map later to area)
            requiredAreaMap[title] = (requiredAreaMap[title] || 0) + 1
          })
        })

        const interventionSnap = await getDocs(
          collection(db, 'interventionsDatabase')
        )

        const titleToAreaMap: Record<string, string> = {}
        const completedAreaMap: Record<string, number> = {}

        interventionSnap.docs.forEach(doc => {
          const data = doc.data()
          const title = data.interventionTitle || 'Untitled'
          const area = data.areaOfSupport || 'Unknown'
          titleToAreaMap[title] = area
          completedAreaMap[area] = (completedAreaMap[area] || 0) + 1
        })

        const resolvedRequiredByArea: Record<string, number> = {}

        Object.entries(requiredAreaMap).forEach(([title, count]) => {
          const area = titleToAreaMap[title] || 'Unknown'
          resolvedRequiredByArea[area] =
            (resolvedRequiredByArea[area] || 0) + count
        })

        const drilldownSeries: Highcharts.DrilldownSeriesOptions[] = []

        // Prepare drilldown for Required
        drilldownSeries.push({
          id: 'required',
          type: 'pie',
          data: Object.entries(resolvedRequiredByArea).map(([area, count]) => [
            area,
            count
          ])
        })

        // Prepare drilldown for Completed
        drilldownSeries.push({
          id: 'completed',
          type: 'pie',
          data: Object.entries(completedAreaMap).map(([area, count]) => [
            area,
            count
          ])
        })

        setChartOptions({
          chart: {
            type: 'pie'
          },
          title: { text: 'Required vs Completed Interventions' },
          plotOptions: {
            pie: {
              allowPointSelect: true,
              cursor: 'pointer',
              borderRadius: 12,
              dataLabels: {
                enabled: true,
                format: '{point.name}: {point.y}'
              }
            }
          },
          credits: { enabled: false },
          tooltip: {
            headerFormat: '',
            pointFormat: '<b>{point.name}</b>: {point.y}'
          },
          series: [
            {
              name: 'Overall',
              type: 'pie',
              colorByPoint: true,
              data: [
                {
                  name: 'Required',
                  y: Object.values(resolvedRequiredByArea).reduce(
                    (a, b) => a + b,
                    0
                  ),
                  drilldown: 'required'
                },
                {
                  name: 'Completed',
                  y: Object.values(completedAreaMap).reduce((a, b) => a + b, 0),
                  drilldown: 'completed'
                }
              ]
            }
          ],
          drilldown: {
            series: drilldownSeries
          }
        })
      }
    }

    generateChart()
  }, [interventionData, selectedChartType, participantsMap])

  const renderTabBar: TabsProps['renderTabBar'] = (props, DefaultTabBar) => (
    <StickyBox offsetTop={64} offsetBottom={20} style={{ zIndex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <DefaultTabBar {...props} style={{ background: '#fff' }} />
      </div>
    </StickyBox>
  )

  const tabItems: TabsProps['items'] = [
    {
      key: '1',
      label: 'Intervention Metrics',
      children: (
        <Row gutter={[24, 24]}>
          <Col xs={24}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card
                hoverable
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #d6e4ff'
                }}
                title='📊 Intervention Breakdown'
                extra={
                  <Select
                    value={selectedChartType}
                    onChange={setSelectedChartType}
                    style={{ width: 280 }}
                  >
                    {chartTypes.map(type => (
                      <Option key={type} value={type}>
                        {type}
                      </Option>
                    ))}
                  </Select>
                }
              >
                <HighchartsReact
                  highcharts={Highcharts}
                  options={chartOptions}
                />
              </Card>
            </motion.div>
          </Col>
        </Row>
      )
    },
    {
      key: '2',
      label: 'Company Breakdown',
      children: (
        <Alert
          message='This section will show company-level intervention insights.'
          type='info'
        />
      )
    },
    {
      key: '3',
      label: 'Challenge Frequency',
      children: (
        <Alert
          message='Heatmap of challenges will be added soon.'
          type='info'
        />
      )
    }
  ]

  return (
    <>
      <Helmet>
        <title>Monitoring & Evaluation | Smart Incubation Platform</title>
      </Helmet>

      {loading ? (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Spin tip='Loading company info...' size='large' />
        </div>
      ) : (
        <div style={{ padding: 24, minHeight: '100vh' }}>
          <Alert
            message='📊 This dashboard helps you analyze intervention trends, company performance, and common challenges faced by participants.'
            type='info'
            showIcon
            style={{ marginBottom: 24 }}
          />
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col>
              <Select
                value={selectedGender}
                onChange={setSelectedGender}
                style={{ width: 160 }}
              >
                <Option value='All'>All Genders</Option>
                <Option value='Male'>Male</Option>
                <Option value='Female'>Female</Option>
              </Select>
            </Col>
            <Col>
              <Select
                value={selectedProvince}
                onChange={setSelectedProvince}
                style={{ width: 180 }}
              >
                <Option value='All'>All Provinces</Option>
                <Option value='Gauteng'>Gauteng</Option>
                <Option value='Western Cape'>Western Cape</Option>
                <Option value='KwaZulu-Natal'>KwaZulu-Natal</Option>
              </Select>
            </Col>
          </Row>

          <Tabs
            defaultActiveKey='1'
            renderTabBar={renderTabBar}
            items={tabItems}
            style={{ marginTop: 15 }}
          />
        </div>
      )}
    </>
  )
}

export default MonitoringEvaluationEvaluation
